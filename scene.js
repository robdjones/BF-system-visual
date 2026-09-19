/* Bloomfilter — System · assembly line
 * Flat / Swiss-international / subway-map prototype.
 * Everything on the stage is a pure function of loop time t (seconds),
 * so the sequence is loopable and scrubbable frame-exact.
 */
(function () {
  'use strict';

  // ---------- constants ----------
  const W = 1600, H = 900, G = 40;
  const C = {
    ink: '#111110', paper: '#F5F3EE', mute: '#8A8781', grid: '#DEDBD3',
    blue: '#2151E0', red: '#E5432A', green: '#17A05E'
  };
  const NS = 'http://www.w3.org/2000/svg';
  const FONT = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';

  // Timeline (seconds)
  const T = {
    origins: 0.15,
    stubsStart: 1.05,
    linesStart: 2.35, linesEnd: 3.35,   // routes draw left→right; units snap to route as the front passes
    dispatchStart: 3.65, cadence: 0.42, // beat 2 metronome
    holdEnd: 14.4, fadeEnd: 14.8, dur: 15.0
  };
  const HOLD = 0.2;        // station hold
  const GAP = 0.06;        // min gap between a unit leaving a slot and the next entering
  const V1 = 560;          // px/s raw → capture
  const V2 = 470;          // px/s between stations
  const V3 = 420;          // px/s exit
  const HAUL = 0.95;       // s, long haul junction → dock (ease-in-out)
  const SLOT = 44;         // queue slot spacing before SEQUENCE

  // Station x positions (middle zone)
  const X_CAP = 680, X_SEQ = 860, X_STD = 980, X_JUN = 1100;
  const Y_TRUNK = 450;

  // ---------- helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const easeInOutSine = u => -(Math.cos(Math.PI * u) - 1) / 2;
  const easeInOutCubic = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  const easeOutCubic = u => 1 - Math.pow(1 - u, 3);
  const step = (t, a) => (t >= a ? 1 : 0);
  const pad2 = n => String(n).padStart(2, '0');

  function el(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function txt(parent, x, y, s, attrs) {
    const n = el('text', Object.assign({ x, y, 'font-family': FONT, fill: C.ink }, attrs || {}), parent);
    n.textContent = s;
    return n;
  }
  function polyD(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' '); }
  function polyLens(pts) {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return L;
  }
  function polyPoint(pts, L, s) {
    s = clamp(s, 0, L[L.length - 1]);
    let i = 1;
    while (i < L.length - 1 && L[i] < s) i++;
    const u = (L[i] - L[i - 1]) ? (s - L[i - 1]) / (L[i] - L[i - 1]) : 0;
    return [lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)];
  }
  function polySAtX(pts, L, x) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if ((a[0] <= x && b[0] >= x) && b[0] !== a[0]) return L[i - 1] + (x - a[0]) / (b[0] - a[0]) * (L[i] - L[i - 1]);
    }
    return L[L.length - 1];
  }
  // evaluate piecewise checkpoint motion: cps = [{t, s, ease?}] sorted by t
  function evalCps(cps, t) {
    if (t <= cps[0].t) return cps[0].s;
    for (let i = 1; i < cps.length; i++) {
      if (t <= cps[i].t) {
        const a = cps[i - 1], b = cps[i];
        if (b.s === a.s) return a.s;
        const u = (t - a.t) / (b.t - a.t);
        return lerp(a.s, b.s, (b.ease || easeInOutSine)(u));
      }
    }
    return cps[cps.length - 1].s;
  }

  // ---------- data ----------
  const LINES = {
    blue: { key: 'blue', name: 'JIRA', sub: 'work items', color: C.blue,
      pts: [[168, 240], [260, 240], [340, 320], [440, 320], [530, 410], [X_CAP, 410], [740, 410], [780, Y_TRUNK]] },
    red: { key: 'red', name: 'GITHUB', sub: 'code', color: C.red,
      pts: [[168, 450], [260, 450], [320, 510], [420, 510], [480, 450], [780, Y_TRUNK]] },
    green: { key: 'green', name: 'AGENTS', sub: 'sessions', color: C.green,
      pts: [[168, 660], [260, 660], [340, 580], [420, 580], [510, 490], [X_CAP, 490], [740, 490], [780, Y_TRUNK]] }
  };
  const TRUNK_A = [[780, Y_TRUNK], [X_STD, Y_TRUNK]];             // 4px, capture→standardize (static map)
  const TRUNK_B = [[X_STD, Y_TRUNK], [X_JUN, Y_TRUNK]];           // 6px, standardized line (draws)
  const TERM_X = 1200, TERM_W = 320, TERM_H = 120;
  const SLOT_DY = 32;                 // dock row sits below the entry line
  const SLOT_X = [1312, 1272, 1232];  // dock order: farthest slot first
  const TERMINALS = [
    { key: 'alloc', cy: 250, name: 'ALLOCATION', q: 'Where does the next dollar go?', measure: 'Cost per unit of work', fill: 0.72,
      branch: [[X_JUN, 450], [1140, 410], [1140, 290], [1180, 250], [TERM_X, 250]] },
    { key: 'process', cy: 450, name: 'PROCESS DESIGN', q: 'What should the process be?', measure: 'Slowest step', fill: 0.58,
      branch: [[X_JUN, 450], [TERM_X, 450]] },
    { key: 'govern', cy: 650, name: 'GOVERNANCE', q: 'Does reality match the process?', measure: 'Process adherence', fill: 0.86,
      branch: [[X_JUN, 450], [1140, 490], [1140, 610], [1180, 650], [TERM_X, 650]] }
  ];

  // Raw units in DISPATCH order (nearest to CAPTURE first, so nothing overtakes anything).
  // k = segment index on the line, f = fraction along that segment; off/rot = messy pre-capture pose.
  const UNITS_DEF = [
    { line: 'blue',  k: 4, f: 0.10, off: [18, -30], rot: -4,  shape: 'rect',    w: 72, h: 26, label: 'PROJ-905', tag: '?',         lab: 'above', pop: 1.48 },
    { line: 'red',   k: 4, f: 0.05, off: [-6, 38],  rot: 10,  shape: 'diamond', w: 44, h: 44, label: 'PR #131',  tag: 'merged',    lab: 'below', pop: 1.66 },
    { line: 'green', k: 4, f: 0.32, off: [8, 36],   rot: -8,  shape: 'circle',  w: 48, h: 48, label: 'claude/…', tag: '9 turns',   lab: 'below', pop: 1.84 },
    { line: 'blue',  k: 2, f: 0.50, off: [8, -36],  rot: 12,  shape: 'rect',    w: 48, h: 34, label: 'PROJ-77',  tag: '42 h',      lab: 'above', pop: 0.92 },
    { line: 'red',   k: 2, f: 0.50, off: [-14, 40], rot: -5,  shape: 'diamond', w: 30, h: 30, label: 'a3f9c1',   tag: '2 reviews', lab: 'below', pop: 1.18 },
    { line: 'green', k: 2, f: 0.50, off: [14, -38], rot: 6,   shape: 'circle',  w: 30, h: 30, label: 'run 7',    tag: '$14.10',    lab: 'above', pop: 1.32 },
    { line: 'blue',  k: 0, f: 0.50, off: [-4, -28], rot: -6,  shape: 'rect',    w: 60, h: 30, label: 'PROJ-412', tag: '3d 4h',     lab: 'above', pop: 0.42 },
    { line: 'red',   k: 0, f: 0.50, off: [8, 40],   rot: 7,   shape: 'diamond', w: 38, h: 38, label: 'PR #88',   tag: '+412 −80',  lab: 'below', pop: 0.55 },
    { line: 'green', k: 0, f: 0.50, off: [-8, 38],  rot: -12, shape: 'circle',  w: 40, h: 40, label: 'run 0x1f', tag: '1.2M tok',  lab: 'below', pop: 0.84 }
  ];
  const JITTER = [0.00, 0.14, -0.10, 0.17, -0.08, 0.06, -0.12, 0.16, -0.05]; // irregular arrivals; SEQUENCE re-times to an even cadence
  const STUBS = [[4, 3, 0.14, 0.52], [8, 7, 0.16, 0.5], [3, 0, 0.18, 0.55]]; // [fromUnit, toUnit, startFrac, endFrac]

  // ---------- geometry ----------
  for (const k in LINES) { const l = LINES[k]; l.L = polyLens(l.pts); }

  const UNITS = UNITS_DEF.map((d, i) => {
    const line = LINES[d.line];
    const a = line.pts[d.k], b = line.pts[d.k + 1];
    const snap = [lerp(a[0], b[0], d.f), lerp(a[1], b[1], d.f)];
    const raw = [snap[0] + d.off[0], snap[1] + d.off[1]];
    const sOnLine = line.L[d.k] + d.f * (line.L[d.k + 1] - line.L[d.k]);
    const term = TERMINALS[Math.floor(i / 3)];
    const slot = i % 3;
    const journey = [snap].concat(line.pts.slice(d.k + 1));
    journey.push([X_STD, Y_TRUNK], [X_JUN, Y_TRUNK]);
    journey.push(...term.branch.slice(1));
    journey.push([TERM_X + SLOT_DY, term.cy + SLOT_DY], [SLOT_X[slot], term.cy + SLOT_DY]);
    const L = polyLens(journey);
    return {
      i, def: d, line, term, slot, snap, raw, sOnLine, journey, L,
      sCap: polySAtX(journey, L, X_CAP), sSeq: polySAtX(journey, L, X_SEQ),
      sStd: polySAtX(journey, L, X_STD), sJun: polySAtX(journey, L, X_JUN), sEnd: L[L.length - 1]
    };
  });

  // ---------- schedule ----------
  (function schedule() {
    let prev = null;
    UNITS.forEach((u, i) => {
      const line = u.line;
      u.tSnap = lerp(T.linesStart, T.linesEnd, u.sOnLine / line.L[line.L.length - 1]);
      u.t0 = T.dispatchStart + i * T.cadence + JITTER[i];
      u.tCapArr = u.t0 + u.sCap / V1;
      u.tCapDep = u.tCapArr + HOLD;
      const cps = [{ t: u.t0, s: 0 }, { t: u.tCapArr, s: u.sCap }, { t: u.tCapDep, s: u.sCap }];
      // queue before SEQUENCE (single track): slots at sSeq-2*SLOT, sSeq-SLOT, sSeq
      const s2 = u.sSeq - 2 * SLOT, s1 = u.sSeq - SLOT;
      const tAt2 = u.tCapDep + (s2 - u.sCap) / V2;
      const dep2 = Math.max(tAt2, prev ? prev.leave[1] + GAP : -Infinity);
      const arr1 = dep2 + SLOT / V2;
      const dep1 = Math.max(arr1, prev ? prev.leave[0] + GAP : -Infinity);
      const arr0 = dep1 + SLOT / V2;
      if (dep2 > tAt2) { cps.push({ t: tAt2, s: s2 }, { t: dep2, s: s2 }); u.queued = true; }
      if (dep1 > arr1) { cps.push({ t: arr1, s: s1 }, { t: dep1, s: s1 }); u.queued = true; }
      u.tSeqArr = arr0;
      cps.push({ t: u.tSeqArr, s: u.sSeq });
      u.tSeqDep = Math.max(u.tSeqArr + HOLD, prev ? prev.tSeqDep + T.cadence : -Infinity);
      u.leave = { 1: dep1, 0: u.tSeqDep };
      cps.push({ t: u.tSeqDep, s: u.sSeq });
      u.tStdArr = u.tSeqDep + (u.sStd - u.sSeq) / V2;
      u.tStdDep = u.tStdArr + HOLD;
      cps.push({ t: u.tStdArr, s: u.sStd }, { t: u.tStdDep, s: u.sStd });
      u.tJunArr = u.tStdDep + (u.sJun - u.sStd) / V3;
      cps.push({ t: u.tJunArr, s: u.sJun });
      u.tDock = u.tJunArr + HAUL;
      cps.push({ t: u.tDock, s: u.sEnd, ease: easeInOutCubic });
      u.cps = cps;
      prev = u;
    });
    TERMINALS.forEach(tm => {
      tm.tFill = Math.max(...UNITS.filter(u => u.term === tm).map(u => u.tDock)) + 0.08;
      tm.tBar = tm.tFill + 0.5;
    });
  })();

  // ---------- static scaffold ----------
  const svg = document.getElementById('stage');
  el('rect', { width: W, height: H, fill: C.paper }, svg);
  const grid = el('g', { id: 'grid' }, svg);
  for (let x = G; x < W; x += G) for (let y = G; y < H; y += G) el('circle', { cx: x, cy: y, r: 1, fill: C.grid }, grid);

  const chrome = el('g', { id: 'chrome' }, svg);
  const gMap = el('g', { id: 'map' }, svg);            // static transit map: never fades
  const scene = el('g', { id: 'live' }, svg);          // everything that moves: fades for the loop
  const gRoutes = el('g', { id: 'routes' }, scene);
  const gStations = el('g', { id: 'stations' }, gMap);
  const gTerminals = el('g', { id: 'terminals' }, scene);
  const gUnits = el('g', { id: 'units' }, scene);
  const gLabels = el('g', { id: 'labels', style: 'mix-blend-mode: difference' }, svg); // terminal type: inverts over the black fill

  function zoneHeader(x0, x1, num, title, sub, rule) {
    const g = el('g', null, chrome);
    txt(g, x0, 116, num, { 'font-size': 30, 'font-weight': 700, 'letter-spacing': '-0.01em' });
    txt(g, x0 + 44, 116, title, { 'font-size': 30, 'font-weight': 400, 'letter-spacing': '-0.01em' });
    el('rect', { x: x0, y: 136, width: x1 - x0, height: rule, fill: C.ink }, g);
    txt(g, x0, 164, sub, { 'font-size': 12, 'font-weight': 500, fill: C.mute, 'letter-spacing': '0.1em' });
  }
  zoneHeader(80, 560, '01', 'Ingredients', 'DISCONNECTED WORK SYSTEMS · TOOLS · MEASURES', 1);
  zoneHeader(600, 1040, '02', 'Bloomfilter', 'CAPTURE → SEQUENCE → STANDARDIZE', 2);
  zoneHeader(1080, 1520, '03', 'Use cases', 'ALLOCATION · PROCESS DESIGN · GOVERNANCE', 4);

  txt(chrome, 80, 52, 'BLOOMFILTER · SYSTEM', { 'font-size': 11, 'font-weight': 600, 'letter-spacing': '0.14em' });
  txt(chrome, 1520, 52, 'ASSEMBLY LINE · LOOP', { 'font-size': 11, 'font-weight': 500, 'letter-spacing': '0.14em', fill: C.mute, 'text-anchor': 'end' });
  el('rect', { x: 80, y: 800, width: 1440, height: 1, fill: C.ink }, chrome);
  [[C.blue, 'JIRA', 'work items'], [C.red, 'GITHUB', 'code'], [C.green, 'AGENTS', 'sessions'], [C.ink, 'BLOOMFILTER', 'context layer']].forEach((lg, i) => {
    const x = 80 + i * 200;
    el('rect', { x, y: 826, width: 24, height: lg[0] === C.ink ? 6 : 3, fill: lg[0] }, chrome);
    txt(chrome, x + 36, 834, lg[1], { 'font-size': 11, 'font-weight': 600, 'letter-spacing': '0.1em' });
    txt(chrome, x + 36, 852, lg[2], { 'font-size': 11, 'font-weight': 400, fill: C.mute });
  });
  txt(chrome, 1520, 834, 'COLOR = SOURCE SYSTEM · SHAPE = STATE · WEIGHT = STAGE', { 'font-size': 10, 'font-weight': 500, fill: C.mute, 'letter-spacing': '0.12em', 'text-anchor': 'end' });

  // origins (line termini)
  const origins = {};
  for (const k in LINES) {
    const l = LINES[k], y = l.pts[0][1];
    const g = el('g', null, gMap);
    el('rect', { x: 72, y: y - 20, width: 96, height: 40, fill: C.paper, stroke: l.color, 'stroke-width': 2 }, g);
    txt(g, 120, y - 2, l.name, { 'font-size': 12, 'font-weight': 700, 'letter-spacing': '0.1em', 'text-anchor': 'middle', fill: l.color });
    txt(g, 120, y + 13, l.sub, { 'font-size': 10, 'text-anchor': 'middle', fill: C.mute });
    origins[k] = g;
  }
  // routes
  const routePaths = {};
  for (const k in LINES) {
    const l = LINES[k], len = l.L[l.L.length - 1];
    routePaths[k] = { len, p: el('path', { d: polyD(l.pts), fill: 'none', stroke: l.color, 'stroke-width': 2.5, 'stroke-linejoin': 'round',
      'stroke-dasharray': len, 'stroke-dashoffset': len }, gRoutes) };
  }
  el('path', { d: polyD(TRUNK_A), fill: 'none', stroke: C.ink, 'stroke-width': 4 }, gMap);
  const belt = el('path', { d: polyD(TRUNK_A), fill: 'none', stroke: C.paper, 'stroke-width': 2, 'stroke-dasharray': '6 10', opacity: 0 }, gRoutes);
  const trunkLenB = polyLens(TRUNK_B).pop();
  const trunkB = el('path', { d: polyD(TRUNK_B), fill: 'none', stroke: C.ink, 'stroke-width': 6, 'stroke-dasharray': trunkLenB }, gRoutes);
  const branchPaths = TERMINALS.map(tm => {
    const len = polyLens(tm.branch).pop();
    return { len, p: el('path', { d: polyD(tm.branch), fill: 'none', stroke: C.ink, 'stroke-width': 6, 'stroke-linejoin': 'miter',
      'stroke-dasharray': len, 'stroke-dashoffset': len }, gRoutes) };
  });
  const junction = el('circle', { cx: X_JUN, cy: Y_TRUNK, r: 7, fill: C.paper, stroke: C.ink, 'stroke-width': 4 }, gRoutes);

  // broken stubs (beat 1): dashed attempts that stop short of the other system
  const stubEls = STUBS.map(([a, b, f0, f1]) => {
    const A = UNITS[a].raw, B = UNITS[b].raw;
    const from = [lerp(A[0], B[0], f0), lerp(A[1], B[1], f0)];
    const end = [lerp(A[0], B[0], f1), lerp(A[1], B[1], f1)];
    const len = Math.hypot(end[0] - from[0], end[1] - from[1]);
    const p = el('path', { d: polyD([from, end]), fill: 'none', stroke: C.mute, 'stroke-width': 1.25 }, gRoutes);
    const x = el('g', { stroke: C.mute, 'stroke-width': 1.25 }, gRoutes);
    el('line', { x1: end[0] - 4, y1: end[1] - 4, x2: end[0] + 4, y2: end[1] + 4 }, x);
    el('line', { x1: end[0] - 4, y1: end[1] + 4, x2: end[0] + 4, y2: end[1] - 4 }, x);
    return { p, x, len };
  });

  // stations
  function station(x, label, sub) {
    const g = el('g', null, gStations);
    const bar = el('rect', { x: x - 3, y: 370, width: 6, height: 160, fill: C.ink }, g);
    txt(g, x, 352, label, { 'font-size': 13, 'font-weight': 700, 'letter-spacing': '0.14em', 'text-anchor': 'middle' });
    const count = txt(g, x, 560, '0 / 9', { 'font-size': 11, 'font-weight': 500, fill: C.mute, 'text-anchor': 'middle', 'letter-spacing': '0.06em' });
    txt(g, x, 578, sub, { 'font-size': 10, fill: C.mute, 'text-anchor': 'middle' });
    return { bar, count, x };
  }
  const stCap = station(X_CAP, 'CAPTURE', 'every record, every system');
  const stSeq = station(X_SEQ, 'SEQUENCE', 'one clock');
  const stStd = station(X_STD, 'STANDARDIZE', 'uniform units');
  // the one clock: 9 ticks, one per unit, filled as units are sequenced
  const ruler = el('g', null, gStations);
  el('line', { x1: 796, y1: 500, x2: 932, y2: 500, stroke: C.ink, 'stroke-width': 1 }, ruler);
  const ticks = UNITS.map((u, i) => el('rect', { x: 800 + i * 16 - 0.5, y: 492, width: 1, height: 8, fill: C.mute }, ruler));

  // terminals
  const termEls = TERMINALS.map(tm => {
    const g = el('g', null, gTerminals);
    const y0 = tm.cy - TERM_H / 2;
    el('rect', { x: TERM_X, y: y0, width: TERM_W, height: TERM_H, fill: C.paper, stroke: C.ink, 'stroke-width': 2 }, gMap);
    const slots = SLOT_X.map(sx => el('rect', { x: sx - 16, y: tm.cy + SLOT_DY - 16, width: 32, height: 32, fill: 'none', stroke: C.mute, 'stroke-width': 1, 'stroke-dasharray': '3 3' }, gMap));
    const fill = el('rect', { x: TERM_X, y: y0, width: 0, height: TERM_H, fill: C.ink }, g);
    txt(gLabels, 1232, tm.cy - 24, tm.name, { 'font-size': 17, 'font-weight': 800, 'letter-spacing': '0.06em', fill: C.paper });
    txt(gLabels, 1232, tm.cy - 5, tm.q, { 'font-size': 11.5, fill: '#9C9A93' });
    const measure = txt(g, 1352, tm.cy + SLOT_DY - 14, tm.measure.toUpperCase(), { 'font-size': 9.5, 'font-weight': 600, 'letter-spacing': '0.1em', fill: C.paper, opacity: 0 });
    const barBg = el('rect', { x: 1352, y: tm.cy + SLOT_DY - 4, width: 144, height: 8, fill: 'none', stroke: C.paper, 'stroke-width': 1, opacity: 0 }, g);
    const bar = el('rect', { x: 1352, y: tm.cy + SLOT_DY - 4, width: 0, height: 8, fill: C.paper }, g);
    return { fill, slots, barBg, bar, measure, tm };
  });

  // units (raw / captured / standardized — swapped, never morphed)
  const unitEls = UNITS.map(u => {
    const d = u.def, col = u.line.color;
    const g = el('g', { class: 'unit' }, gUnits);
    const raw = el('g', null, g);
    if (d.shape === 'rect') el('rect', { x: -d.w / 2, y: -d.h / 2, width: d.w, height: d.h, fill: C.paper, stroke: col, 'stroke-width': 1.75 }, raw);
    else if (d.shape === 'diamond') el('path', { d: `M0 ${-d.h / 2} L${d.w / 2} 0 L0 ${d.h / 2} L${-d.w / 2} 0 Z`, fill: C.paper, stroke: col, 'stroke-width': 1.75 }, raw);
    else el('circle', { r: d.w / 2, fill: C.paper, stroke: col, 'stroke-width': 1.75 }, raw);
    const ly = d.lab === 'above' ? -d.h / 2 - 8 : d.h / 2 + 15;
    const lbl = txt(raw, -d.w / 2, ly, d.label, { 'font-size': 10.5, 'font-weight': 600 });
    const tag = el('tspan', { dx: 8, 'font-size': 10, 'font-weight': 400, fill: C.mute }, lbl);
    tag.textContent = d.tag;
    const cap = el('g', { opacity: 0 }, g);
    el('rect', { x: -16, y: -16, width: 32, height: 32, fill: C.paper, stroke: col, 'stroke-width': 2 }, cap);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
      el('line', { x1: sx * 16, y1: sy * 22, x2: sx * 16, y2: sy * 16, stroke: col, 'stroke-width': 2 }, cap);
      el('line', { x1: sx * 22, y1: sy * 16, x2: sx * 16, y2: sy * 16, stroke: col, 'stroke-width': 2 }, cap);
    });
    const capNum = txt(cap, 0, 4.5, '', { 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle', fill: col });
    const std = el('g', { opacity: 0 }, g);
    el('rect', { x: -16, y: -16, width: 32, height: 32, fill: col }, std);
    txt(std, 0, 4.5, pad2(u.i + 1), { 'font-size': 12, 'font-weight': 700, 'text-anchor': 'middle', fill: '#fff' });
    return { g, raw, cap, capNum, std };
  });

  // ---------- render(t) ----------
  const flash = (t, t0, len) => (t >= t0 ? 1 - seg(t, t0, t0 + len) : 0);
  function render(t) {
    scene.setAttribute('opacity', 1 - seg(t, T.holdEnd, T.fadeEnd));

    const draw = easeInOutSine(seg(t, T.linesStart, T.linesEnd));
    for (const k in LINES) routePaths[k].p.setAttribute('stroke-dashoffset', routePaths[k].len * (1 - draw));
    const firstStd = UNITS[0].tStdDep;
    trunkB.setAttribute('stroke-dashoffset', trunkLenB * (1 - easeOutCubic(seg(t, firstStd - 0.05, firstStd + 0.3))));
    const firstJun = UNITS[0].tJunArr;
    branchPaths.forEach((b, j) => {
      b.p.setAttribute('stroke-dashoffset', b.len * (1 - easeInOutCubic(seg(t, firstJun - 0.05 + j * 0.12, firstJun + 0.55 + j * 0.12))));
    });
    junction.setAttribute('opacity', step(t, firstJun - 0.05));
    const lastStd = UNITS[UNITS.length - 1].tStdArr;
    const beltOn = step(t, T.linesEnd) * (1 - step(t, lastStd));
    belt.setAttribute('opacity', beltOn);
    belt.setAttribute('stroke-dashoffset', (-(t * V2) % 16).toFixed(2));

    stubEls.forEach((s, j) => {
      const a = T.stubsStart + j * 0.28, b = a + 0.45;
      const gone = 1 - seg(t, T.linesStart - 0.1, T.linesStart + 0.2);
      s.p.setAttribute('stroke-dasharray', `${s.len * seg(t, a, b)} ${s.len}`);
      s.p.setAttribute('opacity', gone);
      s.x.setAttribute('opacity', step(t, b + 0.12) * gone);
    });

    let nCap = 0, nSeq = 0, nStd = 0, capFlash = 0, seqFlash = 0, stdFlash = 0;
    UNITS.forEach((u, i) => {
      const e = unitEls[i], d = u.def;
      const visible = t >= d.pop ? 1 : 0;
      e.g.setAttribute('opacity', visible);
      if (!visible) return;
      let x, y, rot = 0;
      if (t < u.t0) {
        const k = seg(t, u.tSnap, u.tSnap + 0.14); // snap-to-route
        x = lerp(u.raw[0], u.snap[0], k); y = lerp(u.raw[1], u.snap[1], k); rot = lerp(d.rot, 0, k);
      } else {
        const p = polyPoint(u.journey, u.L, evalCps(u.cps, t));
        x = p[0]; y = p[1];
      }
      e.g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(2)})`);
      const X = 0.1;
      const kCap = seg(t, u.tCapArr, u.tCapArr + X), kStd = seg(t, u.tStdArr, u.tStdArr + X);
      e.raw.setAttribute('opacity', 1 - kCap);
      e.cap.setAttribute('opacity', kCap * (1 - kStd));
      e.std.setAttribute('opacity', kStd);
      e.capNum.textContent = t >= u.tSeqArr ? pad2(u.i + 1) : '';
      if (t >= u.tCapArr) nCap++;
      if (t >= u.tSeqArr) nSeq++;
      if (t >= u.tStdArr) nStd++;
      capFlash = Math.max(capFlash, flash(t, u.tCapArr, 0.16));
      seqFlash = Math.max(seqFlash, flash(t, u.tSeqDep, 0.16));
      stdFlash = Math.max(stdFlash, flash(t, u.tStdArr, 0.16));
      const on = t >= u.tSeqDep;
      ticks[i].setAttribute('fill', on ? C.ink : C.mute);
      ticks[i].setAttribute('width', on ? 3 : 1);
      ticks[i].setAttribute('x', 800 + i * 16 - (on ? 1.5 : 0.5));
      ticks[i].setAttribute('height', on ? 12 : 8);
      ticks[i].setAttribute('y', on ? 488 : 492);
    });
    [[stCap, capFlash, X_CAP], [stSeq, seqFlash, X_SEQ], [stStd, stdFlash, X_STD]].forEach(([st, f, x]) => {
      st.bar.setAttribute('width', 6 + 6 * f); st.bar.setAttribute('x', x - 3 - 3 * f);
    });
    stCap.count.textContent = `${nCap} / 9`; stSeq.count.textContent = `${nSeq} / 9`; stStd.count.textContent = `${nStd} / 9`;

    termEls.forEach(te => {
      const tm = te.tm;
      const kFill = easeInOutCubic(seg(t, tm.tFill, tm.tFill + 0.45));
      te.fill.setAttribute('width', TERM_W * kFill);
      te.slots.forEach(s => s.setAttribute('opacity', 1 - kFill));
      const kBar = easeInOutCubic(seg(t, tm.tBar, tm.tBar + 0.7));
      te.barBg.setAttribute('opacity', step(t, tm.tBar));
      te.bar.setAttribute('width', 144 * tm.fill * kBar);
      te.measure.setAttribute('opacity', step(t, tm.tBar) * 0.8);
    });
  }

  // ---------- player ----------
  const scrub = document.getElementById('scrub');
  const timeEl = document.getElementById('time');
  const playBtn = document.getElementById('play');
  const marks = document.getElementById('beat-marks');
  const BEATS = [[0, '01 Ingredients'], [T.linesStart, '02 Bloomfilter'], [UNITS[0].tJunArr, '03 Use cases']];
  BEATS.forEach(([tt, label]) => {
    const m = document.createElement('div');
    m.className = 'beat-mark'; m.style.left = (tt / T.dur * 100) + '%'; m.textContent = label;
    marks.appendChild(m);
  });

  let playing = true, tCur = 0, last = performance.now();
  function setTime(t) {
    tCur = ((t % T.dur) + T.dur) % T.dur;
    render(tCur);
    scrub.value = Math.round(tCur / T.dur * 1000);
    timeEl.textContent = tCur.toFixed(2) + ' s';
  }
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (playing) setTime(tCur + dt);
    requestAnimationFrame(frame);
  }
  function setPlaying(p) { playing = p; playBtn.textContent = p ? '❚❚' : '▶'; }
  playBtn.addEventListener('click', () => setPlaying(!playing));
  scrub.addEventListener('input', () => { setPlaying(false); setTime(scrub.value / 1000 * T.dur); });
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    if (e.code === 'ArrowLeft') { setPlaying(false); setTime(tCur - (e.shiftKey ? 1 : 0.1)); }
    if (e.code === 'ArrowRight') { setPlaying(false); setTime(tCur + (e.shiftKey ? 1 : 0.1)); }
    if (e.key === '[' || e.key === ']' || e.key === '\\') { setPlaying(false); setTime(BEATS[{ '[': 0, ']': 1, '\\': 2 }[e.key]][0]); }
  });

  window.BF = {
    duration: T.dur, T, units: UNITS, terminals: TERMINALS, beats: BEATS,
    setTime: t => { setPlaying(false); setTime(t); },
    play: () => setPlaying(true), pause: () => setPlaying(false)
  };
  document.fonts.ready.then(() => { setTime(0); requestAnimationFrame(frame); });
})();
