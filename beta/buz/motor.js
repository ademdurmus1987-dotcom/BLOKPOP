// BLOKPOP Buz (prototip v3) - oyun motoru
// Tarayicida ve Node'da (bot) ayni kod calisir. Cizim yok, sadece kurallar.
//
// Tahta: W sutun x H sira kucuk buz kupu (14x18, 21x27, 28x36); arkasinda resim var (beta/bg).
// Engeller kupleri tek parca kaplar (bir "blok" = B x B kup, B = W/7):
//   tahta  -> her renk fil vurur, cani biter kirilir
//   zincir -> sadece zincirin rengindeki fil vurur
//   kilit  -> vurulamaz; anahtar baska bir buz blogunun icinde, o blok tamamen kirilinca acilir
// Kalin buz kup basina 2 atis ister.
// Kurallar:
//  - Bant tahtanin altinda soldan saga tek yon akar.
//  - Fil bir sutunun altindan gecerken o sutunda ALTTAN ilk kupe bakar:
//      kendi renginde buz / vurabilecegi engel -> atis yapar
//      baska renk ya da kilit                   -> atis yok (onu kapali)
//  - Bandin sonunda mermisi kalan fil bekleme yerine doner; yer yoksa oyun biter.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BZM = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let SRC = null; // BZ_IZGARA (tools/buz-izgara.py)
  function setLib(l) { SRC = l; }

  // ---------- yardimcilar ----------
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ri = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ---------- seviye plani ----------
  // size: sutun sayisi, c: renk, K: oluk, am: fil mermisi (sutun sayisina oranla), mix: kuyruk karisikligi
  // thick/wood/chain: bloklarin (63 blok) orani; lock: kilit sayisi
  const PLAN = {
    1: { size: 14, c: 3, K: 3, am: [0.7, 1.4], mix: 0.3, bench: 6 },
    2: { size: 14, c: 3, K: 3, am: [0.8, 1.6], mix: 0.5, bench: 6 },
    3: { size: 14, c: 3, K: 3, am: [0.8, 1.6], mix: 0.8, bench: 5, thick: 0.1, tip: 'thick' },
    4: { size: 14, c: 4, K: 4, am: [0.8, 1.6], mix: 1, bench: 5, thick: 0.12 },
    5: { size: 14, c: 4, K: 4, am: [0.8, 1.6], mix: 1, bench: 5, wood: 0.1, tip: 'wood' },
    6: { size: 21, c: 4, K: 4, am: [0.8, 1.6], mix: 1, bench: 5, wood: 0.08, thick: 0.08 },
    7: { size: 21, c: 4, K: 4, am: [0.8, 1.6], mix: 1, chain: 0.08, tip: 'chain' },
    8: { size: 21, c: 4, K: 4, am: [0.8, 1.6], mix: 1, chain: 0.08, wood: 0.06 },
    9: { size: 21, c: 4, K: 4, am: [0.8, 1.6], mix: 1, lock: 1, tip: 'lock' },
    10: { size: 21, c: 5, K: 4, am: [0.8, 1.6], mix: 1, lock: 1, thick: 0.1 }
  };
  const COMBOS = [['thick', 'wood'], ['chain', 'thick'], ['lock', 'wood'], ['chain', 'lock'], ['thick', 'wood', 'chain'],
    ['thick'], ['lock', 'chain'], ['wood', 'lock'], ['thick', 'chain', 'lock'], ['thick', 'wood', 'chain', 'lock']];
  function planFor(L) {
    if (PLAN[L]) return Object.assign({ bench: 5, belt: 5 }, PLAN[L]);
    const k = L - 11, combo = COMBOS[k % COMBOS.length], round = Math.floor(k / COMBOS.length);
    const dens = Math.min(0.16, 0.08 + 0.015 * round);
    const hard = (L % 10 === 0) ? 1 : 0, easy = (L % 10 === 6) ? 1 : 0;
    const p = { size: L <= 20 ? 21 : 28, c: L <= 25 ? 4 : 5, K: 4, am: [0.8, 1.6], mix: 1 + 0.3 * hard - 0.3 * easy, bench: 5, belt: 5 };
    if (hard && L >= 30) p.c = 6;
    for (const b of combo) {
      if (b === 'lock') p.lock = L >= 25 && combo.length <= 3 ? 2 : 1;
      else p[b] = dens * (combo.length >= 3 ? 0.75 : 1) * (easy ? 0.7 : 1);
    }
    return p;
  }

  // ---------- seviye uretimi ----------
  function level(L, seed, over) {
    if (!SRC) throw new Error('izgara yuklenmedi');
    const P = Object.assign(planFor(L), over || {});
    const sz = SRC.sizes.find((s) => s[0] === P.size) || SRC.sizes[0];
    const W = sz[0], H = sz[1], B = Math.round(W / 7), BW = 7, BH = Math.round(H / B);
    const pic = SRC.pics[(L - 1) % SRC.pics.length];
    const set = pic.s[String(W)], kk = set[String(Math.max(3, Math.min(6, P.c)))] || set['4'];
    const pal = kk.pal.slice();
    const rnd = rng((seed == null ? L * 7919 + 13 : seed) >>> 0);
    const cells = [];
    for (let i = 0; i < W * H; i++) { const v = +kk.g[i]; cells.push({ c: v, layers: [{ t: 'ice', c: v }], obj: -1, done: false, pend: 0 }); }
    const blockCells = (br, bc, bw, bh) => { const a = []; for (let r = br * B; r < (br + bh) * B; r++) for (let c = bc * B; c < (bc + bw) * B; c++) a.push(r * W + c); return a; };
    const used = new Set(); // dolu bloklar "r,c"
    const free = (br, bc, bw, bh) => { if (br < 0 || bc < 0 || br + bh > BH || bc + bw > BW) return false; for (let r = br; r < br + bh; r++) for (let c = bc; c < bc + bw; c++) if (used.has(r + ',' + c)) return false; return true; };
    const take = (br, bc, bw, bh) => { for (let r = br; r < br + bh; r++) for (let c = bc; c < bc + bw; c++) used.add(r + ',' + c); };
    const objs = [], keys = [];
    const addObj = (t, br, bc, bw, bh, extra) => {
      const o = Object.assign({ id: objs.length, t, br, bc, bw, bh, r0: br * B, c0: bc * B, w: bw * B, h: bh * B, cells: blockCells(br, bc, bw, bh), pend: 0, alive: true }, extra || {});
      o.hp = o.hpMax = t === 'lock' ? 1 : bw * B;
      for (const i of o.cells) cells[i].obj = o.id;
      objs.push(o); take(br, bc, bw, bh); return o;
    };
    // kilitler once, anahtarlar kilitsiz blok sutunlarina (kilit dongusu olmaz)
    const lockCols = new Set();
    for (let gi = 0; gi < (P.lock || 0); gi++) {
      let ok = null;
      for (let t = 0; t < 200 && !ok; t++) { const br = ri(rnd, 2, BH - 2), bc = ri(rnd, 0, BW - 1); if (free(br, bc, 1, 1) && !lockCols.has(bc)) ok = [br, bc]; }
      if (!ok) continue;
      const o = addObj('lock', ok[0], ok[1], 1, 1, { lid: gi });
      lockCols.add(ok[1]);
      let kp = null;
      for (let t = 0; t < 300 && !kp; t++) { const br = ri(rnd, Math.floor(BH * 0.35), BH - 2), bc = ri(rnd, 0, BW - 1); if (!lockCols.has(bc) && free(br, bc, 1, 1)) kp = [br, bc]; }
      if (!kp) { o.alive = false; for (const i of o.cells) cells[i].obj = -1; continue; }
      take(kp[0], kp[1], 1, 1);
      keys.push({ id: keys.length, lock: o.id, cells: blockCells(kp[0], kp[1], 1, 1), br: kp[0], bc: kp[1], out: false });
    }
    const colorsCnt = pal.map(() => 0);
    cells.forEach((x) => { colorsCnt[x.c]++; });
    const nBlocks = BW * BH;
    function spots(frac, bw) {
      const want = Math.round(nBlocks * (frac || 0) / bw), out = [];
      const all = [];
      for (let br = 0; br < BH; br++) for (let bc = 0; bc + bw <= BW; bc++) all.push([br, bc]);
      shuffle(all, rnd);
      for (const [br, bc] of all) { if (out.length >= want) break; if (free(br, bc, bw, 1)) { out.push([br, bc]); take(br, bc, bw, 1); } }
      return out;
    }
    let nThick = 0, nWood = 0, nChain = 0;
    for (const [br, bc] of spots(P.thick, 1)) { for (const i of blockCells(br, bc, 1, 1)) cells[i].layers.push({ t: 'ice', c: cells[i].c }); nThick++; }
    const woodSpots = [];
    if (P.wood) { const two = spots(P.wood * 0.5, 2); two.forEach((s) => woodSpots.push([s[0], s[1], 2])); spots(P.wood * 0.5, 1).forEach((s) => woodSpots.push([s[0], s[1], 1])); }
    for (const [br, bc, bw] of woodSpots) { for (let r = br; r < br + 1; r++) for (let c = bc; c < bc + bw; c++) used.delete(r + ',' + c); addObj('wood', br, bc, bw, 1); nWood++; }
    for (const [br, bc] of spots(P.chain, 1)) {
      used.delete(br + ',' + bc);
      const own = blockCells(br, bc, 1, 1).map((i) => cells[i].c), opts = [];
      pal.forEach((_, ci) => { const share = own.filter((v) => v === ci).length / own.length; if (share < 0.5) for (let k = 0; k < colorsCnt[ci]; k++) opts.push(ci); });
      const c = opts.length ? opts[Math.floor(rnd() * opts.length)] : 0;
      addObj('chain', br, bc, 1, 1, { c }); nChain++;
    }
    const lv = { L, pic: pic.f, crop: pic.crop, W, H, B, pal, cells, objs, keys, plan: P, seed,
      counts: { total: W * H, thick: nThick, wood: nWood, chain: nChain, lock: objs.filter((o) => o.t === 'lock' && o.alive).length } };
    lv.queue = planQueue(lv, rnd);
    return lv;
  }

  // ---------- kural cekirdegi (soyut durum: {cells, objs, keys}) ----------
  function cloneState(s) {
    return {
      cells: s.cells.map((x) => ({ c: x.c, layers: x.layers.map((y) => ({ t: y.t, c: y.c })), obj: x.obj, done: x.done, pend: x.pend })),
      objs: s.objs.map((o) => Object.assign({}, o, { cells: o.cells })),
      keys: s.keys.map((k) => Object.assign({}, k))
    };
  }
  // hucrenin o an "on yuzu": canli engel ya da kendi katmani; null = bitmis/bitmek uzere
  function face(st, i) {
    const x = st.cells[i];
    if (x.done) return null;
    if (x.obj >= 0) { const o = st.objs[x.obj]; if (o.alive && (o.t === 'lock' || o.hp - o.pend > 0)) return { obj: o }; }
    if (x.pend >= x.layers.length) return null;
    return { layer: x.layers[x.pend] };
  }
  // sutunda alttan ilk kup; bu renk vurabilir mi? -> {i, obj} ya da null
  function targetIn(st, W, H, col, color) {
    for (let r = H - 1; r >= 0; r--) {
      const i = r * W + col, f = face(st, i);
      if (!f) continue;
      if (f.obj) {
        const o = f.obj;
        if (o.t === 'lock') return null;
        if (o.t === 'wood' || o.c === color) return { i, r, obj: o.id };
        return null;
      }
      return f.layer.c === color ? { i, r, obj: -1 } : null;
    }
    return null;
  }
  function needOf(st, ncol) {
    const need = new Array(ncol).fill(0); let wood = 0;
    for (const x of st.cells) { if (x.done) continue; for (let j = x.pend; j < x.layers.length; j++) need[x.layers[j].c]++; }
    for (const o of st.objs) { if (!o.alive) continue; const left = o.hp - o.pend; if (left <= 0) continue; if (o.t === 'wood') wood += left; else if (o.t === 'chain') need[o.c] += left; }
    return { need, wood };
  }
  function openLock(st, id) { const o = st.objs[id]; if (o && o.alive) { o.alive = false; for (const i of o.cells) if (st.cells[i].obj === id) st.cells[i].obj = -1; } }
  function keyCheck(st, onKey) { for (const k of st.keys) { if (k.out) continue; if (k.cells.every((i) => st.cells[i].done)) { k.out = true; onKey(k); } } }
  // soyut vurus (kuyruk plani icin; aninda)
  function hitAbstract(st, t) {
    if (t.obj >= 0) { const o = st.objs[t.obj]; o.hp--; if (o.hp <= 0) { o.alive = false; for (const i of o.cells) if (st.cells[i].obj === o.id) st.cells[i].obj = -1; } return; }
    const x = st.cells[t.i]; x.layers.shift();
    if (!x.layers.length) { x.done = true; keyCheck(st, (k) => openLock(st, k.lock)); }
  }
  function planQueue(lv, rnd) {
    const P = lv.plan, W = lv.W, H = lv.H, C = lv.pal.length;
    const st = cloneState(lv);
    const { need, wood } = needOf(st, C);
    const a0 = Math.max(3, Math.round(P.am[0] * W)), a1 = Math.max(a0 + 1, Math.round(P.am[1] * W));
    const chunks = [];
    for (let c = 0; c < C; c++) { let rem = need[c]; while (rem > 0) { const s = rem <= a1 ? rem : ri(rnd, a0, Math.min(a1, rem - a0)); chunks.push({ c, a: s }); rem -= s; } }
    for (let k = 0; k < wood; k++) chunks[Math.floor(rnd() * chunks.length)].a++;
    const pool = chunks.slice(), order = [];
    let guard = 0;
    while (pool.length && guard++ < 2000) {
      const score = new Array(C).fill(0);
      for (let col = 0; col < W; col++) for (let c = 0; c < C; c++) { const t = targetIn(st, W, H, col, c); if (t) score[c] += t.obj >= 0 && st.objs[t.obj].t === 'wood' ? 0.4 : 1; }
      let bc = -1, bs = -1;
      for (const ch of pool) { const s = score[ch.c] + rnd() * 0.5; if (s > bs) { bs = s; bc = ch.c; } }
      const mine = pool.filter((ch) => ch.c === bc), ch = mine[Math.floor(rnd() * mine.length)];
      pool.splice(pool.indexOf(ch), 1);
      order.push({ c: ch.c, ammo: ch.a });
      let ammo = ch.a;
      for (let pass = 0; pass < 8 && ammo > 0; pass++) {
        let hits = 0;
        const D = P.pierce != null ? P.pierce : lv.B;
        for (let col = 0; col < W && ammo > 0; col++) {
          for (let n = 0; n < D && ammo > 0; n++) { const t = targetIn(st, W, H, col, ch.c); if (!t || (n > 0 && t.obj >= 0)) break; hitAbstract(st, t); ammo--; hits++; if (t.obj >= 0) break; }
        }
        if (!hits) break;
      }
    }
    const swaps = Math.round(order.length * (P.mix || 0));
    for (let k = 0; k < swaps; k++) { const i = Math.floor(rnd() * (order.length - 1)); const t = order[i]; order[i] = order[i + 1]; order[i + 1] = t; }
    const cols = [];
    for (let k = 0; k < P.K; k++) cols.push([]);
    order.forEach((s, i) => cols[i % P.K].push(s));
    return cols;
  }

  // ---------- oyun ----------
  const T_CROSS = 3.4, KEY_T = 0.8;
  function newGame(L, opts) {
    opts = opts || {};
    const lv = level(L, opts.seed, opts.plan);
    const P = lv.plan, st = cloneState(lv);
    let id = 0;
    const SP = 1.25 * lv.W / 7;
    const g = {
      L, lv, W: lv.W, H: lv.H, B: lv.B, pal: lv.pal, cells: st.cells, objs: st.objs, keys: st.keys,
      queue: lv.queue.map((col) => col.map((s) => ({ id: ++id, c: s.c, ammo: s.ammo, x: 0 }))),
      bench: new Array(opts.bench || P.bench).fill(null),
      belt: [], shots: [], flying: [], ev: [],
      maxBelt: P.belt, SP, pierce: P.pierce != null ? P.pierce : lv.B, X0: -SP * 0.8, X1: lv.W + SP * 0.8,
      speed: (lv.W + 1.6 * SP) / (opts.tcross || T_CROSS), shotV: lv.H / 0.42,
      t: 0, state: 'play', endT: 0, nid: id, left: 0, launches: 0, topups: 0
    };
    g.cells.forEach((x) => { if (!x.done) g.left++; });
    g.total = g.left;
    topUp(g);
    return g;
  }
  function allShooters(g) {
    const a = [];
    g.queue.forEach((col) => col.forEach((s) => a.push(s)));
    g.bench.forEach((s) => { if (s) a.push(s); });
    g.belt.forEach((s) => { if (!s.gone) a.push(s); });
    return a;
  }
  function addAmmo(g, c, n) {
    let tgt = null;
    for (let k = 0; k < g.queue.length && !tgt; k++) for (let j = g.queue[k].length - 1; j >= 0; j--) if (g.queue[k][j].c === c) { tgt = g.queue[k][j]; break; }
    if (!tgt) tgt = g.bench.find((s) => s && s.c === c) || null;
    if (tgt) tgt.ammo += n;
    else { let k = 0; g.queue.forEach((col, j) => { if (col.length < g.queue[k].length) k = j; }); g.queue[k].push({ id: ++g.nid, c, ammo: n, x: 0 }); }
    g.topups++;
    g.ev.push({ t: 'topup', c, n });
  }
  // guvenlik: her rengin mermisi ihtiyacindan az olmasin (tahta yuzunden kayma olursa)
  function topUp(g) {
    const C = g.pal.length, { need, wood } = needOf(g, C), have = new Array(C).fill(0);
    allShooters(g).forEach((s) => { have[s.c] += s.ammo; });
    for (let c = 0; c < C; c++) if (have[c] < need[c]) { addAmmo(g, c, need[c] - have[c]); have[c] = need[c]; }
    let surplus = 0;
    for (let c = 0; c < C; c++) surplus += Math.max(0, have[c] - need[c]);
    if (surplus < wood) { let c = 0; for (let k = 1; k < C; k++) if (need[k] > need[c]) c = k; addAmmo(g, c, wood - surplus); }
  }
  function useless(g, c) { const { need, wood } = needOf(g, g.pal.length); return need[c] === 0 && wood === 0; }
  function sweepUseless(g) {
    const { need, wood } = needOf(g, g.pal.length);
    if (wood > 0) return;
    for (let k = 0; k < g.queue.length; k++) {
      const col = g.queue[k];
      for (let j = col.length - 1; j >= 0; j--) if (need[col[j].c] === 0) { g.ev.push({ t: 'leave', s: col[j], from: 'q', k, j }); col.splice(j, 1); }
    }
    for (let k = 0; k < g.bench.length; k++) { const s = g.bench[k]; if (s && need[s.c] === 0) { g.ev.push({ t: 'leave', s, from: 'b', k }); g.bench[k] = null; } }
  }
  function canLaunch(g) {
    if (g.state !== 'play') return 'end';
    if (g.belt.length >= g.maxBelt) return 'full';
    for (const s of g.belt) if (s.x < g.X0 + g.SP) return 'busy';
    return '';
  }
  function launch(g, from, k) {
    const why = canLaunch(g);
    if (why) return why;
    let s;
    if (from === 'q') { const col = g.queue[k]; if (!col || !col.length) return 'empty'; s = col.shift(); }
    else { s = g.bench[k]; if (!s) return 'empty'; g.bench[k] = null; }
    s.x = g.X0; s.from = from; s.fromK = k; s.launchT = g.t; s.gone = false;
    g.belt.push(s); g.launches++;
    g.ev.push({ t: 'launch', s, from, k });
    return '';
  }
  // bir sutun gecisinde: alttaki hedefi vurur; ayni renk kupler ust uste duruyorsa en fazla g.pierce kupu delip gecer
  function tryFire(g, s, col) {
    let n = 0;
    for (;;) {
      const t = targetIn(g, g.W, g.H, col, s.c);
      if (!t) break;
      if (n > 0 && t.obj >= 0) break; // engelde durur
      let kind;
      if (t.obj >= 0) { const o = g.objs[t.obj]; o.pend++; kind = o.t; }
      else { const x = g.cells[t.i]; kind = x.layers[x.pend].t; x.pend++; }
      s.ammo--;
      const dist = (g.H - t.r) + 0.5;
      g.shots.push({ i: t.i, r: t.r, col, c: s.c, obj: t.obj, kind, t0: g.t, t1: g.t + dist / g.shotV + n * 0.03, sid: s.id, n });
      if (n === 0) g.ev.push({ t: 'fire', s, r: t.r, col, kind });
      if (kind === 'wood') topUp(g);
      n++;
      if (s.ammo <= 0) { s.gone = true; s.goneT = g.t; g.ev.push({ t: 'empty', s }); break; }
      if (t.obj >= 0 || n >= g.pierce) break;
    }
    return n > 0;
  }
  function impact(g, sh) {
    if (sh.obj >= 0) {
      const o = g.objs[sh.obj];
      o.pend--; o.hp--;
      const broke = o.hp <= 0;
      if (broke) { o.alive = false; for (const i of o.cells) if (g.cells[i].obj === o.id) g.cells[i].obj = -1; }
      g.ev.push({ t: 'objhit', o, i: sh.i, col: sh.col, broke });
      return;
    }
    const x = g.cells[sh.i];
    const y = x.layers.shift();
    x.pend--;
    const done = !x.layers.length;
    if (y.t === 'ice' && !done) x.crk = 1;
    g.ev.push({ t: 'hit', i: sh.i, r: sh.r, col: sh.col, kind: y.t, done, cellC: x.c });
    if (done) {
      x.done = true; g.left--;
      keyCheck(g, (k) => { g.flying.push({ key: k, t0: g.t, t1: g.t + KEY_T }); g.ev.push({ t: 'key', k }); });
      sweepUseless(g);
    }
  }
  function step(g, dt) {
    g.t += dt;
    if (g.state !== 'play') return;
    const W = g.W;
    for (const s of g.belt) {
      if (s.gone) continue;
      const px = s.x; s.x += g.speed * dt;
      const c0 = Math.max(0, Math.floor(px - 0.5) + 1), c1 = Math.min(W - 1, Math.floor(s.x - 0.5));
      for (let c = c0; c <= c1 && !s.gone; c++) tryFire(g, s, c);
    }
    for (let j = g.belt.length - 1; j >= 0; j--) {
      const s = g.belt[j];
      if (s.gone) { g.belt.splice(j, 1); continue; }
      if (s.x < g.X1) continue;
      g.belt.splice(j, 1);
      if (useless(g, s.c)) { g.ev.push({ t: 'leave', s, from: 'belt' }); continue; }
      const k = g.bench.indexOf(null);
      if (k < 0) { g.state = 'lose'; g.endT = g.t; g.lostBy = s; g.ev.push({ t: 'lose', s }); return; }
      g.bench[k] = s; s.benchT = g.t;
      g.ev.push({ t: 'bench', s, k });
    }
    for (let j = g.shots.length - 1; j >= 0; j--) { const sh = g.shots[j]; if (g.t >= sh.t1) { g.shots.splice(j, 1); impact(g, sh); } }
    for (let j = g.flying.length - 1; j >= 0; j--) {
      const f = g.flying[j];
      if (g.t >= f.t1) { g.flying.splice(j, 1); const o = g.objs[f.key.lock]; if (o && o.alive) { openLock(g, o.id); g.ev.push({ t: 'unlock', o }); } }
    }
    if (g.left <= 0 && !g.shots.length) { g.state = 'win'; g.endT = g.t; g.ev.push({ t: 'win' }); }
  }
  function revive(g) {
    if (g.state !== 'lose' || !g.lostBy) return false;
    g.bench.push(g.lostBy); g.lostBy.benchT = g.t; g.lostBy = null;
    g.state = 'play'; g.revives = (g.revives || 0) + 1;
    return true;
  }

  // ---------- sorgular (ipucu / bot / cizim) ----------
  // bu renk fil su an bir geciste kac atis yapar (delme dahil)
  function colHits(g, col, color) {
    const D = g.pierce || 1;
    let n = 0;
    for (let r = g.H - 1; r >= 0 && n < D; r--) {
      const i = r * g.W + col, f = face(g, i);
      if (!f) continue;
      if (f.obj) { if (n === 0 && f.obj.t !== 'lock' && (f.obj.t === 'wood' || f.obj.c === color)) n = 1; break; }
      const x = g.cells[i];
      let k = 0;
      for (let j = x.pend; j < x.layers.length && x.layers[j].c === color; j++) k++;
      if (!k) break;
      n += k;
      if (x.pend + k < x.layers.length) break;
    }
    return Math.min(n, D);
  }
  function hitsNow(g, color, cap) {
    let h = 0;
    for (let col = 0; col < g.W; col++) h += colHits(g, col, color);
    return cap != null ? Math.min(h, cap) : h;
  }
  function frontierOf(g) {
    const f = [];
    for (let col = 0; col < g.W; col++) { let v = -1; for (let r = g.H - 1; r >= 0; r--) if (face(g, r * g.W + col)) { v = r; break; } f.push(v); }
    return f;
  }
  // her sutunda filin gorecegi ilk hedef: {t, c, r} ya da null
  function laneOf(g) {
    const out = [];
    for (let col = 0; col < g.W; col++) {
      let v = null;
      for (let r = g.H - 1; r >= 0; r--) {
        const f = face(g, r * g.W + col);
        if (!f) continue;
        v = f.obj ? { t: f.obj.t, c: f.obj.t === 'chain' ? f.obj.c : -1, r } : { t: f.layer.t, c: f.layer.c, r };
        break;
      }
      out.push(v);
    }
    return out;
  }
  function options(g) {
    const opt = [];
    g.queue.forEach((col, k) => { if (col.length) opt.push({ from: 'q', k, s: col[0] }); });
    g.bench.forEach((s, k) => { if (s) opt.push({ from: 'b', k, s }); });
    return opt;
  }
  function bestMove(g) {
    const busy = new Set(g.belt.map((x) => x.c));
    let best = null, bs = -1;
    for (const o of options(g)) {
      if (busy.has(o.s.c)) continue;
      const h = hitsNow(g, o.s.c);
      if (!h) continue;
      const sc = o.s.ammo <= h ? 1000 + o.s.ammo + (o.from === 'b' ? 5 : 0) : h - (o.s.ammo - h) * 0.3;
      if (sc > bs) { bs = sc; best = o; }
    }
    return best;
  }

  // ---------- bot ----------
  // dikkatli | sayan (sayisi hedefleri gecmeyen fili gonderir) | orta (en cok vuran) | rastgele
  function botPlay(L, style, seed, opts) {
    opts = opts || {};
    const g = newGame(L, opts);
    const rnd = rng((seed || 1) * 2654435761);
    const dt = 1 / 30;
    let next = 0.4;
    const idle = () => !g.belt.length && !g.shots.length && !g.flying.length;
    const anyQ = (opt) => { const qs = opt.filter((o) => o.from === 'q'); const a = qs.length ? qs : opt; return a[Math.floor(rnd() * a.length)]; };
    while (g.state === 'play' && g.t < (opts.maxT || 900)) {
      step(g, dt);
      g.ev.length = 0;
      if (g.t < next || g.state !== 'play') continue;
      const opt = options(g);
      if (!opt.length || canLaunch(g)) { next = g.t + 0.1; continue; }
      let pick = null;
      if (style === 'rastgele') { pick = opt[Math.floor(rnd() * opt.length)]; next = g.t + 0.5 + rnd() * 0.8; }
      else if (style === 'orta') {
        const busy = new Set(g.belt.map((x) => x.c)); let bs = 0;
        for (const o of opt) { if (busy.has(o.s.c)) continue; const h = hitsNow(g, o.s.c, o.s.ammo) + (o.from === 'b' ? 0.5 : 0) + rnd() * 0.3; if (h > bs) { bs = h; pick = o; } }
        if (bs < 2) pick = idle() ? anyQ(opt) : null;
        next = g.t + 0.5 + rnd() * 0.4;
      } else if (style === 'sayan') {
        const busy = new Set(g.belt.map((x) => x.c)), freeB = g.bench.filter((x) => !x).length; let bs = -1;
        for (const o of opt) {
          if (busy.has(o.s.c)) continue;
          const h = hitsNow(g, o.s.c); if (!h) continue;
          const sc = o.s.ammo <= h ? 1000 + o.s.ammo + (o.from === 'b' ? 5 : 0) : (freeB >= 2 || o.from === 'b' ? h - (o.s.ammo - h) * 0.3 : -1);
          if (sc > bs) { bs = sc; pick = o; }
        }
        if (bs < 0) pick = idle() ? anyQ(opt) : null;
        next = g.t + 0.5 + rnd() * 0.4;
      } else {
        const onBelt = {}; g.belt.forEach((s) => { onBelt[s.c] = (onBelt[s.c] || 0) + s.ammo; });
        const freeB = g.bench.filter((x) => !x).length; let bs = 0;
        for (const o of opt) {
          let h = hitsNow(g, o.s.c); if (onBelt[o.s.c]) h = Math.max(0, h - onBelt[o.s.c]);
          const use = Math.min(h, o.s.ammo), back = o.s.ammo > h;
          const sc = use + (back ? (o.from === 'b' ? 0 : -1.5 * g.W / 7 + freeB * 0.3) : 2 * g.W / 7) + (o.from === 'b' ? 1 : 0) + rnd() * 0.3;
          if (use > 0 && sc > bs) { bs = sc; pick = o; }
        }
        if (!pick && idle()) pick = anyQ(opt);
        next = g.t + 0.35 + rnd() * 0.3;
      }
      if (pick) launch(g, pick.from, pick.k);
    }
    return { L, style, win: g.state === 'win', t: Math.round(g.t), left: g.left, total: g.total, launches: g.launches, topups: g.topups, prog: Math.round(100 * (1 - g.left / g.total)) };
  }

  return { setLib, colHits, level, planFor, newGame, step, launch, canLaunch, hitsNow, frontierOf, laneOf, bestMove, targetIn, face, botPlay, revive, rng };
});
