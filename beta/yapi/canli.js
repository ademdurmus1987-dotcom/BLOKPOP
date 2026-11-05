// BLOKPOP Yapi v6.17 - fondaki canlilar (Adem 5 Kas 2026: kus ve koyunlar canli gibi hareket etsin).
// Cayir fonundaki uc koyun Adem'in resminden kesildi (canli/k*_govde.png + k*_kafa.png); fondan silinmis hali fon/cayir4_bos.webp.
// Koyunlar otlar (kafasi yere iner, ot koparir gibi kisa kisa oynar), etrafa bakar, birkac adim yurur (bacaklari sirayla adim atar,
// govdesi hafif sallanir), nefes alir. Kuslar: sahilde martilar (fondaki cizili martilar silindi: fon/sahil3_bos.webp),
// cayirda ve karli koyde kucuk kuslar. Kanat cirpar, suzulur, egilerek doner.
// Hepsi fon resminin piksel koordinatinda calisir, ekrana fonla ayni sekilde (cover / ozel boyut) yerlesir.

const cv = document.getElementById('canli'), cx = cv.getContext('2d');
const IMG = {};
function img(n) { if (!IMG[n]) { IMG[n] = new Image(); IMG[n].src = 'canli/' + n + '.png?v=1'; } return IMG[n]; }
// koyunlar: resimdeki yeri (fon pikseli), sprite 2 kat cozunurlukte; kafa: dondurme noktasi (boyun), bakis yonu, bacak cizgisi
const KOYUN = [
// v6.17: resimdeki yerleri kulenin tam arkasinda kaliyordu; kulenin iki yanindaki on cimene alindi (yakin oldugu icin daha iri: sc)
  { n: 'k1', x: 34, y: 628, w: 56, h: 52, sc: 1.55, yon: -1, piv: [62, 50], leg: 68 },
  { n: 'k3', x: 575, y: 650, w: 57, h: 53, sc: 1.65, yon: -1, piv: [62, 50], leg: 70 },
  { n: 'k2', x: 40, y: 712, w: 60, h: 50, sc: 1.8, yon: 1, piv: [60, 48], leg: 65 }
];
let FON = null, sheep = [], birds = [], IW = 720, IH = 1280, map = { s: 1, ox: 0, oy: 0 }, T = 0, DPR = 1;

export function canliFon(fo) {
  FON = fo.f; sheep = []; birds = [];
  if (FON === 'cayir4') {
    sheep = KOYUN.map((k, i) => ({ ...k, w: k.w * k.sc, h: k.h * k.sc, x0: k.x, dx: 0, face: k.yon, st: 'otla', t: 0, dur: 2 + i * 1.3, hb: 0, hbT: 0.5, step: 0, br: Math.random() * 6, nib: 0, look: 0 }));
    for (const k of KOYUN) { img(k.n + '_govde'); img(k.n + '_kafa'); }
    for (let i = 0; i < 3; i++) birds.push(newBird('kucuk', true));
  } else if (FON.startsWith('sahil')) { for (let i = 0; i < 6; i++) birds.push(newBird('marti', true)); }
  else if (FON.startsWith('kar')) { for (let i = 0; i < 3; i++) birds.push(newBird('kucuk', true)); }
  resize(fo);
}
// fonun ekrana yerlesimi (CSS ile ayni): cover + ortala, ya da kar fonundaki gibi ozel boy (yukseklik %135, alta yasli)
let LASTFO = null;
function resize(fo) {
  fo = fo || LASTFO; LASTFO = fo; if (!fo) return;
  DPR = Math.min(2, devicePixelRatio || 1); const W = innerWidth, H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
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
  for (const k of sheep) { updSheep(k, dt); drawSheep(k); }
  birds.sort((a, b) => a.d - b.d);
  for (const b of birds) { updBird(b, dt); drawBird(b); }
}
