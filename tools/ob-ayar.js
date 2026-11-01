#!/usr/bin/env node
// BLOKPOP v3.10 engel ayari: botun hic kazanamadigi seviyelerde engelleri adim adim hafifletir.
// Adimlar: 0 (tam) -> -1 (kuyruk engeli yok, %30 az engel) -> -2 (tek engel turu, yarim) -> -3 (engel yok).
// Sonuc tools/out/ob-ayar.json dosyasina yazilir ve --yaz ile beta/index.html icindeki OB_TUNE satirina islenir.
// Kullanim: node tools/ob-ayar.js --from 12 --to 1000 --tries 3 [--yaz]
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const A = {}; process.argv.slice(2).forEach((a, i, arr) => { if (a.startsWith('--')) A[a.slice(2)] = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'; });
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'tools/out'), TMP = path.join(OUT, 'ob-ayar-tmp');
const FROM = +(A.from || 12), TO = +(A.to || 1000), TRIES = A.tries || '3', DIR = A.dir || 'beta';
const TF = path.join(OUT, 'ob-ayar.json');
fs.mkdirSync(TMP, { recursive: true });
let tune = fs.existsSync(TF) && A.sifirla !== 'true' ? JSON.parse(fs.readFileSync(TF, 'utf8')) : {};
const run = (list) => {
  fs.writeFileSync(path.join(TMP, 'list.json'), JSON.stringify(list));
  fs.writeFileSync(path.join(TMP, 'tune.json'), JSON.stringify(tune));
  execFileSync('node', [path.join(ROOT, 'tools/level-bot.js'), '--mode', 'normal', '--styles', 'dikkatli', '--tries', TRIES, '--dir', DIR, '--workers', A.workers || '2',
    '--list', path.relative(ROOT, path.join(TMP, 'list.json')), '--obtune', path.relative(ROOT, path.join(TMP, 'tune.json')), '--out', path.relative(ROOT, TMP)], { stdio: ['ignore', 'ignore', 'inherit'] });
  const rows = fs.readFileSync(path.join(TMP, 'levels-normal.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
  const res = {}; rows.forEach((r) => { res[+r[0]] = { win: +r[7], n: +r[6], pct: +r[9] }; });
  return res;
};
let list = []; for (let L = FROM; L <= TO; L++) list.push(L);
for (let round = 0; round < 4 && list.length; round++) {
  const t0 = Date.now();
  const res = run(list);
  const fail = list.filter((L) => res[L] && res[L].win === 0 && (tune[L] | 0) > -3);
  fail.forEach((L) => { tune[L] = (tune[L] | 0) - 1; });
  console.log('tur ' + (round + 1) + ': ' + list.length + ' seviye, kazanilamayan ' + fail.length + ' -> hafifletildi (' + Math.round((Date.now() - t0) / 1000) + ' sn)');
  list = fail;
}
fs.writeFileSync(TF, JSON.stringify(tune));
const by = {}; Object.values(tune).forEach((v) => { by[v] = (by[v] || 0) + 1; });
console.log('ayar ozeti (seviye sayisi):', JSON.stringify(by), '| kalan sorunlu:', list.join(',') || 'yok');
if (A.yaz === 'true') {
  const f = path.join(ROOT, DIR, 'index.html'); let s = fs.readFileSync(f, 'utf8');
  const keys = Object.keys(tune).filter((k) => tune[k]).sort((a, b) => a - b), obj = '{' + keys.map((k) => '"' + k + '":' + tune[k]).join(',') + '}';
  s = s.replace(/const OB_TUNE=\{[^}]*\};/, 'const OB_TUNE=' + obj + ';');
  fs.writeFileSync(f, s); console.log('OB_TUNE yazildi: ' + keys.length + ' seviye');
}
