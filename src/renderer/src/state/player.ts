import { create } from 'zustand'
import { classifyTrack, UNPLAYABLE_LABEL } from '@shared/transcoding'
import type { SCTrack } from '@shared/types'
import { ApiError, relatedTracks } from '../lib/api'
import { AudioEngine } from '../lib/audio'
import { artistName, trackArt } from '../lib/format'
import * as Q from '../lib/queue'
import { toast } from './toast'

type Status = 'idle' | 'loading' | 'playing' | 'paused'

interface PlayerStore {
  queue: Q.QueueState | null
  contextLabel: string
  status: Status
  position: number
  duration: number
  volume: number
  muted: boolean
  autoplay: boolean
  /** Full-screen Now Playing view. */
  stageOpen: boolean

  /** `shuffle` overrides the current shuffle setting (e.g. the Shuffle button). */
  playTracks(tracks: SCTrack[], index: number, contextLabel: string, opts?: { shuffle?: boolean }): void
  togglePlay(): void
  next(): void
  prev(): void
  seek(ms: number): void
  setVolume(v: number): void
  toggleMute(): void
  toggleShuffle(): void
  cycleRepeat(): void
  jump(pos: number): void
  enqueue(track: SCTrack): void
  playNext(track: SCTrack): void
  remove(pos: number): void
  toggleStage(open?: boolean): void
  toggleAutoplay(): void
}

// Small per-device preferences. Storage can be unavailable; fall back quietly.
function pref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`pref:${key}`)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}
function savePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(`pref:${key}`, JSON.stringify(value))
  } catch {
    // ignore
  }
}

const MAX_FAIL_STREAK = 5
let failStreak = 0
let lastPositionSync = 0

export const usePlayer = create<PlayerStore>((set, get) => {
  const engine = new AudioEngine({
    onTime: (position, duration) => {
      set({ position, duration: duration || get().duration })
      if (Date.now() - lastPositionSync > 1000 && duration > 0 && position <= duration) {
        lastPositionSync = Date.now()
        navigator.mediaSession?.setPositionState?.({ duration: duration / 1000, position: position / 1000, playbackRate: 1 })
      }
    },
    onPlaying: () => {
      failStreak = 0
      set({ status: 'playing' })
    },
    onPaused: () => {
      if (get().status !== 'loading') set({ status: 'paused' })
    },
    onWaiting: () => set({ status: 'loading' }),
    onEnded: () => void advance(true),
    onError: (message) => void fail(message)
  })
  engine.setVolume(pref('volume', 0.8), pref('muted', false))

  async function loadCurrent(autoplay: boolean, dir: 1 | -1 = 1, skipped = 0): Promise<void> {
    const q = get().queue
    const track = Q.currentTrack(q)
    if (!q || !track) return stop()

    const verdict = classifyTrack(track)
    if (!verdict.playable) {
      if (skipped + 1 >= q.order.length) {
        toast('Nothing in this queue can be played here')
        return stop()
      }
      if (skipped === 0) toast(`Skipped “${track.title}” — ${UNPLAYABLE_LABEL[verdict.reason]}`)
      const nq = Q.step(q, dir)
      if (!nq) return stop()
      set({ queue: nq })
      return loadCurrent(autoplay, dir, skipped + 1)
    }

    set({ status: 'loading', position: 0, duration: track.full_duration ?? track.duration })
    updateMediaSession(track)
    let lastErr: unknown
    // Try each stream format in preference order; a 404 on one doesn't mean
    // the others are gone too.
    for (const transcoding of [verdict.transcoding, ...verdict.fallbacks]) {
      try {
        await engine.load(track, transcoding, { autoplay })
        if (!autoplay) set({ status: 'paused' })
        return
      } catch (err) {
        lastErr = err
        if (Q.currentTrack(get().queue) !== track) return // user moved on meanwhile
        if (!(err instanceof ApiError) || err.status === 0) break // network trouble: don't hammer
      }
    }
    await fail(lastErr instanceof Error ? lastErr.message : String(lastErr), lastErr instanceof ApiError && lastErr.status === 0)
  }

  /** Skip past a track that failed. Not `auto`, so repeat-one can't loop on it. */
  async function fail(message: string, network = true): Promise<void> {
    if (++failStreak >= MAX_FAIL_STREAK) {
      toast(network ? 'Playback keeps failing — check your connection' : 'SoundCloud won’t serve these tracks right now')
      return stop()
    }
    const t = Q.currentTrack(get().queue)
    toast(t ? `Couldn't play “${t.title}”: ${message}` : message)
    await advance(false)
  }

  async function advance(auto: boolean): Promise<void> {
    const q = get().queue
    if (!q) return
    const nq = Q.step(q, 1, auto)
    if (nq === q) {
      // Repeat-one: replay without re-resolving the stream.
      engine.seek(0)
      await engine.play()
      return
    }
    if (nq) {
      set({ queue: nq })
      return loadCurrent(true)
    }
    if (get().autoplay) {
      const more = await similarTo(q)
      if (more.length > 0) {
        toast('Autoplaying similar tracks')
        set({ queue: Q.step(Q.append(q, more), 1)! })
        return loadCurrent(true)
      }
    }
    engine.pause()
    engine.seek(0)
    set({ status: 'paused', position: 0 })
  }

  async function similarTo(q: Q.QueueState): Promise<SCTrack[]> {
    const seed = Q.currentTrack(q)
    if (!seed) return []
    try {
      const seen = new Set(q.tracks.map((t) => t.id))
      const page = await relatedTracks(seed.id, 30)
      return page.collection.filter((t) => !seen.has(t.id) && classifyTrack(t).playable).slice(0, 15)
    } catch {
      return []
    }
  }

  function stop(): void {
    engine.stop()
    set({ status: 'idle', position: 0 })
    if (navigator.mediaSession) navigator.mediaSession.playbackState = 'none'
  }

  function updateMediaSession(t: SCTrack): void {
    document.title = `${t.title} · ${artistName(t)}`
    if (!navigator.mediaSession) return
    const art = trackArt(t, 't500x500')
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title,
      artist: artistName(t),
      album: get().contextLabel,
      artwork: art ? [{ src: art, sizes: '500x500', type: 'image/jpeg' }] : []
    })
  }

  // Media keys, AirPods controls and the macOS Now Playing widget.
  if (navigator.mediaSession) {
    const ms = navigator.mediaSession
    ms.setActionHandler('play', () => get().togglePlay())
    ms.setActionHandler('pause', () => get().togglePlay())
    ms.setActionHandler('previoustrack', () => get().prev())
    ms.setActionHandler('nexttrack', () => get().next())
    ms.setActionHandler('seekto', (d) => d.seekTime != null && get().seek(d.seekTime * 1000))
    ms.setActionHandler('seekbackward', (d) => get().seek(get().position - (d.seekOffset ?? 10) * 1000))
    ms.setActionHandler('seekforward', (d) => get().seek(get().position + (d.seekOffset ?? 10) * 1000))
  }

  return {
    queue: null,
    contextLabel: '',
    status: 'idle',
    position: 0,
    duration: 0,
    volume: pref('volume', 0.8),
    muted: pref('muted', false),
    autoplay: pref('autoplay', true),
    stageOpen: false,

    playTracks: (tracks, index, contextLabel, opts) => {
      const chosen = tracks[index]
      if (!chosen) return
      const verdict = classifyTrack(chosen)
      if (!verdict.playable) {
        toast(UNPLAYABLE_LABEL[verdict.reason])
        return
      }
      // Leave DRM-only / Go+ tracks out of the queue entirely.
      const playable = tracks.filter((t) => classifyTrack(t).playable)
      failStreak = 0
      const prev = get().queue
      set({
        queue: Q.createQueue(playable, playable.indexOf(chosen), {
          shuffle: opts?.shuffle ?? prev?.shuffle,
          repeat: prev?.repeat
        }),
        contextLabel
      })
      void loadCurrent(true)
    },

    togglePlay: () => {
      const { status, queue } = get()
      if (!queue) return
      if (status === 'idle') void loadCurrent(true)
      else if (engine.el.paused) void engine.play()
      else engine.pause()
    },

    next: () => void advance(false),

    prev: () => {
      const q = get().queue
      if (!q) return
      const pq = get().position > 3000 ? null : Q.step(q, -1)
      if (!pq) return get().seek(0)
      set({ queue: pq })
      void loadCurrent(true, -1)
    },

    seek: (ms) => {
      const clamped = Math.max(0, Math.min(ms, get().duration || ms))
      engine.seek(clamped)
      set({ position: clamped })
    },

    setVolume: (v) => {
      const volume = Math.min(1, Math.max(0, v))
      engine.setVolume(volume, false)
      set({ volume, muted: false })
      savePref('volume', volume)
      savePref('muted', false)
    },

    toggleMute: () => {
      const muted = !get().muted
      engine.setVolume(get().volume, muted)
      set({ muted })
      savePref('muted', muted)
    },

    toggleShuffle: () => {
      const q = get().queue
      if (q) set({ queue: Q.setShuffle(q, !q.shuffle) })
    },

    cycleRepeat: () => {
      const q = get().queue
      if (q) set({ queue: Q.cycleRepeat(q) })
    },

    jump: (pos) => {
      const q = get().queue
      if (!q) return
      set({ queue: Q.jumpTo(q, pos) })
      void loadCurrent(true)
    },

    enqueue: (track) => {
      const q = get().queue
      if (!q) return get().playTracks([track], 0, 'Queue')
      set({ queue: Q.append(q, [track]) })
      toast('Added to queue')
    },

    playNext: (track) => {
      const q = get().queue
      if (!q) return get().playTracks([track], 0, 'Queue')
      set({ queue: Q.insertNext(q, track) })
      toast('Playing next')
    },

    remove: (pos) => {
      const q = get().queue
      if (q) set({ queue: Q.removeAt(q, pos) })
    },

    toggleStage: (open) => set((s) => ({ stageOpen: open ?? !s.stageOpen })),

    toggleAutoplay: () => {
      const autoplay = !get().autoplay
      set({ autoplay })
      savePref('autoplay', autoplay)
    }
  }
})

usePlayer.subscribe((s, prev) => {
  if (s.status !== prev.status && navigator.mediaSession) {
    navigator.mediaSession.playbackState = s.status === 'playing' ? 'playing' : s.status === 'idle' ? 'none' : 'paused'
  }
})

export const useCurrentTrack = (): SCTrack | null => usePlayer((s) => Q.currentTrack(s.queue))
