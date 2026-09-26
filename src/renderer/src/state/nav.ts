import { create } from 'zustand'

export type Route =
  | { name: 'home' }
  | { name: 'likes' }
  | { name: 'library' }
  | { name: 'search'; q: string }
  | { name: 'playlist'; key: string }
  | { name: 'user'; id: number }

interface NavState {
  stack: Route[]
  index: number
  go(route: Route): void
  /** Swap the current entry (used while typing a search so history isn't spammed). */
  replace(route: Route): void
  back(): void
  forward(): void
}

export const useNav = create<NavState>((set, get) => ({
  stack: [{ name: 'home' }],
  index: 0,
  go: (route) => {
    const { stack, index } = get()
    if (JSON.stringify(stack[index]) === JSON.stringify(route)) return
    set({ stack: [...stack.slice(0, index + 1), route], index: index + 1 })
  },
  replace: (route) => {
    const { stack, index } = get()
    set({ stack: [...stack.slice(0, index), route, ...stack.slice(index + 1)] })
  },
  back: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
  forward: () => set((s) => ({ index: Math.min(s.stack.length - 1, s.index + 1) }))
}))

export const useRoute = (): Route => useNav((s) => s.stack[s.index])
export const navigate = (route: Route): void => useNav.getState().go(route)
