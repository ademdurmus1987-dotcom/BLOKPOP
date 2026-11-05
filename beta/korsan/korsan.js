// BLOKPOP Korsan modu - pilot (Adem 5 Kas 2026)
// Yapi motorunun (yapi/oyun.js) uzerine kurulur: kupler, fizik, kirilma, ses ve top ayni. Bu dosya sadece korsan sahnesini kurar:
//  - bizim gemimiz: kamera geminin arkasindan alcak bakar, ekranin altinda sadece burun ve guvertenin onu gorunur;
//    top arabasi (Adem'in modeli) guvertedeki altin yuvarlak platformda durur. Gemi direksiz.
//  - hedefler: sallanan sal, dusman korsan gemisi (alt guverte + kic kabin catisi iki kat), gozcu kulesi adasi.
//  - seyir: her bolumun basinda gemi 2-3 sn ilerler (hedef uzaktan yaklasir), sonra demir atilir ve atis baslar.
//  - hedef dalgada iner kalkar ve yalpalar; ustundeki kupler onunla birlikte tasinir. Kazaninca gemi/sal batar.
//  - kazanma karti: 1-3 yildiz, altin sayilarak eklenir, her 5 bolumde hazine sandigi; sonra deniz haritasi (gemi rotada ilerler).
// 3B modeller (Adem'in Tripo modelleri): model/bizim_gemi, dusman_gemi, kule_ada, sal .glb (KAL tablosu). Dosya yoksa kodla cizilmis yedek govdeler.
let A = null, THREE = null, CANNON = null;
export function bagla(a) { A = a; THREE = a.THREE; CANNON = a.CANNON;
  QA = new THREE.Quaternion(); EU = new THREE.Euler(); VA = new THREE.Vector3(); DQ = new THREE.Quaternion(); QI = new THREE.Quaternion(); V3 = new THREE.Vector3(); Q3 = new THREE.Quaternion(); const h = a.$('hr'); if (h) h.onclick = () => { a.sfx('tik'); haritaAc(); }; }
export function hazir() { return !!(A && A.TC.gun); }

// ---------------- fonlar: Adem'in Gemini resimleri (korsan/kaynak/fon_*.webp). h: ufuk cizgisinin resimdeki yeri (ustten oran) ----------------
const FON = {
  acikdeniz: { h: 0.5, gunes: 0xfff0d0, gi: 2.6, rim: 0xcfe0ff },
  ada: { h: 0.522, gunes: 0xfff4dc, gi: 2.6, rim: 0xd8f0ff },
  gunbatimi: { h: 0.5, gunes: 0xffc48a, gi: 2.3, rim: 0xff9ad0 },
  koy: { h: 0.537, gunes: 0xfff4dc, gi: 2.6, rim: 0xd8f0ff }
};
const IMG_AR = 1440 / 2560;
// ---------------- bolumler ----------------
// kup listesi [i, j(kat), k, model, platform] - platform 1: dusman gemisinin kic kabin catisi (ikinci kat)
function box(o, i0, i1, j0, j1, k0, k1, col, pn) { for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) { const c = typeof col === 'function' ? col(i, j, k) : col; if (c) o.push([i, j, k, c, pn || 0]); } return o; }
export const BOLGE = 10;   // her 10 bolumde bolge (manzara seti) degisir, 10. bolum patron gemisi. Pilotta 5 bolum var.
const BOLUMLER = [
  { ad: 'Sallanan Sal', fon: 'acikdeniz', hedef: 'sal', make: () => box([], 0, 2, 0, 2, 0, 1, (i, j, k) => (j === 2 && i === 1 && k === 0 ? 'altin' : j === 1 && i === 1 ? 'fici' : 'sandik')) },
  { ad: 'Korsan Gemisi', fon: 'acikdeniz', hedef: 'gemi', make: () => box([], 0, 5, 0, 3, 0, 1, (i, j, k) => (j === 0 && k === 1 && (i === 1 || i === 4) ? 'fici' : j === 3 ? (i === 2 || i === 3 ? 'altin' : 'ahsap2') : j === 2 ? 'kirmizi' : 'sandik')) },
  { ad: 'Gözcü Kulesi', fon: 'ada', hedef: 'kule', make: () => box([], 0, 3, 0, 5, 0, 1, (i, j) => (j === 5 ? (i === 1 || i === 2 ? 'altin' : 'tas') : j % 2 ? 'metal' : 'tas')) },
  { ad: 'İki Katlı Gemi', fon: 'gunbatimi', hedef: 'gemi', make: () => { const o = box([], 0, 4, 0, 2, 0, 1, (i, j, k) => (j === 0 && k === 1 && i === 2 ? 'fici' : j === 2 ? 'kirmizi' : 'sandik'));
    return box(o, 0, 2, 0, 2, 0, 1, (i, j) => (j === 2 && i === 1 ? 'altin' : 'metal'), 1); } },
  { ad: 'Patron Gemisi', fon: 'koy', hedef: 'gemi', patron: true, make: () => { const o = box([], 0, 5, 0, 3, 0, 1, (i, j, k) => (j === 0 && k === 1 && (i === 1 || i === 4) ? 'fici' : j === 3 ? 'ahsap2' : j === 1 ? 'tas' : 'sandik'));
    return box(o, 0, 3, 0, 3, 0, 1, (i, j) => (j === 3 && (i === 1 || i === 2) ? 'altin' : j % 2 ? 'kirmizi' : 'metal'), 1); } }
];
export function bolum(L) { return BOLUMLER[(L - 1) % BOLUMLER.length]; }

// ---------------- Tripo modelleri (Adem, 6 Kas 2026) ----------------
// Dosyalar beta/yapi/model/<ad>.glb (orijinalleri model/kaynak/). Olculer modelin kendisinden: yukaridan isin atilarak
// guverte, kabin catisi, kule tepesi ve sal tablasinin yuksekligi ve siniri bulundu (model birimi, y yukari, burun +z).
// su: su cizgisi yuksekligi (tahmin; gemi govdesinin ~%40'i suyun altinda).
const KAL = {
  bizim_gemi: { plat: { y: 0.415, z: 0.15, r: 0.05 }, en: 0.31, kic: -0.17, bas: 0.49, su: 0.17 },   // atici gemisi: altin platform burna yakin
  dusman_gemi: { g: { y: 0.26, x: 0.15, z: [-0.1, 0.3] }, cati: { y: 0.41, x: 0.13, z: [-0.33, -0.1] }, bas: { y: 0.38, z: [0.3, 0.49] }, en: 0.22, su: 0.11 },
  kule_ada: { tepe: { y: 0.9, z: -0.059, r: 0.19 }, kule: 0.13, kum: { y: 0.15, r: 0.4 }, ada: 0.49, su: 0.06 },
  sal: { g: { y: 0.48, x: [-0.16, 0.4], z: 0.29 }, su: 0.21, kirp: -0.25 }   // fiçilar yarıya kadar suda
};
const KM = {};
export function yukle() {
  return Promise.all(Object.keys(KAL).map((n) => new Promise((res) => {
    new A.GLTFLoader().load('model/' + n + '.glb?v=1', (gl) => {
      gl.scene.updateMatrixWorld(true);
      gl.scene.traverse((o) => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = true;
        if (KAL[n].kirp != null && o.geometry.index) {   // salin yanindaki kopuk ip parcasi (modelde ayri duruyor) atilir
          const P = o.geometry.attributes.position, I = o.geometry.index.array, v = new THREE.Vector3(), keep = [];
          for (let i = 0; i < I.length; i += 3) { let out = 0; for (let j = 0; j < 3; j++) { v.fromBufferAttribute(P, I[i + j]).applyMatrix4(o.matrixWorld); if (v.x < KAL[n].kirp) out++; } if (out < 3) keep.push(I[i], I[i + 1], I[i + 2]); }
          o.geometry.setIndex(keep); } });
      KM[n] = gl.scene; res(); }, undefined, () => res());
  })));
}
// modeli kopyala, dondur, olcekle; modeldeki 'cpa' noktasi (model birimi) dunyada 'to' noktasina gelsin
function yerlestir(n, sc, rotY, cpa, to) {
  const m = KM[n].clone(true), g = new THREE.Group(); g.add(m); m.scale.setScalar(sc);
  g.rotation.y = rotY || 0; const off = new THREE.Vector3(...cpa).multiplyScalar(sc).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY || 0);
  g.position.set(to[0] - off.x, to[1] - off.y, to[2] - off.z); return g;
}

// ---------------- kodla cizilen dokular ----------------
const TX = {};
function tex(n, w, h, draw, rep) { return TX[n] || (TX[n] = A.canvasTex(w, h, draw, rep)); }
function plankTex() {   // guverte tahtalari (dunya biriminde: 1 tekrar = 4 birim)
  return tex('tahta', 256, 256, (x, w, h) => {
    const cols = ['#c98b4a', '#bf7f40', '#d39552', '#b87a3c'];
    for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % 4]; x.fillRect(0, i * 32, w, 32); x.fillStyle = 'rgba(80,40,10,.55)'; x.fillRect(0, i * 32, w, 3);
      const cut = (i * 97) % 256; x.fillRect(cut, i * 32, 3, 32);
      for (let k = 0; k < 6; k++) { x.strokeStyle = 'rgba(110,60,20,.18)'; x.beginPath(); x.moveTo(0, i * 32 + 8 + k * 4); x.bezierCurveTo(80, i * 32 + 6 + k * 4, 170, i * 32 + 12 + k * 4, 256, i * 32 + 8 + k * 4); x.stroke(); } }
  }, [0.25, 0.25]);
}
function hullTex(red) {   // gemi govdesi: ustte altin cizgi, kirmizi serit, altinda koyu tahta
  return tex('govde' + red, 64, 512, (x, w, h) => {
    x.fillStyle = '#3a2418'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 26) { x.fillStyle = y % 52 ? '#43291b' : '#352015'; x.fillRect(0, y, w, 24); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, y + 24, w, 2); }
    x.fillStyle = red; x.fillRect(0, 64, w, 70); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, 64, w, 8);
    x.fillStyle = '#f2c14a'; x.fillRect(0, 50, w, 12); x.fillRect(0, 136, w, 8);
    x.fillStyle = '#5a3420'; x.fillRect(0, 0, w, 50);
  });
}
function cabinTex() {   // kic kabini: tahta duvar, isikli pencereler
  return tex('kabin', 256, 128, (x, w, h) => {
    x.fillStyle = '#6b3f22'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#74462a' : '#633a20'; x.fillRect(i * 16, 0, 15, h); }
    for (const cxp of [48, 128, 208]) { x.fillStyle = '#2a1608'; x.beginPath(); x.roundRect(cxp - 18, 34, 36, 44, 14); x.fill(); const gg = x.createRadialGradient(cxp, 56, 2, cxp, 56, 22); gg.addColorStop(0, '#fff3a8'); gg.addColorStop(1, '#f0a020'); x.fillStyle = gg; x.beginPath(); x.roundRect(cxp - 14, 38, 28, 36, 11); x.fill();
      x.fillStyle = '#2a1608'; x.fillRect(cxp - 1.5, 38, 3, 36); x.fillRect(cxp - 14, 54, 28, 3); }
    x.fillStyle = '#c8202e'; x.fillRect(0, h - 14, w, 10); x.fillStyle = '#f2c14a'; x.fillRect(0, h - 4, w, 4); x.fillRect(0, 0, w, 5);
  });
}
function stoneTex() {
  return tex('tas', 256, 256, (x, w, h) => {
    x.fillStyle = '#9c968a'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 5; c++) { const ox = (r % 2) * 26, l = 200 + ((r * 7 + c * 13) % 5) * 9;
      x.fillStyle = 'rgb(' + l + ',' + (l - 8) + ',' + (l - 24) + ')'; x.beginPath(); x.roundRect(c * 52 + ox - 26 + 2, r * 32 + 2, 48, 28, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(c * 52 + ox - 20, r * 32 + 4, 36, 4); }
  });
}
function flagTex() {   // kara korsan bayragi (kafatasi + capraz kemik), kodla cizilir
  return tex('bayrak', 128, 96, (x, w, h) => {
    x.fillStyle = '#16141a'; x.fillRect(0, 0, w, h); x.fillStyle = '#f4f0e6'; x.strokeStyle = '#f4f0e6'; x.lineCap = 'round'; x.lineWidth = 9;
    x.beginPath(); x.moveTo(38, 70); x.lineTo(90, 30); x.moveTo(38, 30); x.lineTo(90, 70); x.stroke();
    for (const [a, b] of [[34, 68], [94, 32], [34, 32], [94, 68]]) { x.beginPath(); x.arc(a, b, 6, 0, 7); x.fill(); }
    x.beginPath(); x.arc(64, 42, 19, 0, 7); x.fill(); x.fillRect(54, 52, 20, 14);
    x.fillStyle = '#16141a'; x.beginPath(); x.arc(56, 42, 5.5, 0, 7); x.arc(72, 42, 5.5, 0, 7); x.fill(); x.fillRect(62, 50, 4, 6);
  });
}
const MAT = {};
function mat(n) {
  if (MAT[n]) return MAT[n];
  const M = THREE.MeshStandardMaterial;
  const m = { tahta: () => new M({ map: plankTex(), roughness: 0.75 }), govde: () => new M({ map: hullTex('#c8202e'), roughness: 0.6, side: THREE.DoubleSide }),
    govde2: () => new M({ map: hullTex('#7a2bd0'), roughness: 0.6, side: THREE.DoubleSide }), bizim: () => new M({ map: hullTex('#d42a2a'), roughness: 0.55, side: THREE.DoubleSide }),
    kabin: () => new M({ map: cabinTex(), roughness: 0.7 }), altin: () => new M({ color: '#f2b93a', roughness: 0.3, metalness: 0.6 }),
    kirmizi: () => new M({ color: '#d42a2a', roughness: 0.45, side: THREE.DoubleSide }), koyu: () => new M({ color: '#4a2c1a', roughness: 0.7 }),
    tas: () => new M({ map: stoneTex(), roughness: 0.85 }), kaya: () => new M({ color: '#8a8780', roughness: 0.9, flatShading: true }),
    kum: () => new M({ color: '#f0d9a0', roughness: 1 }), cimen: () => new M({ color: '#7cc444', roughness: 0.9, flatShading: true }),
    bayrak: () => new M({ map: flagTex(), roughness: 0.8, side: THREE.DoubleSide }), sal: () => new M({ color: '#b97d42', roughness: 0.8 }), ip: () => new M({ color: '#d8b878', roughness: 0.9 }) }[n]();
  return (MAT[n] = m);
}
// ---------------- kodla cizilen parcalar ----------------
// guverte: (x,z) duzlemindeki cokgen, ustu y=top
function deckMesh(pts, top, th, m) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: 4 }); g.rotateX(-Math.PI / 2); g.translate(0, top - th, 0);
  const me = new THREE.Mesh(g, m); me.castShadow = me.receiveShadow = true; return me;
}
// govde: guverte kenarindan asagi daralan kabuk. lv: [y, olcek] seviyeleri (ustten alta). Doku v'si yukseklige gore.
function hullMesh(pts, lv, cx, cz, m) {
  const n = pts.length, pos = [], uv = [], idx = [], y0 = lv[lv.length - 1][0], y1 = lv[0][0];
  let per = 0; const d = [0]; for (let i = 1; i <= n; i++) { const a = pts[i - 1], b = pts[i % n]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); d.push(per); }
  for (const [y, s] of lv) for (let i = 0; i <= n; i++) { const p = pts[i % n]; pos.push(cx + (p[0] - cx) * s, y, cz + (p[1] - cz) * s); uv.push(d[i] / 3, (y - y0) / (y1 - y0)); }
  for (let l = 0; l < lv.length - 1; l++) for (let i = 0; i < n; i++) { const a = l * (n + 1) + i, b = a + 1, c = a + n + 1, e = c + 1; idx.push(a, c, b, b, c, e); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const me = new THREE.Mesh(g, m); me.castShadow = true; me.receiveShadow = true; return me;
}
// kenar parmakligi: kirmizi alcak duvar + altin kupeste + altin babalar
function railing(grp, pts, y, h, k, closed, wall) {
  const P = pts.map(([x, z]) => new THREE.Vector3(x, y + h, z)); if (closed) P.push(P[0].clone());
  const cur = new THREE.CatmullRomCurve3(P, false, 'centripetal', 0.1);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(cur, Math.max(8, P.length * 6), 0.09 * k, 8, false), mat('altin')); tube.castShadow = true; grp.add(tube);
  if (wall) {   // ic tarafta kirmizi duvar seridi
    const pos = [], idx = []; const L = P.length;
    for (let i = 0; i < L; i++) { pos.push(P[i].x, y, P[i].z, P[i].x, y + h, P[i].z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const me = new THREE.Mesh(g, mat('kirmizi')); me.receiveShadow = true; grp.add(me);
  }
  const len = cur.getLength(), nP = Math.max(2, Math.round(len / (1.1 * k)));
  const pg = new THREE.CylinderGeometry(0.07 * k, 0.09 * k, h, 8), kg = new THREE.SphereGeometry(0.14 * k, 10, 8);
  for (let i = 0; i <= nP; i++) { const p = cur.getPointAt(Math.min(1, i / nP)); const po = new THREE.Mesh(pg, mat('altin')); po.position.set(p.x, y + h / 2, p.z); po.castShadow = true; grp.add(po);
    if (i % 3 === 0) { const kn = new THREE.Mesh(kg, mat('altin')); kn.position.set(p.x, y + h + 0.08 * k, p.z); grp.add(kn); } }
}
function flag(grp, x, y, z, h) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 8), mat('koyu')); pole.position.set(x, y + h / 2, z); pole.castShadow = true; grp.add(pole);
  const g = new THREE.PlaneGeometry(1.5, 1.1, 8, 1); g.translate(-0.75, 0, 0);
  const f = new THREE.Mesh(g, mat('bayrak')); f.position.set(x - 0.05, y + h - 0.6, z); f.castShadow = true; grp.add(f); grp.userData.flag = f;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat('altin')); top.position.set(x, y + h + 0.1, z); grp.add(top);
}
// ---------------- hedef ----------------
// T: bu bolumun hedefi. grp: gorunus (pozla birlikte tasinir), p/q: su anki poz. Fizikte hedef = platBody (statik, elle tasinir).
let T = null, TT = 0;
const SEFER = { sure: 2.6, yol: 64 };   // seyir: hedef bu kadar uzaktan yaklasir
const EXTRA = [];
function temizle() {
  if (T && T.grp) A.scene.remove(T.grp);
  for (const o of EXTRA) A.scene.remove(o); EXTRA.length = 0;
  T = null;
}
export function kur(Y, list) {
  temizle();
  const { S } = A, pb = A.platBody;
  A.setPlat('sirk'); A.LEG.visible = false; A.DIRT.visible = false;   // setPlat('sirk') direk yayini acar; sonra gizlenir
  // her platformun (0: alt guverte, 1: kabin catisi) kup sinirlari
  const inf = [0, 1].map(() => ({ i0: 1e9, i1: -1e9, k0: 1e9, k1: -1e9, n: 0 }));
  for (const c of list) { const f = inf[c[4] || 0]; f.n++; f.i0 = Math.min(f.i0, c[0]); f.i1 = Math.max(f.i1, c[0]); f.k0 = Math.min(f.k0, c[2]); f.k1 = Math.max(f.k1, c[2]); f.top = Math.max(f.top || 0, (c[1] + (A.KEEP[c[3]] === 'tall' ? 2 : 1)) * S); }
  for (const f of inf) if (f.n) { f.ci = (f.i0 + f.i1) / 2; f.ck = (f.k0 + f.k1) / 2; f.mx = (f.i1 - f.i0) / 2 * S + S / 2; f.mz = (f.k1 - f.k0) / 2 * S + S / 2; }
  while (pb.shapes.length) pb.removeShape(pb.shapes[0]);
  pb.position.set(0, 0, 0); pb.quaternion.set(0, 0, 0, 1); pb.velocity.set(0, 0, 0); pb.angularVelocity.set(0, 0, 0);
  const grp = new THREE.Group(); A.scene.add(grp);
  const t = { tip: Y.hedef, grp, p: new THREE.Vector3(), q: new THREE.Quaternion(), top: inf[0].top, batar: Y.hedef !== 'kule', patron: !!Y.patron };
  const BOX = (hx, hy, hz, x, y, z) => pb.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), new CANNON.Vec3(x, y, z));
  const f0 = inf[0], f1 = inf[1];
  if (KM[{ sal: 'sal', kule: 'kule_ada', gemi: 'dusman_gemi' }[Y.hedef]]) modelHedef(Y, t, f0, f1, BOX);
  else if (Y.hedef === 'sal') {
    // sal: suya yakin alcak tahta tabla (Adem'in ahsap platform modeli), en cok o sallanir
    A.GY = -1.7; const r = f0.mx + S * 0.6, rz = f0.mz + S * 0.55, GY = A.GY;
    BOX(r, -GY / 2, rz, 0, GY / 2, 0);
    if (A.MOD.platform_ahsap) {
      const m = A.MOD.platform_ahsap, g = m.geo.clone(); g.computeBoundingBox(); const b = g.boundingBox, s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
      g.translate(-c.x, -b.max.y, -c.z); g.scale(2 * r / s.x, 0.9 / s.y, 2 * rz / s.z);
      const me = new THREE.Mesh(g, m.mat); me.castShadow = me.receiveShadow = true; grp.add(me);
      // tablanin altinda birbirine bagli kutuklar (sal)
      const lg = new THREE.CylinderGeometry(0.42, 0.42, 2 * rz + 0.5, 12); lg.rotateX(Math.PI / 2);
      for (let x = -r + 0.45; x <= r - 0.4; x += 0.86) { const l = new THREE.Mesh(lg, mat('sal')); l.position.set(x, -1.25, 0); l.castShadow = true; grp.add(l); }
      for (const z of [-rz + 0.4, rz - 0.4]) { const ip = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 16), mat('ip')); ip.position.set(-r + 0.5, -1.2, z); ip.rotation.y = Math.PI / 2; grp.add(ip); }
    } else grp.add(deckMesh([[-r, -rz], [r, -rz], [r, rz], [-r, rz]], 0, 0.6, mat('tahta')));
    t.hx = r; t.hz = rz; t.dalga = { y: 0.16, roll: 0.05, pitch: 0.035, hz: 0.9 };
    t.ctr = (pn) => [f0.ci, f0.ck, 0, 0, 0];
    t.zemin = (x, z) => (Math.abs(x) < r && Math.abs(z) < rz ? 0 : null);
  } else if (Y.hedef === 'kule') {
    // gozcu kulesi adasi: kayalarla cevrili kum adacik, ortasinda tas kule, tepesinde duz tahta platform (yapi bunun ustunde)
    A.GY = -8.2; const GY = A.GY, rt = Math.max(f0.mx, f0.mz) * 1.02 + S * 0.45, rb = rt * 0.72, Ri = rt * 2.2;
    pb.addShape(new CANNON.Cylinder(rt, rt, 0.5, 24), new CANNON.Vec3(0, -0.25, 0));
    pb.addShape(new CANNON.Cylinder(rb * 0.92, rb * 1.12, -GY - 0.5, 16), new CANNON.Vec3(0, (GY - 0.5) / 2, 0));
    {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(rt, rt * 0.98, 0.5, 40), [mat('tahta'), mat('tahta'), mat('koyu')]); disc.position.y = -0.25; disc.castShadow = disc.receiveShadow = true; grp.add(disc);
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; const be = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 0.5), mat('koyu')); be.position.set(Math.cos(a) * rb * 1.02, -0.75, Math.sin(a) * rb * 1.02); be.rotation.y = -a; grp.add(be); }
      const prof = []; const H = -GY; for (let i = 0; i <= 10; i++) { const y = -H + i / 10 * (H - 0.5); prof.push(new THREE.Vector2(rb * (1.32 - 0.32 * i / 10), y)); }
      prof.push(new THREE.Vector2(0.01, -0.5));
      const tw = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), mat('tas')); tw.castShadow = tw.receiveShadow = true; grp.add(tw);
      mat('tas').map.repeat.set(4, 2.5); mat('tas').map.wrapS = mat('tas').map.wrapT = THREE.RepeatWrapping;
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), mat('tas')); m.position.set(Math.cos(a) * rb * 1.12, -1.15, Math.sin(a) * rb * 1.12); m.rotation.y = -a; m.castShadow = true; grp.add(m); }
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.9, 0.3), mat('koyu')); door.position.set(0, GY + 1.2, rb * 1.28); grp.add(door);
      const kap = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.16, 8, 16, Math.PI), mat('tas')); kap.position.set(0, GY + 2.1, rb * 1.3); grp.add(kap);
      const kum = new THREE.Mesh(new THREE.CylinderGeometry(Ri * 0.92, Ri, 0.5, 40), mat('kum')); kum.position.y = GY - 0.23; kum.receiveShadow = true; grp.add(kum);
      for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283 + (i % 3) * 0.05, s = 0.9 + ((i * 37) % 7) / 10; const k = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat('kaya')); k.position.set(Math.cos(a) * Ri * 1.02, GY + 0.1, Math.sin(a) * Ri * 1.02); k.rotation.set(i, i * 2, 0); k.scale.y = 0.7; k.castShadow = true; grp.add(k); }
      for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.4; const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat('cimen')); c.position.set(Math.cos(a) * rb * 1.6, GY + 0.35, Math.sin(a) * rb * 1.6); c.scale.y = 0.6; grp.add(c); }
      flag(grp, -rt + 0.35, 0, -rt * 0.5, 3.2);
    }
    t.hx = Ri; t.hz = Ri; t.dalga = null; t.ada = Ri;
    t.ctr = () => [f0.ci, f0.ck, 0, 0, 0];
    t.zemin = (x, z) => (x * x + z * z < rt * rt ? 0 : null);
  } else {
    // dusman korsan gemisi: boyu x ekseninde (burun solda), alt guverte y=0, kicta kabin; kabin catisi ikinci kat (y=hc)
    A.GY = t.patron ? -4.4 : -4; const GY = A.GY, k = t.patron ? 1.15 : 1;
    const hz = Math.max(2.3, Math.max(f0.mz, f1.n ? f1.mz : 0) + S * 0.45), Lm = f0.mx * 2 + S * 0.7, Lc = f1.n ? f1.mx * 2 + S * 0.7 : 3.2 * k, hc = f1.n ? 2.6 : 2.2, Lb = 3.4 * k;
    const xs = (Lm + Lc - Lb) / 2, xm = xs - Lc - Lm / 2, xc = xs - Lc / 2, xb = xm - Lm / 2 - Lb;   // kic, alt guverte ortasi, kabin ortasi, burun ucu
    BOX((Lm + Lb * 0.5) / 2, -GY / 2, hz, xm - Lb * 0.25, GY / 2, 0);
    BOX(Lc / 2, (hc - GY) / 2, hz, xc, (hc + GY) / 2, 0);
    {
      const out = [[xs, -hz], [xs, hz]]; for (let i = 0; i <= 8; i++) { const a = i / 8; const x = xm - Lm / 2 - Lb * (a ** 1.6), w = hz * Math.sqrt(1 - a * a * 0.98); out.push([x, w]); }
      for (let i = 8; i >= 0; i--) { const a = i / 8; const x = xm - Lm / 2 - Lb * (a ** 1.6), w = hz * Math.sqrt(1 - a * a * 0.98); out.push([x, -w]); }
      const pts = [[xs, -hz], [xs, hz]].concat(out.slice(2)).filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.01);
      grp.add(deckMesh(pts, 0, 0.3, mat('tahta')));
      grp.add(hullMesh(pts, [[0.55, 1], [0, 1.02], [-1.2, 0.98], [-2.6, 0.86], [GY - 1.6, 0.55]], xm, 0, mat(t.patron ? 'govde2' : 'govde')));
      // kabin
      const cab = new THREE.Mesh(new THREE.BoxGeometry(Lc, hc, hz * 2 - 0.1), [mat('kabin'), mat('kabin'), mat('tahta'), mat('koyu'), mat('kabin'), mat('kabin')]); cab.position.set(xc, hc / 2, 0); cab.castShadow = cab.receiveShadow = true; grp.add(cab);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(Lc + 0.3, 0.22, hz * 2 + 0.2), mat('tahta')); roof.position.set(xc, hc - 0.11, 0); roof.receiveShadow = true; grp.add(roof);
      // parmaklik: alt guverte kenarlari (kabine kadar) ve kabin catisi (on kenari acik)
      const side = (sg) => pts.filter((p) => p[1] * sg > 0.01 || p[0] === xb).filter((p) => p[0] < xs - Lc + 0.01).sort((a, b) => a[0] - b[0]);
      railing(grp, side(1).concat([[xs - Lc, hz]]), 0, 0.55, 1, false, true); railing(grp, side(-1).concat([[xs - Lc, -hz]]), 0, 0.55, 1, false, true);
      railing(grp, [[xs - Lc + 0.15, hz + 0.05], [xs + 0.1, hz + 0.05], [xs + 0.1, -hz - 0.05], [xs - Lc + 0.15, -hz - 0.05]], hc, 0.5, 1, false, false);
      // gemi toplari (sus) ve fener
      for (const sg of [1, -1]) for (const dx of [-0.25, 0.25]) { const gx = xm + dx * Lm; const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.3, 12), mat('koyu')); gun.rotation.x = Math.PI / 2 * sg; gun.position.set(gx, -1.25, sg * (hz * 1.03 + 0.45)); grp.add(gun); }
      flag(grp, xs - 0.35, hc, -hz + 0.35, t.patron ? 4.2 : 3.4);
    }
    t.hx = (xs - xb) / 2; t.hz = hz; t.dalga = t.patron ? { y: 0.1, roll: 0.022, pitch: 0.012, hz: 0.55 } : { y: 0.12, roll: 0.028, pitch: 0.015, hz: 0.7 };
    t.ctr = (pn) => (pn === 1 ? [f1.ci, f1.ck, xc, 0, hc] : [f0.ci, f0.ck, xm, 0, 0]);
    t.zemin = (x, z) => (Math.abs(z) > hz || x < xb || x > xs ? null : x > xs - Lc ? hc : 0);
    t.kx = [xb, xs]; t.hc = hc; if (f1.n) t.top = Math.max(t.top, hc + f1.top);
  }
  // su cizgisinde kopuk ve hafif golge (hedefle birlikte gider)
  t.cx = t.cx || 0; t.kopuk = suHalkasi(t.hx * 2.25, t.hz * 2.6); A.scene.add(t.kopuk); EXTRA.push(t.kopuk);
  T = t; A.TOPY = t.top; A.R = t.hx; A.RZ = t.hz;
  A.addCubes(Y, list, t.ctr);
}
// Adem'in modelleriyle hedef: model kupleri tasiyacak kadar buyutulur, kupler olculen guverte/cati/tepe uzerine oturur.
// Fizik govdeleri modelin olculen bolgelerinden kutu/silindir olarak kurulur. Yerel cerceve: alt guverte ortasi (0,0,0), ust yuzey y=0.
function modelHedef(Y, t, f0, f1, BOX) {
  const pb = A.platBody, S = A.S, grp = t.grp;
  if (Y.hedef === 'gemi') {
    const K = KAL.dusman_gemi, g = K.g, c = K.cati, gL = g.z[1] - g.z[0], cL = c.z[1] - c.z[0], gz = (g.z[0] + g.z[1]) / 2, cz = (c.z[0] + c.z[1]) / 2;
    let sc = Math.max((2 * f0.mx + 0.6) / gL, (2 * f0.mz + 0.5) / (2 * g.x), f1.n ? (2 * f1.mx + 0.35) / cL : 0, f1.n ? (2 * f1.mz + 0.35) / (2 * c.x) : 0);
    if (t.patron) sc *= 1.12;
    // burun +z -> dunyada -x (sola), kic kabini saga. dunya x = -(z - gz) * sc
    const X = (z) => -(z - gz) * sc, hc = (c.y - g.y) * sc, hb = (K.bas.y - g.y) * sc;
    A.GY = (K.su - g.y) * sc; const GY = A.GY;
    grp.add(yerlestir('dusman_gemi', sc, -Math.PI / 2, [0, g.y, gz], [0, 0, 0]));
    BOX((X(g.z[0]) - X(g.z[1])) / 2, -GY / 2 + 0.5, g.x * sc + 0.15, (X(g.z[0]) + X(g.z[1])) / 2, GY / 2 - 0.5, 0);
    BOX((X(-0.49) - X(c.z[1])) / 2, (hc - GY) / 2, c.x * sc + 0.2, (X(-0.49) + X(c.z[1])) / 2, (hc + GY) / 2, 0);
    BOX((X(K.bas.z[0]) - X(K.bas.z[1])) / 2, (hb - GY) / 2, 0.12 * sc, (X(K.bas.z[0]) + X(K.bas.z[1])) / 2, (hb + GY) / 2, 0);
    t.x0 = X(0.49); t.x1 = X(-0.49); t.hx = (t.x1 - t.x0) / 2; t.cx = (t.x0 + t.x1) / 2; t.hz = K.en * sc; t.hc = hc;
    t.dalga = t.patron ? { y: 0.1, roll: 0.02, pitch: 0.01, hz: 0.55 } : { y: 0.12, roll: 0.026, pitch: 0.013, hz: 0.7 };
    t.ctr = (pn) => (pn === 1 ? [f1.ci, f1.ck, X(cz), 0, hc] : [f0.ci, f0.ck, 0, 0, 0]);
    t.zemin = (x, z) => (Math.abs(z) > g.x * sc ? null : x > X(c.z[1]) ? hc : x < X(g.z[1]) ? hb : 0);
    t.kx = [t.x0, t.x1]; if (f1.n) t.top = Math.max(t.top, hc + f1.top);
  } else if (Y.hedef === 'kule') {
    const K = KAL.kule_ada, tp = K.tepe, sc = (Math.hypot(f0.mx, f0.mz) + 0.4) / tp.r;
    A.GY = (K.su - tp.y) * sc; const GY = A.GY, ky = (K.kum.y - tp.y) * sc, az = -tp.z * sc;   // ada merkezi kule tepesinin biraz onunde
    grp.add(yerlestir('kule_ada', sc, 0, [0, tp.y, tp.z], [0, 0, 0]));
    pb.addShape(new CANNON.Cylinder(tp.r * sc, tp.r * sc, 0.6, 24), new CANNON.Vec3(0, -0.3, 0));
    pb.addShape(new CANNON.Cylinder(K.kule * sc, K.kule * sc * 1.15, -0.6 - ky, 16), new CANNON.Vec3(0, (ky - 0.6) / 2, 0));
    pb.addShape(new CANNON.Cylinder(K.kum.r * sc * 0.92, K.kum.r * sc, ky - GY, 24), new CANNON.Vec3(0, (ky + GY) / 2, az));
    t.hx = t.hz = K.ada * sc; t.cz = az; t.ada = K.kum.r * sc; t.dalga = null;
    t.ctr = () => [f0.ci, f0.ck, 0, 0, 0];
    t.zemin = (x, z) => (x * x + z * z < (tp.r * sc) ** 2 ? 0 : x * x + (z - az) ** 2 < (K.kum.r * sc) ** 2 ? ky : null);
  } else {
    const K = KAL.sal, g = K.g, gL = g.x[1] - g.x[0], gx = (g.x[0] + g.x[1]) / 2, sc = Math.max((2 * f0.mx + 0.5) / gL, (2 * f0.mz + 0.5) / (2 * g.z));
    A.GY = (K.su - g.y) * sc; const GY = A.GY;
    grp.add(yerlestir('sal', sc, 0, [gx, g.y, 0], [0, 0, 0]));
    BOX(gL / 2 * sc, -GY / 2, g.z * sc, 0, GY / 2, 0);
    t.hx = (gL / 2 + 0.05) * sc; t.hz = (g.z + 0.05) * sc; t.dalga = { y: 0.16, roll: 0.045, pitch: 0.032, hz: 0.9 };
    t.ctr = () => [f0.ci, f0.ck, 0, 0, 0];
    t.zemin = (x, z) => (Math.abs(x) < gL / 2 * sc && Math.abs(z) < g.z * sc ? 0 : null);
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
  bg.style.backgroundImage = 'url(../korsan/kaynak/fon_' + Y.fon + '.webp?v=1)'; bg.style.backgroundSize = 'cover'; bg.style.backgroundPosition = '50% 50%';
  A.sun.color.set(fo.gunes); A.sun.intensity = fo.gi; A.rim.color.set(fo.rim);
  suYuzeyi().position.y = A.GY;
  const g = A.g; g.state = 'sefer'; g.sefer = 0; A.$('hint').style.opacity = 0;
  if (A.Q.has('demir') || (A.TEST && !A.Q.has('sefer'))) g.sefer = SEFER.sure;   // test: seyir atlanir
  fit(); poz(0);
  A.hud(true); altinHud();
}
export function zone(x, z) { return T && T.ada && (x - T.p.x) ** 2 + (z - T.p.z - (T.cz || 0)) ** 2 < (T.ada * 0.9) ** 2 ? 'kum' : 'su'; }
export function floorAt(x, z) {
  if (!T) return A.GY; const lx = x - T.p.x, lz = z - T.p.z, y = T.zemin(lx, lz); return y == null ? A.GY : y + T.p.y;
}
// hedefin pozu: seyir (uzaktan yaklasma), dalga (iner kalkar, yalpalar), batma
let QA, EU, VA;
function poz(dt) {
  const g = A.g; if (!T || !g) return;
  const s = g.state === 'sefer' ? Math.min(1, g.sefer / SEFER.sure) : 1, e = 1 - (1 - s) ** 3, uz = SEFER.yol * (1 - e);
  const d = T.dalga, w = TT * (d ? d.hz : 0) * 2;
  let y = d ? d.y * Math.sin(w) : 0, rx = d ? d.roll * Math.sin(w * 0.8 + 0.6) : 0, rz = d ? d.pitch * Math.sin(w * 0.6 + 1.7) : 0;
  if (T.bat != null) { const b = T.bat; y -= Math.min(b / 3.2, 1) ** 1.6 * (T.hz * 2 - A.GY + 6); rx += Math.min(b / 2.5, 1) * 0.45; rz -= Math.min(b / 3, 1) * 0.28; }
  const p = VA.set(0, y, -uz); EU.set(rx, 0, rz); QA.setFromEuler(EU);
  tasi(p, QA);
  T.kopuk.position.set(T.p.x + T.cx, A.GY + 0.02, T.p.z + (T.cz || 0)); T.kopuk.material.opacity = T.bat != null ? Math.max(0, 1 - T.bat) : 1;
  if (T.grp.userData.flag) T.grp.userData.flag.rotation.y = Math.sin(TT * 3.1) * 0.25;
}
// hedefi ve ustundeki (dusmemis) kupleri yeni poza tasir; uyuyan kupler uyanmaz, uyanik kuplerin hizi da doner
let DQ, QI, V3, Q3;
function tasi(p, q) {
  QI.copy(T.q).invert(); DQ.copy(q).multiply(QI);
  const pb = A.platBody;
  for (const c of A.cubes) {
    if (c.gone || c.out || c.landed) continue; const b = c.body;
    V3.set(b.position.x - T.p.x, b.position.y - T.p.y, b.position.z - T.p.z).applyQuaternion(DQ).add(p); b.position.set(V3.x, V3.y, V3.z);
    Q3.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w).premultiply(DQ); b.quaternion.set(Q3.x, Q3.y, Q3.z, Q3.w);
    V3.set(b.velocity.x, b.velocity.y, b.velocity.z).applyQuaternion(DQ); b.velocity.set(V3.x, V3.y, V3.z); b.aabbNeedsUpdate = true;
  }
  pb.position.set(p.x, p.y, p.z); pb.quaternion.set(q.x, q.y, q.z, q.w); pb.aabbNeedsUpdate = true;
  T.p.copy(p); T.q.copy(q); T.grp.position.copy(p); T.grp.quaternion.copy(q);
}
// her kare: seyir, dalga, batma, bizim geminin sallanmasi, dumen suyu
export function kare(dt) {
  TT += dt; const g = A.g;
  if (g && T) {
    if (g.state === 'sefer') { g.sefer += dt; A.$('hint').style.opacity = 0; if (g.sefer >= SEFER.sure) demirAt(); }
    if (g.state === 'win' && T.batar && T.bat == null) { T.bat = 0; batmaBasla(); }
    if (T.bat != null) { T.bat += dt; if (T.bat < 3 && Math.random() < dt * 22) A.bubble(T.p.x + (Math.random() - 0.5) * T.hx * 1.6, A.GY - 0.3, T.p.z + (Math.random() - 0.5) * T.hz); }
    poz(dt);
  }
  // bizim gemi: seyirde daha cok, demirdeyken hafif iner kalkar (ufuk resimde sabit oldugu icin sadece yukari asagi)
  if (BIZ.grp && A.cam.userData.base0) {
    const sef = g && g.state === 'sefer' ? 1 - Math.min(1, g.sefer / SEFER.sure) : 0;
    const dy = 0.07 * Math.sin(TT * 1.25) + sef * 0.09 * Math.sin(TT * 3.4);
    A.cam.userData.base.copy(A.cam.userData.base0).setY(A.cam.userData.base0.y + dy);
    BIZ.grp.position.y = dy; A.TC.holder.position.y = A.TC.by + dy;
    const bg = A.$('bg'); bg.style.transform = sef > 0 ? 'scale(' + (1 + 0.07 * sef * sef).toFixed(4) + ')' : '';
    if (sef > 0.05) dumenSuyu(dt, sef);
  }
}
function demirAt() {
  const g = A.g; g.state = 'play'; g.sefer = SEFER.sure; A.$('bg').style.transform = '';
  A.$('hint').style.opacity = 1;
  const at = [innerWidth / 2, innerHeight * 0.62]; A.floatText('⚓ Demir atıldı!', at[0], at[1], 'gold');
  if (A.AC) { A.sfx('metal'); setTimeout(() => A.sfx('metal'), 140); setTimeout(() => A.splashSnd(0.35), 380); }
  A.shake = Math.max(A.shake, 0.08);
}
function batmaBasla() {
  const p = T.p; A.splash(p.x - T.hx * 0.5, p.z + T.hz, 1.6, true); A.splash(p.x + T.hx * 0.4, p.z + T.hz, 1.3, true);
  if (A.AC) { A.splashSnd(0.6); setTimeout(() => A.sfx('thud', 3), 300); }
}
// seyirde bizim geminin iki yaninda akan kopuk
let DS = 0;
function dumenSuyu(dt, k) {
  DS += dt * 26 * k; if (!BIZ.w) return;
  while (DS > 1) { DS--;
    const sg = Math.random() < 0.5 ? -1 : 1, m = A.spr('#ffffff', false, 0.85), z0 = BIZ.tip + Math.random() * 2;
    m.position.set(sg * (BIZ.w * (0.35 + Math.random() * 0.4)), A.GY + 0.1, z0); const s0 = 0.5 + Math.random() * 0.8, vx = sg * (1.5 + Math.random() * 2);
    A.fx(m, 1.1, (o, kk, dd) => { o.position.z += 26 * dd; o.position.x += vx * dd; o.scale.set(s0 * (1 + kk * 2), s0 * 0.55 * (1 + kk), 1); o.material.opacity = 0.85 * (1 - kk); });
  }
}

// ---------------- kamera ve bizim gemi ----------------
// Kamera geminin arkasindan, guverte hizasinin biraz ustunden bakar. Egim, fondaki ufuk cizgisini 3B ufukla cakistirir
// (boylece hedefin su cizgisi resimdeki denize oturur). Hedef ekrani dolduracak kadar yakin; top arabasi altta, altin platformda.
const BIZ = { grp: null };
export function fit() {
  const { cam, ren, TC } = A, W = innerWidth, H = innerHeight; ren.setSize(W, H, false); cam.aspect = W / H;
  cam.fov = Math.max(42, Math.min(92, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(52 * Math.PI / 360) / cam.aspect)))); cam.updateProjectionMatrix();
  const th = Math.tan(cam.fov * Math.PI / 360), thx = th * cam.aspect;
  const Y = bolum(A.LV), fo = FON[Y.fon];
  // resim ekrani 'cover' ile kaplar: ufkun ekrandaki yeri
  const ih = Math.max(H, W / IMG_AR), fh = (fo.h * ih - (ih - H) / 2) / H, yh = 1 - 2 * fh, pitch = Math.atan(yh * th);
  const dir = new THREE.Vector3(0, -Math.sin(pitch), -Math.cos(pitch)), V = new THREE.Vector3();
  const t = T || { hx: 6, hz: 3, top: 7 }, GY = A.GY;
  const x0 = t.x0 != null ? t.x0 : -t.hx, x1 = t.x1 != null ? t.x1 : t.hx, cz = t.cz || 0;
  const tops = [[x0, t.top, -t.hz], [x1, t.top, -t.hz], [x0, t.top, t.hz], [x1, t.top, t.hz]];
  const hull = [[x0, GY, cz + t.hz], [x1, GY, cz + t.hz], [x0 * 0.9, 0, t.hz], [x1 * 0.9, 0, t.hz]], su = [[(x0 + x1) / 2, GY, cz + t.hz * 1.1]];
  const nd = (p) => V.set(p[0], p[1], p[2]).project(cam);
  // iki gecis: once kamera yuksekligi tahmin edilir, top arabasinin kameraya gore ne kadar asagida kaldigi olculur;
  // sonra kamera, bizim guverte denizden ~2.4 birim yukarida olacak sekilde ayarlanir (gemi suya batik gorunmesin)
  let camY = 1.5, d = 12, deck = 0;
  for (let pass = 0; pass < 2; pass++) {
    const place = (dd) => { cam.position.set(0, camY, dd); cam.lookAt(V.set(0, camY, dd).add(dir)); cam.updateMatrixWorld(true); };
    for (d = 14; d < 160; d += 0.25) { place(d); const top = Math.max(...tops.map((p) => nd(p).y)), side = Math.max(...tops.concat(hull).map((p) => Math.abs(nd(p).x))), bot = nd(su[0]).y; if (top < 0.62 && side < 0.95 && bot > -0.3) break; }   // hedefin su cizgisi bizim burnun ustunde kalsin
    place(d);
    if (!TC.gun) break;
    // top arabasi: kameranin ~6 birim onunde (Adem'in gemisinde ~4: kamera kic kasarasinin icinde kalmasin), ekran genisliginin %38'i, namlu alttan %22'de
    const dc = DC(), k = (0.38 * 2 * dc * thx) / TC.w0; TC.holder.scale.setScalar(k); TC.k = k;
    let lo = camY - 40, hi = camY;
    for (let it = 0; it < 30; it++) { const by = (lo + hi) / 2; TC.holder.position.set(0, by, d - dc); TC.holder.rotation.y = Math.PI; TC.holder.updateMatrixWorld(true); const m = A.trunkTip(V); if (m.project(cam).y > -0.56) hi = by; else lo = by; }
    TC.by = (lo + hi) / 2; TC.holder.position.y = TC.by; deck = KM.bizim_gemi ? TC.by : TC.by - 0.32 * k;
    if (pass === 0) camY += GY + (KM.bizim_gemi ? (KAL.bizim_gemi.plat.y - KAL.bizim_gemi.su) * bizSc(dc * thx) : 2.4) - deck;
  }
  cam.userData.base = cam.position.clone(); cam.userData.base0 = cam.position.clone();
  if (TC.gun) {
    const k = TC.k, dc = DC();
    // Adem'in gemisinde top arabasi modeldeki altin platforma oturur (kodla cizilen kaide gizli)
    for (const o of TC.holder.children) o.visible = !KM.bizim_gemi || o === TC.gun;
    // altin yuvarlak platform: kaide kisa ve altin (Yapi'daki uzun krem kaide yerine)
    TC.pad.scale.y = 0.32; TC.pad.position.y = -0.16; TC.rim2.position.y = -0.2; TC.pad.material.color.set('#e7b43c'); TC.pad.material.metalness = 0.55; TC.pad.material.roughness = 0.3;
    bizimGemi(deck, d - dc, dc * thx, k, d);
  }
}
const DC = () => (KM.bizim_gemi ? 4.1 : 6.2);
// Adem'in gemisinin olcegi: altin platform top arabasinin tekerleklerini tasiyacak, kic kasarasi kameranin arkasinda kalacak kadar
function bizSc(hw) { const K = KAL.bizim_gemi; return Math.max(hw * 1.15 / K.en, (DC() + 1.1) / (K.plat.z - K.kic)); }
function bizimGemi(dy, zc, hw, k, camZ) {
  if (BIZ.grp) { A.scene.remove(BIZ.grp); BIZ.grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  const grp = new THREE.Group(); BIZ.grp = grp; A.scene.add(grp);
  const W = hw * 1.02, tip = zc - Math.max(4.5, hw * 1.25), back = camZ + 6;
  BIZ.w = W; BIZ.tip = tip;
  if (KM.bizim_gemi) {   // burun -z'ye (hedefe) doner; altin platformun merkezi top arabasinin altinda
    const K = KAL.bizim_gemi, sc = bizSc(hw); grp.add(yerlestir('bizim_gemi', sc, Math.PI, [0, K.plat.y, K.plat.z], [0, dy, zc]));
    BIZ.w = K.en * sc; BIZ.tip = zc - (K.bas - K.plat.z) * sc; return; }
  const half = []; for (let i = 0; i <= 10; i++) { const a = i / 10, z = zc + 0.6 - (zc + 0.6 - tip) * a; half.push([W * Math.sqrt(Math.max(0, 1 - a ** 2.2)), z]); }
  const side = [[W, back]].concat(half);
  const pts = side.concat(side.slice(0, -1).reverse().map(([x, z]) => [-x, z]));
  grp.add(deckMesh(pts, dy, 0.35, mat('tahta')));
  grp.add(hullMesh(pts, [[dy + 0.95 * k, 1], [dy, 1.03], [A.GY - 1, 0.86]], 0, zc, mat('bizim')));
  railing(grp, side, dy, 0.95 * k, k, false, true); railing(grp, side.map(([x, z]) => [-x, z]), dy, 0.95 * k, k, false, true);
  // burunda altin kaplama ve ip kangali (resimdeki gibi)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.32 * k, 14, 10), mat('altin')); nose.position.set(0, dy + 1.1 * k, tip + 0.15); grp.add(nose);
  for (const sg of [-1, 1]) { const ip = new THREE.Mesh(new THREE.TorusGeometry(0.42 * k, 0.13 * k, 8, 20), mat('ip')); ip.rotation.x = Math.PI / 2; ip.position.set(sg * W * 0.62, dy + 0.13 * k, zc + 0.8); ip.castShadow = true; grp.add(ip); }
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
  // altin sayaci: yildizlardan sonra tek tek sayarak eklenir
  let n = 0; const step = Math.max(1, Math.round(kaz / 24));
  setTimeout(function say() { n = Math.min(kaz, n + step); const a = A.$('kz'), b = A.$('ks'); if (!a) return; a.textContent = '+' + n; b.textContent = once + n; if (A.AC) A.sfx('tik');
    if (n < kaz) setTimeout(say, 45); else { a.parentNode.classList.add('pop'); altinHud(); } }, 900);
  const sd = A.$('sdk'); if (sd) sd.onclick = () => { if (sd.classList.contains('acik')) return; sd.classList.add('acik'); const ek = 100; SV.altin += ek; A.save(); A.sfx('win');
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
  let nodes = ''; DURAK.forEach(([x, y], i) => { const L = b0 + i + 1, done = !!yil[L] && L !== to, cur = L === (salt ? from : to), boss = i === BOLGE - 1, pilot = i >= BOLUMLER.length;
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
