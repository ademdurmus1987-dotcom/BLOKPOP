# BLOKPOP araçları

## Çevrimdışı dosya listesi (sw.js)
Yeni görsel, model veya ses eklediğinde çalıştır:

```
node tools/gen-sw-manifest.js beta --bump
```

Beta klasöründeki dosyaları tarar, `beta/sw.js` içindeki önbellek listesini yeniden yazar ve önbellek sürümünü bir artırır.

## Kayıt + çevrimdışı testleri
```
python3 -m http.server 8765          # repo kökünde
node tools/tests/save-offline.test.js http://127.0.0.1:8765/beta/ ./ekran
```
Playwright gerekir (`npm i -g playwright && npx playwright install chromium`).

## v2.77 kayıt sistemi (beta)
- Ana kayıt anahtarı ve biçimi değişmedi; ana sürümle uyumlu.
- 3 yedek: `_bak_last` (son), `_bak_day` (günün ilk kaydı), `_bak_best` (en ileri ilerleme). Hepsi sağlama (checksum) ile korunur.
- IndexedDB'de ek kopya (`blokpop_saves`). Telefon localStorage'ı silerse buradan otomatik geri yüklenir.
- Açılışta ana kayıt bozuksa en yeni geçerli yedek otomatik yüklenir; bozuk veri `_corrupt` anahtarında saklanır.
- İlk açılışta eski kaydın ham kopyası `_legacy_backup` anahtarına alınır.
- Ayarlar → Kayıt yedeği: kodu kopyala, dosya olarak indir, içe aktar.
