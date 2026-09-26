// Pulls an accent palette out of cover art so the UI can take on the colours
// of whatever is playing. The pixel maths is pure (and unit tested); the
// image loading at the bottom needs a browser.

export type RGB = [number, number, number]

export interface Palette {
  primary: string
  secondary: string
}

export const DEFAULT_PALETTE: Palette = { primary: '#e9a178', secondary: '#9b7cf0' }

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number): number => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

const hex = (rgb: RGB): string => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')

/** Nudge a colour into a range that reads well as an accent on a dark UI. */
export function toAccent(rgb: RGB): string {
  const [h, s, l] = rgbToHsl(rgb)
  return hex(hslToRgb(h, Math.min(0.85, Math.max(0.45, s)), Math.min(0.72, Math.max(0.6, l))))
}

const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Pick the most prominent vivid hue (primary) and a contrasting one
 * (secondary) from RGBA pixel data. Returns null for greyscale artwork.
 */
export function pickPalette(pixels: Uint8ClampedArray | number[]): Palette | null {
  const BUCKETS = 24
  const score = new Array<number>(BUCKETS).fill(0)
  const sums = Array.from({ length: BUCKETS }, () => [0, 0, 0])
  let pixelsSeen = 0

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue
    pixelsSeen++
    const rgb: RGB = [pixels[i], pixels[i + 1], pixels[i + 2]]
    const [h, s, l] = rgbToHsl(rgb)
    if (s < 0.2 || l < 0.1 || l > 0.92) continue
    // Favour saturated mid-tones over near-black or washed-out pixels.
    const w = s * (1 - Math.abs(l - 0.5) * 1.6)
    if (w <= 0) continue
    const b = Math.floor(h / (360 / BUCKETS)) % BUCKETS
    score[b] += w
    sums[b][0] += rgb[0] * w
    sums[b][1] += rgb[1] * w
    sums[b][2] += rgb[2] * w
  }

  const total = score.reduce((a, b) => a + b, 0)
  if (pixelsSeen === 0 || total / pixelsSeen < 0.03) return null

  const avg = (b: number): RGB => [sums[b][0] / score[b], sums[b][1] / score[b], sums[b][2] / score[b]].map(Math.round) as RGB
  const center = (b: number): number => (b + 0.5) * (360 / BUCKETS)

  const order = score.map((s, b) => [s, b]).sort((x, y) => y[0] - x[0])
  const first = order[0][1]
  const second = order.find(([s, b]) => s > total * 0.04 && hueDistance(center(b), center(first)) >= 40)?.[1]

  const primary = avg(first)
  let secondary: RGB
  if (second !== undefined) secondary = avg(second)
  else {
    // Monochrome-ish art: derive a companion hue so gradients still have depth.
    const [h, s, l] = rgbToHsl(primary)
    secondary = hslToRgb((h + 45) % 360, s, l)
  }
  return { primary: toAccent(primary), secondary: toAccent(secondary) }
}

const cache = new Map<string, Promise<Palette>>()

/** Load artwork (CORS-enabled on sndcdn) into a tiny canvas and read its palette. */
export function paletteFromImage(url: string | null): Promise<Palette> {
  if (!url) return Promise.resolve(DEFAULT_PALETTE)
  let hit = cache.get(url)
  if (!hit) {
    hit = new Promise<Palette>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const size = 32
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = size
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!
          ctx.drawImage(img, 0, 0, size, size)
          resolve(pickPalette(ctx.getImageData(0, 0, size, size).data) ?? DEFAULT_PALETTE)
        } catch {
          resolve(DEFAULT_PALETTE)
        }
      }
      img.onerror = () => resolve(DEFAULT_PALETTE)
      img.src = url
    })
    cache.set(url, hit)
  }
  return hit
}
