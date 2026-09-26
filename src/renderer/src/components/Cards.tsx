import { Heart, Play } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SCPlaylist, SCUser } from '@shared/types'
import { formatCount, playlistArt, userArt } from '../lib/format'
import { classifyTrack } from '@shared/transcoding'
import { playlistQuery } from '../lib/queries'
import { queryClient } from '../lib/queryClient'
import { navigate } from '../state/nav'
import { usePlayer } from '../state/player'
import { toast } from '../state/toast'
import { Art } from './Art'

export function playlistKey(p: SCPlaylist): string {
  return p.kind === 'system-playlist' && p.urn ? p.urn : String(p.id)
}

export function playlistKind(p: SCPlaylist): string {
  if (p.kind === 'system-playlist') return 'Mix'
  if (p.is_album || p.set_type === 'album') return 'Album'
  if (p.set_type === 'ep') return 'EP'
  return 'Playlist'
}

async function playPlaylist(p: SCPlaylist): Promise<void> {
  try {
    const { tracks } = await queryClient.fetchQuery(playlistQuery(playlistKey(p)))
    const first = tracks.findIndex((t) => classifyTrack(t).playable)
    if (first < 0) toast('None of these tracks can be streamed outside SoundCloud')
    else usePlayer.getState().playTracks(tracks, first, p.title)
  } catch {
    toast('Couldn’t load that playlist')
  }
}

export function PlaylistCard({ playlist, subtitle }: { playlist: SCPlaylist; subtitle?: string }) {
  return (
    <button className="card" onClick={() => navigate({ name: 'playlist', key: playlistKey(playlist) })}>
      <span className="card-art-wrap">
        <Art src={playlistArt(playlist, 't300x300')} className="card-art" />
        <span
          className="card-play"
          role="button"
          aria-label={`Play ${playlist.title}`}
          onClick={(e) => {
            e.stopPropagation()
            void playPlaylist(playlist)
          }}
        >
          <Play size={18} fill="currentColor" className="nudge" />
        </span>
      </span>
      <span className="card-title">{playlist.title}</span>
      <span className="card-sub">{subtitle ?? `${playlistKind(playlist)} · ${playlist.user?.username ?? 'SoundCloud'}`}</span>
    </button>
  )
}

export function UserCard({ user }: { user: SCUser }) {
  return (
    <button className="card person" onClick={() => navigate({ name: 'user', id: user.id })}>
      <span className="card-art-wrap">
        <Art src={userArt(user, 't300x300')} className="card-art" round />
      </span>
      <span className="card-title">{user.username}</span>
      <span className="card-sub">{user.followers_count != null ? `${formatCount(user.followers_count)} followers` : 'Artist'}</span>
    </button>
  )
}

export function Shelf({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2 className="section-title">{title}</h2>
        {action}
      </div>
      <div className="shelf-row">{children}</div>
    </section>
  )
}

export function LikedCard({ count }: { count?: number }) {
  return (
    <button className="card" onClick={() => navigate({ name: 'likes' })}>
      <span className="card-art-wrap">
        <span className="card-art liked-art">
          <Heart size={44} fill="currentColor" />
        </span>
      </span>
      <span className="card-title">Liked tracks</span>
      <span className="card-sub">{count ? `${count} tracks` : 'Your hearts'}</span>
    </button>
  )
}
