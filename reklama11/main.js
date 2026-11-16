// ZONA TELEFONA — „BLACK FRIDAY IS COMING“ (1080×1920). One continuous camera journey through a real-time 3D world:
// the void → a monumental metal Z → orbit around the black monolith logo → past its edge into a field of real phones →
// a black metal wall cracks with orange energy and shatters → BLACK FRIDAY → final hero shot → logo hold.
// Three.js PBR metals lit by a custom environment, extruded Montserrat Black type, volumetric beams, haze, sparks, shards, bloom, grade.
// Deterministic: setTime(t) renders exactly the frame at time t.
import * as THREE from 'three';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import T from './timeline.json' with { type: 'json' };

const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const eOutCubic = x => 1 - Math.pow(1 - x, 3), eInCubic = x => x * x * x;
const eInOutCubic = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eInOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;
const eOutExpo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eInOutQuint = x => x < .5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2;
const eOutBack = (x, c = 1.4) => 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const noise1 = t => Math.sin(t * 1.3) * .6 + Math.sin(t * 2.7 + 1.3) * .3 + Math.sin(t * 5.1 + 2.1) * .1;
const load = s => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = s; });
const OR = new THREE.Color('#D97757'), ORHOT = new THREE.Color(1.0, .42, .16);     // brand orange / emissive orange for light

// ================================================================== renderer, post
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x030303);
scene.fog = new THREE.FogExp2(0x050302, .028);
const camera = new THREE.PerspectiveCamera(34, W / H, .05, 400);
const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), .55, .5, 1.05); composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: .55 }, uFlash: { value: 0 }, uFade: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uVig,uFlash,uFade; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec3 c=texture2D(tDiffuse,vUv).rgb;
      c=clamp(c,0.,1.); c=mix(c,vec3(1.,.72,.5),uFlash*.6);                // impact flash (warm)
      float l=dot(c,vec3(.299,.587,.114)); c=mix(vec3(l),c,1.06);          // a touch more saturation in the orange
      c=pow(c,vec3(1.08)); c=c*c*(3.-2.*c)*.25+c*.75;                     // deeper blacks, gentle S-curve
      vec2 q=vUv-.5; q.y*=1.15; c*=1.-uVig*smoothstep(.25,.85,length(q));  // vignette
      c+=(h(vUv*vec2(1080.,1920.)+fract(uTime*7.)*91.)-.5)*.028;           // fine film grain
      gl_FragColor=vec4(c*uFade,1.); }`
});
composer.addPass(new OutputPass()); composer.addPass(grade);   // grade runs on tone-mapped, display-referred pixels

// ================================================================== environment for reflections: black studio with orange soft-boxes + a white strip
{
  const env = new THREE.Scene(); env.background = new THREE.Color(0x000000);
  const box = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.BackSide })); env.add(box);
  const panel = (w, h, col, x, y, z, ry = 0, rx = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
  panel(10, 3, new THREE.Color(5, 1.9, .7), -9, 4, 2, Math.PI / 2);        // big orange soft-box left
  panel(6, 2, new THREE.Color(3.5, 1.3, .45), 9, -2, -3, -Math.PI / 2);   // orange right, lower
  panel(14, .35, new THREE.Color(4, 3.9, 3.7), 0, 12, 0, 0, Math.PI / 2); // thin white top strip
  panel(8, .25, new THREE.Color(2.5, 2.4, 2.3), 0, 2, -12);               // white line behind
  panel(4, 6, new THREE.Color(.25, .22, .2), 0, 0, 13);                     // faint graphite fill from the front
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(env, .03).texture;
}
scene.add(new THREE.AmbientLight(0x1a1410, .25));
const key = new THREE.SpotLight(0xff8a4c, 0, 60, .5, .7, 1.2); key.position.set(0, 9, 8); scene.add(key, key.target);
const rim = new THREE.PointLight(0xff6a30, 0, 30, 1.6); scene.add(rim);

// ================================================================== materials
const metalBlack = () => new THREE.MeshStandardMaterial({ color: 0x0d0d0e, metalness: 1, roughness: .27, envMapIntensity: 1.25 });
const edgeOrange = () => new THREE.MeshStandardMaterial({ color: 0x2a140b, metalness: .85, roughness: .3, emissive: ORHOT.clone(), emissiveIntensity: 0, envMapIntensity: 1 });
const chrome = () => new THREE.MeshStandardMaterial({ color: 0xd9d9dc, metalness: 1, roughness: .16, envMapIntensity: 1.35 });
const graphite = () => new THREE.MeshStandardMaterial({ color: 0x2a2a2d, metalness: .9, roughness: .35, envMapIntensity: 1 });
const ADD = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending };

// ================================================================== 3D type: per-letter extruded Montserrat Black (latin + latin-ext merged)
let FONT;
function text3d(str, { size = 1, depth = .25, bevel = .03, tracking = 0, face = metalBlack(), side = edgeOrange() } = {}) {
  const g = new THREE.Group(), chars = [], sc = size / FONT.data.resolution; let x = 0;
  for (const ch of str) {
    const gl = FONT.data.glyphs[ch] || FONT.data.glyphs['?'];
    if (ch !== ' ') {
      const geo = new THREE.ExtrudeGeometry(FONT.generateShapes(ch, size), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .75, bevelSegments: 3, curveSegments: 7 });
      geo.computeBoundingBox(); const bb = geo.boundingBox, cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
      geo.translate(-cx, -cy, -depth / 2);
      const m = new THREE.Mesh(geo, [face, side]); m.userData.home = new THREE.Vector3(x + cx, cy, 0); chars.push(m); g.add(m);
    }
    x += gl.ha * sc + tracking * size;
  }
  const w = x - tracking * size, capC = size * .36;
  for (const m of chars) { m.userData.home.x -= w / 2; m.userData.home.y -= capC; m.position.copy(m.userData.home); }
  g.userData = { chars, width: w, face, side, size }; return g;
}

// ================================================================== world objects
const world = new THREE.Group(); scene.add(world);
// --- S1: the tiny light + beams + dust
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.12, 'rgba(255,190,140,.9)'); g.addColorStop(.4, 'rgba(255,120,60,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const spark0 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc896, ...ADD, fog: false })); world.add(spark0);
function beam(len, r0, r1) {
  const geo = new THREE.CylinderGeometry(r0, r1, len, 48, 1, true); geo.translate(0, -len / 2, 0);
  return new THREE.Mesh(geo, new THREE.ShaderMaterial({ ...ADD, side: THREE.DoubleSide, fog: false, uniforms: { uA: { value: 0 }, uL: { value: len }, uT: { value: 0 } },
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP=position; vec4 w=modelMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-(viewMatrix*w).xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; uniform float uA,uL,uT;
      void main(){ float along=clamp(-vP.y/uL,0.,1.); float edge=pow(abs(dot(vN,vV)),2.2); float n=.75+.25*sin(vP.y*1.7+uT*.8+atan(vP.z,vP.x)*4.);
        vec3 c=mix(vec3(1.,.62,.36),vec3(.85,.3,.1),along)*edge*(1.-along)*.42*n*uA; gl_FragColor=vec4(c,1.); }` }));
}
const beams = [beam(26, .05, 3.2), beam(26, .05, 2.4), beam(26, .05, 2.8)];
beams[0].position.set(-2.5, 14, 1); beams[0].rotation.z = -.18; beams[1].position.set(2.8, 14, -1); beams[1].rotation.z = .2; beams[2].position.set(0, 15, -2); beams[2].rotation.x = .12;
beams.forEach(b => world.add(b));
function dustCloud(n, cx, cy, cz, sx, sy, sz, size, seed) {
  const p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { p.set([cx + (hash(i + seed) - .5) * sx, cy + (hash(i * 1.7 + seed) - .5) * sy, cz + (hash(i * 2.3 + seed) - .5) * sz], i * 3); s[i] = hash(i * 3.1 + seed); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  return new THREE.Points(g, new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 }, uT: { value: 0 }, uSize: { value: size } },
    vertexShader: `attribute float aS; uniform float uT,uSize; varying float vA;
      void main(){ vec3 q=position+vec3(sin(uT*.3+aS*40.)*.25, mod(uT*.12*(.5+aS)+aS*3.,3.)-1.5, cos(uT*.25+aS*30.)*.25);
        vec4 mv=modelViewMatrix*vec4(q,1.); gl_PointSize=uSize*(.6+aS)*(30./-mv.z); vA=(.4+.6*fract(aS*7.))*smoothstep(60.,8.,-mv.z)*smoothstep(.3,1.5,-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uA; varying float vA; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; float k=(1.-d*2.); k*=k; gl_FragColor=vec4(vec3(1.,.66,.42)*k*vA*uA,1.); }` }));
}
const dust1 = dustCloud(2600, 0, 3, 0, 14, 14, 16, 2.4, 1); world.add(dust1);
// --- haze / smoke: soft noise sprites (additive, tinted by the orange light)
const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const id = x.createImageData(256, 256);
  const N = (u, v) => { let s = 0, a = .5, f = 1; for (let o = 0; o < 5; o++) { s += a * (Math.sin(u * f * 6.3 + hash(o) * 9) * Math.sin(v * f * 5.7 + hash(o + 3) * 7) * .5 + .5); a *= .5; f *= 2.1; } return s; };
  for (let y = 0; y < 256; y++) for (let xx = 0; xx < 256; xx++) { const u = xx / 256 - .5, v = y / 256 - .5, r = Math.sqrt(u * u + v * v) * 2; const k = Math.max(0, 1 - r) ** 1.6 * N(u + .5, v + .5); const i = (y * 256 + xx) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = k * 255; }
  x.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); return t; })();
function smokeBank(n, cx, cy, cz, sx, sz, scale, seed, col = 0xff7a40) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    m.userData = { x: cx + (hash(i + seed) - .5) * sx, y: cy + (hash(i * 3 + seed) - .5) * 1.2, z: cz + (hash(i * 5 + seed) - .5) * sz, s: scale * (.7 + hash(i * 7 + seed) * .8), r: hash(i * 11 + seed) * 6, v: (hash(i * 13 + seed) - .5) * .2 };
    g.add(m); }
  g.userData.update = (t, a) => g.children.forEach(m => { const u = m.userData; m.position.set(u.x + Math.sin(t * .2 + u.r) * .4, u.y + t * .03, u.z); m.scale.setScalar(u.s * (1 + .05 * Math.sin(t * .3 + u.r))); m.material.rotation = u.r + t * u.v; m.material.opacity = a * .055; });
  return g;
}

// --- S1/S2: the black monolith with the logo; orange light runs along its edges
const MONO = { w: 6.4, h: 9.2, d: 1.4 };
const monolith = new THREE.Mesh(new RoundedBoxGeometry(MONO.w, MONO.h, MONO.d, 6, .16), new THREE.MeshStandardMaterial({ color: 0x0a0a0b, metalness: .96, roughness: .22, envMapIntensity: 1.1 }));
monolith.position.set(0, 0, -.7); world.add(monolith);
const edgeRuns = [];
{   // four light bars along the front edges with a travelling hot spot
  const mk = (len, x, y, rotZ) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(len, .045), new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 }, uP: { value: 0 }, uL: { value: len } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uA,uP,uL; varying vec2 vUv; void main(){ float d=(vUv.x-uP)*uL; float hot=exp(-d*d*1.6); float base=.18; float v=1.-abs(vUv.y-.5)*2.;
      vec3 c=vec3(1.,.48,.2)*(base+hot*2.2)*v*uA + vec3(1.,.9,.8)*hot*hot*v*uA*.8; gl_FragColor=vec4(c,1.); }` }));
    m.position.set(x, y, .02); m.rotation.z = rotZ; world.add(m); edgeRuns.push(m); };
  mk(MONO.w - .3, 0, MONO.h / 2 - .08, 0); mk(MONO.h - .3, MONO.w / 2 - .08, 0, -Math.PI / 2); mk(MONO.w - .3, 0, -MONO.h / 2 + .08, Math.PI); mk(MONO.h - .3, -MONO.w / 2 + .08, 0, Math.PI / 2);
}
let logoZ, logoT;                         // "ZONA" + "TELEFONA" on the monolith
const smokeMono = smokeBank(14, 0, -4.4, 1.5, 12, 6, 7, 3); world.add(smokeMono);

// --- S3: field of real phones (official stills) floating in the dark behind the monolith
const PH_VS = `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
function phoneMat(tex) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: true, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, uA: { value: 1 }, uSweep: { value: -2 }, uSweepA: { value: 0 }, uRim: { value: 0 }, uDim: { value: 0 } }]),
    vertexShader: `#include <fog_pars_vertex>
      varying vec2 vUv; void main(){ vUv=uv; vec4 mvPosition=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `#include <fog_pars_fragment>
      uniform sampler2D map; uniform float uA,uSweep,uSweepA,uRim,uDim; varying vec2 vUv;
      void main(){ vec4 c=texture2D(map,vUv); if(c.a<.03) discard;
        float d=(vUv.x*.62+vUv.y*.38)-uSweep; c.rgb+=exp(-d*d/.0022)*uSweepA*vec3(1.,.62,.36)*.55*c.a;          // orange specular sweep
        float e=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)); c.rgb+=vec3(1.,.5,.22)*uRim*smoothstep(.06,0.,e)*.35;  // orange rim from the back-light
        c.rgb*=1.-uDim; gl_FragColor=vec4(c.rgb,c.a*uA);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` });
}
function card(tex, img, h) { const m = phoneMat(); m.uniforms.map.value = tex; const mesh = new THREE.Mesh(new THREE.PlaneGeometry(h * img.width / img.height, h), m); world.add(mesh); return mesh; }
class Phone {   // iPhone 17 Pro: front + back stills + extruded titanium edge (real thickness when it turns)
  constructor(ft, bt, h) {
    this.g = new THREE.Group(); world.add(this.g); const D = .052;
    this.front = new THREE.Mesh(new THREE.PlaneGeometry(825 / 1700, 1), phoneMat()); this.front.material.uniforms.map.value = ft; this.front.position.z = D / 2 + .001;
    this.back = new THREE.Mesh(new THREE.PlaneGeometry(887 / 1850, 1), phoneMat()); this.back.material.uniforms.map.value = bt; this.back.position.z = -D / 2 - .001; this.back.rotation.y = Math.PI;
    const ew = .468, eh = .976, r = .088, s = new THREE.Shape();
    s.moveTo(-ew / 2 + r, -eh / 2); s.lineTo(ew / 2 - r, -eh / 2); s.quadraticCurveTo(ew / 2, -eh / 2, ew / 2, -eh / 2 + r); s.lineTo(ew / 2, eh / 2 - r); s.quadraticCurveTo(ew / 2, eh / 2, ew / 2 - r, eh / 2);
    s.lineTo(-ew / 2 + r, eh / 2); s.quadraticCurveTo(-ew / 2, eh / 2, -ew / 2, eh / 2 - r); s.lineTo(-ew / 2, -eh / 2 + r); s.quadraticCurveTo(-ew / 2, -eh / 2, -ew / 2 + r, -eh / 2);
    const eg = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: false, curveSegments: 20 }); eg.translate(0, 0, -D / 2);
    this.edge = new THREE.Mesh(eg, [new THREE.MeshBasicMaterial({ visible: false }), new THREE.MeshStandardMaterial({ color: 0x8a3a18, metalness: 1, roughness: .25, envMapIntensity: 1.3 })]);
    this.g.add(this.edge, this.front, this.back); this.g.scale.setScalar(h);
  }
  mats() { return [this.front.material, this.back.material]; }
  face() { const f = Math.cos(this.g.rotation.y); this.front.visible = f > -.02; this.back.visible = f < .02; }
}
let hero, cards = [], streaks;
// --- S4: the wall with orange cracks; shards + sparks
const WALLZ = -40;
const CRACK = `
  vec2 hash2(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
  float cracks(vec2 x){ vec2 n=floor(x), f=fract(x); vec2 mg, mr; float md=8.;
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 g=vec2(i,j); vec2 o=hash2(n+g); vec2 r=g+o-f; float d=dot(r,r); if(d<md){ md=d; mr=r; mg=g; } }
    md=8.; for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){ vec2 g=mg+vec2(i,j); vec2 o=hash2(n+g); vec2 r=g+o-f; if(dot(mr-r,mr-r)>.00001) md=min(md,dot(.5*(mr+r),normalize(r-mr))); }
    return md; }`;
const wallMat = new THREE.ShaderMaterial({ fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uC: { value: 0 }, uT: { value: 0 }, uCam: { value: new THREE.Vector3() } }]),
  vertexShader: `#include <fog_pars_vertex>
    varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vec4 mvPosition=viewMatrix*w; gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `#include <fog_pars_fragment>
    uniform float uC,uT; uniform vec3 uCam; varying vec3 vW; ${CRACK}
    void main(){ vec2 p=vW.xy;
      vec2 d0=p-vec2(0.,.3); float r=length(d0), a=atan(d0.y,d0.x);
      float spread=uC*6.5;                                              // crack front radius
      float on=smoothstep(spread,spread-1.4,r);
      float ang=a*(15./6.2831853)+sin(r*1.1+a*3.)*.22+sin(r*3.7)*.05;  // 15 wobbling radial cracks
      float rd=abs(fract(ang+.5)-.5)*6.2831853/15.*r;
      float rays=smoothstep(.022,.0,rd)*smoothstep(.15,.6,r)*(1.-smoothstep(4.5,7.,r)*.5);
      float rg=abs(fract(log(r+.35)*2.4+sin(a*4.)*.06)-.5)*r*.42;     // a few concentric breaks
      float rings=smoothstep(.016,.0,rg)*step(.5,fract(a*2.3+floor(log(r+.35)*2.4)*.37))*smoothstep(.4,1.,r);
      float fine=smoothstep(.014,.0,cracks(p*2.6+3.))*smoothstep(1.8,.0,r);
      float line=max(max(rays,rings*.8),fine)*on;
      float c1=rd;
      float flick=.8+.2*sin(uT*40.+r*6.);
      // brushed black metal: dark base + soft orange reflection of the light behind the camera
      vec3 V=normalize(uCam-vW); float spec=pow(max(0.,1.-length(p-vec2(-1.,2.))/14.),3.);
      vec3 base=vec3(.012)+vec3(.05,.028,.018)*spec + vec3(.006)*sin(p.y*90.+sin(p.x*3.)*2.);
      vec3 glow=vec3(1.,.42,.13)*line*(1.1+1.8*uC)*flick + vec3(1.,.3,.08)*on*.06*exp(-r*.6);
      gl_FragColor=vec4(base+glow,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }` });
const HOLE = { w: 7, h: 11 };
const wallFrame = new THREE.Group(); world.add(wallFrame);
{ // big wall made of the outer frame + the breakable centre
  const big = 70, add = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); m.position.set(x, y, WALLZ); wallFrame.add(m); };
  add(big, (big - HOLE.h) / 2, 0, HOLE.h / 2 + (big - HOLE.h) / 4); add(big, (big - HOLE.h) / 2, 0, -HOLE.h / 2 - (big - HOLE.h) / 4);
  add((big - HOLE.w) / 2, HOLE.h, HOLE.w / 2 + (big - HOLE.w) / 4, 0); add((big - HOLE.w) / 2, HOLE.h, -HOLE.w / 2 - (big - HOLE.w) / 4, 0);
}
const wallCentre = new THREE.Mesh(new THREE.PlaneGeometry(HOLE.w, HOLE.h), wallMat); wallCentre.position.set(0, 0, WALLZ); world.add(wallCentre);
const shards = new THREE.Group(); world.add(shards);
{ // jittered triangulation of the centre → thin shards with their own fly-out vectors
  const NX = 9, NY = 14, pts = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const edge = i === 0 || j === 0 || i === NX || j === NY; pts.push([(i / NX - .5) * HOLE.w + (edge ? 0 : (hash(i * 7 + j * 13) - .5) * HOLE.w / NX * .8), (j / NY - .5) * HOLE.h + (edge ? 0 : (hash(i * 3 + j * 17) - .5) * HOLE.h / NY * .8)]); }
  const P = (i, j) => pts[j * (NX + 1) + i];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) for (const tri of ((i + j) % 2 ? [[P(i, j), P(i + 1, j), P(i + 1, j + 1)], [P(i, j), P(i + 1, j + 1), P(i, j + 1)]] : [[P(i, j), P(i + 1, j), P(i, j + 1)], [P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]])) {
    const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    const sh = new THREE.Shape(); sh.moveTo(tri[0][0] - cx, tri[0][1] - cy); sh.lineTo(tri[1][0] - cx, tri[1][1] - cy); sh.lineTo(tri[2][0] - cx, tri[2][1] - cy); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: .09, bevelEnabled: false }); geo.translate(0, 0, -.045);
    const m = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ color: 0x0b0b0c, metalness: 1, roughness: .3, envMapIntensity: 1.2 }), new THREE.MeshStandardMaterial({ color: 0x1a0a04, emissive: ORHOT, emissiveIntensity: 2.2, metalness: .6, roughness: .4 })]);
    const k = shards.children.length, r = Math.hypot(cx, cy - .3) + .2;
    m.userData = { p0: new THREE.Vector3(cx, cy, WALLZ), v: new THREE.Vector3(cx / r * (2.2 + hash(k) * 3.5), (cy - .3) / r * (2.2 + hash(k + 1) * 3.5) + 1.2, 3 + hash(k + 2) * 9), ax: new THREE.Vector3(hash(k + 3) - .5, hash(k + 4) - .5, hash(k + 5) - .5).normalize(), w: 2 + hash(k + 6) * 7, delay: r * .015 };
    shards.add(m);
  }
}
const SPN = 900, sparkGeo = new THREE.BufferGeometry(), sparkPos = new Float32Array(SPN * 6), sparkCol = new Float32Array(SPN * 6);
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3)); sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
const sparks = new THREE.LineSegments(sparkGeo, new THREE.LineBasicMaterial({ vertexColors: true, ...ADD, fog: false })); sparks.frustumCulled = false; world.add(sparks);
const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa070, ...ADD, fog: false, opacity: 0 })); flare.position.set(0, .3, WALLZ + .3); world.add(flare);
// --- S5/S6: BLACK FRIDAY behind the wall, the lines, the final hero
const BFZ = -54;
let bfBlack, bfFriday, akcija, zt, question, uskoro, finalPhone;
const endLine = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .018), new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 }, uW: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uA,uW; varying vec2 vUv; void main(){ float d=abs(vUv.x-.5)*2.; float k=smoothstep(uW,uW*.6,d)*(1.-abs(vUv.y-.5)*2.); gl_FragColor=vec4(vec3(1.,.5,.2)*k*uA*1.6+vec3(1.)*k*k*uA*.3,1.); }` }));
world.add(endLine);
const backGlow = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 }, uT: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform float uA,uT; varying vec2 vUv; void main(){ vec2 q=(vUv-.5)*vec2(1.5,1.); float r=length(q); float k=exp(-r*r*16.)*.9+exp(-r*r*60.)*.6;
    k*=.92+.08*sin(uT*2.1); gl_FragColor=vec4(vec3(1.,.42,.15)*k*uA*.32,1.); }` }));
backGlow.position.set(0, .7, BFZ - 6); backGlow.scale.set(.3, .32, 1); world.add(backGlow);
const bfSmoke = smokeBank(12, 0, -2.4, BFZ + 1, 7, 4, 4.5, 9); world.add(bfSmoke);
const dust2 = dustCloud(2200, 0, 0, BFZ + 4, 12, 14, 12, 2.0, 7); world.add(dust2);
const convBeams = [beam(30, .04, 1.4), beam(30, .04, 1.4), beam(30, .04, 1.2), beam(30, .04, 1.2)];
convBeams.forEach((b, i) => { b.position.set([-7, 7, -4, 4][i], [13, 13, -12, -12][i], BFZ + 6); b.lookAt(0, .3, BFZ + 7); b.rotateX(-Math.PI / 2); world.add(b); });

// ================================================================== camera journey (one continuous move)
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
let path, ZX = -1.8, ZY = 1.0;                       // set in boot() once the Z position is known
const S1END = () => new THREE.Vector3(ZX, ZY - .3, 8.2);
function buildPath() { path = new THREE.CatmullRomCurve3([   // S1 end → orbit out to read the whole logo → rush past the monolith's edge → phone field
  S1END(), new THREE.Vector3(-6.0, 1.4, 13.5), new THREE.Vector3(0, .7, 19.5), new THREE.Vector3(6.4, .4, 8.5),
  new THREE.Vector3(4.3, .25, -1.6), new THREE.Vector3(2.0, .25, -7.5)], false, 'catmullrom', .5); }
function cameraAt(t) {
  let shake = 0;
  if (t < T.s2) {                                     // S1: slow push through the dark towards the light
    const u = eInOutSine(prog(t, 0, T.s2)), ux = eInOutSine(prog(t, .2, 1.8)), e = S1END(); camPos.set(lerp(0, e.x, ux) + Math.sin(t * .4) * .06, lerp(.35, e.y, u), lerp(26, e.z, u)); camLook.set(lerp(0, ZX, ux), lerp(.35, ZY - .2, u), 0);
    shake = Math.exp(-Math.max(0, t - T.impactZ) / .25) * (t > T.impactZ ? .045 : 0);
  } else if (t < T.s3 + .4) {                          // S2: orbit around the monolith, then slip past its edge
    const k = .4 * eInOutSine(prog(t, T.s2, 5.2)) + .6 * eInOutCubic(prog(t, T.pass - .1, T.s3 + .4));
    path.getPoint(k, camPos); const lk = eInOutCubic(prog(t, T.pass, T.s3 + .35)), lz = eInOutSine(prog(t, T.s2, T.s2 + 1.2));
    camLook.set(lerp(lerp(ZX, 0, lz), .3, lk), lerp(lerp(ZY - .2, .35, lz), .2, lk), lerp(0, -22, lk));
  } else if (t < T.s4) {                               // S3: smooth dolly through the phones
    const u = eInOutSine(prog(t, T.s3 + .4, T.s4)); camPos.set(lerp(2.0, -.4, u) + noise1(t * .6) * .05, lerp(.25, .15, u), lerp(-7.5, -13.5, u)); camLook.set(lerp(.3, 0, u), .1, -22);
  } else if (t < T.s5) {                               // S4: everything slows down, towards the wall … then through the hole
    const a = eInOutSine(prog(t, T.s4, T.fracture)), b = eInOutCubic(prog(t, T.fracture + .05, T.s5 + .3));
    camPos.set(lerp(-.4, 0, a), lerp(.15, .3, a), lerp(lerp(-13.5, -33.5, a), BFZ + 10.5, b)); camLook.set(0, .3, lerp(WALLZ, BFZ, b));
    shake = t > T.fracture ? Math.exp(-(t - T.fracture) / .35) * .09 : 0;
  } else if (t < T.s6) {                               // S5: settle on BLACK FRIDAY, slow drift
    const u = eInOutSine(prog(t, T.s5, T.s6)); camPos.set(Math.sin(t * .35) * .12, .3 - .25 * u, BFZ + 10.5 - .6 * u); camLook.set(0, .05 - .25 * u, BFZ);
    if (t < T.s5 + .3) { const b = eInOutCubic(prog(t, T.fracture + .05, T.s5 + .3)); camPos.z = lerp(-33.5, BFZ + 10.5, b); camPos.y = .3; }
  } else {                                             // S6/S7: pull back to the hero frame, then a slow elegant push-in
    const back = eInOutCubic(prog(t, T.s6, T.s6 + 1.0)), push = eInOutSine(prog(t, T.s6 + 1.0, T.end));
    camPos.set(0, lerp(.05, .25, back), lerp(BFZ + 9.9, BFZ + 14.6, back) - 1.1 * push); camLook.set(0, lerp(-.2, .1, back), BFZ);
    shake = t > T.uskoro ? Math.exp(-(t - T.uskoro) / .28) * .035 : 0;
  }
  camera.position.copy(camPos).add(new THREE.Vector3(Math.sin(t * 61) * shake, Math.cos(t * 53) * shake * .7, 0));
  camera.lookAt(camLook);
}

// ================================================================== frame
function setLetters(group, t0, t, { dur = .7, st = .06, from = 'rise', amt = 1 } = {}) {
  group.userData.chars.forEach((m, i) => {
    const p = clamp((t - t0 - i * st) / dur), e = from === 'rise' ? eOutBack(p, 1.2) : eOutExpo(p), h = m.userData.home;
    if (from === 'rise') { m.position.set(h.x, h.y - (1 - e) * 1.2 * amt, h.z - (1 - p) * .6); m.rotation.x = (1 - e) * .6; }
    else if (from === 'push') { m.position.set(h.x, h.y, h.z + (1 - e) * 3 * amt); m.rotation.y = (1 - e) * .5 * (i % 2 ? 1 : -1); }
    else if (from === 'track') { m.position.set(h.x * (1 + (1 - e) * .6), h.y, h.z); }
    else if (from === 'extrude') { m.position.set(h.x, h.y, h.z - (1 - e) * .9); m.scale.z = Math.max(.001, e); }
    m.visible = p > 0;
  });
}
async function setTime(t) {
  cameraAt(t);
  const dt = t;   // world time for drifts
  // ---------- global light states
  const s1 = clamp(prog(t, T.light - .1, T.impactZ)), boom = t > T.impactZ ? Math.exp(-(t - T.impactZ) / .5) : 0;
  spark0.visible = t < T.s3 + .5; spark0.position.set(ZX, ZY, .75);
  const sp = clamp(prog(t, T.light, T.light + .5)) * (1 - eInOutCubic(prog(t, T.s2 + .6, T.s3)));
  spark0.scale.setScalar((.18 + .5 * eInCubic(prog(t, T.light, T.impactZ)) + 2.2 * boom) * sp); spark0.material.opacity = sp * (1 - .5 * clamp(prog(t, T.impactZ + .2, T.s2)));
  for (const [i, b] of beams.entries()) { b.visible = t < T.s3 + .6; b.material.uniforms.uA.value = eOutCubic(prog(t, T.beams + i * .25, T.beams + 1.2 + i * .25)) * (1 - prog(t, T.pass, T.s3 + .5)) * (1 + boom * .6); b.material.uniforms.uT.value = t; }
  dust1.visible = t < T.s4; dust1.material.uniforms.uA.value = eOutCubic(prog(t, T.beams, T.beams + 1.4)) * (1 - prog(t, T.s4 - 1, T.s4)); dust1.material.uniforms.uT.value = dt;
  key.intensity = 140 * (eOutCubic(prog(t, T.impactZ - .05, T.impactZ + .5)) * (1 - prog(t, T.s3 - .4, T.s3 + .4)) + .9 * clamp(prog(t, T.s3, T.s3 + .8)) * (1 - prog(t, T.s4 + .6, T.s4 + 1.4)));
  key.position.set(0, 9, t < T.s3 ? 8 : -12); key.target.position.set(0, 0, t < T.s3 ? 0 : -22);
  rim.intensity = 0; grade.uniforms.uFlash.value = 0; grade.uniforms.uFade.value = 1; grade.uniforms.uTime.value = t;
  // ---------- S1/S2: monolith + logo
  const monoOn = t < T.s3 + 1.0; monolith.visible = monoOn; logoZ.visible = logoT.visible = monoOn;
  if (monoOn) {
    // "Z" erupts from the face at the impact; the other letters follow in S2
    logoZ.userData.chars.forEach((m, i) => {
      const t0 = i === 0 ? T.impactZ - .02 : T.zona + (i - 1) * .14, p = clamp((t - t0) / (i === 0 ? .55 : .7)), e = i === 0 ? eOutExpo(p) : eOutBack(p, 1.1), h = m.userData.home;
      m.visible = p > 0; m.position.set(h.x, h.y, h.z - (1 - e) * 1.1); m.scale.z = Math.max(.001, e);
    });
    setLetters(logoT, T.tel, t, { dur: .8, st: .05, from: 'track' });
    const glowZ = eOutCubic(prog(t, T.impactZ, T.impactZ + .4)) * (1 - .55 * prog(t, T.impactZ + .4, T.s2 + .5));
    logoZ.userData.side.emissiveIntensity = 1.1 * glowZ + .45 * eOutCubic(prog(t, T.zona, T.zona + 1)) * (1 - prog(t, T.pass, T.s3 + .6));
    logoT.userData.side.emissiveIntensity = .55 * eOutCubic(prog(t, T.tel, T.tel + .8)) * (1 - prog(t, T.pass, T.s3 + .6));
    edgeRuns.forEach((m, i) => { m.material.uniforms.uA.value = eOutCubic(prog(t, T.edge + i * .1, T.edge + .8 + i * .1)) * (1 - prog(t, T.pass, T.s3 + .4)); m.material.uniforms.uP.value = ((t - T.edge) * .55 + i * .25) % 1.3 - .15; });
    smokeMono.visible = true; smokeMono.userData.update(dt, eOutCubic(prog(t, T.impactZ, T.s2 + 1)) * (1 - prog(t, T.pass, T.s3)));
  } else { edgeRuns.forEach(m => m.material.uniforms.uA.value = 0); smokeMono.visible = false; }
  // ---------- S3: phones rise out of the darkness; hero turns slowly; light streaks behind
  const fieldOn = t > T.s3 - .8 && t < T.s4 + 1.4;
  hero.g.visible = fieldOn; cards.forEach(c => c.mesh.visible = fieldOn); streaks.visible = fieldOn;
  if (fieldOn) {
    const sink = eInOutCubic(prog(t, T.s4, T.s4 + 1.3));
    cards.forEach((c, i) => {
      const r = eOutCubic(prog(t, T.rise + c.d, T.rise + c.d + 1.4)), m = c.mesh;
      m.position.set(c.x, lerp(c.y - 6.5, c.y, r) + Math.sin(dt * .7 + i) * .05 - sink * 4, c.z); m.rotation.set(0, c.ry + Math.sin(dt * .4 + i * 2) * .05, 0);
      const u = m.material.uniforms; u.uA.value = r * (1 - sink); u.uSweep.value = lerp(-.4, 1.4, prog(t, T.rise + c.d + .6, T.rise + c.d + 2.2)); u.uSweepA.value = .9; u.uRim.value = .8 * r;
    });
    const r = eOutCubic(prog(t, T.rise + .15, T.rise + 1.6));
    hero.g.position.set(.2, lerp(-6.8, .15, r) + Math.sin(dt * .8) * .04 - sink * 4, -21.5);
    hero.g.rotation.set(.04, lerp(-.55, .38, eInOutSine(prog(t, T.hero, T.s4 + .5))), 0); hero.face();
    hero.mats().forEach(m => { m.uniforms.uA.value = r * (1 - sink); m.uniforms.uSweep.value = lerp(-.4, 1.4, prog(t, T.hero + .4, T.s4)); m.uniforms.uSweepA.value = 1; m.uniforms.uRim.value = .7; });
    streaks.children.forEach((s, i) => { const u = s.userData; s.position.set(((dt * u.v + u.o) % 40) - 20, u.y, u.z); s.material.uniforms.uA.value = eOutCubic(prog(t, T.rise + .4, T.rise + 1.6)) * (1 - sink); });
    rim.position.set(0, 1.5, -25); rim.intensity = 60 * r * (1 - sink);
  }
  // ---------- S4: wall, cracks, fracture
  const wallOn = t > T.s4 - .5 && t < T.s5 + .6;
  wallFrame.visible = wallOn; wallCentre.visible = wallOn && t < T.fracture; shards.visible = wallOn && t >= T.fracture; sparks.visible = wallOn && t >= T.fracture - .02;
  wallMat.uniforms.uC.value = eInCubic(prog(t, T.cracks, T.fracture)) * 1.0 + (t >= T.fracture ? 1 : 0) * .4; wallMat.uniforms.uT.value = t; wallMat.uniforms.uCam.value.copy(camera.position);
  if (wallOn && t >= T.fracture) {
    const tt = t - T.fracture;
    shards.children.forEach(m => { const u = m.userData, s = Math.max(0, tt - u.delay), slow = s * (.55 + .45 * clamp(s / .6));
      m.position.copy(u.p0).addScaledVector(u.v, slow).add(new THREE.Vector3(0, -2.2 * slow * slow, 0)); m.quaternion.setFromAxisAngle(u.ax, u.w * slow);
      m.material[1].emissiveIntensity = 1.2 * Math.exp(-s / .6); });
    for (let i = 0; i < SPN; i++) {
      const a = hash(i) * Math.PI * 2, sp = 4 + hash(i + 1) * 14, life = .5 + hash(i + 2) * 1.1, s = tt * (.5 + .5 * clamp(tt / .4)), k = s / life;
      const ox = Math.cos(a) * hash(i + 3) * 1.2, oy = .3 + Math.sin(a) * hash(i + 3) * 1.8;
      const vx = Math.cos(a) * sp * (.4 + hash(i + 4) * .6), vy = Math.sin(a) * sp * (.4 + hash(i + 4) * .6) + 2, vz = 2 + hash(i + 5) * 10;
      const drag = (1 - Math.exp(-s * 1.4)) / 1.4, x = ox + vx * drag, y = oy + vy * drag - 4.5 * s * s, z = WALLZ + .2 + vz * drag;
      const tail = .045, x2 = x - vx * tail * Math.exp(-s * 1.4), y2 = y - (vy - 9 * s) * tail * Math.exp(-s * 1.4), z2 = z - vz * tail * Math.exp(-s * 1.4);
      const br = k < 1 ? (1 - k) ** 1.5 * 2.2 : 0, cool = clamp(k * 1.4);
      sparkPos.set([x, y, z, x2, y2, z2], i * 6);
      const r_ = br, g_ = br * lerp(.75, .32, cool), b_ = br * lerp(.5, .08, cool); sparkCol.set([r_, g_, b_, r_ * .2, g_ * .1, b_ * .05], i * 6);
    }
    sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.color.needsUpdate = true;
  }
  const fl = t >= T.fracture ? Math.exp(-(t - T.fracture) / .22) : 0;
  flare.visible = wallOn; flare.material.opacity = .8 * fl + .25 * eInCubic(prog(t, T.cracks + .8, T.fracture)); flare.scale.setScalar(1.5 + 9 * fl + 2 * eInCubic(prog(t, T.cracks, T.fracture)));
  grade.uniforms.uFlash.value = .45 * fl;
  // ---------- S5/S6: BLACK FRIDAY world
  const bfOn = t > T.fracture - .3;
  for (const g of [bfBlack, bfFriday, akcija, zt, question, uskoro]) g.visible = bfOn;
  finalPhone.g.visible = bfOn && t > T.s6;
  backGlow.material.uniforms.uA.value = bfOn ? eOutCubic(prog(t, T.fracture, T.bf + .6)) * (1 - .9 * eInOutCubic(prog(t, T.s7, T.s7 + 1.4))) * (1 + .5 * Math.exp(-Math.max(0, t - T.bf) / .4) * (t > T.bf ? 1 : 0)) : 0;
  backGlow.material.uniforms.uT.value = t;
  bfSmoke.visible = bfOn; bfSmoke.userData.update(dt, bfOn ? eOutCubic(prog(t, T.bf, T.bf + 1.5)) * (1 - prog(t, T.s7, T.s7 + 1.5)) : 0);
  dust2.visible = bfOn; dust2.material.uniforms.uA.value = bfOn ? eOutCubic(prog(t, T.bf, T.bf + 1.5)) * (1 - prog(t, T.s7, T.s7 + 1.5)) : 0; dust2.material.uniforms.uT.value = dt * .6;
  convBeams.forEach((b, i) => { b.material.uniforms.uA.value = eOutCubic(prog(t, T.phone + i * .12, T.phone + 1 + i * .12)) * (1 - prog(t, T.s7, T.s7 + 1.2)) * .8; b.material.uniforms.uT.value = t; });
  if (bfOn) {
    // BLACK FRIDAY: letters punch towards the camera on the reveal, then hold with breathing orange edges; in the hero shot the faces glow orange
    setLetters(bfBlack, T.bf - .05, t, { dur: .7, st: .045, from: 'push', amt: 1.4 });
    setLetters(bfFriday, T.bf + .12, t, { dur: .7, st: .045, from: 'push', amt: 1.4 });
    const fade7 = eInOutCubic(prog(t, T.s7, T.s7 + 1.3));
    const edge = 1.15 * eOutExpo(prog(t, T.bf, T.bf + .5)) * (.88 + .12 * Math.sin(t * 3.1)) * (1 - fade7);
    const hot = eInOutCubic(prog(t, T.s6 + .2, T.s6 + 1.4)) * (1 - fade7);
    for (const g of [bfBlack, bfFriday]) { g.userData.side.emissiveIntensity = edge; g.userData.face.emissive.copy(ORHOT); g.userData.face.emissiveIntensity = .55 * hot; g.userData.face.opacity = g.userData.side.opacity = 1 - fade7; g.visible = fade7 < 1; }
    const grow = 1 + .5 * eInOutCubic(prog(t, T.s6, T.s6 + 1.2)), capH = .72 * 1.42 * bfBlack.userData.fit * grow, yc = lerp(.75, .25, eInOutCubic(prog(t, T.s6, T.s6 + 1.2)));
    bfBlack.scale.setScalar(bfBlack.userData.fit * grow); bfFriday.scale.setScalar(bfFriday.userData.fit * grow);
    bfBlack.position.set(0, yc + capH * .68, BFZ); bfFriday.position.set(0, yc - capH * .68, BFZ);
    // S5 lines (exact copy) with synchronized impacts
    setLetters(akcija, T.akcija, t, { dur: .55, st: .03, from: 'rise', amt: .6 });
    setLetters(zt, T.zt, t, { dur: .7, st: .035, from: 'track' });
    const out5 = eInOutCubic(prog(t, T.s5out, T.s6 + .2));
    akcija.position.set(0, -.82, BFZ + 1.2 + out5 * 2); if (t < T.logo) zt.position.set(0, -1.38, BFZ + 1.2 + out5 * 2);
    akcija.userData.side.emissiveIntensity = .55 * eOutCubic(prog(t, T.akcija, T.akcija + .5)); zt.userData.side.emissiveIntensity = .65 * eOutCubic(prog(t, T.zt, T.zt + .6));
    akcija.visible = out5 < 1; zt.visible = out5 < 1 || t > T.logo;
    akcija.userData.face.opacity = 1 - out5; if (t < T.logo) zt.userData.face.opacity = 1 - out5;
    // S6 hero phone rising in front, lines of the final frame
    const pr = eOutCubic(prog(t, T.phone, T.phone + 1.3));
    finalPhone.g.position.set(0, lerp(-5.5, -.12, pr) + Math.sin(t * .9) * .03, BFZ + 6.2); finalPhone.g.rotation.set(.03, lerp(.35, -.08, eInOutSine(prog(t, T.phone, T.end))), 0); finalPhone.face();
    finalPhone.mats().forEach(m => { m.uniforms.uA.value = pr * (1 - eInOutCubic(prog(t, T.s7 + .2, T.s7 + 1.2))); m.uniforms.uSweep.value = lerp(-.4, 1.4, prog(t, T.phone + .9, T.uskoro + .4)); m.uniforms.uSweepA.value = 1.1; m.uniforms.uRim.value = 1; });
    setLetters(question, T.question, t, { dur: .6, st: .025, from: 'rise', amt: .5 });
    question.position.set(0, 1.86, BFZ + 6.6); question.userData.side.emissiveIntensity = .5 * eOutCubic(prog(t, T.question, T.question + .5)) * (1 - prog(t, T.s7, T.s7 + .8));
    question.visible = t > T.question && t < T.s7 + .8; question.userData.face.opacity = 1 - prog(t, T.s7, T.s7 + .8);
    setLetters(uskoro, T.uskoro, t, { dur: .5, st: .04, from: 'push', amt: 1.1 });
    uskoro.position.set(0, -1.12, BFZ + 6.7); uskoro.visible = t > T.uskoro - .05 && t < T.s7 + .8;
    uskoro.userData.side.emissiveIntensity = 1.3 * eOutExpo(prog(t, T.uskoro, T.uskoro + .3)) * (1 - prog(t, T.s7, T.s7 + .8)); uskoro.userData.face.opacity = 1 - prog(t, T.s7, T.s7 + .8);
    // the logo: under the phone in the hero frame, then alone on black for the end card
    const lg = eInOutCubic(prog(t, T.s7 + .3, T.s7 + 1.4));
    if (t > T.logo) {
      setLetters(zt, T.logo, t, { dur: .7, st: .03, from: 'track' });
      zt.position.set(0, lerp(1.43, .15, lg), BFZ + 6.6 + lg * .4); zt.scale.setScalar(zt.userData.fit * lerp(.72, .86, lg)); zt.userData.face.opacity = 1;
      zt.userData.side.emissiveIntensity = (.75 + .2 * Math.sin(t * 2)) * eOutCubic(prog(t, T.logo, T.logo + .6)) * (1 - .4 * eInOutCubic(prog(t, T.end - .9, T.end)));
    } else zt.scale.setScalar(zt.userData.fit);
    const el = eOutCubic(prog(t, T.s7 + 1.0, T.s7 + 1.8)); endLine.position.set(0, -.18, BFZ + 7.05); endLine.material.uniforms.uA.value = el; endLine.material.uniforms.uW.value = el;
    rim.position.set(0, 1, BFZ + 4); rim.intensity = 50 * pr * (1 - prog(t, T.s7, T.s7 + 1));
    grade.uniforms.uFlash.value += .3 * (t > T.bf ? Math.exp(-(t - T.bf) / .2) : 0) + .22 * (t > T.uskoro ? Math.exp(-(t - T.uskoro) / .18) : 0);
  }
  composer.render();
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

async function boot() {
  const ttf = new TTFLoader(), buf = async f => (await fetch(f)).arrayBuffer();
  const a = ttf.parse(await buf('assets/montserrat-latin-900-normal.woff')), b = ttf.parse(await buf('assets/montserrat-latin-ext-900-normal.woff'));
  a.glyphs = { ...b.glyphs, ...a.glyphs }; FONT = new Font(a);
  const tx = async f => { const im = await load('assets/' + f); const t = new THREE.Texture(im); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return [t, im]; };
  const [tFront, iFront] = await tx('front.png'), [tBack] = await tx('back.png'), [tSil, iSil] = await tx('back_silver.png'), [tS26, iS26] = await tx('s26_back.png'), [tAir, iAir] = await tx('air_black.png');
  // logo on the monolith
  logoZ = text3d('ZONA', { size: 1.55, depth: .34, bevel: .04 }); logoZ.position.set(0, 1.0, .02 + .17); world.add(logoZ);
  logoT = text3d('TELEFONA', { size: .44, depth: .14, bevel: .018, tracking: .42, face: chrome(), side: edgeOrange() }); logoT.position.set(0, -.55, .02 + .07); world.add(logoT);
  // phones (real stills) floating in the field
  hero = new Phone(tFront, tBack, 3.2);
  cards = [
    { img: iS26, tex: tS26, h: 3.0, x: -2.7, y: .55, z: -25.5, ry: .22, d: .35 },
    { img: iAir, tex: tAir, h: 3.0, x: 2.9, y: -.25, z: -26.5, ry: -.18, d: .55 },
    { img: iSil, tex: tSil, h: 2.7, x: -1.9, y: -.9, z: -17.5, ry: .3, d: .1 },
  ].map(c => ({ ...c, mesh: card(c.tex, c.img, c.h) }));
  streaks = new THREE.Group(); world.add(streaks);
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(5 + hash(i) * 6, .025 + hash(i + 1) * .03), new THREE.ShaderMaterial({ ...ADD, fog: false, uniforms: { uA: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float k=smoothstep(0.,.7,vUv.x)*smoothstep(1.,.85,vUv.x)*(1.-abs(vUv.y-.5)*2.); gl_FragColor=vec4(vec3(1.,.45,.18)*k*uA*1.6,1.); }` }));
    m.userData = { v: 6 + hash(i + 2) * 10, o: hash(i + 3) * 40, y: -2.5 + hash(i + 4) * 5.5, z: -31 - hash(i + 5) * 4 }; streaks.add(m); }
  // BLACK FRIDAY + exact lines
  const tmb = () => { const m = metalBlack(); m.transparent = true; return m; }, tmo = () => { const m = edgeOrange(); m.transparent = true; return m; };
  bfBlack = text3d('BLACK', { size: 1.42, depth: .55, bevel: .05, face: tmb(), side: tmo() }); bfFriday = text3d('FRIDAY', { size: 1.42, depth: .55, bevel: .05, face: tmb(), side: tmo() });
  const bfS = 3.3 / Math.max(bfBlack.userData.width, bfFriday.userData.width);      // S5: BLACK FRIDAY fills the frame width at 10.5 m
  for (const g of [bfBlack, bfFriday]) { g.userData.fit = bfS; world.add(g); }
  const transparentFace = () => new THREE.MeshStandardMaterial({ color: 0xf2eee8, metalness: .35, roughness: .32, envMapIntensity: .9, emissive: new THREE.Color(.9, .86, .8), emissiveIntensity: .58, transparent: true });
  const fit = (g, w) => { g.userData.fit = w / g.userData.width; g.scale.setScalar(g.userData.fit); world.add(g); };
  akcija = text3d('AKCIJA STIŽE U', { size: .46, depth: .12, bevel: .015, face: transparentFace(), side: edgeOrange() }); fit(akcija, 2.7);
  zt = text3d('ZONA TELEFONA', { size: .5, depth: .14, bevel: .018, face: transparentFace(), side: edgeOrange() }); fit(zt, 2.5);
  question = text3d('BLACK FRIDAY AKCIJA?', { size: .3, depth: .08, bevel: .012, face: transparentFace(), side: edgeOrange() }); fit(question, 2.45);
  const uskFace = transparentFace();
  uskoro = text3d('USKORO.', { size: .78, depth: .2, bevel: .025, face: uskFace, side: edgeOrange() }); fit(uskoro, 2.0);
  finalPhone = new Phone(tFront, tBack, 1.95);
  ZX = logoZ.position.x + logoZ.userData.chars[0].userData.home.x; ZY = logoZ.position.y; buildPath();
  window.setTime = setTime; window.__T = T;
  await setTime(0); window.READY = true;
}
boot();
