#!/usr/bin/env node
// BLOKPOP Buz prototipi: seviyeleri 4 tarz oyuncuyla oynatir, zorluk raporu cikarir.
//   node tools/buz-bot.js                  (1-30, her tarz 5 deneme)
//   node tools/buz-bot.js --from 1 --to 60 --tries 8
//   node tools/buz-bot.js --plan '{"bench":3}'   (ayar denemesi; oyunu degistirmez)
// Tarzlar:
//   dikkatli : banttakileri de hesaba katar, mermisi hedefe uyan fili secer
//   sayan    : bant ustundeki renkli noktalari sayar, sayisi noktalari gecmeyen fili gonderir
//   orta     : en cok vuracak fili gonderir, mermi sayisina bakmaz
//   rastgele : dusunmeden dokunur
// Cikti: tools/out/buz-rapor.md
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const M = require(path.join(ROOT, 'beta', 'buz', 'motor.js'));
M.setLib(require(path.join(ROOT, 'beta', 'buz', 'resimler.js')));
const A = { from: 1, to: 30, tries: 5, plan: '{}' };
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i].replace(/^--/, ''); A[k] = process.argv[++i]; }
const from = +A.from, to = +A.to, T = +A.tries, over = JSON.parse(A.plan);
const ST = ['dikkatli', 'sayan', 'orta', 'rastgele'];
const tot = {}; ST.forEach((s) => (tot[s] = 0));
const rows = [];
let n = 0;
for (let L = from; L <= to; L++) {
  const lv = M.level(L, undefined, over), r = {};
  let tw = 0, nw = 0;
  for (const st of ST) {
    r[st] = 0;
    for (let s = 1; s <= T; s++) { const o = M.botPlay(L, st, s, { plan: over }); if (o.win) { r[st]++; if (st === 'sayan') { tw += o.t; nw++; } } }
    tot[st] += r[st];
  }
  n += T;
  const c = lv.counts, eng = [c.thick && 'kalın ' + c.thick, c.wood && 'tahta ' + c.wood, c.chain && 'zincir ' + c.chain, c.lock && 'kilit ' + c.lock].filter(Boolean).join(', ') || '-';
  rows.push('| ' + L + ' | ' + lv.name.replace(/^px_|^w\d+_/, '') + ' | ' + lv.N + '×' + lv.N + ' | ' + lv.pal.length + ' | ' + c.total + ' | ' + eng + ' | ' + lv.plan.bench + ' | ' + ST.map((s) => r[s] + '/' + T).join(' | ') + ' | ' + (nw ? Math.round(tw / nw) : '-') + ' |');
  process.stdout.write('.');
}
const pct = (v) => Math.round((100 * v) / n) + '%';
const out = ['# Buz prototipi — bot raporu', '', 'Seviye ' + from + '–' + to + ', her tarz ' + T + ' deneme' + (A.plan !== '{}' ? ', ayar: `' + A.plan + '`' : '') + '.', '',
  '**Kazanma:** ' + ST.map((s) => s + ' ' + pct(tot[s])).join(' · '), '',
  '| Sv | Resim | Tahta | Renk | Küp | Engeller | Bekleme | Dikkatli | Sayan | Orta | Rastgele | Süre (sn) |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|'].concat(rows);
fs.mkdirSync(path.join(ROOT, 'tools', 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools', 'out', 'buz-rapor.md'), out.join('\n') + '\n');
console.log('\n' + ST.map((s) => s + ' ' + pct(tot[s])).join('  ') + '\n-> tools/out/buz-rapor.md');
