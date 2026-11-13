// ZONA TELEFONA — iPhone 17 Pro × Galaxy S26 Ultra (27 s, 1080×1920)
// Every animation is a deterministic function of time t (seconds). Timings mirror audio.py.
const W = 1080, H = 1920, DURATION = 27;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
const eOutCubic = x => 1 - Math.pow(1 - x, 3);
const eInCubic = x => x * x * x;
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eInOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;
const $ = id => document.getElementById(id);
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ------------------------------------------------------------------ timeline (s)
const T = {
  hook: .08, ipOn: .3, ipTitle: 2.3, ipTitleOut: 7.0, ipOff: 7.55,
  wipe0: 7.5, wipe1: 8.15,
  sA: 8.0, sweepA: 8.55, ssTitle: 8.45, macro: 10.0, sC: 11.5, sD: 13.0, pen0: 13.3, pen1: 14.2, ssTitleOut: 14.3,
  duo: 14.5, duoIn: 15.5, trail0: 15.6, trail1: 17.2, choice: 16.2, lightI: 17.5, lightS: 18.5, recede0: 19.5, recede1: 20.5,
  head: 20.5, logo: 22.0, cta: 23.5, pill: 23.8, shine: 24.6, end0: 26.55, end1: 27.0,
};

// ------------------------------------------------------------------ assets
const IPN = 220; const ipFrames = [];
const ipc = $('ipc').getContext('2d');
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

// ------------------------------------------------------------------ helpers
function set(el, { op = 1, x = 0, y = 0, s = 1, sx = 1, sy = 1, rot = 0, blur = 0, bright = 1, extra = '', mb = null }) {
  el.style.opacity = clamp(op).toFixed(4);
  el.style.visibility = op > .002 ? 'visible' : 'hidden';
  el.style.transform = `${extra} translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${(s * sx).toFixed(4)},${(s * sy).toFixed(4)})`;
  const f = []; if (blur > .05) f.push(`blur(${blur.toFixed(2)}px)`); if (bright !== 1) f.push(`brightness(${bright.toFixed(3)})`); if (mb) f.push(`url(#${mb})`);
  el.style.filter = f.length ? f.join(' ') : 'none';
}
function box(el, l, t, w, h) { el.style.left = l + 'px'; el.style.top = t + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px'; }
function sweep(el, p, a = .55, ang = 115) {
  const s = el.querySelector('.sweep');
  s.style.background = `linear-gradient(${ang}deg, transparent 0%, transparent ${lerp(-30, 100, p) - 12}%, rgba(255,236,220,${a}) ${lerp(-30, 100, p)}%, transparent ${lerp(-30, 100, p) + 12}%, transparent 100%)`;
  s.style.opacity = (p > 0 && p < 1) ? 1 : 0;
}
const shade = (el, v) => { el.querySelector('.shade').style.opacity = clamp(v).toFixed(3); };
function trackIn(el, t, t0, dur = .9, ls0 = .22, ls1 = .02) {
  const p = eOutExpo(prog(t, t0, t0 + dur));
  el.style.letterSpacing = lerp(ls0, ls1, p).toFixed(4) + 'em';
  return { op: clamp(p * 1.6), blur: (1 - p) * 14 };
}
const setMB = (id, px) => $(id + 'b').setAttribute('stdDeviation', `${Math.max(0, px).toFixed(2)} 0`);

// ------------------------------------------------------------------ geometry
const SA = { h: 1250, w: Math.round(1250 * 671 / 1400) }; SA.l = 540 - SA.w / 2; SA.t = 330;
const SC = { h: 1300, w: Math.round(1300 * 603 / 1452) }; SC.l = 540 - SC.w / 2; SC.t = 300;
const SD = { h: 1200, w: Math.round(1200 * 671 / 1400) }; SD.l = 540 - SD.w / 2; SD.t = 290;
const PEN = { len: Math.round(948 * 1200 / 1400), wd: Math.round(47 * 1200 / 1400) };
const DS = { h: 1000, w: Math.round(1000 * 671 / 1400) }, DI = { h: Math.round(1000 * 1288 / 1400), w: Math.round(1000 * 1288 / 1400 * 618 / 1288) };
const FLOOR = 1290, DIcx = 300, DScx = 790;

// ------------------------------------------------------------------ trail (burgundy light ribbon)
const tb = $('trailFront').getContext('2d');
function bez(p0, p1, p2, p3, u) { const v = 1 - u; return [v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]; }
const TR = [[-90, 1505], [330, 1205], [700, 1600], [1170, 1260]];
function drawTrail(p, fade) {
  tb.clearRect(0, 0, W, H); $('trailFront').style.visibility = (p > 0 && fade > 0) ? 'visible' : 'hidden'; if (p <= 0 || fade <= 0) return;
  const N = 140, n = Math.max(2, Math.floor(N * p)), pts = [];
  for (let i = 0; i <= n; i++) pts.push(bez(...TR, i / N));
  const passes = [[46, 'rgba(120,18,42,0.10)'], [22, 'rgba(160,28,58,0.22)'], [9, 'rgba(210,70,95,0.45)'], [2.6, 'rgba(255,232,214,0.95)']];
  tb.lineCap = 'round'; tb.lineJoin = 'round'; tb.globalAlpha = fade;
  for (const [w, c] of passes) {
    tb.strokeStyle = c; tb.lineWidth = w; tb.beginPath(); tb.moveTo(...pts[0]);
    for (const q of pts) tb.lineTo(...q); tb.stroke();
  }
  // tapered tail: fade the oldest part
  const g = tb.createRadialGradient(...pts[pts.length - 1], 0, ...pts[pts.length - 1], 70);
  g.addColorStop(0, 'rgba(255,240,228,.95)'); g.addColorStop(.25, 'rgba(220,90,110,.5)'); g.addColorStop(1, 'rgba(120,18,42,0)');
  if (p < 1) { tb.fillStyle = g; tb.beginPath(); tb.arc(...pts[pts.length - 1], 70, 0, Math.PI * 2); tb.fill(); }
  tb.globalAlpha = 1;
}

// ------------------------------------------------------------------ grain
const gctx = $('grain').getContext('2d');
const grains = [0, 1, 2, 3].map(k => { const d = gctx.createImageData(540, 960); for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * .013 + k * 91.7) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } return d; });

// ------------------------------------------------------------------ logo line reveal
function logoReveal(t, t0) {
  const el = $('logo'), top = el.querySelector('.top'), bot = el.querySelector('.bot'), tx = el.querySelector('.ltxt');
  const h = el._h || (el._h = tx.offsetHeight);
  const pL = eOutExpo(prog(t, t0, t0 + .55)), open = eOutExpo(prog(t, t0 + .45, t0 + 1.25));
  const half = (h / 2 + 34) * open;
  top.style.top = (h / 2 - 1 - half).toFixed(2) + 'px'; bot.style.top = (h / 2 - 1 + half).toFixed(2) + 'px';
  top.style.transform = bot.style.transform = `scaleX(${pL.toFixed(4)})`;
  top.style.opacity = bot.style.opacity = (pL * (1 - .45 * open)).toFixed(3);
  const ins = (50 - 50 * open).toFixed(2); tx.style.clipPath = `inset(${ins}% -10% ${ins}% -10%)`;
  tx.style.transform = `scale(${lerp(1.04, 1, open).toFixed(4)})`;
  const sh = eInOutSine(prog(t, T.shine, T.shine + 1.3));
  el.querySelector('.zona').style.backgroundPosition = `${lerp(100, 0, sh).toFixed(2)}% 0`;
}

// ================================================================== setTime
function setTime(t) {
  // ---------- background light ----------
  let spot = 0, spotY = 200;
  // ---------- HOOK + iPhone (Apple CGI) ----------
  const ipVis = t < T.wipe1;
  const ipEl = $('ipc');
  if (ipVis) {
    const f = clamp(Math.round((t + 1.6 - 2.0) * 30), 0, IPN - 1);
    ipc.drawImage(ipFrames[f], 0, 0);
    const op = clamp(prog(t, T.ipOn, T.ipOn + .45)) * (1 - eInCubic(prog(t, T.ipOff, T.wipe1)));
    set(ipEl, { op, s: lerp(1, 1.03, eInOutSine(prog(t, .3, 7.6))) });
    spot = .3 + .25 * eOutCubic(prog(t, .05, 1.2)) - .2 * prog(t, 7.3, 8.0); spotY = 760;
  } else set(ipEl, { op: 0 });
  // anamorphic streak (hook)
  const sp = prog(t, .04, .55);
  set($('streak'), { op: sp > 0 && t < 1.4 ? Math.min(1, sp * 4) * (1 - prog(t, .55, 1.3)) : 0, sx: lerp(.05, 1.1, eOutExpo(sp)), extra: '' });
  $('streak').style.top = '700px';
  // iPhone title
  { const el = $('tIp'); const a = trackIn(el, t, T.ipTitle, 1.0); set(el, { op: a.op * (1 - prog(t, T.ipTitleOut, T.ipTitleOut + .4)), blur: a.blur }); }
  // transition wipe (light bar)
  { const p = prog(t, T.wipe0, T.wipe1); const el = $('wipe'); el.style.left = lerp(-560, 1120, eInOutCubic(p)).toFixed(1) + 'px'; set(el, { op: p > 0 && p < 1 ? Math.sin(Math.PI * p) * 1.1 : 0 }); }

  // ---------- SAMSUNG ----------
  const sA = $('sA'), mc = $('macro'), sC = $('sC'), sD = $('sD'), pc = $('penClip');
  [sA, mc, sC, sD, pc].forEach(e => set(e, { op: 0 }));
  if (t >= T.sA && t < T.macro) {           // a) back reveal + light sweep
    box(sA, SA.l, SA.t, SA.w, SA.h);
    const e = eOutCubic(prog(t, T.sA, T.sA + 1.0));
    set(sA, { op: e, y: (1 - e) * 70, s: lerp(1, 1.035, prog(t, T.sA, T.macro)), bright: lerp(.35, 1, e) });
    sweep(sA, prog(t, T.sweepA, T.sweepA + 1.1), .5);
    spot = .55;
  }
  if (t >= T.macro && t < T.sC) {           // b) macro on the camera system
    const img = $('macroImg'); const u = eInOutSine(prog(t, T.macro, T.sC));
    const s = lerp(1.5, 1.62, u), cx = 330, cy = lerp(300, 830, u);
    img.style.transform = `translate(${(540 - cx * s).toFixed(1)}px,${(960 - cy * s).toFixed(1)}px) scale(${s.toFixed(4)})`;
    set(mc, { op: 1 }); spot = .4;
  }
  if (t >= T.sC && t < T.sD) {              // c) 30° angle, lateral parallax
    box(sC, SC.l, SC.t, SC.w, SC.h);
    const u = prog(t, T.sC, T.sD);
    set(sC, { op: clamp(prog(t, T.sC, T.sC + .25)), x: lerp(36, -36, eInOutSine(u)), s: lerp(1.02, 1.0, u), extra: `perspective(2400px) rotateY(${lerp(5, -3, eInOutSine(u)).toFixed(3)}deg)` });
    sweep(sC, prog(t, T.sC + .2, T.sC + 1.3), .45, 95);
    spot = .55;
  }
  if (t >= T.sD && t < T.duo + .25) {       // d) front + S Pen ejects from its silo
    box(sD, SD.l, SD.t, SD.w, SD.h);
    const out = prog(t, T.duo - .1, T.duo + .25);
    set(sD, { op: clamp(prog(t, T.sD, T.sD + .25)) * (1 - out), y: lerp(20, 0, eOutCubic(prog(t, T.sD, T.sD + .6))) });
    sweep(sD, prog(t, T.sD + .1, T.sD + 1.0), .35, 120);
    const penX = SD.l + SD.w * .14, bottom = SD.t + SD.h - 6;
    box(pc, Math.round(penX - PEN.wd), Math.round(bottom), PEN.wd * 2, PEN.len + 40);
    const ext = eOutCubic(prog(t, T.pen0, T.pen1)) * .62 * PEN.len;
    const pen = $('pen'); pen.style.width = PEN.wd + 'px'; pen.style.height = PEN.len + 'px';
    pen.style.transform = `translate(${PEN.wd / 2}px,${(ext - PEN.len).toFixed(1)}px) scaleY(-1)`;
    set(pc, { op: clamp(prog(t, T.sD, T.sD + .25)) * (1 - out), y: lerp(20, 0, eOutCubic(prog(t, T.sD, T.sD + .6))) });
    spot = .55;
  }
  // title
  { const el = $('tSs'); const a = trackIn(el, t, T.ssTitle, 1.0); const hide = t >= T.macro && t < T.sC ? 0 : 1; set(el, { op: a.op * hide * (1 - prog(t, T.ssTitleOut, T.ssTitleOut + .3)), blur: a.blur }); }

  // ---------- DUO ----------
  const dI = $('dI'), dS = $('dS');
  if (t >= T.duo) {
    box(dI, DIcx - DI.w / 2, FLOOR - DI.h, DI.w, DI.h); box(dS, DScx - DS.w / 2, FLOOR - DS.h, DS.w, DS.h);
    const ein = prog(t, T.duo, T.duoIn), e = eOutExpo(ein);
    const vel = Math.pow(2, -10 * ein) * (ein > 0 && ein < 1 ? 1 : 0);
    setMB('mbA', vel * 60); setMB('mbB', vel * 60);
    // recede into the background for the CTA
    const r = eInOutCubic(prog(t, T.recede0, T.recede1));
    const gS = lerp(1, .56, r), gY = lerp(0, -420, r), push = 1 + .05 * eInOutSine(prog(t, T.duoIn, T.recede0));
    const k = gS * push;
    const common = (cx, cy) => ({ s: k, x: (cx - 540) * (k - 1), y: (cy - 860) * (k - 1) + gY });
    const lI = t < T.lightS ? 1 : lerp(1, .55, eInOutCubic(prog(t, T.lightS, T.lightS + .6)));
    const lS = t < T.lightI ? 1 : t < T.lightS ? lerp(1, .55, eInOutCubic(prog(t, T.lightI, T.lightI + .5))) : lerp(.55, 1, eInOutCubic(prog(t, T.lightS, T.lightS + .6)));
    const lI2 = t < T.recede0 ? lI : lerp(lI, 1, prog(t, T.recede0, T.recede0 + .4));
    const lS2 = t < T.recede0 ? lS : lerp(lS, 1, prog(t, T.recede0, T.recede0 + .4));
    const bgDim = lerp(1, .26, r), bl = r * 9;
    const cI = common(DIcx, FLOOR - DI.h / 2), cS = common(DScx, FLOOR - DS.h / 2);
    set(dI, { op: clamp(ein * 3) * bgDim, x: lerp(-760, 0, e) + cI.x, y: cI.y, s: cI.s, blur: bl, mb: vel > .02 ? 'mbA' : null });
    set(dS, { op: clamp(ein * 3) * bgDim, x: lerp(760, 0, e) + cS.x, y: cS.y, s: cS.s, blur: bl, mb: vel > .02 ? 'mbB' : null });
    shade(dI, 1 - lI2); shade(dS, 1 - lS2);
    sweep(dI, prog(t, T.lightI, T.lightI + 1.0), .5); sweep(dS, prog(t, T.lightS, T.lightS + 1.0), .45);
    dI.style.transformOrigin = dS.style.transformOrigin = '50% 50%';
    spot = .65 - .3 * r; spotY = lerp(250, -100, r);
    const tp = eInOutCubic(prog(t, T.trail0, T.trail1));
    drawTrail(tp, (1 - prog(t, T.trail1 + .3, T.trail1 + 1.6)) * (1 - r));
    // choice line
    const ch = $('tChoice'); const a = trackIn(ch, t, T.choice, 1.0, .12, 0); set(ch, { op: a.op * (1 - prog(t, T.recede0, T.recede0 + .4)), blur: a.blur });
  } else { set(dI, { op: 0 }); set(dS, { op: 0 }); drawTrail(0, 0); set($('tChoice'), { op: 0 }); }

  // ---------- CTA ----------
  { const el = $('tHead'); const l1 = el.children[0], l2 = el.children[1];
    const p1 = eOutExpo(prog(t, T.head, T.head + .8)), p2 = eOutExpo(prog(t, T.head + .35, T.head + 1.2));
    set(el, { op: t >= T.head ? 1 : 0 });
    l1.style.opacity = clamp(p1 * 1.5); l1.style.transform = `translateY(${((1 - p1) * 30).toFixed(1)}px)`; l1.style.filter = p1 < .99 ? `blur(${((1 - p1) * 10).toFixed(1)}px)` : 'none';
    l2.style.opacity = clamp(p2 * 1.5); l2.style.transform = `scale(${lerp(1.08, 1, p2).toFixed(4)})`; l2.style.filter = p2 < .99 ? `blur(${((1 - p2) * 16).toFixed(1)}px)` : 'none'; }
  { const el = $('logo'); set(el, { op: t >= T.logo ? 1 : 0 }); if (t >= T.logo) logoReveal(t, T.logo); }
  { const el = $('cta'); const p = eOutExpo(prog(t, T.cta, T.cta + .7)); set(el, { op: clamp(p * 1.5), y: (1 - p) * 26, blur: (1 - p) * 8 }); }
  { const el = $('pill'); const p = eOutExpo(prog(t, T.pill, T.pill + .7)); set(el, { op: clamp(p * 1.5), s: lerp(.92, 1, p), extra: 'translateX(-50%)' }); }
  if (t >= T.duo || t < 0) spot = Math.max(spot, t >= T.head ? .5 : spot);

  // ---------- global ----------
  set($('spot'), { op: clamp(spot), y: spotY });
  $('black').style.opacity = (eInCubic(prog(t, T.end0, T.end1))).toFixed(3);
  gctx.putImageData(grains[Math.floor(t * 30) % 4], 0, 0);
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

async function boot() {
  for (const f of ['300 100px Montserrat', '500 100px Montserrat', '600 100px Montserrat', 'italic 400 100px "Cormorant Garamond"', 'italic 500 100px "Cormorant Garamond"']) await document.fonts.load(f, 'ćčšžđ');
  await document.fonts.ready;
  const ps = []; for (let i = 1; i <= IPN; i++) ps.push(loadImg(`assets/ip_${String(i).padStart(4, '0')}.jpg`));
  ipFrames.push(...await Promise.all(ps));
  await Promise.all([...document.images].map(im => im.decode().catch(() => { })));
  window.setTime = setTime; setTime(0); window.READY = true;
}
boot();
