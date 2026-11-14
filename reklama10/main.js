// ZONA TELEFONA — „POV: UŠAO SI SAMO DA POGLEDAŠ…“  (1080×1920, rendered at 60 fps → 30 fps with motion blur)
// Real product material only: Apple Newsroom footage/stills (iPhone 17 Pro, iPhone Air) and Samsung press stills (Galaxy S26 Ultra).
// Canvas2D = footage plates, studio light, depth of field; Three.js = 3D iPhone (front/back/titanium edge) + product cards with reflections;
// GSAP = typography. Deterministic: setTime(t) draws exactly the frame at time t.
import * as THREE from 'three';
import { gsap } from 'gsap';
import T from './timeline.json' with { type: 'json' };

const W = 1080, H = 1920, CX = 540, CY = 960;
const OR = '#D97757', WHITE = '#F5F3F0';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eOutCubic = x => 1 - Math.pow(1 - x, 3), eInCubic = x => x * x * x;
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eInOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInOutExpo = x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
const spring = (t, f = 2.0, z = .55) => { if (t <= 0) return 0; const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t)); };
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const noise1 = t => Math.sin(t * 1.3) * .6 + Math.sin(t * 2.7 + 1.3) * .3 + Math.sin(t * 5.1 + 2.1) * .1;   // smooth "handheld" drift
const $ = id => document.getElementById(id);
const load = s => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = s; });

// ================================================================== footage (pre-extracted JPEG frames, lazily decoded)
class Seq {
  constructor(dir, n, fps = 30000 / 1001) { this.dir = dir; this.n = n; this.fps = fps; this.cache = new Map(); }
  get(src) {
    const i = clamp(Math.round(src * this.fps) + 1, 1, this.n);
    if (!this.cache.has(i)) this.cache.set(i, fetch(`${this.dir}/${String(i).padStart(4, '0')}.jpg`).then(r => r.blob()).then(b => createImageBitmap(b)));
    for (const k of this.cache.keys()) if (Math.abs(k - i) > 8) { this.cache.get(k).then(b => b.close()); this.cache.delete(k); }
    return this.cache.get(i);
  }
}
const PL = new Seq('assets/pl', 360), AP = new Seq('assets/ap', 110);

// ================================================================== Canvas2D layers
const bg = $('bgc').getContext('2d'), fg = $('fgc').getContext('2d');
let IMG = {};
function studio(c = bg, k = 1, top = '#141416', bot = '#060607') {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(.55, '#0C0C0E'); g.addColorStop(1, bot);
  c.globalAlpha = k; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
}
function pool(c, x, y, rx, ry, col, a) {        // soft light pool / glow
  if (a <= 0) return; c.save(); c.translate(x, y); c.scale(1, ry / rx);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = a; c.fillStyle = g; c.fillRect(-rx, -rx, 2 * rx, 2 * rx); c.restore(); c.globalAlpha = 1;
}
// draw a footage/still plate: source point (ax,ay) lands on screen (sx,sy) at scale s; optional depth-of-field blur, horizontal smear (whip)
function plate(c, img, ax, ay, s, { sx = CX, sy = CY, blur = 0, alpha = 1, smear = 0, feather = 260 } = {}) {
  if (!img || alpha <= 0) return;
  const w = img.width * s, h = img.height * s, x = sx - ax * s, y = sy - ay * s;
  c.save(); c.globalAlpha = alpha; if (blur > .3) c.filter = `blur(${blur.toFixed(1)}px)`;
  if (Math.abs(smear) > 1) { const n = 7; c.globalAlpha = alpha / n * 1.6; for (let i = 0; i < n; i++) c.drawImage(img, x + smear * (i / (n - 1) - .5), y, w, h); }
  else c.drawImage(img, x, y, w, h);
  c.restore();
  // feather the plate's top/bottom edges into the black stage
  if (feather) {
    for (const [y0, y1] of [[y, y + feather], [y + h, y + h - feather]]) {
      const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(6,6,7,1)'); g.addColorStop(1, 'rgba(6,6,7,0)');
      c.fillStyle = g; c.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
    }
    c.fillStyle = '#060607'; if (y > 0) c.fillRect(0, 0, W, y + 1); if (y + h < H) c.fillRect(0, y + h - 1, W, H - y - h + 1);
  }
}
function sweep(c, t0, t1, t, a = .22, width = 260, angle = -.35) {   // soft specular band crossing the frame
  const p = prog(t, t0, t1); if (p <= 0 || p >= 1) return;
  const x = lerp(-W * .6, W * 1.6, eInOutSine(p)); c.save(); c.globalCompositeOperation = 'lighter'; c.translate(x, CY); c.rotate(angle);
  const g = c.createLinearGradient(-width, 0, width, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,248,240,${a * Math.sin(Math.PI * p)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(-width, -H, width * 2, H * 2); c.restore();
}
function zoneMark(c, x, y, r, a, t) {           // brand mark: dot + two thin orange rings (accent only)
  if (a <= 0) return; c.save(); c.globalAlpha = a; c.strokeStyle = OR; c.fillStyle = OR;
  c.lineWidth = 3; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  c.globalAlpha = a * .55; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r * 1.55, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(t)); c.stroke();
  c.globalAlpha = a; c.beginPath(); c.arc(x, y, r * .28, 0, Math.PI * 2); c.fill(); c.restore();
}

// ================================================================== Three.js (pixel-unit world: 1 unit = 1 px at z = 0)
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const FOV = 30, CAMZ = CY / Math.tan(FOV / 2 * Math.PI / 180);
const camera = new THREE.PerspectiveCamera(FOV, W / H, 20, 40000); camera.position.set(0, 0, CAMZ); camera.lookAt(0, 0, 0);
const sx = px => px - CX, sy = py => CY - py;
function texOf(src) { const t = new THREE.Texture(src); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; return t; }
const PH_VS = `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
function phoneMat(tex) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    uniforms: { map: { value: tex }, uA: { value: 1 }, uSweep: { value: -2 }, uSweepA: { value: 0 }, uRefl: { value: 0 }, uFloor: { value: -9999 }, uDim: { value: 0 } },
    vertexShader: PH_VS,
    fragmentShader: `uniform sampler2D map; uniform float uA,uSweep,uSweepA,uRefl,uFloor,uDim; varying vec2 vUv; varying vec3 vW;
      void main(){ vec4 c=texture2D(map,vUv); if(c.a<.03) discard;
        float d=(vUv.x*.62+vUv.y*.38)-uSweep; c.rgb+=exp(-d*d/.0025)*uSweepA*vec3(1.,.97,.93)*.45*c.a;
        c.rgb*=1.-uDim; float a=c.a*uA; if(uRefl>.5) a*=.16*smoothstep(uFloor-520.,uFloor,vW.y);
        gl_FragColor=vec4(c.rgb,a);
        #include <colorspace_fragment>
      }`
  });
}
class Phone {   // iPhone 17 Pro: front + back cut-outs + extruded edge (real thickness when it turns)
  constructor(frontTex, backTex) {
    this.g = new THREE.Group(); scene.add(this.g);
    const fw = 825 / 1700, bw = 887 / 1850, D = .052;
    this.front = new THREE.Mesh(new THREE.PlaneGeometry(fw, 1), phoneMat(frontTex)); this.front.position.z = D / 2 + .001;
    this.back = new THREE.Mesh(new THREE.PlaneGeometry(bw, 1), phoneMat(backTex)); this.back.position.z = -D / 2 - .001; this.back.rotation.y = Math.PI;
    const ew = .468, eh = .976, r = .088, s = new THREE.Shape();
    s.moveTo(-ew / 2 + r, -eh / 2); s.lineTo(ew / 2 - r, -eh / 2); s.quadraticCurveTo(ew / 2, -eh / 2, ew / 2, -eh / 2 + r);
    s.lineTo(ew / 2, eh / 2 - r); s.quadraticCurveTo(ew / 2, eh / 2, ew / 2 - r, eh / 2); s.lineTo(-ew / 2 + r, eh / 2);
    s.quadraticCurveTo(-ew / 2, eh / 2, -ew / 2, eh / 2 - r); s.lineTo(-ew / 2, -eh / 2 + r); s.quadraticCurveTo(-ew / 2, -eh / 2, -ew / 2 + r, -eh / 2);
    const eg = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: false, curveSegments: 20 }); eg.translate(0, 0, -D / 2);
    this.edgeMat = new THREE.ShaderMaterial({
      uniforms: { uA: { value: 1 }, uRefl: { value: 0 }, uFloor: { value: -9999 }, uCol: { value: new THREE.Color(.5, .5, .51) } }, transparent: true,
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(normalMatrix*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vW; uniform float uA,uRefl,uFloor; uniform vec3 uCol;
        void main(){ vec3 n=normalize(vN); float l=.30+.70*max(dot(n,normalize(vec3(-.5,.65,.55))),0.);
          float s=pow(max(dot(n,normalize(vec3(.55,.25,.8))),0.),18.)*.9 + pow(max(dot(n,normalize(vec3(-.8,-.1,.6))),0.),30.)*.5;
          vec3 c=uCol*l + s*vec3(1.,.97,.94); float a=uA; if(uRefl>.5) a*=.16*smoothstep(uFloor-520.,uFloor,vW.y);
          gl_FragColor=vec4(c,a);
          #include <colorspace_fragment>
        }`
    });
    this.edge = new THREE.Mesh(eg, [new THREE.MeshBasicMaterial({ visible: false }), this.edgeMat]);
    this.g.add(this.edge, this.front, this.back); this.g.visible = false;
  }
  set(o) {
    this.g.visible = (o.a ?? 1) > 0;
    this.g.position.set(sx(o.x ?? CX), sy(o.y ?? CY), o.z ?? 0); this.g.scale.setScalar(o.h ?? 1000);
    this.g.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    for (const m of [this.front.material, this.back.material]) { m.uniforms.uA.value = o.a ?? 1; m.uniforms.uSweep.value = o.sweep ?? -2; m.uniforms.uSweepA.value = o.sweepA ?? 0; m.uniforms.uDim.value = o.dim ?? 0; }
    this.edgeMat.uniforms.uA.value = o.a ?? 1;
    const f = Math.cos(o.ry ?? 0) * Math.cos(o.rx ?? 0); this.front.visible = f > -.02; this.back.visible = f < .02;
  }
  refl(on, floorY) { for (const m of [this.front.material, this.back.material, this.edgeMat]) { m.uniforms.uRefl.value = on ? 1 : 0; m.uniforms.uFloor.value = floorY; } }
}
class Card {     // a product still on a plane (Samsung / iPhone Air); several angle images can cross-fade (turntable)
  constructor(imgs) {
    this.g = new THREE.Group(); scene.add(this.g); this.layers = [];
    for (const img of imgs) { const m = new THREE.Mesh(new THREE.PlaneGeometry(img.width / img.height, 1), phoneMat(texOf(img))); this.g.add(m); this.layers.push(m); }
    this.g.visible = false;
  }
  set(o) {
    this.g.visible = (o.a ?? 1) > 0; this.g.position.set(sx(o.x ?? CX), sy(o.y ?? CY), o.z ?? 0); this.g.scale.setScalar(o.h ?? 1000);
    this.g.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    const wts = o.w ?? [1];
    this.layers.forEach((m, i) => { const k = wts[i] ?? 0; m.visible = k > .002; m.renderOrder = i; m.position.z = i * .0005;
      const u = m.material.uniforms; u.uA.value = (o.a ?? 1) * k; u.uSweep.value = o.sweep ?? -2; u.uSweepA.value = o.sweepA ?? 0; u.uDim.value = o.dim ?? 0; });
  }
  refl(on, floorY) { for (const m of this.layers) { m.material.uniforms.uRefl.value = on ? 1 : 0; m.material.uniforms.uFloor.value = floorY; } }
}
let ip, ipR, sil, silR, pair, pairR, s26, s26R, air, airR;
// soft studio light: a neutral cone from above + a floor spot (additive, alpha-correct over the page)
const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
const lightRig = new THREE.Group(); scene.add(lightRig); lightRig.visible = false;
const cg = new THREE.ConeGeometry(900, 2800, 64, 1, true); cg.translate(0, -1400, 0);
const cone = new THREE.Mesh(cg, new THREE.ShaderMaterial({
  ...ADD, side: THREE.DoubleSide, uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP=position; vec4 w=modelMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-(viewMatrix*w).xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uA,uTime;
    void main(){ float along=clamp(-vP.y/2800.,0.,1.); float edge=pow(abs(dot(vN,vV)),1.8);
      float n=.85+.15*sin(vP.y*.004+uTime*.9+atan(vP.z,vP.x)*5.);
      vec3 c=vec3(1.,.96,.9)*edge*(1.-along*.9)*.16*n*uA; gl_FragColor=vec4(c,max(c.r,max(c.g,c.b))); }`
}));
cone.position.set(0, 1500, -500); lightRig.add(cone);
const floorSpot = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.ShaderMaterial({
  ...ADD, uniforms: { uA: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec2 vUv; uniform float uA; void main(){ float d=length((vUv-.5)*vec2(1.,1.25)); vec3 c=vec3(1.,.95,.9)*.22*exp(-d*d*26.)*uA; gl_FragColor=vec4(c,max(c.r,max(c.g,c.b))); }`
}));
floorSpot.rotation.x = -Math.PI / 2; lightRig.add(floorSpot);

// ================================================================== the DM joke: a chat drawn into the iPhone's own screen
const SCR = { x0: 35, x1: 790, y0: 30, y1: 1671, r: 116 };          // screen of front.png (measured)
let chatCanvas, chatTex, frameImg;
function screenPath(c, grow = 0) { const { x0, x1, y0, y1, r } = SCR; c.beginPath(); c.roundRect(x0 - 1 - grow, y0 - 1 - grow, x1 - x0 + 2 + 2 * grow, y1 - y0 + 2 + 2 * grow, r + 1 + grow); }
function prepChat() {
  frameImg = document.createElement('canvas'); frameImg.width = 825; frameImg.height = 1700;
  const fc = frameImg.getContext('2d'); fc.drawImage(IMG.front, 0, 0); fc.globalCompositeOperation = 'destination-out'; screenPath(fc, 0); fc.fill();
  chatCanvas = document.createElement('canvas'); chatCanvas.width = 825; chatCanvas.height = 1700;
}
const MSG = [['b1', 'me', 'Koliko je ovaj? 👀'], ['b2', 'me', 'Ima li u crnoj?'], ['b3', 'me', 'Može zamena za moj stari?'], ['b4', 'me', 'Stižem za 10 min 🏃'], ['reply', 'them', 'Čekamo te 😉']];
const FONT = '"Inter Variable", "Noto Color Emoji", sans-serif';
function wrap(c, text, maxW) { const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (c.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; } lines.push(cur); return lines; }
function drawChat(t) {
  const c = chatCanvas.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 825, 1700);
  c.save(); screenPath(c, 3); c.clip();
  c.fillStyle = '#0B0B0D'; c.fillRect(0, 0, 825, 1700);
  // status bar + Dynamic Island
  c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.font = `600 44px ${FONT}`; c.fillText('9:41', 168, 92);
  for (let i = 0; i < 4; i++) c.fillRect(578 + i * 13, 94 - i * 6, 9, 10 + i * 6);
  c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.roundRect(650, 76, 56, 28, 8); c.stroke(); c.fillRect(654, 80, 44, 20); c.fillRect(708, 85, 4, 10);
  c.fillStyle = '#000'; c.beginPath(); c.roundRect(295, 56, 235, 68, 34); c.fill();
  // header: back chevron, avatar (orange ring + ZT), name, status
  c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(96, 196); c.lineTo(76, 218); c.lineTo(96, 240); c.stroke();
  c.strokeStyle = '#D97757'; c.lineWidth = 5; c.beginPath(); c.arc(170, 218, 44, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#1C1C1F'; c.beginPath(); c.arc(170, 218, 37, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff'; c.font = `800 30px ${FONT}`; c.fillText('ZT', 170, 219);
  c.textAlign = 'left'; c.font = `650 40px ${FONT}`; c.fillText('zona.telefona', 236, 202);
  c.fillStyle = '#9A9A9F'; c.font = `500 28px ${FONT}`; c.fillText('Aktivni sada', 236, 244);
  c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(35, 292, 755, 2);
  // input bar
  c.fillStyle = '#1C1C1F'; c.beginPath(); c.roundRect(70, 1520, 685, 96, 48); c.fill();
  c.fillStyle = '#8E8E93'; c.font = `500 34px ${FONT}`; c.fillText('Poruka…', 120, 1569);
  c.fillStyle = '#D97757'; c.beginPath(); c.arc(700, 1568, 34, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.moveTo(700, 1586); c.lineTo(700, 1552); c.moveTo(686, 1564); c.lineTo(700, 1550); c.lineTo(714, 1564); c.stroke();
  // messages: big bubbles stacked from the top of the thread (keeps the joke in the upper, unobstructed part of the frame)
  c.font = `600 58px ${FONT}`; const PADX = 38, PADY = 26, LH = 72, MAXW = 560, GAP = 18;
  let y = 330;
  for (const [k, who, txt] of MSG) {
    const a = eOutCubic(prog(t, T[k], T[k] + .22)); if (a <= 0) continue;
    c.font = `600 58px ${FONT}`;   // measure with the bubble font (the 'Viđeno' label changes it)
    const lines = wrap(c, txt, MAXW), w = Math.max(...lines.map(l => c.measureText(l).width)) + PADX * 2, h = lines.length * LH + PADY * 2;
    const x = who === 'me' ? 790 - 42 - w : 77, sc = .55 + .45 * clamp(spring(t - T[k], 2.6, .52), 0, 1.15);
    c.save(); c.globalAlpha = a; c.translate(who === 'me' ? x + w : x, y + h); c.scale(sc, sc); c.translate(who === 'me' ? -w : 0, -h);
    c.fillStyle = who === 'me' ? '#D97757' : '#2A2A2E'; c.beginPath(); c.roundRect(0, 0, w, h, 44); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = `600 58px ${FONT}`; lines.forEach((l, j) => c.fillText(l, PADX, PADY + LH * j + LH / 2 + 2));
    c.restore();
    y += (h + GAP) * a;
    if (k === 'b4') {   // "Viđeno" under the last message, until they answer
      const sa = eOutCubic(prog(t, T.seen, T.seen + .25));
      if (sa > 0) { c.globalAlpha = sa; c.fillStyle = '#9A9A9F'; c.font = `500 32px ${FONT}`; c.textAlign = 'right'; c.fillText('Viđeno', 748, y + 14); c.globalAlpha = 1; y += 44 * sa; }
    }
  }
  c.restore(); c.drawImage(frameImg, 0, 0); chatTex.needsUpdate = true;
}

// ================================================================== typography (GSAP, one timeline seeked per frame)
const tl = gsap.timeline({ paused: true });
function FT(tg, from, to, at) { tl.set(tg, from, 0); return tl.fromTo(tg, from, { ...to, immediateRender: false }, at); }
const typeEl = $('type');
function measureW(html, cls, fs) {
  const sp = document.createElement('span'); sp.className = cls; sp.innerHTML = html;
  sp.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;font-size:${fs}px`;
  document.body.appendChild(sp); const w = sp.getBoundingClientRect().width; sp.remove(); return w;
}
function line(id, words, { cls = 'anton', size = 170, maxW = 920, y = CY, mask = false } = {}) {
  const el = document.createElement('div'); el.id = id; el.className = 'ln ' + cls; typeEl.appendChild(el);
  el.innerHTML = words.map(w => { const or = w.startsWith('o:'), txt = or ? w.slice(2) : w; const chs = [...txt].map(c => `<span class="ch">${c}</span>`).join('');
    return `<span class="w${or ? ' o' : ''}">${mask ? `<span class="mk">${chs}</span>` : chs}</span>`; }).join('<span class="sp"> </span>');
  const plain = words.map(w => w.replace(/^o:/, '')).join(' ');
  const fs = Math.min(size, size * maxW / measureW(plain, cls, size)); el.style.fontSize = fs.toFixed(1) + 'px';
  el.style.top = (y - el.offsetHeight / 2) + 'px'; el.dataset.text = plain;
  return { el, words: [...el.querySelectorAll('.w')], chars: [...el.querySelectorAll('.ch')], fs };
}
const show = (el, t) => tl.set(el, { autoAlpha: 0 }, 0).set(el, { autoAlpha: 1 }, t);
const hide = (el, t, d = .3, y = -40) => tl.to(el, { autoAlpha: 0, y, duration: d, ease: 'power2.in' }, t);
const rise = (chars, t, d = .5, st = .025) => FT(chars, { yPercent: 110 }, { yPercent: 0, duration: d, ease: 'expo.out', stagger: st }, t);
const LINES = [];
const BADGES = [{ x: 190, y: 720 }, { x: 540, y: 720 }, { x: 890, y: 720 }];
function buildType() {
  // ---- S1 HOOK
  const pov = line('pov', ['POV:'], { cls: 'mont', size: 120, y: 720 }); show(pov.el, T.pov);
  FT(pov.el, { '--ls': pov.fs * .7, autoAlpha: 0 }, { '--ls': pov.fs * .04, autoAlpha: 1, duration: .7, ease: 'expo.out' }, T.pov);
  const us = line('usao', ['UŠAO', 'SI', 'o:SAMO'], { size: 200, y: 905, mask: true }); show(us.el, T.usao);
  rise([...us.words[0].querySelectorAll('.ch'), ...us.words[1].querySelectorAll('.ch')], T.usao);
  FT(us.words[2], { scale: 2.1, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .55, ease: 'back.out(1.6)' }, T.usao + .22);
  const pg = line('pogledas', ['DA', 'POGLEDAŠ…'], { size: 200, y: 1110 }); show(pg.el, T.pogledas);
  FT(pg.el, { scale: 1.45, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .38, ease: 'expo.out' }, T.pogledas);
  for (const l of [pov, us, pg]) tl.to(l.el, { scale: 1.1, autoAlpha: 0, duration: .28, ease: 'power2.in' }, T.s1out);
  // ---- S2
  const ao = line('aliOnda', ['ALI', 'ONDA…'], { size: 170, y: 360, mask: true }); show(ao.el, T.aliOnda); rise(ao.chars, T.aliOnda, .55, .03); hide(ao.el, T.aliOut, .25);
  const vs = line('videoSi', ['VIDEO', 'SI', 'o:OVAJ.'], { size: 175, y: 360, mask: true }); show(vs.el, T.video);
  rise([...vs.words[0].querySelectorAll('.ch'), ...vs.words[1].querySelectorAll('.ch')], T.video, .45);
  FT(vs.words[2], { scale: 1.9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .5, ease: 'back.out(1.7)' }, T.video + .25);
  tl.to(vs.el, { scale: 1.25, autoAlpha: 0, duration: .35, ease: 'power2.in' }, T.s2out + .05);
  // ---- S3
  const is = line('iSad', ['I', 'SAD…'], { size: 190, y: 360 }); show(is.el, T.iSad);
  FT(is.el, { '--ls': is.fs * .5, autoAlpha: 0 }, { '--ls': is.fs * .005, autoAlpha: 1, duration: .7, ease: 'expo.out' }, T.iSad); hide(is.el, T.iSadOut, .25);
  const nm = line('nemozes', ['NE', 'MOŽEŠ', 'DA'], { size: 145, y: 300, mask: true }); show(nm.el, T.nemozes); rise(nm.chars, T.nemozes);
  const pr = line('prestanes', ['PRESTANEŠ'], { size: 220, y: 455 }); show(pr.el, T.prestanes);
  FT(pr.el, { '--ls': pr.fs * .35, scale: 1.08, autoAlpha: 0 }, { '--ls': pr.fs * .005, scale: 1, autoAlpha: 1, duration: .6, ease: 'expo.out' }, T.prestanes);
  const gl = line('gledas', ['DA', 'o:GLEDAŠ.'], { size: 145, y: 610, mask: true }); show(gl.el, T.gledas); rise(gl.chars, T.gledas, .5, .03);
  for (const l of [nm, pr, gl]) tl.to(l.el, { autoAlpha: 0, scale: .96, duration: .3, ease: 'power2.in' }, T.s3out);
  // ---- S4 the joke
  const rk = line('rekao', ['REKAO', 'SI:'], { cls: 'mont', size: 84, y: 290, mask: true }); show(rk.el, T.rekao); rise(rk.chars, T.rekao, .45, .02);
  const sg = line('samoGledam', ['SAMO', 'GLEDAM.'], { size: 175, y: 425 }); show(sg.el, T.samoGledam);
  FT(sg.el, { '--ls': sg.fs * .12, autoAlpha: 0, y: 14 }, { '--ls': sg.fs * .005, autoAlpha: 1, y: 0, duration: .7, ease: 'power2.out' }, T.samoGledam);
  for (const l of [rk, sg]) tl.to(l.el, { autoAlpha: 0, y: -30, duration: .22, ease: 'power2.in' }, T.s4textOut);
  const dn = line('daNaravno', ['DA,', 'o:NARAVNO.'], { size: 200, y: 330 }); show(dn.el, T.punch);
  FT(dn.el, { scale: 1.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .42, ease: 'back.out(1.5)' }, T.punch);
  const em = document.createElement('div'); em.id = 'emoji'; em.className = 'ln'; em.innerHTML = '<span class="emoji">😂</span>'; typeEl.appendChild(em);
  em.style.fontSize = '150px'; em.style.top = (505 - em.offsetHeight / 2) + 'px'; em.dataset.text = '😂'; show(em, T.emoji);
  FT(em.firstChild, { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: .6, ease: 'elastic.out(1,.55)' }, T.emoji);
  tl.to(em.firstChild, { rotation: 8, duration: .14, ease: 'sine.inOut', yoyo: true, repeat: 3 }, T.emoji + .65);
  for (const l of [dn.el, em]) tl.to(l, { autoAlpha: 0, y: -40, duration: .3, ease: 'power2.in' }, T.s4out);
  // ---- S5
  const kj = line('koji', ['KOJI', 'BI', 'TI', 'UZEO?'], { size: 160, y: 330, mask: true }); show(kj.el, T.koji); rise(kj.chars, T.koji, .5, .022);
  const br = line('brojevi', ['o:1,', 'o:2', 'ILI', 'o:3?'], { size: 165, y: 500 }); show(br.el, T.brojevi);
  FT(br.words, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .45, ease: 'back.out(2)', stagger: .12 }, T.brojevi);
  for (const l of [kj, br]) tl.to(l.el, { autoAlpha: 0, y: -30, duration: .3, ease: 'power2.in' }, T.s5out);
  BADGES.forEach((b, i) => {
    const el = document.createElement('div'); el.className = 'ln anton'; el.id = 'badge' + (i + 1); el.dataset.text = String(i + 1);
    el.innerHTML = `<span class="w" style="display:inline-flex;align-items:center;justify-content:center;width:112px;height:112px;border-radius:56px;border:4px solid ${OR};background:rgba(10,10,11,.75);font-size:72px;line-height:1">${i + 1}</span>`;
    el.style.left = (b.x - 540) + 'px'; el.style.right = (540 - b.x) + 'px'; el.style.top = (b.y - 56) + 'px'; typeEl.appendChild(el);
    show(el, T['n' + (i + 1)]); FT(el.firstChild, { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: .5, ease: 'back.out(2.2)' }, T['n' + (i + 1)]);
    tl.to(el, { autoAlpha: 0, scale: .6, duration: .25, ease: 'power2.in' }, T.s5out + i * .04);
    LINES.push({ el, text: String(i + 1) });
  });
  // ---- S6 brand
  const zo = line('zona', ['ZONA'], { size: 430, maxW: 800, y: 760 }); show(zo.el, T.logo);
  FT(zo.el, { '--ls': zo.fs * .35, autoAlpha: 0, scale: .92 }, { '--ls': zo.fs * .02, autoAlpha: 1, scale: 1, duration: 1.0, ease: 'expo.out' }, T.logo);
  const te = line('telefona', ['TELEFONA'], { cls: 'mont8', size: 70, y: 1000 }); show(te.el, T.logo + .3);
  FT(te.el, { '--ls': te.fs * 1.0, autoAlpha: 0 }, { '--ls': te.fs * .5, autoAlpha: 1, duration: 1.0, ease: 'expo.out' }, T.logo + .3);
  const z1 = line('zaprati1', ['ZAPRATI', 'ZA', 'SVOJ'], { cls: 'mont', size: 74, y: 1160, mask: true }); show(z1.el, T.zaprati); rise(z1.chars, T.zaprati, .5, .018);
  const z2 = line('zaprati2', ['o:SLEDEĆI', 'TELEFON.'], { cls: 'mont', size: 74, y: 1250, mask: true }); show(z2.el, T.zaprati + .2); rise(z2.chars, T.zaprati + .2, .5, .018);
  const hd = line('handle', ['@zona.telefona'], { cls: 'mont8', size: 62, y: 1365 }); show(hd.el, T.handle);
  FT(hd.el, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .6, ease: 'expo.out' }, T.handle);
  const ru = line('ruma', ['RUMA'], { cls: 'mont6', size: 42, y: 1440 }); show(ru.el, T.ruma); ru.el.style.color = '#BDB9B4';
  FT(ru.el, { '--ls': ru.fs * 1.0, autoAlpha: 0 }, { '--ls': ru.fs * .5, autoAlpha: 1, duration: .8, ease: 'expo.out' }, T.ruma);
  for (const l of [pov, us, pg, ao, vs, is, nm, pr, gl, rk, sg, dn, kj, br, zo, te, z1, z2, hd, ru]) LINES.push({ el: l.el, text: l.el.dataset.text });
  LINES.push({ el: em, text: '😂' });
  tl.set({}, {}, T.end);
}

// ================================================================== frame
const fxc = $('fx').getContext('2d');
const grains = [0, 1, 2, 3].map(k => { const d = fxc.createImageData(540, 960); for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * .013 + k * 91.7) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } return d; });
const glEl = $('gl'), stage = $('stage');
// plateau footage: silhouette in the hook, then a gentle speed ramp through macro → profile → screen (real rotation, never faked)
function plSrc(t) { if (t < T.s2) return .2 + t * (2.3 / T.s2); const u = clamp((t - T.s2) / 4); return 2.5 + 6.6 * (.62 * u + .38 * u * u); }
function shake(t, t0, amp = 10, dec = .22) { const k = t < t0 ? 0 : Math.exp(-(t - t0) / dec); return [Math.sin((t - t0) * 61) * amp * k, Math.cos((t - t0) * 53) * amp * .6 * k]; }
function stageLights(on, fl, cone_ = .7) { lightRig.visible = true; cone.material.uniforms.uA.value = cone_ * on; floorSpot.material.uniforms.uA.value = on; floorSpot.position.y = fl; }
function withRefl(o, R, set, fl, a = 1) { o.set(set); R.set({ ...set, y: 0, rx: -(set.rx ?? 0), a: (set.a ?? 1) * a }); R.g.position.y = 2 * fl - o.g.position.y; R.g.scale.y *= -1; R.refl(true, fl); }

async function setTime(t) {
  tl.seek(t, false);
  for (const c of [bg, fg]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.globalCompositeOperation = 'source-over'; }
  bg.fillStyle = '#060607'; bg.fillRect(0, 0, W, H); fg.clearRect(0, 0, W, H);
  for (const o of [ip, ipR, sil, silR, pair, pairR, s26, s26R, air, airR]) o.g.visible = false;
  lightRig.visible = false; cone.material.uniforms.uTime.value = t;
  let useGL = false, camShake = [0, 0];

  // ---------------- S1 + S2: the real iPhone 17 Pro film — whole camera module in frame, no extreme crops (0 – 7.0)
  if (t < T.s3) {
    const img = await PL.get(plSrc(t));
    let s, ax, ay;
    if (t < T.s2) { const u = prog(t, 0, T.s2); s = lerp(1.12, 1.26, .3 * u + .7 * eInOutSine(u)); ax = 860; ay = 470; }
    else {
      const a = eInOutSine(prog(t, T.s2, 5.2)), p = eOutCubic(prog(t, T.push, T.push + .6)), b = eInOutCubic(prog(t, 5.7, 6.45));
      s = lerp(lerp(1.26, 1.0, a) + .1 * p, .92, b); ax = lerp(lerp(860, 960, a), 975, b); ay = lerp(470, 700, b);
    }
    // end of S2: the camera pushes into the dark screen until the frame is black (clean match into the studio)
    const into = eInCubic(prog(t, T.s2out, T.s3));
    s *= 1 + into * 3.2; ay = lerp(ay, 760, into);
    const hx = noise1(t * .8) * 6 * (1 - into), hy = noise1(t * .7 + 4) * 4 * (1 - into);
    camShake = shake(t, T.pogledas, 8, .2);
    plate(bg, img, ax, ay, s, { sx: CX + hx, sy: 1010 + hy, feather: 320, alpha: 1 - eInCubic(prog(t, T.s3 - .14, T.s3)) });
    if (t < 1.4) sweep(fg, -.1, 1.35, t, .07, 340, -.5);
    if (t >= T.s2 - .2 && t < 5) sweep(fg, 3.3, 4.6, t, .1, 300);
  }
  // ---------------- S3: three different phones, each whole, each under its own light; the camera trucks right between them (7.0 – 12.0)
  if (t >= T.s3 - .2 && t < T.s4 + .3) {
    useGL = true; studio(bg, clamp(prog(t, T.s3 - .2, T.s3 + .05)));
    const Y = 1130, fl = sy(Y) - 420 - 10;
    // camera truck between products: expo in-out, real motion blur comes from frame blending
    const trk1 = eInOutExpo(prog(t, T.p2 - .3, T.p2 + .3)), trk2 = eInOutExpo(prog(t, T.p3 - .3, T.p3 + .3));
    const lightOn = eOutCubic(prog(t, T.s3 - .15, T.s3 + .4)), outS = eInOutCubic(prog(t, T.s3out, T.s4 + .2));
    // soft back-light behind the product on screen so dark phones separate from the stage
    pool(bg, CX, Y - 120, 420, 520, 'rgba(255,244,232,.075)', lightOn * (1 - outS));
    stageLights(lightOn * (1 - outS), fl, .75);
    const sway = (k) => Math.sin(t * .9 + k) * .07;
    const X = (slot) => CX + (slot - trk1 - trk2) * 980;      // slot 0,1,2 along the truck
    pool(bg, CX, 1560, 520, 130, 'rgba(255,245,235,.09)', lightOn * (1 - outS));
    // 1 — iPhone 17 Pro, Cosmic Orange (official back + front still)
    withRefl(pair, pairR, { x: X(0), y: Y - 10, h: 820, ry: sway(0), w: [1], sweep: lerp(-.4, 1.4, prog(t, T.s3 + .25, T.p2 - .2)), sweepA: .8, a: lightOn, dim: .5 * trk1 }, fl, .9);
    // 2 — Galaxy S26 Ultra
    withRefl(s26, s26R, { x: X(1), y: Y, h: 840, ry: sway(1), w: [0, 1, 0], sweep: lerp(-.4, 1.4, prog(t, T.p2 + .2, T.p3 - .2)), sweepA: .8, dim: .5 * (1 - trk1) * 0 + .5 * trk2 }, fl, .9);
    // 3 — iPhone Air, Space Black
    withRefl(air, airR, { x: X(2), y: Y, h: 840, ry: sway(2), w: [1], sweep: lerp(-.4, 1.4, prog(t, T.p3 + .2, T.s3out)), sweepA: .8, a: 1 - outS, dim: .4 * outS }, fl, .9);
  }
  // ---------------- S4: the joke — the phone shows your DM to @zona.telefona (12.0 – 17.0)
  if (t >= T.s4 - .05 && t < T.s5 + .35) {
    useGL = true; studio(bg, 1);
    const inn = spring(t - T.s4, 1.6, .7), push = eInOutExpo(prog(t, T.tapeStop - .05, T.punch)), leave = eInOutCubic(prog(t, T.s4out, T.s5 + .3));
    camShake = shake(t, T.punch, 11, .16);
    const h = lerp(1240, 1420, push) * (1 - .45 * leave), y = lerp(lerp(1500, 1170, clamp(inn)), 1250, push) + leave * 120;
    const fl = sy(y) - h / 2 - 12;
    stageLights(clamp(inn) * (1 - leave), fl, .6);
    pool(bg, CX, 1600, 560, 150, 'rgba(255,245,235,.08)', clamp(inn) * (1 - leave));
    drawChat(t);
    ip.front.material.uniforms.map.value = chatTex;
    withRefl(ip, ipR, { x: CX + camShake[0] * 0, y: y + Math.sin(t * 1.2) * 5 * (1 - push), h, rx: -.02, ry: .05 * Math.sin(t * .8) * (1 - push), a: 1 - leave, dim: .4 * leave }, fl, 1 - push);
  }
  // ---------------- S5: the line-up — three real phones with air between them; lights come on one by one (17.0 – 21.0)
  if (t >= T.s4out && t < T.s6 + 1.0) {
    useGL = true; studio(bg, 1);
    const Y = 1090, H5 = 560, fl = sy(Y) - H5 / 2 - 10;
    const truck = eInOutCubic(prog(t, T.s5 - .2, T.s5 + 1.1));
    const on = i => eOutCubic(prog(t, T.s5 - .1 + i * .22, T.s5 + .45 + i * .22));
    const dimEnd = clamp(prog(t, T.s5out, T.s6)), fin = eInOutCubic(prog(t, T.s6, T.s6 + .9)), gone = eInOutCubic(prog(t, T.s6 + .45, T.logo + .35));
    const hl = i => Math.max(0, Math.sin(Math.PI * prog(t, T['n' + (i + 1)], T['n' + (i + 1)] + .6)));
    stageLights(on(1) * (1 - fin), fl, .5);
    for (let i = 0; i < 3; i++) { const k = on(i) * (1 - dimEnd * (i === 1 ? 0 : 1)) * (1 - gone);
      pool(bg, BADGES[i].x + (1 - truck) * 160, 1385, 190, 55, 'rgba(255,245,235,.12)', k);
      pool(bg, BADGES[i].x + (1 - truck) * (160 + i * 40), Y - 60, 230, 330, 'rgba(255,244,232,.085)', k); }
    const X = i => BADGES[i].x + (1 - truck) * (160 + i * 40);
    withRefl(sil, silR, { x: X(0) - fin * 120, y: Y, h: H5, rx: .02, ry: Math.PI + .1, sweep: lerp(-.3, 1.3, prog(t, T.n1, T.n1 + .6)), sweepA: hl(0), dim: Math.max(1 - on(0), .55 * dimEnd, fin), a: 1 - gone }, fl, 1 - gone);
    const h2 = lerp(H5, 420, fin), y2 = lerp(Y, 1000, fin);
    withRefl(s26, s26R, { x: X(1), y: y2, h: h2, ry: -.04, w: [0, 1, 0], sweep: lerp(-.3, 1.3, prog(t, T.n2, T.n2 + .6)), sweepA: hl(1), dim: 1 - on(1), a: 1 - gone }, fl, (1 - fin) * (1 - gone));
    withRefl(air, airR, { x: X(2) + fin * 120, y: Y, h: H5, ry: .03, w: [1], sweep: lerp(-.3, 1.3, prog(t, T.n3, T.n3 + .6)), sweepA: hl(2), dim: Math.max(1 - on(2), .55 * dimEnd, fin), a: 1 - gone }, fl, 1 - gone);
    if (gone > 0) { fg.save(); fg.globalCompositeOperation = 'lighter'; const lw = lerp(0, 460, eOutCubic(prog(t, T.s6 + .5, T.logo + .4))), a = Math.sin(Math.PI * prog(t, T.s6 + .5, T.logo + .8));
      const g = fg.createLinearGradient(CX - lw, 0, CX + lw, 0); g.addColorStop(0, 'rgba(217,119,87,0)'); g.addColorStop(.5, `rgba(255,236,224,${.85 * a})`); g.addColorStop(1, 'rgba(217,119,87,0)');
      fg.fillStyle = g; fg.fillRect(CX - lw, 935, 2 * lw, 4); fg.restore(); }
  }
  // ---------------- S6: brand reveal on pure black (21.0 – 25.0)
  if (t >= T.s6) {
    const a = clamp(prog(t, T.logo - .1, T.logo + .5)), ep = 1 + .03 * eInOutSine(prog(t, T.logo, T.end));
    bg.save(); bg.translate(CX, 960); bg.scale(ep, ep); bg.translate(-CX, -960);
    zoneMark(bg, CX, 470, 50, a, prog(t, T.logo, T.end - .3));
    const lw = 300 * eOutCubic(prog(t, T.logo + .35, T.logo + 1.1)); if (lw > 0) { bg.fillStyle = OR; bg.fillRect(CX - lw, 936, 2 * lw, 3); }
    pool(bg, CX, 900, 620, 420, 'rgba(255,240,230,.05)', a * (1 + .25 * Math.sin(t * 1.7))); bg.restore();
  }

  stage.style.transform = `translate(${camShake[0].toFixed(2)}px,${camShake[1].toFixed(2)}px)`;
  const endPush = 1 + .03 * eInOutSine(prog(t, T.logo, T.end)); typeEl.style.transform = `scale(${endPush.toFixed(5)})`; typeEl.style.transformOrigin = '540px 960px';
  if (useGL) { glEl.style.visibility = 'visible'; renderer.render(scene, camera); } else glEl.style.visibility = 'hidden';
  fxc.putImageData(grains[Math.floor(t * 24) % 4], 0, 0);
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

const TEX = {};
async function boot() {
  await Promise.all([document.fonts.load('400 100px "Anton"', 'ŠĐČĆŽšđčćž…'), document.fonts.load('900 60px "Montserrat"', 'ŠĆ'), document.fonts.load('800 60px "Montserrat"'),
    document.fonts.load('600 40px "Montserrat"'), document.fonts.load('600 40px "Inter Variable"', 'ČćžŠđ'), document.fonts.load('100px "Noto Color Emoji"', '😂👀🏃😉')]);
  await document.fonts.ready;
  const L = n => load('assets/' + n);
  IMG = { front: await L('front.png'), s26: await L('s26_back.png'), air: await L('air_black.png'), silver: await L('back_silver.png'), pair: await L('pair.png') };
  prepChat(); chatTex = new THREE.CanvasTexture(chatCanvas); chatTex.colorSpace = THREE.SRGBColorSpace; chatTex.anisotropy = 8;
  // warm the canvas text engine: the first canvas draw can otherwise take spaces/digits from the emoji font
  for (const wgt of [500, 600, 650, 800]) await document.fonts.load(`${wgt} 58px "Inter Variable"`, 'Koliko je ovaj? 9:41 Čekamo Viđeno Može');
  drawChat(T.reply + 1); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); drawChat(T.reply + 1);
  TEX.front = texOf(IMG.front); TEX.silver = texOf(IMG.silver);
  ip = new Phone(chatTex, TEX.silver); ipR = new Phone(chatTex, TEX.silver);
  for (const P of [ip, ipR]) P.edgeMat.uniforms.uCol.value.setRGB(.62, .23, .075);      // Cosmic Orange titanium edge (front of the joke phone)
  sil = new Phone(TEX.front, TEX.silver); silR = new Phone(TEX.front, TEX.silver);           // silver iPhone 17 Pro (line-up, back view)
  pair = new Card([IMG.pair]); pairR = new Card([IMG.pair]);
  s26 = new Card([IMG.s26, IMG.s26, IMG.s26]); s26R = new Card([IMG.s26, IMG.s26, IMG.s26]);
  air = new Card([IMG.air]); airR = new Card([IMG.air]);
  buildType();
  window.setTime = setTime; window.__tl = tl; window.__LINES = LINES;
  await setTime(0); window.READY = true;
}
boot();
