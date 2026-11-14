// QA: seeks the type timeline frame by frame (120 fps) and reports any visible letter that jumps
// more than 150 px between two consecutive frames (= a flash / stutter). usage: node tools/flicker.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const req = createRequire(import.meta.url); let chromium; try { ({ chromium } = req('playwright')); } catch { ({ chromium } = req('/opt/node-tools/node_modules/playwright')); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await pg.goto(`http://localhost:${server.address().port}/index.html`); await pg.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
const out = await pg.evaluate(() => {
  const tl = window.__tl, D = tl.duration(), res = []; let prev = new Map(); const gone = new Map();
  const vis = el => { let n = el; while (n && n.id !== 'stage') { const cs = getComputedStyle(n); if (cs.visibility === 'hidden' || +cs.opacity < .02) return false; n = n.parentElement; } return true; };
  for (let f = 0; f < D * 120; f++) {
    const t = f / 120; tl.seek(t, false); const cur = new Map();
    document.querySelectorAll('#typeF .ch, #typeB .ch, .pt').forEach((ch, i) => {
      if (!vis(ch)) return; const r = ch.getBoundingClientRect(); if (r.bottom < 0 || r.top > 1920) return;
      // clipped by its mask line?
      const ln = ch.closest('.ln'); if (ln && getComputedStyle(ln).overflow === 'hidden') { const lr = ln.getBoundingClientRect(); if (r.top >= lr.bottom - 2 || r.bottom <= lr.top + 2) return; }
      const key = (ch.closest('.blk') || {}).id + ':' + i; cur.set(key, [r.left + r.width / 2, r.top + r.height / 2]);
      const p = prev.get(key); if (p) { const d = Math.hypot(p[0] - cur.get(key)[0], p[1] - cur.get(key)[1]); if (d > 150) res.push(`${t.toFixed(3)} ${key} jumped ${d.toFixed(0)}px`); }
      else if (gone.has(key) && t - gone.get(key) < .6) res.push(`${t.toFixed(3)} ${key} flickered (hidden at ${gone.get(key).toFixed(3)}, back now)`);
    });
    for (const k of prev.keys()) if (!cur.has(k)) gone.set(k, t);
    prev = cur;
  }
  return res;
});
console.log(out.length ? out.join('\n') : 'no letter jumps'); console.log('JUMPS', out.length);
await b.close(); server.close();
