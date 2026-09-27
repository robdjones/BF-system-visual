import type { MapSpec } from './types'

export type Validation = { ok: boolean; errors: string[]; warnings: string[] }

/** Structural validation. Errors block rendering; warnings are worth a look in the builder. */
export function validateSpec(spec: MapSpec): Validation {
  const errors: string[] = []
  const warnings: string[] = []
  const dup = (ids: string[], what: string) => {
    const seen = new Set<string>()
    for (const id of ids) { if (seen.has(id)) errors.push(`duplicate ${what} id "${id}"`); seen.add(id) }
  }
  if (!spec || typeof spec !== 'object') return { ok: false, errors: ['spec is not an object'], warnings }
  if (!Array.isArray(spec.stages) || spec.stages.length === 0) errors.push('spec needs at least one stage')
  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) errors.push('spec needs at least one node')
  if (!Array.isArray(spec.endStates) || spec.endStates.length === 0) errors.push('spec needs at least one end state')
  if (!Array.isArray(spec.edges)) errors.push('spec.edges must be an array')
  if (!Array.isArray(spec.tokens)) errors.push('spec.tokens must be an array')
  if (errors.length) return { ok: false, errors, warnings }

  dup(spec.stages.map((s) => s.id), 'stage')
  dup(spec.nodes.map((n) => n.id), 'node')
  dup(spec.edges.map((e) => e.id), 'edge')
  dup(spec.endStates.map((e) => e.id), 'endState')
  dup(spec.tokens.map((t) => t.id), 'token')

  const stageIds = new Set(spec.stages.map((s) => s.id))
  const nodeIds = new Set(spec.nodes.map((n) => n.id))
  const endIds = new Set(spec.endStates.map((e) => e.id))
  const kinds = new Set(['source', 'step', 'route', 'split', 'govern'])
  const actors = new Set(['human', 'agent', 'either'])
  for (const n of spec.nodes) {
    if (!stageIds.has(n.stage)) errors.push(`node "${n.id}" points at unknown stage "${n.stage}"`)
    if (!kinds.has(n.kind)) errors.push(`node "${n.id}" has unknown kind "${n.kind}"`)
    if (!actors.has(n.actor)) errors.push(`node "${n.id}" has unknown actor "${n.actor}"`)
  }
  if (!spec.nodes.some((n) => n.kind === 'source')) warnings.push('no source node: tokens will start at the first node')
  const out = new Map<string, number>()
  for (const e of spec.edges) {
    if (!nodeIds.has(e.from)) errors.push(`edge "${e.id}" starts at unknown node "${e.from}"`)
    if (!nodeIds.has(e.to) && !endIds.has(e.to)) errors.push(`edge "${e.id}" ends at unknown node or end state "${e.to}"`)
    if (!(e.weight >= 0 && e.weight <= 1)) errors.push(`edge "${e.id}" weight must be within 0..1`)
    out.set(e.from, (out.get(e.from) ?? 0) + (e.weight || 0))
  }
  for (const n of spec.nodes) {
    const w = out.get(n.id) ?? 0
    if (w === 0) warnings.push(`node "${n.id}" has no outgoing edge`)
    else if (Math.abs(w - 1) > 0.02) warnings.push(`node "${n.id}" outgoing weights sum to ${w.toFixed(2)}, not 1`)
  }
  for (const e of spec.endStates) if (e.tone !== 'done' && e.tone !== 'open') errors.push(`end state "${e.id}" tone must be done or open`)
  for (const t of spec.tokens) {
    if (t.actor !== 'human' && t.actor !== 'agent') errors.push(`token "${t.id}" actor must be human or agent`)
    if (!endIds.has(t.endState)) errors.push(`token "${t.id}" ends at unknown end state "${t.endState}"`)
    for (const id of t.path) if (!nodeIds.has(id)) { errors.push(`token "${t.id}" visits unknown node "${id}"`); break }
    if (!(t.finishedAt > t.startedAt)) errors.push(`token "${t.id}" must finish after it starts`)
  }
  return { ok: errors.length === 0, errors, warnings }
}
