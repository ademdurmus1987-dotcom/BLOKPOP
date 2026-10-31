// BLOKPOP Buz (prototip v2) - oyun motoru
// Tarayicida ve Node'da (bot) ayni kod calisir. Cizim yok, sadece kurallar.
//
// Tahta: W sutun x H sira buyuk buz blogu; arkasinda bir resim var (beta/bg).
// Kurallar:
//  - Bant tahtanin altinda soldan saga tek yon akar.
//  - Fil bir sutunun altindan gecerken o sutunda ALTTAN ilk buz bloguna bakar:
//      buz (fil rengi)    -> vurur, buz kirilir, arkadaki resim acilir
//      kalin buz          -> 2 atista kirilir
//      tahta              -> hangi renk olursa olsun vurur
//      zincir             -> once zincirin rengindeki fil kirar, sonra buz kendi rengiyle
//      kilit              -> vurulamaz; anahtari baska bir buzun icinden cikinca acilir
//      baska renk         -> atis yok (onu kapali)
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
  // c: renk sayisi, K: oluk sayisi, a: fil mermisi araligi, mix: kuyruk karisikligi
  // thick/wood/chain: bloklarin orani; lock: kilit grubu sayisi
  const PLAN = {
    1: { c: 3, K: 3, a: [4, 7], mix: 0.3, bench: 6 },
    2: { c: 3, K: 3, a: [4, 8], mix: 0.5, bench: 6 },
    3: { c: 3, K: 3, a: [4, 8], mix: 0.8, bench: 5, thick: 0.12, tip: 'thick' },
    4: { c: 4, K: 4, a: [4, 8], mix: 1, bench: 5, thick: 0.14 },
    5: { c: 4, K: 4, a: [4, 8], mix: 1, bench: 5, wood: 0.12, tip: 'wood' },
    6: { c: 4, K: 4, a: [4, 8], mix: 1, bench: 5, wood: 0.1, thick: 0.08 },
    7: { c: 4, K: 4, a: [4, 8], mix: 1, chain: 0.1, tip: 'chain' },
    8: { c: 4, K: 4, a: [4, 8], mix: 1, chain: 0.1, wood: 0.06 },
    9: { c: 4, K: 4, a: [4, 8], mix: 1, lock: 1, tip: 'lock' },
    10: { c: 5, K: 4, a: [4, 8], mix: 1, lock: 1, thick: 0.1 }
  };
  const COMBOS = [['thick', 'wood'], ['chain', 'thick'], ['lock', 'wood'], ['chain', 'lock'], ['thick', 'wood', 'chain'],
    ['thick'], ['lock', 'chain'], ['wood', 'lock'], ['thick', 'chain', 'lock'], ['thick', 'wood', 'chain', 'lock']];
  function planFor(L) {
    if (PLAN[L]) return Object.assign({ bench: 4, belt: 4 }, PLAN[L]);
    const k = L - 11, combo = COMBOS[k % COMBOS.length], round = Math.floor(k / COMBOS.length);
    const dens = Math.min(0.16, 0.08 + 0.015 * round);
    const hard = (L % 10 === 0) ? 1 : 0, easy = (L % 10 === 6) ? 1 : 0;
    const p = { c: L <= 25 ? 4 : 5, K: 4, a: [4, 8], mix: 1 + 0.3 * hard - 0.3 * easy, bench: 4, belt: 4 };
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
    const W = SRC.W, H = SRC.H;
    const pic = SRC.pics[(L - 1) % SRC.pics.length];
    const kk = pic.k[String(Math.max(3, Math.min(6, P.c)))] || pic.k['4'];
    const pal = kk.pal.slice();
    const rnd = rng((seed == null ? L * 7919 + 13 : seed) >>> 0);
    const cells = [];
    for (let i = 0; i < W * H; i++) { const v = +kk.g[i]; cells.push({ c: v, layers: [{ t: 'ice', c: v }], key: -1, done: false, pend: 0 }); }
    const idx = (r, c) => r * W + c;
    const live = () => cells.map((x, i) => i).filter((i) => !cells[i].done);
    const plain = (i) => !cells[i].done && cells[i].layers.length === 1 && cells[i].layers[0].t === 'ice' && cells[i].key < 0;
    const total = W * H;
    // kilitler once, anahtarlar sonra (anahtar kilitsiz sutunda -> kilit dongusu olmaz)
    const locks = [], lockCols = new Set();
    for (let gi = 0; gi < (P.lock || 0); gi++) {
      let placed = null;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const r = ri(rnd, Math.floor(H * 0.35), H - 2), w = ri(rnd, 1, 2), c0 = ri(rnd, 0, W - w);
        const cs = [];
        for (let c = c0; c < c0 + w; c++) { if (!plain(idx(r, c)) || lockCols.has(c) || r < 2) break; cs.push(c); }
        if (cs.length === w) placed = { r, cs };
      }
      if (!placed) continue;
      const lk = { id: locks.length, cells: [], key: -1 };
      for (const c of placed.cs) { const i = idx(placed.r, c); cells[i].layers.unshift({ t: 'lock', id: lk.id }); lk.cells.push(i); lockCols.add(c); }
      locks.push(lk);
    }
    for (const lk of locks) {
      const cand = live().filter((i) => {
        const r = Math.floor(i / W), c = i % W;
        return !lockCols.has(c) && plain(i) && (H - 1 - r) >= 2 && (H - 1 - r) <= H * 0.65;
      });
      const pick = cand.length ? cand : live().filter((i) => !lockCols.has(i % W) && plain(i));
      if (!pick.length) { for (const i of lk.cells) cells[i].layers.shift(); lk.cells = []; continue; }
      const i = pick[Math.floor(rnd() * pick.length)];
      cells[i].key = lk.id; lk.key = i;
    }
    const colorsCnt = pal.map(() => 0);
    cells.forEach((x) => { colorsCnt[x.c]++; });
    function sprinkle(frac, apply) {
      const k = Math.round(total * (frac || 0));
      if (!k) return 0;
      const cand = shuffle(live().filter(plain), rnd).slice(0, k);
      cand.forEach(apply);
      return cand.length;
    }
    const nThick = sprinkle(P.thick, (i) => { cells[i].layers.push({ t: 'ice', c: cells[i].c }); });
    const nWood = sprinkle(P.wood, (i) => { cells[i].layers.unshift({ t: 'wood' }); });
    const nChain = sprinkle(P.chain, (i) => {
      const own = cells[i].c, opts = [];
      pal.forEach((_, ci) => { if (ci !== own) for (let k = 0; k < colorsCnt[ci]; k++) opts.push(ci); });
      if (!opts.length) return;
      cells[i].layers.unshift({ t: 'chain', c: opts[Math.floor(rnd() * opts.length)] });
    });
    const lv = { L, pic: pic.f, crop: pic.crop, W, H, pal, cells, locks, plan: P, seed,
      counts: { total, thick: nThick, wood: nWood, chain: nChain, lock: locks.filter((l) => l.cells.length).length } };
    lv.queue = planQueue(lv, rnd);
    return lv;
  }

  // ---------- kuyruk ----------
  function needOf(cells, ncol) {
    const need = new Array(ncol).fill(0); let wood = 0;
    for (const x of cells) {
      if (x.done) continue;
      for (let j = x.pend; j < x.layers.length; j++) {
        const y = x.layers[j];
        if (y.t === 'wood') wood++; else if (y.t === 'ice' || y.t === 'chain') need[y.c]++;
      }
    }
    return { need, wood };
  }
  function cloneCells(cells) { return cells.map((x) => ({ c: x.c, layers: x.layers.map((y) => Object.assign({}, y)), key: x.key, done: x.done, pend: x.pend })); }
  // sutunda alttan ilk buz; bu renk vurabilir mi? (satir no ya da -1)
  function targetIn(cells, W, H, col, color) {
    for (let r = H - 1; r >= 0; r--) {
      const x = cells[r * W + col];
      if (x.done || x.pend >= x.layers.length) continue;
      const y = x.layers[x.pend];
      if (y.t === 'lock') return -1;
      if (y.t === 'wood') return r;
      return y.c === color ? r : -1;
    }
    return -1;
  }
  function unlockIn(cells, locks, id) {
    const lk = locks[id]; if (!lk) return;
    for (const i of lk.cells) { const x = cells[i]; if (x.layers.length && x.layers[0].t === 'lock') x.layers.shift(); }
  }
  function hitAbstract(cells, locks, i) {
    const x = cells[i];
    x.layers.shift();
    if (!x.layers.length) { x.done = true; if (x.key >= 0) unlockIn(cells, locks, x.key); }
  }
  function planQueue(lv, rnd) {
    const P = lv.plan, W = lv.W, H = lv.H, C = lv.pal.length;
    const { need, wood } = needOf(lv.cells, C);
    const chunks = [];
    for (let c = 0; c < C; c++) {
      let rem = need[c];
      while (rem > 0) {
        const s = rem <= P.a[1] ? rem : ri(rnd, P.a[0], Math.min(P.a[1], rem - P.a[0]));
        chunks.push({ c, a: s }); rem -= s;
      }
    }
    for (let k = 0; k < wood; k++) chunks[Math.floor(rnd() * chunks.length)].a++;
    // aç gozlu sira: o an en cok isabet edecek renk once
    const st = cloneCells(lv.cells), locks = lv.locks;
    const pool = chunks.slice(), order = [];
    let guard = 0;
    while (pool.length && guard++ < 500) {
      const score = new Array(C).fill(0);
      for (let col = 0; col < W; col++) for (let c = 0; c < C; c++) {
        const r = targetIn(st, W, H, col, c);
        if (r >= 0) score[c] += st[r * W + col].layers[0].t === 'wood' ? 0.4 : 1;
      }
      let bc = -1, bs = -1;
      for (const ch of pool) { const s = score[ch.c] + rnd() * 0.5; if (s > bs) { bs = s; bc = ch.c; } }
      const mine = pool.filter((ch) => ch.c === bc);
      const ch = mine[Math.floor(rnd() * mine.length)];
      pool.splice(pool.indexOf(ch), 1);
      order.push({ c: ch.c, ammo: ch.a });
      let ammo = ch.a;
      for (let pass = 0; pass < 8 && ammo > 0; pass++) {
        let hits = 0;
        for (let col = 0; col < W && ammo > 0; col++) {
          const r = targetIn(st, W, H, col, ch.c);
          if (r >= 0) { hitAbstract(st, locks, r * W + col); ammo--; hits++; }
        }
        if (!hits) break;
      }
    }
    const swaps = Math.round(order.length * (P.mix || 0));
    for (let k = 0; k < swaps; k++) {
      const i = Math.floor(rnd() * (order.length - 1));
      const t = order[i]; order[i] = order[i + 1]; order[i + 1] = t;
    }
    const cols = [];
    for (let k = 0; k < P.K; k++) cols.push([]);
    order.forEach((s, i) => cols[i % P.K].push(s));
    return cols;
  }

  // ---------- oyun ----------
  const X0 = -1.0, SPACING = 1.25, T_CROSS = 3.2, SHOT_V = 22, KEY_T = 0.8;
  function newGame(L, opts) {
    opts = opts || {};
    const lv = level(L, opts.seed, opts.plan);
    const P = lv.plan;
    let id = 0;
    const g = {
      L, lv, W: lv.W, H: lv.H, pal: lv.pal, cells: cloneCells(lv.cells),
      locks: lv.locks.map((l) => ({ id: l.id, cells: l.cells.slice(), key: l.key, open: !l.cells.length })),
      queue: lv.queue.map((col) => col.map((s) => ({ id: ++id, c: s.c, ammo: s.ammo, x: 0 }))),
      bench: new Array(opts.bench || P.bench).fill(null),
      belt: [], shots: [], keys: [], ev: [],
      maxBelt: P.belt, speed: (lv.W + 2) / (opts.tcross || T_CROSS),
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
    const C = g.pal.length, { need, wood } = needOf(g.cells, C), have = new Array(C).fill(0);
    allShooters(g).forEach((s) => { have[s.c] += s.ammo; });
    for (let c = 0; c < C; c++) if (have[c] < need[c]) { addAmmo(g, c, need[c] - have[c]); have[c] = need[c]; }
    let surplus = 0;
    for (let c = 0; c < C; c++) surplus += Math.max(0, have[c] - need[c]);
    if (surplus < wood) { let c = 0; for (let k = 1; k < C; k++) if (need[k] > need[c]) c = k; addAmmo(g, c, wood - surplus); }
  }
  function useless(g, c) { const { need, wood } = needOf(g.cells, g.pal.length); return need[c] === 0 && wood === 0; }
  // isi biten renkteki filler (vuracak hicbir sey kalmadi) eve doner
  function sweepUseless(g) {
    const { need, wood } = needOf(g.cells, g.pal.length);
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
    for (const s of g.belt) if (s.x < X0 + SPACING) return 'busy';
    return '';
  }
  function launch(g, from, k) {
    const why = canLaunch(g);
    if (why) return why;
    let s;
    if (from === 'q') { const col = g.queue[k]; if (!col || !col.length) return 'empty'; s = col.shift(); }
    else { s = g.bench[k]; if (!s) return 'empty'; g.bench[k] = null; }
    s.x = X0; s.from = from; s.fromK = k; s.launchT = g.t; s.gone = false;
    g.belt.push(s); g.launches++;
    g.ev.push({ t: 'launch', s, from, k });
    return '';
  }
  function tryFire(g, s, col) {
    const r = targetIn(g.cells, g.W, g.H, col, s.c);
    if (r < 0) return false;
    const i = r * g.W + col, x = g.cells[i], y = x.layers[x.pend];
    x.pend++;
    s.ammo--;
    const dist = (g.H - r) + 0.5;
    g.shots.push({ i, r, col, c: s.c, kind: y.t, t0: g.t, t1: g.t + dist / SHOT_V, sid: s.id });
    g.ev.push({ t: 'fire', s, r, col, kind: y.t });
    if (y.t === 'wood') topUp(g);
    if (s.ammo <= 0) { s.gone = true; s.goneT = g.t; g.ev.push({ t: 'empty', s }); }
    return true;
  }
  function impact(g, sh) {
    const x = g.cells[sh.i];
    const y = x.layers.shift();
    x.pend--;
    const done = !x.layers.length;
    x.hits = (x.hits || 0) + 1;
    if (y.t === 'ice' && !done) x.crk = 1;
    g.ev.push({ t: 'hit', i: sh.i, r: sh.r, col: sh.col, kind: y.t, c: y.t === 'wood' ? -1 : y.c, done, cellC: x.c });
    if (done) {
      x.done = true; g.left--;
      if (x.key >= 0) {
        const lk = g.locks[x.key];
        if (lk && !lk.open) { g.keys.push({ id: lk.id, from: sh.i, t0: g.t, t1: g.t + KEY_T }); g.ev.push({ t: 'key', id: lk.id, from: sh.i }); }
      }
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
      if (s.x < W + 1) continue;
      g.belt.splice(j, 1);
      if (useless(g, s.c)) { g.ev.push({ t: 'leave', s, from: 'belt' }); continue; }
      const k = g.bench.indexOf(null);
      if (k < 0) { g.state = 'lose'; g.endT = g.t; g.lostBy = s; g.ev.push({ t: 'lose', s }); return; }
      g.bench[k] = s; s.benchT = g.t;
      g.ev.push({ t: 'bench', s, k });
    }
    for (let j = g.shots.length - 1; j >= 0; j--) {
      const sh = g.shots[j];
      if (g.t >= sh.t1) { g.shots.splice(j, 1); impact(g, sh); }
    }
    for (let j = g.keys.length - 1; j >= 0; j--) {
      const k = g.keys[j];
      if (g.t >= k.t1) {
        g.keys.splice(j, 1);
        const lk = g.locks[k.id];
        if (lk && !lk.open) { lk.open = true; unlockIn(g.cells, g.locks, k.id); g.ev.push({ t: 'unlock', id: k.id, cells: lk.cells.slice() }); }
      }
    }
    if (g.left <= 0 && !g.shots.length) { g.state = 'win'; g.endT = g.t; g.ev.push({ t: 'win' }); }
  }
  // kaybettikten sonra +1 bekleme yeriyle devam (prototip)
  function revive(g) {
    if (g.state !== 'lose' || !g.lostBy) return false;
    g.bench.push(g.lostBy); g.lostBy.benchT = g.t; g.lostBy = null;
    g.state = 'play'; g.revives = (g.revives || 0) + 1;
    return true;
  }

  // ---------- sorgular (ipucu / bot / cizim) ----------
  function hitsNow(g, color, cap) {
    let h = 0;
    for (let col = 0; col < g.W; col++) if (targetIn(g.cells, g.W, g.H, col, color) >= 0) h++;
    return cap != null ? Math.min(h, cap) : h;
  }
  function frontierOf(g) {
    const f = [];
    for (let col = 0; col < g.W; col++) {
      let v = -1;
      for (let r = g.H - 1; r >= 0; r--) { const x = g.cells[r * g.W + col]; if (x.done || x.pend >= x.layers.length) continue; v = r; break; }
      f.push(v);
    }
    return f;
  }
  // her sutunda filin gorecegi ilk hedef: {t, c, r} ya da null
  function laneOf(g) {
    const out = [];
    for (let col = 0; col < g.W; col++) {
      let v = null;
      for (let r = g.H - 1; r >= 0; r--) {
        const x = g.cells[r * g.W + col];
        if (x.done || x.pend >= x.layers.length) continue;
        const y = x.layers[x.pend];
        v = { t: y.t, c: y.t === 'ice' || y.t === 'chain' ? y.c : -1, r };
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
  // ipucu: sayisi kadar hedefi olan fil (yoksa en cok vuran)
  function bestMove(g) {
    const busy = new Set(g.belt.map((x) => x.c));
    let best = null, bs = -1;
    for (const o of options(g)) {
      if (busy.has(o.s.c)) continue;
      const h = hitsNow(g, o.s.c);
      if (!h) continue;
      const sc = o.s.ammo <= h ? 100 + o.s.ammo + (o.from === 'b' ? 5 : 0) : h - (o.s.ammo - h) * 0.3;
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
    const idle = () => !g.belt.length && !g.shots.length && !g.keys.length;
    const anyQ = (opt) => { const qs = opt.filter((o) => o.from === 'q'); const a = qs.length ? qs : opt; return a[Math.floor(rnd() * a.length)]; };
    while (g.state === 'play' && g.t < (opts.maxT || 600)) {
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
          const sc = o.s.ammo <= h ? 100 + o.s.ammo + (o.from === 'b' ? 5 : 0) : (freeB >= 2 || o.from === 'b' ? h - (o.s.ammo - h) * 0.3 : -1);
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
          const sc = use + (back ? (o.from === 'b' ? 0 : -1.5 + freeB * 0.3) : 2) + (o.from === 'b' ? 1 : 0) + rnd() * 0.3;
          if (use > 0 && sc > bs) { bs = sc; pick = o; }
        }
        if (!pick && idle()) pick = anyQ(opt);
        next = g.t + 0.35 + rnd() * 0.3;
      }
      if (pick) launch(g, pick.from, pick.k);
    }
    return { L, style, win: g.state === 'win', t: Math.round(g.t), left: g.left, total: g.total, launches: g.launches, topups: g.topups, prog: Math.round(100 * (1 - g.left / g.total)) };
  }

  return { setLib, level, planFor, newGame, step, launch, canLaunch, hitsNow, frontierOf, laneOf, bestMove, targetIn, botPlay, revive, rng, X0, SPACING };
});
