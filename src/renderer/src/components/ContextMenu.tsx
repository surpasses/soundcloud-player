import { ExternalLink, Heart, Link, ListEnd, ListStart, CircleUser } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import type { SCTrack } from '@shared/types'
import { classifyTrack } from '@shared/transcoding'
import { useAuth } from '../state/auth'
import { navigate } from '../state/nav'
import { usePlayer } from '../state/player'
import { toast } from '../state/toast'

interface MenuState {
  open: { x: number; y: number; track: SCTrack } | null
  show(e: React.MouseEvent, track: SCTrack): void
  close(): void
}

export const useTrackMenu = create<MenuState>((set) => ({
  open: null,
  show: (e, track) => {
    e.preventDefault()
    set({ open: { x: e.clientX, y: e.clientY, track } })
  },
  close: () => set({ open: null })
}))

export function ContextMenu() {
  const { open, close } = useTrackMenu()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const liked = useAuth((s) => (open ? s.likedIds.has(open.track.id) : false))

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({
      x: Math.min(open.x, window.innerWidth - r.width - 8),
      y: Math.min(open.y, window.innerHeight - r.height - 8)
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    window.addEventListener('wheel', close, { passive: true })
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
      window.removeEventListener('wheel', close)
    }
  }, [open, close])

  if (!open) return null
  const { track } = open
  const playable = classifyTrack(track).playable
  const act = (fn: () => void) => () => {
    fn()
    close()
  }

  return (
    <div className="menu" ref={ref} style={{ left: pos.x, top: pos.y }} role="menu">
      {playable && (
        <>
          <button role="menuitem" onClick={act(() => usePlayer.getState().playNext(track))}>
            <ListStart size={16} /> Play next
          </button>
          <button role="menuitem" onClick={act(() => usePlayer.getState().enqueue(track))}>
            <ListEnd size={16} /> Add to queue
          </button>
          <hr />
        </>
      )}
      <button role="menuitem" onClick={act(() => void useAuth.getState().toggleLike(track))}>
        <Heart size={16} /> {liked ? 'Remove from Likes' : 'Like'}
      </button>
      <button role="menuitem" onClick={act(() => navigate({ name: 'user', id: track.user.id }))}>
        <CircleUser size={16} /> Go to artist
      </button>
      <hr />
      <button role="menuitem" onClick={act(() => void window.sc.openExternal(track.permalink_url))}>
        <ExternalLink size={16} /> Open on SoundCloud
      </button>
      <button
        role="menuitem"
        onClick={act(() => {
          void navigator.clipboard.writeText(track.permalink_url)
          toast('Link copied')
        })}
      >
        <Link size={16} /> Copy link
      </button>
    </div>
  )
}
