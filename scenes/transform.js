/* STAGE 2 — Transformation
   Concept: Bloomfilter takes the mess and works on it in place — capture, resolve, sequence, normalize.
   Show: one solid rectangle holding five mixed rows. Row by row (staggered so several operations are
   visible at once) elements APPEAR (captured), duplicates slide together and DISAPPEAR (resolved), rows
   REORDER (sequenced), and shapes CHANGE (normalized: fragments become labelled pills, beads and pills
   converge to one size, tilt and uneven gaps go away). Ends on one shared rhythm, dips to cream, loops. */
BF.scenes.transform = (svg, mount) => {
  const { KIT, lerp, remap, ease, rng, pulse, el, makeToken, Timeline } = BF;
  el('rect', { width: 1200, height: 800, fill: KIT.cream }, svg);
  const RECT = { x: 130, y: 100, w: 940, h: 600 };
  el('rect', { x: RECT.x, y: RECT.y, width: RECT.w, height: RECT.h, fill: KIT.orchid }, svg);
  const layer = el('g', {}, svg);
  const veil = el('rect', { width: 1200, height: 800, fill: KIT.cream, opacity: 0, 'pointer-events': 'none' }, svg);

  const SIZE = { h: 54, font: 24, padX: 24 };
  const W_U = 160, R_U = 12, GAP_U = 20, LEFT = RECT.x + 48; // max per row after normalize: 4 pills + 3 beads
  const ROW_Y = [170, 285, 400, 515, 630];
  const r = rng(7700);

  // ---- row content (initial, mixed). 'dup' = duplicate record, 'new' = not yet captured, frag = unfinished
  const D = (c, big) => ({ kind: 'dot', color: KIT.dots[c], r: big ? r.range(19, 24) : r.range(9, 15) });
  const P = (label, o = {}) => ({ kind: 'pill', label, ...o });
  const F = (label) => ({ kind: 'frag', w: r.range(50, 120), label });
  const rows = [
    [P('Jira'), D(0), P('GitHub'), F('Deploys'), P('Jira', { dup: true }), D(2, true), P('Models', { fresh: true })],
    [D(1), P('Cycle time'), P('Sessions'), F('Traces'), D(3, true), P('Tokens', { fresh: true }), P('Sessions', { dup: true })],
    [P('Agents'), P('Agents', { dup: true }), D(2), F('Specs'), P('Rework'), D(1, true), P('PRs', { fresh: true })],
    [F('Runs'), P('PRs'), D(3), P('Cursor'), D(0, true), P('Tickets'), P('Cursor', { dup: true }), { ...D(2), fresh: true }],
    [P('Copilot'), D(1), F('Reviews'), P('Handoffs'), D(3, true), D(0), P('Handoffs', { dup: true }), P('Sprints', { fresh: true })],
  ];

  // ---- build tokens + initial attrs
  const items = [];
  rows.forEach((specs, ri) => {
    specs.forEach((spec, ci) => {
      const tok = makeToken(layer, spec, SIZE);
      const dot = spec.kind === 'dot';
      Object.assign(tok, {
        row: ri, present: !spec.fresh, fresh: !!spec.fresh, dup: !!spec.dup,
        attrs: {
          w: tok.w, r: dot ? tok.r : 0, rot: dot ? 0 : r.range(-12, 12), dy: r.range(-9, 9),
          gap: GAP_U + r.range(-12, 28), scale: spec.fresh ? 0 : (dot ? 1 : r.range(0.86, 1.14)), opacity: 1, labelOp: spec.kind === 'pill' ? 1 : 0,
        },
        kf: [],
      });
      items.push(tok);
    });
  });
  const rowItems = (ri) => items.filter((t) => t.row === ri && t.present);

  // ---- layout helpers: positions from the row's ordered list
  const layout = (ri, list, uniform) => {
    let x = LEFT; const out = new Map();
    list.forEach((tok) => {
      const w = uniform ? (tok.spec.kind === 'dot' ? R_U * 2 : W_U) : tok.attrs.w;
      out.set(tok, x + w / 2);
      x += w + (uniform ? GAP_U : tok.attrs.gap);
    });
    return out;
  };
  const snapshot = (tok, x) => ({ x, y: ROW_Y[tok.row] + tok.attrs.dy, rot: tok.attrs.rot, scale: tok.attrs.scale, opacity: tok.attrs.opacity, w: tok.attrs.w, r: tok.attrs.r, labelOp: tok.attrs.labelOp });
  const key = (tok, t, s, extra = {}) => tok.kf.push({ t, s, ...extra });
  const orderOf = new Map(); // row → current ordered list

  // ---- initial keyframes
  for (let ri = 0; ri < 5; ri++) {
    const list = items.filter((t) => t.row === ri && t.present);
    orderOf.set(ri, list);
    const pos = layout(ri, list, false);
    list.forEach((tok) => key(tok, 0, snapshot(tok, pos.get(tok))));
    // fresh items sit at their future slot, invisible, until captured
    items.filter((t) => t.row === ri && t.fresh).forEach((tok) => key(tok, 0, snapshot(tok, LEFT + 700)));
  }

  // ---- operations. Each row runs the same grammar, offset so several rows are mid-operation at once.
  const T = { appear: 0.55, resolve: 0.5, vanish: 0.22, close: 0.45, reorder: 0.95, normalize: 0.95 };
  const rowStart = (ri) => 0.5 + ri * 0.55;
  const rowLast = { appear: 0, resolve: 0, reorder: 0, normalize: 0 };

  function opAppear(ri, t0) {
    const list = orderOf.get(ri), fresh = items.find((t) => t.row === ri && t.fresh);
    const at = 1 + Math.floor(r.range(1, list.length - 1));
    list.splice(at, 0, fresh); fresh.present = true;
    const pos = layout(ri, list, false);
    list.forEach((tok) => key(tok, t0, snapshot(tok, tok === fresh ? pos.get(tok) : tok.kf[tok.kf.length - 1].s.x)));
    fresh.attrs.scale = 1;
    list.forEach((tok) => key(tok, t0 + T.appear, snapshot(tok, pos.get(tok)), { ease: tok === fresh ? 'out' : 'inOut' }));
    return t0 + T.appear;
  }
  function opResolve(ri, t0) {
    const list = orderOf.get(ri), dup = list.find((t) => t.dup);
    const twin = list.find((t) => t !== dup && t.spec.kind === 'pill' && t.spec.label === dup.spec.label);
    const cur = (tok) => tok.kf[tok.kf.length - 1].s;
    list.forEach((tok) => key(tok, t0, { ...cur(tok) }));
    // duplicate slides onto its twin (passing above it), then vanishes into it
    key(dup, t0 + T.resolve, { ...cur(dup), x: cur(twin).x, y: cur(twin).y, rot: cur(twin).rot, scale: 0.92 }, { arc: -1 });
    key(dup, t0 + T.resolve + T.vanish, { ...cur(dup), x: cur(twin).x, y: cur(twin).y, scale: 0, opacity: 0 });
    dup.present = false; dup.attrs.scale = 0; dup.attrs.opacity = 0;
    list.splice(list.indexOf(dup), 1);
    // the row closes the gap
    const pos = layout(ri, list, false);
    const tc = t0 + T.resolve + 0.1;
    list.forEach((tok) => { key(tok, tc, { ...cur(tok) }); key(tok, tc + T.close, snapshot(tok, pos.get(tok))); });
    return tc + T.close;
  }
  function opReorder(ri, t0) {
    const list = orderOf.get(ri);
    // sequence rule: pills first in label order, beads after — a visible sort
    const sorted = list.slice().sort((a, b) => {
      const ka = a.spec.kind === 'dot' ? 1 : 0, kb = b.spec.kind === 'dot' ? 1 : 0;
      return ka - kb || (a.spec.label || '').localeCompare(b.spec.label || '');
    });
    orderOf.set(ri, sorted);
    const pos = layout(ri, sorted, false);
    const cur = (tok) => tok.kf[tok.kf.length - 1].s;
    sorted.forEach((tok, i) => {
      const from = cur(tok), to = pos.get(tok), st = t0 + i * 0.07;
      key(tok, st, { ...from });
      key(tok, st + T.reorder - i * 0.03, snapshot(tok, to), { arc: to > from.x + 30 ? -1 : to < from.x - 30 ? 1 : 0 });
    });
    return t0 + T.reorder + sorted.length * 0.05;
  }
  function opNormalize(ri, t0) {
    const list = orderOf.get(ri);
    const cur = (tok) => tok.kf[tok.kf.length - 1].s;
    list.forEach((tok) => key(tok, t0, { ...cur(tok) }));
    list.forEach((tok) => { const dot = tok.spec.kind === 'dot'; Object.assign(tok.attrs, { w: dot ? tok.attrs.w : W_U, r: dot ? R_U : 0, rot: 0, dy: 0, gap: GAP_U, scale: 1, labelOp: dot ? 0 : 1 }); });
    const pos = layout(ri, list, true);
    list.forEach((tok, i) => key(tok, t0 + T.normalize + i * 0.04, snapshot(tok, pos.get(tok))));
    return t0 + T.normalize + list.length * 0.04;
  }

  for (let ri = 0; ri < 5; ri++) {
    let t = rowStart(ri);
    t = opAppear(ri, t); rowLast.appear = Math.max(rowLast.appear, t); t += 0.35;
    t = opResolve(ri, t); rowLast.resolve = Math.max(rowLast.resolve, t); t += 0.3;
    t = opReorder(ri, t); rowLast.reorder = Math.max(rowLast.reorder, t); t += 0.3;
    t = opNormalize(ri, t); rowLast.normalize = Math.max(rowLast.normalize, t);
  }
  const HOLD0 = rowLast.normalize + 0.3, DUR = HOLD0 + 2.6;

  // ---- render: piecewise keyframe interpolation per item
  const EASE = { inOut: ease.inOut, out: ease.out };
  function stateAt(tok, t) {
    const kf = tok.kf;
    if (t <= kf[0].t) return { s: kf[0].s };
    for (let i = 1; i < kf.length; i++) {
      if (t < kf[i].t) {
        const a = kf[i - 1], b = kf[i];
        const u = (EASE[b.ease] || ease.inOut)(remap(t, a.t, b.t));
        const s = {};
        for (const k in b.s) s[k] = lerp(a.s[k], b.s[k], u);
        if (b.arc) s.y += b.arc * 30 * Math.sin(u * Math.PI);
        return { s };
      }
    }
    return { s: kf[kf.length - 1].s };
  }
  function render(t) {
    const beat = t >= HOLD0 ? pulse((t - HOLD0) % 0.6, 0, 0.28) : 0;
    for (const tok of items) {
      const { s } = stateAt(tok, t);
      const dot = tok.spec.kind === 'dot';
      tok.set({
        x: s.x, y: s.y, rot: s.rot, opacity: s.opacity,
        scale: s.scale * (1 + beat * (dot ? 0.09 : 0.035)),
        w: dot ? undefined : s.w, r: dot ? s.r : undefined, labelOpacity: s.labelOp,
        visible: s.scale > 0.001,
      });
    }
    veil.setAttribute('opacity', Math.max(remap(t, DUR - 0.4, DUR), 1 - remap(t, 0, 0.3)));
  }

  const tl = new Timeline({
    duration: DUR, render, title: 'Stage 2', subtitle: 'transform — capture · resolve · sequence · normalize', mount,
    phases: [
      { name: 'capture', from: rowStart(0), to: rowLast.appear },
      { name: 'resolve', from: rowStart(0) + T.appear + 0.35, to: rowLast.resolve },
      { name: 'sequence', from: rowStart(0) + T.appear + 0.35 + T.resolve + 0.1 + T.close + 0.3, to: rowLast.reorder },
      { name: 'normalize', from: rowStart(0) + T.appear + 0.35 + T.resolve + 0.1 + T.close + 0.3 + T.reorder + 0.6, to: rowLast.normalize },
      { name: 'one rhythm', from: HOLD0, to: DUR },
    ],
  });
  tl.play();
  return tl;
};
