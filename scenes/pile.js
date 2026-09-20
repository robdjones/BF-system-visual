/* STAGE 1 — Unorganized systems pile
   Concept: work systems, tools and measures sit as a disconnected mess. No shared sequence.
   Motion job: irregular accretion, independent drift, micro-jitter, no common rhythm. Nothing processed. */
BF.scenes.pile = (svg, mount) => {
  const { KIT, lerp, remap, ease, rng, makeDrift, pulse, el, makeToken, Timeline } = BF;
  el('rect', { width: 1200, height: 800, fill: KIT.cream }, svg);
  const layer = el('g', {}, svg);

  const DUR = 12, LOOP_START = 7, LOOP = DUR - LOOP_START; // accretion 0–7s, then a seamless 5s drift loop
  const r = rng(1039);

  // token specs — approximate, diagrammatic labels (not product logos)
  const labels = ['Jira', 'GitHub', 'Agents', 'Copilot', 'Cursor', 'PRs', 'Tickets', 'Sessions', 'Tokens', 'Cycle time', 'Rework', 'Handoffs', 'Deploys', 'Models', 'Traces', 'Sprints'];
  const specs = [];
  labels.forEach((label) => specs.push({ kind: 'pill', label }));
  for (let i = 0; i < 5; i++) specs.push({ kind: 'frag', w: r.range(34, 110) });
  for (let i = 0; i < 14; i++) specs.push({ kind: 'dot', color: r.pick(KIT.dots), r: r.range(7, 12) });

  // scatter inside an irregular blob (lower-left of centre) — protect empty space top/right
  const C = { x: 470, y: 500 };
  const tokens = specs.map((spec, i) => {
    const tok = makeToken(layer, spec);
    const ang = r.range(0, Math.PI * 2), rad = Math.pow(r.f(), 0.6);
    const base = { x: C.x + Math.cos(ang) * rad * 340 + r.range(-40, 40), y: C.y + Math.sin(ang) * rad * 200 + r.range(-30, 30) };
    // a few strays sit well outside the blob — the mess has no edge
    if (i % 9 === 4) { base.x += r.sign() * r.range(140, 220); base.y += r.sign() * r.range(60, 120); }
    tok.base = base;
    tok.rot = spec.kind === 'dot' ? 0 : r.range(-30, 30);
    tok.scale = spec.kind === 'dot' ? 1 : r.range(0.72, 1.28);
    tok.spawn = 0; // set below
    tok.spawnDur = r.range(0.45, 0.9);
    tok.dropFrom = r.range(-70, -140);
    tok.driftX = makeDrift(r, LOOP, r.range(6, 16), [1, 2, 3]);
    tok.driftY = makeDrift(r, LOOP, r.range(6, 16), [1, 2, 3]);
    tok.jitterX = makeDrift(r, LOOP, r.range(0.6, 2.2), [7, 11]);
    tok.jitterY = makeDrift(r, LOOP, r.range(0.6, 2.2), [9, 13]);
    tok.wobble = makeDrift(r, LOOP, spec.kind === 'dot' ? 0 : r.range(1.5, 5), [1, 2]);
    // twitches: 0–2 sudden small jumps per loop, at random moments — no shared beat
    tok.twitches = Array.from({ length: Math.floor(r.range(0, 3)) }, () => ({ t: r.range(0, LOOP), dx: r.range(-9, 9), dy: r.range(-9, 9), w: r.range(0.18, 0.3) }));
    // unfinished fragments flicker: brief opacity dips at their own moments (unresolved state)
    tok.flickers = spec.kind === 'frag' ? Array.from({ length: 2 }, () => ({ t: r.range(0, LOOP), w: r.range(0.35, 0.7) })) : [];
    return tok;
  });

  // light relaxation: keep centres apart enough that labels stay legible, but still allow overlap (it is a pile)
  const minD = (a, b) => (a.spec.kind === 'dot' && b.spec.kind === 'dot' ? 28 : a.spec.kind === 'dot' || b.spec.kind === 'dot' ? 46 : 90);
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < tokens.length; i++) for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i].base, b = tokens[j].base, d = minD(tokens[i], tokens[j]);
      let dx = b.x - a.x, dy = (b.y - a.y) * 1.6; const dist = Math.hypot(dx, dy) || 0.01;
      if (dist < d) { const push = (d - dist) / dist * 0.5; a.x -= dx * push; a.y -= dy * push / 1.6; b.x += dx * push; b.y += dy * push / 1.6; }
    }
    for (const tok of tokens) { tok.base.x = Math.min(1080, Math.max(120, tok.base.x)); tok.base.y = Math.min(700, Math.max(150, tok.base.y)); }
  }

  // spawn order: irregular gaps (clumps and pauses) — not on a beat
  let t = 0.35;
  const order = tokens.slice().sort(() => r.f() - 0.5);
  order.forEach((tok, i) => { tok.spawn = t; t += r.f() < 0.35 ? r.range(0.02, 0.08) : r.range(0.12, 0.42); });
  const scaleT = 6.6 / t; // squeeze accretion into 0–7s
  order.forEach((tok) => (tok.spawn *= scaleT));

  function render(t) {
    const lt = ((t - LOOP_START) % LOOP + LOOP) % LOOP; // loop-local time (periodic)
    for (const tok of tokens) {
      const u = remap(t, tok.spawn, tok.spawn + tok.spawnDur);
      if (u <= 0) { tok.set({ x: 0, y: 0, visible: false }); continue; }
      const eu = ease.out(u);
      let dx = tok.driftX(lt) + tok.jitterX(lt), dy = tok.driftY(lt) + tok.jitterY(lt);
      for (const tw of tok.twitches) { const p = pulse(lt, tw.t, tw.w); dx += tw.dx * p; dy += tw.dy * p; }
      let op = 1;
      for (const fl of tok.flickers) op -= 0.4 * pulse(lt, fl.t, fl.w);
      tok.set({
        x: tok.base.x + dx,
        y: tok.base.y + lerp(tok.dropFrom, 0, ease.outLong(u)) + dy,   // downward drift on entry
        rot: tok.rot + tok.wobble(lt),
        scale: tok.scale * eu,                                          // uniform scale-up on entry
        opacity: op,
      });
    }
  }

  const tl = new Timeline({ duration: DUR, loopStart: LOOP_START, render, title: 'Stage 1', subtitle: 'unorganized systems pile', phases: [], mount });
  tl.play();
  return tl;
};
