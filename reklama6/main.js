// ZONA TELEFONA — "IPHONE ILI ULTRA?" (24 s, 1080×1920, 30 fps)
// Deterministic: setTime(t) draws the exact frame. All timings mirror audio.py.
const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
const eOutCubic = x => 1 - Math.pow(1 - x, 3);
const eInCubic = x => x * x * x;
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eInOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;
const eOutBack = x => { const c = 1.4, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const pulse = (t, t0, att, dec) => t < t0 - att ? 0 : t < t0 ? Math.pow((t - (t0 - att)) / att, 2) : Math.exp(-(t - t0) / dec);
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const $ = id => document.getElementById(id);

// impacts: [t, strength] (same list in audio.py)
const IMPACTS = [[.12, 1], [.8, 1.25], [2.0, .7], [7.2, 1.4], [12.45, 1.1], [13.0, .5], [14.0, .6], [15.0, .45], [15.5, .45], [16.0, .6], [17.2, .6], [17.45, .9], [18.8, .7]];

// ------------------------------------------------------------------ assets
const A = {}; const IPN = 220; const ipF = [];
const ipCache = new Map();
async function ipFrame(i) {
  if (!ipCache.has(i)) {
    const blob = await (await fetch(`assets/ipf_${String(i + 1).padStart(4, '0')}.jpg`)).blob();
    ipCache.set(i, await createImageBitmap(blob));
    while (ipCache.size > 6) { const k = ipCache.keys().next().value; ipCache.get(k).close(); ipCache.delete(k); }
  }
  return ipCache.get(i);
}
const load = s => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = s; });
async function asset(name, rim = true) { A[name] = { img: await load(`assets/${name}.png`) }; if (rim) { A[name].rimL = await load(`assets/${name}_rimL.png`); A[name].rimR = await load(`assets/${name}_rimR.png`); } }

// keyed Samsung footage (RGBA frames cut from Samsung's official design film)
const svCache = new Map();
async function svFrame(dir, i) {
  const key = dir + i;
  if (!svCache.has(key)) {
    const blob = await (await fetch(`assets/${dir}/${String(i).padStart(4, '0')}.png`)).blob();
    svCache.set(key, await createImageBitmap(blob));
    while (svCache.size > 6) { const k = svCache.keys().next().value; svCache.get(k).close(); svCache.delete(k); }
  }
  return svCache.get(key);
}
const rimC = document.createElement('canvas'), rc = rimC.getContext('2d');
// ------------------------------------------------------------------ product renderer (rim light, sweep, real multi-sample motion blur)
const pc = $('pc').getContext('2d');
const tmp = document.createElement('canvas'), tc = tmp.getContext('2d');
function drawPhone(a, o) {
  const U = o.U ?? .893, w = a.img.width * U, h = a.img.height * U;
  if (tmp.width !== Math.ceil(w) || tmp.height !== Math.ceil(h)) { tmp.width = Math.ceil(w); tmp.height = Math.ceil(h); }
  tc.globalCompositeOperation = 'source-over'; tc.globalAlpha = 1; tc.clearRect(0, 0, tmp.width, tmp.height);
  if (a.sat) tc.filter = `saturate(${a.sat})`;
  tc.drawImage(a.img, 0, 0, w, h); tc.filter = 'none';
  if ((o.bright ?? 1) < 1) { tc.globalCompositeOperation = 'source-atop'; tc.fillStyle = `rgba(6,6,6,${1 - o.bright})`; tc.fillRect(0, 0, w, h); }
  if (o.sweep !== undefined && o.sweep > 0 && o.sweep < 1) {       // warm light band travelling across the glass
    tc.globalCompositeOperation = 'source-atop';
    const ang = (o.sweepAng ?? 110) * Math.PI / 180, L = Math.hypot(w, h), p = lerp(-.35, 1.35, o.sweep);
    const cx = w / 2 + Math.cos(ang) * (p - .5) * L, cy = h / 2 + Math.sin(ang) * (p - .5) * L;
    const g = tc.createLinearGradient(cx - Math.cos(ang) * L * .14, cy - Math.sin(ang) * L * .14, cx + Math.cos(ang) * L * .14, cy + Math.sin(ang) * L * .14);
    const sa = o.sweepA ?? .45;
    g.addColorStop(0, 'rgba(249,115,22,0)'); g.addColorStop(.42, `rgba(249,115,22,${sa * .5})`); g.addColorStop(.5, `rgba(255,232,214,${sa})`); g.addColorStop(.58, `rgba(249,115,22,${sa * .5})`); g.addColorStop(1, 'rgba(249,115,22,0)');
    tc.fillStyle = g; tc.fillRect(0, 0, w, h);
  }
  if (a.dyn && (o.rimL > 0 || o.rimR > 0)) {
    if (rimC.width !== tmp.width || rimC.height !== tmp.height) { rimC.width = tmp.width; rimC.height = tmp.height; }
    for (const [side, amt] of [[1, o.rimL], [-1, o.rimR]]) {
      if (!(amt > 0)) continue;
      rc.globalCompositeOperation = 'source-over'; rc.clearRect(0, 0, rimC.width, rimC.height);
      rc.drawImage(a.img, 0, 0, w, h);
      rc.globalCompositeOperation = 'destination-out'; rc.drawImage(a.img, side * 7, 0, w, h);
      rc.globalCompositeOperation = 'source-in'; rc.fillStyle = '#F97316'; rc.fillRect(0, 0, w, h);
      tc.globalCompositeOperation = 'lighter'; tc.globalAlpha = clamp(amt); tc.filter = 'blur(1.2px)'; tc.drawImage(rimC, 0, 0); tc.filter = 'none'; tc.globalAlpha = clamp(amt) * .8; tc.drawImage(rimC, 0, 0);
    }
    tc.globalAlpha = 1;
  }
  tc.globalCompositeOperation = 'lighter';
  if (o.rimL > 0 && a.rimL) { tc.globalAlpha = clamp(o.rimL); tc.drawImage(a.rimL, 0, 0, w, h); }
  if (o.rimR > 0 && a.rimR) { tc.globalAlpha = clamp(o.rimR); tc.drawImage(a.rimR, 0, 0, w, h); }
  tc.globalAlpha = 1; tc.globalCompositeOperation = 'source-over';
  // composite onto the stage with spill glow + motion blur
  const N = (Math.abs(o.mbx ?? 0) + Math.abs(o.mby ?? 0)) > 2 ? 12 : 1;
  pc.save();
  pc.translate(o.cx, o.cy); pc.rotate((o.rot ?? 0) * Math.PI / 180); pc.scale(o.s ?? 1, o.s ?? 1);
  if (o.glow) { pc.shadowColor = `rgba(249,115,22,${clamp(o.glow) * .75})`; pc.shadowBlur = 60; pc.shadowOffsetX = (o.glowSide ?? 0) * 14; }
  for (let i = 0; i < N; i++) {
    const k = N === 1 ? 0 : i / (N - 1) - .5;
    pc.globalAlpha = (o.alpha ?? 1) * (N === 1 ? 1 : 1.6 / N);
    pc.drawImage(tmp, -w / 2 + k * (o.mbx ?? 0), -h / 2 + k * (o.mby ?? 0), w, h);
    pc.shadowColor = 'transparent';
  }
  pc.restore();
  return { w, h };
}

// ------------------------------------------------------------------ iPhone footage with speed ramp + frame blending
const ipc = $('ipc').getContext('2d');
function ipVT(t) { return t + 1.3; }          // 1:1 real-time playback of Apple's footage (ad 2.0 → footage 3.3)
function drawIP(t, cam) {
  const vt = cam.vt ?? ipVT(t), f0 = clamp(Math.round((vt - 2.0) * 30), 0, IPN - 1), fr = 0;
  const im0 = ipCache.get(f0), im1 = ipCache.get(f0 + 1) || im0;
  const z = cam.z, sw = 1080 / z, sh = 1080 / z, sx = cam.x - sw / 2, sy = cam.y - sh / 2;
  ipc.globalAlpha = 1; ipc.fillStyle = '#000'; ipc.fillRect(0, 0, 1080, 1080);
  const N = Math.abs(cam.mb ?? 0) > 2 ? 10 : 1;
  for (let i = 0; i < N; i++) {
    const k = N === 1 ? 0 : (i / (N - 1) - .5) * (cam.mb ?? 0);
    ipc.globalAlpha = N === 1 ? 1 : 1.5 / N; ipc.globalCompositeOperation = N === 1 ? 'source-over' : 'lighter';
    ipc.drawImage(im0, sx, sy, sw, sh, k + (cam.dx ?? 0), 0, 1080, 1080);
    if (fr > .02 && N === 1) { ipc.globalAlpha = fr; ipc.drawImage(im1, sx, sy, sw, sh, (cam.dx ?? 0), 0, 1080, 1080); }
  }
  // orange light sweep that only lights the product (adds a tinted copy of the bright pixels inside a moving band)
  if (cam.sweep > 0 && cam.sweep < 1) {
    ipc.save(); ipc.globalAlpha = .9; ipc.globalCompositeOperation = 'lighter';
    const p = lerp(-300, 1380, cam.sweep);
    ipc.beginPath(); ipc.moveTo(p - 120, 0); ipc.lineTo(p + 60, 0); ipc.lineTo(p - 240, 1080); ipc.lineTo(p - 420, 1080); ipc.closePath(); ipc.clip();
    ipc.filter = 'sepia(1) saturate(5) hue-rotate(-12deg) brightness(.75)';
    ipc.drawImage(im0, sx, sy, sw, sh, (cam.dx ?? 0), 0, 1080, 1080);
    ipc.restore(); ipc.filter = 'none';
  }
  ipc.globalAlpha = 1; ipc.globalCompositeOperation = 'source-over';
}

// ------------------------------------------------------------------ text helpers
function set(el, { op = 1, x = 0, y = 0, s = 1, sx = 1, sy = 1, rot = 0, blur = 0, extra = '' }) {
  el.style.visibility = op > .002 ? 'visible' : 'hidden';
  el.style.opacity = clamp(op).toFixed(4);
  el.style.transform = `${extra} translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${(s * sx).toFixed(4)},${(s * sy).toFixed(4)})`;
  el.style.filter = blur > .1 ? `blur(${blur.toFixed(1)}px)` : '';
}
function slam(t, t0, dur = .22, s0 = 2.4) { const p = eOutExpo(prog(t, t0, t0 + dur)); return { p, op: clamp(prog(t, t0, t0 + .06)), s: lerp(s0, 1, p), blur: (1 - p) * 18 }; }
function slideX(t, t0, dir, dur = .35) { const p = eOutExpo(prog(t, t0, t0 + dur)); return { op: clamp(prog(t, t0, t0 + .08)), x: dir * (1 - p) * 900, sx: 1 + (1 - p) * .5, blur: (1 - p) * 10 }; }
const outQ = (t, t1, d = .25) => { const p = eInCubic(prog(t, t1, t1 + d)); return { op: 1 - p, s: 1 + p * .3, blur: p * 16 }; };
const mix = (...a) => a.reduce((r, o) => ({ op: (r.op ?? 1) * (o.op ?? 1), x: (r.x ?? 0) + (o.x ?? 0), y: (r.y ?? 0) + (o.y ?? 0), s: (r.s ?? 1) * (o.s ?? 1), sx: (r.sx ?? 1) * (o.sx ?? 1), blur: (r.blur ?? 0) + (o.blur ?? 0) }), {});
function streak(id, t, t0, dur, { y = 960, rot = -14, w = 1, maxOp = 1 } = {}) {
  const el = $(id), p = prog(t, t0, t0 + dur);
  if (p <= 0 || p >= 1) { el.style.opacity = 0; return; }
  el.style.top = y + 'px';
  el.style.opacity = (Math.sin(Math.PI * p) * maxOp).toFixed(3);
  el.style.transform = `translateX(${lerp(-1500, 1500, eInOutCubic(p)).toFixed(1)}px) rotate(${rot}deg) scaleY(${w})`;
}

// grain
const gctx = $('grain').getContext('2d');
const grains = [0, 1, 2, 3].map(k => { const d = gctx.createImageData(540, 960); for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * .013 + k * 91.7) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } return d; });

// ================================================================== setTime
async function setTime(t) {
  if (t >= 1.95 && t < 7.05) await ipFrame(clamp(Math.round((ipVT(t) - 2.0) * 30), 0, IPN - 1));
  if (t >= 12.0 && t < 14.3) await ipFrame(clamp(Math.round((4.9 + (t - 12.0) - 2.0) * 30), 0, IPN - 1));
  if (t >= 7.0 && t < 8.75) await svFrame('sv_rot', 8 + clamp(Math.floor((t - 7.0) * 30), 0, 50));
  if (t >= 9.7 && t < 10.75) await svFrame('sv_mac', 1 + clamp(Math.floor((t - 9.7) * 30), 0, 29));
  if (t >= 12.0 && t < 14.3) await svFrame('sv_rot', 58 - clamp(Math.floor((t - 12.0) * 30), 0, 50));
  for (const el of $('txt').children) el.style.visibility = 'hidden';
  for (const id of ['h1', 'h2', 'h3']) $(id).style.visibility = 'hidden';
  pc.clearRect(0, 0, W, H);
  let glow = 0, glowY = 260, ipOp = 0;

  // ---------------- HOOK 0–2 ----------------
  if (t < 2.05) {
    const hk = $('hook'); set(hk, { op: 1 });
    const h1 = slam(t, .12, .22, 2.6), h2 = slam(t, .5, .2, 1.8), h3 = slam(t, .8, .22, 2.8);
    const push = eInExpo(prog(t, 1.62, 2.0));                    // fast push-in through the type
    set($('h1'), mix(h1, { x: (1 - h1.p) * -120 }));
    set($('h2'), h2);
    set($('h3'), mix(h3, { x: (1 - h3.p) * 120 }));
    set(hk, { op: 1 - push, s: (1 + .025 * prog(t, .8, 1.62)) * lerp(1, 3.2, push), blur: push * 14 });
    streak('st1', t, .0, .26, { y: 900, rot: -16, w: 1.2 });
    streak('st2', t, .66, .24, { y: 1040, rot: 12, w: .9, maxOp: .9 });
    glow = .5 + .4 * pulse(t, .8, .02, .5); glowY = 300;
  }
  // ---------------- iPHONE 17 PRO 2–7 ----------------
  if (t >= 1.95 && t < 7.05) {
    let cam;
    if (t < 3.3) { const u = eOutCubic(prog(t, 1.95, 3.3)); cam = { x: lerp(960, 900, u), y: lerp(560, 470, u), z: lerp(1.0, 1.32, u) }; }   // push into the camera plateau
    else if (t < 5.3) { const u = eInOutSine(prog(t, 3.3, 5.3)); cam = { x: lerp(900, 960, u), y: lerp(470, 540, u), z: lerp(1.32, 1.0, u) }; }               // pull back during the turn
    else { const u = eOutCubic(prog(t, 5.3, 7.0)); cam = { x: 960, y: 540, z: lerp(1.0, 1.08, u) }; }
    const wout = eInCubic(prog(t, 6.72, 7.0));                    // whip pan out (left)
    cam.dx = -wout * 1300; cam.mb = wout * 260;
    cam.sweep = t < 4.0 ? prog(t, 2.25, 3.15) : prog(t, 5.55, 6.45);
    drawIP(t, cam);
    ipOp = clamp(prog(t, 1.95, 2.12));
    const ti = $('tIp'); const a = slideX(t, 2.45, 1, .4);
    set(ti, mix(a, { x: -wout * 1300, blur: wout * 20 }));
    glow = .55; glowY = 300;
  }
  $('ipc').style.opacity = ipOp;

  // ---------------- GALAXY S26 ULTRA 7–12 ----------------
  if (t >= 7.0 && t < 12.05) {
    const exit = eInCubic(prog(t, 11.75, 12.0)), gx = -exit * 1300, gmb = exit * 320;     // phone, pen and title leave together
    if (t < 8.7) {                                               // a) REAL rotation (Samsung design film), lit up by an orange key
      const im = svCache.get('sv_rot' + (8 + clamp(Math.floor((t - 7.0) * 30), 0, 50)));
      const on = eOutCubic(prog(t, 7.0, 7.35));
      drawPhone({ img: im, dyn: true, sat: .55 }, { cx: 540, cy: 960, U: lerp(1.08, 1.16, eInOutSine(prog(t, 7.0, 8.7))), bright: lerp(.15, 1, on),
        rimL: clamp(prog(t, 7.03, 7.15)) * (1 + .6 * pulse(t, 7.1, .02, .35)), rimR: clamp(prog(t, 7.25, 7.5)) * .6, sweep: prog(t, 7.45, 8.35), sweepA: .4, glow: on * .9, glowSide: -1 });
    } else if (t < 9.7) {                                        // b) fast push-in on the camera system (official 4500px still)
      const u = eInOutCubic(prog(t, 8.7, 9.25)), d = eInOutSine(prog(t, 9.25, 9.7));
      const img = A.s26_back_full, C = [img.img.width / 2, img.img.height / 2];
      const s0 = 1250 / img.img.height, sc = lerp(s0, 1.72, u) * (1 + .05 * d);
      const F = [330, lerp(470, 720, d)];
      const F0 = [540 + (F[0] - C[0]) * s0, 960 + (F[1] - C[1]) * s0];
      const Fs = [lerp(F0[0], 540, u), lerp(F0[1], 960, u)];
      drawPhone(img, { cx: Fs[0] - (F[0] - C[0]) * sc, cy: Fs[1] - (F[1] - C[1]) * sc, U: sc, sweep: prog(t, 9.2, 9.65), sweepA: .35, sweepAng: 70, glow: .6, glowSide: -1 });
      const gl = pulse(t, 9.3, .06, .25);
      if (gl > .01) { const gxx = Fs[0] + (240 - F[0]) * sc, gyy = Fs[1] + (470 - F[1]) * sc; const g = pc.createRadialGradient(gxx, gyy, 0, gxx, gyy, 260); g.addColorStop(0, `rgba(255,236,220,${.9 * gl})`); g.addColorStop(.2, `rgba(249,115,22,${.4 * gl})`); g.addColorStop(1, 'rgba(249,115,22,0)'); pc.globalCompositeOperation = 'lighter'; pc.fillStyle = g; pc.fillRect(gxx - 260, gyy - 260, 520, 520); pc.globalCompositeOperation = 'source-over'; }
    } else if (t < 10.7) {                                       // c) REAL close-up rotation (Samsung design film)
      const im = svCache.get('sv_mac' + (1 + clamp(Math.floor((t - 9.7) * 30), 0, 29)));
      const sc = lerp(1.28, 1.36, prog(t, 9.7, 10.7));
      // source phone centre ≈ (915, 540) in the 1920×1080 frame
      drawPhone({ img: im, dyn: true, sat: .55 }, { cx: 540 + (960 - 915) * sc, cy: 900, U: sc, rimL: .9, rimR: .35, glow: .6, glowSide: -1, sweep: prog(t, 9.9, 10.6), sweepA: .3 });
      const fg = pc.createLinearGradient(0, 1300, 0, 1700); fg.addColorStop(0, 'rgba(10,10,10,0)'); fg.addColorStop(1, 'rgba(10,10,10,1)'); pc.fillStyle = fg; pc.fillRect(0, 1300, W, 620);
    } else {                                                     // d) front + S Pen leaving its silo — one rigid group
      const settle = eOutExpo(prog(t, 10.7, 11.1)), U = .893, CX = 540 + gx, CY = 930 + (1 - settle) * 40;
      const pen = A.s26_spen.img, pl = pen.height * U, pw = pen.width * U;
      const pbottom = CY + 1400 * U / 2 - 8, px = CX - 671 * U / 2 + 671 * U * .14;
      const ext = eOutCubic(prog(t, 10.9, 11.45)) * .6 * pl;
      pc.save(); pc.globalAlpha = settle; pc.beginPath(); pc.rect(px - 40 - gmb, pbottom, 80 + gmb * 2, 900); pc.clip();
      const NP = gmb > 2 ? 10 : 1;
      for (let i = 0; i < NP; i++) { const k = NP === 1 ? 0 : (i / (NP - 1) - .5) * gmb; pc.globalAlpha = settle * (NP === 1 ? 1 : 1.6 / NP); pc.save(); pc.translate(px + k, pbottom - pl + ext + pl / 2); pc.scale(1, -1); pc.drawImage(pen, -pw / 2, -pl / 2, pw, pl); pc.restore(); }
      pc.restore();
      drawPhone(A.s26_front, { cx: CX, cy: CY, U, alpha: settle, mbx: gmb, rimL: .8, rimR: .9, glow: .8, glowSide: 1, sweep: prog(t, 10.75, 11.5), sweepAng: 120 });
    }
    const ts = $('tSs'); if (t >= 7.3) { const a = slam(t, 7.3, .25, 1.8); set(ts, mix(a, t >= 8.7 && t < 10.7 ? { op: 0 } : {}, { x: gx, blur: exit * 20 })); }
    glow = .5; glowY = 330;
  }

  // ---------------- DUEL 12–17 ----------------
  if (t >= 12.0 && t < 17.05) {
    const wipeX = lerp(-200, 1280, eInOutCubic(prog(t, 13.85, 14.3)));   // light bar that turns the split into the line-up
    if (t < 14.3) {                                              // split screen: both REAL footages, divided by an orange light blade
      const g = eOutExpo(prog(t, 12.0, 12.3));
      const P = [[700, 0], [380, 1920]];                         // blade from top-right to bottom-left
      const drawSide = (left) => {
        pc.save(); pc.beginPath();
        if (left) { pc.moveTo(0, 0); pc.lineTo(P[0][0], 0); pc.lineTo(P[1][0], 1920); pc.lineTo(0, 1920); }
        else { pc.moveTo(P[0][0], 0); pc.lineTo(W, 0); pc.lineTo(W, 1920); pc.lineTo(P[1][0], 1920); }
        pc.closePath(); pc.clip();
        if (t >= 13.85) { pc.beginPath(); pc.rect(wipeX, 0, W, H); pc.clip(); }
        if (left) {
          const f0 = clamp(Math.round((4.9 + (t - 12.0) - 2.0) * 30), 0, IPN - 1), im = ipCache.get(f0);
          const sc = lerp(1.0, 1.05, prog(t, 12, 14.3)); pc.globalAlpha = g;
          pc.drawImage(im, 300 - 960 * sc, 360 + (1 - g) * 120, 1920 * sc, 1080 * sc);
          const fg = pc.createLinearGradient(0, 1150, 0, 1480); fg.addColorStop(0, 'rgba(10,10,10,0)'); fg.addColorStop(1, 'rgba(10,10,10,1)'); pc.fillStyle = fg; pc.globalAlpha = 1; pc.fillRect(0, 1150, W, 800);
        } else {
          const im = svCache.get('sv_rot' + (58 - clamp(Math.floor((t - 12.0) * 30), 0, 50)));
          drawPhone({ img: im, dyn: true, sat: .55 }, { cx: 800, cy: 1000 - (1 - g) * 120, U: lerp(.98, 1.03, prog(t, 12, 14.3)), alpha: g, rimR: .9, rimL: .3, glow: .7, glowSide: 1 });
        }
        pc.restore();
      };
      drawSide(true); drawSide(false);
      // the blade
      const len = eOutExpo(prog(t, 12.0, 12.25)), pul = Math.max(pulse(t, 13.0, .02, .3), pulse(t, 13.5, .02, .3));
      const mx = (P[0][0] + P[1][0]) / 2, my = 960, dx = (P[1][0] - P[0][0]) / 2 * len, dy = 960 * len;
      pc.save(); pc.globalCompositeOperation = 'lighter'; pc.lineCap = 'round';
      for (const [wd, c] of [[46, 'rgba(196,90,53,.18)'], [18, 'rgba(249,115,22,.45)'], [5, 'rgba(255,190,140,.9)'], [2, 'rgba(255,245,235,1)']]) {
        pc.strokeStyle = c; pc.lineWidth = wd * (1 + pul * .6); pc.globalAlpha = t >= 13.85 ? 1 - prog(t, 13.85, 14.1) : 1;
        pc.beginPath(); pc.moveTo(mx - dx, my - dy); pc.lineTo(mx + dx, my + dy); pc.stroke();
      }
      pc.restore();
    }
    if (t >= 13.85) {                                            // the line-up: both official stills, calm continuous drift
      const k = eInOutSine(prog(t, 14.0, 16.4)), push = eInExpo(prog(t, 16.4, 17.0));
      const hitL = Math.max(pulse(t, 15.0, .02, .3), pulse(t, 16.0, .02, .35)), hitR = Math.max(pulse(t, 15.5, .02, .3), pulse(t, 16.0, .02, .35));
      const zoom = (1 + .07 * k) * (1 + push * .5), U = .77 * zoom;
      pc.save(); if (t < 14.3) { pc.beginPath(); pc.rect(0, 0, wipeX, H); pc.clip(); }
      const yI = 900 + (1284 * .77 - 1400 * .77) / 2 + 30, yS = 900;
      drawPhone(A.ip17_back, { cx: 540 - (245 + 14 * k) * zoom, cy: yI + Math.sin(t * 1.3) * 6, U, rot: -3 + 1.2 * k, rimL: .7 + hitL, rimR: .2, glow: .6 + hitL, glowSide: -1, sweep: prog(t, 15.0, 15.7), sweepA: .4, alpha: 1 - push });
      drawPhone(A.s26_back, { cx: 540 + (245 + 14 * k) * zoom, cy: yS - Math.sin(t * 1.3) * 6, U, rot: 3 - 1.2 * k, rimR: .7 + hitR, rimL: .2, glow: .6 + hitR, glowSide: 1, sweep: prog(t, 15.5, 16.2), sweepA: .4, alpha: 1 - push });
      pc.restore();
      // the travelling light bar itself
      if (t < 14.35) { const bx = wipeX; const g2 = pc.createLinearGradient(bx - 120, 0, bx + 120, 0); g2.addColorStop(0, 'rgba(249,115,22,0)'); g2.addColorStop(.5, 'rgba(255,220,190,.9)'); g2.addColorStop(1, 'rgba(249,115,22,0)'); pc.globalCompositeOperation = 'lighter'; pc.fillStyle = g2; pc.fillRect(bx - 120, 0, 240, H); pc.globalCompositeOperation = 'source-over'; }
    }
    set($('dA'), mix(slam(t, 12.4, .22, 2.2), outQ(t, 16.45)));
    set($('dB'), mix(slam(t, 14.3, .22, 2.4), outQ(t, 16.5)));
    glow = .55; glowY = 330;
  }

  // ---------------- CTA 17–24 ----------------
  if (t >= 17.0) {
    const up = eInOutCubic(prog(t, 18.45, 18.85));
    set($('cA'), mix(slideX(t, 17.2, -1, .35), { op: 1 - up, y: -up * 260, blur: up * 12 }));
    set($('cB'), mix(slam(t, 17.45, .25, 2.6), { op: 1 - up, y: -up * 300, blur: up * 12 }));
    // logo revealed by a travelling orange streak
    const lg = $('logo');
    if (t >= 18.75) {
      const p = eInOutCubic(prog(t, 18.75, 19.25));
      set(lg, { op: 1, s: lerp(1.06, 1, eOutCubic(prog(t, 18.75, 19.6))) });
      lg.style.clipPath = `inset(-20% ${(100 - p * 120).toFixed(2)}% -20% -20%)`;
      streak('st1', t, 18.75, .55, { y: 690, rot: 0, w: 1.6 });
    }
    set($('follow'), slideX(t, 20.0, 1, .4));
    set($('dm'), mix({ op: clamp(prog(t, 20.5, 20.6)), s: lerp(.6, 1, eOutBack(prog(t, 20.5, 20.95))) }, { extra: '' }));
    $('dm').style.transform = `translateX(-50%) scale(${lerp(.6, 1, eOutBack(prog(t, 20.5, 20.95))).toFixed(4)})`;
    // products rise into the bottom of the frame
    const r = eOutCubic(prog(t, 19.4, 20.2));
    if (r > 0) {
      drawPhone(A.ip17_back, { cx: 350, cy: lerp(2500, 1820, r), U: .78, rot: -9, rimL: .9, rimR: .2, glow: .7, glowSide: -1, bright: .9, sweep: prog(t, 21.3, 22.1), sweepA: .35 });
      drawPhone(A.s26_back, { cx: 740, cy: lerp(2550, 1840, r), U: .78, rot: 9, rimR: .9, rimL: .2, glow: .7, glowSide: 1, bright: .9, sweep: prog(t, 21.6, 22.4), sweepA: .35 });
    }
    glow = .55; glowY = lerp(330, 900, prog(t, 18.5, 19.2));
  }

  // ---------------- global ----------------
  let fl = 0, sh = 0;
  for (const [ti, s] of IMPACTS) { fl += s * .22 * pulse(t, ti, .015, .11); sh += s * pulse(t, ti, .01, .14); }
  fl += .8 * pulse(t, 2.0, .12, .18);                            // white-orange flash hides the cut into the footage
  $('flash').style.opacity = Math.min(.85, fl).toFixed(3);
  const sx = Math.sin(t * 97) * sh * 9, sy = Math.cos(t * 83) * sh * 9;
  $('world').style.transform = $('txt').style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
  const g = $('glow'); g.style.opacity = clamp(glow).toFixed(3); g.style.top = glowY + 'px';
  gctx.putImageData(grains[Math.floor(t * 30) % 4], 0, 0);
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

async function boot() {
  for (const f of ['400 100px Anton', '400 100px "Archivo Black"', '400 100px "Bebas Neue"']) await document.fonts.load(f, 'ĆČŠŽĐćčšžđ');
  await document.fonts.ready;
  for (const n of ['s26_back', 's26_bl30', 's26_side', 's26_fl30', 's26_front', 'ip17_back']) await asset(n);
  await asset('s26_spen', false); await asset('s26_back_full', false);
  window.setTime = setTime; await setTime(0); window.READY = true;
}
boot();
