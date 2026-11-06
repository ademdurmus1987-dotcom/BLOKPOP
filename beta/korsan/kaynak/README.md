# Korsan modu (pilot) - kaynaklar (Adem, 5 Kas 2026)
- fon_*.webp: Gemini fonlari (Ai filigrani silindi). acikdeniz, ada, gunbatimi, koy. Alt yari bos deniz.
- gorsel_*.webp: Tripo'ya (image to 3D) verilecek onayli Gemini gorselleri: bizim gemi (direksiz, ortada bos altin top platformu), dusman gemi (direksiz, genis bos guverte + kic kabin catisi ikinci kat), kule adasi (duz ust platform).
- taslak.jpg: gorunum taslagi (fotomontaj).
- Tripo .glb modelleri gelince: beta/yapi/model/kaynak/ (GitHub Actions kucultur ve parcalar).
- gorsel_kule_ada_korkuluk.webp / gorsel_kule_ada_duz.webp: kule adasinin iki yeni secenegi (6 Kas). Kupler kulenin tepesine oturdugu icin duz (korkuluksuz) ust daha uygun.

## Pilot (v6.19) - nasil calisir
- Sayfa: beta/korsan/ (Yapi motorunu window.KORSAN ile acar; Yapi bolumleri degismez). Kod: beta/korsan/korsan.js
- 5 bolum: 1 Sallanan Sal (acik deniz), 2 Korsan Gemisi (acik deniz), 3 Gozcu Kulesi (ada), 4 Iki Katli Gemi (gun batimi), 5 Patron Gemisi (koy).
- Tripo modelleri su adlarla beta/yapi/model/kaynak/ klasorune: bizim_gemi.glb, dusman_gemi.glb, kule_ada.glb (istege bagli: sal.glb).
  Model gelene kadar kodla cizilmis gecici govdeler gorunur; gelince korsan.js icindeki KAL tablosu (guverte/su/kabin oranlari) modele gore ayarlanir.

## v6.21 (6 Kas) - platform duzeni
- Kupler sadece Adem'in fiçili ahsap platformlarinda: model/plat_kare, plat_alti, plat_yuvarlak, plat_uzun (.glb). Platform ustleri top hizasinda (y=0).
- 16 bolum, her 2 bolumde manzara degisir (8 fon). Hareketler: sabit, kay, salla, don, dalga; yan yana, onde/arkada duzenler.
- Korsan gemisi, gozcu kulesi adasi, eski sal: denizde sus. Yeni fonlar: fon_gunes, fon_martili, fon_gundogumu, fon_buzul.
- fon_*_bos.webp: cizili kuslar silinmis; fon_*_su.png: su maskesi (dalga sadece suya); penguen.png: buzul resminden kesilen penguen.
