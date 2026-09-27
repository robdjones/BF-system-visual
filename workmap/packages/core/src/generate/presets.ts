import type { Preset } from '../spec/types'
import playClassic from '../presets/play-classic.json'
import reworkLoop from '../presets/rework-loop.json'
import agentHandoff from '../presets/agent-handoff-to-qa.json'
import modelSplit from '../presets/model-split.json'
import procedural from '../presets/procedural.json'

/** The pattern library. A preset is a partial MapSpec plus generator hints. */
export const PRESETS: Record<string, Preset> = {
  'play-classic': playClassic as Preset,
  'rework-loop': reworkLoop as Preset,
  'agent-handoff-to-qa': agentHandoff as Preset,
  'model-split': modelSplit as Preset,
  'procedural': procedural as Preset,
}
/** The hero uses the classic Play map with a fuller token stream. */
export const HERO_PRESET: Preset = { ...(playClassic as Preset), name: 'hero', hints: { ...(playClassic as Preset).hints, tokens: 140 } }

export function loadPreset(name: string): Preset {
  if (name === 'hero') return HERO_PRESET
  const p = PRESETS[name]
  if (!p) throw new Error(`unknown preset "${name}" — known: ${Object.keys(PRESETS).join(', ')}, hero`)
  return p
}
export const presetNames = () => [...Object.keys(PRESETS), 'hero']
