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

## Engel ve strateji sistemi (v3.10, Patlat modu)
Ana oyunun (Patlat) 1000 seviyesinin hepsine engel katmanı eklendi; seviyelerin resimleri, sırası ve sayısı aynı. 1–11 tanıtım bölümleri sade kalır, 12'den itibaren her seviyede en az bir engel vardır. Kod `beta/index.html` içinde `v3.10 ENGEL VE STRATEJI SISTEMI` bloğundadır.

**Boyut:** Engeller tek hücre değil, blok halindedir: 24'lük tahtada 2×2, 30'lukta 3×3, 44'lükte 4×4 (taş duvar 1×2 blok uzunluğunda, cam bir boy büyük).

**Tahta engelleri (kabuk):** küplerin üstünü örter, kırılmadan alttakilere ulaşılamaz.
- Nötr (her renk Pofi vurur, mermi harcamaz): Buz Kaplama, Metal Kafes, Cam Muhafaza, Taş Duvar, Patlayıcı Sandık (kırılınca çevresini patlatır, sandıklar zincirleme), Gizemli Küp (bomba / +40 coin / bütün buzları eritir), Gökkuşağı Küpü (kırılınca altındaki küpleri de yer, yol açar).
- Renkli: Zincirli Küp — zinciri sadece zincir rengindeki Pofi kırar, mermi harcar (kuyruğa eklenir).
- Katmanlı: buz+kafes, buz+zincir (dış katman bitince iç katman görünür, sağ üstte küçük rozet).

**Dev özel küpler (unit):** Zırhlı (kendi rengi, çok vuruş), Mıknatıs (kırılınca kendi rengindeki en yakın küpleri çeker), Mühür anahtarı (kırılınca mühürlü yuva açılır), Hareketli (her N atışta yana kayar, ok ve sayaç gösterir).

**Döner Kalkan:** bir grubu tek yönden korur, sayaç (atış sayısı) bitince saat yönünde döner. Gerçek zamanlı değildir, oyuncu sırayı planlar.

**Kuyruk / tezgâh:** Kilitli yuva (N küp patlayınca açılır), Mühürlü yuva (anahtar küp kırılınca), Donmuş Pofi (N küp patlayınca çözülür; hiç hamle kalmazsa kendiliğinden çözülür), Sınırlı Pofi (turda en fazla rozetteki kadar atış), Ağır Pofi (yavaş, engellere x2 hasar).

**Mermi denkliği:** Kuyruktaki toplam mermi = renkli küp + zincir + dev küp canı. Nötr vuruşlar bedava olduğu için mermi asla eksik/fazla kalmaz; patlama ve mıknatısla kırılan küplerin mermisi kuyruktan düşülür.

**Dağılım (`obPlanAll`)**: tanıtım sırası buz 12, kafes 16, sandık 21, zırh 27, taş 33, cam 40, zincir 48, kilitli yuva 56, gökkuşağı 65, donmuş 75, gizemli 86, kalkan 98, sınırlı 112, mıknatıs 128, mühür 146, ağır 166, hareketli 190. Yeni gelen engel sonraki 9 seviyede pekişir; seviye zorluğuna (`diffClass`) ve sırasına göre 1→4 engel türü birlikte kullanılır; 10'un katı+1 nefes bölümü, 50'nin katları çok zor. Aynı kombinasyon art arda gelmez, 20 seviyede en fazla 2 kez.

**Test:**
```
node tools/tests/ob-check.js                       # 1000 seviye: mermi denkliği + engel dağılımı
node tools/tests/ob-check.js --shots ekran --levels 12,16,21 --wait 3200   # ekran görüntüsü
node tools/ob-ayar.js --from 12 --to 1000 --tries 3 --yaz   # bot doğrulaması + gerekirse hafifletme (OB_TUNE)
```
Oyunda deneme: `?obk=ice,cage,crate,frozen` (bu türleri zorla), `?ob=0` (engelleri kapat).

## Görev sistemi (v3.16, Patlat modu)
Her Patlat bölümünden önce **görev kartı** açılır (oyun alanının üstünde değil, ayrı ekran). "Göreve Başla"ya basılmadan oyun başlamaz. Kartın içeriği bölümü kuru çalıştırıp (`BP.msInfo(L)`) gerçek veriden okunur: resim, engeller ve sayıları, ana görev, bonus görevler, ödül. Kaldığı yerden devam eden oyunda kart açılmaz. Kod: `beta/index.html` içinde `v3.16 GOREV SISTEMI` (motor) ve `v3.16 GOREV KARTI` (arayüz).

- **Pilot bölümler 101–120** (`MS_P`): her birinin teması, başlığı, strateji ipucu, engel düzeni (`m`, `q`, `tp`, `cnt`) ve görevleri elle tasarlandı. Yıldız = ana görev (1) + başarılan bonus görevler (en fazla 3). Canlandırma / Süper Pofi kullanılırsa en fazla 2 yıldız (eski kural).
- **Diğer bölümler**: ana görev "Resmi tamamla", kartta 3 yıldız kuralı (tezgâhta en fazla 2 Pofi) gösterilir; yıldız hesabı değişmedi.
- **Ana görev türleri**: `clear` resmi tamamla · `break` bir engel türünün hepsini kır (bitince kalan resmi Pofi toplar) · `rescue` bebek Pofi'yi kurtar · `boss` boss'u yen · `time` süre dolmadan bitir (dolarsa kayıp, devam: +25 sn) · `sends` en fazla N gönderim (hak bitince kayıp, devam: +4 hak).
- **Bonus türleri**: `sends`, `time`, `peak` (tezgâh), `combo`, `chain` (tek patlamada zincirlenen sandık), `order` (numaralı zincirleri sırayla kır), `first` (bir engel türünü resmin yarısı bitmeden temizle), `ting` (kalkana çarpma sınırı).
- **Boss**: dev zırhlı küp (`unit armor` + `boss`), bölgesi boss rengine boyanır, mermi `obQueue` ile denklenir. Canı her eşiğe inince etrafına nötr buz kalkanı örer (mermi dengesi değişmez). Can çubuğu ve gözler 2B çizilir.
- **Oyun içi gösterge**: üstte küçük hap (`#msHud`): kırılan/toplam, kalan süre, kalan hak, boss canı. Kart oyunun üstünde tekrar açılmaz.
- Kazanma ekranında görev listesi (✓/✗). Kayıt: görev durumu `snapshot.mi` içinde; boss buz kalkanları da geri yüklenir.
- Deneme: `?ms=0` (görevleri ve pilot düzeni kapat), `?msnolim=1` (süre/hak kaybını kapat, ölçüm için).

Ölçüm ve doğrulama:
```
node tools/level-bot.js --mode normal --from 101 --to 120 --tries 5 --url msnolim=1 --ham --out tools/out/gorev-olcum   # sınırsız ölçüm
node tools/level-bot.js --mode normal --from 101 --to 120 --tries 5 --ham --out tools/out/gorev                        # gerçek kurallar
node tools/gorev-ayar.js tools/out/gorev/levels-ham.json                                                               # rapor: tools/out/gorev-rapor.md
```
Bot artık görev kartını kendisi geçer, ana görev bitince Pofi'nin kalan resmi toplamasını bekler. `--url` sayfa adresine parametre ekler, `--ham` ham sonuçları `levels-ham.json` olarak yazar.

Bandın hiç geçmediği şeritler (bandın bitiş noktasından girişe kadar olan sol alt kısım) artık "açık" sayılmaz (`laneOk`): bot ve son tur uzatması ulaşılamayan küpü hedef sanıp takılmıyordu.

## Katlı küp (v3.17, Faz 1 — sadece bölüm 121 ve 122)
Bir hücrede 1–5 küp üst üste durur. Veri: `g.stk[hücre] = [{c: renk, hp: dayanıklılık}, …]` (ilk eleman en üstteki kat; rengi `g.grid` ile aynı). Kod: `beta/index.html` içinde `v3.17 KATLI KUP` bloğu.

- **Vuruş:** Pofi sadece en üst katın rengindeyse vurur (mevcut renk kuralı, `g.grid` hep üst katın rengidir). Her isabet üst katın dayanıklılığından 1 düşer; kat bitince alttaki kat üste çıkar ve hücrenin rengi değişir. Hücre son kat gidene kadar dolu kalır, atış hattı kapalıdır. Sandık patlaması her hücreden bir kat alır; mıknatıs katlı hücreyi çekmez; Süper Pofi bütün katları birden temizler.
- **Mermi:** kuyruk `obPeel` soyma sırasında katları da sayar (alttaki katın rengi, üst kat bittikten sonra sırasına göre kuyruğa girer); `obQueue`, `obInit`, `obRem` bütün katların dayanıklılığını toplar. Toplam mermi = toplam kat dayanıklılığı.
- **Görünüm:** her kat ayrı bir dilim olarak çizilir (5 kat = normal küpün 1,9 katı yükseklik; arka satırı kapatmaz). Üst kat biraz küçük çizilir, kümenin çevresinde sıradaki katın renginde çerçeve ve kat sayısı rozeti (`×3`) vardır.
- **Bölümler:** `MS_P[121]` (2 katlı, tek renk, 2 adet 3×3 küme, `seed` ile çözülebilir kuyruk), `MS_P[122]` (3 katlı, her kat farklı renk, 2 adet 2×2 küme + 2 sandık, ana görev "bütün katlı küpleri kır"). Bu iki bölümde eski dev küpler (`specialUnits`) yok. Yerleştirme: `MP.stk = {n, k, L, mix, hp}`.
- **Kayıt:** oyun anı kaydına `stk` eklendi (eski kayıtlar aynen açılır). 121–122'nin v3.16'dan kalan yarım oyunu farklı düzende olduğu için açılmaz, bölüm baştan başlar; ana ilerleme, yıldız ve coin kaydı değişmedi.
- **Geri dönüş:** GitHub'da `yedek/v3.16` dalı v3.16'nın tam kopyasıdır.
- **Test:** `node tools/tests/katli-test.js http://127.0.0.1:8765/beta/ [--eski http://127.0.0.1:8765/<eski kopya>/]` — renk/kat sırası, mermi denkliği (her adımda), kayıt-geri yükleme, eski biçimli kayıt ve isteğe bağlı olarak 1–1000 bölümün eski sürümle aynı kaldığı.

## Yapı prototipi v2 (3B, sıfırdan) — `beta/yapi/`
Ana oyunun **Mod** menüsünde "Yapı (deneme)". Ayrı küçük oyun, three.js ile gerçek 3B; resim yok.

- **Saha:** düz çimen zeminin ortasında alçak bir platform (kenarı kırmızı-beyaz çizgili); platformun üstünde F×F hücrede üst üste dizilmiş iri kasalar (her hücre bir yığın, 1–8 kat). Etrafında kare asfalt yol ve oklar, ön sol köşede giriş kapısı. Uzakta dünya resmi (`beta/bg`) ufuk manzarası, gökyüzü geçişi ve sis. Kamera önden, alçak açıdan bakar (`?ang=16` derece).
- **Kural:** Pofi yolda saat yönünde bir tur atar. Bir şeridin hizasından geçerken o şeritte **dışarıdan ilk dolu yığına** bakar; yığının **en alttaki** kasası kendi rengindeyse atış yapar. Kasa takla atarak dışarı fırlar, üstündekiler bir kat düşer. Turu biten ve mermisi kalan Pofi bekleme yerine iner; yer kalmazsa oyun biter (+1 yer ile devam). Yolda en fazla 4 Pofi.
- **Seviyeler** (`motor.js` → `LEVELS`, her biri bir yükseklik fonksiyonu `h(r,c)`): 1 İkiz Kuleler, 2 Piramit, 3 Kale, 4 Merdiven, 5 Büyük Kale (sonra döner). Renk: 2 katlık bantlar, bölgeye göre kayma, %18 rastgele vurgu.
- **Kuyruk:** soyma benzetimi (`planQueue`): o an en çok açıkta olan rengin Pofi'si sıraya girer ve benzetimde kendi küplerini kırar. Mermi = kasa sayısı.
- **Bot:** `node -e "const M=require('./beta/yapi/motor.js');console.log(M.botPlay(1,'dikkatli',1))"` — dikkatli oyuncu 5 seviyenin hepsini 10/10 kazanıyor, rastgele dokunan 0/10.
- **Test görüntüsü:** `?test=1&sv=<seviye>` döngüyü durdurur; `YP.run(sn, true)` zamanı botla ilerletir.
- Kayıt ayrı anahtarda (`blokpop_yapi_v2`). Pofi modeli Buz prototipindeki küp Pofi'nin kopyası.
- **Sahne görseli (v2.1):** Adem'in çizdirdiği çöl harabesi sahnesi `beta/yapi/sahne.webp` (üstteki boyalı çubuk silindi, alttaki arayüz kesildi). Resim ekrana genişliğe göre, üst kenara dayalı yerleşir; `solveCam` kamerayı resimdeki cam platformun dört köşesine oturtur (`IMG.glass` piksel koordinatları), bant konumu aynı kameradan zemine ışınla bulunur (`IMG.belt`). 3B'de sadece kasalar, Pofi'ler, atışlar ve gölgeler (`ShadowMaterial`) çizilir. Başka sahne resmi eklenirse sadece `IMG` koordinatları ölçülür.
- **Kasa:** Adem'in metal-dişli küp görseli `kup_yuz.webp` (yeşil ve mavi taşmalar temizlendi, ortadaki rakam silindi). Her renk için bir doku: metal kupun rengine boyanır, ortadaki çekirdek renkli parlar (`kupMat`). Renk başına ayrı `InstancedMesh`.
- **Alt panel:** kuyruk kartları boyalı parşömen (`kart.webp`, rozet bölgesi temizlendi), bekleme yerleri yarı saydam taş kutular.
