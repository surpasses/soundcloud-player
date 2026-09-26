import { useQuery } from '@tanstack/react-query'
import { user as getUser, userPlaylists, userTopTracks, userTracks } from '../lib/api'
import { formatCount, userArt } from '../lib/format'
import { usePaged } from '../lib/usePaged'
import { PlaylistCard, Shelf } from '../components/Cards'
import { ErrorState, Spinner } from '../components/LoadMore'
import { Masthead } from '../components/Masthead'
import { PlayButtons } from '../components/PlayButtons'
import { TrackList } from '../components/TrackList'

export function UserView({ id }: { id: number }) {
  const u = useQuery({ queryKey: ['user', id], queryFn: () => getUser(id) })
  const top = useQuery({ queryKey: ['user', id, 'top'], queryFn: () => userTopTracks(id) })
  const lists = useQuery({ queryKey: ['user', id, 'playlists'], queryFn: () => userPlaylists(id) })
  const tracks = usePaged(['user', id, 'tracks'], () => userTracks(id))

  if (u.isPending) return <Spinner />
  if (u.isError) return <ErrorState error={u.error} onRetry={() => void u.refetch()} />

  const user = u.data
  const popular = top.data?.collection.slice(0, 5) ?? []

  return (
    <div className="view">
      <Masthead
        art={userArt(user, 't500x500')}
        round
        kind="Artist"
        title={user.username}
        meta={
          <>
            {user.followers_count != null && <span>{formatCount(user.followers_count)} followers</span>}
            {user.track_count != null && <span>{user.track_count} tracks</span>}
          </>
        }
      />
      <PlayButtons tracks={popular.length ? popular : tracks.items} contextLabel={user.username} permalink={user.permalink_url} />
      {popular.length > 0 && (
        <section>
          <h2 className="section-title">Most played</h2>
          <TrackList tracks={popular} contextLabel={user.username} />
        </section>
      )}
      {!!lists.data?.collection.length && (
        <Shelf title="Playlists">
          {lists.data.collection.slice(0, 10).map((p) => (
            <PlaylistCard key={p.id} playlist={p} subtitle={`${p.track_count} tracks`} />
          ))}
        </Shelf>
      )}
      <section>
        <h2 className="section-title">Everything</h2>
        {tracks.isPending ? (
          <Spinner />
        ) : (
          <TrackList
            tracks={tracks.items}
            contextLabel={`${user.username} — all tracks`}
            hasMore={tracks.hasNextPage}
            loadingMore={tracks.isFetchingNextPage}
            onLoadMore={() => void tracks.fetchNextPage()}
          />
        )}
      </section>
    </div>
  )
}
