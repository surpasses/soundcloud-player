/**
 * Reduce SoundCloud's waveform samples (usually 1800 values, 0–140) to `bars`
 * peaks normalised to 0–1. Uses the max of each window so transients survive.
 */
export function downsample(samples: number[], bars: number): number[] {
  if (samples.length === 0 || bars <= 0) return []
  const out: number[] = []
  const step = samples.length / bars
  for (let i = 0; i < bars; i++) {
    const start = Math.floor(i * step)
    const end = Math.max(start + 1, Math.floor((i + 1) * step))
    let peak = 0
    for (let j = start; j < end && j < samples.length; j++) peak = Math.max(peak, samples[j])
    out.push(peak)
  }
  const max = Math.max(...out) || 1
  return out.map((v) => v / max)
}

const cache = new Map<string, Promise<number[] | null>>()

/** `waveform_url` points at wave.sndcdn.com JSON (served with CORS `*`). */
export function fetchWaveform(url: string | undefined): Promise<number[] | null> {
  if (!url || !url.endsWith('.json')) return Promise.resolve(null)
  let hit = cache.get(url)
  if (!hit) {
    hit = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { samples?: number[] } | null) => (Array.isArray(d?.samples) ? d.samples : null))
      .catch(() => null)
    cache.set(url, hit)
  }
  return hit
}
