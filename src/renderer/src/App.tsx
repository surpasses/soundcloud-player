import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Ambient } from './components/Ambient'
import { Capsule } from './components/Capsule'
import { ContextMenu } from './components/ContextMenu'
import { LoginDialog } from './components/LoginDialog'
import { Rail } from './components/Rail'
import { Stage } from './components/Stage'
import { navigate, useNav, useRoute, type Route } from './state/nav'
import { usePlayer } from './state/player'
import { useToast } from './state/toast'
import { HomeView } from './views/HomeView'
import { LibraryView } from './views/LibraryView'
import { LikesView } from './views/LikesView'
import { PlaylistView } from './views/PlaylistView'
import { FOCUS_SEARCH, SearchView } from './views/SearchView'
import { UserView } from './views/UserView'

function View({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <HomeView />
    case 'likes':
      return <LikesView />
    case 'library':
      return <LibraryView />
    case 'search':
      return <SearchView q={route.q} />
    case 'playlist':
      return <PlaylistView playlistKey={route.key} />
    case 'user':
      return <UserView id={route.id} />
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (document.querySelector('dialog[open]')) return
      const p = usePlayer.getState()
      const nav = useNav.getState()
      const mod = e.metaKey || e.ctrlKey
      if (e.key === ' ' && !isTyping(e)) {
        // A focused button or slider would otherwise swallow space as well.
        e.preventDefault()
        p.togglePlay()
      } else if (mod && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault()
        p.toggleStage(false)
        if (nav.stack[nav.index].name !== 'search') navigate({ name: 'search', q: '' })
        window.dispatchEvent(new Event(FOCUS_SEARCH))
      } else if (mod && e.key === 'ArrowRight' && !isTyping(e)) p.next()
      else if (mod && e.key === 'ArrowLeft' && !isTyping(e)) p.prev()
      else if (mod && e.key === 'ArrowUp' && !isTyping(e)) p.setVolume(p.volume + 0.1)
      else if (mod && e.key === 'ArrowDown' && !isTyping(e)) p.setVolume(p.volume - 0.1)
      else if (mod && e.key === '[') nav.back()
      else if (mod && e.key === ']') nav.forward()
      else if (!mod && e.key.toLowerCase() === 'n' && !isTyping(e) && p.queue) p.toggleStage()
    }
    // Mouse back/forward buttons.
    const onMouse = (e: MouseEvent): void => {
      if (e.button === 3) useNav.getState().back()
      if (e.button === 4) useNav.getState().forward()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mouseup', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onMouse)
    }
  }, [])
}

export default function App() {
  const route = useRoute()
  const { index, stack, back, forward } = useNav()
  const toastMessage = useToast((s) => s.message)
  const stageOpen = usePlayer((s) => s.stageOpen)
  const mainRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  useShortcuts()

  // New page → start at the top.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [route.name, index])

  return (
    <div className={`app platform-${window.sc.platform} ${stageOpen ? 'stage-open' : ''}`}>
      <Ambient />
      <Rail />
      <main className="main" ref={mainRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}>
        <div className={`chrome ${scrolled ? 'scrolled' : ''}`}>
          <button className="icon-btn" aria-label="Back" disabled={index === 0} onClick={back}>
            <ChevronLeft size={20} />
          </button>
          <button className="icon-btn" aria-label="Forward" disabled={index >= stack.length - 1} onClick={forward}>
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="page" key={`${index}-${route.name}`}>
          <View route={route} />
        </div>
      </main>
      <Capsule />
      <Stage />
      <ContextMenu />
      <LoginDialog />
      {toastMessage && (
        <div className="toast" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
