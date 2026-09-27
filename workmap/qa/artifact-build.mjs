// Turn apps/dev/dist into an artifact page fragment (no doctype/html/head/body) + its asset files.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import path from 'node:path'
const dist = 'apps/dev/dist', out = 'qa/artifact'
mkdirSync(path.join(out, 'assets'), { recursive: true })
const html = readFileSync(path.join(dist, 'index.html'), 'utf8')
const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? ''
const keep = head.replace(/<meta[^>]*charset[^>]*>/i, '').replace(/<meta[^>]*viewport[^>]*>/i, '').replace(/<title>[^<]*<\/title>/, '')
const page = `<title>Bloomfilter Work Map</title>\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${keep}\n<style>html,body,#root{height:100%;margin:0}body{background:#0f1013}</style>\n${body}`
writeFileSync(path.join(out, 'index.html'), page)
for (const f of readdirSync(path.join(dist, 'assets'))) copyFileSync(path.join(dist, 'assets', f), path.join(out, 'assets', f))
console.log('artifact fragment written to', out, 'assets:', readdirSync(path.join(dist, 'assets')).join(', '))
