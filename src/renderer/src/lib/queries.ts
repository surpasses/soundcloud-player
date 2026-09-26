import { hydrateTracks, playlist } from './api'

/** Shared by the playlist page and the play button on playlist cards. */
export const playlistQuery = (key: string) => ({
  queryKey: ['playlist', key],
  queryFn: async () => {
    const p = await playlist(key)
    return { playlist: p, tracks: await hydrateTracks(p.tracks ?? []) }
  }
})
