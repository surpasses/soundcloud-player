import { ExternalLink, Pause, Play, Shuffle } from 'lucide-react'
import { classifyTrack } from '@shared/transcoding'
import type { SCTrack } from '@shared/types'
import { usePlayer } from '../state/player'

interface Props {
  tracks: SCTrack[]
  contextLabel: string
  permalink?: string
}

/** Play / Shuffle row under page headers. */
export function PlayButtons({ tracks, contextLabel, permalink }: Props) {
  const isThisContext = usePlayer((s) => s.contextLabel === contextLabel && !!s.queue)
  const playing = usePlayer((s) => s.status === 'playing')
  const playableIdx = tracks.flatMap((t, i) => (classifyTrack(t).playable ? [i] : []))
  const none = playableIdx.length === 0

  const play = (): void => {
    const player = usePlayer.getState()
    if (isThisContext) player.togglePlay()
    else if (!none) player.playTracks(tracks, playableIdx[0], contextLabel)
  }
  const shufflePlay = (): void => {
    if (none) return
    const start = playableIdx[Math.floor(Math.random() * playableIdx.length)]
    usePlayer.getState().playTracks(tracks, start, contextLabel, { shuffle: true })
  }

  return (
    <div className="play-buttons">
      <button className="play-orb big" aria-label={isThisContext && playing ? 'Pause' : 'Play'} disabled={none} onClick={play}>
        {isThisContext && playing ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="nudge" />}
      </button>
      <button className="pill" disabled={none} onClick={shufflePlay}>
        <Shuffle size={16} /> Shuffle
      </button>
      {permalink && (
        <button className="pill ghost" onClick={() => void window.sc.openExternal(permalink)}>
          <ExternalLink size={15} /> SoundCloud
        </button>
      )}
      {none && tracks.length > 0 && <span className="muted small">None of these can be streamed outside SoundCloud.</span>}
    </div>
  )
}
