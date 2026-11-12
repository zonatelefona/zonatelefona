// Renders frames of index.html with headless Chromium.
// usage: node render.mjs <outDir> <fps> [start=0] [end=DURATION] [workers=1] [--times=1,2,3]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
let chromium; try { ({ chromium } = req('playwright')); } catch { ({ chromium } = req('/opt/node-tools/node_modules/playwright')); }

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const [, , outDir = 'frames', fpsS = '60', startS = '0', endS = '27', workersS = '1', timesArg] = process.argv;
const fps = +fpsS, workers = +workersS;
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

let frames = [];
if (timesArg && timesArg.startsWith('--times=')) {
  frames = timesArg.slice(8).split(',').map(s => ({ t: +s, name: `t_${(+s).toFixed(2)}.jpg` }));
} else {
  const f0 = Math.round(+startS * fps), f1 = Math.round(+endS * fps);
  for (let f = f0; f < f1; f++) frames.push({ t: f / fps, name: String(f).padStart(5, '0') + '.jpg' });
}
frames = frames.filter(fr => !fs.existsSync(path.join(outDir, fr.name)));

async function worker(list, id) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[w${id}]`, m.text()); });
  page.on('pageerror', e => console.log(`[w${id}] PAGEERROR`, e.message));
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
  const t0 = Date.now();
  for (let i = 0; i < list.length; i++) {
    const fr = list[i];
    await page.evaluate(t => window.setTime(t), fr.t);
    await page.screenshot({ path: path.join(outDir, fr.name), type: 'jpeg', quality: 100, timeout: 180000 });
    if (i % 30 === 0 || process.env.V) console.log(`[w${id}] ${i + 1}/${list.length} t=${fr.t.toFixed(2)} ${((Date.now() - t0) / (i + 1)).toFixed(0)}ms/frame`);
  }
  await browser.close();
}
const chunks = Array.from({ length: workers }, (_, w) => frames.filter((_, i) => i % workers === w));
await Promise.all(chunks.map((c, i) => worker(c, i)));
server.close();
console.log('done', frames.length);
