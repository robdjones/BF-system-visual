import { useState } from 'react'
import { generate, HERO_PRESET, randomSeed } from '@bloomfilter/workmap-core'
import { WorkMap, Hud, useClock, type Filter } from '@bloomfilter/workmap-react'
import { href } from '../route'

/** Phase 3 preview: a false page with the hero island and a welcome screen with press play.
 *  On the site this is `<WorkMap client:visible preset="hero" />` inside an Astro island. */
export function Hero({ params }: { params: URLSearchParams }) {
  const [seed, setSeed] = useState(Number(params.get('seed') ?? 11) || 11)
  const spec = generate(HERO_PRESET, seed)
  const clock = useClock(1000, { autoplay: false })
  const [started, setStarted] = useState(false)
  const [filter, setFilter] = useState<Filter>('combined')
  const start = () => { setStarted(true); clock.play() }
  return (
    <div style={{ minHeight: '100%', background: '#0f1013' }}>
      <header style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '18px 24px', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>
        <strong>Bloomfilter</strong><span>Product</span><span>Customers</span><span>Pricing</span><span style={{ marginLeft: 'auto' }}><a href={href('/')}>dev shell</a></span>
      </header>
      <section style={{ padding: '24px 24px 8px', maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 56px)', lineHeight: 1.02, margin: '0 0 12px', letterSpacing: '-0.02em', fontFamily: 'system-ui, sans-serif', textWrap: 'balance' as never }}>Millions in tokens. What's coming back?</h1>
        <p style={{ fontSize: 16, opacity: 0.75, margin: '0 0 20px', maxWidth: 620, fontFamily: 'system-ui, sans-serif' }}>Your own delivery data, turned into the verdict. Watch work move through humans and agents, and see what each step returns.</p>
      </section>
      <section style={{ position: 'relative', height: 'min(62vh, 640px)', maxWidth: 1200, margin: '0 auto', borderRadius: 12, overflow: 'hidden', border: '1px solid #2a2d36' }}>
        <WorkMap spec={spec} clock={clock} decorative onHold={(d) => clock.setSpeed(d ? 6 : 1)} filter={filter} />
        {!started && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(15,16,19,0.55)', backdropFilter: 'blur(2px)' }}>
            <div className="wm wm-plate-el" style={{ textAlign: 'center', padding: '26px 30px', background: 'var(--wm-plate)' }}><span className="wm-rivets" />
              <div className="wm-k">the work map</div>
              <div style={{ fontSize: 14, margin: '8px 0 14px', maxWidth: 360 }}>A synthetic delivery process. Orange is human work, pink is agent work. Hold anywhere to accelerate.</div>
              <button type="button" className="wm-btn wm-on" onClick={start} autoFocus>▶ Press play</button>
            </div>
          </div>
        )}
      </section>
      <section className="wm" style={{ maxWidth: 1200, margin: '12px auto 40px', padding: '0 0 0', background: 'transparent' }}>
        <Hud spec={spec} clock={clock} filter={filter} onFilter={setFilter} compact />
        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>Seed {seed}. <button type="button" className="wm-btn" onClick={() => setSeed(randomSeed())}>New map</button></p>
      </section>
    </div>
  )
}
