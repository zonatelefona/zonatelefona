import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 1080, H = 1920, FOV = 30, DURATION = 25;
// ---------- math ----------
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
const eOutBack = x => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const pulse = (t, t0, att, dec) => t < t0 - att ? 0 : t < t0 ? Math.pow((t - (t0 - att)) / att, 2) : Math.exp(-(t - t0) / dec);
const bell = (t, t0, w) => Math.exp(-Math.pow((t - t0) / w, 2));
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function catmull(keys, t) {           // keys: [[time,[x,y,z]],...]
  let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(keys.length - 1, i + 2)][1];
  const u = clamp((t - keys[i][0]) / (keys[i + 1][0] - keys[i][0])), u2 = u * u, u3 = u2 * u;
  return [0, 1, 2].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3));
}

// impacts (same times in audio.py)
const HITS = [[.6, 1.3], [1.1, .9], [3.0, .8], [4.4, .6], [4.9, 1.0], [7.0, .8], [8.0, .6], [8.5, 1.1], [9.0, .6], [13.0, .6], [13.3, .8],
  [14.3, .6], [14.6, .6], [15.2, 1.1], [18.5, 1.5], [19.6, .7], [21.0, .7], [22.0, .5]];

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, W / H, .02, 200); scene.add(camera);
const SH = d => 2 * d * Math.tan(THREE.MathUtils.degToRad(FOV / 2));

// neutral studio environment, single orange accent strip
{
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(.006, .006, .007), side: THREE.BackSide })));
  const panel = (w, h, c, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(...pos); m.rotation.set(...rot); env.add(m); };
  panel(7, 4, new THREE.Color(3, 3, 3), [0, 9.8, 0], [Math.PI / 2, 0, 0]);
  panel(.8, 16, new THREE.Color(8, 8, 8), [-9.8, 0, -1], [0, Math.PI / 2, 0]);
  panel(1.2, 16, new THREE.Color(5, 5, 5.2), [9.8, 0, 1], [0, -Math.PI / 2, 0]);
  panel(.5, 14, new THREE.Color(7, 2.2, .35), [9.8, 0, -4], [0, -Math.PI / 2, 0]);     // orange accent
  panel(14, .5, new THREE.Color(4, 4, 4), [0, 2.2, 9.8], [0, Math.PI, 0]);
  panel(.4, 14, new THREE.Color(3, 3, 3), [-3.5, 0, 9.8], [0, Math.PI, 0]);
  panel(16, 10, new THREE.Color(.06, .06, .065), [0, -2, -9.8], [0, 0, 0]);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, .03).texture; pm.dispose();
}
const rimW = new THREE.DirectionalLight(0xffffff, 1.2); rimW.position.set(-4, 2, -4); scene.add(rimW);
const rimO = new THREE.DirectionalLight(0xff6a13, 2.0); rimO.position.set(4, 1, -3); scene.add(rimO);
const key = new THREE.DirectionalLight(0xffffff, .6); key.position.set(2, 3, 5); scene.add(key);

// background: dark grey studio sweep + soft spot
const bgMat = new THREE.ShaderMaterial({
  depthWrite: false, depthTest: false,
  uniforms: { uTime: { value: 0 }, uSpot: { value: 1 }, uSpotPos: { value: new THREE.Vector2(.5, .55) }, uOr: { value: 0 }, uAspect: { value: W / H } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec2 vUv; uniform float uTime,uSpot,uOr,uAspect; uniform vec2 uSpotPos;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    void main(){ vec2 p=vUv; vec2 q=(p-uSpotPos)*vec2(uAspect,1.);
      float s=exp(-dot(q,q)*3.2); float s2=exp(-dot(q,q)*.9);
      float sm=n(p*vec2(3.,5.)+uTime*.05)*.5+n(p*7.-uTime*.04)*.25;
      vec3 col=vec3(.002)+vec3(.014,.014,.016)*s2*uSpot+vec3(.03,.029,.028)*s*uSpot*(.8+.4*sm);
      col+=vec3(1.,.28,.03)*.05*uOr*s*(.6+sm);
      gl_FragColor=vec4(col,1.); }`
});
const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
bg.position.z = -80; bg.scale.set(SH(80) * W / H * 1.05, SH(80) * 1.05, 1); bg.renderOrder = -10; bg.frustumCulled = false; camera.add(bg);

// dust
const DN = 700; const dGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(DN * 3), sd = new Float32Array(DN); let s = 777; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < DN; i++) { pos.set([(r() - .5) * 8, (r() - .5) * 10, -16 + r() * 22], i * 3); sd[i] = r(); }
  dGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dGeo.setAttribute('aS', new THREE.BufferAttribute(sd, 1));
}
const dMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uA: { value: 1 } },
  vertexShader: `attribute float aS; uniform float uTime; varying float vA; void main(){ vec3 p=position; p.y+=sin(uTime*.2+aS*30.)*.3+uTime*.04*(aS-.5); p.x+=cos(uTime*.15+aS*20.)*.2;
    vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=clamp((1.5+aS*3.)*(5./max(.3,-mv.z)),1.,40.); vA=(.25+.75*aS)*smoothstep(.2,1.5,-mv.z)*(.5+.5*sin(uTime*2.+aS*40.)); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vA; uniform float uA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(vec3(1.,.92,.85)*a*a*vA*uA*.55,1.); }`
});
scene.add(Object.assign(new THREE.Points(dGeo, dMat), { frustumCulled: false }));

// ---------- phones ----------
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI, false); return s;
}
function rrPlane(w, h, r) { const g = new THREE.ShapeGeometry(rrShape(w, h, r), 24); const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h); return g; }
const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x020306, roughness: .03, metalness: .2, clearcoat: 1, clearcoatRoughness: .02, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 520] });
const lensInMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1020, roughness: 0, metalness: .6, clearcoat: 1 });
const flashMat = new THREE.MeshPhysicalMaterial({ color: 0xe0d8c6, roughness: .35, clearcoat: 1 });
const frontMat = new THREE.MeshPhysicalMaterial({ color: 0x010101, roughness: .05, clearcoat: 1, clearcoatRoughness: .02 });
const blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const cyl = (r, h, n = 64) => new THREE.CylinderGeometry(r, r, h, n, 1).rotateX(Math.PI / 2);

function makePhone(v) {
  const { w, h, r, d = .082, bev = .018 } = v;
  const g = new THREE.Group(); const F = d / 2;
  const metal = new THREE.MeshPhysicalMaterial({ color: v.frame, metalness: 1, roughness: v.frameR, clearcoat: .3, clearcoatRoughness: .2 });
  const back = new THREE.MeshPhysicalMaterial({ color: v.back, metalness: v.backM ?? .1, roughness: v.backR, clearcoat: 1, clearcoatRoughness: .3 });
  const body = new THREE.ExtrudeGeometry(rrShape(w - 2 * bev, h - 2 * bev, r - bev), { depth: d - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 8, curveSegments: 28 });
  body.translate(0, 0, -(d - 2 * bev) / 2); body.computeVertexNormals();
  g.add(new THREE.Mesh(body, [back, metal]));
  const fg = new THREE.Mesh(rrPlane(w - .026, h - .026, r - .01), frontMat); fg.position.z = F + .0004; g.add(fg);
  const scrMat = new THREE.MeshPhysicalMaterial({ color: 0, emissive: 0xffffff, emissiveIntensity: 1, roughness: .05, clearcoat: 1, clearcoatRoughness: .02 });
  let scr;
  if (v.layout === 'OLD') {
    scr = new THREE.Mesh(rrPlane(w - .08, h - .36, .012), scrMat);
    const hb = new THREE.Mesh(new THREE.RingGeometry(.036, .046, 48), new THREE.MeshPhysicalMaterial({ color: 0x555555, metalness: .8, roughness: .3 })); hb.position.set(0, -h / 2 + .09, F + .001); g.add(hb);
    const ear = new THREE.Mesh(rrPlane(.12, .014, .007), blackMat); ear.position.set(0, h / 2 - .09, F + .001); g.add(ear);
  } else {
    scr = new THREE.Mesh(rrPlane(w - .05, h - .05, Math.max(.02, r - .023)), scrMat);
    if (v.layout === 'U') { const ph = new THREE.Mesh(new THREE.CircleGeometry(.018, 32), blackMat); ph.position.set(0, h / 2 - .06, F + .0012); g.add(ph); }
    else { const isl = new THREE.Mesh(rrPlane(.19, .054, .027), blackMat); isl.position.set(0, h / 2 - .07, F + .0012); g.add(isl); }
  }
  scr.position.z = F + .0008; g.add(scr);
  const btn = hh => new RoundedBoxGeometry(.012, hh, .02, 3, .005);
  [[w / 2 + .003, .22, .17], [-w / 2 - .003, .34, .1], [-w / 2 - .003, .2, .1], [-w / 2 - .003, .48, .05]].forEach(([x, y, hh]) => { const b = new THREE.Mesh(btn(hh), metal); b.position.set(x, y, 0); g.add(b); });
  const lens = (x, y, z, rr = .066) => {
    const a = new THREE.Mesh(cyl(rr, .028), metal); a.position.set(x, y, z); g.add(a);
    const l = new THREE.Mesh(cyl(rr * .76, .03), lensMat); l.position.set(x, y, z - .002); g.add(l);
    const li = new THREE.Mesh(cyl(rr * .4, .031, 48), lensInMat); li.position.set(x, y, z - .003); g.add(li);
  };
  if (v.layout === 'A') {
    const cx = w / 2 - .21, cy = h / 2 - .21;
    const mg = new THREE.ExtrudeGeometry(rrShape(.33, .33, .08), { depth: .006, bevelEnabled: true, bevelThickness: .006, bevelSize: .008, bevelSegments: 5, curveSegments: 20 }); mg.translate(0, 0, -.009);
    const m = new THREE.Mesh(mg, new THREE.MeshPhysicalMaterial({ color: v.back, metalness: .15, roughness: .08, clearcoat: 1 })); m.position.set(cx, cy, -F - .009); g.add(m);
    const z = -F - .03; lens(cx + .075, cy + .08, z); lens(cx + .075, cy - .08, z); lens(cx - .08, cy, z);
    const f = new THREE.Mesh(cyl(.019, .012, 32), flashMat); f.position.set(cx - .085, cy + .11, -F - .021); g.add(f);
  } else if (v.layout === 'U') {
    const x = w / 2 - .14, z = -F - .012;
    [h / 2 - .16, h / 2 - .31, h / 2 - .46, h / 2 - .61].forEach((y, i) => lens(x, y, z, i === 3 ? .056 : .064));
    const f = new THREE.Mesh(cyl(.02, .012, 32), flashMat); f.position.set(x - .13, h / 2 - .16, -F - .004); g.add(f);
  } else if (v.layout === 'B') {
    const x = w / 2 - .15, z = -F - .012; [.52, .335, .15].forEach(y => lens(x, y, z));
    const f = new THREE.Mesh(cyl(.019, .012, 32), flashMat); f.position.set(x - .13, .52, -F - .004); g.add(f);
  } else {   // OLD: single lens
    lens(w / 2 - .11, h / 2 - .11, -F - .008, .045);
    const f = new THREE.Mesh(cyl(.016, .01, 32), flashMat); f.position.set(w / 2 - .11, h / 2 - .2, -F - .004); g.add(f);
  }
  g.userData.screen = scrMat; g.visible = false; scene.add(g); return g;
}
const PH = 1.47;
const P = [
  makePhone({ w: .66, h: 1.34, r: .11, d: .098, bev: .03, frame: 0x9a9da2, frameR: .45, back: 0x8d9095, backM: .9, backR: .42, layout: 'OLD' }),   // 0 old
  makePhone({ w: .715, h: 1.47, r: .105, frame: 0x45464b, frameR: .24, back: 0x151518, backR: .42, layout: 'A' }),                              // 1 pro black titanium
  makePhone({ w: .715, h: 1.47, r: .105, frame: 0xd8601c, frameR: .22, back: 0xe56a24, backR: .42, layout: 'A' }),                              // 2 pro orange
  makePhone({ w: .76, h: 1.56, r: .045, d: .084, bev: .012, frame: 0xa3a6ab, frameR: .2, back: 0x2a2d32, backR: .35, layout: 'U' }),           // 3 ultra titanium
  makePhone({ w: .715, h: 1.47, r: .105, frame: 0x26282c, frameR: .2, back: 0x18191c, backR: .3, layout: 'B' }),                               // 4 samsung graphite
  makePhone({ w: .715, h: 1.47, r: .105, frame: 0x8e887d, frameR: .24, back: 0x7b766d, backR: .45, layout: 'A' }),                              // 5 pro natural titanium
  makePhone({ w: .76, h: 1.56, r: .045, d: .084, bev: .012, frame: 0x2b2c30, frameR: .22, back: 0x111214, backR: .3, layout: 'U' }),           // 6 ultra black
];
function setP(i, pos, rot, o = {}) { const p = P[i]; p.visible = true; p.position.set(...pos); p.rotation.set(rot[0], rot[1], rot[2], 'YXZ'); p.scale.setScalar(o.s ?? 1); p.updateMatrixWorld(true); if (o.scr !== undefined) p.userData.screen.emissiveIntensity = o.scr; if (o.tex) p.userData.screen.emissiveMap = o.tex; }
const tmpV = new THREE.Vector3();
const local = (i, v) => { tmpV.set(...v); P[i].localToWorld(tmpV); return [tmpV.x, tmpV.y, tmpV.z]; };

// screens
function wallTex(hue = 0) {
  const c = document.createElement('canvas'); c.width = 900; c.height = 1922; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#050506'); gr.addColorStop(.6, hue ? '#1a0a04' : '#0d0e12'); gr.addColorStop(1, '#020202');
  x.fillStyle = gr; x.fillRect(0, 0, 900, 1922);
  x.filter = 'blur(42px)';
  const silk = (y0, y1, col, wd) => { x.beginPath(); x.moveTo(-100, y0); x.bezierCurveTo(300, y0 - 520, 600, y1 + 420, 1000, y1); x.strokeStyle = col; x.lineWidth = wd; x.stroke(); };
  if (hue) { silk(1500, 900, 'rgba(255,90,10,.7)', 240); silk(1760, 1150, 'rgba(200,50,0,.6)', 300); }
  else { silk(1500, 900, 'rgba(120,130,150,.55)', 240); silk(1760, 1150, 'rgba(60,70,90,.6)', 300); silk(1600, 1000, 'rgba(255,120,40,.35)', 50); }
  x.filter = 'blur(5px)'; silk(1580, 980, 'rgba(255,230,210,.45)', 5); x.filter = 'none';
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '700 40px Montserrat'; x.fillText('Četvrtak, 12. novembar', 450, 330);
  x.font = '800 240px Montserrat'; x.fillText('10:24', 450, 560);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function oldTex() {
  const c = document.createElement('canvas'); c.width = 600; c.height = 1050; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 1050); gr.addColorStop(0, '#1d2a3a'); gr.addColorStop(1, '#0a0e14'); x.fillStyle = gr; x.fillRect(0, 0, 600, 1050);
  x.fillStyle = 'rgba(255,255,255,.75)'; x.textAlign = 'center'; x.font = '300 130px Montserrat'; x.fillText('9:41', 300, 260);
  x.font = '700 28px Montserrat'; x.fillStyle = 'rgba(255,90,60,.9)'; x.fillText('Baterija 4%', 300, 320);
  // cracks
  const cx = 420, cy = 700; x.strokeStyle = 'rgba(235,240,255,.75)'; x.lineCap = 'round';
  for (let k = 0; k < 16; k++) {
    let a = k / 16 * Math.PI * 2 + hash(k) * .3, px = cx, py = cy; x.lineWidth = 2.2; x.beginPath(); x.moveTo(px, py);
    const len = 200 + hash(k * 3.3) * 700;
    for (let s = 0; s < len; s += 24) { a += (hash(k * 13 + s) - .5) * .5; px += Math.cos(a) * 24; py += Math.sin(a) * 24; x.lineTo(px, py); }
    x.stroke();
  }
  for (let ring = 1; ring < 4; ring++) { x.lineWidth = 1.4; x.beginPath(); for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI * 2, rr = ring * 55 + hash(k + ring * 9) * 25; k ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(cx, cy, 30, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function logoTex() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 1922; const x = c.getContext('2d');
  const gr = x.createRadialGradient(450, 880, 20, 450, 880, 1100); gr.addColorStop(0, '#2a1206'); gr.addColorStop(.45, '#0c0604'); gr.addColorStop(1, '#020202');
  x.fillStyle = gr; x.fillRect(0, 0, 900, 1922);
  x.shadowColor = '#ff6a13'; x.shadowBlur = 40; x.strokeStyle = '#ff7a24'; x.lineWidth = 8; x.beginPath(); x.arc(450, 860, 230, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowBlur = 30; x.font = '900 220px Montserrat'; x.fillText('ZT', 450, 872);
  x.shadowBlur = 16; x.fillStyle = '#ff7a24'; x.font = '900 60px Montserrat'; x.fillText('ZONA TELEFONA', 450, 1240);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ---------- post ----------
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 5, aperture: .004, maxblur: .012 }); composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .35, .5, .9); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uZoom: { value: 0 }, uCA: { value: .0015 }, uFade: { value: 1 }, uRes: { value: new THREE.Vector2(W, H) } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uZoom,uCA,uFade; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){ vec2 c=vec2(.5), d=vUv-c; vec3 col=vec3(0.); float ca=uCA+uZoom*.012, r2=dot(d,d);
      int N=uZoom<.01?1:14;
      for(int i=0;i<14;i++){ if(i>=N) break; float s=N==1?1.:1.-uZoom*.16*float(i)/float(N-1);
        col.r+=texture2D(tDiffuse,c+d*s*(1.+ca*(.6+r2*3.))).r; col.g+=texture2D(tDiffuse,c+d*s).g; col.b+=texture2D(tDiffuse,c+d*s*(1.-ca*(.6+r2*3.))).b; }
      col/=float(N);
      float l=dot(col,vec3(.299,.587,.114));
      col=mix(col,col*vec3(1.04,1.0,.95),smoothstep(.35,1.,l)); col=mix(col,col*vec3(.95,.98,1.04),1.-smoothstep(0.,.3,l));
      col=clamp(col,0.,1.); col=col*col*(3.-2.*col)*.25+col*.75;
      float v=smoothstep(1.05,.2,length(d*vec2(1.2,.95))); col*=mix(.3,1.,v);
      col*=uFade; col+=(hash(vUv*uRes+fract(uTime*7.)*97.)-.5)*.026;
      gl_FragColor=vec4(col,1.); }`
});
composer.addPass(grade);

// ---------- DOM helpers (kinetic type) ----------
const $ = id => document.getElementById(id);
const content = $('content');
const show = (el, on = true) => { el.style.visibility = on ? 'visible' : 'hidden'; };
const setMB = (n, px) => $('mb' + n + 'b').setAttribute('stdDeviation', `${Math.max(0, px).toFixed(2)} 0`);
function style(el, { op = 1, x = 0, y = 0, s = 1, sx = 1, sy = 1, blur = 0, mb = 0, extra = '' }) {
  el.style.opacity = clamp(op).toFixed(4);
  el.style.transform = `${extra} translate(${x.toFixed(2)}px,${y.toFixed(2)}px) scale(${(s * sx).toFixed(4)},${(s * sy).toFixed(4)})`;
  const f = []; if (blur > .05) f.push(`blur(${blur.toFixed(2)}px)`); if (mb) f.push(`url(#mb${mb})`);
  el.style.filter = f.length ? f.join(' ') : 'none';
}
const merge = (...a) => a.reduce((r, o) => ({ op: (r.op ?? 1) * (o.op ?? 1), x: (r.x ?? 0) + (o.x ?? 0), y: (r.y ?? 0) + (o.y ?? 0), s: (r.s ?? 1) * (o.s ?? 1), blur: (r.blur ?? 0) + (o.blur ?? 0), sx: (r.sx ?? 1) * (o.sx ?? 1), sy: (r.sy ?? 1) * (o.sy ?? 1) }), {});
function slam(t, t0, dur = .4, s0 = 1.7, b0 = 26) { const p = eOutExpo(prog(t, t0, t0 + dur)); return { p, op: clamp(p * 3), s: lerp(s0, 1, p), blur: (1 - p) * b0 }; }
function maskUp(t, t0, dur = .5) { const p = eOutExpo(prog(t, t0, t0 + dur)); return { op: clamp(p * 2), y: (1 - p) * 160, blur: (1 - p) * 12 }; }
function outBlur(t, t1, dur = .3) { const p = eInCubic(prog(t, t1, t1 + dur)); return { op: 1 - p, blur: p * 24, s: 1 + p * .12 }; }
function whip(t, t0, dur, dir, mode) {
  const u = prog(t, t0, t0 + dur); const p = mode === 'in' ? eOutExpo(u) : eInExpo(u); const k = mode === 'in' ? 1 - p : p;
  const v = mode === 'in' ? Math.pow(2, -10 * u) * (u > 0 ? 1 : 0) : (u > 0 && u < 1 ? u * u * u : 0);
  return { x: dir * 900 * k, mbpx: Math.min(90, 160 * v), op: mode === 'in' ? clamp(p * 3) : 1 - clamp((p - .6) / .4), sx: 1 + .35 * v };
}
const GL = {};
function makeGlitch(id, n = 7) { const el = $(id); GL[id] = Array.from({ length: n }, () => { const c = el.cloneNode(true); c.removeAttribute('id'); c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); content.appendChild(c); return c; }); }
function glitch(id, t, t0, dur) {
  const el = $(id), cl = GL[id]; const p = prog(t, t0, t0 + dur), k = eInCubic(p), fr = Math.floor(t * 30);
  show(el, false); let acc = 0; const cuts = cl.map((_, i) => .5 + hash(i * 7.3 + 1) * 1.2), tot = cuts.reduce((a, b) => a + b);
  cl.forEach((c, i) => { show(c, true); c.innerHTML = el.innerHTML; const a = acc / tot * 100, b = (acc + cuts[i]) / tot * 100; acc += cuts[i];
    c.style.clipPath = `inset(${a.toFixed(2)}% -20% ${(100 - b).toFixed(2)}% -20%)`;
    style(c, { x: (hash(i * 3.1 + fr * .37) - .5) * 2 * (420 + hash(i) * 380) * k, op: 1 - clamp((p - .55) / .45) }); });
}
const hideGlitch = id => (GL[id] || []).forEach(c => show(c, false));
function lineReveal(id, t, t0, lineDur, openDur, pad = 30) {
  const el = $(id), top = el.querySelector('.top'), bot = el.querySelector('.bot'), tx = el.querySelector('.rtxt');
  const h = el._h || (el._h = tx.offsetHeight);
  const pL = eOutExpo(prog(t, t0, t0 + lineDur)), open = eOutExpo(prog(t, t0 + lineDur, t0 + lineDur + openDur));
  const half = (h / 2 + pad) * open;
  top.style.top = (h / 2 - 2 - half).toFixed(2) + 'px'; bot.style.top = (h / 2 - 2 + half).toFixed(2) + 'px';
  top.style.transform = bot.style.transform = `scaleX(${pL.toFixed(4)})`; top.style.opacity = bot.style.opacity = (1 - .35 * open).toFixed(3);
  const ins = (50 - 50 * open).toFixed(2); tx.style.clipPath = `inset(${ins}% -10% ${ins}% -10%)`;
  tx.style.transform = `scale(${lerp(1.1, 1, open).toFixed(4)})`; tx.style.filter = open < .98 ? `blur(${((1 - open) * 8).toFixed(1)}px)` : 'none';
  return open;
}
function typeText(id, t, t0, text, cps = 22) {
  const el = $(id), n = clamp(Math.floor((t - t0) * cps), 0, text.length);
  el.querySelector('.ty').textContent = text.slice(0, n);
  el.querySelector('.caret').style.opacity = (t >= t0 && n < text.length) ? 1 : (Math.floor(t * 2.6) % 2 ? 0 : 1);
}
// sparks + grain
const fx = $('fx').getContext('2d');
const SPARKS = [[.6, 540, 900, .7], [4.9, 540, 1560, .8], [8.5, 540, 900, 1], [15.2, 540, 1520, .8], [18.5, 540, 470, 1.3]];
const grains = [0, 1, 2, 3].map(k => { const c = document.createElement('canvas'); c.width = 540; c.height = 960; const x = c.getContext('2d'); const d = x.createImageData(540, 960); for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * .013 + k * 91.7) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; });
function drawFX(t) {
  fx.clearRect(0, 0, W, H); fx.globalCompositeOperation = 'lighter';
  for (const [t0, cx, cy, s] of SPARKS) {
    const dt = t - t0; if (dt < 0 || dt > 1.5) continue;
    for (let i = 0; i < Math.round(130 * s); i++) {
      const a = hash(i * 1.7 + t0) * Math.PI * 2, sp = (300 + hash(i * 2.9 + t0) * 1000) * s, e = Math.exp(-dt * 3.2), k = (1 - e) / 3.2;
      const x = cx + Math.cos(a) * sp * k * 1.25, y = cy + Math.sin(a) * sp * k * .7 + 260 * dt * dt;
      const vx = Math.cos(a) * sp * e * 1.25, vy = Math.sin(a) * sp * e * .7 + 520 * dt, life = 1 - dt / (.6 + hash(i * 5.3)); if (life <= 0) continue;
      fx.strokeStyle = `rgba(255,${Math.round(140 + 90 * life)},${Math.round(60 * life)},${(life * .9).toFixed(3)})`; fx.lineWidth = 1.5 + hash(i) * 2;
      fx.beginPath(); fx.moveTo(x, y); fx.lineTo(x - vx * .022, y - vy * .022); fx.stroke();
    }
  }
  fx.globalCompositeOperation = 'overlay'; fx.globalAlpha = .07; fx.drawImage(grains[Math.floor(t * 30) % 4], 0, 0, W, H);
  fx.globalAlpha = 1; fx.globalCompositeOperation = 'source-over';
}

let TEX;
const bob = (t, i) => Math.sin(t * 1.3 + i * 2.1) * .02;
function cam(pos, target, roll = 0) { camera.position.set(...pos); camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(...target); camera.updateMatrixWorld(true); }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ================= TIMELINE =================
function setTime(t) {
  for (const el of content.children) show(el, false);
  P.forEach(p => p.visible = false);
  let spot = 1, spotPos = [.5, .55], orA = 0, fade = 1, envI = 1, envRot = .4 + t * .2, zoom = 0, focus = 5, aperture = .003, dustA = 1;
  let cp, ct, roll = 0;

  // ===== S1 0–3 : old phone in the dark =====
  if (t < 3.0) {
    const out = eInExpo(prog(t, 2.55, 3.0));
    setP(0, [0, bob(t, 0) - out * .3, -out * 6], [lerp(.12, .05, t / 3) + out * .8, lerp(.75, .25, eInOutSine(prog(t, 0, 2.6))) + out * 3, -.05], { tex: TEX.old, scr: clamp(prog(t, .45, .75)) * .7 });
    ct = [0, 0, 0]; const dz = lerp(7.8, 4.6, eInOutSine(prog(t, 0, 2.8)));
    cp = [Math.sin(t * .25) * .25, .15, dz]; roll = .02 * Math.sin(t * .8);
    envI = clamp(prog(t, .05, .9)) * .9; spot = clamp(prog(t, .1, 1.0)) * .8; envRot = 2.2 + t * .5;
    focus = dist(cp, ct); aperture = .004; fade = t < .06 ? 0 : 1;
    const b = $('s1'); show(b);
    if (t < 2.55) {
      hideGlitch('s1');
      const a1 = slam(t, .6, .45, 1.8, 30), a2 = slam(t, 1.1, .45, 1.6, 30);
      style($('s1a'), a1); style($('s1b'), a2); style(b, { s: 1 + .02 * prog(t, .6, 2.5) });
    } else glitch('s1', t, 2.55, .4);
    zoom = .9 * bell(t, 2.95, .1);
  }
  // ===== S2 3–7 : premium orbit + macro =====
  else if (t < 7.0) {
    setP(1, [0, 0, 0], [.04, .25 * Math.sin((t - 3) * .4), 0], { tex: TEX.w0, scr: 1 });
    const K = [[3.0, [3.6, 1.3, 2.6]], [3.5, [-1.4, .9, -2.4]], [4.2, [.42, .66, -.66]], [4.9, [-.08, .44, -.56]], [5.45, [.95, -.25, -.22]], [6.0, [1.05, .3, .95]], [6.6, [.25, .1, 3.4]], [7.0, [0, .05, 3.1]]];
    const T = [[3.0, [0, 0, 0]], [3.5, [.1, .3, -.05]], [4.2, [.13, .51, -.05]], [4.9, [.13, .48, -.05]], [5.45, [.37, .1, 0]], [6.0, [.3, .05, 0]], [6.6, [0, 0, 0]], [7.0, [0, 0, 0]]];
    cp = local(1, catmull(K, t)); ct = local(1, catmull(T, t)); roll = .06 * Math.sin((t - 3) * 1.3);
    focus = dist(cp, ct); aperture = t > 4 && t < 5.6 ? .012 : .004;
    envRot = 1 + t * .9; spot = 1;
    const tb = $('s2'); show(tb);
    style($('s2a'), maskUp(t, 4.4, .5));
    const s2 = slam(t, 4.9, .4, 1.9, 30); style($('s2b'), s2);
    const w = whip(t, 6.55, .42, -1, 'out'); setMB(1, w.mbpx); style(tb, { x: w.x, op: w.op, sx: w.sx, mb: 1 });
    zoom = .8 * bell(t, 3.05, .12) + .7 * bell(t, 6.98, .1);
  }
  // ===== S3 7–13 : dolly through a gallery of phones =====
  else if (t < 13.0) {
    const L = [[1, [-.85, .25, -1.0], .5], [2, [.9, -.2, -3.3], -.5], [3, [-.82, -.28, -5.7], .45], [4, [.86, .3, -8.1], -.45], [5, [-.72, .1, -10.5], .4], [6, [0, -.02, -13.6], 0]];
    L.forEach(([i, p, ry], k) => setP(i, [p[0], p[1] + bob(t, k), p[2]], [.06, ry + .25 * Math.sin(t * .5 + k) + (t - 7) * .12 * (k % 2 ? -1 : 1), .03 * Math.sin(t + k)], { tex: i === 2 ? TEX.w1 : TEX.w0, scr: 1 }));
    const u = eInOutSine(prog(t, 7.0, 12.9));
    const cz = lerp(4.6, -9.6, u);
    cp = [.35 * Math.sin(t * .9), .12 + .1 * Math.sin(t * .6), cz]; ct = [.1 * Math.sin(t * .9 + 1), 0, cz - 5];
    roll = .05 * Math.sin(t * .7);
    focus = 3.2; aperture = .006; envRot = t * .5;
    const a = $('s3a'), b = $('s3b'), c = $('s3c');
    const wo = whip(t, 12.5, .45, 1, 'out'); setMB(2, wo.mbpx);
    const W2 = { x: wo.x, op: wo.op, sx: wo.sx };
    if (t > 7.95) { show(a); style(a, { ...merge(maskUp(t, 8.0, .5), W2), mb: 2 }); }
    if (t > 8.45) { show(b); const s = slam(t, 8.5, .45, 2.0, 34); style(b, { ...merge(s, { s: 1 + .03 * prog(t, 8.9, 12.5) }, W2), mb: 2 }); }
    if (t > 8.95) { show(c); style(c, { ...merge(maskUp(t, 9.0, .5), W2), mb: 2 }); }
    zoom = .5 * bell(t, 7.05, .12) + .8 * bell(t, 12.97, .1);
  }
  // ===== S4 13–18 : 1 or 2 =====
  else if (t < 18.0) {
    const e = eOutExpo(prog(t, 13.0, 13.9));
    const h1 = pulse(t, 16.5, .05, .5), h2 = pulse(t, 17.0, .05, .5);
    setP(2, [lerp(-2.2, -.53, e), bob(t, 0) + .02, 0], [.05, lerp(2.5, .22, e) + .1 * Math.sin(t * .7), 0], { tex: TEX.w1, scr: 1 + h1 * .6 });
    setP(3, [lerp(2.2, .55, e), bob(t, 1) - .02, 0], [.05, lerp(-2.5, -.22, e) - .1 * Math.sin(t * .7 + 1), 0], { tex: TEX.w0, scr: 1 + h2 * .6 });
    ct = [0, -.05, 0]; const dz = lerp(7.8, 6.6, eOutCubic(prog(t, 13, 18)));
    cp = [.25 * Math.sin((t - 13) * .5), .3, dz]; focus = dist(cp, ct); aperture = .003;
    envRot = 1.2 + (t - 13) * .45; orA = .4 * (h1 + h2);
    const ta = $('s4a'); show(ta); style(ta, merge(slam(t, 13.3, .45, 1.5, 24), outBlur(t, 17.6, .35)));
    const proj = (i, y) => { const v = new THREE.Vector3(P[i].position.x, y, 0).project(camera); return [(v.x * .5 + .5) * W, (-v.y * .5 + .5) * H]; };
    cam(cp, ct);   // for projection
    [['bd1', 2, 14.3, h1], ['bd2', 3, 14.6, h2]].forEach(([id, i, t0, hl]) => {
      if (t < t0) return; const el = $(id); show(el); const [x, y] = proj(i, -.9);
      el.style.left = x.toFixed(1) + 'px'; el.style.top = y.toFixed(1) + 'px';
      const b = eOutBack(prog(t, t0, t0 + .45)); style(el, merge({ op: clamp(prog(t, t0, t0 + .12)), s: lerp(.2, 1, b) * (1 + .18 * hl) }, outBlur(t, 17.6, .35)));
    });
    const tb = $('s4b'); if (t > 15.15) { show(tb); style(tb, merge(slam(t, 15.2, .45, 2.0, 30), outBlur(t, 17.6, .35))); }
    const pr = $('s4p'); if (t > 15.85) { show(pr); typeText('s4p', t, 16.0, 'napiši u komentaru', 22); const p = eOutExpo(prog(t, 15.85, 16.25)); style(pr, merge({ op: clamp(p * 2), sx: lerp(.05, 1, p) }, outBlur(t, 17.6, .35))); }
    zoom = .5 * bell(t, 13.05, .12) + .5 * bell(t, 17.95, .12);
  }
  // ===== S5 18–25 : pull back, logo, CTA =====
  else {
    const e = eOutCubic(prog(t, 18.0, 25.0));
    setP(2, [-.53, bob(t, 0), 0], [.05, .22 + .15 * Math.sin(t * .4), 0], { tex: TEX.logo, scr: 1 });
    setP(3, [.55, bob(t, 1), 0], [.05, -.22 - .15 * Math.sin(t * .4 + 1), 0], { tex: TEX.w0, scr: 1 });
    setP(1, [-1.6, .3, -2.5], [.05, .7, 0], { tex: TEX.w0, scr: .5 }); setP(6, [1.6, .3, -2.5], [.05, -.7, 0], { tex: TEX.w0, scr: .5 });
    ct = [0, lerp(-.05, 1.7, e), 0]; cp = [lerp(.2, 0, e), lerp(.3, 1.1, e), lerp(6.6, 10.5, e)];
    focus = 3.0; aperture = .006 * e + .002; envRot = 1.5 + (t - 18) * .4; orA = .5 + .5 * pulse(t, 18.5, .02, .8); spotPos = [.5, .45];
    const s5 = $('s5'); if (t > 17.95) { show(s5); lineReveal('s5', t, 18.0, .45, .45, 34); style(s5, { s: 1 + .02 * prog(t, 19, 25) }); }
    const a = $('s5a'); if (t > 19.55) { show(a); style(a, slam(t, 19.6, .45, 1.6, 24)); }
    const b = $('s5b'); if (t > 20.95) { show(b); style(b, slam(t, 21.0, .45, 1.5, 22)); }
    const pl = $('pill'); if (t > 21.95) { show(pl); const p = eOutBack(prog(t, 22.0, 22.5)); style(pl, { op: clamp(prog(t, 22, 22.15)), s: lerp(.4, 1, p), extra: 'translateX(-50%)' }); pl.style.setProperty('--sx', lerp(-220, pl.offsetWidth + 80, eInOutSine(prog(t, 22.6, 23.5))).toFixed(1) + 'px'); }
    const r = $('ruma'); if (t > 22.45) { show(r); style(r, { op: clamp(prog(t, 22.5, 22.8)), y: (1 - eOutExpo(prog(t, 22.5, 23))) * 30 }); r.firstElementChild.style.letterSpacing = lerp(1.2, .6, eOutExpo(prog(t, 22.5, 23.1))).toFixed(3) + 'em'; }
    fade = 1 - eInCubic(prog(t, 24.55, 25.0));
    zoom = .7 * bell(t, 18.5, .08);
  }

  // impacts
  let flash = 0, shake = 0;
  for (const [ti, s] of HITS) { flash += s * .13 * pulse(t, ti, .012, .1); shake += s * pulse(t, ti, .01, .16); zoom += s * .25 * bell(t, ti + .04, .06); }
  $('flash').style.opacity = Math.min(.7, flash).toFixed(3);
  const sh = shake * 7; content.style.transform = `translate(${(Math.sin(t * 97) * sh).toFixed(2)}px,${(Math.cos(t * 83) * sh).toFixed(2)}px)`;
  content.style.opacity = fade.toFixed(3);
  cam(cp, ct, roll);
  if (shake > .002) { camera.position.x += Math.sin(t * 91) * shake * .02; camera.position.y += Math.cos(t * 73) * shake * .02; }
  bokeh.uniforms.focus.value = focus; bokeh.uniforms.aperture.value = aperture; bokeh.uniforms.maxblur.value = .014;
  scene.environmentIntensity = envI; scene.environmentRotation.set(0, envRot, 0);
  rimW.intensity = 1.2 * envI; rimO.intensity = 2 * envI; key.intensity = .6 * envI;
  bgMat.uniforms.uTime.value = t; bgMat.uniforms.uSpot.value = spot; bgMat.uniforms.uSpotPos.value.set(...spotPos); bgMat.uniforms.uOr.value = orA;
  dMat.uniforms.uTime.value = t; dMat.uniforms.uA.value = dustA * envI;
  grade.uniforms.uZoom.value = Math.min(1.3, zoom); grade.uniforms.uFade.value = fade; grade.uniforms.uTime.value = t; grade.uniforms.uCA.value = .0015 + .004 * Math.min(1, flash);
  composer.render();
  drawFX(t);
}

async function boot() {
  for (const f of ['900 100px Montserrat', '800 100px Montserrat', '700 40px Montserrat', '300 100px Montserrat', '400 40px "JetBrains Mono"', '700 40px "JetBrains Mono"']) await document.fonts.load(f, 'AŠĆČšćčđž›');
  await document.fonts.ready;
  TEX = { w0: wallTex(0), w1: wallTex(1), old: oldTex(), logo: logoTex() };
  P.forEach(p => { p.userData.screen.emissiveMap = TEX.w0; p.userData.screen.needsUpdate = true; });
  makeGlitch('s1');
  for (const tw of [1.5, 4.5, 9, 15, 20, 23]) setTime(tw);
  window.setTime = setTime; window.READY = true;
}
boot();
