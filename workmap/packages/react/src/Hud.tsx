import { useMemo } from 'react'
import { metrics, type MapSpec } from '@bloomfilter/workmap-core'
import type { Clock } from './useClock'
import type { Filter } from './WorkMap'

export type HudProps = {
  spec: MapSpec
  clock: Clock
  filter: Filter
  onFilter: (f: Filter) => void
  onScorecard?: () => void
  compact?: boolean
}

const fmt = (x: number, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '–')
const pct = (x: number) => `${Math.round(x * 100)}%`

/** Metric strip on riveted plates. Every number traces to the token list at the current tick. */
export function Hud({ spec, clock, filter, onFilter, onScorecard, compact }: HudProps) {
  const at = clock.tick
  const tokens = useMemo(() => (filter === 'combined' ? spec.tokens : spec.tokens.filter((t) => t.actor === filter)), [spec, filter])
  const view = useMemo(() => ({ ...spec, tokens }), [spec, tokens])
  const s = useMemo(() => metrics.strip(view, at), [view, at])
  const none = s.finished === 0
  const both = s.delta.humans > 0 && s.delta.agents > 0
  const plates: { k: string; v: string; s?: string }[] = [
    { k: 'Cycle time', v: none ? '–' : `${fmt(s.cycleTime)}`, s: 'ticks, mean' },
    { k: 'Rework', v: none ? '–' : pct(s.rework), s: 'looped at least once' },
    { k: 'Compliance', v: none ? '–' : pct(s.compliance), s: 'passed a check' },
    { k: 'Throughput', v: none ? '–' : fmt(s.throughput, 1), s: 'per 100 ticks' },
    { k: 'In flight', v: `${s.inFlight}`, s: `${s.finished} finished` },
    { k: 'Cost / unit', v: none ? '–' : `$${fmt(s.costPerUnit)}`, s: 'synthetic' },
    { k: 'Human − agent', v: both ? `${s.delta.cycleTime >= 0 ? '+' : ''}${fmt(s.delta.cycleTime)}` : '–', s: both ? `ticks · $${fmt(s.delta.cost)} cost` : 'ticks · cost' },
  ]
  const shown = compact ? plates.slice(0, 5) : plates
  return (
    <div className="wm-hud" role="group" aria-label="Work map metrics">
      {shown.map((p) => (
        <div className="wm-plate-el" key={p.k}><span className="wm-rivets" /><div className="wm-k">{p.k}</div><div className="wm-v">{p.v}</div>{p.s && <div className="wm-s">{p.s}</div>}</div>
      ))}
      <div className="wm-toggle" role="radiogroup" aria-label="Show">
        {(['human', 'agent', 'combined'] as Filter[]).map((f) => (
          <button key={f} type="button" role="radio" aria-checked={filter === f} className={`wm-btn${filter === f ? ' wm-on' : ''}`} onClick={() => onFilter(f)}>{f === 'human' ? 'Humans' : f === 'agent' ? 'Agents' : 'Combined'}</button>
        ))}
      </div>
      <button type="button" className={`wm-btn${clock.playing ? '' : ' wm-on'}`} onClick={clock.toggle} aria-pressed={clock.playing}>{clock.playing ? 'Pause' : 'Play'}</button>
      <button type="button" className={`wm-btn${clock.speed > 1 ? ' wm-on' : ''}`} aria-label="Hold to accelerate"
        onPointerDown={() => clock.setSpeed(8)} onPointerUp={() => clock.setSpeed(1)} onPointerLeave={() => clock.setSpeed(1)} onPointerCancel={() => clock.setSpeed(1)}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') clock.setSpeed(8) }} onKeyUp={() => clock.setSpeed(1)}>Hold ▸▸</button>
      {onScorecard && <button type="button" className="wm-btn" onClick={onScorecard}>Scorecard</button>}
    </div>
  )
}
