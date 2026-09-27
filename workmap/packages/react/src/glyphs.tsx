import type { NodePos, EndPos } from '@bloomfilter/workmap-core'

/** The six node glyphs and the plate badge. Colors come from CSS variables only. */
export function Glyph({ n }: { n: NodePos }) {
  const s = n.size, h = s / 2
  const cls = 'wm-glyph'
  switch (n.kind) {
    case 'source':
      return <rect className={cls} x={-h} y={-h * 0.7} width={s} height={s * 0.7} rx={s * 0.16} fill="var(--wm-source)" />
    case 'step': {
      const fill = n.actor === 'agent' ? 'var(--wm-agent)' : n.actor === 'human' ? 'var(--wm-human)' : 'var(--wm-either)'
      return <polygon className={cls} points={`0,${-h} ${h},0 0,${h} ${-h},0`} fill={fill} />
    }
    case 'route':
      return <polygon className={cls} points={`0,${-h} ${h},0 0,${h} ${-h},0`} fill="var(--wm-route)" />
    case 'split':
      return (
        <g className={cls}>
          <polygon points={`0,${-h} ${h},0 0,${h} ${-h},0`} fill="var(--wm-split)" />
          <path d={`M0 ${-h * 0.55} L0 ${h * 0.05} M0 ${h * 0.05} L${-h * 0.42} ${h * 0.5} M0 ${h * 0.05} L${h * 0.42} ${h * 0.5}`} stroke="var(--wm-canvas)" strokeWidth={Math.max(1.5, s * 0.07)} fill="none" strokeLinecap="round" />
        </g>
      )
    case 'govern': {
      const pts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i; return `${(h * Math.cos(a)).toFixed(2)},${(h * Math.sin(a)).toFixed(2)}` }).join(' ')
      return <polygon className={cls} points={pts} fill="var(--wm-govern)" />
    }
  }
}

/** Riveted plate badge: the one label style for nodes, edges, buckets and the HUD. */
export function Plate({ text, x, y, scale = 1, anchor = 'middle', tone }: { text: string; x: number; y: number; scale?: number; anchor?: 'middle' | 'start'; tone?: 'done' | 'open' }) {
  const fs = 10.5 * scale
  const padX = 7 * scale, h = 18 * scale
  const w = Math.max(26 * scale, text.length * fs * 0.62 + padX * 2)
  const left = anchor === 'middle' ? x - w / 2 : x
  const rivet = 1.5 * scale
  const fill = tone === 'done' ? 'var(--wm-end-done)' : 'var(--wm-plate)'
  const textFill = tone === 'done' ? 'var(--wm-end-text-done)' : 'var(--wm-plate-text)'
  return (
    <g className="wm-plate" aria-hidden="true">
      <rect x={left} y={y - h / 2} width={w} height={h} rx={2.5 * scale} fill={fill} stroke="var(--wm-plate-stroke)" strokeWidth={1} />
      {[[left + 3.5 * scale, y - h / 2 + 3.5 * scale], [left + w - 3.5 * scale, y - h / 2 + 3.5 * scale], [left + 3.5 * scale, y + h / 2 - 3.5 * scale], [left + w - 3.5 * scale, y + h / 2 - 3.5 * scale]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={rivet} fill="var(--wm-rivet)" />
      ))}
      <text x={left + w / 2} y={y} fontSize={fs} textAnchor="middle" dominantBaseline="central" style={{ fill: textFill, letterSpacing: '0.04em' }}>{text}</text>
    </g>
  )
}

export function EndBlock({ e, scale, selected }: { e: EndPos; scale: number; selected?: boolean }) {
  const done = e.tone === 'done'
  const rivet = 2 * scale
  return (
    <g className={`wm-end${selected ? ' wm-selected' : ''}`}>
      <rect className="wm-glyph" x={e.x - e.w / 2} y={e.y - e.h / 2} width={e.w} height={e.h} rx={4 * scale} fill={done ? 'var(--wm-end-done)' : 'var(--wm-end-open)'} stroke={selected ? 'var(--wm-text)' : 'var(--wm-plate-stroke)'} strokeWidth={selected ? 2 : 1} />
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy], i) => (
        <circle key={i} cx={e.x + sx * (e.w / 2 - 6 * scale)} cy={e.y + sy * (e.h / 2 - 6 * scale)} r={rivet} fill={done ? 'var(--wm-end-text-done)' : 'var(--wm-rivet)'} opacity={0.7} />
      ))}
      <text x={e.x} y={e.y} fontSize={11 * scale} textAnchor="middle" dominantBaseline="central" style={{ fill: done ? 'var(--wm-end-text-done)' : 'var(--wm-plate-text)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{e.label.toUpperCase()}</text>
    </g>
  )
}
