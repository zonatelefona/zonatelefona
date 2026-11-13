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
  // rotating asterisk behind the phones
  burstCanvas = document.createElement('canvas'); burstCanvas.width = burstCanvas.height = 1024;
  const bc = burstCanvas.getContext('2d'); bc.strokeStyle = OR; bc.lineCap = 'round'; bc.lineWidth = 26; bc.translate(512, 512);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, l = i % 2 ? 380 : 470; bc.beginPath(); bc.moveTo(Math.cos(a) * 60, Math.sin(a) * 60); bc.lineTo(Math.cos(a) * l, Math.sin(a) * l); bc.stroke(); }
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
function fitText(el, width, wdth = 150, wght = 900) { el.style.fontSize = (100 * width / measure(el, wdth, wght)).toFixed(1) + 'px'; }
function place(el, top, color, size) { el.style.top = top + 'px'; if (color) el.style.color = color; if (size) el.style.fontSize = size + 'px'; }
// a heavy word that SNAPS in with a width/weight morph and leaves at `out`
function snapWord(id, t0, out, { from = 'up', color = INK, top = 820, width = 980, wd0 = 50, wd1 = 100 } = {}) {
  const el = $(id); fitText(el, width, wd1); place(el, top, color);
  const y0 = from === 'up' ? 120 : from === 'down' ? -120 : 0, x0 = from === 'left' ? -500 : from === 'right' ? 500 : 0;
  tl.set(el, { autoAlpha: 0, '--wdth': wd0, '--wght': 300, y: y0, x: x0, skewX: from === 'left' ? -18 : from === 'right' ? 18 : 0, rotationX: 0 }, 0);
  tl.set(el, { autoAlpha: 1 }, t0);
  tl.to(el, { '--wdth': wd1, '--wght': 900, y: 0, x: 0, skewX: 0, duration: .32, ease: 'expo.out' }, t0);
  if (out !== undefined) tl.set(el, { autoAlpha: 0 }, out);
  return el;
}
function buildType() {
  // ---------------- HOOK (0.5–2.5)
  snapWord('w1', .5, .875, { from: 'up' });
  snapWord('w2', .875, 1.25, { from: 'left', color: OR });
  snapWord('w3', 1.25, 1.625, { from: 'right' });
  const w4 = snapWord('w4', 1.625, 2.5, { from: 'down', top: 620, width: 940 });
  tl.to(w4, { '--wdth': 58, '--wght': 700, duration: .22, ease: 'power3.inOut' }, 2.0).to(w4, { '--wdth': 100, '--wght': 900, duration: .2, ease: 'back.out(3)' }, 2.22);
  const w4s = $('w4s'); place(w4s, 1010, INK, 130); tl.set(w4s, { autoAlpha: 0, y: 30 }, 0).to(w4s, { autoAlpha: 1, y: 0, duration: .4, ease: 'expo.out' }, 1.85).set(w4s, { autoAlpha: 0 }, 2.5);
  // ---------------- S2 camera reveal (2.5–4.5)
  const m2 = $('m2'); place(m2, 230, CREAM); tl.set(m2, { autoAlpha: 0 }, 0).set(m2, { autoAlpha: 1 }, 2.7).set(m2, { autoAlpha: 0 }, 4.25);
  const t2 = $('t2'); fitText(t2, 900, 150, 800); place(t2, 1490, CREAM);
  tl.set(t2, { autoAlpha: 0, '--wdth': 50, y: 40 }, 0).set(t2, { autoAlpha: 1 }, 2.95).to(t2, { '--wdth': 150, y: 0, duration: .45, ease: 'expo.out' }, 2.95).to(t2, { autoAlpha: 0, y: -40, duration: .2, ease: 'power2.in' }, 4.2);
  const m2b = $('m2b'); place(m2b, 1650, OR); tl.set(m2b, { autoAlpha: 0 }, 0).to(m2b, { autoAlpha: 1, duration: .25 }, 3.25).set(m2b, { autoAlpha: 0 }, 4.25);
  // ---------------- S3 truchet + window (4.5–6.5)
  const m3 = $('m3'); place(m3, 150, CREAM); tl.set(m3, { autoAlpha: 0 }, 0).set(m3, { autoAlpha: 1 }, 4.75).set(m3, { autoAlpha: 0 }, 6.3);
  const t3 = $('t3'); fitText(t3, 960); place(t3, 1500, CREAM);
  tl.set(t3, { autoAlpha: 0, '--wdth': 50, '--wght': 400, scaleY: 1.6 }, 0).set(t3, { autoAlpha: 1 }, 5.0).to(t3, { '--wdth': 150, '--wght': 900, scaleY: 1, duration: .35, ease: 'expo.out' }, 5.0).set(t3, { autoAlpha: 0 }, 6.3);
  // ---------------- S4 particles (6.5–8.5)
  const m4 = $('m4'); place(m4, 150, CREAM); tl.set(m4, { autoAlpha: 0 }, 0).set(m4, { autoAlpha: 1 }, 6.7).set(m4, { autoAlpha: 0 }, 8.35);
  const t4 = $('t4'); fitText(t4, 960); place(t4, 1460, CREAM);
  tl.set(t4, { autoAlpha: 0, '--wdth': 50, letterSpacing: '0.3em' }, 0).set(t4, { autoAlpha: 1 }, 7.0).to(t4, { '--wdth': 150, letterSpacing: '0em', duration: .5, ease: 'expo.out' }, 7.0)
    .to(t4, { '--wght': 200, duration: .25, ease: 'power2.inOut' }, 7.75).to(t4, { '--wght': 900, duration: .25, ease: 'back.out(2)' }, 8.0).set(t4, { autoAlpha: 0 }, 8.4);
  const t4s = $('t4s'); place(t4s, 1600, OR, 84); tl.set(t4s, { autoAlpha: 0, y: 30 }, 0).to(t4s, { autoAlpha: 1, y: 0, duration: .4, ease: 'expo.out' }, 7.3).set(t4s, { autoAlpha: 0 }, 8.4);
  // ---------------- S5 shape morph words (8.5–10.5)
  for (const [id, t0, t1] of [['t5a', 8.75, 9.25], ['t5b', 9.25, 10.0], ['t5c', 10.0, 10.5]]) snapWord(id, t0, t1, { top: 1520, width: 760, from: 'up' });
  // ---------------- S6 big words (10.5–12.5)
  snapWord('t6a', 10.5, 11.0, { from: 'left', top: 760, width: 1000 });
  snapWord('t6b', 11.0, 11.5, { from: 'up', top: 760, width: 900 });
  snapWord('t6c', 11.5, 12.0, { from: 'right', top: 790, width: 1000, color: OR });
  snapWord('t6d', 12.0, 12.5, { from: 'down', top: 760, width: 940 });
  // ---------------- S7 hero (12.5–15)
  const t7 = $('t7'); fitText(t7, 900, 150, 800); place(t7, 1530, CREAM);
  tl.set(t7, { autoAlpha: 0, '--wdth': 50, y: 50 }, 0).set(t7, { autoAlpha: 1 }, 12.95).to(t7, { '--wdth': 150, y: 0, duration: .5, ease: 'expo.out' }, 12.95).to(t7, { autoAlpha: 0, duration: .15 }, 14.85);
  const t7s = $('t7s'); place(t7s, 1680, OR, 80); tl.set(t7s, { autoAlpha: 0, y: 30 }, 0).to(t7s, { autoAlpha: 1, y: 0, duration: .45, ease: 'expo.out' }, 13.3).to(t7s, { autoAlpha: 0, duration: .15 }, 14.85);
  // ---------------- S8 CTA (15–18)
  const c1 = snapWord('c1', 15.25, undefined, { top: 880, width: 1000, from: 'up', wd1: 72 });
  const c2 = $('c2'); fitText(c2, 760); place(c2, 1132, CREAM);
  tl.set(c2, { autoAlpha: 0, '--wdth': 50, scale: 1.4 }, 0).set(c2, { autoAlpha: 1 }, 15.75).to(c2, { '--wdth': 150, scale: 1, duration: .35, ease: 'expo.out' }, 15.75);
  for (const b of [16.5, 17.0, 17.5]) tl.to(c2, { scale: 1.06, duration: .06, ease: 'power2.out' }, b).to(c2, { scale: 1, duration: .3, ease: 'expo.out' }, b + .06);
  const c3 = $('c3'); place(c3, 1355, INK, 50); tl.set(c3, { autoAlpha: 0, y: 20 }, 0).to(c3, { autoAlpha: 1, y: 0, duration: .35, ease: 'expo.out' }, 16.25);
  const c4 = $('c4'); place(c4, 1440, INK, 64); tl.set(c4, { autoAlpha: 0, y: 20 }, 0).to(c4, { autoAlpha: 1, y: 0, duration: .4, ease: 'expo.out' }, 16.45);
  tl.set([c1, c2, c3, c4], { autoAlpha: 1 }, 17.99);
  const pl = $('plane'); pl.style.top = '1150px'; pl.style.left = '0px';
  tl.set(pl, { autoAlpha: 0, x: -200, y: 120, rotation: -20 }, 0).set(pl, { autoAlpha: 1 }, 16.0)
    .to(pl, { x: 870, y: -175, rotation: 8, duration: .55, ease: 'power3.out' }, 16.0)
    .to(pl, { y: -190, duration: .5, ease: 'sine.inOut', yoyo: true, repeat: 2 }, 16.6);
  // everything hidden on t ≤ 0
  tl.set({}, {}, 18.0);
}

// ================================================================== frame
const fxc = $('fx').getContext('2d');
const grains = [0, 1, 2, 3].map(k => { const d = fxc.createImageData(540, 960); for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * .013 + k * 91.7) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } return d; });
const glEl = $('gl');

async function setTime(t) {
  tl.seek(t, false);
  bg.setTransform(1, 0, 0, 1, 0, 0); bg.globalAlpha = 1;
  let useGL = false;

  // ---------------- S0 intro asterisk (0–0.5)
  if (t < .5) {
    fill(INK);
    const d = eOutBack(prog(t, 0, .14)), burst = eOutExpo(prog(t, .25, .45));
    bg.fillStyle = OR; bg.beginPath(); bg.arc(540, 900, Math.max(0, 26 * d * (1 - burst)), 0, Math.PI * 2); bg.fill();
    bg.strokeStyle = CREAM; bg.lineWidth = 3; bg.beginPath(); bg.arc(540, 900, lerp(60, 520, eOutExpo(prog(t, .05, .48))), 0, Math.PI * 2 * eOutExpo(prog(t, .05, .3))); bg.stroke();
    if (t > .25) asterisk(540, 900, 300, 12, t * 2 + burst * 1.2, 18, OR, burst, 40 * burst);
  }
  // ---------------- S1 hook fields (0.5–2.5)
  else if (t < 2.5) {
    fill(t < .875 ? OR : t < 1.25 ? INK : t < 1.625 ? CREAM : OR);
    if (t >= 1.625) asterisk(540, 1500, 240, 12, t * 1.5, 14, INK, eOutExpo(prog(t, 1.9, 2.2)), 30);
  }
  // ---------------- S2 camera iris reveal (2.5–4.5)
  else if (t < 4.5) {
    fill(INK);
    const g = eOutExpo(prog(t, 2.5, 2.9)), close = eInExpo(prog(t, 4.15, 4.5));
    const size = lerp(30, 470, g) * (1 - close * .96), n = lerp(2, 5.2, eInOutCubic(prog(t, 2.8, 3.5)));
    const rot = lerp(-.5, 0, eOutCubic(prog(t, 2.5, 3.3))) + close * .8;
    bg.save(); superellipsePath(540, 880, size, size, n, rot); bg.clip();
    fill('#000');
    const sc = lerp(.82, .74, prog(t, 2.5, 4.5)), px = lerp(1580, 1460, eInOutCubic(prog(t, 2.6, 4.3)));
    bg.drawImage(IMG.cam, 540 - px * sc, 880 - 470 * sc, IMG.cam.width * sc, IMG.cam.height * sc);
    bg.restore();
    bg.strokeStyle = OR; bg.lineWidth = 4; superellipsePath(540, 880, size + 22, size + 22, n, rot); bg.globalAlpha = g * (1 - close); bg.stroke(); bg.globalAlpha = 1;
    orbitDots(540, 880, size + 90, 16, t * .9, 9, OR, eOutCubic(prog(t, 2.7, 3.3)) * (1 - close));
  }
  // ---------------- S3 truchet + phone window (4.5–6.5)
  else if (t < 6.5) {
    const inv = t >= 5.5;
    truchet(t, inv ? INK : OR, inv ? OR : INK);
    const g = eOutExpo(prog(t, 4.55, 5.0)), ex = eInExpo(prog(t, 6.2, 6.5));
    const ww = lerp(560, 1200, ex), hh = lerp(0, 980, g) + ex * 1100, r = lerp(70, 0, ex);
    bg.save(); roundRectPath(540, 860, ww, hh, r); bg.clip(); fill('#050505');
    const s = 900 / IMG.pair.height, yy = lerp(900, 840, prog(t, 4.5, 6.5));
    bg.drawImage(IMG.pair, 540 - IMG.pair.width * s / 2, yy - IMG.pair.height * s / 2, IMG.pair.width * s, IMG.pair.height * s);
    bg.restore();
    bg.strokeStyle = CREAM; bg.lineWidth = 5; roundRectPath(540, 860, ww + 14, hh + 14, r + 7); bg.globalAlpha = g * (1 - ex); bg.stroke(); bg.globalAlpha = 1;
  }
  // ---------------- S4 particle iPhone (6.5–8.5) — Three.js
  else if (t < 8.5) {
    useGL = true; hero.visible = false; particleGroup.visible = true;
    const u = t - 6.5;
    particleGroup.rotation.set(.18 + .08 * Math.sin(u * 1.4), Math.PI + .5 - u * 1.9 + Math.PI * eInOutCubic(prog(t, 7.4, 8.1)), .05);
    pMat.uniforms.uMorph.value = eInOutCubic(prog(t, 7.45, 7.75)) * (1 - eInOutCubic(prog(t, 7.85, 8.15)));
    pMat.uniforms.uCollapse.value = eInExpo(prog(t, 8.3, 8.5));
    pMat.uniforms.uTime.value = t; pMat.uniforms.uA.value = clamp(prog(t, 6.5, 6.7) * 1.2);
    camera.position.set(0, .05, lerp(5.2, 4.4, eOutCubic(prog(t, 6.5, 8.3)))); camera.lookAt(0, .15, 0);
    bloom.strength = .85;
  }
  // ---------------- S5 shape morph (8.5–10.5)
  else if (t < 10.5) {
    fill(CREAM);
    const ks = [[8.5, 'circle', 'circle'], [9.0, 'circle', 'tri'], [9.5, 'tri', 'star'], [10.0, 'star', 'phone']];
    let A = SH.circle, B = SH.circle, k = 1;
    for (const [tb, a, b] of ks) if (t >= tb) { A = SH[a]; B = SH[b]; k = eOutBack(prog(t, tb, tb + .32)); }
    const appear = eOutBack(prog(t, 8.5, 8.75)), ex = eInExpo(prog(t, 10.3, 10.5));
    const s = appear * (1 + ex * 4.5), rot = t < 10.0 ? (t - 8.5) * .5 : (1 - eOutCubic(prog(t, 10.0, 10.3))) * .75;
    bg.fillStyle = INK; morphPath(A, B, k, 540, 860, s, rot); bg.fill();
    if (t >= 10.0) {        // the final phone shape is filled by the real iPhone front
      bg.save(); morphPath(A, B, k, 540, 860, s, rot); bg.clip();
      const ph = 300 * 2.9 * s; bg.globalAlpha = eOutCubic(prog(t, 10.05, 10.25));
      bg.translate(540, 860); bg.rotate(rot); bg.drawImage(IMG.front, -ph * 825 / 1700 / 2, -ph / 2, ph * 825 / 1700, ph); bg.restore(); bg.globalAlpha = 1;
    }
    orbitDots(540, 860, 430 * s, 12, -(t - 8.5) * 1.3, 11, OR, eOutCubic(prog(t, 8.55, 8.95)) * (1 - ex));
  }
  // ---------------- S6 big word fields (10.5–12.5)
  else if (t < 12.5) {
    fill(t < 11 ? WHITE : t < 11.5 ? OR : t < 12 ? INK : CREAM);
    // a single orange bar sweeps under each word, in time with it
    const t0 = 10.5 + Math.floor((t - 10.5) / .5) * .5, p = eOutExpo(prog(t, t0, t0 + .35));
    bg.fillStyle = t >= 11.0 && t < 11.5 ? INK : OR; bg.fillRect(540 - 470 * p, 1110, 940 * p, 18);
  }
  // ---------------- S7 hero 3D (12.5–15) — Three.js
  else if (t < 15) {
    useGL = true; hero.visible = true; particleGroup.visible = false;
    const u = eInOutCubic(prog(t, 12.5, 15.0));
    camera.position.set(lerp(-.7, .55, u), lerp(.45, .15, u), lerp(5.6, 4.6, u)); camera.lookAt(0, -.15, 0);
    pairMesh.rotation.y = lerp(.12, -.08, u); reflMesh.rotation.y = pairMesh.rotation.y;
    cone.material.uniforms.uA.value = clamp(prog(t, 12.5, 12.62)) * (1 + .4 * pulse(t, 12.55, .02, .3)); cone.material.uniforms.uTime.value = t;
    burstMesh.rotation.z = -t * .35; burstMesh.material.opacity = .45 * clamp(prog(t, 12.6, 13.0));
    dust.rotation.y = t * .08;
    const fadeOut = eInExpo(prog(t, 14.75, 15.0));
    pairMesh.material.opacity = 1 - fadeOut; bloom.strength = .55;
  }
  // ---------------- S8 CTA (15–18)
  else {
    fill(OR);
    const e = eOutExpo(prog(t, 15.0, 15.45));
    const kick = [16.5, 17.0, 17.5].reduce((a, b) => a + eOutCubic(prog(t, b, b + .3)) * .52, 0);
    asterisk(540, 560, lerp(40, 250, e), 12, -t * .6 + e * 1.5 + kick, 22, INK, 1, lerp(5, 46, e));
    // black slab behind "POŠALJI DM"
    const p = eOutExpo(prog(t, 15.7, 16.0));
    bg.fillStyle = INK; bg.beginPath(); bg.roundRect(540 - 480 * p, 1080, 960 * p, 210, 105 * p); bg.fill();
    // trail of the paper plane
    const tp = prog(t, 16.0, 16.55);
    if (tp > 0) { bg.strokeStyle = INK; bg.lineWidth = 4; bg.setLineDash([14, 14]); bg.beginPath(); bg.moveTo(-100, 1330); bg.quadraticCurveTo(380, 1360, lerp(-100, 900, eOutCubic(tp)), lerp(1330, 1030, eOutCubic(tp))); bg.globalAlpha = 1 - prog(t, 16.6, 17.2); bg.stroke(); bg.setLineDash([]); bg.globalAlpha = 1; }
  }

  if (useGL) {
    glEl.style.visibility = 'visible';
    composer.render();
  } else glEl.style.visibility = 'hidden';

  // cut flashes
  let fl = 0; for (const [tc, s] of CUTS) fl += s * pulse(t, tc, .008, .07);
  $('flash').style.opacity = Math.min(.85, fl).toFixed(3);
  fxc.putImageData(grains[Math.floor(t * 30) % 4], 0, 0);
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

async function boot() {
  await document.fonts.load('900 100px "Anybody Variable"', 'ĆČŠŽĐćčšž?'); await document.fonts.load('italic 500 100px "Cormorant Garamond"'); await document.fonts.load('500 30px "JetBrains Mono"');
  await document.fonts.ready;
  IMG = { cam: await load('assets/cam.jpg'), pair: await load('assets/pair.png'), front: await load('assets/front.png') };
  buildHero(); buildType();
  window.setTime = setTime; await setTime(0); window.READY = true;
}
boot();
