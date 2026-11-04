// BLOKPOP Yapi v3 (prototip) - v6.3: kayitli (sentezlenip mp3'e basilmis) sesler, yeni yazilar ve bolum bandi, atis dengesi. v6.2: 7 yeni model, platform kameraya duz bakar, top arabasi yerlesimi/olcusu yeniden, top ve kirilma gorunumu, atis/yikilma dengesi. v6.1: cam sekiller, her sey kirilir, boyama yok (Adem'in model renkleri), duz/esit atis, temiz platform ayagi, fon degisimi. v6.0: Royal Smash kalitesi icin atis/kirilma/ses/efekt yenilendi, kamera hafif yandan. v5.5: Pofi yok; onden bakis, altta yakindan buyuk top arabasi, metal kupler boyali. v5.4: cayir fonu + Adem'in Tripo modelleri (cizgili platform, top arabasi, top, ahsap/kirmizi/metal kupler). Direk ustundeki platformda iri metal kuplerden bir yapi; altta Pofi durur.
// Oyuncu yapida bir yere dokunur, Pofi hortumuyla oraya top atar. Kupler gercek fizikle (cannon-es) devrilir, platformdan
// dusen her kup sayilir. Hepsi dusunce bolum biter; toplar biterse kaybedilir.
import * as THREE from '../three.module.min.js';
import * as CANNON from '../cannon.min.js';
import { GLTFLoader } from '../GLTFLoader.js';
import { clone as skClone } from '../SkeletonUtils.js';
import { mergeGeometries } from '../BufferGeometryUtils.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search), TEST = Q.has('test');
const SKEY = 'blokpop_yapi_v3';
let SV = { L: 1, max: 1 };
try { const d = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (d) SV = Object.assign(SV, d); } catch (e) {}
const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(SV)); } catch (e) {} };

// ---------------- olculer ----------------
const S = 1.55;          // kup kenari (iri)
const R0 = 6.1;          // platform modelinin yaricapi
let R = R0, RZ = R0, TOPY = 6;   // R: platformun yarim genisligi (x), RZ: yarim derinligi (z)              // bu bolumdeki yaricap: yapinin hemen disi, itilen kup kenardan dussun
const GY = -4.0;         // zemin: platform kisa bir direk ustunde durur, dusen kupler direk dibindeki zeminde yuvarlanir
const PT = 1.1;          // platform tablasinin kalinligi (ust yuzey y=0)
const POFI = new THREE.Vector3(1.35, GY, 9.6);   // v5.4: Pofi top arabasinin yaninda; ikisi birlikte ortada   // v5.3: Pofi ortada (Adem: kenarda durmasin)
//     // Pofi kaidesiz, cimende durur; direkli platforma yukari atar   // Pofi'nin ayak yeri (z bolume gore platformun onune konur)
const GONE_Y = -0.45;    // bunun altina inen kup platformdan dusmus sayilir

// ---------------- cizim ----------------
const glc = $('gl');
const ren = new THREE.WebGLRenderer({ canvas: glc, antialias: true, alpha: true, preserveDrawingBuffer: TEST }); ren.setClearColor(0, 0);
ren.setPixelRatio(Math.min(2, devicePixelRatio || 1));
ren.outputColorSpace = THREE.SRGBColorSpace; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.32;   // v6.1: daha parlak
ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(40, 1, 0.5, 200);
scene.add(new THREE.HemisphereLight(0xfffaf0, 0x7a8a6a, 1.6));
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
// v5.4: Adem'in yeni Tripo modelleri (4 Kas 2026): ahsap kup sandigin, kirmizi patlayici kup ficinin, metal kup celigin yerine;
// cizgili platform, top ve top arabasi. Anahtar -> dosya adi.
const MFILE = { kup: 'kup_metal', metal: 'kup_metal', ahsap: 'kup_ahsap', kirmizi: 'kup_kirmizi', sandik: 'kup_ahsap', fici: 'varil', tugla: 'kup_tas', tas: 'kup_tas', buz: 'buz_silindir', altin: 'kup_altin', ahsapmetal: 'kup_ahsap_metal', piramitTas: 'piramit_tas', kabak: 'bal_kabagi', platform_ahsap: 'platform_ahsap', platform_tas: 'platform_tas', platform_sirk: 'platform_sirk', top: 'top', topcu: 'top_arabasi' };
const NEWM = new Set(['kup', 'metal', 'ahsap', 'kirmizi', 'sandik', 'platform_sirk', 'top', 'topcu', 'fici', 'tugla', 'tas', 'buz', 'altin', 'ahsapmetal', 'piramitTas', 'kabak']);
const GLBP = {};   // ayni dosya iki anahtarda (kup, celik) bir kez yuklenir
const modelReady = Promise.all(Object.keys(MFILE).map((n) => new Promise((res) => {
  const url = 'model/' + MFILE[n] + '.glb?v=' + (NEWM.has(n) ? 2 : 1);
  (GLBP[url] || (GLBP[url] = new Promise((ok) => new GLTFLoader().load(url, ok, undefined, () => ok(null))))).then((gl) => {
    if (!gl) return res();
    let m = null; gl.scene.updateMatrixWorld(true); gl.scene.traverse((o) => { if (o.isMesh && !m) m = o; });
    if (m) { const geo = m.geometry.clone().applyMatrix4(m.matrixWorld); geo.computeBoundingBox(); MOD[n] = { geo, mat: m.material }; if (!NEWM.has(n) && (n === 'sandik' || n === 'fici')) m.material.color.multiplyScalar(1.35); if (['kup', 'metal', 'ahsap', 'kirmizi', 'sandik', 'tas', 'tugla', 'ahsapmetal', 'altin', 'fici', 'buz', 'piramitTas', 'kabak'].includes(n) && !m.material.envMap) { m.material.envMap = ENV; m.material.envMapIntensity = 0.9; } }
    res();
  });
})));
// kup modeli: kenari S olan, merkezi orijinde bir kupe olceklenir
function fitCube(n) {
  const M = MOD[n]; if (!M) return null; if (M.cube) return M.cube;
  const g = M.geo.clone(), b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), z = b.getSize(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z); g.scale(S / z.x, S / z.y, S / z.z); g.computeBoundingSphere();
  return (M.cube = g);
}
// v6.2: oranini koruyan modeller: varil ve buz silindir (silindir), tas piramit (koni), bal kabagi (top). Yukseklik S (kabak genislik).
const KEEP = { fici: 'cyl', buz: 'cyl', piramitTas: 'cone', kabak: 'ball' };
function fitKeep(n) {
  const M = MOD[n]; if (!M) return null; if (M.keep) return M.keep;
  const g = M.geo.clone(), b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), z = b.getSize(new THREE.Vector3());
  const k = KEEP[n] === 'ball' ? S * 0.9 / Math.max(z.x, z.z) : S / z.y;
  g.translate(-c.x, -c.y, -c.z); g.scale(k, k, k); g.computeBoundingBox(); g.computeBoundingSphere();
  const bb = g.boundingBox; M.dim = { r: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2, h: bb.max.y - bb.min.y };
  return (M.keep = g);
}
function keepShape(n) {
  const d = MOD[n].dim, t = KEEP[n];
  if (t === 'cyl') return new CANNON.Cylinder(d.r * 0.96, d.r * 0.96, d.h, 14);
  if (t === 'cone') return new CANNON.Cylinder(d.r * 0.12, d.r * 0.92, d.h, 10);
  return new CANNON.Sphere(Math.min(d.r, d.h / 2) * 1.02);
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
// v5.4: dikdortgen platform: model genislik 2*rx, derinlik 2*rz olacak sekilde gerilir, ust yuzey y=0, ayagi zeminde (GY)
// v6.1: platform modelinin sadece tablasi kullanilir (gerilmis ayagi cirkin duruyordu); ayak kodla: cizgili direk + kaide
function fitPlatRect(n, rx, rz) {
  const M = MOD[n]; if (!M) return null;
  const src = M.geo, b = src.boundingBox, c = b.getCenter(new THREE.Vector3()), z = b.getSize(new THREE.Vector3()), pa = src.attributes.position;
  // tabla: disariya yakin (direk olamayacak) noktalarin en alti tablanin alt yuzu
  let top = b.min.y, bot = b.max.y; const rr = Math.min(z.x, z.z) * 0.18;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i) - c.x, w = pa.getZ(i) - c.z, y = pa.getY(i); if (x * x + w * w < rr * rr) top = Math.max(top, y); if (Math.abs(x) > z.x * 0.3) bot = Math.min(bot, y); }
  const cut = bot - (top - bot) * 0.05, idx = src.index ? src.index.array : null, keep = [];
  const n3 = idx ? idx.length : pa.count;
  for (let t = 0; t < n3; t += 3) { const a0 = idx ? idx[t] : t, a1 = idx ? idx[t + 1] : t + 1, a2 = idx ? idx[t + 2] : t + 2; if (pa.getY(a0) >= cut && pa.getY(a1) >= cut && pa.getY(a2) >= cut) keep.push(a0, a1, a2); }
  const g = src.clone(); g.setIndex(keep);
  const sx = 2 * rx / z.x, sz = 2 * rz / z.z, sy = 0.75 / Math.max(0.001, top - bot);   // tabla kalinligi ~0.75
  g.translate(-c.x, -top, -c.z); g.scale(sx, sy, sz); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}
const LEG = new THREE.Group(); scene.add(LEG);
{
  const st = canvasTex(128, 256, (x, w, h) => { x.fillStyle = '#2f6fe0'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd23f'; for (let i = -4; i < 12; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(w, i * 32 - 40); x.lineTo(w, i * 32 - 22); x.lineTo(0, i * 32 + 18); x.fill(); } }, [2, 2]);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 1, 32), new THREE.MeshStandardMaterial({ map: st, roughness: 0.35, metalness: 0.1 })); pole.castShadow = pole.receiveShadow = true;
  const gold = new THREE.MeshStandardMaterial({ color: '#ffc93a', roughness: 0.28, metalness: 0.55 }), blue = new THREE.MeshStandardMaterial({ color: '#3a6fe8', roughness: 0.35 });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.7, 0.35, 40), gold), base = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.75, 0.55, 48), blue), ring = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.1, 10, 48), gold), cap = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.25, 0.32, 40), gold);
  ring.rotation.x = Math.PI / 2; base.castShadow = base.receiveShadow = cap.castShadow = collar.castShadow = true;
  LEG.add(pole, collar, base, ring, cap); LEG.userData = { pole, collar, base, ring, cap };
}
function setLeg() {
  const u = LEG.userData, y0 = -0.75, top = y0 - 0.3, bot = GY + 0.82;
  u.collar.position.y = y0 - 0.17; u.pole.scale.set(1, top - bot, 1); u.pole.position.y = (top + bot) / 2;
  u.base.position.y = GY + 0.275; u.ring.position.y = GY + 0.42; u.cap.position.y = GY + 0.7;
}
setLeg();
const SIRK = { mesh: null };
// v5.5: platform direginin dibinde yuvarlak zemin lekesi; v6.1: rengi fona gore (cayirda toprak, karda kar, sahilde kum)
let TOZ = '#d9c3a0';
const DIRT = (() => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 1 }));
  m.rotation.x = -Math.PI / 2; m.position.y = GY + 0.015; m.receiveShadow = true; scene.add(m); return m;
})();
const DIRTT = {};
function setDirt(fo) {
  TOZ = fo.toz;
  DIRT.material.map = DIRTT[fo.f] || (DIRTT[fo.f] = canvasTex(256, 256, (x, w, h) => {
    const [a, b, c] = fo.dirt, gg = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gg.addColorStop(0, 'rgba(' + a + ',1)'); gg.addColorStop(0.72, 'rgba(' + b + ',0.95)'); gg.addColorStop(0.86, 'rgba(' + c + ',0.55)'); gg.addColorStop(1, 'rgba(' + c + ',0)');
    x.fillStyle = gg; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const an = Math.random() * 6.283, r = Math.random() * w * 0.36; x.fillStyle = Math.random() < 0.5 ? 'rgba(90,60,30,.12)' : 'rgba(255,255,255,.18)'; x.beginPath(); x.ellipse(w / 2 + Math.cos(an) * r, h / 2 + Math.sin(an) * r, 2 + Math.random() * 9, 1 + Math.random() * 4, Math.random() * 3, 0, 6.283); x.fill(); }
  }));
  DIRT.material.needsUpdate = true;
}
function setSirk(rx, rz) {
  if (SIRK.mesh) { scene.remove(SIRK.mesh); SIRK.mesh.geometry.dispose(); SIRK.mesh = null; }
  const geo = fitPlatRect('platform_sirk', rx, rz); if (!geo) return;
  SIRK.mesh = new THREE.Mesh(geo, MOD.platform_sirk.mat); SIRK.mesh.castShadow = SIRK.mesh.receiveShadow = true; scene.add(SIRK.mesh);
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
  if (SIRK.mesh) SIRK.mesh.visible = t === 'sirk'; LEG.visible = t === 'sirk';
  if (kare || t === 'sirk') { for (const k in PLM) if (PLM[k]) PLM[k].big.visible = PLM[k].ped.visible = false; for (const o of [PL.top, PL.ring, PL.ring2, PL.ped, PL.pr, PL.base, PL.foot]) o.visible = false; return; }
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
let KGRAY = null;
function kupGray() {
  if (KGRAY) return KGRAY;
  const src = MOD.kup.mat.map; if (!src || !src.image) return (KGRAY = src);
  const im = src.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
  let sum = 0; for (let i = 0; i < a.length; i += 4) sum += 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2];
  const mean = sum / (a.length / 4) || 1;
  for (let i = 0; i < a.length; i += 4) { const L = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2], v = Math.max(0, Math.min(255, 215 + (L - mean) * 1.5)); a[i] = a[i + 1] = a[i + 2] = v; }
  x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = src.flipY; t.anisotropy = 4;
  return (KGRAY = t);
}
function kupModelMat(col) {
  if (KMOD[col]) return KMOD[col];
  // v5.5: metal kup modeli (koyu gri doku) bolum rengine boyanir: dokunun acik gri hali detay olarak kalir, rengi bolum verir
  const m = MOD.kup.mat.clone(); m.map = kupGray(); m.color = new THREE.Color(col).multiplyScalar(1.05);
  m.emissive = new THREE.Color(col); m.emissiveIntensity = 0.16; m.metalness = 0.15; m.roughness = 0.42;
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
  metal: { mass: 1.3, f: 0.62, r: 0.12 }, ahsap: { mass: 0.8, f: 0.62, r: 0.15 }, kirmizi: { mass: 1, f: 0.62, r: 0.15 },
  tas: { mass: 1.8, f: 0.75, r: 0.08 }, ahsapmetal: { mass: 1.1, f: 0.65, r: 0.12 }, piramitTas: { mass: 1, f: 0.7, r: 0.08 }, kabak: { mass: 0.7, f: 0.55, r: 0.2 },   // v6.2   // v6.1: Adem'in kup modelleri, orijinal renkleri
  tugla: { mass: 2.4, f: 0.85, r: 0.1 },
  celik: { mass: 5, f: 0.7, r: 0.05 },
  buz: { mass: 1, f: 0.12, r: 0.1, kir: 7 },
  jole: { mass: 0.8, f: 0.6, r: 0.95, kir: 9 },
  cam: { mass: 0.9, f: 0.5, r: 0.1, kir: 5 },                  // bu hizla carpinca kirilir
  fici: { mass: 0.8, f: 0.6, r: 0.15, boom: 2.3, guc: 15 },   // v6.3: testte tek patlama 63 blogun 44'unu yikiyordu   // patlama yaricapi (kup cinsinden) ve itis hizi
  bomba: { mass: 1.2, f: 0.6, r: 0.1, boom: 3.2, guc: 22 },
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

// ---------------- v6.1 cam sekiller (Adem'in 2. sayfasi): kodla, parlak yari saydam cam + beyaz kenar cizgisi ----------------
// 'yig': ust uste konabilen (tam hucre), 'tepe': sadece sutunun tepesine konur. Her biri kirilir: topla vurulunca, sert carpinca, yere dusunce.
const GS = S * 0.98;
function glassGeo(n) {
  const s = GS, h = s / 2; let g, hh = s;   // hh: sekil yuksekligi
  const box = (w, y, d, r) => roundBox(w, y, d, r || s * 0.07, 3);
  const at = (geo, x, y, z) => { geo.translate(x, y, z); return geo; };
  switch (n) {
    case 'kup': g = box(s, s, s); break;
    case 'silindir': g = new THREE.CylinderGeometry(s * 0.42, s * 0.42, s, 36); break;
    case 'altigen': g = new THREE.CylinderGeometry(s * 0.49, s * 0.49, s, 6); break;
    case 'prizma': g = new THREE.CylinderGeometry(s * 0.56, s * 0.56, s, 3); break;
    case 'kare': g = box(s * 0.62, s, s * 0.62); break;
    case 'yivli': { g = new THREE.CylinderGeometry(s * 0.4, s * 0.4, s, 64, 1); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); if (r < 1e-4) continue; const a = Math.atan2(z, x), k = 1 - 0.07 * Math.max(0, Math.cos(a * 12)); p.setX(i, x * k); p.setZ(i, z * k); }
      g.computeVertexNormals(); break; }
    case 'L': g = mergeGeometries([at(box(s * 0.4, s, s * 0.9), -s * 0.3, 0, 0), at(box(s, s * 0.36, s * 0.9), 0, -s * 0.32, 0)]); break;
    case 'kemer': { const sh = new THREE.Shape(), R = s * 0.5, r = s * 0.27; sh.moveTo(-R, 0); sh.absarc(0, 0, R, Math.PI, 0, true); sh.lineTo(r, 0); sh.absarc(0, 0, r, 0, Math.PI, false); sh.lineTo(-R, 0);
      g = new THREE.ExtrudeGeometry(sh, { depth: s * 0.7, bevelEnabled: true, bevelSize: s * 0.03, bevelThickness: s * 0.03, bevelSegments: 2, curveSegments: 24 });
      g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -(b.max.z + b.min.z) / 2); g.scale(1, s / (b.max.y - b.min.y), 1); break; }
    case 'buz': g = box(s, s, s, s * 0.12); break;
    // tepe sekilleri
    case 'kure': g = new THREE.SphereGeometry(s * 0.46, 32, 20); hh = s * 0.92; break;
    case 'kapsul': g = new THREE.CapsuleGeometry(s * 0.3, s * 0.38, 8, 24); hh = s * 0.98; break;
    case 'piramit': g = new THREE.ConeGeometry(s * 0.6, s * 0.85, 4); g.rotateY(Math.PI / 4); hh = s * 0.85; break;
    case 'koni': g = new THREE.ConeGeometry(s * 0.46, s * 0.9, 36); hh = s * 0.9; break;
    case 'kubbe': g = new THREE.SphereGeometry(s * 0.48, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(0, -s * 0.24, 0); hh = s * 0.48; break;
    case 'kristal': g = new THREE.LatheGeometry([new THREE.Vector2(0.001, -h), new THREE.Vector2(s * 0.27, -h), new THREE.Vector2(s * 0.22, s * 0.18), new THREE.Vector2(0.001, h)], 6); break;
    case 'kama': { const sh = new THREE.Shape(); sh.moveTo(-h, -s * 0.33); sh.lineTo(h, -s * 0.33); sh.lineTo(-h, s * 0.33); sh.lineTo(-h, -s * 0.33);
      g = new THREE.ExtrudeGeometry(sh, { depth: s * 0.8, bevelEnabled: false }); g.translate(0, 0, -s * 0.4); hh = s * 0.66; break; }
    case 'cubuk': g = box(s, s * 0.42, s * 0.5); hh = s * 0.42; break;
    case 'ince': g = box(s, s * 0.24, s * 0.24); hh = s * 0.24; break;
    case 'mazgal': g = mergeGeometries([box(s, s * 0.4, s * 0.62), at(box(s * 0.26, s * 0.24, s * 0.62), -s * 0.37, s * 0.3, 0), at(box(s * 0.26, s * 0.24, s * 0.62), 0, s * 0.3, 0), at(box(s * 0.26, s * 0.24, s * 0.62), s * 0.37, s * 0.3, 0)]);
      g.translate(0, -s * 0.12, 0); hh = s * 0.64; break;
    case 'Y': g = mergeGeometries([at(box(s * 0.36, s * 0.5, s), 0, 0, 0), at(box(s, s * 0.5, s * 0.36), 0, 0, -s * 0.32)]); hh = s * 0.5; break;
  }
  if (g.index === null) g = g; g.computeBoundingSphere();
  return { g, hh };
}
const GLASS = {   // ad: [renk, tur]   (renkler Adem'in resmindeki gibi)
  kup: ['#cfeaf6', 'yig'], silindir: ['#6fb8ff', 'yig'], altigen: ['#8fc8ff', 'yig'], prizma: ['#2fd8c8', 'yig'], kare: ['#2f63ff', 'yig'],
  yivli: ['#cfe3ea', 'yig'], L: ['#b5e6f4', 'yig'], kemer: ['#a5dcef', 'yig'], buz: ['#a9dcff', 'yig'],
  kure: ['#3fd65a', 'tepe'], kapsul: ['#ff63d0', 'tepe'], piramit: ['#ffbe2e', 'tepe'], koni: ['#ff8424', 'tepe'], kubbe: ['#5fb0ea', 'tepe'],
  kristal: ['#a9c6ff', 'tepe'], kama: ['#e27ff0', 'tepe'], cubuk: ['#9ed6ff', 'tepe'], ince: ['#bfe7ff', 'tepe'], mazgal: ['#b5e6f4', 'tepe'], Y: ['#b864ff', 'tepe']
};
const GYIG = Object.keys(GLASS).filter((k) => GLASS[k][1] === 'yig'), GTEPE = Object.keys(GLASS).filter((k) => GLASS[k][1] === 'tepe');
const GG = {}, GM = {}, EDGEM = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 });
function glassMat(n) {
  if (GM[n]) return GM[n];
  const c = new THREE.Color(GLASS[n][0]), solid = n === 'kure' || n === 'kapsul' || n === 'piramit' || n === 'koni' || n === 'kare' || n === 'prizma' || n === 'Y' || n === 'kama';
  return (GM[n] = new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: solid ? 0.8 : 0.58, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04,
    envMap: ENV, envMapIntensity: 1.3, emissive: c, emissiveIntensity: solid ? 0.22 : 0.14, side: THREE.DoubleSide, depthWrite: false }));
}
function glassInfo(n) { return GG[n] || (GG[n] = glassGeo(n)); }
function makeGlass(n) {
  const { g } = glassInfo(n), m = new THREE.Mesh(g, glassMat(n));
  if (!g.userData.edges) g.userData.edges = new THREE.EdgesGeometry(g, 28);
  m.add(new THREE.LineSegments(g.userData.edges, EDGEM)); m.renderOrder = 2; return m;
}
function glassShape(n) {
  const s = GS, { hh } = glassInfo(n);
  if (n === 'silindir' || n === 'yivli') return new CANNON.Cylinder(s * 0.42, s * 0.42, s, 12);
  if (n === 'altigen') return new CANNON.Cylinder(s * 0.48, s * 0.48, s, 6);
  if (n === 'kure') return new CANNON.Sphere(s * 0.46);
  if (n === 'piramit' || n === 'koni' || n === 'kristal') return new CANNON.Cylinder(s * 0.06, s * 0.42, hh, 8);
  if (n === 'kubbe') return new CANNON.Cylinder(s * 0.3, s * 0.48, hh, 10);
  if (n === 'kare') return new CANNON.Box(new CANNON.Vec3(s * 0.31, s / 2, s * 0.31));
  if (n === 'kapsul') return new CANNON.Cylinder(s * 0.3, s * 0.3, hh, 10);
  if (n === 'cubuk') return new CANNON.Box(new CANNON.Vec3(s / 2, hh / 2, s * 0.25));
  if (n === 'ince') return new CANNON.Box(new CANNON.Vec3(s / 2, hh / 2, s * 0.12));
  if (n === 'mazgal') return new CANNON.Box(new CANNON.Vec3(s / 2, hh / 2, s * 0.31));
  return new CANNON.Box(new CANNON.Vec3(s / 2, hh / 2, s / 2));
}
for (const n in GLASS) KIND['g_' + n] = { mass: GLASS[n][1] === 'tepe' ? 0.5 : 0.75, f: 0.5, r: 0.12, kir: 6.5, cam: n };

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
function floorAt(x, z) { return (TEMA_YAPI[1] === 'sirk' ? Math.abs(x) < R && Math.abs(z) < RZ : KARE(TEMA_YAPI[1]) ? Math.abs(x) < R && Math.abs(z) < R : x * x + z * z < R * R) ? 0 : GY; }
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
const TEMA_YAPI = ['cayir4', 'sirk'];
// v6.1: fon her 3 bolumde bir degisir: cayir, karli koy, sahil. Zemin lekesi ve toz rengi fona uyar.
const FONLAR = [{ f: 'cayir4', dirt: ['176,128,82', '160,112,70', '120,92,50'], toz: '#d9c3a0' }, { f: 'kar3', dirt: ['236,242,252', '222,232,248', '200,214,236'], toz: '#ffffff' }, { f: 'sahil3', dirt: ['240,214,160', '228,198,140', '210,180,120'], toz: '#f3dfb4' }];
function fonOf(L) { return FONLAR[Math.floor((L - 1) / 3) % FONLAR.length]; }   // v5.4: Adem'in cayir resmi + cizgili Tripo platformu (harabe kodu duruyor)
// v6.1: bolum tasarimindaki renkler artik boya degil; renk ailesine gore Adem'in kup modeline (orijinal rengiyle) ya da cam sekle donusur.
// Sutun tepeleri cogunlukla cam tepe sekli (kure, piramit, koni, kristal...), govdenin bir kismi cam yigin sekli olur. Bolume gore sabit.
const COLFAM = { '#ff4256': 'kirmizi', '#ff6fcf': 'kirmizi', '#ff9a1f': 'ahsap', '#ffd23f': 'ahsapmetal', '#3d7bff': 'metal', '#a25cff': 'tas', '#22c8e8': 'tas', '#2fcf73': 'ahsapmetal' };
const MTEPE = ['piramitTas', 'kabak', 'buz'];   // v6.2: Adem'in modelleri de sutun tepesinde
function rnd3(a, b, c, d) { let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (d * 2654435761); h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function convertLevel(list, L) {
  const top = {}; for (const [i, j, k] of list) { const key = i + ',' + k; top[key] = Math.max(top[key] ?? -1, j); }
  return list.map(([i, j, k, col]) => {
    if (col[0] !== '#') return [i, j, k, col];
    const a = rnd3(L, Math.round(i * 2), j, Math.round(k * 2)), b = rnd3(L + 99, Math.round(i * 2), j, Math.round(k * 2));
    if (top[i + ',' + k] === j && a < 0.62) return [i, j, k, b < 0.4 ? MTEPE[Math.floor(b / 0.4 * MTEPE.length)] : 'g_' + GTEPE[Math.floor((b - 0.4) / 0.6 * GTEPE.length)]];
    if (a < 0.22) return [i, j, k, 'g_' + GYIG[Math.floor(b * GYIG.length)]];
    return [i, j, k, COLFAM[col] || 'metal'];
  });
}
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
  const Y = levelOf(LV), list = convertLevel(Y.make(), LV);
  let i0 = 1e9, i1 = -1e9, k0 = 1e9, k1 = -1e9; for (const c of list) { i0 = Math.min(i0, c[0]); i1 = Math.max(i1, c[0]); k0 = Math.min(k0, c[2]); k1 = Math.max(k1, c[2]); }
  const ci = (i0 + i1) / 2, ck = (k0 + k1) / 2;
  // platform yapiya gore: en uzak kup kosesinin hemen disi
  R = 0;
  for (const [i, , k] of list) { const x = Math.abs(i - ci) * S + S / 2, z = Math.abs(k - ck) * S + S / 2; R = Math.max(R, Math.hypot(x, z)); }
  R = Math.max(3.4, R + 0.3); RZ = R; TOPY = 0; for (const c of list) TOPY = Math.max(TOPY, (c[1] + 1) * S);
  if (TEMA_YAPI[1] === 'sirk') {   // dikdortgen masa: yapinin her yanindan ~yarim kup bosluk
    let mx = 0, mz = 0; for (const [i, , k] of list) { mx = Math.max(mx, Math.abs(i - ci) * S + S / 2); mz = Math.max(mz, Math.abs(k - ck) * S + S / 2); }
    R = Math.max(3.6, mx + 0.75); RZ = Math.max(2.6, mz + 0.9); setSirk(R, RZ); DIRT.scale.set(R * 1.5, RZ * 2.2, 1);
  }
  stage.scale.set(R / R0, 1, RZ / R0);
  while (platBody.shapes.length) platBody.removeShape(platBody.shapes[0]);
  if (TEMA_YAPI[1] === 'sirk') { platBody.addShape(new CANNON.Box(new CANNON.Vec3(R, 0.375, RZ)), new CANNON.Vec3(0, -0.375, 0)); platBody.addShape(new CANNON.Box(new CANNON.Vec3(0.55, (-GY - 0.75) / 2, 0.55)), new CANNON.Vec3(0, (GY - 0.75) / 2, 0)); }
  else if (KARE(TEMA_YAPI[1])) { platBody.addShape(new CANNON.Box(new CANNON.Vec3(R, PT / 2, R)), new CANNON.Vec3(0, -PT / 2, 0)); platBody.addShape(new CANNON.Box(new CANNON.Vec3(1.35, (-GY - PT) / 2, 1.35)), new CANNON.Vec3(0, (GY - PT) / 2, 0)); }
  else { platBody.addShape(new CANNON.Cylinder(R, R, PT, 32), new CANNON.Vec3(0, -PT / 2, 0)); platBody.addShape(new CANNON.Cylinder(1.05, 1.3, -GY - PT, 16), new CANNON.Vec3(0, (GY - PT) / 2, 0)); }
  POFI.z = RZ + 5.6; pedG.position.copy(POFI); PF.holder.position.copy(POFI); fit(); TC.aimYaw = TC.yaw = Math.PI;
  for (const [i, j, k, col] of list) {
    const kd = col[0] === '#' ? null : KIND[col], mg = fitCube(kd ? col : 'kup'), isF = col === 'fici' && !mg;
    const pm = kd ? (kd.pm || (kd.pm = new CANNON.Material({ friction: kd.f, restitution: kd.r }))) : PM.cube;
    const body = new CANNON.Body({ mass: kd ? kd.mass : 1, material: pm, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.4, linearDamping: 0.02, angularDamping: 0.06 });
    const isE = kd && kd.esya, gl = kd && kd.cam, kp = KEEP[col] && MOD[col] ? fitKeep(col) : null, ghh = gl ? glassInfo(gl).hh : kp ? MOD[col].dim.h : S;
    body.addShape(gl ? glassShape(gl) : kp ? keepShape(col) : isF || isE ? FICISHAPE : CUBESHAPE); body.position.set((i - ci) * S, ghh / 2 + j * (S + 0.002), (k - ck) * S);
    if (isE) body.quaternion.setFromEuler(0, (Math.random() - 0.5) * 0.5, 0);
    world.addBody(body); body.sleep();
    const mesh = gl ? makeGlass(gl) : kp ? new THREE.Mesh(kp, MOD[col].mat) : isE ? makeJar() : mg ? new THREE.Mesh(mg, kd ? MOD[col].mat : kupModelMat(col)) : new THREE.Mesh(isF ? FICIGEO : CUBEGEO, kd ? kindMat(col) : kupMat(col)); mesh.castShadow = !gl; mesh.receiveShadow = col !== 'cam' && !gl; scene.add(mesh);
    const c = { body, mesh, col, kind: kd ? col : null, gone: false, out: false, h: ghh };
    // kirilan/patlayan: carpisma olayi adimin icinde gelir, isi adimdan sonra yapilir (FUSE)
    if (kd && (kd.kir || kd.boom)) body.addEventListener('collide', (e) => {
      if (!g || !g.armed || c.out || c.fuse != null || (c.gone && !kd.esya)) return;   // dusen kavanoz yerde de kirilir
      if (Math.abs(e.contact.getImpactVelocityAlongNormal()) > (kd.kir || 3.2)) { c.fuse = 0; FUSE.push(c); }
    });
    cubes.push(c); CUBE_OF.set(body, c);
  }
  syncMeshes();
  g = { L: LV, ad: Y.ad, total: cubes.length, left: cubes.length, shots: shotsFor(cubes.length, Y), max: shotsFor(cubes.length, Y), state: 'play', t: 0, busy: 0, quiet: 0, combo: null, armed: false, bonus: 0, gold: 0 };
  FUSE.length = 0;
  const tm = TEMA_YAPI, fo = fonOf(LV); $('bg').style.backgroundImage = 'url(fon/' + fo.f + '.webp?v=2)'; setPlat(tm[1]); setDirt(fo);
  const nm = $('nm'); nm.innerHTML = '<div class="rb1"><small>BÖLÜM ' + LV + '</small><b>' + Y.ad + '</b></div>'; nm.classList.remove('on'); void nm.offsetWidth; nm.classList.add('on'); $('hint').style.opacity = 1;
  hud(true);
}
// v6.1: top sayisi blok sayisina gore (her sey kirildigi icin yaklasik 5 bloga 1 top, en az 6, en cok 16)
function shotsFor(n, Y) { return Math.max(7, Math.min(18, Math.round(n / 4.5) + 2)); }
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
const NOPOFI = true;   // v5.5: Adem fil istemiyor - Pofi yuklenmez ve gosterilmez
const pofiReady = new Promise((res) => {
  if (NOPOFI) { PF.holder.visible = false; pedG.visible = false; return res(); }
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
// v5.4: top arabasi (Adem'in Tripo modeli): Pofi'nin yaninda durur, hedefe doner, toplari namludan atar, atista geri teper
const TC = { by: GY, holder: new THREE.Group(), gun: null, muzzle: new THREE.Vector3(), yaw: Math.PI, aimYaw: Math.PI, rec: 0 };
TC.holder.position.set(-POFI.x, GY, POFI.z); scene.add(TC.holder);
function makeCannon() {
  const M = MOD.topcu; if (!M || TC.gun) return;
  const g = M.geo.clone(), b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), z = b.getSize(new THREE.Vector3()), sc = 4.2 / z.x;
  g.translate(-c.x, -b.min.y, -c.z); g.scale(sc, sc, sc); g.computeBoundingBox();
  // namlu ucu: govdenin ust kismindaki (y > %60) noktalarin iki x ucundan hangisi daha yuksekse namlu odur (ayaklar alcakta)
  const pa = g.attributes.position, ym = g.boundingBox.max.y; let x0 = 1e9, x1 = -1e9;
  for (let i = 0; i < pa.count; i++) if (pa.getY(i) > ym * 0.6) { x0 = Math.min(x0, pa.getX(i)); x1 = Math.max(x1, pa.getX(i)); }
  TC.h = g.boundingBox.max.y; TC.w = g.boundingBox.max.z - g.boundingBox.min.z; const band = (x1 - x0) * 0.08, A = new THREE.Vector3(), B = new THREE.Vector3(); let na = 0, nb = 0;
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); if (y < ym * 0.45) continue; const x = pa.getX(i);
    if (x < x0 + band) { A.x += x; A.y += y; A.z += pa.getZ(i); na++; } else if (x > x1 - band) { B.x += x; B.y += y; B.z += pa.getZ(i); nb++; } }
  if (na) A.divideScalar(na); if (nb) B.divideScalar(nb);
  const plusX = !na || (nb && B.y >= A.y), mu = plusX ? B : A, rot = plusX ? -Math.PI / 2 : Math.PI / 2;   // namlu -> +z; holder yaw'i +z'yi hedefe cevirir
  const m = new THREE.Mesh(g, M.mat); m.castShadow = m.receiveShadow = true; m.rotation.y = rot;
  TC.gun = new THREE.Group(); TC.gun.add(m); TC.holder.add(TC.gun);
  // altinda krem renkli yuvarlak tas kaide (resimdeki gibi)
  TC.muzzle.copy(mu).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot); TC.info = { plusX, mu: mu.toArray().map((v) => +v.toFixed(2)) };
  // v6.1: top arabasi yuvarlak krem bir kaidenin ustunde; namlusu platform tablasi hizasinda, boylece alta da duz ve guclu atar
  TC.w0 = TC.w; const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.9, 1, 64), new THREE.MeshStandardMaterial({ color: '#f4e8d6', roughness: 0.55 }));
  pad.receiveShadow = true; TC.holder.add(pad); TC.pad = pad;
  const gm = new THREE.MeshStandardMaterial({ color: '#e8b93a', roughness: 0.28, metalness: 0.55 });
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.76, 0.09, 10, 72), gm), r2 = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.09, 10, 72), gm);
  r1.rotation.x = r2.rotation.x = Math.PI / 2; TC.holder.add(r1, r2); TC.rim2 = r2;

}
function updateCannon(dt) {
  if (!TC.gun) return;
  TC.rec = Math.max(0, TC.rec - dt * 3.2);
  let d = TC.aimYaw - TC.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); TC.yaw += d * Math.min(1, dt * 14); TC.holder.rotation.y = TC.yaw;
  const r = TC.rec, k = r > 0.75 ? (1 - r) / 0.25 : r / 0.75; TC.gun.position.z = -k * 0.85; TC.gun.rotation.x = -k * 0.14; TC.gun.scale.set(1 + k * 0.06, 1 - k * 0.08, 1 + k * 0.06);   // v6.0: sert, hizli geri tepme
}
const TIP = new THREE.Vector3();
function trunkTip(out) {
  if (TC.gun) { TC.holder.updateMatrixWorld(true); TC.gun.updateMatrixWorld(true); return out.copy(TC.muzzle).applyMatrix4(TC.gun.matrixWorld); }
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
const BR = 0.34;   // v6.2: top biraz buyudu, parlak ve isikli
const BALLGEO = new THREE.SphereGeometry(BR, 32, 20);
const TRAILGEO = new THREE.SphereGeometry(0.16, 12, 8);
function shoot(target) {
  if (!g || g.state !== 'play' || g.shots <= 0) return false;
  const now = g.t; if (g.lastShot && now - g.lastShot < 0.22) return false;   // v6.0: daha seri
  g.lastShot = now; g.shots--; g.armed = true; PF.rec = 1;
  PF.aimYaw = Math.atan2(target.x - POFI.x, target.z - POFI.z);
  PF.holder.rotation.y = PF.yaw = PF.aimYaw;   // atis aninda hedefe donuk olsun ki top hortumdan ciksin
  if (TC.gun) { TC.aimYaw = Math.atan2(target.x - TC.holder.position.x, target.z - TC.holder.position.z); TC.holder.rotation.y = TC.yaw = TC.aimYaw; TC.rec = 1; }
  const st = trunkTip(TIP).clone();
  if (target.y < S * 0.5) target = target.clone().setY(S * 0.5);   // v6.1: alt siraya nisan: hedef en az alt kup ortasi, top yavas kavise girmesin
  // yay: v = (hedef - baslangic)/T - g*T/2. En kisa ucus suresi secilir ama top platformun on kenarini (z = R) en az
  // 0.9 yukaridan asmali, yoksa kenara carpip geri seker
  const dv = target.clone().sub(st), gy = world.gravity.y, sz = st.x * Math.sin(YAW) + st.z * Math.cos(YAW), tz = target.x * Math.sin(YAW) + target.z * Math.cos(YAW), edge = Math.min(1, Math.max(0, (sz - RZ) / Math.max(0.01, sz - tz)));
  let T = Math.max(0.12, dv.length() / 44);   // v6.1: her yone ayni hiz (~44 birim/sn): yukari da asagi da ayni guc
  for (; T < 2.2; T += 0.02) { const te = edge * T, vy = dv.y / T - 0.5 * gy * T; if (st.y + vy * te + 0.5 * gy * te * te > BR + 0.12) break; }
  const v = new CANNON.Vec3(dv.x / T, dv.y / T - 0.5 * gy * T, dv.z / T);
  const col = PF.col || '#3d9bff';
  const body = new CANNON.Body({ mass: 12, material: PM.ball, linearDamping: 0.01, allowSleep: false }); body.addShape(new CANNON.Sphere(BR));
  body.position.set(st.x, st.y, st.z); body.velocity.copy(v); world.addBody(body);
  const tg = topGeo(), mesh = tg ? new THREE.Mesh(tg, topMat()) : new THREE.Mesh(BALLGEO, new THREE.MeshStandardMaterial({ color: col, roughness: 0.15, metalness: 0.1, emissive: col, emissiveIntensity: 0.45 })); mesh.castShadow = true; scene.add(mesh);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: '#ffe6ff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(BR * 4.2); mesh.add(halo);
  const b = { body, mesh, halo, t: 0, hit: false, trail: [], col, dir: new THREE.Vector3(v.x, v.y, v.z).normalize(), sp: Math.hypot(v.x, v.y, v.z) };
  body.angularVelocity.set(-v.z * 0.9, 0, v.x * 0.9);   // ucarken one dogru donsun
  // ilk kupe carpista vurus dalgasi: carpisma adimin icinde gelir, itis adimdan sonra yapilir (b.blast)
  body.addEventListener('collide', (e) => { if (b.hit) return; const c = CUBE_OF.get(e.body); if (!c) return; b.hit = true; b.hc = c; b.blast = new THREE.Vector3().copy(body.position); b.slow = true; impact(b, e); });
  balls.push(b);
  g.combo = { n: 0, t: 0, shown: 0 };
  muzzleFx(st, b.dir); sfx('shoot'); buzz(18); shake = Math.max(shake, 0.14); hud();
  $('hint').style.opacity = 0;
  return true;
}
let TOPG = null, TOPM = null;
// v6.2: yildizli top malzemesi daha canli (kendi isigi + yansima) ve etrafinda yumusak bir hale
function topMat() { if (TOPM) return TOPM; const m = MOD.top.mat.clone(); m.envMap = ENV; m.envMapIntensity = 1.4; m.roughness = Math.min(m.roughness, 0.25); m.metalness = 0.2; m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = m.map; m.emissiveIntensity = 0.35; return (TOPM = m); }
function topGeo() {
  if (TOPG || !MOD.top) return TOPG;
  const g = MOD.top.geo.clone(), b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), z = b.getSize(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z); g.scale(2 * BR / z.x, 2 * BR / z.y, 2 * BR / z.z); g.computeBoundingSphere(); return (TOPG = g);
}
function impact(b) {
  wakeAll(); g.busy = 2.5; shake = Math.min(0.5, shake + 0.3);
  const p = new THREE.Vector3().copy(b.body.position); hitFlash(p); burst(p, '#fff3a0', 12, 8); sfx('hit');
}
// v5.3: atis guclendi. Top kupe degdigi an cevresindeki kupler (yaklasik 1.6 kup yaricap) top yonunde itilir;
// itis kupun merkezinin ustunden uygulandigi icin kup sadece kaymaz, devrilir. Agir malzeme (celik, tugla) daha az etkilenir.
const BLAST = { r: S * 1.2, hiz: 6, yukari: 0.9 };   // v6.3: test: ilk atis yapinin yarisini yikiyordu; simdi vurulan kirilir, yakindakiler sarsilir
const IMP = new CANNON.Vec3(), RP = new CANNON.Vec3();
// v6.0: dogrudan vurulan kup parcalara ayrilir (Royal Smash'teki gibi). Agir malzeme (tugla, celik), kendi kirilma/patlama
// kurali olanlar (cam, fici, bomba, recel kavanozu) parcalanmaz, sadece itilir.
// v6.1: (Adem) her sey kirilsin: celik haric hepsi topla dogrudan vurulunca parcalanir; fici/bomba patlar; yere dusen her blok kirilir.
const NOSHAT = new Set(['celik', 'fici', 'bomba', 'recel']);
const KCOL = { sandik: '#9a6532', hediye: '#3d7bff', yildiz: '#b878ff', altin: '#ffd23f', metal: '#6b7380', ahsap: '#9a6532', kirmizi: '#d83a2e', celik: '#8a9098', tugla: '#b5533a', fici: '#b8432c', bomba: '#3a3a3a', buz: '#bfe6ff', jole: '#ff7ab0', cam: '#cfefff', recel: '#e8203a' };
// v6.2: model bloklarinin parca rengi, modelin kendi dokusunun ortalama rengi (Adem'in orijinal renkleri)
function avgCol(mat) {
  if (!mat || !mat.map || !mat.map.image) return null; if (mat.userData.avg) return mat.userData.avg;
  try { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.drawImage(mat.map.image, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data;
    let r = 0, g2 = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; r += d[i]; g2 += d[i + 1]; b += d[i + 2]; n++; }
    const col = new THREE.Color().setRGB(r / n / 255, g2 / n / 255, b / n / 255, THREE.SRGBColorSpace); const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.min(1, hsl.s * 1.25), Math.min(0.62, hsl.l * 1.12));
    return (mat.userData.avg = '#' + col.getHexString()); } catch (e) { return null; }
}
function bColor(c) { const k = c.kind; if (!k) return c.col; if (k.startsWith('g_')) return GLASS[k.slice(2)][0]; return (MOD[k] && NEWM.has(k) && avgCol(MOD[k].mat)) || KCOL[k] || '#cccccc'; }
// parcalar blogun kendi malzemesiyle (Adem'in modellerinde gercek doku parcaciklari gorunur; cam parcalari cam)
function bMat(c) { const k = c.kind; if (k && k.startsWith('g_')) return glassMat(k.slice(2)); return null; }
function bChunk(c) { const k = c.kind; return k && MOD[k] && NEWM.has(k) ? MOD[k].mat : null; }
// bir blogu parcala: sayilir (knock), parcalar sacilir, tek kisa ses
function breakBlock(c, dir, n) {
  if (c.out) return; const p = new THREE.Vector3().copy(c.body.position), gl = c.kind && (c.kind.startsWith('g_') || c.kind === 'cam' || c.kind === 'buz' || c.kind === 'jole');
  if (!c.gone) knock(c, true); else { c.out = true; world.removeBody(c.body); scene.remove(c.mesh); }
  shatter(p, bColor(c), dir || new THREE.Vector3(0, 0.3, -1), bMat(c), n, bChunk(c)); sfx('kir', c.kind);
}
function blast(b) {
  const c0 = b.hc;
  if (c0 && !c0.gone && !c0.out) {
    if (!NOSHAT.has(c0.kind)) { breakBlock(c0, b.dir, 16); buzz(28); }
    else if (KIND[c0.kind] && KIND[c0.kind].boom && c0.fuse == null) { c0.fuse = 0; FUSE.push(c0); }
    else sfx('metal');   // celik: kirilmaz, cinlar
  }
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
    const b = balls[i]; b.t += dt; if (b.blast) { blast(b); b.blast = null; } if (b.slow) { b.slow = false; b.body.velocity.scale(0.45, b.body.velocity); }   // ilk carpista enerjisini kaybeder, yapinin icinden gecip gitmez if (b.hit) b.halo.material.opacity = Math.max(0, b.halo.material.opacity - dt * 2); b.mesh.position.copy(b.body.position); b.mesh.quaternion.copy(b.body.quaternion);
    // iz: arkasinda kuculen parlak toplar
    // v6.0: beyaz parlak iz - top hizliyken arkasinda ince bir isik cizgisi (araya ara noktalar eklenir ki kopuk gorunmesin)
    if (b.t < 1.2) { const pos = b.mesh.position, lp = b.lp || pos.clone(), n = Math.min(6, Math.ceil(lp.distanceTo(pos) / 0.25));
      for (let j = 1; j <= n; j++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: '#ffffff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.lerpVectors(lp, pos, j / n); sp.scale.setScalar(BR * 2.4); scene.add(sp); b.trail.push({ m: sp, life: 0.2 }); }
      b.lp = pos.clone(); }
    for (let j = b.trail.length - 1; j >= 0; j--) { const p = b.trail[j]; p.life -= dt; const k = Math.max(0, p.life / 0.2); p.m.scale.setScalar(BR * 2.4 * (0.25 + 0.75 * k)); p.m.material.opacity = 0.85 * k; if (p.life <= 0) { scene.remove(p.m); p.m.material.dispose(); b.trail.splice(j, 1); } }
    if (b.body.position.y < -16 || b.t > 7) { for (const p of b.trail) { scene.remove(p.m); p.m.material.dispose(); } world.removeBody(b.body); scene.remove(b.mesh); b.halo.material.dispose(); if (b.mesh.material !== TOPM) b.mesh.material.dispose(); balls.splice(i, 1); }
  }
}

// ---------------- v6.0 efektler: namlu parlamasi, duman, vurus parlamasi, kup parcalari, toz, konfeti ----------------
const SOFT = canvasTex(64, 64, (x, w, h) => { const gg = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(0.35, 'rgba(255,255,255,.75)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gg; x.fillRect(0, 0, w, h); });
const FX = [];
function spr(col, add, op) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: col, transparent: true, opacity: op, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false })); scene.add(m); return m; }
function fx(o, life, upd) { FX.push({ o, life, max: life, upd }); }
function updateFX(dt) {
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i]; f.life -= dt; const k = 1 - Math.max(0, f.life) / f.max; f.upd(f.o, k, dt);
    if (f.life <= 0) { scene.remove(f.o); if (f.o.material && !f.o.userData.shared) f.o.material.dispose(); FX.splice(i, 1); }
  }
}
const flashLight = new THREE.PointLight('#ffd6f0', 0, 16, 1.5); scene.add(flashLight);
function muzzleFx(p, dir) {
  // pembe-beyaz parlama: hizla buyur ve soner; namlu onune isik; arkasindan yukari suzulen beyaz duman
  const a = spr('#ffd0ec', true, 1); a.position.copy(p).addScaledVector(dir, 0.4);
  fx(a, 0.32, (o, k) => { o.scale.setScalar(1.2 + k * 3.4); o.material.opacity = (1 - k) ** 1.5; });
  const c = spr('#ffffff', true, 1); c.position.copy(p);
  fx(c, 0.14, (o, k) => { o.scale.setScalar(0.8 + k * 2); o.material.opacity = 1 - k; });
  flashLight.position.copy(p); flashLight.intensity = 60;
  for (let i = 0; i < 7; i++) {
    const m = spr('#f4f0f6', false, 0.7), v = dir.clone().multiplyScalar(1.5 + Math.random() * 2.5).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6));
    m.position.copy(p); const s0 = 0.5 + Math.random() * 0.4;
    fx(m, 0.6 + Math.random() * 0.4, (o, k, dt) => { o.position.addScaledVector(v, dt); v.multiplyScalar(1 - dt * 3); o.scale.setScalar(s0 + k * 2.2); o.material.opacity = 0.7 * (1 - k); });
  }
}
function hitFlash(p) {
  const a = spr('#ffffff', true, 1); a.position.copy(p);
  fx(a, 0.16, (o, k) => { o.scale.setScalar(1.5 + k * 3); o.material.opacity = 1 - k; });
  const r = spr('#ffe48a', true, 0.8); r.position.copy(p);
  fx(r, 0.3, (o, k) => { o.scale.setScalar(2 + k * 4.5); o.material.opacity = 0.8 * (1 - k) ** 2; });
}
// v6.2 kirilma: beyaz halka parlamasi + blogun gercek dokulu 4 iri parcasi + renkli kucuk kirintilar + parilti yildizlari.
// Parcalar top yonunde ve disari sacilir, doner, platforma/zemine seker, kuculup kaybolur.
const SHGEO = [new THREE.BoxGeometry(1, 1, 1), new THREE.TetrahedronGeometry(0.8), new THREE.BoxGeometry(1, 0.45, 0.8), new THREE.OctahedronGeometry(0.7)];
const CHGEO = roundBox(1, 1, 1, 0.08, 2), SHMAT = {};
const STAR = canvasTex(64, 64, (x, w, h) => { x.translate(w / 2, h / 2); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 6 : 30, a = i * Math.PI / 4; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.fill(); });
function piece(m, p, dir, sz, spd, life) {
  m.scale.setScalar(sz); m.castShadow = true; m.userData.shared = true;
  m.position.set(p.x + (Math.random() - 0.5) * S * 0.6, p.y + (Math.random() - 0.5) * S * 0.6, p.z + (Math.random() - 0.5) * S * 0.6);
  m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  const out = m.position.clone().sub(p).normalize(), v = out.multiplyScalar(spd * (0.6 + Math.random() * 0.8)).addScaledVector(dir, spd * (0.4 + Math.random() * 0.6)); v.y += 2.5 + Math.random() * 4;
  const w = new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
  scene.add(m);
  fx(m, life, (o, k, dt) => {
    v.y -= 24 * dt; o.position.addScaledVector(v, dt); o.rotation.x += w.x * dt; o.rotation.y += w.y * dt; o.rotation.z += w.z * dt;
    const fl = floorAt(o.position.x, o.position.z) + sz * 0.45;
    if (o.position.y < fl && o.position.y > fl - 1.2) { o.position.y = fl; if (v.y < 0) { v.y *= -0.32; v.x *= 0.55; v.z *= 0.55; w.multiplyScalar(0.5); } }
    o.scale.setScalar(sz * (k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1));
  });
}
function shatter(p, col, dir, mat0, cnt, chunkMat) {
  const mat = mat0 || SHMAT[col] || (SHMAT[col] = new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.05, emissive: col, emissiveIntensity: 0.18 }));
  const N = cnt || 14;
  // halka parlama
  const ring = spr('#ffffff', true, 0.9); ring.position.copy(p); fx(ring, 0.22, (o, k) => { o.scale.setScalar(S * (0.8 + k * 2.4)); o.material.opacity = 0.9 * (1 - k); });
  // iri dokulu parcalar (blogun kendisi gibi gorunur)
  if (chunkMat) for (let i = 0; i < 4; i++) piece(new THREE.Mesh(CHGEO, chunkMat), p, dir, S * (0.32 + Math.random() * 0.12), 6, 1.6 + Math.random() * 0.4);
  // renkli kirintilar
  for (let i = 0; i < N; i++) piece(new THREE.Mesh(SHGEO[i % 4], mat), p, dir, S * (0.1 + Math.random() * 0.14), 8, 1.1 + Math.random() * 0.5);
  // parilti yildizlari
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: STAR, color: i % 2 ? '#ffffff' : col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(m);
    const v = new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6).addScaledVector(dir, 2); m.position.copy(p); const s0 = 0.35 + Math.random() * 0.3;
    fx(m, 0.45 + Math.random() * 0.25, (o, k, dt) => { v.y -= 10 * dt; o.position.addScaledVector(v, dt); o.material.rotation += dt * 6; o.scale.setScalar(s0 * (k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7 * 0.8)); o.material.opacity = 1 - k * k; });
  }
  // toz bulutu
  for (let i = 0; i < 4; i++) {
    const m = spr(col, false, 0.55), v = new THREE.Vector3((Math.random() - 0.5) * 3, 0.6 + Math.random() * 1.5, (Math.random() - 0.5) * 3); m.position.copy(p); const s0 = 0.7 + Math.random() * 0.5;
    fx(m, 0.6, (o, k, dt) => { o.position.addScaledVector(v, dt); o.scale.setScalar(s0 * (1 + k * 1.6)); o.material.opacity = 0.55 * (1 - k); });
  }
}
function dust(x, y, z, s) {
  for (let i = 0; i < 7; i++) {
    const m = spr(TOZ, false, 0.75), a = Math.random() * 6.283, v = new THREE.Vector3(Math.cos(a) * (1 + Math.random() * 2), 0.6 + Math.random() * 1.2, Math.sin(a) * (1 + Math.random() * 2));
    m.position.set(x, y + 0.3, z); const s0 = (0.6 + Math.random() * 0.5) * s;
    fx(m, 0.7 + Math.random() * 0.4, (o, k, dt) => { o.position.addScaledVector(v, dt); v.multiplyScalar(1 - dt * 2.5); o.scale.setScalar(s0 * (1 + k * 2)); o.material.opacity = 0.75 * (1 - k); });
  }
}
const CONGEO = new THREE.PlaneGeometry(0.28, 0.16), CONCOL = ['#ff4256', '#ffd23f', '#3d7bff', '#2fcf73', '#ff6fcf', '#a25cff', '#22c8e8', '#ff9a1f'];
function confetti() {
  for (let i = 0; i < 170; i++) {
    const m = new THREE.Mesh(CONGEO, new THREE.MeshBasicMaterial({ color: CONCOL[i % CONCOL.length], side: THREE.DoubleSide, transparent: true }));
    m.position.set((Math.random() - 0.5) * R * 3, TOPY + 3 + Math.random() * 6, (Math.random() - 0.5) * 6); scene.add(m);
    const v = new THREE.Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 6, (Math.random() - 0.5) * 3), w = new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), ph = Math.random() * 6;
    fx(m, 3.2 + Math.random() * 0.8, (o, k, dt) => { v.y = Math.max(-2.2, v.y - 9 * dt); v.x *= 1 - dt * 0.8; o.position.addScaledVector(v, dt); o.position.x += Math.sin(ph + k * 20) * dt * 0.8; o.rotation.x += w.x * dt; o.rotation.y += w.y * dt; o.material.opacity = k > 0.85 ? (1 - k) / 0.15 : 1; });
  }
}
function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

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
  c.gone = true; g.left--; if (g.combo) { g.combo.n++; g.combo.t = 0; if (!g.combo.at) g.combo.at = screenAt(c.body.position, 0.3); }
  const p = c.body.position, at = screenAt(p, 0.3);
  if (c.kind === 'hediye') { g.shots += 2; floatText('+2 Top', at[0], at[1], 'blue'); burst(new THREE.Vector3().copy(p), '#ffd23f', 16, 6); sfx('bonus'); }
  else if (c.kind === 'altin') { g.gold++; floatText('Hazine!', at[0], at[1], 'gold'); burst(new THREE.Vector3().copy(p), '#ffd23f', 20, 7); sfx('bonus'); }
  else if (c.kind === 'yildiz') { g.bonus++; floatText('+1 ★', at[0], at[1], 'gold'); burst(new THREE.Vector3().copy(p), '#c58bff', 20, 7); sfx('bonus'); }

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
    if (kd.kir) { breakBlock(c, null, 12); wakeAll(); g.busy = Math.max(g.busy, 1); }
    else { knock(c, true); explode(p, kd); }
  }
}
function explode(p, kd) {
  const RR = kd.boom * S;
  shake = Math.min(0.9, shake + (kd.boom > 4 ? 0.8 : 0.55)); boomLight.position.copy(p); boomLight.intensity = kd.boom > 4 ? 90 : 60;
  burst(p, '#ffb020', 30, 12); burst(p, '#ff4020', 20, 9); burst(p, '#5a4a40', 10, 6); sfx('boom');
  praise(kd.boom > 4 ? 'KABOOM!' : 'BOOM!', '', true);
  wakeAll(); g.busy = Math.max(g.busy, 2.5);
  for (const o of cubes) {
    if (o.gone || o.out) continue;
    V2.copy(o.body.position).sub(p); const L = V2.length(); if (L > RR) continue;
    const k = 1 - L / RR; V2.normalize(); V2.y += 0.55; V2.normalize();
    const m = o.body.mass, dv = kd.guc * (0.35 + 0.65 * k) / Math.max(1, m * 0.6);
    o.body.applyImpulse(new CANNON.Vec3(V2.x * dv * m, V2.y * dv * m, V2.z * dv * m));
    o.body.angularVelocity.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    const ok = o.kind && KIND[o.kind]; if (ok && (ok.boom || ok.kir) && o.fuse == null && L < RR * 0.6) { o.fuse = ok.boom ? 0.14 + Math.random() * 0.08 : 0.02; FUSE.push(o); }
  }
}
function updateCubes(dt) {
  let moving = false;
  for (const c of cubes) {
    if (c.out) continue;
    const p = c.body.position;
    if (!c.gone && p.y < GONE_Y) knock(c, false);
    if (c.gone && !c.landed && p.y < GY + (c.h || S) * 0.62) { c.landed = true; dust(p.x, GY, p.z, 1); if (c.kind !== 'recel') { breakBlock(c, new THREE.Vector3(0, 1, 0), 9); continue; } }
    if (c.gone) { c.gt = (c.gt || 0) + dt; if (c.gt > 1.4) { const k = Math.max(0, 1 - (c.gt - 1.4) / 0.4); c.mesh.scale.setScalar(k); if (k <= 0) { c.out = true; world.removeBody(c.body); scene.remove(c.mesh); continue; } } }
    if (SPL.length && !c.gone && !c.sticky && p.y > 0 && p.y < S * 0.75) for (const s of SPL) if (s.y > -0.5 && (p.x - s.x) ** 2 + (p.z - s.z) ** 2 < (s.r + S * 0.3) ** 2) { c.sticky = true; c.body.linearDamping = 0.9; c.body.angularDamping = 0.95; break; }   // recel lekesine basan yapisir
    if (c.body.sleepState !== CANNON.Body.SLEEPING && c.body.velocity.lengthSquared() > 0.6) moving = true;
  }
  // bir sey hareket ettikce hepsi uyanik kalir: alttaki kup gidince ustteki uyurken havada kalmasin
  if (moving) { g.busy = Math.max(g.busy, 0.6); wakeAll(); }
  g.busy = Math.max(0, g.busy - dt);
  if (g.combo) { g.combo.t += dt; const n = g.combo.n;
    const lv = n >= 24 ? 3 : n >= 12 ? 2 : n >= 5 ? 1 : 0;
    if (n > (g.combo.fl || 0) && g.combo.t > 0.35) { const at = g.combo.at || [innerWidth / 2, innerHeight * 0.45]; floatText('+' + (n - (g.combo.fl || 0)), at[0], at[1]); g.combo.fl = n; }
    if (lv > g.combo.shown) { g.combo.shown = lv; praise(['', 'Süper!', 'Harika!', 'Efsane!'][lv], n + ' blok', lv === 3); }
    if (g.combo.t > 3) g.combo = null; }
  if (g.state === 'play') {
    if (g.left <= 0) { g.state = 'win'; confetti(); sfx('win'); praise('Harika!', 'Yapı yıkıldı', true); setTimeout(win, 1600); }
    else if (g.shots <= 0 && !balls.length && g.busy <= 0) { g.quiet += dt; if (g.quiet > 1.2) { g.state = 'lose'; lose(); } }
    else g.quiet = 0;
  }
}

// ---------------- ses (kucuk sentez) ----------------
let AC = null;
// v6.0: daha dolgun sentez sesler. Hepsi bir kompresor uzerinden cikar (ust uste binince patlamasin), her cagri hafif farkli perdede.
let MASTER = null, NOISE = null, lastThud = 0;
function out() {
  if (MASTER) return MASTER;
  const cp = AC.createDynamicsCompressor(); cp.threshold.value = -14; cp.ratio.value = 6; cp.attack.value = 0.003; cp.release.value = 0.15;
  const gv = AC.createGain(); gv.gain.value = 0.9; gv.connect(cp); cp.connect(AC.destination);
  NOISE = AC.createBuffer(1, AC.sampleRate * 1, AC.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (MASTER = gv);
}
function tone(type, f0, f1, t0, dur, vol, dst) {
  const o = AC.createOscillator(), v = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  v.gain.setValueAtTime(0.0001, t0); v.gain.exponentialRampToValueAtTime(vol, t0 + 0.006); v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(v); v.connect(dst || out()); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(ft, fq, q, t0, dur, vol, sweep) {
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), v = AC.createGain(); s.buffer = NOISE || (out(), NOISE);
  f.type = ft; f.frequency.setValueAtTime(fq, t0); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + dur); f.Q.value = q;
  v.gain.setValueAtTime(0.0001, t0); v.gain.exponentialRampToValueAtTime(vol, t0 + 0.004); v.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(v); v.connect(out()); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}
// v6.3: sesler artik onceden uretilmis kayitlar (ses/*.mp3): katmanli, yankili; her olay icin 2-3 cesit, her calista perde hafif degisir.
// Malzemeye gore kirilma: tahta, tas, metal, cam. Ayni ses cok sik calmaz, ayni anda en fazla 6 ses.
const SFILES = { atis: 3, vurus: 3, tahta: 3, tas: 3, metal: 3, cam: 3, dusme: 3, patlama: 2, pop: 0, bonus: 0, kazan: 0, kaybet: 0, tik: 0 };
const RAW = {}, BUF = {};
for (const k in SFILES) { const n = SFILES[k] || 1; for (let i = 0; i < n; i++) { const f = SFILES[k] ? k + i : k; RAW[f] = fetch('ses/' + f + '.mp3?v=1').then((r) => r.arrayBuffer()).catch(() => null); } }
function decodeAll() { for (const f in RAW) RAW[f].then((ab) => { if (ab && !BUF[f]) AC.decodeAudioData(ab.slice(0), (b) => { BUF[f] = b; }, () => {}); }); }
const MATSND = { ahsap: 'tahta', sandik: 'tahta', ahsapmetal: 'tahta', kirmizi: 'tahta', hediye: 'tahta', kabak: 'tahta', recel: 'cam', tas: 'tas', tugla: 'tas', piramitTas: 'tas', metal: 'metal', celik: 'metal', altin: 'metal', fici: 'metal', yildiz: 'metal', cam: 'cam', buz: 'cam', jole: 'cam' };
function matSnd(kind) { if (!kind) return 'tahta'; if (kind.startsWith('g_')) return 'cam'; return MATSND[kind] || 'tahta'; }
const LAST = {}, GAP = { atis: 0.06, vurus: 0.06, tahta: 0.05, tas: 0.05, metal: 0.07, cam: 0.06, patlama: 0.12, pop: 0.09, dusme: 0.07 };
let voices = [];
function play(k, vol, rate) {
  const n = SFILES[k], f = n ? k + Math.floor(Math.random() * n) : k, b = BUF[f]; if (!b) return;
  const src = AC.createBufferSource(), g0 = AC.createGain(); src.buffer = b; src.playbackRate.value = rate || (0.95 + Math.random() * 0.1); g0.gain.value = vol;
  src.connect(g0); g0.connect(out()); src.start();
}
function sfx(k, n) {
  if (!AC) return; out(); const now = AC.currentTime;
  const key = k === 'kir' ? matSnd(n) : k === 'shatter' ? 'tahta' : k;
  if (GAP[key] && LAST[key] && now - LAST[key] < GAP[key]) return; LAST[key] = now;
  voices = voices.filter((v) => v > now); if (voices.length >= 6 && k !== 'shoot' && k !== 'win' && k !== 'lose') return; voices.push(now + 0.15);
  if (k === 'shoot') play('atis', 0.95);
  else if (k === 'hit') play('vurus', 0.7);
  else if (k === 'kir' || k === 'shatter') play(key, key === 'metal' ? 0.5 : 0.75);
  else if (k === 'cam') play('cam', 0.6);
  else if (k === 'metal') play('metal', 0.55);
  else if (k === 'boom') play('patlama', 1);
  else if (k === 'thud') play('dusme', Math.min(0.7, 0.25 + (n || 4) * 0.04));
  else if (k === 'slap') play('dusme', 0.5, 0.8);
  else if (k === 'bonus') play('bonus', 0.7);
  else if (k === 'win') play('kazan', 0.8);
  else if (k === 'lose') play('kaybet', 0.7);
  else if (k === 'tik') play('tik', 0.5);
  else play('pop', 0.35, 0.9 + Math.min(20, n || 1) * 0.035);   // sayac: seri arttikca perde yukselir
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
function praise(t, s, big) { const p = $('praise'); p.innerHTML = ''; void p.offsetWidth; p.innerHTML = '<div class="p' + (big ? ' big' : '') + '"><b>' + t + '</b>' + (s ? '<i>' + s + '</i>' : '') + '</div>'; }
function floatText(t, x, y, cls) { const e = document.createElement('div'); e.className = 'fl' + (cls ? ' ' + cls : ''); e.textContent = t; e.style.left = x + 'px'; e.style.top = y + 'px'; document.body.appendChild(e); setTimeout(() => e.remove(), 1050); }
function modal(h) { $('card').innerHTML = h; $('modal').classList.add('on'); }
function closeModal() { $('modal').classList.remove('on'); }
function win() {
  SV.max = Math.max(SV.max, LV + 1); save();
  const r = g.shots / g.max, st = Math.min(3, (r >= 0.4 ? 3 : r >= 0.15 ? 2 : 1) + g.bonus);
  const stars = [0, 1, 2].map((i) => '<span' + (i < st ? '' : ' class="off"') + '>★</span>').join('');
  modal('<div class="rib">Tebrikler!</div><div class="stars">' + stars + '</div><h2>Bölüm ' + LV + ' tamam</h2>' +
    '<div class="stat"><div>KALAN TOP<b>' + g.shots + '</b></div><div>BLOK<b>' + g.total + '</b></div>' + (g.gold ? '<div>HAZİNE<b>' + g.gold + '</b></div>' : '') + '</div>' +
    '<button class="btn" id="nx">Devam Et</button>');
  for (let i = 0; i < st; i++) setTimeout(() => sfx('bonus'), 120 + i * 250);
  $('nx').onclick = () => { sfx('tik'); start(LV + 1); };
}
function lose() {
  sfx('lose');
  modal('<div class="rib r">Toplar bitti!</div><h2>' + g.left + ' blok kaldı</h2><p>Biraz daha kalmıştı, tekrar dene!</p>' +
    '<button class="btn o" id="rv">+3 Top ile Devam</button><button class="btn" id="rt">Tekrar Dene</button>');
  $('rt').onclick = () => { sfx('tik'); start(LV); };
  $('rv').onclick = () => { sfx('tik'); g.shots += 3; g.state = 'play'; g.quiet = 0; closeModal(); hud(); };
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
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); decodeAll(); } catch (x) {} } else if (AC.state === 'suspended') AC.resume();
  const p = aimAt(e.clientX, e.clientY); if (p) shoot(p);
});

// ---------------- kamera ----------------
// platformun tamami ve altta Pofi ekrana sigar; dar (telefon) ekranda geriye cekilir
const YAW = 0;   // v6.2: (Adem) platform kameraya duz baksin; derinligi yukaridan bakis acisi verir
function fit() {
  // v6.2: 1) kamera: 13 derece yukaridan, tam karsidan. Yapinin tepesi ile platformun alt kenari ekranin ortasina (biraz yukari) oturur,
  //          yapi ekrana sigana kadar geri cekilir. 2) top arabasi: kameradan yapiya olan yolun ~%30'unda, ekran genisliginin ~%40'i kadar,
  //          namlu ucu ekranin alttan ~%24'unde. Platformla arasinda her zaman bosluk kalir.
  const W = innerWidth, H = innerHeight; ren.setSize(W, H, false); cam.aspect = W / H;
  const HF = 52;
  cam.fov = Math.max(42, Math.min(92, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(HF * Math.PI / 360) / cam.aspect)))); cam.updateProjectionMatrix();
  const pitch = 13 * Math.PI / 180, dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)), thx = Math.tan(cam.fov * Math.PI / 360) * cam.aspect;
  const V = new THREE.Vector3(), tg = new THREE.Vector3();
  const tops = [[-R, TOPY + 0.2, -RZ], [R, TOPY + 0.2, -RZ], [-R, TOPY + 0.2, RZ], [R, TOPY + 0.2, RZ]], bots = [[-R, -0.8, RZ], [R, -0.8, RZ]];
  const yOf = (p) => V.set(p[0], p[1], p[2]).project(cam).y;
  const place = (d, ty) => { tg.set(0, ty, 0); cam.position.copy(tg).addScaledVector(dir, d); cam.lookAt(tg); cam.updateMatrixWorld(true); };
  let d = 8;
  for (; d < 120; d += 0.25) {
    let lo = -10, hi = TOPY + 10;
    for (let it = 0; it < 28; it++) { const ty = (lo + hi) / 2; place(d, ty); const top = Math.max(...tops.map(yOf)), bot = Math.min(...bots.map(yOf)); if ((top + bot) / 2 > 0.13) lo = ty; else hi = ty; }
    place(d, (lo + hi) / 2);
    const top = Math.max(...tops.map(yOf)), bot = Math.min(...bots.map(yOf)), side = Math.max(...tops.concat(bots).map((p) => Math.abs(V.set(p[0], p[1], p[2]).project(cam).x)));
    if (top < 0.62 && bot > -0.36 && side < 0.9) break;
  }
  // top arabasi
  if (TC.gun) {
    const dH = cam.position.z, dc = Math.max(3.5, Math.min(dH * 0.3, dH - RZ - 4));
    const k = (0.4 * 2 * dc * thx) / TC.w0; TC.holder.scale.setScalar(k); TC.k = k;
    let lo = GY - 30, hi = cam.position.y;
    for (let it = 0; it < 30; it++) { const by = (lo + hi) / 2; TC.holder.position.set(0, by, cam.position.z - dc); TC.holder.rotation.y = Math.PI; TC.holder.updateMatrixWorld(true);
      const m = trunkTip(V); if (m.project(cam).y > -0.52) hi = by; else lo = by; }
    TC.by = (lo + hi) / 2; TC.holder.position.y = TC.by;
    const ph = Math.max(0.2, (TC.by - GY) / k); TC.pad.scale.y = ph; TC.pad.position.y = -ph / 2; TC.rim2.position.y = -ph + 0.12;
  }
  cam.userData.base = cam.position.clone();
}
addEventListener('resize', fit); fit();

// ---------------- dongu ----------------
let last = 0, shake = 0;
function frame(ts) {
  const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
  if (g) { g.t += dt; world.step(1 / 120, dt, 8); updateFuse(dt); updateDebris(dt); syncMeshes(); updateBalls(dt); updateCubes(dt); if (KM.bomba) KM.bomba.emissiveIntensity = 0.45 + 0.4 * Math.sin(g.t * 8); }
  updatePofi(dt); updateCannon(dt); updateParts(dt); updateFX(dt); if (flashLight.intensity > 0) flashLight.intensity = Math.max(0, flashLight.intensity - dt * 400);
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.4); cam.position.copy(cam.userData.base).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0)); } else if (cam.userData.base) cam.position.copy(cam.userData.base);
  ren.render(scene, cam);
  if (!TEST) requestAnimationFrame(frame);
}
function start(L) {
  LV = Math.max(1, L); SV.L = LV; save(); closeModal(); $('praise').innerHTML = '';
  setPofiCol(POFICOL[(LV - 1) % POFICOL.length]); buildLevel();
}
window.YP = { TC, cam, scene, cubes, balls, get g() { return g; }, start, shoot: (x, y, z) => shoot(new THREE.Vector3(x, y, z)), aimAt, run(sec) { let t = last || 0; for (let i = 0; i < Math.round(sec * 60); i++) { t += 1000 / 60; frame(t); } }, snap() { return glc.toDataURL('image/png'); } };
Promise.all([faceReady, pofiReady, texReady, modelReady]).then(() => {
  makeCannon(); fit();
  for (const k in KMAT) delete KMAT[k];
  start(+(Q.get('sv') || SV.L || 1));
  const l = $('load'); l.style.opacity = 0; setTimeout(() => l.remove(), 400);
  if (!TEST) requestAnimationFrame(frame); else frame(16);
});
