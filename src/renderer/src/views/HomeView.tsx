import { useMemo } from 'react'
import type { SCFeedItem, SCPlaylist, SCTrack } from '@shared/types'
import { feed, library } from '../lib/api'
import { usePaged } from '../lib/usePaged'
import { useAuth } from '../state/auth'
import { navigate } from '../state/nav'
import { greeting, todayLabel } from '../components/Bits'
import { LikedCard, PlaylistCard, Shelf } from '../components/Cards'
import { ErrorState, Spinner } from '../components/LoadMore'
import { TrackList } from '../components/TrackList'
import { MOODS } from './SearchView'

export function HomeView() {
  const status = useAuth((s) => s.status)
  const user = useAuth((s) => s.user)

  if (status === 'unknown') return <Spinner />
  if (status === 'out') return <Welcome />

  return (
    <div className="view">
      <header className="hello">
        <span className="eyebrow">{todayLabel()}</span>
        <h1 className="display">
          {user ? (
            <>
              {greeting()}, <em>{user.username}.</em>
            </>
          ) : (
            `${greeting()}.`
          )}
        </h1>
      </header>
      <LibraryShelf />
      <Feed />
    </div>
  )
}

function Welcome() {
  return (
    <div className="view">
      <header className="hello welcome">
        <span className="eyebrow">{todayLabel()}</span>
        <h1 className="display">
          Music from the <em>underground</em>,<br />
          played beautifully.
        </h1>
        <p className="lede">
          Log in with your SoundCloud account for your feed, likes and playlists. Or just start searching — every public
          track is here.
        </p>
        <div className="row-gap">
          <button className="pill solid" onClick={() => useAuth.getState().showLogin()}>
            Log in to SoundCloud
          </button>
          <button className="pill" onClick={() => navigate({ name: 'search', q: '' })}>
            Search
          </button>
        </div>
      </header>
      <div className="moods">
        <span className="eyebrow">Tonight, maybe</span>
        <div className="mood-list">
          {MOODS.slice(0, 8).map((m) => (
            <button key={m} className="mood" onClick={() => navigate({ name: 'search', q: m })}>
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function LibraryShelf() {
  const lib = usePaged(['library'], library)
  const likedCount = useAuth((s) => s.likedIds.size)
  const playlists = lib.items.map((i) => i.playlist ?? i.system_playlist).filter((p): p is SCPlaylist => !!p)
  return (
    <Shelf
      title="Your collection"
      action={
        <button className="link small-caps" onClick={() => navigate({ name: 'library' })}>
          See all
        </button>
      }
    >
      <LikedCard count={likedCount} />
      {playlists.slice(0, 11).map((p) => (
        <PlaylistCard key={`${p.kind}-${p.id}`} playlist={p} />
      ))}
    </Shelf>
  )
}

function Feed() {
  const q = usePaged<SCFeedItem>(['feed'], feed)

  const { tracks, items, playlists } = useMemo(() => {
    const tracks: SCTrack[] = []
    const items: SCFeedItem[] = []
    const playlists: SCPlaylist[] = []
    const seenTracks = new Set<number>()
    const seenLists = new Set<number>()
    for (const item of q.items) {
      if (item.track && !seenTracks.has(item.track.id)) {
        seenTracks.add(item.track.id)
        tracks.push(item.track)
        items.push(item)
      } else if (item.playlist && !seenLists.has(item.playlist.id)) {
        seenLists.add(item.playlist.id)
        playlists.push(item.playlist)
      }
    }
    return { tracks, items, playlists }
  }, [q.items])

  if (q.isPending) return <Spinner label="Tuning in to your feed…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />

  return (
    <>
      {playlists.length > 0 && (
        <Shelf title="Fresh drops">
          {playlists.slice(0, 12).map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </Shelf>
      )}
      <section>
        <h2 className="section-title">From people you follow</h2>
        <TrackList
          tracks={tracks}
          contextLabel="Your feed"
          dateOf={(i) => items[i].created_at}
          note={(i) => (items[i].type.endsWith('repost') ? `reposted by ${items[i].user.username}` : null)}
          hasMore={q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          onLoadMore={() => void q.fetchNextPage()}
        />
      </section>
    </>
  )
}
