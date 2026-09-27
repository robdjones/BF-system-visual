import { generate, loadPreset, presetNames } from '@bloomfilter/workmap-core'
import { WorkMap, useClock } from '@bloomfilter/workmap-react'
import { href } from '../route'

function Thumb({ name }: { name: string }) {
  const spec = generate(loadPreset(name), 1)
  const clock = useClock(1000, { autoplay: true })
  return <div style={{ height: 180, borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2d36' }}><WorkMap spec={spec} clock={clock} decorative showLaneLabels={false} labels={false} orientation="horizontal" /></div>
}

export function Index() {
  return (
    <main style={{ padding: '24px 16px', maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 16, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>Work Map · dev shell</h1>
      <p style={{ opacity: 0.7, fontSize: 13, margin: '0 0 20px' }}>Stories for every component. Synthetic data only. <a href={href('/hero')}>Hero</a> · <a href={href('/play')}>Play / builder</a> · <a href={href('/story', { preset: 'play-classic', seed: 1 })}>WorkMap + HUD story</a> · <a href={href('/story/kit')}>Visual kit</a></p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {presetNames().map((name) => (
          <a key={name} href={href('/story', { preset: name, seed: 1 })} style={{ textDecoration: 'none' }}>
            <Thumb name={name} />
            <div style={{ fontSize: 13, marginTop: 8 }}>{name}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{loadPreset(name).description}</div>
          </a>
        ))}
      </div>
    </main>
  )
}
