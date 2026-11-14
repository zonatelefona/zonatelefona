// QA: exact copy, horizontal centring and Reels safe zone for every text element (seeks the type timeline every 1/30 s).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const req = createRequire(import.meta.url); let chromium; try { ({ chromium } = req('playwright')); } catch { ({ chromium } = req('/opt/node-tools/node_modules/playwright')); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } });
pg.on('pageerror', e => console.log('PAGEERROR', e.message));
await pg.goto(`http://localhost:${server.address().port}/index.html`); await pg.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
const REQUIRED = ['POV:', 'UŠAO SI SAMO', 'DA POGLEDAŠ…', 'ALI ONDA…', 'VIDEO SI OVAJ.', 'I SAD…', 'NE MOŽEŠ DA', 'PRESTANEŠ', 'DA GLEDAŠ.',
  'REKAO SI:', 'SAMO GLEDAM.', 'DA, NARAVNO.', '😂', 'KOJI BI TI UZEO?', '1, 2 ILI 3?', 'ZONA', 'TELEFONA', 'ZAPRATI ZA SVOJ', 'SLEDEĆI TELEFON.', '@zona.telefona', 'RUMA', '1', '2', '3'];
const res = await pg.evaluate((REQUIRED) => {
  const tl = window.__tl, D = tl.duration(), out = { text: [], centre: [], safe: [], seen: {} };
  const lines = window.__LINES;
  const rendered = lines.map(l => l.el.textContent.replace(/\s+/g, ' ').trim());
  for (const r of REQUIRED) if (!rendered.includes(r)) out.text.push('MISSING: ' + r);
  for (const r of rendered) if (!REQUIRED.includes(r)) out.text.push('UNEXPECTED: ' + r);
  for (let f = 0; f < D * 30; f++) {
    tl.seek(f / 30, false);
    for (const l of lines) {
      const cs = getComputedStyle(l.el); if (cs.visibility === 'hidden' || +cs.opacity < .99) continue;
      const parts = [...l.el.querySelectorAll('.w, .emoji')]; if (!parts.length) continue;
      const ls = parseFloat(cs.letterSpacing) || 0;   // trailing letter-spacing is not ink
      const rs = parts.map(p => p.getBoundingClientRect()); const L = Math.min(...rs.map(r => r.left)), R = Math.max(...rs.map(r => r.right)) - ls, Tp = Math.min(...rs.map(r => r.top)), B = Math.max(...rs.map(r => r.bottom));
      const m = (cs.transform && cs.transform !== 'none') ? cs.transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number) : [1, 0, 0, 1, 0, 0];
      if (Math.abs(m[0] - 1) > .04 || Math.abs(m[4]) > 2) continue;   // only settled poses (scale ≈ 1, no slide)
      const moving = parts.some(p => { const t = getComputedStyle(p).transform; if (!t || t === 'none') return false; const q = t.match(/matrix\(([^)]+)\)/); if (!q) return true; const v = q[1].split(',').map(Number); return Math.abs(v[0] - 1) > .01 || Math.abs(v[1]) > .01 || Math.abs(v[4]) > 1 || Math.abs(v[5]) > 1; });
      if (moving) continue;
      const key = l.el.id; const s = out.seen[key] || (out.seen[key] = { n: 0, maxOff: 0, minTop: 9e9, maxBot: 0, minL: 9e9, maxR: 0 });
      s.n++; s.maxOff = Math.max(s.maxOff, Math.abs((L + R) / 2 - 540 - (l.el.id.startsWith('badge') ? (l.el.getBoundingClientRect().left + l.el.getBoundingClientRect().right) / 2 - 540 : 0)));
      s.minTop = Math.min(s.minTop, Tp); s.maxBot = Math.max(s.maxBot, B); s.minL = Math.min(s.minL, L); s.maxR = Math.max(s.maxR, R);
    }
  }
  for (const [k, s] of Object.entries(out.seen)) {
    if (s.maxOff > 4) out.centre.push(`${k}: off-centre by ${s.maxOff.toFixed(1)} px`);
    if (s.minTop < 220 || s.maxBot > 1480 || s.minL < 50 || s.maxR > 1030) out.safe.push(`${k}: outside safe zone (top ${s.minTop.toFixed(0)}, bottom ${s.maxBot.toFixed(0)}, left ${s.minL.toFixed(0)}, right ${s.maxR.toFixed(0)})`);
  }
  out.count = Object.keys(out.seen).length;
  return out;
}, REQUIRED);
console.log('lines checked:', res.count);
console.log('copy:', res.text.length ? res.text.join(' | ') : 'all required text present, nothing else');
console.log('centring:', res.centre.length ? res.centre.join(' | ') : 'all lines within ±4 px');
console.log('safe zone:', res.safe.length ? res.safe.join(' | ') : 'all text inside the Reels safe zone');
console.log('ISSUES', res.text.length + res.centre.length + res.safe.length);
await b.close(); server.close();
