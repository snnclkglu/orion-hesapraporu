# CMAA Specification No. 70 (1983 Revizyonu) — Analiz Notları

Kaynak: `cmaa.txt` (87 PDF sayfası, OCR dökümü). Bu doküman CMAA 70-1983'tür (çok kirişli, üstten yürüyen gezer köprülü vinçler / Multiple Girder Electric Overhead Traveling Cranes).

**ÖNEMLİ NUMARALANDIRMA NOTU:** Bu 1983 baskısında dişli hesabı **4.7**, mil hesabı **4.11**, frenler **4.9 + 5.3**, teker seçimi **4.13**'tedir (görevde anılan 5.2.8/5.2.7/5.2.9.1.3 numaraları daha yeni baskılara/başka bölümlere aittir). Motor boyutlandırma **5.2.9** bu baskıda da aynıdır.

---

## 1. BÖLÜM HARİTASI (PDF s.2-3, İçindekiler)

| Bölüm | Başlık | PDF Sayfa |
|---|---|---|
| 70-1 | Genel Şartname (General Specifications): 1.1 Kapsam … 1.15 Bakım | 4–9 |
| 70-2 | Vinç Servis Sınıflandırması (Crane Classifications): 2.1–2.8 | 10–11 |
| 70-3 | Yapısal Tasarım (Structural Design): 3.1 Malzeme, 3.2 Kaynak, 3.3 Yapı/Yükler, 3.4 İzin verilen gerilmeler, 3.5 Tasarım sınırları, 3.6 Köprü uç arabası, 3.7 Yürüme yolu, 3.8 Kabin, 3.9 Araba şasisi, 3.10 Köprü rayları, 3.11 Uç bağları, 3.12 8/12/16 tekerli vinçler, 3.13 Cıvatalar, 3.14 Portal vinçler | 12–33 |
| 70-4 | Mekanik Tasarım (Mechanical Design): 4.1 Ortalama etkin yük, 4.2 Kanca blokları, 4.3 Aşırı yük sınırlayıcı, 4.4 Halatlar, 4.5 Makaralar, 4.6 Tambur, 4.7 Dişliler, 4.8 Rulmanlar, 4.9 Frenler, 4.10 Köprü tahrikleri, 4.11 Miller, 4.12 Kaplinler, 4.13 Tekerler, 4.14 Tamponlar | 34–52 |
| 70-5 | Elektrik Ekipmanı: 5.1 Genel, 5.2 Motorlar (5.2.9 motor boyutlandırma), 5.3 Frenler, 5.4 Kontrolörler, 5.5 Dirençler, 5.6 Koruma, 5.7 Master şalterler, 5.8 Pendant, 5.9 Limit şalterleri, 5.10–5.12 Kondüktörler, 5.13 Gerilim düşümü | 53–76 |
| 70-6 | Sorgu Veri Formu ve Hızlar (Inquiry Data Sheet & Speeds) | 77–80 |
| 70-7 | Sözlük (Glossary) | 81–84 |
| 70-8 | Dizin (Index) | 85–86 |

---

## 2. SERVİS SINIFLARI — Section 70-2 (PDF s.10-11)

### Sınıf tanımları (2.2–2.7)
*(Not: PDF s.10'da OCR paragraf sıraları karışıktır; başlıklarla eşleştirilmiştir.)*

- **2.2 Class A (Standby / Infrequent — Bekleme/Seyrek):** Güç santralleri, türbin salonları, motor odaları, trafo istasyonları; düşük hızda hassas elleçleme, kaldırmalar arası uzun boşta bekleme. Kapasite yükleri ilk kurulum ve seyrek bakım için.
- **2.3 Class B (Light — Hafif):** Tamir atölyeleri, hafif montaj, servis binaları, hafif depolama; yavaş hız, saatte 2–5 kaldırma, ortalama 10 ft kaldırma; yüksüzden ara sıra tam yüke.
- **2.4 Class C (Moderate — Orta):** Makine atölyeleri, kağıt fabrikası makine daireleri; yükler ortalama nominal kapasitenin ~%50'si, saatte 5–10 kaldırma, ortalama 15 ft, kaldırmaların %50'sinden azı nominal kapasitede.
- **2.5 Class D (Heavy — Ağır):** Ağır makine atölyeleri, dökümhaneler, imalat, depolar, konteyner sahaları, kereste fabrikaları; standart görev kepçe/mıknatıs işleri. Nominal kapasitenin ~%50'sine yaklaşan yükler sürekli; saatte 10–20 kaldırma, ortalama 15 ft; kaldırmaların %65'inden fazlası nominal kapasitede DEĞİL; yüksek hız istenir.
- **2.6 Class E (Severe — Şiddetli):** Ömrü boyunca nominal kapasiteye yakın yükler; hurda sahaları, çimento, kereste, gübre tesisleri, konteyner elleçleme; mıknatıs/kepçe kombinasyonları; saatte ≥20 kaldırma, nominal kapasitede veya yakınında.
- **2.7 Class F (Continuous Severe — Sürekli Şiddetli):** Nominal kapasiteye yakın yükleri sürekli, şiddetli koşullarda; özel tasarım kritik vinçler; en yüksek güvenilirlik + kolay bakım.

### Ortalama etkin yük faktörü (mean effective load factor) — 2.1 (PDF s.10)

```
k = ³√( W1³·P1 + W2³·P2 + W3³·P3 + … + Wn³·Pn )
```
- **W** = yük büyüklüğü (her kaldırılan yükün nominal kapasiteye oranı; yüksüz çalışma ve aparat ağırlığı dahil edilmelidir)
- **P** = yük olasılığı (o yük büyüklüğündeki çevrim sayısının toplam çevrime oranı; ΣP = 1.0)
- **k** = sadece vinç servis sınıfını belirlemede kullanılır.
- Normal ortam varsayımı: 0…104 °F (−17.78…40 °C), aşırı toz/nem/korozif duman yok.

### TABLE 2.8-1 — Load Class + Load Cycles → Servis Sınıfı (PDF s.11)

| Load Class | N1 | N2 | N3 | N4 | k (Mean Effective Load Factor) |
|---|---|---|---|---|---|
| L1 | A | B | C | D | 0.35 – 0.53 |
| L2 | B | C | D | E | 0.531 – 0.67 |
| L3 | C | D | E | F | 0.671 – 0.85 |
| L4 | D | E | F | F | 0.851 – 1.00 |

**Yük sınıfları:** L1 = nominal yükü istisnaen, normalde çok hafif yükler; L2 = nominal yükü nadiren, normalde ~1/3 nominal; L3 = nominal yükü oldukça sık, normalde 1/3–2/3 nominal; L4 = düzenli olarak nominale yakın yüklü.

**Yük çevrimleri:** N1 = 20.000–200.000; N2 = 200.000–600.000; N3 = 600.000–2.000.000; N4 = >2.000.000 çevrim.
(N1: uzun boşta bekleme ile düzensiz kullanım; N2: kesintili düzenli; N3: sürekli düzenli; N4: şiddetli sürekli.)

---

## 3. YAPISAL HESAP — Section 3.3 / 3.4 / 3.5 (PDF s.12-30)

### 3.3.2 Yükler (Loadings) — PDF s.12
- **Ana yükler (Principal):** DL (Dead Load, ölü yük — 3.3.2.1.1.1), TL (Trolley Load, araba yükü — 3.3.2.1.1.2), LL (Lifted Load, kaldırılan yük; kanca bloğu, traves, kepçe, mıknatıs vb. dahil — 3.3.2.1.1.3), düşey atalet kuvvetleri (VIF — 3.3.2.1.1.4), tahrik atalet kuvvetleri (IFD — 3.3.2.1.1.5).
- **Ek yükler (Additional):** işletme rüzgârı WLO (3.3.2.1.2.1), çarpıklık/skew kuvvetleri SK (3.3.2.1.2.2).
- **Olağanüstü yükler (Extraordinary):** servis dışı rüzgâr WLS (3.3.2.1.3.1), çarpışma CF (3.3.2.1.3.2), test yükleri. Deprem bu şartnamede kapsam dışıdır (gerekirse ivme, ray kotunda sahip/şartname yazarı tarafından verilir).

### 3.3.2.1.1.4.1 Ölü Yük Faktörü (Dead Load Factor, DLF) — TABLE 3.3.2.1.1.4.1-1 (PDF s.13)

| Yürüme hızı (Travel Speed, FPM) | DLF |
|---|---|
| ≤ 200 | 1.1 |
| > 200 | 1.2 |

Yük kombinasyonlarında köprü için DLFB, araba için DLFT olarak (her birinin kendi hızına göre) uygulanır.

### 3.3.2.1.1.4.2 Kaldırma Yükü Faktörü (Hoist Load Factor, HLF) — PDF s.13

```
HLF = 0.005 × (kaldırma hızı, FPM);   0.15 ≤ HLF ≤ 0.5
Metindeki yazım: (HLF) = .15 ≤ .005 (hoist speed) ≤ .5
```
- Kepçe (bucket) ve mıknatıs (magnet) vinçlerinde darbe değeri, kepçe/mıknatıs vincinin nominal kapasitesinin **%50**'si alınır.

### 3.3.2.1.1.5 Tahrik Atalet Kuvvetleri (IFD) — PDF s.13
- Yatay yük = düşey yükün yüzdesi olarak **7.8 × ivme/yavaşlama (ft/s²)**, fakat düşey yükün **%2.5'inden az olamaz**.
- Canlı + ölü yüklere uygulanır (uç arabaları ve uç bağları hariç); iki kirişe eşit bölünür; kirişin düşey eksene göre tüm kesit atalet momenti kullanılır; araba en elverişsiz konumda.

### 3.3.2.1.2.1 İşletme Rüzgâr Yükü (WLO) — PDF s.13
- Aksi belirtilmedikçe **5 lb/ft²** (dış saha vinçleri). Araba rüzgâr yükü iki kirişe eşit bölünür. Kiriş aralığı kiriş yüksekliğinden büyükse rüzgâr alanı = 1 kirişin izdüşüm alanı × **1.6**; tek yüzeyler (kabin, makine muhafazası) için × **1.2**.

### 3.3.2.1.2.2 Çarpıklık Kuvvetleri (Skewing, SK) — PDF s.14
- Her teker (veya bojideki) düşey yük × **Ssk** katsayısı; Ssk, oran = SPAN / WHEELBASE (açıklık/dingil mesafesi) oranına bağlıdır.
- Metindeki grafikten okunabilen eksen değerleri: Ssk ekseni 0.05 / 0.10 / 0.15; oran ekseni 3–8. Eğrinin tam ara değerleri [metinden çıkarılamadı — grafik OCR'da bozuk].

### 3.3.2.1.3 Olağanüstü Yükler — PDF s.14
- **WLS (Stored/servis dışı rüzgâr):** vincin servis dışında dayanması gereken maksimum rüzgâr; hız/test basıncı yüksekliğe, coğrafyaya, maruziyete bağlı (bkz. ANSI A58.1).
- **3.3.2.1.3.2 Çarpışma / Tampon kuvvetleri (CF):** Tampon hesabı **0.4 × nominal hızda** çarpma esas alınır; tampon sisteminin enerjiyi tasarım strokunda yutabildiği varsayılır. Serbest sallanan yük dikkate alınmaz; yük sallanamıyorsa yük dahil edilir. İki vinç çarpışmasında serbest kalan kinetik enerji:

```
E = M1·M2·(0.4·VT1 + 0.4·VT2)² / (2·(M1 + M2))
```
- Tampon kuvvetleri, tampon karakteristiğine ve yapının hareket serbestliğine göre dağıtılır (araba en elverişsiz konumda).

### 3.3.2.2 Burulma (Torsional Forces) — PDF s.14
- **3.3.2.2.1 Köprü motoru kalkış/duruşundan:** burulma momenti = köprü motoru kalkış momenti, tam yük momentinin **%200**'ü × motor-ara mili arasındaki dişli oranı.
- **3.3.2.2.2 Düşey yüklerden:** düşey kuvvet × (kuvvet ekseni ile kirişin kayma merkezi arasındaki yatay mesafe).
- **3.3.2.2.3 Yatay yüklerden:** yatay kuvvet × (kuvvet ekseni ile kayma merkezi arası düşey mesafe).

### 3.3.2.3 Teker Yükünün Boyuna Dağılımı — PDF s.15
```
S = 2H + 2 in. = 2(R + C) + 2 in.
R = ray yüksekliği, C = üst başlık plakası kalınlığı  (ray doğrudan başlık üzerinde ise; Fig. 3.3.2.3-1)
```

### 3.3.2.4 Yük Kombinasyonları (Load Combination) — PDF s.15
- **Case 1 (Stress Level 1) — düzenli kullanım, ana yükler:**
  `DL(DLFB) + TL(DLFT) + LL(1 + HLF) + IFD`
- **Case 2 (Stress Level 2) — düzenli kullanım, ana + ek yükler:**
  `DL(DLFB) + TL(DLFT) + LL(1 + HLF) + IFD + WLO + SK`
- **Case 3 (Stress Level 3) — olağanüstü yükler:**
  - Servis dışı rüzgârda: `DL + TL + WLS`
  - Çarpışmada: `DL + TL + LL + CF`
  - **3.3.2.4.3.3 Test yükü:** CMAA test yükünün nominal yükün **%125**'ini aşmamasını önerir.

### 3.4 İzin Verilen Gerilmeler (Allowable Stresses) — PDF s.16
*(σyp = akma sınırı / yield point)*

| Madde | Stress Level / Case | Çekme (Tension) | Basınç* (Compression) | Kayma (Shear) |
|---|---|---|---|---|
| 3.4.1 | 1 | 0.60 σyp | 0.60 σyp | 0.35 σyp |
| 3.4.2 | 2 | 0.66 σyp | 0.66 σyp | 0.375 σyp |
| 3.4.3 | 3 | 0.75 σyp | 0.75 σyp | 0.43 σyp |

\* Burkulmaya tabi olmayan elemanlar; burkulma için 3.4.6 ve 3.4.8'e bakınız.

**3.4.4 Birleşik gerilmeler:**
- 3.4.4.1 Düzlem gerilme referans gerilmesi: `σt = √(σx² + σy² − σx·σy + 3τxy²) ≤ σALL`
- 3.4.4.2 Kaynaklar için maksimum birleşik gerilme: `σv = ½(σx+σy) ± ½·√((σx−σy)² + 4τ²) ≤ σALL`

**3.4.6 Basınç elemanları (kolon burkulması):**
- KL/r < Cc iken: `σA = [1 − (KL/r)²/(2Cc²)]·σyp / N·[5/3 + 3(KL/r)/(8Cc) − (KL/r)³/(8Cc³)]` *(OCR bozuk; AISC formu — katsayı ayrıntısı [metinden kısmen çıkarılamadı])*, `Cc = √(2π²E/σyp)`
- KL/r > Cc iken (Euler bölgesi): `σA = 12π²E / (23·(KL/r)²·N)`
- **N katsayısı: Case 1 → 1.1, Case 2 → 1.0, Case 3 → 0.89**
- **3.4.6.3 Eksenel basınç + eğilme etkileşimi:**
  `σa/σBK + Cmx·σbx/[(1−σa/σ'ex)·σBX] + Cmy·σby/[(1−σa/σ'ey)·σBY] ≤ 1.0`; σa/σA ≤ 0.15 ise basitçe `σa/σA + σbx/σBX + σby/σBY ≤ 1.0`.
  Cm: yana ötelenmeli çerçevede 0.85; ötelenmesiz, açıklıkta yüksüz: `Cm = 0.6 − 0.4·M1/M2 ≥ 0.4`; açıklık yüklü + uçlar tutulu 0.85, tutulu değil 1.0.

### 3.4.7 Yorulma — İzin Verilen Gerilme Aralığı (Allowable Stress Range) — PDF s.18-22
Tekrarlı yüke maruz eleman ve bağlantılarda gerilme aralığı (σmax − σmin; işaret farklıysa σmin negatif) Table 3.4.7-1 değerlerini aşamaz. Kategoriler Table 3.4.7-2A'da tanımlı, krokiler Figure 3.4.7-2B; tipik kutu kiriş Fig. 3.4.7-3, tipik araba rayı Fig. 3.4.7-4.

**TABLE 3.4.7-1 — İzin verilen gerilme aralığı σsr (ksi):**

| Servis Sınıfı \ Joint Category | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| A | 43 | 43 | 43 | 43 | 40 | 43* |
| B | 43 | 43 | 43 | 40 | 28 | 43* |
| C | 43 | 43 | 40 | 28 | 20 | 31 |
| D | 43 | 34 | 28 | 20 | 14 | 22 |
| E | 34 | 24 | 20 | 14 | 10 | 16 |
| F | 24 | 17 | 14 | 10 | 7 | 11 |

\* Değerler OCR dökümünden aynen alınmıştır; A ve B satırlarının son (F kategorisi) sütunundaki 43 değeri tablonun genel düşüş düzeniyle çelişiyor görünmektedir — orijinal basılı tablodan doğrulanması önerilir. "Stress range values are independent of material yield stress" (gerilme aralığı değerleri malzeme akma dayanımından bağımsızdır).

**Joint kategorileri (Table 3.4.7-2A özet):** A = düz haddelenmiş malzeme; B = sürekli kaynaklı yapma elemanlar, taşlanmış tam nüfuziyetli ek kaynakları (NDT'li), yüksek dayanımlı sürtünme tipi cıvatalı bağlantı brüt kesiti; C = enine berkitme kaynak topuğu, tam nüfuziyetli ek (takviye kaldırılmamış, NDT'li), aralıklı kaynaklar (enine berkitme); D = mekanik bağlantı net kesiti, geçiş yarıçapı 2–6 in detaylar; E = kısmi boy kapak plakası uçları, boyuna berkitme aralıklı kaynakları, tapa/yarık kaynak bitişiği, R<2 in detaylar; F = köşe kaynak boğaz kesme gerilmesi, saplama kesmesi, kısmi nüfuziyetli enine kaynak metali.

### 3.4.8 Burkulma (Plate Buckling) — PDF s.23-27
- Plakalar a (boy) × b (en) panellere bölünür; a = tam derinlik diyafram/enine berkitme aralığı; b = basınç başlığında gövdeler arası mesafe, gövdede kiriş derinliği/berkitmeler arası mesafe.
- **Euler gerilmesi:** `σe = π²E/(12(1−μ²)) · (t/b)² = 26.21×10⁶ · (t/b)²  [PSI]` (E = 29.000.000 psi, μ = 0.3, t = plaka kalınlığı in, b = basınca dik plaka genişliği in).
- **Kritik burkulma gerilmeleri:** `σk = Kσ·σe ; τk = Kτ·σe` (Kσ, Kτ Table 3.4.8.2-1'den; α = a/b oranına, yükleme tipine ve ψ gerilme oranına bağlı).
- Basınç + kayma birlikte ise kıyas kritik gerilme σ1k hesaplanır; τ=0 özel halinde σ1k = σk; σ=0 halinde σ1k = τk·√3.
- Kritik gerilme orantı sınırının (σp = σy/1.32 varsayılır) üzerindeyse **inelastik burkulma**; gerilme indirgenir: `σkR = …` [formül OCR'da bozuk — metinden tam çıkarılamadı; 0.1836·σy² ve σk terimleri içeriyor].

**TABLE 3.4.8.2-1 — Burkulma katsayıları (basit mesnetli kenarlar):**

| Durum | Yükleme | Katsayı |
|---|---|---|
| 1 | Doğrusal değişen basınç (0 ≤ ψ ≤ 1) | α ≥ 1: `Kσ = 8.4/(ψ + 1.1)`;  α < 1: `Kσ = [α + 1/α]² · 2.1/(ψ + 1.1)` |
| 2 | Basınç baskın, basınç+çekme (−1 < ψ < 0) | `Kσ = (1+ψ)·K′ − ψ·K″ + 10ψ(1+ψ)` (K′: ψ=0 için Durum 1; K″: ψ=−1 için Durum 3) |
| 3 | Eşit kenar değerli basınç+çekme (ψ = −1) | α ≥ 2/3: `Kσ = 23.9`;  α < 2/3: `Kσ = 15.87 + 1.87/α² + 8.6·α²` |
| 4 | Üniform kayma | α ≥ 1: `Kτ = 5.34 + 4.00/α²`;  α < 1: `Kτ = 4.00 + 5.34/α²` |

**3.4.8.3 Burkulma emniyet katsayısı:**
Elastik: `νB = σ1k /√(σ² + 3τ²) ≥ DFB`; inelastik: aynı, σ1kR ile.

| Yük Kombinasyonu | Tasarım Faktörü DFB |
|---|---|
| Case 1 | 1.7 + 0.175(ψ − 1) |
| Case 2 | 1.5 + 0.125(ψ − 1) |
| Case 3 | 1.35 + 0.05(ψ − 1) |

### 3.5 Tasarım Sınırlamaları (Design Limitations) — PDF s.27-30
- **3.5.1 Kaynaklı kutu kiriş oranları:** `L/h ≤ 25`, `L/b ≤ 65`; b/t ve h/t burkulma analiziyle doğrulanmalı. (L = açıklık in, b = gövdeler arası mesafe in, h = kiriş derinliği in, t = plaka kalınlığı in.)
- **3.5.2 / 3.5.3 Boyuna berkitmeler:** 1 berkitme → basınç başlığı iç yüzünden tarafsız eksene mesafenin ~0.4'üne; 2 berkitme → 0.25 ve 0.55'ine. Gerekli atalet momentleri (bt³ cinsinden ampirik formüller, ör. `Io = 1.2[0.3 + 0.4·a/h + 1.3(a/h)² + 14·As·a/(h²t)]·b·t³` — OCR nedeniyle katsayılar kısmen şüpheli, uygulamadan önce orijinalden doğrulayın). Berkitme elemanı genişlik/kalınlık: tek kenar destekli ≤ **12.7**, iki kenar destekli ≤ **42.2** (3.5.2.3).
- **3.5.4 Diyafram/düşey berkitmeler:** Düşey gövde berkitme aralığı `a = 350·t/√v` [v = gövde kayma gerilmesi ksi; OCR kısmen bozuk] formülünü, ayrıca **72 in** veya gövde derinliği h'den (büyük olanı) fazlasını aşmamalı. Diyaframlar üst başlığa oturmalı, gövdeye kaynaklanmalı; diyafram kalınlığı araba teker yükünü yatakta taşımaya yeterli olmalı (teker yükü, ray tabanı genişliği + ray tabanından diyafram üstüne mesafenin 2 katı üzerinde yayılı kabul edilir).
- **3.5.4.6 Kısa diyaframlar:** araba rayında VIF'siz eğilme gerilmesini Case 1'de **18 ksi** ile sınırlayacak aralıkta: `(araba teker yükü)·(diyafram aralığı)/(6·ray kesit modülü) ≤ 18 ksi`; **Case 2 → 19.8 ksi, Case 3 → 22.5 ksi**.
- **3.5.5 Sehim ve ters sehim (Deflection & Camber):** Araba ağırlığı + nominal yükten düşey sehim ≤ **0.001125 in/in açıklık** (= L/888.9 ≈ **L/888**); VIF dahil edilmez. Kutu kirişlere **ters sehim (camber) = ölü yük sehimi + canlı yük sehiminin 1/2'si** verilmelidir.
- **3.5.7 Tek gövdeli kirişler:** aynı sehim limiti (0.001125 in/in). Case 1 maksimum gerilmeler: Çekme (net kesit) = 0.6σyp; **Basınç = 12,000/(L·d/Af) ≤ 0.6σyp** (L = üst başlık desteksiz boyu in, d = kiriş derinliği in, Af = basınç başlığı alanı in²); Kayma = 0.35σyp. Case 2 ve 3 için 3.4.1-3 oranlanır.

### 3.6 Köprü Uç Arabası (Bridge End Truck) — PDF s.31
- Dingil mesafesi (wheelbase) ≥ **açıklığın 1/7'si** [metin kesik: "1/7 of the span or…"]. Aks kırılmasında düşme ≤ 1 in olacak şekilde önlem; her dış tekerin önünde ray süpürgesi/koruyucu.

### 1.4 Kren Yolu (Runway) — PDF s.6-7
- Yanal sehim ≤ **L/400** (maks teker yüklerinin %10'u ile, darbesiz); düşey sehim ≤ **L/600** (maks teker yükleri ile, darbesiz).
- TABLE 1.4.2-1 toleransları: Açıklık (span): L≤50′ → A=3/16″; 50′<L≤100′ → A=1/4″ [OCR: %"]; L>100′ → A=3/8″; değişim hızı 1/4″ / 20′-0″. Doğrusallık B ≤ 1/4″ (1/4″/20′). Kot C ≤ 1/4″. Ray-ray kot farkı D: L≤50′ → ±3/16″; 50–100′ → ±1/4″; >100′ → ±3/8″. *(Kesir değerleri OCR'da "%" olarak bozulmuş; 3/16 ve ±3/8 metinden net, 1/4 değerleri tipik değer olarak işaretlendi — doğrulayın.)* Ray eki açıklığı ≤ 1/32 in.

---

## 4. KÖPRÜ / ARABA YÜRÜTME MOTORU BOYUTLANDIRMA — 5.2.9 (PDF s.57-62)

### 5.2.9.1.1 Kaldırma (Hoist) Tahrikleri — PDF s.57
```
Mekanik HP = (W × V) / (33000 × E)
```
- W = kaldırılan toplam ağırlık (lb; yük + kanca bloğu + aparatlar), V = kaldırma hızı (FPM), E = mekanik verim (ondalık): `E = Eg^n × Es^m`.
- **TABLE 5.2.9.1.1.1-1 Tipik verimler:** Rulmanlı (anti-friction): Eg = 0.97, Es = 0.99; Kaymalı (sleeve): Eg = 0.93, Es = 0.98.
- **TABLE 5.2.9.1.1.1-2 (rulmanlı, toplam verim E):** ör. 4 halat çift donanım (m=1): halat verimi 0.990; 2 redüksiyon (Eg²=0.9409) → E=0.931; 3 redüksiyon (0.9127) → 0.903. 8 halat (m=3): 0.970 / 0.913 / 0.885. 16 halat (m=7): 0.932 / 0.877 / 0.850. (Tam tablo m = 1…20 için PDF s.58.)
- **5.2.9.1.1.2 Gerekli motor gücü:** `Gerekli HP = Mekanik HP × Kc`; Kc = kontrol faktörü. Kc = 1 (kalıcı sekonder direnç yoksa: AC bilezikli manyetik/statik, DC ayar gerilimli, sabit potansiyelli DC). Kalıcı kayma dirençli AC bilezikli sistemlerde `Kc = motor nominal devri / kaldırmadaki işletme devri` (nominal momentte). Class E ve F'te ayrıca termik analiz gerekir.

### 5.2.9.1.2.1 Kapalı Saha (Indoor) Köprü ve Araba Tahrikleri — PDF s.59
```
Gerekli HP = Ka × W × V × Ks
```
- **W** = hareket ettirilecek toplam ağırlık (ölü + canlı, TON), **V** = nominal sürüş hızı (FPM), **Ks** = servis faktörü (Table 5.2.9.1.2.1-E), **Ka** = ivmelenme faktörü:

```
        f + (2000 × a × Cr) / (g × E)      Nr
Ka  =  ───────────────────────────────  ×  ──
                33,000 × Kt                Nf
```
*(OCR'daki dizgi: pay = "f + 2000a×Cr", "g×E" alt satırda; payda = "33,000 × Kt"; çarpan Nr/Nf. E'nin konumu dizgiden dolayı belirsizdir — E paydada tüm ifadeye de uygulanıyor olabilir; orijinal basılı formülle doğrulayın.)*

- **f** = yürüyüş sürtünmesi (aktarma kayıpları dahil), lb/ton — Table 5.2.9.1.2.1-D
- **a** = ortalama/eşdeğer üniform ivme (ft/s², nominal motor devrine kadar) — Table A ve B
- **Cr** = dönel atalet faktörü (rotational inertia factor) = (vinç+yük WK² + dönen kütle WK²)/(vinç+yük WK²); bilinmiyorsa `Cr = 1.05 + a/7.5` *(taramadaki "(all.5)" ifadesi CMAA 70-2000 baskısıyla çapraz doğrulandı: doğru payda 7.5'tir)*
- **g** = 32.2 ft/s²
- **E** = tahrik mekanik verimi (bilinmiyorsa 0.9 önerilir)
- **Nr** = motor tam yük nominal devri (RPM); **Nf** = V hızında serbest çalışma devri (bkz. 5.2.10.2)
- **Kt** = nominal motor momentine göre eşdeğer sabit ivmelendirme momenti oranı (kontrol karakteristiğine bağlı) — Table C

**TABLE 5.2.9.1.2.1-A — Tipik ivme aralıkları (yürütme):**

| Serbest hız (FPM) | (ft/s) | İvme a (ft/s²), AC veya DC |
|---|---|---|
| 60 | 1.0 | 0.25 min |
| 120 | 2.0 | 0.25 – 0.80 |
| 180 | 3.0 | 0.30 – 1.0 |
| 240 | 4.0 | 0.40 – 1.0 |
| 300 | 5.0 | 0.50 – 1.1 |
| 360 | 6.0 | 0.60 – 1.1 |
| 420 | 7.0 | 0.70 – 1.2 |
| 480 | 8.0 | 0.80 – 1.3 |
| 540 | 9.0 | 0.90 – 1.4 |
| 600 | 10.0 | 1.0 – 1.6 |

**TABLE 5.2.9.1.2.1-B — Teker patinajını önleyen maksimum ivme:**

| Tahrikli teker yüzdesi | 100 | 50 | 33.33 | 25 | 16.67 |
|---|---|---|---|---|---|
| Maks a (ft/s²), kuru ray (μ=0.2) | 4.8 | 2.4 | 1.6 | 1.2 | 0.8 |
| Maks a (ft/s²), ıslak ray (μ=0.12) | 2.9 | 1.5 | 1.0 | 0.7 | 0.5 |

**TABLE 5.2.9.1.2.1-C — Kt (ivmelendirme momenti faktörü) önerilen değerleri:**

| Motor tipi | Kontrol tipi | Kt |
|---|---|---|
| AC bilezikli (wound rotor) | Kontaktör-direnç | 1.3 – 1.5 |
| AC bilezikli | Statik kademesiz | 1.3 – 1.5 |
| AC bilezikli, mill | Kontaktör-direnç | 1.5 – 1.7 |
| AC sincap kafes | Balast direnci | 1.3 |
| DC şönt | Ayarlı gerilim | 1.5 |
| DC seri | Kontaktör-direnç | 1.35 |

(Kalıcı kayma direnci varsa aralığın alt ucu önerilir. DC seri motorlarda 'a', seri dirençler üzerindeyken oluşan değerdir; serbest devrin %50–80'i aralığı.)

**TABLE 5.2.9.1.2.1-D — Sürtünme faktörü f (lb/ton), metalik tekerler + rulmanlı yataklar:**

| Teker çapı (in) | 36 | 30 | 27 | 24 | 21 | 18 | 15 | 12 | 10 | 8 | 6 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| f (lb/ton) | 10 | 10 | 12 | 12 | 12 | 15 | 15 | 15 | 15 | 16 | 16 |

- Not 1: Kaymalı yataklı vinçlerde f = **24 lb/ton**. Not 2: Düşük verimli sonsuz dişli, metalik olmayan teker, özel yatak, kötü ray durumunda değiştirilebilir.

**TABLE 5.2.9.1.2.1-E — Yürütme servis faktörü Ks:**

| CMAA Sınıfı | DC sabit pot. AISE seri mill motor, 60 dk | Aynısı, 30 dk | AC manyetik + ayarlı gerilim DC şönt | AC statik, sabit sekonder direnç (kalıcı kayma) |
|---|---|---|---|---|
| A | 0.75 | 1.0 | 1.0 | 1.2 |
| B | 0.75 | 1.0 | 1.0 | 1.2 |
| C | 0.75 | 1.0 | 1.0 | 1.2 |
| D | 0.85 | 1.15 | 1.1 | 1.3 |
| E¹ | 1.0 | N/A | 1.2 | 1.4 |
| F² | 1.4 | N/A | 1.4 | 1.6 |

¹ Class E değerleri maks %30 devrede kalma ve saatte 25 çevrim esaslıdır (1 çevrim = 2 hareket: 1 yüklü + 1 boş). ² Class F: maks %50 devrede kalma, saatte 45 çevrim. Fazlası için görev çevrimi (duty cycle) analizi.

### 5.2.9.1.2.3 Açık Saha (Outdoor) Köprü Tahriki — PDF s.61-62
```
HPF = (W × V × f) / 33000                        (rüzgârsız serbest yürüyüş; W ton, V FPM, f Table D)
HPw = (P × rüzgâr alanı × V) / (33000 × E)       (yalnız rüzgâr)
Gerekli motor HP = 0.75 × (HPF + HPw) × Ks
```
- P = rüzgâr basıncı (lb/ft²), `P = … Vw²` formülünden (katsayı OCR'da kesik — [metinden çıkarılamadı]; Vw = rüzgâr hızı mph). Vw belirtilmemişse **P = 5 lb/ft²**. Rüzgâr alanı 3.3.2.1.2.1'e göre. Ek kontroller (5.2.9.1.2.3.4): rüzgâra karşı tam hıza ulaşabilme, rüzgârla giderken emniyetli maks hız, patinaj önleme, 4.9.4 fren gereksinimleri.
- 5.2.9.1.2.4: Açık saha araba tahriki, kapalı saha prosedürüyle (5.2.9.1.2.1) seçilir.

### 5.2.10 Redüksiyon (Gear Ratio) Seçimi — PDF s.62-63
- **Hoist:** `oran = (Nf × D × π) / (R × V × 12)`; D = tambur adım çapı (in); R = halat redüksiyon oranı = (yük bloğunu taşıyan toplam halat sayısı)/(tamburdan çıkan halat sayısı); Nf, tam yük kaldırma gücündeki `HP_FL = W·V/(33000·E)` için motor-kontrol hız-moment eğrisinden.
- **Köprü/araba:** `oran = (Nf × Dw × π) / (V × 12)`; Dw = teker yuvarlanma çapı (in); Nf, serbest yürüyüş gücü `HP_FR = W·f·V/33000` (W ton) noktasındaki devir. Standart oran kullanımına izin verilir; gerçek tam yük hızı, belirtilenin **±%10**'u içinde kalmalı.

---

## 5. (BOŞ — görev listesinde 5 yok, numaralar korunmuştur)

## 6. FREN BOYUTLANDIRMA — 4.9 (PDF s.39-41) ve 5.3 (PDF s.63)

### 4.9.1 Kaldırma Tutma Frenleri (Hoist Holding Brakes)
Minimum moment, frenin uygulandığı noktadaki **nominal yük kaldırma momentinin yüzdesi** olarak:
- **4.9.1.2.1:** **%125** — mekanik olmayan kontrol frenleme aracı ile birlikte kullanıldığında.
- **4.9.1.2.2:** **%100** — mekanik kontrol frenleme aracı (mekanik yük freni) ile.
- **4.9.1.2.3:** **%100** — iki tutma freni varsa her biri için.
- **4.9.1.5 Sıvı metal vinçleri:** (a) 2 tutma freni (biri redüktör milinde) + kontrol frenlemesi, her biri **%100**; veya (b) mekanik yük freni ya da enerji kesilince indirme yönünde acil frenleme sağlayan kontrol frenlemesi varsa tek tutma freni yeterli, momenti **%150**.
- 4.9.2 Kontrol frenleme araçları (mekanik, hidrolik, pnömatik veya elektrik: eddy-current, dinamik, rejeneratif, karşı moment) indirme hızını kontrol edebilmeli; termik kapasite servise yeterli olmalı.

### 4.9.3 Araba Frenleri / 4.9.4 Köprü Frenleri
- **Durdurma mesafesi kuralı:** Fren, nominal hızda nominal yükle giderken hareketi, **ft cinsinden = nominal yük hızının (FPM) %10'u** kadar mesafede durdurabilmelidir (4.9.3.1 araba, 4.9.4.1 kabinli köprü, 4.9.4.2 yerden/uzaktan kumandalı köprü — fren veya "non-coasting" mekanik tahrik).
- **Park freni:** varsa moment ≥ nominal motor momentinin **%50**'si (4.9.3.5 araba, 4.9.4.4 köprü).
- 4.9.5.1: Pedal frenlerinde nominal fren momenti için gereken kuvvet ≤ **70 lb**.
- Fren gereklilik matrisleri: Fig. 4.9.3.7-1 (araba), Fig. 4.9.5.8-1 (köprü) — kabinli/yerden, iç/dış saha kombinasyonlarına göre.
- 5.3 (Elektrik): tutma frenleri enerji kesilince otomatik uygulanır (5.3.3); çift frenli vinçlerde birine zaman gecikmesi verilebilir (5.3.4); yalnız acil durdurma/park için kullanılan yürütme freni bobini sürekli göreve (continuous duty) uygun olmalı (5.3.6).

---

## 7. TEKER YÜKLERİ VE SEÇİMİ — 4.13.3 (PDF s.45-50)

### Tanım (4.13.3)
- **Maksimum teker yükü (max wheel load):** araba + nominal yük, tekerde maksimum reaksiyon oluşturacak konumda; **darbe (impact) dahil edilmez**.
- Dayanım tabanlı teker seçimi: Table 4.13.3-4 değerleri `P = D × W × K` çarpımıyla kurulmuştur:
  - D = teker çapı (in), W = etkin ray mantar genişliği (in; mantar üstü − köşe yarıçapları),
  - K = teker sertlik katsayısı: `K = BHN × 5` (BHN ≤ 260); `K = 1300 × (BHN/260)^0.33` (BHN ≥ 260) *(üs OCR'da "33" görünüyor; 0.33 olarak yorumlandı — 5×260=1300 tutarlılığı sağlanıyor).*

### Yük faktörleri
- **4.13.3.1 Araba teker yük faktörü:**
```
Ktw = [2×(nominal yük/T) + 1.5×TW] / [3×(nominal yük/T) + 1.5×TW]     TW = araba ağırlığı
```
*(OCR'da "2Y rated load/T" biçiminde; pay/payda yapısı: Ktw = (2·LL + 1.5·TW)/(3·LL + 1.5·TW) düzeninde — orijinalden doğrulayın.)*
- **4.13.3.2'nin öncesi, köprü teker yük faktörü (formül, PDF s.46):**
```
Kbw = [0.75·BW + f·LL + 0.5·TW − 0.5·f·TW] / [0.75·BW + 1.5·f·LL]
```
*(OCR: ".75(BW) + f(LL) + .5(TW) − .5f(TW)" / ".75(BW) + 1.5f(LL)"; BW = köprü ağırlığı, LL = araba ağırlığı + nominal yük, f = X/açıklık.)* Standart kancalı vinçler için Table 4.13.3-1 kullanılabilir; 100 tondan büyük kapasitelerde 100 ton değerleri kullanılabilir.

**TABLE 4.13.3-1 — Tipik köprü yük faktörleri Kbw (seçme değerler):**

| Açıklık (ft) \ Kapasite (ton) | 3 | 5 | 10 | 20 | 30 | 50 | 75 | 100 |
|---|---|---|---|---|---|---|---|---|
| 20 | .812 | .782 | .747 | .722 | .716 | .713 | .709 | .708 |
| 40 | .827 | .794 | .760 | .732 | .723 | .714 | .711 | .708 |
| 60 | .861 | .830 | .790 | .754 | .741 | .726 | .721 | .717 |
| 80 | .888 | .857 | .818 | .779 | .761 | .742 | .735 | .730 |
| 100 | .912 | .883 | .848 | .806 | .786 | .763 | .753 | .745 |
| 120 | .934 | .909 | .879 | .834 | .814 | .790 | .774 | .763 |

(Tam tablo: 3, 5, 7.5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 75, 100 ton × 20–120 ft; PDF s.48.)

- **4.13.3.2 Hız faktörü Cs:**
```
RPM ≤ 31.5:  Cs = [1 + (RPM − 31.5)/330]²      [OCR: "(RPM − 31.5)/330" payda kısmen bozuk]
RPM ≥ 31.5:  Cs = 1 + (RPM − 31.5)/328.5
```
*(İki formülün RPM sınırına göre ataması OCR'da karışmıştır; Table 4.13.3-2 değerleriyle uyum için: düşük devirde Cs<1, yüksek devirde Cs>1 verir.)*

**TABLE 4.13.3-2 — Hız faktörü Cs (seçme değerler):**

| Teker çapı (in) \ FPM | 30 | 50 | 100 | 150 | 200 | 300 | 400 |
|---|---|---|---|---|---|---|---|
| 8 | .907 | .958 | 1.049 | 1.122 | 1.195 | 1.340 | 1.485 |
| 10 | .892 | .932 | 1.020 | 1.079 | 1.137 | 1.253 | 1.369 |
| 12 | .882 | .915 | 1.001 | 1.049 | 1.098 | 1.195 | 1.292 |
| 15 | .872 | .898 | .967 | 1.020 | 1.059 | 1.137 | 1.214 |
| 18 | .865 | .887 | .944 | 1.001 | 1.033 | 1.098 | 1.163 |
| 24 | .857 | .873 | .915 | .958 | 1.001 | 1.049 | 1.098 |
| 30 | .852 | .865 | .898 | .932 | .967 | 1.020 | 1.059 |
| 36 | .849 | .860 | .887 | .915 | .944 | 1.001 | 1.033 |

(Tam tablo 8–36 in çap × 30–400 FPM; PDF s.49.)

- **4.13.3.3 Teker servis faktörü Sm = 1.25 × Cd** (ray-teker etkileşiminin işlenmiş yağlı yüzeylerden daha zorlayıcı olduğunu hesaba katar).

**TABLE 4.13.3-3 — Sm ve minimum Kwl:**

| Servis sınıfı | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Kwl MIN. | .75 | .75 | .8 | .85 | .9 | .95 |
| Sm | .8 | .9 | 1.0 | 1.12 | 1.25 | 1.45 |

- **4.13.3.4 Teker yükü servis katsayısı:** `Kwl = Kw × Cs × Sm` (Kw: köprüde Kbw, arabada Ktw); **Kwl ≥ Kwl min** (Table 4.13.3-3).
- **4.13.3.5 Eşdeğer dayanım teker yükü (equivalent durability wheel load):**
```
Pe = Maks. teker yükü × Kwl   ;   Pe ≤ Table 4.13.3-4 değeri
```

**TABLE 4.13.3-4 — Temel köprü/araba teker yükleri, lb (P = D·W·K) — seçme değerler:**

| BHN | Çap (in) | ASCE 25# (W=1.000″) | ASCE 40# (W=1.250″) | ASCE 60&70#/ARA-B (W=1.750″) | ARA-A 100# (W=1.875″) | ASCE 100# (W=2.125″) | BETH/USS 135# (W=2.250″) |
|---|---|---|---|---|---|---|---|
| 200 | 8 | 8000 | 10000 | — | — | — | — |
| 200 | 10 | 10000 | 12500 | 17500 | — | — | — |
| 200 | 12 | 12000* | 15000 | 21000 | 22500 | 25500 | — |
| 200 | 18 | — | 22500 | 31500 | 33750 | 38250 | 40500 |
| 200 | 24 | — | — | 42000 | 45000 | 51000 | 54000 |
| 200 | 30 | — | — | — | 56250 | 63750 | 67500 |
| 200 | 36 | — | — | — | — | 76500 | 81000 |
| 260 | 12 | 15600* | 19500 | 27300 | 29250 | 33200 | — |
| 260 | 18 | — | 29250 | 41000 | 43900 | 49700 | 52650 |
| 260 | 24 | — | — | 54600 | 58500 | 66300 | 70200 |
| 260 | 36 | — | — | — | — | 99500 | 105300 |
| 320 | 12 | 16700* | 20900 | 29300 | 31300 | 35500 | — |
| 320 | 18 | — | 31300 | 43900 | 47000 | 53300 | 56400 |
| 320 | 24 | — | — | 58500 | 62700 | 71100 | 75200 |
| 320 | 36 | — | — | — | — | 106600 | 112800 |

\* 12″ satırındaki ilk değer OCR'da ASCE 25#/30# sütun hizası belirsiz. Etkin mantar genişlikleri W (in): ASCE 20#=0.844, 25#=1.000, 30#=1.063, 40#=1.250, ASCE 80&85#/ARA-A 90#=1.656, ASCE 60&70#/ARA-B 100#=1.750, ARA-A 100#=1.875, ASCE 100#/BETH 104/USS 105#=2.125, BETH&USS 135#=2.250. (Tam tablo PDF s.50; BHN blokları 200/260/320, çaplar 8–36 in.)

- **4.13.4 Teker boşluğu:** flanşlar arası açıklık, ray mantarından ~3/4–1 in daha geniş; konik sırtlı tekerlerde düz sırtlının %150'si.
- Kbw/Ktw ayrıca aks rulmanı seçiminde kullanılır (4.1.2.4).

---

## 8. DİŞLİ HESABI (4.7) VE MİL HESABI (4.11)

### 4.7 Dişliler (Gearing) — PDF s.35-36
- AGMA kalite sınıfı ≥ 5. Dayanım: kaldırma dişlileri için nominal yükü kaldırma momenti; yürütme dişlileri için motor etiket gücü esas alınır; maksimum fren momenti de gözetilir.
- AGMA 220.02 / 210.02 / 221.02 / 211.02'ye dayalı güç formülleri:
```
Mukavemet (strength):   Pat = (Np·d)/126000 × Kv × (F/Km) × (Sat·J)/(Pd·Sf)
Dayanıklılık (durability): Pac = (Np·F·I·Cv)/(126000·Cm·Sfd) × [(Sac·d·Ch)/Cp]²
```
*(OCR dizilimine göre yeniden kurulmuştur; Np = pinyon devri RPM, d = pinyon adım çapı in, F = net diş genişliği, Pd = diametral pitch, J/I = geometri faktörleri, Kv/Cv = dinamik, Km/Cm = yük dağılım, Cp = elastik katsayı, Ch = sertlik faktörü, Sat/Sac = izin verilen eğilme/temas gerilmesi.)*
- **Sfd (dayanıklılık servis faktörü) = Cd × Kw** (Cd: Table 4.1.3-1, Kw: 4.1).
- **TABLE 4.7.4-1 — Mukavemet servis faktörü Sf:** A=0.75, B=0.85, C=0.90, D=0.95, E=1.0, F=1.05.

### 4.1 Mekanik Ortalama Etkin Yük (PDF s.34) — dişli/rulman hesabına girdi
```
Kw = ³√[ (2·maks yük + min yük)³ … ]  →  metindeki temel form:
Kw = ³√[ (2(maks yük) + (min yük)) / (3(maks yük)) ]
Ortalama etkin yük = Maksimum yük × Kw
```
- **Kwh (hoist):** `Kwh = [2(nominal yük) + 3(kanca bloğu ağırlığı)] / [3(nominal yük + kanca bloğu ağırlığı)]` — blok < kapasitenin %2'si ise ihmal edilebilir (Kwh = 2/3).
- **Kwt (araba tahriki):** `Kwt = [2(nominal yük) + 3(araba ağırlığı)] / [3(nominal yük + araba ağırlığı)]`
- **Kwb (köprü tahriki):** `Kwb = [2(nominal yük) + 3(araba + köprü ağırlığı)] / [3(nominal yük + araba + köprü ağırlığı)]`
*(Hepsinde küp kök alınır: metindeki genel form `Kw = ³√(…)`; OCR'da köklerin gösterimi düşmüştür — 4.1.2 "Load factors Kw convert maximum loads into mean effective loads". Maks yük: nominal yük en elverişsiz konumda, darbesiz; min yük: yalnız köprü/araba ölü yükü.)*
- **TABLE 4.1.3-1 — Makine servis faktörü Cd:** A=0.64, B=0.72, C=0.8, D=0.9, E=1.0, F=1.16.
- **4.8.2 Rulman ömrü (AFBMA L10):** A=1250 h, B=2500 h, C=5000 h, D=10000 h, E=20000 h, F=40000 h (tam nominal hızda; Kw yük faktörü ile).

### 4.11 Miller (Shafting) — PDF s.43-44
- **TABLE 4.11.1-1 Yüzey durumu faktörü Ksc:** 1.4 = parlatılmış-ısıl işlemli-muayeneli; 1.0 = işlenmiş-ısıl işlemli-muayeneli; 0.75 = işlenmiş-genel kullanım.
- **TABLE 4.11.1-2 Vinç sınıfı faktörü Kc:** A=1.0, B=1.015, C=1.03, D=1.06, E=1.125, F=1.25.
- **Yorulma dayanımı:** `Se = 0.36 × Su′ × Ksc` (Su′ = minimum çekme dayanımı) *(OCR: "Se = .36 Su′ Ksc")*.
- **4.11.2 Yatak aralığı:** <400 RPM için `L ≤ ∛(4.760.000·D²/(1.2·N))` düzeninde bir formül; >400 RPM'de kritik hız titreşimi için `L ≤ √(432.000·D²/N)` düzeninde formül (küçük olanı alınır). *(Her iki formülün üs/kök yapısı OCR'da bozuk — "4,760,000 D…1.2N" ve "√432,000 D²" öğeleri metinden; kesin biçim orijinalden doğrulanmalı.)* L = yatak merkezleri arası (in), D = mil çapı (in), N = maks devir (RPM).
- **4.11.3 Köprü ara mili burulma sehimi (TABLE 4.11.3-1), derece/ft:**

| Tahrik | % Motor momenti | Kabinli | Yerden/uzaktan |
|---|---|---|---|
| A1 | 67 | .080 | 0.10 |
| A2 | 50 | .080 | 0.10 |
| A3 | 67 | .080 | 0.10 |
| A4 | 100 | .070 | 0.10 |
| A5 | 50 | .080 | 0.10 |
| A6 | 100 | .070 | 0.10 |

Ek koşul: toplam açısal sehim, tahrik tekerinde çevre üzerinde **teker çevresinin %[metinde kesik] veya 0.5 in**'den (hangisi ise) fazla hareket yaratmamalı.

- **4.11.4.1 Statik gerilme kontrolleri (işletme):**
  - Eksenel: `σ = P/A ≤ Su/5` (yani %20 Su)
  - Eğilme: `σ = M·r/I ≤ Su/5`
  - Burulma: `τ = T·r/J ≤ Su/(5√3)`
  - Enine kesme: dolu mil `τ = 1.33·V/A`; içi boş mil `τ = 2·V/A`; ≤ Su/(5√3)
  - Birleşik: `σt = √(σ² + 3τ²) ≤ Su/5`
- **4.11.4.2 Yorulma kontrolü (dalgalanan gerilmeler):** geometrik süreksizliklerde (fatura, delik, kama, sıkı geçme) gerilme yükseltme faktörleri Kt (eğilme), Ks (kesme) ile:
  - Tümü dalgalanan: `σt = √((Kt·σ)² + 3(Ks·τ)²) ≤ Se/Kc`
  - Kısmen dalgalanan: `σt = √((σav + Kt·(Syp/Se)·σr)² + 3(τav + Ks·(Syp/Se)·τr)²) ≤ Syp/Kc` *(OCR düzenine göre; Syp = min akma)*
- **4.11.5 Yatak basıncı:** `P/(d·L)`; dönen millerde ≤ min akmanın **%50**'si; salınım yapan millerde ≤ **%20** (burç malzemesi sınırlamıyorsa).
- Genel ilke (1.7.1): tüm diğer yük taşıyan parçalarda nominal kapasite ile statik gerilme ≤ ortalama kopma dayanımının **%20**'si. Kanca: düz kiriş teorisi ≤ %20 Su, eğri kiriş ≤ %33 Su (4.2.2.1); halat: ≤ %20 kopma yükü (sıvı metalde %12.5) (4.4.1).

---

## 9. DİĞER KONULAR

### Kren yolu rayı / köprü rayları (1.4, 3.10 — PDF s.6, 31)
- Kren yolu rayları düz, paralel, aynı kotta; toleranslar Table 1.4.2-1 (yukarıda). Ek aralığı ≤ 1/32″; yüzer ray önerilmez.
- Köprü/araba rayları Table 4.13.3-4 ile ve teker çapı + maks teker yüküyle uyumlu (3.10.2); ASCE/ARA/AREA birinci kalite; kayma (creep) önlenmeli.

### Tamponlar (Bumpers) — 3.3.2.1.3.2 (PDF s.14) + 4.14 (PDF s.51-52)
- Yapısal hesap: 0.4×nominal hız; enerji formülü yukarıda (Bölüm 3).
- **4.14.1 Köprü tamponu:** (1) güç kapalıyken **nominal hızın ≥%40**'ında vinci durduracak enerji kapasitesi; (2) nominal hızın %20'sinde ortalama yavaşlama ≤ **3 ft/s²**; (3) çarpmada cıvatalara doğrudan kesme gelmeyecek montaj.
- **4.14.7 Araba tamponu:** enerji kapasitesi **≥%50** nominal hız; nominal hızın 1/3'ünde ortalama yavaşlama ≤ **4.7 ft/s²**.
- Aynı yolda birden çok vinç/araba varsa komşu uçlara tampon (4.14.3, 4.14.9). Kren yolu durdurucuları (runway stops) genelde işveren tarafından; teker sırtına basan durdurucular önerilmez (4.14.6, 4.14.11).

### Skewing (çarpıklık) — 3.3.2.1.2.2 (PDF s.14)
- Yukarıda Bölüm 3'te: teker düşey yükü × Ssk; Ssk = f(SPAN/WHEELBASE), grafik değerleri 0.05–0.15 bandında, oran ekseni 3–8. Sözlük (PDF s.83): normal işletmede bir miktar skew her köprüde oluşur.
- İlgili: uç arabası dingil mesafesi ≥ açıklık/7 (3.6.1) skew eğilimini sınırlar.

### Sehim özet (hızlı referans)
- Kiriş düşey: **0.001125 in/in ≈ L/888** (araba + nominal yük, VIF'siz) — 3.5.5.1, 3.5.7.
- Kren yolu: yanal **L/400** (teker yüklerinin %10'u), düşey **L/600** — 1.4.3.

### Motor süre değerleri ve hızlar
- TABLE 5.2.7-1 (PDF s.56): minimum motor zaman değerleri (dk) — sınıf A/B: 15–60; C: 30–60; D: 30–60; E/F: 60 (mekanik yük frenli manyetik kontrol E/F için önerilmez).
- Fig. 6.2 / 6.3 (PDF s.80): önerilen işletme hızları (FPM) — yerden kumandalı köprü: 50/115/175 (3–25 ton, yavaş/orta/hızlı); kabinli köprü 200/300/400 (3–20 ton) … 150 tonda 50/75/100. Kaldırma: 3 ton 14/35/45 → 150 ton 3/6/11.

### Gerilim düşümü (5.13, PDF s.76)
- Şebeke tapında %96–105 nominal; kren yolu kondüktör sonunda ≥ %93 nominal; vinç içi düşüm ≈ %2; kalkışta motor terminali ≥ %90, fren/kontrol ≥ %85; işletmede motor terminali %95–110.

---

## OCR/GÜVENİLİRLİK NOTLARI
1. Metin taranmış PDF dökümüdür; kesir ve üs karakterleri (¼, ⅜, ², ³, √) sık bozulmuştur. Bozuk/emin olunamayan her yer "[metinden çıkarılamadı]" veya "(OCR ... doğrulayın)" ile işaretlendi.
2. Skewing Ssk eğrisi, inelastik burkulma indirgeme formülü (σkR), rüzgâr basıncı P = f(Vw²) katsayısı, TABLE 1.4.2-1'in bazı kesirleri ve Ka formülünde E'nin tam konumu metinden kesin çıkarılamayan başlıca öğelerdir.
3. Bu 1983 baskısıdır; sonraki baskılarda (2000/2005/2010/2015) madde numaraları ve bazı değerler (özellikle Table 3.4.7-1 yorulma değerleri ve motor formülleri) revize edilmiştir.
