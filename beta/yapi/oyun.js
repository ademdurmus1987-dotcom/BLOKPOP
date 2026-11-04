// BLOKPOP Yapi v3 (prototip) - v5.2: col harabesi fonu + kare tas platform. Direk ustundeki platformda iri metal kuplerden bir yapi; altta Pofi durur.
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
const GY = -4.0;         // zemin: platform kisa bir direk ustunde durur, dusen kupler direk dibindeki zeminde yuvarlanir
const PT = 1.1;          // platform tablasinin kalinligi (ust yuzey y=0)
const POFI = new THREE.Vector3(0, GY, 9.6);   // v5.3: Pofi ortada (Adem: kenarda durmasin)
//     // Pofi kaidesiz, cimende durur; direkli platforma yukari atar   // Pofi'nin ayak yeri (z bolume gore platformun onune konur)
const GONE_Y = -0.45;    // bunun altina inen kup platformdan dusmus sayilir

// ---------------- cizim ----------------
const glc = $('gl');
const ren = new THREE.WebGLRenderer({ canvas: glc, antialias: true, alpha: true, preserveDrawingBuffer: TEST }); ren.setClearColor(0, 0);
ren.setPixelRatio(Math.min(2, devicePixelRatio || 1));
ren.outputColorSpace = THREE.SRGBColorSpace; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.15;
ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(40, 1, 0.5, 200);
scene.add(new THREE.HemisphereLight(0xffeedd, 0x8a5a40, 1.25));   // gun batimi tonu (harabe fonu)
const sun = new THREE.DirectionalLight(0xffdcae, 2.6); sun.position.set(-8, 18, 10); sun.castShadow = true;
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
  const g1 = new THREE.CylinderGeometry(R0, R0, 1.1, 72), g2 = new THREE.CylinderGeometry(1.05, 1.3, -GY - PT, 40);
  PL.top = new THREE.Mesh(g1); PL.top.position.y = -0.55; PL.top.receiveShadow = PL.top.castShadow = true; stage.add(PL.top);
  // kisa direk ve zemine oturan ayak: platform buyuyunce direk kalinlasmasin diye stage disinda
  PL.base = new THREE.Mesh(g2); PL.base.position.y = (GY - PT) / 2; PL.base.receiveShadow = PL.base.castShadow = true; scene.add(PL.base);
  PL.foot = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.15, 0.35, 48)); PL.foot.position.y = GY + 0.175; PL.foot.receiveShadow = true; scene.add(PL.foot);
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
// harabe temasi (Adem'in col harabesi resmi): kare tas tabla, ustunde oyuk izgara; kare tas direk ve ayak.
// dokular resmin kendisinden kesildi (doku/plat/harabe_*). Tabla stage icinde (bolume gore buyur), direk disarida.
const HQ = {};
{
  const ld = (n, rx, ry) => { const x = PTL.load('doku/plat/harabe_' + n + '.webp?v=3'); x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 8; if (rx) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.repeat.set(rx, ry || 1); } return x; };
  // resimdeki gibi acik renkli boyali tas: dokunun kendisi biraz isik da verir, golgede kahverengiye bogulmaz
  const mk = (tx, c, e, r) => new THREE.MeshStandardMaterial({ map: tx, color: c, emissive: '#ffffff', emissiveMap: tx, emissiveIntensity: e, roughness: r });
  const top = mk(ld('ust'), '#ffffff', 0.12, 0.82);
  const yan = mk(ld('yan'), '#ffe6d2', 0.45, 0.85);
  const dir = mk(ld('direk', 1, 1), '#fff2e6', 0.35, 0.9);
  const alt = new THREE.MeshStandardMaterial({ color: '#8a6a5a', roughness: 0.95 });
  HQ.slab = new THREE.Mesh(new THREE.BoxGeometry(2 * R0, PT, 2 * R0), [yan, yan, top, alt, yan, yan]); HQ.slab.position.y = -PT / 2;
  HQ.slab.castShadow = HQ.slab.receiveShadow = true; stage.add(HQ.slab);
  const ph = -GY - PT;
  HQ.col = new THREE.Mesh(new THREE.BoxGeometry(2.7, ph, 2.7), [dir, dir, alt, alt, dir, dir]); HQ.col.position.y = -PT - ph / 2;
  HQ.col.castShadow = HQ.col.receiveShadow = true; scene.add(HQ.col);
  HQ.foot = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.3, 3.5), [yan, yan, alt, alt, yan, yan]); HQ.foot.position.y = GY + 0.15; HQ.foot.receiveShadow = true; scene.add(HQ.foot);
}
const KARE = (t) => t === 'harabe';
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
  const big = new THREE.Mesh(fitPlat(n, R0, -PT), MOD[n].mat), ped = new THREE.Mesh(fitPlat(n, 1.55, GY - POFI.y), MOD[n].mat);
  big.receiveShadow = ped.receiveShadow = true; big.castShadow = true; big.visible = ped.visible = false; stage.add(big); pedG.add(ped);
  return (PLM[t] = { big, ped });
}
function setPlat(t) {
  const kare = KARE(t); for (const k in HQ) HQ[k].visible = kare;
  if (kare) { for (const k in PLM) if (PLM[k]) PLM[k].big.visible = PLM[k].ped.visible = false; for (const o of [PL.top, PL.ring, PL.ring2, PL.ped, PL.pr, PL.base, PL.foot]) o.visible = false; return; }
  PL.base.visible = PL.foot.visible = true;
  const m = platMats(t), pm = platModel(t);
  for (const k in PLM) if (PLM[k]) PLM[k].big.visible = PLM[k].ped.visible = k === t;
  for (const o of [PL.top, PL.ring, PL.ring2, PL.ped, PL.pr]) o.visible = !pm;
  PL.top.material = [m.side, m.top, m.alt]; PL.base.material = PL.foot.material = [m.side, m.top, m.alt]; PL.ring.material = PL.ring2.material = PL.pr.material = m.halka;
  PL.ped.material = [m.side, m.top, m.alt];
  if (POFI.y - GY < 0.2) { PL.ped.visible = PL.pr.visible = false; if (pm) pm.ped.visible = false; }
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
const texReady = Promise.all(['fici_yan', 'fici_kapak', 'sandik', 'cam', 'buz', 'altin', 'celik', 'tugla', 'jole', 'hediye', 'bomba', 'yildiz', 'recel_etiket'].map((n) => new Promise((res) => {
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
  yildiz: { mass: 0.9, f: 0.6, r: 0.15 },
  recel: { mass: 1.3, f: 0.55, r: 0.08, kir: 7, esya: 1 }   // devrilince kirilmaz, ustune kup duserse ya da yere dusunce kirilir
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

// ---------------- mutfak esyalari: recel kavanozu ----------------
// Tripo yerine burada torna (Lathe) ile kurulur: cam gercekten seffaf, icindeki recel gorunur, kirilinca parcalara ayrilir.
// Kavanoz fici gibi bir izgara hucresine oturan silindirdir (FICISHAPE): devrilir, yuvarlanir; sert carpinca kirilir,
// cam kiriklari ve bez kapak savrulur, recel topaklari sicrar, dustugu yerde yapiskan leke kalir (ustundeki kupler kaymaz).
const JR = FR * 0.97, JB = -S / 2, JT = S / 2 - 0.15;   // govde yaricapi, taban, cam agzi (ustunde bez kapak)
const JS = JT - 0.2, JN = JR * 0.84, JMID = (JB + JS) / 2;  // omuz yuksekligi, boyun yaricapi, kirilma cizgisi
// cam ve recel icin yumusak bir mutfak yansimasi (pencere isiklari); sadece bu malzemeler kullanir
const ENV = (() => {
  const t = canvasTex(512, 256, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.45, '#ffeedd'); gr.addColorStop(0.55, '#d9b8a0'); gr.addColorStop(1, '#6a5048');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    const blob = (cx, cy, rx, ry, a) => { x.save(); x.translate(cx, cy); x.scale(1, ry / rx); const g2 = x.createRadialGradient(0, 0, 0, 0, 0, rx); g2.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g2.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g2; x.beginPath(); x.arc(0, 0, rx, 0, 6.283); x.fill(); x.restore(); };
    blob(150, 70, 70, 50, 1); blob(380, 80, 50, 40, 0.7); blob(260, 40, 120, 30, 0.5);
  });
  t.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(ren), e = pm.fromEquirectangular(t).texture; pm.dispose(); return e;
})();
const V2D = (x, y) => new THREE.Vector2(x, y);
// alttan uste cam profili: yuvarlak dip kosesi, duz govde, omuz, boyun
function jarProfile() {
  const p = [V2D(0, JB)];
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; p.push(V2D(JR - 0.1 + 0.1 * Math.sin(a), JB + 0.1 - 0.1 * Math.cos(a))); }
  p.push(V2D(JR, JMID), V2D(JR, JS));
  for (let i = 1; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; p.push(V2D(JN + (JR - JN) * Math.cos(a), JS + (JT - 0.06 - JS) * Math.sin(a))); }
  p.push(V2D(JN, JT), V2D(JN - 0.04, JT));
  return p;
}
let JM = null;
function jarKit() {
  if (JM) return JM;
  const glass = new THREE.MeshPhysicalMaterial({ color: '#f4fbff', transparent: true, opacity: 0.16, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, envMap: ENV, envMapIntensity: 1.1, side: THREE.DoubleSide, depthWrite: false });
  const shard = glass.clone(); shard.opacity = 0.55; shard.color = new THREE.Color('#dff4ff'); shard.emissive = new THREE.Color('#bfe8ff'); shard.emissiveIntensity = 0.25;
  const jamTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#a00a22'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { x.fillStyle = 'rgba(120,0,20,' + (0.2 + Math.random() * 0.4) + ')'; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 14, 4 + Math.random() * 8, Math.random() * 3, 0, 6.283); x.fill(); }
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(255,70,90,' + (0.3 + Math.random() * 0.4) + ')'; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 8, 0, 6.283); x.fill(); }
    x.fillStyle = '#ffd36b'; for (let i = 0; i < 70; i++) { x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 1.6, 2.6, Math.random() * 3, 0, 6.283); x.fill(); }
  }, [3, 2]);
  const jam = new THREE.MeshPhysicalMaterial({ map: jamTex, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMap: ENV, envMapIntensity: 0.6, color: '#d8d0d0', emissive: '#5a0010', emissiveIntensity: 0.12 });
  // kareli bez: yari saydam kirmizi seritler ust uste binince kesisimler koyulasir
  const ging = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#fff8f0'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(226,36,58,.55)';
    for (let k = 0; k < 4; k++) { x.fillRect(k * 32, 0, 16, h); x.fillRect(0, k * 32, w, 16); }
    for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(0,0,0,' + Math.random() * 0.05 + ')'; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
  }, [7, 3]);
  const cloth = new THREE.MeshStandardMaterial({ map: ging, roughness: 0.85, side: THREE.DoubleSide });
  const rib = new THREE.MeshPhysicalMaterial({ color: '#ffc43d', roughness: 0.3, clearcoat: 1, envMap: ENV, envMapIntensity: 0.7 });
  const lab = new THREE.MeshStandardMaterial({ map: TX.recel_etiket, roughness: 0.55 });
  const prof = jarProfile(), glassGeo = new THREE.LatheGeometry(prof, 40);
  // recel: camin biraz icinde, omzun altina kadar dolu, ustu hafif kubbe
  const ri = JR - 0.035, jb = JB + 0.04, jt = JS - 0.03, jp = [V2D(0, jb)];
  for (let i = 0; i <= 5; i++) { const a = (i / 5) * Math.PI / 2; jp.push(V2D(ri - 0.08 + 0.08 * Math.sin(a), jb + 0.08 - 0.08 * Math.cos(a))); }
  jp.push(V2D(ri, jt), V2D(ri - 0.06, jt + 0.04), V2D(ri * 0.5, jt + 0.07), V2D(0, jt + 0.075));
  const jamGeo = new THREE.LatheGeometry(jp, 32);
  // etiket: on yuzde kavisli kagit (4:3 resim, yay uzunlugu = yukseklik*4/3)
  const lh = 0.6, lr = JR + 0.012, labGeo = new THREE.CylinderGeometry(lr, lr, lh, 20, 1, true, -lh * 4 / 3 / lr / 2, lh * 4 / 3 / lr);
  labGeo.translate(0, JB + 0.1 + (JS - JB - 0.1) / 2 - 0.02, 0);
  // bez kapak (kapak grubunun merkezi y=JT): kubbe ust, boyna sarilan kurdele, asagi sarkan dalgali etek
  const cp = [V2D(0, 0.14), V2D(0.25, 0.135), V2D(JN * 0.8, 0.12), V2D(JN + 0.05, 0.08), V2D(JN + 0.08, 0.03), V2D(JN + 0.1, -0.02), V2D(JR + 0.02, -0.12), V2D(JR + 0.07, -0.21)];
  const clothGeo = new THREE.LatheGeometry(cp, 72), pa = clothGeo.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); if (y >= 0.03) continue;
    const t = (0.03 - y) / 0.24, ph = Math.atan2(x, z), k = 1 + 0.07 * t * Math.sin(9 * ph);
    pa.setXYZ(i, x * k, y + 0.03 * t * Math.sin(9 * ph + 1), z * k);
  }
  clothGeo.computeVertexNormals();
  const ribGeo = new THREE.TorusGeometry(JN + 0.105, 0.035, 8, 48); ribGeo.rotateX(Math.PI / 2);
  const loopGeo = new THREE.TorusGeometry(0.085, 0.03, 8, 18), knotGeo = new THREE.SphereGeometry(0.05, 12, 10);
  // kirilinca: cam 4 dilim x 2 kat = 8 kavisli parca (her biri kendi merkezine gore)
  const shards = [], lo = prof.filter((v) => v.y <= JMID + 1e-6), hi = prof.filter((v) => v.y >= JMID - 1e-6);
  for (let a = 0; a < 4; a++) for (const band of [lo, hi]) {
    const g0 = new THREE.LatheGeometry(band, 5, a * Math.PI / 2 + (Math.random() - 0.5) * 0.3, Math.PI / 2 * (0.8 + Math.random() * 0.3));
    g0.computeBoundingBox(); const c = g0.boundingBox.getCenter(new THREE.Vector3()); g0.translate(-c.x, -c.y, -c.z); shards.push({ geo: g0, c });
  }
  return (JM = { glass, shard, jam, cloth, rib, lab, glassGeo, jamGeo, labGeo, clothGeo, ribGeo, loopGeo, knotGeo, shards, blobGeo: new THREE.SphereGeometry(0.2, 14, 10) });
}
function makeJar() {
  const K = jarKit(), gr = new THREE.Group();
  const add = (geo, mat, par) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; (par || gr).add(m); return m; };
  add(K.jamGeo, K.jam); add(K.labGeo, K.lab);
  const gl = add(K.glassGeo, K.glass); gl.castShadow = false; gl.renderOrder = 2;
  const lid = new THREE.Group(); lid.position.y = JT; gr.add(lid);
  add(K.clothGeo, K.cloth, lid); add(K.ribGeo, K.rib, lid);
  const bz = JN + 0.14;   // kurdele fiyonku onde
  const l1 = add(K.loopGeo, K.rib, lid); l1.position.set(-0.08, 0.02, bz); l1.rotation.set(0, 0.5, 0.5);
  const l2 = add(K.loopGeo, K.rib, lid); l2.position.set(0.08, 0.02, bz); l2.rotation.set(0, -0.5, -0.5);
  const kn = add(K.knotGeo, K.rib, lid); kn.position.set(0, 0, bz + 0.02);
  gr.userData.lid = lid;
  return gr;
}
// ucusan parcalar (cam, kapak, recel topagi): basit kinematik; platformun ustune ya da zemine duser, sonra kuculup kaybolur
const DEB = [], SPL = [];
const rndV = (k) => new THREE.Vector3((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
function floorAt(x, z) { return (KARE(TEMA_YAPI[1]) ? Math.abs(x) < R && Math.abs(z) < R : x * x + z * z < R * R) ? 0 : GY; }
function debris(m, pos, vel, spin, life, kind, h, sr) { m.position.copy(pos); scene.add(m); DEB.push({ m, v: vel, w: spin, life, kind, s: m.scale.clone(), h, sr }); }
let SPLMAT = null;
const SPLGEO = new THREE.PlaneGeometry(2, 2);
function splat(x, y, z, r) {
  if (!SPLMAT) {
    const t = canvasTex(256, 256, (c, w, h) => {
      c.fillStyle = '#c4142c'; c.beginPath(); c.arc(128, 128, 78, 0, 6.283); c.fill();
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + Math.random() * 0.3, d = 66 + Math.random() * 30, rr = 10 + Math.random() * 16; c.beginPath(); c.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, rr, 0, 6.283); c.fill(); }
      for (let i = 0; i < 12; i++) { const a = Math.random() * 6.283, d = 104 + Math.random() * 18, rr = 3 + Math.random() * 6; c.beginPath(); c.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, rr, 0, 6.283); c.fill(); }
      const gr = c.createRadialGradient(128, 128, 10, 128, 128, 110); gr.addColorStop(0, 'rgba(110,0,20,.45)'); gr.addColorStop(1, 'rgba(110,0,20,0)'); c.globalCompositeOperation = 'source-atop'; c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(100, 98, 30, 14, -0.6, 0, 6.283); c.fill();
    });
    SPLMAT = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.15, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, envMap: ENV, envMapIntensity: 0.6 });
  }
  const m = new THREE.Mesh(SPLGEO, SPLMAT); m.rotation.set(-Math.PI / 2, 0, Math.random() * 6.283); m.position.set(x, y + 0.012 + (SPL.length % 8) * 0.002, z);
  m.scale.setScalar(0.01); m.receiveShadow = true; scene.add(m); SPL.push({ m, x, y, z, r, k: 0 });
}
function updateDebris(dt) {
  for (let i = DEB.length - 1; i >= 0; i--) {
    const d = DEB[i], m = d.m; d.life -= dt; d.v.y -= 22 * dt; m.position.addScaledVector(d.v, dt);
    m.rotation.x += d.w.x * dt; m.rotation.y += d.w.y * dt; m.rotation.z += d.w.z * dt;
    const f0 = floorAt(m.position.x, m.position.z), fy = f0 + (d.h || 0.04);
    if (m.position.y < fy && d.v.y < 0 && m.position.y > fy - 0.8) {
      if (d.kind === 'blob') { splat(m.position.x, f0, m.position.z, d.sr || 0.3 + Math.random() * 0.25); burst(new THREE.Vector3(m.position.x, f0 + 0.1, m.position.z), '#d01830', d.sr ? 10 : 3, 3); d.life = 0; }
      else { m.position.y = fy; d.v.y *= -0.3; d.v.x *= 0.55; d.v.z *= 0.55; d.w.multiplyScalar(0.5); }
    }
    if (d.life < 0.5) m.scale.copy(d.s).multiplyScalar(Math.max(0, d.life / 0.5));
    if (d.life <= 0 || m.position.y < GY - 3) { scene.remove(m); DEB.splice(i, 1); }
  }
  for (const s of SPL) if (s.k < 1) { s.k = Math.min(1, s.k + dt * 7); s.m.scale.setScalar(s.r * (0.3 + 0.7 * s.k)); }
}
function breakJar(c) {
  const K = jarKit(), p = new THREE.Vector3().copy(c.body.position), q = new THREE.Quaternion().copy(c.body.quaternion);
  for (const sh of K.shards) {
    const m = new THREE.Mesh(sh.geo, K.shard); m.quaternion.copy(q); m.renderOrder = 2;
    const ctr = sh.c.clone().applyQuaternion(q), v = new THREE.Vector3(ctr.x, 0, ctr.z).normalize().multiplyScalar(2.5 + Math.random() * 3.5); v.y += 3 + Math.random() * 4;
    debris(m, p.clone().add(ctr), v, rndV(12), 1.8 + Math.random() * 0.6, 'cam');
  }
  const lid = c.mesh.userData.lid, lp = new THREE.Vector3(0, JT, 0).applyQuaternion(q).add(p);
  lid.removeFromParent(); lid.position.set(0, 0, 0); lid.quaternion.copy(q);
  debris(lid, lp, new THREE.Vector3((Math.random() - 0.5) * 3, 7 + Math.random() * 2, (Math.random() - 0.5) * 2), rndV(9), 2.6, 'kapak');
  // icindeki recel tek bir koca topak olarak duser, yere carpinca buyuk leke olur; cevreye damlalar sacilir
  const lump = new THREE.Mesh(K.jamGeo, K.jam); lump.quaternion.copy(q); lump.castShadow = true;
  debris(lump, p.clone(), new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.5, (Math.random() - 0.5) * 1.5), rndV(1.5), 4, 'blob', 0.55, 0.9);
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(K.blobGeo, K.jam), s = 0.7 + Math.random() * 0.6; m.scale.set(s, s * 0.75, s); m.castShadow = true;
    const a = Math.random() * 6.283, v = new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 3), 4 + Math.random() * 3, Math.sin(a) * (2 + Math.random() * 3));
    debris(m, p.clone().add(new THREE.Vector3(Math.cos(a) * 0.25, Math.random() * 0.3, Math.sin(a) * 0.25)), v, rndV(4), 4, 'blob', 0.12);
  }
  burst(p, '#e8203a', 18, 6); burst(p, '#ffffff', 8, 5); sfx('cam'); sfx('slap');
  const at = screenAt(p, 0.6); floatText('Şlap!', at[0], at[1]);
  shake = Math.min(0.6, shake + 0.25); wakeAll(); g.busy = Math.max(g.busy, 1.5);
}

// ---------------- bolumler ----------------
const C = { kir: '#ff4256', tur: '#ff9a1f', sar: '#ffd23f', mav: '#3d7bff', mor: '#a25cff', yes: '#2fcf73', pem: '#ff6fcf', tur2: '#22c8e8' };
// her bolum: kup listesi [i, j(kat), k, renk] (izgara birimi), top sayisi, arka plan
function box(o, i0, i1, j0, j1, k0, k1, col) { for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) o.push([i, j, k, typeof col === 'function' ? col(i, j, k) : col]); return o; }
// zorluk egrisi: bolum ilerledikce top sayisi azalir, yapilar agirlasir (tugla/celik) ve ozel bloklar artar.
// renk (#...) yerine malzeme adi da yazilabilir: sandik, tugla, celik, buz, jole, cam, fici, bomba, altin, hediye, yildiz
const LEVELS = [
  { ad: 'Reçel Rafı', top: 7, tema: ['cayir1', 'seker'], make: () => { const o = box([], 0, 4, 0, 0, 0, 1, (i) => [C.kir, C.tur, C.sar, C.yes, C.mav][i]);
    box(o, 0, 4, 1, 1, 0, 1, (i, j, k) => (k === 1 && (i === 1 || i === 3) ? 'recel' : k === 1 ? C.mor : C.tur)); box(o, 0, 4, 2, 2, 0, 1, C.sar);
    o.push([1, 3, 1, 'recel'], [2, 3, 1, 'hediye'], [3, 3, 1, 'recel'], [0, 3, 0, 'recel'], [4, 3, 0, 'recel']); return o; } },
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
// Yapi bolumunun tek fonu ve platformu (Adem 4 Kas 2026): col harabesi resmi + kare tas platform. Eski temalar yukarida duruyor.
const TEMA_YAPI = ['harabe', 'harabe'];
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
const cubes = [], balls = [], CUBE_OF = new Map();
function clearLevel() {
  for (const c of cubes) { world.removeBody(c.body); scene.remove(c.mesh); }
  for (const b of balls) { world.removeBody(b.body); scene.remove(b.mesh); }
  for (const d of DEB) scene.remove(d.m); for (const s of SPL) scene.remove(s.m);
  CUBE_OF.clear(); cubes.length = 0; balls.length = 0; DEB.length = 0; SPL.length = 0;
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
  if (KARE(TEMA_YAPI[1])) { platBody.addShape(new CANNON.Box(new CANNON.Vec3(R, PT / 2, R)), new CANNON.Vec3(0, -PT / 2, 0)); platBody.addShape(new CANNON.Box(new CANNON.Vec3(1.35, (-GY - PT) / 2, 1.35)), new CANNON.Vec3(0, (GY - PT) / 2, 0)); }
  else { platBody.addShape(new CANNON.Cylinder(R, R, PT, 32), new CANNON.Vec3(0, -PT / 2, 0)); platBody.addShape(new CANNON.Cylinder(1.05, 1.3, -GY - PT, 16), new CANNON.Vec3(0, (GY - PT) / 2, 0)); }
  POFI.z = R + 5.6; pedG.position.copy(POFI); PF.holder.position.copy(POFI); fit();
  for (const [i, j, k, col] of list) {
    const kd = col[0] === '#' ? null : KIND[col], mg = fitCube(kd ? col : 'kup'), isF = col === 'fici' && !mg;
    const pm = kd ? (kd.pm || (kd.pm = new CANNON.Material({ friction: kd.f, restitution: kd.r }))) : PM.cube;
    const body = new CANNON.Body({ mass: kd ? kd.mass : 1, material: pm, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.4, linearDamping: 0.02, angularDamping: 0.06 });
    const isE = kd && kd.esya; body.addShape(isF || isE ? FICISHAPE : CUBESHAPE); body.position.set((i - ci) * S, S / 2 + j * (S + 0.002), (k - ck) * S);
    if (isE) body.quaternion.setFromEuler(0, (Math.random() - 0.5) * 0.5, 0);
    world.addBody(body); body.sleep();
    const mesh = isE ? makeJar() : mg ? new THREE.Mesh(mg, kd ? MOD[col].mat : kupModelMat(col)) : new THREE.Mesh(isF ? FICIGEO : CUBEGEO, kd ? kindMat(col) : kupMat(col)); mesh.castShadow = true; mesh.receiveShadow = col !== 'cam'; scene.add(mesh);
    const c = { body, mesh, col, kind: kd ? col : null, gone: false, out: false };
    // kirilan/patlayan: carpisma olayi adimin icinde gelir, isi adimdan sonra yapilir (FUSE)
    if (kd && (kd.kir || kd.boom)) body.addEventListener('collide', (e) => {
      if (!g || !g.armed || c.out || c.fuse != null || (c.gone && !kd.esya)) return;   // dusen kavanoz yerde de kirilir
      if (Math.abs(e.contact.getImpactVelocityAlongNormal()) > (kd.kir || 3.2)) { c.fuse = 0; FUSE.push(c); }
    });
    cubes.push(c); CUBE_OF.set(body, c);
  }
  syncMeshes();
  g = { L: LV, ad: Y.ad, total: cubes.length, left: cubes.length, shots: Y.top, max: Y.top, state: 'play', t: 0, busy: 0, quiet: 0, combo: null, armed: false, bonus: 0, gold: 0 };
  FUSE.length = 0;
  const tm = TEMA_YAPI; $('bg').style.backgroundImage = 'url(fon/' + tm[0] + '.webp)'; setPlat(tm[1]);
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
const BR = 0.27;   // v5.3: top kucultuldu (0.42 cok iriydi)
const BALLGEO = new THREE.SphereGeometry(BR, 32, 20);
const TRAILGEO = new THREE.SphereGeometry(0.16, 12, 8);
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
  let T = Math.max(0.2, Math.min(0.4, dv.length() / 62));   // v5.3: daha hizli, daha duz atis
  for (; T < 2.2; T += 0.03) { const te = edge * T, vy = dv.y / T - 0.5 * gy * T; if (st.y + vy * te + 0.5 * gy * te * te > 0.9) break; }
  const v = new CANNON.Vec3(dv.x / T, dv.y / T - 0.5 * gy * T, dv.z / T);
  const col = PF.col || '#3d9bff';
  const body = new CANNON.Body({ mass: 38, material: PM.ball, linearDamping: 0.01, allowSleep: false }); body.addShape(new CANNON.Sphere(BR));
  body.position.set(st.x, st.y, st.z); body.velocity.copy(v); world.addBody(body);
  const mesh = new THREE.Mesh(BALLGEO, new THREE.MeshStandardMaterial({ color: col, roughness: 0.15, metalness: 0.1, emissive: col, emissiveIntensity: 0.45 })); mesh.castShadow = true; scene.add(mesh);
  const b = { body, mesh, t: 0, hit: false, trail: [], col, dir: new THREE.Vector3(v.x, v.y, v.z).normalize() };
  // ilk kupe carpista vurus dalgasi: carpisma adimin icinde gelir, itis adimdan sonra yapilir (b.blast)
  body.addEventListener('collide', (e) => { if (b.hit) return; const c = CUBE_OF.get(e.body); if (!c) return; b.hit = true; b.blast = new THREE.Vector3().copy(body.position); impact(b, e); });
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
// v5.3: atis guclendi. Top kupe degdigi an cevresindeki kupler (yaklasik 1.6 kup yaricap) top yonunde itilir;
// itis kupun merkezinin ustunden uygulandigi icin kup sadece kaymaz, devrilir. Agir malzeme (celik, tugla) daha az etkilenir.
const BLAST = { r: S * 1.6, hiz: 11, yukari: 2.2 };
const IMP = new CANNON.Vec3(), RP = new CANNON.Vec3();
function blast(b) {
  const p = b.blast, d = b.dir.clone(); d.y = Math.max(-0.2, Math.min(0.25, d.y)); d.normalize();
  for (const c of cubes) {
    if (c.gone || c.out) continue;
    const q = c.body.position, dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z, dist = Math.hypot(dx, dy, dz);
    if (dist > BLAST.r) continue;
    const k = 1 - dist / BLAST.r, m = c.body.mass, sp = BLAST.hiz * (0.35 + 0.65 * k) / Math.max(1, m * 0.55);
    // top yonu + biraz merkezden disari + hafif yukari
    const rx = dist > 0.01 ? dx / dist : 0, rz = dist > 0.01 ? dz / dist : 0;
    IMP.set((d.x * 0.8 + rx * 0.3) * sp * m, (d.y * 0.5 + 0.12) * sp * m + BLAST.yukari * k * m, (d.z * 0.8 + rz * 0.3) * sp * m);
    RP.set(0, S * 0.32, 0);   // merkezin ustu: devirme torku
    c.body.wakeUp(); c.body.applyImpulse(IMP, RP);
  }
}
function updateBalls(dt) {
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i]; b.t += dt; if (b.blast) { blast(b); b.blast = null; } b.mesh.position.copy(b.body.position); b.mesh.quaternion.copy(b.body.quaternion);
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
    const c = FUSE[i]; c.fuse -= dt; if (c.fuse > 0) continue; FUSE.splice(i, 1);
    const kd = KIND[c.kind], p = new THREE.Vector3().copy(c.body.position);
    if (c.out || (c.gone && !kd.esya)) continue;
    if (kd.esya) { breakJar(c); if (!c.gone) knock(c, true); else { c.out = true; world.removeBody(c.body); scene.remove(c.mesh); } continue; }
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
    if (SPL.length && !c.gone && !c.sticky && p.y > 0 && p.y < S * 0.75) for (const s of SPL) if (s.y > -0.5 && (p.x - s.x) ** 2 + (p.z - s.z) ** 2 < (s.r + S * 0.3) ** 2) { c.sticky = true; c.body.linearDamping = 0.9; c.body.angularDamping = 0.95; break; }   // recel lekesine basan yapisir
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
  else if (k === 'slap') { o.type = 'sine'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.15); v.gain.setValueAtTime(0.35, t); v.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.start(t); o.stop(t + 0.22);
    const nb = AC.createBuffer(1, AC.sampleRate * 0.18, AC.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), gv = AC.createGain(); f.type = 'lowpass'; f.frequency.value = 600; gv.gain.value = 0.6; s.buffer = nb; s.connect(f); f.connect(gv); gv.connect(AC.destination); s.start(t + 0.03); }
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
  const hits = ray.intersectObjects(cubes.filter((c) => !c.gone).map((c) => c.mesh), true);
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
  const y0 = Math.min(POFI.y, GY) - 0.6, y1 = TOPY + 1.4, tg = new THREE.Vector3(0, (y0 + y1) / 2 + 0.6, POFI.z * 0.25);
  const d = Math.max(14, (R + 0.6) / Math.tan(hf / 2), ((y1 - y0) / 2) / Math.tan(cam.fov * Math.PI / 360) * 1.05);
  const dir = new THREE.Vector3(0, 0.27, 1).normalize();
  cam.position.copy(tg).addScaledVector(dir, d); cam.lookAt(tg); cam.updateProjectionMatrix();
  cam.userData.base = cam.position.clone();
}
addEventListener('resize', fit); fit();

// ---------------- dongu ----------------
let last = 0, shake = 0;
function frame(ts) {
  const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
  if (g) { g.t += dt; world.step(1 / 120, dt, 8); updateFuse(dt); updateDebris(dt); syncMeshes(); updateBalls(dt); updateCubes(dt); if (KM.bomba) KM.bomba.emissiveIntensity = 0.45 + 0.4 * Math.sin(g.t * 8); }
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
