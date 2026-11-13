// ZONA TELEFONA — motion design spot (18 s, 1080×1920, 60 fps)
// Three.js (particle iPhone, hero scene with volumetric light + reflection), GSAP (kinetic type, seeked per frame),
// Canvas2D procedural graphics (asterisk, truchet field, shape morphs). Deterministic: setTime(t) renders exactly frame t.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { gsap } from 'gsap';

const W = 1080, H = 1920;
const OR = '#D97757', INK = '#0A0A0A', CREAM = '#F4E9DC', WHITE = '#FFFFFF';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eOutBack = x => { const c = 1.7, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const eOutCubic = x => 1 - Math.pow(1 - x, 3);
const pulse = (t, t0, att, dec) => t < t0 - att ? 0 : t < t0 ? Math.pow((t - (t0 - att)) / att, 2) : Math.exp(-(t - t0) / dec);
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const $ = id => document.getElementById(id);
const load = s => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = s; });

// scene cuts (all on the 120 BPM grid)
const CUTS = [[0, .7], [.5, .55], [.875, .25], [1.25, .25], [1.625, .3], [2.5, .4], [4.5, .3], [6.5, .45], [8.5, .4], [10.5, .3], [11, .2], [11.5, .2], [12, .2], [12.5, .6], [15, .5]];

// ================================================================== Canvas2D
const bg = $('bgc').getContext('2d');
let IMG = {};
function fill(c) { bg.fillStyle = c; bg.fillRect(0, 0, W, H); }
function asterisk(cx, cy, r, n, rot, lw, col, grow = 1, inner = 0) {
  bg.save(); bg.translate(cx, cy); bg.rotate(rot); bg.strokeStyle = col; bg.lineCap = 'round'; bg.lineWidth = lw;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, l = r * grow * (i % 2 ? .82 : 1); bg.beginPath(); bg.moveTo(Math.cos(a) * inner, Math.sin(a) * inner); bg.lineTo(Math.cos(a) * l, Math.sin(a) * l); bg.stroke(); }
  bg.restore();
}
function superellipsePath(cx, cy, rx, ry, n, rot = 0) {
  bg.beginPath();
  for (let i = 0; i <= 160; i++) {
    const a = i / 160 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * rx, y = Math.sign(s) * Math.pow(Math.abs(s), 2 / n) * ry;
    const xr = x * Math.cos(rot) - y * Math.sin(rot), yr = x * Math.sin(rot) + y * Math.cos(rot);
    i ? bg.lineTo(cx + xr, cy + yr) : bg.moveTo(cx + xr, cy + yr);
  }
  bg.closePath();
}
function roundRectPath(cx, cy, w, h, r) { bg.beginPath(); bg.roundRect(cx - w / 2, cy - h / 2, w, h, r); }
function cover(img, cx, cy, scale) { bg.drawImage(img, cx - img.width * scale / 2, cy - img.height * scale / 2, img.width * scale, img.height * scale); }
function orbitDots(cx, cy, R, n, rot, size, col, appear = 1) {
  bg.fillStyle = col;
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rot, k = clamp(appear * n - i); if (k <= 0) continue; bg.beginPath(); bg.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, Math.max(0, size * k), 0, Math.PI * 2); bg.fill(); }
}

// --- truchet field
const TC = 108, TCOLS = 10, TROWS = 18;
const tiles = []; for (let j = 0; j < TROWS; j++) for (let i = 0; i < TCOLS; i++) tiles.push({ i, j, b: hash(i * 31.7 + j * 7.3) > .5 ? 1 : 0, d: Math.hypot(i - 4.5, j - 8) });
function truchet(t, fg, bgc) {
  fill(bgc); bg.strokeStyle = fg; bg.lineWidth = 20; bg.lineCap = 'butt';
  const beats = [4.5, 5.0, 5.5, 6.0];
  for (const c of tiles) {
    let ang = c.b * Math.PI / 2;
    for (const b of beats) ang += Math.PI / 2 * eInOutCubic(prog(t, b + c.d * .025, b + c.d * .025 + .28));
    const x = c.i * TC + TC / 2, y = c.j * TC + TC / 2 - 12;
    bg.save(); bg.translate(x, y); bg.rotate(ang);
    bg.beginPath(); bg.arc(-TC / 2, -TC / 2, TC / 2, 0, Math.PI / 2); bg.stroke();
    bg.beginPath(); bg.arc(TC / 2, TC / 2, TC / 2, Math.PI, Math.PI * 1.5); bg.stroke();
    bg.restore();
  }
}
// --- shape morph (circle → triangle → star → phone)
const NPT = 180;
function shapePts(kind, R) {
  const pts = [];
  for (let i = 0; i < NPT; i++) {
    const u = i / NPT, a = u * Math.PI * 2 - Math.PI / 2;
    if (kind === 'circle') pts.push([Math.cos(a) * R, Math.sin(a) * R]);
    else if (kind === 'tri' || kind === 'star') {
      const n = kind === 'tri' ? 3 : 5, verts = [];
      for (let k = 0; k < n * (kind === 'star' ? 2 : 1); k++) { const aa = -Math.PI / 2 + k * Math.PI * 2 / (n * (kind === 'star' ? 2 : 1)); const rr = kind === 'star' && k % 2 ? R * .45 : R * (kind === 'tri' ? 1.15 : 1.05); verts.push([Math.cos(aa) * rr, Math.sin(aa) * rr]); }
      const m = verts.length, f = u * m, k0 = Math.floor(f) % m, k1 = (k0 + 1) % m, s = f - Math.floor(f);
      pts.push([lerp(verts[k0][0], verts[k1][0], s), lerp(verts[k0][1], verts[k1][1], s)]);
    } else {           // phone: rounded rect 1 : 2.06 (front.png aspect)
      const h = R * 2.9, w = h * 825 / 1700, r = w * .17;
      const per = 2 * (w + h - 4 * r) + 2 * Math.PI * r; let d = ((u + .125) % 1) * per;
      const seg = [[w - 2 * r, 'top'], [Math.PI * r / 2, 'c1'], [h - 2 * r, 'right'], [Math.PI * r / 2, 'c2'], [w - 2 * r, 'bot'], [Math.PI * r / 2, 'c3'], [h - 2 * r, 'left'], [Math.PI * r / 2, 'c4']];
      let p = [0, 0];
      for (const [L, nm] of seg) {
        if (d <= L) {
          const k = d / L;
          if (nm === 'top') p = [-w / 2 + r + k * (w - 2 * r), -h / 2];
          if (nm === 'c1') { const aa = -Math.PI / 2 + k * Math.PI / 2; p = [w / 2 - r + Math.cos(aa) * r, -h / 2 + r + Math.sin(aa) * r]; }
          if (nm === 'right') p = [w / 2, -h / 2 + r + k * (h - 2 * r)];
          if (nm === 'c2') { const aa = k * Math.PI / 2; p = [w / 2 - r + Math.cos(aa) * r, h / 2 - r + Math.sin(aa) * r]; }
          if (nm === 'bot') p = [w / 2 - r - k * (w - 2 * r), h / 2];
          if (nm === 'c3') { const aa = Math.PI / 2 + k * Math.PI / 2; p = [-w / 2 + r + Math.cos(aa) * r, h / 2 - r + Math.sin(aa) * r]; }
          if (nm === 'left') p = [-w / 2, h / 2 - r - k * (h - 2 * r)];
          if (nm === 'c4') { const aa = Math.PI + k * Math.PI / 2; p = [-w / 2 + r + Math.cos(aa) * r, -h / 2 + r + Math.sin(aa) * r]; }
          break;
        }
        d -= L;
      }
      pts.push(p);
    }
  }
  return pts;
}
const SH = { circle: shapePts('circle', 300), tri: shapePts('tri', 300), star: shapePts('star', 330), phone: shapePts('phone', 300) };
function morphPath(A, B, k, cx, cy, s = 1, rot = 0) {
  bg.beginPath();
  for (let i = 0; i < NPT; i++) {
    const x = lerp(A[i][0], B[i][0], k) * s, y = lerp(A[i][1], B[i][1], k) * s;
    const xr = x * Math.cos(rot) - y * Math.sin(rot), yr = x * Math.sin(rot) + y * Math.cos(rot);
    i ? bg.lineTo(cx + xr, cy + yr) : bg.moveTo(cx + xr, cy + yr);
  }
  bg.closePath();
}

// ================================================================== Three.js
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x050505);
const camera = new THREE.PerspectiveCamera(30, W / H, .05, 100);
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .7, .6, .55); composer.addPass(bloom);
composer.addPass(new OutputPass());

// --- particle iPhone (sampled from the iPhone 17 Pro silhouette: body, camera plateau, three lenses)
const PN = 26000;
const phoneP = new Float32Array(PN * 3), sphereP = new Float32Array(PN * 3), seed = new Float32Array(PN);
{
  const Wp = .78, Hp = 1.6, Dp = .09, R = .13;
  const inRR = (x, y, w, h, r) => { const dx = Math.max(Math.abs(x) - (w / 2 - r), 0), dy = Math.max(Math.abs(y) - (h / 2 - r), 0); return dx * dx + dy * dy <= r * r; };
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < PN; i++) {
    let x, y, z, k = rnd();
    if (k < .42) {                 // back surface (full rounded rect)
      do { x = (rnd() - .5) * Wp; y = (rnd() - .5) * Hp; } while (!inRR(x, y, Wp, Hp, R)); z = -Dp / 2;
      // camera plateau: full-width band on the 17 Pro → raised
      if (y > Hp / 2 - .36) z -= .035;
    } else if (k < .62) {          // front surface (screen), sparser look by jitter
      do { x = (rnd() - .5) * Wp; y = (rnd() - .5) * Hp; } while (!inRR(x, y, Wp, Hp, R)); z = Dp / 2;
    } else if (k < .82) {          // edge band
      const a = rnd(); const per = 2 * (Wp + Hp); let d = a * per; z = (rnd() - .5) * Dp;
      if (d < Wp) { x = -Wp / 2 + d; y = Hp / 2; } else if (d < Wp + Hp) { x = Wp / 2; y = Hp / 2 - (d - Wp); } else if (d < 2 * Wp + Hp) { x = Wp / 2 - (d - Wp - Hp); y = -Hp / 2; } else { x = -Wp / 2; y = -Hp / 2 + (d - 2 * Wp - Hp); }
      const cx = Math.sign(x) * (Wp / 2 - R), cy = Math.sign(y) * (Hp / 2 - R);
      if (Math.abs(x) > Wp / 2 - R && Math.abs(y) > Hp / 2 - R) { const a2 = Math.atan2(y - cy, x - cx); x = cx + Math.cos(a2) * R; y = cy + Math.sin(a2) * R; }
    } else {                       // three lens rings + flash on the plateau (back is −z; viewed from back x is mirrored)
      const L = [[.2, Hp / 2 - .13], [.2, Hp / 2 - .29], [.05, Hp / 2 - .21]], idx = Math.floor(rnd() * 3.3);
      if (idx < 3) { const a = rnd() * Math.PI * 2, rr = .065 + (rnd() < .5 ? 0 : -.025); x = L[idx][0] + Math.cos(a) * rr; y = L[idx][1] + Math.sin(a) * rr; }
      else { const a = rnd() * Math.PI * 2; x = -.25 + Math.cos(a) * .03; y = Hp / 2 - .12 + Math.sin(a) * .03; }
      z = -Dp / 2 - .06;
    }
    phoneP.set([x, y, z], i * 3);
    const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1), rr = 1.05 + rnd() * .25;
    sphereP.set([Math.sin(ph) * Math.cos(th) * rr, Math.cos(ph) * rr * 1.25, Math.sin(ph) * Math.sin(th) * rr], i * 3);
    seed[i] = rnd();
  }
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(phoneP, 3));
pGeo.setAttribute('aSphere', new THREE.BufferAttribute(sphereP, 3));
pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uMorph: { value: 0 }, uCollapse: { value: 0 }, uTime: { value: 0 }, uA: { value: 1 } },
  vertexShader: `attribute vec3 aSphere; attribute float aSeed; uniform float uMorph,uCollapse,uTime; varying float vA; varying vec3 vC;
    void main(){ float m=clamp(uMorph*1.3-aSeed*.3,0.,1.); m=m*m*(3.-2.*m);
      vec3 p=mix(position,aSphere,m); p+=sin(vec3(aSeed*40.+uTime*2.,aSeed*70.+uTime*1.7,aSeed*90.))*.02*m;
      p*=1.-uCollapse;
      vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=(2.2+aSeed*2.2)*(4.2/-mv.z);
      vA=.55+.45*sin(uTime*3.+aSeed*50.); vC=mix(vec3(.85,.47,.34),vec3(1.,.93,.86),step(.94,aSeed));
      gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform float uA; varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(vC*(1.-d*1.6)*vA*uA*1.3,1.); }`
});
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false;
const particleGroup = new THREE.Group(); particleGroup.add(points); scene.add(particleGroup);

// --- hero scene: official Cosmic Orange iPhone 17 Pro still on a glossy floor under a volumetric light cone
const hero = new THREE.Group(); scene.add(hero);
let pairMesh, reflMesh, cone, dust, burstTex, burstCanvas, burstMesh;
function buildHero() {
  const tex = new THREE.Texture(IMG.pair); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true;
  const h = 1.55, w = h * IMG.pair.width / IMG.pair.height;
  pairMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  pairMesh.position.y = h / 2 - 1.0; hero.add(pairMesh);
  reflMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { map: { value: tex }, uA: { value: .28 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D map; uniform float uA; varying vec2 vUv; void main(){ vec4 c=texture2D(map,vec2(vUv.x,1.-vUv.y)); float f=smoothstep(.55,1.,vUv.y); gl_FragColor=vec4(c.rgb*.8,c.a*f*uA);} `
  }));
  reflMesh.position.y = -1.0 - h / 2 - .005; hero.add(reflMesh);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uA: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv; uniform float uA; void main(){ float d=length((vUv-.5)*vec2(1.,1.6)); vec3 c=vec3(.85,.47,.34)*.22*exp(-d*d*30.); gl_FragColor=vec4(c,uA*smoothstep(.5,.0,d));}`
  }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.0, 0); floor.renderOrder = -1; hero.add(floor);
  // volumetric light cone (additive shader, soft edges + slow noise)
  const cg = new THREE.ConeGeometry(1.6, 4.4, 64, 1, true); cg.translate(0, -2.2, 0);
  cone = new THREE.Mesh(cg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP=position; vec4 w=modelMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-(viewMatrix*w).xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uA,uTime;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){ float along=clamp(-vP.y/4.4,0.,1.); float edge=pow(abs(dot(vN,vV)),1.6);
        float n=.75+.25*sin(vP.y*6.+uTime*1.3+atan(vP.z,vP.x)*5.);
        vec3 c=mix(vec3(1.,.93,.86),vec3(.85,.47,.34),along); gl_FragColor=vec4(c*edge*(1.-along)*.32*n*uA,1.); }`
  }));
  cone.position.set(0, 3.2, -.3); hero.add(cone);
  // dust in the beam
  const DN = 900, dp = new Float32Array(DN * 3); let s = 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < DN; i++) { const y = rnd() * 4.2 - 1.0, rr = (3.2 - y) / 4.4 * 1.5 * Math.sqrt(rnd()), a = rnd() * 6.283; dp.set([Math.cos(a) * rr, y, Math.sin(a) * rr - .3], i * 3); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffd9c4, size: .012, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
  hero.add(dust);
  // concentric 'zone' rings behind the phones (brand motif, replaces the asterisk)
  burstCanvas = document.createElement('canvas'); burstCanvas.width = burstCanvas.height = 1024;
  const bc = burstCanvas.getContext('2d'); bc.strokeStyle = OR; bc.translate(512, 512);
  for (let i = 0; i < 6; i++) { bc.lineWidth = 10 - i; bc.globalAlpha = 1 - i * .13; bc.beginPath(); bc.arc(0, 0, 150 + i * 62, 0, Math.PI * 2); bc.stroke(); }
  burstTex = new THREE.CanvasTexture(burstCanvas); burstTex.colorSpace = THREE.SRGBColorSpace;
  burstMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: burstTex, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  burstMesh.position.set(0, .2, -1.6); hero.add(burstMesh);
}

// ================================================================== GSAP kinetic type
const tl = gsap.timeline({ paused: true });
function measure(el, wdth, wght) {
  const sp = document.createElement('span'); sp.className = el.className; sp.textContent = el.textContent;
  sp.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;font-size:100px;--wdth:${wdth};--wght:${wght}`;
  document.body.appendChild(sp); const w = sp.getBoundingClientRect().width; sp.remove(); return w;
}
function fitText(el, width, wdth = 100, wght = 900) { el.style.fontSize = (100 * width / measure(el, wdth, wght)).toFixed(1) + 'px'; }
function place(el, top, color, size) { el.style.top = top + 'px'; if (color) el.style.color = color; if (size) el.style.fontSize = size + 'px'; }
// heavy word: smooth IN (width/weight morph + rise) and smooth OUT (squeeze + lift + fade)
function word(id, tIn, tOut, { color = INK, top = 820, width = 960, wd1 = 100, from = 'up', inDur = .55, outDur = .32 } = {}) {
  const el = $(id); fitText(el, width, wd1); place(el, top, color);
  const y0 = from === 'up' ? 110 : from === 'down' ? -110 : 0, x0 = from === 'left' ? -380 : from === 'right' ? 380 : 0;
  tl.set(el, { autoAlpha: 0, '--wdth': 50, '--wght': 300, y: y0, x: x0, scale: 1 }, 0);
  tl.to(el, { autoAlpha: 1, duration: .2, ease: 'power1.out' }, tIn);
  tl.to(el, { '--wdth': wd1, '--wght': 900, y: 0, x: 0, duration: inDur, ease: 'expo.out' }, tIn);
  if (tOut !== undefined) tl.to(el, { '--wdth': Math.max(50, wd1 - 45), '--wght': 500, y: -70, autoAlpha: 0, duration: outDur, ease: 'power3.in' }, tOut - outDur);
  return el;
}
function soft(id, tIn, tOut, { top, color, size, y = 30 } = {}) {
  const el = $(id); place(el, top, color, size);
  tl.set(el, { autoAlpha: 0, y }, 0).to(el, { autoAlpha: 1, y: 0, duration: .5, ease: 'expo.out' }, tIn);
  if (tOut !== undefined) tl.to(el, { autoAlpha: 0, y: -y, duration: .3, ease: 'power2.in' }, tOut - .3);
  return el;
}
function buildType() {
  // HOOK — one word per 0.75 s
  word('w1', 1.0, 1.75, { top: 800 });
  word('w2', 1.75, 2.5, { top: 800, color: OR, from: 'left' });
  word('w3', 2.5, 3.25, { top: 800, from: 'right' });
  const w4 = word('w4', 3.25, 4.5, { top: 640, width: 900 });
  tl.to(w4, { '--wdth': 62, '--wght': 650, duration: .3, ease: 'power3.inOut' }, 3.75).to(w4, { '--wdth': 100, '--wght': 900, duration: .35, ease: 'back.out(2.2)' }, 4.05);
  soft('w4s', 3.55, 4.5, { top: 990, color: INK, size: 130 });
  // S2 iPhone reveal
  soft('m2', 4.85, 6.75, { top: 200, color: CREAM, y: 12 });
  const t2 = word('t2', 5.05, 6.8, { top: 1520, width: 860, color: CREAM, wd1: 120 });
  soft('m2b', 5.4, 6.8, { top: 1680, color: OR, y: 12 });
  // S3 truchet + window
  soft('m3', 7.3, 9.3, { top: 150, color: CREAM, y: 12 });
  word('t3', 7.7, 9.3, { top: 1500, width: 940, color: CREAM });
  // S4 particles
  soft('m4', 9.7, 11.8, { top: 150, color: CREAM, y: 12 });
  const t4 = word('t4', 9.95, 11.8, { top: 1480, width: 940, color: CREAM });
  tl.to(t4, { '--wght': 250, duration: .3, ease: 'power2.inOut' }, 10.6).to(t4, { '--wght': 900, duration: .35, ease: 'back.out(2)' }, 10.95);
  soft('t4s', 10.3, 11.8, { top: 1620, color: OR, size: 84 });
  // S5 shape morph words
  word('t5a', 12.6, 13.2, { top: 1540, width: 700 });
  word('t5b', 13.2, 13.8, { top: 1540, width: 700 });
  word('t5c', 13.8, 14.4, { top: 1540, width: 700 });
  // S6 big words
  word('t6a', 14.5, 15.15, { top: 760, width: 960, from: 'left' });
  word('t6b', 15.15, 15.8, { top: 760, width: 820 });
  word('t6c', 15.8, 16.5, { top: 790, width: 960, color: OR, from: 'right' });
  // S7 hero
  word('t7', 17.0, 18.85, { top: 1560, width: 860, color: CREAM, wd1: 120 });
  soft('t7s', 17.35, 18.85, { top: 1700, color: OR, size: 80 });
  // S8 CTA
  word('c1', 19.3, undefined, { top: 820, width: 980, wd1: 72 });
  const c2 = $('c2'); fitText(c2, 740); place(c2, 1060, CREAM);
  tl.set(c2, { autoAlpha: 0, '--wdth': 50, scale: 1.25 }, 0).to(c2, { autoAlpha: 1, duration: .2 }, 19.8).to(c2, { '--wdth': 100, scale: 1, duration: .5, ease: 'expo.out' }, 19.8);
  for (const b of [21.0, 21.5, 22.0]) tl.to(c2, { scale: 1.04, duration: .08, ease: 'power2.out' }, b).to(c2, { scale: 1, duration: .35, ease: 'expo.out' }, b + .08);
  soft('c3', 20.35, undefined, { top: 1290, color: INK, size: 52 });
  soft('c4', 20.55, undefined, { top: 1375, color: INK, size: 66 });
  const pl = $('plane'); pl.style.top = '1130px'; pl.style.left = '0px';
  tl.set(pl, { autoAlpha: 0, x: -200, y: 140, rotation: -20 }, 0).set(pl, { autoAlpha: 1 }, 20.05)
    .to(pl, { x: 860, y: -190, rotation: 8, duration: .7, ease: 'power3.out' }, 20.05)
    .to(pl, { y: -205, duration: .6, ease: 'sine.inOut', yoyo: true, repeat: 2 }, 20.8);
  tl.set({}, {}, DUR);
}
const DUR = 22.5;

// ================================================================== frame helpers
const fxc = $('fx').getContext('2d');
const grains = [0, 1, 2, 3].map(k => { const d = fxc.createImageData(540, 960); for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * .013 + k * 91.7) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } return d; });
const glEl = $('gl');
// colour fields that WIPE in (bottom / top alternately) instead of hard-cutting
function fields(t, list) {
  let i = 0; while (i < list.length - 1 && t >= list[i + 1][0]) i++;
  if (i === 0) { fill(list[0][1]); return; }
  const [t0, c] = list[i], p = eOutExpo(prog(t, t0 - .12, t0 + .38));
  fill(list[i - 1][1]); bg.fillStyle = c;
  if (i % 2) bg.fillRect(0, H * (1 - p), W, H * p); else bg.fillRect(0, 0, W, H * p);
}
// 'zone' rings: concentric circles pulsing outward (brand motif)
function rings(cx, cy, r0, gap, n, t, col, a = 1, lw = 4) {
  bg.strokeStyle = col;
  for (let i = 0; i < n; i++) {
    const ph = ((t * .6 + i / n) % 1), r = r0 + ph * gap * n;
    bg.globalAlpha = a * Math.sin(Math.PI * ph); bg.lineWidth = lw; bg.beginPath(); bg.arc(cx, cy, r, 0, Math.PI * 2); bg.stroke();
  }
  bg.globalAlpha = 1;
}
function drawPair(cx, cy, h, alpha = 1) { const w = h * IMG.pair.width / IMG.pair.height; bg.globalAlpha = alpha; bg.drawImage(IMG.pair, cx - w / 2, cy - h / 2, w, h); bg.globalAlpha = 1; }

// ================================================================== frame
async function setTime(t) {
  tl.seek(t, false);
  bg.setTransform(1, 0, 0, 1, 0, 0); bg.globalAlpha = 1;
  let useGL = false;

  // ---------------- S0 intro: a dot sends out zone rings (0–1)
  if (t < 1.0) {
    fill(INK);
    const d = eOutBack(prog(t, 0, .25)), go = eInExpo(prog(t, .8, 1.0));
    bg.fillStyle = OR; bg.beginPath(); bg.arc(540, 900, Math.max(0, 22 * d + go * 1200), 0, Math.PI * 2); bg.fill();   // the dot grows into the first orange field
    rings(540, 900, 30, 70, 6, t, CREAM, clamp(prog(t, .1, .35)) * (1 - go), 3);
  }
  // ---------------- S1 hook (1–4.5)
  else if (t < 4.5) {
    fields(t, [[1.0, OR], [1.75, INK], [2.5, CREAM], [3.25, OR]]);
    if (t >= 3.4) rings(540, 1480, 40, 46, 5, t, INK, clamp(prog(t, 3.5, 3.8)) * (1 - prog(t, 4.2, 4.5)), 4);
  }
  // ---------------- S2 iris reveals the whole iPhone, centred (4.5–7)
  else if (t < 7.0) {
    fill(INK);
    const g = eOutExpo(prog(t, 4.5, 5.1)), close = eInOutCubic(prog(t, 6.6, 7.0));
    const size = lerp(20, 500, g) * (1 - close * .97), n = lerp(2, 4.2, eInOutCubic(prog(t, 4.8, 5.6)));
    const rot = lerp(-.35, 0, eOutCubic(prog(t, 4.5, 5.4)));
    bg.save(); superellipsePath(540, 860, size * .86, size, n, rot); bg.clip(); fill('#060606');
    drawPair(540, 860, lerp(840, 800, eInOutCubic(prog(t, 4.6, 6.8))));
    bg.restore();
    bg.strokeStyle = OR; bg.lineWidth = 4; bg.globalAlpha = g * (1 - close); superellipsePath(540, 860, size * .86 + 22, size + 22, n, rot); bg.stroke(); bg.globalAlpha = 1;
    orbitDots(540, 860, size + 80, 16, t * .5, 8, OR, eOutCubic(prog(t, 4.8, 5.5)) * (1 - close));
  }
  // ---------------- S3 truchet field with the iPhone in a window (7–9.5)
  else if (t < 9.5) {
    const inv = t >= 8.5;
    truchetT(t, inv ? INK : OR, inv ? OR : INK);
    const g = eOutExpo(prog(t, 7.05, 7.6)), ex = eInOutCubic(prog(t, 9.15, 9.5));
    const ww = lerp(660, 1300, ex), hh = lerp(0, 900, g) + ex * 1200, r = lerp(70, 0, ex);
    bg.save(); roundRectPath(540, 840, ww, hh, r); bg.clip(); fill('#060606');
    drawPair(540, 840, lerp(780, 760, prog(t, 7, 9.5)), 1 - ex);
    bg.restore();
    bg.strokeStyle = CREAM; bg.lineWidth = 5; bg.globalAlpha = g * (1 - ex); roundRectPath(540, 840, ww + 14, hh + 14, r + 7); bg.stroke(); bg.globalAlpha = 1;
  }
  // ---------------- S4 particle iPhone (9.5–12) — Three.js
  else if (t < 12.0) {
    useGL = true; hero.visible = false; particleGroup.visible = true;
    const u = t - 9.5;
    particleGroup.rotation.set(.12 + .06 * Math.sin(u * 1.2), Math.PI + .4 - u * 1.2 + Math.PI * eInOutCubic(prog(t, 10.6, 11.4)), .03);
    pMat.uniforms.uMorph.value = eInOutCubic(prog(t, 10.6, 10.95)) * (1 - eInOutCubic(prog(t, 11.05, 11.4)));
    pMat.uniforms.uCollapse.value = eInOutCubic(prog(t, 11.7, 12.0));
    pMat.uniforms.uTime.value = t; pMat.uniforms.uA.value = clamp(prog(t, 9.5, 9.85));
    camera.position.set(0, 0, lerp(6.2, 5.6, eInOutCubic(prog(t, 9.5, 11.8)))); camera.lookAt(0, -.12, 0);
    bloom.strength = .85;
  }
  // ---------------- S5 shape morph → the real iPhone (12–14.5)
  else if (t < 14.5) {
    fill(CREAM);
    const ks = [[12.0, 'circle', 'circle'], [12.6, 'circle', 'tri'], [13.2, 'tri', 'star'], [13.8, 'star', 'phone']];
    let A = SH.circle, B = SH.circle, k = 1;
    for (const [tb, a, b] of ks) if (t >= tb) { A = SH[a]; B = SH[b]; k = eOutBack(prog(t, tb, tb + .45)); }
    const appear = eOutBack(prog(t, 12.0, 12.4)), ex = eInOutCubic(prog(t, 14.2, 14.5));
    const s = appear * (1 - ex), rot = t < 13.8 ? (t - 12.0) * .35 : (1 - eOutCubic(prog(t, 13.8, 14.2))) * .63;
    bg.fillStyle = INK; morphPath(A, B, k, 540, 840, s, rot); bg.fill();
    if (t >= 13.8) {
      bg.save(); morphPath(A, B, k, 540, 840, s, rot); bg.clip();
      const ph = 300 * 2.9 * s; bg.globalAlpha = eOutCubic(prog(t, 13.9, 14.15));
      bg.translate(540, 840); bg.rotate(rot); bg.drawImage(IMG.front, -ph * 825 / 1700 / 2, -ph / 2, ph * 825 / 1700, ph); bg.restore(); bg.globalAlpha = 1;
    }
    orbitDots(540, 840, 470 * s, 12, -(t - 12.0) * .8, 10, OR, eOutCubic(prog(t, 12.05, 12.6)) * (1 - ex));
  }
  // ---------------- S6 big words (14.5–16.5)
  else if (t < 16.5) {
    fields(t, [[14.3, CREAM], [14.5, WHITE], [15.15, OR], [15.8, INK]]);
    const t0 = t < 15.15 ? 14.5 : t < 15.8 ? 15.15 : 15.8, t1 = t0 + .65;
    const p = eOutExpo(prog(t, t0 + .1, t0 + .5)), q = eInOutCubic(prog(t, t1 - .3, t1));
    bg.fillStyle = t0 === 15.15 ? INK : OR; bg.fillRect(540 - 450 * p + 900 * q, 1105, 900 * (p - q) > 0 ? 900 * p * (1 - q) : 0, 16);
  }
  // ---------------- S7 hero, centred (16.5–19) — Three.js
  else if (t < 19.0) {
    useGL = true; hero.visible = true; particleGroup.visible = false;
    const u = eInOutCubic(prog(t, 16.5, 19.0));
    camera.position.set(lerp(-.25, .25, u), lerp(.25, .1, u), lerp(5.6, 5.0, u)); camera.lookAt(0, -.38, 0);
    pairMesh.rotation.y = lerp(.06, -.04, u); reflMesh.rotation.y = pairMesh.rotation.y;
    cone.material.uniforms.uA.value = eOutCubic(prog(t, 16.5, 16.9)); cone.material.uniforms.uTime.value = t;
    burstMesh.rotation.z = 0; burstMesh.scale.setScalar(1 + .04 * Math.sin(t * 2)); burstMesh.material.opacity = .4 * clamp(prog(t, 16.7, 17.2));
    dust.rotation.y = t * .08;
    const fo = eInOutCubic(prog(t, 18.7, 19.0)), fi = eOutCubic(prog(t, 16.5, 16.85));
    pairMesh.material.opacity = fi * (1 - fo); reflMesh.material.uniforms.uA.value = .28 * fi * (1 - fo);
    bloom.strength = .55;
  }
  // ---------------- S8 CTA (19–22.5)
  else {
    fill(INK);
    const e = eOutExpo(prog(t, 19.0, 19.5));
    bg.fillStyle = OR; bg.beginPath(); bg.arc(540, 960, e * 1300, 0, Math.PI * 2); bg.fill();   // orange field opens from the centre
    rings(540, 520, 40, 44, 6, t, INK, clamp(prog(t, 19.3, 19.8)), 5);
    bg.fillStyle = INK; bg.beginPath(); bg.arc(540, 520, Math.max(0, 16 * eOutBack(prog(t, 19.2, 19.5))), 0, Math.PI * 2); bg.fill();
    const p = eOutExpo(prog(t, 19.75, 20.2));
    bg.fillStyle = INK; bg.beginPath(); bg.roundRect(540 - 470 * p, 1015, 940 * p, 210, 105 * p); bg.fill();
    const tp = prog(t, 20.05, 20.75);
    if (tp > 0) { bg.strokeStyle = INK; bg.lineWidth = 4; bg.setLineDash([14, 14]); bg.beginPath(); bg.moveTo(-100, 1330); bg.quadraticCurveTo(380, 1380, lerp(-100, 880, eOutCubic(tp)), lerp(1330, 1000, eOutCubic(tp))); bg.globalAlpha = 1 - prog(t, 20.8, 21.4); bg.stroke(); bg.setLineDash([]); bg.globalAlpha = 1; }
  }

  if (useGL) { glEl.style.visibility = 'visible'; composer.render(); } else glEl.style.visibility = 'hidden';
  $('flash').style.opacity = 0;
  fxc.putImageData(grains[Math.floor(t * 30) % 4], 0, 0);
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
// truchet with slower, smoother tile waves
function truchetT(t, fg, bgc) {
  fill(bgc); bg.strokeStyle = fg; bg.lineWidth = 20;
  const beats = [7.0, 7.75, 8.5, 9.0];
  for (const c of tiles) {
    let ang = c.b * Math.PI / 2;
    for (const b of beats) ang += Math.PI / 2 * eInOutCubic(prog(t, b + c.d * .03, b + c.d * .03 + .45));
    const x = c.i * TC + TC / 2, y = c.j * TC + TC / 2 - 12;
    bg.save(); bg.translate(x, y); bg.rotate(ang);
    bg.beginPath(); bg.arc(-TC / 2, -TC / 2, TC / 2, 0, Math.PI / 2); bg.stroke();
    bg.beginPath(); bg.arc(TC / 2, TC / 2, TC / 2, Math.PI, Math.PI * 1.5); bg.stroke();
    bg.restore();
  }
}

async function boot() {
  await document.fonts.load('900 100px "Anybody Variable"', 'ĆČŠŽĐćčšž?'); await document.fonts.load('italic 500 100px "Cormorant Garamond"'); await document.fonts.load('500 30px "JetBrains Mono"');
  await document.fonts.ready;
  IMG = { cam: await load('assets/cam.jpg'), pair: await load('assets/pair.png'), front: await load('assets/front.png') };
  buildHero(); buildType();
  window.setTime = setTime; await setTime(0); window.READY = true;
}
boot();
