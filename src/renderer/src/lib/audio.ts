import Hls, { ErrorTypes, Events } from 'hls.js'
import type { SCTrack, SCTranscoding } from '@shared/types'
import { resolveStreamUrl } from './api'

export interface AudioEvents {
  onTime(positionMs: number, durationMs: number): void
  onPlaying(): void
  onPaused(): void
  onWaiting(): void
  onEnded(): void
  onError(message: string): void
}

/**
 * Wraps a single <audio> element. HLS streams go through hls.js (Chromium has
 * no native HLS); progressive MP3 plays directly. Stream URLs are signed and
 * expire, so a fatal network error triggers one re-resolve at the same spot.
 */
export class AudioEngine {
  readonly el = new Audio()
  private hls: Hls | null = null
  private loadId = 0
  private current: { track: SCTrack; transcoding: SCTranscoding } | null = null
  private retried = false

  constructor(private events: AudioEvents) {
    this.el.preload = 'auto'
    const time = (): void => events.onTime(this.el.currentTime * 1000, (this.el.duration || 0) * 1000)
    this.el.addEventListener('timeupdate', time)
    this.el.addEventListener('durationchange', time)
    this.el.addEventListener('playing', () => {
      this.retried = false
      events.onPlaying()
    })
    this.el.addEventListener('pause', () => events.onPaused())
    this.el.addEventListener('waiting', () => events.onWaiting())
    this.el.addEventListener('ended', () => events.onEnded())
    this.el.addEventListener('error', () => {
      // hls.js reports its own errors; this covers progressive playback.
      if (!this.hls && this.el.src) void this.recover(`Playback error (${this.el.error?.message || this.el.error?.code})`)
    })
  }

  async load(track: SCTrack, transcoding: SCTranscoding, opts: { autoplay: boolean; startMs?: number }): Promise<void> {
    const id = ++this.loadId
    if (this.current?.track.id !== track.id) this.retried = false
    this.current = { track, transcoding }
    this.teardown()
    const url = await resolveStreamUrl(track, transcoding)
    if (id !== this.loadId) return // a newer load superseded this one
    this.attach(url, transcoding.format.protocol === 'hls', (opts.startMs ?? 0) / 1000)
    if (opts.autoplay) await this.play()
  }

  private attach(url: string, isHls: boolean, startSec: number): void {
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ startPosition: startSec, maxBufferLength: 60, enableWorker: true })
      hls.on(Events.ERROR, (_e, data) => {
        if (!data.fatal) return
        if (data.type === ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
        else void this.recover(`Stream error: ${data.details}`)
      })
      hls.loadSource(url)
      hls.attachMedia(this.el)
      this.hls = hls
    } else {
      this.el.src = url
      if (startSec > 0) {
        this.el.addEventListener('loadedmetadata', () => (this.el.currentTime = startSec), { once: true })
      }
    }
  }

  private async recover(message: string): Promise<void> {
    if (!this.current || this.retried) {
      this.events.onError(message)
      return
    }
    this.retried = true
    const wasPlaying = !this.el.paused
    try {
      await this.load(this.current.track, this.current.transcoding, {
        autoplay: wasPlaying,
        startMs: this.el.currentTime * 1000
      })
    } catch (err) {
      this.events.onError(err instanceof Error ? err.message : String(err))
    }
  }

  private teardown(): void {
    this.hls?.destroy()
    this.hls = null
    this.el.removeAttribute('src')
    this.el.load()
  }

  async play(): Promise<void> {
    try {
      await this.el.play()
    } catch (err) {
      // An AbortError just means a newer load interrupted this play() call.
      if (!(err instanceof DOMException && err.name === 'AbortError')) throw err
    }
  }

  pause(): void {
    this.el.pause()
  }

  seek(ms: number): void {
    this.el.currentTime = Math.max(0, ms / 1000)
  }

  setVolume(v: number, muted: boolean): void {
    this.el.volume = Math.min(1, Math.max(0, v))
    this.el.muted = muted
  }

  stop(): void {
    this.loadId++
    this.current = null
    this.teardown()
  }
}
