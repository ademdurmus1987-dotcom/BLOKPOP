#!/usr/bin/env node
// BLOKPOP seviye botu
// Oyunu gorunmez bir tarayicida acar, seviyeleri iki farkli oyun tarziyla oynar ve zorluk raporu cikarir.
// Oyunun kodunu degistirmez; oyunun kendi motorunu (window.BP) kullanir.
//
// Kullanim (repo kokunden):
//   node tools/level-bot.js                       -> iki mod, 1-100, her tarz 3 deneme
//   node tools/level-bot.js --mode boya --from 1 --to 10 --tries 5
//   node tools/level-bot.js --mode normal --from 101 --to 200 --dir .   (ana surumu test et)
// Secenekler:
//   --mode boya|insa|normal|ikisi|hepsi   hangi mod (varsayilan: ikisi = normal+boya, hepsi = uc mod)
//   --from N --to M            seviye araligi (varsayilan 1-100)
//   --tries N                  her seviye ve her tarz icin deneme sayisi (varsayilan 3)
//   --styles dikkatli,rastgele hangi oyun tarzlari (varsayilan ikisi)
//   --dir beta|.               hangi surum (varsayilan beta)
//   --workers N                ayni anda kac tarayici (varsayilan: islemci sayisi, en fazla 4)
//   --out tools/out            cikti klasoru
//   --chrome /yol/chrome       Playwright'in kendi Chromium'u yerine baska bir Chrome (ya da BLOKPOP_CHROME ortam degiskeni)
//   --seedmode merkez|renk|bolge  boyama baslangic noktasi kurali (oyundaki ?ps= ile ayni)
//   --ara                      TOHUM ARAMA: her seviye icin dikkatli oyuncunun hep kazandigi bir tohum arar,
//                              sonucu tools/out/tohumlar-<mod>.json dosyasina yazar (oyundaki PSEEDS/SEEDS'e kopyalanir)
//   --tune '{"look":2}'        insa modu ayarlarini dene (rw: halka genisligi, look: acik halka sayisi, amin/amax: mermi)
//   --aday N                   tohum aramada seviye basina denenecek en fazla aday (varsayilan 16)
// Gerekli: Playwright  (npm i -g playwright && npx playwright install chromium)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('Playwright bulunamadi. Kurmak icin: npm i -g playwright && npx playwright install chromium');
  process.exit(1);
}

// ------------------------------------------------------------------ secenekler
function argv() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : 'true'; o[k] = v; }
  }
  return o;
}
const A = argv();
const ROOT = path.resolve(__dirname, '..');
const MODES = (A.mode || 'ikisi') === 'ikisi' ? ['normal', 'boya'] : A.mode === 'hepsi' ? ['normal', 'boya', 'insa'] : [A.mode];
const FROM = Math.max(1, parseInt(A.from || '1', 10));
const TO = Math.max(FROM, parseInt(A.to || '100', 10));
const TRIES = Math.max(1, parseInt(A.tries || '3', 10));
const STYLES = (A.styles || 'dikkatli,rastgele').split(',').map((s) => s.trim()).filter(Boolean);
const DIR = (A.dir || 'beta').replace(/^\/+|\/+$/g, '');
const WORKERS = Math.max(1, Math.min(parseInt(A.workers || String(Math.min(4, os.cpus().length || 1)), 10), 8));
const OUT = path.resolve(ROOT, A.out || 'tools/out');
const CHROME = A.chrome || process.env.BLOKPOP_CHROME || '';
const SEEDMODE = A.seedmode || '';
const ARA = A.ara === 'true';
const ADAY = Math.max(1, parseInt(A.aday || '16', 10));
for (const m of MODES) if (m !== 'boya' && m !== 'normal' && m !== 'insa') { console.error('Gecersiz --mode: ' + m); process.exit(1); }
for (const s of STYLES) if (s !== 'dikkatli' && s !== 'rastgele') { console.error('Gecersiz tarz: ' + s); process.exit(1); }

// ------------------------------------------------------------------ kucuk web sunucusu (ek kurulum gerekmesin)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.glb': 'model/gltf-binary', '.webm': 'video/webm', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT)) { rsp.writeHead(403); rsp.end(); return; }
      fs.readFile(f, (err, buf) => {
        if (err) { rsp.writeHead(404); rsp.end(); return; }
        rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        rsp.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

// ------------------------------------------------------------------ sayfa icinde calisan oyuncu
// Bir seviyeyi bastan sona oynar. Zamani BP.update ile hizli ilerletir (ekrana cizim yok).
const PLAY = ([L, style, seed, maxT]) => {
  let rs = seed >>> 0;
  const rnd = () => { rs = (rs + 0x6D2B79F5) >>> 0; let t = rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  BP.start(L);
  const g = BP.G;
  if (!g) return { err: 'oyun baslamadi' };
  const N = g.grid.length;
  const cols = new Set(); let units = 0;
  for (const row of g.orig) for (const v of row) if (v >= 0) cols.add(v);
  try { units = g.units ? g.units.length : 0; } catch (e) {}
  const DT = 0.05, STEP = 8; // her 0.4 sn'de bir karar
  let t = 0, launches = 0, benchFull = 0, wasFull = false, forced = 0;
  const activeAmmo = () => { let n = 0; g.active.forEach((s) => { if (s.a > 0) n++; }); return n; };
  while (t < maxT && g.state === 'play') {
    let did = false;
    if (style === 'dikkatli') {
      const ex = BP.build ? BP.buildOpen() : BP.exposed(); // renk -> su an vurulabilir hucre sayisi (oyunun kendi kurali; insada acik halkalar)
      for (let i = 0; i < g.bench.length && !did; i++) {
        const s = g.bench[i];
        if (s && s.st !== 'exit' && ex[s.c] > 0 && BP.launchFromBench(i)) did = true;
      }
      if (!did) {
        let best = -1, bv = -1;
        for (let c = 0; c < 4; c++) {
          const s = g.q[c][0];
          if (!s || !(ex[s.c] > 0)) continue;
          const v = ex[s.c] + rnd() * 0.5;
          if (v > bv) { bv = v; best = c; }
        }
        if (best >= 0 && BP.launchFromQueue(best)) did = true;
      }
      if (!did && activeAmmo() === 0) {
        // bantta kimse yok ve isabet edecek fil yok: oyuncu mecburen bir fil gonderir
        const ok = [];
        for (let i = 0; i < g.bench.length; i++) if (g.bench[i] && g.bench[i].st !== 'exit') ok.push(['b', i]);
        for (let c = 0; c < 4; c++) if (g.q[c][0]) ok.push(['q', c]);
        if (ok.length) {
          const p = ok[Math.floor(rnd() * ok.length)];
          if (p[0] === 'b' ? BP.launchFromBench(p[1]) : BP.launchFromQueue(p[1])) { did = true; forced++; }
        }
      }
    } else if (rnd() < 0.5) {
      // rastgele: dusunmeden dokunan oyuncu (ortalama ~0.8 sn'de bir dokunus)
      const ok = [];
      for (let c = 0; c < 4; c++) if (g.q[c][0]) ok.push(['q', c]);
      for (let i = 0; i < g.bench.length; i++) if (g.bench[i] && g.bench[i].st !== 'exit') ok.push(['b', i]);
      if (ok.length) {
        const p = ok[Math.floor(rnd() * ok.length)];
        if (p[0] === 'b' ? BP.launchFromBench(p[1]) : BP.launchFromQueue(p[1])) did = true;
      }
    }
    if (did) launches++;
    for (let k = 0; k < STEP && g.state === 'play'; k++) { BP.update(DT); t += DT; }
    const full = g.bench.length > 0 && g.bench.every((s) => !!s);
    if (full && !wasFull) benchFull++;
    wasFull = full;
  }
  let pct = 0;
  try { pct = g.state === 'win' ? 100 : Math.max(0, Math.min(100, Math.floor((1 - g.remPx / g.total) * 100))); } catch (e) {}
  return { L, style, win: g.state === 'win', state: g.state, pct, t: Math.round(t), launches, benchFull, forced, N, colors: cols.size, units, timeout: g.state === 'play' };
};

// ------------------------------------------------------------------ calisan (bir tarayici)
async function worker(id, base, jobs, results, progress) {
  const opts = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] };
  if (CHROME) opts.executablePath = CHROME;
  const browser = await chromium.launch(opts);
  const pages = {};
  async function pageFor(mode) {
    if (pages[mode]) return pages[mode];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'tr-TR', serviceWorkers: 'block' });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => console.log('  [sayfa hatasi] ' + e.message));
    await pg.goto(base + '/' + (DIR ? DIR + '/' : '') + 'index.html' + (mode !== 'normal' ? '?mod=' + mode : ''), { waitUntil: 'load' });
    await pg.waitForFunction(() => window.BP && window.BlokpopUI && document.querySelector('#btnPlay') && !document.querySelector('#btnPlay').classList.contains('hidden'), null, { timeout: 60000 });
    await pg.click('#btnPlay', { force: true });
    await pg.waitForSelector('[data-act="playCur"]', { state: 'visible', timeout: 30000 });
    await pg.waitForTimeout(800);
    await pg.click('[data-act="playCur"]', { force: true });
    await pg.waitForFunction(() => window.BP && BP.G && BP.G.state, null, { timeout: 30000 });
    const pm = await pg.evaluate(() => (BP.build ? 'insa' : BP.paint ? 'boya' : 'normal'));
    if (pm !== mode) throw new Error('mod acilamadi: ' + mode + ' (oyun: ' + pm + ')');
    // ekrana cizimi durdur: bot zamani kendisi ilerletir, tarayici bosuna cizim yapmasin
    await pg.evaluate(() => { window.requestAnimationFrame = function () { return 0; }; });
    if (SEEDMODE) await pg.evaluate((m) => BP.setPaintSeedMode(m), SEEDMODE);
    if (A.tune) await pg.evaluate((t) => BP.setBuildTune(JSON.parse(t)), A.tune);
    pages[mode] = pg;
    return pg;
  }
  const play = async (pg, L, style, seed) => { try { return await pg.evaluate(PLAY, [L, style, seed, 900]); } catch (e) { return { L, style, err: String(e.message || e).slice(0, 200) }; } };
  while (jobs.length) {
    const j = jobs.shift();
    const pg = await pageFor(j.mode);
    if (j.search) { results.push(await searchLevel(pg, j.mode, j.L, play)); progress(); continue; }
    const r = await play(pg, j.L, j.style, j.seed);
    r.mode = j.mode; r.L = j.L; r.style = j.style; r.try = j.k;
    results.push(r);
    progress();
  }
  await browser.close();
}

// ------------------------------------------------------------------ tohum arama
// Bir seviye icin: once mevcut tohum, sonra yeni adaylar. Kabul: dikkatli oyuncu TRIES denemenin hepsini kazanir.
// Ilk 3 seviyede ayrica rastgele oyuncunun en cok ilerledigi aday, sonrakilerde rastgele oyuncunun hep kazanmadigi (cok kolay olmayan) aday tercih edilir.
async function searchLevel(pg, mode, L, play) {
  const cur = await pg.evaluate((L) => BP.seedFor(L), L);
  const cands = [cur];
  for (let k = 1; k < ADAY; k++) cands.push(((((L * 1000003) ^ (k * 2654435761)) >>> 0) % 9999991) + 1);
  let best = null;
  for (let ci = 0; ci < cands.length; ci++) {
    const sd = cands[ci];
    await pg.evaluate(([L, s]) => BP.setSeed(L, s), [L, sd]);
    let dw = 0, dp = 0, rw = 0, rp = 0;
    for (let k = 0; k < TRIES; k++) { const r = await play(pg, L, 'dikkatli', (L * 7919 + k * 104729) >>> 0); if (r.win) dw++; dp += r.pct || 0; }
    if (dw === TRIES) for (let k = 0; k < TRIES; k++) { const r = await play(pg, L, 'rastgele', (L * 7919 + k * 104729 + 17) >>> 0); if (r.win) rw++; rp += r.pct || 0; }
    const ok = dw === TRIES;
    const score = dw * 1000 + dp / TRIES + (ok ? (L <= 3 ? rp / TRIES * 2 : (rw < TRIES ? 50 : 0)) : 0);
    const c = { L, mode, seed: sd, old: cur, dw, dp: Math.round(dp / TRIES), rw, rp: Math.round(rp / TRIES), ok, score, tried: ci + 1 };
    if (!best || c.score > best.score) best = c;
    const good = ok && (L <= 3 ? rp / TRIES >= 60 || ci >= 5 : rw < TRIES);
    if (good) break;
  }
  await pg.evaluate(([L, s]) => BP.setSeed(L, s), [L, best.seed]);
  best.search = true; best.tried = best.tried;
  return best;
}

// ------------------------------------------------------------------ raporlar
const pctf = (x) => Math.round(x * 100) + '%';
function aggregate(results) {
  const by = {};
  for (const r of results) {
    const k = r.mode + '|' + r.L + '|' + r.style;
    const o = by[k] || (by[k] = { mode: r.mode, L: r.L, style: r.style, n: 0, win: 0, pct: 0, t: 0, launches: 0, benchFull: 0, forced: 0, N: r.N, colors: r.colors, units: r.units, err: 0, timeout: 0 });
    if (r.err) { o.err++; continue; }
    o.n++; if (r.win) o.win++; if (r.timeout) o.timeout++;
    o.pct += r.pct; o.t += r.t; o.launches += r.launches; o.benchFull += r.benchFull; o.forced += r.forced;
  }
  for (const k in by) { const o = by[k]; const n = Math.max(1, o.n); o.rate = o.win / n; o.pctA = o.pct / n; o.tA = o.t / n; o.lA = o.launches / n; o.bA = o.benchFull / n; o.fA = o.forced / n; }
  return by;
}
function writeCsv(by, mode) {
  const rows = ['seviye,dunya,grid,renk,ozel_blok,tarz,deneme,kazanma,kazanma_orani,ort_biten_yuzde,ort_sure_sn,ort_firlatma,ort_tezgah_dolma,ort_zorunlu_hamle,hata'];
  const list = Object.values(by).filter((o) => o.mode === mode).sort((a, b) => a.L - b.L || a.style.localeCompare(b.style));
  for (const o of list) rows.push([o.L, Math.ceil(o.L / 50), o.N, o.colors, o.units, o.style, o.n, o.win, o.rate.toFixed(2), o.pctA.toFixed(0), o.tA.toFixed(0), o.lA.toFixed(1), o.bA.toFixed(1), o.fA.toFixed(1), o.err].join(','));
  const f = path.join(OUT, 'levels-' + mode + '.csv');
  fs.writeFileSync(f, rows.join('\n') + '\n');
  return f;
}
function report(by, secs) {
  const g = (m, L, s) => by[m + '|' + L + '|' + s];
  const L = [];
  const has = (s) => STYLES.includes(s);
  L.push('# Blokpop seviye botu raporu', '');
  L.push('Tarih: ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' (UTC) | Sürüm klasörü: ' + (DIR || '.') + (SEEDMODE ? ' | Boyama başlangıcı: ' + SEEDMODE : '') + ' | Seviyeler: ' + FROM + '–' + TO + ' | Deneme: ' + TRIES + ' | Süre: ' + Math.round(secs / 60) + ' dk', '');
  L.push('**Tarzlar:** *dikkatli* = sadece şu an isabet edecek fili gönderir (önce tezgâhtakiler). *rastgele* = düşünmeden, ortalama 0,8 saniyede bir rastgele dokunur (acemi oyuncunun en kötü hali). Bot iyi bir oyuncu değil, kaba bir ölçüm aracıdır: "dikkatli bot kazanamadı" seviyenin imkânsız olduğunu değil, zor olduğunu gösterir.', '');
  for (const m of MODES) {
    const name = m === 'boya' ? 'BOYAMA' : m === 'insa' ? 'İNŞA' : 'NORMAL';
    const lv = []; for (let i = FROM; i <= TO; i++) lv.push(i);
    L.push('## ' + name + ' modu', '');
    if (m === 'boya') L.push('> Not: Boyama modunda sadece 1–10. seviyeler için özel ayar (PSEEDS) var; 11. seviye ve sonrası normal modun ayarını kullanıyor, yani henüz boyama için ayarlanmadı.', '');
    const sum = { dikkatli: [0, 0, 0], rastgele: [0, 0, 0] };
    for (const i of lv) for (const s of STYLES) { const o = g(m, i, s); if (o && o.n) { sum[s][0] += o.win; sum[s][1] += o.n; sum[s][2] += o.pctA; } }
    for (const s of STYLES) { const v = sum[s]; if (v[1]) L.push('- **' + s + '**: kazanma ' + pctf(v[0] / v[1]) + ' | resmin ortalama biten kısmı: %' + Math.round(v[2] / lv.length)); }
    L.push('');
    if (has('dikkatli')) {
      const hard = lv.map((i) => g(m, i, 'dikkatli')).filter((o) => o && o.n && o.win === 0);
      L.push('**Dikkatli botun hiç kazanamadığı seviyeler (' + hard.length + '):** ' + (hard.length ? hard.map((o) => o.L + ' (%' + Math.round(o.pctA) + ' bitti)').join(', ') : 'yok'), '');
      const jumps = [];
      for (let i = Math.max(FROM + 1, 2); i <= TO; i++) {
        const a = g(m, i - 1, 'dikkatli'), b = g(m, i, 'dikkatli');
        if (a && b && a.n && b.n && a.rate - b.rate >= 0.5) jumps.push(i + ' (' + pctf(a.rate) + ' → ' + pctf(b.rate) + ')');
      }
      L.push('**Ani zorlaşan seviyeler** (dikkatli kazanma oranı bir öncekine göre 50 puan veya daha fazla düşüyor): ' + (jumps.length ? jumps.join(', ') : 'yok'), '');
    }
    if (has('rastgele')) {
      const easy = lv.filter((i) => i <= 10).map((i) => g(m, i, 'rastgele')).filter((o) => o && o.n && o.win === 0);
      L.push('**İlk 10 seviyede rastgele dokunan oyuncunun hiç kazanamadığı seviyeler:** ' + (easy.length ? easy.map((o) => o.L + ' (%' + Math.round(o.pctA) + ' bitti)').join(', ') : 'yok'), '');
    }
    // dunya ozetleri
    const worlds = {};
    for (const i of lv) { const w = Math.ceil(i / 50); for (const s of STYLES) { const o = g(m, i, s); if (!o || !o.n) continue; const q = worlds[w] || (worlds[w] = {}); const z = q[s] || (q[s] = [0, 0, 0]); z[0] += o.win; z[1] += o.n; z[2] += o.tA; } }
    L.push('| Dünya | ' + STYLES.map((s) => s + ' kazanma').join(' | ') + ' | ort. süre (sn, dikkatli) |', '|---|' + STYLES.map(() => '---').join('|') + '|---|');
    for (const w of Object.keys(worlds).sort((a, b) => a - b)) {
      const q = worlds[w]; const tS = q.dikkatli || q[STYLES[0]];
      L.push('| ' + w + ' | ' + STYLES.map((s) => (q[s] ? pctf(q[s][0] / q[s][1]) : '-')).join(' | ') + ' | ' + (tS ? Math.round(tS[2] / Math.max(1, tS[1] / TRIES)) : '-') + ' |');
    }
    L.push('');
    // ilk 20 seviye tablo
    const first = lv.filter((i) => i <= Math.min(TO, FROM + 19));
    L.push('**İlk seviyeler (' + first[0] + '–' + first[first.length - 1] + '):**', '');
    L.push('| Sv | grid | renk | özel blok | ' + STYLES.map((s) => s).join(' | ') + ' | tezgâh dolma (dikkatli) |', '|---|---|---|---|' + STYLES.map(() => '---').join('|') + '|---|');
    for (const i of first) {
      const any = STYLES.map((s) => g(m, i, s)).find((o) => o);
      if (!any) continue;
      const cell = (s) => { const o = g(m, i, s); return o && o.n ? pctf(o.rate) + ' (%' + Math.round(o.pctA) + ')' : '-'; };
      const d = g(m, i, 'dikkatli');
      L.push('| ' + i + ' | ' + any.N + ' | ' + any.colors + ' | ' + any.units + ' | ' + STYLES.map(cell).join(' | ') + ' | ' + (d ? d.bA.toFixed(1) : '-') + ' |');
    }
    L.push('', '_Hücredeki değer: kazanma oranı (resmin ortalama biten yüzdesi)._', '');
  }
  if (MODES.length === 2) {
    L.push('## Boyama ve normal karşılaştırması', '');
    for (const s of STYLES) {
      let bw = 0, bn = 0, nw = 0, nn = 0, bp = 0, np = 0, c = 0; const harder = [];
      for (let i = FROM; i <= TO; i++) {
        const b = g('boya', i, s), n = g('normal', i, s);
        if (!b || !n || !b.n || !n.n) continue;
        bw += b.win; bn += b.n; nw += n.win; nn += n.n; bp += b.pctA; np += n.pctA; c++;
        if (n.rate - b.rate >= 0.5) harder.push(i);
      }
      if (!c) continue;
      L.push('- **' + s + '**: boyama ' + pctf(bw / bn) + ' kazanma, ortalama biten %' + Math.round(bp / c) + ' — normal ' + pctf(nw / nn) + ' kazanma, ortalama biten %' + Math.round(np / c));
      if (harder.length) L.push('  - Boyamada belirgin daha zor olan seviyeler: ' + harder.join(', '));
    }
    L.push('');
  }
  const errs = Object.values(by).filter((o) => o.err).map((o) => o.mode + ' ' + o.L + ' ' + o.style);
  if (errs.length) L.push('## Hatalar', '', errs.join(', '), '');
  const f = path.join(OUT, 'bot-rapor.md');
  fs.writeFileSync(f, L.join('\n'));
  return f;
}

// ------------------------------------------------------------------ ana akis
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const jobs = [];
  if (ARA) { for (const mode of MODES) for (let L = FROM; L <= TO; L++) jobs.push({ mode, L, search: true }); }
  else for (const mode of MODES) for (let L = FROM; L <= TO; L++) for (const style of STYLES) for (let k = 0; k < TRIES; k++) jobs.push({ mode, L, style, k, seed: (L * 7919 + k * 104729 + (style === 'rastgele' ? 17 : 0)) >>> 0 });
  // ayni modu ayni tarayicida toplamak icin sirala
  const total = jobs.length, results = [];
  const t0 = Date.now(); let done = 0, lastPrint = 0;
  const progress = () => { done++; const now = Date.now(); if (now - lastPrint > 5000 || done === total) { lastPrint = now; const el = (now - t0) / 1000; process.stdout.write('  ' + done + '/' + total + ' oyun  (' + Math.round(el) + ' sn, kalan ~' + Math.round(el / done * (total - done) / 60) + ' dk)\n'); } };
  console.log('Blokpop seviye botu: ' + MODES.join('+') + ' | seviye ' + FROM + '-' + TO + ' | ' + STYLES.join('+') + ' x ' + TRIES + ' deneme | ' + WORKERS + ' tarayici');
  // her calisana kendi is listesi (modlari karistirmamak icin modlara gore bol)
  const lanes = Array.from({ length: WORKERS }, () => []);
  jobs.forEach((j, i) => lanes[i % WORKERS].push(j));
  lanes.forEach((l) => l.sort((a, b) => a.mode.localeCompare(b.mode)));
  await Promise.all(lanes.map((l, i) => worker(i, base, l, results, progress)));
  srv.close();
  if (ARA) {
    for (const mode of MODES) {
      const list = results.filter((r) => r.mode === mode).sort((a, b) => a.L - b.L);
      const map = {}; list.forEach((r) => { map[r.L] = r.seed; });
      const f = path.join(OUT, 'tohumlar-' + mode + '.json');
      fs.writeFileSync(f, JSON.stringify({ mode, seedmode: SEEDMODE || 'oyundaki', from: FROM, to: TO, tries: TRIES, seeds: map, detay: list.map((r) => ({ L: r.L, seed: r.seed, eski: r.old, dikkatli: r.dw + '/' + TRIES, dikkatli_biten: r.dp, rastgele: r.dw === TRIES ? r.rw + '/' + TRIES : '-', rastgele_biten: r.rp, kabul: r.ok, denenen: r.tried })) }, null, 1));
      const bad = list.filter((r) => !r.ok).map((r) => r.L + ' (' + r.dw + '/' + TRIES + ')');
      console.log(mode + ': ' + list.length + ' seviye, degisen tohum: ' + list.filter((r) => r.seed !== r.old).length + ', uygun tohum bulunamayan: ' + (bad.length ? bad.join(', ') : 'yok') + '\n  -> ' + path.relative(ROOT, f));
    }
    return;
  }
  const by = aggregate(results);
  const files = MODES.map((m) => writeCsv(by, m));
  files.push(report(by, (Date.now() - t0) / 1000));
  console.log('Bitti. Dosyalar:\n  ' + files.map((f) => path.relative(ROOT, f)).join('\n  '));
})().catch((e) => { console.error(e); process.exit(1); });
