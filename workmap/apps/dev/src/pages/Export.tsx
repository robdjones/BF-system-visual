import { useEffect } from 'react'
import { WorkMap, useClock } from '@bloomfilter/workmap-react'
import { useSpecFromParams } from './useSpec'

/** Headless frame page for packages/export: a bare map at a fixed size, driven by window.__workmap.seek(tick). */
export function Export({ params }: { params: URLSearchParams }) {
  const { spec, theme } = useSpecFromParams(params)
  const w = Number(params.get('w') ?? 1280), h = Number(params.get('h') ?? 720)
  const clock = useClock(1000, { autoplay: false })
  useEffect(() => { (window as unknown as { __workmap: unknown }).__workmap = { seek: clock.seek, length: clock.length, ready: true } }, [clock.seek, clock.length])
  return <div style={{ width: w, height: h }}><WorkMap spec={spec} clock={clock} theme={theme} decorative /></div>
}
