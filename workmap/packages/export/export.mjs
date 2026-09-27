#!/usr/bin/env node
/* Headless render of a preset to PNG frames, then MP4 / GIF when an ffmpeg binary is available.
   usage: node packages/export/export.mjs --preset rework-loop --seed 3 --theme play --seconds 8 --fps 30 --width 1280 --height 720 --out out/rework-loop
   Needs the dev app built (apps/dev/dist) and Playwright's Chromium. */
import { spawnSync, execSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] ?? 'true'] : [])).filter((x) => x.length))
const preset = args.preset ?? 'play-classic', seed = args.seed ?? '1', theme = args.theme ?? 'play'
const seconds = Number(args.seconds ?? 8), fps = Number(args.fps ?? 30), width = Number(args.width ?? 1280), height = Number(args.height ?? 720)
const ticksPerSecond = Number(args.tps ?? 60)
const out = args.out ?? `out/${preset}-${seed}`
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const dist = path.join(root, 'apps/dev/dist')
if (!existsSync(path.join(dist, 'index.html'))) { console.log('building apps/dev…'); execSync('npm run build -w apps/dev', { cwd: root, stdio: 'inherit' }) }
mkdirSync(out, { recursive: true })

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }
const server = createServer((req, res) => {
  let p = path.join(dist, decodeURIComponent((req.url ?? '/').split('?')[0]))
  if (!existsSync(p) || statSync(p).isDirectory()) p = path.join(dist, 'index.html')
  res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' }); res.end(readFileSync(p))
})
await new Promise((r) => server.listen(0, r))
const port = server.address().port

let chromium
try { ({ chromium } = await import('playwright')) } catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')) }
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
await page.goto(`http://127.0.0.1:${port}/#/export?preset=${preset}&seed=${seed}&theme=${theme}&w=${width}&h=${height}`)
await page.waitForFunction(() => window.__workmap?.ready)
await page.waitForTimeout(200)
const frames = Math.round(seconds * fps)
for (let i = 0; i < frames; i++) {
  const tick = ((i / fps) * ticksPerSecond) % 1000
  await page.evaluate((t) => window.__workmap.seek(t), tick)
  await page.screenshot({ path: path.join(out, `frame-${String(i).padStart(4, '0')}.png`) })
  if (i % fps === 0) process.stdout.write(`\r${i}/${frames} frames`)
}
console.log(`\nwrote ${frames} frames to ${out}`)
await browser.close(); server.close()

// encode when we can: a full ffmpeg (with the image2 demuxer) makes MP4 / WebM / GIF; Playwright's trimmed build cannot read PNG sequences
const manual = `ffmpeg -framerate ${fps} -i ${out}/frame-%04d.png -c:v libx264 -pix_fmt yuv420p ${out}.mp4`
const candidates = ['ffmpeg', '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux']
const ffmpeg = candidates.find((c) => spawnSync(c, ['-version'], { stdio: 'ignore' }).status === 0)
const encode = (label, file, extra) => {
  if (!ffmpeg) return false
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(out, 'frame-%04d.png'), ...extra, file], { stdio: 'pipe' })
  if (r.status === 0) { console.log(`wrote ${file}`); return true }
  return false
}
const ok = [
  encode('mp4', `${out}.mp4`, ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']),
  encode('webm', `${out}.webm`, ['-c:v', 'libvpx', '-b:v', '2M']),
  encode('gif', `${out}.gif`, ['-vf', 'fps=15,scale=640:-1']),
].some(Boolean)
if (!ok) console.log(`frames only (${ffmpeg ? 'this ffmpeg cannot read PNG sequences' : 'no ffmpeg found'}). To encode with a full ffmpeg:\n  ${manual}`)
