import { findAppVersion, findClientId, findScriptUrls } from '../shared/clientId'
import type { ApiRequest, ApiResult } from '../shared/types'

export const API_BASE = 'https://api-v2.soundcloud.com'
const API_HOST = new URL(API_BASE).hostname

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface ClientCredentials {
  clientId: string
  appVersion: string | null
  fetchedAt: number
}

export interface SoundCloudClientDeps {
  fetch: FetchLike
  /** Returns the user's OAuth token (from the `oauth_token` cookie), if logged in. */
  getToken: () => Promise<string | null>
  loadCredentials?: () => ClientCredentials | null
  saveCredentials?: (c: ClientCredentials) => void
}

/**
 * Thin client for SoundCloud's internal api-v2 — the same API soundcloud.com
 * uses. It is undocumented, so the public client_id is scraped from the site and
 * refreshed automatically whenever the API starts rejecting it.
 */
export class SoundCloudClient {
  private creds: ClientCredentials | null
  private refreshing: Promise<ClientCredentials> | null = null

  constructor(private deps: SoundCloudClientDeps) {
    this.creds = deps.loadCredentials?.() ?? null
  }

  async credentials(force = false): Promise<ClientCredentials> {
    if (this.creds && !force) return this.creds
    this.refreshing ??= this.scrapeCredentials().finally(() => {
      this.refreshing = null
    })
    this.creds = await this.refreshing
    this.deps.saveCredentials?.(this.creds)
    return this.creds
  }

  private async scrapeCredentials(): Promise<ClientCredentials> {
    const home = await this.deps.fetch('https://soundcloud.com/')
    if (!home.ok) throw new Error(`soundcloud.com returned ${home.status}`)
    const html = await home.text()
    // The client_id lives in one of the later bundles, so search from the end.
    for (const src of findScriptUrls(html).reverse()) {
      const res = await this.deps.fetch(src)
      if (!res.ok) continue
      const clientId = findClientId(await res.text())
      if (clientId) return { clientId, appVersion: findAppVersion(html), fetchedAt: Date.now() }
    }
    throw new Error('Could not find a client_id on soundcloud.com')
  }

  buildUrl(req: ApiRequest, creds: ClientCredentials): URL {
    const url = req.path.startsWith('https://') ? new URL(req.path) : new URL(req.path, API_BASE)
    if (url.hostname !== API_HOST) throw new Error(`Refusing to call non-API host ${url.hostname}`)
    for (const [k, v] of Object.entries(req.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
    // next_href values carry a stale client_id; always use the current one.
    url.searchParams.set('client_id', creds.clientId)
    if (creds.appVersion) url.searchParams.set('app_version', creds.appVersion)
    url.searchParams.set('app_locale', 'en')
    return url
  }

  async request<T = unknown>(req: ApiRequest): Promise<ApiResult<T>> {
    try {
      let creds = await this.credentials()
      let res = await this.send(req, creds)
      // A 401/403 usually means the scraped client_id was rotated. Retry once
      // with a fresh one; if a user token is the problem this fails again. The
      // age check stops an expired token from triggering a scrape per request.
      if ((res.status === 401 || res.status === 403) && Date.now() - creds.fetchedAt > 60_000) {
        creds = await this.credentials(true)
        res = await this.send(req, creds)
      }
      const text = await res.text()
      const data = text ? safeJson(text) : null
      if (!res.ok) {
        const apiError = data && typeof data === 'object' && 'error' in data ? String(data.error) : ''
        const message = apiError || res.statusText
        return { ok: false, status: res.status, error: message || `HTTP ${res.status}` }
      }
      return { ok: true, status: res.status, data: data as T }
    } catch (err) {
      return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) }
    }
  }

  private async send(req: ApiRequest, creds: ClientCredentials): Promise<Response> {
    const token = await this.deps.getToken()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `OAuth ${token}`
    let body: string | undefined
    if (req.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(req.body)
    }
    return this.deps.fetch(this.buildUrl(req, creds).toString(), { method: req.method ?? 'GET', headers, body })
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
