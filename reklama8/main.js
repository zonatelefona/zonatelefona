// ZONA TELEFONA v8 — motion design spot (20 s, 1080×1920, rendered at 120 fps → blended to 60 fps with motion blur)
// Phones are real cut-outs living in a Three.js scene (true perspective, 3D flip with a metal edge), never shown through a frame.
// Deterministic: setTime(t) draws exactly the frame at time t.
import * as THREE from 'three';
import { gsap } from 'gsap';
import T from './timeline.json' with { type: 'json' };   // shared with audio.py

const W = 1080, H = 1920, CX = 540, CY = 960;
const OR = '#D97757', INK = '#0A0A0A', CREAM = '#F4E9DC';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eOutCubic = x => 1 - Math.pow(1 - x, 3);
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eInOutQuart = x => x < .5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2;
const eInOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInCubic = x => x * x * x;
const eInBack = x => { const c = 1.6; return (c + 1) * x ** 3 - c * x * x; };
// damped spring 0→1 (overshoots once, settles) — used for every "pop"
const spring = (t, f = 2.0, z = .55) => { if (t <= 0) return 0; const w = 2 * Math.PI * f, wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t)); };
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const $ = id => document.getElementById(id);
const load = s => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = s; });

let IMG = {};

// ================================================================== Canvas2D background layer
const bg = $('bgc').getContext('2d');
function fill(c) { bg.fillStyle = c; bg.fillRect(0, 0, W, H); }
// colour reveals: a circle grows from the centre, or a huge circle sweeps in from top/bottom (curved wipe). Always eased in-out.
const REV = [];
function reveal(t0, dur, color, from = 'c', lead = null) { REV.push({ t0, dur, color, from, lead }); }
function drawReveals(t, base) {
  let cur = base; const act = [];
  for (const r of REV) { if (t >= r.t0 + r.dur) cur = r.color; else if (t >= r.t0) act.push(r); }
  fill(cur);
  for (const r of act) {
    const draw = (p, col) => {
      if (p <= 0) return; bg.fillStyle = col; bg.beginPath();
      if (r.from === 'c') bg.arc(CX, CY, p * 1110, 0, Math.PI * 2);
      else { const R = 5200, cy = r.from === 'b' ? H + R : -R, sag = R - Math.sqrt(R * R - CX * CX); const d = p * (H + sag + 30); bg.arc(CX, r.from === 'b' ? cy - d : cy + d, R, 0, Math.PI * 2); }
      bg.fill();
    };
    const p = eInOutCubic(prog(t, r.t0, r.t0 + r.dur));
    if (r.lead) draw(eInOutCubic(prog(t, r.t0 - .07, r.t0 + r.dur - .07)), r.lead);
    draw(p, r.color);
  }
}
// 'zone' rings — the brand motif (concentric circles drifting outward)
function rings(cx, cy, r0, gap, n, t, col, a = 1, lw = 4, speed = .35) {
  bg.strokeStyle = col; bg.lineWidth = lw;
  for (let i = 0; i < n; i++) {
    const ph = ((t * speed + i / n) % 1), r = r0 + ph * gap * n;
    bg.globalAlpha = a * Math.sin(Math.PI * ph); bg.beginPath(); bg.arc(cx, cy, r, 0, Math.PI * 2); bg.stroke();
  }
  bg.globalAlpha = 1;
}
// ring waves emitted on an event (the phone ringing)
function waves(t, t0, cx, cy, col, n = 3) {
  for (let k = 0; k < n; k++) {
    const p = prog(t, t0 + k * .13, t0 + k * .13 + 1.35); if (p <= 0 || p >= 1) continue;
    const e = eOutCubic(p);
    bg.strokeStyle = col; bg.globalAlpha = Math.pow(1 - p, 1.4) * .85; bg.lineWidth = lerp(9, 1.5, e);
    bg.beginPath(); bg.ellipse(cx, cy, 300 + e * 760, 520 + e * 820, 0, 0, Math.PI * 2); bg.stroke();
  }
  bg.globalAlpha = 1;
}
function glow(cx, cy, r, col, a) {
  if (a <= 0) return;
  const g = bg.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  bg.globalAlpha = a; bg.fillStyle = g; bg.fillRect(cx - r, cy - r, 2 * r, 2 * r); bg.globalAlpha = 1;
}
const DUST = Array.from({ length: 70 }, (_, i) => ({ x: hash(i) * W, y: hash(i + 50) * H, s: 1 + hash(i + 9) * 2.4, v: 12 + hash(i + 3) * 30, a: .15 + hash(i + 7) * .35 }));
function dust(t, a, col = '255,214,190') {
  for (const d of DUST) { const y = (d.y - t * d.v + H * 10) % H; bg.fillStyle = `rgba(${col},${d.a * a})`; bg.beginPath(); bg.arc(d.x + Math.sin(t * .7 + d.y) * 10, y, d.s, 0, Math.PI * 2); bg.fill(); }
}

// ================================================================== Three.js (pixel-unit world: 1 unit = 1 px at z = 0)
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const FOV = 30, CAMZ = CY / Math.tan(FOV / 2 * Math.PI / 180);
const camera = new THREE.PerspectiveCamera(FOV, W / H, 20, 40000); camera.position.set(0, 0, CAMZ); camera.lookAt(0, 0, 0);
const sx = px => px - CX, sy = py => CY - py;           // screen px → world

function texOf(src) {
  const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true; return t;
}
const PH_VS = `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
function phoneMat(tex) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    uniforms: { map: { value: tex }, uA: { value: 1 }, uSweep: { value: -2 }, uSweepA: { value: 0 }, uRefl: { value: 0 }, uFloor: { value: -9999 } },
    vertexShader: PH_VS,
    fragmentShader: `uniform sampler2D map; uniform float uA,uSweep,uSweepA,uRefl,uFloor; varying vec2 vUv; varying vec3 vW;
      void main(){ vec4 c=texture2D(map,vUv); if(c.a<.03) discard;
        float d=(vUv.x*.62+vUv.y*.38)-uSweep; c.rgb+=exp(-d*d/.0025)*uSweepA*vec3(1.,.88,.78)*.55*c.a;
        float a=c.a*uA; if(uRefl>.5) a*=.2*smoothstep(uFloor-560.,uFloor,vW.y);
        gl_FragColor=vec4(c.rgb,a);
        #include <colorspace_fragment>
      }`
  });
}
// phone = front cut-out + back cut-out + extruded titanium edge (so a 3D turn shows real thickness)
class Phone {
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
      uniforms: { uA: { value: 1 }, uRefl: { value: 0 }, uFloor: { value: -9999 } }, transparent: true,
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(normalMatrix*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vW; uniform float uA,uRefl,uFloor;
        void main(){ vec3 n=normalize(vN); float l=.30+.70*max(dot(n,normalize(vec3(-.5,.65,.55))),0.);
          float s=pow(max(dot(n,normalize(vec3(.55,.25,.8))),0.),18.)*.9 + pow(max(dot(n,normalize(vec3(-.8,-.1,.6))),0.),30.)*.5;
          vec3 c=vec3(.62,.23,.075)*l + s*vec3(1.,.82,.66); float a=uA; if(uRefl>.5) a*=.2*smoothstep(uFloor-560.,uFloor,vW.y);
          gl_FragColor=vec4(c,a);
          #include <colorspace_fragment>
        }`
    });
    this.edge = new THREE.Mesh(eg, [new THREE.MeshBasicMaterial({ visible: false }), this.edgeMat]);
    this.g.add(this.edge, this.front, this.back); this.g.visible = false;
  }
  set(o) {   // {x,y (screen px), z, h (px), rx, ry, rz, a}
    this.g.visible = (o.a ?? 1) > 0;
    this.g.position.set(sx(o.x ?? CX), sy(o.y ?? CY), o.z ?? 0); this.g.scale.setScalar(o.h ?? 1200);
    this.g.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    for (const m of [this.front.material, this.back.material]) { m.uniforms.uA.value = o.a ?? 1; m.uniforms.uSweep.value = o.sweep ?? -2; m.uniforms.uSweepA.value = o.sweepA ?? 0; }
    // only the side that faces the camera is drawn (no ghosting while fading)
    const f = Math.cos(o.ry ?? 0) * Math.cos(o.rx ?? 0); this.front.visible = f > -.02; this.back.visible = f < .02;
    this.edgeMat.uniforms.uA.value = o.a ?? 1;
  }
  refl(on, floorY) { for (const m of [this.front.material, this.back.material, this.edgeMat]) { m.uniforms.uRefl.value = on ? 1 : 0; m.uniforms.uFloor.value = floorY; } }
}
let phone, mirror, pairMesh, callCanvas, callTex, frontTex;

// --- particle iPhone (back view: plateau, three lenses, flash, LiDAR — positions match back.png)
const PN = 24000;
const phoneP = new Float32Array(PN * 3), scatP = new Float32Array(PN * 3), seedA = new Float32Array(PN);
{
  const Wp = .468, Hp = .976, Dp = .052, R = .075;
  const inRR = (x, y, w, h, r) => { const dx = Math.max(Math.abs(x) - (w / 2 - r), 0), dy = Math.max(Math.abs(y) - (h / 2 - r), 0); return dx * dx + dy * dy <= r * r; };
  let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const L = [[.1441, .4047, .0466], [.0235, .3401, .0466], [.1441, .2759, .0466]];   // lens centres measured on back.png (model x is mirrored when seen from the back)
  for (let i = 0; i < PN; i++) {
    let x, y, z, k = rnd();
    if (k < .5) { do { x = (rnd() - .5) * Wp; y = (rnd() - .5) * Hp; } while (!inRR(x, y, Wp, Hp, R)); z = -Dp / 2; if (y > .208 && Math.abs(x) < Wp / 2 - .02 && y < Hp / 2 - .02) z -= .012; }
    else if (k < .62) { do { x = (rnd() - .5) * Wp; y = (rnd() - .5) * Hp; } while (!inRR(x, y, Wp, Hp, R)); z = Dp / 2; }
    else if (k < .8) {
      const per = 2 * (Wp + Hp); let d = rnd() * per; z = (rnd() - .5) * Dp;
      if (d < Wp) { x = -Wp / 2 + d; y = Hp / 2; } else if (d < Wp + Hp) { x = Wp / 2; y = Hp / 2 - (d - Wp); } else if (d < 2 * Wp + Hp) { x = Wp / 2 - (d - Wp - Hp); y = -Hp / 2; } else { x = -Wp / 2; y = -Hp / 2 + (d - 2 * Wp - Hp); }
      const cx = Math.sign(x) * (Wp / 2 - R), cy = Math.sign(y) * (Hp / 2 - R);
      if (Math.abs(x) > Wp / 2 - R && Math.abs(y) > Hp / 2 - R) { const a2 = Math.atan2(y - cy, x - cx); x = cx + Math.cos(a2) * R; y = cy + Math.sin(a2) * R; }
    } else {
      const idx = Math.floor(rnd() * 3.5);
      if (idx < 3) { const a = rnd() * Math.PI * 2, rr = L[idx][2] * (rnd() < .55 ? 1 : .62); x = L[idx][0] + Math.cos(a) * rr; y = L[idx][1] + Math.sin(a) * rr; }
      else { const a = rnd() * Math.PI * 2, f = rnd() < .5; x = -.144 + Math.cos(a) * .024; y = (f ? .41 : .273) + Math.sin(a) * .024; }
      z = -Dp / 2 - .03;
    }
    phoneP.set([x, y, z], i * 3);
    const ang = rnd() * Math.PI * 2, rad = .3 + rnd() * .75;
    scatP.set([Math.cos(ang) * rad, Math.sin(ang) * rad * 1.5, (rnd() - .5) * 1.2], i * 3);
    seedA[i] = rnd();
  }
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(phoneP, 3));
pGeo.setAttribute('aScat', new THREE.BufferAttribute(scatP, 3));
pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seedA, 1));
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
  uniforms: { uAsm: { value: 0 }, uExp: { value: 0 }, uTime: { value: 0 }, uA: { value: 1 }, uScale: { value: 1 } },
  vertexShader: `attribute vec3 aScat; attribute float aSeed; uniform float uAsm,uExp,uTime,uScale; varying float vA; varying vec3 vC;
    void main(){
      float a=clamp(uAsm*1.5-aSeed*.5,0.,1.); a=a*a*(3.-2.*a);
      float ang=(1.-a)*(3.5+aSeed*2.)+uTime*.25; float c=cos(ang), s=sin(ang);
      vec3 sc=vec3(c*aScat.x-s*aScat.y, s*aScat.x+c*aScat.y, aScat.z);
      vec3 p=mix(sc,position,a);
      float e=clamp(uExp*1.4-aSeed*.4,0.,1.); e=1.-pow(1.-e,3.);
      vec3 dir=normalize(position+vec3(sin(aSeed*91.)*.2,cos(aSeed*53.)*.2,.25*sin(aSeed*17.)));
      p+=dir*e*(1.2+aSeed*1.6);
      vec4 mv=modelViewMatrix*vec4(p,1.);
      gl_PointSize=(2.4+aSeed*3.2)*uScale*(${CAMZ.toFixed(1)}/-mv.z)*(1.+e*.6);
      vA=(.55+.45*sin(uTime*3.+aSeed*50.))*(1.-e*.85);
      vC=mix(vec3(.93,.52,.36),vec3(1.,.93,.86),step(.9,aSeed));
      gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `uniform float uA; varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard;
    float k=(1.-d*2.)*vA*uA; vec3 c=vC*k*1.8; gl_FragColor=vec4(c,max(c.r,max(c.g,c.b))); }`
});
const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false;
const particles = new THREE.Group(); particles.add(points); scene.add(particles); particles.visible = false;

// --- hero set: volumetric cone, dust in the beam, floor spot (all additive light, alpha-correct over the page)
const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor };
const hero = new THREE.Group(); scene.add(hero); hero.visible = false;
const FLOOR = -640;
const cg = new THREE.ConeGeometry(980, 2900, 64, 1, true); cg.translate(0, -1450, 0);
const cone = new THREE.Mesh(cg, new THREE.ShaderMaterial({
  ...ADD, side: THREE.DoubleSide, uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP=position; vec4 w=modelMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-(viewMatrix*w).xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uA,uTime;
    void main(){ float along=clamp(-vP.y/2900.,0.,1.); float edge=pow(abs(dot(vN,vV)),1.8);
      float n=.8+.2*sin(vP.y*.004+uTime*1.1+atan(vP.z,vP.x)*5.);
      vec3 c=mix(vec3(1.,.92,.84),vec3(.85,.47,.34),along)*edge*(1.-along*.9)*.30*n*uA; gl_FragColor=vec4(c,max(c.r,max(c.g,c.b))); }`
}));
cone.position.set(0, 1900, -500); hero.add(cone);
{
  const DN = 700, dp = new Float32Array(DN * 3); let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < DN; i++) { const y = rnd() * 2600 - 900, rr = (1900 - y) / 2900 * 900 * Math.sqrt(rnd()), a = rnd() * 6.283; dp.set([Math.cos(a) * rr, y, Math.sin(a) * rr - 500], i * 3); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  hero.dust = new THREE.Points(dg, new THREE.ShaderMaterial({ ...ADD, uniforms: { uA: { value: 0 } },
    vertexShader: `void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=2.6*(${CAMZ.toFixed(1)}/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uA; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; vec3 c=vec3(1.,.85,.75)*(1.-d*2.)*.7*uA; gl_FragColor=vec4(c,max(c.r,max(c.g,c.b))); }` }));
  hero.add(hero.dust);
}
const floorSpot = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.ShaderMaterial({
  ...ADD, uniforms: { uA: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec2 vUv; uniform float uA; void main(){ float d=length((vUv-.5)*vec2(1.,1.3)); vec3 c=vec3(.85,.47,.34)*.5*exp(-d*d*28.)*uA; gl_FragColor=vec4(c,max(c.r,max(c.g,c.b))); }`
}));
floorSpot.rotation.x = -Math.PI / 2; floorSpot.position.set(0, FLOOR, -100); hero.add(floorSpot);

// ================================================================== incoming-call screen (drawn into the phone's own texture)
const SCR = { x0: 35, x1: 790, y0: 30, y1: 1671, r: 116 };   // screen rect + corner radius measured on front.png
function screenPath(c, grow = 0) {
  const { x0, x1, y0, y1, r } = SCR; c.beginPath(); c.roundRect(x0 - 1 - grow, y0 - 1 - grow, x1 - x0 + 2 + 2 * grow, y1 - y0 + 2 + 2 * grow, r + 1 + grow);
}
let poster, frameImg;
function prepCall() {
  poster = document.createElement('canvas'); poster.width = 825; poster.height = 1700;
  const pc = poster.getContext('2d');
  pc.filter = 'blur(38px) saturate(1.3) brightness(.6)'; pc.drawImage(IMG.front, -80, -80, 985, 1860); pc.filter = 'none';
  const g = pc.createLinearGradient(0, 0, 0, 1700); g.addColorStop(0, 'rgba(217,119,87,.32)'); g.addColorStop(.45, 'rgba(70,24,12,.18)'); g.addColorStop(1, 'rgba(8,5,4,.78)');
  pc.fillStyle = g; pc.fillRect(0, 0, 825, 1700);
  frameImg = document.createElement('canvas'); frameImg.width = 825; frameImg.height = 1700;
  const fc = frameImg.getContext('2d'); fc.drawImage(IMG.front, 0, 0);
  fc.globalCompositeOperation = 'destination-out'; screenPath(fc, 0); fc.fill();
  callCanvas = document.createElement('canvas'); callCanvas.width = 825; callCanvas.height = 1700;
}
function handset(c, x, y, s, rot, col) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.strokeStyle = col; c.fillStyle = col; c.lineCap = 'round';
  c.lineWidth = 9; c.beginPath(); c.arc(0, 14, 26, Math.PI * 1.16, Math.PI * 1.84); c.stroke();
  for (const sgn of [-1, 1]) { c.save(); c.translate(sgn * 22, 4); c.rotate(sgn * .55); c.beginPath(); c.roundRect(-8, -4, 16, 22, 6); c.fill(); c.restore(); }
  c.restore();
}
function drawCall(t) {
  const c = callCanvas.getContext('2d'), cx = 412.5;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 825, 1700);
  c.save(); screenPath(c, 3); c.clip();
  c.drawImage(poster, 0, 0);
  // status bar + Dynamic Island
  c.fillStyle = '#fff'; c.font = '600 44px "Inter Variable"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('9:41', 168, 92);
  for (let i = 0; i < 4; i++) { c.fillRect(578 + i * 13, 104 - 10 - i * 6, 9, 10 + i * 6); }
  c.beginPath(); c.roundRect(650, 76, 56, 28, 8); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke(); c.fillRect(654, 80, 44, 20); c.fillRect(708, 85, 4, 10);
  c.fillStyle = '#000'; c.beginPath(); c.roundRect(295, 56, 235, 68, 34); c.fill();
  // caller
  const ans = eInOutCubic(prog(t, 1.82, 2.12));
  c.fillStyle = 'rgba(255,255,255,.62)'; c.font = '500 36px "Inter Variable"'; c.fillText(ans > .99 ? '00:00' : 'mobilni', cx, 268);
  c.fillStyle = '#fff'; c.font = '650 74px "Inter Variable"'; c.fillText('Tvoj novi iPhone', cx, 352);
  // avatar: brand rings, pulsing with the ring
  const ay = 760, pulse = Math.max(prog(t, .35, 1.0) < 1 ? Math.sin(Math.PI * prog(t, .35, 1.0)) : 0, prog(t, 1.2, 1.85) < 1 ? Math.sin(Math.PI * prog(t, 1.2, 1.85)) : 0);
  for (let k = 0; k < 3; k++) { const ph = (t * .9 + k / 3) % 1; c.strokeStyle = `rgba(255,214,190,${.35 * Math.sin(Math.PI * ph)})`; c.lineWidth = 4; c.beginPath(); c.arc(cx, ay, 150 + ph * 120, 0, Math.PI * 2); c.stroke(); }
  const ag = c.createLinearGradient(cx - 140, ay - 140, cx + 140, ay + 140); ag.addColorStop(0, '#F0A07F'); ag.addColorStop(1, '#B4502E');
  c.fillStyle = ag; c.beginPath(); c.arc(cx, ay, 140 * (1 + pulse * .04), 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(10,10,10,.85)'; c.lineWidth = 7;
  for (const r of [34, 66, 98]) { c.beginPath(); c.arc(cx, ay, r, 0, Math.PI * 2); c.stroke(); }
  c.fillStyle = INK; c.beginPath(); c.arc(cx, ay, 14, 0, Math.PI * 2); c.fill();
  // remind / message buttons
  c.globalAlpha = 1 - ans;
  for (const [bx, lab] of [[232, 'Podseti me'], [593, 'Poruka']]) {
    c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(bx, 1268, 52, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.8)'; c.font = '500 30px "Inter Variable"'; c.fillText(lab, bx, 1352);
    c.strokeStyle = '#fff'; c.lineWidth = 5;
    if (lab === 'Poruka') { c.beginPath(); c.roundRect(bx - 22, 1250, 44, 32, 9); c.stroke(); c.beginPath(); c.moveTo(bx - 10, 1282); c.lineTo(bx - 16, 1292); c.lineTo(bx - 2, 1282); c.stroke(); }
    else { c.beginPath(); c.arc(bx, 1270, 20, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(bx, 1270); c.lineTo(bx, 1258); c.moveTo(bx, 1270); c.lineTo(bx + 9, 1276); c.stroke(); }
  }
  c.globalAlpha = 1;
  // slide to answer
  const sx0 = 92, sw = 641, sy0 = 1440, sh = 150;
  c.fillStyle = `rgba(255,255,255,${.16 + ans * .1})`; c.beginPath(); c.roundRect(sx0, sy0, sw, sh, 75); c.fill();
  if (ans > 0) { c.fillStyle = '#34C759'; c.globalAlpha = ans; c.beginPath(); c.roundRect(sx0, sy0, 150 + (sw - 150) * ans, sh, 75); c.fill(); c.globalAlpha = 1; }
  const sh0 = (t * .55) % 1, sg = c.createLinearGradient(sx0 + 120, 0, sx0 + sw, 0);
  sg.addColorStop(0, 'rgba(255,255,255,.45)'); sg.addColorStop(clamp(sh0 - .12), 'rgba(255,255,255,.45)'); sg.addColorStop(sh0, 'rgba(255,255,255,1)'); sg.addColorStop(clamp(sh0 + .12), 'rgba(255,255,255,.45)'); sg.addColorStop(1, 'rgba(255,255,255,.45)');
  c.globalAlpha = 1 - clamp(ans * 3); c.fillStyle = sg; c.font = '500 38px "Inter Variable"'; c.fillText('prevuci da se javiš', sx0 + sw / 2 + 50, sy0 + sh / 2 + 2); c.globalAlpha = 1;
  const tx = sx0 + 75 + (sw - 150) * ans;
  c.fillStyle = '#fff'; c.beginPath(); c.arc(tx, sy0 + sh / 2, 64, 0, Math.PI * 2); c.fill();
  handset(c, tx, sy0 + sh / 2 - 2, 1.05, -Math.PI / 4 * (1 - ans) + 0 * ans, '#34C759');
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.roundRect(272, 1636, 280, 10, 5); c.fill();
  // screen turns into the orange field of the next shot as we fly into it
  const o = eInOutSine(prog(t, 2.16, 2.42));
  if (o > 0) { c.globalAlpha = o; c.fillStyle = OR; c.fillRect(0, 0, 825, 1700); c.globalAlpha = 1; }
  c.restore();
  c.drawImage(frameImg, 0, 0);
  callTex.needsUpdate = true;
}

// ================================================================== GSAP kinetic type — ONE big word at a time, caps centred on the frame
const tl = gsap.timeline({ paused: true });
function FT(tg, from, to, at) { tl.set(tg, from, 0); return tl.fromTo(tg, from, { ...to, immediateRender: false }, at); }
const mctx = document.createElement('canvas').getContext('2d');
function measure(text, wdth, wght = 900) {
  const sp = document.createElement('span'); sp.className = 'word'; sp.textContent = text;
  sp.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;white-space:nowrap;font-size:100px;--wdth:${wdth};--wght:${wght};font-variation-settings:'wdth' ${wdth},'wght' ${wght}`;
  document.body.appendChild(sp); const w = sp.getBoundingClientRect().width; sp.remove(); return w;
}
function chars(el) { const t = el.dataset.text; el.innerHTML = `<div class="ln"><span class="lt">${[...t].map(ch => `<span class="ch">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('')}</span></div>`; return [...el.querySelectorAll('.ch')]; }
// as big as possible inside the Reels safe width: choose the width axis so every word gets ~the same big cap height
function fitWord(el, { maxW = 940, fs0 = 400, fsMax = 470 } = {}) {
  const text = el.dataset.text, wAt = (wd, fs) => measure(text, wd) * fs / 100;
  let wd, fs = fs0;
  if (wAt(50, fs) > maxW) { wd = 50; fs = maxW * 100 / measure(text, 50); }
  else if (wAt(150, fs) < maxW) { wd = 150; fs = Math.min(fsMax, maxW * 100 / measure(text, 150)); }
  else { let lo = 50, hi = 150; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (wAt(m, fs) > maxW) hi = m; else lo = m; } wd = lo; }
  el.style.fontSize = fs.toFixed(1) + 'px'; el.style.setProperty('--wdth', wd.toFixed(1)); el.dataset.wd = wd;
  return { wd, fs };
}
function capCentre(fs) {   // y of the cap-height centre inside the block (line-height .86)
  mctx.font = `900 ${fs}px "Anybody Variable"`; const m = mctx.measureText('H'), Lh = .86 * fs;
  const base = (Lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
  return base - m.actualBoundingBoxAscent / 2;
}
const EX = { rise: .2, punch: .2, slide: .22, flip: .22, burst: .22, stretch: .22 };
function word(id, tIn, tOut, style, { color = INK, maxW = 940, fs0 = 400, cy = CY } = {}) {
  const el = $(id), ch = chars(el), ln = el.querySelector('.ln'); el.style.color = color;
  const { wd, fs } = fitWord(el, { maxW, fs0 }); el.style.top = (cy - capCentre(fs)) + 'px';
  if (style === 'rise') el.classList.add('mask');
  tl.set(el, { autoAlpha: 0 }, 0).set(el, { autoAlpha: 1 }, tIn);
  const hold = tOut !== undefined ? tOut - tIn + .25 : 3;
  tl.fromTo(el, { scale: .97 }, { scale: 1.035, duration: hold, ease: 'none', immediateRender: false }, tIn);    // keeps breathing while it is on screen
  const F = (tg, a, b, at = tIn) => FT(tg, a, b, at);
  // the letter-by-letter entrance must be completely finished before the exit starts (otherwise a late letter pops back)
  const avail = tOut !== undefined ? tOut - tIn - .04 : 9, fit = (dur, st) => { const k = Math.min(1, avail / (dur + st * (ch.length - 1))); return [dur * k, st * k]; };
  if (style === 'rise') { const [d, st] = fit(.5, .03); F(ch, { yPercent: 125 }, { yPercent: 0, duration: d, ease: 'expo.out', stagger: st }); F(el, { '--wdth': wd * .6 }, { '--wdth': wd, duration: Math.min(.65, avail), ease: 'expo.out' }); }
  if (style === 'punch') { F(ln, { scale: 2.5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: Math.min(.42, avail), ease: 'expo.out' }); F(el, { '--wdth': wd * .7 }, { '--wdth': wd, duration: Math.min(.5, avail), ease: 'expo.out' }); }
  if (style === 'slide') { const [d, st] = fit(.55, .025); F(ln, { x: 820, skewX: -22 }, { x: 0, skewX: 0, duration: Math.min(.5, avail), ease: 'expo.out' }); F(ch, { x: 90 }, { x: 0, duration: d, ease: 'expo.out', stagger: st }); }
  if (style === 'flip') { const [d, st] = fit(.6, .035); F(ch, { rotationX: -105, yPercent: 35, transformPerspective: 900, autoAlpha: 0 }, { rotationX: 0, yPercent: 0, autoAlpha: 1, duration: d, ease: 'back.out(1.5)', stagger: st }); }
  if (style === 'burst') F(ch, { scale: 0, x: i => (hash(i + 3) - .5) * 600, y: i => (hash(i + 17) - .5) * 440, rotation: i => (hash(i + 29) - .5) * 70 }, { scale: 1, x: 0, y: 0, rotation: 0, duration: .45, ease: 'expo.out', stagger: { each: .012, from: 'center' } });
  if (style === 'stretch') { F(el, { '--wdth': 50 }, { '--wdth': wd, duration: Math.min(.6, avail), ease: 'expo.out' }); F(ln, { scaleY: 1.6, autoAlpha: 0 }, { scaleY: 1, autoAlpha: 1, duration: Math.min(.45, avail), ease: 'expo.out' }); }
  if (tOut !== undefined) {
    const d = EX[style];
    if (style === 'rise') tl.to(ch, { yPercent: -125, duration: d, ease: 'power2.in', stagger: .012 }, tOut);
    if (style === 'punch' || style === 'burst') tl.to(ln, { scale: .5, autoAlpha: 0, duration: d, ease: 'power2.in' }, tOut);
    if (style === 'slide') tl.to(ln, { x: -820, skewX: 22, duration: d, ease: 'power2.in' }, tOut);
    if (style === 'flip') tl.to(ch, { rotationX: 85, autoAlpha: 0, duration: d, ease: 'power2.in', stagger: .01 }, tOut);   // never past edge-on (no back-face flash)
    if (style === 'stretch') { tl.to(el, { '--wdth': 50, duration: d, ease: 'power2.in' }, tOut); tl.to(ln, { scaleX: .3, autoAlpha: 0, duration: d, ease: 'power2.in' }, tOut); }
    tl.set(el, { autoAlpha: 0 }, tOut + d + .012 * ch.length + .02);
  }
  return el;
}
function soft(el, t, tOut) {
  tl.set(el, { autoAlpha: 0 }, 0).fromTo(el, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: .55, ease: 'expo.out', immediateRender: false }, t);
  if (tOut) tl.to(el, { autoAlpha: 0, y: -26, duration: .25, ease: 'power2.in' }, tOut);
}
const DUR = T.end;
function buildType() {
  word('w1', T.w1, T.w2 - .17, 'rise');
  word('w2', T.w2, T.cRev + .02, 'stretch');
  word('nv', T.nv, T.nvOut, 'stretch', { color: CREAM, maxW: 1000, fs0: 470 });       // behind the pair (typeB layer)
  word('w3', T.w3, T.d2Rev + .05, 'punch');
  word('w4', T.w4, T.d3Rev + .05, 'slide', { color: CREAM });
  word('w5', T.w5, T.eRev + .03, 'flip', { color: OR });
  word('w6', T.w6, T.fRev - .1, 'burst', { color: CREAM });
  word('w7', T.w7, T.f2Rev + .05, 'rise', { color: OR });
  word('w8', T.w8, T.f3Rev + .05, 'punch');
  const w9 = word('w9', T.w9, undefined, 'stretch', { color: CREAM }); tl.set(w9, { autoAlpha: 0 }, T.hero - .02);
  // CTA: ZONA alone, then it climbs into the lockup while TELEFONA rises under it, then the DM pill
  const A = $('h1a'), B = $('h1b'), P = $('h2'), Hd = $('h3');
  Hd.style.fontSize = '50px'; Hd.style.color = INK;
  const chA = chars(A), chB = chars(B), lnA = A.querySelector('.ln');
  const fa = fitWord(A, { maxW: 700, fs0: 330 }), fb = fitWord(B, { maxW: 860, fs0: 200 });
  A.classList.add('mask'); B.classList.add('mask'); A.style.color = B.style.color = INK;
  const hA = .86 * fa.fs, hB = .86 * fb.fs, gap1 = 6, gap2 = 64, gap3 = 40, hP = 168, hH = 60;
  const total = hA + gap1 + hB + gap2 + hP + gap3 + hH; let y = CY - total / 2;
  A.style.top = y + 'px'; y += hA + gap1; B.style.top = y + 'px'; y += hB + gap2; P.style.top = y + 'px'; y += hP + gap3; Hd.style.top = y + 'px';
  const soloDy = CY - (parseFloat(A.style.top) + capCentre(fa.fs));
  tl.set(A, { autoAlpha: 0 }, 0).set(A, { autoAlpha: 1 }, T.cta);
  FT(chA, { yPercent: 125 }, { yPercent: 0, duration: .5, ease: 'expo.out', stagger: .035 }, T.cta);
  FT(A, { '--wdth': fa.wd * .6 }, { '--wdth': fa.wd, duration: .65, ease: 'expo.out' }, T.cta);
  tl.set(lnA, { y: soloDy, scale: 1.28 }, 0);                                   // ZONA starts big in the centre…
  tl.to(lnA, { y: 0, scale: 1, duration: .65, ease: 'power3.inOut' }, T.cta2 - .15);   // …then glides up into the lockup
  tl.set(B, { autoAlpha: 0 }, 0).set(B, { autoAlpha: 1 }, T.cta2);
  FT(chB, { yPercent: 125 }, { yPercent: 0, duration: .55, ease: 'expo.out', stagger: .03 }, T.cta2 + .1);
  const pill = P.querySelector('.pill'), pt = P.querySelector('.pt');
  tl.set(P, { autoAlpha: 0 }, 0).set(P, { autoAlpha: 1 }, T.pill);
  FT(pill, { scaleX: 0, scaleY: .3 }, { scaleX: 1, duration: .75, ease: 'elastic.out(1,.75)' }, T.pill);
  tl.fromTo(pill, { scaleY: .3 }, { scaleY: 1, duration: .55, ease: 'back.out(2.5)', immediateRender: false }, T.pill);
  FT(pt, { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: .5, ease: 'expo.out' }, T.pill + .2);
  for (const b of [T.pill + 1.0, T.pill + 1.5]) tl.to(pill, { scale: 1.05, duration: .09, ease: 'power2.out' }, b).to(pill, { scale: 1, duration: .4, ease: 'expo.out' }, b + .09);
  soft(Hd, T.pill + .4, T.outro);
  // outro → loop: everything collapses back into the dot the film starts from
  tl.to([...chA, ...chB], { yPercent: -125, duration: .38, ease: 'power2.in', stagger: .012 }, T.outro);
  tl.to(pill, { scale: 0, duration: .4, ease: 'back.in(1.8)' }, T.outro + .08).set([P, A, B], { autoAlpha: 0 }, T.outro + .55);
  tl.set({}, {}, DUR);
}

// ================================================================== frame
const fxc = $('fx').getContext('2d');
const grains = [0, 1, 2, 3].map(k => { const d = fxc.createImageData(540, 960); for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * .013 + k * 91.7) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } return d; });
const glEl = $('gl');
// background colour story — every change is an eased reveal that finishes just as the next word lands
reveal(T.cRev, .45, INK, 'c');                    // → NOVI + the pair
reveal(T.dRev, .45, OR, 'b', CREAM);              // → KUPI.
reveal(T.d2Rev, .42, INK, 'c');                   // → PRODAJ.
reveal(T.d3Rev, .42, CREAM, 't', OR);             // → ZAMENI.
reveal(T.eRev, .45, INK, 'c');                    // → particles / OTKUPUJEMO
reveal(T.fRev, .42, CREAM, 'c', OR);              // → BRZO.
reveal(T.f2Rev, .38, OR, 'b');                    // → FER.
reveal(T.f3Rev, .38, INK, 't', CREAM);            // → SIGURNO.
reveal(T.hRev, .5, OR, 'c', CREAM);               // hero → CTA
function bgAt(t) { let c = t < 2.47 ? INK : OR; for (const r of REV) if (t >= r.t0 + r.dur * .5) c = r.color; return c; }

// fly-through: the O of SIGURNO. is moved to the frame centre while we scale through its counter
function zoomOrigin(el) {
  const ch = el.querySelectorAll('.ch')[6], fs = parseFloat(el.style.fontSize);
  mctx.font = `900 ${fs}px "Anybody Variable"`; const m = mctx.measureText('O'), Lh = .86 * fs;
  const base = (Lh - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
  let x = 0, y = 0, n = ch; while (n && n !== el) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { x: x + ch.offsetWidth / 2, y: y + base - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 };
}
const DOT = 16;
const ring = (t, a, b) => { const p = prog(t, a, b); return p > 0 && p < 1 ? Math.sin(Math.PI * p) ** .3 : 0; };

async function setTime(t) {
  tl.seek(t, false);
  bg.setTransform(1, 0, 0, 1, 0, 0); bg.globalAlpha = 1;
  phone.g.visible = mirror.g.visible = pairMesh.visible = particles.visible = hero.visible = false;
  let useGL = false;
  drawReveals(t, t < 2.47 ? INK : OR);
  // outro: the orange field shrinks back into the dot (last frame == first frame → seamless loop)
  const oc = eInOutCubic(prog(t, T.outro + .38, T.end));
  if (oc > 0) { fill(INK); bg.fillStyle = OR; bg.beginPath(); bg.arc(CX, CY, lerp(1110, DOT, oc), 0, Math.PI * 2); bg.fill(); glow(CX, CY, 260, 'rgba(217,119,87,.7)', .35 * prog(t, T.end - .35, T.end)); }
  // brand rings behind every word (subtle, contrasting with the current field)
  const words = (t >= T.w1 && t < T.cRev + .3) || (t >= T.dRev && t < T.eRev + .3) || (t >= T.fRev && t < T.zoom);
  if (words) { const b = bgAt(t); rings(CX, CY, 170, 115, 7, t, b === INK ? OR : INK, .08, 3); }

  // ---------------- A: the phone pops out of the dot and rings (0 – 2.5)
  if (t < 2.56) {
    useGL = true;
    const pop = spring(t - .02, 1.7, .6), swing = spring(t - .02, 1.35, .66);
    const vib = ring(t, .35, .95) + ring(t, 1.22, 1.82);
    const jz = vib * (Math.sin(t * 2 * Math.PI * 23) * .016 + Math.sin(t * 2 * Math.PI * 37) * .007);
    const jx = vib * Math.sin(t * 2 * Math.PI * 29) * 5;
    const zoom = eInOutQuart(prog(t, 2.08, 2.5));
    if (t < .4) {     // loop anchor: same dot + glow the outro ends on; the phone pops out of it
      glow(CX, CY, 260, 'rgba(217,119,87,.7)', .35 * (1 - prog(t, 0, .3)));
      bg.fillStyle = OR; bg.beginPath(); bg.arc(CX, CY, DOT * (1 - eOutCubic(prog(t, .03, .3))), 0, Math.PI * 2); bg.fill();
    }
    if (t < 2.5) {
      dust(t, clamp(prog(t, .1, .6)) * (1 - zoom));
      glow(CX, CY, 900, 'rgba(217,119,87,.55)', .55 * clamp(pop) * (1 - zoom) * (1 + .25 * vib));
      waves(t, .35, CX, CY, OR); waves(t, 1.22, CX, CY, OR);
    }
    drawCall(t);
    phone.front.material.uniforms.map.value = callTex;
    phone.set({
      x: CX + jx, y: CY + (1 - pop) * 40 + Math.sin(t * 1.6) * 6 * (1 - zoom),
      z: zoom * (CAMZ * .62), h: 1150 * Math.max(.001, pop),
      rx: (1 - swing) * .35, ry: (1 - swing) * -1.0, rz: (1 - pop) * -.3 + jz,
      sweep: lerp(-.4, 1.4, prog(t, .55, 1.25)), sweepA: .7
    });
  }

  // ---------------- C: NOVI, then the pair pops out in front of it
  if (t >= T.cRev && t < T.pairOut + .45) {
    useGL = true;
    const p = spring(t - T.pair, 1.55, .58), sw = spring(t - T.pair, 1.2, .64);
    const out = eInBack(prog(t, T.pairOut, T.pairOut + .36));
    glow(CX, CY, 950, 'rgba(217,119,87,.5)', .5 * clamp(p) * (1 - out));
    pairMesh.visible = p > 0 && out < 1;
    const s = Math.max(.001, p * (1 - out)) * (1 + .05 * eInOutSine(prog(t, T.pair + .5, T.pairOut)));
    pairMesh.scale.set(s, s, 1);
    pairMesh.position.set(0, (1 - p) * -260, 0);
    pairMesh.rotation.set((1 - sw) * .3, (1 - sw) * .85 + Math.sin((t - T.pair) * 1.3) * .08, (1 - p) * .22 + out * .5);
    pairMesh.material.uniforms.uSweep.value = lerp(-.4, 1.5, eInOutSine(prog(t, T.pair + .45, T.pair + 1.15))); pairMesh.material.uniforms.uSweepA.value = .8;
  }

  // ---------------- E: particles swirl into the iPhone, it turns real, then bursts into OTKUPUJEMO
  if (t >= T.eRev && t < T.fRev + .5) {
    useGL = true; particles.visible = true;
    const asm = eInOutCubic(prog(t, T.asm, T.real + .1)), ex = prog(t, T.boom, T.boom + 1.1);
    pMat.uniforms.uAsm.value = asm; pMat.uniforms.uExp.value = ex; pMat.uniforms.uTime.value = t;
    const realIn = eInOutCubic(prog(t, T.real, T.real + .22)), realOut = eInOutCubic(prog(t, T.realOut, T.realOut + .1));
    pMat.uniforms.uA.value = clamp(prog(t, T.eRev, T.eRev + .3)) * (1 - realIn * .9 + realOut * .9);
    const ry = Math.PI + .75 - eInOutCubic(prog(t, T.asm, T.realOut)) * .95, h = 1130;
    particles.scale.setScalar(h); particles.rotation.set(.06, ry, 0);
    const real = realIn * (1 - realOut);
    if (real > 0) { phone.front.material.uniforms.map.value = frontTex; phone.set({ x: CX, y: CY, h, rx: .06, ry, rz: 0, a: real, sweep: lerp(-.3, 1.3, prog(t, T.real, T.realOut)), sweepA: .9 }); }
    glow(CX, CY, 800, 'rgba(217,119,87,.45)', .45 * asm * (1 - ex));
  }

  // ---------------- F: fly through the O of SIGURNO.
  {
    const f3 = $('w9'), pan = eInOutCubic(prog(t, T.zoom - .22, T.zoom + .14)), z = prog(t, T.zoom, T.hero);
    if (pan > 0 && t < T.hero) {
      // open the O up first (width axis → 150) so the camera flies through a wide counter
      f3.style.setProperty('--wdth', lerp(+f3.dataset.wd, 150, eInOutCubic(prog(t, T.zoom - .3, T.zoom + .08))));
      const O = zoomOrigin(f3), top = parseFloat(f3.style.top);
      f3.style.transformOrigin = `${O.x}px ${O.y}px`;
      f3.style.translate = `${(CX - O.x) * pan}px ${(CY - (top + O.y)) * pan}px`;
      f3.style.scale = (1 + .45 * pan) * (1 + Math.pow(z, 2.5) * 75);
    } else if (t < T.zoom) { f3.style.scale = 1; f3.style.translate = '0px 0px'; }
  }

  // ---------------- G: hero — spotlight, the phone pops up, turns to its back
  if (t >= T.hero - .05 && t < T.hRev + .5) {
    useGL = true; hero.visible = true;
    const on = eOutCubic(prog(t, T.hero, T.hero + .4)), off = eInOutCubic(prog(t, T.shrink - .05, T.shrink + .4));
    cone.material.uniforms.uA.value = on * (1 - off); cone.material.uniforms.uTime.value = t;
    hero.dust.material.uniforms.uA.value = on * (1 - off); hero.dust.rotation.y = t * .05;
    floorSpot.material.uniforms.uA.value = on * (1 - off);
    const p = spring(t - (T.hero + .05), 1.5, .6), flip = eInOutCubic(prog(t, T.flip, T.flip + .75)), shrink = eInBack(prog(t, T.shrink, T.shrink + .38));
    const H0 = 1080, h = H0 * Math.max(.001, p) * (1 - shrink);
    const ry = (1 - p) * -.6 + flip * Math.PI + Math.sin((t - T.hero) * 1.1) * .1, y = CY + (1 - p) * 220 + Math.sin(t * 1.4) * 8;
    phone.front.material.uniforms.map.value = frontTex;
    phone.set({ x: CX, y, h, rx: (1 - p) * .25, ry, rz: shrink * .4, sweep: lerp(-.4, 1.4, eInOutSine(prog(t, T.flip + .65, T.flip + 1.15))), sweepA: .9 });
    const fl = sy(CY) - H0 / 2 - 14; floorSpot.position.y = fl;
    mirror.front.material.uniforms.map.value = frontTex;
    mirror.set({ x: CX, y: 0, h, rx: -(1 - p) * .25, ry, rz: -shrink * .4 });
    mirror.g.position.y = 2 * fl - phone.g.position.y; mirror.g.scale.y *= -1; mirror.refl(true, fl);
    mirror.g.visible = p > .05 && shrink < 1;
  }

  // ---------------- H: CTA
  if (t >= T.hRev + .3) {
    rings(CX, CY, 220, 120, 8, t, INK, .13 * clamp(prog(t, T.hRev + .3, T.hRev + .8)) * (1 - prog(t, T.outro, T.outro + .4)), 4, .25);
    const slot = $('h2').querySelector('.slot').getBoundingClientRect(), pl = $('plane');
    const p = prog(t, T.plane, T.plane + .68);
    if (p > 0) {
      const e = eOutCubic(p), x0 = -160, y0 = 1650, x1 = slot.left, y1 = slot.top, mx = 200, my = 1000;
      const x = (1 - e) ** 2 * x0 + 2 * (1 - e) * e * mx + e * e * x1, y = (1 - e) ** 2 * y0 + 2 * (1 - e) * e * my + e * e * y1;
      const k = 1 - eInBack(prog(t, T.outro + .08, T.outro + .48));
      pl.style.visibility = k > 0 ? 'visible' : 'hidden'; pl.style.transform = `translate(${x}px,${y}px) rotate(${lerp(-35, 0, e)}deg) scale(${lerp(1.8, 1, e) * Math.max(0, k)})`;
    } else pl.style.visibility = 'hidden';
  } else $('plane').style.visibility = 'hidden';

  if (useGL) { glEl.style.visibility = 'visible'; renderer.render(scene, camera); } else glEl.style.visibility = 'hidden';
  fxc.putImageData(grains[Math.floor(t * 30) % 4], 0, 0);
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

async function boot() {
  await Promise.all([
    document.fonts.load('900 100px "Anybody Variable"', 'ĆČŠŽĐćčšž?'), document.fonts.load('600 40px "Inter Variable"', 'šž'),
    document.fonts.load('500 30px "JetBrains Mono"')]);
  await document.fonts.ready;
  IMG = { front: await load('assets/front.png'), back: await load('assets/back.png'), pair: await load('assets/pair.png') };
  prepCall();
  callTex = texOf(callCanvas); frontTex = texOf(IMG.front);
  const backTex = texOf(IMG.back);
  phone = new Phone(callTex, backTex); mirror = new Phone(frontTex, backTex);
  const pt = texOf(IMG.pair), ph = 1000, pw = ph * IMG.pair.width / IMG.pair.height;
  pairMesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), phoneMat(pt)); scene.add(pairMesh); pairMesh.visible = false;
  buildType();
  window.setTime = setTime; window.__tl = tl; await setTime(0); window.READY = true;   // __tl: used by tools/flicker check
}
boot();
