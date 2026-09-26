import { describe, expect, it } from 'vitest'
import type { SCTrack } from '@shared/types'
import {
  append,
  createQueue,
  currentTrack,
  cycleRepeat,
  insertNext,
  removeAt,
  setShuffle,
  step,
  upNext
} from './queue'

const track = (id: number): SCTrack =>
  ({ id, kind: 'track', title: `t${id}`, permalink_url: '', artwork_url: null, duration: 1000, user: {} }) as SCTrack

const tracks = [1, 2, 3, 4, 5].map(track)
// Deterministic stand-in for Math.random.
const rng = (): number => 0

describe('queue', () => {
  it('starts at the requested track', () => {
    expect(currentTrack(createQueue(tracks, 2))?.id).toBe(3)
  })

  it('stops at the end with repeat off, wraps with repeat all', () => {
    const q = createQueue(tracks, 4)
    expect(step(q, 1)).toBeNull()
    expect(currentTrack(step({ ...q, repeat: 'all' }, 1))?.id).toBe(1)
    expect(currentTrack(step({ ...createQueue(tracks, 0), repeat: 'all' }, -1))?.id).toBe(5)
  })

  it('repeat one only holds on automatic advance', () => {
    const q = { ...createQueue(tracks, 1), repeat: 'one' as const }
    expect(currentTrack(step(q, 1, true))?.id).toBe(2)
    expect(currentTrack(step(q, 1, false))?.id).toBe(3)
  })

  it('shuffled queue plays the chosen track first and contains every track', () => {
    const q = createQueue(tracks, 2, { shuffle: true, rng })
    expect(currentTrack(q)?.id).toBe(3)
    expect([...q.order].sort()).toEqual([0, 1, 2, 3, 4])
  })

  it('toggling shuffle keeps the current track and restores order when off', () => {
    const q = createQueue(tracks, 1)
    const on = setShuffle(q, true, rng)
    expect(currentTrack(on)?.id).toBe(2)
    expect(on.order.slice(0, 2)).toEqual([0, 1])
    const off = setShuffle(step(on, 1)!, false)
    expect(off.order).toEqual([0, 1, 2, 3, 4])
    expect(currentTrack(off)?.id).toBe(currentTrack(step(on, 1)!)?.id)
  })

  it('insertNext plays right after the current track', () => {
    const q = insertNext(createQueue(tracks, 0), track(99))
    expect(currentTrack(step(q, 1))?.id).toBe(99)
    expect(upNext(q).map((e) => e.track.id)).toEqual([99, 2, 3, 4, 5])
  })

  it('append adds to the end and removeAt keeps the current track', () => {
    let q = append(createQueue(tracks, 2), [track(6)])
    expect(upNext(q).map((e) => e.track.id)).toEqual([4, 5, 6])
    q = removeAt(q, 0)
    expect(currentTrack(q)?.id).toBe(3)
    expect(upNext(q).map((e) => e.track.id)).toEqual([4, 5, 6])
    expect(removeAt(q, q.pos)).toBe(q)
  })

  it('cycles repeat off → all → one → off', () => {
    const q = createQueue(tracks, 0)
    expect(cycleRepeat(q).repeat).toBe('all')
    expect(cycleRepeat(cycleRepeat(q)).repeat).toBe('one')
    expect(cycleRepeat(cycleRepeat(cycleRepeat(q))).repeat).toBe('off')
  })
})
