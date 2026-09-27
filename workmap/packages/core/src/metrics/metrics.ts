import type { MapSpec, Token } from '../spec/types'

/** Metrics are pure functions of Token[]. Nothing here is stored on the spec.
 *  `at` = the clock tick; only work finished (or started) by then counts, so the HUD moves with the map. */

export type Split = 'actor' | 'model' | 'stage' | 'workType'

export const finishedBy = (tokens: Token[], at = Infinity) => tokens.filter((t) => t.finishedAt <= at)
export const startedBy = (tokens: Token[], at = Infinity) => tokens.filter((t) => t.startedAt <= at)
export const inFlightAt = (tokens: Token[], at: number) => tokens.filter((t) => t.startedAt <= at && t.finishedAt > at)

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** Mean ticks from start to finish. */
export const cycleTime = (tokens: Token[], at = Infinity) => mean(finishedBy(tokens, at).map((t) => t.finishedAt - t.startedAt))
/** Work items finished per 100 ticks, over the window in which anything finished. */
export function velocity(tokens: Token[], at = Infinity): number {
  const done = finishedBy(tokens, at)
  if (!done.length) return 0
  const first = Math.min(...done.map((t) => t.startedAt)), last = Math.min(at, Math.max(...done.map((t) => t.finishedAt)))
  const span = Math.max(100, last - first)
  return (done.length / span) * 100
}
/** Alias the Play page used. */
export const throughput = velocity
/** Share of finished work that looped back at least once. */
export const reworkRate = (tokens: Token[], at = Infinity) => { const d = finishedBy(tokens, at); return d.length ? d.filter((t) => t.reworkCount > 0).length / d.length : 0 }
/** Mean synthetic dollars per finished unit of work. */
export const costPerUnit = (tokens: Token[], at = Infinity) => mean(finishedBy(tokens, at).map((t) => t.cost))
/** Share of finished work that passed a governance check. */
export function compliance(spec: MapSpec, at = Infinity): number {
  const govern = new Set(spec.nodes.filter((n) => n.kind === 'govern').map((n) => n.id))
  if (!govern.size) return 1
  const d = finishedBy(spec.tokens, at)
  return d.length ? d.filter((t) => t.path.some((id) => govern.has(id))).length / d.length : 0
}
export function endStateDistribution(spec: MapSpec, at = Infinity): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(spec.endStates.map((e) => [e.id, 0]))
  for (const t of finishedBy(spec.tokens, at)) out[t.endState] = (out[t.endState] ?? 0) + 1
  return out
}
/** Human minus agent, for cycle time and cost: negative means agents are faster / cheaper. */
export function humanAgentDelta(tokens: Token[], at = Infinity): { cycleTime: number; cost: number; humans: number; agents: number } {
  const d = finishedBy(tokens, at)
  const h = d.filter((t) => t.actor === 'human'), a = d.filter((t) => t.actor === 'agent')
  const ct = (xs: Token[]) => mean(xs.map((t) => t.finishedAt - t.startedAt))
  const cost = (xs: Token[]) => mean(xs.map((t) => t.cost))
  return { cycleTime: ct(h) - ct(a), cost: cost(h) - cost(a), humans: h.length, agents: a.length }
}

export type Row = { key: string; count: number; cycleTime: number; cost: number; reworkRate: number }
/** Any metric, split by actor, model, stage or work type. Stage split counts a token in every stage it visited. */
export function splitBy(spec: MapSpec, by: Split, at = Infinity): Row[] {
  const done = finishedBy(spec.tokens, at)
  const groups = new Map<string, Token[]>()
  const push = (k: string, t: Token) => { if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(t) }
  const stageOf = new Map(spec.nodes.map((n) => [n.id, n.stage]))
  const stageLabel = new Map(spec.stages.map((s) => [s.id, s.label]))
  for (const t of done) {
    if (by === 'actor') push(t.actor, t)
    else if (by === 'model') push(t.model ?? (t.actor === 'human' ? 'human' : 'unknown'), t)
    else if (by === 'workType') push(t.workType, t)
    else for (const s of new Set(t.path.map((id) => stageOf.get(id)).filter(Boolean) as string[])) push(stageLabel.get(s) ?? s, t)
  }
  const rows: Row[] = []
  for (const [key, ts] of groups) rows.push({ key, count: ts.length, cycleTime: mean(ts.map((t) => t.finishedAt - t.startedAt)), cost: mean(ts.map((t) => t.cost)), reworkRate: ts.filter((t) => t.reworkCount > 0).length / ts.length })
  if (by === 'stage') { const order = spec.stages.slice().sort((a, b) => a.order - b.order).map((s) => s.label); rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)) }
  else rows.sort((a, b) => b.count - a.count)
  return rows
}

/** Per-node view for the node modal: how much work passed, who did it, how long it took on average. */
export function nodeStats(spec: MapSpec, nodeId: string, at = Infinity) {
  const through = finishedBy(spec.tokens, at).filter((t) => t.path.includes(nodeId))
  const visits = through.reduce((s, t) => s + t.path.filter((id) => id === nodeId).length, 0)
  return {
    tokens: through.length, visits, revisits: visits - through.length,
    humans: through.filter((t) => t.actor === 'human').length, agents: through.filter((t) => t.actor === 'agent').length,
    cycleTime: mean(through.map((t) => t.finishedAt - t.startedAt)), cost: mean(through.map((t) => t.cost)),
    reworkRate: through.length ? through.filter((t) => t.reworkCount > 0).length / through.length : 0,
  }
}

/** The metric strip: the Play page's five plus cost per unit and the human vs agent delta. */
export function strip(spec: MapSpec, at = Infinity) {
  const t = spec.tokens
  return {
    cycleTime: cycleTime(t, at), rework: reworkRate(t, at), compliance: compliance(spec, at), throughput: velocity(t, at),
    inFlight: inFlightAt(t, Math.min(at, Infinity)).length, costPerUnit: costPerUnit(t, at), delta: humanAgentDelta(t, at),
    finished: finishedBy(t, at).length,
  }
}

/** A text equivalent of the map, for screen readers and the accessible summary on the play route. */
export function describe(spec: MapSpec, at = Infinity): string {
  const s = strip(spec, at)
  const dist = endStateDistribution(spec, at)
  const ends = spec.endStates.map((e) => `${dist[e.id] ?? 0} ${e.label}`).join(', ')
  const pct = (x: number) => `${Math.round(x * 100)}%`
  return `A work map with ${spec.stages.length} stages and ${spec.nodes.length} steps. ${s.finished} work items finished, ${s.inFlight} in flight. ` +
    `Average cycle time ${Math.round(s.cycleTime)} ticks, rework ${pct(s.rework)}, compliance ${pct(s.compliance)}, throughput ${s.throughput.toFixed(1)} per 100 ticks, ` +
    `cost per unit $${Math.round(s.costPerUnit)}. Humans took ${Math.round(s.delta.cycleTime)} ticks longer and cost $${Math.round(s.delta.cost)} more per item than agents. End states: ${ends}.`
}
