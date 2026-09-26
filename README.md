# Cloudplayer

A Spotify-style desktop client for SoundCloud, built with Electron, React and TypeScript.

It talks to SoundCloud's **internal api-v2**, the same undocumented API soundcloud.com itself uses. That means no Artist Pro subscription or developer approval is needed. It also means SoundCloud can change the API without notice, and using it goes against their API terms. This is a personal-use project; don't distribute it or add features that republish content.

## Run it

```bash
npm install
npm run dev        # hot-reloading dev build
npm run build && npm start   # production build
npm run install-app   # build Cloudplayer.app and copy it to /Applications
npm run dist          # macOS .dmg in dist/
npm run icon          # re-render resources/icon.png from icon.svg
```

Builds are ad-hoc signed (`scripts/adhoc-sign.cjs`) so they run on your own Mac without an Apple Developer ID. To share a build with someone else it would need proper signing and notarization.

If `npm install` stops with `Cannot read properties of null (reading 'edgesOut')`, that is an npm bug triggered by vitest 4.1.x; vitest is pinned to 4.0.x here to avoid it. If Electron fails to start with `ENOENT … Electron.app`, run `node node_modules/electron/install.js` to fetch the binary.

## Design

"Afterglow": the interface takes its accent colours from the artwork that's playing (`src/renderer/src/lib/color.ts`) and cross-fades between tracks. Behind everything sits the cover art, hugely blurred and slowly turning. The player is a floating glass capsule whose seek bar is the track's real waveform. Click the artwork (or press `N`) for the full-screen Now Playing stage. Type is Instrument Serif for display, Geist for UI and Geist Mono for numbers.

## Features

- Search tracks, artists and playlists; artist pages; playlist and album pages
- Log in with your SoundCloud account (same login page as the website) to get your **feed**, **liked tracks** and **library** (playlists, albums, liked playlists and SoundCloud mixes) in the sidebar
- Like and unlike tracks
- Queue with shuffle, repeat (all/one), play next, add to queue, remove from queue
- Autoplay of similar tracks when the queue runs out (∞ button)
- macOS media keys, AirPods controls and the Now Playing widget (Media Session API)
- Keyboard shortcuts: `Space` play/pause, `N` Now Playing, `⌘←/⌘→` previous/next, `⌘↑/⌘↓` volume, `⌘K` search, `⌘[`/`⌘]` back/forward
- Right-click any track for more options

### What can't play

Some tracks are marked with a lock icon and skipped:

- **Protected**: major-label tracks that SoundCloud only serves as DRM-encrypted streams (Widevine/FairPlay). When a track has encrypted streams, its unencrypted-looking MP3 entries are decoys that return 404, so the whole track counts as protected. This app does not circumvent DRM. The lock icon opens the track on soundcloud.com.
- **Go+**: tracks limited to SoundCloud Go+ subscribers; outside the website only a 30-second preview is available.

Independent and underground uploads, which are most of SoundCloud, play in full.

## How it works

```
renderer (React UI) ──IPC──> main process ──HTTPS──> api-v2.soundcloud.com
       │                         │
       │                         └─ login window + oauth_token cookie (persist:soundcloud session)
       └─ <audio> + hls.js ──────────────────────> SoundCloud CDN (audio)
```

- **client_id**: scraped from soundcloud.com's JS bundles (`src/shared/clientId.ts`), cached in the app's user-data folder, and re-scraped automatically when the API rejects it (`src/main/soundcloud.ts`).
- **API calls run in the main process.** api-v2 only allows browser requests from the `soundcloud.com` origin; the main process isn't subject to that restriction.
- **Auth**: the login window uses the real soundcloud.com sign-in. The resulting `oauth_token` cookie is sent as `Authorization: OAuth …`. Google refuses to sign in inside embedded browsers, so the login dialog also accepts an `oauth_token` copied from a browser where you're already logged in (DevTools → Application → Cookies → soundcloud.com).
- **Playback**: each track lists several transcodings. `src/shared/transcoding.ts` picks HLS AAC 160k, then progressive MP3, then HLS MP3, and never selects encrypted streams. Stream URLs are signed and expire, so they are resolved at play time and re-resolved once if playback fails.
- **Playlists** embed only their first 5 tracks in full; the rest are fetched in batches of 50 via `/tracks?ids=`.

## Tests

```bash
npm test          # unit tests (queue logic, stream selection, client_id scraping, API client)
npm run smoke     # also hits the live SoundCloud API: search → stream → CDN → playlist
npm run typecheck
```

## Layout

```
src/main/        Electron main process: window, login, API client
src/preload/     contextBridge exposing window.sc
src/shared/      types + pure logic shared by both sides
src/renderer/    React UI (views/, components/, state/ = zustand stores, lib/)
```
