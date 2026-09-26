import { Heart, Infinity as InfinityIcon, Maximize2, Volume1, Volume2, VolumeX } from 'lucide-react'
import { artistName, formatTime, trackArt } from '../lib/format'
import { useAuth } from '../state/auth'
import { navigate } from '../state/nav'
import { useCurrentTrack, usePlayer } from '../state/player'
import { Art } from './Art'
import { Logo } from './Bits'
import { useTrackMenu } from './ContextMenu'
import { Slider } from './Slider'
import { Transport } from './Transport'
import { useWaveform, Waveform } from './Waveform'

/** The floating glass player. The waveform is the seek bar. */
export function Capsule() {
  const track = useCurrentTrack()
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)
  const volume = usePlayer((s) => s.volume)
  const muted = usePlayer((s) => s.muted)
  const autoplay = usePlayer((s) => s.autoplay)
  const { seek, setVolume, toggleMute, toggleAutoplay, toggleStage } = usePlayer.getState()
  const liked = useAuth((s) => (track ? s.likedIds.has(track.id) : false))
  const samples = useWaveform(track)
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div className={`capsule ${track ? '' : 'idle'}`}>
      <div className="cap-now">
        {track ? (
          <>
            <button className="cap-art" aria-label="Open Now Playing" onClick={() => toggleStage(true)}>
              <Art src={trackArt(track, 't200x200')} size={52} />
              <span className="cap-expand">
                <Maximize2 size={16} />
              </span>
            </button>
            <div className="cap-meta" onContextMenu={(e) => useTrackMenu.getState().show(e, track)}>
              <span className="cap-title" title={track.title}>
                {track.title}
              </span>
              <button className="link cap-artist" onClick={() => navigate({ name: 'user', id: track.user.id })}>
                {artistName(track)}
              </button>
            </div>
            <button
              className={`icon-btn like ${liked ? 'on' : ''}`}
              aria-label={liked ? 'Remove from Likes' : 'Like'}
              onClick={() => void useAuth.getState().toggleLike(track)}
            >
              <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
            </button>
          </>
        ) : (
          <>
            <span className="cap-art placeholder">
              <Logo size={28} />
            </span>
            <span className="cap-idle">Pick something to play</span>
          </>
        )}
      </div>

      <div className="cap-wave">
        <span className="time">{formatTime(position)}</span>
        <Waveform samples={samples} position={position} duration={duration} onSeek={seek} height={34} disabled={!track} />
        <span className="time">{formatTime(duration)}</span>
      </div>

      <Transport />

      <div className="cap-extras">
        <button
          className={`icon-btn toggle ${autoplay ? 'on' : ''}`}
          aria-label="Autoplay similar tracks"
          title="Keep playing similar tracks when the queue ends"
          onClick={toggleAutoplay}
        >
          <InfinityIcon size={17} />
        </button>
        <div className="volume">
          <button className="icon-btn" aria-label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
            <VolumeIcon size={17} />
          </button>
          <Slider label="Volume" value={muted ? 0 : volume * 100} max={100} onChange={(v) => setVolume(v / 100)} />
        </div>
      </div>
    </div>
  )
}
