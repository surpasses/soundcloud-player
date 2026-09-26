// Renders resources/icon.svg to resources/icon.png (1024×1024, transparent)
// with Electron's own Chromium, so no extra image tooling is needed.
// Usage: npm run icon
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const dir = join(__dirname, '../resources')
const svg = readFileSync(join(dir, 'icon.svg'), 'utf8')
const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`

app.dock?.hide()
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 400))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 })
  const png = image.resize({ width: 1024, height: 1024 }).toPNG()
  writeFileSync(join(dir, 'icon.png'), png)
  console.log(`wrote resources/icon.png (${png.length} bytes)`)
  app.quit()
})
