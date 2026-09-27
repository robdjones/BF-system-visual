# Bloomfilter Work Map

A modular, procedural, responsive process map built as one package that serves the marketing site hero, a play/builder page, and motion export. **Synthetic data only.** Nothing here connects to a work system.

> Product boundary: this is a marketing and concept surface. The day it loads real work-system data or a customer asks to keep a map, it becomes product, which is outside the retainer and needs its own Scope & Estimate.

## Layout

```
workmap/
  packages/
    core/            framework-free TypeScript (seedrandom is the only runtime dep)
      src/spec/      types, validation, seed utils, URL encode/decode
      src/generate/  procedural generator, preset loader
      src/layout/    lane layout (horizontal / vertical), curved connectors, token travel
      src/metrics/   cycle time, velocity, rework, compliance, cost, splits, text summary
      src/presets/   play-classic, rework-loop, agent-handoff-to-qa, model-split, procedural
      test/          node:test
    react/           React components over core
      WorkMap        renders a spec, animates tokens, emits events
      Hud            metric strip + scorecard, reads metrics at the clock tick
      Builder        place, connect, auto-route, rename buckets, share by URL
    export/          headless render to PNG frames; MP4 / WebM / GIF when ffmpeg is present
  apps/
    dev/             Vite shell: stories, hero preview, play route, export page
  .cursor/rules      see the spec's Cursor workflow
```

## Run

```
cd workmap
npm install
npm run dev          # http://localhost:5173  → #/  stories · #/hero · #/play · #/story?preset=…&seed=…
npm test             # core tests
npm run typecheck
npm run build
npm run export -- --preset rework-loop --seed 3 --seconds 8 --fps 30   # PNG frames (+ MP4/GIF with ffmpeg)
```

## The spec

One JSON document describes a map (`packages/core/src/spec/types.ts`). The generator and the builder write it; layout, render, interaction and export read it. Metrics are computed from `tokens` at runtime, never stored. A **preset** is a partial `MapSpec` plus generator hints; the **pattern library** is `packages/core/src/presets/`.

`?seed=N` reproduces a procedural map. `?spec=<base64url>` carries a hand-built map (tokens regenerate from the seed).

## On the site

```astro
<WorkMap client:visible preset="hero" />   <!-- hero island -->
<Builder client:load />                     <!-- /play route -->
```
The site installs `@bloomfilter/workmap-core` and `@bloomfilter/workmap-react` and imports only the public components and the preset loader.

## Phases

| Phase | Status |
|---|---|
| 0. Spec + static render | Types, validator, five presets, static render from a spec. The Play page itself could not be extracted (the bloomfilter-play repo was not reachable from this build); `play-classic` is authored from the spec's visual-system table and should be checked against the Play code. |
| 1. Generate + animate | Seeded generator, responsive lane layout (vertical under 640px), tokens along curved tracks, play / rave / plain themes, seed in the URL. |
| 2. Interact | HUD strip (5 + cost per unit + human−agent delta), scorecard, node and bucket modals, human / agent / combined toggle, hold-to-accelerate, text summary. |
| 3. Ship the hero | Component-ready; `#/hero` is the false-page preview with the press-play welcome. Publishing the npm package and the Astro island are site-repo work. |
| 4. Build | Builder on `#/play`: place nodes, connect, auto-route, rename buckets, share by URL. |
| 5. Export | `packages/export`: headless PNG frames; MP4 / WebM / GIF when an ffmpeg binary is on the path. |

Motion respects `prefers-reduced-motion` (the map opens paused on a mid-timeline frame). Dots are `aria-hidden`; every map gets a text equivalent from the metrics.
