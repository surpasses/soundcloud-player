import { LoaderCircle, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import { usePlayer } from '../state/player'

/** Shuffle / prev / play / next / repeat, shared by the capsule and the stage. */
export function Transport({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const status = usePlayer((s) => s.status)
  const queue = usePlayer((s) => s.queue)
  const { toggleShuffle, prev, togglePlay, next, cycleRepeat } = usePlayer.getState()
  const icon = size === 'lg' ? 24 : 18
  const repeat = queue?.repeat ?? 'off'

  return (
    <div className={`transport ${size}`}>
      <button className={`icon-btn toggle ${queue?.shuffle ? 'on' : ''}`} aria-label="Shuffle" onClick={toggleShuffle} disabled={!queue}>
        <Shuffle size={icon - 2} />
      </button>
      <button className="icon-btn" aria-label="Previous" onClick={prev} disabled={!queue}>
        <SkipBack size={icon} fill="currentColor" />
      </button>
      <button className="play-orb" aria-label={status === 'playing' ? 'Pause' : 'Play'} onClick={togglePlay} disabled={!queue}>
        {status === 'loading' ? (
          <LoaderCircle size={icon} className="spin" />
        ) : status === 'playing' ? (
          <Pause size={icon} fill="currentColor" />
        ) : (
          <Play size={icon} fill="currentColor" className="nudge" />
        )}
      </button>
      <button className="icon-btn" aria-label="Next" onClick={next} disabled={!queue}>
        <SkipForward size={icon} fill="currentColor" />
      </button>
      <button className={`icon-btn toggle ${repeat !== 'off' ? 'on' : ''}`} aria-label={`Repeat: ${repeat}`} onClick={cycleRepeat} disabled={!queue}>
        {repeat === 'one' ? <Repeat1 size={icon - 2} /> : <Repeat size={icon - 2} />}
      </button>
    </div>
  )
}
