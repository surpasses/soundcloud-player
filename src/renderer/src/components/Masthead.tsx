import type { CSSProperties, ReactNode } from 'react'
import { Art } from './Art'
import { usePalette } from './Ambient'

interface Props {
  art: string | null
  /** Replaces the artwork (e.g. the Liked tracks gradient). */
  artNode?: ReactNode
  round?: boolean
  kind: string
  title: string
  meta?: ReactNode
}

/** Editorial page header, tinted with colours from its own artwork. */
export function Masthead({ art, artNode, round, kind, title, meta }: Props) {
  const palette = usePalette(art)
  const style = { '--tint': palette.primary, '--tint-2': palette.secondary } as CSSProperties
  return (
    <header className="masthead" style={style}>
      <div className={`masthead-art ${round ? 'round' : ''}`}>{artNode ?? <Art src={art} round={round} />}</div>
      <div className="masthead-text">
        <span className="eyebrow">{kind}</span>
        <h1 className={`display ${title.length > 28 ? 'long' : ''}`}>{title}</h1>
        {meta && <div className="masthead-meta">{meta}</div>}
      </div>
    </header>
  )
}
