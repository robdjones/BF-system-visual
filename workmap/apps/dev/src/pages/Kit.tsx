import { Glyph, Plate, EndBlock } from '@bloomfilter/workmap-react'
import type { NodePos, EndPos } from '@bloomfilter/workmap-core'
import { href } from '../route'

/** Visual kit story: the six node glyphs, the plate badge, terminal blocks and dots, in all three themes. */
export function Kit() {
  const nodes: NodePos[] = [
    { id: 'a', kind: 'source', actor: 'either', label: 'Source', x: 0, y: 0, size: 56, stage: '' },
    { id: 'b', kind: 'step', actor: 'human', label: 'Human step', x: 0, y: 0, size: 56, stage: '' },
    { id: 'c', kind: 'step', actor: 'agent', label: 'Agent step', x: 0, y: 0, size: 56, stage: '' },
    { id: 'd', kind: 'route', actor: 'either', label: 'Route', x: 0, y: 0, size: 56, stage: '' },
    { id: 'e', kind: 'split', actor: 'either', label: 'Split', x: 0, y: 0, size: 56, stage: '' },
    { id: 'f', kind: 'govern', actor: 'either', label: 'Govern', x: 0, y: 0, size: 56, stage: '' },
  ]
  const ends: EndPos[] = [
    { id: 'done', label: 'Feature', tone: 'done', x: 0, y: 0, w: 130, h: 48 },
    { id: 'open', label: 'Orphan', tone: 'open', x: 0, y: 0, w: 130, h: 48 },
  ]
  return (
    <main style={{ padding: 16 }}>
      <p style={{ fontSize: 12, opacity: 0.7 }}><a href={href('/')}>← stories</a> · Visual kit: six node kinds, one plate badge, two terminal tones, two dot colors (model variants get a stroke). Colors are CSS variables on the root svg.</p>
      {(['play', 'rave', 'plain'] as const).map((theme) => (
        <div key={theme} className={`wm wm-theme-${theme}`} style={{ padding: 16, borderRadius: 8, marginBottom: 12, background: 'var(--wm-canvas)' }}>
          <div className="wm-k" style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--wm-muted)', marginBottom: 6 }}>{theme}</div>
          <svg className="wm-svg" viewBox="0 0 980 120" style={{ height: 120, width: '100%', maxWidth: 980 }}>
            {nodes.map((n, i) => <g key={n.id} transform={`translate(${50 + i * 100} 44)`}><Glyph n={n} /><Plate text={n.label} x={0} y={50} /></g>)}
            {ends.map((e, i) => <g key={e.id} transform={`translate(${720 + i * 145} 44)`}><EndBlock e={e} scale={1} /></g>)}
            <g transform="translate(720 100)">
              <circle r={5} fill="var(--wm-human)" /><text x={10} y={0} fontSize={10} dominantBaseline="central">human</text>
              <circle cx={70} r={5} fill="var(--wm-agent)" /><text x={80} y={0} fontSize={10} dominantBaseline="central">agent</text>
              <circle cx={140} r={5} fill="var(--wm-agent)" stroke="var(--wm-model-b)" strokeWidth={1.4} /><text x={150} y={0} fontSize={10} dominantBaseline="central">agent · model B</text>
            </g>
          </svg>
          <div className="wm-hud" style={{ marginTop: 8 }}>
            <div className="wm-plate-el"><span className="wm-rivets" /><div className="wm-k">Cycle time</div><div className="wm-v">312</div><div className="wm-s">ticks, mean</div></div>
            <button type="button" className="wm-btn">Button</button><button type="button" className="wm-btn wm-on">Button on</button>
          </div>
        </div>
      ))}
    </main>
  )
}
