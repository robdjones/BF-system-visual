import type { MapSpec, Node, Edge, EndState, Actor, NodeKind } from '../spec/types'
import { samplePath, type Polyline, type Pt, type Segment } from './geometry'

/** Lane layout: stages are lanes along the flow axis, end states are the last lane. Horizontal on wide
 *  viewports, vertical on narrow ones. Everything is computed from the spec and the viewport, nothing stored. */

export type Orientation = 'horizontal' | 'vertical'
export type LayoutOptions = {
  width: number
  height: number
  orientation?: Orientation | 'auto'
  padding?: number
  breakpoint?: number           // below this width, lanes stack vertically (default 640)
}
export type LanePos = { id: string; label: string; x: number; y: number; w: number; h: number; index: number }
export type NodePos = { id: string; kind: NodeKind; actor: Actor; label: string; x: number; y: number; size: number; stage: string }
export type EndPos = { id: string; label: string; tone: EndState['tone']; x: number; y: number; w: number; h: number }
export type EdgeGeom = { id: string; from: string; to: string; weight: number; loop: boolean; path: Polyline }
export type Layout = {
  width: number
  height: number
  orientation: Orientation
  lanes: LanePos[]
  nodes: Record<string, NodePos>
  ends: Record<string, EndPos>
  edges: Record<string, EdgeGeom>
  nodeSize: number
  scale: number                 // 1 at ~1200px wide; type and stroke scale with it
}

export function layoutMap(spec: MapSpec, opts: LayoutOptions): Layout {
  const padding = opts.padding ?? 24
  const breakpoint = opts.breakpoint ?? 640
  const orientation: Orientation = opts.orientation && opts.orientation !== 'auto' ? opts.orientation : opts.width < breakpoint ? 'vertical' : 'horizontal'
  const W = Math.max(200, opts.width), H = Math.max(160, opts.height)
  // flow axis length (u) and cross axis (v)
  const along = orientation === 'horizontal' ? W : H
  const across = orientation === 'horizontal' ? H : W
  const stages = spec.stages.slice().sort((a, b) => a.order - b.order)
  const laneCount = stages.length + 1
  const laneLen = (along - padding * 2) / laneCount
  const crossLen = across - padding * 2
  const maxPerLane = Math.max(1, ...stages.map((s) => spec.nodes.filter((n) => n.stage === s.id).length), spec.endStates.length)
  const nodeSize = Math.max(22, Math.min(64, laneLen * 0.42, (crossLen / (maxPerLane + 0.5)) * 0.62))
  const scale = Math.max(0.6, Math.min(1.25, along / 1200))
  const toXY = (u: number, v: number): Pt => (orientation === 'horizontal' ? { x: u, y: v } : { x: v, y: u })

  const lanes: LanePos[] = stages.map((s, i) => {
    const u0 = padding + i * laneLen
    const p = toXY(u0, padding)
    return { id: s.id, label: s.label, index: i, x: p.x, y: p.y, w: orientation === 'horizontal' ? laneLen : crossLen, h: orientation === 'horizontal' ? crossLen : laneLen }
  })

  const nodes: Record<string, NodePos> = {}
  const nodeUV: Record<string, { u: number; v: number }> = {}
  stages.forEach((s, i) => {
    const list = spec.nodes.filter((n) => n.stage === s.id)
    const u = padding + i * laneLen + laneLen * 0.5
    list.forEach((n, k) => {
      const v = padding + (crossLen * (k + 1)) / (list.length + 1)
      nodeUV[n.id] = { u, v }
      const p = toXY(u, v)
      nodes[n.id] = { id: n.id, kind: n.kind, actor: n.actor, label: n.label, x: p.x, y: p.y, size: nodeSize, stage: n.stage }
    })
  })

  const ends: Record<string, EndPos> = {}
  const endUV: Record<string, { u: number; v: number }> = {}
  const endW = Math.min(laneLen * 0.8, 150 * scale), endH = Math.min(crossLen / (spec.endStates.length + 0.5) * 0.7, 56 * scale)
  spec.endStates.forEach((e, k) => {
    const u = padding + stages.length * laneLen + laneLen * 0.5
    const v = padding + (crossLen * (k + 1)) / (spec.endStates.length + 1)
    endUV[e.id] = { u, v }
    const p = toXY(u, v)
    const w = orientation === 'horizontal' ? endW : endH * 2.2, h = orientation === 'horizontal' ? endH : endH
    ends[e.id] = { id: e.id, label: e.label, tone: e.tone, x: p.x, y: p.y, w, h }
  })

  const edges: Record<string, EdgeGeom> = {}
  const half = nodeSize / 2
  const loopLanes = new Map<string, number>() // stagger loops so several don't overlap
  for (const e of spec.edges) {
    const a = nodeUV[e.from]; if (!a) continue
    const b = nodeUV[e.to] ?? endUV[e.to]; if (!b) continue
    const isEnd = !!endUV[e.to]
    const bHalf = isEnd ? (orientation === 'horizontal' ? ends[e.to].w / 2 : ends[e.to].h / 2) : half
    let segs: Segment[]
    if (e.loop) {
      // out the "down" side of `from`, back along the cross axis past the lane, into the "down" side of `to`
      const key = `${e.to}`
      const n = loopLanes.get(key) ?? 0
      loopLanes.set(key, n + 1)
      const dip = Math.min(crossLen * 0.22, 90 * scale) + n * 18 * scale
      const vLow = Math.max(a.v, b.v) + half + dip
      const p0 = toXY(a.u, a.v + half), p1 = toXY(a.u, vLow), p2 = toXY(b.u, vLow), p3 = toXY(b.u, b.v + half)
      const r = Math.min(40 * scale, Math.abs(a.u - b.u) / 3)
      segs = [
        { kind: 'C', p0, p1: toXY(a.u, a.v + half + dip * 0.9), p2: toXY(a.u + r * 0.2, vLow), p3: toXY(a.u - r, vLow) },
        { kind: 'L', p0: toXY(a.u - r, vLow), p1: toXY(b.u + r, vLow) },
        { kind: 'C', p0: toXY(b.u + r, vLow), p1: toXY(b.u - r * 0.2, vLow), p2: toXY(b.u, b.v + half + dip * 0.9), p3 },
      ]
      void p1; void p2
    } else {
      const p0 = toXY(a.u + half, a.v), p3 = toXY(b.u - bHalf, b.v)
      const mid = (a.u + half + b.u - bHalf) / 2
      segs = [{ kind: 'C', p0, p1: toXY(mid, a.v), p2: toXY(mid, b.v), p3 }]
    }
    edges[e.id] = { id: e.id, from: e.from, to: e.to, weight: e.weight, loop: !!e.loop, path: samplePath(segs) }
  }
  return { width: W, height: H, orientation, lanes, nodes, ends, edges, nodeSize, scale }
}

/** Find the edge a token travelled between two consecutive path entries (a node, then a node or end state). */
export function edgeBetween(spec: MapSpec, from: string, to: string, preferLoop: boolean): Edge | undefined {
  const cands = spec.edges.filter((e) => e.from === from && e.to === to)
  if (!cands.length) return undefined
  return cands.find((e) => !!e.loop === preferLoop) ?? cands[0]
}

export type NodeLookup = Record<string, Node>
export const nodeLookup = (spec: MapSpec): NodeLookup => Object.fromEntries(spec.nodes.map((n) => [n.id, n]))
