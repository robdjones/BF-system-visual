import seedrandom from 'seedrandom'

/** Seeded PRNG. Same seed, same sequence. Never Math.random. */
export type Rng = {
  float(): number                       // [0, 1)
  int(min: number, max: number): number // inclusive
  range(min: number, max: number): number
  chance(p: number): boolean
  pick<T>(arr: readonly T[]): T
  weighted<T>(arr: readonly T[], weights: readonly number[]): T
  gauss(mean: number, sd: number): number
  shuffle<T>(arr: readonly T[]): T[]
}

export function makeRng(seed: number | string): Rng {
  const r = seedrandom(String(seed))
  const rng: Rng = {
    float: () => r(),
    int: (min, max) => min + Math.floor(r() * (max - min + 1)),
    range: (min, max) => min + r() * (max - min),
    chance: (p) => r() < p,
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    weighted: (arr, weights) => {
      const total = weights.reduce((s, w) => s + w, 0)
      let x = r() * total
      for (let i = 0; i < arr.length; i++) { x -= weights[i]; if (x < 0) return arr[i] }
      return arr[arr.length - 1]
    },
    gauss: (mean, sd) => {
      // Box–Muller
      const u = 1 - r(), v = r()
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    shuffle: (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a },
  }
  return rng
}

/** A fresh seed for "refresh gives a new map". Only place that is allowed to be non-deterministic. */
export function randomSeed(): number {
  return Math.floor(Date.now() % 1_000_000_007) ^ Math.floor(performance.now() * 1000) & 0x7fffffff
}
