import { LoaderCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../state/auth'

export function LoginDialog() {
  const { loginOpen, hideLogin, loginWithBrowser, loginWithToken } = useAuth()
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // <dialog> gives focus trapping and Escape-to-close for free.
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (loginOpen && !d.open) d.showModal()
    if (!loginOpen && d.open) d.close()
    if (!loginOpen) {
      setToken('')
      setError(null)
    }
  }, [loginOpen])

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setBusy(true)
    setError(await loginWithToken(token))
    setBusy(false)
  }

  return (
    <dialog ref={dialogRef} className="login-dialog" onClose={hideLogin} onClick={(e) => e.target === dialogRef.current && hideLogin()}>
      <div className="login-body">
        <div className="login-head">
          <h2>Log in to SoundCloud</h2>
          <button className="icon-btn" aria-label="Close" onClick={hideLogin}>
            <X size={18} />
          </button>
        </div>

        <section>
          <h3>Email, Facebook or Apple</h3>
          <p className="muted">Opens SoundCloud’s own sign-in page in a new window.</p>
          <button className="pill solid" onClick={() => void loginWithBrowser()}>
            Open SoundCloud sign-in
          </button>
        </section>

        <div className="or">
          <span>or</span>
        </div>

        <section>
          <h3>Signed up with Google?</h3>
          <p className="muted">
            Google blocks sign-in inside apps. Instead, borrow the session from a browser where you’re already logged in
            to SoundCloud:
          </p>
          <ol className="steps">
            <li>
              In Chrome, open{' '}
              <button className="link strong" onClick={() => void window.sc.openExternal('https://soundcloud.com')}>
                soundcloud.com
              </button>{' '}
              and make sure you’re logged in.
            </li>
            <li>
              Press <kbd>⌥⌘I</kbd> to open DevTools, then go to <b>Application</b> → <b>Cookies</b> →{' '}
              <b>https://soundcloud.com</b>.
            </li>
            <li>
              Find the row named <code>oauth_token</code>, double-click its <b>Value</b> and copy it.
            </li>
          </ol>
          <form onSubmit={(e) => void submit(e)} className="token-form">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste oauth_token value"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="pill solid" type="submit" disabled={!token.trim() || busy}>
              {busy ? <LoaderCircle size={16} className="spin" /> : 'Connect'}
            </button>
          </form>
          {error && <p className="error">{error}</p>}
          <p className="muted small">
            The token is stored only in this app’s local session, like a browser cookie. Treat it like a password: anyone
            with it can act as your SoundCloud account. Logging out here doesn’t end your browser session.
          </p>
        </section>
      </div>
    </dialog>
  )
}
