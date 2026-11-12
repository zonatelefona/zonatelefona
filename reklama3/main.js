import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const W = 1080, H = 1920, DURATION = 30;
// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
const eOutCubic = x => 1 - Math.pow(1 - x, 3);
const eInCubic = x => x * x * x;
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eOutBack = x => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const pulse = (t, t0, att, dec) => t < t0 - att ? 0 : t < t0 ? Math.pow((t - (t0 - att)) / att, 2) : Math.exp(-(t - t0) / dec);
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// HITS — identical timestamps are used in audio.py
// real-time hits up to 18 s (scene 4 extended by one bar), logical-time hits after (real = logical + 2)
const HITS_A = [[1.0, 1.2], [3.5, .9], [7.0, .7], [7.75, .7], [8.5, 1.1], [12.7, .8], [13.0, 1.0], [14.0, 1.0], [15.0, 1.2], [16.0, .9], [16.5, 1.0]];
const HITS_B = [[16.0, .6], [16.75, 1.1], [17.5, .8], [19.0, .5], [19.5, .5], [20.0, .6], [21.0, 1.6], [22.0, .6], [22.5, .4]];
const SPARKS_A = [[1.0, 540, 960, .8], [8.5, 540, 1090, 1], [13.0, 540, 705, .55], [14.0, 540, 925, .55], [15.0, 540, 1145, .75], [16.5, 540, 1440, .6]];
const SPARKS_B = [[16.75, 540, 920, .8], [17.5, 540, 1130, .7], [21.0, 540, 840, 1.4]];
const EXT = 2.0;

// ---------- three: wireframe phones + grid ----------
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, .05, 100);
const ORANGE = new THREE.Color(0xff7a1a);

const PW = .715, PH = 1.47, D = .082;
function rr(w, h, r, z, div = 10) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI, false);
  return s.getSpacedPoints(div * 8).map(p => new THREE.Vector3(p.x, p.y, z));
}
function loopSegs(out, pts, ox = 0, oy = 0) { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; out.push(a.x + ox, a.y + oy, a.z, b.x + ox, b.y + oy, b.z); } }
function circle(out, cx, cy, r, z, n = 40) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)); } loopSegs(out, p); }
function phoneWire(layout) {
  const s = [];
  const front = rr(PW - .03, PH - .03, .095, D / 2), back = rr(PW - .03, PH - .03, .095, -D / 2), mid = rr(PW, PH, .105, 0);
  loopSegs(s, front); loopSegs(s, back); loopSegs(s, mid);
  for (let i = 0; i < front.length; i += 8) { const a = front[i], m = mid[i], b = back[i]; s.push(a.x, a.y, a.z, m.x, m.y, m.z, m.x, m.y, m.z, b.x, b.y, b.z); }
  loopSegs(s, rr(PW - .07, PH - .07, .08, D / 2 + .002));
  loopSegs(s, rr(.19, .055, .0275, D / 2 + .003, 3), 0, PH / 2 - .075);
  // side buttons
  [[PW / 2 + .006, .22, .17], [-PW / 2 - .006, .34, .1], [-PW / 2 - .006, .2, .1]].forEach(([x, y, h]) => { s.push(x, y - h / 2, 0, x, y + h / 2, 0); });
  const zb = -D / 2 - .012;
  if (layout === 'A') {
    const cx = PW / 2 - .21, cy = PH / 2 - .21;
    loopSegs(s, rr(.33, .33, .08, zb, 4), cx, cy);
    for (const [x, y] of [[.075, .08], [.075, -.08], [-.08, 0]]) { circle(s, cx + x, cy + y, .066, zb - .015); circle(s, cx + x, cy + y, .042, zb - .02, 28); }
    circle(s, cx - .085, cy + .11, .018, zb - .005, 16);
  } else if (layout === 'B') {
    const x = PW / 2 - .15;
    for (const y of [.52, .335, .15]) { circle(s, x, y, .066, zb); circle(s, x, y, .042, zb - .006, 28); }
    circle(s, x - .13, .52, .018, zb, 16);
  } else {
    loopSegs(s, rr(.52, .34, .12, zb, 4), 0, PH / 2 - .26);
    for (const x of [-.12, .12]) { circle(s, x, PH / 2 - .26, .1, zb - .015); circle(s, x, PH / 2 - .26, .065, zb - .02, 28); }
  }
  const geo = new LineSegmentsGeometry(); geo.setPositions(s);
  const mat = new LineMaterial({ color: 0xff7a1a, linewidth: 2.6, transparent: true, opacity: 1, depthWrite: false, dashed: true, dashSize: 1e4, gapSize: 1e4, blending: THREE.AdditiveBlending });
  mat.resolution.set(W, H);
  const ls = new LineSegments2(geo, mat); ls.computeLineDistances();
  // total length for draw-on
  const ds = geo.attributes.instanceDistanceEnd; let total = 0; for (let i = 0; i < ds.count; i++) total = Math.max(total, ds.getX(i));
  const g = new THREE.Group(); g.add(ls);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(PW - .07, PH - .07), new THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: .05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  fill.position.z = D / 2; g.add(fill);
  g.userData = { mat, total, fill }; scene.add(g); return g;
}
const phones = [phoneWire('A'), phoneWire('B'), phoneWire('C')];
function setPhone(i, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, op = 1, draw = 1 }) {
  const g = phones[i]; g.visible = op > .003; if (!g.visible) return;
  g.position.set(x, y, z); g.rotation.set(rx, ry, rz); g.scale.setScalar(s);
  const u = g.userData; u.mat.opacity = op; u.fill.material.opacity = .05 * op;
  u.mat.dashSize = draw >= 1 ? 1e4 : Math.max(.0001, u.total * draw); u.mat.gapSize = draw >= 1 ? 1e4 : u.total * 2;
}
// grid floor
const GS = .6;
const grid = (() => {
  const pos = [], col = [];
  const fade = (x, z) => clamp(1 - Math.abs(z + 4) / 11) * clamp(1 - Math.abs(x) / 7) * .5;
  for (let x = -7.2; x <= 7.21; x += GS) for (let z = -15; z < 4; z += GS) { pos.push(x, 0, z, x, 0, z + GS); const a = fade(x, z), b = fade(x, z + GS); col.push(a, a * .42, a * .08, b, b * .42, b * .08); }
  for (let z = -15; z <= 4; z += GS) for (let x = -7.2; x < 7.2; x += GS) { pos.push(x, 0, z, x + GS, 0, z); const a = fade(x, z), b = fade(x + GS, z); col.push(a, a * .42, a * .08, b, b * .42, b * .08); }
  const geo = new LineSegmentsGeometry(); geo.setPositions(pos); geo.setColors(col);
  const mat = new LineMaterial({ vertexColors: true, linewidth: 1.6, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  mat.resolution.set(W, H);
  const m = new LineSegments2(geo, mat); scene.add(m); return m;
})();

// ---------- DOM helpers ----------
const $ = id => document.getElementById(id);
const content = $('content');
const show = (el, on = true) => { el.style.visibility = on ? 'visible' : 'hidden'; };
function setMB(n, px) { $('mb' + n + 'b').setAttribute('stdDeviation', `${Math.max(0, px).toFixed(2)} 0`); }
function style(el, { op = 1, x = 0, y = 0, s = 1, sx = 1, sy = 1, blur = 0, ls = null, mb = 0, extra = '' }) {
  el.style.opacity = clamp(op).toFixed(4);
  el.style.transform = `${extra} translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${(s * sx).toFixed(4)},${(s * sy).toFixed(4)})`;
  const f = []; if (blur > .05) f.push(`blur(${blur.toFixed(2)}px)`); if (mb) f.push(`url(#mb${mb})`);
  el.style.filter = f.length ? f.join(' ') : 'none';
  if (ls !== null) el.style.letterSpacing = ls.toFixed(4) + 'em';
}
// blur + tracking + scale in
function blurIn(el, t, t0, dur = .55, o = {}) {
  const p = eOutExpo(prog(t, t0, t0 + dur));
  return { p, op: clamp(p * 1.8), blur: (1 - p) * (o.blur ?? 22), s: lerp(o.s0 ?? 1.18, 1, p), y: (1 - p) * (o.y ?? 0) };
}
function outBlur(t, t1, dur = .3) { const p = eInCubic(prog(t, t1, t1 + dur)); return { op: 1 - p, blur: p * 24, s: 1 + p * .12 }; }
function whip(t, t0, dur, dir, mode) {   // mode 'in' | 'out'  → {x, mb, op, sx}
  const p = mode === 'in' ? eOutExpo(prog(t, t0, t0 + dur)) : eInExpo(prog(t, t0, t0 + dur));
  const k = mode === 'in' ? 1 - p : p;
  const v = mode === 'in' ? Math.pow(2, -10 * prog(t, t0, t0 + dur)) : (p > 0 && p < 1 ? Math.pow(prog(t, t0, t0 + dur), 3) : 0);
  return { x: dir * 900 * k, mbpx: Math.min(90, 160 * v * (p < 1 || mode === 'out' ? 1 : 0)), op: mode === 'in' ? clamp(p * 3) : 1 - clamp((p - .6) / .4), sx: 1 + .35 * v };
}
const merge = (...a) => a.reduce((r, o) => ({ op: (r.op ?? 1) * (o.op ?? 1), x: (r.x ?? 0) + (o.x ?? 0), y: (r.y ?? 0) + (o.y ?? 0), s: (r.s ?? 1) * (o.s ?? 1), blur: (r.blur ?? 0) + (o.blur ?? 0), sx: (r.sx ?? 1) * (o.sx ?? 1), sy: (r.sy ?? 1) * (o.sy ?? 1) }), {});

// slice glitch clones
const GL = {};
function makeGlitch(id, n = 7) {
  const el = $(id); const cl = [];
  for (let i = 0; i < n; i++) { const c = el.cloneNode(true); c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); content.appendChild(c); cl.push(c); }
  GL[id] = cl;
}
function glitch(id, t, t0, dur, mode, base = {}) {
  const el = $(id), cl = GL[id]; const p = prog(t, t0, t0 + dur);
  const k = mode === 'out' ? eInCubic(p) : 1 - eOutExpo(p);
  const fr = Math.floor(t * 30);
  show(el, false);
  let acc = 0; const cuts = cl.map((_, i) => .5 + hash(i * 7.3 + 1) * 1.2); const tot = cuts.reduce((a, b) => a + b);
  cl.forEach((c, i) => {
    show(c, true); c.innerHTML = el.innerHTML;
    const a = acc / tot * 100, b = (acc + cuts[i]) / tot * 100; acc += cuts[i];
    c.style.clipPath = `inset(${a.toFixed(2)}% -20% ${(100 - b).toFixed(2)}% -20%)`;
    const dx = (hash(i * 3.1 + fr * .37) - .5) * 2 * (420 + hash(i) * 380) * k;
    const st = merge(base, { x: dx, op: mode === 'out' ? 1 - clamp((p - .55) / .45) : clamp(p * 4) });
    style(c, { ...st, extra: c.dataset.extra || '' });
  });
}
function hideGlitch(id) { (GL[id] || []).forEach(c => show(c, false)); }

// line reveal block
function lineReveal(id, t, t0, lineDur, openDur, { hold = 1, collapseAt = 1e9, collapseDur = .4, pad = 26 } = {}) {
  const el = $(id), top = el.querySelector('.top'), bot = el.querySelector('.bot'), tx = el.querySelector('.rtxt');
  const h = el._h || (el._h = tx.offsetHeight);
  const pL = eOutExpo(prog(t, t0, t0 + lineDur));
  let open = eOutExpo(prog(t, t0 + lineDur, t0 + lineDur + openDur));
  const c = eInOutCubic(prog(t, collapseAt, collapseAt + collapseDur));
  open *= 1 - c;
  const half = (h / 2 + pad) * open;
  top.style.top = (h / 2 - 2 - half).toFixed(2) + 'px'; bot.style.top = (h / 2 - 2 + half).toFixed(2) + 'px';
  const lw = pL * (1 - eInExpo(prog(t, collapseAt + collapseDur * .6, collapseAt + collapseDur + .25)));
  top.style.transform = bot.style.transform = `scaleX(${lw.toFixed(4)})`;
  top.style.opacity = bot.style.opacity = (1 - .35 * open * hold).toFixed(3);
  const ins = (50 - 50 * open).toFixed(2);
  tx.style.clipPath = `inset(${ins}% -10% ${ins}% -10%)`;
  tx.style.transform = `scale(${lerp(1.08, 1, open).toFixed(4)})`;
  tx.style.filter = open < .98 ? `blur(${((1 - open) * 8).toFixed(1)}px)` : 'none';
  return { pL, open };
}
function typeText(id, t, t0, text, cps = 22) {
  const el = $(id), ty = el.querySelector('.ty'), car = el.querySelector('.caret');
  const n = clamp(Math.floor((t - t0) * cps), 0, text.length);
  ty.textContent = text.slice(0, n);
  const typing = t >= t0 && n < text.length;
  car.style.opacity = typing ? 1 : (Math.floor(t * 2.6) % 2 ? 0 : 1);
  return n;
}
function boxOpen(el, t, t0, dur = .4) { const p = eOutExpo(prog(t, t0, t0 + dur)); return { op: clamp(p * 2), sx: lerp(.05, 1, p), sy: lerp(.6, 1, p) }; }

// ---------- 2D FX canvas: sparks + grain ----------
const fx = $('fx').getContext('2d');
const grains = [0, 1, 2, 3].map(k => { const c = document.createElement('canvas'); c.width = 540; c.height = 960; const x = c.getContext('2d'); const d = x.createImageData(540, 960); for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * .013 + k * 91.7) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; });
function drawFX(tr) {
  const SPARKS = tr < 18 ? SPARKS_A : SPARKS_B; const ts = tr < 18 ? tr : tr - EXT; const t = tr;
  fx.clearRect(0, 0, W, H);
  fx.globalCompositeOperation = 'lighter';
  for (const [t0, cx, cy, s] of SPARKS) {
    const dt = ts - t0; if (dt < 0 || dt > 1.6) continue;
    const n = Math.round(150 * s);
    for (let i = 0; i < n; i++) {
      const a = hash(i * 1.7 + t0) * Math.PI * 2, sp = (300 + hash(i * 2.9 + t0) * 1100) * s;
      const k = (1 - Math.exp(-dt * 3.2)) / 3.2;
      const x = cx + Math.cos(a) * sp * k * 1.25, y = cy + Math.sin(a) * sp * k * .7 + 260 * dt * dt;
      const vx = Math.cos(a) * sp * Math.exp(-dt * 3.2) * 1.25, vy = Math.sin(a) * sp * Math.exp(-dt * 3.2) * .7 + 520 * dt;
      const life = 1 - dt / (0.6 + hash(i * 5.3) * 1.0); if (life <= 0) continue;
      fx.strokeStyle = `rgba(255,${Math.round(140 + 90 * life)},${Math.round(60 * life)},${(life * .9).toFixed(3)})`;
      fx.lineWidth = 1.5 + hash(i) * 2.2;
      fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x - vx * .022, y - vy * .022); fx.stroke();
    }
  }
  fx.globalCompositeOperation = 'overlay'; fx.globalAlpha = .06;
  fx.drawImage(grains[Math.floor(t * 30) % 4], 0, 0, W, H);
  fx.globalAlpha = 1; fx.globalCompositeOperation = 'source-over';
}

// ---------- curve panel ----------
{
  let d = ''; for (let i = 0; i <= 60; i++) { const u = i / 60; d += (i ? 'L' : 'M') + (10 + u * 280).toFixed(1) + ',' + (130 - eInOutCubic(u) * 120).toFixed(1); } $('cpath').setAttribute('d', d);
}
const pad4 = v => String(Math.round(Math.abs(v))).padStart(4, '0');

// ================= TIMELINE =================
function setTime(t) {
  const tr = t; const inS4 = tr >= 11 && tr < 18; if (tr >= 18) t = tr - EXT;
  for (const el of content.children) show(el, false);
  for (const id of ['b1', 'b2', 'b3', 'c1', 'c2', 'k1', 'k2', 'k3']) show($(id), false);
  phones.forEach(p => p.visible = false); grid.visible = false;
  let glow = 0, glowY = 960, glowS = 1, glowB = 0, shakeAmt = 0, kadar = 1, hudOp = clamp(t / .4) * (1 - prog(t, 26.6, 27.0));
  let camPos = [0, .9, 8.4], camT = [0, -.15, 0];

  // ===== S1 0–3 : IMAŠ / TELEFON? =====
  if (t < 3.0) {
    kadar = 1;
    const s1 = $('s1');
    if (t < 2.45) { show(s1); const r = lineReveal('s1', t, .15, .8, .4); style(s1, { s: 1 + .03 * prog(t, 1.0, 2.45) }); glow = r.pL * .7 + .5 * r.open; }
    else { lineReveal('s1', t, .15, .8, .4); glitch('s1', t, 2.45, .4, 'out', { s: 1.03 }); glow = 1 - prog(t, 2.45, 2.9); }
    glowY = 960; glowS = .6 + .5 * eOutExpo(prog(t, .15, 1.2));
  }
  // ===== S2 3–7 : wireframe phone + KUPUJEMO! =====
  else if (t < 7.0) {
    kadar = 2;
    grid.visible = true; grid.material.opacity = clamp(prog(t, 3.0, 3.5)) * (1 - prog(t, 6.6, 7.0));
    grid.position.set(0, -1.15, (t * .9) % GS);
    const d = eOutCubic(prog(t, 3.0, 3.9));
    const out = eInExpo(prog(t, 6.5, 6.95));
    setPhone(0, { x: 0, y: -.05 + .05 * Math.sin(t * 1.6), z: 0, rx: .25 * Math.sin(t * .9) + .15, ry: t * 1.05 + out * 5, rz: .12 * Math.sin(t * .7), s: lerp(.7, 1, d) * (1 - out * .6), op: 1 - out, draw: d });
    camPos = [Math.sin(t * .3) * .6, .95, lerp(9.2, 8.4, eOutCubic(prog(t, 3, 7)))];
    // headline
    const hd = $('s2t'); show(hd);
    let st = blurIn(hd, t, 3.5, .6, { s0: 1.25, blur: 26 });
    hd.style.letterSpacing = lerp(.22, -.01, st.p).toFixed(4) + 'em';
    const w = whip(t, 6.45, .45, -1, 'out'); setMB(1, w.mbpx);
    style(hd, { ...merge(st, { x: w.x, op: w.op, sx: w.sx }), mb: 1 });
    // prompt
    const pr = $('s2m'); if (t > 4.2) { show(pr); typeText('s2m', t, 4.45, 'otkup polovnih telefona', 24); const b = boxOpen(pr, t, 4.2); const w2 = whip(t, 6.5, .45, 1, 'out'); setMB(2, w2.mbpx); style(pr, { ...merge(b, { x: w2.x, op: w2.op }), mb: 2 }); }
    // panels
    const pp = phones[0];
    for (const [id, t0] of [['panel', 4.0], ['curve', 4.15], ['s2lbl', 4.3]]) { const el = $(id); show(el); const b = blurIn(el, t, t0, .5, { s0: 1.05, blur: 12, y: 20 }); style(el, merge(b, outBlur(t, 6.45, .3))); }
    $('pX').textContent = pad4(540 + pp.position.x * 1000) + ' px'; $('pY').textContent = pad4(960 - pp.position.y * 1000) + ' px';
    $('pZ').textContent = (pp.position.z < 0 ? '-' : '') + pad4(pp.position.z * 1000 - 120 * Math.sin(t)) + ' px';
    $('pRX').textContent = String(Math.round(((pp.rotation.x * 57.3) % 360 + 360) % 360)).padStart(3, '0') + '°';
    $('pRY').textContent = String(Math.round(((pp.rotation.y * 57.3) % 360 + 360) % 360)).padStart(3, '0') + '°';
    const u = ((t - 3.5) % 1.5) / 1.5; $('cdot').setAttribute('cx', (10 + u * 280).toFixed(1)); $('cdot').setAttribute('cy', (130 - eInOutCubic(u) * 120).toFixed(1));
    glow = clamp(prog(t, 3.0, 3.6)) * .8 * (1 - prog(t, 6.5, 7)); glowY = 1050; glowS = 1.1;
  }
  // ===== S3 7–11 : PRODAJ. / ZAMENI. / KUPI. =====
  else if (t < 11.0) {
    kadar = 3;
    const s3 = $('s3'); show(s3);
    const ws = [['w1', 7.0], ['w2', 7.75], ['w3', 8.5]];
    ws.forEach(([id, t0], i) => {
      const el = $(id); const p = eOutExpo(prog(t, t0, t0 + .5));
      const bb = i === 2 ? eOutBack(prog(t, t0, t0 + .6)) : p;
      style(el, { op: clamp(p * 2), y: (1 - p) * 220, blur: (1 - p) * 16, s: i === 2 ? lerp(1.35, 1, bb) : lerp(1.08, 1, p) });
    });
    const w = whip(t, 10.4, .45, 1, 'out'); setMB(3, w.mbpx);
    style(s3, { x: w.x, op: w.op, sx: w.sx, s: 1 + .025 * prog(t, 7, 10.4), mb: 3 });
    glow = .5 + .25 * prog(t, 7, 8.5) + .5 * pulse(t, 8.5, .02, .6); glow *= 1 - prog(t, 10.45, 10.85); glowY = 1100; glowS = 1.2;
  }
  // ===== S4 11–18 (real time) : prompt → boxes (impact) → BRZA PROCENA. FER CENA. =====
  else if (inS4) {
    kadar = 4;
    const gOut = outBlur(t, 17.5, .35);
    const pr = $('s4p'); show(pr); typeText('s4p', t, 11.3, 'Koliko vredi moj telefon?', 21);
    const pc = t > 12.65 ? .35 * pulse(t, 12.7, .02, .25) : 0;
    style(pr, merge(boxOpen(pr, t, 11.0, .45), gOut, { s: 1 + pc * .1 }));
    pr.style.borderColor = t > 12.7 ? 'rgba(255,122,26,.95)' : '';
    if (t > 12.7 && t < 13.5) { const r = $('ring'); show(r); const e = eOutCubic(prog(t, 12.7, 13.4)); const dd = lerp(40, 1100, e); r.style.width = r.style.height = dd.toFixed(1) + 'px'; r.style.left = (540 - dd / 2).toFixed(1) + 'px'; r.style.top = (476 - dd / 2).toFixed(1) + 'px'; r.style.opacity = ((1 - e) * 1.2).toFixed(3); r.style.borderWidth = lerp(7, 1.5, e).toFixed(2) + 'px'; }
    // boxes: SLAM in (scale-down + blur + orange flash fill + shock outline)
    const bx = $('boxes'); show(bx);
    [['b1', 'k1', 13.0], ['b2', 'k2', 14.0], ['b3', 'k3', 15.0]].forEach(([id, kid, t0], i) => {
      const el = $(id), k = $(kid); const on = t >= t0; el.style.visibility = on ? 'visible' : 'hidden'; if (!on) return;
      const p = eOutExpo(prog(t, t0, t0 + .32));
      const fl = pulse(t, t0 + .03, .02, .22);
      style(el, { op: clamp(p * 4), s: lerp(1.7, 1, p), blur: (1 - p) * 16 });
      el.style.backgroundColor = `rgba(${Math.round(lerp(14, 255, fl * .8))},${Math.round(lerp(9, 110, fl * .8))},${Math.round(lerp(5, 20, fl * .8))},${(.6 + .3 * fl).toFixed(3)})`;
      el.style.borderColor = fl > .02 || i === 2 ? 'rgba(255,122,26,1)' : '';
      el.style.boxShadow = `0 0 ${Math.round(20 + 90 * fl)}px rgba(255,100,0,${(.15 + .7 * fl).toFixed(3)})${i === 2 ? ',inset 0 0 30px rgba(255,100,0,.12)' : ''}`;
      const ke = eOutCubic(prog(t, t0 + .02, t0 + .6));
      if (ke < 1) { k.style.visibility = 'visible'; style(k, { s: lerp(1, 1.5, ke), sy: lerp(1, 1.5, ke), op: (1 - ke) * 1.2 }); }
    });
    [['c1', 13.5], ['c2', 14.5]].forEach(([id, t0]) => { const el = $(id); el.style.visibility = t >= t0 ? 'visible' : 'hidden'; el.style.transform = `scaleY(${eOutCubic(prog(t, t0, t0 + .45)).toFixed(3)})`; });
    style(bx, gOut);
    // headline: slower, each line slams separately
    const hh = $('s4h');
    if (t < 17.5) {
      show(hh); hideGlitch('s4h');
      const a = blurIn(hh, t, 16.0, .8, { s0: 1.35, blur: 26 }); style(hh, { op: a.op, blur: a.blur, s: 1 + .02 * prog(t, 16.8, 17.5) });
      hh.children[0].style.transform = `scale(${lerp(1.35, 1, a.p).toFixed(4)})`; hh.children[0].style.letterSpacing = lerp(.12, -.01, a.p).toFixed(4) + 'em';
      const p2 = eOutExpo(prog(t, 16.5, 16.85));
      const f2 = hh.children[1]; f2.style.opacity = clamp(p2 * 3).toFixed(3); f2.style.transform = `scale(${lerp(1.6, 1, p2).toFixed(4)})`;
    } else glitch('s4h', t, 17.5, .4, 'out');
    glow = .45 * clamp(prog(t, 11, 11.5)) + .4 * pulse(t, 12.7, .02, .5) + .35 * clamp(prog(t, 16.0, 16.4)); glow *= 1 - prog(t, 17.5, 17.9);
    glowY = t < 13 ? 470 : t < 16 ? 900 : 1350; glowS = t < 13 ? .9 : t < 16 ? 1.1 : 1.1;
  }
  // ===== S5 16–21 : TVOJ SLEDEĆI / TELEFON / JE OVDE.  → SVI BRENDOVI =====
  else if (t < 21.0) {
    kadar = 5;
    if (t < 18.85) {
      ['s5a', 's5b', 's5c'].forEach(id => hideGlitch(id));
      const a = $('s5a'); show(a); const w = whip(t, 16.0, .5, 1, 'in'); setMB(1, w.mbpx); style(a, { x: w.x, op: w.op, sx: w.sx, mb: 1 });
      const b = $('s5b'); if (t > 16.74) { show(b); const p = eOutExpo(prog(t, 16.75, 17.15)); style(b, { op: clamp(p * 3), s: lerp(1.9, 1, p) * (1 + .02 * prog(t, 17.1, 18.85)), blur: (1 - p) * 30 }); }
      const c = $('s5c'); if (t > 17.49) { show(c); const p = eOutBack(prog(t, 17.5, 17.95)); style(c, { op: clamp(prog(t, 17.5, 17.65)), y: (1 - clamp(p)) * 120, blur: (1 - clamp(p)) * 14 }); }
      glow = .5 + .5 * pulse(t, 16.75, .02, .5) + .3 * prog(t, 17.5, 17.8); glowY = 1000; glowS = 1.3;
    } else {
      if (t < 19.3) { glitch('s5a', t, 18.85, .4, 'out'); glitch('s5b', t, 18.88, .4, 'out'); glitch('s5c', t, 18.9, .4, 'out'); }
      // three brands on grid
      const build = eInCubic(prog(t, 20.3, 20.95));
      grid.visible = true; grid.material.opacity = clamp(prog(t, 18.9, 19.3)) * (1 - prog(t, 20.6, 20.95)); grid.position.set(0, -1.15, (t * (.9 + build * 8)) % GS);
      const col = eInOutCubic(prog(t, 20.6, 20.97));
      [[0, 19.0, -1.08], [1, 19.5, 0], [2, 20.0, 1.08]].forEach(([i, t0, x]) => {
        if (t < t0) return; const e = eOutExpo(prog(t, t0, t0 + .5));
        setPhone(i, { x: lerp(x * 2.2, x, e) * (1 - col), y: .05 * Math.sin(t * 1.5 + i) + lerp(-1.2, 0, e), z: 0, rx: .2 + .1 * Math.sin(t + i), ry: t * (1.2 + build * 9) + i * 1.3, s: .7 * (1 - col * .9), op: 1 - col, draw: eOutCubic(prog(t, t0, t0 + .7)) });
      });
      camPos = [0, 1.0, 8.6]; camT = [0, -.1, 0];
      const tt = $('s5t'); show(tt); style(tt, merge(blurIn(tt, t, 19.15, .55, { s0: 1.2 }), { op: 1 - prog(t, 20.55, 20.85), sy: 1 - col }));
      [['lab1', 19.15, -1.08], ['lab2', 19.65, 0], ['lab3', 20.15, 1.08]].forEach(([id, t0, x]) => {
        const el = $(id); if (t < t0) return; show(el);
        const v = new THREE.Vector3(x, -1.0, 0).project(camera); el.style.left = ((v.x * .5 + .5) * W).toFixed(1) + 'px'; el.style.top = ((-v.y * .5 + .5) * H).toFixed(1) + 'px';
        style(el, { op: clamp(prog(t, t0, t0 + .3)) * (1 - prog(t, 20.5, 20.8)), y: (1 - eOutExpo(prog(t, t0, t0 + .4))) * 20 });
      });
      glow = .55 + build * .9; glowY = 1050; glowS = 1.2 + build * .4; glowB = build;
    }
  }
  // ===== S6 21–28 : ZONA TELEFONA =====
  else {
    kadar = 6;
    const s6 = $('s6'); show(s6);
    const r = lineReveal('s6', t, 20.75, .25, .45, { collapseAt: 26.8, collapseDur: .45, pad: 34 });
    style(s6, { s: 1 + .03 * eOutCubic(prog(t, 21, 26.8)) });
    const coll = eInOutCubic(prog(t, 26.75, 27.1));
    const a = $('s6a'); if (t > 21.95) { show(a); style(a, merge(blurIn(a, t, 22.0, .55, { s0: 1.25, blur: 20 }), { op: 1 - coll, sy: 1 - coll })); a.style.letterSpacing = lerp(.25, .0, eOutExpo(prog(t, 22, 22.6))).toFixed(3) + 'em'; }
    const b = $('s6b'); if (t > 22.45) { show(b); style(b, merge(blurIn(b, t, 22.5, .5, { s0: 1.0, blur: 10, y: 20 }), { op: 1 - coll })); }
    const p = $('s6p'); if (t > 23.15) { show(p); typeText('s6p', t, 23.5, 'zaprati: @zona.telefona', 22); style(p, merge(boxOpen(p, t, 23.2, .45), { op: 1 - coll, sy: 1 - coll })); }
    // end dot
    if (t > 27.0) { const dt = $('dot'); show(dt); const e = eOutExpo(prog(t, 27.0, 27.3)); style(dt, { op: e * (1 - prog(t, 27.5, 28)), s: lerp(.2, 1.4, e) * (1 - .5 * prog(t, 27.5, 28)) }); }
    glow = 1.2 * r.open + .5 * pulse(t, 21.0, .02, .8); glow *= 1 - prog(t, 26.9, 27.4); glow += .6 * pulse(t, 27.15, .05, .4);
    glowY = 820; glowS = 1.25 - .6 * prog(t, 26.8, 27.3);
  }

  // ---- hits: flash / shake / glow pulse ----
  let flash = 0;
  for (const [ti, s] of (tr < 18 ? HITS_A : HITS_B)) { flash += s * .16 * pulse(t, ti, .012, .12); shakeAmt += s * pulse(t, ti, .01, .16); glowB += s * .35 * pulse(t, ti, .01, .35); }
  flash += .55 * pulse(t, 20.98, .06, .3);
  $('flash').style.opacity = Math.min(.8, flash).toFixed(3);
  const sh = shakeAmt * 9;
  content.style.transform = `translate(${(Math.sin(t * 97) * sh).toFixed(2)}px,${(Math.cos(t * 83) * sh).toFixed(2)}px)`;
  const gA = $('glowA'), gB = $('glowB');
  gA.style.opacity = clamp(glow).toFixed(3); gA.style.top = glowY + 'px'; gA.style.transform = `scale(${glowS.toFixed(3)},${(glowS * .9).toFixed(3)})`;
  gB.style.opacity = clamp(glowB * .8).toFixed(3); gB.style.top = glowY + 'px'; gB.style.transform = `scale(${(glowS * .55).toFixed(3)},${(glowS * .35).toFixed(3)})`;
  // HUD
  $('hud').style.opacity = hudOp.toFixed(3);
  const fr = Math.floor(tr * 30); $('hudT').textContent = `00:00:${String(Math.floor(tr)).padStart(2, '0')}:${String(fr % 30).padStart(2, '0')}`;
  $('hudB').textContent = `KADAR 0${kadar} / 06`;
  // three
  camera.position.set(...camPos); camera.lookAt(...camT);
  renderer.render(scene, camera);
  drawFX(tr);
}

async function boot() {
  for (const f of ['900 100px Montserrat', '800 100px Montserrat', '400 40px "JetBrains Mono"', '700 40px "JetBrains Mono"']) await document.fonts.load(f, 'AŠĆČšćčđž›•·×');
  await document.fonts.ready;
  for (const id of ['s1', 's4h', 's5a', 's5b', 's5c']) makeGlitch(id);
  for (const tw of [1.5, 5, 8.6, 14.6, 17.6, 19.8, 23]) setTime(tw);
  window.setTime = setTime; window.READY = true;
}
boot();
