import type { SCLibraryItem, SCPlaylist } from '@shared/types'
import { library } from '../lib/api'
import { usePaged } from '../lib/usePaged'
import { useAuth } from '../state/auth'
import { LikedCard, PlaylistCard, playlistKind } from '../components/Cards'
import { ErrorState, LoadMore, Spinner } from '../components/LoadMore'

function label(item: SCLibraryItem, p: SCPlaylist): string {
  const owner = p.user?.username ?? 'SoundCloud'
  const liked = item.type.includes('like')
  return `${liked ? 'Saved ' + playlistKind(p).toLowerCase() : playlistKind(p)} · ${owner}`
}

export function LoggedOut({ title, text }: { title: string; text: string }) {
  return (
    <div className="view">
      <header className="hello">
        <span className="eyebrow">Not signed in</span>
        <h1 className="display">{title}</h1>
        <p className="lede">{text}</p>
        <div className="row-gap">
          <button className="pill solid" onClick={() => useAuth.getState().showLogin()}>
            Log in to SoundCloud
          </button>
        </div>
      </header>
    </div>
  )
}

export function LibraryView() {
  const status = useAuth((s) => s.status)
  const likedCount = useAuth((s) => s.likedIds.size)
  const q = usePaged<SCLibraryItem>(['library'], library, status === 'in')

  if (status === 'out') return <LoggedOut title="Library" text="Log in to see your playlists, albums and mixes." />
  if (q.isPending) return <Spinner label="Opening your library…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />

  return (
    <div className="view">
      <header className="hello compact">
        <span className="eyebrow">{q.items.length + 1} collections</span>
        <h1 className="display">Library</h1>
      </header>
      <div className="grid">
        <LikedCard count={likedCount} />
        {q.items.map((item) => {
          const p = item.playlist ?? item.system_playlist
          return p ? <PlaylistCard key={`${item.type}-${p.id ?? p.urn}`} playlist={p} subtitle={label(item, p)} /> : null
        })}
      </div>
      <LoadMore hasMore={q.hasNextPage} loading={q.isFetchingNextPage} onLoad={() => void q.fetchNextPage()} />
    </div>
  )
}
