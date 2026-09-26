import { Music } from 'lucide-react'
import { useState } from 'react'

interface Props {
  src: string | null
  size?: number
  round?: boolean
  className?: string
}

export function Art({ src, size, round, className = '' }: Props) {
  const [failed, setFailed] = useState<string | null>(null)
  const style = size ? { width: size, height: size } : undefined
  const cls = `art ${round ? 'round' : ''} ${className}`
  if (!src || failed === src) {
    return (
      <div className={`${cls} art-fallback`} style={style}>
        <Music size={size ? Math.max(14, size / 3) : 32} />
      </div>
    )
  }
  return <img className={cls} style={style} src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(src)} />
}
