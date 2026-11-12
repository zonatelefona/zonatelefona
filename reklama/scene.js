import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 1080, H = 1920;
export const DURATION = 26.0;

// ---------- math / easing ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const L3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
const eOutCubic = x => 1 - Math.pow(1 - x, 3);
const eInCubic = x => x * x * x;
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eInOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;
const eOutQuart = x => 1 - Math.pow(1 - x, 4);
// impulse: rises fast at t0, decays
const pulse = (t, t0, att, dec) => t < t0 - att ? 0 : t < t0 ? Math.pow((t - (t0 - att)) / att, 2) : Math.exp(-(t - t0) / dec);
const bell = (t, t0, w) => Math.exp(-Math.pow((t - t0) / w, 2));

// ---------- renderer ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 0.03, 200);
scene.add(camera);

// ---------- environment (studio strip lights for reflections) ----------
function buildEnv() {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.012, 0.006, 0.008), side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, col, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    m.position.set(...pos); m.rotation.set(...rot); env.add(m); return m;
  };
  panel(9, 6, new THREE.Color(2.6, 2.3, 2.0), [0, 9.8, 0], [Math.PI / 2, 0, 0]);           // top softbox
  panel(0.9, 16, new THREE.Color(7, 6.2, 5.4), [-9.8, 0, -2], [0, Math.PI / 2, 0]);          // cream strip L
  panel(1.3, 16, new THREE.Color(6, 0.7, 1.3), [9.8, 0, 1], [0, -Math.PI / 2, 0]);           // bordo strip R
  panel(14, 0.7, new THREE.Color(5, 4.4, 3.8), [0, 2.5, 9.8], [0, Math.PI, 0]);              // front horizontal band
  panel(0.6, 14, new THREE.Color(2, 1.8, 1.6), [4, 0, 9.8], [0, Math.PI, 0]);                // front vertical strip
  panel(16, 10, new THREE.Color(0.35, 0.04, 0.09), [0, -2, -9.8], [0, 0, 0]);                // back bordo wash
  panel(16, 16, new THREE.Color(0.08, 0.01, 0.02), [0, -9.8, 0], [-Math.PI / 2, 0, 0]);      // floor
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  return tex;
}
scene.environment = buildEnv();
scene.environmentIntensity = 1.0;

// subtle key light for spec on frames
const key = new THREE.DirectionalLight(0xffeadc, 0.6); key.position.set(-3, 4, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0xff5a78, 1.2); rim.position.set(4, 1, -4); scene.add(rim);

// ---------- background plane (camera-attached) ----------
const bgMat = new THREE.ShaderMaterial({
  depthWrite: false, depthTest: false,
  uniforms: {
    uTime: { value: 0 }, uGlow: { value: 1 }, uGlowPos: { value: new THREE.Vector2(0.5, 0.5) },
    uRays: { value: 0.6 }, uAspect: { value: W / H },
    cBase: { value: new THREE.Color(0x050203) }, cGlow: { value: new THREE.Color(0x4c0a1b) }, cGlow2: { value: new THREE.Color(0x1d0309) },
    cRay: { value: new THREE.Color(0xf1dcc4) }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    varying vec2 vUv; uniform float uTime,uGlow,uRays,uAspect; uniform vec2 uGlowPos;
    uniform vec3 cBase,cGlow,cGlow2,cRay;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
    void main(){
      vec2 p=vUv; vec2 q=(p-uGlowPos)*vec2(uAspect*1.15,1.0);
      float g=exp(-dot(q,q)*5.5);
      float g2=exp(-dot(q,q)*1.6);
      vec3 col=cBase;
      float smoke=fbm(p*vec2(3.,5.)+vec2(uTime*.03,-uTime*.05));
      col+=cGlow2*g2*(.6+.8*smoke)*uGlow;
      col+=cGlow*g*uGlow*(.75+.5*smoke);
      // light rays from top
      vec2 s=p-vec2(.5,1.18); float ang=atan(s.x,-s.y);
      float r=pow(.5+.5*sin(ang*23.+uTime*.25),6.)*.6+pow(.5+.5*sin(ang*41.-uTime*.18+1.3),8.)*.4;
      float fall=smoothstep(1.6,.2,length(s))*smoothstep(.75,0.,abs(ang));
      col+=cRay*r*fall*uRays*.028*(.6+smoke);
      // floor haze
      col+=cGlow*.25*smoothstep(.35,0.,p.y)*uGlow*smoke;
      gl_FragColor=vec4(col,1.);
    }`
});
const bgDist = 60;
const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
bg.position.z = -bgDist; bg.renderOrder = -10; bg.frustumCulled = false;
camera.add(bg);
function fitBg() {
  const h = 2 * bgDist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  bg.scale.set(h * camera.aspect * 1.02, h * 1.02, 1);
}

// ---------- particles ----------
const PN = 900;
const pGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(PN * 3), seed = new Float32Array(PN * 4);
  let s = 1234567;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < PN; i++) {
    pos[i * 3] = (rnd() - .5) * 9; pos[i * 3 + 1] = (rnd() - .5) * 12; pos[i * 3 + 2] = -8 + rnd() * 12;
    seed[i * 4] = rnd(); seed[i * 4 + 1] = rnd(); seed[i * 4 + 2] = rnd(); seed[i * 4 + 3] = rnd();
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
}
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uTime: { value: 0 }, uAmt: { value: 1 }, uSpeed: { value: 0 } },
  vertexShader: `
    attribute vec4 aSeed; uniform float uTime,uSpeed; varying float vA; varying vec3 vC;
    void main(){
      vec3 p=position;
      p.y=mod(p.y+uTime*(.05+aSeed.x*.12)+6.,12.)-6.;
      p.x+=sin(uTime*(.2+aSeed.y*.3)+aSeed.z*6.28)*.25;
      p.z=mod(p.z+uSpeed+8.,12.)-8.;
      vec4 mv=modelViewMatrix*vec4(p,1.);
      float big=step(.93,aSeed.w);
      float sz=mix(2.2+aSeed.z*3.5, 26.+aSeed.x*40., big);
      gl_PointSize=clamp(sz*(4.5/max(.2,-mv.z)),1.,180.);
      float tw=.55+.45*sin(uTime*(1.+aSeed.y*2.)+aSeed.x*30.);
      vA=mix(.75,.07,big)*tw*smoothstep(.15,1.2,-mv.z);
      vC=mix(vec3(1.,.86,.72),vec3(1.,.32,.42),step(.62,aSeed.y));
      gl_Position=projectionMatrix*mv;
    }`,
  fragmentShader: `
    varying float vA; varying vec3 vC; uniform float uAmt;
    void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); a=a*a;
      gl_FragColor=vec4(vC*a*vA*uAmt*1.4,1.); }`
});
const particles = new THREE.Points(pGeo, pMat);
particles.frustumCulled = false;
scene.add(particles);

// ---------- phone model ----------
const PW = 0.715, PH = 1.47, BS = 0.018, DEP = 0.046, BT = 0.018;
const FRONT = DEP / 2 + BT; // 0.041

function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI, false);
  return s;
}
function rrPlane(w, h, r, seg = 24) {
  const g = new THREE.ShapeGeometry(rrShape(w, h, r), seg);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
  return g;
}
const bodyGeo = (() => {
  const g = new THREE.ExtrudeGeometry(rrShape(PW - 2 * BS, PH - 2 * BS, 0.105 - BS), {
    depth: DEP, bevelEnabled: true, bevelThickness: BT, bevelSize: BS, bevelSegments: 8, curveSegments: 28
  });
  g.translate(0, 0, -DEP / 2); g.computeVertexNormals(); return g;
})();
const frontGlassGeo = rrPlane(PW - 0.026, PH - 0.026, 0.094);
const screenGeo = rrPlane(PW - 0.05, PH - 0.05, 0.082);
const islandGeo = rrPlane(0.19, 0.054, 0.027);
const modGeo = (() => { const g = new THREE.ExtrudeGeometry(rrShape(0.33, 0.33, 0.08), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 5, curveSegments: 20 }); g.translate(0, 0, -0.009); return g; })();
const ringGeo = new THREE.CylinderGeometry(0.066, 0.068, 0.028, 72, 1).rotateX(Math.PI / 2);
const lensGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 72, 1).rotateX(Math.PI / 2);
const lensInGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.031, 48, 1).rotateX(Math.PI / 2);
const smallGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.012, 32, 1).rotateX(Math.PI / 2);
const btnGeo = (h) => new RoundedBoxGeometry(0.012, h, 0.02, 3, 0.005);

const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x020306, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 520] });
const lensInMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1020, roughness: 0.0, metalness: 0.6, clearcoat: 1 });
const flashMat = new THREE.MeshPhysicalMaterial({ color: 0xdcd3bf, roughness: 0.35, clearcoat: 1, emissive: 0x2a2016 });
const frontMat = new THREE.MeshPhysicalMaterial({ color: 0x010101, roughness: 0.06, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.03 });
const islandMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

const VARIANTS = [
  { frame: 0x3a3a40, frameR: 0.26, back: 0x141417, backR: 0.42, layout: 'A' },   // P0 titanium noir
  { frame: 0xd4bea4, frameR: 0.2, back: 0xe9dcc8, backR: 0.48, layout: 'B' },     // P1 cream
  { frame: 0x6e2c36, frameR: 0.22, back: 0x4d0f1f, backR: 0.38, layout: 'A' },    // P2 bordo
];

function makePhone(v) {
  const g = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: v.frame, metalness: 1, roughness: v.frameR, clearcoat: 0.3, clearcoatRoughness: 0.2 });
  const back = new THREE.MeshPhysicalMaterial({ color: v.back, metalness: 0.1, roughness: v.backR, clearcoat: 1, clearcoatRoughness: 0.32, sheen: 0.4, sheenColor: new THREE.Color(0xffe2d0), sheenRoughness: 0.6 });
  const body = new THREE.Mesh(bodyGeo, [back, metal]);
  g.add(body);
  const fg = new THREE.Mesh(frontGlassGeo, frontMat); fg.position.z = FRONT + 0.0004; g.add(fg);
  const scrMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
  const scr = new THREE.Mesh(screenGeo, scrMat); scr.position.z = FRONT + 0.0008; g.add(scr);
  const isl = new THREE.Mesh(islandGeo, islandMat); isl.position.set(0, PH / 2 - 0.07, FRONT + 0.0012); g.add(isl);
  // buttons
  const b1 = new THREE.Mesh(btnGeo(0.17), metal); b1.position.set(PW / 2 + 0.003, 0.22, 0); g.add(b1);
  const b2 = new THREE.Mesh(btnGeo(0.1), metal); b2.position.set(-PW / 2 - 0.003, 0.34, 0); g.add(b2);
  const b3 = new THREE.Mesh(btnGeo(0.1), metal); b3.position.set(-PW / 2 - 0.003, 0.2, 0); g.add(b3);
  const b4 = new THREE.Mesh(btnGeo(0.05), metal); b4.position.set(-PW / 2 - 0.003, 0.48, 0); g.add(b4);
  // camera
  const lens = (x, y, z, ringMat) => {
    const r = new THREE.Mesh(ringGeo, ringMat); r.position.set(x, y, z); g.add(r);
    const l = new THREE.Mesh(lensGeo, lensMat); l.position.set(x, y, z - 0.002); g.add(l);
    const li = new THREE.Mesh(lensInGeo, lensInMat); li.position.set(x, y, z - 0.003); g.add(li);
  };
  if (v.layout === 'A') {
    const cx = PW / 2 - 0.045 - 0.165, cy = PH / 2 - 0.045 - 0.165;
    const modMat = new THREE.MeshPhysicalMaterial({ color: v.back, metalness: 0.15, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02 });
    const m = new THREE.Mesh(modGeo, modMat); m.position.set(cx, cy, -FRONT - 0.009); g.add(m);
    const z = -FRONT - 0.03;
    lens(cx + 0.075, cy + 0.08, z, metal); lens(cx + 0.075, cy - 0.08, z, metal); lens(cx - 0.08, cy, z, metal);
    const f = new THREE.Mesh(smallGeo, flashMat); f.position.set(cx - 0.085, cy + 0.11, -FRONT - 0.021); g.add(f);
    const d = new THREE.Mesh(smallGeo, lensMat); d.position.set(cx - 0.085, cy - 0.11, -FRONT - 0.021); d.scale.setScalar(0.85); g.add(d);
  } else {
    const x = PW / 2 - 0.15, z = -FRONT - 0.012;
    [0.52, 0.335, 0.15].forEach(y => lens(x, y, z, metal));
    const f = new THREE.Mesh(smallGeo, flashMat); f.position.set(x - 0.13, 0.52, -FRONT - 0.004); g.add(f);
  }
  g.userData.screen = scrMat;
  return g;
}
const phones = VARIANTS.map(v => { const p = makePhone(v); scene.add(p); return p; });

// ---------- screen textures ----------
function wallpaperTex(variant) {
  const c = document.createElement('canvas'); c.width = 900; c.height = 1922;
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, c.height);
  const tones = variant === 1 ? ['#2a0c10', '#6e2a2c', '#140507'] : variant === 2 ? ['#16040a', '#5a1022', '#0a0204'] : ['#120408', '#3d0a17', '#060203'];
  gr.addColorStop(0, tones[0]); gr.addColorStop(.55, tones[1]); gr.addColorStop(1, tones[2]);
  x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
  x.filter = 'blur(38px)';
  const silk = (y0, y1, col, w) => { x.beginPath(); x.moveTo(-100, y0); x.bezierCurveTo(300, y0 - 500, 600, y1 + 400, 1000, y1); x.strokeStyle = col; x.lineWidth = w; x.stroke(); };
  silk(1500, 900, 'rgba(160,30,60,.55)', 260);
  silk(1750, 1150, 'rgba(110,15,40,.7)', 320);
  silk(1300, 700, 'rgba(255,200,170,.18)', 60);
  silk(1620, 1000, 'rgba(255,225,200,.22)', 24);
  x.filter = 'blur(6px)';
  silk(1580, 980, 'rgba(255,235,215,.25)', 4);
  x.filter = 'none';
  x.fillStyle = '#f4e8d6'; x.textAlign = 'center';
  x.font = '400 40px Montserrat'; x.letterSpacing = '2px';
  x.fillText('Četvrtak, 12. novembar', 450, 330);
  x.font = '200 250px Montserrat'; x.letterSpacing = '0px';
  x.fillText('10:24', 450, 560);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function logoTex() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 1922;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(450, 900, 30, 450, 900, 1200);
  gr.addColorStop(0, '#6a1428'); gr.addColorStop(.45, '#2a0610'); gr.addColorStop(1, '#070203');
  x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = 'rgba(239,227,207,.55)'; x.lineWidth = 3;
  x.beginPath(); x.arc(450, 860, 230, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = 'rgba(239,227,207,.18)'; x.lineWidth = 2;
  x.beginPath(); x.arc(450, 860, 262, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#f2e6d3'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '200 200px Montserrat'; x.letterSpacing = '18px';
  x.fillText('ZT', 459, 872);
  x.font = '500 44px Montserrat'; x.letterSpacing = '16px';
  x.fillText('ZONA TELEFONA', 458, 1230);
  x.globalAlpha = .7; x.font = '400 28px Montserrat'; x.letterSpacing = '10px';
  x.fillText('@zona.telefona', 455, 1300);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------- scan FX (otkup) ----------
const scanMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uA: { value: 0 }, uDir: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec2 vUv; uniform float uA,uDir;
    void main(){ float y=vUv.y; float line=exp(-pow((y-.5)*90.,2.));
      float trail=exp(-max(0.,(y-.5)*uDir)*9.)*step(0.,(y-.5)*uDir)*.35;
      float ex=smoothstep(0.,.12,vUv.x)*smoothstep(1.,.88,vUv.x);
      vec3 c=vec3(1.,.9,.8)*line*3.5+vec3(.9,.35,.45)*trail;
      gl_FragColor=vec4(c*ex*uA,1.);} `
});
const scan = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.5), scanMat);
scan.position.z = -FRONT - 0.05; phones[2].add(scan);

// ---------- swap trails (zamena) ----------
const trailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.5, 2.1), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.0, 0.9), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0035, 8, 200), ringMat);
ring.rotation.x = Math.PI / 2; scene.add(ring);
let trails = [];
function setTrails(list) {
  trails.forEach(m => { scene.remove(m); m.geometry.dispose(); }); trails = [];
  for (const pts of list) {
    if (pts.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.007, 8, false), trailMat);
    scene.add(m); trails.push(m);
  }
}

// ---------- post ----------
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.5, 0.75, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uZoom: { value: 0 }, uCA: { value: 0.002 }, uFade: { value: 1 }, uRes: { value: new THREE.Vector2(W, H) } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uZoom,uCA,uFade; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){
      vec2 c=vec2(.5); vec2 d=vUv-c; vec3 col=vec3(0.);
      float ca=uCA+uZoom*.012; float r2=dot(d,d);
      int N=uZoom<.01?1:14;
      for(int i=0;i<14;i++){
        if(i>=N) break;
        float s=N==1?1.:1.-uZoom*.16*float(i)/float(N-1);
        vec2 p=c+d*s;
        col.r+=texture2D(tDiffuse,c+d*s*(1.+ca*(.6+r2*3.))).r;
        col.g+=texture2D(tDiffuse,p).g;
        col.b+=texture2D(tDiffuse,c+d*s*(1.-ca*(.6+r2*3.))).b;
      }
      col/=float(N);
      // grade: burgundy shadows, cream highlights
      float l=dot(col,vec3(.299,.587,.114));
      col=mix(col, col*vec3(1.05,.93,.95)+vec3(.012,.002,.005), 1.-smoothstep(.0,.35,l));
      col=mix(col, col*vec3(1.03,1.0,.94), smoothstep(.45,1.,l));
      col=clamp(col,0.,1.);
      col=col*col*(3.-2.*col)*.22+col*.78; // gentle S-curve
      float v=smoothstep(1.05,.2,length(d*vec2(1.25,.95)));
      col*=mix(.42,1.,v);
      col*=uFade;
      col+=(hash(vUv*uRes+fract(uTime*7.)*97.)-.5)*.028;
      gl_FragColor=vec4(col,1.);
    }`
});
composer.addPass(grade);

// ---------- DOM helpers ----------
const $ = id => document.getElementById(id);
document.querySelectorAll('.split').forEach(el => {
  const txt = el.textContent; el.textContent = '';
  for (const ch of txt) {
    const s = document.createElement('span'); s.className = 'ch' + (ch === ' ' ? ' sp' : '');
    s.textContent = ch === ' ' ? ' ' : ch; el.appendChild(s);
  }
});
const uiKids = Array.from($('ui').children);
function vis(el, on) { el.style.visibility = on ? 'visible' : 'hidden'; }
function chars(el, t, t0, { dur = .8, st = .035, y = .55, blur = 12, ease = eOutExpo, from = 'up' } = {}) {
  const cs = el.querySelectorAll('.ch');
  cs.forEach((c, i) => {
    const p = ease(prog(t, t0 + i * st, t0 + i * st + dur));
    c.style.opacity = p.toFixed(4);
    const yy = (from === 'up' ? 1 : -1) * (1 - p) * y;
    c.style.transform = `translateY(${yy.toFixed(4)}em)`;
    c.style.filter = p < .999 ? `blur(${((1 - p) * blur).toFixed(2)}px)` : 'none';
  });
}
function outFx(el, t, t0, dur = .35, { scale = .04, rise = 36, blur = 16 } = {}, extra = '') {
  const p = eInCubic(prog(t, t0, t0 + dur));
  el.style.opacity = (1 - p).toFixed(4);
  el.style.filter = p > 0 ? `blur(${(p * blur).toFixed(2)}px)` : 'none';
  el.style.transform = `${extra} translateY(${(-p * rise).toFixed(2)}px) scale(${(1 + p * scale).toFixed(4)})`;
}
function fadeIn(el, t, t0, dur = .6, { y = 30, blur = 14, ease = eOutExpo } = {}, extra = '') {
  const p = ease(prog(t, t0, t0 + dur));
  el.style.opacity = p.toFixed(4);
  el.style.filter = p < .999 ? `blur(${((1 - p) * blur).toFixed(2)}px)` : 'none';
  el.style.transform = `${extra} translateY(${((1 - p) * y).toFixed(2)}px)`;
  return p;
}
function tracking(el, t, t0, dur, a, b) {
  const p = eOutExpo(prog(t, t0, t0 + dur));
  const ls = lerp(a, b, p);
  el.style.letterSpacing = ls.toFixed(4) + 'em'; el.style.paddingLeft = ls.toFixed(4) + 'em';
  el.style.opacity = clamp(p * 1.4).toFixed(4);
  el.style.filter = p < .999 ? `blur(${((1 - p) * 26).toFixed(2)}px)` : 'none';
  return p;
}
function shine(el, t, t0, dur) {
  const p = eInOutSine(prog(t, t0, t0 + dur));
  el.style.backgroundPosition = `${lerp(100, 0, p).toFixed(2)}% 0`;
}
function rule(el, t, t0, dur) {
  const p = eOutExpo(prog(t, t0, t0 + dur));
  el.style.transform = `scaleX(${p.toFixed(4)})`; el.style.opacity = p.toFixed(4);
}
function section(id, t, tin, tout) {
  const root = $(id); const on = t >= tin - .05 && t < tout + .4; vis(root, on); if (!on) return;
  chars($(id + 'i'), t, tin, { dur: .7, st: .02, y: .8, blur: 8 });
  chars($(id + 't'), t, tin + .12, { dur: .9, st: .05, y: .5, blur: 18 });
  chars($(id + 's'), t, tin + .45, { dur: .9, st: .018, y: .45, blur: 10 });
  outFx(root, t, tout);
}

// ---------- phone/camera setters ----------
const tmpV = new THREE.Vector3();
function P(i, pos, rot, on = true, s = 1) {
  const p = phones[i]; p.visible = on; if (!on) return;
  p.position.set(...pos); p.rotation.set(rot[0], rot[1], rot[2], 'YXZ'); p.scale.setScalar(s);
  p.updateMatrixWorld(true);
}
function cam(pos, target, roll = 0, fov = 32) {
  camera.position.set(...pos); camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(...target);
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); fitBg(); }
}
function orbitPos(target, ang, dist, h) { return [target[0] + Math.sin(ang) * dist, target[1] + h, target[2] + Math.cos(ang) * dist]; }
const local = (i, v) => { tmpV.set(...v); phones[i].localToWorld(tmpV); return [tmpV.x, tmpV.y, tmpV.z]; };

let TEX = null;
const float = (t, i) => Math.sin(t * 1.3 + i * 2.1) * 0.018;

// ---------- the timeline ----------
function setTime(t) {
  uiKids.forEach(k => vis(k, false));
  phones.forEach(p => { p.visible = false; });
  scan.visible = false; ring.visible = false; setTrails([]);
  let glow = 1, glowPos = [0.5, 0.52], rays = .6, fade = 1, envRot = 0.4 + t * 0.2, pAmt = 1, pSpeed = t * 0.15;
  let shake = 0;

  // ===== S1 HOOK 0 – 3.0 =====
  if (t < 3.0) {
    const e = eInOutSine(prog(t, 0.0, 2.55));
    const ed = eOutCubic(prog(t, 0.0, 2.55));
    P(0, [0, 0, 0], [lerp(0.38, -0.05, e), lerp(Math.PI + 0.75, 0.2, e), lerp(-0.3, 0.02, e)]);
    phones[0].userData.screen.emissiveMap = TEX.wall0;
    phones[0].userData.screen.emissiveIntensity = lerp(0, 1, eOutCubic(prog(t, 1.45, 2.0))) + 0.6 * pulse(t, 1.5, .05, .25);
    let target = L3([0.02, 0.44, 0], [0, 0.12, 0], ed);
    let pos = orbitPos(target, lerp(-0.55, 0.14, e), lerp(1.05, 4.7, ed), lerp(0.2, 0.28, ed));
    const k = eInExpo(prog(t, 2.55, 3.0));
    if (k > 0) {
      pos = L3(pos, local(0, [0, 0.02, 0.16]), k);
      target = L3(target, local(0, [0, 0.02, 0]), k);
      phones[0].userData.screen.emissiveIntensity += k * 0.6;
    }
    cam(pos, target, lerp(-0.08, 0, ed));
    glow = lerp(0.25, 0.85, ed) + k * 0.6; rays = .4; envRot = 1.4 + t * 0.9;
    fade = t < 0.12 ? 0 : 1;
    shake = pulse(t, 0.15, .01, .25) * 0.6;
    // text
    vis($('s1'), t > 0.8);
    chars($('s1a'), t, 0.85, { dur: .9, st: .028, y: .6, blur: 14 });
    chars($('s1b'), t, 1.45, { dur: 1.0, st: .045, y: .4, blur: 20 });
    outFx($('s1'), t, 2.6, .32);
  }
  // ===== S2 BRAND 3.0 – 6.0 (+ phone flight into S3 from 5.6) =====
  else if (t < 6.0) {
    const c3 = camS3(Math.max(t, 5.6));
    const u = eInOutSine(prog(t, 3.0, 5.6));
    const pos = [c3.pos[0], c3.pos[1] + lerp(0.6, 0, u), c3.pos[2] + lerp(3.2, 0, u)];
    cam(pos, c3.target, lerp(0.05, 0, u));
    glow = lerp(1.7, 1.15, prog(t, 3.0, 5.8)) + 0.5 * pulse(t, 3.25, .03, .5); rays = 1.0; pSpeed = 0.45 + (t - 3) * 1.4;
    glowPos = [0.5, 0.56];
    phonesS3(t);
    const s2 = $('s2'); vis(s2, t < 5.95);
    tracking($('s2z'), t, 3.0, .7, 1.25, .42);
    rule($('s2r'), t, 3.28, 1.0);
    chars($('s2t'), t, 3.35, { dur: .8, st: .04, y: .6, blur: 12 });
    chars($('s2s'), t, 3.9, { dur: .8, st: .015, y: .5, blur: 8 });
    shine($('s2z'), t, 4.05, 1.0);
    outFx(s2, t, 5.55, .4, { scale: .22, rise: 0, blur: 26 });
    shake = pulse(t, 3.25, .02, .3) * 0.35;
  }
  // ===== S3 KUPOVINA 6.0 – 10.0 =====
  else if (t < 10.0) {
    const c3 = camS3(t); cam(c3.pos, c3.target, c3.roll);
    phonesS3(t);
    glow = 1.15; rays = .8; glowPos = [0.5, 0.45];
    section('s3', t, 6.85, 9.55);
    shake = (pulse(t, 6.0, .02, .2) + pulse(t, 6.5, .02, .18) * .6 + pulse(t, 7.0, .02, .18) * .6) * 0.5;
  }
  // ===== S4 OTKUP 10.0 – 14.0 =====
  else if (t < 14.0) {
    const e = eOutCubic(prog(t, 10.0, 14.0));
    P(2, [0, float(t, 2), 0], [0.1, Math.PI - 0.42 + 1.35 * (1 - e), -0.04]);
    let d = lerp(4.2, 5.9, eOutExpo(prog(t, 10.0, 11.4))) - 0.3 * prog(t, 11.4, 14);
    d -= 3.6 * eInExpo(prog(t, 13.55, 14.0));
    const target = [0, -0.04, 0];
    cam(orbitPos(target, lerp(0.28, -0.16, eInOutSine(prog(t, 10, 14))), d, 0.35), target, lerp(0.04, -0.02, e));
    // scan
    const s1p = prog(t, 10.5, 11.7), s2p = prog(t, 11.7, 12.9);
    scan.visible = t > 10.4 && t < 13.0;
    const yA = t < 11.7 ? lerp(0.78, -0.78, eInOutSine(s1p)) : lerp(-0.78, 0.78, eInOutSine(s2p));
    scan.position.y = yA; scanMat.uniforms.uDir.value = t < 11.7 ? 1 : -1;
    scanMat.uniforms.uA.value = clamp(prog(t, 10.4, 10.6)) * (1 - prog(t, 12.8, 13.0));
    glow = 0.95; glowPos = [0.5, 0.53]; rays = .5;
    section('s4', t, 10.25, 13.5);
    // card
    const card = $('card'); vis(card, t > 10.3 && t < 13.95);
    fadeIn(card, t, 10.45, .8, { y: 60, blur: 18 });
    if (t > 13.5) outFx(card, t, 13.5, .35);
    const bp = prog(t, 10.6, 12.5);
    $('barfill').style.width = (bp * 100).toFixed(2) + '%';
    $('pct').textContent = Math.round(bp * 100) + '%';
    [['r1', 11.0], ['r2', 11.5], ['r3', 12.0]].forEach(([id, tc], i) => {
      const row = $(id); fadeIn(row, t, 10.6 + i * .1, .6, { y: 18, blur: 6 });
      const ck = eOutExpo(prog(t, tc, tc + .45));
      row.querySelector('.dot').style.opacity = (1 - ck).toFixed(3);
      const svg = row.querySelector('svg'); svg.style.opacity = ck.toFixed(3);
      svg.style.transform = `scale(${lerp(.6, 1, eOutCubic(prog(t, tc, tc + .35))).toFixed(3)})`;
      svg.querySelector('path').style.strokeDashoffset = (16 * (1 - ck)).toFixed(2);
    });
    fadeIn($('offer'), t, 12.5, .7, { y: 14, blur: 10 });
    shake = pulse(t, 10.0, .02, .2) * 0.3;
  }
  // ===== S5 ZAMENA 14.0 – 18.0 =====
  else if (t < 18.0) {
    const r = 0.52;
    const sw = eInOutCubic(prog(t, 14.9, 16.0));
    const phi = Math.PI * sw;
    const pA = ph => [-r * Math.cos(ph), 0, r * Math.sin(ph) * 1.25];
    const pB = ph => [r * Math.cos(ph), 0, -r * Math.sin(ph) * 1.25];
    const a = pA(phi), b = pB(phi);
    const spin = 2 * Math.PI * sw;
    P(1, [a[0], a[1] + float(t, 1), a[2]], [0.04, 0.3 * Math.cos(phi) + spin, 0]);
    P(0, [b[0], b[1] + float(t, 0), b[2]], [0.04, -0.3 * Math.cos(phi) - spin, 0]);
    phones[0].userData.screen.emissiveMap = TEX.wall0;
    let d = lerp(3.4, 5.6, eOutExpo(prog(t, 14.0, 15.0))) - 0.35 * prog(t, 15, 17.5);
    d -= 3.6 * eInExpo(prog(t, 17.55, 18.0));
    const target = [0, 0.28, 0];
    cam(orbitPos(target, lerp(-0.2, 0.18, eInOutSine(prog(t, 14, 18))), d, 0.55), target, 0);
    // ring + trails
    const ry = -PH / 2 - 0.06;
    ring.visible = true; ring.position.set(0, ry, 0); ring.scale.set(r, r * 1.25, 1);
    ringMat.opacity = 0.18 * eOutCubic(prog(t, 14.2, 14.9)) + 0.5 * pulse(t, 16.0, .03, .5);
    if (phi > 0.02 && t < 17.2) {
      const N = 40, la = [], lb = [];
      const ph0 = Math.max(0, phi - 2.4);
      for (let i = 0; i <= N; i++) { const ph = lerp(ph0, phi, i / N); const A = pA(ph), B = pB(ph); la.push([A[0], ry, A[2]]); lb.push([B[0], ry, B[2]]); }
      setTrails([la, lb]);
      trailMat.opacity = 1 - prog(t, 16.0, 17.0);
    }
    glow = 1.05; glowPos = [0.5, 0.47]; rays = .7;
    section('s5', t, 14.3, 17.5);
    // tags
    vis($('s5tags'), t > 14.6 && t < 17.9);
    const tagP = (tt) => { const v = new THREE.Vector3(tt[0], -PH / 2 - 0.2, tt[2]).project(camera); return [(v.x * .5 + .5) * W, (-v.y * .5 + .5) * H]; };
    const ta = tagP(a), tb = tagP(b);
    const o1 = $('tagOld'), o2 = $('tagNew');
    const pin = eOutExpo(prog(t, 14.7, 15.3)) * (1 - prog(t, 14.95, 15.15)) + eOutExpo(prog(t, 16.05, 16.6)) * (1 - prog(t, 17.4, 17.6));
    o1.style.left = (ta[0] - o1.offsetWidth / 2).toFixed(1) + 'px'; o1.style.top = (ta[1] + 10).toFixed(1) + 'px'; o1.style.opacity = pin.toFixed(3);
    o2.style.left = (tb[0] - o2.offsetWidth / 2).toFixed(1) + 'px'; o2.style.top = (tb[1] + 10).toFixed(1) + 'px'; o2.style.opacity = pin.toFixed(3);
    shake = pulse(t, 16.0, .02, .25) * 0.4 + pulse(t, 14.0, .02, .2) * .2;
  }
  // ===== S6 MONTAGE 18.0 – 21.0 =====
  else if (t < 21.0) {
    glow = 0.8; rays = .5; glowPos = [0.5, 0.5];
    if (t < 19.5) {
      const shot = Math.floor((t - 18.0) / 0.5), u = (t - 18.0 - shot * 0.5) / 0.5;
      const eu = eOutCubic(u);
      if (shot === 0) {
        P(2, [0, 0, 0], [0.08, Math.PI + 0.3, 0.06]);
        const c = local(2, L3([0.42, 0.66, -0.78], [-0.08, 0.5, -0.66], eu)), tg = local(2, [0.15, 0.5, -0.05]);
        cam(c, tg, 0.06);
      } else if (shot === 1) {
        P(1, [0, 0, 0], [0.0, Math.PI / 2 - 0.25, 0.22]);
        const c = local(1, L3([0.7, -0.85, 0.45], [0.62, 0.25, 0.5], eu)), tg = local(1, [0.34, lerp(-0.2, 0.3, eu), 0]);
        cam(c, tg, -0.1);
      } else {
        P(0, [0, 0, 0], [0.1, lerp(-0.5, -0.15, eu), 0]);
        phones[0].userData.screen.emissiveMap = TEX.wall0;
        const c = local(0, L3([-1.1, -1.0, -1.5], [-0.25, -0.75, -1.45], eu)), tg = local(0, [0.05, 0.25, 0]);
        cam(c, tg, 0.05);
      }
      fade = 0.62; envRot = t * 1.6;
      const ws = ['w1', 'w2', 'w3'];
      const w = $(ws[shot]); vis(w, true);
      const p = eOutExpo(prog(u, 0, .35));
      w.style.opacity = (clamp(p * 1.6) * (1 - prog(u, .82, 1))).toFixed(3);
      w.style.transform = `scale(${lerp(1.14, 1, p).toFixed(4)})`;
      w.style.filter = p < .99 ? `blur(${((1 - p) * 14).toFixed(2)}px)` : 'none';
      w.style.letterSpacing = lerp(0.06, 0.0, p).toFixed(4) + 'em';
      shake = pulse(u, 0.0, .01, .08) * .4;
    } else {
      const sp = eInCubic(prog(t, 19.5, 20.95));
      P(0, [0, float(t, 0), 0], [0.06 - 0.04 * sp, -0.25 + sp * Math.PI * 4, 0]);
      phones[0].userData.screen.emissiveMap = TEX.wall0;
      const target = [0, -0.36, 0];
      cam(orbitPos(target, lerp(0.2, -0.1, prog(t, 19.5, 21)), lerp(6.0, 4.6, eInOutSine(prog(t, 19.5, 21))), 0.25), target, 0);
      envRot = t * 0.6 + sp * 3;
      glow = 0.9 + sp * .8;
      vis($('s6'), true);
      chars($('s6a'), t, 19.55, { dur: .8, st: .025, y: .6, blur: 12 });
      chars($('s6b'), t, 19.85, { dur: .9, st: .035, y: .4, blur: 18 });
      outFx($('s6'), t, 20.7, .25);
      pSpeed = 0.5 + sp * 6;
    }
  }
  // ===== S7 END 21.0 – 26.0 =====
  else {
    const tt = t - 21.0;
    const e = eOutCubic(prog(t, 21.0, 23.6));
    P(0, [0, float(t, 0) * .7, 0], [0.04, -0.1 + 0.6 * (1 - e) + 0.05 * Math.sin(tt * 0.7), 0]);
    phones[0].userData.screen.emissiveMap = TEX.logo;
    phones[0].userData.screen.emissiveIntensity = 1.0 + 0.35 * pulse(t, 21.0, .02, .5);
    const side = eOutExpo(prog(t, 21.0, 22.2));
    P(1, [lerp(-2.6, -1.34, side), -0.25 + float(t, 1), -2.4], [0.02, 0.62, 0]);
    P(2, [lerp(2.6, 1.34, side), -0.25 + float(t, 2), -2.4], [0.02, -0.62, 0]);
    phones[2].userData.screen.emissiveMap = TEX.wall2;
    phones[1].userData.screen.emissiveMap = TEX.wall1;
    const target = [0, -0.42, 0];
    cam(orbitPos(target, lerp(0.14, -0.05, eOutCubic(prog(t, 21, 26))), lerp(5.7, 4.95, eOutCubic(prog(t, 21, 26))), 0.22), target, 0);
    glow = 1.25 + 0.6 * pulse(t, 21.0, .02, .6); glowPos = [0.5, 0.66]; rays = 1.0; envRot = 0.9 + tt * 0.35;
    fade = 1 - eInCubic(prog(t, 25.55, 26.0));
    // texts
    vis($('s7'), true);
    tracking($('s7z'), t, 21.05, .8, 1.2, .42);
    rule($('s7r'), t, 21.35, 1.0);
    chars($('s7t'), t, 21.45, { dur: .8, st: .04, y: .6, blur: 12 });
    shine($('s7z'), t, 23.9, 1.1);
    vis($('s7tag'), t > 22.1);
    chars($('s7tag'), t, 22.15, { dur: .9, st: .022, y: .45, blur: 12 });
    const pill = $('pill'); vis(pill, t > 22.7);
    fadeIn(pill, t, 22.75, .8, { y: 40, blur: 16 }, 'translateX(-50%)');
    pill.style.setProperty('--sx', lerp(-200, pill.offsetWidth + 80, eInOutSine(prog(t, 23.2, 24.2))).toFixed(1) + 'px');
    vis($('footer'), t > 23.3);
    chars($('footer'), t, 23.35, { dur: .7, st: .012, y: .6, blur: 6 });
    shake = pulse(t, 21.0, .02, .35) * 0.6;
  }

  // ---- global FX ----
  let flash = 0.55 * pulse(t, 0.15, .02, .22) + 0.22 * pulse(t, 3.25, .02, .3) + 0.22 * pulse(t, 6.0, .015, .18)
    + 0.08 * pulse(t, 6.5, .015, .15) + 0.08 * pulse(t, 7.0, .015, .15) + 0.12 * pulse(t, 10.0, .015, .2) + 0.12 * pulse(t, 14.0, .015, .2)
    + 0.12 * pulse(t, 16.0, .015, .2) + 0.18 * (pulse(t, 18.0, .01, .12) + pulse(t, 18.5, .01, .12) + pulse(t, 19.0, .01, .12))
    + 0.9 * pulse(t, 21.0, .14, .45);
  flash = Math.min(1, flash);
  let zoom = 0;
  for (const tz of [2.95, 5.95, 9.97, 13.97, 17.97]) zoom += bell(t, tz, 0.11);
  zoom += 0.35 * (bell(t, 18.5, .05) + bell(t, 19.0, .05) + bell(t, 19.5, .06)) + 0.5 * eInCubic(prog(t, 20.3, 20.98)) * (t < 21 ? 1 : 0) + 0.6 * bell(t, 21.0, 0.08);
  grade.uniforms.uZoom.value = Math.min(zoom, 1.4);
  grade.uniforms.uCA.value = 0.0025 + 0.004 * flash;
  grade.uniforms.uFade.value = fade;
  grade.uniforms.uTime.value = t;
  $('flash').style.opacity = flash.toFixed(4);
  $('ui').style.opacity = (t < 21 ? Math.min(1, fade / .62) : fade).toFixed(4);

  // camera shake
  if (shake > 0.001) {
    const s = shake * 0.035;
    camera.position.x += Math.sin(t * 91.0) * s; camera.position.y += Math.cos(t * 77.0) * s;
  }
  const fl = $('flare'), fl2 = $('flare2');
  const fAmt = clamp(0.9 * pulse(t, 0.15, .02, .45) + 0.8 * pulse(t, 3.25, .02, .6) + 0.5 * pulse(t, 6.0, .02, .3) + 0.9 * pulse(t, 21.0, .05, .7));
  vis(fl, fAmt > 0.005); vis(fl2, fAmt > 0.005);
  const fy = t < 3 ? 960 : t < 6 ? 900 : t < 21 ? 900 : 640;
  fl.style.top = fy + 'px'; fl2.style.top = fy + 'px';
  fl.style.opacity = fAmt.toFixed(3); fl2.style.opacity = fAmt.toFixed(3);
  fl.style.transform = `scaleX(${lerp(0.4, 1.2, clamp(fAmt)).toFixed(3)})`;

  bgMat.uniforms.uTime.value = t; bgMat.uniforms.uGlow.value = glow; bgMat.uniforms.uRays.value = rays;
  bgMat.uniforms.uGlowPos.value.set(glowPos[0], glowPos[1]);
  pMat.uniforms.uTime.value = t; pMat.uniforms.uAmt.value = pAmt; pMat.uniforms.uSpeed.value = pSpeed;
  scene.environmentRotation.set(0, envRot, 0);
  composer.render();
}

// S3 camera, valid from 5.6
function camS3(t) {
  const u = eInOutSine(prog(t, 5.6, 10.0));
  const target = [0, 0.3, -0.25];
  let r = lerp(6.6, 5.8, u);
  r -= 3.8 * eInExpo(prog(t, 9.55, 10.0));
  return { pos: orbitPos(target, lerp(-0.42, 0.36, u), r, lerp(0.75, 0.3, u)), target, roll: lerp(-0.03, 0.02, u) };
}
function phonesS3(t) {
  const fly = (i, t0, from, to, rotFrom, rotTo) => {
    if (t < t0 - 0.42) return;
    const f = eOutQuart(prog(t, t0 - 0.42, t0 + 0.05));
    const pos = L3(from, to, f); pos[1] += f >= 1 ? float(t, i) : 0;
    const rot = L3(rotFrom, rotTo, f); rot[1] += f >= 1 ? 0.06 * Math.sin((t - t0) * 0.7 + i) : 0;
    P(i, pos, rot);
    phones[i].userData.screen.emissiveMap = TEX['wall' + i];
    phones[i].userData.screen.emissiveIntensity = 1;
  };
  fly(0, 6.0, [0, -3.6, 1.2], [0, 0, 0], [0.9, -Math.PI * 2, 0.3], [0.03, 0, 0]);
  fly(1, 6.5, [-3.8, 1.6, -1.6], [-0.78, -0.06, -1.15], [-0.4, Math.PI * 2 + 0.45, -0.5], [0.03, 0.38, 0.0]);
  fly(2, 7.0, [3.8, -1.9, -1.6], [0.78, -0.06, -1.15], [0.5, -Math.PI * 2 - 0.45, 0.5], [0.03, -0.38, 0.0]);
}

// ---------- boot ----------
async function boot() {
  await document.fonts.load('200 100px Montserrat'); await document.fonts.load('300 100px Montserrat');
  await document.fonts.load('400 100px Montserrat'); await document.fonts.load('500 100px Montserrat');
  await document.fonts.load('italic 400 100px "Cormorant Garamond"');
  await document.fonts.load('italic 400 100px "Cormorant Garamond"', 'ćčšžđ');
  await document.fonts.ready;
  TEX = { wall0: wallpaperTex(0), wall1: wallpaperTex(1), wall2: wallpaperTex(2), logo: logoTex() };
  phones.forEach((p, i) => { p.userData.screen.emissiveMap = TEX['wall' + i]; p.userData.screen.needsUpdate = true; });
  fitBg();
  // warm-up compile
  for (const tw of [0.5, 4, 7, 11, 15, 18.2, 20, 23]) setTime(tw);
  window.setTime = setTime;
  window.READY = true;
}
boot();
