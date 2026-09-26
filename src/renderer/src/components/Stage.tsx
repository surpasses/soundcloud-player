import { ChevronDown, ExternalLink, Heart, X } from 'lucide-react'
import { useEffect } from 'react'
import { artistName, formatTime, trackArt } from '../lib/format'
import { upNext } from '../lib/queue'
import { useAuth } from '../state/auth'
import { navigate } from '../state/nav'
import { useCurrentTrack, usePlayer } from '../state/player'
import { Art } from './Art'
import { useTrackMenu } from './ContextMenu'
import { Transport } from './Transport'
import { useWaveform, Waveform } from './Waveform'

/** Full-screen Now Playing: giant artwork, big waveform, and what's next. */
export function Stage() {
  const open = usePlayer((s) => s.stageOpen)
  const track = useCurrentTrack()
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)
  const queue = usePlayer((s) => s.queue)
  const context = usePlayer((s) => s.contextLabel)
  const autoplay = usePlayer((s) => s.autoplay)
  const liked = useAuth((s) => (track ? s.likedIds.has(track.id) : false))
  const samples = useWaveform(open ? track : null)
  const close = (): void => usePlayer.getState().toggleStage(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open && !track) close()
  }, [open, track])

  if (!open || !track) return null
  const next = upNext(queue)
  const goArtist = (): void => {
    close()
    navigate({ name: 'user', id: track.user.id })
  }

  return (
    <div className="stage" role="dialog" aria-label="Now playing">
      <div className="stage-bar">
        <button className="icon-btn" aria-label="Close Now Playing" onClick={close}>
          <ChevronDown size={22} />
        </button>
        <span className="eyebrow">Playing from {context}</span>
        <button className="icon-btn" aria-label="Open on SoundCloud" title="Open on SoundCloud" onClick={() => void window.sc.openExternal(track.permalink_url)}>
          <ExternalLink size={18} />
        </button>
      </div>

      <div className="stage-grid">
        <div className="stage-art-wrap">
          <Art key={track.id} src={trackArt(track, 't500x500')} className="stage-art" />
        </div>

        <div className="stage-side">
          <div className="stage-info" onContextMenu={(e) => useTrackMenu.getState().show(e, track)}>
            <h1 className="stage-title">{track.title}</h1>
            <div className="stage-sub">
              <button className="link" onClick={goArtist}>
                {artistName(track)}
              </button>
              <button
                className={`icon-btn like ${liked ? 'on' : ''}`}
                aria-label={liked ? 'Remove from Likes' : 'Like'}
                onClick={() => void useAuth.getState().toggleLike(track)}
              >
                <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>

          <div className="stage-wave">
            <Waveform samples={samples} position={position} duration={duration} onSeek={usePlayer.getState().seek} height={84} bar={3} gap={2} />
            <div className="stage-times">
              <span className="time">{formatTime(position)}</span>
              <span className="time">−{formatTime(Math.max(0, duration - position))}</span>
            </div>
          </div>

          <Transport size="lg" />

          <div className="up-next">
            <h2 className="eyebrow">Up next</h2>
            {next.length === 0 && <p className="muted">{autoplay ? 'Similar tracks will keep the music going.' : 'That’s the end of the queue.'}</p>}
            <div className="up-next-list">
              {next.slice(0, 60).map(({ pos, track: t }) => (
                <div
                  key={`${pos}-${t.id}`}
                  className="up-row"
                  onDoubleClick={() => usePlayer.getState().jump(pos)}
                  onContextMenu={(e) => useTrackMenu.getState().show(e, t)}
                >
                  <Art src={trackArt(t, 't67x67')} size={40} />
                  <div className="title-text">
                    <span className="track-title">{t.title}</span>
                    <span className="track-sub">{artistName(t)}</span>
                  </div>
                  <span className="time">{formatTime(t.full_duration ?? t.duration)}</span>
                  <button className="icon-btn remove" aria-label="Remove from queue" onClick={() => usePlayer.getState().remove(pos)}>
                    <X size={15} />
                  </button>
                </div>
              ))}
              {next.length > 60 && <p className="muted small">and {next.length - 60} more</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
