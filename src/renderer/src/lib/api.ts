import { isFullTrack } from '@shared/transcoding'
import type {
  ApiRequest,
  SCFeedItem,
  SCLibraryItem,
  SCPage,
  SCPlaylist,
  SCTrack,
  SCTrackLike,
  SCTrackStub,
  SCTranscoding,
  SCUser
} from '@shared/types'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

export async function api<T>(req: ApiRequest): Promise<T> {
  const res = await window.sc.request<T>(req)
  if (!res.ok) throw new ApiError(res.error, res.status)
  return res.data
}

const paged = { linked_partitioning: 1 }

/** Follow a `next_href` from any paginated response. */
export const nextPage = <T>(href: string): Promise<SCPage<T>> => api({ path: href })

export const feed = (): Promise<SCPage<SCFeedItem>> => api({ path: '/stream', query: { limit: 40, ...paged } })

export const trackLikes = (userId: number): Promise<SCPage<SCTrackLike>> =>
  api({ path: `/users/${userId}/track_likes`, query: { limit: 50, ...paged } })

export const library = (): Promise<SCPage<SCLibraryItem>> =>
  api({ path: '/me/library/all', query: { limit: 50, ...paged } })

/** `key` is a numeric playlist id, or a system-playlist URN (daily mixes etc). */
export function playlist(key: string): Promise<SCPlaylist> {
  const path = key.includes('system-playlists') ? `/system-playlists/${key}` : `/playlists/${key}`
  return api({ path, query: { representation: 'full' } })
}

/** Playlists only embed the first few tracks in full; fetch the rest in batches. */
export async function hydrateTracks(items: (SCTrack | SCTrackStub)[]): Promise<SCTrack[]> {
  const known = new Map<number, SCTrack>()
  for (const t of items) if (isFullTrack(t)) known.set(t.id, t)
  const missing = items.filter((t) => !known.has(t.id)).map((t) => t.id)
  const batches: number[][] = []
  for (let i = 0; i < missing.length; i += 50) batches.push(missing.slice(i, i + 50))
  const results = await Promise.all(batches.map((ids) => api<SCTrack[]>({ path: '/tracks', query: { ids: ids.join(',') } })))
  for (const t of results.flat()) known.set(t.id, t)
  // Keep playlist order; drop tracks that were deleted or made private.
  return items.map((t) => known.get(t.id)).filter((t): t is SCTrack => !!t)
}

export const searchTracks = (q: string, limit = 30): Promise<SCPage<SCTrack>> =>
  api({ path: '/search/tracks', query: { q, limit, ...paged } })

export const searchPlaylists = (q: string, limit = 12): Promise<SCPage<SCPlaylist>> =>
  api({ path: '/search/playlists', query: { q, limit, ...paged } })

export const searchUsers = (q: string, limit = 12): Promise<SCPage<SCUser>> =>
  api({ path: '/search/users', query: { q, limit, ...paged } })

export const user = (id: number): Promise<SCUser> => api({ path: `/users/${id}` })

export const userTracks = (id: number): Promise<SCPage<SCTrack>> =>
  api({ path: `/users/${id}/tracks`, query: { limit: 50, ...paged } })

export const userTopTracks = (id: number): Promise<SCPage<SCTrack>> =>
  api({ path: `/users/${id}/toptracks`, query: { limit: 10, ...paged } })

export const userPlaylists = (id: number): Promise<SCPage<SCPlaylist>> =>
  api({ path: `/users/${id}/playlists_without_albums`, query: { limit: 20, ...paged } })

export const relatedTracks = (id: number, limit = 20): Promise<SCPage<SCTrack>> =>
  api({ path: `/tracks/${id}/related`, query: { limit } })

export async function likedTrackIds(): Promise<number[]> {
  const ids: number[] = []
  let page = await api<SCPage<number>>({ path: '/me/track_likes/ids', query: { limit: 200, ...paged } })
  ids.push(...page.collection)
  // Cap the walk so a huge library can't stall startup.
  for (let i = 0; page.next_href && i < 25; i++) {
    page = await nextPage<number>(page.next_href)
    ids.push(...page.collection)
  }
  return ids
}

export const setTrackLike = (userId: number, trackId: number, liked: boolean): Promise<unknown> =>
  api({ method: liked ? 'PUT' : 'DELETE', path: `/users/${userId}/track_likes/${trackId}` })

export async function resolveStreamUrl(track: SCTrack, transcoding: SCTranscoding): Promise<string> {
  const res = await api<{ url?: string }>({
    path: transcoding.url,
    query: { track_authorization: track.track_authorization }
  })
  if (!res.url) throw new ApiError('SoundCloud returned no stream URL', 200)
  return res.url
}
