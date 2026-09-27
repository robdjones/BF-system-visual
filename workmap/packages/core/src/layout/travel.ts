import type { MapSpec, Token } from '../spec/types'
import { dwellWeight, TRAVEL_WEIGHT } from '../generate/generate'
import { pointAt, type Pt } from './geometry'
import { edgeBetween, nodeLookup, type Layout } from './layout'

/** Where a token is at a tick. Its lifetime [startedAt, finishedAt] is split across node dwells and edge travels
 *  by the same weights the generator used, so a token sits longer at a human step than at a route. */
export type TravelPlan = {
  token: Token
  legs: { kind: 'dwell' | 'travel'; at: string; edgeId?: string; t0: number; t1: number; loop?: boolean }[]
}

export function planTravel(spec: MapSpec, token: Token): TravelPlan {
  const nodes = nodeLookup(spec)
  const weights: number[] = []
  const legs: TravelPlan['legs'] = []
  const stops = [...token.path, token.endState]
  const seen = new Map<string, number>()
  for (let i = 0; i < stops.length; i++) {
    const id = stops[i]
    const node = nodes[id]
    if (node) {
      legs.push({ kind: 'dwell', at: id, t0: 0, t1: 0 })
      weights.push(dwellWeight(node.kind, node.actor === 'either' ? token.actor : node.actor))
      seen.set(id, (seen.get(id) ?? 0) + 1)
    } else {
      legs.push({ kind: 'dwell', at: id, t0: 0, t1: 0 })
      weights.push(0.0001)
    }
    if (i < stops.length - 1) {
      const next = stops[i + 1]
      // a loop edge is one that goes backwards to a node already visited
      const backwards = (seen.get(next) ?? 0) > 0
      const edge = edgeBetween(spec, id, next, backwards) ?? edgeBetween(spec, id, next, !backwards)
      legs.push({ kind: 'travel', at: id, edgeId: edge?.id, t0: 0, t1: 0, loop: edge?.loop })
      weights.push(TRAVEL_WEIGHT)
    }
  }
  const total = weights.reduce((a, b) => a + b, 0) || 1
  const D = token.finishedAt - token.startedAt
  let t = token.startedAt
  legs.forEach((leg, i) => { leg.t0 = t; t += (weights[i] / total) * D; leg.t1 = t })
  return { token, legs }
}

export type TokenState = { x: number; y: number; at: string; moving: boolean; edgeId?: string; done: boolean; started: boolean }

export function tokenAt(plan: TravelPlan, layout: Layout, tick: number): TokenState | null {
  const { token, legs } = plan
  if (tick < token.startedAt || tick > token.finishedAt) return null
  for (const leg of legs) {
    if (tick > leg.t1) continue
    if (leg.kind === 'dwell') {
      const p = pos(layout, leg.at)
      return { x: p.x, y: p.y, at: leg.at, moving: false, done: false, started: true }
    }
    const geom = leg.edgeId ? layout.edges[leg.edgeId] : undefined
    const u = (tick - leg.t0) / Math.max(1e-6, leg.t1 - leg.t0)
    if (!geom) {
      const a = pos(layout, leg.at), b = pos(layout, nextStop(legs, leg))
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, at: leg.at, moving: true, done: false, started: true }
    }
    const p = pointAt(geom.path, u)
    return { x: p.x, y: p.y, at: leg.at, moving: true, edgeId: leg.edgeId, done: false, started: true }
  }
  // float accumulation can leave the last leg a hair short of finishedAt: the token is at its end state
  const last = legs[legs.length - 1]
  const p = pos(layout, last.at)
  return { x: p.x, y: p.y, at: last.at, moving: false, done: true, started: true }
}

function nextStop(legs: TravelPlan['legs'], leg: TravelPlan['legs'][number]): string {
  const i = legs.indexOf(leg)
  return legs[i + 1]?.at ?? leg.at
}
function pos(layout: Layout, id: string): Pt {
  const n = layout.nodes[id]; if (n) return { x: n.x, y: n.y }
  const e = layout.ends[id]; if (e) return { x: e.x, y: e.y }
  return { x: 0, y: 0 }
}
