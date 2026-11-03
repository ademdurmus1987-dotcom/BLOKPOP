#!/usr/bin/env node
// BLOKPOP v3.16 gorev ayari: pilot bolumlerin (MS_P) gorev sayilarini bot olcumuyle kontrol eder.
// Once botu calistir (iki tarz, sinirsiz modda olcum ve gercek modda dogrulama):
//   node tools/level-bot.js --mode normal --from 101 --to 120 --tries 5 --url msnolim=1 --ham --out tools/out/gorev-olcum
//   node tools/level-bot.js --mode normal --from 101 --to 120 --tries 5 --ham --out tools/out/gorev
// Sonra:  node tools/gorev-ayar.js [tools/out/gorev/levels-ham.json]
// Cikti: tools/out/gorev-rapor.md  (seviye basina kazanma, gonderim/sure/tezgah/kombo dagilimi, bonus basari orani, oneriler)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const F = path.resolve(ROOT, process.argv[2] || 'tools/out/gorev/levels-ham.json');
const R = JSON.parse(fs.readFileSync(F, 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'beta/index.html'), 'utf8');
const m = html.match(/const MS_P=\{([\s\S]*?)\n\};/);
const ids = m ? [...m[1].matchAll(/\n(\d+):\{/g)].map((x) => +x[1]) : [];
const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
const rng = (a) => { const b = a.filter((x) => x != null); return b.length ? Math.min(...b) + '–' + Math.max(...b) : '-'; };
const out = ['# BLOKPOP gorev raporu', '', 'Kaynak: ' + path.relative(ROOT, F) + ' · ' + new Date().toISOString().slice(0, 10), '',
  '| Bolum | Ana gorev | Dikkatli kazanma | Rastgele kazanma | Gonderim | Sure (sn) | Tezgah | Yildiz (dikkatli) | Bonus basari | Not |', '|---|---|---|---|---|---|---|---|---|---|'];
let bad = 0;
for (const L of ids) {
  const d = R.filter((r) => r.L === L && r.style === 'dikkatli'), z = R.filter((r) => r.L === L && r.style === 'rastgele');
  if (!d.length) continue;
  const ms = d.map((r) => r.ms || {}), win = d.filter((r) => r.win).length, zw = z.filter((r) => r.win).length;
  const bon = [0, 0]; d.forEach((r) => { const s = (r.ms && r.ms.mis) || ''; for (let i = 1; i < s.length && i < 3; i++) if (s[i] === '1') bon[i - 1]++; });
  const why = ms.map((x) => x.why).filter(Boolean);
  let note = '';
  if (win < d.length) { note = 'dikkatli oyuncu kaybediyor' + (why.length ? ' (' + why.join(',') + ')' : ''); bad++; }
  else if (zw === z.length && z.length) note = 'cok kolay';
  out.push('| ' + [L, (ms[0] && ms[0].main) || '-', win + '/' + d.length, zw + '/' + z.length, rng(ms.map((x) => x.s)), rng(ms.map((x) => x.t)), rng(ms.map((x) => x.pk)),
    rng(ms.map((x) => x.stars)), bon.map((b) => b + '/' + d.length).join(' · '), note].join(' | ') + ' |');
}
out.push('', 'Dikkatli oyuncunun kaybettigi bolum: **' + bad + '**', '', 'Oneri: sure siniri ~ dikkatli suresinin 1.8 kati, gonderim siniri ~ dikkatli gonderiminin en yuksegi + 6, bonuslar dikkatli oyuncunun yaklasik yarisinin yapabildigi degerde.');
const of = path.join(ROOT, 'tools/out/gorev-rapor.md');
fs.writeFileSync(of, out.join('\n') + '\n');
console.log(out.join('\n'));
console.log('\nYazildi: ' + path.relative(ROOT, of));
