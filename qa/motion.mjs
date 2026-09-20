// QA: sample token transforms over time and report displacement stats (checks drift is visible + independent)
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const [file, t0 = '7', t1 = '7.5'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 860 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
await page.goto('file://' + path.resolve(file));
await page.waitForFunction(() => window.TL);
const sample = async (t) => page.evaluate((t) => { TL.pause(); TL.seek(t); return [...document.querySelectorAll('g.tok')].map((g) => { const m = g.transform.baseVal.consolidate()?.matrix; return m ? { x: m.e, y: m.f, vis: g.getAttribute('display') !== 'none' } : null; }); }, t);
const a = await sample(parseFloat(t0)), b = await sample(parseFloat(t1));
const d = a.map((p, i) => (p && b[i] && p.vis ? Math.hypot(b[i].x - p.x, b[i].y - p.y) : null)).filter((v) => v != null);
const dirs = a.map((p, i) => (p && b[i] && p.vis ? Math.atan2(b[i].y - p.y, b[i].x - p.x) : null)).filter((v) => v != null);
const mean = d.reduce((s, v) => s + v, 0) / d.length;
// direction coherence: |mean unit vector| — 1 = everyone moves together, 0 = fully independent
const cx = dirs.reduce((s, v) => s + Math.cos(v), 0) / dirs.length, cy = dirs.reduce((s, v) => s + Math.sin(v), 0) / dirs.length;
console.log(`${file}: ${d.length} visible tokens; displacement ${t0}s→${t1}s  min ${Math.min(...d).toFixed(1)}  mean ${mean.toFixed(1)}  max ${Math.max(...d).toFixed(1)} px; direction coherence ${Math.hypot(cx, cy).toFixed(2)} (0 = independent)`);
await browser.close();
