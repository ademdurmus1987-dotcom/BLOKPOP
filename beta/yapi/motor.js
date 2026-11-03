// BLOKPOP Yapi v2 (prototip) - oyun motoru. Tarayicida ve Node'da (bot) ayni kod calisir; cizim yok.
//
// Saha: duz zeminin ortasinda F x F'lik bir platform. Her hucrede ust uste dizilmis kupler (yigin, alttan uste renkler).
// Pofi'ler platformun etrafindaki kare yolda saat yonunde bir tur atar. Bir seridin hizasindan gecerken o seritte
// DISARIDAN ilk dolu yigina bakar; o yiginin EN ALTTAKI kupu kendi rengindeyse atis yapar. Alttaki kup kirilinca
// ustundekiler bir kat duser. Turu biten ve mermisi kalan Pofi bekleme yerine iner; yer yoksa oyun biter.
// Mermi denkligi: kuyruktaki toplam mermi = sahadaki kup sayisi.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YPM = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function rng(seed) { let a = (seed >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const ri = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));

  const PAL = ['#ff4d5e', '#ffb22e', '#3d7bff', '#a25cff', '#2fcf73', '#ff7ad0'];
  const D = (a, b) => Math.max(Math.abs(a), Math.abs(b));
  // h(r,c): yigin yuksekligi (r: arka->on, c: sol->sag). Kenar: 0 = bos hucre
  const LEVELS = [
    { ad: 'İkiz Kuleler', F: 6, c: 3, h: (r, c) => ((c <= 1 && r <= 1) || (c >= 4 && r <= 1) ? 6 : r <= 3 ? 2 : 1) },
    { ad: 'Piramit', F: 7, c: 3, h: (r, c) => 6 - 2 * D(r - 3, c - 3) + (D(r - 3, c - 3) === 0 ? 0 : 0) },
    { ad: 'Kale', F: 8, c: 4, h: (r, c) => { const e = r === 0 || r === 7 || c === 0 || c === 7, k = (r <= 1 || r >= 6) && (c <= 1 || c >= 6); return k ? 6 : e ? 3 : (r >= 3 && r <= 4 && c >= 3 && c <= 4) ? 5 : 0; } },
    { ad: 'Merdiven', F: 7, c: 4, h: (r, c) => Math.max(1, 6 - Math.floor((r + c) / 2)) },
    { ad: 'Büyük Kale', F: 8, c: 5, h: (r, c) => { const k = (r <= 1 || r >= 6) && (c <= 1 || c >= 6), e = r === 0 || r === 7 || c === 0 || c === 7, m = r >= 3 && r <= 4 && c >= 3 && c <= 4; return k ? 6 : m ? 6 : e ? 3 : 2; } }
  ];
  function levelOf(L) { return LEVELS[(L - 1) % LEVELS.length]; }

  function level(L, seed) {
    const Y = levelOf(L), F = Y.F, C = Y.c, rnd = rng((seed == null ? L * 7919 + 13 : seed) >>> 0), pal = PAL.slice(0, C);
    const cells = [];
    // renk: katlara gore bant (2 kat bir renk) + bolgeye gore kayma + rastgele vurgu
    const shift = (r, c) => ((r < F / 2 ? 0 : 1) + (c < F / 2 ? 0 : 2)) % C;
    for (let r = 0; r < F; r++) for (let c = 0; c < F; c++) {
      const h = Math.max(0, Math.min(8, Math.round(Y.h(r, c)))), st = [];
      for (let y = 0; y < h; y++) { let v = (Math.floor(y / 2) + shift(r, c)) % C; if (rnd() < 0.18) v = (v + 1 + ri(rnd, 0, C - 2)) % C; st.push(v); }
      cells.push({ st, pend: 0 });
    }
    const lv = { L, ad: Y.ad, F, pal, cells, seed: seed == null ? L * 7919 + 13 : seed };
    lv.total = cells.reduce((a, x) => a + x.st.length, 0);
    lv.queue = planQueue(lv, rnd);
    return lv;
  }

  // ---------- seritler ----------
  // tur sirasi: on (S) soldan saga, sag (E) onden arkaya, arka (N) sagdan sola, sol (W) arkadan one
  // seritte disaridan iceriye hucre listesi
  function laneCells(F, side, k) {
    const o = [];
    for (let j = 0; j < F; j++) {
      if (side === 0) o.push((F - 1 - j) * F + k);              // on: c = k, r: F-1 -> 0
      else if (side === 1) o.push((F - 1 - k) * F + (F - 1 - j)); // sag: r = F-1-k, c: F-1 -> 0
      else if (side === 2) o.push(j * F + (F - 1 - k));          // arka: c = F-1-k, r: 0 -> F-1
      else o.push(k * F + j);                                     // sol: r = k, c: 0 -> F-1
    }
    return o;
  }
  // seritte ilk dolu (talep edilmemis kati olan) yigin -> {i, col} ya da null
  function laneTarget(cells, F, side, k) {
    for (const i of laneCells(F, side, k)) { const x = cells[i]; if (x.st.length - x.pend > 0) return { i, col: x.st[x.pend] }; }
    return null;
  }
  function exposure(cells, F, C) {
    const e = new Array(C).fill(0);
    for (let s = 0; s < 4; s++) for (let k = 0; k < F; k++) { const t = laneTarget(cells, F, s, k); if (t) e[t.col]++; }
    return e;
  }

  // ---------- kuyruk (soyma benzetimi) ----------
  function planQueue(lv, rnd) {
    const F = lv.F, C = lv.pal.length, cells = lv.cells.map((x) => ({ st: x.st.slice(), pend: 0 }));
    const rem = new Array(C).fill(0); cells.forEach((x) => x.st.forEach((v) => rem[v]++));
    const a0 = Math.max(3, Math.round(F * 0.8)), a1 = Math.max(a0 + 2, Math.round(F * 1.6)), order = [];
    let guard = 0;
    while (rem.some((v) => v > 0) && guard++ < 500) {
      const e = exposure(cells, F, C); let bc = -1, bs = -1;
      for (let c = 0; c < C; c++) if (rem[c] > 0) { const s = e[c] + rnd() * 0.6; if (s > bs) { bs = s; bc = c; } }
      let a = rem[bc] <= a1 ? rem[bc] : ri(rnd, a0, Math.min(a1, rem[bc] - a0));
      rem[bc] -= a; order.push({ c: bc, a });
      // benzetim: bu Pofi birkac tur atar ve acik kuplerini kirar
      let ammo = a;
      for (let lap = 0; lap < 6 && ammo > 0; lap++) { let hit = 0;
        for (let s = 0; s < 4 && ammo > 0; s++) for (let k = 0; k < F && ammo > 0; k++) { const t = laneTarget(cells, F, s, k); if (t && t.col === bc) { cells[t.i].st.shift(); ammo--; hit++; } }
        if (!hit) break; }
    }
    for (let k = 0; k < Math.round(order.length * 0.35); k++) { const i = Math.floor(rnd() * (order.length - 1)); const t = order[i]; order[i] = order[i + 1]; order[i + 1] = t; }
    const cols = [[], [], [], []]; order.forEach((s, i) => cols[i % 4].push(s)); return cols;
  }

  // ---------- oyun ----------
  const M = 1.15;          // yol platform kenarindan bu kadar disarida (hucre)
  const MAX_BELT = 4, MAX_BENCH = 6, LAP_T = 6.0, SHOT_T = 0.2;
  function newGame(L, opts) {
    opts = opts || {};
    const lv = level(L, opts.seed);
    let id = 0;
    const SEG = lv.F + 2 * M, LAP = SEG * 4;
    const g = { L, lv, F: lv.F, pal: lv.pal, cells: lv.cells.map((x) => ({ st: x.st.slice(), pend: 0 })),
      queue: lv.queue.map((col) => col.map((s) => ({ id: ++id, c: s.c, ammo: s.a }))),
      bench: new Array(opts.bench || 5).fill(null), belt: [], shots: [], ev: [], SEG, LAP, speed: LAP / LAP_T,
      t: 0, state: 'play', left: lv.total, total: lv.total, launches: 0, nid: id };
    return g;
  }
  // yoldaki konum: d (0..LAP) -> {x, z, side, k(serit, kesirli)} ; platform merkezi 0,0 ve hucre boyu 1
  function trackPos(g, d) {
    const F = g.F, h = F / 2 + M, SEG = g.SEG; d = ((d % g.LAP) + g.LAP) % g.LAP;
    const side = Math.min(3, Math.floor(d / SEG)), u = d - side * SEG, p = u - h;   // p: -h..h
    if (side === 0) return { x: p, z: h, side, u: p + F / 2 };
    if (side === 1) return { x: h, z: -p, side, u: p + F / 2 };
    if (side === 2) return { x: -p, z: -h, side, u: p + F / 2 };
    return { x: -h, z: p, side, u: p + F / 2 };
  }
  function canLaunch(g) { if (g.state !== 'play') return false; if (g.belt.length >= MAX_BELT) return false; return !g.belt.some((s) => s.d < 1.4); }
  function launch(g, from, k) {
    if (!canLaunch(g)) return false;
    let s = null;
    if (from === 'q') { if (!g.queue[k] || !g.queue[k].length) return false; s = g.queue[k].shift(); }
    else { s = g.bench[k]; if (!s) return false; g.bench[k] = null; }
    s.d = 0; s.lane = -1; s.side = 0; s.fired = 0; g.belt.push(s); g.launches++;
    g.ev.push({ t: 'launch', s, from, k }); return true;
  }
  function step(g, dt) {
    if (g.state !== 'play') return;
    g.t += dt;
    for (let n = g.belt.length - 1; n >= 0; n--) {
      const s = g.belt[n], d0 = s.d; s.d += g.speed * dt;
      // gecilen serit merkezleri
      const p0 = trackPos(g, d0), p1 = trackPos(g, Math.min(s.d, g.LAP - 1e-6));
      const cross = [];
      if (p0.side === p1.side) { for (let k = 0; k < g.F; k++) { const c = k + 0.5; if (p0.u < c && p1.u >= c) cross.push([p1.side, k]); } }
      else { for (let k = 0; k < g.F; k++) { if (p0.u < k + 0.5) cross.push([p0.side, k]); } for (let k = 0; k < g.F; k++) { if (p1.u >= k + 0.5) cross.push([p1.side, k]); } }
      for (const [side, k] of cross) {
        if (s.ammo <= 0) break;
        const t = laneTarget(g.cells, g.F, side, k);
        if (t && t.col === s.c) { g.cells[t.i].pend++; s.ammo--; s.fired++; const sh = { s, i: t.i, c: s.c, t: 0, side, k }; g.shots.push(sh); g.ev.push({ t: 'fire', s, i: t.i, sh }); }
      }
      if (s.d >= g.LAP) {
        g.belt.splice(n, 1);
        if (s.ammo <= 0) { g.ev.push({ t: 'done', s }); continue; }
        const j = g.bench.indexOf(null);
        if (j < 0) { g.state = 'lose'; g.ev.push({ t: 'lose', s }); return; }
        g.bench[j] = s; g.ev.push({ t: 'bench', s, k: j });
      }
    }
    for (let n = g.shots.length - 1; n >= 0; n--) {
      const sh = g.shots[n]; sh.t += dt; if (sh.t < SHOT_T) continue;
      g.shots.splice(n, 1); const x = g.cells[sh.i], col = x.st.shift(); x.pend--; g.left--;
      g.ev.push({ t: 'hit', i: sh.i, c: col, left: x.st.length });
    }
    if (g.left <= 0 && !g.shots.length) { g.state = 'win'; g.ev.push({ t: 'win' }); }
  }
  function revive(g) { if (g.state !== 'lose') return false; g.bench.push(null); g.state = 'play'; return true; }

  // ---------- bot ----------
  function bestMove(g) {
    const e = exposure(g.cells, g.F, g.pal.length);
    let best = null, bv = 0;
    g.bench.forEach((s, k) => { if (s && e[s.c] > bv) { bv = e[s.c] + 0.5; best = { from: 'b', k }; } });
    for (let k = 0; k < 4; k++) { const s = g.queue[k][0]; if (s && e[s.c] > bv) { bv = e[s.c]; best = { from: 'q', k }; } }
    return best;
  }
  function botPlay(L, style, seed) {
    const g = newGame(L); let r = (seed >>> 0) || 1; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
    let t = 0;
    while (g.state === 'play' && t < 600) {
      if (canLaunch(g)) {
        if (style === 'dikkatli') { const b = bestMove(g); if (b) launch(g, b.from, b.k); else if (!g.belt.length && !g.shots.length) { const o = [0, 1, 2, 3].filter((k) => g.queue[k].length); const bi = g.bench.findIndex((s) => s); if (o.length) launch(g, 'q', o[Math.floor(rnd() * o.length)]); else if (bi >= 0) launch(g, 'b', bi); } }
        else if (rnd() < 0.3) { const o = [0, 1, 2, 3].filter((k) => g.queue[k].length); if (o.length) launch(g, 'q', o[Math.floor(rnd() * o.length)]); }
      }
      for (let i = 0; i < 6; i++) step(g, 0.05); t += 0.3; g.ev.length = 0;
    }
    return { L, style, win: g.state === 'win', t: Math.round(g.t), left: g.left, total: g.total, launches: g.launches };
  }
  return { PAL, LEVELS, levelOf, level, newGame, step, launch, canLaunch, trackPos, laneTarget, laneCells, exposure, revive, bestMove, botPlay, MAX_BELT, MAX_BENCH, M, rng };
});
