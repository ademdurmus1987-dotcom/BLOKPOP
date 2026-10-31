// BLOKPOP Buz (prototip) - oyun motoru
// Tarayicida ve Node'da (bot) ayni kod calisir. Cizim yok, sadece kurallar.
//
// Kurallar:
//  - Tahta dikey durur, bant altinda soldan saga tek yon akar.
//  - Fil bir sutunun altindan gecerken o sutunda ALTTAN ilk bitmemis kupe bakar:
//      buz (fil rengi)    -> vurur, buz kirilir, renk ortaya cikar
//      kalin buz          -> 2 atista kirilir
//      tahta              -> hangi renk olursa olsun vurur
//      zincir             -> once zincirin rengindeki fil kirar, sonra buz kendi rengiyle
//      kilit              -> vurulamaz; anahtari baska bir kupun icinden cikinca acilir
//      baska renk         -> atis yok (onu kapali)
//  - Bandin sonunda mermisi kalan fil bekleme yerine doner; yer yoksa oyun biter.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BZM = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let LIB = null;
  function setLib(l) { LIB = l; }

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
  function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  // algiya yakin renk farki (redmean)
  function cdist(a, b) { const x = hexRGB(a), y = hexRGB(b), r = (x[0] + y[0]) / 2, dr = x[0] - y[0], dg = x[1] - y[1], db = x[2] - y[2]; return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db); }

  // ---------- resim ----------
  function decode(i) {
    const [name, n, pal, rle] = LIB.pics[i];
    const flat = [];
    rle.replace(/([A-Z.])(\d*)/g, (m, ch, k) => {
      const v = ch === '.' ? -1 : ch.charCodeAt(0) - 65;
      for (let j = 0, K = k ? +k : 1; j < K; j++) flat.push(v >= pal.length ? -1 : v);
      return '';
    });
    const g = [];
    for (let r = 0; r < n; r++) g.push(flat.slice(r * n, r * n + n));
    return { name, pal: pal.slice(), g, n };
  }
  function resample(g, T) {
    const n = g.length; T = Math.min(T, n);
    const out = [];
    for (let r = 0; r < T; r++) {
      const row = [];
      const y0 = Math.floor(r * n / T), y1 = Math.max(y0 + 1, Math.floor((r + 1) * n / T));
      for (let c = 0; c < T; c++) {
        const x0 = Math.floor(c * n / T), x1 = Math.max(x0 + 1, Math.floor((c + 1) * n / T));
        const cnt = {}; let tot = 0, emp = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = g[y][x]; tot++; if (v < 0) emp++; else cnt[v] = (cnt[v] || 0) + 1; }
        if (emp * 2 > tot) { row.push(-1); continue; }
        let best = -1, bn = -1; for (const k in cnt) if (cnt[k] > bn) { bn = cnt[k]; best = +k; }
        row.push(best);
      }
      out.push(row);
    }
    return out;
  }
  // arka fonu kes: kenardan baslayan baskin rengi bosalt (sadece karakter kalsin)
  function cutBg(g) {
    const n = g.length, cnt = {}; let tot = 0;
    for (let i = 0; i < n; i++) for (const v of [g[0][i], g[n - 1][i], g[i][0], g[i][n - 1]]) { if (v >= 0) cnt[v] = (cnt[v] || 0) + 1; tot++; }
    let bg = -1, bn = 0; for (const k in cnt) if (cnt[k] > bn) { bn = cnt[k]; bg = +k; }
    if (bg < 0 || bn < tot * 0.5) return g;
    const h = g.map((r) => r.slice()), st = [];
    for (let i = 0; i < n; i++) st.push([0, i], [n - 1, i], [i, 0], [i, n - 1]);
    while (st.length) {
      const [r, c] = st.pop();
      if (r < 0 || c < 0 || r >= n || c >= n || h[r][c] !== bg) continue;
      h[r][c] = -1; st.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
    }
    // kucuk kirintilari temizle
    const seen = h.map((r) => r.map(() => false));
    for (let r0 = 0; r0 < n; r0++) for (let c0 = 0; c0 < n; c0++) {
      if (h[r0][c0] < 0 || seen[r0][c0]) continue;
      const comp = [], s2 = [[r0, c0]]; seen[r0][c0] = true;
      while (s2.length) {
        const [r, c] = s2.pop(); comp.push([r, c]);
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && rr < n && cc < n && !seen[rr][cc] && h[rr][cc] >= 0) { seen[rr][cc] = true; s2.push([rr, cc]); }
        }
      }
      if (comp.length <= 3) comp.forEach(([r, c]) => { h[r][c] = -1; });
    }
    let left = 0; h.forEach((r) => r.forEach((v) => { if (v >= 0) left++; }));
    return left < n * n * 0.22 ? g : h;
  }
  // renk sayisini azalt, birbirine cok benzeyen renkleri birlestir (buz altinda karismasin)
  function reduceColors(g, pal, maxC, minD) {
    const MIN_D = minD || 140;
    for (;;) {
      const cnt = {};
      let tot = 0;
      g.forEach((r) => r.forEach((v) => { if (v >= 0) { cnt[v] = (cnt[v] || 0) + 1; tot++; } }));
      const ks = Object.keys(cnt).map(Number);
      let from = -1, to = -1, best = 1e18, forced = false;
      for (const a of ks) for (const b of ks) {
        if (a === b) continue;
        const d = cdist(pal[a], pal[b]);
        // cok benzeyen ya da cok az kupu olan renk (tek mermili fil olmasin) en yakinina katilir
        const rare = ks.length > 2 && cnt[a] < Math.max(5, tot * 0.04);
        if ((d < MIN_D || rare) && cnt[a] <= cnt[b]) { const cost = d + (rare ? 0 : 1000); if (!forced || cost < best) { forced = true; best = cost; from = a; to = b; } }
      }
      if (!forced) {
        if (ks.length <= maxC) break;
        best = 1e18;
        for (const a of ks) for (const b of ks) {
          if (a === b) continue;
          const cost = cnt[a] * (cdist(pal[a], pal[b]) + 20);
          if (cost < best) { best = cost; from = a; to = b; }
        }
      }
      g.forEach((r) => { for (let i = 0; i < r.length; i++) if (r[i] === from) r[i] = to; });
    }
    const used = [];
    g.forEach((r) => r.forEach((v) => { if (v >= 0 && used.indexOf(v) < 0) used.push(v); }));
    used.sort((a, b) => a - b);
    return { g: g.map((r) => r.map((v) => (v < 0 ? -1 : used.indexOf(v)))), pal: used.map((i) => pal[i]) };
  }

  // ---------- seviye plani ----------
  // thick/wood/chain: resim kuplerinin orani; lock: kilit grubu sayisi
  const PLAN = {
    1: { n: 12, c: 3, K: 2, a: [5, 9], mix: 0.3, bench: 6 },
    2: { n: 12, c: 3, K: 2, a: [5, 10], mix: 0.5, bench: 6 },
    3: { n: 12, c: 4, K: 3, a: [6, 12], mix: 0.8, bench: 5, thick: 0.1, tip: 'thick' },
    4: { n: 13, c: 4, K: 3, a: [8, 14], mix: 1, bench: 5, thick: 0.14 },
    5: { n: 13, c: 4, K: 3, a: [8, 14], mix: 1, bench: 5, wood: 0.1, tip: 'wood' },
    6: { n: 13, c: 4, K: 3, a: [8, 14], mix: 1, bench: 5, wood: 0.08, thick: 0.08 },
    7: { n: 14, c: 4, K: 3, a: [8, 14], mix: 1, chain: 0.07, tip: 'chain' },
    8: { n: 14, c: 5, K: 3, a: [8, 14], mix: 1, chain: 0.08, wood: 0.05 },
    9: { n: 14, c: 4, K: 3, a: [8, 14], mix: 1, lock: 1, tip: 'lock' },
    10: { n: 14, c: 5, K: 3, a: [8, 14], mix: 1, lock: 1, thick: 0.08 }
  };
  const COMBOS = [['thick', 'wood'], ['chain', 'thick'], ['lock', 'wood'], ['chain', 'lock'], ['thick', 'wood', 'chain'],
    ['thick'], ['lock', 'chain'], ['wood', 'lock'], ['thick', 'chain', 'lock'], ['thick', 'wood', 'chain', 'lock']];
  function planFor(L) {
    if (PLAN[L]) return Object.assign({ bench: 4, belt: 5 }, PLAN[L]);
    const k = L - 11, combo = COMBOS[k % COMBOS.length], round = Math.floor(k / COMBOS.length);
    const dens = Math.min(0.13, 0.06 + 0.012 * round);
    const hard = (L % 10 === 0) ? 1 : 0, easy = (L % 10 === 6) ? 1 : 0;
    const p = {
      n: L <= 20 ? 14 : L <= 40 ? 15 : 16,
      c: L <= 30 ? 5 : 6,
      K: L <= 30 ? 3 : 4,
      a: L <= 30 ? [8, 14] : [8, 16],
      mix: 1 + 0.3 * hard - 0.3 * easy,
      bench: 4, belt: 5
    };
    for (const b of combo) {
      if (b === 'lock') p.lock = L >= 25 && combo.length <= 3 ? 2 : 1;
      else p[b] = dens * (combo.length >= 3 ? 0.75 : 1) * (easy ? 0.7 : 1);
    }
    return p;
  }

  // ---------- seviye uretimi ----------
  const BLANK = () => ({ c: -1, layers: [], key: -1, done: true, pend: 0 });
  function level(L, seed, over) {
    if (!LIB) throw new Error('resimler yuklenmedi');
    const P = Object.assign(planFor(L), over || {});
    const ord = LIB.order[(L - 1) % LIB.order.length];
    const pic = decode(ord[0]);
    let g = pic.g;
    if (ord[1]) g = g.map((r) => r.slice().reverse());
    g = resample(g, P.n);
    const red = reduceColors(P.bg ? g : cutBg(g), pic.pal, P.c, P.minD);
    g = red.g;
    const N = g.length, pal = red.pal;
    const rnd = rng((seed == null ? L * 7919 + 13 : seed) >>> 0);
    const cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = g[r][c];
      cells.push(v < 0 ? BLANK() : { c: v, layers: [{ t: 'ice', c: v }], key: -1, done: false, pend: 0 });
    }
    const idx = (r, c) => r * N + c;
    const live = () => cells.map((x, i) => i).filter((i) => !cells[i].done);
    const plain = (i) => !cells[i].done && cells[i].layers.length === 1 && cells[i].layers[0].t === 'ice' && cells[i].key < 0;
    const total = live().length;
    const locks = [];
    // kilitler: once kilitler, sonra anahtarlar (anahtar kilitsiz sutunda -> kilit dongusu olmaz)
    const lockCols = new Set();
    for (let gi = 0; gi < (P.lock || 0); gi++) {
      let placed = null;
      for (let tries = 0; tries < 200 && !placed; tries++) {
        const r = ri(rnd, Math.floor(N * 0.45), N - 2), w = ri(rnd, 1, 3), c0 = ri(rnd, 0, N - w);
        const cs = [];
        for (let c = c0; c < c0 + w; c++) {
          if (!plain(idx(r, c)) || lockCols.has(c)) break;
          let above = 0; for (let rr = 0; rr < r; rr++) if (!cells[idx(rr, c)].done) above++;
          if (above < 2) break;
          cs.push(c);
        }
        if (cs.length === w) placed = { r, cs };
      }
      if (!placed) continue;
      const lk = { id: locks.length, cells: [], key: -1, open: false };
      for (const c of placed.cs) { const i = idx(placed.r, c); cells[i].layers.unshift({ t: 'lock', id: lk.id }); lk.cells.push(i); lockCols.add(c); }
      locks.push(lk);
    }
    for (const lk of locks) {
      const cand = live().filter((i) => {
        const r = Math.floor(i / N), c = i % N;
        if (lockCols.has(c) || !plain(i)) return false;
        let below = 0; for (let rr = r + 1; rr < N; rr++) if (!cells[idx(rr, c)].done) below++;
        return below >= 2 && below <= N * 0.6;
      });
      const pickFrom = cand.length ? cand : live().filter((i) => !lockCols.has(i % N) && plain(i));
      if (!pickFrom.length) { // anahtar konamadi: kilidi kaldir
        for (const i of lk.cells) cells[i].layers.shift();
        lk.cells = []; lk.open = true; continue;
      }
      const i = pickFrom[Math.floor(rnd() * pickFrom.length)];
      cells[i].key = lk.id; lk.key = i;
    }
    const colorsCnt = pal.map(() => 0);
    cells.forEach((x) => { if (!x.done) colorsCnt[x.c]++; });
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
      // zincir rengi buzun renginden belirgin farkli olsun
      pal.forEach((_, ci) => { if (ci !== own && cdist(pal[ci], pal[own]) >= 150) for (let k = 0; k < colorsCnt[ci]; k++) opts.push(ci); });
      const d = opts.length ? opts[Math.floor(rnd() * opts.length)] : own;
      if (d === own) return;
      cells[i].layers.unshift({ t: 'chain', c: d });
    });
    const lv = { L, name: pic.name, N, pal, cells, locks, plan: P, seed, counts: { total, thick: nThick, wood: nWood, chain: nChain, lock: locks.filter((l) => l.cells.length).length } };
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
  // sutunda alttan ilk bitmemis kup; bu renk vurabilir mi?
  function targetIn(cells, N, col, color) {
    for (let r = N - 1; r >= 0; r--) {
      const x = cells[r * N + col];
      if (x.done || x.pend >= x.layers.length) continue;
      const y = x.layers[x.pend];
      if (y.t === 'lock') return -1;
      if (y.t === 'wood') return r;
      return y.c === color ? r : -1;
    }
    return -1;
  }
  function frontier(cells, N, col) {
    for (let r = N - 1; r >= 0; r--) {
      const x = cells[r * N + col];
      if (x.done || x.pend >= x.layers.length) continue;
      return r;
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
    const P = lv.plan, N = lv.N, C = lv.pal.length;
    const { need, wood } = needOf(lv.cells, C);
    // mermileri filere bol
    const chunks = [];
    for (let c = 0; c < C; c++) {
      let rem = need[c];
      while (rem > 0) {
        let s;
        if (rem <= P.a[1]) s = rem;
        else s = ri(rnd, P.a[0], Math.min(P.a[1], rem - P.a[0]));
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
      for (let col = 0; col < N; col++) {
        for (let c = 0; c < C; c++) {
          const r = targetIn(st, N, col, c);
          if (r >= 0) score[c] += st[r * N + col].layers[0].t === 'wood' ? 0.4 : 1;
        }
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
        for (let col = 0; col < N && ammo > 0; col++) {
          const r = targetIn(st, N, col, ch.c);
          if (r >= 0) { hitAbstract(st, locks, r * N + col); ammo--; hits++; }
        }
        if (!hits) break;
      }
    }
    // karistir (zorluk)
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
  const X0 = -1.2, SPACING = 2.0, T_CROSS = 3.0, SHOT_V = 32, KEY_T = 0.75;
  function newGame(L, opts) {
    opts = opts || {};
    const lv = level(L, opts.seed, opts.plan);
    const P = lv.plan;
    let id = 0;
    const g = {
      L, lv, N: lv.N, pal: lv.pal, cells: cloneCells(lv.cells), locks: lv.locks.map((l) => ({ id: l.id, cells: l.cells.slice(), key: l.key, open: !l.cells.length })),
      queue: lv.queue.map((col) => col.map((s) => ({ id: ++id, c: s.c, ammo: s.ammo, x: 0 }))),
      bench: new Array(opts.bench || P.bench).fill(null),
      belt: [], shots: [], keys: [], ev: [],
      maxBelt: P.belt, merge: !!P.merge, loop: !!P.loop, run: P.run === true ? 99 : (P.run | 0), speed: (lv.N + 2) / (opts.tcross || T_CROSS),
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
  // guvenlik: her rengin mermisi ihtiyacindan az olmasin (tahta yuzunden kayma olursa)
  function topUp(g) {
    const C = g.pal.length, { need, wood } = needOf(g.cells, C), have = new Array(C).fill(0);
    const all = allShooters(g);
    all.forEach((s) => { have[s.c] += s.ammo; });
    for (let c = 0; c < C; c++) {
      if (have[c] >= need[c]) continue;
      const add = need[c] - have[c];
      let tgt = null;
      for (let k = 0; k < g.queue.length && !tgt; k++) for (let j = g.queue[k].length - 1; j >= 0; j--) if (g.queue[k][j].c === c) { tgt = g.queue[k][j]; break; }
      if (!tgt) tgt = g.bench.find((s) => s && s.c === c) || null;
      if (tgt) tgt.ammo += add;
      else { let k = 0; g.queue.forEach((col, j) => { if (col.length < g.queue[k].length) k = j; }); g.queue[k].push({ id: ++g.nid, c, ammo: add, x: 0 }); }
      have[c] += add; g.topups++;
      g.ev.push({ t: 'topup', c, n: add });
    }
    let surplus = 0;
    for (let c = 0; c < C; c++) surplus += Math.max(0, have[c] - need[c]);
    if (surplus < wood) {
      let c = 0; for (let k = 1; k < C; k++) if (need[k] > need[c]) c = k;
      let tgt = null;
      for (let k = 0; k < g.queue.length && !tgt; k++) for (let j = g.queue[k].length - 1; j >= 0; j--) if (g.queue[k][j].c === c) { tgt = g.queue[k][j]; break; }
      if (tgt) tgt.ammo += wood - surplus;
      else { let k = 0; g.queue.forEach((col, j) => { if (col.length < g.queue[k].length) k = j; }); g.queue[k].push({ id: ++g.nid, c, ammo: wood - surplus, x: 0 }); }
      g.topups++;
    }
  }
  // isi biten renkteki filler (vuracak hicbir sey kalmadi) eve doner
  function useless(g, c) {
    const { need, wood } = needOf(g.cells, g.pal.length);
    return need[c] === 0 && wood === 0;
  }
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
    s.x = X0; s.from = from; s.launchT = g.t; s.gone = false;
    g.belt.push(s); g.launches++;
    g.ev.push({ t: 'launch', s, from, k });
    return '';
  }
  function tryFire(g, s, col) {
    let n = 0;
    for (;;) {
      const r = targetIn(g.cells, g.N, col, s.c);
      if (r < 0) break;
      const i = r * g.N + col, x = g.cells[i], y = x.layers[x.pend];
      if (n > 0 && y.t === 'wood') break; // delip gecen atis tahtada durur
      x.pend++;
      s.ammo--;
      const dist = (g.N - r) + 0.6;
      g.shots.push({ i, r, col, c: s.c, kind: y.t, t0: g.t, t1: g.t + dist / SHOT_V + n * 0.05, sid: s.id, n });
      g.ev.push({ t: 'fire', s, r, col, kind: y.t, n });
      if (y.t === 'wood') topUp(g);
      n++;
      if (s.ammo <= 0) { s.gone = true; s.goneT = g.t; g.ev.push({ t: 'empty', s }); break; }
      if (!g.run || y.t === 'wood' || n >= g.run) break;
    }
    return n > 0;
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
    const N = g.N;
    for (const s of g.belt) {
      if (s.gone) continue;
      const px = s.x; s.x += g.speed * dt;
      const c0 = Math.max(0, Math.floor(px - 0.5) + 1), c1 = Math.min(N - 1, Math.floor(s.x - 0.5));
      for (let c = c0; c <= c1 && !s.gone; c++) tryFire(g, s, c);
    }
    // bandin sonu
    for (let j = g.belt.length - 1; j >= 0; j--) {
      const s = g.belt[j];
      if (s.gone) { g.belt.splice(j, 1); continue; }
      if (s.x < N + 1) continue;
      g.belt.splice(j, 1);
      if (useless(g, s.c)) { g.ev.push({ t: 'leave', s, from: 'belt' }); continue; }
      // hala vuracak hedefi varsa bastan bir tur daha (bekleme yerine girmez)
      if (g.loop && hitsNow(g, s.c) > 0) {
        let minX = X0 + SPACING;
        for (const o of g.belt) if (!o.gone) minX = Math.min(minX, o.x);
        s.x = Math.min(X0, minX - SPACING); s.loopT = g.t; g.belt.push(s); g.loops = (g.loops || 0) + 1;
        g.ev.push({ t: 'loop', s });
        continue;
      }
      // ayni renk fil bekleme yerinde varsa birlesirler
      const m = g.merge ? g.bench.findIndex((b) => b && b.c === s.c) : -1;
      if (m >= 0) { g.bench[m].ammo += s.ammo; g.bench[m].mergeT = g.t; g.ev.push({ t: 'merge', s, into: g.bench[m], k: m }); continue; }
      const k = g.bench.indexOf(null);
      if (k < 0) { g.state = 'lose'; g.endT = g.t; g.lostBy = s; g.ev.push({ t: 'lose', s }); return; }
      g.bench[k] = s; s.benchT = g.t;
      g.ev.push({ t: 'bench', s, k });
    }
    // atislar
    for (let j = g.shots.length - 1; j >= 0; j--) {
      const sh = g.shots[j];
      if (g.t >= sh.t1) { g.shots.splice(j, 1); impact(g, sh); }
    }
    // anahtarlar
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

  // ---------- yardimci sorgular (ipucu / bot) ----------
  function hitsNow(g, color, cap) {
    let h = 0;
    for (let col = 0; col < g.N; col++) if (targetIn(g.cells, g.N, col, color) >= 0) h++;
    return cap != null ? Math.min(h, cap) : h;
  }
  // her sutunda filin gorecegi ilk hedef: {t:'ice'|'chain'|'wood'|'lock', c} ya da null
  function laneOf(g) {
    const out = [];
    for (let col = 0; col < g.N; col++) {
      let v = null;
      for (let r = g.N - 1; r >= 0; r--) {
        const x = g.cells[r * g.N + col];
        if (x.done || x.pend >= x.layers.length) continue;
        const y = x.layers[x.pend];
        v = { t: y.t, c: y.t === 'ice' || y.t === 'chain' ? y.c : -1, r };
        break;
      }
      out.push(v);
    }
    return out;
  }
  // ipucu: sayisi kadar hedefi olan fil (yoksa en cok vuran)
  function bestMove(g) {
    const opt = [];
    g.queue.forEach((col, k) => { if (col.length) opt.push({ from: 'q', k, s: col[0] }); });
    g.bench.forEach((s, k) => { if (s) opt.push({ from: 'b', k, s }); });
    const busy = new Set(g.belt.map((x) => x.c));
    let best = null, bs = -1;
    for (const o of opt) {
      if (busy.has(o.s.c)) continue;
      const h = hitsNow(g, o.s.c);
      if (!h) continue;
      const sc = o.s.ammo <= h ? 100 + o.s.ammo + (o.from === 'b' ? 5 : 0) : h - (o.s.ammo - h) * 0.3;
      if (sc > bs) { bs = sc; best = o; }
    }
    return best;
  }
  function frontierOf(g) {
    const f = [];
    for (let col = 0; col < g.N; col++) f.push(frontier(g.cells, g.N, col));
    return f;
  }

  // ---------- bot ----------
  // style: 'dikkatli' (o an isabet edecek fili gonderir) | 'rastgele' (dusunmeden dokunur)
  function botPlay(L, style, seed, opts) {
    opts = opts || {};
    const g = newGame(L, opts);
    const rnd = rng((seed || 1) * 2654435761);
    const dt = 1 / 30;
    let next = 0.4;
    while (g.state === 'play' && g.t < (opts.maxT || 600)) {
      step(g, dt);
      g.ev.length = 0;
      if (g.t < next || g.state !== 'play') continue;
      const opt = [];
      g.queue.forEach((col, k) => { if (col.length) opt.push({ from: 'q', k, s: col[0] }); });
      g.bench.forEach((s, k) => { if (s) opt.push({ from: 'b', k, s }); });
      if (!opt.length || canLaunch(g)) { next = g.t + 0.1; continue; }
      if (style === 'rastgele') {
        const o = opt[Math.floor(rnd() * opt.length)];
        launch(g, o.from, o.k);
        next = g.t + 0.5 + rnd() * 0.8;
        continue;
      }
      if (style === 'sayan') { // bant ustundeki renk noktalarini sayan oyuncu: sayisi kadar hedefi olan fili secer
        const busy = new Set(g.belt.map((x) => x.c)), freeB = g.bench.filter((x) => !x).length;
        let best = null, bs = -1;
        for (const o of opt) {
          if (busy.has(o.s.c)) continue;
          const h = hitsNow(g, o.s.c);
          if (!h) continue;
          const sc = o.s.ammo <= h ? 100 + o.s.ammo + (o.from === 'b' ? 5 : 0) : (freeB >= 2 || o.from === 'b' ? h - (o.s.ammo - h) * 0.3 : -1);
          if (sc > bs) { bs = sc; best = o; }
        }
        if (best && bs >= 0) launch(g, best.from, best.k);
        else if (!g.belt.length && !g.shots.length && !g.keys.length) { const qs = opt.filter((o) => o.from === 'q'); const o = (qs.length ? qs : opt)[Math.floor(rnd() * (qs.length ? qs : opt).length)]; launch(g, o.from, o.k); }
        next = g.t + 0.5 + rnd() * 0.4;
        continue;
      }
      if (style === 'orta') { // basit kural ogrenmis oyuncu: bantta ayni renk yoksa, en az 2 isabet edecek fili gonder
        const busy = new Set(g.belt.map((x) => x.c));
        let best = null, bs = 0;
        for (const o of opt) { if (busy.has(o.s.c)) continue; const h = hitsNow(g, o.s.c, o.s.ammo) + (o.from === 'b' ? 0.5 : 0) + rnd() * 0.3; if (h > bs) { bs = h; best = o; } }
        if (best && bs >= 2) launch(g, best.from, best.k);
        else if (!g.belt.length && !g.shots.length && !g.keys.length) { const qs = opt.filter((o) => o.from === 'q'); const o = (qs.length ? qs : opt)[Math.floor(rnd() * (qs.length ? qs : opt).length)]; launch(g, o.from, o.k); }
        next = g.t + 0.5 + rnd() * 0.4;
        continue;
      }
      if (style === 'acele') { // acemi ama istekli: o an en cok vuracak fili hemen gonderir, banttakileri dusunmez
        let best = null, bs = 0;
        for (const o of opt) { const h = hitsNow(g, o.s.c, o.s.ammo) + rnd() * 0.3; if (h > bs) { bs = h; best = o; } }
        if (best && bs >= 1) launch(g, best.from, best.k);
        next = g.t + 0.4 + rnd() * 0.3;
        continue;
      }
      // dikkatli: banttaki fillerin hedefleri de hesaba katilsin diye kaba tahmin
      const onBelt = {};
      g.belt.forEach((s) => { onBelt[s.c] = (onBelt[s.c] || 0) + s.ammo; });
      let best = null, bs = 0;
      const freeB = g.bench.filter((x) => !x).length;
      for (const o of opt) {
        let h = hitsNow(g, o.s.c);
        if (onBelt[o.s.c]) h = Math.max(0, h - onBelt[o.s.c]);
        const use = Math.min(h, o.s.ammo), back = o.s.ammo > h;
        // bosalacak fil iyi; geri donecekse ve yer azsa kotu
        let sc = use + (back ? (o.from === 'b' ? 0 : -1.5 + freeB * 0.3) : 2) + (o.from === 'b' ? 1 : 0) + rnd() * 0.3;
        if (use > 0 && sc > bs) { bs = sc; best = o; }
      }
      if (!best && !g.belt.length && !g.shots.length && !g.keys.length) {
        const qs = opt.filter((o) => o.from === 'q');
        best = (qs.length ? qs : opt)[Math.floor(rnd() * (qs.length ? qs : opt).length)];
      }
      if (best) launch(g, best.from, best.k);
      next = g.t + 0.35 + rnd() * 0.3;
    }
    return { L, style, win: g.state === 'win', t: Math.round(g.t), left: g.left, total: g.total, launches: g.launches, topups: g.topups, prog: Math.round(100 * (1 - g.left / g.total)) };
  }

  // kaybettikten sonra +1 bekleme yeriyle devam (prototip)
  function revive(g) {
    if (g.state !== 'lose' || !g.lostBy) return false;
    g.bench.push(g.lostBy); g.lostBy.benchT = g.t; g.lostBy = null;
    g.state = 'play'; g.revives = (g.revives || 0) + 1;
    return true;
  }

  return { setLib, revive, laneOf, bestMove, level, planFor, newGame, step, launch, canLaunch, hitsNow, frontierOf, targetIn, botPlay, rng, X0, SPACING };
});
