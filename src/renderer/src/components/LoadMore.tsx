import { LoaderCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface Props {
  hasMore: boolean
  loading: boolean
  onLoad(): void
}

/** Invisible sentinel that loads the next page as it scrolls into view. */
export function LoadMore({ hasMore, loading, onLoad }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading) onLoad()
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, onLoad])

  return (
    <div ref={ref} className="load-more">
      {loading && <LoaderCircle className="spin" size={20} />}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="center-state">
      <LoaderCircle className="spin" size={28} />
      {label && <p>{label}</p>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="center-state">
      <p>Something went wrong: {error instanceof Error ? error.message : String(error)}</p>
      {onRetry && (
        <button className="pill" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
