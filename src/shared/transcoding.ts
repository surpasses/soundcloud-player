import type { SCTrack, SCTrackStub, SCTranscoding } from './types'

export type Playability =
  | { playable: true; transcoding: SCTranscoding; fallbacks: SCTranscoding[] }
  | { playable: false; reason: 'drm' | 'preview-only' | 'blocked' | 'no-stream' | 'stub' }

// Most preferred first. `abr_*` presets are skipped: resolving them returns an
// empty object. aac_256k only appears for Go+ accounts.
const PREFERENCE: { protocol: string; preset: RegExp }[] = [
  { protocol: 'hls', preset: /^aac_256k/ },
  { protocol: 'hls', preset: /^aac_160k/ },
  { protocol: 'progressive', preset: /^aac_/ },
  { protocol: 'progressive', preset: /^mp3_/ },
  { protocol: 'hls', preset: /^mp3_/ },
  { protocol: 'hls', preset: /^aac_96k/ },
  { protocol: 'hls', preset: /^aac_/ },
  { protocol: 'hls', preset: /^opus_/ }
]

export function isFullTrack(t: SCTrack | SCTrackStub): t is SCTrack {
  return 'title' in t && 'user' in t
}

/**
 * Rank the streams this client can actually play. DRM-protected streams
 * (`*-encrypted-hls`) are never selected: this app does not circumvent DRM.
 *
 * When a track has any encrypted stream, its unencrypted entries are decoys —
 * SoundCloud lists them but resolving them returns 404 — so such tracks count
 * as protected.
 */
export function classifyTrack(track: SCTrack | SCTrackStub): Playability {
  if (!isFullTrack(track)) return { playable: false, reason: 'stub' }
  if (track.policy === 'BLOCK') return { playable: false, reason: 'blocked' }

  const all = track.media?.transcodings ?? []
  if (all.some((t) => t.format.protocol.includes('encrypted'))) return { playable: false, reason: 'drm' }

  const open = all.filter((t) => t.format.protocol === 'hls' || t.format.protocol === 'progressive')
  const full = open.filter((t) => !t.snipped && !t.preset.startsWith('abr'))

  const ranked: SCTranscoding[] = []
  for (const pref of PREFERENCE) {
    for (const t of full) {
      if (t.format.protocol === pref.protocol && pref.preset.test(t.preset) && !ranked.includes(t)) ranked.push(t)
    }
  }
  for (const t of full) if (!ranked.includes(t)) ranked.push(t)
  if (ranked.length > 0) return { playable: true, transcoding: ranked[0], fallbacks: ranked.slice(1) }

  if (open.some((t) => t.snipped) || track.policy === 'SNIP') return { playable: false, reason: 'preview-only' }
  return { playable: false, reason: 'no-stream' }
}

export const UNPLAYABLE_LABEL: Record<Exclude<Playability, { playable: true }>['reason'], string> = {
  drm: 'Protected — open on SoundCloud',
  'preview-only': 'SoundCloud Go+ only',
  blocked: 'Not available in your region',
  'no-stream': 'No stream available',
  stub: 'Loading…'
}
