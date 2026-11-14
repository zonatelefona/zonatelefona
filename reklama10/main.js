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
let ip, ipR, s26, s26R, air, airR;
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

// ================================================================== typography (GSAP, one timeline seeked per frame)
const tl = gsap.timeline({ paused: true });
function FT(tg, from, to, at) { tl.set(tg, from, 0); return tl.fromTo(tg, from, { ...to, immediateRender: false }, at); }
const typeEl = $('type');
function measureW(html, cls, fs, ls = 0) {
  const sp = document.createElement('span'); sp.className = cls; sp.innerHTML = html;
  sp.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;font-size:${fs}px;letter-spacing:${ls}em`;
  document.body.appendChild(sp); const w = sp.getBoundingClientRect().width; sp.remove(); return w;
}
// a centred line: words → <span class=w>, characters → <span class=ch> (optionally masked); `o:` prefix makes a word Claude Orange
function line(id, words, { cls = 'anton', size = 170, maxW = 920, y = CY, mask = false } = {}) {
  const el = document.createElement('div'); el.id = id; el.className = 'ln ' + cls; typeEl.appendChild(el);
  const html = words.map((w, i) => {
    const or = w.startsWith('o:'), txt = or ? w.slice(2) : w;
    const chs = [...txt].map(c => `<span class="ch">${c}</span>`).join('');
    return `<span class="w${or ? ' o' : ''}">${mask ? `<span class="mk">${chs}</span>` : chs}</span>`;
  }).join('<span class="sp"> </span>');
  el.innerHTML = html;
  const plain = words.map(w => w.replace(/^o:/, '')).join(' ');
  const fs = Math.min(size, size * maxW / measureW(plain, el.className.replace('ln ', ''), size));
  el.style.fontSize = fs.toFixed(1) + 'px';
  el.style.top = (y - el.offsetHeight / 2) + 'px';
  el.dataset.text = plain;
  return { el, words: [...el.querySelectorAll('.w')], chars: [...el.querySelectorAll('.ch')], fs };
}
const show = (el, t) => tl.set(el, { autoAlpha: 0 }, 0).set(el, { autoAlpha: 1 }, t);
const hide = (el, t, d = .3, y = -40) => { tl.to(el, { autoAlpha: 0, y, duration: d, ease: 'power2.in' }, t); };
const LINES = [];
function buildType() {
  // ---- S1 HOOK
  const pov = line('pov', ['POV:'], { cls: 'mont', size: 120, y: 720 }); show(pov.el, T.pov);
  FT(pov.el, { '--ls': pov.fs * .7, autoAlpha: 0 }, { '--ls': pov.fs * .04, autoAlpha: 1, duration: .7, ease: 'expo.out' }, T.pov);
  const us = line('usao', ['UŠAO', 'SI', 'o:SAMO'], { size: 200, y: 905, mask: true }); show(us.el, T.usao);
  const [uw1, uw2, uw3] = us.words;
  FT([...uw1.querySelectorAll('.ch'), ...uw2.querySelectorAll('.ch')], { yPercent: 110 }, { yPercent: 0, duration: .5, ease: 'expo.out', stagger: .025 }, T.usao);
  FT(uw3, { scale: 2.1, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .55, ease: 'back.out(1.6)' }, T.usao + .22);
  const pg = line('pogledas', ['DA', 'POGLEDAŠ…'], { size: 200, y: 1110 }); show(pg.el, T.pogledas);
  FT(pg.el, { scale: 1.45, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .38, ease: 'expo.out' }, T.pogledas);
  for (const l of [pov, us, pg]) tl.to(l.el, { scale: 1.12, autoAlpha: 0, duration: .28, ease: 'power2.in' }, T.s1out);
  // ---- S2 first temptation
  const ao = line('aliOnda', ['ALI', 'ONDA…'], { size: 170, y: 400, mask: true }); show(ao.el, T.aliOnda);
  FT(ao.chars, { yPercent: 110 }, { yPercent: 0, duration: .55, ease: 'expo.out', stagger: .03 }, T.aliOnda); hide(ao.el, T.aliOut, .25);
  const vs = line('videoSi', ['VIDEO', 'SI', 'o:OVAJ.'], { size: 175, y: 400, mask: true }); show(vs.el, T.video);
  const [vw1, vw2, vw3] = vs.words;
  FT([...vw1.querySelectorAll('.ch'), ...vw2.querySelectorAll('.ch')], { yPercent: 110 }, { yPercent: 0, duration: .45, ease: 'expo.out', stagger: .025 }, T.video);
  FT(vw3, { scale: 1.9, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .5, ease: 'back.out(1.7)' }, T.video + .25);
  tl.to(vs.el, { x: -700, skewX: 18, autoAlpha: 0, duration: .32, ease: 'power3.in' }, T.s2out);
  // ---- S3 falling for the phones
  const is = line('iSad', ['I', 'SAD…'], { size: 190, y: 380 }); show(is.el, T.iSad);
  FT(is.el, { '--ls': is.fs * .5, autoAlpha: 0 }, { '--ls': is.fs * .005, autoAlpha: 1, duration: .7, ease: 'expo.out' }, T.iSad); hide(is.el, T.iSadOut, .25);
  const nm = line('nemozes', ['NE', 'MOŽEŠ', 'DA'], { size: 150, y: 330, mask: true }); show(nm.el, T.nemozes);
  FT(nm.chars, { yPercent: 110 }, { yPercent: 0, duration: .5, ease: 'expo.out', stagger: .025 }, T.nemozes);
  const pr = line('prestanes', ['PRESTANEŠ'], { size: 230, y: 505 }); show(pr.el, T.prestanes);
  FT(pr.el, { '--ls': pr.fs * .35, scale: 1.08, autoAlpha: 0 }, { '--ls': pr.fs * .005, scale: 1, autoAlpha: 1, duration: .6, ease: 'expo.out' }, T.prestanes);
  const gl = line('gledas', ['DA', 'o:GLEDAŠ.'], { size: 150, y: 690, mask: true }); show(gl.el, T.gledas);
  FT(gl.chars, { yPercent: 110 }, { yPercent: 0, duration: .5, ease: 'expo.out', stagger: .03 }, T.gledas);
  for (const l of [nm, pr, gl]) tl.to(l.el, { autoAlpha: 0, scale: .96, duration: .3, ease: 'power2.in' }, T.s3out);
  // ---- S4 the joke
  const rk = line('rekao', ['REKAO', 'SI:'], { cls: 'mont', size: 84, y: 330, mask: true }); show(rk.el, T.rekao);
  FT(rk.chars, { yPercent: 110 }, { yPercent: 0, duration: .45, ease: 'expo.out', stagger: .02 }, T.rekao);
  const sg = line('samoGledam', ['SAMO', 'GLEDAM.'], { size: 190, y: 475 }); show(sg.el, T.samoGledam);
  FT(sg.el, { '--ls': sg.fs * .12, autoAlpha: 0, y: 14 }, { '--ls': sg.fs * .005, autoAlpha: 1, y: 0, duration: .8, ease: 'power2.out' }, T.samoGledam);
  for (const l of [rk, sg]) tl.to(l.el, { autoAlpha: 0, y: 30, duration: .22, ease: 'power2.in' }, T.s4textOut);
  const dn = line('daNaravno', ['DA,', 'o:NARAVNO.'], { size: 210, y: 420 }); show(dn.el, T.punch);
  FT(dn.el, { scale: 1.7, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .42, ease: 'back.out(1.5)' }, T.punch);
  const em = document.createElement('div'); em.id = 'emoji'; em.className = 'ln'; em.innerHTML = '<span class="emoji">😂</span>'; typeEl.appendChild(em);
  em.style.fontSize = '190px'; em.style.top = (630 - em.offsetHeight / 2) + 'px'; em.dataset.text = '😂'; show(em, T.emoji);
  const es = em.firstChild;
  FT(es, { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: .6, ease: 'elastic.out(1,.55)' }, T.emoji);
  tl.to(es, { rotation: 8, duration: .14, ease: 'sine.inOut', yoyo: true, repeat: 3 }, T.emoji + .65);
  for (const l of [dn.el, em]) tl.to(l, { autoAlpha: 0, x: -500, duration: .32, ease: 'power3.in' }, T.s4out);
  // ---- S5 which one?
  const kj = line('koji', ['KOJI', 'BI', 'TI', 'UZEO?'], { size: 160, y: 335, mask: true }); show(kj.el, T.koji);
  FT(kj.chars, { yPercent: 110 }, { yPercent: 0, duration: .5, ease: 'expo.out', stagger: .022 }, T.koji);
  const br = line('brojevi', ['o:1,', 'o:2', 'ILI', 'o:3?'], { size: 170, y: 505 }); show(br.el, T.brojevi);
  FT(br.words, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .45, ease: 'back.out(2)', stagger: .12 }, T.brojevi);
  for (const l of [kj, br]) tl.to(l.el, { autoAlpha: 0, y: -30, duration: .3, ease: 'power2.in' }, T.s5out);
  // number badges above the three phones
  BADGES.forEach((b, i) => {
    const el = document.createElement('div'); el.className = 'ln anton'; el.id = 'badge' + (i + 1); el.dataset.text = String(i + 1);
    el.innerHTML = `<span class="w" style="display:inline-flex;align-items:center;justify-content:center;width:120px;height:120px;border-radius:60px;border:4px solid ${OR};background:rgba(10,10,11,.75);font-size:78px;line-height:1">${i + 1}</span>`;
    el.style.left = (b.x - 540) + 'px'; el.style.right = (540 - b.x) + 'px'; el.style.top = (b.y - 60) + 'px'; typeEl.appendChild(el);
    show(el, T['n' + (i + 1)]); FT(el.firstChild, { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: .5, ease: 'back.out(2.2)' }, T['n' + (i + 1)]);
    tl.to(el, { autoAlpha: 0, scale: .6, duration: .25, ease: 'power2.in' }, T.s5out + i * .04);
    LINES.push({ el, text: String(i + 1) });
  });
  // ---- S6 brand
  const zo = line('zona', ['ZONA'], { size: 430, maxW: 800, y: 760 }); show(zo.el, T.logo);
  FT(zo.el, { '--ls': zo.fs * .35, autoAlpha: 0, scale: .92 }, { '--ls': zo.fs * .02, autoAlpha: 1, scale: 1, duration: 1.0, ease: 'expo.out' }, T.logo);
  const te = line('telefona', ['TELEFONA'], { cls: 'mont8', size: 70, y: 1000 }); show(te.el, T.logo + .3);
  FT(te.el, { '--ls': te.fs * 1.0, '--pl': te.fs * 1.0, autoAlpha: 0 }, { '--ls': te.fs * .5, '--pl': te.fs * .5, autoAlpha: 1, duration: 1.0, ease: 'expo.out' }, T.logo + .3);
  const z1 = line('zaprati1', ['ZAPRATI', 'ZA', 'SVOJ'], { cls: 'mont', size: 74, y: 1160, mask: true }); show(z1.el, T.zaprati);
  FT(z1.chars, { yPercent: 110 }, { yPercent: 0, duration: .5, ease: 'expo.out', stagger: .018 }, T.zaprati);
  const z2 = line('zaprati2', ['o:SLEDEĆI', 'TELEFON.'], { cls: 'mont', size: 74, y: 1250, mask: true }); show(z2.el, T.zaprati + .2);
  FT(z2.chars, { yPercent: 110 }, { yPercent: 0, duration: .5, ease: 'expo.out', stagger: .018 }, T.zaprati + .2);
  const hd = line('handle', ['@zona.telefona'], { cls: 'mont8', size: 62, y: 1365 }); show(hd.el, T.handle);
  FT(hd.el, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: .6, ease: 'expo.out' }, T.handle);
  const ru = line('ruma', ['RUMA'], { cls: 'mont6', size: 42, y: 1440 }); show(ru.el, T.ruma);
  ru.el.style.color = '#BDB9B4';
  FT(ru.el, { '--ls': ru.fs * 1.0, '--pl': ru.fs * 1.0, autoAlpha: 0 }, { '--ls': ru.fs * .5, '--pl': ru.fs * .5, autoAlpha: 1, duration: .8, ease: 'expo.out' }, T.ruma);
  for (const l of [pov, us, pg, ao, vs, is, nm, pr, gl, rk, sg, dn, kj, br, zo, te, z1, z2, hd, ru]) LINES.push({ el: l.el, text: l.el.dataset.text });
  LINES.push({ el: em, text: '😂' });
  tl.set({}, {}, T.end);
}
const BADGES = [{ x: 205, y: 700 }, { x: 540, y: 700 }, { x: 875, y: 700 }];

// ================================================================== frame
const fxc = $('fx').getContext('2d');
const grains = [0, 1, 2, 3].map(k => { const d = fxc.createImageData(540, 960); for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * .013 + k * 91.7) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } return d; });
const glEl = $('gl'), stage = $('stage');
// plateau footage: slow silhouette in the hook, then a speed-ramped orbit (macro → profile → screen)
function plSrc(t) { if (t < T.s2) return .15 + t * (2.35 / T.s2); const u = clamp((t - T.s2) / 4); return 2.5 + 7.0 * (.35 * u + .65 * u * u); }
function shake(t, t0, amp = 10, dec = .22) { const k = t < t0 ? 0 : Math.exp(-(t - t0) / dec); return [Math.sin((t - t0) * 61) * amp * k, Math.cos((t - t0) * 53) * amp * .6 * k]; }

async function setTime(t) {
  tl.seek(t, false);
  for (const c of [bg, fg]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.globalCompositeOperation = 'source-over'; }
  bg.fillStyle = '#060607'; bg.fillRect(0, 0, W, H); fg.clearRect(0, 0, W, H);
  for (const o of [ip, ipR, s26, s26R, air, airR]) o.g.visible = false;
  lightRig.visible = false;
  let useGL = false, camShake = [0, 0];

  // ---------------- S1 + S2: one continuous move on the real iPhone 17 Pro footage (0 – 7.0)
  if (t < T.s3 + .05) {
    const img = await PL.get(plSrc(t));
    // camera: slow dolly-in on the silhouette → macro → punch-in on "OVAJ." → pull back as it turns to the screen
    let s, ax, ay;
    if (t < T.s2) { s = lerp(1.42, 1.72, eInOutSine(prog(t, 0, T.s2))); ax = 780; ay = 455; }
    else {
      const a = eInOutSine(prog(t, T.s2, 5.35)), p = eOutExpo(prog(t, T.push, T.push + .5)), b = eInOutCubic(prog(t, 5.95, 6.9));
      s = lerp(lerp(1.72, 1.5, a) + .22 * p, 1.08, b); ax = lerp(lerp(780, 950, a), 975, b); ay = lerp(lerp(455, 470, a), 640, b);
    }
    const hx = noise1(t * .8) * 7, hy = noise1(t * .7 + 4) * 5;                 // controlled handheld feel
    const whip = eInCubic(prog(t, T.s2out, T.s3));
    camShake = shake(t, T.pogledas, 9, .2);
    plate(bg, img, ax, ay, s, { sx: CX + hx - whip * 1100, sy: 1010 + hy, smear: -whip * 320, feather: 300 });
    if (t >= T.s2 - .2) sweep(fg, 3.3, 4.6, t, .1, 300);
  }
  // ---------------- S3a: macro of the Cosmic Orange camera (real photo), tracking across the lenses (6.8 – 8.6)
  if (t >= T.s2out + .1 && t < T.s26 + .2) {
    const enter = 1 - eOutCubic(prog(t, T.s2out + .1, T.s3 + .2)), leave = eInCubic(prog(t, T.s26 - .1, T.s26 + .2));
    const u = eInOutSine(prog(t, T.s3, T.s26));
    const rack = 18 * (1 - eOutCubic(prog(t, T.s3 - .05, T.s3 + .45))) + 12 * leave;
    plate(bg, IMG.cam, lerp(1700, 1080, u), lerp(470, 430, u), lerp(.74, .86, u), { sx: CX + enter * 900 - leave * 900, sy: 1040, blur: rack, smear: (enter - leave) * 260, feather: 280 });
    sweep(fg, T.s3 + .2, T.s26, t, .14, 220);
  }
  // ---------------- S3b: Galaxy S26 Ultra — tracking in, turning (three real angles), macro push on the camera array (8.45 – 10.25)
  if (t >= T.s26 - .1 && t < T.air + .2) {
    useGL = true; lightRig.visible = true; studio(bg, clamp(prog(t, T.s26 - .1, T.s26 + .15)));
    // turntable from the three real angles: right 30° → straight → left 30° → back to straight for the macro push
    const p = eOutExpo(prog(t, T.s26 - .05, T.s26 + .7)), turn = Math.cos(Math.PI * 1.5 * eInOutSine(prog(t, T.s26, 9.75)));
    const macro = eInOutCubic(prog(t, 9.62, T.air + .15)), out = clamp(prog(t, T.air - .05, T.air + .2));
    // background: the iPhone Air out of focus (rack focus / parallax depth)
    bg.save(); bg.filter = 'blur(16px)'; bg.globalAlpha = .38 * p * (1 - macro); const ah = 900;
    bg.drawImage(IMG.air, 200 - (1 - p) * 200 - turn * 30 - ah * IMG.air.width / IMG.air.height / 2, 560, ah * IMG.air.width / IMG.air.height, ah); bg.restore();
    pool(bg, CX, 1520, 520, 140, 'rgba(255,245,235,.10)', 1);
    cone.material.uniforms.uA.value = .8 * (1 - macro); cone.material.uniforms.uTime.value = t; floorSpot.material.uniforms.uA.value = (1 - macro);
    const h = lerp(980, 2600, macro), x = lerp(CX + (1 - p) * 760 + turn * 18, CX + .11 * h, macro), y = lerp(1060, CY + .33 * h, macro);   // macro lands on the camera array
    const w = [clamp(turn), 1 - Math.abs(turn), clamp(-turn)];
    s26.set({ x, y, h, ry: turn * .16, w, sweep: lerp(-.3, 1.3, prog(t, 9.1, 9.9)), sweepA: .9, a: 1 - out });
    const fl = sy(1060) - 980 / 2 - 10; floorSpot.position.y = fl;
    s26R.set({ x, y: 0, h, ry: turn * .16, w, a: (1 - macro) * (1 - out) }); s26R.g.position.y = 2 * fl - s26.g.position.y; s26R.g.scale.y *= -1; s26R.refl(true, fl);
  }
  // ---------------- S3c: iPhone Air — real macro footage of the plateau (10.1 – 12.0)
  if (t >= T.air - .05 && t < T.s4 + .05) {
    const img = await AP.get(clamp((t - T.air) * 1.25, 0, 2.6));
    const inn = eOutCubic(prog(t, T.air - .05, T.air + .3)), out = eInCubic(prog(t, T.s3out, T.s4));
    plate(bg, img, lerp(640, 1020, eInOutSine(prog(t, T.air, T.s4))), 600, lerp(.86, .96, prog(t, T.air, T.s4)),
      { sx: CX, sy: 1250, alpha: .8 * inn * (1 - out), blur: 14 * (1 - inn) + 16 * out, feather: 300 });
    sweep(fg, T.air + .3, T.s3out, t, .12, 240);
  }
  // ---------------- S4: the joke — one hero phone, slow turn, sudden smooth push-in (12.0 – 17.0)
  if (t >= T.s4 - .05 && t < T.s5 + .9) {
    useGL = true; lightRig.visible = true;
    const inn = clamp(prog(t, T.s4 - .05, T.s4 + .35)); studio(bg, inn);
    const push = eInOutExpo(prog(t, T.s4push, T.punch)), toLine = eInOutCubic(prog(t, T.s4out, T.s5 + .9));
    camShake = shake(t, T.punch, 12, .16);
    pool(bg, CX, 1500, 560, 150, 'rgba(255,245,235,.09)', inn * (1 - toLine));
    cone.material.uniforms.uA.value = inn * (1 - toLine * .6); cone.material.uniforms.uTime.value = t; floorSpot.material.uniforms.uA.value = inn;
    // ends exactly on the S5 pose of slot 1 (x 250, y 1080, h 640, ry π+.17) so the hand-over is seamless
    const ry = Math.PI + lerp(.55, -.35, eInOutSine(prog(t, T.s4, T.tapeStop))) - .35 * eInOutSine(prog(t, T.punch, T.s4out)) + .87 * toLine;
    const h = lerp(lerp(940, 1260, push), 620, toLine), x = lerp(CX, BADGES[0].x, toLine), y = lerp(lerp(1065, 1290, push), 1090, toLine);
    const float = Math.sin(t * 1.2) * 6 * (1 - push);
    ip.front.material.uniforms.map.value = TEX.front;
    ip.set({ x: x + camShake[0], y: y + float + camShake[1], h, rx: .04, ry, sweep: lerp(-.35, 1.35, eInOutSine(prog(t, 12.7, 13.9))), sweepA: .7, a: inn });
    const fl = sy(lerp(1065, 1090, toLine)) - lerp(940, 620, toLine) / 2 - 10; floorSpot.position.y = fl;
    ipR.front.material.uniforms.map.value = TEX.front;
    ipR.set({ x, y: 0, h, rx: -.04, ry, a: inn * (1 - push) + inn * toLine }); ipR.g.position.y = 2 * fl - ip.g.position.y; ipR.g.scale.y *= -1; ipR.refl(true, fl);
    ipR.g.visible = (1 - push) + toLine > .02;
  }
  // ---------------- S5: the line-up — tracking shot that settles on all three (17.0 – 21.0)
  if (t >= T.s4out && t < T.s6 + 1.0) {
    useGL = true; lightRig.visible = true; studio(bg, 1);
    const k = eOutCubic(prog(t, T.s4out + .1, T.s5 + 1.25)), k3 = eOutCubic(prog(t, T.s4out + .25, T.s5 + 1.4));
    const dim1 = .55 * clamp(prog(t, T.s5out, T.s6)), fin = eInOutCubic(prog(t, T.s6, T.s6 + .9)), gone = eInOutCubic(prog(t, T.s6 + .45, T.logo + .35));
    const hl = i => Math.max(0, Math.sin(Math.PI * prog(t, T['n' + (i + 1)], T['n' + (i + 1)] + .6)));
    for (let i = 0; i < 3; i++) pool(bg, BADGES[i].x, 1415, 200, 60, 'rgba(255,245,235,.12)', (1 - dim1) * (i === 1 ? 1 : 1) * clamp(k * 2 - i * .3));
    cone.material.uniforms.uA.value = .55 * (1 - fin); floorSpot.material.uniforms.uA.value = (1 - fin);
    const fl = sy(1090) - 310 - 10; floorSpot.position.y = fl;
    if (t >= T.s5 + .9) {   // the iPhone from S4 has arrived at slot 1 (S4 animates it there)
      ip.front.material.uniforms.map.value = TEX.front;
      ip.set({ x: BADGES[0].x - fin * 120, y: 1090, h: 620, rx: .03, ry: Math.PI + .17, sweep: lerp(-.3, 1.3, prog(t, T.n1, T.n1 + .6)), sweepA: hl(0), dim: Math.max(dim1, fin), a: 1 - gone });
      ipR.front.material.uniforms.map.value = TEX.front;
      ipR.set({ x: BADGES[0].x - fin * 120, y: 0, h: 620, rx: -.03, ry: Math.PI + .17, a: 1 - gone }); ipR.g.position.y = 2 * fl - ip.g.position.y; ipR.g.scale.y *= -1; ipR.refl(true, fl);
    }
    const x2 = lerp(BADGES[1].x + 900, BADGES[1].x, k), x3 = lerp(BADGES[2].x + 900, BADGES[2].x, k3);
    const h2 = lerp(630, 420, fin), y2 = lerp(1090, 1000, fin);
    s26.set({ x: x2, y: y2, h: h2, ry: -.05, w: [0, 1, 0], sweep: lerp(-.3, 1.3, prog(t, T.n2, T.n2 + .6)), sweepA: hl(1), a: 1 - gone });
    s26R.set({ x: x2, y: 0, h: h2, ry: -.05, w: [0, 1, 0], a: (1 - fin) * (1 - gone) }); s26R.g.position.y = 2 * fl - s26.g.position.y; s26R.g.scale.y *= -1; s26R.refl(true, fl);
    air.set({ x: x3 + fin * 120, y: 1090, h: 620, ry: .02, w: [1], sweep: lerp(-.3, 1.3, prog(t, T.n3, T.n3 + .6)), sweepA: hl(2), dim: Math.max(dim1, fin), a: 1 - gone });
    airR.set({ x: x3 + fin * 120, y: 0, h: 620, ry: .02, w: [1], a: 1 - gone }); airR.g.position.y = 2 * fl - air.g.position.y; airR.g.scale.y *= -1; airR.refl(true, fl);
    // the last phone leaves through a thin line of light that becomes the logo rule
    if (gone > 0) { fg.save(); fg.globalCompositeOperation = 'lighter'; const lw = lerp(0, 460, eOutCubic(prog(t, T.s6 + .5, T.logo + .4))), a = Math.sin(Math.PI * prog(t, T.s6 + .5, T.logo + .8));
      const g = fg.createLinearGradient(CX - lw, 0, CX + lw, 0); g.addColorStop(0, 'rgba(217,119,87,0)'); g.addColorStop(.5, `rgba(255,236,224,${.85 * a})`); g.addColorStop(1, 'rgba(217,119,87,0)');
      fg.fillStyle = g; fg.fillRect(CX - lw, 936 - 1, 2 * lw, 4); fg.restore(); }
  }
  // ---------------- S6: brand reveal on pure black (21.0 – 25.0)
  if (t >= T.s6) {
    const a = clamp(prog(t, T.logo - .1, T.logo + .5));
    zoneMark(bg, CX, 470, 50, a, prog(t, T.logo, T.logo + 1.2));
    const lw = 300 * eOutCubic(prog(t, T.logo + .35, T.logo + 1.1));
    if (lw > 0) { bg.fillStyle = OR; bg.fillRect(CX - lw, 936, 2 * lw, 3); }
    pool(bg, CX, 900, 620, 420, 'rgba(255,240,230,.05)', a);
  }

  stage.style.transform = `translate(${camShake[0].toFixed(2)}px,${camShake[1].toFixed(2)}px)`;
  if (useGL) { glEl.style.visibility = 'visible'; renderer.render(scene, camera); } else glEl.style.visibility = 'hidden';
  fxc.putImageData(grains[Math.floor(t * 24) % 4], 0, 0);
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

const TEX = {};
async function boot() {
  await Promise.all([document.fonts.load('400 100px "Anton"', 'ŠĐČĆŽšđčćž…'), document.fonts.load('900 60px "Montserrat"', 'ŠĆ'), document.fonts.load('800 60px "Montserrat"'),
    document.fonts.load('600 40px "Montserrat"'), document.fonts.load('100px "Noto Color Emoji"', '😂')]);
  await document.fonts.ready;
  const L = n => load('assets/' + n);
  IMG = { front: await L('front.png'), back: await L('back.png'), cam: await L('cam.jpg'), s26: await L('s26_back.png'), s26r: await L('s26_back_r30.png'),
    s26l: await L('s26_back_l30.png'), air: await L('air_black.png'), silver: await L('back_silver.png') };
  TEX.front = texOf(IMG.front); TEX.back = texOf(IMG.silver);
  ip = new Phone(TEX.front, TEX.back); ipR = new Phone(TEX.front, TEX.back);
  s26 = new Card([IMG.s26r, IMG.s26, IMG.s26l]); s26R = new Card([IMG.s26r, IMG.s26, IMG.s26l]);
  air = new Card([IMG.air]); airR = new Card([IMG.air]);
  buildType();
  window.setTime = setTime; window.__tl = tl; window.__LINES = LINES;
  await setTime(0); window.READY = true;
}
boot();
