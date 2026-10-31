#!/usr/bin/env node
// BLOKPOP: sw.js icindeki onbellek listesini klasordeki dosyalardan otomatik uretir.
// Kullanim:  node tools/gen-sw-manifest.js beta        (beta surumu icin)
//            node tools/gen-sw-manifest.js .           (ana surum icin, sw.js ayni yapidaysa)
// Ek olarak: --bump  -> onbellek surum numarasini 1 artirir (ornek: blokpop-beta-v80 -> v81)
'use strict';
const fs = require('fs'), path = require('path');
const dir = path.resolve(process.argv[2] || 'beta');
const bump = process.argv.includes('--bump');
const swPath = path.join(dir, 'sw.js');
if (!fs.existsSync(swPath)) { console.error('sw.js bulunamadi: ' + swPath); process.exit(1); }

// Oyunun acilmasi icin mutlaka gereken dosyalar (biri bile inmezse kurulum basarisiz sayilir)
const CORE_NAMES = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'runpofi.js', 'items3d.js', 'sfx.js', 'avatars.js', 'live3d.js', 'three.module.min.js', 'GLTFLoader.js',
  'SkeletonUtils.js', 'BufferGeometryUtils.js'];
const SKIP = new Set(['sw.js', 'ses.html']);
const EXT = /\.(html|js|webmanifest|png|jpg|jpeg|webp|glb|mp4|webm|txt|json|mp3|ogg|wav)$/i;

function walk(d, rel) {
  let out = [];
  for (const n of fs.readdirSync(d).sort()) {
    if (n.startsWith('.')) continue;
    const full = path.join(d, n), r = rel ? rel + '/' + n : n;
    const st = fs.statSync(full);
    if (st.isDirectory()) { if (n === 'beta' || n === 'tools' || n === 'node_modules' || n === 'orig') continue; /* orig: galeri orijinalleri, bakilinca indirilir */ out = out.concat(walk(full, r)); }
    else if (EXT.test(n) && !SKIP.has(r)) out.push(r);
  }
  return out;
}
const all = walk(dir, '');
const core = ['./'].concat(CORE_NAMES.filter(n => all.includes(n)).map(n => './' + n));
const extra = all.filter(n => !CORE_NAMES.includes(n)).map(n => './' + n);

let sw = fs.readFileSync(swPath, 'utf8');
const block = '// @@ASSETS-START (tools/gen-sw-manifest.js ile otomatik uretilir, elle duzenleme)\n' +
  'const CORE=' + JSON.stringify(core) + ';\n' +
  'const EXTRA=' + JSON.stringify(extra) + ';\n' +
  '// @@ASSETS-END';
if (!/\/\/ @@ASSETS-START[\s\S]*?\/\/ @@ASSETS-END/.test(sw)) { console.error('sw.js icinde @@ASSETS-START/@@ASSETS-END isaretleri yok'); process.exit(1); }
sw = sw.replace(/\/\/ @@ASSETS-START[\s\S]*?\/\/ @@ASSETS-END/, block);
if (bump) sw = sw.replace(/(const C='[^']*?v)(\d+)'/, (m, a, n) => a + (+n + 1) + "'");
fs.writeFileSync(swPath, sw);
const size = all.reduce((s, n) => s + fs.statSync(path.join(dir, n)).size, 0);
console.log('sw.js guncellendi: ' + core.length + ' zorunlu + ' + extra.length + ' ek dosya, toplam ' + (size / 1048576).toFixed(1) + ' MB' + (bump ? ' (surum artirildi)' : ''));
console.log((/const C='([^']+)'/.exec(sw) || [])[1]);
