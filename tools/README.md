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

## Seviye botu (v2.79)
Oyunu görünmez bir tarayıcıda açar, seviyeleri iki tarzla oynar ve zorluk raporu çıkarır. Oyunun kodunu değiştirmez, kendi web sunucusunu kendisi açar.

```
node tools/level-bot.js                                   # iki mod, 1–100, her tarz 3 deneme (~30 dk)
node tools/level-bot.js --mode boya --from 1 --to 10 --tries 5
node tools/level-bot.js --mode normal --from 101 --to 200 --dir .   # ana sürüm
```

- Tarzlar: `dikkatli` (sadece şu an isabet edecek fili gönderir) ve `rastgele` (düşünmeden dokunan acemi).
- Çıktılar `tools/out/`: `levels-normal.csv`, `levels-boya.csv`, `bot-rapor.md` (kazanılamayan seviyeler, ani zorlaşanlar, dünya özetleri, iki modun karşılaştırması).
- Başka bir Chrome kullanmak için: `--chrome /yol/chrome` ya da `BLOKPOP_CHROME` ortam değişkeni.

## Test raporları (v2.79)
Oyunda Ayarlar → **Test raporu**: oyuncu adını yazar, **Raporu gönder** ile bir `.txt` dosyası paylaşır (WhatsApp vb.). Kayıtlar yalnızca oyuncunun telefonunda tutulur, kendiliğinden hiçbir yere gönderilmez.

Gelen dosyaları `tools/test-raporlari/` klasörüne koy (bu klasör GitHub'a yüklenmez), sonra:

```
node tools/test-ozet.js
```

Çıktı: `tools/out/test-ozet.md` — kişi başı oynama, ilk 10 seviyeyi bitirme oranı, seviye başına kayıp oranı, vazgeçilen seviyeler, boyama ve normal mod karşılaştırması. Dosya yerine metin geldiyse metni `.txt` olarak kaydetmek yeterli.

## v2.77 kayıt sistemi (beta)
- Ana kayıt anahtarı ve biçimi değişmedi; ana sürümle uyumlu.
- 3 yedek: `_bak_last` (son), `_bak_day` (günün ilk kaydı), `_bak_best` (en ileri ilerleme). Hepsi sağlama (checksum) ile korunur.
- IndexedDB'de ek kopya (`blokpop_saves`). Telefon localStorage'ı silerse buradan otomatik geri yüklenir.
- Açılışta ana kayıt bozuksa en yeni geçerli yedek otomatik yüklenir; bozuk veri `_corrupt` anahtarında saklanır.
- İlk açılışta eski kaydın ham kopyası `_legacy_backup` anahtarına alınır.
- Ayarlar → Kayıt yedeği: kodu kopyala, dosya olarak indir, içe aktar.
