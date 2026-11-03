// BLOKPOP Yapi v2 (prototip) - 3B gorunum. Duz zemin, ortada platform ustunde ust uste kupler, etrafinda kare yol.
// Kurallar motor.js'te (window.YPM); burasi cizim ve dokunma.
import * as THREE from '../three.module.min.js';
const YPM = window.YPM;
// ---------------- sahne ----------------
const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search), TEST = Q.has('test');
const SKEY = 'blokpop_yapi_v2';
let SV = { L: 1, max: 1, mute: false };
try { const d = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (d) SV = Object.assign(SV, d); } catch (e) {}
const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(SV)); } catch (e) {} };
const glc = $('gl');
const ren = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: TEST });
ren.outputColorSpace = THREE.SRGBColorSpace; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.0;
ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(40, 1, 0.3, 400);
// gok: dikey gecis + uzak dunya resmi (kartpostal gibi)
scene.background = canvasTex(4, 256, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5fb8ff'); gr.addColorStop(0.55, '#bfe6ff'); gr.addColorStop(1, '#fff3d6'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
scene.fog = new THREE.Fog('#d8efff', 60, 160);
{ const h = new THREE.HemisphereLight(0xeaf6ff, 0x6a8a3a, 0.75); scene.add(h); }
const sun = new THREE.DirectionalLight(0xfff0d6, 2.3); sun.position.set(-8, 16, 10); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 2, far: 50 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun); scene.add(sun.target);
const fill = new THREE.DirectionalLight(0xdfeaff, 0.5); fill.position.set(8, 6, 12); scene.add(fill);
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }

// duz zemin (cimen), uzak manzara
const GRASS = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#7ccf4a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(30,90,10,.08)'; const s = 2 + Math.random() * 6; x.fillRect(Math.random() * w, Math.random() * h, s, s * 0.5); } }, [120, 120]);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: GRASS, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const farImg = new Image(), farTex = new THREE.Texture(farImg); farTex.colorSpace = THREE.SRGBColorSpace; farTex.repeat.set(1, 0.314); farTex.offset.set(0, 0.5); farImg.onload = () => { farTex.needsUpdate = true; };
const far = new THREE.Mesh(new THREE.PlaneGeometry(260, 146), new THREE.MeshBasicMaterial({ map: farTex, fog: false, toneMapped: false })); far.position.set(0, 40, -150); scene.add(far);

// ---------------- malzemeler ----------------
function crateDraw(x, w, h) { x.fillStyle = '#f4f4f4'; x.fillRect(0, 0, w, h); const b = w * 0.1;
  x.fillStyle = '#c9c9c9'; x.fillRect(0, 0, w, b); x.fillRect(0, h - b, w, b); x.fillRect(0, 0, b, h); x.fillRect(w - b, 0, b, h);
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = w * 0.025; x.strokeRect(b, b, w - 2 * b, h - 2 * b);
  x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(b * 1.2, b * 1.2, w - 2.4 * b, w * 0.05);
  x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); const cx = w / 2, cy = h * 0.55, s = w * 0.17;  // kale emblemi
  x.moveTo(cx - s, cy + s); x.lineTo(cx - s, cy - s * 0.6); x.lineTo(cx - s * 0.6, cy - s * 0.6); x.lineTo(cx - s * 0.6, cy - s); x.lineTo(cx - s * 0.2, cy - s); x.lineTo(cx - s * 0.2, cy - s * 0.6);
  x.lineTo(cx + s * 0.2, cy - s * 0.6); x.lineTo(cx + s * 0.2, cy - s); x.lineTo(cx + s * 0.6, cy - s); x.lineTo(cx + s * 0.6, cy - s * 0.6); x.lineTo(cx + s, cy - s * 0.6); x.lineTo(cx + s, cy + s); x.closePath(); x.fill();
  x.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 4; i++) x.fillRect(b * 1.1 + i * (w - 2.2 * b) / 4, h - b * 1.2, (w - 2.2 * b) / 8, b * 0.25); }
const CRATETX = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; crateDraw(c.getContext('2d'), 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();

const MAT = {
  crate: new THREE.MeshStandardMaterial({ map: CRATETX, roughness: 0.45 }),
  plat: new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#e9dcc4'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,90,50,.35)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.stroke(); } }, [2, 2]), roughness: 0.8 }),
  side: new THREE.MeshStandardMaterial({ map: canvasTex(256, 32, (x, w, h) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#e8323c'; x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16 + 16, 0); x.lineTo(i * 16 + 8, h); x.lineTo(i * 16 - 8, h); x.closePath(); x.fill(); } }, [2, 1]), roughness: 0.6 }),
  road: new THREE.MeshStandardMaterial({ color: '#4a4f5c', roughness: 0.85 }),
  curb: new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.6 })
};
function roundedCube(s) { return roundBox(s, s, s, s * 0.14, 3); }

// ---------------- oyun durumu ----------------
let g = null, LV = 1, F = 6;
const world = new THREE.Group(); scene.add(world);
let cubeMesh = null, platG = null, trackG = null;
const S = 1, PLAT_H = 0.5;
const DEB = [], SHOTS = new Map(), FALL = {};   // dusme: hucre -> {off, v}
const pofis = new Map();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const cellXZ = (i) => ({ x: (i % F) - F / 2 + 0.5, z: Math.floor(i / F) - F / 2 + 0.5 });
const cubeY = (k) => PLAT_H + (k + 0.5) * S;

function buildLevel() {
  [cubeMesh, platG, trackG].forEach((o) => { if (o) world.remove(o); });
  DEB.forEach((d) => world.remove(d.m)); DEB.length = 0; for (const [, o] of SHOTS) world.remove(o.m); SHOTS.clear();
  for (const [, p] of pofis) world.remove(p.holder); pofis.clear();
  for (const k in FALL) delete FALL[k];
  F = g.F;
  farImg.src = '../bg/w' + ('0' + (((LV + 3) % 20) + 1)).slice(-2) + '.webp';
  // platform: duz zemine oturan alcak kaide
  platG = new THREE.Group();
  const pw = F + 0.5, top = new THREE.Mesh(new THREE.BoxGeometry(pw, PLAT_H, pw), [MAT.side, MAT.side, MAT.plat, MAT.plat, MAT.side, MAT.side]);
  top.position.y = PLAT_H / 2; top.castShadow = true; top.receiveShadow = true; platG.add(top);
  world.add(platG);
  // yol: platformun etrafinda kare serit, sari kenar cizgisi ve oklar
  trackG = new THREE.Group(); const h = F / 2 + YPM.M, W = 0.9;
  const road = new THREE.Shape(); const o = h + W / 2, i0 = h - W / 2;
  road.moveTo(-o, -o); road.lineTo(o, -o); road.lineTo(o, o); road.lineTo(-o, o); road.lineTo(-o, -o);
  const hole = new THREE.Path(); hole.moveTo(-i0, -i0); hole.lineTo(-i0, i0); hole.lineTo(i0, i0); hole.lineTo(i0, -i0); hole.lineTo(-i0, -i0); road.holes.push(hole);
  const rm = new THREE.Mesh(new THREE.ShapeGeometry(road), MAT.road); rm.rotation.x = -Math.PI / 2; rm.position.y = 0.02; rm.receiveShadow = true; trackG.add(rm);
  const arrowG = new THREE.ShapeGeometry((() => { const a = new THREE.Shape(); a.moveTo(-0.14, -0.12); a.lineTo(0.12, 0); a.lineTo(-0.14, 0.12); a.lineTo(-0.06, 0); a.lineTo(-0.14, -0.12); return a; })());
  const am = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 });
  for (let d = 0.5; d < g.LAP; d += 1.0) { const p = YPM.trackPos(g, d), m = new THREE.Mesh(arrowG, am); m.rotation.x = -Math.PI / 2; m.rotation.z = -[0, Math.PI / 2, Math.PI, -Math.PI / 2][p.side]; m.position.set(p.x, 0.03, p.z); trackG.add(m); }
  // giris kapisi (Pofi'ler buradan yola cikar)
  const gate = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 10, 24, Math.PI), MAT.curb); const p0 = YPM.trackPos(g, 0.01); gate.position.set(p0.x, 0, p0.z); gate.castShadow = true; trackG.add(gate);
  world.add(trackG);
  // kupler: her hucrede en fazla 8 kat -> instanced
  const n = F * F * 8;
  cubeMesh = new THREE.InstancedMesh(roundedCube(S * 0.96), MAT.crate, n); cubeMesh.castShadow = true; cubeMesh.receiveShadow = true;
  cubeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); for (let k = 0; k < n; k++) cubeMesh.setColorAt(k, _c.set('#ffffff'));
  world.add(cubeMesh);
  fit(); dirty = true;
}
let dirty = true;
function updateCubes(dt) {
  let k = 0, moving = false;
  for (let i = 0; i < F * F; i++) {
    const x = g.cells[i], p = cellXZ(i), f = FALL[i];
    let off = 0; if (f) { f.v += 22 * dt; f.off = Math.max(0, f.off - f.v * dt); off = f.off; if (f.off <= 0) delete FALL[i]; else moving = true; }
    for (let y = 0; y < x.st.length && y < 8; y++) {
      const claimed = y < x.pend, bob = claimed ? 0.96 : 1;
      _v.set(p.x, cubeY(y) + off, p.z); _s.setScalar(bob); _m.compose(_v, _q.identity(), _s); cubeMesh.setMatrixAt(k, _m);
      _c.set(g.pal[x.st[y]]); if (y === x.pend) _c.multiplyScalar(1.08); cubeMesh.setColorAt(k, _c); k++;
    }
  }
  for (; k < cubeMesh.count; k++) { _s.setScalar(0); _m.compose(_v.set(0, -5, 0), _q, _s); cubeMesh.setMatrixAt(k, _m); }
  cubeMesh.instanceMatrix.needsUpdate = true; if (cubeMesh.instanceColor) cubeMesh.instanceColor.needsUpdate = true;
  for (let n = DEB.length - 1; n >= 0; n--) { const d = DEB[n]; d.t += dt; d.v.y -= 20 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.w.x * dt; d.m.rotation.z += d.w.z * dt;
    if (d.m.position.y < 0.5) { d.m.position.y = 0.5; d.v.y = Math.abs(d.v.y) * 0.35; d.v.x *= 0.7; d.v.z *= 0.7; }
    const f = d.t > 1.1 ? Math.max(0, 1 - (d.t - 1.1) / 0.4) : 1; d.m.scale.setScalar(f); if (d.t > 1.5) { world.remove(d.m); DEB.splice(n, 1); } else moving = true; }
  dirty = moving;
}
function crateDebris(i, col) {
  const p = cellXZ(i), m = new THREE.Mesh(roundedCube(S * 0.96), new THREE.MeshStandardMaterial({ map: CRATETX, color: g.pal[col], roughness: 0.45 }));
  m.position.set(p.x, cubeY(0), p.z); m.castShadow = true; world.add(m);
  // disari dogru (atisin geldigi yone) firlar
  const dx = p.x === 0 ? 1 : Math.sign(p.x), dz = p.z === 0 ? 1 : Math.sign(p.z), sd = Math.random() < 0.5 ? -1 : 1;
  DEB.push({ m, t: 0, v: new THREE.Vector3(dx * (1.5 + Math.random() * 2) + sd * 0.5, 5 + Math.random() * 3, dz * (1.5 + Math.random() * 2)), w: new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12) });
}

// ---------------- Pofi ----------------
const KS = 1;
function roundBox(w, h, d, r, seg) {
  const g0 = new THREE.BoxGeometry(w, h, d, seg, seg, seg), p = g0.attributes.position, nr = g0.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3();
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r, cl = (x, a) => Math.max(-a, Math.min(a, x));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); c.set(cl(v.x, hw), cl(v.y, hh), cl(v.z, hd)); v.sub(c);
    const L = v.length(); if (L > 1e-6) v.multiplyScalar(1 / L); nr.setXYZ(i, v.x, v.y, v.z);
    p.setXYZ(i, c.x + v.x * r, c.y + v.y * r, c.z + v.z * r);
  }
  return g0;
}
// yumusak kosel plaka (kulak): buyuk koseli dikdortgen, kenarlari bombeli
function softPlate(w, h, r, d) {
  const x0 = -w / 2, y0 = -h / 2, sh = new THREE.Shape();
  sh.moveTo(x0 + r, y0); sh.lineTo(x0 + w - r, y0); sh.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r); sh.lineTo(x0 + w, y0 + h - r); sh.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  sh.lineTo(x0 + r, y0 + h); sh.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r); sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0);
  const bev = d * 0.45, geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.005, d - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 3, curveSegments: 6 });
  geo.translate(0, 0, -(d - 2 * bev) / 2); geo.computeVertexNormals(); return geo;
}
// govde rengi: ustu acik, alti hafif koyu-mor (gorseldeki plastik gecis)
function gradColors(geo, y0, y1) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const t = Math.max(0, Math.min(1, (p.getY(i) - y0) / (y1 - y0))); col[i * 3] = 0.84 + 0.2 * t; col[i * 3 + 1] = 0.84 + 0.22 * t; col[i * 3 + 2] = 0.95 + 0.12 * t; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
}
const KG = (() => {
  const body = gradColors(roundBox(1, 1, 1.02, 0.2, 6), -0.5, 0.5);
  const ear = softPlate(0.5, 0.68, 0.22, 0.1), earIn = softPlate(0.32, 0.48, 0.14, 0.03);
  const leg = new THREE.CylinderGeometry(0.15, 0.16, 0.34, 18), nail = new THREE.SphereGeometry(0.045, 10, 8);
  const seg = new THREE.CylinderGeometry(0.115, 0.125, 0.2, 18); seg.rotateX(Math.PI / 2); seg.translate(0, 0, 0.1);
  const joint = new THREE.SphereGeometry(0.12, 16, 12), lip = new THREE.TorusGeometry(0.105, 0.035, 10, 22), hole = new THREE.CircleGeometry(0.085, 18);
  const tail = new THREE.TubeGeometry(new THREE.CubicBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.02, -0.08, -0.12), new THREE.Vector3(0.06, -0.24, -0.1), new THREE.Vector3(0.05, -0.36, -0.16)), 12, 0.03, 8);
  const tuft = new THREE.SphereGeometry(0.07, 12, 10); tuft.scale(0.8, 1.4, 0.8);
  const eye = new THREE.SphereGeometry(0.075, 16, 12); eye.scale(1, 1.15, 0.45);
  const shine = new THREE.SphereGeometry(0.022, 8, 6), brow = roundBox(0.2, 0.055, 0.05, 0.022, 2), blush = new THREE.CircleGeometry(0.075, 18);
  return { body, ear, earIn, leg, nail, seg, joint, lip, hole, tail, tuft, eye, shine, brow, blush };
})();
const KM = {
  eye: new THREE.MeshStandardMaterial({ color: '#241c30', roughness: 0.15, metalness: 0.1 }), shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  hole: new THREE.MeshBasicMaterial({ color: '#1a2236' }), blush: new THREE.MeshBasicMaterial({ color: '#ff8fb0', transparent: true, opacity: 0.45, depthWrite: false })
};
const KMC = {};   // renk -> malzemeler
function kupMats(col) {
  if (KMC[col]) return KMC[col];
  const c = new THREE.Color(col);
  return (KMC[col] = {
    grad: new THREE.MeshStandardMaterial({ color: c, vertexColors: true, roughness: 0.38, metalness: 0 }),
    body: new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.96), roughness: 0.4 }),
    inner: new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.72), roughness: 0.55 }),
    nail: new THREE.MeshStandardMaterial({ color: c.clone().lerp(new THREE.Color('#ffffff'), 0.55), roughness: 0.5 }),
    brow: new THREE.MeshStandardMaterial({ color: c.clone().lerp(new THREE.Color('#2a3446'), 0.6), roughness: 0.5 })
  });
}
function kupPofi() {
  const holder = new THREE.Group(), root = new THREE.Group(); holder.add(root);
  const fig = new THREE.Group(); fig.scale.setScalar(KS); root.add(fig);
  const LEG = 0.3, BY = LEG + 0.5, parts = { grad: [], body: [], inner: [], nail: [], brow: [] };
  const add = (geo, kind, mat) => { const m = new THREE.Mesh(geo, mat || null); if (kind) parts[kind].push(m); m.castShadow = false; return m; };
  const body = add(KG.body, 'grad'); body.position.y = BY; fig.add(body);
  [-1, 1].forEach((sd) => {
    const e = new THREE.Group(); e.position.set(sd * 0.7, BY + 0.12, 0.02); e.rotation.set(0, sd * 0.3, sd * -0.1); fig.add(e);
    e.add(add(KG.ear, 'body')); const ei = add(KG.earIn, 'inner'); ei.position.set(sd * 0.02, -0.03, 0.05); e.add(ei);
    [-1, 1].forEach((fb) => {
      const l = add(KG.leg, 'body'); l.position.set(sd * 0.27, LEG / 2, fb * 0.27); fig.add(l);
      if (fb > 0) for (let n = -1; n <= 1; n++) { const t = add(KG.nail, 'nail'); t.scale.set(1, 0.8, 0.5); t.position.set(sd * 0.27 + n * 0.07, 0.05, 0.27 + 0.145); fig.add(t); }
    });
    const ey = new THREE.Mesh(KG.eye, KM.eye); ey.position.set(sd * 0.2, BY + 0.1, 0.505); fig.add(ey);
    const sh = new THREE.Mesh(KG.shine, KM.shine); sh.position.set(sd * 0.2 + 0.025, BY + 0.135, 0.535); fig.add(sh);
    const br = add(KG.brow, 'brow'); br.position.set(sd * 0.2, BY + 0.24, 0.52); br.rotation.z = sd * -0.38; fig.add(br);
    const bl = new THREE.Mesh(KG.blush, KM.blush); bl.position.set(sd * 0.3, BY - 0.06, 0.513); fig.add(bl);
  });
  // hortum: 3 parca, her eklem x ekseninde kivrilir
  const segs = []; let par = fig;
  const base = new THREE.Group(); base.position.set(0, BY - 0.04, 0.47); fig.add(base); par = base;
  for (let i = 0; i < 3; i++) { const sg = new THREE.Group(); if (i) sg.position.z = 0.19; par.add(sg); sg.add(add(KG.joint, 'body')); sg.add(add(KG.seg, 'body')); segs.push(sg); par = sg; }
  const tip = new THREE.Group(); tip.position.z = 0.2; par.add(tip);
  const lip = add(KG.lip, 'body'); tip.add(lip); const hole = new THREE.Mesh(KG.hole, KM.hole); hole.position.z = 0.012; tip.add(hole);
  // kuyruk
  const tl = new THREE.Group(); tl.position.set(0, BY - 0.12, -0.5); fig.add(tl); tl.add(add(KG.tail, 'body')); const tf = add(KG.tuft, 'inner'); tf.position.set(0.05, -0.4, -0.17); tl.add(tf);
  const head = new THREE.Object3D(); head.position.set(0, BY + 0.05, -0.15); fig.add(head);
  const t1 = new THREE.Object3D(); segs[2].add(t1);
  return { holder, root, b: { Head: head, Trunk1: t1, Trunk2: tip }, segs, parts, kup: true, col: null };
}
function kupColor(o, col) { const m = kupMats(col); for (const k in o.parts) for (const x of o.parts[k]) x.material = m[k]; o.col = col; }

const BLOB = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
function pofiMesh(col) { const o = kupPofi(); kupColor(o, col); o.holder.scale.setScalar(0.85); const b = BLOB.clone(); b.rotation.x = -Math.PI / 2; b.position.y = 0.03; o.holder.add(b); o.holder.traverse((x) => { if (x.isMesh && x !== b) x.castShadow = true; }); return o; }
function pofiFor(s) { let p = pofis.get(s); if (!p) { p = pofiMesh(g.pal[s.c]); pofis.set(s, p); world.add(p.holder); } return p; }
function updatePofis(dt) {
  for (const s of g.belt) {
    const p = pofiFor(s), tp = YPM.trackPos(g, s.d), ent = Math.min(1, s.d / 0.8);
    p.holder.position.set(tp.x, Math.abs(Math.sin(g.t * 12 + s.id)) * 0.08, tp.z);
    p.holder.rotation.y = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][tp.side];   // yuzu platforma donuk
    p.holder.scale.setScalar(0.85 * (0.4 + 0.6 * ent));
    const rec = s.fireT != null ? Math.max(0, 1 - (g.t - s.fireT) / 0.18) : 0; p.root.position.z = -rec * 0.12;
    p.seen = g.t;
  }
  for (const [s, p] of pofis) if (p.seen !== g.t) { world.remove(p.holder); pofis.delete(s); }
}

// ---------------- atislar ----------------
const SHOT_GEO = new THREE.SphereGeometry(0.14, 12, 10);
function updateShots() {
  for (const sh of g.shots) {
    let o = SHOTS.get(sh); if (!o) { const p = YPM.trackPos(g, sh.s.d); o = { m: new THREE.Mesh(SHOT_GEO, new THREE.MeshBasicMaterial({ color: g.pal[sh.c] })), from: new THREE.Vector3(p.x, 0.75, p.z) }; SHOTS.set(sh, o); world.add(o.m); }
    const q = cellXZ(sh.i), k = Math.min(1, sh.t / 0.2), to = new THREE.Vector3(q.x, cubeY(0), q.z);
    o.m.position.lerpVectors(o.from, to, k); o.m.position.y += Math.sin(k * Math.PI) * 0.6; o.seen = 1;
  }
  for (const [sh, o] of SHOTS) { if (g.shots.indexOf(sh) < 0) { world.remove(o.m); SHOTS.delete(sh); } }
}

// ---------------- kamera ----------------
function fit() {
  const W = innerWidth, H = innerHeight; ren.setPixelRatio(Math.min(2, devicePixelRatio || 1)); ren.setSize(W, H, false);
  cam.aspect = W / H;
  const h = F / 2 + YPM.M + 0.6, ang = (+Q.get('ang') || 16) * Math.PI / 180;   // yolun disi ekrana sigsin
  const vf = cam.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
  const dist = h * 1.02 / Math.tan(hf / 2) + h;
  const cy = 2.2;
  cam.position.set(0, cy + Math.sin(ang) * dist, Math.cos(ang) * dist); cam.lookAt(0, cy, 0);
  // alt panel icin sahneyi biraz yukari al
  cam.setViewOffset(W, H, 0, H * 0.05, W, H); cam.updateProjectionMatrix();
}
addEventListener('resize', () => { fit(); });

// ---------------- arayuz ----------------
function hud() {
  $('nm').textContent = g.lv.ad; $('lv').textContent = 'Yapı ' + LV;
  $('pb').style.width = Math.round(100 * (1 - g.left / g.total)) + '%';
  const qh = [0, 1, 2, 3].map((k) => { const c = g.queue[k]; return '<button class="qc" data-q="' + k + '">' + c.slice(0, 3).map((s, j) => '<i class="pf' + (j ? ' bk' : '') + '" style="--c:' + g.pal[s.c] + '"><b>' + s.ammo + '</b></i>').join('') + (c.length > 3 ? '<em>+' + (c.length - 3) + '</em>' : '') + '</button>'; }).join('');
  $('qs').innerHTML = qh;
  $('bn').innerHTML = g.bench.map((s, k) => '<button class="bs" data-b="' + k + '">' + (s ? '<i class="pf" style="--c:' + g.pal[s.c] + '"><b>' + s.ammo + '</b></i>' : '') + '</button>').join('');
}
function tap(e) { const q = e.target.closest('[data-q]'), b = e.target.closest('[data-b]'); if (!g || g.state !== 'play') return;
  let ok = false; if (q) ok = YPM.launch(g, 'q', +q.dataset.q); else if (b) ok = YPM.launch(g, 'b', +b.dataset.b); else return;
  if (!ok) { toast(g.belt.length >= YPM.MAX_BELT ? 'Yol dolu!' : 'Biraz bekle'); } hud(); }
$('qs').addEventListener('pointerdown', tap); $('bn').addEventListener('pointerdown', tap);
let tt = 0; function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 900); }
function modal(h) { $('card').innerHTML = h; $('modal').classList.add('on'); }
function closeModal() { $('modal').classList.remove('on'); }
$('re').onclick = () => start(LV);
$('home').onclick = () => { location.href = '../'; };
$('prev').onclick = () => start(Math.max(1, LV - 1)); $('next').onclick = () => start(LV + 1);

// ---------------- dongu ----------------
let combo = 0, lastHit = -9, shake = 0;
function events() {
  for (const e of g.ev) {
    if (e.t === 'fire') e.s.fireT = g.t;
    else if (e.t === 'hit') {
      crateDebris(e.i, e.c); if (e.left > 0) FALL[e.i] = { off: S, v: 0 };
      if (g.t - lastHit < 0.5) combo++; else combo = 1; lastHit = g.t; shake = Math.min(0.25, shake + 0.04);
      if (combo === 10 || combo === 25 || combo === 50) toast(combo >= 50 ? 'EFSANE!' : combo >= 25 ? 'Muhteşem!' : 'Harika!');
      dirty = true; hud();
    } else if (e.t === 'bench' || e.t === 'done' || e.t === 'launch') hud();
    else if (e.t === 'win') { SV.max = Math.max(SV.max, LV + 1); save(); setTimeout(() => modal('<div class="tag">Yapı ' + LV + '</div><h2>Yapı yıkıldı!</h2><p>' + Math.round(g.t) + ' saniye</p><button class="btn g" id="nx">Sonraki ▶</button>'), 900); setTimeout(() => { const b = $('nx'); if (b) b.onclick = () => { closeModal(); start(LV + 1); }; }, 950); }
    else if (e.t === 'lose') { modal('<div class="tag r">Yapı ' + LV + '</div><h2>Bekleme yeri doldu!</h2><p>Yapının %' + Math.round(100 * (1 - g.left / g.total)) + ' kadarı yıkıldı.</p><button class="btn g" id="rt">Tekrar dene</button><button class="btn o" id="rv">+1 yer ile devam</button>');
      $('rt').onclick = () => { closeModal(); start(LV); }; $('rv').onclick = () => { if (YPM.revive(g)) { closeModal(); hud(); } }; }
  }
  g.ev.length = 0;
}
let last = 0;
function frame(ts) {
  const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
  if (g) { YPM.step(g, dt); events(); updatePofis(dt); updateShots(); updateCubes(dt); }
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.2); world.position.x = (Math.random() - 0.5) * shake * 0.4; } else world.position.x = 0;
  ren.render(scene, cam);
  if (!TEST) requestAnimationFrame(frame);
}
function start(L) { LV = Math.max(1, L); SV.L = LV; save(); closeModal(); g = YPM.newGame(LV); buildLevel(); hud(); }
window.YP = { cam, get g() { return g; }, start, run(sec, bot) { let t = last || 0; for (let i = 0; i < Math.round(sec * 30); i++) { t += 1000 / 30; if (bot && i % 6 === 0 && g.state === 'play' && YPM.canLaunch(g)) { const b = YPM.bestMove(g); if (b) YPM.launch(g, b.from, b.k); } frame(t); } hud(); }, snap() { return glc.toDataURL('image/png'); } };
start(+(Q.get('sv') || SV.L || 1));
if (!TEST) requestAnimationFrame(frame); else frame(16);
