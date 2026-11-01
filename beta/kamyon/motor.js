// BLOKPOP Kamyon - oyun motoru (sadece kurallar, cizim yok). Tarayicida ve Node'da (bot) ayni kod calisir.
//
// Tahta: W x H renkli kup (resim). Etrafinda kare bir bant doner (saat yonu: alt kenar soldan saga, sag kenar yukari,
// ust kenar sola, sol kenar asagi). Kamyonlar bantta tahtaya donuk ilerler.
// Kurallar:
//  - Kamyon bir satirin/sutunun hizasindan gecerken o hatta KENARDAN ilk kupe bakar:
//      kendi renginde -> hortumuyla yutar (kasaya 1 kup), baska renk -> yutamaz (yol kapali).
//  - Kasa dolunca kamyon korna calip gider (banttan ayrilir). Bos/eksik kasayla gidemez.
//  - Bir turu dolmadan bitiren kamyon park yerine iner (yuku kasasinda kalir). Park yeri yoksa oyun biter.
//  - Rengi tahtada hic kalmamis kamyon (joker yuzunden) eksik yukle de gidebilir.
//  - Bantta ayni anda en fazla beltMax kamyon olur.
// Ozel kamyonlar: big (buyuk kasa), dbl (cift hortum: hatta ust uste iki kupu yutabilir), joker (her rengi yutar).
// Kilitli kamyon: lockAt kadar kamyon gidince acilir. Buzlu kup: iki yutusta biter (ilki buzu kirar).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KMM = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let SRC = null; // BZ_IZGARA (buz modunun resim kutuphanesi)
  function setLib(l) { SRC = l; }

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
  // size: tahta sutunu, c: renk, lanes: kuyruk, caps: kasa kapasiteleri (14'luk tahtaya gore), mix: kuyruk karisikligi
  // lock: kilitli kamyon, ice: buzlu kup orani, big/dbl/joker: ozel kamyon sayisi, park: park yeri
  const PLAN = {
    1: { size: 14, c: 3, lanes: 2, caps: [14], mix: 0, park: 5, beltMax: 4, tip: 'intro' },
    2: { size: 14, c: 4, lanes: 3, caps: [12, 16], mix: 1.5, park: 4, beltMax: 4 },
    3: { size: 14, c: 4, lanes: 3, caps: [12, 16], mix: 2.5, park: 4, beltMax: 4 },
    4: { size: 14, c: 5, lanes: 3, caps: [12, 16, 20], mix: 3, park: 4, beltMax: 3 },
    5: { size: 14, c: 5, lanes: 3, caps: [12, 16, 20], mix: 3, park: 3, beltMax: 3, tip: 'park' },
    6: { size: 14, c: 5, lanes: 3, caps: [8, 12, 16, 24], mix: 3.5, park: 3, beltMax: 3, tip: 'caps' },
    7: { size: 14, c: 6, lanes: 3, caps: [12, 16, 20, 28], mix: 3.5, park: 4, beltMax: 3 },
    8: { size: 14, c: 5, lanes: 4, caps: [12, 16, 20, 28], mix: 4, park: 3, beltMax: 3 },
    9: { size: 14, c: 6, lanes: 4, caps: [12, 16, 20, 28], mix: 4, park: 3, beltMax: 3 },
    10: { size: 14, c: 6, lanes: 4, caps: [16, 20, 28], mix: 4, park: 3, beltMax: 3 },
    11: { size: 14, c: 5, lanes: 3, caps: [12, 16, 20], mix: 3, park: 4, beltMax: 3, lock: 2, tip: 'lock' },
    12: { size: 14, c: 5, lanes: 4, caps: [12, 16, 20, 28], mix: 3.5, park: 3, beltMax: 3, lock: 2 },
    13: { size: 21, c: 5, lanes: 4, caps: [12, 16, 20], mix: 3, park: 4, beltMax: 3, lock: 2 },
    14: { size: 21, c: 5, lanes: 4, caps: [12, 16, 20, 28], mix: 3.5, park: 3, beltMax: 3, lock: 3 },
    15: { size: 21, c: 6, lanes: 4, caps: [16, 20, 28], mix: 4, park: 3, beltMax: 3, lock: 2 },
    16: { size: 14, c: 5, lanes: 3, caps: [12, 16, 20], mix: 3, park: 4, beltMax: 3, ice: 0.12, tip: 'ice' },
    17: { size: 21, c: 5, lanes: 4, caps: [12, 16, 20, 28], mix: 3.5, park: 3, beltMax: 3, ice: 0.12 },
    18: { size: 21, c: 6, lanes: 4, caps: [16, 20, 28], mix: 4, park: 3, beltMax: 3, ice: 0.12, lock: 2 },
    19: { size: 21, c: 5, lanes: 4, caps: [12, 16, 20, 28], mix: 4, park: 3, beltMax: 3, ice: 0.16 },
    20: { size: 21, c: 6, lanes: 4, caps: [16, 20, 28], mix: 4, park: 3, beltMax: 3, ice: 0.12, lock: 3 },
    21: { size: 14, c: 5, lanes: 3, caps: [12, 16, 20], mix: 3, park: 4, beltMax: 3, big: 2, tip: 'big' },
    22: { size: 21, c: 5, lanes: 4, caps: [12, 16, 20, 28], mix: 3.5, park: 3, beltMax: 3, big: 2, ice: 0.1 },
    23: { size: 14, c: 5, lanes: 3, caps: [12, 16, 20], mix: 3, park: 4, beltMax: 3, dbl: 2, tip: 'dbl' },
    24: { size: 21, c: 6, lanes: 4, caps: [16, 20, 28], mix: 4, park: 3, beltMax: 3, dbl: 2, lock: 2 },
    25: { size: 14, c: 5, lanes: 3, caps: [12, 16, 20], mix: 3, park: 4, beltMax: 3, joker: 1, tip: 'joker' }
  };
  const COMBOS = [['lock', 'ice'], ['big', 'lock'], ['dbl', 'ice'], ['joker', 'lock'], ['big', 'dbl'], ['ice', 'joker'], ['lock', 'dbl', 'ice'], ['big', 'joker', 'ice']];
  function planFor(L) {
    const base = { park: 3, beltMax: 3, mix: 4 };
    if (PLAN[L]) return Object.assign(base, PLAN[L]);
    const k = L - 26, combo = COMBOS[((k % COMBOS.length) + COMBOS.length) % COMBOS.length], round = Math.floor(k / COMBOS.length);
    const hard = (L % 10 === 0) ? 1 : 0, easy = (L % 10 === 6) ? 1 : 0;
    const p = Object.assign(base, { size: 21, c: hard ? 6 : 5, lanes: 4, caps: [12, 16, 20, 28] });
    if (easy) { p.c = 4; p.lanes = 3; p.park = 4; p.mix = 3; }
    for (const b of combo) {
      if (b === 'lock') p.lock = 2 + Math.min(2, round);
      else if (b === 'ice') p.ice = Math.min(0.2, 0.1 + 0.02 * round);
      else if (b === 'big') p.big = 2;
      else if (b === 'dbl') p.dbl = 2;
      else if (b === 'joker') p.joker = 1;
    }
    return p;
  }

  // ---------- geometri ----------
  // dunya birimi = 1 kup. Bant, tahta kenarindan OFF*u uzakta (u = W/14: buyuk tahtada her sey orantili buyur).
  function geom(W, H) {
    const u = W / 14, off = 1.8 * u, A = W / 2 + off, B = H / 2 + off, L = 4 * A + 4 * B;
    const lines = [];
    for (let c = 0; c < W; c++) { const xc = -W / 2 + c + 0.5, cells = []; for (let r = H - 1; r >= 0; r--) cells.push(r * W + c); lines.push({ s: xc + A, side: 0, k: c, cells }); }
    for (let r = H - 1; r >= 0; r--) { const zc = -H / 2 + r + 0.5, cells = []; for (let c = W - 1; c >= 0; c--) cells.push(r * W + c); lines.push({ s: 2 * A + (B - zc), side: 1, k: r, cells }); }
    for (let c = W - 1; c >= 0; c--) { const xc = -W / 2 + c + 0.5, cells = []; for (let r = 0; r < H; r++) cells.push(r * W + c); lines.push({ s: 2 * A + 2 * B + (A - xc), side: 2, k: c, cells }); }
    for (let r = 0; r < H; r++) { const zc = -H / 2 + r + 0.5, cells = []; for (let c = 0; c < W; c++) cells.push(r * W + c); lines.push({ s: 4 * A + 2 * B + (zc + B), side: 3, k: r, cells }); }
    lines.sort((a, b) => a.s - b.s);
    return { u, off, A, B, L, lines, speed: 12 * u, spacing: 2.2 * u };
  }
  // bant uzerindeki konum: x, z, yon (tahtaya bakis acisi: kamyon onu bu yone bakar), kenar
  function posAt(G, s) {
    const A = G.A, B = G.B; s = ((s % G.L) + G.L) % G.L;
    if (s < 2 * A) return { x: -A + s, z: B, side: 0 };
    s -= 2 * A; if (s < 2 * B) return { x: A, z: B - s, side: 1 };
    s -= 2 * B; if (s < 2 * A) return { x: A - s, z: -B, side: 2 };
    s -= 2 * A; return { x: -A, z: -B + s, side: 3 };
  }

  // ---------- seviye uretimi ----------
  function decodePic(L, P) {
    const sz = SRC.sizes.find((s) => s[0] === P.size) || SRC.sizes[0];
    const W = sz[0], H = sz[1];
    const pic = SRC.pics[(L - 1) % SRC.pics.length];
    const set = pic.s[String(W)], kk = set[String(Math.max(3, Math.min(6, P.c)))] || set['4'];
    const gs = kk.g || kk.r.replace(/([a-f])(\d*)/g, (m, ch, n) => String(ch.charCodeAt(0) - 97).repeat(n ? +n : 1));
    const grid = []; for (let i = 0; i < W * H; i++) grid.push(+gs[i]);
    return { W, H, pal: kk.pal.slice(), grid, pic };
  }
  function level(L, seed, over) {
    if (!SRC) throw new Error('resim kutuphanesi yuklenmedi');
    const P = Object.assign(planFor(L), over || {});
    const d = decodePic(L, P), W = d.W, H = d.H;
    const rnd = rng((seed == null ? L * 7919 + 101 : seed) >>> 0);
    // arka plan rengi: kenar hucrelerinde en cok gorunen renk (resim kupleri ondan yuksek cizilir)
    const edge = new Array(d.pal.length).fill(0); let ne = 0;
    for (let i = 0; i < W * H; i++) { const r = Math.floor(i / W), c = i % W; if (r === 0 || c === 0 || r === H - 1 || c === W - 1) { edge[d.grid[i]]++; ne++; } }
    let bgc = edge.indexOf(Math.max.apply(null, edge)); if (edge[bgc] < ne * 0.45) bgc = -1;
    const cells = d.grid.map((c) => ({ c, hp: 1, bg: c === bgc }));
    if (P.ice) { const idx = shuffle(cells.map((_, i) => i), rnd).slice(0, Math.round(W * H * P.ice)); for (const i of idx) cells[i].hp = 2; }
    const lv = { L, W, H, pal: d.pal, cells, bgc, plan: P, seed: seed == null ? null : seed, pic: d.pic.f, src: '../buz/' + (d.pic.src || ('resim/' + d.pic.f + '.webp')) };
    lv.lanes = planQueue(lv, rnd);
    return lv;
  }

  // renk basina kasa listesi
  function splitCaps(n, caps, u, rnd) {
    const cs = caps.map((c) => Math.max(3, Math.round(c * u))), out = [];
    let left = n;
    while (left > 0) {
      let c = cs[Math.floor(rnd() * cs.length)];
      if (left - c < Math.min.apply(null, cs) * 0.5) c = left;     // kucuk artik kalmasin
      if (c > left) c = left;
      out.push(c); left -= c;
    }
    return shuffle(out, rnd);
  }
  // soyut soyma: kamyonlarin ne zaman ise yarayacagina gore dogal bir sira cikarir, sonra karistirir
  function planQueue(lv, rnd) {
    const P = lv.plan, W = lv.W, H = lv.H, G = geom(W, H), nc = lv.pal.length;
    const hp = lv.cells.map((x) => x.hp), cnt = new Array(nc).fill(0);
    lv.cells.forEach((x) => cnt[x.c]++);
    const capsBy = cnt.map((n) => splitCaps(n, P.caps, G.u, rnd));
    const seq = [];
    const first = (ln) => { for (const i of ln.cells) if (hp[i] > 0) return i; return -1; };
    const expo = () => { const e = new Array(nc).fill(0), seen = new Set(); for (const ln of G.lines) { const i = first(ln); if (i >= 0 && !seen.has(i)) { seen.add(i); e[lv.cells[i].c]++; } } return e; };
    // bir kamyonu soyut olarak calistir: kasasi dolana ya da bir tur bos gecene kadar
    const run = (t) => { let eatenAny = true; while (t.left > 0 && eatenAny) { eatenAny = false; for (const ln of G.lines) { if (t.left <= 0) break; const i = first(ln); if (i >= 0 && lv.cells[i].c === t.c) { hp[i]--; if (hp[i] <= 0) { t.left--; } eatenAny = true; } } } };
    let open = [];
    let guard = 0;
    while (capsBy.some((a) => a.length) && guard++ < 4000) {
      open = open.filter((t) => { run(t); return t.left > 0; });
      const e = expo();
      // en cok acikta olan renk (biraz rastgelelik)
      let best = -1, bw = -1;
      for (let c = 0; c < nc; c++) { if (!capsBy[c].length) continue; const w = e[c] * (0.75 + rnd() * 0.5) + (e[c] > 0 ? 1 : 0); if (w > bw) { bw = w; best = c; } }
      const cap = capsBy[best].pop(), t = { c: best, cap, left: cap };
      seq.push({ c: best, cap });
      run(t); if (t.left > 0) open.push(t);
    }
    // ozel kamyonlar
    const pickIdx = (from, n, ok) => { const idx = []; for (let i = from; i < seq.length; i++) if (ok(seq[i])) idx.push(i); return shuffle(idx, rnd).slice(0, n); };
    let id = 0;
    seq.forEach((t) => { t.id = id++; t.kind = 'n'; t.lockAt = 0; });
    for (const i of pickIdx(2, P.big || 0, (t) => t.kind === 'n')) { // iki kamyonu birlestir: buyuk kasa
      const t = seq[i], j = seq.findIndex((o, k) => k > i && o.c === t.c && o.kind === 'n');
      if (j < 0) continue; t.cap += seq[j].cap; t.kind = 'big'; seq.splice(j, 1);
    }
    for (const i of pickIdx(2, P.dbl || 0, (t) => t.kind === 'n')) seq[i].kind = 'dbl';
    for (let q = 0; q < (P.joker || 0); q++) { const at = Math.min(seq.length, ri(rnd, 3, Math.max(4, Math.floor(seq.length * 0.5)))); seq.splice(at, 0, { id: id++, c: -1, cap: Math.max(4, Math.round(6 * G.u)), kind: 'joker', lockAt: 0 }); }
    // karistir: kuyruk sirasini biraz boz (dusunmeyi gerektirsin)
    const mix = P.mix || 0, nl = P.lanes;
    for (let k = 0; k < seq.length * mix * 1.2; k++) {
      const i = Math.floor(rnd() * seq.length), j = Math.min(seq.length - 1, i + 1 + Math.floor(rnd() * nl * 2));
      const t = seq[i]; seq[i] = seq[j]; seq[j] = t;
    }
    // kuyruklara dagit
    const lanes = []; for (let l = 0; l < nl; l++) lanes.push([]);
    seq.forEach((t, i) => lanes[i % nl].push(t));
    // kilitler: kuyrukta onde olmayan kamyonlara; o ana kadar gitmis olmasi beklenen kamyon sayisinin yarisi
    if (P.lock) {
      const cand = []; lanes.forEach((ln, l) => ln.forEach((t, k) => { if (k >= 1 && k <= 4 && t.kind !== 'joker') cand.push({ t, k, l }); }));
      shuffle(cand, rnd);
      const usedLane = {};
      for (const o of cand.slice(0, P.lock * 3)) {
        if (Object.keys(usedLane).length >= P.lock) break;
        if (usedLane[o.l]) continue;
        o.t.lockAt = Math.max(2, Math.round(o.k * nl * 0.5)); usedLane[o.l] = 1;
      }
    }
    // tanitim seviyesi: yeni ozellik ilk ekranda gorunsun (kuyrukta 2. sira)
    const want = { lock: (t) => t.lockAt > 0, big: (t) => t.kind === 'big', dbl: (t) => t.kind === 'dbl', joker: (t) => t.kind === 'joker' }[P.tip];
    if (want && !lanes.some((ln) => ln.slice(0, 2).some(want))) {
      for (const ln of lanes) { const k = ln.findIndex(want); if (k > 1) { const t = ln[k]; ln.splice(k, 1); ln.splice(1, 0, t); if (P.tip === 'lock') t.lockAt = 2; break; } }
    }
    return lanes;
  }

  // ---------- oyun (zamanla ilerleyen simulasyon) ----------
  function Game(lv) {
    this.lv = lv; this.W = lv.W; this.H = lv.H; this.pal = lv.pal;
    this.G = geom(lv.W, lv.H);
    this.cells = lv.cells.map((x) => ({ c: x.c, hp: x.hp, pend: 0, bg: x.bg }));
    this.lanes = lv.lanes.map((ln) => ln.map((t) => Object.assign({ load: 0, loadC: [] }, t)));
    this.trucks = {}; this.lanes.forEach((ln) => ln.forEach((t) => { this.trucks[t.id] = t; }));
    this.park = new Array(lv.plan.park).fill(null);
    this.belt = []; this.waiting = []; this.departed = 0; this.t = 0; this.events = [];
    this.state = 'play'; this.revives = 0; this.maxPark = 0; this.eaten = 0;
    this.remain = new Array(lv.pal.length).fill(0); this.cells.forEach((x) => this.remain[x.c]++);
    this.total = this.cells.length; this.left = this.total;
  }
  const GP = Game.prototype;
  GP.emit = function (e) { this.events.push(e); };
  GP.cellLeft = function (i) { const x = this.cells[i]; return x.hp - x.pend; };
  GP.firstIn = function (ln, from) { for (let k = from || 0; k < ln.cells.length; k++) { if (this.cellLeft(ln.cells[k]) > 0) return k; } return -1; };
  GP.beltCount = function () { return this.belt.length + this.waiting.length; };
  GP.locked = function (t) { return t.lockAt > this.departed; };
  GP.colorLeft = function (t) { return t.kind === 'joker' ? this.left : this.remain[t.c]; };
  GP.entryClear = function () { for (const b of this.belt) if (b.enter > 0 || b.s < this.G.spacing) return false; return true; };
  // oyuncu: kuyruktan gonder
  GP.sendLane = function (l) {
    if (this.state !== 'play') return 'over';
    const ln = this.lanes[l]; if (!ln || !ln.length) return 'empty';
    const t = ln[0]; if (this.locked(t)) return 'locked';
    if (this.beltCount() >= this.lv.plan.beltMax) return 'full';
    ln.shift();
    this.emit({ type: 'launch', t, from: 'lane', lane: l });
    this.queueTruck(t);
    return 'ok';
  };
  GP.sendPark = function (k) {
    if (this.state !== 'play') return 'over';
    const t = this.park[k]; if (!t) return 'empty';
    if (this.beltCount() >= this.lv.plan.beltMax) return 'full';
    this.park[k] = null;
    this.emit({ type: 'launch', t, from: 'park', slot: k });
    this.queueTruck(t);
    return 'ok';
  };
  GP.queueTruck = function (t) {
    if (this.colorLeft(t) <= 0) { this.depart(t, 'empty', null); return; }
    this.waiting.push(t);
  };
  GP.depart = function (t, why, b) {
    t.gone = true; this.departed++;
    if (b) { const i = this.belt.indexOf(b); if (i >= 0) this.belt.splice(i, 1); }
    this.emit({ type: 'leave', t, why, s: b ? b.s : null });
  };
  GP.tick = function (dt) {
    if (this.state !== 'play') return;
    this.t += dt;
    const G = this.G;
    if (this.waiting.length && this.entryClear()) {
      const t = this.waiting.shift(), b = { t, s: 0, ev: 0, enter: 0.32 };
      this.belt.push(b); this.emit({ type: 'enter', t });
    }
    for (const b of this.belt.slice()) {
      if (b.enter > 0) { b.enter -= dt; continue; }
      // onundeki kamyona carpmasin (bant tek hizda; yine de guvenlik)
      b.s += G.speed * dt;
      while (b.ev < G.lines.length && G.lines[b.ev].s <= b.s) {
        this.line(b, G.lines[b.ev]); b.ev++;
        if (b.t.gone) break;
      }
      if (b.t.gone) continue;
      if (b.s >= G.L) this.loopEnd(b);
      if (this.state !== 'play') return;
    }
    // parktaki kamyonun rengi bittiyse kendiliginden gider
    for (let k = 0; k < this.park.length; k++) { const t = this.park[k]; if (t && this.colorLeft(t) <= 0) { this.park[k] = null; this.depart(t, 'empty', null); } }
    if (this.left <= 0) { this.state = 'win'; this.emit({ type: 'win' }); return; }
    if (!this.belt.length && !this.waiting.length && this.isStuck()) { this.state = 'lose'; this.emit({ type: 'lose', why: 'stuck' }); }
  };
  GP.line = function (b, ln) {
    const t = b.t; if (t.load >= t.cap) return;
    let k = 0;
    const bites = t.kind === 'dbl' ? 2 : 1;
    for (let n = 0; n < bites; n++) {
      k = this.firstIn(ln, k); if (k < 0) return;
      const i = ln.cells[k], x = this.cells[i];
      if (!(t.kind === 'joker' || x.c === t.c)) return;     // yol kapali
      x.pend++;
      if (x.pend < x.hp) { this.emit({ type: 'crack', t, i, ln }); return; }   // buz kirildi, kup duruyor
      t.load++; t.loadC.push(x.c); this.remain[x.c]--; this.left--; this.eaten++;
      this.emit({ type: 'eat', t, i, c: x.c, ln, n, s: b.s });
      if (t.load >= t.cap) { this.depart(t, 'full', b); return; }
    }
  };
  GP.loopEnd = function (b) {
    const t = b.t;
    if (t.load >= t.cap || this.colorLeft(t) <= 0) { this.depart(t, 'done', b); return; }
    const k = this.park.indexOf(null);
    const i = this.belt.indexOf(b); if (i >= 0) this.belt.splice(i, 1);
    if (k < 0) { this.state = 'lose'; this.emit({ type: 'lose', why: 'park', t }); this.overflow = t; return; }
    this.park[k] = t; this.emit({ type: 'park', t, slot: k });
    this.maxPark = Math.max(this.maxPark, this.park.filter(Boolean).length);
  };
  // hamle kalmadi mi? (bant bos, park dolu, gonderilebilecek hicbir kamyon bir sey yutamiyor)
  GP.canEatNow = function (t) {
    for (const ln of this.G.lines) { const k = this.firstIn(ln, 0); if (k < 0) continue; const x = this.cells[ln.cells[k]]; if (t.kind === 'joker' || x.c === t.c) return true; }
    return false;
  };
  GP.available = function () {
    const out = [];
    this.lanes.forEach((ln, l) => { if (ln.length && !this.locked(ln[0])) out.push({ t: ln[0], from: 'lane', i: l }); });
    this.park.forEach((t, k) => { if (t) out.push({ t, from: 'park', i: k }); });
    return out;
  };
  GP.isStuck = function () {
    if (this.park.indexOf(null) >= 0) return false;
    return !this.available().some((o) => this.canEatNow(o.t));
  };
  // devam: park yeri ekle
  GP.revive = function (n) {
    for (let k = 0; k < (n || 1); k++) this.park.push(null);
    if (this.overflow) { const t = this.overflow; this.overflow = null; const k = this.park.indexOf(null); this.park[k] = t; this.emit({ type: 'park', t, slot: k }); }
    this.revives++; this.state = 'play'; this.emit({ type: 'revive' });
  };
  GP.stars = function () { if (this.revives) return 1; return this.maxPark <= Math.ceil(this.park.length / 2) ? 3 : 2; };
  GP.exposure = function () {
    const e = new Array(this.pal.length).fill(0), seen = new Set();
    for (const ln of this.G.lines) { const k = this.firstIn(ln, 0); if (k < 0) continue; const i = ln.cells[k]; if (!seen.has(i)) { seen.add(i); e[this.cells[i].c]++; } }
    return e;
  };

  // ---------- bot (zorluk olcumu) ----------
  // dikkatli: acikta en cok kupu olan kamyonu gonderir; rastgele: dusunmeden dokunur
  // bir karar: gonderilecek kamyon ya da null (bekle)
  function decide(g, style, rnd) {
    const av = g.available(); if (!av.length) return null;
    if (style === 'rastgele') return av[Math.floor(rnd() * av.length)];
    // acikta olup banttaki ayni renk kamyonlarca "ayrilmamis" kup sayisi
    const e = g.exposure(), res = {};
    g.belt.map((b) => b.t).concat(g.waiting).forEach((t) => { res[t.c] = (res[t.c] || 0) + (t.cap - t.load); });
    const free = g.park.filter((x) => !x).length;
    let bw = -1e9, pick = null;
    for (const o of av) {
      const t = o.t, need = t.cap - t.load;
      const ex = t.kind === 'joker' ? e.reduce((a, b) => a + b, 0) * 0.5 : Math.max(0, e[t.c] - (res[t.c] || 0));
      let w = Math.min(ex, need) / need;           // bu turda dolma payi
      if (o.from === 'park') w += 0.15;
      if (ex >= need) w += 0.5;
      // kuyrugu acmak icin: arkadaki kamyon cok iyiyse one gecenden vazgecip park etmeyi goze al
      if (o.from === 'lane' && ex === 0) { const nx = g.lanes[o.i][1]; w = (nx && free >= 3 && g.lanes[o.i].length > 1 && e[nx.c] > 0) ? 0.05 : -1; }
      w += rnd() * 0.02;
      if (w > bw) { bw = w; pick = o; }
    }
    if (bw <= 0.04 && (g.belt.length || free < 3)) pick = null;   // bekle, banttakiler yolu acsin
    if (!pick && !g.belt.length && !g.waiting.length) pick = av.reduce((a, o) => (o.from === 'park' ? o : a), av[0]);
    return pick;
  }
  // bot: dikkatli (acikta en cok kupu olan kamyonu gonderir) ya da rastgele (dusunmeden dokunur)
  function play(lv, style, seed, maxT) {
    const g = new Game(lv), rnd = rng(seed || 1); let next = 0;
    const dt = 1 / 30;
    while (g.state === 'play' && g.t < (maxT || 900)) {
      if (g.t >= next && g.beltCount() < lv.plan.beltMax && g.entryClear()) {
        const pick = decide(g, style, rnd);
        if (pick) { if (pick.from === 'lane') g.sendLane(pick.i); else g.sendPark(pick.i); next = g.t + (style === 'rastgele' ? 0.25 : 0.4); }
      }
      g.tick(dt); g.events.length = 0;
    }
    return { win: g.state === 'win', t: Math.round(g.t), left: g.left, total: g.total, maxPark: g.maxPark, departed: g.departed };
  }

  return { setLib, rng, planFor, level, geom, posAt, Game, play, decide, PLAN };
});
