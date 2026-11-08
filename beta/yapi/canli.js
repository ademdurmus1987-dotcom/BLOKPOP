// BLOKPOP Yapi v6.17 - fondaki canlilar (Adem 5 Kas 2026: kus ve koyunlar canli gibi hareket etsin).
// Cayir fonundaki uc koyun Adem'in resminden kesildi (canli/k*_govde.png + k*_kafa.png); fondan silinmis hali fon/cayir4_bos.webp.
// Koyunlar otlar (kafasi yere iner, ot koparir gibi kisa kisa oynar), etrafa bakar, birkac adim yurur (bacaklari sirayla adim atar,
// govdesi hafif sallanir), nefes alir. Kuslar: sahilde martilar (fondaki cizili martilar silindi: fon/sahil3_bos.webp),
// cayirda ve karli koyde kucuk kuslar. Kanat cirpar, suzulur, egilerek doner.
// Hepsi fon resminin piksel koordinatinda calisir, ekrana fonla ayni sekilde (cover / ozel boyut) yerlesir.

const cv = document.getElementById('canli'), cx = cv.getContext('2d');
const cv2 = document.getElementById('onfx'), cx2 = cv2.getContext('2d');   // v6.18: yapinin onunde (kar yagisi)
const IMG = {};
function img(n) { if (!IMG[n]) { IMG[n] = new Image(); IMG[n].src = 'canli/' + n + '.png?v=1'; } return IMG[n]; }
// koyunlar: resimdeki yeri (fon pikseli), sprite 2 kat cozunurlukte; kafa: dondurme noktasi (boyun), bakis yonu, bacak cizgisi
const KOYUN = [
// v6.17: resimdeki yerleri kulenin tam arkasinda kaliyordu; kulenin iki yanindaki on cimene alindi (yakin oldugu icin daha iri: sc)
// v6.18: (Adem) koyunlar platforma yakin durmasin, daha uzakta olsun: cayirin iki yan kenarinda, daha geride ve daha kucuk
  { n: 'k1', x: 82, y: 590, w: 56, h: 52, sc: 1.05, yon: -1, piv: [62, 50], leg: 68 },
  { n: 'k3', x: 616, y: 598, w: 57, h: 53, sc: 1.1, yon: -1, piv: [62, 50], leg: 70 },
  { n: 'k2', x: 6, y: 612, w: 60, h: 50, sc: 1.15, yon: 1, piv: [60, 48], leg: 65 }
];
// nehir (cayir): Adem'in resmindeki suyun maskesi; ustunde akis yonunde kayan isik cizgileri ve parlamalar
const NEHIR = { x: 0, y: 390, w: 426, h: 148, dir: [-0.95, 0.31] };
let nehirC = null, nehirP = null, flakes = [];
function nehirHazirla() {
  if (nehirC) return; nehirC = document.createElement('canvas'); nehirC.width = NEHIR.w; nehirC.height = NEHIR.h;
  // akis dokusu: akis yonunde uzamis yumusak beyaz cizgiler (dikissiz tekrar eden 256x128)
  nehirP = document.createElement('canvas'); nehirP.width = 256; nehirP.height = 128; const p = nehirP.getContext('2d');
  for (let i = 0; i < 70; i++) { const x = Math.random() * 256, y = Math.random() * 128, l = 6 + Math.random() * 18, a = 0.1 + Math.random() * 0.28;
    for (const dx of [-256, 0, 256]) for (const dy of [-128, 0, 128]) { p.save(); p.translate(x + dx, y + dy); p.rotate(Math.atan2(NEHIR.dir[1], NEHIR.dir[0])); p.fillStyle = 'rgba(255,255,255,' + a + ')'; p.beginPath(); p.ellipse(0, 0, l, 0.9 + Math.random() * 0.8, 0, 0, 6.283); p.fill(); p.restore(); } }
  img('nehir');
}
function nehirCiz() {
  const M = IMG.nehir; if (!M || !M.complete || !M.naturalWidth) return;
  const c = nehirC.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, NEHIR.w, NEHIR.h);
  // iki katman: hizli ve yavas akis (derinlik); hafif dalgalanma
  for (const [sp, al, sc] of [[26, 0.9, 1], [15, 0.55, 1.6]]) {
    const ox = ((T * sp * NEHIR.dir[0]) % (256 * sc) + 256 * sc) % (256 * sc), oy = ((T * sp * NEHIR.dir[1]) % (128 * sc) + 128 * sc) % (128 * sc);
    c.globalAlpha = al; for (let x = -256 * sc; x < NEHIR.w + 256 * sc; x += 256 * sc) for (let y = -128 * sc; y < NEHIR.h + 128 * sc; y += 128 * sc) c.drawImage(nehirP, x + ox, y + oy + Math.sin(T * 1.3 + x * 0.01) * 0.6, 256 * sc, 128 * sc);
  }
  // parlamalar
  c.globalAlpha = 1;
  for (let i = 0; i < 9; i++) { const ph = T * 0.7 + i * 1.7, k = Math.max(0, Math.sin(ph * 2.3)); if (k < 0.6) continue; const t2 = (i * 0.137 + T * 0.04) % 1, x = NEHIR.w * (1 - t2), y = NEHIR.h * (0.25 + 0.5 * ((i * 0.31) % 1)) + t2 * 30;
    const gg = c.createRadialGradient(x, y, 0, x, y, 3 + k * 3); gg.addColorStop(0, 'rgba(255,255,255,' + (k - 0.5) * 1.6 + ')'); gg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gg; c.fillRect(x - 8, y - 8, 16, 16); }
  c.globalCompositeOperation = 'destination-in'; c.drawImage(M, 0, 0);
  const s = map.s * DPR; cx.drawImage(nehirC, map.ox * DPR + NEHIR.x * s, map.oy * DPR + NEHIR.y * s, NEHIR.w * s, NEHIR.h * s);
}
// kar yagisi (karli koy): hafif, farkli buyuklukte taneler, sallanarak iner (yakindakiler buyuk ve hizli)
function karHazirla() { flakes = []; const n = Math.round(Math.min(140, innerWidth * innerHeight / 5200)); for (let i = 0; i < n; i++) flakes.push(newFlake(true)); }
function newFlake(first) { const d = Math.random(); return { x: Math.random() * innerWidth, y: first ? Math.random() * innerHeight : -8, r: 0.8 + d * 2.4, vy: 18 + d * 42, sw: Math.random() * 6, sa: 6 + Math.random() * 18, a: 0.45 + d * 0.5 }; }
function karCiz(dt) {
  const cx = cx2; cx.clearRect(0, 0, cv2.width, cv2.height); cx.fillStyle = '#ffffff';
  for (const f of flakes) {
    f.y += f.vy * dt; f.sw += dt * (0.6 + f.r * 0.25); const x = f.x + Math.sin(f.sw) * f.sa;
    if (f.y > innerHeight + 8) Object.assign(f, newFlake(false));
    cx.globalAlpha = f.a; cx.beginPath(); cx.arc(x * DPR, f.y * DPR, f.r * DPR, 0, 6.283); cx.fill();
  }
  cx.globalAlpha = 1;
}
let FON = null, sheep = [], birds = [], IW = 720, IH = 1280, map = { s: 1, ox: 0, oy: 0 }, T = 0, DPR = 1;

export function canliFon(fo) {
  FON = fo.f; sheep = []; birds = []; flakes = []; cx2.clearRect(0, 0, cv2.width, cv2.height);
  if (FON === 'cayir4') {
    sheep = KOYUN.map((k, i) => ({ ...k, w: k.w * k.sc, h: k.h * k.sc, x0: k.x, dx: 0, face: k.yon, st: 'otla', t: 0, dur: 2 + i * 1.3, hb: 0, hbT: 0.5, step: 0, br: Math.random() * 6, nib: 0, look: 0 }));
    for (const k of KOYUN) { img(k.n + '_govde'); img(k.n + '_kafa'); }
    for (let i = 0; i < 3; i++) birds.push(newBird('kucuk', true));
    nehirHazirla();
  } else if (FON.startsWith('sahil') && !fo.vid) { for (let i = 0; i < 6; i++) birds.push(newBird('marti', true)); }
  else if (FON.startsWith('kar')) { for (let i = 0; i < 2; i++) birds.push(newBird('kucuk', true)); karHazirla(); }
  resize(fo);
}
// fonun ekrana yerlesimi (CSS ile ayni): cover + ortala, ya da kar fonundaki gibi ozel boy (yukseklik %135, alta yasli)
let LASTFO = null;
function resize(fo) {
  fo = fo || LASTFO; LASTFO = fo; if (!fo) return;
  DPR = Math.min(2, devicePixelRatio || 1); const W = innerWidth, H = innerHeight;
  cv.width = cv2.width = Math.round(W * DPR); cv.height = cv2.height = Math.round(H * DPR);
  IH = fo.f.startsWith('kar') || fo.f.startsWith('cayir') || fo.f.startsWith('sahil') ? 1280 : 1222;
  let s;
  if (fo.bs === 'auto 135%') { s = H * 1.35 / IH; map = { s, ox: (W - IW * s) / 2, oy: H - IH * s }; }
  else { s = Math.max(W / IW, H / IH); map = { s, ox: (W - IW * s) / 2, oy: (H - IH * s) / 2 }; }
}
addEventListener('resize', () => resize());

// ---------------- kuslar ----------------
function newBird(tur, first) {
  const fromL = Math.random() < 0.5, sky = tur === 'marti' ? [250, 520] : FON === 'cayir4' ? [60, 300] : [90, 330];
  const d = 0.55 + Math.random() * 0.75;   // uzaklik: yakindaki buyuk ve hizli
  return {
    tur, d, x: first ? Math.random() * IW : fromL ? -40 : IW + 40, y: sky[0] + Math.random() * (sky[1] - sky[0]),
    vx: (fromL ? 1 : -1) * (tur === 'marti' ? 22 : 34) * (0.7 + d * 0.6), vy: 0, ph: Math.random() * 6, flap: Math.random() < 0.6, ft: Math.random() * 2,
    wob: Math.random() * 6, bank: 0, wait: first ? 0 : Math.random() * 3
  };
}
function updBird(b, dt) {
  if (b.wait > 0) { b.wait -= dt; return; }
  b.ft -= dt;
  if (b.ft <= 0) { b.flap = !b.flap; b.ft = b.flap ? 0.8 + Math.random() * 1.6 : 1 + Math.random() * 2.2; if (!b.flap && b.tur === 'kucuk') b.ft *= 0.5; }
  const rate = b.tur === 'marti' ? 6.5 : 13;
  if (b.flap) b.ph += dt * rate; else b.ph += (Math.round(b.ph / 6.283) * 6.283 + 1.2 - b.ph) * Math.min(1, dt * 3);   // suzulurken kanat hafif yukarida sabit
  b.wob += dt * 0.6;
  const lift = b.flap ? -6 : 4;   // cirparken yukselir, suzulurken alcalir
  b.vy += ((lift + Math.sin(b.wob) * 8) - b.vy) * dt * 1.5;
  b.bank += ((Math.sin(b.wob * 0.7) * 0.35) - b.bank) * dt * 2;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < -60 || b.x > IW + 60) Object.assign(b, newBird(b.tur, false));
}
function drawBird(b) {
  if (b.wait > 0) return;
  const s = map.s * DPR, X = map.ox * DPR + b.x * s, Y = map.oy * DPR + b.y * s, k = (b.tur === 'marti' ? 24 : 11) * b.d * s, dir = Math.sign(b.vx);
  const fl = Math.sin(b.ph), up = fl * 0.75;   // kanat acisi
  cx.save(); cx.translate(X, Y); cx.rotate(b.bank * 0.4 * dir); cx.scale(dir, 1);
  const wing = (side) => {
    // kanat iki parca: omuz ve uc; uc biraz gecikmeli kalkar (gercek kanat gibi kirilir)
    const ex = side * k * 0.55, ey = -up * k * 0.55, tx = side * k * 1.15, ty = ey - Math.sin(b.ph - 0.6) * k * 0.45;
    cx.beginPath(); cx.moveTo(-k * 0.12, 0); cx.quadraticCurveTo(ex * 0.5, ey - k * 0.12, ex, ey); cx.quadraticCurveTo((ex + tx) / 2, (ey + ty) / 2 - k * 0.06, tx, ty);
    cx.quadraticCurveTo((ex + tx) / 2, (ey + ty) / 2 + k * 0.12, ex * 0.9, ey + k * 0.16); cx.quadraticCurveTo(ex * 0.4, k * 0.12, k * 0.14, k * 0.04); cx.closePath();
    if (b.tur === 'marti') {
      cx.fillStyle = '#f3f6f8'; cx.fill(); cx.strokeStyle = 'rgba(120,130,150,.55)'; cx.lineWidth = Math.max(0.6, k * 0.05); cx.stroke();
      cx.beginPath(); cx.moveTo(tx, ty); cx.lineTo(tx - side * k * 0.28, ty + k * 0.03); cx.lineTo(tx - side * k * 0.2, ty + k * 0.14); cx.closePath(); cx.fillStyle = '#2b3550'; cx.fill();   // koyu kanat ucu
    } else { cx.fillStyle = FON.startsWith('kar') ? '#4a4f63' : '#3b3550'; cx.fill(); }
  };
  // arkadaki kanat once (biraz kucuk ve koyu: derinlik)
  cx.globalAlpha = 0.85; cx.save(); cx.scale(0.92, 0.92); wing(-1); cx.restore(); cx.globalAlpha = 1;
  // govde
  cx.beginPath(); cx.ellipse(0, k * 0.03, k * 0.42, k * 0.12, 0, 0, 6.283); cx.fillStyle = b.tur === 'marti' ? '#ffffff' : FON.startsWith('kar') ? '#5a5f72' : '#463f5c'; cx.fill();
  cx.beginPath(); cx.arc(k * 0.38, -k * 0.03, k * 0.1, 0, 6.283); cx.fill();
  if (b.tur === 'marti') { cx.beginPath(); cx.moveTo(k * 0.46, -k * 0.02); cx.lineTo(k * 0.6, k * 0.02); cx.lineTo(k * 0.46, k * 0.04); cx.fillStyle = '#f2b233'; cx.fill(); }
  cx.beginPath(); cx.moveTo(-k * 0.38, 0); cx.lineTo(-k * 0.6, -k * 0.05); cx.lineTo(-k * 0.56, k * 0.08); cx.closePath(); cx.fillStyle = b.tur === 'marti' ? '#e8edf2' : cx.fillStyle; cx.fill();   // kuyruk
  wing(1);
  cx.restore();
}

// ---------------- koyunlar ----------------
// durumlar: otla (kafa yerde, kisa kisa koparir), bak (kafa kalkik, biraz doner), yuru (birkac adim, yonunu degistirebilir)
function nextState(k) {
  const r = Math.random();
  if (k.st === 'yuru' || r < 0.5) { k.st = 'otla'; k.dur = 2.5 + Math.random() * 4; }
  else if (r < 0.75) { k.st = 'bak'; k.dur = 1.2 + Math.random() * 2; k.look = Math.random() < 0.5 ? -1 : 1; }
  else {
    k.st = 'yuru'; k.dur = 1.6 + Math.random() * 2.2;
    const lim = 16 * k.sc; let want = Math.random() < 0.65 ? k.face : -k.face;
    if (k.dx * want > lim * 0.6) want = -want; k.face = want; k.spd = 4 + Math.random() * 2.5;
  }
  k.t = 0;
}
function updSheep(k, dt) {
  k.t += dt; k.br += dt; if (k.t > k.dur) nextState(k);
  // kafa hedefi: otlarken asagi (0.42), bakarken yukari (-0.06)
  const tgt = k.st === 'otla' ? 0.42 : k.st === 'bak' ? -0.06 : 0.12;
  k.hb += (tgt - k.hb) * Math.min(1, dt * 3.2);
  if (k.st === 'otla') { k.nib += dt * 9; } else k.nib *= 0.9;
  if (k.st === 'yuru') {
    // ust uste binmesinler
    const nx = k.dx + k.face * k.spd * dt; const me = k.x0 + nx;
    let ok = Math.abs(nx) < 18 * k.sc; for (const o of sheep) if (o !== k && Math.abs(o.y - k.y) < 40 && Math.abs(me - (o.x0 + o.dx)) < (o.x0 < k.x0 ? o.w : k.w) + 4 && Math.sign((o.x0 + o.dx) - me) === k.face) ok = false;
    if (ok) { k.dx = nx; k.step += dt * k.spd * 0.95; } else k.t = k.dur;
  }
}
function drawSheep(k) {
  const G = IMG[k.n + '_govde'], H = IMG[k.n + '_kafa']; if (!G || !G.complete || !G.naturalWidth || !H.complete) return;
  const s = map.s * DPR, X = map.ox * DPR + (k.x0 + k.dx) * s, Y = map.oy * DPR + k.y * s, w = k.w * s, h = k.h * s, q = w / G.naturalWidth;
  const flip = k.face !== k.yon, walk = k.st === 'yuru', st = Math.sin(k.step * 2.4);
  // golge
  cx.save(); cx.globalAlpha = 0.28; cx.fillStyle = '#2f5a14'; cx.beginPath(); cx.ellipse(X + w * 0.47 - k.yon * w * 0.04, Y + h * 0.93, w * 0.46, h * 0.09, 0, 0, 6.283); cx.fill(); cx.restore();
  cx.save(); cx.translate(X + w / 2, Y); if (flip) cx.scale(-1, 1); cx.translate(-w / 2, 0);
  const breathe = 1 + Math.sin(k.br * 2.2) * 0.012, bob = walk ? Math.abs(st) * -0.9 * q * 2 : 0, sway = walk ? st * 0.018 : 0;
  // bacaklar: alt bant iki parcaya bolunur (on ve arka bacaklar), yururken sirayla kalkip one gider
  const legY = k.leg, gw = G.naturalWidth, gh = G.naturalHeight;
  for (let i = 0; i < 2; i++) {
    const sx = i ? gw / 2 : 0, ph = i ? st : -st, lift = walk ? Math.max(0, ph) * 2.2 : 0, fw = walk ? ph * 1.6 : 0;
    cx.drawImage(G, sx, legY, gw / 2, gh - legY, sx * q + fw * q, legY * q - lift * q, gw / 2 * q, (gh - legY) * q);
  }
  // govde (bacaklarin ustu): nefes alir, yururken iner kalkar ve hafif sallanir
  cx.save(); cx.translate(w / 2, legY * q); cx.rotate(sway); cx.scale(1, breathe); cx.translate(-w / 2, -legY * q + bob);
  cx.drawImage(G, 0, 0, gw, legY + 1, 0, 0, w, (legY + 1) * q);
  // kafa: boyundan doner; otlarken yere iner ve kisa kisa koparir, bakarken hafif sag sola
  const px = k.piv[0] * q, py = k.piv[1] * q, side = k.yon;   // kafa sprite icinde yon tarafinda
  const nib = k.st === 'otla' && k.hb > 0.3 ? Math.max(0, Math.sin(k.nib)) * 0.07 : 0, look = k.st === 'bak' ? Math.sin(k.t * 1.6) * 0.08 * k.look : 0;
  const ang = (k.hb + nib) * side + look;
  cx.translate(px, py); cx.rotate(ang); cx.translate(-px, -py + (k.hb > 0 ? k.hb * 3.5 * q : 0));
  cx.drawImage(H, 0, 0, w, h);
  cx.restore();
  cx.restore();
}

let lastT = 0;
export function canliKare(dt) {
  if (!FON) return;
  T += dt; cx.clearRect(0, 0, cv.width, cv.height);
  if (FON === 'cayir4') nehirCiz();
  for (const k of sheep) { updSheep(k, dt); drawSheep(k); }
  birds.sort((a, b) => a.d - b.d);
  for (const b of birds) { updBird(b, dt); drawBird(b); }
  if (FON.startsWith('kar')) karCiz(dt);
}
