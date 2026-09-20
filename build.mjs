// Inline kit + scenes + viewer into one self-contained file (dist/) for publishing as a live link.
// Output is body-only (no doctype/html/head/body) as the artifact host wraps it; it still opens fine in a browser.
import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const index = read('index.html');
const body = index.slice(index.indexOf('<body>') + 6, index.indexOf('</body>'))
  .replace(/<script src="[^"]+"><\/script>\s*/g, '');
const out = `<title>Bloomfilter System Motion</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
${read('kit.css')}
html, body { height: 100%; }
body { padding-inline: 0; }
.chapters { padding-top: calc(12px + env(safe-area-inset-top, 0px)); }
.bar { padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }
</style>
${body.replace('<script>', `<script>\n${read('kit.js')}\n${read('scenes/pile.js')}\n${read('scenes/transform.js')}\n`)}`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/bloomfilter-system-motion.html', out);
console.log('wrote dist/bloomfilter-system-motion.html', (out.length / 1024).toFixed(1) + ' KB');
