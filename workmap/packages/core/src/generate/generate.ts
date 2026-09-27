import type { MapSpec, Preset, GeneratorHints, Stage, Node, Edge, EndState, Token, NodeKind } from '../spec/types'
import { makeRng, type Rng } from '../spec/seed'

/** Deterministic: same preset and seed, same spec. Structure comes from the preset when it has one,
 *  otherwise it is invented from the hints. Tokens are always simulated here. */

const STAGE_POOL = ['Intake', 'Spec', 'Build', 'Review', 'Verify', 'Release']
const STEP_LABELS = {
  human: ['Triage', 'Write spec', 'Design', 'Code', 'Code review', 'QA', 'Sign-off', 'Deploy'],
  agent: ['Draft spec', 'Plan', 'Implement', 'Write tests', 'Fix lint', 'Summarize', 'Auto-review'],
}
const DEFAULT_WORK_TYPES = ['feature', 'bug', 'spike', 'chore']
const DEFAULT_MODELS = ['Model A', 'Model B', 'Model C']
const DEFAULT_ENDS: EndState[] = [
  { id: 'feature', label: 'Feature', tone: 'done' },
  { id: 'initiative', label: 'Initiative', tone: 'done' },
  { id: 'orphan', label: 'Orphan', tone: 'open' },
  { id: 'canceled', label: 'Canceled', tone: 'open' },
]

// dwell weights per node kind and actor: how long a token sits at a node, relative
export function dwellWeight(kind: NodeKind, actor: 'human' | 'agent' | 'either'): number {
  switch (kind) {
    case 'source': return 0.3
    case 'route': return 0.4
    case 'split': return 0.4
    case 'govern': return 0.9
    case 'step': return actor === 'agent' ? 0.8 : 1.6
  }
}
export const TRAVEL_WEIGHT = 0.5

export function generate(preset: Preset, seed: number = preset.seed ?? 1): MapSpec {
  const rng = makeRng(`${preset.name}:${seed}`)
  const hints: Required<GeneratorHints> = {
    stages: 5, nodesPerStage: [1, 3], agentShare: 0.5, reworkChance: 0.5, splitChance: 0.35, governChance: 0.5,
    tokens: 80, ticks: 1000, workTypes: DEFAULT_WORK_TYPES, models: DEFAULT_MODELS, ...(preset.hints ?? {}),
  }

  const structure = preset.nodes && preset.nodes.length
    ? { stages: preset.stages ?? [], nodes: preset.nodes, edges: preset.edges ?? [], endStates: preset.endStates ?? DEFAULT_ENDS }
    : inventStructure(rng, hints)

  const stages = structure.stages.slice().sort((a, b) => a.order - b.order)
  const tokens = simulateTokens(rng, hints, stages, structure.nodes, structure.edges, structure.endStates)

  return {
    id: preset.id ?? `${preset.name}-${seed}`,
    seed,
    theme: preset.theme ?? 'play',
    stages, nodes: structure.nodes, edges: structure.edges, endStates: structure.endStates, tokens,
  }
}

function inventStructure(rng: Rng, h: Required<GeneratorHints>) {
  const count = Math.max(3, Math.min(6, h.stages))
  const stages: Stage[] = STAGE_POOL.slice(0, count).map((label, i) => ({ id: label.toLowerCase(), label, order: i }))
  const nodes: Node[] = []
  const edges: Edge[] = []
  const byStage: Node[][] = []
  let n = 0
  stages.forEach((s, si) => {
    const list: Node[] = []
    if (si === 0) {
      list.push({ id: `n${n++}`, stage: s.id, kind: 'source', actor: 'either', label: 'Backlog' })
      if (rng.chance(0.6)) list.push({ id: `n${n++}`, stage: s.id, kind: 'route', actor: 'either', label: 'Triage' })
    } else {
      const k = rng.int(h.nodesPerStage[0], h.nodesPerStage[1])
      for (let i = 0; i < k; i++) {
        const roll = rng.float()
        let kind: NodeKind = 'step'
        if (roll < h.splitChance * 0.4 && si < count - 1) kind = 'split'
        else if (roll < h.splitChance * 0.4 + h.governChance * 0.35 && si >= count - 2) kind = 'govern'
        else if (roll > 0.85 && si < count - 1) kind = 'route'
        const actor = kind === 'step' ? (rng.chance(h.agentShare) ? 'agent' : 'human') : 'either'
        const label = kind === 'step' ? rng.pick(STEP_LABELS[actor as 'human' | 'agent']) : kind === 'split' ? rng.pick(['Model A / B', 'Human / agent']) : kind === 'govern' ? rng.pick(['Policy check', 'Spec gate', 'Compliance']) : rng.pick(['Route', 'Assign'])
        list.push({ id: `n${n++}`, stage: s.id, kind, actor, label })
      }
    }
    byStage.push(list)
    nodes.push(...list)
  })
  // connect each stage to the next; within stage 0 chain source → route
  let e = 0
  for (let si = 0; si < count; si++) {
    const here = byStage[si], next = byStage[si + 1]
    if (si === 0 && here.length === 2) { edges.push({ id: `e${e++}`, from: here[0].id, to: here[1].id, weight: 1 }); }
    const tails = si === 0 ? [here[here.length - 1]] : here
    for (const from of tails) {
      if (!next) {
        // last stage → end states, weighted toward done
        const ends = DEFAULT_ENDS
        const w = normalize([0.55, 0.2, 0.15, 0.1].map((x) => x * rng.range(0.7, 1.3)))
        ends.forEach((end, i) => edges.push({ id: `e${e++}`, from: from.id, to: end.id, weight: w[i] }))
        continue
      }
      const fan = from.kind === 'split' || from.kind === 'route' ? Math.min(next.length, rng.int(2, 3)) : Math.min(next.length, rng.chance(0.3) ? 2 : 1)
      const targets = rng.shuffle(next).slice(0, fan)
      const w = normalize(targets.map(() => rng.range(0.5, 1)))
      targets.forEach((to, i) => edges.push({ id: `e${e++}`, from: from.id, to: to.id, weight: w[i] }))
    }
  }
  // every node in a middle stage must have an incoming edge
  for (let si = 1; si < count; si++) for (const node of byStage[si]) {
    if (!edges.some((x) => x.to === node.id)) {
      const from = rng.pick(byStage[si - 1])
      edges.push({ id: `e${e++}`, from: from.id, to: node.id, weight: 0.3 })
      renormalize(edges, from.id)
    }
  }
  // rework loops: a review-ish step bends back to a build-ish step
  for (let si = 2; si < count; si++) for (const node of byStage[si]) {
    if ((node.kind === 'step' || node.kind === 'govern') && rng.chance(h.reworkChance * 0.5)) {
      const back = rng.pick(byStage[si - 1].filter((x) => x.kind === 'step')) ?? rng.pick(byStage[si - 1])
      edges.push({ id: `e${e++}`, from: node.id, to: back.id, weight: rng.range(0.12, 0.3), loop: true })
      renormalize(edges, node.id)
    }
  }
  return { stages, nodes, edges, endStates: DEFAULT_ENDS.map((x) => ({ ...x })) }
}

function normalize(w: number[]): number[] { const s = w.reduce((a, b) => a + b, 0) || 1; return w.map((x) => Math.round((x / s) * 1000) / 1000) }
function renormalize(edges: Edge[], from: string) {
  const mine = edges.filter((x) => x.from === from)
  const w = normalize(mine.map((x) => x.weight))
  mine.forEach((x, i) => (x.weight = w[i]))
}

function simulateTokens(rng: Rng, h: Required<GeneratorHints>, stages: Stage[], nodes: Node[], edges: Edge[], ends: EndState[]): Token[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const endIds = new Set(ends.map((x) => x.id))
  const outgoing = new Map<string, Edge[]>()
  for (const e of edges) { if (!outgoing.has(e.from)) outgoing.set(e.from, []); outgoing.get(e.from)!.push(e) }
  const stageOrder = new Map(stages.map((s) => [s.id, s.order]))
  const sources = nodes.filter((n) => n.kind === 'source')
  const start = sources.length ? sources : [nodes.slice().sort((a, b) => (stageOrder.get(a.stage) ?? 0) - (stageOrder.get(b.stage) ?? 0))[0]]
  const unit = h.ticks / 22 // one dwell unit in ticks (a typical item finishes in 200–350 ticks)
  const tokens: Token[] = []
  for (let i = 0; i < h.tokens; i++) {
    const actor: 'human' | 'agent' = rng.chance(h.agentShare) ? 'agent' : 'human'
    const model = actor === 'agent' ? rng.pick(h.models) : undefined
    const workType = rng.pick(h.workTypes)
    const speed = actor === 'agent' ? rng.range(0.55, 0.9) : rng.range(0.9, 1.4)
    let node = rng.pick(start)
    const path: string[] = []
    let ticks = 0, cost = 0, rework = 0, endState = ends[ends.length - 1].id
    const loopsTaken = new Map<string, number>()
    for (let guard = 0; guard < 40; guard++) {
      path.push(node.id)
      const dwell = dwellWeight(node.kind, node.actor === 'either' ? actor : node.actor) * unit * speed * rng.range(0.6, 1.5)
      ticks += dwell
      cost += stepCost(rng, node, actor)
      const outs = outgoing.get(node.id) ?? []
      if (!outs.length) { endState = ends.find((x) => x.tone === 'open')?.id ?? endState; break }
      // loops get less likely each time they are taken by this token
      const weights = outs.map((e) => (e.loop ? e.weight * Math.pow(0.35, loopsTaken.get(e.id) ?? 0) : e.weight))
      const e = rng.weighted(outs, weights)
      ticks += TRAVEL_WEIGHT * unit * rng.range(0.7, 1.3)
      if (e.loop) { rework++; loopsTaken.set(e.id, (loopsTaken.get(e.id) ?? 0) + 1) }
      if (endIds.has(e.to)) { endState = e.to; break }
      node = nodeById.get(e.to)!
    }
    const startedAt = Math.round(rng.range(0, h.ticks * 0.72))
    tokens.push({
      id: `t${i}`, workType, actor, model, path, endState,
      cost: Math.round(cost), startedAt, finishedAt: Math.round(startedAt + Math.max(ticks, unit * 0.5)), reworkCount: rework,
    })
  }
  return tokens.sort((a, b) => a.startedAt - b.startedAt).map((t, i) => ({ ...t, id: `t${i}` }))
}

function stepCost(rng: Rng, node: Node, actor: 'human' | 'agent'): number {
  const who = node.actor === 'either' ? actor : node.actor
  if (node.kind === 'source') return 0
  if (node.kind === 'route' || node.kind === 'split') return who === 'agent' ? rng.range(1, 4) : rng.range(15, 40)
  if (node.kind === 'govern') return who === 'agent' ? rng.range(3, 9) : rng.range(40, 90)
  return who === 'agent' ? rng.range(6, 30) : rng.range(120, 420)
}
