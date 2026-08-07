# YILMAZ redüktör kataloğu çıkarımı

`catalog_data/reducers/yilmaz_{dr,m,h}.json` dosyalarının kaynağı. Üç YILMAZ
katalog PDF'i (workspace kökünde, repo dışında) taranıp tabloya çevrilir.

## Neden motorsuz (gear unit) tablolar

Kataloglarda iki ayrı güç–devir bölümü var: **motorlu** (geared motor — belirli
bir motorla eşleşmiş kombinasyonlar) ve **motorsuz** (gear unit — redüktörün
kendi anma değerleri). Uygulama redüktör ile motoru AYRI bölümlerde seçtiği için
(2.3/2.4 kaldırma, 5.4/5.5 yürütme) motorlu tablolar modele uymaz: her satır bir
motoru zorunlu kılar. Bu yüzden **motorsuz tablolar** kullanılır — anma momenti
Ma, izin verilen radyal yükler Fqam/Fqem, ağırlık ve mil çapları oradadır.

Kataloğun kendi tanımıyla (M kataloğu s.7): *"Anma Momenti (Ma): Redüktörün fs=1
şartı için mekanik olarak taşıdığı moment değeridir."* — `gearbox.torque`
kontrolünün karşılaştırdığı büyüklük tam olarak budur.

## Kaynak sayfalar

| Katalog | Performans tablosu | Mil ölçüleri | Kullanım grubu |
|---|---|---|---|
| `YILMAZ DR KATALOG.pdf` | s.252–262 (D serisi motorsuz) | s.322 kovan tablosu (d, H7) | yürütme |
| `YILMAZ M KATALOG.pdf` | s.320–331 (motorsuz) | s.333–393 teknik resim Ø etiketleri | yürütme |
| `YILMAZ H KATALOG.pdf` | s.104–233 (H serisi) + s.416–505 (B serisi) | s.236–414, s.507–576 ve s.579 | kaldırma |

H/B serisinde her model beş giriş devri için ayrı basılıdır (n1 = 1400 / 900 /
750 / 450 / 300) ve anma momenti devirle değiştiğinden beşi de alınır. Ayrıca
tablo **iki sayfalık yayım**dır: sol sayfa kimlik + moment + radyal yük, sağ
sayfa ağırlık + ölçü sayfası. `parse_h_spread` ikisini blokların ilk çevrim
oranına göre eşler.

D ve M/N serisinde Ma, n2 ve Fqam yalnız n1 = 1450 için basılıdır; diğer giriş
devirlerinin nominal güçleri `nominal_power_kw_n1_*` alanlarında taşınır.

## Dosyalar

- `grid.py` — çizgi ızgarasına dayalı ortak tablo okuyucu (dikey çizgiler sütun,
  yatay çizgiler blok sınırı). Sayfayı (satır, sütun) hücre metnine çevirir.
- `extract.py` — performans tabloları. Sütunlar başlık etiketlerinden bulunur,
  sabit indise güvenilmez. Termik güç sütunlarında "-" yer tutucusu satırların
  ~%24'ünde basılmadığından değerler `Pt1…Pt6` başlıklarının x merkezine göre
  konumsal eşlenir.
- `shafts.py` — mil çapları. H/B'de "Pozisyonlara Göre Mil Ölçüleri" bandındaki
  dört montaj düzeni (00 delik mil · 01 masif çıkış mili · 04 iki uçlu · 0S
  sıkma bileziği) etiketlerine göre ayrıştırılır; giriş mili çapı aynı gövdede
  çevrim oranı bandına göre değişir ve sayfa altındaki küçük tablodan okunur.
- `build.py` — performans + mil verisini birleştirir, kullanım grubunu işler,
  `catalog_data/reducers/*.json` yazar.
- `validate.py` — fiziğe karşı doğrulama (n2 = n1/i, Ma ↔ Pn, ölçek aralıkları,
  oran arttıkça n2 azalması, model başına tek çıkış mili çapı).

## Çalıştırma

```bash
pip install pymupdf
cd scripts/catalog-extract
python build.py        # catalog_data/reducers/*.json yazar
python validate.py     # tutarlılık raporu
```

Ardından seed migration'ı yenile:

```bash
npx tsx scripts/seed-catalog.ts --kinds gearbox --out <YYYYMMDDHHMMSS>_gearbox_reseed
```

## Doğrulama durumu

`validate.py` yalnız `n2 != n1/i` başlığında sapma bildirir; tamamı katalogun
kendi yuvarlamasıdır. Tam sayıya yuvarlama toleransıyla bakıldığında M'de 20
satır (o bloklar 1450 yerine 1400 d/dak ile hesaplanmış — katalog tutarsızlığı),
H'de 2 satır (±2 d/dak yuvarlama) kalır; açıklanamayan satır yoktur. Örnek
satırlar basılı sayfalarla birebir karşılaştırılmıştır (s.104, s.110, s.252,
s.320).

Kademe sayısı model kodunun SON basamağıdır (katalog tip tanımlaması, M
kataloğu s.10); H/B serisinde araya sabit bir tasarım kodu ("2") girer. Okuma
çevrim oranı aralıklarıyla doğrulanmıştır: HT0321 i=1,54…5,06 (tek kademe),
HT0322 i=5,33…19,18, HT0323 i=20,7…75,1.

---

# Kaplin katalogları (`catalog_data/couplings/`)

Üç marka, 47 dosya, 588 satır. Her **seri kendi dosyasındadır** — arayüzdeki
"Seri" süzgeci `meta.series`ten beslendiği için alt seriler ancak böyle ayrı
ayrı seçilebilir (ör. MT ile MTS aynı dosyada olamaz).

```bash
pip install pymupdf
cd scripts/catalog-extract
python couplings_build.py       # üçünü üretir + doğrular
python couplings_validate.py    # yalnız doğrulama (0 = hata yok)
```

| Betik | İş |
|---|---|
| `couplings_common.py` | ortak şema, JSON yazıcı, eski dosya temizliği |
| `couplings_ozgun.py` | ÖZGÜN — taranmış PDF'ten GÖRSEL okuma (elle tablo) |
| `couplings_sibre.py` | SIBRE — metin katmanından koordinat tabanlı okuma |
| `couplings_jaure.py` | JAURE MT dosyasını alt serilere bölme |
| `couplings_validate.py` | fizik + seri monotonluk + doğrulanmış değer kontrolü |

## Ortak şema

`brand` · `model` · `coupling_type` · `series` · `nominal_torque_Nm` ·
`max_torque_Nm` · `max_bore_mm` · `min_bore_mm` · `max_radial_load_N` ·
`weight_kg` (ya da `weight_min_kg`/`weight_max_kg`) · `outer_diameter_mm` ·
`max_speed_rpm`.

**Basılı sayfada olmayan alan hiç yazılmaz.** Katalog ağırlık basmıyorsa
`weight_kg` yoktur; tahmin edilmez. `couplings_validate.py` bu boşlukları
"ATLANAN KONTROL" olarak listeler — sessizce geçmez.

`coupling_type` değerleri: `gear` · `drum` · `brake` · `flexible` · `pin` ·
`disc` · `chain` · `barrel`.

## ÖZGÜN — `ozgun katalog 2019 1-b.pdf`

**PDF'in metin katmanı YOKTUR** (70 sayfanın tamamı 0 karakter; taranmış
görüntü, OCR uygulanmamış). Bu yüzden her tablo sayfası `page.get_pixmap
(dpi=120)` ile PNG'ye render edilip **görsel olarak okunmuş** ve
`couplings_ozgun.py` içine elle yazılmıştır. Yavaştır ama doğrudur; hiçbir
değer enterpolasyonla üretilmemiştir.

PDF sayfa indisi (0 tabanlı) = basılı sayfa numarası + 2.

28 tip: A · B1 · B2 · B3 · C · Da · Db · Dc · Dk · Dt · Dtk · Dv · E · F ·
G · H · I · J · K · N · R · S6 · S8 · T6 · T8 · Y · Za · Zr.

### Tambur kaplini YALNIZ TİP J'dir

Kataloğun kendi kullanım kılavuzu (s.51) bu seriyi *"OPERATION and
MAINTENANCE INSTRUCTIONS FOR OZGUN TYPE J DRUM COUPLINGS"* başlığıyla
tanımlar ve **"Radial Load [N]" satırı yalnız TİP J tablosunda** basılıdır.
`coupling_type: "drum"` bu yüzden başka hiçbir ÖZGÜN tipine verilmemiştir.

### Düzeltilen iki hatalı dosya

| Eski dosya | Sorun | Yeni |
|---|---|---|
| `ozgun_j_drum.json` | tork sütununa **radyal yük** yazılmıştı | `ozgun_j.json` |
| `ozgun_b_motor.json` | B serisi "motor-redüktör kaplini" sanılmıştı | `ozgun_b1/b2/b3.json` |

`ozgun_j_drum.json` J6 için `nominal_torque_Nm = 59400` diyordu. Basılı
tabloda J6 satırı şudur: **Tnominal 22600 Nm · Tpeak 45200 Nm · Radial Load
59 400 N · ød max 130 mm**. Yani 59 400 tork değil radyal yüktür ve dosyadaki
"130 kN radyal yük" da aslında 130 mm'lik delik çapıdır — iki alan da bir
sütun kaymasıyla yanlış yere yazılmıştı. Şüphe doğrulandı ve düzeltildi.

B1/B2/B3 basılı başlıkları **"TİP B1 (Brake 1)" / "(Brake 2)" / "(Brake 3)"**
ve dipnotları *"FREN DİSKLERİ / FREN KASNAKLARI GGG50 malzemeden imal
edilerek dinamik balansı alınmaktadır"* der; üçü de fren kaplinidir
(`coupling_type: "brake"`). Ağırlıkları fren diski/kasnağı çapına bağlı
olduğundan tek bir ağırlık yoktur: `weight_min_kg` / `weight_max_kg` +
`brake_dia_options_mm` yazılır.

### ÖZGÜN'de basılı olmayan / şüpheli değerler (silinmedi, işaretlendi)

- **TİP E** zincir kaplinde katalog moment BASMAZ; yalnız 1000 d/dak'daki
  azami gücü (HP) verir. `nominal_torque_Nm` boştur, `9550·P/n` ile
  türetilmemiştir.
- **TİP I 2** için anma momenti sayfada `11500` Nm basılıdır — aynı sütundaki
  tepe momenti 2300 Nm'dir, yani baskı hatasıdır. Doğrusu tahmin edilmedi;
  alan boş bırakıldı ve satıra `catalog_print_issue` notu düşüldü.
- **TİP Dc6** için ød min sayfada `5` mm basılıdır (aynı boyda Da/Db 55 mm
  der). Basılı değeriyle bırakıldı, meta.notes'ta işaretlendi.
- **TİP K3** anma momenti 2800 Nm basılıdır (F/G/H'de aynı boy 2900 Nm).
- **TİP T8** sayfa başlığı "1-18" olduğu hâlde tabloda 17 boy vardır;
  18. boy uydurulmadı.
- **Da15/Da16 ve Dv15/Dv16** devir sınırı 1400 → 1500 d/dak diye artar
  (sıralama bozuk); sayfadaki hâliyle alındı, doğrulayıcı UYARI verir.

## SIBRE — `02_SIBRE_Coupling-catalogue.pdf`

Bu PDF'in **metin katmanı VARDIR** (29 sayfa, ~55 000 karakter), bu yüzden
tablolar elle yazılmaz: `page.get_text("words")` ile kelimeler alınır, y'ye
göre satıra kümelenir, x'e göre sütuna eşlenir. Sütun eşlemesi **en yakın
başlık çapasına** göre yapılır; böylece "-" yer tutucusu basılmamış
satırlarda kayma olmaz.

11 seri: ALC-A · ALC-AS · ALC-AT (elastik) · AFC-A · AFC-AS (tam-flex
elastik) · APC-A · APC-AS · APC-AT · APC-BT (pimli) · ZKES (dişli) ·
ABC-V (tambur).

**Kapsam dışı:** idx 14–16'daki `BRAKE DISCS (TYPE BS)` ve `BRAKE DRUM
(DIN 15431)` sayfaları kaplin değil, kaplinin üzerine takılan fren
elemanlarıdır; kaplin kataloğuna alınmadı.

### ABC-V'de anma momenti diye bir sütun yoktur

Basılı Tablo 3 (s.47) tek moment sütunu verir: **"Torque(1) Tk max"**.
Kataloğun kendi çözümlü örneği (s.46) seçimi doğrudan bu değerle yapar:
`T'Amax = 156 600 Nm ≤ Tkmax = 180 000 Nm`. Bu yüzden `nominal_torque_Nm` ve
`max_torque_Nm` aynı değeri taşır.

Önceki `sibre_abc_drum.json` `nominal = Tkmax / 1,6` yazıyordu; **bu bölme
katalogda yoktur.** 1,6 işletme katsayısı Cerf'in M6 değeridir ve TAHRİK
momentine uygulanır, kaplini derate etmez. Uydurma derating kaldırıldı.
Ayrıca Tablo 3'ün (1) dipnotu şunu söyler: verilen momentler **mil–göbek
bağlantısını kapsamaz**, o ayrıca kontrol edilmelidir.

## JAURE — katalog PDF'i workspace'te YOK

`jaure_mt_gear.json` 86 satırın tamamını tek bir `meta.series = "MT"` altında
topluyordu; MTS/MTF/MTG arayüzde ayrı seçilemiyordu. Alt seri **model
kodunun harf önekinden** türetilip yedi dosyaya bölündü: MT (12) · MTS (18) ·
MTG (14) · MTG-HD (14) · MTF (8) · MTFE (8) · MTES (12). **Hiçbir sayı
değişmedi** — bu veri üretmek değil, var olan veriyi doğru gruplamaktır.

Kaynak dosyada MTG 730 / MTG-HD 730 / MTS 345 ağırlıkları `0` yazıyordu;
0 kg bir ölçüm değil eksik veridir — alan tamamen kaldırıldı, sayı
uydurulmadı.

**Doğrulanmadı:** JAURE ve TCBR katalog PDF'leri workspace'te olmadığından
hiçbir JAURE satırı basılı sayfayla karşılaştırılamamıştır. Ayrıca
`jaure_tcbr_barrel.json`da şüpheli üç alan vardır — TCBR 25 için
`max_speed_rpm = 68` ile `max_shaft_diameter_mm = 68` aynı sayıdır ve
`hub_diameter_mm = 38` mil çapından küçüktür; `max_speed_rpm` sütunu boy
büyüdükçe ARTAR (68 → 640), yani devir değil bir ölçü gibi davranır. PDF
elde edilene kadar bu alanlara güvenilmemelidir; meta.notes'ta yazılıdır.

## `couplings_validate.py`

| Kontrol | Kural |
|---|---|
| Şema | `meta.brand/series/coupling_type/source_pdf` dolu; satır `coupling_type`/`series` meta ile aynı |
| Tekrar | Aynı `model` iki kez geçemez |
| Moment | `max_torque_Nm ≥ nominal_torque_Nm`, ikisi de > 0 |
| Delik | `min_bore_mm ≤ max_bore_mm`, `outer_diameter_mm > max_bore_mm` |
| İşaret | ağırlık / radyal yük / devir > 0; `weight_min_kg ≤ weight_max_kg` |
| **Seri monotonluğu** | anma momentine göre sıralandığında delik çapı, dış çap, tepe momenti ve radyal yük AZALAMAZ (HATA) |
| Devir eğilimi | boy büyürken devir sınırı artıyorsa UYARI |
| Ağırlık eğilimi | tork artarken ağırlık azalıyorsa UYARI |
| Doğrulanmış değer | 10 satır basılı sayfaya karşı sabitlenmiştir (aşağıda) |

Betik **negatif test edilmiştir**: `ozgun_j.json`a dört bozukluk enjekte
edilerek (tepe < anma momenti, tekrar eden model, delik çapı düşüşü, radyal
yük düşüşü) altısı da yakalanmış ve çıkış kodu 1 olmuştur.

### Basılı sayfayla birebir karşılaştırılan satırlar

| Dosya | Model | Alan | Değer | Kaynak |
|---|---|---|---|---|
| `ozgun_j.json` | J6 | anma momenti | 22 600 Nm | s.33 TİP J, Tnominal |
| `ozgun_j.json` | J6 | radyal yük | 59 400 N | s.33 TİP J, Radial Load |
| `ozgun_j.json` | J6 | ød max | 130 mm | s.33 TİP J, ød max |
| `ozgun_b3.json` | B3-2 | anma momenti | 2 850 Nm | s.18 TİP B3 (Brake 3) |
| `ozgun_a.json` | A6 | anma momenti | 17 200 Nm | s.15 TİP A |
| `sibre_abc_v.json` | ABC-V 450 | Tk max | 180 000 Nm | s.47 Tablo 3 + s.46 örnek |
| `sibre_abc_v.json` | ABC-V 450 | Fr max | 150 000 N | s.47 Tablo 3 + s.46 örnek |
| `sibre_abc_v.json` | ABC-V 545 | Tk max | 320 000 Nm | s.45 çözümlü örnek |
| `sibre_alc_a.json` | ALC-A 65 | anma momenti | 940 Nm | s.10 ALC-A |
| `sibre_apc_a.json` | APC-A 160 | anma momenti | 270 Nm | s.16 APC-A |

Marka başına en az iki satır: ÖZGÜN 5, SIBRE 5. **JAURE için 0** — kataloğu
yok (yukarıya bakınız).

## Doğrulama durumu

`python couplings_validate.py` → **0 HATA**, 18 UYARI, 19 atlanan kontrol.
UYARI'ların 15'i `jaure_tcbr_barrel.json`ın şüpheli devir sütunundan, 3'ü
ÖZGÜN'ün kendi basılı sıralama tutarsızlığından gelir (Da15/16, Dv15/16,
Y9/Y10) — hiçbiri çıkarım hatası değildir.

## seed-catalog.ts'te gereken değişiklik

`scripts/seed-catalog.ts` kaplin dosyalarını **sabit bir listeden** okur ve
`a.series = meta.series` atar. Yeni dosya düzeni için o liste dizin
taramasıyla değiştirilmeli (`catalog_data/couplings/*.json`) ve seri satırdan
da okunabilmelidir (`a.series = it.series ?? meta.series`). Ayrıca
`min_bore_mm → min_shaft_dia_mm` yeniden adlandırması eklenmelidir. Bu dosya
bu paketin sahipliğinde DEĞİLDİR; değişiklik ayrıca istenmiştir.

---

# Rulman kataloğu (`catalog_data/bearings/`)

## Durum: PDF'den çıkarıldı — 320 satır

`skf.json`, şirketin sağladığı `SKF genel-rulman-katalogu.pdf` dosyasının
ürün tablolarından **320 satır** olarak çıkarılmıştır: 60xx / 62xx / 63xx
sabit bilyalı, 222xx / 223xx küresel makaralı, 512xx eksenel bilyalı ve NU / NJ
silindirik makaralı serileri. Her kayıtta d, D ve B sınır ölçüleri **mm**;
dinamik/statik yükler kN; hız katalogdaki limiting speed değeridir.

`robots.txt` `/group/products/...` yollarına izin verir — fakat robots.txt bir
kullanım lisansı değildir. Ürün sayfasının kendi kullanım koşulları şunu der:

> "The information and software made available on this website / app may not be
> reproduced, duplicated, copied, transferred, distributed, stored, modified,
> downloaded or otherwise exploited for **any commercial use** without the prior
> written approval of SKF. … Under no circumstances may this information or
> software be supplied to third parties."

ORION ticari bir üründür ve müşteriye teslim edilen rapor üretir; ~180 SKF ürün
kaydını uygulamanın dağıtılan kataloğuna kopyalamak tam olarak bu maddenin
kapsamıdır. Karar mühendisin/şirketin değil ajanın verebileceği bir karar
olmadığından çıkarım **durdurulmuştur**. Satır uydurulmamıştır.

Bu çıkarım doğrudan sağlanan basılı katalogdan yapılır; SKF web sitesinden toplu
veri çekilmez. Ürün verisi güncellenecekse yeni bir üretici PDF'i sağlanmalı ve
`catalogs_galvi_skf.py` ile yeniden üretilmelidir.

## `bearings_validate.py`

Rulman tablosunu fiziğe ve ISO 15'e karşı sınar. Kaynağı ne olursa olsun
(elle giriş, PDF çıkarımı, web) üretilen dosyaya uygulanır.

```bash
cd scripts/catalog-extract
python bearings_validate.py                  # catalog_data/bearings/*.json
python bearings_validate.py <dosya.json>      # tek dosya
```

Çıkış kodu 0 = hata yok, 1 = en az bir HATA. Kontroller:

| Kontrol | Kural |
|---|---|
| Alan varlığı | `fields` listesindeki dokuz alanın tamamı her satırda |
| Geometri | D > d, B > 0 |
| Yük | C > 0, C0 > 0, ağırlık > 0 |
| Tanım ↔ delik | ISO 15: kod ≥ 04 için d = 5 × kod; 00→10, 01→12, 02→15, 03→17 |
| Seri monotonluğu | Aynı seride d artarken C ve C0 artmalı (ağırlık düşerse UYARI) |
| Hız eğilimi | Aynı seride d artarken `limiting_speed_rpm` azalmalı |
| ISO 15 sınır ölçü | `iso15_reference.json` varsa D ve B çapraz kontrolü |
| Doğrulanmış değer | 22212 E C0 = 166 kN, 51214 C0 = 160 kN |
| Tekrar | Aynı `designation` iki kez geçemez |

**Atlanan kontrol sessiz geçmez.** ISO 15 referansı olmayan satır "ATLANDI"
olarak sayılır ve listelenir; hatırlanan/tahmin edilen bir referansa karşı
doğrulama yapmaktansa kontrolü atlamak doğrudur — yanlış referans, gerçek bir
hatayı "geçti" gösterir.

## `iso15_reference.json`

ISO 15 sınır ölçüleri: boyut serisi → delik kodu → `{D, B}`. Şu an yalnız
**doğrulanmış üç giriş** vardır (seri 02/kod 10, seri 22/kod 12, seri 12/kod 14);
her girişte `verified` alanı kaynağı taşır. Tablo genişletilirken kural aynıdır:
**hatırlanan ölçü yazılmaz**, yalnız basılı katalogdan ya da ürün sayfasından
okunan ölçü yazılır.

Üç giriş 37 satırın 5'ini kapsar (6210, NU210 ECP, NJ210 ECP, 22212 E, 51214) —
NU210/NJ210'un 6210 ile aynı ISO 15 kutusunu paylaşması çapraz doğrulamadır.

## Doğrulama durumu

Mevcut `skf.json`: **0 HATA**, 1 UYARI (`meta.source_url` boş), 32 atlanan
ISO 15 kontrolü. Betik ayrıca bozuk veri enjekte edilerek negatif test edilmiştir
(golden C0 ihlali, seri monotonluk kırılması, tanım↔delik uyumsuzluğu, D ≤ d ve
ISO 15 D ihlali — beşi de yakalanır).

**Bilinen veri farkı (çözülmedi).** Doğrulama sırasında mevcut satırların
skf.com'daki güncel değerlerden ayrıştığı görülmüştür — mevcut tablo daha eski
bir katalog baskısıdır ve `limiting_speed_rpm` alanında SKF'in *referans* hızı
gibi görünen değerler vardır:

| Ürün | Alan | `skf.json` | skf.com (2026-08-06) |
|---|---|---|---|
| 22212 E | C0 | 166 kN | **166 kN** (teyit) |
| 22212 E | C | 153 kN | 159 kN |
| 22212 E | limiting_speed | 5 600 | ref 5 600 · limit 7 500 |
| 22212 E | ağırlık | 1,0 kg | 1,14 kg |
| 51214 | C0 | 160 kN | **160 kN** (teyit) |
| 51214 | C | 68,9 kN | 62,4 kN |
| 6210 | C | 35,1 kN | 37,1 kN (SKF Explorer) |

İki golden C0 değeri **teyit edilmiştir**. Buna karşılık `limiting_speed_rpm`
alanının hangi büyüklüğü taşıdığı (limit hız mı, referans hız mı) belirsizdir;
tablo yenilenirken bu tanım netleştirilmelidir.

---

# TAMPON (`catalog_data/buffers/`)

Vinç yol sonu tamponları üç ayrı fizik ailesinden gelir ve **tek bir formülle
karşılaştırılamazlar**. Ailenin imzası

> **κ = W / (F · s)** — sönümlenen enerji, son kuvvet × strok çarpımının oranı

büyüklüğüdür ve `buffers_validate.py` her satırı bu orana karşı sınar:

| Aile | κ | Neden |
|---|---|---|
| Hidrolik (SIBRE SP) | **0,85** | Yağ kısma iğnesi kuvveti strok boyunca neredeyse SABİT tutar. Katalog s.18: *"final forces are already applied with a damping efficiency of 0.85"* |
| Hidrolik (firma Excel'i) | **0,80** | Aynı fizik, firmanın daha muhafazakâr kabulü |
| Kauçuk, silindirik | **≈0,31** | Doğrusal DEĞİL: kuvvet sonda patlar, ortalama kuvvet tepe kuvvetin üçte biridir |
| Kauçuk, konik | 0,24–0,46 | h/d oranına kuvvetle bağlı |
| Hücresel poliüretan | 0,50–0,90 | Hacimce sıkışabilir, uzun strok |

Bu tablo pratikte şu demektir: **aynı enerjiyi sönümlemek için kauçuk tampon
hidroliğin ~2,7 katı tepe kuvvet üretir.** Yol kirişi ve tampon konsolu bu
kuvvete göre boyutlandırıldığından tür seçimi bir yapı kararıdır.

## Dosyalar

| Dosya | Satır | Kaynak |
|---|---:|---|
| `sibre_sp_hydraulic.json` | 33 | SIBRE Produktkatalog2022 s.19-22 (M 1501 493-496 E-EN-08-2022) |
| `sibre_sp_force_matrix.json` | 216 | aynı PDF s.18 (M 1501 486 E-EN-2021-11) |
| `sibre_sp_metering_pins.json` | 169 | aynı PDF s.19-22, "Design mass [t]" tabloları |
| `conductix_rubber.json` | 67 | KAT0170-0002-EN s.11-13 (Program 0170) |
| `conductix_cellular.json` | 55 | KAT0170-0002-EN s.23-24 (Program 0180) |
| `conductix_curves.json` | 10 çap | KAT0170-0003-EN s.4-13 (yük diyagramları) |
| `firma_excel_buffers.json` | 11 | `Tampon Seçimi - Yeni Type S Tipi.xlsx` |

Betikler: `buffers_common.py` (yollar, sayı ayrıştırma, JSON yazımı) ·
`buffers_sibre.py` · `buffers_conductix.py` · `buffers_curves.py` ·
`buffers_firma_excel.py` · `buffers_validate.py`.

```bash
pip install pymupdf openpyxl
cd scripts/catalog-extract
python buffers_sibre.py
python buffers_conductix.py
python buffers_curves.py        # conductix_rubber.json'a bağımlıdır, ondan sonra
python buffers_firma_excel.py   # sibre_sp_hydraulic.json'a bağımlıdır, ondan sonra
python buffers_validate.py
```

## Çıkarım yöntemi — Conductix ürün tabloları

İki özellik okuyucuyu belirler:

1. **Sütunlar ortalanmıştır** — hücrelerin x MERKEZİ sütun başına sabittir.
   Sütun merkezleri veri hücrelerinden kümelenerek bulunur; sabit indise ya da
   başlık konumuna güvenilmez. Bulunan sütun sayısı ve satır sayısı basılı
   sayfadan sayılan değerlere karşı doğrulanır (`expected_rows`), tutmazsa
   betik **durur** — sessizce eksik veri yazmaz.
2. **Bazı sütunlar birleştirilmiştir** — değer, kapsadığı satır bloğunun DÜŞEY
   ORTASINA bir kez basılır. Blok sınırları buradan TAM olarak geri çözülür:
   blok ilk satırdan başlar ve `son = 2 × y_metin − y_ilk` konumuna en yakın
   satırda biter (`_resolve_merged`, öne doğru süpürme).

   *"En yakın basılı değer"* ya da *"orta nokta"* kestirmeleri blok uzunlukları
   farklı olduğunda yanlış satıra atar — kauçuk s.12'de Ø63 grubu 6, Ø80 grubu
   3 satırdır ve `017220-063x063` komşu grubun M12'sini kapar. Hücresel s.23'te
   ise `d2` ve `s` sütunları İKİ çap grubunu birden kapsar; çap grubunun y
   aralığına bakan bir kural bunu çözemez. Süpürme kuralı ikisini de doğru
   çözer.

## Yük diyagramları — kalibrasyon ve ZORUNLU DOĞRULAMA

Kauçuk yay karakteristiği doğrusal olmadığından ürün tablosundaki Wmax/Fmax
yalnız %50 sıkışmadaki uç değerlerdir; ara nokta kapalı formülle üretilemez.
Eğri şarttır. `buffers_curves.py` her sayfada grafik çerçevesini (0,659 pt
dikdörtgen), eksen etiketi metinlerinden en küçük karelerle piksel→birim
dönüşümünü ve 1,4 pt kalınlıktaki kübik Bézier eğrisini bulur, %2,5 adımlarla
21 noktada örnekler.

Kalibrasyon, eğrinin **uç noktasının ürün tablosuyla karşılaştırılmasıyla**
doğrulanmıştır:

| Ø | eğri W [J] | tablo W | oran | eğri F [kN] | tablo F | oran |
|---:|---:|---:|---:|---:|---:|---:|
| 40 | 50,1 | — | — | 9,81 | — | — |
| 50 | 99,5 | — | — | 15,9 | — | — |
| 63 | 198 | — | — | 24,9 | — | — |
| **80** | 398 | 400 | **99,5 %** | 39,1 | 40 | **97,7 %** |
| **100** | 783 | 800 | **97,8 %** | 62,8 | 63 | **99,7 %** |
| **125** | 1588 | 1600 | **99,2 %** | 100,1 | 100 | **100,1 %** |
| **160** | 3190 | 3200 | **99,7 %** | 159,4 | 160 | **99,6 %** |
| **200** | 6343 | 6300 | **100,7 %** | 248,9 | 250 | **99,6 %** |
| **250** | 12719 | 12500 | **101,8 %** | 392,3 | 400 | **98,1 %** |
| **315** | 25037 | 25000 | **100,2 %** | 627,9 | 630 | **99,7 %** |

Yedi çapta uyuşma **%97,7–%101,8** bandındadır; kalibrasyon doğrudur.

**Ø40, Ø50 ve Ø63'te oran hesaplanmamıştır** — çünkü karşılaştırılacak ürün
yoktur, uydurulmamıştır. Diyagram sayfası *"Valid for solid-rubber buffers with
h = 0,8 × d1"* der; katalogda **silindirik** gövde yalnız Ø80…Ø315'te vardır
(`017111-*` taban plakalı, `017120-*` saplamalı). Ø40/50/63'te yalnız KONİK
ürün (`017220-*`, `017110-*`) basılıdır ve konik gövde farklı bir yay
karakteristiğidir: eğri uç noktası konik tablo değerleriyle Ø40'ta %87,
Ø50'de %111 sapar. Bu üç eğri yine de alınmıştır çünkü kendi içlerinde
tutarlıdır (on çapta da W ≈ 0,317·F·s ve W ∝ d³ korunur), ancak
`applies_to_models` alanları **boştur** — konik ürünlere uygulanmamalıdır.

Çapraz kontrol: Ø50 diyagramı katalogda iki kez basılıdır (s.3 hesap örneğiyle,
s.5 tek başına). İki sayfadan okunan uç noktalar **aynıdır** (99,53 / 99,54 J).

**Belirsizlik.** Grafik yüksekliği ~227 piksel, tam ölçek = eksen üst tiki →
1 piksel ≈ tam ölçeğin %0,44'ü. Değerler 3 anlamlı basamağa yuvarlanmıştır.
Enerji eğrisi sayfada yalnız **iki** Bézier parçasıyla çizilidir (kuvvet eğrisi
dörtle); bu yüzden `∫F ds` ile enerji eğrisi uç noktada %7–9 ayrışır ve
**sıkışmanın ilk %10'unda enerji eğrisinin bağıl hatası büyüktür** (mutlak
hata 1-2 piksel, ama değerin kendisi küçük). Tampon zaten %30–50 sıkışmada
çalışır; seçim o bölgeden yapılır. Doğrulayıcı ∫F ds / W oranını 0,85–1,25
bandında sınar.

## Firma Excel'i — seçim yöntemi ADIM ADIM

`Tampon Seçimi - Yeni Type S Tipi.xlsx`, tek sayfa (*Tampon Seçimleri*), dört
vinç için işlenmiş örnek. Her vinç **iki satırdır**: `Araba` ve `Köprü` — ikisi
ayrı ayrı tampon seçer. Aşağıdaki adımlar sonraki fazda birebir kodlanacaktır;
işlenmiş dört örnek ara değerleriyle `meta.worked_examples` altındadır.

**Girdiler:** D ağırlık [kg] · F hız [m/dak] · G arabanın minimum yanaşması [m]
(yalnız köprü) · H köprü açıklığı [m] (yalnız köprü) · K motor gücü [kW] ·
L motor adedi · M motor devri [d/dak] · N redüktör çevrim oranı.

| # | Hücre | Büyüklük | Bağıntı | Birim |
|---|---|---|---|---|
| 1 | I | Çarpışma kütlesi | Araba: `I = D_araba` · Köprü: `I = D_köprü/2 + D_araba·(H−G)/H` | kg |
| 2 | J | Çarpışma enerjisi | `J = (I/1000) · (F/60 · 0,7)² · 0,5` | kJ |
| 3 | O | Tampon başına yürütme yükü | `O = 9550 · K · L / M · N / 2` | N (Excel'in kabulü) |
| 4 | P | Yürütmeden gelen enerji | `P = O · U / 1 000 000` | kJ |
| 5 | Q | Sönümlenmesi gereken toplam | `Q = P + J` | kJ |
| 6 | R | Tampon yükü | `R = Q / (U/1000 · 0,8) + O/1000` | kN |
| 7 | S,T,U,V | Tampon seçimi | mühendis listeden seçer; T/U/V `INDEX+MATCH` ile `AE16:BJ19`'dan okunur | kJ, mm, kN |
| 8 | W | Kuvvet kontrolü | `V ≥ R → OK` | — |
| 9 | X | Enerji kontrolü | `T ≥ Q → OK` | — |
| 10 | Y | Sağlanan emniyet katsayısı | `Y = T / Q` | — |
| 11 | Z | Yavaşlama ivmesi | `Z = (F/60)² / (2 · U/1000)` | m/s² |
| 12 | AA | İvme kontrolü | `Z ≤ 5 → OK` | — |

Kodlarken bilinmesi gerekenler:

- **Adım 1'de YÜK YOKTUR.** Çarpışma kütlesi yalnız çelik yapı + araba
  ağırlığıdır; kanca yükü katılmaz (yük sallanır, tampona tam aktarmaz).
  Köprüde `D_köprü/2` iki tamponun paralel çalışmasıdır; arabanın payı
  `(H−G)/H` ile o taraftaki raya düşen kısımdır.
- **Adım 2'de hız %70'tir.** Çarpma anma yürüyüş hızının 0,7 katında varsayılır
  (yaygın vinç kabulü); Excel bunu bir sabit olarak gömer.
- **Adım 3 BOYUT OLARAK TUTARSIZDIR.** `9550·K/M` motor momentidir [Nm];
  `×L×N` tahrik çıkış momentidir; sonuç **Nm**'dir ama adım 4 ve 6'da
  **N** (kuvvet) gibi kullanılır. Yani teker yarıçapı örtük olarak **1 m**
  alınmıştır. Sonraki fazda bu, `tahrik kuvveti = çıkış momenti / teker
  yarıçapı` olarak DÜZELTİLMELİDİR — aksi hâlde küçük tekerli vinçlerde
  tahrik kuvveti ciddi biçimde eksik çıkar.
- **Adım 4 motorun çarpma boyunca tahrik etmeyi sürdürdüğünü** varsayar; bu
  muhafazakârdır ve doğrudur (sınır durum: fren devreye girmemiş).
- **Hesap döngüseldir**: `U` (strok) seçilen tampondan gelir ve adım 4/6'yı
  besler. Uygulamada akış "seç → doğrula → gerekirse değiştir"dir; otomatik
  seçim yapılacaksa aday listesi üzerinde döngü kurulmalıdır.
- **Adım 6'da verim 0,8'dir**, SIBRE kataloğunun 0,85'i değil. Aynı enerjide
  %6 daha yüksek kuvvet verir — firma muhafazakâr davranmıştır. Kod bunu
  ürünün kendi `damping_efficiency` alanından okumalı, sabit gömmemelidir.
- **Adım 11'de ANMA hızı kullanılır**, adım 2'deki 0,7·v değil. Excel'in kendi
  içinde tutarsız olduğu tek yer burasıdır; ivme bu yüzden ~2 kat yüksek
  (muhafazakâr) çıkar. `5 m/s²` sınırı bir **firma kabulüdür**, Excel'de
  dayandığı standart yazmaz.

### Excel'in ürün listesi

32 sütunun **21'i SIBRE SP**'dir ve `sibre_sp_hydraulic.json` ile
**21/21 BİREBİR** uyuşur (strok, enerji ve kuvvetin üçü de). Bu, SIBRE
çıkarımının PDF'ten bağımsız ikinci bir doğrulamasıdır; sonuç
`firma_excel_buffers.json` → `meta.sibre_sp_verification` altında saklanır ve
her koşuda yeniden hesaplanır.

Kalan **11 satır** `Type 21 HD/*`, `Type 23 HD/*`, `Type 23T1 HD/*`,
`Type 50 HD/*`, `Type 70 HD/*` kodludur ve elimizdeki üretici kataloglarında
**KARŞILIĞI YOKTUR**. Marka, malzeme, ağırlık ve montaj ölçüleri
**bilinmiyor** — uydurulmamış, alan açılmamıştır. Onbirinin de κ = W/(F·s)
oranı tam **0,80**'dir; yani hidrolik (sabit kuvvetli) bir aile olmaları ve
Excel'in kendi 0,8 verimiyle üretilmiş olmaları muhtemeldir — ama
DOĞRULANMAMIŞTIR. **Katalog elde edilene kadar uygulamanın seçici listesine
alınmamalıdır.**

## Bilinen baskı hataları (düzeltilmedi, kayda geçirildi)

Katalogun ne dediği ile ne demesi gerektiği ayrı bilgilerdir; basılı değer
korunur, hesaplanan doğrusu `meta.known_print_errors` altına yazılır.
Doğrulayıcı bu listeyi tanır ve o hücreleri HATA değil UYARI sayar — ayrıca
**liste bayatlarsa** (veri değişip giriş tutmaz hâle gelirse) HATA verir.

| Dosya | Hücre | Basılı | Olması gereken |
|---|---|---|---|
| `sibre_sp_force_matrix` | SP 65 / 600 mm / 50 kJ | 118 kN | 98 kN (`50/(0,6·0,85)`) |
| `sibre_sp_force_matrix` | SP 65 / 600 mm / 60 kJ | 156 kN | 118 kN; 156 aslında 80 kJ satırının değeridir ve 150 kN sınırı aşıldığı için basılmamalıydı |
| `sibre_sp_metering_pins` | SP 65 / 600 mm / 300 t | 612 | 614 |
| `sibre_sp_metering_pins` | SP 65 / 800 mm / 300 t | 812 | 814 |
| `sibre_sp_metering_pins` | SP 100 / 200 mm / 20 t | 260 | 206 |

Ayrıca **düzeltilen** bir hata vardır: s.18 matrisinde SP 80 sütun başlıkları
`600/800` yazar, oysa aynı sütunların L1/L2/L3 ölçüleri s.20'deki `500/600 mm`
satırlarıyla birebir aynıdır ve 1 kJ'deki 2 kN değeri `1/(0,6·0,85)=1,96`'ya
uyup `1/(0,8·0,85)=1,47`'ye uymaz. Başlık `500/600` olarak düzeltilmiştir.

## Doğrulama durumu

`python buffers_validate.py` → **0 HATA, 6 UYARI, 39 ATLANDI** (çıkış kodu 0).

UYARI'ların hepsi açıklanmıştır: beşi yukarıdaki bilinen baskı hataları, biri
`SP 80 FF 600` (κ = 0,711 < 0,85 — 500 ve 600 mm strokların ikisi de 128 kJ
basılıdır; katalog 600 mm'yi bağıntının izin verdiği 153 kJ yerine düşük
derecelendirmiştir, muhafazakârdır). ATLANDI'ların 33'ü
`max_impact_speed_mps` (SIBRE katalogda basmaz — uydurulmadı, `null`),
6'sı Ø40/50/63 eğri uç noktası karşılaştırması.

Doğrulayıcı **negatif test edilmiştir**: 13 ayrı bozuk veri enjekte edilip
(κ bandı, sıkışma yüzdesi, eksik alan, statik>dinamik kapasite, eğride geri
düşen kuvvet, uç nokta oranı, ∫F ds tutarsızlığı, seri monotonluğu, matris
bağıntısı, bayat `known_print_errors` girişi, iğne kodu monotonluğu) **13'ü de
yakalanmıştır**.

## `seed-catalog.ts`'e eklenecek `kind="buffer"` bloğu

**Henüz eklenmemiştir** — bu paket yalnız `catalog_data/` üretti,
`scripts/seed-catalog.ts` bu paketin sahipliğinde değildir. Tarifi:

Dört dosya okunur; `brand` `meta.brand`'den gelir, `firma_excel_buffers.json`'da
`meta.brand` **null** olduğundan orada elle verilmelidir (`"Firma (teyitsiz)"`
gibi). `cleanAttrs` null alanları zaten düşürür, anahtarları küçültür.

| Dosya | model | attrs (cleanAttrs sonrası) |
|---|---|---|
| `buffers/sibre_sp_hydraulic.json` | `it.model` (ör. `SP 80 FF 400`) | `buffer_type`, `series`, `stroke_mm`, `energy_capacity_kj`, `max_end_force_kn`, `weight_kg`, `mounting`, `design_mass_t_max`, `max_restoring_energy_kn`, `damping_efficiency`, `length_l1_mm`, `length_l2_mm`, `length_l3_mm`, `body_dia_d1_mm`, `plunger_dia_d2_mm`, `bolt_hole_d3_mm`, `flange_a_mm`, `flange_b_mm` |
| `buffers/conductix_rubber.json` | `it.model` (ör. `017111-100N`) | `buffer_type`, `program`, `diameter_mm`, `height_mm`, **`energy_capacity_j`**, `max_force_kn`, `max_compression_pct`, `weight_kg`, `mounting`, `form`, `thread`, `packing_unit`, `standard_range` |
| `buffers/conductix_cellular.json` | `it.model` | `buffer_type`, `program`, `diameter_mm`, `height_mm`, `energy_capacity_kj`, `energy_capacity_static_kj`, `max_force_kn`, `max_compression_pct`, `weight_kg`, `mounting`, `thread`, `packing_unit`, `standard_range` |
| `buffers/firma_excel_buffers.json` | `it.model` | `stroke_mm`, `energy_capacity_kj`, `max_force_kn`, `source` |

Dikkat edilecekler:

1. **`type` alanını `buffer_type`'a yeniden adlandır.** Kaynak JSON'larda alan
   adı `type`'tır (`"hidrolik"` | `"kauçuk"` | `"hücresel"`); `attrs.type`
   satırın `kind`'ıyla karışır. `rename(a, { type: "buffer_type" })`.
2. **Enerji birimi türe göre DEĞİŞİR** — kauçuk `energy_capacity_j` (joule),
   hidrolik ve hücresel `energy_capacity_kj`. Ortak bir `energy_capacity_kj`
   alanına indirgemek isteniyorsa kauçukta `/1000` ile TÜRETİLİR ve **ham alan
   da korunur**; sessizce birim karıştırmak seçimi 1000 kat yanıltır.
3. **Kauçukta tek başına enerji YETMEZ.** `energy_capacity_j` yalnız %50
   sıkışmadaki uç değerdir. Kısmî sıkışmada çalışacak bir seçim
   `conductix_curves.json` eğrisini ister; bu dosya bir ÜRÜN listesi değildir,
   `cat_equipment`'a satır olarak girmez — ayrı bir tabloya ya da uygulama
   tarafında statik veri olarak taşınmalıdır (`applies_to_models` alanı
   eğriyi ürünlere bağlar).
4. **Kullanım grubu.** Redüktörlerdeki `application` gibi bir kilitli süzgeç
   tampon için gerekirse (araba tamponu / köprü tamponu) bu alan katalogda
   YOKTUR — ikisi de aynı üründür, ayrım hesap tarafındadır.
5. `firma_excel_buffers.json` satırları **teyitsizdir**; seed'e alınacaksa
   ayrı bir `attrs.unverified = true` bayrağıyla alınmalı ve seçicide
   varsayılan olarak gizlenmelidir.
6. `_version.json` → `sources.buffers` **doldurulmuştur**; seed migration'ı
   `npx tsx scripts/seed-catalog.ts --kinds buffer --out <YYYYMMDDHHMMSS>_buffer_seed`
   ile üretilir.

---

# Motor katalogları (`catalog_data/motors/`)

`abb.json` · `innomatics.json` · `gamak.json` — üç üretici PDF kataloğundan
(workspace kökünde, repo dışında) `pymupdf` ile çıkarılır.

**Marka adı:** Siemens'in bu ürün hattı **INNOMATICS** adıyla yenilenmiştir.
Dosya adı `innomatics.json`, `meta.brand` = "INNOMATICS"; kaynak PDF adı ve
doküman numarası meta'da Siemens olarak korunur — veri oradan gelmektedir,
kaynağın gizlenmesi doğru olmaz.

## Dosyalar

- `motors_common.py` — ortak parçalar: sütun bandına dayalı satır okuyucu
  (`banded_cells`), IEC 60072-1 mil ucu çapı defteri, gövde kodu ayrıştırma,
  JSON yazımı. ABB ve SIMOTICS sayfalarında tablo ÇİZGİSİ yoktur, bu yüzden
  `grid.py` oralarda işe yaramaz; sütunlar başlık x konumlarından türetilir.
  GAMAK sayfalarında çizgi ızgarası vardır ve `grid.py` doğrudan kullanılır.
- `motors_abb.py` · `motors_siemens.py` · `motors_gamak.py` — marka başına
  sayfa çözümleyicileri (düzenler birbirine hiç benzemez).
- `motors_build.py` — üçünü sırayla çalıştırır, özet basar.
- `motors_validate.py` — fiziğe ve IEC 60072-1'e karşı doğrulama.

```bash
pip install pymupdf
cd scripts/catalog-extract
python motors_build.py       # catalog_data/motors/*.json yazar
python motors_validate.py    # tutarlılık raporu (çıkış kodu 0 = HATA yok)
```

## Kaynak sayfalar ve satır sayıları

| Marka | Kaynak | Performans tabloları | Mil çapı (D) tablosu | Satır |
|---|---|---|---|---|
| ABB | `abb-ozel-elektrik-motor-katalog.pdf` (9AKK105944 EN 02-2020) | s.43 (2K) · s.44 (4K) · s.46 (6K) IE3 CENELEC-design · s.26 (8K) IE2 CENELEC-design | s.88 (IE3) · s.86 (IE2) | 115 |
| INNOMATICS | `SIEMENS MOTOR KATALOG.pdf` (Siemens D 81.1 · 12/2021) | s.150-153 SIMOTICS SD 1LE1503 Basic Line · s.154-157 1LE1603 Performance Line (2/4/6/8 kutup, IE3) | s.306 (gövde 71-160) · s.307+308 (gövde 180-315) | 100 |
| GAMAK | `GAMAK MOTOR.pdf` (Teknik Katalog 2022) | s.21-26 üç fazlı işletme değerleri (standart / yüksek verimli / premium verimli) | s.31 (gövde 56-200) · s.32 (132-450) | 148 |

Sayfa numaraları PDF sayfa numarasıdır (SIMOTICS kataloğunun kendi "3/18"
biçimindeki bölüm numarası ayrıca `meta.page_range` içindedir).

| Marka | 2K | 4K | 6K | 8K | Güç aralığı |
|---|---|---|---|---|---|
| ABB | 26 | 27 | 26 | 36 | 0,09 – 630 kW |
| INNOMATICS | 24 | 25 | 25 | 26 | 0,09 – 200 kW |
| GAMAK | 40 | 40 | 35 | 33 | 0,06 – 1000 kW |

## Alanlar

Zorunlu: `power_kw` · `poles` · `speed_rpm` · `torque_nm` · `frame_size` ·
`efficiency_pct` · `weight_kg` · **`shaft_diameter_mm`**.
Ek: `current_a` · `power_factor` · `series` · `ip_class` · `efficiency_class` ·
`model` · `shaft_source`.

`shaft_diameter_mm` motor ÇIKIŞ MİLİ ucunun çapıdır (IEC gövde ölçü
tablosundaki **D**, GAMAK'ta **DØ**). Üç katalogda da 225 ve üstü gövdelerde
2 kutuplu makine daha ince mille çıkar; bu yüzden eşleme kutup sayısına
duyarlıdır. `shaft_source` her satırda değerin katalogtan mı yoksa
IEC 60072-1'den mi geldiğini söyler — **363 satırın tamamı katalogtandır**,
IEC'e düşen satır yoktur.

## Kapsam kararları ve SAPMALAR

**Ortak ilke:** 400 V / 50 Hz, IP55; 60 Hz tabloları kapsam dışı. Aynı
(güç, kutup) çifti bir markada YALNIZ BİR KEZ bulunur; katalogun aynı gücü
birden çok gövde/varyantla bastığı yerlerde tek satır seçilir ve elenenler
`motors_build.py` çıktısında sayılır (sessizce atılmaz).

- **ABB — 8 kutupta IE3 YOK.** ABB bu katalogda 8 kutuplu IE3 dökme gövde
  motor yayınlamıyor (IE3 bölümü s.37-49 yalnız 2/4/6 kutup). 8 kutuplu
  satırlar IE2 tablosundan (s.26) alınmıştır. Ayrıca s.26'da dipnotla IE1'e
  düşen bir satır vardır (3 kW · 8 kutup · 132SMB); `efficiency_class` alanı
  her satırda gerçek sınıfı taşır. Dipnot NUMARALANDIRMASI sayfadan sayfaya
  değiştiğinden (s.26'da `4)` = IE1, s.43'te `3)` = IE1) her sayfada yeniden
  okunur — sabit bir eşleme yanlış sınıf yazardı.
- **ABB — IE3 iki kuşak.** Ürün kodunun son harfi kuşağı verir; L kuşağı
  (s.43-49) alınmıştır, çünkü 2/4/6 kutupta da CENELEC-design bölümü vardır.
  K kuşağının 2 kutuplu sayfasında yalnız "B design" bulunur ve karışık kuşak
  seçmek gövde-güç atamasını bozar. Her sayfadaki "High-output design"
  bölümü aynı gücü daha büyük gövdeyle tekrarladığı için ALINMAZ.
- **INNOMATICS — iki ürün hattı birleşik.** Tek hat dört kutup sayısını da
  kapsamıyor: Basic Line (1LE1503) 8 kutupta 1,5 kW'ta biter, Performance
  Line (1LE1603) 2 kutupta 3 kW'tan başlar. İkisi de alınmış, aynı
  (güç, kutup) için Performance Line tercih edilmiştir; `series` alanı hangi
  hattan geldiğini söyler. İki hat AYNI boyut tablosunu paylaşır (s.306-309
  başlıkları hem `1LE15.3-` hem `1LE16.3-` listeler), dolayısıyla gövde
  ölçüsü ve mil çapı ortaktır.
- **INNOMATICS — metin katmanı onarımı.** 8 kutuplu sayfalarda 1,5 kW
  satırının gövde sütunu metin katmanında "1112" üretiyor. Baştaki fazla
  basamak atılarak geçerli IEC kademesi (112) aranır; hiçbiri tutmazsa satır
  eksik sayılır — tahmin edilmez. Ürün kodu (`1BD2` → 1B = 112) bunu bağımsız
  olarak doğrular.
- **INNOMATICS — ürün no. ile ağırlık aynı kelimeye yapışıyor.**
  `1LE1503-0CA2■-■■■■13` tek bir kelimedir; ağırlık desenle ayrılır
  (`ARTICLE_RE`). Ürün kodu parçası (`0CA2`) aynı zamanda 180-315 gövde
  aralığında mil çapı eşlemesinin anahtarıdır.
- **GAMAK — 8 kutupta IE2/IE3 YOK.** GAMAK bu katalogda 8 kutuplu yüksek
  (IE2) ya da premium (IE3) verimli motor yayınlamıyor; 8 kutuplu satırların
  tamamı standart seridir (IE1). IE3 yalnız 55-400 kW arası 2 ve 4 kutupta
  basılıdır. Verim sınıfı ve gövde malzemesi BAŞLIKTAN DEĞİL tip kodundan
  okunur (`AGM2E 132 S 4a`: A = alüminyum · 2E = IE2), çünkü başlık konumu
  yatay yayım düzenine bağlıdır, tip kodu ise satırın kendi verisidir.
  Aynı (güç, kutup) için en yüksek verim sınıfı, eşitlikte pik (dökme) gövde
  seçilir.
- **GAMAK — ALINMAYAN SATIR.** s.25 (8 kutup, standart seri) 0,25 kW
  `AGM 80 M 8b` satırının anma verimi **basılı sayfada "630"** yazmaktadır;
  ondalık ayracı ne PDF içerik akışında ne de basılı görüntüde vardır (sayfa
  4× büyütmeyle görsel olarak da denetlendi). Doğru değer okunamadığından
  satır ALINMAMIŞTIR — tahmin edilen bir verim uydurma veri olur. Bu yüzden
  GAMAK 148 satırdır, 149 değil.
- **GAMAK — birleşik hücreli boyut tabloları.** s.31-32 boyut tablolarında
  yapı büyüklüğü ve kutup grubu hücreleri düşey birleştirilmiştir; `grid.py`
  bu satırları doğru dağıtamaz. Yalnız bu iki sayfada PyMuPDF'in kendi
  `find_tables` çözümleyicisi kullanılır, kutup grupları bir kuyruğa alınır ve
  her DØ değeri kuyruktaki ilk grubu tüketir.

## `motors_validate.py`

Windows konsolu cp1254'tür; çıktı `bearings_validate.py` ile aynı biçimde
UTF-8'e sabitlenir (rapor ortasında `UnicodeEncodeError` ile çökmek en
tehlikeli davranıştır — kullanıcı kısmi listeyi görüp gerisini "geçti" sanır).

| Kontrol | Kural | Düzey |
|---|---|---|
| Alan varlığı | sekiz zorunlu alan her satırda | HATA |
| Moment | `T ≈ 9550·P/n`, %5 tolerans | HATA |
| Devir (fizik) | `0 < kayma ≤ %15` (senkron 3000/1500/1000/750) | HATA |
| Devir (beklenti) | 2K 2800-2960 · 4K 1400-1480 · 6K 900-980 · 8K 690-740 | UYARI |
| Verim | %50-98 (P ≥ 0,75 kW) · %35-98 (P < 0,75 kW) | HATA |
| Mil çapı ↔ gövde | IEC 60072-1 kademesi | UYARI |
| Ağırlık / akım | > 0 | HATA |
| Tekrar | aynı (güç, kutup) çifti bir kez | HATA |
| `meta.page_range` | yer tutucu metin kalmamış | HATA |

**Devir kontrolü iki kademelidir.** İstenen bant (2800-2960 …) bir *katalog
beklentisidir*, fizik sınırı değil: 0,75 kW altındaki motorlarda kayma çok
daha büyüktür ve bandın ALTINA düşmek normaldir (GAMAK `AGM 71 M 8b`
670 d/dak); büyük motorlarda kayma sıfıra yaklaşır ve bandın ÜSTÜNE çıkmak
normaldir (SIMOTICS 315 gövde 2 kutup 2982 d/dak). Bandı HATA yapmak yüzlerce
gerçek satırı yanlış kırmızıya boyardı. Bu yüzden bant UYARI'dır, kayma sınırı
(0 < s ≤ %15) HATA'dır — yanlış sütundan okunmuş bir devir bu sınırı mutlaka
ihlal eder.

**Verim tabanı güce bağlıdır.** Tek bir %50 tabanı ABB 0,09 kW 8 kutup
(%49,4) ve SIMOTICS 0,09 kW 8 kutup (%44,1) satırlarını yanlışlıkla hata
gösterirdi; ikisi de BASILI değerdir.

**Kayıtlı katalog sapmaları.** `BILINEN_KATALOG_SAPMALARI` sözlüğü basılı
katalogun kendi tutarsızlığını gerekçesiyle kayda alır; kontrol çalışmaya
devam eder ama o satır UYARI'ya düşer — sessizce kaybolmaz. Şu an tek giriş:

| Dosya | Model | Kontrol | Gerekçe |
|---|---|---|---|
| `abb.json` | `M3BP 80MLC` | moment | Katalog s.44'te 4 Nm basılı, `9550·P/n` = 3,6 Nm. Komşu satırlar (0,37 kW → 2,46 Nm · 0,75 kW → 4,9 Nm) bağıntıya uyduğundan sapma basılı sayfanın kendi yuvarlamasıdır. Katalog değeri DEĞİŞTİRİLMEMİŞTİR — uydurma sayı yazmaktansa üreticinin beyanı korunur. |

## Doğrulama durumu

`motors_validate.py`: **0 HATA**, 193 UYARI (2904 kontrol). Uyarıların tamamı
üç başlıktadır ve her biri açıklanmıştır: (1) düşük kaymalı büyük motorların
beklenti bandını aşması, (2) 0,75 kW altı motorların bandın altına düşmesi,
(3) üreticinin IEC kademesinden bilinçli sapması — GAMAK 315 gövdede 85 mm
(IEC 80), ABB `315 ML_` varyantında 90 mm; ikisi de basılı boyut tablosundan
okunmuştur.

Basılı sayfayla **birebir** karşılaştırılan satırlar (sayfalar 3-4×
büyütmeyle görüntü olarak denetlendi):

| Marka | Satır | Basılı sayfa | Sonuç |
|---|---|---|---|
| ABB | 5,5 kW · 4K · M3BP 132SMB · 1460 d/dak · 35,9 Nm · %89,6 · 68 kg · 11 A | s.44 | ✓ |
| ABB | 11 kW · 4K · M3BP 160MLA · 1477 · 71,27 Nm · %91,4 · 160 kg · 21,1 A | s.44 | ✓ |
| ABB | 30 kW · 4K · M3BP 200MLA · 1483 · 193 Nm · %93,6 · 292 kg · 54,8 A | s.44 | ✓ |
| ABB | 55 kW · 4K · M3BP 250SMA · 1482 · 354 Nm · %94,6 · 406 kg · 100 A | s.44 | ✓ |
| ABB | mil çapı 132 → 38 · 160 → 42 · 200 → 55 · 250 → 60 (2K) / 65 (4-8K) | s.88 | ✓ |
| INNOMATICS | 5,5 kW · 4K · 1LE1603-1CB0 · 132 S · 1470 · 35,5 Nm · %89,6 · 74 kg | s.155 | ✓ |
| INNOMATICS | 30 kW · 4K · 1LE1603-2AB5 · 200 L · 1470 · 195 Nm · %93,6 · 240 kg | s.155 | ✓ |
| INNOMATICS | 55 kW · 4K · 1LE1603-2CB2 · 250 M · 1482 · 355 Nm · %94,6 · 420 kg | s.155 | ✓ |
| INNOMATICS | 90 kW · 4K · 1LE1603-2DB2 · 280 M · 1485 · 580 Nm · %95,2 · 670 kg | s.155 | ✓ |
| INNOMATICS | mil çapı 71 M → 14 · 80 M → 19 · 90 S/L → 24 · 100 L → 28 | s.307 | ✓ |
| GAMAK | 5,5 kW · 4K · GM2E 132 S 4a · 1465 · 35,9 Nm · %87,7 · 53 kg · 11,2 A | s.22 | ✓ |
| GAMAK | 11 kW · 4K · GM2E 160 M 4a · 1465 · 71,7 Nm · %89,8 · 115 kg · 21,3 A | s.22 | ✓ |
| GAMAK | 18,5 kW · 4K · GM2E 180 M 4a · 1470 · 120,2 Nm · %91,2 · 165 kg | s.22 | ✓ |
| GAMAK | 55 kW · 2K · GM3E 250 M 2a · 2985 · 176 Nm · %94,3 · 480 kg · 92 A | s.26 | ✓ |
| GAMAK | 75 kW · 2K · GM3E 280 S 2a · 2985 · 239,9 Nm · %94,7 · 585 kg · 127 A | s.26 | ✓ |
| GAMAK | mil çapı 225 → 55 (2K) / 60 (4-8K) · 315 → 65 / 85 · 355 → 80 / 100 | s.32 | ✓ |

## Sonraki adım (bu pakette YAPILMADI)

`scripts/seed-catalog.ts` ve `src/lib/catalog-mapping.ts` başka bir fazın
kapsamındadır. Gereken değişiklikler:

1. `seed-catalog.ts` motor dosya listesine **`motors/innomatics.json`**
   eklenmeli (şu an yalnız `gamak.json` ve `abb.json` okunuyor).
2. Aynı bloktaki `rename` haritasına `shaft_diameter_mm: "shaft_mm"`
   eklenmeli — redüktördeki `output_shaft_mm` / `input_shaft_mm` deseniyle
   tutarlı olur.
3. `catalog-mapping.ts` bölüm 2.4 ve 5.4'e
   `{ sel: "motorShaftMm", from: { attr: "shaft_mm" } }` eklenmeli. Alan bugün
   eşlenmiyor; `applyCatalogPick` sessizce atlıyor ve mühendisin eski değeri
   kalıyor. `motorShaftMm` kaplin mili çapını besliyor (`hoistGroup.ts`
   `maks(motorShaftMm, gearboxInputShaftMm)`), yani eşlenmemesi gerçek bir
   hesap girdisini eski değerde bırakıyor.
4. `motor` kind'ının `columns` listesine mil çapı (`shaft_mm`, "Mil Çapı",
   mm) ve verim sınıfı sütunları, `facets`e `efficiency_class` eklenmeli.
   INNOMATICS eklendiğinde `series` faceti üç markanın seri adlarını birlikte
   listeler; marka süzgeci zaten `brand` üzerindendir.
5. Uygulanmış seed migration'ı düzenlenmez; yenileme migration'ı üretilir:
   `npx tsx scripts/seed-catalog.ts --kinds motor --out <YYYYMMDDHHMMSS>_motor_reseed`
6. `catalog_data/_version.json` (başka ajanda) `sources.motors` satırı
   güncellenmeli: `"ABB M3BP (115) + INNOMATICS SIMOTICS SD (100, eski
   Siemens) + GAMAK (148) — 2/4/6/8 kutup, mil çapı dahil, PDF çıkarımı
   2026-08-06"`.

### `motorRpm` select'i ile katalog devri arasındaki uyuşmazlık

> **DURUM (PK-F / madde 9 paketi):** aşağıdaki önerinin `motorRpm` ayağı
> UYGULANDI — alan `fields.ts` ve `travelFields.ts` içinde artık
> **`type: "number"`** (birim d/dak). `MOTOR_RPM_SERIES` / `MOTOR_RPM_LABELS`
> anma devri sözlüğü olarak dışa verilmeye devam ediyor ama alan tanımı
> onları okumuyor. `motorPoles` ayağı HÂLÂ AÇIK. Aşağıdaki metin sorunun
> gerekçesi olarak korunmuştur.

`motorRpm` eskiden **select**'ti (`fields.ts` `MOTOR_RPM_SERIES` =
750/1000/1500/3000) ve `catalog-mapping.ts` ona katalogun `rpm` alanını
yazıyordu. Katalog ANMA devri veriyor (1465 · 1470 · 2985 …), yani seçim
listesinde karşılığı olmayan bir değer select'e yazılıyordu.

Bu yalnız görüntü sorunu değildir: `motorRpm` hesaba üç yerde giriyor —
`requiredRatio = motorRpm / drumRpm`, `actualSpeed = (motorRpm / ratio)·π·D`
ve `requiredPowerKw = (T · motorRpm) / 9550`. Senkron devir kullanmak
kaldırma/yürütme hızını %2-3 fazla, gereken çevrim oranını az gösterir.

**Öneri — alanı ikiye ayır:**

- `motorPoles` — yeni **select** (2 / 4 / 6 / 8). Katalog seçicisinde `poles`
  zaten bir facet; bu alan katalogdan `{ attr: "poles" }` ile dolar ve
  kullanıcının "1500'lük motor" niyetini taşır. Etiket bugünkü
  `MOTOR_RPM_LABELS` metinlerinin aynısı olabilir ("1.500 (4 kutup)").
- `motorRpm` — **`type: "number"`, birim d/dak**. Katalogdan anma devri
  (`{ attr: "rpm" }`) yazılır; katalogdan seçim yapılmadığında mühendis elle
  girer. Hesaplar bu alanı okumaya devam eder ama artık gerçek çalışma
  noktasını taşır.

Geriye uyumluluk: eski revizyonlarda `motorRpm` zaten 1500 gibi bir SAYI
olarak saklı, dolayısıyla select → number geçişi `revision-load.ts`
`withDefaults` tarafında göç gerektirmez. `motorPoles` yeni alan olduğundan
varsayılanı mevcut `motorRpm`'den türetilebilir (3000→2, 1500→4, 1000→6,
750→8).

Alternatif (daha az tercih edilir): `motorRpm` select kalır ve "senkron
devir" anlamını üstlenir, yanına `motorRatedRpm` eklenir. Bu, iki alanı da
raporda göstermek zorunda bırakır ve hangisinin hesaba girdiğini
belirsizleştirir.
