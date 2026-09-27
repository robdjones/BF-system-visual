import type { MapSpec } from './types'

/** A spec in a URL: JSON → UTF-8 → base64url. Tokens are dropped (they regenerate from the seed). */
export function encodeSpecForUrl(spec: MapSpec): string {
  const { tokens: _tokens, ...rest } = spec
  const json = JSON.stringify(rest)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeSpecFromUrl(param: string): Omit<MapSpec, 'tokens'> | null {
  try {
    const b64 = param.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (param.length % 4)) % 4)
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}
