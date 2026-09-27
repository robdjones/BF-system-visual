// Serve apps/dev/dist and screenshot routes. usage: node qa/shoot.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import path from 'node:path'
const dist = path.resolve('apps/dev/dist')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }
const server = createServer((req, res) => { let p = path.join(dist, decodeURIComponent((req.url ?? '/').split('?')[0])); if (!existsSync(p) || statSync(p).isDirectory()) p = path.join(dist, 'index.html'); res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' }); res.end(readFileSync(p)) })
await new Promise((r) => server.listen(0, r))
const base = `http://127.0.0.1:${server.address().port}/`
mkdirSync('qa/out', { recursive: true })
const browser = await chromium.launch()
const shots = [
  ['index', '#/', 1280, 900, 0],
  ['story-play', '#/story?preset=play-classic&seed=1', 1280, 800, 420],
  ['story-rework-rave', '#/story?preset=rework-loop&seed=3&theme=rave', 1280, 800, 500],
  ['story-procedural-plain', '#/story?preset=procedural&seed=7&theme=plain', 1280, 800, 380],
  ['story-narrow', '#/story?preset=agent-handoff-to-qa&seed=2', 420, 900, 450],
  ['hero', '#/hero', 1280, 1000, 0],
  ['play', '#/play?preset=model-split&seed=5', 1280, 860, 300],
  ['kit', '#/story/kit', 1100, 800, 0],
  ['story-late', '#/story?preset=play-classic&seed=1', 1280, 800, 2400],
]
for (const [name, hash, w, h, tick] of shots) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => console.error('PAGE ERROR', name, e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', name, m.text()) })
  await page.goto(base + hash)
  await page.waitForTimeout(600)
  if (tick) await page.evaluate(() => { /* pause all clocks by pressing play buttons? we just wait */ })
  await page.waitForTimeout(tick ? tick * 3 : 300) // let the clock run a little (60 ticks/s)
  await page.screenshot({ path: `qa/out/${name}.png` })
  console.log('wrote', name)
  await page.close()
}
await browser.close(); server.close()
