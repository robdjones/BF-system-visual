# Bloomfilter — System · assembly line (motion + Swiss/subway styling)

Loopable animated sequence of the assembly-line metaphor: **Ingredients → Bloomfilter → Use cases**,
drawn as a flat transit map. One 15 s loop, scrubbable frame-exact.

## Run

Open `index.html` in a browser (no build step). Fonts and scripts are local.

```
npx serve .        # or: python3 -m http.server
```

Controls: `space` play/pause · `←/→` step 0.1 s (`shift` = 1 s) · `[` `]` `\` jump to beat 1 / 2 / 3 · scrub bar.

## Exports

- `exports/bloomfilter-system-loop.mp4` — 1600×900, 30 fps, one loop
- `exports/bloomfilter-system-loop-800.gif` — 800 px preview

Re-render with the QA harness (needs Playwright + ffmpeg):

```
node qa/capture.js frames  out/ 2.0,5.2,10.6   # PNG at exact loop times
node qa/capture.js sheet   out/                # 12-frame contact sheet
node qa/capture.js video   out/ 30             # mp4 at 30 fps
```

## How it is built

- `index.html` — stage (SVG, 1600×900 viewBox) + minimal player chrome
- `scene.js` — the whole piece. Geometry is data (polylines on a 40 px grid); every visual property is a
  pure function of loop time `t`, so scrubbing, looping and frame capture are exact. No CSS animations,
  no physics, no tweening library.
- Motion is path-based: units travel along polylines by arc length with a scheduled list of checkpoints
  (station holds, a queue before SEQUENCE, an even-cadence release, one eased long haul to the terminal).
- State changes are swaps, not morphs: raw shape → bounded square → solid token.

## Graphic language (locked)

- **Color = source system.** Blue JIRA, red GITHUB, green AGENTS. Ink = Bloomfilter. Paper neutrals.
- **Shape = state.** Irregular outlines (raw) → bracketed square (captured) → solid square (standardized).
- **Weight = stage.** 2.5 px colored lines on the left → 4 px ink trunk → 6 px branches and solid black terminals.
  Zone header rules go 1 → 2 → 4 px.
- Type: Inter (neo-grotesque), tracked caps for labels, big number + regular title for zone heads.
- Grid: 40 px, dot grid; all routes are 90°/45° subway geometry.

Porting: the SVG + `render(t)` function drops into any web stack (Astro/React) as-is; drive `t` from a
scroll position instead of the clock to make it a scrubbed website moment.

See `NOTES.md` for the critique/improve passes.
