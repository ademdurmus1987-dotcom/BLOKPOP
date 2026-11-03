// BLOKPOP Yapi v3 (prototip) - direk ustundeki yuvarlak platformda iri metal kuplerden bir yapi; altta Pofi durur.
// Oyuncu yapida bir yere dokunur, Pofi hortumuyla oraya top atar. Kupler gercek fizikle (cannon-es) devrilir, platformdan
// dusen her kup sayilir. Hepsi dusunce bolum biter; toplar biterse kaybedilir.
import * as THREE from '../three.module.min.js';
import * as CANNON from '../cannon.min.js';
import { GLTFLoader } from '../GLTFLoader.js';
import { clone as skClone } from '../SkeletonUtils.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search), TEST = Q.has('test');
const SKEY = 'blokpop_yapi_v3';
let SV = { L: 1, max: 1 };
try { const d = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (d) SV = Object.assign(SV, d); } catch (e) {}
const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(SV)); } catch (e) {} };

// ---------------- olculer ----------------
const S = 1.55;          // kup kenari (iri)
const R0 = 6.1;          // platform modelinin yaricapi
let R = R0, TOPY = 6;              // bu bolumdeki yaricap: yapinin hemen disi, itilen kup kenardan dussun
const POFI = new THREE.Vector3(0, -1.3, 9.6);   // Pofi'nin ayak yeri (z bolume gore platformun onune konur)
const GONE_Y = -1.2;     // bunun altina inen kup platformdan dusmus sayilir

// ---------------- cizim ----------------
const glc = $('gl');
const ren = new THREE.WebGLRenderer({ canvas: glc, antialias: true, alpha: true, preserveDrawingBuffer: TEST }); ren.setClearColor(0, 0);
ren.setPixelRatio(Math.min(2, devicePixelRatio || 1));
ren.outputColorSpace = THREE.SRGBColorSpace; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.15;
ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(40, 1, 0.5, 200);
scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6a7a5a, 1.25));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.6); sun.position.set(-8, 18, 10); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 14, bottom: -8, near: 2, far: 50 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun);
const rim = new THREE.DirectionalLight(0xcfe0ff, 0.9); rim.position.set(9, 6, -8); scene.add(rim);

function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
// seker cubugu seridi (capraz), platform kenari, direk ve Pofi kaidesi icin
const stripe = (a, b, rep) => canvasTex(256, 64, (x, w, h) => { x.fillStyle = b; x.fillRect(0, 0, w, h); x.fillStyle = a; for (let i = -2; i < 10; i++) { x.beginPath(); x.moveTo(i * 32, h); x.lineTo(i * 32 + 16, h); x.lineTo(i * 32 + 16 + 24, 0); x.lineTo(i * 32 + 24, 0); x.closePath(); x.fill(); }
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, rep);
const MAT = {
  side: new THREE.MeshStandardMaterial({ map: stripe('#e8326e', '#fff6f0', [6, 1]), roughness: 0.45 }),
  pole: new THREE.MeshStandardMaterial({ map: stripe('#7b4dff', '#fff6f0', [2, 14]), roughness: 0.45 }),
  top: new THREE.MeshStandardMaterial({ map: canvasTex(512, 512, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, '#fff3dc'); g.addColorStop(0.8, '#f2d9ad'); g.addColorStop(1, '#d9b37a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(150,100,50,.22)'; x.lineWidth = 3; for (let r = 60; r < w / 2; r += 60) { x.beginPath(); x.arc(w / 2, h / 2, r, 0, 7); x.stroke(); }
    for (let a = 0; a < 16; a++) { x.beginPath(); x.moveTo(w / 2 + Math.cos(a * Math.PI / 8) * 60, h / 2 + Math.sin(a * Math.PI / 8) * 60); x.lineTo(w / 2 + Math.cos(a * Math.PI / 8) * w / 2, h / 2 + Math.sin(a * Math.PI / 8) * h / 2); x.stroke(); } }), roughness: 0.75 }),
  gold: new THREE.MeshStandardMaterial({ color: '#ffc43d', roughness: 0.3, metalness: 0.55, emissive: '#5a3000', emissiveIntensity: 0.25 })
};

// platform: kalin yuvarlak tabla, altin kenar, altta huni, cizgili direk
const stage = new THREE.Group(), pedG = new THREE.Group(); scene.add(stage, pedG);
{
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.8, 64), [MAT.side, MAT.top, MAT.side]); top.position.y = -0.4; top.receiveShadow = true; top.castShadow = true; stage.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.14, 12, 80), MAT.gold); ring.rotation.x = Math.PI / 2; stage.add(ring);
  const ring2 = ring.clone(); ring2.position.y = -0.8; stage.add(ring2);
  const fun = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.6, 1.0, 2.2, 48), MAT.side); fun.position.y = -1.9; fun.castShadow = true; stage.add(fun);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 40, 32), MAT.pole); pole.position.y = -23; stage.add(pole);
  // Pofi kaidesi
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.6, 48), [MAT.side, MAT.top, MAT.side]); ped.position.y = -0.3; ped.receiveShadow = true; pedG.add(ped);
  const pr = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 10, 48), MAT.gold); pr.rotation.x = Math.PI / 2; pedG.add(pr);
  const pp = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 30, 24), MAT.pole); pp.position.y = -15.6; pedG.add(pp);
}

// ---------------- kup gorunusu ----------------
// Adem'in metal-disli kup yuzu (kup_yuz.webp); metal kupun rengine boyanir, ortadaki cekirdek parlar
function roundBox(w, h, d, r, seg) {
  const g0 = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g0.attributes.position, nr = g0.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3();
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r, cl = (x, a) => Math.max(-a, Math.min(a, x));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); c.set(cl(v.x, hw), cl(v.y, hh), cl(v.z, hd)); v.sub(c);
    const L = v.length(); if (L > 1e-6) v.multiplyScalar(1 / L); else v.fromBufferAttribute(nr, i); nr.setXYZ(i, v.x, v.y, v.z);
    p.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
  }
  return g0;
}
const CUBEGEO = roundBox(S, S, S, S * 0.09, 5);
const CORE = { x: 0.4961, y: 0.5181, r: 0.2079 };
const FACE = new Image(); const KMAT = {};
const GLOWMASK = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); const gr = x.createRadialGradient(CORE.x * w, CORE.y * h, 0, CORE.x * w, CORE.y * h, CORE.r * w * 1.02); gr.addColorStop(0, '#fff'); gr.addColorStop(0.75, '#c8c8c8'); gr.addColorStop(1, '#000'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
function kupMat(col) {
  if (KMAT[col]) return KMAT[col];
  const ok = FACE.complete && FACE.naturalWidth > 0;
  const t = canvasTex(256, 256, (x, w, h) => {
    if (ok) x.drawImage(FACE, 0, 0, w, h); else { x.fillStyle = '#8a8478'; x.fillRect(0, 0, w, h); }
    // metal once aydinlatilir, sonra rengine boyanir: sari/turuncu camurlasmasin, golge ve vida dokusu kalsin
    x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.35; x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.restore();
    x.save(); x.globalCompositeOperation = 'color'; x.globalAlpha = 1; x.fillStyle = col; x.fillRect(0, 0, w, h); x.restore();
    x.save(); x.globalCompositeOperation = 'overlay'; x.globalAlpha = 0.55; x.fillStyle = col; x.fillRect(0, 0, w, h); x.restore();
    x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.18; x.fillStyle = col; x.fillRect(0, 0, w, h); x.restore();
    const cx = CORE.x * w, cy = CORE.y * h, Rr = CORE.r * w, c = new THREE.Color(col), hi = '#' + c.clone().lerp(new THREE.Color('#ffffff'), 0.55).getHexString();
    const gr = x.createRadialGradient(cx - Rr * 0.25, cy - Rr * 0.3, Rr * 0.05, cx, cy, Rr * 0.98); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.2, hi); gr.addColorStop(0.75, col); gr.addColorStop(1, '#' + c.clone().multiplyScalar(0.45).getHexString());
    x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, Rr * 0.98, 0, 6.283); x.fill();
    x.lineWidth = w * 0.014; x.strokeStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.arc(cx, cy, Rr * 0.8, 3.6, 5.2); x.stroke();
  });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.38, metalness: 0.05, emissive: col, emissiveMap: GLOWMASK, emissiveIntensity: 0.75 });
  KMAT[col] = m; return m;
}
const faceReady = new Promise((res) => { FACE.onload = FACE.onerror = res; FACE.src = 'kup_yuz.webp?v=1'; });

// ---------------- bolumler ----------------
const C = { kir: '#ff4256', tur: '#ff9a1f', sar: '#ffd23f', mav: '#3d7bff', mor: '#a25cff', yes: '#2fcf73', pem: '#ff6fcf', tur2: '#22c8e8' };
// her bolum: kup listesi [i, j(kat), k, renk] (izgara birimi), top sayisi, arka plan
function box(o, i0, i1, j0, j1, k0, k1, col) { for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) o.push([i, j, k, typeof col === 'function' ? col(i, j, k) : col]); return o; }
const LEVELS = [
  { ad: 'Renkli Duvar', top: 9, bg: 1, make: () => box([], 0, 5, 0, 3, 0, 1, (i, j) => (j < 2 ? ((i + j) % 4 === 1 ? C.sar : C.kir) : (i % 3 === 1 && j === 3 ? C.sar : C.tur))) },
  { ad: 'İkiz Kuleler', top: 10, bg: 1, make: () => { const o = []; box(o, 0, 1, 0, 5, 0, 1, (i, j) => (j === 5 ? C.sar : C.mav)); box(o, 5, 6, 0, 5, 0, 1, (i, j) => (j === 5 ? C.sar : C.mav)); box(o, 2, 4, 0, 2, 0, 0, (i, j) => (j === 1 && i === 3 ? C.sar : C.kir)); box(o, 2, 4, 0, 1, 1, 1, C.tur); return o; } },
  { ad: 'Piramit', top: 9, bg: 3, make: () => { const o = [], cols = [C.mor, C.pem, C.tur, C.sar, C.kir, C.yes]; for (let l = 0; l < 6; l++) box(o, l / 2, 5 - l / 2, l, l, 0, 1, cols[l]); return o; } },
  { ad: 'Kale', top: 12, bg: 1, make: () => { const o = []; box(o, 0, 6, 0, 2, 0, 1, (i, j) => (j === 1 && (i === 2 || i === 4) ? C.sar : C.kir)); box(o, 0, 0, 3, 5, 0, 1, (i, j) => (j === 5 ? C.mor : C.mav)); box(o, 6, 6, 3, 5, 0, 1, (i, j) => (j === 5 ? C.mor : C.mav)); box(o, 2, 4, 3, 4, 1, 1, C.tur); return o; } },
  { ad: 'Dev Kule', top: 10, bg: 2, make: () => box([], 0, 2, 0, 6, 0, 2, (i, j) => [C.yes, C.tur2, C.mav, C.mor, C.pem, C.kir, C.sar][j]) },
  { ad: 'Basamaklar', top: 9, bg: 3, make: () => { const o = []; for (let i = 0; i < 6; i++) box(o, i, i, 0, 5 - i, 0, 1, (ii, j) => (j % 2 ? C.yes : C.tur2)); return o; } }
];
function levelOf(L) { return LEVELS[(L - 1) % LEVELS.length]; }

// ---------------- fizik ----------------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -24, 0) });
world.broadphase = new CANNON.SAPBroadphase(world); world.allowSleep = true; world.solver.iterations = 14; world.solver.tolerance = 0.0005;
const PM = { cube: new CANNON.Material('kup'), ball: new CANNON.Material('top'), plat: new CANNON.Material('tabla') };
world.addContactMaterial(new CANNON.ContactMaterial(PM.cube, PM.cube, { friction: 0.38, restitution: 0.04 }));
world.addContactMaterial(new CANNON.ContactMaterial(PM.cube, PM.plat, { friction: 0.4, restitution: 0.05 }));
world.addContactMaterial(new CANNON.ContactMaterial(PM.ball, PM.cube, { friction: 0.2, restitution: 0.25 }));
world.addContactMaterial(new CANNON.ContactMaterial(PM.ball, PM.plat, { friction: 0.3, restitution: 0.3 }));
const platBody = new CANNON.Body({ mass: 0, material: PM.plat }); world.addBody(platBody);
const CUBESHAPE = new CANNON.Box(new CANNON.Vec3(S / 2, S / 2, S / 2));

// ---------------- oyun durumu ----------------
let LV = 1, g = null;
const cubes = [], balls = [];
function clearLevel() {
  for (const c of cubes) { world.removeBody(c.body); scene.remove(c.mesh); }
  for (const b of balls) { world.removeBody(b.body); scene.remove(b.mesh); }
  cubes.length = 0; balls.length = 0;
}
function buildLevel() {
  clearLevel();
  const Y = levelOf(LV), list = Y.make();
  let i0 = 1e9, i1 = -1e9, k0 = 1e9, k1 = -1e9; for (const c of list) { i0 = Math.min(i0, c[0]); i1 = Math.max(i1, c[0]); k0 = Math.min(k0, c[2]); k1 = Math.max(k1, c[2]); }
  const ci = (i0 + i1) / 2, ck = (k0 + k1) / 2;
  // platform yapiya gore: en uzak kup kosesinin hemen disi
  R = 0;
  for (const [i, , k] of list) { const x = Math.abs(i - ci) * S + S / 2, z = Math.abs(k - ck) * S + S / 2; R = Math.max(R, Math.hypot(x, z)); }
  R = Math.max(3.4, R + 0.3); TOPY = 0; for (const c of list) TOPY = Math.max(TOPY, (c[1] + 1) * S);
  stage.scale.set(R / R0, 1, R / R0);
  while (platBody.shapes.length) platBody.removeShape(platBody.shapes[0]);
  platBody.addShape(new CANNON.Cylinder(R, R, 0.8, 32), new CANNON.Vec3(0, -0.4, 0));
  POFI.z = R + 3.6; pedG.position.copy(POFI); PF.holder.position.copy(POFI); fit();
  for (const [i, j, k, col] of list) {
    const body = new CANNON.Body({ mass: 1, material: PM.cube, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.4, linearDamping: 0.02, angularDamping: 0.06 });
    body.addShape(CUBESHAPE); body.position.set((i - ci) * S, S / 2 + j * (S + 0.002), (k - ck) * S); world.addBody(body); body.sleep();
    const mesh = new THREE.Mesh(CUBEGEO, kupMat(col)); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    cubes.push({ body, mesh, col, gone: false, out: false });
  }
  syncMeshes();
  g = { L: LV, ad: Y.ad, total: cubes.length, left: cubes.length, shots: Y.top, max: Y.top, state: 'play', t: 0, busy: 0, quiet: 0, combo: null };
  $('bg').style.backgroundImage = 'url(../bg/w0' + Y.bg + '.webp)';
  $('nm').textContent = Y.ad; $('hint').style.opacity = 1;
  hud(true);
}
function syncMeshes() { for (const c of cubes) { c.mesh.position.copy(c.body.position); c.mesh.quaternion.copy(c.body.quaternion); } }
function wakeAll() { for (const c of cubes) if (!c.out) c.body.wakeUp(); }

// ---------------- Pofi ----------------
// live_pofi.glb (Tripo modeli); govde rengi seviyeye gore boyanir. Kosma klibinin bir karesinde durur, nefes alir, atista hortumu kalkar.
const PDEF = { hue1: 0.585, sat0: 0.22, val0: 0.42, bake: 0.35, hue2: [2, 2] };
const POFICOL = ['#3d9bff', '#ff5aa8', '#2fcf73', '#a25cff', '#ff9a1f', '#22c8e8'];
function tintMat(src, d, col) {
  const m = src.clone(); m.metalness = 0; m.roughness = 0.5; m.normalScale = new THREE.Vector2(0.6, 0.6);
  const c = new THREE.Color(col); m.customProgramCacheKey = () => 'yp' + col;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCol = { value: c };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uCol;\n' +
      'vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1.0e-10;return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);}')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 sc = pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2)); vec3 hv = rgb2hsv(sc);
        float bodyW = smoothstep(0.33, 0.37, hv.x) * (1.0 - smoothstep(${d.hue1.toFixed(3)} - 0.02, ${d.hue1.toFixed(3)} + 0.02, hv.x)) * smoothstep(${(d.sat0 - 0.05).toFixed(3)}, ${(d.sat0 + 0.05).toFixed(3)}, hv.y) * smoothstep(${(d.val0 - 0.06).toFixed(3)}, ${(d.val0 + 0.06).toFixed(3)}, hv.z);
        float lum = dot(sc, vec3(0.3, 0.59, 0.11));
        vec3 body = uCol * mix(1.0, clamp(lum / 0.62, 0.55, 1.35), ${d.bake.toFixed(3)});
        vec3 warm = pow(vec3(lum) * vec3(1.03, 1.0, 0.93), vec3(2.2)); vec3 det = mix(diffuseColor.rgb, warm, 1.0 - smoothstep(0.18, 0.4, hv.y));
        diffuseColor.rgb = mix(det, body, bodyW);`);
  };
  return m;
}
const bonesOf = (root) => { const b = {}; root.traverse((o) => { if (o.isBone) b[o.name.replace(/^mixamorig:?/, '')] = o; }); return b; };
// Tripo iskeletinde hortum kemigi yok: basa iki kemik eklenir, hortum noktalari onlara baglanir (live3d.js ile ayni kural)
function addTrunk(model, mesh) {
  const bones = bonesOf(model), head = bones.Head; if (!head) return;
  mesh.skeleton.pose(); model.updateMatrixWorld(true);
  const sk = mesh.skeleton, hi = sk.bones.indexOf(head), T1 = new THREE.Bone(), T2 = new THREE.Bone(); T1.name = 'Trunk1'; T2.name = 'Trunk2';
  head.add(T1); T1.position.copy(head.worldToLocal(new THREE.Vector3(0.02, 0.54, 0.15))); T1.updateMatrixWorld(true);
  T1.add(T2); T2.position.copy(T1.worldToLocal(new THREE.Vector3(0.07, 0.47, 0.21))); T2.updateMatrixWorld(true);
  const i1 = sk.bones.length, i2 = i1 + 1, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, pos = mesh.geometry.attributes.position, w = new THREE.Vector3();
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < pos.count; i++) {
    let bi = 0, bw = -1; for (let k = 0; k < 4; k++) { const ww = sw.getComponent(i, k); if (ww > bw) { bw = ww; bi = si.getComponent(i, k); } }
    if (bi !== hi) continue;
    mesh.getVertexPosition(i, w); w.applyMatrix4(mesh.matrixWorld);
    if (w.z < 0.11 || w.y > 0.57 || w.y < 0.3 || Math.abs(w.x - 0.05) > 0.14) continue;
    const t = Math.max(0, Math.min(1, ((0.57 - w.y) / 0.18) * 0.55 + ((w.z - 0.11) / 0.16) * 0.45)); if (t < 0.05) continue;
    const a = ss(0.05, 0.35, t), b = ss(0.45, 0.85, t);
    si.setXYZW(i, hi, i1, i2, 0); sw.setXYZW(i, 1 - a, a * (1 - b), a * b, 0);
  }
  si.needsUpdate = sw.needsUpdate = true;
  mesh.bind(new THREE.Skeleton(sk.bones.concat([T1, T2]), sk.boneInverses.concat([T1.matrixWorld.clone().invert(), T2.matrixWorld.clone().invert()])), mesh.bindMatrix);
}
const PF = { holder: new THREE.Group(), ok: false, yaw: Math.PI, aimYaw: Math.PI, rec: 0, mats: {}, col: null };
PF.holder.position.copy(POFI); scene.add(PF.holder);
const pofiReady = new Promise((res) => {
  new GLTFLoader().load('../live_pofi.glb', (gl) => {
    const src = gl.scene; let m0 = null; src.traverse((o) => { if (o.isSkinnedMesh) m0 = o; }); if (!m0) return res();
    addTrunk(src, m0);
    const root = skClone(src); let mesh = null; root.traverse((x) => { if (x.isSkinnedMesh) { mesh = x; x.frustumCulled = false; x.castShadow = true; } });
    const bb = new THREE.Box3().setFromObject(src), h0 = bb.max.y - bb.min.y, sc = 3.6 / h0;
    root.scale.setScalar(sc); root.position.y = -bb.min.y * sc;
    PF.body = new THREE.Group(); PF.body.add(root); PF.holder.add(PF.body);
    PF.mixer = new THREE.AnimationMixer(root); PF.act = PF.mixer.clipAction(gl.animations[0]); PF.act.play();
    PF.dur = gl.animations[0].duration; PF.root = root; PF.mesh = mesh; PF.src = m0.material; PF.b = bonesOf(root); PF.ok = true;
    setPofiCol(POFICOL[(LV - 1) % POFICOL.length]); res();
  }, undefined, () => res());
});
function setPofiCol(col) { if (!PF.ok || PF.col === col) return; if (!PF.mats[col]) PF.mats[col] = tintMat(PF.src, PDEF, col); PF.mesh.material = PF.mats[col]; PF.col = col; }
const TIP = new THREE.Vector3();
function trunkTip(out) {
  if (PF.ok && PF.b.Trunk2) { PF.root.updateMatrixWorld(true); PF.b.Trunk2.getWorldPosition(out); return out; }
  return out.set(POFI.x, POFI.y + 2.2, POFI.z - 0.6);
}
function updatePofi(dt) {
  PF.rec = Math.max(0, PF.rec - dt * 3.2);
  let d = PF.aimYaw - PF.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); PF.yaw += d * Math.min(1, dt * 14);
  PF.holder.rotation.y = PF.yaw;
  if (!PF.ok) return;
  // durus: kosma klibinin sakin bir karesi; hafif nefes; atista ezilip uzama
  PF.act.time = PF.dur * 0.12 + Math.sin(g ? g.t * 2 : 0) * PF.dur * 0.02; PF.mixer.update(0);
  const br = Math.sin((g ? g.t : 0) * 3) * 0.015, r = PF.rec, sq = Math.sin(Math.min(1, r) * Math.PI) * 0.18;
  PF.body.scale.set(1 + sq * 0.6 - br, 1 - sq + br, 1 + sq * 0.6 - br);
  PF.body.rotation.x = -r * 0.22;
  if (PF.b.Trunk1) { PF.b.Trunk1.rotation.x -= r * 0.9; PF.b.Trunk2.rotation.x -= r * 0.6; }
}

// ---------------- toplar ----------------
const BALLGEO = new THREE.SphereGeometry(0.62, 32, 20);
const TRAILGEO = new THREE.SphereGeometry(0.32, 12, 8);
function shoot(target) {
  if (!g || g.state !== 'play' || g.shots <= 0) return false;
  const now = g.t; if (g.lastShot && now - g.lastShot < 0.32) return false;
  g.lastShot = now; g.shots--; PF.rec = 1;
  PF.aimYaw = Math.atan2(target.x - POFI.x, target.z - POFI.z);
  PF.holder.rotation.y = PF.yaw = PF.aimYaw;   // atis aninda hedefe donuk olsun ki top hortumdan ciksin
  const st = trunkTip(TIP).clone();
  // yay: v = (hedef - baslangic)/T - g*T/2. En kisa ucus suresi secilir ama top platformun on kenarini (z = R) en az
  // 0.9 yukaridan asmali, yoksa kenara carpip geri seker
  const dv = target.clone().sub(st), gy = world.gravity.y, edge = Math.min(1, Math.max(0, (st.z - R) / Math.max(0.01, st.z - target.z)));
  let T = Math.max(0.32, Math.min(0.6, dv.length() / 34));
  for (; T < 1.2; T += 0.03) { const te = edge * T, vy = dv.y / T - 0.5 * gy * T; if (st.y + vy * te + 0.5 * gy * te * te > 0.9) break; }
  const v = new CANNON.Vec3(dv.x / T, dv.y / T - 0.5 * gy * T, dv.z / T);
  const col = PF.col || '#3d9bff';
  const body = new CANNON.Body({ mass: 30, material: PM.ball, linearDamping: 0.01, allowSleep: false }); body.addShape(new CANNON.Sphere(0.62));
  body.position.set(st.x, st.y, st.z); body.velocity.copy(v); world.addBody(body);
  const mesh = new THREE.Mesh(BALLGEO, new THREE.MeshStandardMaterial({ color: col, roughness: 0.15, metalness: 0.1, emissive: col, emissiveIntensity: 0.45 })); mesh.castShadow = true; scene.add(mesh);
  const b = { body, mesh, t: 0, hit: false, trail: [], col };
  body.addEventListener('collide', (e) => { if (b.hit) return; b.hit = true; impact(b, e); });
  balls.push(b);
  g.combo = { n: 0, t: 0, shown: 0 };
  burst(st, col, 8, 4); sfx('shoot'); hud();
  $('hint').style.opacity = 0;
  return true;
}
function impact(b) {
  wakeAll(); g.busy = 2.5; shake = Math.min(0.5, shake + 0.32);
  burst(new THREE.Vector3().copy(b.body.position), '#fff3a0', 18, 9); sfx('hit');
}
function updateBalls(dt) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i]; b.t += dt; b.mesh.position.copy(b.body.position); b.mesh.quaternion.copy(b.body.quaternion);
    // iz: arkasinda kuculen parlak toplar
    if (b.t < 1.5) { const tr = new THREE.Mesh(TRAILGEO, new THREE.MeshBasicMaterial({ color: b.col, transparent: true, opacity: 0.55, depthWrite: false })); tr.position.copy(b.mesh.position); scene.add(tr); b.trail.push({ m: tr, life: 0.28 }); }
    for (let j = b.trail.length - 1; j >= 0; j--) { const p = b.trail[j]; p.life -= dt; const k = Math.max(0, p.life / 0.28); p.m.scale.setScalar(k); p.m.material.opacity = 0.55 * k; if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); b.trail.splice(j, 1); } }
    if (b.body.position.y < -16 || b.t > 7) { for (const p of b.trail) { scene.remove(p.m); p.m.material.dispose(); } world.removeBody(b.body); scene.remove(b.mesh); b.mesh.material.dispose(); balls.splice(i, 1); }
  }
}

// ---------------- parcaciklar ----------------
const PGEO = new THREE.BoxGeometry(0.22, 0.22, 0.22), parts = [];
function burst(p, col, n, sp) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(PGEO, new THREE.MeshBasicMaterial({ color: Math.random() < 0.4 ? '#ffffff' : col, transparent: true }));
    m.position.copy(p); scene.add(m);
    const a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = sp * (0.5 + Math.random() * 0.7), q = Math.sqrt(1 - u * u);
    parts.push({ m, v: new THREE.Vector3(Math.cos(a) * q * s, Math.abs(u) * s + 2, Math.sin(a) * q * s), life: 0.6 + Math.random() * 0.4, r: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0) });
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; p.v.y -= 20 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += p.r.x * dt; p.m.rotation.y += p.r.y * dt;
    p.m.material.opacity = Math.min(1, p.life * 2.5); p.m.scale.setScalar(Math.max(0.1, Math.min(1, p.life * 2)));
    if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); }
  }
}

// ---------------- kup dusmesi, ovgu, kazanma/kaybetme ----------------
const V = new THREE.Vector3();
let lastFl = 0;
function updateCubes(dt) {
  let moving = false;
  for (const c of cubes) {
    if (c.out) continue;
    const p = c.body.position;
    if (!c.gone && p.y < GONE_Y) {
      c.gone = true; g.left--; if (g.combo) { g.combo.n++; g.combo.t = 0; }
      sfx('pop', g.combo ? g.combo.n : 1); hud();
      if (g.t - lastFl > 0.05) { lastFl = g.t; V.copy(p); V.y = 0.3; V.project(cam); floatText('+1', (V.x + 1) / 2 * innerWidth, (1 - V.y) / 2 * innerHeight); }
    }
    if (p.y < -18) { c.out = true; world.removeBody(c.body); scene.remove(c.mesh); continue; }
    if (c.body.sleepState !== CANNON.Body.SLEEPING && c.body.velocity.lengthSquared() > 0.6) moving = true;
  }
  // bir sey hareket ettikce hepsi uyanik kalir: alttaki kup gidince ustteki uyurken havada kalmasin
  if (moving) { g.busy = Math.max(g.busy, 0.6); wakeAll(); }
  g.busy = Math.max(0, g.busy - dt);
  if (g.combo) { g.combo.t += dt; const n = g.combo.n;
    const lv = n >= 24 ? 3 : n >= 12 ? 2 : n >= 5 ? 1 : 0;
    if (lv > g.combo.shown) { g.combo.shown = lv; praise(['', 'Süper!', 'Harika!', 'EFSANE!'][lv], '+' + n + ' küp'); }
    if (g.combo.t > 3) g.combo = null; }
  if (g.state === 'play') {
    if (g.left <= 0) { g.state = 'win'; setTimeout(win, 900); }
    else if (g.shots <= 0 && !balls.length && g.busy <= 0) { g.quiet += dt; if (g.quiet > 1.2) { g.state = 'lose'; lose(); } }
    else g.quiet = 0;
  }
}

// ---------------- ses (kucuk sentez) ----------------
let AC = null;
function sfx(k, n) {
  if (!AC) return; const t = AC.currentTime, o = AC.createOscillator(), v = AC.createGain(); o.connect(v); v.connect(AC.destination);
  if (k === 'shoot') { o.type = 'sine'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.18); v.gain.setValueAtTime(0.35, t); v.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.start(t); o.stop(t + 0.22); }
  else if (k === 'hit') { o.type = 'triangle'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); v.gain.setValueAtTime(0.4, t); v.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.start(t); o.stop(t + 0.32);
    const nb = AC.createBuffer(1, AC.sampleRate * 0.25, AC.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), gv = AC.createGain(); f.type = 'lowpass'; f.frequency.value = 900; gv.gain.value = 0.5; s.buffer = nb; s.connect(f); f.connect(gv); gv.connect(AC.destination); s.start(t); }
  else { o.type = 'square'; const f0 = 420 * Math.pow(1.06, Math.min(24, n || 1)); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.06); v.gain.setValueAtTime(0.06, t); v.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.start(t); o.stop(t + 0.11); }
}

// ---------------- arayuz ----------------
const prev = {};
function setNum(id, v, anim) { const e = $(id); if (prev[id] !== v) { e.textContent = v; if (anim && prev[id] != null) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); } prev[id] = v; } }
function hud(reset) {
  if (!g) return;
  $('lv').textContent = 'Yapı'; setNum('lvn', LV, false);
  setNum('kc', g.left, !reset); setNum('tc', g.shots, !reset);
  $('pb').style.width = Math.round(100 * (1 - g.left / g.total)) + '%';
}
function praise(t, s) { const p = $('praise'); p.innerHTML = '<div class="p g1">' + t + '<i>' + s + '</i></div>'; }
function floatText(t, x, y) { const e = document.createElement('div'); e.className = 'fl'; e.textContent = t; e.style.left = x + 'px'; e.style.top = y + 'px'; document.body.appendChild(e); setTimeout(() => e.remove(), 950); }
function modal(h) { $('card').innerHTML = h; $('modal').classList.add('on'); }
function closeModal() { $('modal').classList.remove('on'); }
function win() {
  SV.max = Math.max(SV.max, LV + 1); save();
  const r = g.shots / g.max, st = r >= 0.4 ? 3 : r >= 0.15 ? 2 : 1;
  for (let i = 0; i < 4; i++) setTimeout(() => burst(new THREE.Vector3((Math.random() - 0.5) * 8, 4 + Math.random() * 4, 0), POFICOL[i % POFICOL.length], 30, 10), i * 180);
  modal('<div class="tag">Yapı ' + LV + '</div><div class="stars">' + '★'.repeat(st) + '<span style="opacity:.25">' + '★'.repeat(3 - st) + '</span></div><h2>Yapı yıkıldı!</h2><p>' + g.shots + ' top arttı</p><button class="btn" id="nx">Sonraki ▶</button>');
  $('nx').onclick = () => start(LV + 1);
}
function lose() {
  modal('<div class="tag r">Yapı ' + LV + '</div><h2>Toplar bitti!</h2><p>' + g.left + ' küp kaldı.</p><button class="btn" id="rt">Tekrar dene</button><button class="btn o" id="rv">+3 top ile devam</button>');
  $('rt').onclick = () => start(LV);
  $('rv').onclick = () => { g.shots += 3; g.state = 'play'; g.quiet = 0; closeModal(); hud(); };
}
$('re').onclick = () => start(LV);
$('home').onclick = () => { location.href = '../'; };

// dokunma: once kuplere, yoksa yapinin onundeki dikey duzleme nisan alinir
const ray = new THREE.Raycaster(), NDC = new THREE.Vector2(), AIMPL = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.0);
function aimAt(cx, cy) {
  NDC.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(NDC, cam);
  const hits = ray.intersectObjects(cubes.filter((c) => !c.gone).map((c) => c.mesh), false);
  if (hits.length) return hits[0].point.clone().addScaledVector(ray.ray.direction, 0.3);
  const p = new THREE.Vector3(); return ray.ray.intersectPlane(AIMPL, p) ? p : null;
}
glc.addEventListener('pointerdown', (e) => {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (x) {} }
  const p = aimAt(e.clientX, e.clientY); if (p) shoot(p);
});

// ---------------- kamera ----------------
// platformun tamami ve altta Pofi ekrana sigar; dar (telefon) ekranda geriye cekilir
function fit() {
  const W = innerWidth, H = innerHeight; ren.setSize(W, H, false); cam.aspect = W / H;
  cam.fov = 38; const hf = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect);
  // yatayda platform, dikeyde yapinin tepesinden Pofi'nin ayagina kadar sigsin
  const y0 = POFI.y - 1.2, y1 = TOPY + 1.4, tg = new THREE.Vector3(0, (y0 + y1) / 2 + 0.6, POFI.z * 0.25);
  const d = Math.max(14, (R + 0.6) / Math.tan(hf / 2), ((y1 - y0) / 2) / Math.tan(cam.fov * Math.PI / 360) * 1.05);
  const dir = new THREE.Vector3(0, 0.36, 1).normalize();
  cam.position.copy(tg).addScaledVector(dir, d); cam.lookAt(tg); cam.updateProjectionMatrix();
  cam.userData.base = cam.position.clone();
}
addEventListener('resize', fit); fit();

// ---------------- dongu ----------------
let last = 0, shake = 0;
function frame(ts) {
  const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
  if (g) { g.t += dt; world.step(1 / 120, dt, 8); syncMeshes(); updateBalls(dt); updateCubes(dt); }
  updatePofi(dt); updateParts(dt);
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.4); cam.position.copy(cam.userData.base).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0)); } else if (cam.userData.base) cam.position.copy(cam.userData.base);
  ren.render(scene, cam);
  if (!TEST) requestAnimationFrame(frame);
}
function start(L) {
  LV = Math.max(1, L); SV.L = LV; save(); closeModal(); $('praise').innerHTML = '';
  setPofiCol(POFICOL[(LV - 1) % POFICOL.length]); buildLevel();
}
window.YP = { cam, cubes, balls, get g() { return g; }, start, shoot: (x, y, z) => shoot(new THREE.Vector3(x, y, z)), aimAt, run(sec) { let t = last || 0; for (let i = 0; i < Math.round(sec * 60); i++) { t += 1000 / 60; frame(t); } }, snap() { return glc.toDataURL('image/png'); } };
Promise.all([faceReady, pofiReady]).then(() => {
  for (const k in KMAT) delete KMAT[k];
  start(+(Q.get('sv') || SV.L || 1));
  const l = $('load'); l.style.opacity = 0; setTimeout(() => l.remove(), 400);
  if (!TEST) requestAnimationFrame(frame); else frame(16);
});
