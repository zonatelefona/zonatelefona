// 3D type QA: projects every visible letter of the active shots to screen space and checks centring and the Reels safe zone.
// usage: node tools/qa_text3d.mjs [times...]   (defaults: the settled moment of every line of copy)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const req = createRequire(import.meta.url); let chromium; try { ({ chromium } = req('playwright')); } catch { ({ chromium } = req('/opt/node-tools/node_modules/playwright')); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff': 'font/woff' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(0);
const times = process.argv.slice(2).map(Number);
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json')));
const checks = times.length ? times : [T.spremi + .5, T.spremi + 1.1, T.lock + .4, T.s4out - .05, T.s5 + 2.4, T.s5out - .1, T.akcija + .7, T.uskoro + .6, T.s6out - .05, T.s7 + 1.0, T.end - .02];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1080, height: 1920 } }); pg.on('pageerror', e => console.log('PAGEERROR', e.message));
await pg.goto(`http://localhost:${srv.address().port}/index.html`); await pg.waitForFunction(() => window.READY === true, null, { timeout: 180000 });
let bad = 0;
for (const t of checks) {
  await pg.evaluate(t => window.setTime(t), t); const rows = await pg.evaluate(() => window.__qa());
  for (const r of rows) {
    const off = r.cx - 540, issues = [];
    if (Math.abs(off) > 6) issues.push(`off-centre ${off}px`);
    if (r.x0 < 50 || r.x1 > 1030) issues.push('outside x safe zone');
    if (r.y0 < 220 || r.y1 > 1480) issues.push('outside y safe zone');
    if (issues.length) bad++;
    console.log(`${t.toFixed(2)}s ${r.shot.padEnd(9)} ${r.text.padEnd(14)} x ${r.x0}-${r.x1} (w ${r.x1 - r.x0}) y ${r.y0}-${r.y1}  centre ${off >= 0 ? '+' : ''}${off}px  ${issues.join(', ') || 'OK'}`);
  }
}
console.log(bad ? `${bad} issue(s)` : 'all type centred and inside the safe zone');
await b.close(); srv.close();
