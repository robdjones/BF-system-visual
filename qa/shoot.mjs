// QA: render a stage at given times to PNG frames. usage: node qa/shoot.mjs stage-1-pile.html 1,3,7,9
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path';
import fs from 'node:fs';
const [file, times, outDir = 'qa/out'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 860 } });
page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto('file://' + path.resolve(file));
await page.waitForFunction(() => window.TL);
await page.evaluate(() => TL.pause());
for (const ts of times.split(',')) {
  const t = parseFloat(ts);
  await page.evaluate((t) => TL.seek(t), t);
  const name = `${outDir}/${path.basename(file, '.html')}-t${t.toFixed(2)}.png`;
  await page.screenshot({ path: name });
  console.log('wrote', name);
}
await browser.close();
