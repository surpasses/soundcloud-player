import { useQuery } from '@tanstack/react-query'
import { playlistQuery } from '../lib/queries'
import { formatTime, playlistArt, yearOf } from '../lib/format'
import { navigate } from '../state/nav'
import { playlistKind } from '../components/Cards'
import { ErrorState, Spinner } from '../components/LoadMore'
import { Masthead } from '../components/Masthead'
import { PlayButtons } from '../components/PlayButtons'
import { TrackList } from '../components/TrackList'

export function PlaylistView({ playlistKey }: { playlistKey: string }) {
  const q = useQuery(playlistQuery(playlistKey))

  if (q.isPending) return <Spinner />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />

  const { playlist: p, tracks } = q.data
  const total = tracks.reduce((sum, t) => sum + (t.full_duration ?? t.duration), 0)
  const year = yearOf(p.last_modified)

  return (
    <div className="view">
      <Masthead
        art={playlistArt(p, 't500x500')}
        kind={playlistKind(p)}
        title={p.title}
        meta={
          <>
            {p.user && (
              <button className="link strong" onClick={() => navigate({ name: 'user', id: p.user!.id })}>
                {p.user.username}
              </button>
            )}
            {year && <span>{year}</span>}
            <span>{tracks.length} tracks</span>
            <span>{formatTime(total)}</span>
          </>
        }
      />
      <PlayButtons tracks={tracks} contextLabel={p.title} permalink={p.permalink_url} />
      <TrackList tracks={tracks} contextLabel={p.title} />
    </div>
  )
}
