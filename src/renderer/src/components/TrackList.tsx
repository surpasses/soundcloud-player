import { Ellipsis, Heart, Lock, Pause, Play } from 'lucide-react'
import { memo, type ReactNode } from 'react'
import { classifyTrack, UNPLAYABLE_LABEL } from '@shared/transcoding'
import type { SCTrack } from '@shared/types'
import { artistName, formatCount, formatRelative, formatTime, trackArt } from '../lib/format'
import { useAuth } from '../state/auth'
import { navigate } from '../state/nav'
import { useCurrentTrack, usePlayer } from '../state/player'
import { Art } from './Art'
import { Equalizer } from './Bits'
import { useTrackMenu } from './ContextMenu'
import { LoadMore } from './LoadMore'

interface Props {
  tracks: SCTrack[]
  contextLabel: string
  /** Render from this index on; playback still uses the whole list as context. */
  skip?: number
  /** Extra line under the artist, e.g. "reposted by …". */
  note?: (index: number) => ReactNode
  /** Date shown on the right (defaults to upload date). */
  dateOf?: (index: number) => string | undefined
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

export function TrackList({ tracks, contextLabel, skip = 0, note, dateOf, hasMore, loadingMore, onLoadMore }: Props) {
  const current = useCurrentTrack()
  const status = usePlayer((s) => s.status)
  const likedIds = useAuth((s) => s.likedIds)

  return (
    <div className="tracklist" role="list">
      {tracks.slice(skip).map((t, k) => {
        const i = k + skip
        return (
          <TrackRow
            key={`${t.id}-${i}`}
            track={t}
            index={i}
            tracks={tracks}
            contextLabel={contextLabel}
            isCurrent={current?.id === t.id}
            isPlaying={current?.id === t.id && status === 'playing'}
            liked={likedIds.has(t.id)}
            note={note?.(i)}
            date={dateOf?.(i) ?? t.display_date ?? t.created_at}
          />
        )
      })}
      {onLoadMore && <LoadMore hasMore={!!hasMore} loading={!!loadingMore} onLoad={onLoadMore} />}
    </div>
  )
}

interface RowProps {
  track: SCTrack
  index: number
  tracks: SCTrack[]
  contextLabel: string
  isCurrent: boolean
  isPlaying: boolean
  liked: boolean
  note?: ReactNode
  date?: string
}

const TrackRow = memo(function TrackRow({ track, index, tracks, contextLabel, isCurrent, isPlaying, liked, note, date }: RowProps) {
  const verdict = classifyTrack(track)
  const play = (): void => {
    if (isCurrent) usePlayer.getState().togglePlay()
    else usePlayer.getState().playTracks(tracks, index, contextLabel)
  }

  return (
    <div
      role="listitem"
      className={`track-row ${isCurrent ? 'current' : ''} ${verdict.playable ? '' : 'unavailable'}`}
      title={verdict.playable ? undefined : UNPLAYABLE_LABEL[verdict.reason]}
      onDoubleClick={verdict.playable ? play : undefined}
      onContextMenu={(e) => useTrackMenu.getState().show(e, track)}
    >
      <span className="row-index">{isCurrent ? <Equalizer playing={isPlaying} /> : String(index + 1).padStart(2, '0')}</span>

      <div className="row-art">
        <Art src={trackArt(track, 't67x67')} size={44} />
        {verdict.playable ? (
          <button className="row-play" aria-label={isPlaying ? 'Pause' : `Play ${track.title}`} onClick={play}>
            {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
          </button>
        ) : (
          <button
            className="row-play locked"
            aria-label={`${UNPLAYABLE_LABEL[verdict.reason]} — open on SoundCloud`}
            onClick={() => void window.sc.openExternal(track.permalink_url)}
          >
            <Lock size={14} />
          </button>
        )}
      </div>

      <div className="title-text">
        <span className="track-title">{track.title}</span>
        <span className="track-sub">
          {!verdict.playable && <span className="badge">{verdict.reason === 'preview-only' ? 'Go+' : 'Protected'}</span>}
          <button className="link" onClick={() => navigate({ name: 'user', id: track.user.id })}>
            {artistName(track)}
          </button>
          {note && <span className="note"> · {note}</span>}
        </span>
      </div>

      <span className="row-stat">{track.playback_count ? `${formatCount(track.playback_count)} plays` : ''}</span>
      <span className="row-stat row-date">{formatRelative(date)}</span>

      <div className="row-actions">
        <button
          className={`icon-btn like ${liked ? 'on' : ''}`}
          aria-label={liked ? 'Remove from Likes' : 'Like'}
          onClick={() => void useAuth.getState().toggleLike(track)}
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <button className="icon-btn" aria-label="More options" onClick={(e) => useTrackMenu.getState().show(e, track)}>
          <Ellipsis size={16} />
        </button>
      </div>

      <span className="row-time">{formatTime(track.full_duration ?? track.duration)}</span>
    </div>
  )
})
