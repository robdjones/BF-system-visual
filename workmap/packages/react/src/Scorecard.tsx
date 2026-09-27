import { metrics, type MapSpec } from '@bloomfilter/workmap-core'

const fmt = (x: number, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '–')
const pct = (x: number) => `${Math.round(x * 100)}%`

/** The scorecard: each metric split by actor, model, stage and work type, plus the end-state distribution. */
export function Scorecard({ spec, at }: { spec: MapSpec; at: number }) {
  const dist = metrics.endStateDistribution(spec, at)
  const total = Object.values(dist).reduce((a, b) => a + b, 0)
  return (
    <div>
      <p>{metrics.describe(spec, at)}</p>
      <h3>End states</h3>
      <table className="wm-table"><thead><tr><th>End state</th><th className="num">Items</th><th className="num">Share</th></tr></thead>
        <tbody>{spec.endStates.map((e) => <tr key={e.id}><td>{e.label}</td><td className="num">{dist[e.id] ?? 0}</td><td className="num">{total ? pct((dist[e.id] ?? 0) / total) : '–'}</td></tr>)}</tbody></table>
      {(['actor', 'model', 'stage', 'workType'] as const).map((by) => {
        const rows = metrics.splitBy(spec, by, at)
        if (!rows.length) return null
        return (
          <div key={by}>
            <h3 style={{ marginTop: 14 }}>By {by === 'workType' ? 'work type' : by}</h3>
            <table className="wm-table"><thead><tr><th>{by}</th><th className="num">Items</th><th className="num">Cycle time</th><th className="num">Cost / unit</th><th className="num">Rework</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.key}><td>{r.key}</td><td className="num">{r.count}</td><td className="num">{fmt(r.cycleTime)}</td><td className="num">${fmt(r.cost)}</td><td className="num">{pct(r.reworkRate)}</td></tr>)}</tbody></table>
          </div>
        )
      })}
    </div>
  )
}

export function NodeCard({ spec, nodeId, at }: { spec: MapSpec; nodeId: string; at: number }) {
  const node = spec.nodes.find((n) => n.id === nodeId)
  if (!node) return null
  const s = metrics.nodeStats(spec, nodeId, at)
  const stage = spec.stages.find((x) => x.id === node.stage)
  return (
    <div>
      <h3>{node.label}</h3>
      <p>{node.kind}{node.actor !== 'either' ? ` · ${node.actor}` : ''}{stage ? ` · ${stage.label}` : ''}</p>
      <table className="wm-table"><tbody>
        <tr><td>Work items through</td><td className="num">{s.tokens}</td></tr>
        <tr><td>Visits (incl. rework)</td><td className="num">{s.visits}</td></tr>
        <tr><td>Humans / agents</td><td className="num">{s.humans} / {s.agents}</td></tr>
        <tr><td>Cycle time of items through here</td><td className="num">{fmt(s.cycleTime)} ticks</td></tr>
        <tr><td>Cost per unit</td><td className="num">${fmt(s.cost)}</td></tr>
        <tr><td>Rework rate</td><td className="num">{pct(s.reworkRate)}</td></tr>
      </tbody></table>
    </div>
  )
}

export function BucketCard({ spec, endId, at }: { spec: MapSpec; endId: string; at: number }) {
  const end = spec.endStates.find((e) => e.id === endId)
  if (!end) return null
  const items = metrics.finishedBy(spec.tokens, at).filter((t) => t.endState === endId)
  const byType = new Map<string, number>()
  for (const t of items) byType.set(t.workType, (byType.get(t.workType) ?? 0) + 1)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
  return (
    <div>
      <h3>{end.label}</h3>
      <p>{end.tone === 'done' ? 'Done: work that shipped as this.' : 'Open: work that ended here without shipping.'}</p>
      <table className="wm-table"><tbody>
        <tr><td>Items</td><td className="num">{items.length}</td></tr>
        <tr><td>Humans / agents</td><td className="num">{items.filter((t) => t.actor === 'human').length} / {items.filter((t) => t.actor === 'agent').length}</td></tr>
        <tr><td>Cycle time</td><td className="num">{fmt(mean(items.map((t) => t.finishedAt - t.startedAt)))} ticks</td></tr>
        <tr><td>Cost per unit</td><td className="num">${fmt(mean(items.map((t) => t.cost)))}</td></tr>
        {[...byType].map(([k, v]) => <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>)}
      </tbody></table>
    </div>
  )
}

export function Modal({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title: string }) {
  return (
    <div className="wm-modal-backdrop" onClick={onClose} role="presentation">
      <div className="wm-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {children}
        <div style={{ marginTop: 12 }}><button type="button" className="wm-btn" onClick={onClose} autoFocus>Close</button></div>
      </div>
    </div>
  )
}
