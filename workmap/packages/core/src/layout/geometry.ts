/** Curves without a dependency: cubic beziers sampled into points so tokens can travel along them. */
export type Pt = { x: number; y: number }

export function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

export type Segment = { kind: 'C'; p0: Pt; p1: Pt; p2: Pt; p3: Pt } | { kind: 'L'; p0: Pt; p1: Pt }

export type Polyline = { points: Pt[]; cum: number[]; length: number; d: string }

/** Sample a list of segments into a polyline with cumulative lengths and an SVG path string. */
export function samplePath(segments: Segment[], perSegment = 18): Polyline {
  const points: Pt[] = []
  let d = ''
  segments.forEach((s, i) => {
    if (i === 0) d += `M${s.p0.x.toFixed(1)} ${s.p0.y.toFixed(1)}`
    if (s.kind === 'L') {
      d += ` L${s.p1.x.toFixed(1)} ${s.p1.y.toFixed(1)}`
      if (i === 0) points.push(s.p0)
      points.push(s.p1)
    } else {
      d += ` C${s.p1.x.toFixed(1)} ${s.p1.y.toFixed(1)} ${s.p2.x.toFixed(1)} ${s.p2.y.toFixed(1)} ${s.p3.x.toFixed(1)} ${s.p3.y.toFixed(1)}`
      for (let k = i === 0 ? 0 : 1; k <= perSegment; k++) points.push(cubic(s.p0, s.p1, s.p2, s.p3, k / perSegment))
    }
  })
  const cum = [0]
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  return { points, cum, length: cum[cum.length - 1] || 0, d }
}

/** Point at a fraction u ∈ [0,1] of the polyline's length. */
export function pointAt(p: Polyline, u: number): Pt {
  if (p.points.length === 0) return { x: 0, y: 0 }
  if (p.points.length === 1 || p.length === 0) return p.points[0]
  const target = Math.max(0, Math.min(1, u)) * p.length
  let lo = 0, hi = p.cum.length - 1
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (p.cum[mid] <= target) lo = mid; else hi = mid }
  const span = p.cum[hi] - p.cum[lo] || 1
  const t = (target - p.cum[lo]) / span
  const a = p.points[lo], b = p.points[hi]
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}
