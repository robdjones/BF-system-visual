import { useEffect, useState } from 'react'
/** Hash router: #/path?query. */
export function useRoute() {
  const parse = () => { const h = location.hash.replace(/^#/, '') || '/'; const [path, q = ''] = h.split('?'); return { path, params: new URLSearchParams(q) } }
  const [route, setRoute] = useState(parse)
  useEffect(() => { const on = () => setRoute(parse()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on) }, [])
  return route
}
export const href = (path: string, params: Record<string, string | number | undefined> = {}) => {
  const q = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v))
  const s = q.toString(); return `#${path}${s ? `?${s}` : ''}`
}
