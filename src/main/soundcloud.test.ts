import { describe, expect, it } from 'vitest'
import { classifyTrack } from '../shared/transcoding'
import type { SCPage, SCPlaylist, SCTrack } from '../shared/types'
import { SoundCloudClient, type FetchLike } from './soundcloud'

const HOME = '<script crossorigin src="https://a-v2.sndcdn.com/assets/1-a.js"></script>'
const bundle = (id: string): string => `x={client_id:"${id}"}`
const ID_A = 'a'.repeat(32)
const ID_B = 'b'.repeat(32)

describe('SoundCloudClient', () => {
  it('scrapes a client_id and adds it (plus the auth header) to requests', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetch: FetchLike = async (url, init) => {
      calls.push({ url, init })
      if (url === 'https://soundcloud.com/') return new Response(HOME)
      if (url.endsWith('1-a.js')) return new Response(bundle(ID_A))
      return Response.json({ ok: 1 })
    }
    const client = new SoundCloudClient({ fetch, getToken: async () => 'tok' })
    const res = await client.request({ path: '/me', query: { limit: 5, skip: undefined } })

    expect(res).toEqual({ ok: true, status: 200, data: { ok: 1 } })
    const api = new URL(calls.at(-1)!.url)
    expect(api.pathname).toBe('/me')
    expect(api.searchParams.get('client_id')).toBe(ID_A)
    expect(api.searchParams.get('limit')).toBe('5')
    expect(api.searchParams.has('skip')).toBe(false)
    expect((calls.at(-1)!.init!.headers as Record<string, string>).Authorization).toBe('OAuth tok')
  })

  it('replaces the stale client_id inside a next_href', async () => {
    const fetch: FetchLike = async () => Response.json({})
    const client = new SoundCloudClient({
      fetch,
      getToken: async () => null,
      loadCredentials: () => ({ clientId: ID_B, appVersion: '1', fetchedAt: Date.now() })
    })
    const url = client.buildUrl(
      { path: `https://api-v2.soundcloud.com/stream?cursor=xyz&client_id=${ID_A}` },
      { clientId: ID_B, appVersion: '1', fetchedAt: 0 }
    )
    expect(url.searchParams.get('client_id')).toBe(ID_B)
    expect(url.searchParams.get('cursor')).toBe('xyz')
  })

  it('refuses to send requests (and the token) to other hosts', async () => {
    const client = new SoundCloudClient({
      fetch: async () => Response.json({}),
      getToken: async () => 'tok',
      loadCredentials: () => ({ clientId: ID_A, appVersion: null, fetchedAt: Date.now() })
    })
    const res = await client.request({ path: 'https://evil.example.com/steal' })
    expect(res.ok).toBe(false)
  })

  it('re-scrapes the client_id once when an old one is rejected', async () => {
    let scrapes = 0
    const fetch: FetchLike = async (url) => {
      if (url === 'https://soundcloud.com/') return new Response(HOME)
      if (url.endsWith('1-a.js')) {
        scrapes++
        return new Response(bundle(ID_B))
      }
      const id = new URL(url).searchParams.get('client_id')
      return id === ID_B ? Response.json({ fine: true }) : new Response('{"error":"nope"}', { status: 401 })
    }
    const client = new SoundCloudClient({
      fetch,
      getToken: async () => null,
      // An hour-old cached id that SoundCloud has since rotated.
      loadCredentials: () => ({ clientId: ID_A, appVersion: null, fetchedAt: Date.now() - 3_600_000 })
    })
    const res = await client.request({ path: '/tracks/1' })
    expect(res).toEqual({ ok: true, status: 200, data: { fine: true } })
    expect(scrapes).toBe(1)
  })

  it('surfaces API errors without throwing', async () => {
    const client = new SoundCloudClient({
      fetch: async () => new Response('{"error":"Not Found"}', { status: 404 }),
      getToken: async () => null,
      loadCredentials: () => ({ clientId: ID_A, appVersion: null, fetchedAt: Date.now() })
    })
    expect(await client.request({ path: '/tracks/0' })).toEqual({ ok: false, status: 404, error: 'Not Found' })
  })
})

// Live check against the real API. Run with `npm run smoke`.
describe.skipIf(!process.env.SMOKE)('live api-v2 smoke test', () => {
  const client = new SoundCloudClient({ fetch: (u, i) => fetch(u, i), getToken: async () => null })

  it('searches, resolves a playable stream and hydrates a playlist', { timeout: 30_000 }, async () => {
    const search = await client.request<SCPage<SCTrack>>({ path: '/search/tracks', query: { q: 'lofi', limit: 20 } })
    if (!search.ok) throw new Error(search.error)
    const playable = search.data.collection.map((t) => ({ t, p: classifyTrack(t) })).find((x) => x.p.playable)
    expect(playable).toBeDefined()
    const p = playable!.p as Extract<ReturnType<typeof classifyTrack>, { playable: true }>

    const stream = await client.request<{ url: string }>({
      path: p.transcoding.url,
      query: { track_authorization: playable!.t.track_authorization }
    })
    if (!stream.ok) throw new Error(stream.error)
    const media = await fetch(stream.data.url, { headers: { Range: 'bytes=0-1000' } })
    expect(media.ok).toBe(true)
    expect(media.headers.get('access-control-allow-origin')).toBe('*')

    const lists = await client.request<SCPage<SCPlaylist>>({ path: '/search/playlists', query: { q: 'lofi', limit: 1 } })
    if (!lists.ok) throw new Error(lists.error)
    const pl = await client.request<SCPlaylist>({
      path: `/playlists/${lists.data.collection[0].id}`,
      query: { representation: 'full' }
    })
    if (!pl.ok) throw new Error(pl.error)
    const stubIds = pl.data.tracks!.filter((t) => !('title' in t)).slice(0, 10).map((t) => t.id)
    if (stubIds.length) {
      const hydrated = await client.request<SCTrack[]>({ path: '/tracks', query: { ids: stubIds.join(',') } })
      if (!hydrated.ok) throw new Error(hydrated.error)
      expect(hydrated.data.length).toBeGreaterThan(0)
    }
  })
})
