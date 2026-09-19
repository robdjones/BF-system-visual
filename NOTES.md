# Self-QA — critique / improve passes

Each pass: render frames at fixed loop times with Playwright, read them against the brief's checklist
(three beats readable without narration · left→right unmistakable · light middle vs heavy right ·
routes not floaty · flat style consistent), fix the weakest thing, re-render.

## Pass 1 — bones
Built the map: three colored source lines, three ink stations (CAPTURE / SEQUENCE / STANDARDIZE),
ink trunk, junction, three terminals. Units travel by arc length along polylines.
- Weakest: units overtook each other on their own line and piled up on the SEQUENCE station;
  raw labels straddled the lines; terminal text overflowed; number readouts risked reading as product claims.

## Pass 2 — collisions, sequencing as a visible mechanic
- Dispatch nearest-to-CAPTURE first so nothing passes through anything.
- Real queue before SEQUENCE (slots at 44 px) with an even-cadence release: irregular arrivals bunch,
  then leave on one clock. This made "sequence" legible instead of implied.
- Raw labels moved above/below the shape (never on the line); terminal card re-laid out
  (name + question top-left, tokens bottom-left, measure bar bottom-right); numeric readouts removed.
- Weakest: middle read precise but not playful; loop fade wiped the whole map; captions still clipped.

## Pass 3 — map vs live layers, conveyor
- Split static map (stations, terminal outlines, origins, trunk) from the live layer (routes, units,
  fills, bars). Only the live layer fades for the loop, so the transit map persists like a poster.
- Terminal names sit on a `difference` blend layer, so they invert automatically when the block fills black.
- Added a moving paper dash on the trunk = conveyor belt, on only while beat 2 runs; solid once the line closes.
- Shortened measure captions to fit.
- Bug found in review: belt rendered above unit numbers ("02" read as "C2") — fixed z-order.

## Pass 4 — collisions in the messy state
- Two raw units and their labels overlapped near the zone edge; a raw tag overlapped a station counter.
  Re-placed on the route (still on 45°/90° geometry), verified at 2.0 s and 3.4 s.
- Loop fade shortened to 0.4 s.

## What I would push next (not done)
- Middle beat could carry one more light touch (e.g. a tick sound-mark or a subtle count-up on the ruler)
  if it still reads too clinical when played in context.
- Palette is placeholder-neutral; swap for brand tokens once the website direction is fixed.
- For the website moment, drive `t` from scroll and let the terminals hold as the section end state.
