import { useEffect, useMemo, useRef, useState } from 'react'
import { generate, encodeSpecForUrl, validateSpec, type MapSpec, type Node, type NodeKind, type Actor, type ThemeId } from '@bloomfilter/workmap-core'
import { WorkMap, type Filter } from './WorkMap'
import { Hud } from './Hud'
import { useClock } from './useClock'
import { Modal, Scorecard } from './Scorecard'

/** Builder: place nodes, connect, auto-route, rename buckets, share by URL. Writes a spec; everything else reads it. */
export type BuilderProps = { initial: MapSpec; theme?: ThemeId; onChange?: (spec: MapSpec) => void }
type Tool = 'select' | 'add' | 'connect'
type Structure = Omit<MapSpec, 'tokens'>

const PALETTE: { key: string; kind: NodeKind; actor: Actor; label: string }[] = [
  { key: 'source', kind: 'source', actor: 'either', label: 'Source' },
  { key: 'human', kind: 'step', actor: 'human', label: 'Human step' },
  { key: 'agent', kind: 'step', actor: 'agent', label: 'Agent step' },
  { key: 'route', kind: 'route', actor: 'either', label: 'Route' },
  { key: 'split', kind: 'split', actor: 'either', label: 'Split' },
  { key: 'govern', kind: 'govern', actor: 'either', label: 'Govern' },
]

export function Builder({ initial, theme, onChange }: BuilderProps) {
  const [structure, setStructure] = useState<Structure>(() => { const { tokens: _t, ...s } = initial; return s })
  const [seed, setSeed] = useState(initial.seed)
  const [tool, setTool] = useState<Tool>('select')
  const [palette, setPalette] = useState('human')
  const [selected, setSelected] = useState<string | null>(null)
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('combined')
  const [scorecard, setScorecard] = useState(false)
  const [copied, setCopied] = useState(false)

  const spec: MapSpec = useMemo(() => generate({ name: 'builder', ...structure, hints: { tokens: 80, ticks: 1000 } }, seed), [structure, seed])
  const validation = useMemo(() => validateSpec(spec), [spec])
  const clock = useClock(1000, { autoplay: true })
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } onChange?.(spec) }, [spec, onChange])

  const update = (fn: (s: Structure) => Structure) => setStructure((s) => fn(structuredClone(s)))
  const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`
  const node = structure.nodes.find((n) => n.id === selected)
  const edge = structure.edges.find((e) => e.id === selected)
  const end = structure.endStates.find((e) => e.id === selected)

  const addNode = (stageId: string) => {
    const p = PALETTE.find((x) => x.key === palette)!
    const n: Node = { id: uid(p.kind), stage: stageId, kind: p.kind, actor: p.actor, label: p.label }
    update((s) => ({ ...s, nodes: [...s.nodes, n] }))
    setSelected(n.id)
  }
  const connect = (from: string, to: string) => {
    if (from === to) return
    update((s) => {
      if (s.edges.some((e) => e.from === from && e.to === to)) return s
      const fromNode = s.nodes.find((n) => n.id === from)!
      const toNode = s.nodes.find((n) => n.id === to)
      const order = (id: string) => s.stages.find((x) => x.id === id)?.order ?? 0
      const loop = !!toNode && order(toNode.stage) <= order(fromNode.stage)
      s.edges.push({ id: uid('e'), from, to, weight: 0.5, loop: loop || undefined })
      return normalizeFrom(s, from)
    })
  }
  const onNodeClick = (id: string) => {
    if (tool === 'connect') {
      if (!pendingFrom) setPendingFrom(id)
      else { connect(pendingFrom, id); setPendingFrom(null) }
      return
    }
    setSelected(id)
  }
  const onEndClick = (id: string) => {
    if (tool === 'connect' && pendingFrom) { connect(pendingFrom, id); setPendingFrom(null); return }
    setSelected(id)
  }
  const onLaneClick = (stageId: string) => { if (tool === 'add') addNode(stageId); else setSelected(null) }
  const remove = () => {
    if (!selected) return
    update((s) => ({
      ...s,
      nodes: s.nodes.filter((n) => n.id !== selected),
      edges: s.edges.filter((e) => e.id !== selected && e.from !== selected && e.to !== selected),
      endStates: s.endStates.length > 1 ? s.endStates.filter((e) => e.id !== selected) : s.endStates,
    }))
    setSelected(null)
  }
  const autoRoute = () => update((s) => {
    // every node without an outgoing edge gets one to the next stage (or the first done end state); weights normalized
    const stages = s.stages.slice().sort((a, b) => a.order - b.order)
    for (const n of s.nodes) {
      if (s.edges.some((e) => e.from === n.id)) continue
      const si = stages.findIndex((x) => x.id === n.stage)
      const next = s.nodes.filter((x) => x.stage === stages[si + 1]?.id)
      if (next.length) next.forEach((x) => s.edges.push({ id: uid('e'), from: n.id, to: x.id, weight: 1 / next.length }))
      else { const done = s.endStates.find((e) => e.tone === 'done') ?? s.endStates[0]; s.edges.push({ id: uid('e'), from: n.id, to: done.id, weight: 1 }) }
    }
    for (const n of s.nodes) normalizeFrom(s, n.id)
    return s
  })
  const addStage = () => update((s) => { const order = s.stages.length; s.stages.push({ id: uid('stage'), label: `Stage ${order + 1}`, order }); return s })
  const share = async () => {
    const url = new URL(location.href); url.searchParams.set('spec', encodeSpecForUrl(spec)); url.searchParams.set('seed', String(seed))
    history.replaceState(null, '', url.toString())
    try { await navigator.clipboard.writeText(url.toString()); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked: the URL bar has it */ }
  }

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', height: '100%', gap: 10 }}>
      <div className="wm-hud" style={{ alignItems: 'center' }}>
        <div className="wm-toggle" role="radiogroup" aria-label="Tool">
          {(['select', 'add', 'connect'] as Tool[]).map((t) => <button key={t} type="button" role="radio" aria-checked={tool === t} className={`wm-btn${tool === t ? ' wm-on' : ''}`} onClick={() => { setTool(t); setPendingFrom(null) }}>{t}</button>)}
        </div>
        {tool === 'add' && <div className="wm-toggle" role="radiogroup" aria-label="Node kind">
          {PALETTE.map((p) => <button key={p.key} type="button" role="radio" aria-checked={palette === p.key} className={`wm-btn${palette === p.key ? ' wm-on' : ''}`} onClick={() => setPalette(p.key)}>{p.label}</button>)}
          <span style={{ fontSize: 12, alignSelf: 'center', opacity: 0.7 }}>click a lane to place</span>
        </div>}
        {tool === 'connect' && <span style={{ fontSize: 12, alignSelf: 'center', opacity: 0.7 }}>{pendingFrom ? `from ${structure.nodes.find((n) => n.id === pendingFrom)?.label ?? pendingFrom} → click a node or end state` : 'click the source node'}</span>}
        <button type="button" className="wm-btn" onClick={addStage}>+ stage</button>
        <button type="button" className="wm-btn" onClick={autoRoute}>Auto-route</button>
        <button type="button" className="wm-btn" onClick={() => setSeed((s) => s + 1)}>Regenerate tokens</button>
        <button type="button" className="wm-btn" onClick={share}>{copied ? 'Copied' : 'Share URL'}</button>
        {!validation.ok && <span style={{ fontSize: 12, color: 'var(--wm-human)' }}>{validation.errors[0]}</span>}
        {validation.ok && validation.warnings.length > 0 && <span style={{ fontSize: 12, opacity: 0.7 }}>{validation.warnings[0]}</span>}
      </div>
      <div style={{ minHeight: 320, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 10 }}>
        <div style={{ minHeight: 320 }}>
          <WorkMap spec={spec} clock={clock} theme={theme ?? spec.theme} filter={filter} selectedId={selected} onNodeClick={onNodeClick} onEndClick={onEndClick} onLaneClick={onLaneClick} onEdgeClick={(id) => setSelected(id)} />
        </div>
        <aside className="wm-plate-el" style={{ fontSize: 12 }}><span className="wm-rivets" />
          <div className="wm-k">Inspector</div>
          {!selected && <p style={{ opacity: 0.7 }}>Select a node, track or end state. Add places nodes in a lane; Connect draws a track between two clicks.</p>}
          {node && <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <label>Label <input value={node.label} onChange={(e) => update((s) => { s.nodes.find((n) => n.id === node.id)!.label = e.target.value; return s })} style={inputStyle} /></label>
            <label>Kind <select value={node.kind} onChange={(e) => update((s) => { s.nodes.find((n) => n.id === node.id)!.kind = e.target.value as NodeKind; return s })} style={inputStyle}>{['source', 'step', 'route', 'split', 'govern'].map((k) => <option key={k}>{k}</option>)}</select></label>
            <label>Actor <select value={node.actor} onChange={(e) => update((s) => { s.nodes.find((n) => n.id === node.id)!.actor = e.target.value as Actor; return s })} style={inputStyle}>{['human', 'agent', 'either'].map((k) => <option key={k}>{k}</option>)}</select></label>
            <label>Stage <select value={node.stage} onChange={(e) => update((s) => { s.nodes.find((n) => n.id === node.id)!.stage = e.target.value; return s })} style={inputStyle}>{structure.stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <button type="button" className="wm-btn" onClick={remove}>Delete</button>
          </div>}
          {edge && <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <div>{structure.nodes.find((n) => n.id === edge.from)?.label} → {structure.nodes.find((n) => n.id === edge.to)?.label ?? structure.endStates.find((e) => e.id === edge.to)?.label}</div>
            <label>Weight {edge.weight.toFixed(2)} <input type="range" min={0.05} max={1} step={0.05} value={edge.weight} onChange={(e) => update((s) => { s.edges.find((x) => x.id === edge.id)!.weight = parseFloat(e.target.value); return normalizeFrom(s, edge.from, edge.id) })} style={{ width: '100%' }} /></label>
            <label><input type="checkbox" checked={!!edge.loop} onChange={(e) => update((s) => { s.edges.find((x) => x.id === edge.id)!.loop = e.target.checked || undefined; return s })} /> rework loop</label>
            <button type="button" className="wm-btn" onClick={remove}>Delete</button>
          </div>}
          {end && <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <label>Bucket name <input value={end.label} onChange={(e) => update((s) => { s.endStates.find((x) => x.id === end.id)!.label = e.target.value; return s })} style={inputStyle} /></label>
            <label>Tone <select value={end.tone} onChange={(e) => update((s) => { s.endStates.find((x) => x.id === end.id)!.tone = e.target.value as 'done' | 'open'; return s })} style={inputStyle}><option value="done">done (green)</option><option value="open">open (grey)</option></select></label>
            <button type="button" className="wm-btn" onClick={() => update((s) => { s.endStates.push({ id: uid('end'), label: 'Bucket', tone: 'open' }); return s })}>+ bucket</button>
            <button type="button" className="wm-btn" onClick={remove}>Delete</button>
          </div>}
          {structure.stages.length > 0 && <div style={{ marginTop: 14 }}><div className="wm-k">Stages</div>
            {structure.stages.slice().sort((a, b) => a.order - b.order).map((s) => <input key={s.id} value={s.label} onChange={(e) => update((x) => { x.stages.find((y) => y.id === s.id)!.label = e.target.value; return x })} style={{ ...inputStyle, marginTop: 4 }} aria-label={`Stage ${s.order + 1} name`} />)}
          </div>}
        </aside>
      </div>
      <Hud spec={spec} clock={clock} filter={filter} onFilter={setFilter} onScorecard={() => setScorecard(true)} />
      {scorecard && <Modal title="Scorecard" onClose={() => setScorecard(false)}><Scorecard spec={spec} at={clock.tick} /></Modal>}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', font: 'inherit', fontSize: 12, background: 'var(--wm-canvas)', color: 'var(--wm-text)', border: '1px solid var(--wm-plate-stroke)', borderRadius: 4, padding: '5px 7px', boxSizing: 'border-box' }

function normalizeFrom(s: Structure, from: string, keep?: string): Structure {
  const mine = s.edges.filter((e) => e.from === from)
  if (!mine.length) return s
  if (keep) {
    const kept = mine.find((e) => e.id === keep)!
    const others = mine.filter((e) => e.id !== keep)
    const rest = Math.max(0, 1 - kept.weight), sum = others.reduce((a, e) => a + e.weight, 0) || 1
    others.forEach((e) => (e.weight = Math.round((e.weight / sum) * rest * 1000) / 1000))
    return s
  }
  const sum = mine.reduce((a, e) => a + e.weight, 0) || 1
  mine.forEach((e) => (e.weight = Math.round((e.weight / sum) * 1000) / 1000))
  return s
}
