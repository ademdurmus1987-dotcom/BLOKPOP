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

## Buz prototipi (v2.94, 3B) — `beta/buz/`
Ayrı küçük bir oyun, three.js ile gerçek 3B. Ekran ikiye bölünür: üstte arkaya yaslanmış dev tahta karşıdan (3B buz küpleri, arkasında resim `beta/bg`, ahşap çerçeve), altta tahtadan bir boşlukla ayrılmış atıcı alanı tepeden (mavi-gri taş zemin, düz bant, yuvalar, sol altta 4 gri kare tabla, 4 kuyruk oluğu). İki kamera ayrı katman görür (0 tahta, 1 atıcı alanı); alt kameranın x ölçeği tahtanın sütunlarıyla eşlenir, atış dik gider. Küpler: sv 1–10 14×18, sv 11–30 21×27, sv 31+ 28×36.

Akış: oluğa dokun → yığından tabla banda fırlar (mantar patlaması sesi), Pofi tablaya biner. Bantta başını ve hortumunu kaldırıp sütunun en alttaki kendi renk küpüne **bir** atış yapar (tok vuruş sesi). Bantta en fazla 4 Pofi. Tur bitince mermisi kalan Pofi yuvaya iner, tabla yığına döner. Yuva kalmazsa oyun biter.

Atıcı (v2.94): **küp Pofi** — kutu gövdeli fil (yuvarlak köşeli küp gövde, iki yanda büyük kulak, önde 3 parçalı hortum, kısa bacaklar, püsküllü kuyruk, kaşlı gözler), parçalardan kodla kurulur ve renge boyanır; atışta gövde geriye yaslanır, hortum yukarı kıvrılır. Eski GLB Pofi: `?pofi=glb`. Boyut: `?ks=1`.

Engeller birkaç küpü tek parça kaplar: 3B çivili tahta, metal zincir, asma kilit + anahtar; kalın buz beyaz kabuk. Ses/efekt ana oyunun ses motorundan; titreşim ayarı (⚙). Yavaş telefonda kalite kendiliğinden düşer.

Yeni deneyimler (v2.90), her biri ilk geldiği seviyede ipucuyla tanıtılır:
- **Büyük kaya** (sv 11): 2×2 blok, her renk vurur, canı tahtanın iki katı; vuruldukça çatlar.
- **Drone Pofi** (sv 12): tablaya binmez, tahtanın önünde yılan gibi uçar; yakındaki kendi renk küplerini (en altta olmasalar da) vurur, en alttakileri banttakilere bırakır. Bant doluyken de gönderilir; aynı anda bir drone.
- **Bomba küp** (sv 13): kırılınca çevresini (blok+1 yarıçap) patlatır, engellere hasar verir, bombalar zincirleme patlar. Fazla kalan mermi kuyruktan düşülür.
- **Donmuş Pofi** (sv 15): oluğun başına gelince ❄ sayısı kadar küp kırılana kadar gönderilemez. Hiç hamle kalmazsa kendiliğinden çözülür.
- Sv 16'dan sonra engeller ve özel Pofiler karışık kombinasyonlarla döner.

Kamera (v2.92, Ayarlar → Kamera): **Derin** (varsayılan) tek kamera; atıcıların arkasından tahtaya bakar. Görüntü düzlemi tahtaya paralel, tahta dikdörtgen ve kenardan kenara kalır (geniş ekranda yükseklik %60 ile sınırlı), zemin ve oluklar perspektifle tahtaya doğru daralır. Oluklar ikisi solda ikisi sağda, ortada tahtaya uzanan boş zemin; kuyrukta 3 Pofi görünür, yakındakiler küçültülür. Kamera v2.93'te biraz yukarıda, tahtanın dibinde gölge var (birleşim yeri derin görünür). v2.94: ray kaldırıldı (`krail=1` ile açılır), bant tahtadan 4 birim önde, bandın uzak kenarı yere doğru eğimli şerit, yuva ve oluklar aralıklı (`kpad=0.15&klane=0.47`), çerçevenin dış kenarları ekran kenarında. Deneme: `?kam=derin&kd=22&kh=0.28&kt=28&kb=4&kgap=1.2&klw=1.25&klane=0.47&kq=0.74&krail=0` (kd mesafe, kh bakış yüksekliği, kt tahta eğimi = kamera açısı, kb bant uzaklığı, krail=0 rayı kapatır). **Tepeden**: eski bölünmüş görünüm (`?kam=tepe`).

Derinlik (Tepeden): tahta ahşap bir kaidenin üstünde durur; altta bandın arkasında karanlık bir hendek ve platform kenarı görünür (`?sill=0.45&ftop=0.16` ile denenebilir).

Resimler (v2.91): `beta/buz/resim/` altında 107 piksel resim (hayvanlar, tatlılar) + 20 dünya arka planı. Sıra: iki özel resim, bir arka plan (60. seviyeden sonra sadece özel resimler).

Yeni resim eklemek: `python3 tools/buz-resim-ekle.py a.zip b.zip klasor/ resim.png` (birden çok zip olur). Araç iki türü ayırır:
- **Düz zeminli** (beyaz ya da tek renk zemin üstünde karakter): özneyi keser, tahtayı dolduracak kadar büyütür (piksel resimde keskin kalır), zemini pastel renkli kareli desenle değiştirir; öznenin içindeki beyazlar (panda yüzü gibi) korunur. Pastel renk öznenin rengine en uzak olandan seçilir, böylece zemin küpleri farklı renk olur. Alttan kesik özne tahtanın altına oturur, kenardaki renk şeritleri atılır.
- **Tam sahne**: ortadan 7:9 kesilir.
Benzer resim ikinci kez eklenmez (`beta/buz/resim/liste.json`). Kontrol: `tools/out/buz-resim.png`. Çok parçalı eklemede `--izgarasiz` verip en sonda `python3 tools/buz-izgara.py` çalıştır (~1 dk).

Küp renkleri `izgara.js` içinde sıkıştırılmış (renk harfi + tekrar sayısı); motor açarken çözer. Açılan resim ton eşlemesiz çizilir (canlı renk; `?picglow=0.2` ile parlaklık denenebilir).

- Dosyalar: `beta/buz/index.html`, `beta/buz/oyun3d.js` (3B çizim, ses, dokunma), `beta/buz/motor.js` (kurallar; Node'da da çalışır), `beta/buz/izgara.js` (küp renkleri).
- Test: `?test=1` döngüyü durdurur; `BZ.run(sn, true, sessiz)` zamanı ilerletir (sessiz=true çizmeden), `BZ.snap()` kareyi PNG verir. Kamera denemesi: `?tilt=9&fpitch=64&ffov=30&gap=0.035`.
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

## Kamyon modu (v3.00, 3B) — `beta/kamyon/`
Ayrı küçük bir oyun, Buz gibi three.js ile gerçek 3B. Ana oyunun **Mod** menüsünde "Kamyon (deneme)".

Oyun: ortada resim küpleri, etrafında kare bant (saat yönü), altta park yerleri ve kamyon kuyrukları. Kuyruktaki kamyona dokun → giriş kapısına zıplar → banda çıkar, tahtaya dönük ilerler. Önünden geçtiği sıranın **kenardaki ilk küpü** kendi rengindeyse hortumu uzanır, küpü kapar, küp kasaya düşer (dıştan içe, Patlat moduyla aynı engelleme). Kasa dolunca korna + 180° dönüş + gidiş, coin. Dolmadan turu biten kamyon park yerine iner (yükü kasasında kalır); park yeri yoksa kaybedilir (60 coin ile +1 park yeri). Bantta aynı anda en fazla `beltMax` kamyon.

Zorluk (`motor.js` → `PLAN`): 1 tanıtım; 2–4 renk/karışıklık artar; 5'ten sonra 3 park + 3 bant; 6 farklı kasalar; 11 **kilitli kamyon** (N kamyon gidince açılır); 13'ten sonra 21×27 tahta; 16 **buzlu küp** (iki yutuş); 21 **XL kamyon**; 23 **çift hortum** (x2); 25 **gökkuşağı/joker** (her rengi yutar); 26+ karışık kombinasyonlar. Yeni özellik ilk geldiği seviyede ipucuyla tanıtılır ve kuyrukta ilk ekranda görünür.

Bot: `node tools/kamyon-bot.js --from 1 --to 30 --tries 4` — "dikkatli" ve "rastgele" oyuncunun kazanma oranı. Hedef: dikkatli hep kazanır, rastgele 5. seviyeden sonra çoğunlukla kaybeder.

Kamyon modeli: `beta/kamyon/kamyon.glb` (0,8 MB, ~16 bin üçgen; gövde + 4 ayrı tekerlek, ön yön −X). Tripo3D çıktısından (65 MB, 2M üçgen) `tools/kamyon-model/` ile üretildi:
```
python3 tools/kamyon-model/analyze.py model.glb        # inv.npy (kaynaştırma)
python3 tools/kamyon-model/prep.py model.glb           # in.bin + doku jpg'leri
g++ -O3 -o simplify tools/kamyon-model/simplify.cpp && ./simplify in.bin o16.bin 16000 7 30
python3 tools/kamyon-model/mask2.py tex1.jpg tint2.png  # gövde maskesi (alfa) -> webp'ye çevir
python3 tools/kamyon-model/buildfinal.py o16.bin tint2.webp kamyon.glb
```
Dokunun alfa kanalı gövde maskesidir; oyunda shader gövdeyi kamyonun rengine boyar, tekerlek/göz/cam korunur.

- Dosyalar: `beta/kamyon/index.html`, `oyun.js` (3B çizim, ses, dokunma, arayüz), `motor.js` (kurallar; Node'da da çalışır). Resimler Buz'un kütüphanesinden (`../buz/izgara.js`).
- Kayıt: `blokpop_kamyon_v1` (seviye, yıldız). Coin'ler ana oyunla ortak (`blokpop_save_v1` içindeki `coins`).
- Test: `?test=1` (otomasyon kancası `window.KM`), `?sv=12` seviye, `?auto=1` dikkatli oto-oynama, `?auto=r` rastgele.
- Yavaş telefonda kalite kendiliğinden düşer (piksel oranı 1, kamyon gölgeleri kapanır).
