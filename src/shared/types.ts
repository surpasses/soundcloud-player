// Shapes returned by SoundCloud's internal api-v2. Only the fields the app uses
// are typed; the real payloads carry many more.

export interface SCUser {
  id: number
  kind: 'user'
  username: string
  permalink_url: string
  avatar_url: string | null
  full_name?: string
  followers_count?: number
  track_count?: number
  description?: string | null
  visuals?: { visuals?: { visual_url: string }[] } | null
}

export interface SCTranscoding {
  url: string
  preset: string
  duration: number
  snipped: boolean
  quality: string
  format: {
    protocol: 'hls' | 'progressive' | 'ctr-encrypted-hls' | 'cbc-encrypted-hls' | string
    mime_type: string
  }
}

export interface SCTrack {
  id: number
  kind: 'track'
  urn?: string
  title: string
  permalink_url: string
  artwork_url: string | null
  waveform_url?: string
  duration: number
  full_duration?: number
  genre?: string | null
  created_at?: string
  display_date?: string
  playback_count?: number | null
  likes_count?: number | null
  policy?: 'ALLOW' | 'MONETIZE' | 'SNIP' | 'BLOCK' | string
  monetization_model?: string
  streamable?: boolean
  track_authorization?: string
  media?: { transcodings: SCTranscoding[] }
  user: SCUser
  publisher_metadata?: { artist?: string } | null
}

/** Playlists only embed full data for the first few tracks; the rest are stubs. */
export interface SCTrackStub {
  id: number
  kind: 'track'
  policy?: string
  monetization_model?: string
}

export interface SCPlaylist {
  id: number
  kind: 'playlist' | 'system-playlist'
  urn?: string
  title: string
  permalink_url: string
  artwork_url: string | null
  calculated_artwork_url?: string | null
  duration?: number
  track_count: number
  is_album?: boolean
  set_type?: string
  user?: SCUser
  tracks?: (SCTrack | SCTrackStub)[]
  description?: string | null
  last_modified?: string
}

export interface SCPage<T> {
  collection: T[]
  next_href: string | null
}

export interface SCFeedItem {
  type: 'track' | 'track-repost' | 'playlist' | 'playlist-repost' | string
  created_at: string
  user: SCUser
  track?: SCTrack
  playlist?: SCPlaylist
}

export interface SCTrackLike {
  created_at: string
  track: SCTrack
}

export interface SCLibraryItem {
  type: string
  created_at: string
  playlist?: SCPlaylist
  system_playlist?: SCPlaylist
}

// ---------------------------------------------------------------------------
// IPC contract between the renderer and the main process.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface ApiRequest {
  method?: HttpMethod
  /** A path like `/tracks/123`, or an absolute api-v2 URL such as a `next_href`. */
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

export type ApiResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string }

export interface AuthState {
  loggedIn: boolean
  user: SCUser | null
}

export interface ScBridge {
  request<T = unknown>(req: ApiRequest): Promise<ApiResult<T>>
  auth: {
    status(): Promise<AuthState>
    login(): Promise<AuthState>
    loginWithToken(token: string): Promise<AuthState & { error?: string }>
    logout(): Promise<AuthState>
    onChange(cb: (state: AuthState) => void): () => void
  }
  openExternal(url: string): Promise<void>
  platform: string
}
