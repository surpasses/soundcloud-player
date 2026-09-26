import type { SCTrack } from '@shared/types'

export type Repeat = 'off' | 'all' | 'one'

/**
 * Immutable play queue. `tracks` never reorders; `order` is the play order as
 * indexes into `tracks`, and `pos` is the current position within `order`.
 * Shuffling only rewrites `order`, so un-shuffling can restore the original.
 */
export interface QueueState {
  tracks: SCTrack[]
  order: number[]
  pos: number
  shuffle: boolean
  repeat: Repeat
}

export type Rng = () => number

function shuffled(indexes: number[], rng: Rng): number[] {
  const a = [...indexes]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function identity(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

export function createQueue(
  tracks: SCTrack[],
  start: number,
  opts: { shuffle?: boolean; repeat?: Repeat; rng?: Rng } = {}
): QueueState {
  const shuffle = opts.shuffle ?? false
  let order = identity(tracks.length)
  let pos = Math.min(Math.max(start, 0), Math.max(tracks.length - 1, 0))
  if (shuffle) {
    // The chosen track plays first, the rest follow in random order.
    order = [pos, ...shuffled(order.filter((i) => i !== pos), opts.rng ?? Math.random)]
    pos = 0
  }
  return { tracks, order, pos, shuffle, repeat: opts.repeat ?? 'off' }
}

export function currentTrack(q: QueueState | null): SCTrack | null {
  if (!q || q.order.length === 0) return null
  return q.tracks[q.order[q.pos]] ?? null
}

/**
 * Move through the queue. `auto` is true when a track finished by itself, which
 * is the only time repeat-one keeps playing the same track. Returns null when
 * playback should stop.
 */
export function step(q: QueueState, dir: 1 | -1, auto = false): QueueState | null {
  if (q.order.length === 0) return null
  if (auto && q.repeat === 'one') return q
  const next = q.pos + dir
  if (next >= 0 && next < q.order.length) return { ...q, pos: next }
  if (q.repeat === 'off') return null
  return { ...q, pos: (next + q.order.length) % q.order.length }
}

export function jumpTo(q: QueueState, pos: number): QueueState {
  if (pos < 0 || pos >= q.order.length) return q
  return { ...q, pos }
}

export function setShuffle(q: QueueState, shuffle: boolean, rng: Rng = Math.random): QueueState {
  if (shuffle === q.shuffle) return q
  const cur = q.order[q.pos]
  if (shuffle) {
    // Keep what has already played, randomise only what is still to come.
    const played = q.order.slice(0, q.pos + 1)
    const rest = q.order.slice(q.pos + 1)
    return { ...q, shuffle, order: [...played, ...shuffled(rest, rng)] }
  }
  const order = identity(q.tracks.length)
  return { ...q, shuffle, order, pos: cur ?? 0 }
}

export function cycleRepeat(q: QueueState): QueueState {
  const nextMode: Record<Repeat, Repeat> = { off: 'all', all: 'one', one: 'off' }
  return { ...q, repeat: nextMode[q.repeat] }
}

/** Append tracks to the end of the queue (used for "Add to queue" and autoplay). */
export function append(q: QueueState, tracks: SCTrack[]): QueueState {
  const base = q.tracks.length
  return {
    ...q,
    tracks: [...q.tracks, ...tracks],
    order: [...q.order, ...tracks.map((_, i) => base + i)]
  }
}

/** Insert a track to play right after the current one. */
export function insertNext(q: QueueState, track: SCTrack): QueueState {
  const idx = q.tracks.length
  const order = [...q.order]
  order.splice(q.pos + 1, 0, idx)
  return { ...q, tracks: [...q.tracks, track], order }
}

/** Remove the entry at play-order position `pos` (never the current track). */
export function removeAt(q: QueueState, pos: number): QueueState {
  if (pos === q.pos || pos < 0 || pos >= q.order.length) return q
  const order = q.order.filter((_, i) => i !== pos)
  return { ...q, order, pos: pos < q.pos ? q.pos - 1 : q.pos }
}

/** Tracks still to come, in play order, with their positions. */
export function upNext(q: QueueState | null): { pos: number; track: SCTrack }[] {
  if (!q) return []
  return q.order.slice(q.pos + 1).map((i, k) => ({ pos: q.pos + 1 + k, track: q.tracks[i] }))
}
