#!/usr/bin/env node
// BLOKPOP test raporlarini birlestirir.
// Testciler oyunda Ayarlar > Test raporu > "Raporu gonder" ile bir .txt dosyasi gonderir (WhatsApp vb.).
// O dosyalari bir klasore koy ve calistir:
//   node tools/test-ozet.js                        -> tools/test-raporlari/ klasorundeki tum .txt/.json dosyalari
//   node tools/test-ozet.js klasor/yolu
// Cikti: tools/out/test-ozet.md
// Dosya yerine kopyalanmis metin geldiyse metni .txt olarak kaydetmen yeterli; "---BLOKPOP-JSON---" satirindan sonrasi okunur.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.argv[2] || path.join(ROOT, 'tools', 'test-raporlari'));
const OUT = path.join(ROOT, 'tools', 'out');
const MARK = '---BLOKPOP-JSON---';

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const i = raw.indexOf(MARK);
  const js = i >= 0 ? raw.slice(i + MARK.length) : raw;
  const a = js.indexOf('{'), b = js.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('rapor verisi bulunamadi');
  const d = JSON.parse(js.slice(a, b + 1));
  if (!d || d.game !== 'blokpop' || !Array.isArray(d.ev)) throw new Error('Blokpop raporu degil');
  return d;
}

// bir oyuncunun olaylarindan ozet
function analyse(d) {
  const ses = {}, per = {};
  let firstT = Infinity, lastT = 0;
  for (const e of d.ev) {
    firstT = Math.min(firstT, e.t); lastT = Math.max(lastT, e.t);
    const q = ses[e.s] || (ses[e.s] = { a: e.t, b: e.t });
    q.a = Math.min(q.a, e.t); q.b = Math.max(q.b, e.t);
    if (e.L == null || (e.m !== 'boya' && e.m !== 'normal' && e.m !== 'insa')) continue;
    const k = e.m + ':' + e.L;
    const o = per[k] || (per[k] = { m: e.m, L: e.L, st: 0, w: 0, l: 0, q: 0, best: 0, tw: 0, boost: 0, rev: 0 });
    if (e.n === 'level_start') o.st++;
    else if (e.n === 'level_win') { o.w++; o.best = 100; if (e.time != null) o.tw += e.time; else if (e.d != null) o.tw += e.d; }
    else if (e.n === 'level_lose') { o.l++; o.best = Math.max(o.best, e.p | 0); }
    else if (e.n === 'quit') { o.q++; o.best = Math.max(o.best, e.p | 0); }
    else if (e.n === 'booster' || e.n === 'super_pofi') o.boost++;
    else if (e.n === 'revive') o.rev++;
  }
  const sessions = Object.values(ses);
  const minutes = sessions.reduce((s, q) => s + (q.b - q.a) / 60000, 0);
  const days = new Set(d.ev.map((e) => new Date(e.t).toISOString().slice(0, 10)));
  return { name: d.name || '(isimsiz)', ver: d.ver, per, sessions: sessions.length, minutes, days: days.size, firstT, lastT };
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '-');

(function main() {
  if (!fs.existsSync(DIR)) {
    fs.mkdirSync(DIR, { recursive: true });
    console.log('Klasor olusturuldu: ' + path.relative(ROOT, DIR) + '\nTestcilerden gelen rapor dosyalarini bu klasore koyup tekrar calistir.');
    return;
  }
  const files = fs.readdirSync(DIR).filter((f) => /\.(txt|json)$/i.test(f));
  const players = [], bad = [];
  for (const f of files) {
    try { players.push(analyse(parse(path.join(DIR, f)))); } catch (e) { bad.push(f + ' (' + e.message + ')'); }
  }
  // ayni kisi iki kez gonderdiyse en cok olayi olani tut
  const byName = {};
  for (const p of players) { const k = p.name.toLowerCase(); const n = Object.keys(p.per).length; if (!byName[k] || n >= Object.keys(byName[k].per).length) byName[k] = p; }
  const P = Object.values(byName);
  const L = [];
  L.push('# Blokpop test özeti', '');
  L.push('Rapor sayısı: ' + P.length + (bad.length ? ' | Okunamayan: ' + bad.join(', ') : ''), '');
  if (!P.length) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'test-ozet.md'), L.join('\n') + '\nHenüz rapor yok.\n'); console.log('Rapor bulunamadi: ' + DIR); return; }

  // kisi tablosu
  L.push('## Kişiler', '', '| Kişi | Gün | Oturum | Süre (dk) | Boyama: oynanan / biten | İnşa: oynanan / biten | Normal: oynanan / biten |', '|---|---|---|---|---|---|---|');
  for (const p of P) {
    const c = (m) => { const v = Object.values(p.per).filter((o) => o.m === m); return v.length ? v.length + ' / ' + v.filter((o) => o.w).length : '-'; };
    L.push('| ' + p.name + ' | ' + p.days + ' | ' + p.sessions + ' | ' + Math.round(p.minutes) + ' | ' + c('boya') + ' | ' + c('insa') + ' | ' + c('normal') + ' |');
  }
  const avgMin = P.reduce((s, p) => s + p.minutes / Math.max(1, p.sessions), 0) / P.length;
  const back = P.filter((p) => p.days >= 2).length;
  L.push('', '- Ortalama oturum süresi: **' + avgMin.toFixed(1) + ' dk**');
  L.push('- Birden fazla gün oynayan: **' + back + '/' + P.length + '** (' + pct(back, P.length) + ')', '');

  // mod karsilastirmasi
  L.push('## Modların karşılaştırması', '', '| | Boyama | İnşa | Normal |', '|---|---|---|---|');
  const M = {};
  for (const m of ['boya', 'insa', 'normal']) {
    const who = P.filter((p) => Object.values(p.per).some((o) => o.m === m));
    const f10all = who.filter((p) => { for (let i = 1; i <= 10; i++) { const o = p.per[m + ':' + i]; if (!o || !o.w) return false; } return true; }).length;
    const f10avg = who.reduce((s, p) => { let n = 0; for (let i = 1; i <= 10; i++) { const o = p.per[m + ':' + i]; if (o && o.w) n++; } return s + n; }, 0) / Math.max(1, who.length);
    let w = 0, l = 0, q = 0, nl = 0, b = 0, r = 0;
    for (const p of who) for (const o of Object.values(p.per)) if (o.m === m) { w += o.w; l += o.l; q += o.q; nl++; b += o.boost; r += o.rev; }
    M[m] = { who: who.length, f10all, f10avg, w, l, q, nl, b, r };
  }
  const row = (t, f) => L.push('| ' + t + ' | ' + f(M.boya) + ' | ' + f(M.insa) + ' | ' + f(M.normal) + ' |');
  row('Oynayan kişi', (o) => String(o.who));
  row('İlk 10 seviyenin hepsini bitiren', (o) => (o.who ? o.f10all + '/' + o.who + ' (' + pct(o.f10all, o.who) + ')' : '-'));
  row('İlk 10 seviyeden ortalama biten', (o) => (o.who ? o.f10avg.toFixed(1) + '/10' : '-'));
  row('Kazanma / (kazanma + kaybetme)', (o) => pct(o.w, o.w + o.l));
  row('Vazgeçme (bölümden çıkma)', (o) => String(o.q));
  row('Kişi başı oynanan seviye', (o) => (o.who ? (o.nl / o.who).toFixed(1) : '-'));
  row('Yardımcı kullanımı / canlandırma', (o) => o.b + ' / ' + o.r);
  L.push('');

  // seviye tablosu
  for (const m of ['boya', 'insa', 'normal']) {
    const lv = {};
    for (const p of P) for (const o of Object.values(p.per)) if (o.m === m) {
      const z = lv[o.L] || (lv[o.L] = { L: o.L, people: 0, done: 0, w: 0, l: 0, q: 0, best: 0, tw: 0, nw: 0 });
      z.people++; if (o.w) z.done++; z.w += o.w; z.l += o.l; z.q += o.q; z.best += o.best; if (o.w) { z.tw += o.tw / o.w; z.nw++; }
    }
    const list = Object.values(lv).sort((a, b) => a.L - b.L);
    if (!list.length) continue;
    L.push('## ' + (m === 'boya' ? 'Boyama' : m === 'insa' ? 'İnşa' : 'Normal') + ' — seviye seviye', '');
    L.push('| Sv | Oynayan | Bitiren | Kayıp oranı | Vazgeçme | Ort. bitirme süresi (sn) |', '|---|---|---|---|---|---|');
    for (const z of list) L.push('| ' + z.L + ' | ' + z.people + ' | ' + z.done + ' (' + pct(z.done, z.people) + ') | ' + pct(z.l, z.w + z.l) + ' | ' + z.q + ' | ' + (z.nw ? Math.round(z.tw / z.nw) : '-') + ' |');
    const stuck = list.filter((z) => z.people >= 2).sort((a, b) => (b.l + b.q) / b.people - (a.l + a.q) / a.people).slice(0, 5);
    if (stuck.length) L.push('', '**En çok takılınan:** ' + stuck.map((z) => 'Sv ' + z.L + ' (kişi başı ' + ((z.l + z.q) / z.people).toFixed(1) + ' kayıp/çıkış)').join(', '));
    const quit = list.filter((z) => z.q > 0).sort((a, b) => b.q - a.q).slice(0, 5);
    if (quit.length) L.push('', '**En çok vazgeçilen:** ' + quit.map((z) => 'Sv ' + z.L + ' (' + z.q + ')').join(', '));
    L.push('');
  }
  fs.mkdirSync(OUT, { recursive: true });
  const f = path.join(OUT, 'test-ozet.md');
  fs.writeFileSync(f, L.join('\n') + '\n');
  console.log(P.length + ' rapor birlestirildi -> ' + path.relative(ROOT, f) + (bad.length ? '\nOkunamayan: ' + bad.join(', ') : ''));
})();
