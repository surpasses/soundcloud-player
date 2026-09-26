import { useState, type CSSProperties } from 'react'

interface Props {
  value: number
  max: number
  /** Called continuously while dragging; `commit` is true on release. */
  onChange(value: number, commit: boolean): void
  step?: number
  label: string
  className?: string
}

/**
 * Range input that keeps a local value while dragging, so a seek bar doesn't
 * fight incoming time updates and only seeks once on release.
 */
export function Slider({ value, max, onChange, step = 1, label, className = '' }: Props) {
  const [drag, setDrag] = useState<number | null>(null)
  const shown = drag ?? value
  const pct = max > 0 ? Math.min(100, (shown / max) * 100) : 0

  const commit = (): void => {
    if (drag !== null) onChange(drag, true)
    setDrag(null)
  }

  return (
    <input
      type="range"
      aria-label={label}
      className={`slider ${className}`}
      min={0}
      max={max || 1}
      step={step}
      value={shown}
      style={{ '--pct': `${pct}%` } as CSSProperties}
      onChange={(e) => {
        const v = Number(e.target.value)
        setDrag(v)
        onChange(v, false)
      }}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  )
}
