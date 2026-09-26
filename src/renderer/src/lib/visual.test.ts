import { describe, expect, it } from 'vitest'
import { pickPalette, toAccent } from './color'
import { downsample } from './waveform'

function pixels(colors: [number, number, number, number][]): number[] {
  return colors.flatMap(([r, g, b, count]) => Array.from({ length: count }, () => [r, g, b, 255]).flat())
}

const hue = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  if (max === r) return (((g - b) / d + 6) % 6) * 60
  if (max === g) return ((b - r) / d + 2) * 60
  return ((r - g) / d + 4) * 60
}

describe('pickPalette', () => {
  it('picks the dominant vivid hue first and a contrasting one second', () => {
    const p = pickPalette(pixels([
      [200, 30, 30, 600], // red, dominant
      [30, 60, 200, 200], // blue
      [10, 10, 10, 224] // near-black background, ignored
    ]))!
    expect(hue(p.primary)).toBeLessThan(15)
    expect(hue(p.secondary)).toBeGreaterThan(200)
    expect(hue(p.secondary)).toBeLessThan(260)
  })

  it('returns null for greyscale artwork', () => {
    expect(pickPalette(pixels([[120, 120, 120, 500], [240, 240, 240, 500]]))).toBeNull()
  })

  it('derives a companion hue for single-colour art', () => {
    const p = pickPalette(pixels([[40, 160, 60, 1000]]))!
    expect(p.primary).not.toBe(p.secondary)
  })

  it('lifts dark colours into a readable accent', () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(toAccent([40, 0, 0]).slice(i, i + 2), 16))
    expect(Math.max(r, g, b)).toBeGreaterThan(180)
  })
})

describe('downsample', () => {
  it('keeps peaks and normalises to 0–1', () => {
    expect(downsample([0, 10, 0, 0, 5, 0], 2)).toEqual([1, 0.5])
    expect(downsample([], 10)).toEqual([])
  })

  it('handles more bars than samples', () => {
    const out = downsample([2, 4], 4)
    expect(out).toHaveLength(4)
    expect(Math.max(...out)).toBe(1)
  })
})
