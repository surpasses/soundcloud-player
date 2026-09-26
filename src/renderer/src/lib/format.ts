import { isFullTrack } from '@shared/transcoding'
import type { SCPlaylist, SCTrack, SCUser } from '@shared/types'

export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

export function formatCount(n: number | null | undefined): string {
  if (n == null) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return String(n)
}

export function formatRelative(iso: string | undefined): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const day = 86_400_000
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))} min ago`
  if (diff < day) return `${Math.round(diff / 3_600_000)} h ago`
  if (diff < 30 * day) return `${Math.round(diff / day)} d ago`
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function yearOf(iso: string | undefined): number | null {
  return iso ? new Date(iso).getFullYear() : null
}

type ArtSize = 't67x67' | 't200x200' | 't300x300' | 't500x500'

/** SoundCloud serves artwork at several sizes by swapping the `-large` suffix. */
export function artUrl(url: string | null | undefined, size: ArtSize = 't300x300'): string | null {
  return url ? url.replace(/-(large|t\d+x\d+|crop|original)\./, `-${size}.`) : null
}

export function trackArt(t: SCTrack, size?: ArtSize): string | null {
  return artUrl(t.artwork_url ?? t.user?.avatar_url, size)
}

export function playlistArt(p: SCPlaylist, size?: ArtSize): string | null {
  const firstTrackArt = p.tracks?.filter(isFullTrack).find((t) => t.artwork_url)?.artwork_url
  return artUrl(p.artwork_url ?? p.calculated_artwork_url ?? firstTrackArt ?? p.user?.avatar_url, size)
}

export function userArt(u: SCUser, size?: ArtSize): string | null {
  return artUrl(u.avatar_url, size)
}

export function artistName(t: SCTrack): string {
  return t.publisher_metadata?.artist || t.user?.username || 'Unknown artist'
}
