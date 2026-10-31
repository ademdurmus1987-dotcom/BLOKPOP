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

### Boyama tohumu arama (v2.80)
Yeni boyama seviyeleri eklendiğinde ya da bir seviye kilitlendiğinde:

```
node tools/level-bot.js --mode boya --from 101 --to 200 --ara
```

Her seviye için dikkatli oyuncunun her denemede kazandığı (ama rastgele oyuncunun hep kazanmadığı) bir tohum arar ve `tools/out/tohumlar-boya.json` dosyasına yazar. Bu değerler `beta/index.html` içindeki `PSEEDS` listesine eklenir.

- Boyama başlangıç kuralı: `--seedmode merkez|renk|bolge` (oyunda `?ps=` ile denenebilir). Varsayılan `bolge`: her renk bölgesinin ortasından boyama başlar.

## Oyun modları (v2.82)
- **Patlat** (normal): resim küp küp sökülür.
- **Boya** (`?mod=boya`): gri tonlu numaralı küpler, filler numarasına göre boyar.
- **İnşa** (`?mod=insa`): sadece karakter (arka fon yok), cam küpler + numara, filler %45 hızlı. Kural (v2.83): resim ortadan büyür; bir küp ancak yapılmış küplere komşuysa açılır (açık küplerin numarası koyu). Fil her hatta **merkeze en yakın açık boşluğa** küp koyar; o boşluk başka numaraysa o hatta koyamaz. Yanlış fil gönderilirse turu boşa geçer ve tezgâha döner, tezgâh dolarsa kaybedilir. 1. seviye serbest ve birebir sıralı (öğretici), 1–3 kaybedilemez. Tohumlar `BSEEDS` listesinde (`--mode insa --ara`). Ayarlar `BT` nesnesinde (`amin/amax`: fil mermisi, grid boyuna göre).

Haritadaki **Mod** düğmesi üç mod arasında seçim yapar; her modun ilerlemesi ayrı tutulur. Bot: `--mode insa` ya da `--mode hepsi`.

## Galeri için resimlerin aslı (v2.81)
Boyama galerisinde her resmin aslı (Gemini'den gelen orijinal görsel) gösterilir. Görselleri eklemek için:

```
python3 tools/orijinal-ekle.py resimler.zip        # ya da klasör / tek tek dosyalar
```

Dosya adları önemli değil: her görsel oyundaki piksel resimlerle karşılaştırılıp en benzeyenle eşleştirilir. Görseller `beta/orig/` klasörüne küçültülmüş `.webp` olarak kaydedilir, liste `beta/orig/list.json` dosyasındadır. Kontrol için `tools/out/orijinal-eslesme.png` (solda gelen görsel, sağda eşleştiği oyun resmi). Aslı olmayan resimlerde galeri küp görünümünü gösterir. `orig/` klasörü oyunun ilk indirmesine dahil değildir, resme bakılınca indirilir.

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
