#!/usr/bin/env node
// BLOKPOP v3.10: 1000 seviyenin engel listesi + bot sonucu -> tools/out/ob-seviyeler.csv ve tools/out/ob-rapor.md
// Kullanim: node tools/ob-rapor.js [--bot tools/out/levels-normal.csv]
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const A = {}; process.argv.slice(2).forEach((a, i, arr) => { if (a.startsWith('--')) A[a.slice(2)] = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'; });
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'tools/out');
const TR = { ice: 'Buz', cage: 'Kafes', crate: 'Sandık', armor: 'Zırhlı', stone: 'Taş duvar', glass: 'Cam', chain: 'Zincir', rainbow: 'Gökkuşağı', myst: 'Gizemli', shield: 'Döner kalkan', magnet: 'Mıknatıs', move: 'Hareketli', lock: 'Kilitli yuva', seal: 'Mühürlü yuva', frozen: 'Donmuş Pofi', limit: 'Sınırlı Pofi', heavy: 'Ağır Pofi' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; fs.readFile(path.join(ROOT, p), (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); r.end(b); }); });
(async () => {
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
  const pg = await (await br.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })).newPage();
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/' + (A.dir || 'beta') + '/index.html', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.BP && BP.obPlan, null, { timeout: 60000 });
  const rows = await pg.evaluate(() => {
    const out = [];
    for (let L = 1; L <= BP.TOTAL_LEVELS; L++) {
      BP.start(L); const g = BP.G, p = BP.obPlan(L);
      out.push({ L, n: g.grid.length, k: g.obOn ? Object.keys(g.obKinds) : [], intro: p && p.intro || '', tier: p ? p.t : 0, tune: BP.OB_TUNE[L] | 0, cls: BP.diffClass(L) });
    }
    return out;
  });
  await br.close(); srv.close();
  const bot = {};
  const bf = A.bot ? path.resolve(ROOT, A.bot) : null;
  if (bf && fs.existsSync(bf)) fs.readFileSync(bf, 'utf8').trim().split('\n').slice(1).forEach((l) => { const r = l.split(','); if (r[5] === 'dikkatli') bot[+r[0]] = { w: +r[7], n: +r[6] }; });
  const lvlName = (t) => t <= 1 ? 'kolay' : t <= 2 ? 'orta' : t <= 3 ? 'zor' : 'çok zor';
  const csv = ['seviye,izgara,zorluk,engeller,tanitim,hafifletme,bot_kazanma'];
  rows.forEach((r) => csv.push([r.L, r.n, lvlName(r.tier), '"' + r.k.map((k) => TR[k] || k).join(' + ') + '"', r.intro ? TR[r.intro] : '', r.tune || '', bot[r.L] ? bot[r.L].w + '/' + bot[r.L].n : ''].join(',')));
  fs.writeFileSync(path.join(OUT, 'ob-seviyeler.csv'), csv.join('\n') + '\n');
  const cnt = {}, mix = {}, combos = new Set();
  rows.forEach((r) => { r.k.forEach((k) => { cnt[k] = (cnt[k] || 0) + 1; }); mix[r.k.length] = (mix[r.k.length] || 0) + 1; if (r.k.length) combos.add(r.k.slice().sort().join('+')); });
  const md = ['# BLOKPOP v3.10 engel raporu', '', 'Tarih: ' + new Date().toISOString().slice(0, 10), ''];
  md.push('## Tanıtım bölümleri', '', '| Mekanik | İlk bölüm | Kullanıldığı bölüm sayısı |', '|---|---|---|');
  rows.filter((r) => r.intro).forEach((r) => md.push('| ' + TR[r.intro] + ' | ' + r.L + ' | ' + (cnt[r.intro] || 0) + ' |'));
  md.push('', '## Bir bölümdeki mekanik sayısı', '', '| Mekanik sayısı | Bölüm |', '|---|---|');
  Object.keys(mix).sort((a, b) => a - b).forEach((k) => md.push('| ' + k + ' | ' + mix[k] + ' |'));
  md.push('', 'Farklı kombinasyon sayısı: **' + combos.size + '**', '');
  const tuned = rows.filter((r) => r.tune), byT = {}; tuned.forEach((r) => { byT[r.tune] = (byT[r.tune] || 0) + 1; });
  md.push('## Bot doğrulaması', '', 'Hafifletilen bölüm: ' + tuned.length + ' (' + Object.keys(byT).map((k) => k + ': ' + byT[k]).join(', ') + ')', '');
  const tested = rows.filter((r) => bot[r.L]), won = tested.filter((r) => bot[r.L].w > 0);
  if (tested.length) md.push('Dikkatli bot en az bir kez kazandı: **' + won.length + '/' + tested.length + '**', '', 'Kazanılamayanlar: ' + (tested.filter((r) => !bot[r.L].w).map((r) => r.L).join(', ') || 'yok'), '');
  fs.writeFileSync(path.join(OUT, 'ob-rapor.md'), md.join('\n') + '\n');
  console.log('yazildi: tools/out/ob-seviyeler.csv, tools/out/ob-rapor.md');
})();
