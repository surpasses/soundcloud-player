/** Three dancing bars for "this is playing". Freezes when paused. */
export function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className={`eq-bars ${playing ? '' : 'paused'}`} aria-label={playing ? 'Playing' : 'Paused'}>
      <i />
      <i />
      <i />
    </span>
  )
}

/** Cloudplayer's mark: a disc with a waveform running through it. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--glow)" />
          <stop offset="1" stopColor="var(--glow-2)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#logo-g)" />
      {[9, 13, 17, 21, 25].map((x, i) => {
        const h = [6, 12, 16, 10, 5][i]
        return <rect key={x} x={x - 1.25} y={16 - h / 2} width="2.5" height={h} rx="1.25" fill="#0c0b0a" />
      })}
    </svg>
  )
}

export function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
