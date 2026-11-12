import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 1080, H = 1920, FOV = 32;
// ---------------- math ----------------
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
const eOutBack = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const pulse = (t, t0, att, dec) => t < t0 - att ? 0 : t < t0 ? Math.pow((t - (t0 - att)) / att, 2) : Math.exp(-(t - t0) / dec);
const bell = (t, t0, w) => Math.exp(-Math.pow((t - t0) / w, 2));

// impacts: [time, strength]  (same timestamps in audio.py)
const IMP = [[0.5, 1.2], [1.0, 0.9], [3.5, 0.8], [4.0, 1.1], [7.5, 0.8], [8.5, 0.8], [9.5, 1.0], [11.5, 0.9], [11.75, 0.5],
  [13.5, 0.9], [13.75, 0.5], [17.5, 0.6], [18.0, 1.0], [18.5, 0.5], [21.0, 1.5], [21.35, 0.9]];

// ---------------- renderer ----------------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.03, 200);
scene.add(camera);
const SH = d => 2 * d * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const SW = d => SH(d) * W / H;

// ---------------- environment: orange + white strips ----------------
{
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.008, 0.008, 0.009), side: THREE.BackSide })));
  const panel = (w, h, col, pos, rot) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(...pos); m.rotation.set(...rot); env.add(m); };
  panel(8, 5, new THREE.Color(2.2, 2.1, 2.0), [0, 9.8, 0], [Math.PI / 2, 0, 0]);
  panel(1.0, 16, new THREE.Color(9, 2.6, 0.45), [-9.8, 0, -1], [0, Math.PI / 2, 0]);
  panel(1.2, 16, new THREE.Color(9, 2.9, 0.5), [9.8, 0, -2], [0, -Math.PI / 2, 0]);
  panel(0.5, 16, new THREE.Color(6, 6, 6), [9.8, 0, 3], [0, -Math.PI / 2, 0]);
  panel(14, 0.6, new THREE.Color(4, 3.8, 3.6), [0, 2.5, 9.8], [0, Math.PI, 0]);
  panel(16, 10, new THREE.Color(0.5, 0.13, 0.02), [0, -2, -9.8], [0, 0, 0]);
  panel(16, 16, new THREE.Color(0.05, 0.03, 0.02), [0, -9.8, 0], [-Math.PI / 2, 0, 0]);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.03).texture; pm.dispose();
}
const rimL = new THREE.DirectionalLight(0xff6a13, 5); rimL.position.set(-4, 1.5, -3); scene.add(rimL);
const rimR = new THREE.DirectionalLight(0xff7a20, 4); rimR.position.set(4, 0.5, -3); scene.add(rimR);
const keyL = new THREE.DirectionalLight(0xffffff, 0.5); keyL.position.set(-2, 3, 5); scene.add(keyL);

// ---------------- background (camera attached) ----------------
const bgMat = new THREE.ShaderMaterial({
  depthWrite: false, depthTest: false,
  uniforms: { uTime: { value: 0 }, uGlow: { value: 1 }, uGlowPos: { value: new THREE.Vector2(.5, .5) }, uGrid: { value: 0.6 }, uWarp: { value: 0 }, uAspect: { value: W / H } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `
    varying vec2 vUv; uniform float uTime,uGlow,uGrid,uWarp,uAspect; uniform vec2 uGlowPos;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.02;a*=.5;}return v;}
    void main(){
      vec2 p=vUv; vec3 orange=vec3(1.,.16,.012); vec3 grey=vec3(.012,.012,.014);
      vec2 q=(p-uGlowPos)*vec2(uAspect*1.1,1.);
      float g=exp(-dot(q,q)*6.), g2=exp(-dot(q,q)*1.4);
      float sm=fbm(p*vec2(3.,5.)+vec2(uTime*.04,-uTime*.06));
      vec3 col=grey*(1.-p.y*.5);
      col+=orange*g2*.022*uGlow*(.5+sm);
      col+=orange*g*.065*uGlow*(.6+.6*sm);
      // perspective grid floor
      float hz=.36;
      if(p.y<hz){
        float z=.06/(hz-p.y+.001); float x=(p.x-.5)*z*3.;
        vec2 gp=vec2(x, z*2.+uTime*1.2);
        vec2 gl=abs(fract(gp)-.5)/fwidth(gp);
        float line=1.-min(min(gl.x,gl.y),1.);
        float fade=smoothstep(0.,.25,hz-p.y)*smoothstep(2.6,.2,z)*smoothstep(1.4,.2,abs(x)*.25);
        col+=orange*line*fade*.12*uGrid;
        col+=orange*.04*uGrid*smoothstep(.05,0.,abs(p.y-hz+.005));
      }
      // warp streaks
      vec2 c=p-.5; c.x*=uAspect; float a=atan(c.y,c.x); float r=length(c);
      float st=pow(n(vec2(a*40.,0.)),8.)*smoothstep(.05,.6,r);
      col+=mix(orange,vec3(1.,.7,.5),.4)*st*uWarp*.8*fract(r*2.-uTime*4.+n(vec2(a*40.,1.)));
      gl_FragColor=vec4(col,1.);
    }`
});
const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
bg.position.z = -60; bg.scale.set(SW(60) * 1.02, SH(60) * 1.02, 1); bg.renderOrder = -10; bg.frustumCulled = false; camera.add(bg);

// ---------------- embers ----------------
const PN = 1000; const pGeo = new THREE.BufferGeometry();
{
  const pos = new Float32Array(PN * 3), seed = new Float32Array(PN * 4); let s = 98765;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < PN; i++) { pos.set([(rnd() - .5) * 10, (rnd() - .5) * 12, -9 + rnd() * 12], i * 3); seed.set([rnd(), rnd(), rnd(), rnd()], i * 4); }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
}
const pMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 }, uSpeed: { value: 0 }, uAmt: { value: 1 } },
  vertexShader: `attribute vec4 aSeed; uniform float uTime,uSpeed; varying float vA; varying vec3 vC;
    void main(){ vec3 p=position; p.y=mod(p.y+uTime*(.1+aSeed.x*.25)+6.,12.)-6.; p.x+=sin(uTime*(.3+aSeed.y*.4)+aSeed.z*6.28)*.3;
      p.z=mod(p.z+uSpeed+9.,12.)-9.; vec4 mv=modelViewMatrix*vec4(p,1.); float big=step(.94,aSeed.w);
      gl_PointSize=clamp(mix(2.5+aSeed.z*4.,30.+aSeed.x*40.,big)*(4.5/max(.2,-mv.z)),1.,160.);
      vA=mix(.9,.08,big)*(.5+.5*sin(uTime*(2.+aSeed.y*3.)+aSeed.x*30.))*smoothstep(.15,1.2,-mv.z);
      vC=mix(vec3(1.,.35,.05),vec3(1.,.75,.45),step(.7,aSeed.y)); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vA; varying vec3 vC; uniform float uAmt; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(vC*a*a*vA*uAmt*1.6,1.); }`
});
const embers = new THREE.Points(pGeo, pMat); embers.frustumCulled = false; scene.add(embers);

// ---------------- FX layers (camera attached) ----------------
const FXD = 7;
function fxPlane(frag, uniforms, size = [SW(FXD) * 1.6, SW(FXD) * 1.6]) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`, fragmentShader: frag
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), m); mesh.position.z = -FXD; mesh.renderOrder = 50; mesh.frustumCulled = false; camera.add(mesh); return mesh;
}
const rings = [0, 1, 2].map(() => fxPlane(`varying vec2 vUv; uniform float uR,uW,uA;
  void main(){ vec2 c=(vUv-.5)*2.; float d=length(c); float r=exp(-pow((d-uR)/uW,2.)); float inner=exp(-pow((d-uR*.82)/(uW*2.5),2.))*.25;
  vec3 col=vec3(1.,.35,.05)*(r*2.4+inner)+vec3(1.,.85,.7)*r*.8; gl_FragColor=vec4(col*uA,1.);}`, { uR: { value: 0 }, uW: { value: .02 }, uA: { value: 0 } }));
const burst = fxPlane(`varying vec2 vUv; uniform float uA,uRot;
  void main(){ vec2 c=(vUv-.5)*2.; float d=length(c); float a=atan(c.y,c.x)+uRot;
  float core=exp(-d*d*14.); float halo=exp(-d*3.2)*.5;
  float rays=pow(abs(cos(a*6.)),40.)*exp(-d*2.2)*.9+pow(abs(cos(a*11.+1.)),60.)*exp(-d*3.)*.5;
  float streak=exp(-abs(c.y)*90.)*exp(-abs(c.x)*1.1)*1.4;
  vec3 col=vec3(1.,.4,.08)*(halo+rays+streak)+vec3(1.,.9,.8)*core*1.5; gl_FragColor=vec4(col*uA,1.);}`, { uA: { value: 0 }, uRot: { value: 0 } });
const eline = fxPlane(`varying vec2 vUv; uniform float uA,uLen;
  void main(){ vec2 c=(vUv-.5)*2.; float l=exp(-abs(c.y)*260.)*smoothstep(uLen,uLen*.4,abs(c.x));
  float g=exp(-abs(c.y)*35.)*smoothstep(uLen,0.,abs(c.x))*.35; gl_FragColor=vec4((vec3(1.,.85,.7)*l*3.+vec3(1.,.35,.05)*g)*uA,1.);}`,
  { uA: { value: 0 }, uLen: { value: 0 } });
// burst sparks
const SN = 420; const sGeo = new THREE.BufferGeometry();
{
  const dir = new Float32Array(SN * 3), sd = new Float32Array(SN); let s = 4242; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < SN; i++) { const a = rnd() * Math.PI * 2, z = rnd() * 2 - 1, r = Math.sqrt(1 - z * z); dir.set([Math.cos(a) * r, Math.sin(a) * r, z * .4], i * 3); sd[i] = rnd(); }
  sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SN * 3), 3)); sGeo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3)); sGeo.setAttribute('aS', new THREE.BufferAttribute(sd, 1));
}
const sMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uDt: { value: 10 }, uA: { value: 0 } },
  vertexShader: `attribute vec3 aDir; attribute float aS; uniform float uDt; varying float vA;
    void main(){ float sp=1.2+aS*3.2; float k=(1.-exp(-uDt*3.))*sp; vec3 p=aDir*k; p.y-=uDt*uDt*.25;
      vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=(3.+aS*7.)*(1.-smoothstep(.2,1.2,uDt)); vA=exp(-uDt*(1.5+aS*2.)); gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vA; uniform float uA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(vec3(1.,.55,.18)*a*vA*uA*2.,1.); }`
});
const sparks = new THREE.Points(sGeo, sMat); sparks.position.z = -FXD; sparks.renderOrder = 51; sparks.frustumCulled = false; camera.add(sparks);

// ---------------- phones ----------------
const PW = 0.715, PH = 1.47, BS = 0.018, DEP = 0.046, BT = 0.018, FRONT = DEP / 2 + BT;
function rrShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, 1.5 * Math.PI, false); return s;
}
function rrPlane(w, h, r) { const g = new THREE.ShapeGeometry(rrShape(w, h, r), 24); const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h); return g; }
const bodyGeo = (() => { const g = new THREE.ExtrudeGeometry(rrShape(PW - 2 * BS, PH - 2 * BS, 0.105 - BS), { depth: DEP, bevelEnabled: true, bevelThickness: BT, bevelSize: BS, bevelSegments: 8, curveSegments: 28 }); g.translate(0, 0, -DEP / 2); g.computeVertexNormals(); return g; })();
const frontGlassGeo = rrPlane(PW - 0.026, PH - 0.026, 0.094), screenGeo = rrPlane(PW - 0.05, PH - 0.05, 0.082), islandGeo = rrPlane(0.19, 0.054, 0.027);
const modGeo = (() => { const g = new THREE.ExtrudeGeometry(rrShape(0.33, 0.33, 0.08), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 5, curveSegments: 20 }); g.translate(0, 0, -0.009); return g; })();
const ringGeo = new THREE.CylinderGeometry(0.066, 0.068, 0.028, 72, 1).rotateX(Math.PI / 2);
const lensGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 72, 1).rotateX(Math.PI / 2);
const lensInGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.031, 48, 1).rotateX(Math.PI / 2);
const smallGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.012, 32, 1).rotateX(Math.PI / 2);
const btnGeo = h => new RoundedBoxGeometry(0.012, h, 0.02, 3, 0.005);
const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x020306, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 520] });
const lensInMat = new THREE.MeshPhysicalMaterial({ color: 0x0b1020, roughness: 0.0, metalness: 0.6, clearcoat: 1 });
const flashMat = new THREE.MeshPhysicalMaterial({ color: 0xdcd3bf, roughness: 0.35, clearcoat: 1 });
const frontMat = new THREE.MeshPhysicalMaterial({ color: 0x010101, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 });
const islandMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const VARIANTS = [
  { frame: 0x34343a, frameR: 0.24, back: 0x111113, backR: 0.42, layout: 'A' },  // P0 iPhone-style black titanium
  { frame: 0x26282c, frameR: 0.2, back: 0x18191c, backR: 0.3, layout: 'B' },    // P1 Samsung-style graphite
  { frame: 0xd8601c, frameR: 0.22, back: 0xe56a24, backR: 0.42, layout: 'A' },  // P2 iPhone-style orange
];
function makePhone(v) {
  const g = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: v.frame, metalness: 1, roughness: v.frameR, clearcoat: 0.3, clearcoatRoughness: 0.2 });
  const back = new THREE.MeshPhysicalMaterial({ color: v.back, metalness: 0.1, roughness: v.backR, clearcoat: 1, clearcoatRoughness: 0.3 });
  g.add(new THREE.Mesh(bodyGeo, [back, metal]));
  const fg = new THREE.Mesh(frontGlassGeo, frontMat); fg.position.z = FRONT + 0.0004; g.add(fg);
  const scrMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
  const scr = new THREE.Mesh(screenGeo, scrMat); scr.position.z = FRONT + 0.0008; g.add(scr);
  const isl = new THREE.Mesh(islandGeo, islandMat); isl.position.set(0, PH / 2 - 0.07, FRONT + 0.0012); g.add(isl);
  [[PW / 2 + 0.003, 0.22, .17], [-PW / 2 - 0.003, 0.34, .1], [-PW / 2 - 0.003, 0.2, .1], [-PW / 2 - 0.003, 0.48, .05]].forEach(([x, y, h]) => { const b = new THREE.Mesh(btnGeo(h), metal); b.position.set(x, y, 0); g.add(b); });
  const lens = (x, y, z) => { const r = new THREE.Mesh(ringGeo, metal); r.position.set(x, y, z); g.add(r); const l = new THREE.Mesh(lensGeo, lensMat); l.position.set(x, y, z - .002); g.add(l); const li = new THREE.Mesh(lensInGeo, lensInMat); li.position.set(x, y, z - .003); g.add(li); };
  if (v.layout === 'A') {
    const cx = PW / 2 - 0.21, cy = PH / 2 - 0.21;
    const m = new THREE.Mesh(modGeo, new THREE.MeshPhysicalMaterial({ color: v.back, metalness: 0.15, roughness: 0.08, clearcoat: 1 })); m.position.set(cx, cy, -FRONT - 0.009); g.add(m);
    const z = -FRONT - 0.03; lens(cx + .075, cy + .08, z); lens(cx + .075, cy - .08, z); lens(cx - .08, cy, z);
    const f = new THREE.Mesh(smallGeo, flashMat); f.position.set(cx - .085, cy + .11, -FRONT - .021); g.add(f);
  } else {
    const x = PW / 2 - 0.15, z = -FRONT - 0.012; [0.52, 0.335, 0.15].forEach(y => lens(x, y, z));
    const f = new THREE.Mesh(smallGeo, flashMat); f.position.set(x - .13, .52, -FRONT - .004); g.add(f);
  }
  g.userData.screen = scrMat; return g;
}
const phones = VARIANTS.map(v => { const p = makePhone(v); scene.add(p); return p; });

function wallTex(k) {
  const c = document.createElement('canvas'); c.width = 900; c.height = 1922; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, '#050505'); gr.addColorStop(.6, '#140803'); gr.addColorStop(1, '#030303');
  x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
  x.filter = 'blur(40px)';
  const silk = (y0, y1, col, w) => { x.beginPath(); x.moveTo(-100, y0); x.bezierCurveTo(300, y0 - 520 + k * 60, 600, y1 + 420, 1000, y1); x.strokeStyle = col; x.lineWidth = w; x.stroke(); };
  silk(1500, 900, 'rgba(255,90,10,.75)', 240); silk(1760, 1150, 'rgba(200,50,0,.7)', 300); silk(1620, 1000, 'rgba(255,190,120,.45)', 40);
  x.filter = 'blur(5px)'; silk(1580, 980, 'rgba(255,220,180,.6)', 5); x.filter = 'none';
  x.fillStyle = '#ffffff'; x.textAlign = 'center';
  x.font = '700 40px Montserrat'; x.fillText('Četvrtak, 12. novembar', 450, 330);
  x.font = '800 240px Montserrat'; x.fillText('10:24', 450, 560);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function logoTex() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 1922; const x = c.getContext('2d');
  const gr = x.createRadialGradient(450, 880, 20, 450, 880, 1100); gr.addColorStop(0, '#4a1a04'); gr.addColorStop(.4, '#140602'); gr.addColorStop(1, '#020202');
  x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
  x.shadowColor = '#ff6a13'; x.shadowBlur = 50; x.strokeStyle = '#ff7a24'; x.lineWidth = 10; x.beginPath(); x.arc(450, 860, 240, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowBlur = 40;
  x.font = '900 230px Montserrat'; x.fillText('ZT', 450, 872);
  x.shadowBlur = 20; x.fillStyle = '#ff7a24'; x.font = '900 62px Montserrat'; x.fillText('ZONA TELEFONA', 450, 1250);
  x.fillStyle = '#ffffff'; x.font = '700 38px Montserrat'; x.fillText('@zona.telefona', 450, 1330);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// scan beam (child of P0)
const scanMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uA: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec2 vUv; uniform float uA; void main(){ float l=exp(-pow((vUv.y-.5)*80.,2.)); float g=exp(-abs(vUv.y-.5)*9.)*.4;
    float ex=smoothstep(0.,.1,vUv.x)*smoothstep(1.,.9,vUv.x); gl_FragColor=vec4((vec3(1.,.8,.6)*l*4.+vec3(1.,.3,.03)*g)*ex*uA,1.);}`
});
const scan = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.5), scanMat); scan.position.z = FRONT + 0.04; phones[0].add(scan);

// ---------------- KINETIC WORDS (3D text planes, camera attached) ----------------
const wordMat = (map, glow) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: true, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
  uniforms: { map: { value: map }, uOp: { value: 1 }, uShine: { value: -1 }, uBoost: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D map; uniform float uOp,uShine,uBoost; varying vec2 vUv;
    void main(){ vec4 c=texture2D(map,vUv); vec3 col=c.rgb*uBoost;
      float s=exp(-pow((vUv.x-uShine+(vUv.y-.5)*.35)*7.,2.)); col+=vec3(1.,.92,.85)*s*1.6*c.a;
      gl_FragColor=vec4(col,c.a*uOp); }`
});
const WORDS = {};
function makeWord(id, text, { orange = false, size = 300, spacing = -4, italic = false } = {}) {
  const font = `${italic ? 'italic ' : ''}900 ${size}px Montserrat`;
  const m = document.createElement('canvas').getContext('2d'); m.font = font; m.letterSpacing = spacing + 'px';
  const met = m.measureText(text);
  const tw = met.width, asc = Math.max(met.actualBoundingBoxAscent, size * .74), desc = Math.max(met.actualBoundingBoxDescent, size * .04);
  const pad = Math.round(size * .42);
  const cw = Math.ceil(tw + pad * 2), ch = Math.ceil(asc + desc + pad * 2);
  const draw = (glow) => {
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d');
    x.font = font; x.letterSpacing = spacing + 'px'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    const bx = pad, by = pad + asc;
    if (glow) {
      x.fillStyle = orange ? '#ff5a00' : '#ff6a13';
      x.filter = `blur(${size * .16}px)`; x.fillText(text, bx, by);
      x.filter = `blur(${size * .05}px)`; x.globalAlpha = orange ? .9 : .5; x.fillText(text, bx, by);
    } else {
      const gr = x.createLinearGradient(0, by - asc, 0, by + desc);
      if (orange) { gr.addColorStop(0, '#FFD2A0'); gr.addColorStop(.35, '#FF8C2E'); gr.addColorStop(.75, '#FF6410'); gr.addColorStop(1, '#E24800'); }
      else { gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(.6, '#F2F2F2'); gr.addColorStop(1, '#C9C9CC'); }
      x.lineJoin = 'round'; x.strokeStyle = orange ? '#2a0c00' : '#141414'; x.lineWidth = size * .05; x.strokeText(text, bx, by);
      x.fillStyle = gr; x.fillText(text, bx, by);
      // top bevel highlight
      x.globalCompositeOperation = 'source-atop';
      const hl = x.createLinearGradient(0, by - asc, 0, by - asc + size * .18); hl.addColorStop(0, 'rgba(255,255,255,.55)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = hl; x.fillRect(0, 0, cw, ch);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
  };
  const grp = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1, 1);
  const gm = wordMat(draw(true), true), mm = wordMat(draw(false), false);
  const glowMesh = new THREE.Mesh(geo, gm), main = new THREE.Mesh(geo, mm);
  glowMesh.renderOrder = 60; main.renderOrder = 61; glowMesh.scale.setScalar(1); grp.add(glowMesh, main);
  grp.visible = false; camera.add(grp);
  WORDS[id] = { grp, gm, mm, cw, ch, tw, orange };
}
function word(id, o) {
  const w = WORDS[id]; const op = o.op ?? 1; if (op <= 0.002) { w.grp.visible = false; return; }
  const d = o.d ?? 5, sw = SW(d), sh = SH(d);
  w.grp.visible = true;
  w.grp.position.set((o.x ?? 0) * sw, (o.y ?? 0) * sh, -d);
  w.grp.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  const base = (o.w ?? .9) * sw * (w.cw / w.tw) * (o.s ?? 1);
  w.grp.scale.set(base, base * w.ch / w.cw, 1);
  w.mm.uniforms.uOp.value = op; w.gm.uniforms.uOp.value = op * (o.glow ?? 1) * (w.orange ? 0.42 : 0.38);
  w.mm.uniforms.uBoost.value = o.boost ?? (w.orange ? 1.0 : 0.94);
  w.gm.uniforms.uBoost.value = 1.0;
  w.mm.uniforms.uShine.value = o.shine ?? -1;
}
function kin(t, t0, style, dur = .36) {
  const p = prog(t, t0, t0 + dur), e = eOutExpo(p), b = eOutBack(prog(t, t0, t0 + dur * 1.25)), op = clamp(p * 3.5);
  const drift = 1 + 0.014 * Math.max(0, t - t0 - dur);
  switch (style) {
    case 'zoom': return { s: lerp(3.6, 1, e) * drift, op, rz: lerp(-0.14, 0, e) };
    case 'slamrot': return { s: lerp(2.6, 1, e) * drift, op, rz: lerp(0.28, 0, e), rx: lerp(0.6, 0, e) };
    case 'left': return { x: lerp(-1.4, 0, e), ry: lerp(-1.2, 0, e), op, s: lerp(1.2, 1, e) * drift };
    case 'right': return { x: lerp(1.4, 0, e), ry: lerp(1.2, 0, e), op, s: lerp(1.2, 1, e) * drift };
    case 'flip': return { rx: lerp(-1.57, 0, b), op, s: lerp(.85, 1, e) * drift };
    case 'drop': return { dy: lerp(.3, 0, b), op, s: lerp(1.35, 1, e) * drift };
    case 'rise': return { dy: lerp(-.3, 0, b), op, s: lerp(1.35, 1, e) * drift };
    case 'back': return { s: lerp(.12, 1, b) * drift, op };
  }
}
function outk(t, t1, style = 'fly', dur = .28) {
  const p = eInCubic(prog(t, t1, t1 + dur));
  switch (style) {
    case 'fly': return { s: 1 + p * 2.2, op: 1 - p };
    case 'up': return { dy: p * .25, op: 1 - p, s: 1 + p * .2 };
    case 'down': return { dy: -p * .25, op: 1 - p, s: 1 + p * .2 };
    case 'flip': return { rx: p * 1.57, op: 1 - p };
    case 'left': return { x: -p * 1.4, ry: p * -1.0, op: 1 - p };
  }
}
function W2(id, t, t0, style, t1, ostyle, base) {
  if (t < t0 - .01 || t > t1 + .4) { WORDS[id].grp.visible = false; return; }
  const a = kin(t, t0, style), b = outk(t, t1, ostyle);
  word(id, {
    ...base,
    x: (base.x ?? 0) + (a.x ?? 0) + (b.x ?? 0), y: (base.y ?? 0) + (a.dy ?? 0) + (b.dy ?? 0),
    s: (a.s ?? 1) * (b.s ?? 1), rx: (a.rx ?? 0) + (b.rx ?? 0), ry: (a.ry ?? 0) + (b.ry ?? 0), rz: (a.rz ?? 0),
    op: a.op * b.op
  });
}

// ---------------- post ----------------
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.5, 0.55, 0.88); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uZoom: { value: 0 }, uCA: { value: .002 }, uFade: { value: 1 }, uRes: { value: new THREE.Vector2(W, H) } },
  vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uZoom,uCA,uFade; uniform vec2 uRes; varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){ vec2 c=vec2(.5), d=vUv-c; vec3 col=vec3(0.); float ca=uCA+uZoom*.014, r2=dot(d,d);
      int N=uZoom<.01?1:14;
      for(int i=0;i<14;i++){ if(i>=N) break; float s=N==1?1.:1.-uZoom*.18*float(i)/float(N-1);
        col.r+=texture2D(tDiffuse,c+d*s*(1.+ca*(.6+r2*3.))).r; col.g+=texture2D(tDiffuse,c+d*s).g; col.b+=texture2D(tDiffuse,c+d*s*(1.-ca*(.6+r2*3.))).b; }
      col/=float(N);
      float l=dot(col,vec3(.299,.587,.114));
      col=mix(col,col*vec3(1.08,1.0,.92),smoothstep(.3,1.,l));     // warm highlights
      col=mix(col,col*vec3(.92,.95,1.02),1.-smoothstep(0.,.25,l));  // neutral-cool blacks
      col=clamp(col,0.,1.); col=col*col*(3.-2.*col)*.3+col*.7;
      float v=smoothstep(1.05,.22,length(d*vec2(1.25,.95))); col*=mix(.35,1.,v);
      col*=uFade; col+=(hash(vUv*uRes+fract(uTime*7.)*97.)-.5)*.03;
      gl_FragColor=vec4(col,1.); }`
});
composer.addPass(grade);

// ---------------- helpers ----------------
const $ = id => document.getElementById(id);
const tmpV = new THREE.Vector3();
function P(i, pos, rot, s = 1) { const p = phones[i]; p.visible = true; p.position.set(...pos); p.rotation.set(rot[0], rot[1], rot[2], 'YXZ'); p.scale.setScalar(s); p.updateMatrixWorld(true); }
function cam(pos, target, roll = 0) { camera.position.set(...pos); camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(...target); }
const orbit = (tg, ang, dist, h) => [tg[0] + Math.sin(ang) * dist, tg[1] + h, tg[2] + Math.cos(ang) * dist];
const local = (i, v) => { tmpV.set(...v); phones[i].localToWorld(tmpV); return [tmpV.x, tmpV.y, tmpV.z]; };
const fl = (t, i) => Math.sin(t * 1.4 + i * 2.1) * 0.02;
let TEX;
function dom(id, t, t0, t1 = 99, y = 40) {
  const el = $(id); const on = t >= t0; el.style.visibility = on ? 'visible' : 'hidden'; if (!on) return;
  const p = eOutExpo(prog(t, t0, t0 + .45)), q = eInCubic(prog(t, t1, t1 + .3));
  const extra = id === 'pill' ? 'translateX(-50%) ' : '';
  el.style.opacity = (clamp(p * 2) * (1 - q)).toFixed(3);
  el.style.transform = `${extra}translateY(${((1 - p) * y).toFixed(1)}px) scale(${lerp(1.35, 1, p).toFixed(4)})`;
  el.style.filter = p < .99 ? `blur(${((1 - p) * 12).toFixed(1)}px)` : 'none';
}

// ================= TIMELINE =================
const DURATION = 27;
function setTime(t) {
  Object.values(WORDS).forEach(w => w.grp.visible = false);
  phones.forEach(p => p.visible = false);
  scan.visible = false; eline.visible = false;
  for (const el of $('ui').children) el.style.visibility = 'hidden';
  let glow = 1, glowPos = [.5, .5], grid = .7, warp = 0, fade = 1, envRot = .3 + t * .25, pSpeed = t * .3;
  const scr = i => phones[i].userData.screen;

  // ===== S1 0–3: IMAŠ TELEFON? =====
  if (t < 3.0) {
    const ce = eInOutSine(prog(t, 0, 3));
    cam([0, 0.1, lerp(6.2, 5.4, ce)], [0, 0, 0], lerp(0.03, -0.01, ce));
    const lp = eInExpo(prog(t, 0.05, 0.5));
    eline.material.uniforms.uLen.value = lerp(0.02, 1.1, lp);
    eline.material.uniforms.uA.value = t < 0.5 ? lp * 1.2 + 0.15 : Math.exp(-(t - .5) / .25) * 1.3;
    eline.visible = true;
    glow = t < 0.5 ? lp * .6 : 1.0 + .6 * Math.exp(-(t - .5) / .5); grid = t < .5 ? 0 : clamp((t - .5) * 1.5) * .8;
    W2('imas', t, 0.5, 'zoom', 2.62, 'fly', { y: .085, w: .66 });
    W2('tel1', t, 1.0, 'slamrot', 2.66, 'fly', { y: -.065, w: .88 });
    fade = t < 0.04 ? 0 : 1;
    warp = .6 * bell(t, 2.95, .18);
  }
  // ===== S2 3–7: phone + KUPUJEMO! =====
  else if (t < 7.0) {
    eline.visible = false;
    const f = eOutExpo(prog(t, 3.0, 3.52));
    const spin = 1 - f;
    const ry = lerp(0.45, -0.55, eInOutSine(prog(t, 3.5, 7.0))) + spin * Math.PI * 3;
    const out = eInExpo(prog(t, 6.6, 7.0));
    P(2, [0, lerp(-.2, 0, f) + fl(t, 2) + out * 0, lerp(-14, 0, f) + out * 3], [lerp(0.8, 0.06, f), ry + out * Math.PI * 2, lerp(-.4, 0, f)]);
    scr(2).emissiveMap = TEX.w2; scr(2).emissiveIntensity = 1;
    const tg = [0, -0.25, 0];
    const k = eInOutSine(prog(t, 3, 7));
    cam(orbit(tg, lerp(-.25, .2, k), lerp(5.6, 5.0, k), lerp(.35, .1, k)), tg, lerp(-.04, .03, k));
    // KUPUJEMO: center slam, then slides down under the phone
    const mv = eInOutCubic(prog(t, 4.7, 5.15));
    if (t >= 3.99) {
      const a = kin(t, 4.0, 'back'), b = outk(t, 6.62, 'fly');
      word('kup', { y: lerp(0, -.3, mv), w: lerp(.82, .8, mv), s: a.s * b.s, op: a.op * b.op, rz: 0, d: lerp(4.2, 5, mv) });
    }
    dom('s2sub', t, 5.25, 6.55, 30);
    glow = 1.25 + .5 * pulse(t, 3.5, .02, .4); glowPos = [.5, .56]; envRot = 1 + t * .7;
    warp = 1.1 * bell(t, 3.05, .15) + .8 * bell(t, 6.97, .14);
  }
  // ===== S3 7–11: PRODAJ. ZAMENI. KUPI. =====
  else if (t < 11.0) {
    const k = eInOutSine(prog(t, 7, 11));
    const tg = [0, 0, -.6];
    let d = lerp(7.0, 6.2, k) - 3.5 * eInExpo(prog(t, 10.62, 11.0));
    cam(orbit(tg, lerp(.3, -.3, k), d, lerp(.45, .15, k)), tg, lerp(.03, -.03, k));
    const enter = (i, t0, from, to, rf, rt2) => { if (t < t0 - .4) return; const e = eOutExpo(prog(t, t0 - .4, t0 + .1)); const pos = L3(from, to, e); pos[1] += fl(t, i); const r = L3(rf, rt2, e); r[1] += .08 * Math.sin(t * .8 + i); P(i, pos, r); scr(i).emissiveMap = TEX['w' + i]; };
    enter(0, 7.5, [-4, 1.5, -2], [-1.0, 0.05, -1.3], [0.4, 3.6, .5], [.05, .55, 0]);
    enter(1, 8.5, [4, -1.5, -2], [1.0, 0.05, -1.3], [-.4, -3.6, -.5], [.05, -.55, 0]);
    enter(2, 9.5, [0, -4, 1], [0, -0.05, -.4], [1.0, -6.28, 0], [.05, 0, 0]);
    W2('prodaj', t, 7.5, 'left', 8.38, 'left', { y: 0, w: .9, d: 4.6 });
    W2('zameni', t, 8.5, 'flip', 9.38, 'flip', { y: 0, w: .88, d: 4.6 });
    W2('kupi', t, 9.5, 'zoom', 10.62, 'fly', { y: 0, w: .8, d: 4.6 });
    glow = 1.1; glowPos = [.5, .5]; envRot = t * .9;
    warp = .9 * bell(t, 10.98, .14);
  }
  // ===== S4 11–16: BRZA PROCENA. / FER CENA. =====
  else if (t < 16.0) {
    const r1 = eInOutCubic(prog(t, 11.0, 13.2));
    P(0, [0, fl(t, 0), 0], [0.06, lerp(Math.PI + 0.7, -0.35, r1) + .35 * eInOutSine(prog(t, 13.2, 16)), lerp(.1, 0, r1)]);
    scr(0).emissiveMap = TEX.w0; scr(0).emissiveIntensity = 1;
    const tg = [0, 0, 0];
    let d = lerp(2.2, 5.6, eOutExpo(prog(t, 11.0, 11.8))) - .4 * prog(t, 11.8, 15.6) - 3.6 * eInExpo(prog(t, 15.6, 16.0));
    cam(orbit(tg, lerp(.6, -.2, eOutCubic(prog(t, 11, 16))), d, lerp(.6, .15, eOutCubic(prog(t, 11, 12)))), tg, 0);
    // scan
    scan.visible = t > 11.95 && t < 13.35;
    scan.position.y = lerp(.8, -.8, eInOutSine(prog(t, 12.0, 13.2)));
    scan.position.z = FRONT + 0.04; scan.rotation.y = 0;
    scanMat.uniforms.uA.value = clamp(prog(t, 11.95, 12.1)) * (1 - prog(t, 13.15, 13.35));
    W2('brza', t, 11.5, 'drop', 13.25, 'flip', { y: .345, w: .62 });
    W2('procena', t, 11.75, 'rise', 13.25, 'flip', { y: -.34, w: .94 });
    W2('fer', t, 13.5, 'flip', 15.6, 'up', { y: .345, w: .5 });
    W2('cena', t, 13.75, 'flip', 15.6, 'down', { y: -.34, w: .8 });
    glow = 1.15; envRot = t * .55;
    warp = .9 * bell(t, 15.97, .14);
  }
  // ===== S5 16–21: TVOJ SLEDEĆI / TELEFON / JE OVDE. =====
  else if (t < 21.0) {
    const tg = [0, 0, 0];
    const k = eInOutSine(prog(t, 16, 21));
    const build = eInCubic(prog(t, 19.9, 20.95));
    cam(orbit(tg, lerp(-.15, .15, k), lerp(6.4, 5.6, k) - build * .8, .2), tg, build * .05 * Math.sin(t * 30));
    // pass-throughs
    if (t < 16.75) { const u = prog(t, 16.0, 16.75); P(1, [lerp(-3.2, 3.2, eInOutSine(u)), .3, lerp(1.5, 2.2, u)], [.2, lerp(-1.5, 2.2, u), .3]); scr(1).emissiveMap = TEX.w1; }
    if (t > 16.4 && t < 17.2) { const u = prog(t, 16.45, 17.2); P(2, [lerp(3.4, -3.4, eInOutSine(u)), -.4, lerp(1.0, 1.8, u)], [-.15, lerp(1.6, -2.4, u), -.25]); scr(2).emissiveMap = TEX.w2; }
    if (t > 17.0) {
      const e = eOutExpo(prog(t, 17.0, 17.55));
      const ry = -.3 + (1 - e) * Math.PI * 2 + .3 * Math.sin((t - 17.5) * .9) + build * Math.PI * 5;
      P(0, [0, lerp(-3.2, 0, e) + fl(t, 0), 0], [.05, ry, 0]); scr(0).emissiveMap = TEX.w0;
    }
    W2('tvoj', t, 17.5, 'left', 20.15, 'fly', { y: .33, w: .9 });
    W2('telefon', t, 18.0, 'zoom', 20.2, 'fly', { y: -.295, w: .92 });
    W2('ovde', t, 18.5, 'rise', 20.25, 'fly', { y: -.415, w: .6 });
    glow = 1.1 + build * 1.4; envRot = t * .6 + build * 4;
    warp = .8 * bell(t, 16.05, .15) + .6 * bell(t, 16.75, .12) + build * 1.4; pSpeed = t * .3 + build * 8;
    eline.visible = build > 0; eline.material.uniforms.uLen.value = lerp(1.2, .05, build); eline.material.uniforms.uA.value = build * 1.5;
  }
  // ===== S6 21–27: ZONA TELEFONA =====
  else {
    eline.visible = false;
    const e = eOutExpo(prog(t, 21.0, 21.9));
    const ry = lerp(-1.2, -.25, e) + .35 * Math.sin((t - 21) * .55);
    P(2, [0, lerp(-1.6, 0, e) + fl(t, 2) * .8, 0], [.05, ry, 0]); scr(2).emissiveMap = TEX.logo; scr(2).emissiveIntensity = 1 + .4 * pulse(t, 21, .02, .6);
    const se = eOutExpo(prog(t, 21.1, 22.2));
    P(0, [lerp(-3, -1.25, se), .25 + fl(t, 0), -2.2], [.04, .7, 0]); scr(0).emissiveMap = TEX.w0;
    P(1, [lerp(3, 1.25, se), .25 + fl(t, 1), -2.2], [.04, -.7, 0]); scr(1).emissiveMap = TEX.w1;
    const tg = [0, -.84, 0];
    const k = eOutCubic(prog(t, 21, 27));
    cam(orbit(tg, lerp(.12, -.06, k), lerp(5.6, 5.0, k), lerp(.95, .85, k)), tg, 0);
    const zA = kin(t, 21.0, 'slamrot'), tA = kin(t, 21.35, 'zoom');
    const sh = lerp(-.2, 1.25, eInOutSine(prog(t, 24.0, 25.0)));
    word('zona', { y: -.06, w: .86, s: zA.s, rz: zA.rz, rx: zA.rx, op: zA.op, shine: sh, d: 4.6 });
    word('telefona', { y: -.178, w: .86, s: tA.s, rz: tA.rz, op: tA.op, shine: sh - .15, d: 4.6 });
    dom('l1', t, 22.2); dom('l2', t, 22.6); dom('pill', t, 23.0, 99, 50);
    const pill = $('pill'); pill.style.setProperty('--sx', lerp(-220, pill.offsetWidth + 80, eInOutSine(prog(t, 23.6, 24.5))).toFixed(1) + 'px');
    glow = 1.2 + .6 * pulse(t, 21, .02, .7); glowPos = [.5, .66]; envRot = 1.2 + (t - 21) * .4;
    fade = 1 - eInCubic(prog(t, 26.6, 27.0));
  }

  // ---------- impacts: rings / burst / sparks / flash / shake / zoom ----------
  let flash = 0, shake = 0, zoom = 0, bA = 0, last = null;
  const active = [];
  for (const [ti, s] of IMP) {
    const dt = t - ti;
    if (dt >= -0.02 && dt < 1.0) active.push([dt, s]);
    if (dt >= 0) last = [dt, s];
    flash += s * .2 * pulse(t, ti, .015, .1);
    shake += s * pulse(t, ti, .01, .18);
    zoom += s * .55 * bell(t, ti + .05, .07);
    bA += s * pulse(t, ti, .01, .13);
  }
  flash += .95 * pulse(t, 20.98, .1, .4);
  rings.forEach((r, i) => {
    const a = active[active.length - 1 - i];
    if (!a || a[0] < 0) { r.visible = false; return; }
    r.visible = true; const [dt, s] = a; const e = eOutCubic(clamp(dt / .8));
    r.material.uniforms.uR.value = lerp(.05, 1.05, e); r.material.uniforms.uW.value = lerp(.01, .05, e); r.material.uniforms.uA.value = s * Math.pow(1 - e, 1.5) * .7;
  });
  burst.material.uniforms.uA.value = Math.min(1.0, bA * .45); burst.material.uniforms.uRot.value = t * .3; burst.visible = bA > .005;
  if (last && last[0] < 1.4) { sparks.visible = true; sMat.uniforms.uDt.value = last[0]; sMat.uniforms.uA.value = last[1]; } else sparks.visible = false;
  zoom += warp * .35;
  grade.uniforms.uZoom.value = Math.min(zoom, 1.4);
  grade.uniforms.uCA.value = .002 + .006 * Math.min(1, flash);
  grade.uniforms.uFade.value = fade; grade.uniforms.uTime.value = t;
  $('flash').style.opacity = Math.min(.9, flash).toFixed(4);
  $('ui').style.opacity = fade.toFixed(3);
  if (shake > .002) { const s = shake * .045; camera.position.x += Math.sin(t * 93) * s; camera.position.y += Math.cos(t * 71) * s; }

  bgMat.uniforms.uTime.value = t; bgMat.uniforms.uGlow.value = glow + .8 * Math.min(1, bA); bgMat.uniforms.uGlowPos.value.set(glowPos[0], glowPos[1]);
  bgMat.uniforms.uGrid.value = grid; bgMat.uniforms.uWarp.value = warp;
  pMat.uniforms.uTime.value = t; pMat.uniforms.uSpeed.value = pSpeed;
  scene.environmentRotation.set(0, envRot, 0);
  composer.render();
}

async function boot() {
  for (const w of ['700', '800', '900']) await document.fonts.load(`${w} 100px Montserrat`, 'AŠĆČŽĐšćčžđ');
  await document.fonts.load('italic 900 100px Montserrat', 'AŠĆ');
  await document.fonts.ready;
  TEX = { w0: wallTex(0), w1: wallTex(1), w2: wallTex(2), logo: logoTex() };
  phones.forEach((p, i) => { p.userData.screen.emissiveMap = TEX['w' + i]; p.userData.screen.needsUpdate = true; });
  makeWord('imas', 'IMAŠ');
  makeWord('tel1', 'TELEFON?', { orange: true });
  makeWord('kup', 'KUPUJEMO!', { orange: true, italic: true });
  makeWord('prodaj', 'PRODAJ.');
  makeWord('zameni', 'ZAMENI.', { orange: true });
  makeWord('kupi', 'KUPI.');
  makeWord('brza', 'BRZA');
  makeWord('procena', 'PROCENA.', { orange: true });
  makeWord('fer', 'FER');
  makeWord('cena', 'CENA.', { orange: true });
  makeWord('tvoj', 'TVOJ SLEDEĆI');
  makeWord('telefon', 'TELEFON', { orange: true });
  makeWord('ovde', 'JE OVDE.');
  makeWord('zona', 'ZONA', { orange: true, spacing: 6 });
  makeWord('telefona', 'TELEFONA', { spacing: 34 });
  for (const tw of [1.2, 4.5, 8, 12.5, 18.6, 22, 24]) setTime(tw);
  window.setTime = setTime; window.READY = true;
}
boot();
