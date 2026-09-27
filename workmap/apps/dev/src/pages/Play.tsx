import { Builder } from '@bloomfilter/workmap-react'
import { href } from '../route'
import { useSpecFromParams } from './useSpec'

/** The play route hosts the full builder. Share by URL writes ?spec= into the hash. */
export function Play({ params }: { params: URLSearchParams }) {
  const { spec, theme } = useSpecFromParams(params, 'play-classic')
  return (
    <div className={`wm wm-theme-${theme}`} style={{ height: '100%', padding: 12, boxSizing: 'border-box', background: 'var(--wm-canvas)', display: 'grid', gridTemplateRows: 'auto 1fr', gap: 10 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}><a href={href('/')}>← stories</a> · Builder: place nodes, connect, auto-route, rename buckets, share by URL. A map built by hand renders, animates and shares like a preset.</div>
      <div style={{ minHeight: 0 }}><Builder key={spec.id + spec.seed} initial={spec} theme={theme} /></div>
    </div>
  )
}
