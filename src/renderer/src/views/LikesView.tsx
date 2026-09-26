import { Heart } from 'lucide-react'
import { useMemo } from 'react'
import type { SCTrackLike } from '@shared/types'
import { trackLikes } from '../lib/api'
import { usePaged } from '../lib/usePaged'
import { useAuth } from '../state/auth'
import { ErrorState, Spinner } from '../components/LoadMore'
import { Masthead } from '../components/Masthead'
import { PlayButtons } from '../components/PlayButtons'
import { TrackList } from '../components/TrackList'
import { LoggedOut } from './LibraryView'

export function LikesView() {
  const status = useAuth((s) => s.status)
  const user = useAuth((s) => s.user)
  const likedCount = useAuth((s) => s.likedIds.size)
  const q = usePaged<SCTrackLike>(['likes', user?.id], () => trackLikes(user!.id), !!user)
  const likes = useMemo(() => q.items.filter((l) => l.track), [q.items])
  const tracks = useMemo(() => likes.map((l) => l.track), [likes])

  if (status === 'out') return <LoggedOut title="Likes" text="Log in to see every track you’ve hearted." />
  if (!user || q.isPending) return <Spinner label="Gathering your likes…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />

  return (
    <div className="view">
      <Masthead
        art={null}
        artNode={
          <div className="liked-art">
            <Heart size={72} fill="currentColor" />
          </div>
        }
        kind="Collection"
        title="Liked tracks"
        meta={
          <>
            <span>{user.username}</span>
            <span>{likedCount || tracks.length} tracks</span>
          </>
        }
      />
      <PlayButtons tracks={tracks} contextLabel="Liked tracks" />
      <TrackList
        tracks={tracks}
        contextLabel="Liked tracks"
        dateOf={(i) => likes[i].created_at}
        hasMore={q.hasNextPage}
        loadingMore={q.isFetchingNextPage}
        onLoadMore={() => void q.fetchNextPage()}
      />
    </div>
  )
}
