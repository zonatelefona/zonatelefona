// ZONA TELEFONA — BLACK FRIDAY (1080×1920). v2 reconstruction: eleven separate shots, each its own 3D world or plate,
// joined by ten different transitions in a compositor pass (iris, light blade, whip, rack focus, light sweep, dolly,
// flash, slit, luma, dim).
//   S1  0–3   CG macro lens: iris blades, orange reflection, fly through the aperture → light-blade space, „SPREMI SE.“
//   S2  3–7   four real phone shots: titanium side frame (footage), camera plateau (still), front display in a
//             reflective studio, three phones in a 3D composition
//   S3  7–11  metal architecture corridor, travelling orange pulses, CG phone near-miss past its titanium edge
//   S4 11–15  2,200 metal fragments swirl in and lock into a 3D „BLACK FRIDAY“
//   S5 15–19  mirror-floor showcase, „ZONA TELEFONA“ rises through the floor
//   S6 19–23  hero footage with volumetric beams: „AKCIJA STIŽE“, „USKORO.“
//   S7 23–25  logo on deep black
// Deterministic: setTime(t) renders exactly the frame at time t.
import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import T from './timeline.json' with { type: 'json' };

const W = 1080, H = 1920, ASPECT = W / H, TANV = Math.tan(17 * Math.PI / 180);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eOutCubic = x => 1 - Math.pow(1 - x, 3), eInCubic = x => x * x * x, eInQuad = x => x * x;
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eInOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInExpo = x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10);
const eOutQuart = x => 1 - Math.pow(1 - x, 4);
const eOutBack = (x, c = 1.4) => 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const noise1 = t => Math.sin(t * 1.3) * .6 + Math.sin(t * 2.7 + 1.3) * .3 + Math.sin(t * 5.1 + 2.1) * .1;
const hit = (t, t0, d) => t >= t0 ? Math.exp(-(t - t0) / d) : 0;           // decaying impulse
const settle = (x, f = 2.2, d = 7) => x <= 0 ? 0 : 1 - Math.exp(-d * x) * Math.cos(f * 2 * Math.PI * x);   // damped overshoot
const load = s => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = s; });
const ORHOT = new THREE.Color(1.0, .42, .16);
const VS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };
const visW = d => 2 * d * TANV * ASPECT, visH = d => 2 * d * TANV;             // frame size in world units at distance d
const px2w = (px, d) => px / W * visW(d);

// ================================================================== renderer + post
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.localClippingEnabled = true;
const RT = () => new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const rtA = RT(), rtB = RT();

const COMP = new THREE.ShaderMaterial({
  uniforms: { tA: { value: rtA.texture }, tB: { value: rtB.texture }, uMode: { value: 0 }, uP: { value: 0 }, uK: { value: 0 }, uR: { value: 0 }, uRot: { value: 0 }, uE: { value: 1 }, uC: { value: new THREE.Vector2(.5, .5) } },
  vertexShader: VS,
  fragmentShader: `uniform sampler2D tA,tB; uniform int uMode; uniform float uP,uK,uR,uRot,uE; uniform vec2 uC; varying vec2 vUv;
    const float AS=${(W / H).toFixed(6)};
    vec3 s(sampler2D t,vec2 u){ vec3 v=texture2D(t,clamp(u,0.,1.)).rgb; v=mix(v,vec3(0.),vec3(isnan(v))); return clamp(v,0.,48.); }   // guard: no Inf/NaN into bloom
    vec3 zb(sampler2D t,vec2 u,vec2 c,float k){ vec3 a=vec3(0.); for(int i=0;i<10;i++){ float f=float(i)/9.; a+=s(t,c+(u-c)*(1.-k*f)); } return a*.1; }
    vec3 db(sampler2D t,vec2 u,vec2 d){ vec3 a=vec3(0.); for(int i=0;i<14;i++){ float f=float(i)/13.-.5; a+=s(t,u+d*f); } return a/14.; }
    vec3 disc(sampler2D t,vec2 u,float r){ vec3 a=s(t,u); for(int i=0;i<16;i++){ float fi=float(i); float g=fi*2.39996; float rr=r*sqrt((fi+.5)/16.); a+=s(t,u+vec2(cos(g),sin(g))*rr/vec2(1080.,1920.)); } return a/17.; }
    float ngon(vec2 p,float rot){ float S=6.2831853/9.; float a=atan(p.y,p.x)-rot; float k=floor(a/S+.5); return cos(k*S-a)*length(p); }
    float eio(float x){ return x<.5?4.*x*x*x:1.-pow(-2.*x+2.,3.)/2.; }
    void main(){ vec3 c;
      if(uMode==0){ c=s(tA,vUv); }
      else if(uMode==1){            // IRIS: the next world is seen through the 9-blade aperture
        vec2 p=(vUv-uC)*vec2(AS,1.); float d=ngon(p,uRot); float m=smoothstep(uR+.003,uR-.003,d);
        vec3 a=zb(tA,vUv,uC,uK); vec3 b=zb(tB,uC+(vUv-uC)*(.72+.28*uP),uC,.22*(1.-uP))*uE;
        c=a*(1.-m*uP)+b*m+vec3(1.,.55,.25)*exp(-pow((d-uR)/.004,2.))*.8*(1.-uP);
      } else if(uMode==2){          // LIGHT BLADE: the vertical light opens into the next shot
        float dx=abs(vUv.x-.5); float m=smoothstep(uK+.004,uK-.004,dx);
        vec3 a=s(tA,vUv)*(1.+uP*1.2); vec3 b=s(tB,vUv)*(1.+3.*(1.-uP)*(1.-uP));
        c=mix(a,b,m)+vec3(1.,.62,.32)*exp(-pow((dx-uK)/.016,2.))*2.*(1.-uP*.8)+vec3(1.,.5,.2)*exp(-pow(dx/(.05+uK),2.))*.5*sin(3.14159*uP);
      } else if(uMode==3){          // WHIP: horizontal smear
        float e=eio(uP); float bl=sin(3.14159*uP)*.24; float x=vUv.x+e;
        c=mix(db(tA,vec2(x,vUv.y),vec2(bl,0.)),db(tB,vec2(x-1.,vUv.y),vec2(bl,0.)),smoothstep(.96,1.04,x));
      } else if(uMode==4){          // RACK FOCUS
        float ba=smoothstep(0.,.55,uP)*30., bb=(1.-smoothstep(.45,1.,uP))*30.;
        c=mix(disc(tA,.5+(vUv-.5)*(1.-.07*uP),ba),disc(tB,.5+(vUv-.5)*(1.06-.06*uP),bb),smoothstep(.38,.62,uP));
      } else if(uMode==5){          // DIAGONAL LIGHT SWEEP
        float sw=mix(-.25,1.25,eio(uP)); float dg=vUv.x*.55+(1.-vUv.y)*.45; float m=smoothstep(sw+.015,sw-.015,dg);
        c=mix(s(tA,vUv),s(tB,vUv),m)+vec3(1.,.6,.32)*(exp(-pow((dg-sw)/.01,2.))*1.8+exp(-pow((dg-sw)/.07,2.))*.3);
      } else if(uMode==6){          // DEPTH DOLLY
        float ea=uP*uP*uP, eb=1.-pow(1.-uP,3.);
        c=mix(zb(tA,.5+(vUv-.5)/(1.+2.2*ea),vec2(.5),.2*uP),zb(tB,.5+(vUv-.5)*(1.6-.6*eb),vec2(.5),.22*(1.-uP)),smoothstep(.3,.7,uP));
      } else if(uMode==7){          // FLASH into the light
        float up=smoothstep(0.,.5,uP), dn=1.-smoothstep(.5,1.,uP);
        c=mix(s(tA,vUv)*(1.+2.6*up*up),s(tB,vUv)*(1.+2.6*dn*dn),smoothstep(.44,.56,uP))+vec3(1.,.55,.28)*exp(-pow((uP-.5)/.1,2.))*.75;
      } else if(uMode==8){          // SLIT between the two lines
        float dy=abs(vUv.y-uC.y); float m=smoothstep(uR+.003,uR-.003,dy);
        c=mix(zb(tA,vUv,uC,.1*uP),s(tB,uC+(vUv-uC)*(1.25-.25*uP))*(1.+1.5*(1.-uP)),m)+vec3(1.,.6,.3)*exp(-pow((dy-uR)/.005,2.))*1.4*(1.-uP);
      } else if(uMode==9){          // LUMA: the next shot appears in the light first
        vec3 bl=disc(tA,vUv,18.); float l=dot(bl,vec3(.3,.59,.11)); float m=clamp((l*.9+uP*1.7-.85)*3.,0.,1.);
        c=mix(s(tA,vUv),s(tB,vUv),m)+vec3(1.,.5,.2)*m*(1.-m)*1.1;
      } else {                      // DIM: lights go out, the end card comes up
        c=s(tA,vUv)*pow(1.-uP,2.2)+s(tB,vUv)*smoothstep(.5,1.,uP);
      }
      gl_FragColor=vec4(c,1.); }`
});
let ACTIVE = { a: null, b: null };
class CompPass extends Pass {
  constructor() { super(); this.needsSwap = true; this.q = new FullScreenQuad(COMP); }
  render(r, writeBuffer) {
    const { a, b } = ACTIVE;
    r.setRenderTarget(rtA); r.clear(); r.render(a.scene, a.cam);
    if (b) { r.setRenderTarget(rtB); r.clear(); r.render(b.scene, b.cam); }
    r.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.q.render(r);
  }
}
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new CompPass());
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .38, .42, 1.0); composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: .5 }, uFlash: { value: 0 }, uFade: { value: 1 } },
  vertexShader: VS,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uVig,uFlash,uFade; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 q=vUv-.5; vec3 c;
      c.r=texture2D(tDiffuse,.5+q*1.0012).r; c.g=texture2D(tDiffuse,vUv).g; c.b=texture2D(tDiffuse,.5+q*.9988).b;   // faint lens CA
      c=clamp(c,0.,1.); c=mix(c,vec3(1.,.74,.52),uFlash*.55);
      float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,1.05);
      c=pow(c,vec3(1.07)); c=c*c*(3.-2.*c)*.25+c*.75;
      q.y*=1.15; c*=1.-uVig*smoothstep(.28,.88,length(q));
      c+=(h(vUv*vec2(1080.,1920.)+fract(uTime*7.)*91.)-.5)*.024;
      gl_FragColor=vec4(c*uFade,1.); }`
});
composer.addPass(new OutputPass()); composer.addPass(grade);

// ================================================================== reflection environments (PMREM)
function makeEnv(build) {
  const env = new THREE.Scene(); env.background = new THREE.Color(0);
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x040404, side: THREE.BackSide })));
  const panel = (w, h, c, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
  build(panel);
  const pm = new THREE.PMREMGenerator(renderer); const tex = pm.fromScene(env, .03).texture; pm.dispose(); return tex;
}
const ENV_STUDIO = makeEnv(p => {
  p(10, 3, [5, 1.9, .7], -9, 4, 2, Math.PI / 2); p(6, 2, [3.5, 1.3, .45], 9, -2, -3, -Math.PI / 2);
  p(14, .35, [4, 3.9, 3.7], 0, 12, 0, 0, Math.PI / 2); p(8, .25, [2.5, 2.4, 2.3], 0, 2, -12); p(4, 6, [.25, .22, .2], 0, 0, 13);
});
const ENV_HOT = makeEnv(p => {
  p(16, 2.2, [6, 2.2, .7], 0, 9, 6, 0, Math.PI / 2.6); p(3, 12, [4.5, 1.6, .5], -11, 0, 4, Math.PI / 2); p(3, 12, [4.5, 1.6, .5], 11, 0, 4, -Math.PI / 2);
  p(12, .3, [4, 3.8, 3.5], 0, -3, 13); p(10, 1, [2.2, .8, .25], 0, -9, 0, 0, -Math.PI / 2); p(6, 10, [.4, .3, .25], 0, 2, -13);
});

// ================================================================== materials
const metalBlack = () => new THREE.MeshStandardMaterial({ color: 0x101011, metalness: 1, roughness: .24, envMapIntensity: 1.3 });
const edgeOrange = (k = 0) => new THREE.MeshStandardMaterial({ color: 0x2a140b, metalness: .85, roughness: .3, emissive: ORHOT.clone(), emissiveIntensity: k, envMapIntensity: 1 });
const typeFace = (k = .55) => new THREE.MeshStandardMaterial({ color: 0xf2eee8, metalness: .45, roughness: .3, envMapIntensity: 1, emissive: new THREE.Color(.92, .88, .82), emissiveIntensity: k });
const graphite = (c = 0x1c1c1f, r = .35) => new THREE.MeshStandardMaterial({ color: c, metalness: .95, roughness: r, envMapIntensity: 1 });
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.12, 'rgba(255,190,140,.9)'); g.addColorStop(.4, 'rgba(255,120,60,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const id = x.createImageData(256, 256);
  const N = (u, v) => { let s = 0, a = .5, f = 1; for (let o = 0; o < 5; o++) { s += a * (Math.sin(u * f * 6.3 + hash(o) * 9) * Math.sin(v * f * 5.7 + hash(o + 3) * 7) * .5 + .5); a *= .5; f *= 2.1; } return s; };
  for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) { const u = xx / 256 - .5, v = y / 256 - .5, r = Math.sqrt(u * u + v * v) * 2; const k = Math.max(0, 1 - r) ** 1.6 * N(u + .5, v + .5); const i = (y * 256 + xx) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = k * 255; }
  x.putImageData(id, 0, 0); return new THREE.CanvasTexture(c); })();

// ================================================================== shared building blocks
let FONT;
function text3d(str, { size = 1, depth = .25, bevel = .03, tracking = 0, face = metalBlack(), side = edgeOrange() } = {}) {
  const g = new THREE.Group(), chars = [], sc = size / FONT.data.resolution; let x = 0;
  for (const ch of str) {
    const gl = FONT.data.glyphs[ch] || FONT.data.glyphs['?'];
    if (ch !== ' ') {
      const geo = new THREE.ExtrudeGeometry(FONT.generateShapes(ch, size), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .75, bevelSegments: 3, curveSegments: 7 });
      geo.computeBoundingBox(); const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
      geo.translate(-cx, -cy, -depth / 2);
      const m = new THREE.Mesh(geo, [face, side]); m.userData = { home: new THREE.Vector3(x + cx, cy, 0), ch, cx, cy, size, zf: depth / 2 + bevel, hw: (bb.max.x - bb.min.x) / 2 }; chars.push(m); g.add(m);
    }
    x += gl.ha * sc + tracking * size;
  }
  const w = x - tracking * size, capC = size * .36;
  // centre on the ink (glyph outlines), not on the advance widths: side bearings would push the word off-axis
  const ink = (Math.min(...chars.map(m => m.userData.home.x - m.userData.hw)) + Math.max(...chars.map(m => m.userData.home.x + m.userData.hw))) / 2;
  for (const m of chars) { m.userData.home.x -= ink; m.userData.home.y -= capC; m.position.copy(m.userData.home); }
  g.userData = { chars, width: w, face, side, size, capH: size * .72 }; return g;
}
const fitW = (g, w) => { g.userData.fit = w / g.userData.width; g.scale.setScalar(g.userData.fit); return g; };
function dustCloud(n, cx, cy, cz, sx, sy, sz, size, seed, col = [1, .66, .42]) {
  const p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { p.set([cx + (hash(i + seed) - .5) * sx, cy + (hash(i * 1.7 + seed) - .5) * sy, cz + (hash(i * 2.3 + seed) - .5) * sz], i * 3); s[i] = hash(i * 3.1 + seed); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 }, uT: { value: 0 }, uSize: { value: size }, uC: { value: new THREE.Color(...col) } },
    vertexShader: `attribute float aS; uniform float uT,uSize; varying float vA;
      void main(){ vec3 q=position+vec3(sin(uT*.3+aS*40.)*.25, mod(uT*.12*(.5+aS)+aS*3.,3.)-1.5, cos(uT*.25+aS*30.)*.25);
        vec4 mv=modelViewMatrix*vec4(q,1.); gl_PointSize=uSize*(.6+aS)*(30./-mv.z); vA=(.4+.6*fract(aS*7.))*smoothstep(70.,6.,-mv.z)*smoothstep(.3,1.5,-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uA; uniform vec3 uC; varying float vA; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; float k=(1.-d*2.); k*=k; gl_FragColor=vec4(uC*k*vA*uA,1.); }` }));
  pts.frustumCulled = false; return pts;
}
function bokeh(n, cx, cy, cz, sx, sy, sz, size, seed) {          // big soft out-of-focus discs (foreground depth)
  const p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { p.set([cx + (hash(i + seed) - .5) * sx, cy + (hash(i * 1.9 + seed) - .5) * sy, cz + (hash(i * 2.9 + seed) - .5) * sz], i * 3); s[i] = hash(i * 4.1 + seed); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 }, uT: { value: 0 }, uSize: { value: size } },
    vertexShader: `attribute float aS; uniform float uT,uSize; varying float vA;
      void main(){ vec3 q=position+vec3(sin(uT*.21+aS*20.)*.18, sin(uT*.17+aS*13.)*.14, 0.); vec4 mv=modelViewMatrix*vec4(q,1.);
        gl_PointSize=uSize*(.5+aS)*(10./-mv.z); vA=.25+.75*fract(aS*5.3); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uA; varying float vA; void main(){ float d=length(gl_PointCoord-.5)*2.; if(d>1.) discard; float k=smoothstep(1.,.86,d)*(.55+.45*smoothstep(.5,.95,d));
      gl_FragColor=vec4(vec3(1.,.55,.26)*k*vA*uA*.1,1.); }` }));
  pts.frustumCulled = false; return pts;
}
function smokeBank(n, cx, cy, cz, sx, sz, scale, seed, col = 0xff7a40) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    m.userData = { x: cx + (hash(i + seed) - .5) * sx, y: cy + (hash(i * 3 + seed) - .5) * 1.2, z: cz + (hash(i * 5 + seed) - .5) * sz, s: scale * (.7 + hash(i * 7 + seed) * .8), r: hash(i * 11 + seed) * 6, v: (hash(i * 13 + seed) - .5) * .2 };
    g.add(m); }
  g.userData.update = (t, a) => g.children.forEach(m => { const u = m.userData; m.position.set(u.x + Math.sin(t * .2 + u.r) * .4, u.y + t * .03, u.z); m.scale.setScalar(u.s * (1 + .05 * Math.sin(t * .3 + u.r))); m.material.rotation = u.r + t * u.v; m.material.opacity = a * .055; });
  return g;
}
function beam(len, r0, r1) {           // volumetric light cone (additive, view-dependent edge falloff)
  const geo = new THREE.CylinderGeometry(r0, r1, len, 48, 1, true); geo.translate(0, -len / 2, 0);
  return new THREE.Mesh(geo, new THREE.ShaderMaterial({ ...ADD, side: THREE.DoubleSide, fog: false, uniforms: { uA: { value: 0 }, uL: { value: len }, uT: { value: 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP=position; vec4 w=modelMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-(viewMatrix*w).xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uA,uL,uT;
      void main(){ float along=clamp(-vP.y/uL,0.,1.); float edge=pow(abs(dot(vN,vV)),2.2); float n=.75+.25*sin(vP.y*1.7+uT*.8+atan(vP.z,vP.x)*4.);
        vec3 c=mix(vec3(1.,.62,.36),vec3(.85,.3,.1),along)*edge*(1.-along)*.42*n*uA; gl_FragColor=vec4(c,1.); }` }));
}
const glowPlane = (w, h, col = [1, .42, .15], fall = 16) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 }, uC: { value: new THREE.Color(...col) } },
  vertexShader: VS, fragmentShader: `uniform float uA; uniform vec3 uC; varying vec2 vUv; void main(){ vec2 q=vUv-.5; float r=length(q); gl_FragColor=vec4(uC*exp(-r*r*${fall.toFixed(1)})*smoothstep(.5,.28,r)*uA,1.); }` }));
function streak(w, h) {                 // anamorphic horizontal flare
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 } }, vertexShader: VS,
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float x=abs(vUv.x-.5)*2., y=abs(vUv.y-.5)*2.; float k=exp(-y*y*40.)*pow(1.-x,2.5); gl_FragColor=vec4((vec3(1.,.55,.25)*k+vec3(1.,.9,.8)*k*k*exp(-x*30.))*uA,1.); }` }));
}
// photo / footage plate: warm grade, light sweep, depth-of-field by mip bias, feathered edges
function plateMat({ alpha = false, rot = false, add = false } = {}) {
  return new THREE.ShaderMaterial({ transparent: alpha || add, depthWrite: !alpha && !add, side: THREE.DoubleSide, ...(add ? { blending: THREE.AdditiveBlending } : {}),
    uniforms: { map: { value: null }, map2: { value: null }, uMix: { value: 0 }, uGain: { value: 1.2 }, uWarm: { value: .3 }, uA: { value: 1 }, uSweep: { value: -9 }, uSweepA: { value: 0 }, uSweepW: { value: .01 },
      uSweepDir: { value: new THREE.Vector2(.8, .6) }, uBlur: { value: 0 }, uBlurAll: { value: 0 }, uFocus: { value: .5 }, uFocusW: { value: .3 }, uFeather: { value: .04 }, uFadeB: { value: 0 }, uScreen: { value: new THREE.Vector4(0, 0, 0, 0) }, uRim: { value: 0 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D map,map2; uniform float uMix,uGain,uWarm,uA,uSweep,uSweepA,uSweepW,uBlur,uBlurAll,uFocus,uFocusW,uFeather,uRim,uFadeB; uniform vec2 uSweepDir; uniform vec4 uScreen; varying vec2 vUv;
      void main(){ vec2 st=${rot ? 'vec2(vUv.y,1.-vUv.x)' : 'vUv'};
        float bias=uBlurAll+uBlur*smoothstep(uFocusW*.5,uFocusW*.5+.3,abs(vUv.y-uFocus));
        vec4 c=texture2D(map,st,bias); ${'' /* frame blend for footage */} if(uMix>0.) c=mix(c,texture2D(map2,st,bias),uMix);
        ${alpha ? 'if(c.a<.02) discard;' : ''}
        float l=dot(c.rgb,vec3(.2126,.7152,.0722));
        float scr=step(uScreen.x,vUv.x)*step(vUv.x,uScreen.z)*step(uScreen.y,vUv.y)*step(vUv.y,uScreen.w);   // screen area: neutralise cool hues
        c.rgb=mix(c.rgb,l*vec3(1.16,.88,.68),clamp(uWarm+scr*.55,0.,1.));
        c.rgb*=uGain;
        float d=dot(vUv-.5,uSweepDir)-uSweep; c.rgb+=vec3(1.,.58,.3)*exp(-d*d/uSweepW)*uSweepA*smoothstep(.01,.2,l)*${alpha ? 'c.a' : '1.'};
        float e=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)); c.rgb+=vec3(1.,.5,.22)*uRim*smoothstep(.05,0.,e)*.4;
        float f=smoothstep(0.,uFeather,vUv.x)*smoothstep(0.,uFeather,1.-vUv.x)*smoothstep(0.,uFeather,vUv.y)*smoothstep(0.,uFeather,1.-vUv.y)*mix(1.,smoothstep(0.,uFadeB,vUv.y),step(.001,uFadeB));
        gl_FragColor=${alpha ? 'vec4(c.rgb,c.a*uA*f)' : 'vec4(c.rgb*f*uA,1.)'}; }` });
}
const texOf = im => { const t = new THREE.Texture(im || undefined); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (im) t.needsUpdate = true; return t; };
class Seq {                              // footage as numbered JPEG frames, loaded on demand (deterministic: awaited before the frame renders)
  constructor(dir, n, fps = 29.97) { this.dir = dir; this.n = n; this.fps = fps; this.cache = new Map(); this.tex = [texOf(null), texOf(null)]; this.cur = [0, 0]; }
  async img(i) { i = clamp(i, 1, this.n); if (this.cache.has(i)) return this.cache.get(i); const im = await load(`${this.dir}/${String(i).padStart(4, '0')}.jpg`); this.cache.set(i, im); if (this.cache.size > 16) this.cache.delete(this.cache.keys().next().value); return im; }
  async at(sec, mat) {                   // blends the two neighbouring source frames (smooth 30 → 60 fps)
    const f = sec * this.fps + 1, i0 = Math.floor(f), k = f - i0;
    for (const [j, i] of [[0, i0], [1, i0 + 1]]) if (this.cur[j] !== i) { this.tex[j].image = await this.img(i); this.tex[j].needsUpdate = true; this.cur[j] = i; }
    mat.uniforms.map.value = this.tex[0]; mat.uniforms.map2.value = this.tex[1]; mat.uniforms.uMix.value = k;
  }
}

class Shot {
  constructor(name, { fov = 34, bg = 0x020202, env = ENV_STUDIO, fog = null } = {}) {
    this.name = name; this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(bg); this.scene.environment = env; if (fog) this.scene.fog = fog;
    this.cam = new THREE.PerspectiveCamera(fov, ASPECT, .03, 800); this.texts = []; this.update = async () => {};
  }
  look(p, l, roll = 0, shake = 0, t = 0) { this.cam.position.set(p[0] + Math.sin(t * 61) * shake, p[1] + Math.cos(t * 53) * shake * .7, p[2]); this.cam.lookAt(l[0], l[1], l[2]); if (roll) this.cam.rotateZ(roll); this.cam.updateMatrixWorld(); }
}
const scr = (shot, v) => { const p = v.clone().project(shot.cam); return new THREE.Vector2((p.x + 1) / 2, (p.y + 1) / 2); };   // uv (y up)

// ================================================================== S1a — CG macro lens
const L = new Shot('lens', { bg: 0x010101 });
{
  const s = L.scene, U = L.u = {};
  s.add(new THREE.AmbientLight(0x1a120c, .3));
  const kl = new THREE.SpotLight(0xff8a4c, 260, 40, .55, .8, 1.4); kl.position.set(-5, 6, 9); s.add(kl, kl.target); U.kl = kl;
  // anodised plateau with a fine micro-grain normal map
  const nrm = (() => { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); const id = x.createImageData(512, 512);
    for (let y = 0; y < 512; y++) for (let i = 0; i < 512; i++) { const n = hash(i * 7.1 + y * 131.7) - .5, m = Math.sin(i * .05 + Math.sin(y * .03) * 2) * .5; const k = (y * 512 + i) * 4; id.data[k] = 128 + n * 26 + m * 6; id.data[k + 1] = 128 + (hash(i * 3.3 + y * 71.9) - .5) * 26; id.data[k + 2] = 255; id.data[k + 3] = 255; }
    x.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 7); return t; })();
  const plShape = new THREE.Shape(); plShape.moveTo(-8, -11); plShape.lineTo(8, -11); plShape.lineTo(8, 11); plShape.lineTo(-8, 11); plShape.closePath();
  plShape.holes.push(new THREE.Path().absarc(0, 0, 1.0, 0, Math.PI * 2, true));          // the lens opening (the optics sit below the plateau)
  const plGeo = new THREE.ShapeGeometry(plShape, 96); { const uv = plGeo.attributes.uv, ps = plGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, ps.getX(i) / 16 + .5, ps.getY(i) / 22 + .5); }
  const plate = new THREE.Mesh(plGeo, new THREE.MeshStandardMaterial({ color: 0x232325, metalness: 1, roughness: .36, envMapIntensity: .8, normalMap: nrm, normalScale: new THREE.Vector2(.35, .35) }));
  s.add(plate);
  function polishM() { return new THREE.MeshStandardMaterial({ color: 0xffc8a0, metalness: 1, roughness: .1, envMapIntensity: 1.5 }); }
  const lathe = (pts, mat) => { const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), 128); g.rotateX(Math.PI / 2); return new THREE.Mesh(g, mat); };
  const orangeAno = new THREE.MeshStandardMaterial({ color: 0xc0561f, metalness: 1, roughness: .3, envMapIntensity: 1.1, side: THREE.DoubleSide });
  const polish = new THREE.MeshStandardMaterial({ color: 0xffc8a0, metalness: 1, roughness: .08, envMapIntensity: 1.6, side: THREE.DoubleSide });
  const blackIn = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: .6, roughness: .45, side: THREE.DoubleSide });
  function housing(R, withInner) {
    const g = new THREE.Group(), k = R / 1.4;
    g.add(lathe([[1.40, 0], [1.40, .06], [1.36, .30], [1.33, .36]].map(([r, h]) => [r * k, h]), orangeAno));
    g.add(lathe([[1.33, .36], [1.25, .42]].map(([r, h]) => [r * k, h]), polish));
    g.add(lathe([[1.25, .42], [1.10, .42]].map(([r, h]) => [r * k, h]), orangeAno));
    g.add(lathe([[1.10, .42], [1.04, .37]].map(([r, h]) => [r * k, h]), polish));
    g.add(lathe([[1.04, .37], [1.02, .18], [.98, .16], [.98, -.8]].map(([r, h]) => [r * k, h]), blackIn));
    if (!withInner) { const cap = new THREE.Mesh(new THREE.CircleGeometry(1.02 * k, 64), new THREE.MeshStandardMaterial({ color: 0x030303, metalness: .2, roughness: .06, envMapIntensity: 1.2 })); cap.position.z = .3; g.add(cap); }
    return g;
  }
  const main = housing(1.4, true); s.add(main);
  const second = housing(1.32, false); second.position.set(-.35, 3.25, 0); s.add(second);
  const flash = new THREE.Mesh(new THREE.CircleGeometry(.26, 48), new THREE.MeshStandardMaterial({ color: 0x0e0b09, metalness: .3, roughness: .12, envMapIntensity: 1.2 })); flash.position.set(1.35, -2.25, .012); s.add(flash);
  const flR = new THREE.Mesh(new THREE.RingGeometry(.26, .3, 64), polishM()); flR.position.set(1.35, -2.25, .012); s.add(flR);
  const mic = new THREE.Mesh(new THREE.CircleGeometry(.07, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })); mic.position.set(-1.25, -2.4, .01); s.add(mic);
  // inner optics: focus ring with ticks, element rims, two coated glass elements, the iris, the pupil
  const inner = new THREE.Group(); s.add(inner); U.inner = inner;
  const tick = (() => { const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d'); x.translate(512, 512);
    for (let i = 0; i < 180; i++) { x.save(); x.rotate(i / 180 * Math.PI * 2); x.fillStyle = i % 10 === 0 ? 'rgba(255,200,160,.85)' : 'rgba(200,170,150,.35)'; x.fillRect(430, -1.6, i % 10 === 0 ? 60 : 32, 3.2); x.restore(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const ring = new THREE.Mesh(new THREE.RingGeometry(.84, .98, 128), new THREE.MeshStandardMaterial({ color: 0x151515, metalness: .9, roughness: .4, map: tick, emissiveMap: tick, emissive: new THREE.Color(.6, .35, .2), emissiveIntensity: .35 }));
  ring.position.z = .12; inner.add(ring); U.ring = ring;
  for (const [r, z] of [[.9, .02], [.82, -.12], [.74, -.2]]) { const tr = new THREE.Mesh(new THREE.TorusGeometry(r, .018, 12, 128), graphite(0x2a2a2c, .25)); tr.position.z = z; inner.add(tr); }
  const coat = (col, k) => new THREE.MeshStandardMaterial({ color: new THREE.Color(...col), metalness: 1, roughness: .12, envMapIntensity: k, ...ADD });
  const cap = (R, rr, z, mat) => { const th = Math.asin(rr / R); const g = new THREE.SphereGeometry(R, 96, 24, 0, Math.PI * 2, 0, th); g.rotateX(Math.PI / 2); g.translate(0, 0, z - R); return new THREE.Mesh(g, mat); };
  inner.add(cap(2.4, .94, .1, coat([1, .62, .32], .2)), cap(1.6, .8, -.08, coat([1, .78, .45], .14)));
  const iris = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.ShaderMaterial({ uniforms: { uR: { value: .5 }, uRot: { value: 0 }, uLA: { value: 2.2 }, uA: { value: 1 } }, vertexShader: VS,
    fragmentShader: `uniform float uR,uRot,uLA,uA; varying vec2 vUv; const float S=6.2831853/9.;
      void main(){ vec2 p=(vUv-.5)*2.2; float r=length(p); if(r>1.0) discard;
        float a=atan(p.y,p.x)-uRot; float k=floor(a/S+.5); float d=cos(k*S-a)*r; if(d<uR) discard;
        float bi=mod(k+9.,9.); float shade=.03+.03*fract(sin(bi*12.9898)*43758.5);
        float spec=pow(max(0.,cos(a+uRot-uLA)),5.)*.3*smoothstep(uR,uR+.4,d);
        float a2=(k+1.)*S+uRot; vec2 n2=vec2(cos(a2),sin(a2)); float l2=abs(dot(p,n2)-uR);
        float line=smoothstep(.012,0.,l2)*smoothstep(uR,uR+.05,d);
        float edge=smoothstep(.025,0.,d-uR);
        vec3 c=vec3(shade)+vec3(1.,.55,.28)*spec+vec3(.6,.42,.3)*line*.4+vec3(1.,.62,.34)*edge*.55;
        gl_FragColor=vec4(c*uA,1.); }` }));
  iris.position.z = -.3; inner.add(iris); U.iris = iris;
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: 0x000000 })); pupil.position.z = -.7; inner.add(pupil);
  const deep = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a50, ...ADD, opacity: 0 })); deep.position.z = -.65; deep.scale.setScalar(.5); inner.add(deep); U.deep = deep;
  // cover glass: reflections + a moving orange light band
  // cover glass: an unlit fresnel sheen (a lit metal layer here caught the key light and washed the whole lens out)
  const cover = new THREE.Mesh(new THREE.CircleGeometry(1.03, 128), new THREE.ShaderMaterial({ ...ADD, vertexShader: VS, fragmentShader: `varying vec2 vUv; void main(){ float r=length(vUv-.5)*2.; gl_FragColor=vec4(vec3(1.,.62,.36)*pow(r,6.)*.08,1.); }` })); cover.position.z = .4; s.add(cover);
  const band = new THREE.Mesh(new THREE.CircleGeometry(1.03, 128), new THREE.ShaderMaterial({ ...ADD, uniforms: { uS: { value: -2 }, uA: { value: 0 } }, vertexShader: VS,
    fragmentShader: `uniform float uS,uA; varying vec2 vUv; void main(){ vec2 p=(vUv-.5)*2.; float r=length(p);
      float d=dot(p,normalize(vec2(.82,.57)))-uS; float b=exp(-d*d/.01)+.3*exp(-d*d/.12); float rim=smoothstep(.84,.97,r)*smoothstep(1.,.97,r);
      vec3 c=vec3(1.,.52,.22)*b*.75+vec3(1.,.85,.7)*exp(-d*d/.0012)*.9+vec3(1.,.6,.35)*rim*(.12+.5*b);
      gl_FragColor=vec4(c*uA,1.); }` }));
  band.position.z = .405; s.add(band); U.band = band;
  const fl = streak(9, .5); fl.position.set(0, 0, .6); s.add(fl); U.fl = fl;
  L.update = async t => {
    // camera: impact push (speed ramp) → creep while the iris works → accelerate into the pupil
    const a = eOutExpo(prog(t, 0, .4)), b = eInOutSine(prog(t, .35, .8)), c = eInCubic(prog(t, .78, T.throughEnd));
    const z = lerp(lerp(lerp(13.5, 8.8, a), 7.6, b), 1.35, c);
    const x = lerp(lerp(.6, .18, a), 0, b) * (1 - c), y = lerp(-.5, -.06, a) * (1 - b), roll = lerp(.16, 0, eOutCubic(prog(t, 0, .6)));
    L.look([x, y, z], [x * .3, y * .3, -.3], roll);
    // iris mechanics: half-open → snap closed (click) → servo open wide
    const rClose = eOutExpo(prog(t, T.irisClose, T.irisClose + .12)), rOpen = eInOutCubic(prog(t, T.irisOpen, T.irisOpen + .32));
    const rAp = lerp(lerp(.46, .2, rClose), .78, rOpen);
    U.iris.material.uniforms.uR.value = rAp; U.iris.material.uniforms.uRot.value = (.78 - rAp) * 1.6; L.irisR = rAp; L.irisRot = (.78 - rAp) * 1.6;
    U.iris.material.uniforms.uLA.value = 2.4 - t * 1.4;
    U.ring.rotation.z = -.5 * eInOutCubic(prog(t, T.irisOpen - .05, T.irisOpen + .4)) + .12 * rClose; U.inner.position.z = .05 * eInOutCubic(prog(t, T.irisOpen, T.irisOpen + .35));
    // the orange light: environment sweep + band across the cover glass + flare
    L.scene.environmentRotation.set(0, lerp(-1.4, 1.1, eInOutSine(prog(t, 0, 1.2))), 0);
    const bs = lerp(-1.6, 1.6, eInOutSine(prog(t, .02, .95))); U.band.material.uniforms.uS.value = bs; U.band.material.uniforms.uA.value = 1.2 * (1 - prog(t, 1.0, 1.25));
    U.fl.material.uniforms.uA.value = 1.3 * Math.exp(-bs * bs * 6) * (1 - prog(t, .9, 1.1)); U.fl.position.y = -bs * .3;
    U.deep.material.opacity = .6 * eInCubic(prog(t, .5, 1.0)); U.deep.scale.setScalar(.4 + .6 * prog(t, .5, 1.1));
    U.kl.intensity = 260 * (.55 + .45 * Math.sin(t * 2 + 1));
  };
}

// ================================================================== S1b — light-blade space, „SPREMI SE.“
const E = new Shot('blade', { bg: 0x020202, fog: new THREE.FogExp2(0x070302, .022) });
{
  const s = E.scene, U = E.u = {};
  s.environmentRotation.set(0, .9, 0);
  s.add(new THREE.AmbientLight(0x2a1a10, .4));
  const blade = new THREE.Mesh(new THREE.PlaneGeometry(10, 70), new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 }, uW: { value: 1 } }, vertexShader: VS,
    fragmentShader: `uniform float uA,uW; varying vec2 vUv; void main(){ float x=(vUv.x-.5)*10.; float core=exp(-x*x/(.012*uW*uW)); float halo=exp(-x*x/(.9*uW))*.32+exp(-x*x/(9.*uW))*.07;
      float v=smoothstep(0.,.35,vUv.y)*smoothstep(1.,.65,vUv.y); vec3 c=vec3(1.,.84,.68)*core*3.2+vec3(1.,.45,.16)*halo*1.6; gl_FragColor=vec4(c*v*uA,1.); }` }));
  blade.position.set(0, 2, -46); s.add(blade); U.blade = blade;
  const floorRef = new THREE.Mesh(new THREE.PlaneGeometry(6, 90), new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 } }, vertexShader: VS,
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float x=(vUv.x-.5)*6.; float k=exp(-x*x*3.)*.5+exp(-x*x*.25)*.12; float z=vUv.y; gl_FragColor=vec4(vec3(1.,.5,.2)*k*pow(z,1.6)*uA,1.); }` }));
  floorRef.rotation.x = -Math.PI / 2; floorRef.position.set(0, -2.99, -1); s.add(floorRef); U.floorRef = floorRef;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 120), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: .8, roughness: .3, envMapIntensity: .6 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -3, -20); s.add(floor);
  // monolith pillars with thin orange light lines receding towards the blade
  const pm = graphite(0x101012, .32), stripM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.15, .36) });
  for (let i = 0; i < 9; i++) for (const sd of [-1, 1]) {
    const x = sd * (3.3 + hash(i * 2 + (sd > 0 ? 1 : 0)) * .5), z = 10 - i * 6.5;
    const p = new THREE.Mesh(new THREE.BoxGeometry(.8, 18, .8), pm); p.position.set(x, 6, z); s.add(p);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(.035, 18), stripM); st.position.set(x - sd * .41, 6, z + .2); st.rotation.y = -sd * Math.PI / 2; s.add(st);
  }
  U.dust = dustCloud(2200, 0, 1, -14, 9, 10, 56, 2.2, 21); s.add(U.dust);
  U.smoke = smokeBank(12, 0, -1.6, -30, 12, 14, 9, 5); s.add(U.smoke);
  const shock = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uR: { value: 0 }, uA: { value: 0 } }, vertexShader: VS,
    fragmentShader: `uniform float uR,uA; varying vec2 vUv; void main(){ float r=length(vUv-.5)*2.; float k=exp(-pow((r-uR)/.035,2.))+.25*exp(-pow((r-uR*.8)/.12,2.)); gl_FragColor=vec4(vec3(1.,.55,.24)*k*uA*smoothstep(1.,.85,r),1.); }` }));
  shock.position.set(0, 0, -.6); shock.scale.setScalar(4.2); s.add(shock); U.shock = shock;
  const fl = streak(16, .6); fl.position.set(0, .05, -.4); s.add(fl); U.fl = fl;
  E.build = () => {
    const g = text3d('SPREMI SE.', { size: .6, depth: .24, bevel: .026, tracking: .02, face: typeFace(.5), side: edgeOrange(1.2) });
    fitW(g, px2w(870, 10.4)); s.add(g); U.txt = g; E.texts.push(g);
  };
  E.update = async t => {
    const arr = eOutExpo(prog(t, T.through, T.spremi + .05)), push = eInOutSine(prog(t, T.spremi, T.s1out + .3));
    const z = lerp(lerp(34, 10.4, arr), 9.6, push), sh = .05 * hit(t, T.spremi, .22);
    E.look([0, lerp(.9, .05, arr), z], [0, .02, -6], lerp(-.05, 0, arr), sh, t);
    const out = prog(t, T.s1out, T.s2a);
    U.blade.material.uniforms.uA.value = (.2 + .6 * eOutCubic(prog(t, T.through, T.through + .5)) + .5 * hit(t, T.spremi, .3)) * (1 + 3 * eInCubic(out));
    U.blade.material.uniforms.uW.value = .8 + .4 * hit(t, T.spremi, .25) + 10 * eInCubic(out);
    U.floorRef.material.uniforms.uA.value = U.blade.material.uniforms.uA.value * .5;
    U.dust.material.uniforms.uA.value = .9 * eOutCubic(prog(t, T.through, T.through + .4)) + .8 * hit(t, T.spremi, .5); U.dust.material.uniforms.uT.value = t * 3;
    U.smoke.userData.update(t, 1);
    // letters slam in from behind the camera, hard stop with recoil
    U.txt.userData.chars.forEach((m, i) => {
      const land = T.spremi - .015 + i * .011, a = prog(t, land - .3, land), h = m.userData.home;
      const rec = t > land ? (1 - settle(t - land, 2.6, 9)) : 0;
      m.position.set(h.x * (1 + .5 * (1 - eInQuad(a))), h.y + (1 - eInQuad(a)) * (i % 2 ? .25 : -.2), h.z + (1 - eInQuad(a)) * 16 - rec * .5);
      m.rotation.set(0, (1 - a) * .3 * (i - 4.5) / 4.5, 0); m.visible = t > land - .3;
    });
    U.txt.userData.side.emissiveIntensity = .9 + 1.6 * hit(t, T.spremi, .35);
    U.shock.material.uniforms.uR.value = eOutCubic(prog(t, T.spremi, T.spremi + .7)); U.shock.material.uniforms.uA.value = .16 * hit(t, T.spremi, .28) * (t > T.spremi ? 1 : 0);
    U.fl.material.uniforms.uA.value = .9 * hit(t, T.spremi, .2);
  };
}

// ================================================================== S2 — four real phone shots
const P1 = new Shot('sideframe', { bg: 0x000000 }), P2 = new Shot('plateau', { bg: 0x000000 }), P3 = new Shot('display', { bg: 0x030303 }), P4 = new Shot('trio', { bg: 0x020202 });
const CS = new Seq('assets/cs', 100), PL = new Seq('assets/pl', 360);
{ // 2a: real titanium side frame (Ceramic Shield 2 film), rotated upright, macro pan with a light travelling along the metal
  const U = P1.u = {};
  const m = plateMat({ rot: true }); m.uniforms.uWarm.value = .62; m.uniforms.uGain.value = .64; m.uniforms.uFeather.value = .02; m.uniforms.uSweepDir.value.set(0, 1); m.uniforms.uSweepW.value = .002;
  m.uniforms.uBlur.value = 2.2; m.uniforms.uFocusW.value = .16;
  const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 16), m); P1.scene.add(p); U.m = m;
  U.bk = bokeh(18, 0, 0, 5, 7, 12, 4, 170, 3); P1.scene.add(U.bk);
  const fl = streak(7, .35); fl.position.z = .5; P1.scene.add(fl); U.fl = fl;
  P1.update = async t => {
    const u = eInOutSine(prog(t, T.s1out, T.s2b + .1));
    P1.look([lerp(-.25, .2, u), lerp(-.2, 3.4, u), lerp(9.2, 7.9, u)], [lerp(-.1, .05, u), lerp(-.2, 3.6, u), 0], lerp(-.05, .03, u));
    await CS.at(.25 + (t - T.s1out) * .9, m);
    const yv = lerp(-.2, 3.6, u) / 16 + .5; m.uniforms.uFocus.value = yv;
    const sw = prog(t, T.s2a - .1, T.s2b - .1); m.uniforms.uSweep.value = lerp(-.45, .25, sw); m.uniforms.uSweepA.value = 2.2 * Math.sin(Math.PI * sw);
    U.fl.position.y = (m.uniforms.uSweep.value) * 16; U.fl.material.uniforms.uA.value = .8 * Math.sin(Math.PI * sw) * Math.exp(-Math.pow((U.fl.position.y - lerp(-.2, 3.6, u)) / 1.5, 2));
    U.bk.material.uniforms.uA.value = 1; U.bk.material.uniforms.uT.value = t;
  };
}
{ // 2b: Cosmic Orange camera plateau (still 3840×2160), tracking across the lenses with a rack focus
  const U = P2.u = {};
  const m = plateMat(); m.uniforms.uWarm.value = .05; m.uniforms.uGain.value = .86; m.uniforms.uFeather.value = .03; m.uniforms.uSweepDir.value.set(.9, .45); m.uniforms.uSweepW.value = .004;
  U.m = m; P2.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(16, 9), m));
  U.bk = bokeh(14, 0, 2, 4.5, 6, 9, 3, 170, 9); P2.scene.add(U.bk);
  const fl = streak(8, .3); fl.position.z = .3; P2.scene.add(fl); U.fl = fl;
  P2.update = async t => {
    const u = eInOutSine(prog(t, T.s2b - .15, T.s2c + .15));
    const x = lerp(2.2, -2.6, u), y = lerp(1.3, 1.6, u);
    P2.look([x, y - .2, lerp(10.4, 9.4, u)], [x - .3, y, 0], lerp(.06, -.04, u));
    const rack = 1 - eOutCubic(prog(t, T.s2b - .05, T.s2b + .4)); m.uniforms.uBlurAll.value = 4.5 * rack; m.uniforms.uBlur.value = 1.6; m.uniforms.uFocus.value = .78; m.uniforms.uFocusW.value = .32;
    const sw = prog(t, T.s2b + .15, T.s2c - .1); m.uniforms.uSweep.value = lerp(-.45, .5, sw); m.uniforms.uSweepA.value = .8 * Math.sin(Math.PI * sw);
    U.fl.position.set(x - .3, y + .1, .3); U.fl.material.uniforms.uA.value = .9 * Math.exp(-Math.pow((sw - .55) / .12, 2));
    U.bk.material.uniforms.uA.value = 1; U.bk.material.uniforms.uT.value = t;
  };
}
{ // 2c: Galaxy S26 Ultra front display in a dark reflective studio
  const U = P3.u = {}, s = P3.scene;
  const wall = glowPlane(7, 7, [1, .4, .14], 9); wall.position.set(1.3, 2.3, -4); s.add(wall); U.wall = wall;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(12, .012), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, .9, .3) })); line.position.set(0, 0.002, -3.2); s.add(line); U.line = line;
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), new THREE.ShaderMaterial({ ...ADD, uniforms: { uA: { value: 0 } }, vertexShader: VS,
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ vec2 q=(vUv-vec2(.62,1.))*vec2(1.,1.6); gl_FragColor=vec4(vec3(1.,.45,.17)*exp(-dot(q,q)*3.)*.18*uA,1.); }` }));
  sheen.rotation.x = -Math.PI / 2; sheen.position.set(0, .001, -1); s.add(sheen); U.sheen = sheen;
  P3.build = (tex, im) => {
    const h = 2.6, w = h * im.width / im.height;
    const mk = refl => { const m = plateMat({ alpha: true }); m.uniforms.map.value = tex; m.uniforms.uWarm.value = .1; m.uniforms.uGain.value = 1.15; m.uniforms.uFeather.value = .0001;
      m.uniforms.uScreen.value.set(.1, .05, .93, .97); m.uniforms.uSweepDir.value.set(.75, .66); m.uniforms.uSweepW.value = .006;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(0, refl ? -h / 2 - .004 : h / 2 + .004, 0); if (refl) { p.scale.y = -1; m.uniforms.uA.value = .28; } s.add(p); return p; };
    U.ph = mk(false); U.rf = mk(true);
    const fade = new THREE.Mesh(new THREE.PlaneGeometry(14, 3), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: {}, vertexShader: VS,
      fragmentShader: `varying vec2 vUv; void main(){ gl_FragColor=vec4(vec3(.012),smoothstep(.95,.25,vUv.y)); }` }));
    fade.rotation.x = -Math.PI / 2; fade.position.set(0, .003, .6); s.add(fade);    // glossy floor: the reflection fades with distance
    U.bk = bokeh(16, 0, 1.4, 3, 6, 5, 2.5, 200, 17); s.add(U.bk);
  };
  P3.update = async t => {
    const u = eInOutSine(prog(t, T.s2c - .2, T.s2d + .1)), ang = lerp(.32, -.12, u), r = lerp(6.6, 5.7, u);
    P3.look([Math.sin(ang) * r, lerp(.55, .9, u), Math.cos(ang) * r], [0, 1.02, 0]);
    for (const p of [U.ph, U.rf]) { const m = p.material.uniforms; const sw = prog(t, T.s2c, T.s2d - .05); m.uSweep.value = lerp(-.7, .7, eInOutSine(sw)); m.uSweepA.value = .85 * Math.sin(Math.PI * sw); }
    U.wall.material.uniforms.uA.value = .4; U.sheen.material.uniforms.uA.value = .8; U.bk.material.uniforms.uA.value = .6; U.bk.material.uniforms.uT.value = t;
  };
}
{ // 2d: three phones in depth — iPhone 17 Pro pair (back + front) and a Galaxy S26 Ultra in the foreground
  const U = P4.u = {}, s = P4.scene;
  const back = glowPlane(8, 8, [1, .42, .15], 9); back.position.set(.6, 1.5, -5); s.add(back); U.back = back;
  U.beams = [beam(14, .05, 1.6), beam(14, .05, 1.2)]; U.beams[0].position.set(-1.5, 8, -2); U.beams[0].rotation.z = -.22; U.beams[1].position.set(2.4, 8, -3); U.beams[1].rotation.z = .25; U.beams.forEach(b => s.add(b));
  U.dust = dustCloud(900, 0, 1, -1, 8, 8, 8, 2, 33); s.add(U.dust);
  P4.build = (pairT, pairI, s26T, s26I) => {
    const card = (tex, im, h, warm, scrR) => { const m = plateMat({ alpha: true }); m.uniforms.map.value = tex; m.uniforms.uWarm.value = warm; m.uniforms.uGain.value = 1.15; m.uniforms.uFeather.value = .0001;
      if (scrR) m.uniforms.uScreen.value.set(...scrR); m.uniforms.uSweepDir.value.set(.8, .6); m.uniforms.uSweepW.value = .005;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(h * im.width / im.height, h), m); s.add(p); return p; };
    U.pair = card(pairT, pairI, 2.75, .02); U.pair.position.set(.45, 1.15, -.8);
    U.s26 = card(s26T, s26I, 2.5, .12); U.s26.position.set(-.72, .55, 1.0); U.s26.rotation.y = .32; U.s26.material.uniforms.uBlurAll.value = .6;
  };
  P4.update = async t => {
    const u = eInOutSine(prog(t, T.s2d - .2, T.s3 + .2)), ang = lerp(-.3, .14, u);
    P4.look([Math.sin(ang) * 8.4 + .3, lerp(1.6, 1.15, u), Math.cos(ang) * 8.4], [.25, .95, 0], lerp(.03, -.02, u));
    for (const [p, d] of [[U.pair, 0], [U.s26, .12]]) { const m = p.material.uniforms, sw = prog(t, T.s2d - .05 + d, T.s3 - .1 + d); m.uSweep.value = lerp(-.7, .7, sw); m.uSweepA.value = .8 * Math.sin(Math.PI * sw); }
    U.pair.position.y = 1.15 + Math.sin(t * 1.3) * .02; U.s26.position.y = .55 + Math.sin(t * 1.1 + 1) * .03;
    U.back.material.uniforms.uA.value = .35; U.beams.forEach((b, i) => { b.material.uniforms.uA.value = .32; b.material.uniforms.uT.value = t + i; });
    U.dust.material.uniforms.uA.value = .7; U.dust.material.uniforms.uT.value = t;
  };
}

// ================================================================== S3 — metal architecture corridor + CG phone near-miss
const C = new Shot('corridor', { bg: 0x030202, env: ENV_STUDIO, fog: new THREE.FogExp2(0x060302, .028) });
{
  const s = C.scene, U = C.u = {};
  s.add(new THREE.AmbientLight(0x1c140e, .35));
  U.l1 = new THREE.PointLight(0xff7a3a, 14, 9, 1.4); U.l2 = new THREE.PointLight(0xff6a2a, 30, 20, 1.5); s.add(U.l1, U.l2);
  const N = 76, fins = new THREE.InstancedMesh(new THREE.BoxGeometry(.09, 9, 1.05), graphite(0x141416, .3), N * 2), M = new THREE.Matrix4();
  for (let i = 0; i < N; i++) for (const [j, sd] of [[0, -1], [1, 1]]) { M.makeTranslation(sd * 3.1, 2.4, 6 - i * 1.9); fins.setMatrixAt(i * 2 + j, M); }
  s.add(fins);
  const beamsI = new THREE.InstancedMesh(new THREE.BoxGeometry(6.4, .22, .4), graphite(0x101012, .3), 30);
  for (let i = 0; i < 30; i++) { M.makeTranslation(0, 5.2, 6 - i * 5.1); beamsI.setMatrixAt(i, M); } s.add(beamsI);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(.2, 9), graphite(0x0c0c0d, .4));
  const wallL = new THREE.Mesh(new THREE.PlaneGeometry(160, 9), graphite(0x09090a, .45)); wallL.rotation.y = Math.PI / 2; wallL.position.set(-3.5, 2.4, -70); s.add(wallL);
  const wallR = wallL.clone(); wallR.rotation.y = -Math.PI / 2; wallR.position.x = 3.5; s.add(wallR);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 170), new THREE.MeshStandardMaterial({ color: 0x080808, metalness: .85, roughness: .26, envMapIntensity: .7 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.4, -70); s.add(floor);
  const stripMat = new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uT: { value: 0 }, uA: { value: 1 }, uK: { value: 0 } }, vertexShader: `varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uT,uA,uK; varying vec3 vW; void main(){ float z=vW.z; float ph=fract((z*.11+uT)); float p=exp(-pow((ph-.5)/.025,2.))*(1.4+uK*2.);
      float base=.22+.25*uK; float fog=exp(-abs(z-cameraPosition.z)*.025); gl_FragColor=vec4(vec3(1.,.45,.16)*(base+p*3.)*fog*uA,1.); }` });
  for (const x of [-1.5, 1.5]) { const st = new THREE.Mesh(new THREE.PlaneGeometry(.05, 170), stripMat); st.rotation.x = -Math.PI / 2; st.position.set(x, -1.395, -70); s.add(st); }
  for (const [x, y] of [[-3.0, 3.4], [3.0, 3.4], [-3.0, -.9], [3.0, -.9]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, 170), stripMat); r.position.set(x, y, -70); s.add(r); }   // wall light rails
  U.strip = stripMat;
  U.gates = [];
  for (let i = 0; i < 16; i++) { const g = new THREE.Group(), gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
    for (const [w, h, x, y] of [[5.2, .04, 0, 4.6], [.04, 6, -2.6, 1.6], [.04, 6, 2.6, 1.6]]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), gm); b.position.set(x, y, 0); g.add(b); }
    g.position.z = -4 - i * 7.5; g.userData.m = gm; s.add(g); U.gates.push(g); }
  const endW = glowPlane(40, 40, [1, .5, .2], 12); endW.position.set(0, 1.5, -150); s.add(endW); U.endW = endW;
  U.dust = dustCloud(2600, 0, 1.2, -60, 6, 7, 140, 2.2, 41); s.add(U.dust);
  // speed lines (sparks) flowing past
  const SN = 260, sg = new THREE.BufferGeometry(), sp = new Float32Array(SN * 6), sc = new Float32Array(SN * 6);
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const lines = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, fog: false })); lines.frustumCulled = false; s.add(lines); U.lines = { sg, sp, sc, SN };
  // CG phone: titanium frame, graphite glass back, camera plateau with three lenses, warm screen
  const ph = new THREE.Group(); s.add(ph); U.ph = ph;
  const w = .78, h = 1.64, r = .13, d = .07, sh = new THREE.Shape();
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const bg = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: .014, bevelSize: .014, bevelSegments: 6, curveSegments: 32 }); bg.translate(0, 0, -d / 2);
  const glass = new THREE.MeshStandardMaterial({ color: 0x0c0b0b, metalness: .3, roughness: .1, envMapIntensity: 1.3 });
  const ti = new THREE.MeshStandardMaterial({ color: 0xb9b0a8, metalness: 1, roughness: .17, envMapIntensity: 1.7 });
  ph.add(new THREE.Mesh(bg, [glass, ti]));
  const scrM = new THREE.ShaderMaterial({ uniforms: { uA: { value: 1 } }, vertexShader: VS,
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ vec2 q=vUv-vec2(.5,.12); float g=exp(-dot(q*vec2(1.,.7),q*vec2(1.,.7))*6.);
      float wave=smoothstep(.012,0.,abs(vUv.y-.36-.07*sin(vUv.x*6.)))*.7+smoothstep(.008,0.,abs(vUv.y-.27-.05*sin(vUv.x*5.+1.)))*.45;
      vec3 c=vec3(1.,.4,.13)*g*.12+vec3(1.,.55,.26)*wave*.3*(.3+g)+vec3(.008); float isl=step(abs(vUv.x-.5),.12)*step(abs(vUv.y-.955),.012); c*=1.-isl; gl_FragColor=vec4(c*uA,1.); }` });
  const scrG = new THREE.ShapeGeometry(sh, 24); scrG.scale(.94, .965, 1); const uvA = scrG.attributes.uv, posA = scrG.attributes.position;
  for (let i = 0; i < uvA.count; i++) uvA.setXY(i, posA.getX(i) / (w * .94) + .5, posA.getY(i) / (h * .965) + .5);
  const scrMesh = new THREE.Mesh(scrG, scrM); scrMesh.position.z = d / 2 + .015; ph.add(scrMesh);
  const scrGlass = new THREE.Mesh(scrG, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .05, envMapIntensity: .55, ...ADD })); scrGlass.position.z = d / 2 + .017; ph.add(scrGlass);   // cover glass: live reflections as it turns
  const pl = new THREE.Mesh(new RoundedBoxGeometry(.36, .4, .03, 4, .07), new THREE.MeshStandardMaterial({ color: 0x1a1918, metalness: .5, roughness: .22, envMapIntensity: 1.2 })); pl.position.set(-.17, .52, -d / 2 - .02); ph.add(pl);
  const ringM = new THREE.MeshStandardMaterial({ color: 0xc8b8a8, metalness: 1, roughness: .15, envMapIntensity: 1.6 }), lensM = new THREE.MeshStandardMaterial({ color: 0x020202, metalness: .2, roughness: .03, envMapIntensity: 1.4 });
  for (const [x, y] of [[-.25, .62], [-.25, .43], [-.09, .525]]) { const rg = new THREE.Mesh(new THREE.CylinderGeometry(.068, .072, .03, 48), ringM); rg.rotation.x = Math.PI / 2; rg.position.set(x, y, -d / 2 - .05); ph.add(rg);
    const ln = new THREE.Mesh(new THREE.CircleGeometry(.052, 48), lensM); ln.position.set(x, y, -d / 2 - .066); ln.rotation.y = Math.PI; ph.add(ln); }
  for (const [y, hh] of [[.28, .16], [.08, .16]]) { const b = new THREE.Mesh(new RoundedBoxGeometry(.012, hh, .03, 2, .005), ti); b.position.set(-w / 2 - .016, y, 0); ph.add(b); }
  const pb = new THREE.Mesh(new RoundedBoxGeometry(.012, .22, .03, 2, .005), ti); pb.position.set(w / 2 + .016, .18, 0); ph.add(pb);
  U.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb080, ...ADD, opacity: 0, fog: false })); s.add(U.glint);
  // camera z along the corridor: fast → slow-motion near-miss → accelerating rush into the light
  const zAt = t => {
    const v = tt => tt < 7.6 ? lerp(13, 9, prog(tt, 7.0, 7.6)) : tt < 8.2 ? lerp(9, 2.2, eInOutSine(prog(tt, 7.6, 8.2))) : tt < 8.66 ? 2.2 : tt < 9.0 ? lerp(2.2, 9, eInOutSine(prog(tt, 8.66, 9.0))) : lerp(9, 46, eInCubic(prog(tt, 9.0, 11.1)));
    let z = 4, x = 6.85; const dt = 1 / 120; for (; x < t; x += dt) z -= v(x) * dt; return z;   // integrate speed (deterministic)
  };
  C.zAt = zAt;
  C.update = async t => {
    const z = zAt(t), sway = noise1(t * .8) * .06;
    const near = Math.exp(-Math.pow((t - T.flyby) / .55, 2));
    C.look([sway - near * .1, .36, z], [near * .55 + sway * .3, .32, z - 8], lerp(0, .06, near) + Math.sin(t * .6) * .015, .012 * prog(t, 9.6, 10.7), t);
    U.l2.position.set(0, 3.6, z - 12); U.l2.intensity = 30 + 40 * prog(t, 9.4, 10.7);
    const tension = eInCubic(prog(t, T.build, T.s3out + .3));
    U.strip.uniforms.uT.value = -(t - 7) * (1.2 + 3 * tension) - tension * 2; U.strip.uniforms.uK.value = tension;
    U.gates.forEach((g, i) => { const dz = g.position.z - z, k = .2 + Math.exp(-Math.pow((dz + 7) / 6, 2)) * .45 + Math.exp(-Math.pow(dz / 2.5, 2)) * 1.1 + tension * .55; g.userData.m.color.setRGB(3.2 * k, 1.1 * k, .34 * k); });
    U.endW.material.uniforms.uA.value = .18 + 1.6 * tension; U.dust.material.uniforms.uA.value = .9; U.dust.material.uniforms.uT.value = t;
    // the phone floats in the corridor, screen towards us; the camera skims past its titanium edge
    const pz = zAt(T.flyby + .05), turn = eInOutSine(prog(t, 7.1, 8.6));
    U.ph.position.set(lerp(.55, .13, eOutCubic(prog(t, 7.0, 8.3))), .36 + Math.sin(t * 1.6) * .025, pz);
    U.ph.rotation.set(.05 - .04 * turn, lerp(-.3, -1.45, turn), lerp(.06, -.04, turn));
    U.l1.position.copy(U.ph.position).add(new THREE.Vector3(-1.1, .9, 1.4)); U.l1.intensity = 14 * (1 - prog(t, 8.8, 9.3));
    U.glint.position.copy(U.ph.position).add(new THREE.Vector3(.02, .7, .4)); U.glint.material.opacity = .8 * Math.exp(-Math.pow((t - (T.flyby - .18)) / .12, 2)); U.glint.scale.setScalar(.6);
    // speed lines
    const { sg, sp, sc, SN } = U.lines, spd = 8 + 30 * eInCubic(prog(t, 9.0, 11));
    for (let i = 0; i < SN; i++) { const zz = z - 2 - ((hash(i) * 40 + t * spd * (.6 + hash(i + 7) * .5)) % 40), xx = (hash(i + 3) - .5) * 5.5, yy = -1.2 + hash(i + 5) * 5.5, len = .05 + spd * .012;
      sp.set([xx, yy, zz, xx, yy, zz - len], i * 6); const b = .5 * (.3 + hash(i + 9)) * (.4 + tension); sc.set([b, b * .45, b * .16, 0, 0, 0], i * 6); }
    sg.attributes.position.needsUpdate = true; sg.attributes.color.needsUpdate = true;
  };
}

// ================================================================== S4 — fragments assemble into BLACK FRIDAY
const F = new Shot('assemble', { bg: 0x020101, env: ENV_HOT, fog: new THREE.FogExp2(0x050201, .02) });
{
  const s = F.scene, U = F.u = {};
  s.add(new THREE.AmbientLight(0x1a1009, .35));
  U.core = new THREE.PointLight(0xff7030, 0, 30, 1.4); U.core.position.set(0, .8, 6); s.add(U.core);
  const glow = glowPlane(9, 6.5, [1, .42, .15], 9); glow.position.set(0, 0, -4); s.add(glow); U.glow = glow;
  const rays = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 }, uT: { value: 0 } }, vertexShader: VS,
    fragmentShader: `uniform float uA,uT; varying vec2 vUv; void main(){ vec2 q=vUv-.5; float a=atan(q.y,q.x), r=length(q);
      float k=pow(.5+.5*sin(a*23.+sin(a*7.+uT*.4)*2.),6.)*.6+pow(.5+.5*sin(a*61.-uT*.3),12.)*.4; k*=exp(-r*7.)*smoothstep(.0,.05,r)*smoothstep(.5,.3,r);
      gl_FragColor=vec4(vec3(1.,.48,.18)*k*uA,1.); }` }));
  rays.position.set(0, 0, -3.6); s.add(rays); U.rays = rays;
  U.dust = dustCloud(1800, 0, 0, 0, 16, 14, 14, 2.0, 51); s.add(U.dust);
  U.smoke = smokeBank(10, 0, -3, -2, 12, 4, 6, 15); s.add(U.smoke);
  // sparks at the lock
  const SPN = 800, sg = new THREE.BufferGeometry(), sp = new Float32Array(SPN * 6), sc = new Float32Array(SPN * 6);
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const sparks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, fog: false })); sparks.frustumCulled = false; s.add(sparks); U.sp = { sg, sp, sc, SPN, sparks };
  F.build = () => {
    const hotFace = new THREE.MeshStandardMaterial({ color: 0xa8471a, metalness: 1, roughness: .26, envMapIntensity: 1.25, emissive: ORHOT.clone(), emissiveIntensity: .42 });
    const hotEdge = new THREE.MeshStandardMaterial({ color: 0x3a1a0a, metalness: .8, roughness: .3, emissive: new THREE.Color(1, .62, .34), emissiveIntensity: 0, envMapIntensity: 1 });
    const bl = text3d('BLACK', { size: 1, depth: .42, bevel: .04, face: hotFace, side: hotEdge }), fr = text3d('FRIDAY', { size: 1, depth: .42, bevel: .04, face: hotFace, side: hotEdge });
    const fit = px2w(860, 9.2) / Math.max(bl.userData.width, fr.userData.width), capH = .72 * fit;
    for (const [g, y] of [[bl, capH * .66], [fr, -capH * .66]]) { g.scale.setScalar(fit); g.position.set(0, y, 0); s.add(g); g.updateMatrixWorld(true); }
    U.bl = bl; U.fr = fr; F.texts.push(bl, fr); F.gapY = 0; F.gapH = capH * .32 * .5;
    // targets: area-weighted samples on the letter faces (exact glyph shapes)
    const tris = [];
    for (const g of [bl, fr]) for (const m of g.userData.chars) {
      const geo = new THREE.ShapeGeometry(FONT.generateShapes(m.userData.ch, m.userData.size), 4); geo.translate(-m.userData.cx, -m.userData.cy, m.userData.zf);
      geo.applyMatrix4(m.matrixWorld); const p = geo.attributes.position, idx = geo.index;
      for (let i = 0; i < idx.count; i += 3) { const a = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i)), b = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i + 1)), c = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i + 2));
        const ar = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2; if (ar > 1e-6) tris.push({ a, b, c, ar }); }
    }
    const tot = tris.reduce((q, x) => q + x.ar, 0); let acc = 0; for (const x of tris) { acc += x.ar; x.cum = acc / tot; }
    const NF = 2200, fg = new THREE.ExtrudeGeometry((() => { const q = new THREE.Shape(); q.moveTo(-.5, -.42); q.lineTo(.55, -.5); q.lineTo(.42, .5); q.lineTo(-.48, .38); q.closePath(); return q; })(), { depth: .25, bevelEnabled: false }); fg.translate(0, 0, -.125);
    const fm = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .26, envMapIntensity: .8, emissive: ORHOT.clone(), emissiveIntensity: 0 });
    const inst = new THREE.InstancedMesh(fg, fm, NF); inst.frustumCulled = false; s.add(inst); U.inst = inst; U.fm = fm;
    const side = Math.sqrt(tot / NF) * 1.55, col = new THREE.Color();
    U.fr8 = [];
    for (let i = 0; i < NF; i++) {
      const u = hash(i * 3.7 + .1); let lo = 0, hi = tris.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (tris[mid].cum < u) lo = mid + 1; else hi = mid; }
      const tr = tris[lo]; let r1 = hash(i * 5.3 + .2), r2 = hash(i * 7.1 + .3); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
      const tgt = tr.a.clone().addScaledVector(new THREE.Vector3().subVectors(tr.b, tr.a), r1).addScaledVector(new THREE.Vector3().subVectors(tr.c, tr.a), r2);
      const th = hash(i * 1.3) * Math.PI * 2, rad = 2.2 + hash(i * 2.9) * 6.5;
      const start = new THREE.Vector3(Math.cos(th) * rad, Math.sin(th) * rad * 1.1, -6 + hash(i * 4.4) * 13);
      U.fr8.push({ tgt, start, ts: 10.75 + hash(i * 6.1) * .5, ta: 12.2 + Math.pow(hash(i * 8.3), .7) * .72, sw: (2.2 + hash(i * 9.7) * 2.5) * (hash(i * 3.3) > .5 ? 1 : -1),
        ax: new THREE.Vector3(hash(i + .5) - .5, hash(i + .7) - .5, hash(i + .9) - .5).normalize(), spin: 5 + hash(i * 11.1) * 9, sc: side * (.75 + hash(i * 12.7) * .6), rz: hash(i * 13.3) * 6.28 });
      const g = hash(i * 14.9); col.setRGB(...(g < .2 ? [.9, .45, .2] : g < .5 ? [.42, .42, .44] : [.2, .2, .21])); inst.setColorAt(i, col);
    }
    inst.instanceColor.needsUpdate = true;
  };
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q0 = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Zax = new THREE.Vector3(0, 0, 1);
  F.update = async t => {
    // camera: arrives in an arc, settles frontal for the lock, slow push, then dives into the gap between the lines
    const a = eInOutCubic(prog(t, T.s3out, T.lock - .1)), push = eInOutSine(prog(t, T.lock, T.s4out)), dive = eInCubic(prog(t, T.s4out, T.s5 + .05));
    const ang = lerp(.75, 0, a), rad = lerp(lerp(13.5, 9.2, a), 8.6, push), y = lerp(2.2, 0, a);
    const zc = lerp(Math.cos(ang) * rad, .25, dive), sh = .07 * hit(t, T.lock, .3);
    F.look([Math.sin(ang) * rad * (1 - dive), y * (1 - dive) + F.gapY * dive, zc], [0, lerp(.4, 0, a), -1], lerp(.1, 0, a), sh, t);
    const lockP = prog(t, T.lock - .02, T.lock + .1), fragOut = t > T.lock ? clamp((t - T.lock) / .12) : 0;
    // fragments
    U.fm.emissiveIntensity = .25 * eInCubic(prog(t, 12.6, T.lock)) * (1 - fragOut);
    U.inst.visible = fragOut < 1;
    if (U.inst.visible) U.fr8.forEach((f, i) => {
      const e = eInOutCubic(prog(t, f.ts, f.ta)), rel = new THREE.Vector3().subVectors(f.start, f.tgt).multiplyScalar(1 - e);
      rel.applyAxisAngle(Zax, f.sw * Math.pow(1 - e, 2));
      P.copy(f.tgt).add(rel); if (e < 1) P.z += Math.sin(e * Math.PI) * .6;
      Q.setFromAxisAngle(f.ax, f.spin * (1 - e) * (1 - e) + f.rz * (1 - e)); Q0.setFromAxisAngle(Zax, f.rz * .2); Q.slerp(Q0, eInCubic(e));
      const sc = f.sc * (1 - fragOut) * (1 + 4 * (1 - e) * (1 - e)); S.set(sc, sc, sc * .5);
      M.compose(P, Q, S); U.inst.setMatrixAt(i, M);
    });
    U.inst.instanceMatrix.needsUpdate = true;
    // the solid letters lock in (extrude out of the mosaic)
    for (const g of [U.bl, U.fr]) g.userData.chars.forEach(m => { const h = m.userData.home; m.visible = t >= T.lock - .02; m.scale.set(1, 1, Math.max(.02, eOutExpo(lockP))); m.position.set(h.x, h.y, h.z - (1 - eOutExpo(lockP)) * .2); });
    U.bl.userData.side.emissiveIntensity = t < T.lock ? 0 : .7 + 1.6 * hit(t, T.lock, .35) + .08 * Math.sin(t * 3);
    U.bl.userData.face.emissiveIntensity = .72 + .4 * hit(t, T.lock, .3);
    s.environmentRotation.set(0, lerp(-1.2, 1.0, eInOutSine(prog(t, T.lock - .3, T.s4out + .4))), 0);
    const build = eInCubic(prog(t, 11.6, T.lock));
    U.glow.material.uniforms.uA.value = .14 + .3 * build + .35 * hit(t, T.lock, .45) - (t > T.lock ? .32 : 0);
    U.rays.material.uniforms.uA.value = .05 + .15 * build + .35 * hit(t, T.lock, .5) - (t > T.lock ? .15 : 0); U.rays.material.uniforms.uT.value = t;
    U.core.intensity = (26 - 12 * build) * (1 - fragOut) * eOutCubic(prog(t, T.s3out, 11.4)) + 40 * hit(t, T.lock, .25);
    U.dust.material.uniforms.uA.value = .6 + .8 * hit(t, T.lock, .6); U.dust.material.uniforms.uT.value = t * 1.4; U.smoke.userData.update(t, .35 + .4 * build);
    // sparks
    const { sg, sp, sc, SPN, sparks } = U.sp; sparks.visible = t >= T.lock;
    if (sparks.visible) { const tt = t - T.lock;
      for (let i = 0; i < SPN; i++) { const f = U.fr8[(i * 7) % U.fr8.length].tgt, a = hash(i) * Math.PI * 2, spd = 2 + hash(i + 1) * 9, life = .4 + hash(i + 2) * .9, k = tt / life;
        const vx = Math.cos(a) * spd, vy = Math.sin(a) * spd * .8 + 1.5, vz = 1 + hash(i + 5) * 6, dr = (1 - Math.exp(-tt * 1.6)) / 1.6;
        const x = f.x + vx * dr, y = f.y + vy * dr - 3.5 * tt * tt, z = f.z + vz * dr, tl = .035 * Math.exp(-tt * 1.6);
        sp.set([x, y, z, x - vx * tl, y - (vy - 7 * tt) * tl, z - vz * tl], i * 6); const br = k < 1 ? (1 - k) ** 1.5 * 2.4 : 0, cl = clamp(k * 1.4);
        sc.set([br, br * lerp(.78, .32, cl), br * lerp(.5, .08, cl), br * .2, br * .08, br * .03], i * 6); }
      sg.attributes.position.needsUpdate = true; sg.attributes.color.needsUpdate = true; }
  };
}

// ================================================================== S5 — mirror-floor showcase, ZONA TELEFONA
const Z = new Shot('showcase', { bg: 0x020202, env: ENV_HOT, fog: new THREE.FogExp2(0x040201, .03) });
{
  const s = Z.scene, U = Z.u = {};
  s.add(new THREE.AmbientLight(0x1a120c, .3));
  U.key = new THREE.SpotLight(0xff9a60, 0, 40, .4, .8, 1.2); U.key.position.set(0, 9, 6); U.key.target.position.set(0, 1, 0); s.add(U.key, U.key.target);
  // back wall of vertical light slats (continues under the mirror floor)
  U.slats = [];
  for (let i = 0; i < 17; i++) { const x = (i - 8) * .78, m = new THREE.Mesh(new THREE.PlaneGeometry(.045, 22), new THREE.ShaderMaterial({ ...ADD, uniforms: { uA: { value: 0 }, uP: { value: 0 } }, vertexShader: VS,
      fragmentShader: `uniform float uA,uP; varying vec2 vUv; void main(){ float y=vUv.y; float k=smoothstep(.0,.5,y)*smoothstep(1.,.62,y); float x=1.-abs(vUv.x-.5)*2.; float run=exp(-pow((y-uP)/.04,2.));
        gl_FragColor=vec4(vec3(1.,.45,.16)*(k*.5+run*1.5)*x*uA,1.); }` }));
    m.position.set(x, 0, -6 - Math.abs(i - 8) * .25); s.add(m); U.slats.push(m); }
  const wallGlow = glowPlane(10, 7, [1, .42, .15], 10); wallGlow.position.set(0, 2.2, -6.5); s.add(wallGlow); U.wallGlow = wallGlow;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x020202, metalness: .6, roughness: .3, envMapIntensity: .06, transparent: true, opacity: .74 }));
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = 2; s.add(floor);
  U.dust = dustCloud(1400, 0, 2.5, -1, 14, 6, 12, 1.8, 61); s.add(U.dust);
  Z.build = () => {
    const mk = (refl) => {
      const face = typeFace(refl ? .2 : .42), side = edgeOrange(0), clip = [new THREE.Plane(new THREE.Vector3(0, refl ? -1 : 1, 0), 0)]; face.clippingPlanes = side.clippingPlanes = clip;
      const z = text3d('ZONA', { size: 1, depth: .3, bevel: .03, face, side }), tl = text3d('TELEFONA', { size: .3, depth: .12, bevel: .014, tracking: .38, face, side });
      const fz = px2w(720, 10.2) / z.userData.width; z.scale.setScalar(fz); tl.scale.setScalar(px2w(720, 10.2) / tl.userData.width);
      const zc = .72 * fz, tc = .72 * .3 * tl.scale.x, base = .18;
      tl.position.set(0, base + tc / 2, 0); z.position.set(0, base + tc + tc * 1.05 + zc / 2, 0);
      const g = new THREE.Group(); g.add(z, tl); if (refl) g.scale.y = -1; s.add(g); g.userData = { z, tl, face, side, h: base + tc * 2.05 + zc }; return g;
    };
    U.logo = mk(false); U.refl = mk(true); Z.texts.push(U.logo.userData.z, U.logo.userData.tl); Z.yc = U.logo.userData.h / 2 + .05;
  };
  Z.update = async t => {
    const a = eInOutCubic(prog(t, T.s5 - .4, T.s5 + 2.3)), push = eInOutSine(prog(t, T.s5 + 2.3, T.s5out + .4)), up = eInCubic(prog(t, T.s5out - .1, T.s6 + .1));
    const ang = lerp(-.78, 0, a), rad = lerp(lerp(8.2, 10.2, a), 9.5, push), y = lerp(.75, Z.yc, a) + up * 1.5;
    Z.look([Math.sin(ang) * rad, y, Math.cos(ang) * rad], [0, Z.yc + up * 2.2, 0], lerp(-.05, 0, a));
    for (const g of [U.logo, U.refl]) {
      const { z, tl } = g.userData;
      z.userData.chars.forEach((m, i) => { const p = eOutQuart(prog(t, T.logoRise + i * .11, T.logoRise + .95 + i * .11)), h = m.userData.home; m.position.set(h.x, h.y - (1 - p) * 2.6, h.z); m.rotation.x = (1 - p) * .35; });
      tl.userData.chars.forEach((m, i) => { const p = eOutQuart(prog(t, T.logoRise + .55 + i * .05, T.logoRise + 1.35 + i * .05)), h = m.userData.home; m.position.set(h.x, h.y - (1 - p) * 1.6, h.z); });
      g.userData.side.emissiveIntensity = (g === U.logo ? 1 : .6) * (.35 + .5 * eOutCubic(prog(t, T.logoRise + .6, T.logoRise + 1.6)) + .3 * Math.max(0, Math.sin((t - T.logoRise) * 1.8)) * prog(t, T.logoRise + 1.6, T.logoRise + 2.4));
    }
    const lit = eOutCubic(prog(t, T.s5 - .3, T.s5 + 1.2));
    U.slats.forEach((m, i) => { m.material.uniforms.uA.value = lit * (.35 + .4 * Math.sin(i * 1.7 + t * .8) ** 2) * (1 + 2.5 * up); m.material.uniforms.uP.value = ((t - T.s5) * .35 + hash(i) * .6) % 1.4 - .2; });
    U.wallGlow.material.uniforms.uA.value = .18 * lit * (1 + 3 * up); U.key.intensity = 70 * lit;
    U.dust.material.uniforms.uA.value = .7 * lit; U.dust.material.uniforms.uT.value = t;
    s.environmentRotation.set(0, lerp(-.8, .5, eInOutSine(prog(t, T.s5, T.s5out))), 0);
  };
}

// ================================================================== S6 — hero footage with volumetric beams, AKCIJA STIŽE / USKORO.
const Hh = new Shot('hero', { bg: 0x000000, env: ENV_HOT });
{
  const s = Hh.scene, U = Hh.u = {};
  const m = plateMat({ add: true }); m.uniforms.uWarm.value = .5; m.uniforms.uGain.value = 1.15; m.uniforms.uFeather.value = .14; m.uniforms.uFadeB.value = .42; m.uniforms.uSweepDir.value.set(.9, .4); m.uniforms.uSweepW.value = .006; U.m = m;
  // plate: phone ~760 px wide, centred, fading into black top and bottom
  const d = 10, ph = px2w(1700, d) * 9 / 16; U.plate = new THREE.Mesh(new THREE.PlaneGeometry(ph * 16 / 9, ph), m); U.plate.position.set(0, .12, 0); s.add(U.plate);
  U.beams = [beam(16, .04, 2.2), beam(16, .04, 1.7), beam(16, .04, 1.9), beam(15, .04, 1.4)];
  [[-2.2, 8, 1, -.32], [2.4, 8, .5, .3], [0, 9, -.6, .02], [-.8, 8.5, 1.4, -.12]].forEach(([x, y, z, rz], i) => { const b = U.beams[i]; b.position.set(x, y, z); b.rotation.z = rz; s.add(b); });
  U.back = glowPlane(5, 5, [1, .42, .15], 10); U.back.position.set(0, .4, -1); s.add(U.back);
  U.bk = bokeh(34, 0, 0, 4, 7, 12, 5, 240, 71); s.add(U.bk);
  U.dust = dustCloud(1500, 0, 0, 2, 6, 10, 6, 1.7, 77); s.add(U.dust);
  const fl = streak(9, .4); fl.position.set(0, 0, 2); s.add(fl); U.fl = fl;
  Hh.build = () => {
    const ak = text3d('AKCIJA STIŽE', { size: .5, depth: .14, bevel: .016, face: typeFace(.55), side: edgeOrange(.6) }); fitW(ak, px2w(840, 8.4)); s.add(ak);
    const us = text3d('USKORO.', { size: .8, depth: .24, bevel: .026, face: typeFace(.6), side: edgeOrange(.9) }); fitW(us, px2w(700, 8.4)); s.add(us);
    U.ak = ak; U.us = us; Hh.texts.push(ak, us);
  };
  Hh.update = async t => {
    const u = eInOutSine(prog(t, T.s5out, T.s7)), sh = .045 * hit(t, T.uskoro, .28) + .02 * hit(t, T.akcija, .2);
    Hh.look([lerp(.25, -.15, u), lerp(-.15, .1, u), lerp(10.6, 9.6, u)], [0, 0, 0], 0, sh, t);
    await PL.at(5.4 + (t - T.s5out) * .83, m);       // stays before the film's cut to a hand (≈ 9.5 s)
    const sw = prog(t, 19.6, 21.2); m.uniforms.uSweep.value = lerp(-.6, .6, sw); m.uniforms.uSweepA.value = .7 * Math.sin(Math.PI * sw);
    m.uniforms.uA.value = eOutCubic(prog(t, T.s5out, T.s6 + .3)) * (1 + .25 * hit(t, T.uskoro, .3));
    // text (placed in front of the plate, at 8.4 world units from the camera)
    const zt = 1.2, dTop = Hh.cam.position.z - zt, cx = Hh.cam.position.x * zt / Hh.cam.position.z;   // keep the type on the optical axis while the camera drifts
    U.ak.position.set(cx, (H / 2 - 330) / H * visH(dTop), zt);
    U.us.position.set(cx, -(1418 - H / 2) / H * visH(dTop), zt);
    const lv = (i, n) => eInCubic(prog(t, T.s6out - .12 + i * .012, T.s6out + .2 + i * .012));   // exit: letters fold away, staggered
    U.ak.userData.chars.forEach((c, i) => { const p = eOutExpo(prog(t, T.akcija + i * .028, T.akcija + .5 + i * .028)) * (1 - lv(i)), h = c.userData.home; c.visible = p > .01; c.position.set(h.x, h.y, h.z - (1 - p) * 1.4); c.scale.set(1, Math.max(.02, p), 1); });
    U.us.userData.chars.forEach((c, i) => { const p = prog(t, T.uskoro - .22 + i * .018, T.uskoro + i * .018), h = c.userData.home, rec = t > T.uskoro + i * .018 ? 1 - settle(t - T.uskoro - i * .018, 2.4, 8) : 0;
      const o = lv(i + 4); c.visible = p > 0 && o < .99; c.position.set(h.x, h.y, h.z + (1 - eInQuad(p)) * 9 - rec * .35 - o * 1.2); c.scale.set(1, Math.max(.02, 1 - o), 1); });
    U.ak.userData.side.emissiveIntensity = .6 + 1.4 * hit(t, T.akcija, .35); U.us.userData.side.emissiveIntensity = .9 + 2.2 * hit(t, T.uskoro, .4);
    const out = eInCubic(prog(t, T.s6out, T.s7 + .2));
    U.beams.forEach((b, i) => { b.material.uniforms.uA.value = (eOutCubic(prog(t, T.s5out + .2 + i * .15, T.s6 + .8 + i * .15)) * .3 + .35 * hit(t, T.uskoro, .5)) * (1 - out); b.material.uniforms.uT.value = t; });
    U.back.material.uniforms.uA.value = (.07 + .12 * hit(t, T.uskoro, .5)) * (1 - out);
    U.bk.material.uniforms.uA.value = 1 - out; U.bk.material.uniforms.uT.value = t; U.dust.material.uniforms.uA.value = .8 * (1 - out); U.dust.material.uniforms.uT.value = t;
    U.fl.position.y = U.us.position.y; U.fl.position.z = zt + .3; U.fl.material.uniforms.uA.value = 1.4 * hit(t, T.uskoro, .25);
  };
}

// ================================================================== S7 — logo on deep black
const E7 = new Shot('endcard', { bg: 0x000000, env: ENV_HOT });
{
  const s = E7.scene, U = E7.u = {};
  U.line = new THREE.Mesh(new THREE.PlaneGeometry(1, .012), new THREE.ShaderMaterial({ ...ADD, uniforms: { uA: { value: 0 }, uW: { value: 0 } }, vertexShader: VS,
    fragmentShader: `uniform float uA,uW; varying vec2 vUv; void main(){ float d=abs(vUv.x-.5)*2.; float k=smoothstep(uW,uW*.55,d)*(1.-abs(vUv.y-.5)*2.); gl_FragColor=vec4(vec3(1.,.5,.2)*k*uA*1.5+vec3(1.)*k*k*uA*.25,1.); }` }));
  s.add(U.line);
  U.glow = glowPlane(5.5, 3.2, [1, .42, .15], 10); U.glow.position.set(0, -.35, -1.5); s.add(U.glow);
  U.dust = dustCloud(500, 0, 0, 0, 7, 8, 6, 1.4, 91); s.add(U.dust);
  E7.build = () => {
    const face = typeFace(.5), side = edgeOrange(.5);
    const z = text3d('ZONA', { size: 1, depth: .3, bevel: .03, face, side }), tl = text3d('TELEFONA', { size: .3, depth: .12, bevel: .014, tracking: .38, face, side });
    fitW(z, px2w(700, 10)); fitW(tl, px2w(700, 10)); const zc = .72 * z.userData.fit, tc = .72 * .3 * tl.userData.fit;
    const gap = tc * 1.05, tot = zc + gap + tc; z.position.y = tot / 2 - zc / 2; tl.position.y = -tot / 2 + tc / 2;
    s.add(z, tl); U.z = z; U.tl = tl; U.face = face; U.side = side; E7.texts.push(z, tl);
    U.line.position.set(0, -tot / 2 - tc * 1.3, 0); U.line.scale.x = px2w(700, 10);
  };
  E7.update = async t => {
    const u = eInOutSine(prog(t, T.s6out, T.end));
    E7.look([0, 0, lerp(10.8, 9.7, u)], [0, 0, 0]);
    const inP = eOutCubic(prog(t, T.s6out + .1, T.s7 + .5));
    U.z.userData.chars.forEach((m, i) => { const h = m.userData.home; m.position.set(h.x, h.y, h.z - (1 - inP) * .6); });
    U.tl.position.x = 0; U.tl.userData.chars.forEach((m, i) => { const h = m.userData.home, p = eOutCubic(prog(t, T.s7 + .1 + i * .03, T.s7 + .8 + i * .03)); m.position.set(h.x * lerp(1.25, 1, p), h.y, h.z); m.visible = p > 0; });
    U.side.emissiveIntensity = .55 + .15 * Math.sin(t * 2.2);
    const lw = eOutCubic(prog(t, T.s7 + .35, T.s7 + 1.2)); U.line.material.uniforms.uA.value = lw; U.line.material.uniforms.uW.value = lw;
    U.glow.material.uniforms.uA.value = .16 * eOutCubic(prog(t, T.s7, T.s7 + 1.2)); U.dust.material.uniforms.uA.value = .5; U.dust.material.uniforms.uT.value = t;
  };
}

// ================================================================== timeline of shots and transitions
const TR = [
  { a: L, b: E, t0: T.through, t1: T.throughEnd, mode: 1 },
  { a: E, b: P1, t0: T.s1out, t1: T.s2a + .06, mode: 2 },
  { a: P1, b: P2, t0: T.s2b - .14, t1: T.s2b + .08, mode: 3 },
  { a: P2, b: P3, t0: T.s2c - .17, t1: T.s2c + .13, mode: 4 },
  { a: P3, b: P4, t0: T.s2d - .14, t1: T.s2d + .1, mode: 5 },
  { a: P4, b: C, t0: T.s3 - .17, t1: T.s3 + .15, mode: 6 },
  { a: C, b: F, t0: T.s3out, t1: T.s4 + .14, mode: 7 },
  { a: F, b: Z, t0: T.s4out, t1: T.s5 + .03, mode: 8 },
  { a: Z, b: Hh, t0: T.s5out, t1: T.s6 + .1, mode: 9 },
  { a: Hh, b: E7, t0: T.s6out, t1: T.s7 + .3, mode: 10 },
];
function stateAt(t) {
  const tr = TR.find(r => t >= r.t0 && t < r.t1);
  if (tr) return { a: tr.a, b: tr.b, mode: tr.mode, p: (t - tr.t0) / (tr.t1 - tr.t0) };
  let s = L; for (const r of TR) if (t >= r.t1) s = r.b; return { a: s, b: null, mode: 0, p: 0 };
}
async function setTime(t) {
  const st = stateAt(t); ACTIVE = st;
  await st.a.update(t); if (st.b) await st.b.update(t);
  const U = COMP.uniforms; U.uMode.value = st.mode; U.uP.value = st.p; U.uE.value = 1;
  if (st.mode === 1) {                       // aperture in screen space
    const c = scr(L, new THREE.Vector3(0, 0, -.3 + L.u.inner.position.z)), dist = L.cam.position.z - (-.3 + L.u.inner.position.z);
    U.uC.value.copy(c); U.uR.value = L.irisR / (2 * dist * TANV); U.uRot.value = L.irisRot; U.uK.value = .12 * st.p; U.uE.value = eOutCubic(prog(t, T.through, T.through + .25));
  } else if (st.mode === 2) U.uK.value = eInCubic(st.p) * .62;
  else if (st.mode === 8) {                  // slit = the gap between BLACK and FRIDAY
    const c = scr(F, new THREE.Vector3(0, F.gapY, 0)), e = scr(F, new THREE.Vector3(0, F.gapY + F.gapH, 0));
    U.uC.value.set(.5, c.y); U.uR.value = Math.max(Math.abs(e.y - c.y), eInCubic(st.p) * .62);
  }
  grade.uniforms.uTime.value = t;
  grade.uniforms.uFlash.value = .35 * hit(t, 0, .12) + .3 * hit(t, T.spremi, .16) + .28 * hit(t, T.lock, .2) + .18 * hit(t, T.uskoro, .16);
  grade.uniforms.uFade.value = 1;
  composer.render();
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}
// QA helper: screen-space boxes of the visible 3D type of the active shots
function qaText() {
  const out = [], st = ACTIVE, box = new THREE.Box3(), v = new THREE.Vector3();
  for (const sh of [st.a, st.b].filter(Boolean)) for (const g of sh.texts) {
    if (!g.visible || (g.parent && !g.parent.visible)) continue; let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9, n = 0;
    g.updateMatrixWorld(true);
    for (const m of g.userData.chars) { if (!m.visible) continue; box.setFromObject(m); for (let i = 0; i < 8; i++) { v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(sh.cam);
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); } n++; }
    if (n) out.push({ shot: sh.name, text: g.userData.chars.map(c => c.userData.ch).join(''), x0: Math.round(mnx), x1: Math.round(mxx), y0: Math.round(mny), y1: Math.round(mxy), cx: Math.round((mnx + mxx) / 2) });
  }
  return out;
}

async function boot() {
  const ttf = new TTFLoader(), buf = async f => (await fetch(f)).arrayBuffer();
  const a = ttf.parse(await buf('assets/montserrat-latin-900-normal.woff')), b = ttf.parse(await buf('assets/montserrat-latin-ext-900-normal.woff'));
  a.glyphs = { ...b.glyphs, ...a.glyphs }; FONT = new Font(a);
  const tx = async f => { const im = await load('assets/' + f); return [texOf(im), im]; };
  const [camT] = await tx('cam.jpg'), [frT, frI] = await tx('s26_front_l30.png'), [pairT, pairI] = await tx('pair.png'), [s26T, s26I] = await tx('s26_back_r30.png');
  P2.u.m.uniforms.map.value = camT;
  E.build(); P3.build(frT, frI); P4.build(pairT, pairI, s26T, s26I); F.build(); Z.build(); Hh.build(); E7.build();
  window.setTime = setTime; window.__T = T; window.__qa = qaText; window.__shots = { L, E, P1, P2, P3, P4, C, F, Z, Hh, E7 };
  await setTime(0); window.READY = true;
}
boot();
