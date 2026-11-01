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
- **İnşa** (`?mod=insa`): sadece karakter (arka fon yok), filler %45 hızlı. Kural (v2.84) = patlatmanın tersi: patlatmada fil hattında kenardan ilk küpü vurur; inşada hattında merkezden ilk boş yuvaya küp koyar. O yuva filin rengi değilse atış olmaz (yol kapalı). Tahta köşegenlerle dört parçaya bölünür; her parçayı o taraftaki filler doldurur, böylece dışarıdaki yuva içeridekinden önce dolamaz ve delik kalmaz. Sadece şu an doldurulabilen yuvalar renkli ve numaralı görünür, diğerleri düz cam. Tohumlar `BSEEDS` (`--mode insa --ara`), ayarlar `BT` (`amin/amax` fil mermisi, `look` halka sınırı — kapalı, açınca oyun kilitleniyor).

Haritadaki **Mod** düğmesi üç mod arasında seçim yapar; her modun ilerlemesi ayrı tutulur. Bot: `--mode insa` ya da `--mode hepsi`.

## Buz prototipi (v2.88, 3B) — `beta/buz/`
Ayrı küçük bir oyun, three.js ile gerçek 3B. Arkaya yaslanmış dev tahta ekranı tam genişlikte kaplar: 3B buz küpleri (yuvarlak kenar, parlak), arkasında resim (`beta/bg`), ahşap çerçeve. Küpler seviyeyle küçülür: sv 1–5 14×18, sv 6–20 21×27, sv 21+ 28×36. Tahtanın dibinde zeminle aynı düzlemde düz bant (çarksız), önünde zeminde yuvalar (bekleme), sol altta tabla yığını (en fazla 5 = bant kapasitesi) ve 4 kuyruk oluğu. Filler ana oyunun 3B Pofi modeli (`../live_pofi.glb`, renge boyanır), arkadan görünür.

Akış: oluğa dokun → yığından tabla banda fırlar, Pofi zıplayıp tablaya biner. Bantta başını ve hortumunu kaldırıp sütunun en alttaki kendi renk küpünü vurur; aynı renk küpleri bir blok yüksekliğine kadar delip geçer. Tur bitince mermisi kalan Pofi yuvaya iner, tabla yığına geri uçar. Yuva kalmazsa oyun biter.

Engeller birkaç küpü tek parça kaplar (blok = sütun/7 küp): 3B çivili tahta (her renk vurur, üstündeki sayı kalan atış), metal zincir (sadece zincirin rengi), asma kilit + anahtar (anahtar bir buz bloğunun içinde). Kalın buz: buzlu beyaz kabuk, 2 atış.

Ses/efekt ana oyunun ses motorundan; kombo yazıları, titreşim ayarı (⚙). Yavaş telefonda çözünürlük ve gölgeler kendiliğinden düşer.

- Dosyalar: `beta/buz/index.html` (kabuk), `beta/buz/oyun3d.js` (3B çizim, ses, dokunma), `beta/buz/motor.js` (kurallar; Node'da da çalışır), `beta/buz/izgara.js` (küp renkleri).
- Test/ekran görüntüsü: `?test=1` döngüyü durdurur; `BZ.run(sn, true)` zamanı ilerletir, `BZ.snap()` kareyi PNG verir. Kamera denemesi: `?fov=36&tilt=9&fit=10.9`.
- Küp renkleri: `python3 tools/buz-izgara.py`. Bot: `node tools/buz-bot.js --from 1 --to 30 --tries 5`.
- Kayıt ayrı anahtarda (`blokpop_buz_v1`). Beta'da Mod menüsünde "Buz (deneme)".

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
