import { Heart, House, Library, LogIn, LogOut, Search, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { userArt } from '../lib/format'
import { useAuth } from '../state/auth'
import { navigate, useRoute, type Route } from '../state/nav'
import { Art } from './Art'
import { Logo } from './Bits'

/** Slim navigation rail on the left edge. */
export function Rail() {
  const route = useRoute()
  const { status, user } = useAuth()
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menu])

  const item = (target: Route, icon: ReactNode, label: string) => {
    const active = route.name === target.name || (target.name === 'library' && route.name === 'playlist')
    return (
      <button className={`rail-item ${active ? 'active' : ''}`} onClick={() => navigate(target)} aria-current={active ? 'page' : undefined}>
        {icon}
        <span>{label}</span>
      </button>
    )
  }

  return (
    <nav className="rail">
      <div className="rail-drag" />
      <button className="rail-brand" aria-label="Home" onClick={() => navigate({ name: 'home' })}>
        <Logo />
      </button>
      <div className="rail-items">
        {item({ name: 'home' }, <House size={20} />, 'Home')}
        {item({ name: 'search', q: '' }, <Search size={20} />, 'Search')}
        {item({ name: 'library' }, <Library size={20} />, 'Library')}
        {item({ name: 'likes' }, <Heart size={20} />, 'Likes')}
      </div>
      <div className="rail-account" ref={menuRef}>
        {status === 'in' ? (
          <>
            <button className="rail-avatar" aria-label="Account" onClick={() => setMenu((m) => !m)}>
              {user ? <Art src={userArt(user, 't67x67')} size={36} round /> : <UserRound size={20} />}
            </button>
            {menu && (
              <div className="menu rail-menu">
                <div className="menu-label">{user?.username ?? 'Signed in'}</div>
                {user && (
                  <button onClick={() => void window.sc.openExternal(user.permalink_url)}>
                    <UserRound size={16} /> Profile on SoundCloud
                  </button>
                )}
                <hr />
                <button
                  onClick={() => {
                    setMenu(false)
                    void useAuth.getState().logout()
                  }}
                >
                  <LogOut size={16} /> Log out
                </button>
              </div>
            )}
          </>
        ) : status === 'out' ? (
          <button className="rail-item" onClick={() => useAuth.getState().showLogin()}>
            <LogIn size={20} />
            <span>Log in</span>
          </button>
        ) : null}
      </div>
    </nav>
  )
}
