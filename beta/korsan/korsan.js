// BLOKPOP Korsan modu - pilot (Adem 5-6 Kas 2026)
// Yapi motorunun (yapi/oyun.js) uzerine kurulur: kupler, fizik, kirilma, ses ve top ayni. Bu dosya korsan sahnesini kurar.
//  - Bizim gemimiz (Adem'in atici gemisi) denizde ilerler, yoluna hedefler cikar. Kamera geminin arkasindan bakar; top arabasinin
//    alt kismi ve altindaki altin platform ekranin altinda kalir (modelde o kisim yakindan bozuk gorunuyor).
//  - (Adem 6 Kas) Kupler hep Adem'in fiçili ahsap platformlarinda durur: kare, alti gen, yuvarlak, uzun. Platformlarin ustu top hizasinda.
//    Her bolumde baska bir duzen: saga sola kayan, yan yana iki platform, onde sallanan + arkada buyuk sabit, donen, dalgada inip kalkan...
//  - Korsan gemisi, gozcu kulesi adasi ve eski sal denizde sadece sus (uzakta yuzer, gemi yavasca seyreder).
//  - Manzara her 2 bolumde degisir (8 fon). Deniz WebGL'de dalgalanir; kuslar ve penguen hareket eder.
//  - Kazanma karti: 1-3 yildiz, altin sayilarak eklenir, her 5 bolumde hazine sandigi; sonra deniz haritasi.
let A = null, THREE = null, CANNON = null;
export function bagla(a) { A = a; THREE = a.THREE; CANNON = a.CANNON;
  QA = new THREE.Quaternion(); EU = new THREE.Euler(); VA = new THREE.Vector3(); DQ = new THREE.Quaternion(); QI = new THREE.Quaternion(); V3 = new THREE.Vector3(); Q3 = new THREE.Quaternion(); QS = new THREE.Quaternion(); EU2 = new THREE.Euler(); M4 = new THREE.Matrix4(); const h = a.$('hr'); if (h) h.onclick = () => { a.sfx('tik'); haritaAc(); }; }
export function hazir() { return !!(A && A.TC.gun); }

// ---------------- fonlar (korsan/kaynak/fon_*_bos.webp: cizili kuslar silinmis hali) ----------------
// h: ufuk cizgisinin resimdeki yeri (ustten oran). pir: denizdeki gunes piriltisinin yonu/rengi/gucu.
// dekor: denizdeki sus modelleri ve resimde durabilecekleri acik deniz yerleri (u: resmin soldan orani, sirayla denenir).
// (Adem 8 Kas: gemi/kule maddelerin icinden geciyordu) ada, koy ve buzulda ufuk boyunca resimde kara/buz var: sus yok.
const FON = {
  gunes: { h: 0.414, gunes: 0xfff4dc, gi: 2.6, rim: 0xd8f0ff, pir: [0.02, 0.6, -1], pr: 0xffffff, pg: 1.3, dekor: [{ n: 'gemi', u: [0.2, 0.8, 0.13, 0.87] }] },
  martili: { h: 0.414, gunes: 0xfff4dc, gi: 2.6, rim: 0xd8f0ff, pir: [0.0, 0.25, -1], pr: 0xfffbe8, pg: 1.3, dekor: [{ n: 'kule', u: [0.2] }, { n: 'gemi', u: [0.8, 0.87, 0.2, 0.13] }] },
  ada: { h: 0.522, gunes: 0xfff4dc, gi: 2.6, rim: 0xd8f0ff, pir: [0.0, 0.32, -1], pr: 0xfffbe8, pg: 1.2, dekor: [] },
  gundogumu: { h: 0.3775, gunes: 0xffd9a0, gi: 2.4, rim: 0xffc8e0, pir: [0.0, 0.12, -1], pr: 0xffe0a0, pg: 1.6, dekor: [{ n: 'gemi', u: [0.8, 0.87, 0.2, 0.13] }, { n: 'kule', u: [0.2] }] },
  koy: { h: 0.537, gunes: 0xfff4dc, gi: 2.6, rim: 0xd8f0ff, pir: [0.25, 0.4, -1], pr: 0xfffbe8, pg: 1.1, dekor: [] },
  buzul: { h: 0.345, gunes: 0xf4f8ff, gi: 2.5, rim: 0xd8ecff, pir: [0.1, 0.5, -1], pr: 0xffffff, pg: 0.9, dekor: [], penguen: { u: 0.76, v: 0.4797, u0: 0.68, u1: 0.86 } },   // penguen hedeflerin sagindaki buzda
  acikdeniz: { h: 0.5, gunes: 0xfff0d0, gi: 2.6, rim: 0xcfe0ff, pir: [0.02, 0.3, -1], pr: 0xfffbe8, pg: 1.3, dekor: [{ n: 'gemi', u: [0.68, 0.72] }] },
  gunbatimi: { h: 0.5, gunes: 0xffc48a, gi: 2.3, rim: 0xff9ad0, pir: [0.0, 0.1, -1], pr: 0xffd890, pg: 1.6, dekor: [{ n: 'gemi', u: [0.78, 0.86] }] }
};
const IMG_AR = 1440 / 2560;
// ---------------- bolumler ----------------
// Her bolum bir platform listesi: m model (kare, alti, yuvarlak, uzun), x/z yeri, har hareket, kup(o, pn) o platformun kupleri.
// Hareketler: sabit (dalgada hafif), kay (saga sola), salla (yalpalar, iner kalkar), don (kendi ekseninde doner), dalga (buyuk iner kalkar).
function box(o, i0, i1, j0, j1, k0, k1, col, pn) { for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) { const c = typeof col === 'function' ? col(i, j, k) : col; if (c) o.push([i, j, k, c, pn || 0]); } return o; }
// hazir kup dizilisleri: g genislik (x), d derinlik (z), h kat. tepe ortasinda altin, altta varil (patlayici) olabilir.
const yapi = (g, d, h, pal, ops = {}) => (o, pn) => box(o, 0, g - 1, 0, h - 1, 0, d - 1, (i, j, k) => {
  const mid = i === Math.floor((g - 1) / 2) || i === Math.ceil((g - 1) / 2);
  if (j === h - 1 && mid && k === 0 && ops.altin !== false) return 'altin';
  if (ops.fici && j === 0 && k === d - 1 && (i === 1 || i === g - 2)) return 'fici';
  return pal[(j + (ops.cap ? i + k : 0)) % pal.length];
}, pn);
const AH = ['sandik', 'sandik', 'ahsap2'], KR = ['sandik', 'kirmizi', 'sandik', 'ahsap2'], TS = ['tas', 'metal', 'tas'], BZ = ['buz2', 'buz2', 'metal'], KZ = ['kirmizi', 'metal', 'kirmizi', 'tas'];
export const BOLGE = 10;   // haritada her bolge 10 durak, 10. durak patron
const BOLUMLER = [
  { ad: 'İlk Hedef', fon: 'gunes', p: [{ m: 'kare', har: 'sabit', kup: yapi(4, 2, 3, AH) }] },
  { ad: 'Kayan Sal', fon: 'gunes', p: [{ m: 'uzun', har: 'kay', a: 3.2, w: 0.55, kup: yapi(6, 1, 3, KR) }] },
  { ad: 'İkiz Sallar', fon: 'martili', p: [{ m: 'sal', x: -5.3, har: 'salla', kup: yapi(3, 2, 3, AH) }, { m: 'yuvarlak', x: 5.3, har: 'sabit', kup: yapi(3, 2, 3, KR) }] },
  { ad: 'Sallanan Öncü', fon: 'martili', p: [{ m: 'alti', x: -3.5, z: 5, har: 'salla', kup: yapi(3, 2, 2, KR) }, { m: 'kare', z: -8, har: 'sabit', buyuk: 1.25, kup: yapi(5, 2, 5, AH, { fici: true }) }] },
  { ad: 'Dönen Altıgen', fon: 'ada', p: [{ m: 'alti', har: 'don', w: 0.45, kup: yapi(3, 2, 4, TS) }] },
  { ad: 'Karşı Akıntı', fon: 'ada', p: [{ m: 'uzun', z: 4, har: 'kay', a: 3, w: 0.6, kup: yapi(5, 1, 2, KR) }, { m: 'uzun', z: -6, har: 'kay', a: 3, w: 0.6, ph: Math.PI, kup: yapi(5, 1, 4, AH) }] },
  { ad: 'Üçlü Filo', fon: 'gundogumu', p: [{ m: 'yuvarlak', x: -6.2, z: 4, har: 'salla', kup: yapi(3, 2, 2, KZ) }, { m: 'yuvarlak', x: 6.2, z: 4, har: 'salla', ph: 1.7, kup: yapi(3, 2, 2, KZ) }, { m: 'kare', z: -8, har: 'sabit', buyuk: 1.2, kup: yapi(4, 2, 5, AH, { fici: true }) }] },
  { ad: 'Dalga Sırtı', fon: 'gundogumu', p: [{ m: 'kare', har: 'dalga', a: 0.55, kup: yapi(4, 2, 5, KR, { fici: true }) }] },
  { ad: 'Kaçak Sal', fon: 'koy', p: [{ m: 'uzun', z: 4, har: 'kay', a: 4, w: 0.75, kup: yapi(5, 1, 2, KR) }, { m: 'yuvarlak', z: -6, har: 'sabit', kup: yapi(3, 2, 5, TS) }] },
  { ad: 'Kaptanın Kalesi', fon: 'koy', patron: true, p: [{ m: 'kare', z: -8, har: 'sabit', buyuk: 1.3, kup: yapi(5, 2, 6, KZ, { fici: true }) }, { m: 'alti', x: -6.5, z: 3, har: 'don', w: 0.5, kup: yapi(3, 2, 2, AH) }, { m: 'alti', x: 6.5, z: 3, har: 'don', w: -0.5, kup: yapi(3, 2, 2, AH) }] },
  { ad: 'Buz Salı', fon: 'buzul', p: [{ m: 'sal', har: 'dalga', a: 0.4, kup: yapi(3, 2, 4, BZ) }] },
  { ad: 'Buz Kardeşler', fon: 'buzul', p: [{ m: 'alti', x: -5.3, har: 'salla', kup: yapi(3, 2, 3, BZ) }, { m: 'alti', x: 5.3, har: 'salla', ph: 2.1, kup: yapi(3, 2, 3, BZ) }] },
  { ad: 'Kayan Kule', fon: 'acikdeniz', p: [{ m: 'sal', har: 'kay', a: 2.6, w: 0.5, kup: yapi(3, 2, 7, TS) }] },
  { ad: 'Kademeli', fon: 'acikdeniz', p: [{ m: 'uzun', z: 4.5, har: 'sabit', kup: yapi(5, 1, 2, KR) }, { m: 'kare', z: -6, har: 'kay', a: 2.6, w: 0.5, kup: yapi(4, 2, 4, AH, { fici: true }) }] },
  { ad: 'İkiz Fırıldak', fon: 'gunbatimi', p: [{ m: 'yuvarlak', x: -5.3, har: 'don', w: 0.55, kup: yapi(3, 2, 3, KZ) }, { m: 'yuvarlak', x: 5.3, har: 'don', w: -0.55, kup: yapi(3, 2, 3, KZ) }] },
  { ad: 'Son Liman', fon: 'gunbatimi', p: [{ m: 'uzun', z: 5, har: 'kay', a: 3.5, w: 0.6, kup: yapi(5, 1, 2, KZ) }, { m: 'kare', z: -7, har: 'salla', buyuk: 1.25, kup: yapi(5, 2, 5, KR, { fici: true }) }] }
];
// her bolumun kup listesi: [i, j, k, model, platform]
for (const Y of BOLUMLER) Y.make = () => { const o = []; Y.p.forEach((p, pn) => p.kup(o, pn)); return o; };
export function bolum(L) { return BOLUMLER[(L - 1) % BOLUMLER.length]; }

// ---------------- Adem'in Tripo modelleri ----------------
// Olculer modelin kendisinden: yukaridan isin atilarak ust yuzeyin yuksekligi ve siniri bulundu (model birimi, y yukari).
// Platformlar: ust = tablanin yuksekligi, yar = kuplerin durabilecegi yarim genislik (uzun: yx boy, yz en).
const PLAT = {
  kare: { ust: 0.365, yar: 0.43, sekil: 'kare' },
  alti: { ust: 0.325, yar: 0.37, sekil: 'yuvarlak' },
  yuvarlak: { ust: 0.359, yar: 0.42, sekil: 'yuvarlak' },
  uzun: { ust: 0.227, yx: 0.455, yz: 0.165, sekil: 'uzun' },
  sal: { ust: 0.48, yx: 0.28, yz: 0.29, cx: 0.12, sekil: 'uzun', model: 'sal', don: 0 }   // ilk fiçili sal (model/sal.glb): artik denizde bos yuzmuyor, ustunde kupler var
};
// sus modelleri ve bizim gemi: su = su cizgisi (tahmin), plat = bizim gemideki altin platform
const KAL = {
  bizim_gemi: { plat: { y: 0.415, z: 0.15, r: 0.05 }, en: 0.31, kic: -0.17, bas: 0.49, su: 0.17 },
  dusman_gemi: { su: 0.11 }, kule_ada: { su: 0.06 }, sal: { su: 0.21, kirp: -0.25 }
};
const KM = {};
export function yukle() {
  const doku = (url, f) => new Promise((res) => new THREE.TextureLoader().load(url, (tx) => { tx.colorSpace = THREE.NoColorSpace; f(tx); res(); }, undefined, () => res()));
  const isler = [];
  for (const n of Object.keys(FON)) {
    isler.push(doku('../korsan/kaynak/fon_' + n + '_bos.webp?v=2', (tx) => { tx.anisotropy = 4; FON[n].tx = tx; FON[n].sis = ufukRengi(tx.image, FON[n].h); }));
    isler.push(doku('../korsan/kaynak/fon_' + n + '_su.png?v=1', (tx) => { FON[n].msk = tx; }));   // su maskesi: dalga sadece suya uygulanir (buz, kum, kaya kipirdamaz)
  }
  isler.push(doku('../korsan/kaynak/penguen.png?v=1', (tx) => { PENG.tx = tx; }));
  const glb = (n, dosya) => new Promise((res) => new A.GLTFLoader().load('model/' + dosya + '.glb?v=1', (gl) => {
    gl.scene.updateMatrixWorld(true);
    gl.scene.traverse((o) => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = true;
      if (KAL[n] && KAL[n].kirp != null && o.geometry.index) {   // salin yanindaki kopuk ip parcasi (modelde ayri duruyor) atilir
        const P = o.geometry.attributes.position, I = o.geometry.index.array, v = new THREE.Vector3(), keep = [];
        for (let i = 0; i < I.length; i += 3) { let out = 0; for (let j = 0; j < 3; j++) { v.fromBufferAttribute(P, I[i + j]).applyMatrix4(o.matrixWorld); if (v.x < KAL[n].kirp) out++; } if (out < 3) keep.push(I[i], I[i + 1], I[i + 2]); }
        o.geometry.setIndex(keep); } });
    KM[n] = gl.scene; res(); }, undefined, () => res()));
  for (const n of Object.keys(KAL)) isler.push(glb(n, n));
  for (const n of Object.keys(PLAT)) isler.push(glb('p_' + n, 'plat_' + n));
  return Promise.all(isler);
}
// sis rengi: resimde ufkun hemen ustundeki seridin ortalamasi (uzaktaki her sey bu renge dogru hafifce soluklasir)
function ufukRengi(img, h) {
  try { const c = document.createElement('canvas'); c.width = 32; c.height = 64; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 32, 64); const y = Math.round(h * 64) - 3, d = x.getImageData(0, y, 32, 2).data;
    let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace); } catch (e) { return new THREE.Color('#bfe0f0'); }
}
// modeli kopyala, dondur, olcekle; modeldeki 'cpa' noktasi (model birimi) dunyada 'to' noktasina gelsin
function yerlestir(n, sc, rotY, cpa, to) {
  const m = KM[n].clone(true), g = new THREE.Group(); g.add(m); m.scale.setScalar(sc);
  g.rotation.y = rotY || 0; const off = new THREE.Vector3(...cpa).multiplyScalar(sc).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY || 0);
  g.position.set(to[0] - off.x, to[1] - off.y, to[2] - off.z); return g;
}

// ---------------- hedef: platformlar ----------------
// T.P: platformlar. Her biri statik bir fizik govdesi (ilki motorun platBody'si), gorunus grubu, taban yeri ve o anki pozu.
// Ustundeki kupler pozla birlikte tasinir. Platformlarin ust yuzeyi y=0'da (top hizasi), deniz GY'de.
let T = null, TT = 0;
const SEFER = { sure: 2.6, yol: 64 };   // seyir: hedefler bu kadar uzaktan yaklasir (gemi ilerliyor)
const DENIZ = -1.4;   // deniz seviyesi: platformun ustunden 1.4 birim asagida (fiçilarin yarisi suda)
function temizle() {
  if (T) for (const P of T.P) { A.scene.remove(P.grp); if (P.kopuk) A.scene.remove(P.kopuk); if (P.body !== A.platBody) A.world.removeBody(P.body); }
  T = null;
}
export function kur(Y, list) {
  temizle();
  A.setPlat('sirk'); A.LEG.visible = false; A.DIRT.visible = false;
  A.GY = DENIZ; const S = A.S;
  const inf = Y.p.map(() => ({ i0: 1e9, i1: -1e9, k0: 1e9, k1: -1e9, top: 0 }));
  for (const c of list) { const f = inf[c[4] || 0]; f.i0 = Math.min(f.i0, c[0]); f.i1 = Math.max(f.i1, c[0]); f.k0 = Math.min(f.k0, c[2]); f.k1 = Math.max(f.k1, c[2]); f.top = Math.max(f.top, (c[1] + (A.KEEP[c[3]] === 'tall' ? 2 : 1)) * S); }
  const P = Y.p.map((d, i) => {
    const f = inf[i], mx = (f.i1 - f.i0) / 2 * S + S / 2, mz = (f.k1 - f.k0) / 2 * S + S / 2, M = PLAT[d.m];
    let sc = M.sekil === 'kare' ? (Math.max(mx, mz) + 0.45) / M.yar : M.sekil === 'uzun' ? Math.max((mx + 0.45) / M.yx, (mz + 0.3) / M.yz) : (Math.hypot(mx, mz) + 0.35) / M.yar;
    sc *= d.buyuk || 1;
    const body = i === 0 ? A.platBody : new CANNON.Body({ mass: 0, material: A.PM.plat });
    if (i) { body.collisionFilterGroup = 4; A.world.addBody(body); }
    while (body.shapes.length) body.removeShape(body.shapes[0]);
    body.velocity.set(0, 0, 0); body.angularVelocity.set(0, 0, 0);
    const h = M.ust * sc;   // tablanin ustunden fiçilarin altina
    let hx, hz;
    if (M.sekil === 'kare') { hx = hz = M.yar * sc; body.addShape(new CANNON.Box(new CANNON.Vec3(hx, h / 2, hz)), new CANNON.Vec3(0, -h / 2, 0)); }
    else if (M.sekil === 'uzun') { hx = M.yx * sc; hz = M.yz * sc; body.addShape(new CANNON.Box(new CANNON.Vec3(hx, h / 2, hz)), new CANNON.Vec3(0, -h / 2, 0)); }
    else { hx = hz = M.yar * sc; body.addShape(new CANNON.Cylinder(hx, hx, h, 24), new CANNON.Vec3(0, -h / 2, 0)); }
    const grp = new THREE.Group(); A.scene.add(grp);
    // model: tablanin ust ortasi platformun merkezine (uzun platformun boyu x eksenine doner)
    const mn = M.model || 'p_' + d.m; if (KM[mn]) grp.add(yerlestir(mn, sc, M.don != null ? M.don : M.sekil === 'uzun' ? Math.PI / 2 : 0, [M.cx || 0, M.ust, 0], [0, 0, 0]));
    const x = d.x || 0, z = d.z || 0;
    const kopuk = suHalkasi(hx * 2.5, hz * 2.5); A.scene.add(kopuk);
    return { d, body, grp, kopuk, x, z, hx, hz, top: f.top, mx, mz, ci: (f.i0 + f.i1) / 2, ck: (f.k0 + f.k1) / 2, kuyu: M.sekil !== 'kare' && M.sekil !== 'uzun',
      p: new THREE.Vector3(x, 0, z), q: new THREE.Quaternion(), ph: d.ph || 0 };
  });
  T = { P, batar: true };
  // kamera cercevesi icin: tum platformlarin (kayma payi dahil) siniri
  let x0 = 1e9, x1 = -1e9, zf = -1e9, top = 0;
  for (const p of P) { const k = p.d.har === 'kay' ? p.d.a : 0; x0 = Math.min(x0, p.x - p.hx - k); x1 = Math.max(x1, p.x + p.hx + k); zf = Math.max(zf, p.z + p.hz); top = Math.max(top, p.top); }
  Object.assign(T, { x0, x1, zf, top, hz: Math.max(...P.map((p) => Math.abs(p.z) + p.hz)) });
  A.TOPY = top; A.R = (x1 - x0) / 2; A.RZ = T.hz;
  A.addCubes(Y, list, (pn) => { const p = P[pn]; return [p.ci, p.ck, p.x, p.z, 0]; });
}
// ---------------- denizdeki suslar: korsan gemisi, gozcu kulesi adasi, eski sal ----------------
const DEKOR = [];
// (Adem 8 Kas) eskiden gemi ufukta bastan basa gidip geliyor; hedeflerin arkasindan, resimdeki adalarin, kayaliklarin, deniz fenerinin
// icinden geciyor, 13. bolumde kule adasinin icine giriyordu. Simdi her sus resmin acik deniz kisminda, hedeflerin ekrandaki yerinin
// disinda bir noktaya demirli durur (yerinde hafif suruklenir, iner kalkar, yalpalar); bos yer yoksa o bolumde hic konmaz.
const DK = { gemi: { z: -140, sc: 22, yar: 10.8, sur: 1.2 }, kule: { z: -190, sc: 30, yar: 20, sur: 0 } };
function dekorKur(fo) {
  for (const o of DEKOR) A.scene.remove(o.g); DEKOR.length = 0;
  const GY = A.GY, cam = A.cam, cz = (cam.userData.base0 || cam.position).z, thx = Math.tan(cam.fov * Math.PI / 360) * cam.aspect;
  const sar = innerWidth / innerHeight, ux = (u) => 2 * (0.5 + (u - 0.5) * FR.Z * (sar < IMG_AR ? IMG_AR / sar : 1)) - 1;   // resim orani -> ekran (-1..1)
  // hedeflerin ekranda kapladigi yatay aralik (kayan platformun gidip geldigi yer dahil)
  const dolu = [];
  if (T) { let a = 1e9, b = -1e9; for (const P of T.P) { const k = P.d.har === 'kay' ? P.d.a : 0;
    for (const z of [P.z - P.hz, P.z + P.hz]) { const dz = Math.max(1, cz - z) * thx; a = Math.min(a, (P.x - P.hx - k) / dz); b = Math.max(b, (P.x + P.hx + k) / dz); } }
    dolu.push([a - 0.06, b + 0.06]); }
  for (const s of fo.dekor) {
    const D = DK[s.n], mdl = s.n === 'gemi' ? 'dusman_gemi' : 'kule_ada'; if (!KM[mdl]) continue;
    const dz = (cz - D.z) * thx, hw = (D.yar + D.sur) / dz;
    const u = s.u.find((u) => { const c = ux(u); return Math.abs(c) < 1 && dolu.every(([a, b]) => c + hw < a || c - hw > b); });
    if (u == null) continue;
    const c = ux(u), x = c * dz; dolu.push([c - hw - 0.03, c + hw + 0.03]);
    const w = new THREE.Group();
    if (s.n === 'gemi') w.add(yerlestir('dusman_gemi', D.sc, 0, [0, KAL.dusman_gemi.su, 0], [0, 0, 0]));
    else w.add(yerlestir('kule_ada', D.sc, -0.5, [0, KAL.kule_ada.su, 0], [0, 0, 0]));
    A.scene.add(w);
    // gemi: burnu ekranin disina dogru (hedeflere degil), hafif capraz
    DEKOR.push({ g: w, tip: s.n, x0: x, x, z: D.z, y: GY, sur: D.sur, yon: (c < 0 ? -1 : 1) * (Math.PI / 2 - 0.35), ph: Math.random() * 6 });
  }
  dekorKare(0);
}
function dekorKare(dt) {
  for (const o of DEKOR) {
    o.ph += dt;
    if (o.tip === 'kule') { o.g.position.set(o.x0, o.y, o.z); continue; }
    o.x = o.x0 + o.sur * Math.sin(o.ph * 0.13);   // demirde: zincir boyunca yavasca suruklenir
    o.g.position.set(o.x, o.y + Math.sin(o.ph * 0.9) * 0.18, o.z);
    o.g.rotation.set(Math.sin(o.ph * 0.55 + 1) * 0.015, o.yon + Math.sin(o.ph * 0.11) * 0.06, Math.sin(o.ph * 0.7) * 0.025);
  }
}
// ---------------- su: gorunmez yuzey (su altini fon resmi gosterir) ----------------
let SU = null;
function suYuzeyi() {
  if (SU) return SU;
  // sadece derinlik yazar: geminin su altindaki kismi, batan kupler ve top gizlenir; resimdeki deniz gorunur
  SU = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ colorWrite: false })); SU.rotation.x = -Math.PI / 2; SU.renderOrder = -10; A.scene.add(SU);
  return SU;
}
const FOAM2 = {};
function suHalkasi(w, d) {
  const t = FOAM2.t || (FOAM2.t = A.canvasTex(256, 256, (x, W, H) => {
    const gg = x.createRadialGradient(W / 2, H / 2, W * 0.25, W / 2, H / 2, W / 2); gg.addColorStop(0, 'rgba(20,60,90,.28)'); gg.addColorStop(0.55, 'rgba(20,60,90,.12)'); gg.addColorStop(0.75, 'rgba(255,255,255,.5)'); gg.addColorStop(0.86, 'rgba(255,255,255,.2)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gg; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { const a = Math.random() * 6.283, r = W * (0.33 + Math.random() * 0.13); x.fillStyle = 'rgba(255,255,255,' + (0.3 + Math.random() * 0.5) + ')'; x.beginPath(); x.arc(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r, 1.5 + Math.random() * 4, 0, 6.283); x.fill(); }
  }));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.renderOrder = 2; return m;
}


// ---------------- sahne: fon, isik, seyir ----------------
export function sahne() {
  const Y = bolum(A.LV), fo = FON[Y.fon], bg = A.$('bg');
  bg.style.backgroundImage = 'none'; const cv = A.$('canli'); if (cv) cv.style.display = 'none';
  A.sun.color.set(fo.gunes); A.sun.intensity = fo.gi; A.rim.color.set(fo.rim);
  denizKur(fo);
  // derinlik: uzaktaki her sey ufuk rengine dogru hafifce soluklasir (bizim gemi yakinda, etkilenmez)
  A.scene.fog = new THREE.Fog(fo.sis || new THREE.Color('#bfe0f0'), 38, 300);
  suYuzeyi().position.y = A.GY;
  const g = A.g; g.state = 'sefer'; g.sefer = 0; A.$('hint').style.opacity = 0;
  g.shots = g.max = g.max + 2 * Y.p.length;   // hedefler uzakta ve hareketli: platform basina 2 top fazla
  if (A.Q.has('demir') || (A.TEST && !A.Q.has('sefer'))) g.sefer = SEFER.sure;   // test: seyir atlanir
  fit(); poz(); kuslar(Y.fon); dekorKur(fo); penguenKur(fo);
  A.hud(true); altinHud();
}
// kup durdugu platformun ustunden asagi inince dusmus sayilir (platformun dalgayla inip kalkmasi da hesaba katilir)
// (Adem 6 Kas: bolum bitmiyordu) kup kendi platformunun ustunden ayrilinca hemen dusmus sayilir: platformun yerel cercevesinde
// tablanin altina indiyse ya da merkezi tablanin disina ciktiysa. Baska platforma ya da fiçilara takilsa bile sayilir.
let VL, QL;
export function dustu(c) {
  const P = T && T.P[c.pi || 0]; if (!P) return c.body.position.y < -0.45;
  VL = VL || new THREE.Vector3(); QL = QL || new THREE.Quaternion();
  const b = c.body.position; VL.set(b.x - P.p.x, b.y - P.p.y, b.z - P.p.z).applyQuaternion(QL.copy(P.q).invert());
  if (VL.y < -0.5) return true;
  const m = 0.12; return P.kuyu ? VL.x * VL.x + VL.z * VL.z > (P.hx + m) ** 2 : Math.abs(VL.x) > P.hx + m || Math.abs(VL.z) > P.hz + m;
}
export function goneY(c) { const P = T && T.P[c.pi || 0]; return P ? P.p.y - 0.7 : -0.45; }
export function zone() { return 'su'; }
export function floorAt(x, z) {
  if (T) for (const P of T.P) { const lx = x - P.p.x, lz = z - P.p.z; if (P.kuyu ? lx * lx + lz * lz < P.hx * P.hx : Math.abs(lx) < P.hx && Math.abs(lz) < P.hz) return P.p.y; }
  return A.GY;
}
// her platformun pozu: seyir (uzaktan yaklasma), hareket (kay, salla, don, dalga), batma
let QA, EU, VA;
function poz() {
  const g = A.g; if (!T || !g) return;
  // (Adem 6 Kas) hedefler bize dogru gelmez, yerinde durur; seyirde ilerleyen bizim gemi (kamera, kare() icinde)
  for (const P of T.P) {
    const d = P.d, t = TT, ph = P.ph;
    let x = P.x, y = 0.05 * Math.sin(t * 1.3 + ph), rx = 0.008 * Math.sin(t * 1.1 + ph), rz = 0.008 * Math.sin(t * 0.9 + ph + 1), ry = 0;
    if (d.har === 'kay') x += d.a * Math.sin(t * d.w + ph);
    if (d.har === 'salla') { y = 0.16 * Math.sin(t * 1.7 + ph); rx = 0.05 * Math.sin(t * 1.35 + ph + 0.6); rz = 0.04 * Math.sin(t * 1.05 + ph + 1.7); }
    if (d.har === 'dalga') { y = (d.a || 0.45) * Math.sin(t * 1.25 + ph); rx = 0.02 * Math.sin(t * 1.25 + ph + 1.2); }
    if (d.har === 'don') ry = t * d.w;
    if (T.bat != null) { const b = T.bat; y -= Math.min(b / 3, 1) ** 1.6 * 6; rx += Math.min(b / 2.5, 1) * 0.3; rz -= Math.min(b / 3, 1) * 0.2; }
    VA.set(x, y, P.z); EU.set(rx, ry, rz, 'YXZ'); QA.setFromEuler(EU);
    tasi(P, VA, QA);
    P.kopuk.position.set(P.p.x, A.GY + 0.02, P.p.z); P.kopuk.material.opacity = T.bat != null ? Math.max(0, 1 - T.bat) : 1;
  }
}
// platformu ve ustundeki (dusmemis) kupleri yeni poza tasir; uyuyan kupler uyanmaz, uyanik kuplerin hizi da doner
let DQ, QI, V3, Q3, QS, EU2, M4;
function tasi(P, p, q) {
  QI.copy(P.q).invert(); DQ.copy(q).multiply(QI);
  const pi = T.P.indexOf(P);
  for (const c of A.cubes) {
    if (c.gone || c.out || c.landed || (c.pi || 0) !== pi) continue; const b = c.body;
    V3.set(b.position.x - P.p.x, b.position.y - P.p.y, b.position.z - P.p.z).applyQuaternion(DQ).add(p); b.position.set(V3.x, V3.y, V3.z);
    Q3.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w).premultiply(DQ); b.quaternion.set(Q3.x, Q3.y, Q3.z, Q3.w);
    V3.set(b.velocity.x, b.velocity.y, b.velocity.z).applyQuaternion(DQ); b.velocity.set(V3.x, V3.y, V3.z); b.aabbNeedsUpdate = true;
  }
  P.body.position.set(p.x, p.y, p.z); P.body.quaternion.set(q.x, q.y, q.z, q.w); P.body.aabbNeedsUpdate = true;
  P.p.copy(p); P.q.copy(q); P.grp.position.copy(p); P.grp.quaternion.copy(q);
}
// her kare: seyir, platform hareketleri, batma, bizim geminin sallanmasi, deniz, kuslar, penguen, suslar
export function kare(dt) {
  TT += dt; const g = A.g;
  if (g && T) {
    if (g.state === 'sefer') { g.sefer += dt; A.$('hint').style.opacity = 0; if (g.sefer >= SEFER.sure) demirAt(); }
    if (g.state === 'win' && T.bat == null) { T.bat = 0; batmaBasla(); }
    if (T.bat != null) { T.bat += dt; if (T.bat < 3 && Math.random() < dt * 22) { const P = T.P[Math.floor(Math.random() * T.P.length)]; A.bubble(P.p.x + (Math.random() - 0.5) * P.hx * 1.6, A.GY - 0.3, P.p.z + (Math.random() - 0.5) * P.hz); } }
    poz();
  }
  // bizim gemi: kamera ile birlikte iner kalkar, yalpalar (roll) ve bas vurur (pitch); seyirde daha cok.
  // Fon resmi de deniz golgelendiricisinde ayni aciyla doner, boylece ufuk dunyayla birlikte egilir.
  const cam = A.cam;
  if (BIZ.pv && cam.userData.q0) {
    const sef = g && g.state === 'sefer' ? 1 - Math.min(1, g.sefer / SEFER.sure) : 0;
    const dy = 0.07 * Math.sin(TT * 1.25) + sef * 0.12 * Math.sin(TT * 3.1);
    const roll = 0.011 * Math.sin(TT * 0.83) + sef * 0.022 * Math.sin(TT * 2.2), pit = 0.006 * Math.sin(TT * 1.25 + 1.1) + sef * 0.014 * Math.sin(TT * 3.1 + 0.9);
    // seyir: gemi hedefe dogru ilerler (yavaslayarak durur); kamera, gemi ve top arabasi birlikte
    const s = g && g.state === 'sefer' ? Math.min(1, g.sefer / SEFER.sure) : 1, uz = SEFER.yol * (1 - s) ** 3; BIZ.uz = uz;
    cam.userData.base.copy(cam.userData.base0).setY(cam.userData.base0.y + dy); cam.userData.base.z += uz; A.TC.holder.position.z = A.TC.hz0 + uz;
    QS.setFromEuler(EU2.set(pit, 0, roll)); BIZ.pv.position.copy(cam.userData.base); BIZ.pv.quaternion.copy(QS);
    cam.quaternion.copy(QS).multiply(cam.userData.q0);
    A.TC.holder.position.y = A.TC.by + dy;
    if (sef > 0.05) dumenSuyu(dt, sef);
  }
  if (DZ.mesh && cam.userData.q0) {
    const u = DZ.mesh.material.uniforms; u.time.value = TT; u.sar.value = innerWidth / innerHeight; u.th.value = DZ.th; u.pitch.value = DZ.pitch; u.camH.value = DZ.camH + (cam.userData.base.y - cam.userData.base0.y);
    if (g && g.state === 'sefer') { const k = Math.min(1, g.sefer / SEFER.sure); DZ.travel += SEFER.yol * 3 * (1 - k) ** 2 / SEFER.sure * dt; u.zoom.value = zoomSefer(k); } else u.zoom.value = FR.Z;
    u.kay.value = FR.kay;
    u.travel.value = DZ.travel; QI.copy(cam.userData.q0).invert().multiply(cam.quaternion); u.rot.value.setFromMatrix4(M4.makeRotationFromQuaternion(QI));
    penguenKare(dt, u);
  }
  kusKare(dt); dekorKare(dt);
  // ortam sesleri: dalgalar hep calar, seyirde ruzgarda yelken/bayrak; ses ilk dokunusta acilir, bu yuzden duzenli yoklanir
  if (A.AC && (ORT -= dt) <= 0) { ORT = 0.25; const sef = g && g.state === 'sefer' ? 1 - Math.min(1, g.sefer / SEFER.sure) : 0; A.dongu('dalga', 0.3, 0.8); A.dongu('yelken', 0.25 * sef, 0.3); }
}
let ORT = 0;
// (Adem 8 Kas: acilista yakinlasma mantiksizdi) eskiden seyirde fon resmi %6 buyukten baslayip kuculuyordu: gemi ileri giderken
// manzara geri cekiliyordu. Simdi gemiyle ayni egriyle (yavaslayarak) hafifce buyur; ufuktaki adalar, kayaliklar da yaklasir.
function zoomSefer(k) { const z0 = Math.max(1.02, FR.Z * 0.965); return z0 + (FR.Z - z0) * (1 - (1 - k) ** 3); }
function demirAt() {
  const g = A.g; g.state = 'play'; g.sefer = SEFER.sure;
  A.$('hint').style.opacity = 1;
  const at = [innerWidth / 2, innerHeight * 0.62]; A.floatText('⚓ Demir atıldı!', at[0], at[1], 'gold');
  if (A.AC) { A.sfx('zincir', 0.7); A.dongu('yelken', 0, 1.2); }   // demir zinciri bosalir, demir suya duser; yelken sesi kesilir
  A.shake = Math.max(A.shake, 0.08);
}
function batmaBasla() {
  for (const P of T.P) A.splash(P.p.x, P.p.z + P.hz, 1.4, true);
  if (A.AC) { A.sfx('su', 1); setTimeout(() => A.sfx('su', 1), 350); setTimeout(() => A.play('kabarcik', 0.35, 0.8), 700); }
}
// seyirde bizim geminin iki yaninda akan kopuk
let DS = 0;
function dumenSuyu(dt, k) {
  DS += dt * 26 * k; if (!BIZ.w) return;
  while (DS > 1) { DS--;
    const sg = Math.random() < 0.5 ? -1 : 1, m = A.spr('#ffffff', false, 0.85), z0 = BIZ.tip + Math.random() * 2;
    m.position.set(sg * (BIZ.w * (0.35 + Math.random() * 0.4)), A.GY + 0.1, z0 + (BIZ.uz || 0)); const s0 = 0.5 + Math.random() * 0.8, vx = sg * (1.5 + Math.random() * 2);
    A.fx(m, 1.1, (o, kk, dd) => { o.position.z += 26 * dd; o.position.x += vx * dd; o.scale.set(s0 * (1 + kk * 2), s0 * 0.55 * (1 + kk), 1); o.material.opacity = 0.85 * (1 - kk); });
  }
}
// ---------------- deniz: fon resmi WebGL'de, dalgali ve parlayan su ----------------
// Fon, ekrani kaplayan bir yuzeyde cizilir. Ufkun altindaki her nokta icin kameradan denize isin atilir: 5 dalganin egimi resmi
// o noktada kaydirir (yakinda cok, uzakta az -> perspektif), gunes pirilti yapar. Su maskesi sayesinde buz, kum ve kayalar kipirdamaz.
// Seyirde dalgalar bize dogru akar. Kamera yalpalayinca resim de ayni aciyla doner. Penguen de bu yuzeyde, buzun ustunde yurur.
const DZ = { mesh: null, travel: 0 }, ZOOM0 = 1.045; let FR = { Z: 1.045, kay: 0, c: 1 };   // yalpada kenarlar acilmasin diye resim %4.5 buyuk
// resimdeki bir satirin (ustten oran) ekrandaki yeri (ustten oran): golgelendiricideki 'cover' + ZOOM0 ile ayni hesap
// (Adem 6 Kas) ufku cok yukarida olan fonlarda (buzul, gundogumu) kamera fazla asagi bakiyordu: resim biraz buyutulup asagi
// kaydirilir, ufuk ekranin ustten ~%43'une gelir. Z: buyutme, kay: dikey kayma (ekran orani), c: genis ekranda dikey kirpma
const UFUK = 0.43;
function cerceve(fo) {
  const sar = innerWidth / innerHeight, c = sar < IMG_AR ? 1 : sar / IMG_AR, h0 = 0.5 + (fo.h - 0.5) * ZOOM0 * c;
  if (h0 >= UFUK) return { Z: ZOOM0, kay: 0, c };
  const Z = ZOOM0 * Math.max(1, UFUK / (fo.h * c), (1 - UFUK) / ((1 - fo.h) * c));
  return { Z, kay: UFUK - 0.5 - (fo.h - 0.5) * Z * c, c };
}
function resimdenEkran(fo, r) { const k = cerceve(fo); return 0.5 + (r - 0.5) * k.Z * k.c + k.kay; }
function denizKur(fo) {
  if (!DZ.mesh) {
    const m = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, fog: false,
      uniforms: { map: { value: null }, msk: { value: null }, iar: { value: IMG_AR }, sar: { value: 0.5 }, zoom: { value: ZOOM0 }, kay: { value: 0 }, th: { value: 1 }, pitch: { value: 0 }, camH: { value: 6 }, time: { value: 0 }, travel: { value: 0 },
        rot: { value: new THREE.Matrix3() }, sun: { value: new THREE.Vector3(0, 0.3, -1).normalize() }, sunCol: { value: new THREE.Color(1, 1, 0.9) }, glint: { value: 1.2 },
        pTex: { value: null }, pOn: { value: 0 }, pPos: { value: new THREE.Vector2() }, pSize: { value: new THREE.Vector2(0.1035, 0.0895) }, pAng: { value: 0 }, pFlip: { value: 1 }, pSq: { value: 1 }, pHop: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
      fragmentShader: `varying vec2 vUv; uniform sampler2D map, msk, pTex; uniform float iar, sar, zoom, kay, th, pitch, camH, time, travel, glint, pOn, pAng, pFlip, pSq, pHop; uniform vec2 pPos, pSize; uniform mat3 rot; uniform vec3 sun, sunCol;
        vec2 cover(vec2 n) { vec2 u = n * 0.5 + 0.5; u.y += kay; if (sar < iar) u.x = 0.5 + (u.x - 0.5) * sar / iar; else u.y = 0.5 + (u.y - 0.5) * iar / sar; return (u - 0.5) / zoom + 0.5; }
        void main() {
          vec2 n = vUv * 2.0 - 1.0;
          vec3 r0 = rot * normalize(vec3(n.x * th * sar, n.y * th, -1.0));
          vec2 n0 = vec2(r0.x / (-r0.z) / (th * sar), r0.y / (-r0.z) / th);
          vec2 uv = cover(n0);
          float sp = sin(pitch), cp = cos(pitch);
          vec3 wd = normalize(vec3(r0.x, r0.y * cp + r0.z * sp, -r0.y * sp + r0.z * cp));
          vec3 col;
          if (wd.y < -0.0015) {
            float m = texture2D(msk, uv).r;
            float t = camH / -wd.y; vec2 P = wd.xz * t; P.y -= travel;
            vec2 gr = vec2(0.0); float hg = 0.0;
            #define WV(dx, dz, k, a, w) { vec2 D = normalize(vec2(dx, dz)); float f = exp(-k * t * 0.018); float ph = dot(D, P) * k + time * w; gr += D * k * a * cos(ph) * f; hg += a * sin(ph) * f; }
            WV(0.15, 1.0, 0.45, 0.48, 1.05) WV(-0.55, 1.0, 0.8, 0.3, 1.5) WV(0.75, 0.65, 1.45, 0.16, 2.05) WV(-0.3, -1.0, 2.6, 0.08, 2.8) WV(1.0, 0.15, 4.2, 0.04, 3.5)
            float near = clamp(10.0 / t, 0.0, 1.8);
            vec2 off = gr * 0.013 * near * m; off.y *= 0.6;
            col = texture2D(map, uv + off).rgb;
            vec3 nr = normalize(vec3(-gr.x * 0.8, 1.0, -gr.y * 0.8));
            float s = pow(max(dot(reflect(wd, nr), sun), 0.0), 260.0) * smoothstep(320.0, 20.0, t);
            col += sunCol * s * glint * m;
            col *= 1.0 + hg * 0.08 * near * m;
          } else col = texture2D(map, uv).rgb;
          if (pOn > 0.5) {   // penguen: resim piksel biriminde, ayak noktasi etrafinda yalpalayarak
            vec2 d = (uv - pPos) * vec2(1.0, 1.0 / iar);
            float ca = cos(pAng), sa = sin(pAng); d = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y);
            vec2 ps = pSize * vec2(1.0, 1.0 / iar);
            float sh = length(vec2((d.x - ps.x * 0.12) / (ps.x * 0.55), (d.y + pHop * 0.3) / (ps.y * 0.06)));
            col *= 1.0 - 0.22 * smoothstep(1.0, 0.3, sh) / (1.0 + pHop * 60.0);
            vec2 l = vec2(d.x * pFlip / (ps.x * (2.0 - pSq)) + 0.5, (d.y - pHop) / (ps.y * pSq));
            if (l.x > 0.0 && l.x < 1.0 && l.y > 0.0 && l.y < 1.0) { vec4 pc = texture2D(pTex, l); col = mix(col, pc.rgb, pc.a); }
          }
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, 1.25) * 1.06; col = (col - 0.5) * 1.04 + 0.5;   // eski CSS fon filtresi
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }` });
    DZ.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); DZ.mesh.frustumCulled = false; DZ.mesh.renderOrder = -100; A.scene.add(DZ.mesh);
  }
  const u = DZ.mesh.material.uniforms; u.map.value = fo.tx || null; u.msk.value = fo.msk || fo.tx || null; DZ.mesh.visible = !!fo.tx;
  u.sun.value.set(...fo.pir).normalize(); u.sunCol.value.set(fo.pr); u.glint.value = fo.pg; DZ.travel = 0;
}
// ---------------- penguen: buz kutlesinin ustunde yalpalayarak yurur, durur, etrafina bakar, ziplar, kanat cirpar ----------------
// Adem'in buzul resmindeki penguen resimden kesildi (penguen.png), yeri dolduruldu; simdi fon yuzeyinde canli cizilir.
const PENG = { tx: null, on: false };
function penguenKur(fo) {
  const p = fo.penguen; PENG.on = !!(p && PENG.tx);
  if (!PENG.on) return;
  Object.assign(PENG, { u: p.u, v: p.v, u0: p.u0, u1: p.u1, yon: -1, mod: 'dur', t: 1.2, adim: 0, hop: 0, sq: 1 });
}
function penguenKare(dt, U) {
  U.pOn.value = PENG.on ? 1 : 0; if (!PENG.on) return;
  const P = PENG; P.t -= dt;
  if (P.t <= 0) {   // yeni davranis
    const r = Math.random();
    if (P.mod === 'yuru' || r < 0.3) { P.mod = 'dur'; P.t = 0.8 + Math.random() * 1.8; }
    else if (r < 0.75) { P.mod = 'yuru'; P.t = 1.5 + Math.random() * 2.5; if (Math.random() < 0.45) P.yon = -P.yon; }
    else if (r < 0.88) { P.mod = 'zipla'; P.t = 0.5; }
    else { P.mod = 'kanat'; P.t = 0.9; }
  }
  let ang = 0;
  if (P.mod === 'yuru') {
    P.adim += dt * 7.5; P.u += P.yon * 0.022 * dt;
    if (P.u < P.u0) { P.u = P.u0; P.yon = 1; } if (P.u > P.u1) { P.u = P.u1; P.yon = -1; }
    ang = Math.sin(P.adim) * 0.11; P.hop = Math.abs(Math.sin(P.adim)) * 0.0018; P.sq = 1;
  } else if (P.mod === 'zipla') { const k = 1 - P.t / 0.5; P.hop = Math.sin(k * Math.PI) * 0.012; P.sq = k < 0.15 ? 0.9 : 1.04; }
  else if (P.mod === 'kanat') { P.sq = 1 + Math.sin(P.t * 28) * 0.035; ang = Math.sin(P.t * 28) * 0.03; P.hop = 0; }
  else { P.hop = 0; P.sq = 1 + Math.sin(TT * 2.4) * 0.008; ang = Math.sin(TT * 0.7) * 0.02; }
  U.pPos.value.set(P.u, 1 - P.v); U.pAng.value = ang; U.pFlip.value = P.yon < 0 ? 1 : -1; U.pSq.value = P.sq; U.pHop.value = P.hop; U.pTex.value = P.tx;
}
// ---------------- martilar: gokte kanat cirparak ucar, suzulur, egilerek doner ----------------
const KUS = [];
function kanatGeo(ic) {   // ic kanat: kok genis; dis kanat: sivri, ucu koyu (martinin kara kanat ucu)
  const g = new THREE.BufferGeometry(), L = ic ? 0.95 : 1.0, c0 = ic ? 0.55 : 0.42, c1 = ic ? 0.42 : 0.06;
  const P = [0, 0, -c0 * 0.35, L, 0, -c1 * 0.2, L, 0, c1 * 0.8, 0, 0, c0 * 0.65], C = ic ? [1, 1, 1, 0.92, 0.94, 0.96, 0.92, 0.94, 0.96, 1, 1, 1] : [0.92, 0.94, 0.96, 0.12, 0.12, 0.14, 0.12, 0.12, 0.14, 0.92, 0.94, 0.96];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); return g;
}
function kusYap(sc) {
  const KM2 = KUS.mat || (KUS.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })), WB = KUS.wb || (KUS.wb = new THREE.MeshLambertMaterial({ color: '#ffffff' }));
  const gi = KUS.gi || (KUS.gi = kanatGeo(true)), go = KUS.go || (KUS.go = kanatGeo(false));
  const b = new THREE.Group(), body = new THREE.Mesh(KUS.bg || (KUS.bg = new THREE.SphereGeometry(0.22, 10, 8)), WB); body.scale.set(1, 0.85, 2.4); b.add(body);
  const head = new THREE.Mesh(KUS.hg || (KUS.hg = new THREE.SphereGeometry(0.16, 10, 8)), WB); head.position.set(0, 0.1, -0.5); b.add(head);
  const beak = new THREE.Mesh(KUS.kg || (KUS.kg = new THREE.ConeGeometry(0.05, 0.22, 6)), KUS.km || (KUS.km = new THREE.MeshLambertMaterial({ color: '#f2a020' }))); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.08, -0.7); b.add(beak);
  const tail = new THREE.Mesh(KUS.tg || (KUS.tg = new THREE.ConeGeometry(0.15, 0.4, 4)), WB); tail.rotation.x = Math.PI / 2; tail.scale.y = 1; tail.position.set(0, 0.02, 0.55); tail.scale.set(1, 1, 0.3); b.add(tail);
  const w = [];
  for (const sg of [1, -1]) { const ic = new THREE.Group(), il = new THREE.Mesh(gi, KM2), dl = new THREE.Group(), dm = new THREE.Mesh(go, KM2);
    ic.add(il); dl.position.x = 0.95; dl.add(dm); ic.add(dl); ic.scale.x = sg; ic.position.set(sg * 0.12, 0.06, -0.08); b.add(ic); w.push({ ic, dl, sg }); }
  b.scale.setScalar(sc); b.userData.w = w; A.scene.add(b); return b;
}
function kuslar(fon) {
  for (const k of KUS) A.scene.remove(k.m); KUS.length = 0;
  const n = fon === 'gunbatimi' ? 4 : 6;
  for (let i = 0; i < n; i++) KUS.push(kusYeni(i, true));
}
function kusYeni(i, ilk) {
  const near = i % 3 === 0, d = near ? 22 + Math.random() * 18 : 55 + Math.random() * 90, sc = near ? 0.8 + Math.random() * 0.3 : 1 + Math.random() * 0.5;
  const m = kusYap(sc), sg = Math.random() < 0.5 ? -1 : 1, cy = A.cam.position.y, cz = A.cam.position.z;
  const span = d * 0.62 + 8;
  const k = { m, d, sg, sp: 5 + Math.random() * 4, x: ilk ? (Math.random() * 2 - 1) * span : -sg * span, y: cy + d * (0.16 + Math.random() * 0.3), z: cz - d, ph: Math.random() * 10, fl: Math.random() * 2, cir: 1, yalp: (Math.random() - 0.5) * 0.4, span };
  return k;
}
function kusKare(dt) {
  if (!KUS.length) return;
  for (let i = 0; i < KUS.length; i++) {
    const k = KUS[i]; k.ph += dt; k.fl -= dt;
    if (k.fl < 0) { k.cir = 1 - k.cir; k.fl = k.cir ? 0.9 + Math.random() * 1.4 : 1.4 + Math.random() * 2.2; }
    const turn = Math.sin(k.ph * 0.35 + i) * 0.35 + k.yalp;   // hafif kivrilarak ucar
    k.x += k.sg * k.sp * dt * Math.cos(turn * 0.4); k.z += k.sp * dt * Math.sin(turn * 0.4) * 0.6; k.y += Math.sin(k.ph * 0.7 + i) * dt * 0.6 + (k.cir ? 0.25 : -0.2) * dt;
    const m = k.m; m.position.set(k.x, k.y, k.z);
    m.rotation.set(0, -k.sg * Math.PI / 2 + turn * 0.4, 0); m.rotateZ(-turn * 0.6 * k.sg);
    const f = k.cir ? Math.sin(k.ph * 9) : 0, a = k.cir ? 0.15 + f * 0.65 : 0.12 + Math.sin(k.ph * 1.3) * 0.04;
    for (const w of m.userData.w) { w.ic.rotation.z = a * w.sg; w.dl.rotation.z = (k.cir ? -f * 0.45 - 0.1 : -0.18) * w.sg; }   // aynalanan sol kanatta aci ters
    if (Math.abs(k.x) > k.span + 6) { A.scene.remove(m); KUS[i] = kusYeni(i, false); }
  }
}
// ---------------- kamera ve bizim gemi ----------------
// Kamera geminin arkasindan bakar. Egim, fondaki ufuk cizgisini 3B ufukla cakistirir (hedefler resimdeki denize oturur).
// Top arabasi platformlarin ustuyle ayni hizada; (Adem 6 Kas) arabanin alti ve altin platform ekranin altinda kalir:
// kamera yuksekligi, altin platformun on kenari ekranin hemen altina dusecek kadar secilir.
const BIZ = { grp: null };
const GUV = -0.7;   // bizim guverte (top arabasinin tabani): platform ustlerinin (y=0) biraz altinda, namlu platform hizasinda
export function fit() {
  const { cam, ren, TC } = A, W = innerWidth, H = innerHeight; ren.setSize(W, H, false); cam.aspect = W / H;
  cam.fov = Math.max(42, Math.min(92, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(52 * Math.PI / 360) / cam.aspect)))); cam.updateProjectionMatrix();
  const th = Math.tan(cam.fov * Math.PI / 360), thx = th * cam.aspect;
  const Y = bolum(A.LV), fo = FON[Y.fon];
  const yh = 1 - 2 * resimdenEkran(fo, fo.h), pitch = Math.atan(yh * th); FR = cerceve(fo);
  const dir = new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch)), V = new THREE.Vector3();
  const t = T || { x0: -5, x1: 5, zf: 3, top: 6, hz: 3 }, GY = A.GY;
  const nd = (p) => V.set(p[0], p[1], p[2]).project(cam);
  let camY = GUV + 2.2, dc = 4.1, sc = 0, rd = 1;
  const place = (dd) => { cam.position.set(0, camY, dd); cam.lookAt(V.set(0, camY, dd).add(dir)); cam.updateMatrixWorld(true); };
  // 1) altin platformun on kenari ekranin altinin disinda kalsin (yalpa payi ile). Ufku yuksek fonlarda kamera asagi baktigi icin
  // once top arabasi kameraya yaklastirilir (dc), olmazsa goz biraz yukselir (en cok 3.6).
  find: for (dc = 4.1; dc >= 2.2; dc -= 0.1) {
    DCV = dc; sc = KM.bizim_gemi ? bizSc(dc * thx) : 0; rd = KM.bizim_gemi ? (KAL.bizim_gemi.plat.r + 0.035) * sc : 1.2;
    for (let e = 2.2; e <= 3.6; e += 0.05) { camY = GUV + e; place(100); if (nd([0, GUV, 100 - dc - rd]).y < -1.07) break find; }
  }
  // 2) top arabasi: genisligi ekranin %36'si; ust kismi (namlu) ekranda yeterince gorunsun diye gerekirse buyur
  let capTop = -0.4;
  if (TC.gun) {
    let k = (0.36 * 2 * dc * thx) / TC.w0;
    for (let i = 0; i < 30; i++) { TC.holder.scale.setScalar(k); capTop = nd([0, GUV + TC.h * k * 0.92, 100 - dc]).y; if (capTop > -0.42 || k * TC.w0 > 0.62 * 2 * dc * thx) break; k *= 1.04; }
    TC.k = k;
  }
  // 3) hedef uzakligi: yapinin tepesi ust cubugun altinda, platformlar (kayma payi dahil) ekrana sigar, on platform topun ustunde gorunur
  const tops = [[t.x0, t.top + 0.3, -t.hz], [t.x1, t.top + 0.3, -t.hz], [t.x0, t.top + 0.3, t.zf], [t.x1, t.top + 0.3, t.zf]];
  const side = [[t.x0, GY, t.zf], [t.x1, GY, t.zf]], on = [(t.x0 + t.x1) / 2, -0.3, t.zf];
  let d = 24;
  for (; d < 220; d += 0.25) { place(d); const top = Math.max(...tops.map((p) => nd(p).y)), sd = Math.max(...tops.concat(side).map((p) => Math.abs(nd(p).x))), lo = nd(on).y;
    if (top < 0.62 && sd < 0.94 && lo > capTop + 0.04) break; }
  place(d); cam.userData.base = cam.position.clone(); cam.userData.base0 = cam.position.clone(); cam.userData.q0 = cam.quaternion.clone();
  DZ.pitch = pitch; DZ.th = th; DZ.camH = camY - GY; DZ.ok = true;
  if (TC.gun) {
    TC.holder.position.set(0, GUV, d - dc); TC.holder.rotation.y = Math.PI; TC.by = GUV; TC.hz0 = d - dc;
    // Adem'in gemisinde top arabasi modeldeki altin platforma oturur (kodla cizilen kaide gizli)
    for (const o of TC.holder.children) o.visible = !KM.bizim_gemi || o === TC.gun;
    bizimGemi(GUV, d - dc, sc);
  }
}
let DCV = 4.1; const DC = () => DCV;
// Adem'in gemisinin olcegi: altin platform top arabasinin tekerleklerini tasiyacak, kic kasarasi kameranin arkasinda kalacak kadar
function bizSc(hw) { const K = KAL.bizim_gemi; return Math.max(hw * 1.15 / K.en, (DC() + 1.1) / (K.plat.z - K.kic)); }
function bizimGemi(dy, zc, sc) {
  if (BIZ.grp) BIZ.pv.remove(BIZ.grp);
  // bizim gemi kameranin cevresinde donen bir eksene (pv) bagli: kamera ile birlikte yalpalar ve bas vurur, ekranda sabit kalir
  if (!BIZ.pv) { BIZ.pv = new THREE.Group(); A.scene.add(BIZ.pv); }
  BIZ.pv.position.copy(A.cam.position); BIZ.pv.quaternion.identity();
  const grp = new THREE.Group(); BIZ.grp = grp; BIZ.pv.add(grp); grp.position.copy(A.cam.position).negate();
  if (!KM.bizim_gemi) return;
  // burun -z'ye (hedefe) doner; altin platformun merkezi top arabasinin altinda
  const K = KAL.bizim_gemi; grp.add(yerlestir('bizim_gemi', sc, Math.PI, [0, K.plat.y, K.plat.z], [0, dy, zc]));
  BIZ.w = K.en * sc; BIZ.tip = zc - (K.bas - K.plat.z) * sc;
}

// ---------------- arayuz: altin, kazanma karti, sandik, harita ----------------
function altinHud() { const e = A.$('au'); if (e) e.textContent = A.SV.altin || 0; }
const yildiz = (n) => [0, 1, 2].map((i) => '<span' + (i < n ? '' : ' class="off"') + '>★</span>').join('');
export function kart() {
  const g = A.g, SV = A.SV, L = A.LV;
  SV.max = Math.max(SV.max || 1, L + 1); if (!SV.yil) SV.yil = {};
  const r = g.shots / g.max, st = Math.min(3, (r >= 0.4 ? 3 : r >= 0.15 ? 2 : 1) + g.bonus);
  SV.yil[L] = Math.max(SV.yil[L] || 0, st);
  const kaz = 10 + st * 10 + g.gold * 25 + (bolum(L).patron ? 50 : 0), once = SV.altin || 0; SV.altin = once + kaz; A.save();
  const sandik = L % 5 === 0;
  A.modal('<div class="rib">Zafer!</div><div class="stars">' + yildiz(st) + '</div><h2>Bölüm ' + L + ' tamam</h2>' +
    '<div class="kz"><i class="coin"></i><b id="kz">+0</b></div><p class="kasa">Hazine: <b id="ks">' + once + '</b></p>' +
    (sandik ? '<div class="sdk" id="sdk">' + sandikSvg() + '<small>Hazine sandığı! Aç</small></div>' : '') +
    '<button class="btn" id="nx">Devam Et</button>');
  for (let i = 0; i < st; i++) setTimeout(() => A.sfx('bonus'), 120 + i * 250);
  // altin sayaci: yildizlardan sonra tek tek sayarak eklenir (altin sesiyle)
  setTimeout(() => A.AC && A.sfx('para', 0.55), 900);
  let n = 0; const step = Math.max(1, Math.round(kaz / 24));
  setTimeout(function say() { n = Math.min(kaz, n + step); const a = A.$('kz'), b = A.$('ks'); if (!a) return; a.textContent = '+' + n; b.textContent = once + n;
    if (n < kaz) setTimeout(say, 45); else { a.parentNode.classList.add('pop'); altinHud(); } }, 900);
  const sd = A.$('sdk'); if (sd) sd.onclick = () => { if (sd.classList.contains('acik')) return; sd.classList.add('acik'); const ek = 100; SV.altin += ek; A.save(); A.sfx('sandik', 0.8);
    sd.querySelector('small').textContent = '+' + ek + ' altın!'; paraYagmuru(sd); const b = A.$('ks'); if (b) b.textContent = SV.altin; altinHud(); };
  A.$('nx').onclick = () => { A.sfx('tik'); harita(L, L + 1); };
}
function paraYagmuru(el) {
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 18; i++) { const c = document.createElement('i'); c.className = 'coin ucan'; c.style.left = (r.left + r.width / 2) + 'px'; c.style.top = (r.top + r.height * 0.4) + 'px';
    c.style.setProperty('--dx', ((Math.random() - 0.5) * 220) + 'px'); c.style.setProperty('--dy', (-80 - Math.random() * 160) + 'px'); c.style.animationDelay = (i * 0.03) + 's'; document.body.appendChild(c); setTimeout(() => c.remove(), 1300); }
}
function sandikSvg() {
  return '<svg viewBox="0 0 120 96" width="120" height="96"><g class="gv"><rect x="14" y="44" width="92" height="44" rx="6" fill="#8a4a1e" stroke="#4a2008" stroke-width="4"/>' +
    '<rect x="14" y="56" width="92" height="7" fill="#f2c14a"/><rect x="24" y="44" width="9" height="44" fill="#f2c14a"/><rect x="87" y="44" width="9" height="44" fill="#f2c14a"/>' +
    '<rect x="52" y="52" width="16" height="18" rx="3" fill="#f7d45c" stroke="#7a4a08" stroke-width="3"/><circle cx="60" cy="60" r="3" fill="#4a2008"/></g>' +
    '<g class="ic"><circle cx="44" cy="44" r="8" fill="#ffd23f" stroke="#a86a00" stroke-width="2"/><circle cx="60" cy="40" r="9" fill="#ffe36b" stroke="#a86a00" stroke-width="2"/><circle cx="77" cy="44" r="8" fill="#ffd23f" stroke="#a86a00" stroke-width="2"/></g>' +
    '<g class="kp"><path d="M14 46 Q14 14 60 14 Q106 14 106 46 Z" fill="#9a5424" stroke="#4a2008" stroke-width="4"/><rect x="24" y="17" width="9" height="29" fill="#f2c14a"/><rect x="87" y="17" width="9" height="29" fill="#f2c14a"/></g></svg>';
}
// deniz haritasi: bolgenin 10 duragi, kivrimli rota; gemi bir sonraki durağa ilerler. 10. durak patron gemisi.
const DURAK = [[60, 330], [150, 312], [236, 286], [212, 226], [118, 210], [60, 160], [128, 112], [218, 120], [252, 64], [158, 34]];
function harita(from, to, salt) {
  const b0 = Math.floor((from - 1) / BOLGE) * BOLGE, ix = (L) => Math.min(BOLGE - 1, Math.max(0, L - 1 - b0));
  let d = 'M' + DURAK[0][0] + ' ' + DURAK[0][1]; for (let i = 1; i < DURAK.length; i++) { const [x0, y0] = DURAK[i - 1], [x1, y1] = DURAK[i]; d += ' Q' + ((x0 + x1) / 2 + (i % 2 ? 24 : -24)) + ' ' + ((y0 + y1) / 2) + ' ' + x1 + ' ' + y1; }
  const yil = (A.SV.yil || {});
  let nodes = ''; DURAK.forEach(([x, y], i) => { const L = b0 + i + 1, done = !!yil[L] && L !== to, cur = L === (salt ? from : to), boss = i === BOLGE - 1, pilot = L > BOLUMLER.length;
    nodes += '<g class="nd' + (done ? ' ok' : '') + (cur ? ' cur' : '') + (boss ? ' boss' : '') + (pilot && !done ? ' kilit' : '') + '"><circle cx="' + x + '" cy="' + y + '" r="' + (boss ? 17 : 13) + '"/>' +
      '<text x="' + x + '" y="' + (y + 5) + '">' + (boss ? '☠' : L) + '</text>' + (yil[L] ? '<text class="ys" x="' + x + '" y="' + (y + 27) + '">' + '★'.repeat(yil[L]) + '</text>' : '') + '</g>'; });
  const html = '<div class="rib">Deniz Haritası</div><p class="bl">Bölge ' + (b0 / BOLGE + 1) + ' · Turkuaz Sular</p>' +
    '<svg class="map" viewBox="0 0 300 360"><defs><pattern id="dz" width="22" height="14" patternUnits="userSpaceOnUse"><path d="M0 10 Q5.5 4 11 10 T22 10" fill="none" stroke="#9cc9d8" stroke-width="1.4"/></pattern></defs>' +
    '<rect x="4" y="4" width="292" height="352" rx="18" fill="#bfe6ef"/><rect x="4" y="4" width="292" height="352" rx="18" fill="url(#dz)" opacity=".7"/>' +
    '<g class="adalar"><ellipse cx="250" cy="200" rx="34" ry="20"/><ellipse cx="40" cy="250" rx="26" ry="16"/><ellipse cx="90" cy="60" rx="30" ry="17"/><ellipse cx="200" cy="330" rx="24" ry="12"/></g>' +
    '<path id="rota" d="' + d + '" fill="none" stroke="#8a4a1e" stroke-width="4" stroke-dasharray="2 10" stroke-linecap="round"/>' + nodes +
    '<g id="gm"><path d="M-16 0 L16 0 L11 9 L-11 9 Z" fill="#c8202e" stroke="#4a1608" stroke-width="2"/><rect x="-1.5" y="-20" width="3" height="21" fill="#4a2008"/><path d="M1 -19 L14 -12 L1 -5 Z" fill="#fff4dc" stroke="#4a2008" stroke-width="1.5"/></g>' +
    '<text x="276" y="28" class="pus">N</text></svg>' +
    '<button class="btn" id="ya">' + (salt ? 'Kapat' : 'Yelken Aç!') + '</button>';
  A.modal(html); A.$('card').classList.add('harita');
  const path = A.$('rota'), gm = A.$('gm'), len = path.getTotalLength();
  const lenAt = (i) => { let lo = 0, hi = len; const [x, y] = DURAK[i]; for (let s = 0; s <= 200; s++) { const p = path.getPointAtLength(len * s / 200); if (Math.hypot(p.x - x, p.y - y) < 3) { lo = len * s / 200; break; } } return lo; };
  const a = lenAt(ix(from)), b = salt ? a : lenAt(ix(to)), t0 = performance.now(), dur = salt ? 1 : 1400;
  (function an(now) { const k = Math.min(1, (now - t0 - 300) / dur), e = k < 0 ? 0 : k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2, p = path.getPointAtLength(a + (b - a) * e), q = path.getPointAtLength(Math.min(len, a + (b - a) * e + 2));
    gm.setAttribute('transform', 'translate(' + p.x + ' ' + (p.y - 6) + ') scale(' + (q.x < p.x ? -1 : 1) + ' 1) rotate(' + (Math.sin(now / 220) * 4) + ')'); if (k < 1 || (salt && A.$('card').classList.contains('harita'))) requestAnimationFrame(an); })(t0);
  A.$('ya').onclick = () => { A.sfx('tik'); A.$('card').classList.remove('harita'); if (salt) { A.closeModal(); return; } A.start(to); };
}
export function haritaAc() { if (!A || !A.g) return; harita(A.LV, A.LV, true); }
export function _T() { return T; }   // testler icin
export function _olc() {   // testler icin: suslarin ve platformlarin dunyadaki kutulari
  const bx = (o) => { const b = new THREE.Box3().setFromObject(o); return [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z].map((v) => +v.toFixed(1)); };
  return { dekor: DEKOR.map((o) => ({ tip: o.tip, kutu: bx(o.g) })), plat: T ? T.P.map((P) => bx(P.grp)) : [], cam: A.cam.position.toArray().map((v) => +v.toFixed(1)), GY: A.GY, ses: A.AC ? A.AC.state : 'yok', zoom: DZ.mesh ? +DZ.mesh.material.uniforms.zoom.value.toFixed(4) : 0 };
}
