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
const GY = -1.7;         // zemin: alcak platform buna oturur, dusen kupler burada yuvarlanir
const POFI = new THREE.Vector3(0, -0.9, 9.6);   // Pofi'nin ayak yeri (z bolume gore platformun onune konur)
const GONE_Y = -0.45;    // bunun altina inen kup platformdan dusmus sayilir

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
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 16, bottom: -14, near: 2, far: 60 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
scene.add(sun);
const rim = new THREE.DirectionalLight(0xcfe0ff, 0.9); rim.position.set(9, 6, -8); scene.add(rim);

function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
// platform temalari: Gemini ile uretilen yan seridi ve ust daire (doku/plat/*), kenar halkasinin rengi
const PTEMA = {
  ahsap: { halka: '#ffc43d' }, buz: { halka: '#9ff0ff', isik: 0.5 }, mercan: { halka: '#ffd6e6' },
  seker: { halka: '#ffd36b' }, neon: { halka: '#c890ff', isik: 0.9 }, tas: { halka: '#d8dcc8' }
};
const PMAT = {}, PTL = new THREE.TextureLoader();
function platMats(t) {
  if (PMAT[t]) return PMAT[t];
  const ld = (n, rep) => { const x = PTL.load('doku/plat/' + t + '_' + n + '.webp?v=1'); x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 4; if (rep) { x.wrapS = THREE.RepeatWrapping; x.repeat.set(rep, 1); } return x; };
  const T = PTEMA[t], side = new THREE.MeshStandardMaterial({ map: ld('yan', 6), roughness: 0.5 }), top = new THREE.MeshStandardMaterial({ map: ld('ust'), roughness: 0.6 });
  const halka = new THREE.MeshStandardMaterial({ color: T.halka, roughness: 0.3, metalness: 0.45, emissive: T.halka, emissiveIntensity: T.isik || 0.15 });
  const alt = side.clone(); alt.color = new THREE.Color('#9a9a9a');
  return (PMAT[t] = { side, top, halka, alt });
}

// platform: zemine oturan alcak kalin tabla + biraz dar bir taban (yuksek direk yok); Pofi de alcak bir kaidede
const stage = new THREE.Group(), pedG = new THREE.Group(); scene.add(stage, pedG);
const PL = {};
{
  const g1 = new THREE.CylinderGeometry(R0, R0, 1.1, 72), g2 = new THREE.CylinderGeometry(R0 * 0.9, R0 * 0.95, -GY - 1.1, 72);
  PL.top = new THREE.Mesh(g1); PL.top.position.y = -0.55; PL.top.receiveShadow = PL.top.castShadow = true; stage.add(PL.top);
  PL.base = new THREE.Mesh(g2); PL.base.position.y = (GY - 1.1) / 2; PL.base.receiveShadow = true; stage.add(PL.base);
  PL.ring = new THREE.Mesh(new THREE.TorusGeometry(R0, 0.13, 12, 96)); PL.ring.rotation.x = Math.PI / 2; stage.add(PL.ring);
  PL.ring2 = PL.ring.clone(); PL.ring2.position.y = -1.1; stage.add(PL.ring2);
  const ph = POFI.y - GY;
  PL.ped = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, ph, 48)); PL.ped.position.y = -ph / 2; PL.ped.receiveShadow = true; pedG.add(PL.ped);
  PL.pr = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.09, 10, 48)); PL.pr.rotation.x = Math.PI / 2; pedG.add(PL.pr);
  // zemin golgesi: yumusak koyu leke, platform ve kaide arka plan resmindeki yere oturmus gibi gorunur
  const blob = canvasTex(128, 128, (x, w, h) => { const gg = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gg.addColorStop(0, 'rgba(20,10,30,.55)'); gg.addColorStop(0.7, 'rgba(20,10,30,.35)'); gg.addColorStop(1, 'rgba(20,10,30,0)'); x.fillStyle = gg; x.fillRect(0, 0, w, h); });
  const bm = new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(R0 * 2.7, R0 * 2.7), bm); sh.rotation.x = -Math.PI / 2; sh.position.y = GY + 0.02; stage.add(sh);
  const sh2 = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), bm); sh2.rotation.x = -Math.PI / 2; sh2.position.y = GY - POFI.y + 0.02; pedG.add(sh2);
}
// ---------------- Tripo modelleri (model/*.glb) ----------------
// Adem'in Gemini resimlerinden Tripo'da yapilan gercek 3B modeller (kucultulmus: ~6 bin ucgen kup, ~25 bin platform).
// Renkli kup, sandik ve fici modeli kupun yerine gecer; ahsap ve tas temalarinda platform da model olur.
const MOD = {};
const modelReady = Promise.all(['kup', 'sandik', 'fici', 'platform_ahsap', 'platform_tas'].map((n) => new Promise((res) => {
  new GLTFLoader().load('model/' + n + '.glb?v=1', (gl) => {
    let m = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse((o) => { if (o.isMesh && !m) m = o; });
    if (m) { const geo = m.geometry.clone().applyMatrix4(m.matrixWorld); geo.computeBoundingBox(); MOD[n] = { geo, mat: m.material }; if (n === 'sandik' || n === 'fici') m.material.color.multiplyScalar(1.35); }
    res();
  }, undefined, () => res());
})));
// kup modeli: kenari S olan, merkezi orijinde bir kupe olceklenir
function fitCube(n) {
  const M = MOD[n]; if (!M) return null; if (M.cube) return M.cube;
  const g = M.geo.clone(), b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), z = b.getSize(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z); g.scale(S / z.x, S / z.y, S / z.z); g.computeBoundingSphere();
  return (M.cube = g);
}
// platform modeli: genisligi 2*R0, ortadaki ust yuzey y=0'da, alti zemine (GY) kadar basik
function fitPlat(n, R1, bottom) {
  const M = MOD[n]; if (!M) return null;
  const g = M.geo.clone(), b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), z = b.getSize(new THREE.Vector3()), pa = g.attributes.position;
  let top = b.min.y; const rr = Math.min(z.x, z.z) * 0.18;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i) - c.x, w = pa.getZ(i) - c.z; if (x * x + w * w < rr * rr) top = Math.max(top, pa.getY(i)); }
  const sx = 2 * R1 / z.x, sz = 2 * R1 / z.z, sy = -bottom / Math.max(0.01, top - b.min.y);
  g.translate(-c.x, -top, -c.z); g.scale(sx, sy, sz); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
const PLM = {};
function platModel(t) {
  if (PLM[t] !== undefined) return PLM[t];
  const n = 'platform_' + t; if (!MOD[n]) return (PLM[t] = null);
  const big = new THREE.Mesh(fitPlat(n, R0, GY), MOD[n].mat), ped = new THREE.Mesh(fitPlat(n, 1.55, GY - POFI.y), MOD[n].mat);
  big.receiveShadow = ped.receiveShadow = true; big.castShadow = true; big.visible = ped.visible = false; stage.add(big); pedG.add(ped);
  return (PLM[t] = { big, ped });
}
function setPlat(t) {
  const m = platMats(t), pm = platModel(t);
  for (const k in PLM) if (PLM[k]) PLM[k].big.visible = PLM[k].ped.visible = k === t;
  for (const o of [PL.top, PL.base, PL.ring, PL.ring2, PL.ped, PL.pr]) o.visible = !pm;
  PL.top.material = [m.side, m.top, m.alt]; PL.base.material = [m.alt, m.alt, m.alt]; PL.ring.material = PL.ring2.material = PL.pr.material = m.halka;
  PL.ped.material = [m.side, m.top, m.alt];
}
setPlat('ahsap');
// renkli kup modeli: gri metal doku kupun rengiyle carpilir, hafif kendi isigi
const KMOD = {};
function kupModelMat(col) {
  if (KMOD[col]) return KMOD[col];
  const m = MOD.kup.mat.clone(); m.color = new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.12).multiplyScalar(1.35);
  m.emissive = new THREE.Color(col); m.emissiveIntensity = 0.18; m.metalness = Math.min(m.metalness, 0.35);
  return (KMOD[col] = m);
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

// ---------------- ozel malzemeler ----------------
// Gemini ile uretilen dokular (doku/*.webp). Her malzemenin agirligi, kayganligi, sekmesi ve ozel isi farkli:
// cam belli hizda carpinca kirilir; fici/bomba patlar ve cevresini iter (yakindaki ficiyi de patlatir);
// hediye dusunce +2 top, altin hazine, yildiz bolum sonunda +1 yildiz verir.
const TL = new THREE.TextureLoader(), TX = {};
const texReady = Promise.all(['fici_yan', 'fici_kapak', 'sandik', 'cam', 'buz', 'altin', 'celik', 'tugla', 'jole', 'hediye', 'bomba', 'yildiz'].map((n) => new Promise((res) => {
  TX[n] = TL.load('doku/' + n + '.webp?v=1', res, undefined, res); TX[n].colorSpace = THREE.SRGBColorSpace; TX[n].anisotropy = 4; })));
TX.fici_yan.wrapS = THREE.RepeatWrapping; TX.fici_yan.repeat.set(2, 1);
const KIND = {
  sandik: { mass: 0.6, f: 0.6, r: 0.15 },
  tugla: { mass: 2.4, f: 0.85, r: 0.1 },
  celik: { mass: 5, f: 0.7, r: 0.05 },
  buz: { mass: 1, f: 0.12, r: 0.1 },
  jole: { mass: 0.8, f: 0.6, r: 0.95 },
  cam: { mass: 0.9, f: 0.5, r: 0.1, kir: 5 },                  // bu hizla carpinca kirilir
  fici: { mass: 0.8, f: 0.6, r: 0.15, boom: 3.2, guc: 26 },   // patlama yaricapi (kup cinsinden) ve itis hizi
  bomba: { mass: 1.2, f: 0.6, r: 0.1, boom: 4.4, guc: 38 },
  altin: { mass: 1.6, f: 0.6, r: 0.1 },
  hediye: { mass: 0.7, f: 0.6, r: 0.15 },
  yildiz: { mass: 0.9, f: 0.6, r: 0.15 }
};
const KM = {};
function kindMat(k) {
  if (KM[k]) return KM[k];
  const t = TX[k === 'fici' ? 'fici_yan' : k]; let m;
  if (k === 'cam') m = new THREE.MeshPhysicalMaterial({ map: t, transparent: true, opacity: 0.6, roughness: 0.05, clearcoat: 1, depthWrite: false });
  else if (k === 'buz') m = new THREE.MeshPhysicalMaterial({ map: t, transparent: true, opacity: 0.9, roughness: 0.1, clearcoat: 1 });
  else if (k === 'jole') m = new THREE.MeshPhysicalMaterial({ map: t, transparent: true, opacity: 0.88, roughness: 0.15, clearcoat: 1, emissive: '#ff5aa0', emissiveIntensity: 0.18 });
  else if (k === 'altin') m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.5 });
  else if (k === 'bomba') m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.3, emissive: '#ff2020', emissiveMap: t, emissiveIntensity: 0.4 });
  else if (k === 'yildiz') m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, emissive: '#ffcc33', emissiveMap: t, emissiveIntensity: 0.35 });
  else m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: k === 'celik' ? 0.35 : 0 });
  if (k === 'fici') { const top = new THREE.MeshStandardMaterial({ map: TX.fici_kapak, roughness: 0.6 }); m = [m, top, top]; }
  return (KM[k] = m);
}
const FR = S * 0.46, FICIGEO = new THREE.CylinderGeometry(FR, FR, S, 32);

// ---------------- bolumler ----------------
const C = { kir: '#ff4256', tur: '#ff9a1f', sar: '#ffd23f', mav: '#3d7bff', mor: '#a25cff', yes: '#2fcf73', pem: '#ff6fcf', tur2: '#22c8e8' };
// her bolum: kup listesi [i, j(kat), k, renk] (izgara birimi), top sayisi, arka plan
function box(o, i0, i1, j0, j1, k0, k1, col) { for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) o.push([i, j, k, typeof col === 'function' ? col(i, j, k) : col]); return o; }
// zorluk egrisi: bolum ilerledikce top sayisi azalir, yapilar agirlasir (tugla/celik) ve ozel bloklar artar.
// renk (#...) yerine malzeme adi da yazilabilir: sandik, tugla, celik, buz, jole, cam, fici, bomba, altin, hediye, yildiz
const LEVELS = [
  { ad: 'Renkli Duvar', top: 8, bg: 1, make: () => { const o = box([], 0, 5, 0, 3, 0, 1, (i, j) => (j < 2 ? ((i + j) % 4 === 1 ? C.sar : C.kir) : (i % 3 === 1 && j === 3 ? C.sar : C.tur))); o.push([2.5, 4, 0.5, 'hediye']); return o; } },
  { ad: 'Barut Fıçısı', top: 6, bg: 1, make: () => box([], 0, 5, 0, 2, 0, 1, (i, j, k) => (j === 0 && k === 1 && (i === 1 || i === 4) ? 'fici' : j === 2 ? C.mav : C.kir)) },
  { ad: 'İkiz Kuleler', top: 8, bg: 1, make: () => { const o = []; box(o, 0, 1, 0, 5, 0, 1, (i, j) => (j === 5 ? C.sar : C.mav)); box(o, 5, 6, 0, 5, 0, 1, (i, j) => (j === 5 ? C.sar : C.mav)); box(o, 2, 4, 0, 2, 0, 0, (i, j) => (j === 0 && i === 3 ? 'fici' : j === 1 && i === 3 ? C.sar : C.kir)); box(o, 2, 4, 0, 1, 1, 1, C.tur); return o; } },
  { ad: 'Sandık Piramidi', top: 6, bg: 3, make: () => { const o = []; for (let l = 0; l < 6; l++) box(o, l / 2, 5 - l / 2, l, l, 0, 1, l === 5 ? 'altin' : 'sandik'); return o; } },
  { ad: 'Kale', top: 8, bg: 1, make: () => { const o = []; box(o, 0, 6, 0, 2, 0, 1, (i, j, k) => (i === 3 && j < 2 && k === 1 ? 'celik' : k === 1 && j === 0 && (i === 1 || i === 5) ? 'fici' : 'tugla')); box(o, 0, 0, 3, 5, 0, 1, (i, j) => (j === 5 ? C.mor : C.mav)); box(o, 6, 6, 3, 5, 0, 1, (i, j) => (j === 5 ? C.mor : C.mav)); box(o, 2, 4, 3, 4, 1, 1, (i, j) => (i === 3 && j === 4 ? 'yildiz' : C.tur)); return o; } },
  { ad: 'Cam Kule', top: 6, bg: 2, make: () => { const o = box([], 0, 2, 0, 5, 0, 2, (i, j) => (j % 2 ? 'cam' : [C.yes, C.tur2, C.mav][j / 2])); o.push([1, 6, 1, 'yildiz']); return o; } },
  { ad: 'Buz Basamakları', top: 5, bg: 3, make: () => { const o = []; for (let i = 0; i < 6; i++) box(o, i, i, 0, 5 - i, 0, 1, (ii, j) => (j === 5 - i ? 'jole' : 'buz')); return o; } },
  { ad: 'Cephanelik', top: 4, bg: 1, make: () => box([], 0, 5, 0, 2, 0, 1, (i, j, k) => (i === 2 && j === 1 && k === 1 ? 'bomba' : (i + j + k) % 3 === 0 ? 'fici' : 'sandik')) },
  { ad: 'Buz Sarayı', top: 6, bg: 2, make: () => { const o = []; box(o, 0, 6, 0, 1, 0, 1, 'buz'); box(o, 0, 1, 2, 4, 0, 1, 'cam'); box(o, 5, 6, 2, 4, 0, 1, 'cam'); box(o, 2, 4, 2, 2, 0, 1, (i) => (i === 3 ? 'hediye' : C.tur2)); return o; } },
  { ad: 'Hazine Odası', top: 7, bg: 3, make: () => { const o = box([], 0, 6, 0, 3, 0, 1, (i, j, k) => ((i === 0 || i === 6) && j === 0 ? 'celik' : k === 1 && j === 1 && (i === 2 || i === 4) ? 'altin' : 'tugla')); o.push([3, 4, 0.5, 'yildiz']); return o; } },
  { ad: 'Jöle Kuleleri', top: 5, bg: 2, make: () => { const o = []; box(o, 0, 1, 0, 4, 0, 1, (i, j) => (j % 2 ? 'jole' : C.pem)); box(o, 4, 5, 0, 4, 0, 1, (i, j) => (j % 2 ? 'jole' : C.mor)); box(o, 2, 3, 0, 1, 0, 1, (i, j, k) => (j === 0 && k === 1 && i === 2 ? 'bomba' : 'hediye')); return o; } },
  { ad: 'Dev Kule', top: 6, bg: 2, make: () => box([], 0, 2, 0, 6, 0, 2, (i, j, k) => (j === 3 ? 'cam' : j === 0 && i === 1 && k === 2 ? 'fici' : [C.yes, C.tur2, C.mav, 0, C.pem, C.kir, C.sar][j])) }
];
// her bolumun arka plani (Adem'in Gemini resimleri, fon/*.webp) ve ona uyan platform temasi
const TEMALAR = [['cayir1', 'ahsap'], ['cayir2', 'ahsap'], ['sahil1', 'mercan'], ['col', 'tas'], ['orman', 'tas'], ['kar1', 'buz'],
  ['kar2', 'buz'], ['uzay', 'neon'], ['deniz', 'mercan'], ['sahil2', 'ahsap'], ['seker', 'seker'], ['cayir3', 'ahsap']];
function levelOf(L) { return LEVELS[(L - 1) % LEVELS.length]; }

// ---------------- fizik ----------------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -24, 0) });
world.broadphase = new CANNON.SAPBroadphase(world); world.allowSleep = true; world.solver.iterations = 14; world.solver.tolerance = 0.0005;
// ozel malzemelerin kendi Material'i var; onlarla carpismada surtunme/sekme iki tarafin carpimidir (cannon-es)
const PM = { cube: new CANNON.Material({ friction: 0.62, restitution: 0.2 }), ball: new CANNON.Material({ friction: 0.45, restitution: 0.5 }), plat: new CANNON.Material({ friction: 0.65, restitution: 0.25 }) };
world.addContactMaterial(new CANNON.ContactMaterial(PM.cube, PM.cube, { friction: 0.38, restitution: 0.04 }));
world.addContactMaterial(new CANNON.ContactMaterial(PM.cube, PM.plat, { friction: 0.4, restitution: 0.05 }));
world.addContactMaterial(new CANNON.ContactMaterial(PM.ball, PM.cube, { friction: 0.2, restitution: 0.25 }));
world.addContactMaterial(new CANNON.ContactMaterial(PM.ball, PM.plat, { friction: 0.3, restitution: 0.3 }));
const platBody = new CANNON.Body({ mass: 0, material: PM.plat }); world.addBody(platBody);
{ const gb = new CANNON.Body({ mass: 0, material: PM.plat }); gb.addShape(new CANNON.Plane()); gb.quaternion.setFromEuler(-Math.PI / 2, 0, 0); gb.position.y = GY; world.addBody(gb); }
const CUBESHAPE = new CANNON.Box(new CANNON.Vec3(S / 2, S / 2, S / 2)), FICISHAPE = new CANNON.Cylinder(FR, FR, S, 16);

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
  platBody.addShape(new CANNON.Cylinder(R, R, -GY, 32), new CANNON.Vec3(0, GY / 2, 0));
  POFI.z = R + 3.6; pedG.position.copy(POFI); PF.holder.position.copy(POFI); fit();
  for (const [i, j, k, col] of list) {
    const kd = col[0] === '#' ? null : KIND[col], mg = fitCube(kd ? col : 'kup'), isF = col === 'fici' && !mg;
    const pm = kd ? (kd.pm || (kd.pm = new CANNON.Material({ friction: kd.f, restitution: kd.r }))) : PM.cube;
    const body = new CANNON.Body({ mass: kd ? kd.mass : 1, material: pm, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.4, linearDamping: 0.02, angularDamping: 0.06 });
    body.addShape(isF ? FICISHAPE : CUBESHAPE); body.position.set((i - ci) * S, S / 2 + j * (S + 0.002), (k - ck) * S); world.addBody(body); body.sleep();
    const mesh = mg ? new THREE.Mesh(mg, kd ? MOD[col].mat : kupModelMat(col)) : new THREE.Mesh(isF ? FICIGEO : CUBEGEO, kd ? kindMat(col) : kupMat(col)); mesh.castShadow = true; mesh.receiveShadow = col !== 'cam'; scene.add(mesh);
    const c = { body, mesh, col, kind: kd ? col : null, gone: false, out: false };
    // kirilan/patlayan: carpisma olayi adimin icinde gelir, isi adimdan sonra yapilir (FUSE)
    if (kd && (kd.kir || kd.boom)) body.addEventListener('collide', (e) => {
      if (!g || !g.armed || c.gone || c.fuse != null) return;
      if (Math.abs(e.contact.getImpactVelocityAlongNormal()) > (kd.kir || 3.2)) { c.fuse = 0; FUSE.push(c); }
    });
    cubes.push(c);
  }
  syncMeshes();
  g = { L: LV, ad: Y.ad, total: cubes.length, left: cubes.length, shots: Y.top, max: Y.top, state: 'play', t: 0, busy: 0, quiet: 0, combo: null, armed: false, bonus: 0, gold: 0 };
  FUSE.length = 0;
  const tm = TEMALAR[(LV - 1) % TEMALAR.length]; $('bg').style.backgroundImage = 'url(fon/' + tm[0] + '.webp)'; setPlat(tm[1]);
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
const BALLGEO = new THREE.SphereGeometry(0.42, 32, 20);
const TRAILGEO = new THREE.SphereGeometry(0.24, 12, 8);
function shoot(target) {
  if (!g || g.state !== 'play' || g.shots <= 0) return false;
  const now = g.t; if (g.lastShot && now - g.lastShot < 0.32) return false;
  g.lastShot = now; g.shots--; g.armed = true; PF.rec = 1;
  PF.aimYaw = Math.atan2(target.x - POFI.x, target.z - POFI.z);
  PF.holder.rotation.y = PF.yaw = PF.aimYaw;   // atis aninda hedefe donuk olsun ki top hortumdan ciksin
  const st = trunkTip(TIP).clone();
  // yay: v = (hedef - baslangic)/T - g*T/2. En kisa ucus suresi secilir ama top platformun on kenarini (z = R) en az
  // 0.9 yukaridan asmali, yoksa kenara carpip geri seker
  const dv = target.clone().sub(st), gy = world.gravity.y, edge = Math.min(1, Math.max(0, (st.z - R) / Math.max(0.01, st.z - target.z)));
  let T = Math.max(0.24, Math.min(0.5, dv.length() / 44));
  for (; T < 1.2; T += 0.03) { const te = edge * T, vy = dv.y / T - 0.5 * gy * T; if (st.y + vy * te + 0.5 * gy * te * te > 0.9) break; }
  const v = new CANNON.Vec3(dv.x / T, dv.y / T - 0.5 * gy * T, dv.z / T);
  const col = PF.col || '#3d9bff';
  const body = new CANNON.Body({ mass: 38, material: PM.ball, linearDamping: 0.01, allowSleep: false }); body.addShape(new CANNON.Sphere(0.42));
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
const V = new THREE.Vector3(), V2 = new THREE.Vector3();
let lastFl = 0;
function screenAt(p, dy) { V.copy(p); V.y += dy || 0; V.project(cam); return [(V.x + 1) / 2 * innerWidth, (1 - V.y) / 2 * innerHeight]; }
// kup gitti (dustu, kirildi ya da patladi): sayilir, ozel kuplerin odulu verilir; remove ise sahneden hemen kalkar
function knock(c, remove) {
  c.gone = true; g.left--; if (g.combo) { g.combo.n++; g.combo.t = 0; }
  const p = c.body.position, at = screenAt(p, 0.3);
  if (c.kind === 'hediye') { g.shots += 2; floatText('+2 top', at[0], at[1]); burst(new THREE.Vector3().copy(p), '#ffd23f', 16, 6); sfx('bonus'); }
  else if (c.kind === 'altin') { g.gold++; floatText('Hazine!', at[0], at[1]); burst(new THREE.Vector3().copy(p), '#ffd23f', 20, 7); sfx('bonus'); }
  else if (c.kind === 'yildiz') { g.bonus++; floatText('+1 ★', at[0], at[1]); burst(new THREE.Vector3().copy(p), '#c58bff', 20, 7); sfx('bonus'); }
  else if (g.t - lastFl > 0.05) { lastFl = g.t; floatText('+1', at[0], at[1]); }
  sfx('pop', g.combo ? g.combo.n : 1); hud();
  if (remove) { c.out = true; world.removeBody(c.body); scene.remove(c.mesh); }
}
// carpisma ile tetiklenen camlar ve ficilar: kisa bir fitilden sonra kirilir/patlar (zincirleme patlama icin)
const FUSE = [], boomLight = new THREE.PointLight('#ffa040', 0, 14, 1.6); scene.add(boomLight);
function updateFuse(dt) {
  boomLight.intensity = Math.max(0, boomLight.intensity - dt * 160);
  for (let i = FUSE.length - 1; i >= 0; i--) {
    const c = FUSE[i]; c.fuse -= dt; if (c.fuse > 0) continue; FUSE.splice(i, 1); if (c.gone) continue;
    const kd = KIND[c.kind], p = new THREE.Vector3().copy(c.body.position);
    knock(c, true);
    if (kd.kir) { burst(p, '#bff4ff', 24, 7); burst(p, '#ffffff', 10, 5); sfx('cam'); wakeAll(); g.busy = Math.max(g.busy, 1); }
    else explode(p, kd);
  }
}
function explode(p, kd) {
  const RR = kd.boom * S;
  shake = Math.min(0.9, shake + (kd.boom > 4 ? 0.8 : 0.55)); boomLight.position.copy(p); boomLight.intensity = kd.boom > 4 ? 90 : 60;
  burst(p, '#ffb020', 30, 12); burst(p, '#ff4020', 20, 9); burst(p, '#5a4a40', 10, 6); sfx('boom');
  praise(kd.boom > 4 ? 'KABOOM!' : 'BOOM!', '');
  wakeAll(); g.busy = Math.max(g.busy, 2.5);
  for (const o of cubes) {
    if (o.gone || o.out) continue;
    V2.copy(o.body.position).sub(p); const L = V2.length(); if (L > RR) continue;
    const k = 1 - L / RR; V2.normalize(); V2.y += 0.55; V2.normalize();
    const m = o.body.mass, dv = kd.guc * (0.35 + 0.65 * k) / Math.max(1, m * 0.6);
    o.body.applyImpulse(new CANNON.Vec3(V2.x * dv * m, V2.y * dv * m, V2.z * dv * m));
    o.body.angularVelocity.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    const ok = o.kind && KIND[o.kind]; if (ok && (ok.boom || ok.kir) && o.fuse == null && L < RR * 0.85) { o.fuse = ok.boom ? 0.14 + Math.random() * 0.08 : 0.02; FUSE.push(o); }
  }
}
function updateCubes(dt) {
  let moving = false;
  for (const c of cubes) {
    if (c.out) continue;
    const p = c.body.position;
    if (!c.gone && p.y < GONE_Y) knock(c, false);
    if (c.gone) { c.gt = (c.gt || 0) + dt; if (c.gt > 1.4) { const k = Math.max(0, 1 - (c.gt - 1.4) / 0.4); c.mesh.scale.setScalar(k); if (k <= 0) { c.out = true; world.removeBody(c.body); scene.remove(c.mesh); continue; } } }
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
  else if (k === 'boom' || k === 'cam') { const B = k === 'boom'; o.type = B ? 'sine' : 'triangle'; o.frequency.setValueAtTime(B ? 90 : 1800, t); o.frequency.exponentialRampToValueAtTime(B ? 30 : 600, t + 0.4); v.gain.setValueAtTime(B ? 0.6 : 0.12, t); v.gain.exponentialRampToValueAtTime(0.001, t + 0.5); o.start(t); o.stop(t + 0.52);
    const L = B ? 0.7 : 0.35, nb = AC.createBuffer(1, AC.sampleRate * L, AC.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** (B ? 1.5 : 3);
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), gv = AC.createGain(); f.type = B ? 'lowpass' : 'highpass'; f.frequency.value = B ? 700 : 2500; gv.gain.value = B ? 0.9 : 0.4; s.buffer = nb; s.connect(f); f.connect(gv); gv.connect(AC.destination); s.start(t); }
  else if (k === 'bonus') { o.type = 'triangle'; o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(990, t + 0.08); o.frequency.setValueAtTime(1320, t + 0.16); v.gain.setValueAtTime(0.18, t); v.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.start(t); o.stop(t + 0.36); }
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
  const r = g.shots / g.max, st = Math.min(3, (r >= 0.4 ? 3 : r >= 0.15 ? 2 : 1) + g.bonus);
  for (let i = 0; i < 4; i++) setTimeout(() => burst(new THREE.Vector3((Math.random() - 0.5) * 8, 4 + Math.random() * 4, 0), POFICOL[i % POFICOL.length], 30, 10), i * 180);
  modal('<div class="tag">Yapı ' + LV + '</div><div class="stars">' + '★'.repeat(st) + '<span style="opacity:.25">' + '★'.repeat(3 - st) + '</span></div><h2>Yapı yıkıldı!</h2><p>' + g.shots + ' top arttı' + (g.gold ? ' · ' + g.gold + ' hazine' : '') + '</p><button class="btn" id="nx">Sonraki ▶</button>');
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
  if (g) { g.t += dt; world.step(1 / 120, dt, 8); updateFuse(dt); syncMeshes(); updateBalls(dt); updateCubes(dt); if (KM.bomba) KM.bomba.emissiveIntensity = 0.45 + 0.4 * Math.sin(g.t * 8); }
  updatePofi(dt); updateParts(dt);
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.4); cam.position.copy(cam.userData.base).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0)); } else if (cam.userData.base) cam.position.copy(cam.userData.base);
  ren.render(scene, cam);
  if (!TEST) requestAnimationFrame(frame);
}
function start(L) {
  LV = Math.max(1, L); SV.L = LV; save(); closeModal(); $('praise').innerHTML = '';
  setPofiCol(POFICOL[(LV - 1) % POFICOL.length]); buildLevel();
}
window.YP = { cam, scene, cubes, balls, get g() { return g; }, start, shoot: (x, y, z) => shoot(new THREE.Vector3(x, y, z)), aimAt, run(sec) { let t = last || 0; for (let i = 0; i < Math.round(sec * 60); i++) { t += 1000 / 60; frame(t); } }, snap() { return glc.toDataURL('image/png'); } };
Promise.all([faceReady, pofiReady, texReady, modelReady]).then(() => {
  for (const k in KMAT) delete KMAT[k];
  start(+(Q.get('sv') || SV.L || 1));
  const l = $('load'); l.style.opacity = 0; setTimeout(() => l.remove(), 400);
  if (!TEST) requestAnimationFrame(frame); else frame(16);
});
