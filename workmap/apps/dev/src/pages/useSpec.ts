import { useMemo } from 'react'
import { generate, loadPreset, decodeSpecFromUrl, type MapSpec, type ThemeId } from '@bloomfilter/workmap-core'

/** Spec from the URL: ?spec=<encoded> wins, else ?preset=&seed=. Theme from ?theme=. */
export function useSpecFromParams(params: URLSearchParams, fallbackPreset = 'play-classic'): { spec: MapSpec; preset: string; seed: number; theme: ThemeId } {
  const preset = params.get('preset') ?? fallbackPreset
  const seed = Number(params.get('seed') ?? 1) || 1
  const theme = (params.get('theme') as ThemeId) || 'play'
  const encoded = params.get('spec')
  const spec = useMemo(() => {
    const structure = encoded ? decodeSpecFromUrl(encoded) : null
    const base = structure ? { name: 'shared', ...structure, hints: { tokens: 80, ticks: 1000 } } : loadPreset(preset)
    return { ...generate(base, seed), theme }
  }, [encoded, preset, seed, theme])
  return { spec, preset, seed, theme }
}
