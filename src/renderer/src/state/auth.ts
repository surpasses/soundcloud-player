import { create } from 'zustand'
import type { AuthState, SCTrack, SCUser } from '@shared/types'
import { likedTrackIds, setTrackLike } from '../lib/api'
import { queryClient } from '../lib/queryClient'
import { toast } from './toast'

interface AuthStore {
  status: 'unknown' | 'in' | 'out'
  user: SCUser | null
  likedIds: Set<number>
  loginOpen: boolean
  init(): Promise<void>
  showLogin(): void
  hideLogin(): void
  /** Opens soundcloud.com's sign-in page in a separate window. */
  loginWithBrowser(): Promise<void>
  /** Returns an error message, or null on success. */
  loginWithToken(token: string): Promise<string | null>
  logout(): Promise<void>
  toggleLike(track: SCTrack): Promise<void>
}

export const useAuth = create<AuthStore>((set, get) => {
  const apply = (state: AuthState): void => {
    const wasIn = get().status === 'in'
    set({ status: state.loggedIn ? 'in' : 'out', user: state.user })
    if (state.loggedIn) set({ loginOpen: false })
    if (state.loggedIn && !wasIn) {
      likedTrackIds()
        .then((ids) => set({ likedIds: new Set(ids) }))
        .catch(() => toast('Could not load your likes'))
    }
    if (!state.loggedIn) set({ likedIds: new Set() })
    // Everything user-specific (feed, likes, library) is now stale.
    if (state.loggedIn !== wasIn) void queryClient.invalidateQueries()
  }

  return {
    status: 'unknown',
    user: null,
    likedIds: new Set(),
    loginOpen: false,
    init: async () => {
      window.sc.auth.onChange(apply)
      apply(await window.sc.auth.status())
    },
    showLogin: () => set({ loginOpen: true }),
    hideLogin: () => set({ loginOpen: false }),
    loginWithBrowser: async () => apply(await window.sc.auth.login()),
    loginWithToken: async (token) => {
      const res = await window.sc.auth.loginWithToken(token)
      if (res.error) return res.error
      apply(res)
      return null
    },
    logout: async () => apply(await window.sc.auth.logout()),
    toggleLike: async (track) => {
      const { user, likedIds } = get()
      if (!user) {
        toast('Log in to like tracks')
        return
      }
      const liked = !likedIds.has(track.id)
      const optimistic = new Set(likedIds)
      if (liked) optimistic.add(track.id)
      else optimistic.delete(track.id)
      set({ likedIds: optimistic })
      try {
        await setTrackLike(user.id, track.id, liked)
        void queryClient.invalidateQueries({ queryKey: ['likes'] })
      } catch {
        set({ likedIds })
        toast(liked ? 'Could not like track' : 'Could not remove like')
      }
    }
  }
})
