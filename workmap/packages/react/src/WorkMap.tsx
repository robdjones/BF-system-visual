import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { layoutMap, planTravel, tokenAt, type MapSpec, type Layout, type ThemeId, type TravelPlan } from '@bloomfilter/workmap-core'
import { EndBlock, Glyph, Plate } from './glyphs'
import type { Clock } from './useClock'

export type Filter = 'human' | 'agent' | 'combined'
export type WorkMapProps = {
  spec: MapSpec
  clock: Clock
  theme?: ThemeId
  filter?: Filter
  orientation?: 'auto' | 'horizontal' | 'vertical'
  selectedId?: string | null
  onNodeClick?: (id: string) => void
  onEndClick?: (id: string) => void
  onLaneClick?: (stageId: string, point: { x: number; y: number }) => void
  onEdgeClick?: (id: string) => void
  onHold?: (down: boolean) => void      // hold-to-accelerate on the map itself
  showLaneLabels?: boolean
  labels?: boolean                     // node plate badges (off for thumbnails)
  decorative?: boolean                 // hero: aria-hidden, no focus
  className?: string
  style?: React.CSSProperties
}

const MODEL_STROKES = ['var(--wm-model-a)', 'var(--wm-model-b)', 'var(--wm-model-c)']

export function WorkMap(props: WorkMapProps) {
  const { spec, clock, theme = spec.theme, filter = 'combined', selectedId, decorative } = props
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1200, h: 600 })
  useLayoutEffect(() => {
    const el = host.current; if (!el) return
    const ro = new ResizeObserver(([entry]) => { const r = entry.contentRect; if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height }) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const layout: Layout = useMemo(() => layoutMap(spec, { width: size.w, height: size.h, orientation: props.orientation ?? 'auto' }), [spec, size.w, size.h, props.orientation])
  const plans: TravelPlan[] = useMemo(() => spec.tokens.map((t) => planTravel(spec, t)), [spec])
  const models = useMemo(() => Array.from(new Set(spec.tokens.map((t) => t.model).filter(Boolean))) as string[], [spec])

  // tokens are driven imperatively per frame
  const tokenLayer = useRef<SVGGElement>(null)
  const layoutRef = useRef(layout); layoutRef.current = layout
  useEffect(() => {
    const layer = tokenLayer.current; if (!layer) return
    const circles = Array.from(layer.children) as SVGCircleElement[]
    return clock.subscribe((tick) => {
      const L = layoutRef.current
      for (let i = 0; i < plans.length; i++) {
        const c = circles[i]; if (!c) continue
        const s = tokenAt(plans[i], L, tick)
        if (!s) { c.setAttribute('display', 'none'); continue }
        c.removeAttribute('display')
        // while waiting at a node, each token keeps its own small offset so a queue reads as a cluster, not a stack
        const o = s.moving ? 0 : L.nodeSize * 0.36
        const a = (i * 2.399) % (Math.PI * 2), rad = o * (0.35 + ((i * 7) % 10) / 15)
        c.setAttribute('cx', (s.x + Math.cos(a) * rad).toFixed(1)); c.setAttribute('cy', (s.y + Math.sin(a) * rad).toFixed(1))
      }
    })
  }, [plans, clock, layout.width, layout.height])

  const r = 5 * layout.scale
  const stroke = Math.max(2, 4.5 * layout.scale)
  const hor = layout.orientation === 'horizontal'
  const svgRef = useRef<SVGSVGElement>(null)
  const toLocal = (e: React.PointerEvent) => { const rect = svgRef.current!.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top } }
  const laneAt = (p: { x: number; y: number }) => layout.lanes.find((l) => p.x >= l.x && p.x <= l.x + l.w && p.y >= l.y && p.y <= l.y + l.h)

  return (
    <div ref={host} className={`wm wm-theme-${theme} ${props.className ?? ''}`} style={{ width: '100%', height: '100%', ...props.style }}>
      <svg
        ref={svgRef} className="wm-svg" viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width} height={layout.height}
        aria-hidden={decorative ? true : undefined} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : 'Work map'}
        onPointerDown={(e) => { props.onHold?.(true); if (props.onLaneClick && e.target === e.currentTarget) { const p = toLocal(e); const lane = laneAt(p); if (lane) props.onLaneClick(lane.id, p) } }}
        onPointerUp={() => props.onHold?.(false)} onPointerLeave={() => props.onHold?.(false)} onPointerCancel={() => props.onHold?.(false)}
      >
        {/* lanes */}
        <g className="wm-lanes">
          {layout.lanes.map((l) => (
            <g key={l.id} className="wm-lane-label" onPointerDown={(e) => { if (props.onLaneClick) { e.stopPropagation(); props.onLaneClick(l.id, toLocal(e)) } }}>
              <rect x={l.x} y={l.y} width={l.w} height={l.h} fill={l.index % 2 ? 'var(--wm-lane)' : 'transparent'} />
              <line x1={hor ? l.x + l.w : l.x} y1={hor ? l.y : l.y + l.h} x2={l.x + l.w} y2={l.y + l.h} stroke="var(--wm-lane-line)" strokeDasharray="3 5" />
              {props.showLaneLabels !== false && <text x={hor ? l.x + l.w / 2 : l.x + 6} y={hor ? l.y + 12 * layout.scale : l.y + l.h / 2} fontSize={9.5 * layout.scale} textAnchor={hor ? 'middle' : 'start'} dominantBaseline="central">{l.label}</text>}
            </g>
          ))}
        </g>
        {/* tracks */}
        <g className="wm-tracks" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {Object.values(layout.edges).map((e) => (
            <path key={e.id} d={e.path.d} stroke={e.loop ? 'var(--wm-track-loop)' : 'var(--wm-track)'} strokeWidth={stroke * (0.55 + e.weight * 0.9)}
              style={{ cursor: props.onEdgeClick ? 'pointer' : undefined, opacity: selectedId === e.id ? 1 : undefined }}
              onPointerDown={(ev) => { if (props.onEdgeClick) { ev.stopPropagation(); props.onEdgeClick(e.id) } }} />
          ))}
          {selectedId && layout.edges[selectedId] && <path d={layout.edges[selectedId].path.d} stroke="var(--wm-text)" strokeWidth={1.5} strokeDasharray="2 4" />}
        </g>
        {/* end states */}
        <g>
          {Object.values(layout.ends).map((e) => (
            <g key={e.id} tabIndex={decorative ? -1 : 0} role={decorative ? undefined : 'button'} aria-label={decorative ? undefined : `${e.label} end state`}
              onPointerDown={(ev) => { ev.stopPropagation(); props.onEndClick?.(e.id) }} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); props.onEndClick?.(e.id) } }}>
              <EndBlock e={e} scale={layout.scale} selected={selectedId === e.id} />
            </g>
          ))}
        </g>
        {/* nodes */}
        <g>
          {Object.values(layout.nodes).map((n) => (
            <g key={n.id} className={`wm-node${selectedId === n.id ? ' wm-selected' : ''}`} transform={`translate(${n.x} ${n.y})`} tabIndex={decorative ? -1 : 0} role={decorative ? undefined : 'button'}
              aria-label={decorative ? undefined : `${n.label}, ${n.kind}${n.actor !== 'either' ? `, ${n.actor}` : ''}`}
              onPointerDown={(ev) => { ev.stopPropagation(); props.onNodeClick?.(n.id) }} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); props.onNodeClick?.(n.id) } }}>
              <Glyph n={n} />
              {props.labels !== false && <Plate text={n.label} x={hor ? 0 : n.size / 2 + 8 * layout.scale} y={hor ? n.size / 2 + 14 * layout.scale : 0} scale={layout.scale} anchor={hor ? 'middle' : 'start'} />}
            </g>
          ))}
        </g>
        {/* tokens: one circle per work item, positioned per frame */}
        <g ref={tokenLayer} className="wm-tokens" aria-hidden="true">
          {spec.tokens.map((t) => (
            <circle key={t.id} className={`wm-token${filter !== 'combined' && filter !== t.actor ? ' wm-dim' : ''}`} r={r} display="none"
              fill={t.actor === 'agent' ? 'var(--wm-agent)' : 'var(--wm-human)'}
              stroke={t.model ? MODEL_STROKES[models.indexOf(t.model) % MODEL_STROKES.length] : undefined} strokeWidth={t.model ? Math.max(1, 1.4 * layout.scale) : 0} />
          ))}
        </g>
      </svg>
    </div>
  )
}
