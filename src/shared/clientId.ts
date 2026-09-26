// The public web client_id is embedded in one of soundcloud.com's JS bundles.
// These helpers are pure so they can be unit tested without the network.

export function findScriptUrls(html: string): string[] {
  const re = /<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g
  return [...html.matchAll(re)].map((m) => m[1])
}

export function findClientId(js: string): string | null {
  const m = js.match(/[{,]client_id\s*:\s*"([a-zA-Z0-9]{32})"/) ?? js.match(/client_id=([a-zA-Z0-9]{32})/)
  return m ? m[1] : null
}

export function findAppVersion(html: string): string | null {
  const m = html.match(/__sc_version\s*=\s*"(\d+)"/)
  return m ? m[1] : null
}
