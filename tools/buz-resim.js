#!/usr/bin/env node
// BLOKPOP Buz prototipi: oyunun resim kutuphanesinden (beta/index.html icindeki LIB)
// ilk N seviyenin resimlerini kucuk bir dosyaya kopyalar -> beta/buz/resimler.js
//   node tools/buz-resim.js            (ilk 100 seviye)
//   node tools/buz-resim.js 200
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const COUNT = +(process.argv[2] || 100);
const src = fs.readFileSync(path.join(ROOT, 'beta', 'index.html'), 'utf8');
const m = src.match(/const LIB=(\{[\s\S]*?\});\s*\n/);
if (!m) throw new Error('LIB bulunamadi');
const lib = JSON.parse(m[1]);
const pics = [], map = {}, order = [];
for (let L = 1; L <= COUNT && L <= lib.order.length; L++) {
  const [pi, mir] = lib.order[L - 1];
  if (!(pi in map)) { map[pi] = pics.length; pics.push(lib.pics[pi]); }
  order.push([map[pi], mir ? 1 : 0]);
}
const out = '// Otomatik uretildi: node tools/buz-resim.js (elle duzenleme)\n' +
  'var BZ_LIB=' + JSON.stringify({ v: 1, pics, order }) + ';\n' +
  'if(typeof module==="object"&&module.exports)module.exports=BZ_LIB;\n';
fs.writeFileSync(path.join(ROOT, 'beta', 'buz', 'resimler.js'), out);
console.log(order.length + ' seviye, ' + pics.length + ' resim -> beta/buz/resimler.js (' + Math.round(out.length / 1024) + ' KB)');
