import { useState } from 'react'
import { metrics, presetNames, randomSeed, type ThemeId } from '@bloomfilter/workmap-core'
import { WorkMap, Hud, Modal, Scorecard, NodeCard, BucketCard, useClock, type Filter } from '@bloomfilter/workmap-react'
import { href } from '../route'
import { useSpecFromParams } from './useSpec'

/** The WorkMap + HUD story: preset, seed, theme and orientation controls; node and bucket modals; text summary. */
export function Story({ params }: { params: URLSearchParams }) {
  const { spec, preset, seed, theme } = useSpecFromParams(params)
  const clock = useClock(1000, { autoplay: true })
  const [filter, setFilter] = useState<Filter>('combined')
  const [modal, setModal] = useState<{ kind: 'node' | 'end' | 'score'; id?: string } | null>(null)
  const [orientation, setOrientation] = useState<'auto' | 'horizontal' | 'vertical'>('auto')
  const go = (p: Record<string, string | number | undefined>) => { location.hash = href('/story', { preset, seed, theme, ...p }) }
  return (
    <div className={`wm wm-theme-${theme}`} style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 10, padding: 12, boxSizing: 'border-box', background: 'var(--wm-canvas)' }}>
      <div className="wm-hud" style={{ alignItems: 'center', fontSize: 12 }}>
        <a href={href('/')} style={{ opacity: 0.7 }}>← stories</a>
        <label>preset <select value={preset} onChange={(e) => go({ preset: e.target.value, spec: undefined })}>{presetNames().map((n) => <option key={n}>{n}</option>)}</select></label>
        <label>seed <input type="number" value={seed} onChange={(e) => go({ seed: e.target.value })} style={{ width: 80 }} /></label>
        <button type="button" className="wm-btn" onClick={() => go({ seed: randomSeed() })}>Refresh map</button>
        <label>theme <select value={theme} onChange={(e) => go({ theme: e.target.value as ThemeId })}>{['play', 'rave', 'plain'].map((n) => <option key={n}>{n}</option>)}</select></label>
        <label>lanes <select value={orientation} onChange={(e) => setOrientation(e.target.value as 'auto')}>{['auto', 'horizontal', 'vertical'].map((n) => <option key={n}>{n}</option>)}</select></label>
        <span style={{ opacity: 0.6 }}>tick {Math.round(clock.tick)} · seed {spec.seed} in URL</span>
      </div>
      <div style={{ minHeight: 320, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--wm-plate-stroke)' }}>
        <WorkMap spec={spec} clock={clock} theme={theme} filter={filter} orientation={orientation} onNodeClick={(id) => setModal({ kind: 'node', id })} onEndClick={(id) => setModal({ kind: 'end', id })} onHold={(d) => clock.setSpeed(d ? 6 : 1)} />
      </div>
      <div>
        <Hud spec={spec} clock={clock} filter={filter} onFilter={setFilter} onScorecard={() => setModal({ kind: 'score' })} />
        <p style={{ fontSize: 12, opacity: 0.65, margin: '10px 0 0', maxWidth: 900 }} aria-live="polite">{metrics.describe(spec, clock.tick)}</p>
      </div>
      {modal?.kind === 'node' && <Modal title="Node" onClose={() => setModal(null)}><NodeCard spec={spec} nodeId={modal.id!} at={clock.tick} /></Modal>}
      {modal?.kind === 'end' && <Modal title="Bucket" onClose={() => setModal(null)}><BucketCard spec={spec} endId={modal.id!} at={clock.tick} /></Modal>}
      {modal?.kind === 'score' && <Modal title="Scorecard" onClose={() => setModal(null)}><Scorecard spec={spec} at={clock.tick} /></Modal>}
    </div>
  )
}
