// BLOKPOP beta: kayit guvenligi + cevrimdisi testleri
// Calistirma: once repo kokunde bir web sunucusu acin (python3 -m http.server 8765)
//             sonra: node tools/tests/save-offline.test.js [http://127.0.0.1:8765/beta/] [ekran-goruntusu-klasoru]
'use strict';
const { chromium } = require('playwright');
const URL0 = process.argv[2] || 'http://127.0.0.1:8765/beta/';
const SHOTS = process.argv[3] || '.';
const K = 'blokpop_save_v1_beta';
let pass = 0, fail = 0;
function check(name, cond, extra) { if (cond) { pass++; console.log('  GECTI  ' + name); } else { fail++; console.log('  KALDI  ' + name + (extra ? '  -> ' + extra : '')); } }

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => d.accept());
  const st = () => page.evaluate(() => { const S = window.BlokpopUI.S(); let n = 0; for (const k in S.stars) n += S.stars[k] | 0; return { unlocked: S.unlocked, coins: S.coins, stars: n }; });
  const ready = async () => { await page.waitForFunction(() => window.BlokpopUI && window.BlokpopUI.S, null, { timeout: 30000 }); await page.waitForTimeout(600); };
  const open = async () => { await page.goto(URL0, { waitUntil: 'load' }); await ready(); };
  const doSave = () => page.evaluate(() => { const b = document.querySelector('[data-act="tgSound"]'); b.click(); b.click(); });

  console.log('1) Ilk acilis');
  await open();
  check('oyun hatasiz acildi', errs.length === 0, errs.join(' | '));
  await doSave();

  // gercek bir ilerleme olustur: 37. bolum, yildizlar, coin
  const seed = await page.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.unlocked = 37; d.coins = 4321; d.stars = {}; for (let i = 1; i < 37; i++) d.stars[i] = 3; return JSON.stringify(d); }, K);
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [K, seed]);

  console.log('2) Eski formattaki kayit (v2.76) yeni surume tasiniyor');
  await open();
  let s = await st();
  check('eski kayit kayipsiz yuklendi (bolum 37, 4321 coin)', s.unlocked === 37 && s.coins === 4321, JSON.stringify(s));
  check('eski kaydin ham kopyasi saklandi', await page.evaluate(k => !!localStorage.getItem(k + '_legacy_backup'), K));
  await doSave();
  await page.waitForTimeout(500);
  const bk = await page.evaluate(k => ['_bak_last', '_bak_day', '_bak_best'].map(x => !!localStorage.getItem(k + x)), K);
  check('3 yedek olustu (son / gunluk / en iyi)', bk.every(Boolean), JSON.stringify(bk));
  check('IndexedDB kopyasi yazildi', await page.evaluate(() => new Promise(r => { const q = indexedDB.open('blokpop_saves'); q.onsuccess = () => { const g = q.result.transaction('s').objectStore('s').get('blokpop_save_v1_beta'); g.onsuccess = () => r(!!g.result); g.onerror = () => r(false); }; q.onerror = () => r(false); })));

  console.log('3) Bozuk kayit (gecersiz JSON)');
  await page.evaluate(k => localStorage.setItem(k, '{bozuk kayit!!'), K);
  await open(); s = await st();
  check('ilerleme yedekten otomatik geri geldi', s.unlocked === 37 && s.stars === 108, JSON.stringify(s));
  check('ana kayit onarildi', await page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)).unlocked === 37; } catch (e) { return false; } }, K));
  check('bozuk veri inceleme icin ayri saklandi', await page.evaluate(k => localStorage.getItem(k + '_corrupt') === '{bozuk kayit!!', K));

  console.log('4) Yarim yazilmis kayit');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v.slice(0, Math.floor(v.length / 2))), [K, seed]);
  await open(); s = await st();
  check('yarim kayitta ilerleme kaybolmadi', s.unlocked === 37, JSON.stringify(s));

  console.log('5) Telefon depolamayi temizledi (localStorage tamamen bos, IndexedDB duruyor)');
  await page.evaluate(() => localStorage.clear());
  await page.goto(URL0, { waitUntil: 'load' });
  await page.waitForTimeout(2500); await ready(); s = await st();
  check('IndexedDB kopyasindan otomatik kurtarildi', s.unlocked === 37, JSON.stringify(s));

  console.log('6) localStorage yazilamiyor (dolu / kapali)');
  await page.addInitScript(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__lsFull) throw new Error('QuotaExceeded'); return o.call(this, k, v); }; });
  await open();
  const before = errs.length;
  await page.evaluate(() => { window.__lsFull = true; const S = window.BlokpopUI.S(); S.coins = 9999; });
  await doSave();
  check('yazma hatasinda oyun cokmedi', errs.length === before, errs.slice(before).join(' | '));
  await page.evaluate(() => { window.__lsFull = false; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
  check('bekleyen kayit depolama acilinca yazildi', await page.evaluate(k => JSON.parse(localStorage.getItem(k)).coins === 9999, K));

  console.log('7) Disa aktar / ice aktar');
  const code = await page.evaluate(() => { document.querySelector('[data-act="bkOpen"]').click(); return document.getElementById('bkTxt').value; });
  check('yedek kodu uretildi', /^BLOKPOP1:/.test(code), code.slice(0, 30));
  await page.screenshot({ path: SHOTS + '/1-yedek-ekrani.png' });
  await page.evaluate(k => { const d = JSON.parse(localStorage.getItem(k)); d.unlocked = 1; d.stars = {}; d.coins = 0; localStorage.setItem(k, JSON.stringify(d)); }, K);
  await open();
  await page.evaluate(c => { document.querySelector('[data-act="bkOpen"]').click(); document.getElementById('bkTxt').value = c; document.querySelector('[data-act="bkImport"]').click(); }, code);
  await page.waitForTimeout(1500); await ready(); s = await st();
  check('ice aktarilan yedek geri yuklendi', s.unlocked === 37 && s.coins === 9999, JSON.stringify(s));
  await page.evaluate(() => { document.querySelector('[data-act="bkOpen"]').click(); document.getElementById('bkTxt').value = 'BLOKPOP1:abc' + 'x'.repeat(40); document.querySelector('[data-act="bkImport"]').click(); });
  await page.waitForTimeout(400); s = await st();
  check('bozuk yedek kodu reddedildi, ilerleme etkilenmedi', s.unlocked === 37);

  console.log('8) Cevrimdisi calisma');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => { const ks = await caches.keys(); for (const k of ks) { const c = await caches.open(k); const n = (await c.keys()).length; if (n >= 50) return true; } return false; }, null, { timeout: 120000, polling: 1000 });
  const cached = await page.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks.find(k => k.indexOf('blokpop-beta-v') === 0)); return (await c.keys()).map(r => new URL(r.url).pathname.replace(/^.*\/beta\//, '')); });
  check('arka planlar onbellekte (20/20)', cached.filter(x => /^bg\//.test(x)).length === 20);
  check('3D modeller onbellekte (4/4)', cached.filter(x => /\.glb$/.test(x)).length === 4);
  await ctx.setOffline(true);
  const offErr = errs.length;
  await page.goto(URL0, { waitUntil: 'load' }); await ready();
  check('internet yokken oyun acildi', (await st()).unlocked === 37);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOTS + '/2-cevrimdisi-acilis.png' });
  await page.evaluate(() => { const b = document.getElementById('btnPlay'); if (b) b.click(); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOTS + '/3-cevrimdisi-harita.png' });
  const bgOk = await page.evaluate(() => fetch('bg/w01.webp').then(r => r.ok).catch(() => false));
  const glbOk = await page.evaluate(() => fetch('live_pofi.glb').then(r => r.ok).catch(() => false));
  check('cevrimdisi arka plan yuklenebiliyor', bgOk);
  check('cevrimdisi 3D Pofi modeli yuklenebiliyor', glbOk);
  await page.evaluate(() => window.BlokpopUI.startLevel(5));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: SHOTS + '/4-cevrimdisi-bolum.png' });
  check('cevrimdisi bolum acildi', await page.evaluate(() => !!(window.BP && window.BP.G && window.BP.G.state)));
  check('cevrimdisi hata yok', errs.length === offErr, errs.slice(offErr).join(' | '));
  await ctx.setOffline(false);

  console.log('\nSONUC: ' + pass + ' gecti, ' + fail + ' kaldi');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
