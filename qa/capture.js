#!/usr/bin/env node
/* QA capture: renders the loop at exact times.
 *   node qa/capture.js frames  [outDir] [t1,t2,...]   → PNG per time
 *   node qa/capture.js sheet   [outDir]               → 12-frame contact sheet (needs ffmpeg)
 *   node qa/capture.js video   [outDir] [fps]         → frames + mp4/webm via ffmpeg
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PW_MODULE || 'playwright');

const ROOT = path.resolve(__dirname, '..');
const mode = process.argv[2] || 'frames';
const outDir = path.resolve(process.argv[3] || path.join(ROOT, 'qa', 'out'));
fs.mkdirSync(outDir, { recursive: true });

const FFMPEG = process.env.FFMPEG || (fs.existsSync('/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2') ? '/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2' : 'ffmpeg');
const DEFAULT_TIMES = [0.3, 1.2, 2.0, 2.9, 3.8, 4.6, 5.4, 6.4, 7.6, 8.8, 10.0, 11.6, 13.0, 14.0];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => window.BF && document.fonts.status === 'loaded');
  const dur = await page.evaluate(() => window.BF.duration);
  const stage = await page.$('#stage');

  async function shot(t, file) {
    await page.evaluate(t => window.BF.setTime(t), t);
    await page.waitForTimeout(16);
    await stage.screenshot({ path: file });
  }

  if (mode === 'frames') {
    const times = process.argv[4] ? process.argv[4].split(',').map(Number) : DEFAULT_TIMES;
    for (const t of times) {
      const f = path.join(outDir, `t${t.toFixed(2).padStart(5, '0')}.png`);
      await shot(t, f);
      console.log(f);
    }
  } else if (mode === 'sheet') {
    const n = 12;
    const files = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * dur;
      const f = path.join(outDir, `sheet_${String(i).padStart(2, '0')}.png`);
      await shot(t, f); files.push(f);
    }
    const out = path.join(outDir, 'contact_sheet.png');
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.join(outDir, 'sheet_%02d.png'),
      '-vf', 'scale=800:-1,tile=3x4:padding=8:margin=8:color=white', out]);
    console.log(out);
  } else if (mode === 'video') {
    const fps = Number(process.argv[4] || 30);
    const n = Math.round(dur * fps);
    const dir = path.join(outDir, 'video_frames');
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 0; i < n; i++) {
      await shot(i / fps, path.join(dir, `f${String(i).padStart(4, '0')}.png`));
      if (i % 60 === 0) console.log(`frame ${i}/${n}`);
    }
    const mp4 = path.join(outDir, 'bloomfilter-system-loop.mp4');
    try {
      execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%04d.png'),
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', mp4]);
      console.log(mp4);
    } catch (e) {
      const webm = path.join(outDir, 'bloomfilter-system-loop.webm');
      execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%04d.png'),
        '-c:v', 'libvpx-vp9', '-b:v', '4M', '-pix_fmt', 'yuv420p', webm]);
      console.log(webm);
    }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
