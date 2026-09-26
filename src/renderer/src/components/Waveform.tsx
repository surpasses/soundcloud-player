import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SCTrack } from '@shared/types'
import { formatTime } from '../lib/format'
import { downsample, fetchWaveform } from '../lib/waveform'

export function useWaveform(track: SCTrack | null): number[] | null {
  const [samples, setSamples] = useState<number[] | null>(null)
  useEffect(() => {
    let live = true
    setSamples(null)
    void fetchWaveform(track?.waveform_url).then((s) => live && setSamples(s))
    return () => {
      live = false
    }
  }, [track?.waveform_url])
  return samples
}

interface Props {
  samples: number[] | null
  position: number
  duration: number
  onSeek(ms: number): void
  height: number
  bar?: number
  gap?: number
  disabled?: boolean
}

/**
 * The track's real waveform as a scrubber: mirrored rounded bars, played part
 * painted with the ambient gradient. Click or drag to seek.
 */
export function Waveform({ samples, position, duration, onSeek, height, bar = 2, gap = 2, disabled }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const [dragX, setDragX] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const count = Math.max(0, Math.floor((width + gap) / (bar + gap)))
  const peaks = useMemo(() => {
    if (samples?.length) return downsample(samples, count)
    // Placeholder while loading / for tracks without waveform data: a calm ripple.
    return Array.from({ length: count }, (_, i) => 0.18 + 0.1 * Math.sin(i / 3) ** 2)
  }, [samples, count])

  const progress = duration > 0 ? Math.min(1, (dragX !== null ? dragX / width : position / duration)) : 0

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    const css = getComputedStyle(canvas)
    const grad = ctx.createLinearGradient(0, 0, width, 0)
    grad.addColorStop(0, css.getPropertyValue('--glow').trim() || '#e9a178')
    grad.addColorStop(1, css.getPropertyValue('--glow-2').trim() || '#9b7cf0')
    const rest = 'rgba(244, 241, 234, 0.2)'
    const hover = 'rgba(244, 241, 234, 0.42)'
    const playedX = progress * width
    const hx = hoverX ?? -1

    const mid = height / 2
    peaks.forEach((p, i) => {
      const x = i * (bar + gap)
      const h = Math.max(2, p * (height - 2))
      ctx.fillStyle = x + bar <= playedX ? grad : hx >= 0 && x <= hx && x > playedX ? hover : rest
      ctx.beginPath()
      ctx.roundRect(x, mid - h / 2, bar, h, bar / 2)
      ctx.fill()
    })
  }, [peaks, progress, hoverX, width, height, bar, gap])

  const xOf = (e: React.PointerEvent): number => {
    const r = wrapRef.current!.getBoundingClientRect()
    return Math.min(width, Math.max(0, e.clientX - r.left))
  }

  const shownX = dragX ?? hoverX

  return (
    <div
      ref={wrapRef}
      className={`waveform ${disabled ? 'disabled' : ''}`}
      style={{ height }}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration / 1000)}
      aria-valuenow={Math.round(position / 1000)}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onSeek(position + 5000)
        if (e.key === 'ArrowLeft') onSeek(position - 5000)
      }}
      onPointerMove={(e) => {
        if (disabled) return
        const x = xOf(e)
        setHoverX(x)
        if (dragX !== null) setDragX(x)
      }}
      onPointerLeave={() => setHoverX(null)}
      onPointerDown={(e) => {
        if (disabled) return
        e.currentTarget.setPointerCapture(e.pointerId)
        setDragX(xOf(e))
      }}
      onPointerUp={(e) => {
        if (dragX === null) return
        onSeek((xOf(e) / width) * duration)
        setDragX(null)
      }}
    >
      <canvas ref={canvasRef} style={{ width, height }} />
      {shownX !== null && !disabled && duration > 0 && (
        <span className="wave-tip" style={{ left: shownX }}>
          {formatTime((shownX / width) * duration)}
        </span>
      )}
    </div>
  )
}
