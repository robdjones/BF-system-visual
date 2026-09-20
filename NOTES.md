# Bloomfilter · System motion prototype — working notes

Two isolated, looping, scrubbable stages. Plain HTML + inline SVG + a small deterministic JS timeline
(every frame is a pure function of time), so each scene is portable straight into an Astro/web moment later.

- `index.html` — chapter chooser
- `stage-1-pile.html` — Stage 1 · unorganized systems pile
- `stage-2-transform.html` — Stage 2 · transform (capture · sequence · normalize)
- `kit.css` / `kit.js` — locked visual kit + runtime (timeline, tokens, easing, seeded randomness)
- `qa/` — Playwright scripts used for self-review (`shoot.mjs` stills, `motion.mjs` drift stats, `sheet.mjs` contact sheets)

Open `index.html` in a browser (no build step). Space = play/pause, ← → = frame step (shift = 1s), R = replay.

## Visual kit (locked, reel-faithful)
| Role | Value |
|---|---|
| Field | cream `#FCF3E1`, flat, empty space protected |
| Container | one solid triangle, orchid `#F090F0`, no stroke/shadow/gradient |
| Labels | black stadium pills, white grotesque sans, one type size (19px in a 42px pill) |
| Beads | orange `#F26B21`, yellow `#F5C400`, purple `#6A4CFF`, olive `#7A8A2E` |
| Depth | stacking order only. No lines, no map routes, no 3D |

The reel itself could not be fetched from this environment (Instagram is blocked by the network proxy),
so the kit was built from the brief's description of it: cream field, solid orchid container, black pills,
white sans, colored dots, accretion + scale-up + downward drift, locked camera, long eases.

Orchid is kept as the container color. It is a single CSS/JS constant (`--orchid` / `KIT.orchid`) so a
Bloomfilter signal color can be swapped in one place if the brand team prefers.

## Token language
Approximate, diagrammatic labels (not product logos): Jira, GitHub, Agents, Copilot, Cursor, PRs, Tickets,
Sessions, Tokens, Cycle time, Rework, Handoffs, Deploys, Models, Traces, Sprints. Blank pills = unfinished /
unresolved fragments. Beads = measures / records.

## Stage 1 — motion design
- Irregular accretion 0–7s: tokens spawn at uneven intervals (clumps and pauses, never a beat), each with
  a uniform scale-up and a short downward drift on entry.
- From 7s a seamless 5s drift loop: each token has its own sum-of-sines drift (periods divide the loop
  length, so the seam is exact), its own micro-jitter, its own rotation wobble, 0–2 random twitches, and
  fragments flicker. No two tokens share a rhythm.
- Measured: over 0.5s tokens move a mean of 10px with direction coherence 0.07 (0 = fully independent).

## Stage 2 — motion design
Grammar, in order (phase chips in the viewer bar show where you are):
1. **Capture / steerage** — scattered, jittering tokens are pulled one by one along an arc to a single gate
   (the apex). Arrival order is irregular; they bunch in a queue at the mouth. Rotation halves and size
   settles as they are pulled — calming begins at capture.
2. **Sequence** — released from the queue on a strict 0.3s beat, they squeeze through the gate, then drift
   downward to lanes inside the container, landing exactly on the beat with a small settle. Release order is
   not arrival order (the gate sorts). Rows fill bottom-up: 5 · 3 · 4 · 2 · 3 · 1.
3. **Normalize** — a top-to-bottom sweep resolves each row: rotation → 0, scale → 1, pill width → one unit
   width, beads → one radius, blank fragments gain their label (unknowns resolved), positions snap to a grid.
4. **One rhythm** — everything breathes on one shared beat (contrast with Stage 1's independent jitter).
The container grows smoothly the whole time (long ease-out, 0.6 → 1.0), apex locked; landed tokens ride
its growth as a slow downward drift. Loop closes with a short dip to cream.

## Improvement passes
### Pass 1 (first build) → critique
- Stage 1: one stray pill clipped off-canvas; three labels stacked fully on top of each other in the centre;
  composition dead-centred. Stage 2: greedy row packing made a tall single-pill column with beads stacked at
  the apex (one outside the container); queue at the gate crowded and clipped at the top edge; normalize
  sweep overran the "one rhythm" hold.
### Pass 2 → changes
- Stage 1: light relaxation pass keeps label centres apart while still allowing overlap; canvas clamp; pile
  moved lower-left; drift amplitude raised; verified loop seam is exact (0.0px at 7s vs 12s).
- Stage 2: explicit row plan (18 tokens) so the stack fills the triangle cleanly; wider triangle, apex lower
  so the queue has headroom; queue spread wider; sweep faster (0.22s/row) and hold starts after it; total 13s.
- Added chapter index, motion stats script, fragment flicker (Stage 1), stronger bead pulse in the hold.
### Pass 3 → changes
- Stage 2: capture arcs were leaving the frame and the queue clipped at the top edge → arc control point
  clamped inside the canvas, queue band lowered; loop shortened to 12.5s so the hold is not dead time;
  bead pulse in the hold stronger than pill pulse. Lane-up now happens at landing (y exact on the row,
  x/rotation/size/width still irregular) so *sequence* owns order + lanes + beat and *normalize* owns uniformity.
- Stage 1: fragment flicker softened (0.6 floor) so dips read as "unresolved", not as grey tokens.
- Structure: scenes moved to `scenes/*.js` modules; `index.html` is now a chapter viewer that mounts one
  isolated scene at a time (keys 1 / 2); `build.mjs` inlines everything into `dist/` for a single-link publish.
### Pass 4 → review only
- Full contact-sheet review of both loops after the pass 3 changes. Stage 1: accretion 0–7s reads as clumps
  and pauses, then the 5s drift loop with an exact seam. Stage 2: arcs stay in frame, queue bunches above the
  apex, beat landings fill rows bottom-up with lanes exact, sweep resolves to uniform units, hold breathes on
  one rhythm. No further changes made; published as a single-file artifact.

## Known limits / next
- Reel not viewable from this environment; kit is built from the brief's description. Worth a side-by-side
  check against the reel for pill proportion and container color.
- Orchid container kept from the reel; single constant to swap if a Bloomfilter signal color is preferred.
- Fonts fall back to the system grotesque stack (Inter → Helvetica → Arial). Load Inter explicitly when this
  moves to the site.
- Out of scope by brief and untouched: use-case outputs, tree/plant, website chrome, continuous scroll.
