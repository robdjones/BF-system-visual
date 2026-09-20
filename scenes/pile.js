/* STAGE 1 — Unorganized systems pile (gravity)
   Concept: work systems, tools and measures sit as a disconnected mess.
   Motion job: big tokens drop in at irregular moments, tumble, and settle on each other in a loose heap
   along the bottom of the screen. No shared rhythm, nothing processed — just gravity.
   Implementation: a 2D rigid-body sim (Matter.js) is pre-run once at load with a fixed timestep, so every
   frame is a lookup → the scene stays deterministic, scrubbable and loops exactly. */
BF.scenes.pile = (svg, mount) => {
  const { KIT, lerp, remap, ease, rng, el, makeToken, Timeline } = BF;
  const M = window.Matter;
  el('rect', { width: 1200, height: 800, fill: KIT.cream }, svg);
  if (!M) {
    const msg = el('text', { x: 600, y: 400, 'text-anchor': 'middle', 'font-size': 22, fill: KIT.ink }, svg);
    msg.textContent = 'Physics library (matter-js) did not load — check network / CDN access.';
    const tl = new Timeline({ duration: 1, render: () => {}, title: 'Stage 1', subtitle: 'unorganized systems pile', mount });
    return tl;
  }
  const layer = el('g', {}, svg);
  const veil = el('rect', { width: 1200, height: 800, fill: KIT.cream, opacity: 0, 'pointer-events': 'none' }, svg);

  const DUR = 12, FPS = 60, LAST_DROP = 7.4;
  const SIZE = { h: 70, font: 30, padX: 30 };
  const r = rng(1039);

  // token specs — approximate, diagrammatic labels (not product logos)
  const labels = ['Jira', 'GitHub', 'Agents', 'Copilot', 'Cursor', 'PRs', 'Tickets', 'Sessions', 'Tokens', 'Cycle time', 'Rework', 'Handoffs', 'Deploys', 'Models', 'Traces', 'Sprints', 'Reviews', 'Incidents', 'Specs', 'Runs'];
  const specs = [];
  labels.forEach((label) => specs.push({ kind: 'pill', label }));
  for (let i = 0; i < 5; i++) specs.push({ kind: 'frag', w: r.range(64, 180) });
  for (let i = 0; i < 14; i++) specs.push({ kind: 'dot', color: r.pick(KIT.dots), r: r.range(15, 27) });
  const tokens = specs.map((spec) => makeToken(layer, spec, SIZE));

  // drop schedule: irregular gaps (clumps and pauses), never a beat
  const order = tokens.slice().sort(() => r.f() - 0.5);
  let t = 0.3;
  order.forEach((tok) => { tok.spawn = t; t += r.f() < 0.3 ? r.range(0.03, 0.1) : r.range(0.14, 0.42); });
  const squeeze = (LAST_DROP - 0.3) / (t - 0.3);
  order.forEach((tok) => (tok.spawn = 0.3 + (tok.spawn - 0.3) * squeeze));

  // ---- physics world (pre-simulated)
  const engine = M.Engine.create({ enableSleeping: true });
  engine.gravity.y = 1.35;
  const world = engine.world;
  M.Composite.add(world, [
    M.Bodies.rectangle(600, 860, 1600, 120, { isStatic: true, friction: 1 }),      // floor = bottom of the screen
    M.Bodies.rectangle(-60, 0, 120, 3000, { isStatic: true }),                     // invisible side walls
    M.Bodies.rectangle(1260, 0, 120, 3000, { isStatic: true }),
  ]);
  const bodyOpts = () => ({ friction: 0.55, frictionStatic: 0.9, restitution: 0.03, density: 0.002 });
  order.forEach((tok) => {
    // aim at the middle of the screen with a bell-ish spread so a heap forms, plus a few wide strays
    const g = (r.f() + r.f() + r.f()) / 3;
    let x = 600 + (g - 0.5) * 760;
    if (r.f() < 0.12) x = 600 + r.sign() * r.range(380, 520);
    const y = -140 - r.range(0, 120);
    const w = tok.w, h = tok.h;
    tok.body = tok.spec.kind === 'dot'
      ? M.Bodies.circle(x, y, tok.r, bodyOpts())
      : M.Bodies.rectangle(x, y, w, h, { chamfer: { radius: h / 2 - 1 }, ...bodyOpts() });
    tok.angle0 = tok.spec.kind === 'dot' ? 0 : r.range(-1.2, 1.2);
    tok.spin0 = r.range(-0.09, 0.09);
    tok.vx0 = r.range(-1.6, 1.6);
  });

  const STEPS = Math.ceil(DUR * FPS) + 1;
  const frames = new Array(STEPS);
  let next = 0;
  for (let s = 0; s < STEPS; s++) {
    const st = s / FPS;
    while (next < order.length && order[next].spawn <= st) {
      const tok = order[next++];
      M.Body.setAngle(tok.body, tok.angle0);
      M.Body.setAngularVelocity(tok.body, tok.spin0);
      M.Body.setVelocity(tok.body, { x: tok.vx0, y: 3 });
      M.Composite.add(world, tok.body);
      tok.added = true;
    }
    frames[s] = tokens.map((tok) => (tok.added ? [tok.body.position.x, tok.body.position.y, tok.body.angle] : null));
    M.Engine.update(engine, 1000 / FPS);
  }

  function render(t) {
    const f = Math.min(STEPS - 1, Math.max(0, t * FPS));
    const i0 = Math.floor(f), i1 = Math.min(STEPS - 1, i0 + 1), u = f - i0;
    tokens.forEach((tok, k) => {
      const a = frames[i0][k], b = frames[i1][k] || a;
      if (!a) { tok.set({ x: 0, y: 0, visible: false }); return; }
      let rot = (lerp(a[2], b[2], u) * 180) / Math.PI;
      // a stadium is symmetric under a half turn: keep labels upright without changing the silhouette
      if (tok.spec.kind === 'pill') rot = (((rot + 90) % 180) + 180) % 180 - 90;
      tok.set({ x: lerp(a[0], b[0], u), y: lerp(a[1], b[1], u), rot });
    });
    veil.setAttribute('opacity', Math.max(remap(t, DUR - 0.4, DUR), 1 - remap(t, 0, 0.3)));
  }

  const tl = new Timeline({ duration: DUR, render, title: 'Stage 1', subtitle: 'unorganized systems pile', phases: [], mount });
  tl.play();
  return tl;
};
