#!/usr/bin/env node
// BLOKPOP v3.17 katli kup testleri (Faz 1: bolum 121-122).
// Kullanim: python3 -m http.server 8765 (repo kokunde) ; node tools/tests/katli-test.js [http://127.0.0.1:8765/beta/] [--eski http://127.0.0.1:8765/eski/]
// 1) Renk: her kat sadece kendi rengindeki Pofi ile kirilir, kat bitince alttaki kat dogru renkle uste cikar
// 2) Mermi: baslangicta ve oyun boyunca kuyruk+tezgah+bant+yoldaki mermi = kalan hasar (butun katlar dahil), renk bazinda
// 3) Kayit: oyun ortasinda kaydet/geri yukle -> katlar, kalan hasar ve mermi ayni; eski bicimdeki kayit (katsiz) da acilir
// 4) Diger bolumler: --eski verilirse 1-1000 bolumun izgara+kuyruk ozeti eski surumle karsilastirilir (121-122 haric ayni olmali)
'use strict';
const { chromium } = require('playwright');
const A = {}; process.argv.slice(2).forEach((a, i, arr) => { if (a.startsWith('--')) A[a.slice(2)] = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'; });
const BASE = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8765/beta/';
const CHROME = process.env.BLOKPOP_CHROME || '';
const SEEDS = +(A.tekrar || 6);
let fail = 0; const ok = (c, m) => { console.log((c ? '  GECTI  ' : '  KALDI  ') + m); if (!c) fail++; };

async function page(br, url) {
  const p = await br.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url + 'index.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.BP);
  await p.evaluate(() => { window.requestAnimationFrame = () => 0; });
  p._errs = errs; return p;
}
// sayfa icinde: dikkatli oyuncu + her adimda denetim
const PLAY = ([L, seed, stopAt]) => {
  let rs = seed >>> 0; const rnd = () => { rs = (rs * 1103515245 + 12345) & 0x7fffffff; return rs / 0x7fffffff; };
  BP.start(L); const g = BP.G, N = g.grid.length, out = { L, seed, err: [], pops: 0, layerSeen: 0 };
  const ammo = () => { const o = {}; let t = 0; const add = (s) => { if (s && s.a > 0) { o[s.c] = (o[s.c] || 0) + s.a; t += s.a; } };
    g.q.forEach((c) => c.forEach(add)); g.bench.forEach(add); g.active.forEach(add); g.bullets.forEach((b) => { if (!b.fr) { o[b.col] = (o[b.col] || 0) + 1; t++; } }); return { o, t }; };
  const need = () => { const o = {}; const add = (c, n) => { o[c] = (o[c] || 0) + n; };
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const v = g.grid[r][c]; if (v < 0) continue; const i = r * N + c; if (g.um && g.um[i] >= 0) continue; if (g.om && g.om[i] >= 0 && g.ob[g.om[i]].eat && g.ob[g.om[i]].lay.length) continue;
      const S = g.stk && g.stk[i]; if (S) S.forEach((l) => add(l.c, l.hp)); else add(v, 1); }
    g.units.forEach((U) => { if (U.hp > 0) add(U.col, U.hp); }); (g.ob || []).forEach((O) => O.lay.forEach((l) => { if (l.col >= 0) add(l.col, l.hp); }));
    // yoldaki mermilerin hedefleri henuz dusulmedi; renk bazinda karsilastirma icin dusmeyiz (her ikisi de yoldaki mermiyi sayar)
    return o; };
  const snapStk = () => { const m = {}; for (const k in (g.stk || {})) m[k] = g.stk[k].map((l) => l.c + ':' + l.hp).join('>'); return m; };
  { const a = ammo(), n = need(); if (a.t !== g.remPx) out.err.push('baslangic mermi ' + a.t + ' != kalan ' + g.remPx);
    for (const c in n) if ((a.o[c] || 0) !== n[c]) out.err.push('baslangic renk ' + c + ': mermi ' + (a.o[c] || 0) + ' != ihtiyac ' + n[c]); }
  out.layers0 = Object.keys(g.stk || {}).length;
  let prev = snapStk(), t = 0, steps = 0;
  while (t < 900 && g.state === 'play') {
    let did = false; const ex = BP.exposed();
    for (let i = 0; i < g.bench.length && !did; i++) { const s = g.bench[i]; if (s && s.st !== 'exit' && ex[s.c] > 0 && BP.launchFromBench(i)) did = true; }
    if (!did) { let best = -1, bv = -1; for (let c = 0; c < 4; c++) { const s = g.q[c][0]; if (!s || !(ex[s.c] > 0) || s.frz > 0) continue; const v = ex[s.c] + rnd() * 0.5; if (v > bv) { bv = v; best = c; } } if (best >= 0 && BP.launchFromQueue(best)) did = true; }
    const act = g.active.filter((s) => s.a > 0).length;
    if (!did && ex.any > 0 && act < 2) { for (let c = 0; c < 4 && !did; c++) { const s = g.q[c][0]; if (s && !(s.frz > 0) && BP.launchFromQueue(c)) did = true; } }
    if (!did && act === 0) { const okk = []; for (let i = 0; i < g.bench.length; i++) if (g.bench[i] && g.bench[i].st !== 'exit') okk.push(['b', i]); for (let c = 0; c < 4; c++) if (g.q[c][0] && !(g.q[c][0].frz > 0)) okk.push(['q', c]);
      if (okk.length) { const q = okk[Math.floor(rnd() * okk.length)]; q[0] === 'b' ? BP.launchFromBench(q[1]) : BP.launchFromQueue(q[1]); } }
    for (let k = 0; k < 8 && g.state === 'play'; k++) { BP.update(0.05); t += 0.05;
      // kat gecisleri: yeni ustteki kat, onceki kaydin ikinci kati olmali
      const now = snapStk();
      for (const key in prev) { const a = prev[key].split('>'), b = now[key]; if (b === prev[key]) continue; out.pops++;
        if (b == null) { const i = +key, r = (i / N) | 0, c = i % N; if (a.length > 1) { const al = a.map((x) => x.split(':')); if (!(al.length === 1 || (al.length === 2 && al[0][1] === '1' && false))) { /* son kat silindi: hucre bos olmali ya da tek kat kaldi */ } }
          if (g.grid[r][c] >= 0 && a.length > 1) out.err.push('kat kaydi silindi ama hucre dolu ' + key); continue; }
        const bl = b.split('>'); out.layerSeen++;
        if (bl.length === a.length) { if (+bl[0].split(':')[1] !== +a[0].split(':')[1] - 1) out.err.push('dayaniklilik yanlis ' + key + ' ' + prev[key] + ' -> ' + b); }
        else if (bl.length === a.length - 1) { if (bl.join('>') !== a.slice(1).join('>')) out.err.push('alttaki kat yanlis ' + key + ' ' + prev[key] + ' -> ' + b);
          const i = +key; if (g.grid[(i / N) | 0][i % N] !== +bl[0].split(':')[0]) out.err.push('hucre rengi ustteki katla ayni degil ' + key); }
        else out.err.push('bir anda birden fazla kat gitti ' + key + ' ' + prev[key] + ' -> ' + b); }
      prev = now;
      if (++steps % 7 === 0 && g.state === 'play') { const a2 = ammo(); if (a2.t !== g.remPx) { out.err.push('t=' + t.toFixed(1) + ' mermi ' + a2.t + ' != kalan ' + g.remPx); break; } }
      if (stopAt && t >= stopAt) break; }
    if (stopAt && t >= stopAt) break;
  }
  while (g.state === 'super' && t < 960) { BP.update(0.05); t += 0.05; }
  out.state = g.state; out.t = Math.round(t); out.bad = BP.stkDbg() ? BP.stkDbg().bad : -1; out.stkLeft = Object.keys(g.stk || {}).length;
  return out;
};
(async () => {
  const br = await chromium.launch(Object.assign({ args: ['--no-sandbox'] }, CHROME ? { executablePath: CHROME } : {}));
  const p = await page(br, BASE);
  console.log('1-2) Renk, kat sirasi ve mermi denkligi (her bolum ' + SEEDS + ' oyun)');
  for (const L of [121, 122]) {
    let wins = 0, pops = 0, errs = [], bad = 0, layers0 = 0;
    for (let k = 1; k <= SEEDS; k++) { const r = await p.evaluate(PLAY, [L, k * 7919, 0]); if (r.state === 'win') wins++; pops += r.layerSeen; errs = errs.concat(r.err.map((e) => 'oyun' + k + ': ' + e)); bad += r.bad; layers0 = r.layers0; }
    ok(layers0 > 0, L + ': katli hucre sayisi ' + layers0);
    ok(bad === 0, L + ': yanlis renkle kirilan kat ' + bad);
    ok(errs.length === 0, L + ': kat sirasi / mermi hatasi ' + errs.length + (errs.length ? ' -> ' + errs.slice(0, 3).join(' | ') : '') + ' (gozlenen kat gecisi ' + pops + ')');
    console.log('     ' + L + ': dikkatli oyuncu ' + wins + '/' + SEEDS + ' kazandi');
  }
  console.log('3) Kayit / geri yukleme');
  for (const L of [121, 122]) {
    const r = await p.evaluate(([L, PLAYS]) => { const PLAY = eval('(' + PLAYS + ')'); PLAY([L, 4242, 25]); const g = BP.G; const sn = BP.snapshot(); if (!sn) return { err: 'kayit alinamadi (durum ' + g.state + ')' };
      const before = { rem: g.remPx, stk: JSON.stringify(sn.stk) }; const j = JSON.parse(JSON.stringify(sn)); const g2 = BP.restore(j); if (!g2) return { err: 'geri yuklenemedi' };
      const after = { rem: g2.remPx, stk: JSON.stringify(BP.snapshot().stk) };
      const old = JSON.parse(JSON.stringify(sn)); delete old.stk; // v3.16 bicimi (katsiz) -> acilmali ya da temiz reddedilmeli, cokmemeli
      let oldRes = 'acildi'; try { const g3 = BP.restore(old); oldRes = g3 ? 'acildi (katsiz)' : 'reddedildi (bolum bastan)'; } catch (e) { oldRes = 'HATA ' + e.message; }
      return { before, after, oldRes, layers: (sn.stk || []).length }; }, [L, PLAY.toString()]);
    if (r.err) { ok(false, L + ': ' + r.err); continue; }
    ok(r.before.rem === r.after.rem && r.before.stk === r.after.stk, L + ': kayit sonrasi kalan ' + r.before.rem + ' = ' + r.after.rem + ', katlar ayni (' + r.layers + ' katli hucre)');
    ok(!/HATA/.test(r.oldRes), L + ': eski bicimli kayit ' + r.oldRes);
  }
  if (A.eski) {
    console.log('4) 1-1000 bolum eski surumle ayni mi');
    const sig = (pg) => pg.evaluate(() => { const o = {}; for (let L = 1; L <= 1000; L++) { BP.start(L); const g = BP.G; let h = 0; const s = g.grid.map((r) => r.join(',')).join('/') + '|' + g.q.map((c) => c.map((x) => x.c + ':' + x.a).join(',')).join('/') + '|' + g.units.map((U) => U.kind + U.r0 + ',' + U.c0 + ',' + U.hp).join(';') + '|' + (g.ob || []).map((O) => O.r0 + ',' + O.c0 + O.lay.map((l) => l.k + l.hp).join('')).join(';');
      for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; o[L] = h; } return o; });
    const pe = await page(br, A.eski); const a = await sig(pe), b = await sig(p);
    const diff = Object.keys(a).filter((L) => a[L] !== b[L]).map(Number);
    ok(diff.every((L) => L === 121 || L === 122), 'farkli bolumler: ' + (diff.join(',') || 'yok') + ' (sadece 121-122 farkli olmali)');
  }
  ok(p._errs.length === 0, 'sayfa hatasi ' + p._errs.length + (p._errs.length ? ': ' + p._errs.slice(0, 2).join(' | ') : ''));
  await br.close();
  console.log(fail ? '\nSONUC: ' + fail + ' test kaldi' : '\nSONUC: butun testler gecti');
  process.exit(fail ? 1 : 0);
})();
