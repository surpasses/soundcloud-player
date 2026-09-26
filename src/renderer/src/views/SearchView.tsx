import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { searchPlaylists, searchTracks, searchUsers } from '../lib/api'
import { usePaged } from '../lib/usePaged'
import { useNav } from '../state/nav'
import { PlaylistCard, Shelf, UserCard } from '../components/Cards'
import { ErrorState, Spinner } from '../components/LoadMore'
import { TrackList } from '../components/TrackList'

export const FOCUS_SEARCH = 'cloudplayer:focus-search'

export const MOODS = ['lo-fi', 'ambient', 'deep house', 'jersey club', 'drum & bass', 'jazz', 'hyperpop', 'field recordings', 'phonk', 'afrobeats', 'shoegaze', 'bedroom pop']

export function SearchView({ q }: { q: string }) {
  const [text, setText] = useState(q)
  const inputRef = useRef<HTMLInputElement>(null)

  // Follow the route when navigating back/forward between searches.
  useEffect(() => setText(q), [q])

  useEffect(() => {
    inputRef.current?.focus()
    const focus = (): void => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener(FOCUS_SEARCH, focus)
    return () => window.removeEventListener(FOCUS_SEARCH, focus)
  }, [])

  // Debounce typing into the route (replace, so history isn't spammed).
  useEffect(() => {
    if (text === q) return
    const t = setTimeout(() => useNav.getState().replace({ name: 'search', q: text }), 280)
    return () => clearTimeout(t)
  }, [text, q])

  const term = q.trim()

  return (
    <div className="view">
      <label className="big-search">
        <input
          ref={inputRef}
          value={text}
          placeholder="Search"
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setText('')}
        />
        {text && (
          <button className="icon-btn" aria-label="Clear search" onClick={() => setText('')}>
            <X size={22} />
          </button>
        )}
      </label>
      {term ? (
        <Results term={term} />
      ) : (
        <div className="moods">
          <span className="eyebrow">Or start with a mood</span>
          <div className="mood-list">
            {MOODS.map((m) => (
              <button key={m} className="mood" onClick={() => setText(m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Results({ term }: { term: string }) {
  const tracks = usePaged(['search', 'tracks', term], () => searchTracks(term))
  const users = useQuery({ queryKey: ['search', 'users', term], queryFn: () => searchUsers(term) })
  const lists = useQuery({ queryKey: ['search', 'playlists', term], queryFn: () => searchPlaylists(term) })

  if (tracks.isPending) return <Spinner />
  if (tracks.isError) return <ErrorState error={tracks.error} onRetry={() => void tracks.refetch()} />

  const nothing = tracks.items.length === 0 && !users.data?.collection.length && !lists.data?.collection.length

  return (
    <>
      {nothing && <p className="muted empty-note">Nothing for “{term}”. Try fewer words?</p>}
      {tracks.items.length > 0 && (
        <section>
          <h2 className="section-title">Tracks</h2>
          <TrackList
            tracks={tracks.items.slice(0, 6)}
            contextLabel={`“${term}”`}
          />
        </section>
      )}
      {!!users.data?.collection.length && (
        <Shelf title="Artists">
          {users.data.collection.slice(0, 8).map((u) => (
            <UserCard key={u.id} user={u} />
          ))}
        </Shelf>
      )}
      {!!lists.data?.collection.length && (
        <Shelf title="Playlists & albums">
          {lists.data.collection.slice(0, 8).map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </Shelf>
      )}
      {tracks.items.length > 6 && (
        <section>
          <h2 className="section-title">More tracks</h2>
          <TrackList
            tracks={tracks.items}
            skip={6}
            contextLabel={`“${term}”`}
            hasMore={tracks.hasNextPage}
            loadingMore={tracks.isFetchingNextPage}
            onLoadMore={() => void tracks.fetchNextPage()}
          />
        </section>
      )}
    </>
  )
}
