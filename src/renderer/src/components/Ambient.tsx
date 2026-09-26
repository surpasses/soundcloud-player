import { useEffect, useState } from 'react'
import { DEFAULT_PALETTE, paletteFromImage, type Palette } from '../lib/color'
import { trackArt } from '../lib/format'
import { useCurrentTrack } from '../state/player'

/** Palette for any artwork URL (defaults while loading). */
export function usePalette(url: string | null): Palette {
  const [palette, setPalette] = useState(DEFAULT_PALETTE)
  useEffect(() => {
    let live = true
    void paletteFromImage(url).then((p) => live && setPalette(p))
    return () => {
      live = false
    }
  }, [url])
  return palette
}

/**
 * The room the music plays in: the current artwork, hugely blurred, drifting
 * behind everything, and the `--glow` accents lifted from it. Colours cross-fade
 * via registered custom properties (see styles.css).
 */
export function Ambient() {
  const track = useCurrentTrack()
  const art = track ? trackArt(track, 't500x500') : null
  const palette = usePalette(track ? trackArt(track, 't200x200') : null)
  const [layers, setLayers] = useState<string[]>([])

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--glow', palette.primary)
    root.setProperty('--glow-2', palette.secondary)
  }, [palette])

  // Keep the previous artwork underneath while the new one fades in.
  useEffect(() => {
    if (!art) return
    setLayers((l) => (l[l.length - 1] === art ? l : [...l.slice(-1), art]))
    const t = setTimeout(() => setLayers((l) => l.slice(-1)), 2000)
    return () => clearTimeout(t)
  }, [art])

  return (
    <div className="ambient" aria-hidden>
      <div className="ambient-wash" />
      {layers.map((src) => (
        <img key={src} className="ambient-art" src={src} alt="" />
      ))}
      <div className="ambient-grain" />
    </div>
  )
}
