/* Bloomfilter system motion prototype — shared runtime
   Deterministic: every frame is a pure function of time t, so scenes are scrubbable and loop exactly. */
(function (global) {
  const KIT = {
    cream: '#FCF3E1', ink: '#111111', white: '#FFFFFF', orchid: '#F090F0',
    dots: ['#F26B21', '#F5C400', '#6A4CFF', '#7A8A2E'],
    pillH: 42, font: 19, padX: 20, dotR: 10,
  };

  // ---------- math ----------
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const remap = (t, a, b) => clamp01((t - a) / (b - a));
  const ease = {
    linear: (t) => t,
    in: (t) => t * t * t,
    out: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outLong: (t) => 1 - Math.pow(1 - t, 5),
    smooth: (t) => t * t * (3 - 2 * t),
    // quick pop: overshoot-free settle (scale 1.06 -> 1)
    settle: (t) => 1 + 0.06 * (1 - t) * Math.sin(t * Math.PI),
  };
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = (seed) => {
    const r = mulberry32(seed);
    return { f: r, range: (a, b) => a + (b - a) * r(), pick: (arr) => arr[Math.floor(r() * arr.length)], sign: () => (r() < 0.5 ? -1 : 1) };
  };
  // periodic "independent drift": sum of sines whose periods divide loopLen -> seamless
  function makeDrift(r, loopLen, amp, ks) {
    const comps = ks.map((k) => ({ k, ph: r.range(0, Math.PI * 2), a: amp * r.range(0.5, 1) / Math.sqrt(k) }));
    return (t) => comps.reduce((s, c) => s + c.a * Math.sin((2 * Math.PI * c.k * t) / loopLen + c.ph), 0);
  }
  // a short one-off pulse of width w starting at t0, returns 0..1..0
  const pulse = (t, t0, w) => { const u = (t - t0) / w; return u <= 0 || u >= 1 ? 0 : Math.sin(u * Math.PI); };

  // ---------- svg ----------
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs = {}, parent) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  // Token: pill (label), frag (blank pill, "unfinished"), dot (bead)
  function makeToken(parent, spec) {
    const g = el('g', { class: 'tok ' + spec.kind }, parent);
    const tok = { spec, g, w: 0, h: KIT.pillH };
    if (spec.kind === 'dot') {
      tok.r = spec.r || KIT.dotR;
      tok.circle = el('circle', { r: tok.r, fill: spec.color || KIT.dots[0] }, g);
      tok.w = tok.r * 2; tok.h = tok.r * 2;
    } else {
      tok.rect = el('rect', { height: KIT.pillH, rx: KIT.pillH / 2, ry: KIT.pillH / 2, fill: KIT.ink }, g);
      if (spec.kind === 'pill') {
        tok.text = el('text', { 'font-size': KIT.font, 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 0 }, g);
        tok.text.textContent = spec.label;
        tok.w = tok.text.getComputedTextLength() + KIT.padX * 2;
      } else {
        tok.w = spec.w || 70;
        // frag may later gain a label (resolution)
        tok.text = el('text', { 'font-size': KIT.font, 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 0, opacity: 0 }, g);
        tok.text.textContent = spec.label || '';
      }
      tok.setWidth = (w) => {
        tok.rect.setAttribute('width', w); tok.rect.setAttribute('x', -w / 2); tok.rect.setAttribute('y', -KIT.pillH / 2);
      };
      tok.setWidth(tok.w);
    }
    tok.set = (s) => {
      const sc = s.scale == null ? 1 : s.scale;
      g.setAttribute('transform', `translate(${s.x.toFixed(2)} ${s.y.toFixed(2)}) rotate(${(s.rot || 0).toFixed(2)}) scale(${sc.toFixed(4)})`);
      g.setAttribute('opacity', s.opacity == null ? 1 : s.opacity);
      if (s.w != null && tok.setWidth) tok.setWidth(s.w);
      if (s.labelOpacity != null && tok.text) tok.text.setAttribute('opacity', s.labelOpacity);
      if (s.visible === false) g.setAttribute('display', 'none'); else g.removeAttribute('display');
    };
    return tok;
  }

  // ---------- timeline + viewer chrome ----------
  class Timeline {
    constructor({ duration, render, loopStart = 0, phases = [], title = '', subtitle = '', mount = document.body }) {
      Object.assign(this, { duration, render, loopStart, phases, t: 0, playing: false, loop: true, alive: true });
      this._last = null;
      this.buildBar(title, subtitle, mount);
      this.seek(0);
      this._tick = this._tick.bind(this);
      requestAnimationFrame(this._tick);
    }
    destroy() { this.alive = false; this.playing = false; window.removeEventListener('keydown', this._keys); this.bar.remove(); }
    buildBar(title, subtitle, mount) {
      const bar = document.createElement('div'); bar.className = 'bar'; this.bar = bar;
      bar.innerHTML = `
        <div class="title">${title}<span>${subtitle}</span></div>
        <button class="play">Pause</button>
        <button class="ghost replay">Replay</button>
        <input type="range" min="0" max="${this.duration}" step="0.01" value="0">
        <div class="time"></div>
        <div class="phases">${this.phases.map((p) => `<div class="phase">${p.name}</div>`).join('')}</div>`;
      mount.appendChild(bar);
      this.ui = {
        play: bar.querySelector('.play'), range: bar.querySelector('input'), time: bar.querySelector('.time'),
        phases: [...bar.querySelectorAll('.phase')],
      };
      this.ui.play.onclick = () => (this.playing ? this.pause() : this.play());
      bar.querySelector('.replay').onclick = () => { this.seek(0); this.play(); };
      this.ui.range.oninput = (e) => { this.pause(); this.seek(parseFloat(e.target.value)); };
      this._keys = (e) => {
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.code !== 'Space') return;
        if (e.code === 'Space') { e.preventDefault(); this.playing ? this.pause() : this.play(); }
        if (e.code === 'ArrowRight') { e.preventDefault(); this.pause(); this.seek(Math.min(this.duration, this.t + (e.shiftKey ? 1 : 1 / 30))); }
        if (e.code === 'ArrowLeft') { e.preventDefault(); this.pause(); this.seek(Math.max(0, this.t - (e.shiftKey ? 1 : 1 / 30))); }
        if (e.key === 'r') { this.seek(0); this.play(); }
      };
      window.addEventListener('keydown', this._keys);
    }
    play() { this.playing = true; this._last = null; this.ui.play.textContent = 'Pause'; }
    pause() { this.playing = false; this.ui.play.textContent = 'Play'; }
    seek(t) {
      this.t = t; this.render(t);
      this.ui.range.value = t; this.ui.time.textContent = `${t.toFixed(2)} / ${this.duration.toFixed(2)}s`;
      this.ui.phases.forEach((p, i) => p.classList.toggle('on', t >= this.phases[i].from && t < this.phases[i].to));
    }
    _tick(now) {
      if (!this.alive) return;
      if (this.playing) {
        if (this._last != null) {
          let t = this.t + (now - this._last) / 1000;
          if (t >= this.duration) t = this.loop ? this.loopStart + (t - this.duration) : this.duration;
          this.seek(t);
          if (!this.loop && t >= this.duration) this.pause();
        }
        this._last = now;
      }
      requestAnimationFrame(this._tick);
    }
  }

  global.BF = { KIT, clamp01, lerp, remap, ease, rng, makeDrift, pulse, el, makeToken, Timeline, scenes: {} };
})(window);
