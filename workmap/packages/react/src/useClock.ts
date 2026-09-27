import { useCallback, useEffect, useRef, useState } from 'react'

/** The map clock, in ticks. One second of wall time = `ticksPerSecond` ticks at speed 1. Loops over [0, length]. */
export type Clock = {
  tick: number
  playing: boolean
  speed: number
  length: number
  play(): void
  pause(): void
  toggle(): void
  seek(tick: number): void
  setSpeed(s: number): void
  /** subscribe to per-frame ticks without re-rendering React */
  subscribe(fn: (tick: number) => void): () => void
}

export function useClock(length: number, opts: { ticksPerSecond?: number; autoplay?: boolean; loop?: boolean } = {}): Clock {
  const tps = opts.ticksPerSecond ?? 60
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [playing, setPlaying] = useState(!!opts.autoplay && !reduced)
  const [speed, setSpeedState] = useState(1)
  const [tick, setTickState] = useState(reduced ? length * 0.55 : 0)
  const tickRef = useRef(tick)
  const playingRef = useRef(playing)
  const speedRef = useRef(speed)
  const subs = useRef(new Set<(t: number) => void>())
  const raf = useRef(0)
  const last = useRef<number | null>(null)
  playingRef.current = playing
  speedRef.current = speed

  const emit = (t: number) => { tickRef.current = t; subs.current.forEach((fn) => fn(t)) }

  useEffect(() => {
    const frame = (now: number) => {
      if (playingRef.current) {
        if (last.current != null) {
          let t = tickRef.current + ((now - last.current) / 1000) * tps * speedRef.current
          if (t > length) t = opts.loop === false ? length : t - length
          emit(t)
        }
        last.current = now
      } else last.current = null
      raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf.current)
  }, [length, tps, opts.loop])

  // a slow React-side tick (4/s) for the HUD numbers
  useEffect(() => {
    const id = setInterval(() => setTickState(tickRef.current), 250)
    return () => clearInterval(id)
  }, [])

  const seek = useCallback((t: number) => { emit(Math.max(0, Math.min(length, t))); setTickState(tickRef.current) }, [length])
  const play = useCallback(() => setPlaying(true), [])
  const pause = useCallback(() => setPlaying(false), [])
  const toggle = useCallback(() => setPlaying((p) => !p), [])
  const setSpeed = useCallback((s: number) => setSpeedState(s), [])
  const subscribe = useCallback((fn: (t: number) => void) => { subs.current.add(fn); fn(tickRef.current); return () => { subs.current.delete(fn) } }, [])
  return { tick, playing, speed, length, play, pause, toggle, seek, setSpeed, subscribe }
}
