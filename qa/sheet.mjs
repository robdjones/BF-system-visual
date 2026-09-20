// QA: contact sheet of a stage at fixed intervals (deterministic timeline → identical to real-time frames).
// usage: node qa/sheet.mjs stage-2-transform.html 13 0.5
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
const [file, secs = '13', step = '0.5'] = process.argv.slice(2);
const base = path.basename(file, '.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 860 } });
await page.goto('file://' + path.resolve(file));
await page.waitForFunction(() => window.TL);
const frames = [];
for (let t = 0; t < parseFloat(secs); t += parseFloat(step)) {
  await page.evaluate((t) => { TL.pause(); TL.seek(t); }, t);
  const buf = await page.screenshot({ clip: { x: 16, y: 16, width: 1168, height: 779 } });
  frames.push({ t, data: 'data:image/png;base64,' + buf.toString('base64') });
}
const cols = 6, w = 300, h = Math.round((779 / 1168) * 300);
const sheet = await browser.newPage({ viewport: { width: cols * w, height: Math.ceil(frames.length / cols) * (h + 18) } });
await sheet.setContent(`<body style="margin:0;background:#ddd;font:11px sans-serif"><canvas id=c width=${cols * w} height=${Math.ceil(frames.length / cols) * (h + 18)}></canvas></body>`);
await sheet.evaluate(async ({ frames, cols, w, h }) => {
  const ctx = document.getElementById('c').getContext('2d');
  for (let i = 0; i < frames.length; i++) {
    const img = new Image(); img.src = frames[i].data; await img.decode();
    const x = (i % cols) * w, y = Math.floor(i / cols) * (h + 18);
    ctx.drawImage(img, x, y, w, h); ctx.fillStyle = '#000'; ctx.fillText(frames[i].t.toFixed(2) + 's', x + 4, y + h + 12);
  }
}, { frames, cols, w, h });
await sheet.screenshot({ path: `qa/out/sheet-${base}.png` });
console.log('wrote', `qa/out/sheet-${base}.png`);
await browser.close();
