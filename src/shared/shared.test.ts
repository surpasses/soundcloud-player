import { describe, expect, it } from 'vitest'
import { findAppVersion, findClientId, findScriptUrls } from './clientId'
import { classifyTrack } from './transcoding'
import type { SCTrack, SCTranscoding } from './types'

const tc = (protocol: string, preset: string, snipped = false): SCTranscoding => ({
  url: `https://api-v2.soundcloud.com/media/x/${preset}/${protocol}`,
  preset,
  duration: 1000,
  snipped,
  quality: 'sq',
  format: { protocol, mime_type: 'audio/mpeg' }
})

const track = (transcodings: SCTranscoding[], policy = 'ALLOW'): SCTrack =>
  ({ id: 1, kind: 'track', title: 't', user: {}, policy, media: { transcodings } }) as unknown as SCTrack

describe('classifyTrack', () => {
  it('prefers HLS AAC 160k, then progressive MP3', () => {
    const r = classifyTrack(track([tc('progressive', 'mp3_1_0'), tc('hls', 'aac_96k'), tc('hls', 'aac_160k')]))
    expect(r.playable && r.transcoding.preset).toBe('aac_160k')
    const r2 = classifyTrack(track([tc('hls', 'aac_96k'), tc('hls', 'mp3_1_0'), tc('progressive', 'mp3_1_0')]))
    expect(r2.playable && r2.transcoding.format.protocol).toBe('progressive')
  })

  it('never selects DRM streams', () => {
    const r = classifyTrack(track([tc('cbc-encrypted-hls', 'aac_160k'), tc('ctr-encrypted-hls', 'aac_160k')], 'MONETIZE'))
    expect(r).toEqual({ playable: false, reason: 'drm' })
  })

  it('treats open streams next to encrypted ones as decoys', () => {
    // Seen live: these MP3 entries return 404 when resolved.
    const r = classifyTrack(track([tc('ctr-encrypted-hls', 'aac_160k'), tc('hls', 'mp3_1_0'), tc('progressive', 'mp3_1_0')], 'MONETIZE'))
    expect(r).toEqual({ playable: false, reason: 'drm' })
  })

  it('prefers 256k AAC and keeps the rest as ordered fallbacks, skipping abr', () => {
    const r = classifyTrack(
      track([tc('hls', 'abr_sq'), tc('progressive', 'mp3_1_0'), tc('hls', 'aac_160k'), tc('hls', 'aac_256k'), tc('hls', 'aac_96k')])
    )
    if (!r.playable) throw new Error('expected playable')
    expect([r.transcoding, ...r.fallbacks].map((t) => t.preset)).toEqual(['aac_256k', 'aac_160k', 'mp3_1_0', 'aac_96k'])
  })

  it('reports Go+ previews as preview-only', () => {
    const r = classifyTrack(track([tc('hls', 'mp3_1_0', true), tc('progressive', 'mp3_1_0', true)], 'SNIP'))
    expect(r).toEqual({ playable: false, reason: 'preview-only' })
  })

  it('handles blocked tracks and playlist stubs', () => {
    expect(classifyTrack(track([tc('hls', 'aac_160k')], 'BLOCK'))).toEqual({ playable: false, reason: 'blocked' })
    expect(classifyTrack({ id: 5, kind: 'track' })).toEqual({ playable: false, reason: 'stub' })
  })
})

describe('client_id scraping', () => {
  it('finds bundle URLs, the client_id and the app version', () => {
    const html = `<script>window.__sc_version="1790362417"</script>
      <script crossorigin src="https://a-v2.sndcdn.com/assets/0-abc.js"></script>
      <script crossorigin src="https://a-v2.sndcdn.com/assets/55-def.js"></script>`
    expect(findScriptUrls(html)).toEqual([
      'https://a-v2.sndcdn.com/assets/0-abc.js',
      'https://a-v2.sndcdn.com/assets/55-def.js'
    ])
    expect(findAppVersion(html)).toBe('1790362417')
    expect(findClientId('e={foo:1,client_id:"Abc123Def456Ghi789Jkl012Mno345Pq",env:"production"}')).toBe(
      'Abc123Def456Ghi789Jkl012Mno345Pq'
    )
    expect(findClientId('nothing here')).toBeNull()
  })
})
