// Kamyon modu zorluk botu: node tools/kamyon-bot.js --from 1 --to 30 --tries 4
// Her seviyeyi "dikkatli" ve "rastgele" oyuncuyla oynatir, kazanma oranini yazar.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..', 'beta');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'buz', 'izgara.js'), 'utf8') + ';this.BZ_IZGARA=BZ_IZGARA;', ctx);
const K = require(path.join(root, 'kamyon', 'motor.js'));
K.setLib(ctx.BZ_IZGARA);
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? +process.argv[i + 1] : d; };
const from = arg('from', 1), to = arg('to', 30), tries = arg('tries', 4);
const rows = [];
for (let L = from; L <= to; L++) {
  const t0 = Date.now(), lv = K.level(L);
  const trucks = lv.lanes.reduce((a, l) => a + l.length, 0);
  let cw = 0, rw = 0, ct = 0;
  for (let k = 0; k < tries; k++) { const a = K.play(lv, 'dikkatli', 11 + k); if (a.win) { cw++; ct += a.t; } if (K.play(lv, 'rastgele', 77 + k).win) rw++; }
  rows.push([L, lv.W + 'x' + lv.H, lv.pal.length, trucks, cw + '/' + tries, rw + '/' + tries, cw ? Math.round(ct / cw) + 's' : '-', (Date.now() - t0) + 'ms']);
  console.log(rows[rows.length - 1].join('\t'));
}
