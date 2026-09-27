/** One JSON document describes a map. The generator and the builder write it; layout, render, interaction and export read it.
 *  Metrics are computed from tokens at runtime, never stored. Synthetic data only. */

export type ThemeId = 'play' | 'rave' | 'plain'

export type MapSpec = {
  id: string
  seed: number                 // same seed, same map; shareable in a URL
  theme: ThemeId
  stages: Stage[]              // lanes work moves through, left to right
  nodes: Node[]
  edges: Edge[]
  endStates: EndState[]        // terminal blocks at the end of the map
  tokens: Token[]              // synthetic work items (the dots)
}

export type Stage = { id: string; label: string; order: number }

export type NodeKind = 'source' | 'step' | 'route' | 'split' | 'govern'
export type Actor = 'human' | 'agent' | 'either'

export type Node = {
  id: string
  stage: string                // Stage.id
  kind: NodeKind
  //  source  work enters
  //  step    a diamond, orange for human, pink for agent
  //  route   blue diamond, routing and branching
  //  split   yellow split node: model A vs B, human vs agent
  //  govern  pink hexagon, a governance check
  actor: Actor
  label: string                // rendered on a plate badge
}

export type Edge = {
  id: string
  from: string                 // Node.id
  to: string                   // Node.id or EndState.id
  weight: number               // share of tokens that take this path, 0 to 1
  loop?: boolean               // rework: the track bends backward past a node
}

export type EndState = {
  id: string
  label: string                // 'Initiative' | 'Feature' | 'Orphan' | 'Canceled', user-renamable
  tone: 'done' | 'open'        // green Done block, or grey block with rivets
}

export type Token = {
  id: string
  workType: string             // 'feature' | 'bug' | 'spike' | ...
  actor: 'human' | 'agent'     // orange dot or pink dot
  model?: string               // for agent tokens: which model
  path: string[]               // ordered Node.ids it visited
  endState: string             // EndState.id
  cost: number                 // synthetic dollars
  startedAt: number            // tick
  finishedAt: number           // tick
  reworkCount: number
}

/** Generator hints ride on a preset. Everything here is optional; the generator fills the rest from the seed. */
export type GeneratorHints = {
  stages?: number              // lanes to invent when the preset gives none (4–6)
  nodesPerStage?: [number, number]
  agentShare?: number          // share of steps and tokens that are agents, 0..1
  reworkChance?: number        // chance a review-ish step gets a rework loop
  splitChance?: number
  governChance?: number
  tokens?: number              // how many work items to simulate
  ticks?: number               // timeline length in ticks
  workTypes?: string[]
  models?: string[]
}

/** A preset is a partial MapSpec plus generator hints. A pattern library is a folder of presets. */
export type Preset = Partial<Omit<MapSpec, 'tokens'>> & {
  name: string
  description?: string
  hints?: GeneratorHints
}
