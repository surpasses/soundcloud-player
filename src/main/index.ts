import { app, BrowserWindow, ipcMain, session, shell, type Session } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ApiRequest, AuthState, SCUser } from '../shared/types'
import { SoundCloudClient, type ClientCredentials } from './soundcloud'

// soundcloud.com (and Google/Apple sign-in) treat Electron's default user agent
// with suspicion, so present as plain Chrome.
app.userAgentFallback = app.userAgentFallback.replace(/\s(Electron|soundcloud-player|Cloudplayer)\/\S+/gi, '')

const SC_PARTITION = 'persist:soundcloud'
let mainWindow: BrowserWindow | null = null
let loginWindow: BrowserWindow | null = null
let loginPromise: Promise<AuthState> | null = null
let client: SoundCloudClient
let scSession: Session

function credentialsPath(): string {
  return join(app.getPath('userData'), 'sc-credentials.json')
}

async function getToken(): Promise<string | null> {
  const cookies = await scSession.cookies.get({ url: 'https://soundcloud.com', name: 'oauth_token' })
  return cookies[0]?.value || null
}

async function authState(): Promise<AuthState> {
  if (!(await getToken())) return { loggedIn: false, user: null }
  const me = await client.request<SCUser>({ path: '/me' })
  if (me.ok) return { loggedIn: true, user: me.data }
  // Keep the session on network errors; only a definite rejection logs out.
  if (me.status === 401) return { loggedIn: false, user: null }
  return { loggedIn: true, user: null }
}

async function broadcastAuth(): Promise<AuthState> {
  const state = await authState()
  mainWindow?.webContents.send('auth:changed', state)
  return state
}

function openLogin(): Promise<AuthState> {
  if (loginWindow && loginPromise) {
    loginWindow.focus()
    return loginPromise
  }
  // soundcloud.com's sign-in page has a desktop min-width of roughly 1000px.
  loginWindow = new BrowserWindow({
    width: 1080,
    height: 820,
    minWidth: 1000,
    title: 'Log in to SoundCloud',
    parent: mainWindow ?? undefined,
    webPreferences: { partition: SC_PARTITION }
  })
  // Social sign-in opens popups; keep them in the same session so cookies land.
  loginWindow.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: { webPreferences: { partition: SC_PARTITION } }
  }))
  loginWindow.loadURL('https://soundcloud.com/signin')

  loginPromise = new Promise<AuthState>((resolve) => {
    let done = false
    const finish = async (): Promise<void> => {
      if (done) return
      done = true
      scSession.cookies.off('changed', onCookie)
      const win = loginWindow
      loginWindow = null
      loginPromise = null
      if (win && !win.isDestroyed()) win.close()
      resolve(await broadcastAuth())
    }
    const onCookie = (_e: Electron.Event, cookie: Electron.Cookie, _cause: string, removed: boolean): void => {
      if (!removed && cookie.name === 'oauth_token' && cookie.value) void finish()
    }
    scSession.cookies.on('changed', onCookie)
    loginWindow!.on('closed', () => void finish())
  })
  return loginPromise
}

/**
 * Log in with an `oauth_token` copied from a browser where the user is already
 * signed in. This is the way in for Google accounts, since Google blocks
 * sign-in from embedded browser windows.
 */
async function loginWithToken(raw: unknown): Promise<AuthState & { error?: string }> {
  const token = typeof raw === 'string' ? raw.trim().replace(/^OAuth\s+/i, '').replace(/^"|"$/g, '') : ''
  if (!/^[\w.-]{16,}$/.test(token)) return { loggedIn: false, user: null, error: 'That doesn’t look like an oauth_token value.' }
  await scSession.cookies.set({
    url: 'https://soundcloud.com',
    domain: '.soundcloud.com',
    path: '/',
    name: 'oauth_token',
    value: token,
    secure: true,
    expirationDate: Date.now() / 1000 + 365 * 24 * 3600
  })
  const state = await authState()
  if (!state.loggedIn) {
    await scSession.cookies.remove('https://soundcloud.com', 'oauth_token')
    return { ...state, error: 'SoundCloud rejected that token. Copy it again from a logged-in browser tab.' }
  }
  return broadcastAuth()
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 960,
    minHeight: 620,
    show: false,
    title: 'Cloudplayer',
    backgroundColor: '#0f0f10',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // Keep playing when the window is hidden or minimised.
      backgroundThrottling: false
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => (mainWindow = null))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      e.preventDefault()
      if (url.startsWith('https://')) void shell.openExternal(url)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Packaged builds get the icon from the bundle; in dev, replace Electron's.
  if (process.platform === 'darwin' && !app.isPackaged) app.dock?.setIcon(join(__dirname, '../../resources/icon.png'))

  scSession = session.fromPartition(SC_PARTITION)
  client = new SoundCloudClient({
    fetch: (url, init) => scSession.fetch(url, init),
    getToken,
    loadCredentials: () => {
      try {
        return JSON.parse(readFileSync(credentialsPath(), 'utf8')) as ClientCredentials
      } catch {
        return null
      }
    },
    saveCredentials: (c) => {
      try {
        writeFileSync(credentialsPath(), JSON.stringify(c))
      } catch (err) {
        console.warn('Could not cache SoundCloud credentials', err)
      }
    }
  })

  ipcMain.handle('sc:request', (_e, req: ApiRequest) => client.request(req))
  ipcMain.handle('auth:status', () => authState())
  ipcMain.handle('auth:login', () => openLogin())
  ipcMain.handle('auth:token', (_e, token: unknown) => loginWithToken(token))
  ipcMain.handle('auth:logout', async () => {
    await scSession.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb'] })
    return broadcastAuth()
  })
  ipcMain.handle('shell:open', (_e, url: string) => {
    if (typeof url === 'string' && url.startsWith('https://')) return shell.openExternal(url)
  })

  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
