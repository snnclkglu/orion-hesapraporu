# FEM 1.001 3rd Edition Revised (1998.10.01) — Standart İnceleme Notları

> Kaynak: `FEM 1.001 3rd Edition.pdf` (312 sayfa). Bu doküman iki bölümde hazırlanmıştır: Bölüm A (Booklet 1–3: kapsam, sınıflandırma, yükler, yapı gerilmeleri) ve Bölüm B (Booklet 4, 8, 9: mekanizma elemanları, test yükleri, ekler/değişiklikler). Tüm madde/tablo numaraları orijinal metinden alınmıştır; PDF sayfa numaraları dosyadaki mutlak sayfalardır. Hesap satırlarının `standard` alanları için başvuru kaynağıdır (bkz. `calc-crossref.md`).

---

# FEM 1.001 3rd Edition Revised (1998.10.01) — Bölüm A Analizi
## Booklet 1 (Object and Scope), Booklet 2 (Classification and Loading), Booklet 3 (Calculating the Stresses in the Structure)

Kaynak: fem.txt satır 1–6869, PDF sayfa 1–157. Tüm madde/tablo numaraları orijinal İngilizce metinden birebir alınmıştır.

---

# 1. BOOKLET / BÖLÜM HARİTASI

## Genel yapı (PDF s.3, madde 1.1 Preface)
FEM 1.001 kitapçıkları (booklets):
- **Booklet 1** – Object and Scope (Amaç ve Kapsam)
- **Booklet 2** – Classification and loading on structures and mechanisms (Sınıflandırma ve yükleme)
- **Booklet 3** – Calculating the stresses in the structure (Yapıdaki gerilmelerin hesabı)
- **Booklet 4** – Checking for fatigue and choice of mechanism components
- **Booklet 5** – Electrical equipment
- **Booklet 6** – Stability and safety against movement by the wind
- **Booklet 7** – Safety rules
- **Booklet 8** – Test loads and tolerances
(3rd Edition revised: booklet 1–5 ve 7–9'u kapsar.)

## Booklet 1 madde listesi (PDF s.2)
- 1.1 Preface (Önsöz)
- 1.2 Introduction (Giriş) — alıcının belirtmesi gerekenler: kullanım sınıfı (2.1.2.2), yük spektrumu (2.1.2.3); mekanizmalar için 2.1.3.2 / 2.1.3.3
- 1.3 Object of the Rules (Kuralların amacı, PDF s.6): dizayn için dikkate alınacak yükleri ve yük kombinasyonlarını belirlemek; mukavemet ve stabilite koşullarını koymak
- 1.4 Scope (Kapsam, PDF s.7): Section I terminolojisindeki vinçler; Section V (lastik/paletli mobil vinçler) ve Section IX (seri kaldırma ekipmanı, elektrikli vinçler/hoist, krikolar vb.) hariç
- List of Symbols and Notations (PDF s.8–21)

## Booklet 2 madde listesi (PDF s.23–25)
- 2.1 Group classification (2.1.1 genel plan; 2.1.2 aparey; 2.1.3 mekanizma; 2.1.4 komponent)
- 2.2 Loads entering into the design of structures (2.2.1 principal; 2.2.2 düşey hareket; 2.2.3 yatay hareket SH; 2.2.4 iklimsel; 2.2.5 muhtelif)
- 2.3 Cases of loading (Case I/II/III; 2.3.4 γc)
- 2.4 Seismic effects
- 2.5 Loads entering into the design of mechanisms (SM, SR)
- 2.6 Cases of loading (mekanizmalar; γm; 2.6.4 SM hesabı)
- Appendix A.2.1.1 (kullanım sınıfı harmonizasyonu), A.2.2.3 (yatay ivme yükleri hesabı)

## Booklet 3 madde listesi (PDF s.86–87)
- Introduction (üç kırılma nedeni: elastik limit aşımı, flambaj/burkulma, yorulma)
- 3.1 The choice of steel qualities (gevrek kırılma, ZA/ZB/ZC, kalite grupları)
- 3.2 Checking with respect to the elastic limit (3.2.1 elemanlar; 3.2.2 birleşimler: perçin/cıvata/kaynak)
- 3.3 Checking members subject to crippling (kolon flambajı, ω)
- 3.4 Checking members subject to buckling (plaka burkulması, νV)
- 3.5 Case of structures subjected to significant deformation
- 3.6 Checking members subjected to fatigue
- Appendix: A-3.2.2.2.2.3 (HS cıvatalar), A-3.2.2.3 (kaynak gerilmeleri), A-3.3 (crippling, ω tabloları), A-3.4 (plaka burkulması), A-3.6 (yorulma, W/K sınıfları, σW), hesap örnekleri

---

# 2. SINIFLANDIRMA (Madde 2.1, PDF s.26–36)

## 2.1.1 Genel plan (PDF s.26)
Sınıflandırma üç düzeyde yapılır: aparey bütünü (appliance as a whole), her mekanizma bütünü (individual mechanisms), yapısal/mekanik komponentler. İki kritere dayanır: toplam kullanım süresi (total duration of use) ve yük/gerilme spektrumu.

## 2.1.2 Apareyin (vincin) sınıflandırılması

### 2.1.2.2 Kullanım sınıfları U0–U9 — Tablo T.2.1.2.2 (PDF s.27)
Kaldırma çevrimi (hoisting cycle): bir yükün kaldırılmasıyla başlayıp aparey bir sonraki yükü kaldırmaya hazır olana kadarki tüm operasyon dizisi. nmax = toplam kaldırma çevrimi sayısı.

| Sembol | Toplam kullanım süresi (nmax kaldırma çevrimi) |
|---|---|
| U0 | nmax ≤ 16 000 |
| U1 | 16 000 < nmax ≤ 32 000 |
| U2 | 32 000 < nmax ≤ 63 000 |
| U3 | 63 000 < nmax ≤ 125 000 |
| U4 | 125 000 < nmax ≤ 250 000 |
| U5 | 250 000 < nmax ≤ 500 000 |
| U6 | 500 000 < nmax ≤ 1 000 000 |
| U7 | 1 000 000 < nmax ≤ 2 000 000 |
| U8 | 2 000 000 < nmax ≤ 4 000 000 |
| U9 | 4 000 000 < nmax |

### 2.1.2.3 Yük spektrumu (load spectrum) Q1–Q4 — Tablo T.2.1.2.3 (PDF s.27–28)
Spektrum faktörü (nominal spectrum factor):

kp = ∫₀¹ y^d dx, grup sınıflandırması için **d = 3** alınır.

Kademeli (basamaklı) yaklaşık form:

**kp = Σᵢ [ (mli / mlmax)³ · (ni / nmax) ]**

(mli = i. basamaktaki yük; mlmax = güvenli çalışma yükü (safe working load); ni = o yükteki çevrim sayısı; n1+n2+...+nr = nmax)

| Sembol | Spektrum faktörü kp |
|---|---|
| Q1 | kp ≤ 0,125 |
| Q2 | 0,125 < kp ≤ 0,250 |
| Q3 | 0,250 < kp ≤ 0,500 |
| Q4 | 0,500 < kp ≤ 1,000 |

### 2.1.2.4 Aparey grupları A1–A8 — Tablo T.2.1.2.4 (PDF s.29)

| Spektrum sınıfı | U0 | U1 | U2 | U3 | U4 | U5 | U6 | U7 | U8 | U9 |
|---|---|---|---|---|---|---|---|---|---|---|
| Q1 | A1 | A1 | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 |
| Q2 | A1 | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A8 |
| Q3 | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A8 | A8 |
| Q4 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A8 | A8 | A8 |

### 2.1.2.5 Grup seçimi rehberi — Tablo T.2.1.2.5 (PDF s.30, seçmeler)
| Ref | Aparey tipi | Kullanım | Grup |
|---|---|---|---|
| 1 | El ile çalıştırılan apareyler | — | A1–A2 |
| 2 | Montaj vinçleri (erection cranes) | — | A1–A2 |
| 3 | Santral/atölye montaj-demontaj vinçleri | — | A2–A4 |
| 4 | Stok/geri alma transportörleri | Kanca (hook duty) | A5 |
| 5 | Stok/geri alma transportörleri | Kepçe/mıknatıs (grab or magnet) | A6–A8 |
| 6 | Atölye vinçleri (workshop cranes) | — | A3–A5 |
| 7 | Gezer köprülü vinçler, hurda vinçleri | Kepçe/mıknatıs | A6–A8 |
| 8 | Pota vinçleri (ladle cranes) | — | A6–A8 |
| 9 | Tav çukuru vinçleri (soaking-pit) | — | A8 |
| 10 | Stripper / şarj vinçleri | — | A8 |
| 11 | Dövme (forge) vinçleri | — | A6–A8 |
| 12a | Yükleme/konteyner köprü vinçleri | Kanca/spreader | A5–A6 |
| 12b | Diğer köprü vinçleri (crab ve/veya döner bomlu) | Kanca | A4 |
| 13 | Yükleme köprü vinçleri | Kepçe/mıknatıs | A6–A8 |
| 14 | Kuru havuz, tersane bom vinçleri | Kanca | A3–A5 |
| 15 | Rıhtım vinçleri, yüzer vinçler | Kanca | A5–A6 |
| 16 | Rıhtım vinçleri, yüzer vinçler | Kepçe/mıknatıs | A6–A8 |
| 17 | Çok ağır yükler için yüzer vinçler (>100 t) | — | A2–A3 |
| 18 | Güverte vinçleri | Kanca | A3–A4 |
| 19 | Güverte vinçleri | Kepçe/mıknatıs | A4–A5 |
| 20 | İnşaat kule vinçleri | — | A3–A4 |
| 21 | Derrick'ler | — | A2–A3 |
| 22 | Trende koşabilen demiryolu vinçleri | — | A4 |

## 2.1.3 Mekanizmaların sınıflandırılması (PDF s.29, 31–33)

### 2.1.3.2 Kullanım sınıfları T0–T9 — Tablo T.2.1.3.2 (PDF s.31)
Kullanım süresi = mekanizmanın fiilen hareket halinde olduğu süre (saat).

| Sembol | Toplam kullanım süresi T (saat) |
|---|---|
| T0 | T ≤ 200 |
| T1 | 200 < T ≤ 400 |
| T2 | 400 < T ≤ 800 |
| T3 | 800 < T ≤ 1 600 |
| T4 | 1 600 < T ≤ 3 200 |
| T5 | 3 200 < T ≤ 6 300 |
| T6 | 6 300 < T ≤ 12 500 |
| T7 | 12 500 < T ≤ 25 000 |
| T8 | 25 000 < T ≤ 50 000 |
| T9 | 50 000 < T |

### 2.1.3.3 Yükleme spektrumu L1–L4 — Tablo T.2.1.3.3 (PDF s.31–32)
km = ∫₀¹ y^d dx, d = 3. Yaklaşık form:

**km = Σᵢ [ (Si / Smax)³ · (ti / T) ]**

| Sembol | Spektrum faktörü km |
|---|---|
| L1 | km ≤ 0,125 |
| L2 | 0,125 < km ≤ 0,250 |
| L3 | 0,250 < km ≤ 0,500 |
| L4 | 0,500 < km ≤ 1,000 |

### 2.1.3.4 Mekanizma grupları M1–M8 — Tablo T.2.1.3.4 (PDF s.32)

| Spektrum sınıfı | T0 | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 |
|---|---|---|---|---|---|---|---|---|---|---|
| L1 | M1 | M1 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 |
| L2 | M1 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M8 |
| L3 | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M8 | M8 |
| L4 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M8 | M8 | M8 |

### 2.1.3.5 Mekanizma grup seçimi rehberi — Tablo T.2.1.3.5 (PDF s.33, seçmeler)
Sütunlar: Kaldırma (Hoisting) / Dönme (Slewing) / Bom kaldırma (Luffing) / Araba yürütme (Traverse) / Yürütme (Travel)

| Ref | Aparey tipi (kullanım) | Hoist | Slew | Luff | Traverse | Travel |
|---|---|---|---|---|---|---|
| 1 | El ile çalıştırılan | M1 | – | – | M1 | M1 |
| 2 | Montaj vinçleri | M2–M3 | M2–M3 | M1–M2 | M1–M3 | M2–M3 |
| 3 | Santral montaj-demontaj | M2 | – | – | M2 | M2 |
| 4 | Stok transportörleri (kanca) | M5–M6 | M4 | – | M4–M5 | M5–M6 |
| 5 | Stok transportörleri (kepçe/mıknatıs) | M7–M8 | M6 | – | M6–M7 | M7–M8 |
| 6 | Atölye vinçleri | M6 | M4 | – | M4 | M5 |
| 7 | Gezer köprülü/hurda (kepçe/mıknatıs) | M8 | M6 | – | M6–M7 | M7–M8 |
| 8 | Pota vinçleri | M7–M8 | – | – | M4–M5 | M6–M7 |
| 9 | Tav çukuru vinçleri | M8 | M6 | – | M7 | M8 |
| 10 | Stripper/şarj vinçleri | M8 | M6 | – | M7 | M8 |
| 11 | Dövme vinçleri | M8 | – | – | M5 | M6 |
| 12a | Yükleme/konteyner köprü (kanca/spreader) | M6–M7 | M5–M6 | M3–M4 | M6–M7 | M4–M5 |
| 12b | Diğer köprü vinçleri (kanca) | M4–M5 | M4–M5 | – | M4–M5 | M4–M5 |
| 13 | Yükleme köprü (kepçe/mıknatıs) | M8 | M5–M6 | M3–M4 | M7–M8 | M4–M5 |
| 14 | Kuru havuz/tersane bom (kanca) | M5–M6 | M4–M5 | M4–M5 | M4–M5 | M5–M6 |
| 15 | Rıhtım/yüzer vinçler (kanca) | M6–M7 | M5–M6 | M5–M6 | – | M3–M4 |
| 16 | Rıhtım/yüzer vinçler (kepçe/mıknatıs) | M7–M8 | M6–M7 | M6–M7 | – | M4–M5 |
| 17 | Yüzer vinçler >100 t | M3–M4 | M3–M4 | M3–M4 | – | – |
| 18 | Güverte vinçleri (kanca) | M4 | M3–M4 | M3–M4 | M2 | M3 |
| 19 | Güverte vinçleri (kepçe/mıknatıs) | M5–M6 | M3–M4 | M3–M4 | M4–M5 | M3–M4 |
| 20 | İnşaat kule vinçleri | M4 | M5 | M4 | M3 | M3 |
| 21 | Derrick'ler | M2–M3 | M1–M2 | M1–M2 | – | – |
| 22 | Demiryolu vinçleri | M3–M4 | M2–M3 | M2–M3 | – | – |

## 2.1.4 Komponentlerin sınıflandırılması (PDF s.34–36)

### 2.1.4.2 Kullanım sınıfları B0–B10 — Tablo T.2.1.4.2 (PDF s.34)
(n = gerilme çevrimi sayısı)

| Sembol | n (gerilme çevrimi) | Sembol | n |
|---|---|---|---|
| B0 | n ≤ 16 000 | B6 | 500 000 < n ≤ 1 000 000 |
| B1 | 16 000 < n ≤ 32 000 | B7 | 1 000 000 < n ≤ 2 000 000 |
| B2 | 32 000 < n ≤ 63 000 | B8 | 2 000 000 < n ≤ 4 000 000 |
| B3 | 63 000 < n ≤ 125 000 | B9 | 4 000 000 < n ≤ 8 000 000 |
| B4 | 125 000 < n ≤ 250 000 | B10 | 8 000 000 < n |
| B5 | 250 000 < n ≤ 500 000 | | |

### 2.1.4.3 Gerilme spektrumu P1–P4 — Tablo T.2.1.4.3 (PDF s.35)
ksp = ∫₀¹ y^c dx (c: malzeme/şekil/boyut/yüzey/korozyona bağlı üs — booklet 4).
ksp = Σᵢ [ (σi/σmax)^c · (ni/n) ]

| Sembol | ksp |
|---|---|
| P1 | ksp ≤ 0,125 |
| P2 | 0,125 < ksp ≤ 0,250 |
| P3 | 0,250 < ksp ≤ 0,500 |
| P4 | 0,500 < ksp ≤ 1,000 |

Yapısal komponentlerde spektruma esas gerilme: σsup − σm farkları (σm = tüm üst/alt gerilmelerin aritmetik ortalaması). Mekanik komponentlerde σm = 0 alınır. Yaylı komponentler gibi çalışma yükünden bağımsız yüklenenler çoğunlukla ksp = 1 → P4.

### 2.1.4.4 Komponent grupları E1–E8 — Tablo T.2.1.4.4 (PDF s.36)

| Spektrum | B0 | B1 | B2 | B3 | B4 | B5 | B6 | B7 | B8 | B9 | B10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | E1 | E1 | E1 | E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 |
| P2 | E1 | E1 | E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | E8 |
| P3 | E1 | E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | E8 | E8 |
| P4 | E1 | E2 | E2 | E4 | E5 | E6 | E7 | E8 | E8 | E8 | E8 |

*(Not: Bu matris metin dökümünden sütun-satır yeniden kurulmuştur; B2–B3/P3–P4 kesişimlerinde döküm akışı "E1 E1 E2 E2" / "E1 E2 E3 E4" şeklindedir — B2 sütunu P4 için E2, B3 sütunu P4 için E4 okunmuştur. Standart FEM tablosuyla uyumludur ancak B2/P4 hücresi dökümde belirsizdi, [emin değilim] işareti.)*

---

# 3. YÜKLER (Madde 2.2, PDF s.37–53)

## Tanımlar (2.2, PDF s.37)
- **Working load (çalışma yükü)**: kaldırılan faydalı yük + aksesuar ağırlıkları (makara blokları, kanca, traversler, kepçe vb.)
- **Dead load (ölü yük/zati ağırlık)**: çalışma yükü hariç, bir elemana etkiyen komponentlerin zati ağırlığı.
- Yük türleri: (a) principal loads (SG zati + SL çalışma yükü, en gayri müsait konumda), (b) düşey hareket yükleri, (c) yatay hareket yükleri, (d) iklimsel yükler.

## 2.2.1 Ana yükler (PDF s.37)
SG (dead weight) + SL (working load); tüm hareketli parçalar en gayri müsait konumda. Her eleman, maksimum gerilmeyi veren yük büyüklüğü (0 ile SWL arası) ve aparey konumu için tasarlanır (bazı durumlarda maksimum gerilme yüksüz halde oluşabilir).

## 2.2.2 Düşey hareket yükleri — Dinamik katsayı ψ (2.2.2.1.1, PDF s.38)

**ψ = 1 + ξ · VL**

- VL: kaldırma hızı (m/s); ξ: deneysel katsayı.
- **ξ = 0,6** gezer köprülü vinçler ve köprü vinçleri (overhead travelling cranes and bridge cranes)
- **ξ = 0,3** bomlu vinçler (jib cranes)
- Formülde VL için alınacak maksimum hız **1 m/s** (daha yüksek hızlarda ψ artırılmaz).
- **ψ ≥ 1,15** (hiçbir durumda 1,15'ten küçük alınmaz).
- Değerler Şekil 2.2.2.1.1 eğrilerinde (A: köprülü vinçler, B: bomlu vinçler) verilir.
- Not: Bomlu vinç ξ değeri, kaldırma yükünü esnek eleman (bom) taşıdığı için daha küçüktür; transporter konsol ucu için jib değeri, bacaklar arası için köprü değeri kullanılabilir.

*(Görev metnindeki "Tablo T.2.2.2.1.1" ifadesine karşılık metinde tablo değil Şekil 2.2.2.1.1 eğrisi vardır; sayısal ξ değerleri yukarıdaki gibidir.)*

### 2.2.2.2 (PDF s.39)
ψ en büyük şok olan yük kapmayı (snatch) kapsadığından, kaldırma hareketinin ivmelenme/yavaşlama yükleri ve düzgün döşenmiş raylarda düşey şoklar ihmal edilir (ray ekleri iyi durumda olmalı; yüksek hızda kaynaklı ray önerilir).

### 2.2.2.3 Özel durum (PDF s.39–41)
Ölü yük ile çalışma yükü zıt işaretliyse iki durum karşılaştırılır:
- Yük indirme (setting down) durumu: **SG − SL·(ψ−1)/2**
- Yüklü durum: **SG + ψ·SL**
En gayri müsait olan esas alınır. (Kaldırmada salınım genliği SL(ψ−1); indirmede bunun yarısı kabul edilir.)

## 2.2.3 Yatay hareket yükleri SH (PDF s.42–45)

### 2.2.3.1.1 Araba/köprü yürütme ivmeleri — Tablo T.2.2.3.1.1 (PDF s.42–43)
Tahrikli tekerlek temas noktasında raya paralel yatay kuvvet. Kullanıcı hız/ivme belirtmezse üç işletme koşulu:
(a) uzun mesafeli düşük-orta hız; (b) normal uygulamalar, orta-yüksek hız; (c) yüksek ivmeli yüksek hız.

| Hız (m/s) | (a) süre (s) | (a) ivme (m/s²) | (b) süre (s) | (b) ivme (m/s²) | (c) süre (s) | (c) ivme (m/s²) |
|---|---|---|---|---|---|---|
| 4,00 | — | — | 8,0 | 0,50 | 6,0 | 0,67 |
| 3,15 | — | — | 7,1 | 0,44 | 5,4 | 0,58 |
| 2,5 | — | — | 6,3 | 0,39 | 4,8 | 0,52 |
| 2 | 9,1 | 0,22 | 5,6 | 0,35 | 4,2 | 0,47 |
| 1,60 | 8,3 | 0,19 | 5,0 | 0,32 | 3,7 | 0,43 |
| 1,00 | 6,6 | 0,15 | 4,0 | 0,25 | 3,0 | 0,33 |
| 0,63 | 5,2 | 0,12 | 3,2 | 0,19 | — | — |
| 0,40 | 4,1 | 0,098 | 2,5 | 0,16 | — | — |
| 0,25 | 3,2 | 0,078 | — | — | — | — |
| 0,16 | 2,5 | 0,064 | — | — | — | — |

*(Sütun-hız eşleşmesi dökümdeki blok sıralamasından yeniden kurulmuştur; (a) sütununun 2,0 m/s'den başladığı, (c) sütununun 1,0 m/s'de bittiği kabulü bağlamdan çıkarılmıştır — standart FEM tablosuyla uyumludur.)*

**Sınır:** dikkate alınacak yatay kuvvet, tahrikli/frenli tekerleklerdeki yükün **1/30'undan az, 1/4'ünden çok olamaz**.

### 2.2.3.1.2 Dönme ve bom kaldırma (slewing/luffing) (PDF s.43)
Motor miline uygulanan ivmelenme/yavaşlama momentine göre hesaplanır. Normal vinç için bom ucunda ivme **0,1–0,6 m/s²** (hız ve yarıçapa göre), ivmelenme süresi **5–10 s** olacak şekilde seçilir. Hesap yöntemi Appendix A.2.2.3'te.

### 2.2.3.2 Merkezkaç kuvveti (PDF s.43)
Bomlu vinçlerde dönmeden doğan merkezkaç dikkate alınır; pratikte yük halatının eğiminden bom ucuna gelen yatay kuvveti belirlemek yeterlidir; diğer elemanlarda genelde ihmal edilir.

### 2.2.3.3 Çapraz yürüyüş / yuvarlanma kaynaklı enine reaksiyonlar (transverse reactions due to rolling action / skewing) (PDF s.44)
İki tekerlek (veya iki boji) rayda yuvarlanırken raya dik yatay kuvvet çifti dikkate alınır. Bileşenler = tekerlek (boji) düşey yükü × **λ** katsayısı; λ, açıklık p / dingil mesafesi a oranına bağlıdır:
- **p/a = 2 ile 8 arasında λ = 0,05 ile 0,2 arasında** (grafikten okunur).
- "Wheelbase": en dıştaki tekerlek çiftleri merkez mesafesi; bojilerde boji pivot merkezleri mesafesi; yatay kılavuz tekerlekler varsa bunların ray temas noktaları arası.

### 2.2.3.4 Tampon etkileri ST (buffer effects) (PDF s.44–45)
**Yapıya etki (2.2.3.4.1):**
1) Asılı yük salınabiliyorsa: yatay hız < 0,7 m/s ise tampon etkisi dikkate alınmaz. Hız > 0,7 m/s ise tamponla çarpışma reaksiyonları hesaba katılır. Tamponun, apareyin (çalışma yükü hariç) kinetik enerjisini nominal hızın **0,7·Vt** kesrinde absorbe edebildiği varsayılır. Yapıdaki yükler tamponun verdiği yavaşlamaya göre hesaplanır. Hız > 1 m/s ise otomatik yavaşlatma tertibatı varsa azaltılmış hız Vt olarak alınabilir (salt sınır şalteri yeterli sayılmaz).
2) Rijit kılavuzlu (salınamayan) yük: aynı hesap, çalışma yükü de dahil edilerek yapılır.

**Asılı yüke etki (2.2.3.4.2):** yalnız rijit kılavuzlu yüklerde; çarpışma yükü, crab'in iki tekerleğini kaldırabilecek yatay kuvvet olarak hesaplanabilir.

## 2.2.4 İklimsel etkiler — Rüzgar (2.2.4.1, PDF s.45–52)

### 2.2.4.1.1 Rüzgar basıncı (PDF s.45)
**q = 0,613 · Vs²**  (q: dinamik basınç N/m²; Vs: tasarım rüzgar hızı m/s)

### 2.2.4.1.2.1 Servis içi rüzgar — Tablo T.2.2.4.1.2.1 (PDF s.46)

| Aparey tipi | Servis rüzgar basıncı (N/m²) | Servis rüzgar hızı (m/s) |
|---|---|---|
| Rüzgara karşı kolay korunabilen veya yalnız hafif rüzgarda kullanılan apareyler; montaj işleri | 125 | 14 |
| Açıkta kurulu tüm normal vinç tipleri | 250 | 20 |
| Kuvvetli rüzgarda çalışmaya devam etmesi gereken apareyler (örn. T.2.1.2.5'teki tip 12a) | 500 | 28 |

**Yük (kanca yükü) üzerindeki rüzgar:** F = 2,5 · A · q (F: N; A: yükün dolu kısımlarının maksimum alanı m²; bilinmiyorsa SWL'nin **tonu başına min. 0,5 m²** alınır).

### 2.2.4.1.2.2 Servis dışı (fırtına) rüzgarı — Tablo T.2.2.4.1.2.2 (PDF s.47)

| Zemin üstü yükseklik (m) | Servis dışı tasarım rüzgar basıncı (N/m²) | Yaklaşık eşdeğer hız (m/s) |
|---|---|---|
| 0 – 20 | 800 | 36 |
| 20 – 100 | 1 100 | 42 |
| > 100 | 1 300 | 46 |

Basınç yükseklik aralıklarında sabit alınabilir veya tepe basıncı tüm yükseklikte sabit kabul edilebilir. Bomu hızla indirilebilen vinçlerde (her iş günü sonunda indirilmesi şartıyla) servis dışı rüzgar dikkate alınmayabilir.

### 2.2.4.1.3 Rüzgar yükü hesabı (PDF s.48)
**F = A · q · Cf**  (A: etkin ön alan m²; Cf: şekil katsayısı). Toplam yük = parça yüklerinin toplamı.

### 2.2.4.1.4.1 Şekil katsayıları — Tablo T.2.2.4.1.4.1 (PDF s.49)
Aerodinamik narinlik l/b veya l/D'ye göre:

| Tip | Açıklama | ≤5 | 10 | 20 | 30 | 40 | 50 | >50 |
|---|---|---|---|---|---|---|---|---|
| Tekil eleman | Hadde profilleri, kutu ≤356 mm kare / 254×457 mm | 1,15–1,4 aralığı* | 1,05–1,45* | 1,05–1,5* | 1,2–1,55* | 1,3–1,55* | 1,4–1,55* | 1,6 |
| Tekil eleman | Diğer kesitler | 1,30 | 1,35 | 1,60 | 1,65 | 1,70 | 1,80 | 1,80 |
| Tekil eleman | Dairesel kesit, D·Vs < 6 m²/s | 0,60 | 0,70 | 0,80 | 0,85 | 0,90 | 0,90 | 0,90 |
| Tekil eleman | Dairesel kesit, D·Vs ≥ 6 m²/s | 0,60 | 0,65 | 0,70 | 0,70 | 0,75 | 0,80 | 0,80 |
| Tek kafes çerçeve | Düz kenarlı kesitler | 1,70 | | | | | | |
| Tek kafes çerçeve | Dairesel, D·Vs < 6 | 1,10 | | | | | | |
| Tek kafes çerçeve | Dairesel, D·Vs ≥ 6 | 0,80 | | | | | | |
| Makine daireleri vb. | Zemin/katı taban üstü dikdörtgen kaplamalı yapılar | 1,10 | | | | | | |

*(\*) Hadde/kutu profil satırı dökümde üç alt satır halinde iç içe geçmiştir (1,15/1,4/1,05 – 1,15/1,45/1,05 – 1,3/1,5/1,2 – 1,4/1,55/1,3 – 1,45/1,55/1,4 – 1,5/1,55/1,5 – 1,6/1,6/1,6); satır ayrımı (hangi alt satırın hangi profile ait olduğu) dökümden kesin kurulamadı [emin değilim].*

Büyük kutu kesitler (>356 mm kare, >254×457 mm) için b/d oranına göre (rüzgar yönü b'ye dik):

| b/d | ≤5 | 10 | 20 | 30 | 40 |
|---|---|---|---|---|---|
| 2 | 1,55 | 1,75 | 1,95 | 2,10 | 2,20 |
| 1 | 1,40 | 1,55 | 1,75 | 1,85 | 1,90 |
| 0,5 | 1,0 | 1,20 | 1,30 | 1,35 | 1,40 |
| 0,25 | 0,80 | 0,90 | 0,90 | 1,0 | 1,0 |

Tanımlar (Şekil 2.2.4.1.4.1, PDF s.50): Aerodinamik narinlik = l/b veya l/D; Doluluk oranı (solidity ratio) = A/Ae = Σ(li·bi)/(L·B); Aralık oranı (spacing ratio) = a/b veya a/B; Kesit oranı = b/d.

### 2.2.4.1.4.2 Perdeleme (shielding) katsayısı η — Tablo T.2.2.4.1.4.2 (PDF s.51)

| a/b \ A/Ae | 0,1 | 0,2 | 0,3 | 0,4 | 0,5 | ≥0,6 |
|---|---|---|---|---|---|---|
| 0,5 | 0,75 | 0,40 | 0,32 | 0,21 | 0,15 | 0,10 |
| 1,0 | 0,92 | 0,75 | 0,59 | 0,43 | 0,25 | 0,10 |
| 2,0 | 0,95 | 0,80 | 0,63 | 0,50 | 0,33 | 0,20 |
| 4,0 | 1,0 | 0,88 | 0,76 | 0,66 | 0,55 | 0,45 |
| 5,0 | 1,0 | 0,95 | 0,88 | 0,81 | 0,75 | 0,68 |
| 6,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 | 1,0 |

Ardışık özdeş n çerçeve: F1 = A·q·Cf; F2 = η·A·q·Cf; Fn = η^(n−1)·A·q·Cf (n = 3…8); 9. ve sonrası F9 = η⁸·A·q·Cf.
Toplam (≤9 çerçeve): F_total = [(1 − η^n)/(1 − η)]·A·q·Cf; (>9): F_total = [(1 − η⁹)/(1 − η) + (n − 9)·η⁸]·A·q·Cf. η^x alt sınırı 0,10.

### 2.2.4.1.4.3 Kafes kuleler (PDF s.52)
Kare kule "yüzden" rüzgar toplam kuvvet katsayısı (rüzgar yüzü dolu alanına):
- Düz kenarlı kesitler: **1,7·(1 + η)**
- Dairesel, D·Vs < 6 m²/s: **1,1·(1 + η)**; D·Vs ≥ 6 m²/s: **1,4**
η, a/b = 1 için T.2.2.4.1.4.2'den. Köşeden esen rüzgarda maksimum yük ≈ yüz değerinin **1,2 katı**.

### 2.2.4.1.4.4 Rüzgara eğik parçalar (PDF s.52)
- Tekil eleman/çerçeve: **F = A·q·Cf·sin²θ**
- Kafes kiriş/kule: **F = A·q·Cf·K2**, K2 = θ / [50·(1,7 − Sp/S)]; sınırlar 0,35 ≤ K2 ≤ 1,0. (θ: derece, <90°; Sp: örgü elemanları izdüşüm alanı; S: tüm elemanların izdüşüm alanı.)

## 2.2.4.2 Kar yükü (PDF s.53)
Köprülü, gezer köprülü ve bomlu vinçlerde kar yükü ihmal edilir.

## 2.2.4.3 Sıcaklık (PDF s.53)
Sadece serbest genleşemeyen elemanlarda dikkate alınır; sınır değerler **−20 °C … +45 °C**.

## 2.2.5 Platform yükleri (2.2.5.1, PDF s.53)
- 3000 N: malzeme konulabilen bakım geçitleri/platformları
- 1500 N: yalnız personel erişim geçitleri
- 300 N: korkuluk ve süpürgeliklere yatay kuvvet
(Kiriş hesabında kullanılmaz.)

---

# 4. YÜK KOMBİNASYONLARI — YAPI (Madde 2.3, PDF s.54–56)

## 2.3.1 Case I — Rüzgarsız çalışma (PDF s.54)
**γc · (SG + ψ·SL + SH)**
SH: 2.2.3'te tanımlanan yatay etkilerden en gayri müsait **iki** tanesi (tampon kuvvetleri hariç). Yürütme yalnız konumlama içinse başka yatay hareketle kombine edilmez.

## 2.3.2 Case II — Rüzgarlı çalışma (PDF s.54)
**γc · (SG + ψ·SL + SH) + SW**
SW: sınır çalışma rüzgarı (T.2.2.4.1.2.1) + varsa sıcaklık etkisi. (Rüzgarda ivme/fren süreleri farklıdır.)

## 2.3.3 Case III — İstisnai yüklemeler (PDF s.55)
En yükseği alınır:
- a) **SG + SWmax** (servis dışı maksimum rüzgar, ankraj reaksiyonları dahil)
- b) **SG + SL + ST** (en büyük tampon etkisi; yük salınımı ihmal edilir, rijit kılavuzlu yükler hariç)
- c) **SG + ψ·ρ1·SL** veya **SG + ρ2·SL** (dinamik test ρ1, statik test ρ2 — booklet 8, madde 8.1.1/8.1.2)
Not 1: (c) kontrolü yalnız çalışma yükünün tek başına zati ağırlığa zıt yönde gerilme ürettiği ve statik test yükünün 1,5·SWL'yi aşmadığı durumlarda yapılır.

## 2.3.4 Amplifikasyon katsayısı γc — Tablo T.2.3.4 (PDF s.56)
*(Görev metninde "Tablo T.2.3.1" denmiş; metindeki gerçek numara T.2.3.4'tür.)*

| Aparey grubu | A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 |
|---|---|---|---|---|---|---|---|---|
| γc | 1,00 | 1,02 | 1,05 | 1,08 | 1,11 | 1,14 | 1,17 | 1,20 |

## 2.4 Sismik etkiler (PDF s.56)
Genelde Avrupa sismik etkileri için kontrol gerekmez; resmi yönetmelik/şartname öngörüyorsa özel kurallar uygulanır; sismik spektrumları kullanıcı sağlar.

---

# 4b. MEKANİZMA YÜKLERİ VE KOMBİNASYONLARI (Madde 2.5–2.6, PDF s.57–62)

## 2.5 Mekanizma yükleri (PDF s.57)
- **SM tipi**: motor/fren momentlerine doğrudan bağlı yükler. Bileşenler: SMG (çalışma yükü dışındaki hareketli parçaların düşey yer değişimi), SML (çalışma yükünün düşey yer değişimi), SMF (verimde hesaba katılmamış sürtünmeler), SMA (ivme/fren), SMW (çalışma rüzgarı).
- **SR tipi**: motor/fren etkisinden bağımsız, tahrik millerinde momentle dengelenmeyen reaksiyon yükleri. Bileşenler: SRG (zati ağırlık), SRL (çalışma yükü), SRA (ivmeler), SRW (çalışma rüzgarı SW veya maksimum rüzgar SWmax).

## 2.6 Mekanizma yük kombinasyonları ve γm — Tablo T.2.6 (PDF s.58)

| Mekanizma grubu | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 |
|---|---|---|---|---|---|---|---|---|
| γm | 1,00 | 1,04 | 1,08 | 1,12 | 1,16 | 1,20 | 1,25 | 1,30 |

- **Case I** (rüzgarsız normal servis): SM max I = (SMG + SML + SMF + SMA)·γm ; SR max I = (SRG + SRL + SRA)·γm
- **Case II** (rüzgarlı): SM max II = (SMG + SML + SMF + SMA + SMW8)·γm  **veya** (SMG + SML + SMF + SMW25)·γm — büyüğü alınır (SMW8: 80 N/m² rüzgar; SMW25: 250 N/m²). SR max II = (SRG + SRL + SRA + SRW25)·γm
- **Case III** (istisnai): SM için motorun fiilen iletebileceği maksimum yük; SR max III = SRG + SRWmax

### 2.6.4 SM uygulaması (PDF s.60–62)
- **Kaldırma hareketi**: Case I–II: SM max I = (SML + SMF)·γm (kaldırma ivmesi ihmal). **Case III: SM max III = 1,6·(SML + SMF)** (deneyime dayalı 1,6 katsayısı).
- **Yatay hareketler**: Case I: (SMF + SMA)·γm ; Case II: (SMF + SMA + SMW8)·γm veya (SMF + SMW25)·γm (büyüğü); Case III: motor (veya fren) maksimum momentine karşılık gelen yük; kayma/tork sınırlayıcı varsa fiilen iletilen değer.
- **Bileşik hareketler**: Case III için SMC max III (maks. motor momenti) veya ağırlık merkezi yükseltme baskınsa SM max III = 1,6·SM max II.

---

# 5. BOOKLET 3 — GERİLME HESABI VE İZİN VERİLEN GERİLMELER (PDF s.85–157)

## Giriş (PDF s.88)
Üç kırılma nedeni için yeterli emniyet katsayısı ν kontrol edilir: elastik limit aşımı; kritik crippling/buckling yükü aşımı; yorulma dayanım sınırı aşımı. Kesitler: basınçta brüt kesit, çekmede net kesit (delikler düşülür); eğilmede yarı-net kesit kabulü yapılabilir.

## 5.1 Çelik kalitesi seçimi (3.1, PDF s.89–95)
Gevrek kırılmaya (brittle fracture) karşı çelik kalitesi üç etkinin puanlanmasıyla seçilir:
- **Etki A (3.1.1.1)**: boyuna artık çekme gerilmeleri + zati ağırlık gerilmeleri.
  - Çizgi I (kaynaksız/yalnız enine kaynak): ZA = σG/(0,5·σa) − 1 (σG ≥ 0,5·σa için geçerli)
  - Çizgi II (boyuna kaynaklar): ZA = σG/(0,5·σa)
  - Çizgi III (kaynak yığılması): ZA = σG/(0,5·σa) + 1
  (Gerilme giderme tavı ~600–650 °C yapılırsa tüm kaynak tipleri için çizgi I.)
- **Etki B (3.1.1.2)**: eleman kalınlığı t. ZB = 9·t²/2500 (t = 5–20 mm); ZB = 0,65·(t − 14,81)^0,5 − 0,05 (t = 20–100 mm). Örnek değerler: t=5→0,10; t=10→0,40; t=20→1,45; t=50→3,8; t=100→6,0. Hadde profillerde ideal kalınlık t* = d/1,8 (yuvarlak), t/1,8 (kare), b/1,8 (dikdörtgen, b/t ≤ 1,8; b/t > 1,8 ise t* = t).
- **Etki C (3.1.1.3)**: soğuk etkisi (kuruluş yerindeki en düşük sıcaklık). ZC = 6·T²/1600 (0 … −30 °C); ZC = [(−2,25·T) − 33,75]/10 (−30 … −55 °C). Örnek: 0→0,0; −20→1,5; −30→3,4; −55→9,0.

**Tablo T.3.1.2 (PDF s.93)** — ΣZ = ZA + ZB + ZC toplamına göre kalite grubu:

| ΣZ | Kalite grubu |
|---|---|
| ≤ 2 | 1 |
| ≤ 4 | 2 |
| ≤ 8 | 3 |
| ≤ 16 | 4 |

(ΣZ > 16 ise malzeme uzmanlarıyla özel önlemler.)

**Tablo T.3.1.3 (PDF s.94)** — Kalite grupları, V-çentik darbe (ISO R 148) değerleri:

| Grup | Çentik sünekliği (Nm/cm²) | Test sıcaklığı Tc (°C) | Karşılık gelen çelikler (örnek) |
|---|---|---|---|
| 1 | — | — | Fe 360-A, Fe 430-A; St 37-2, St 44-2; E 24-1 |
| 2 | 23 (min. 5*) | +20 | Fe 360-B, Fe 430-B, Fe 510-B; R St 37-2; E 24-2, E 26-2, E 36-2 |
| 3 | 33 (min. 5*) | 0 | Fe 360-C, Fe 430-C, Fe 510-C; St 37-3U, St 44-3U, St 52-3U; E 24-3, E 26-3, E 36-3 |
| 4 | 43 (min. 5*) | −20 | Fe 360-D, Fe 410-D, Fe 510-D; St 37-3N, St 44-3N, St 52-3N; E 24-4, E 26-4, E 36-4 |

*(\*) Dökümde "23 5 +20", "33 5 0", "43 5 −20" biçiminde; ikinci rakamın (5) anlamı dökümden tam çözülemedi [emin değilim — muhtemelen kalınlık kademesi/dipnot]. Üç testin ortalaması; hiçbir değer 20 Nm/cm² altında olmamalı.*

Özel kurallar (3.1.4, PDF s.95): Grup 1 kaynatılmamış (non-killed) çelikler yalnız ≤6 mm hadde profil/boru; >50 mm kalınlık için özel deneyim; soğuk bükümde r/t < 10 ise katlamaya uygun kalite.

## 5.2 Elastik limite göre kontrol (3.2, PDF s.96–107)

### 5.2.1 Basit çekme/basınç — νE ve σa (3.2.1.1, PDF s.96)
σE/σR < 0,7 olan çelikler için: hesaplanan σ ≤ σa = σE / νE.

| | Case I | Case II | Case III |
|---|---|---|---|
| **νE** | **1,5** | **1,33** | **1,1** |
| σa | σE/1,5 | σE/1,33 | σE/1,1 |

**Tablo T.3.2.1.1 (PDF s.96)** — A.37/A.42/A.52 (E.24/E.26/E.36) için σE ve σa (N/mm²):

| Çelik | σE | σa Case I | σa Case II | σa Case III |
|---|---|---|---|---|
| E.24 (A.37, Fe 360 ≈ S235) | 240 | 160 | 180 | 215 |
| E.26 (A.42) | 260 | 175 | 195 | 240 |
| E.36 (A.52, Fe 510 ≈ S355) | 360 | 240 | 270 | 325 |

(σE, %0,2 uzamaya karşılık gelen gerilme olarak alınır.)

**Yüksek elastik limitli çelikler** (σE/σR > 0,7, PDF s.97):
σa = [ (σE + σR) / (σE.52 + σR.52) ] · σa52 ; burada σE.52 = 360 N/mm², σR.52 = 510 N/mm².

### 5.2.2 Kayma ve eşdeğer gerilme (3.2.1.2 / 3.2.1.3, PDF s.97)
- Kayma: **τa = σa / √3**
- Bileşik yükleme (von Mises eşdeğer gerilmesi):
  **σcp = ( σx² + σy² − σx·σy + 3·τxy² )^0,5 ≤ σa**  (ayrıca σx ≤ σa, σy ≤ σa, τxy ≤ τa)
- Özel hal (çekme/basınç + kayma): **(σ² + 3·τ²)^0,5 ≤ σa**
- Maksimum değerlerin birlikte alınması konservatiftir; daha hassas hesap için üç kombinasyon (σx max ile karşılık gelenler; σy max ile; τxy max ile) ayrı ayrı kontrol edilir.

### 5.2.3 Perçinli birleşimler (3.2.2.1, PDF s.98–99)
- Tek tesirli kesme: τ ≤ 0,6·σa; çift/çok tesirli: τ ≤ 0,8·σa
- Çekme: σ ≤ 0,2·σa (çekmeye çalışan perçinden kaçınılmalı)
- Ezilme (bearing): σn ≤ 1,5·σa (tek tesirli); σn ≤ 2·σa (çift tesirli)
- Her birleşimde kuvvet doğrultusunda en az 2 perçin.

### 5.2.4 Cıvatalı birleşimler (3.2.2.2, PDF s.99–106)
**Kontrollü sıkmalı çekme cıvataları (3.2.2.2.1):** Ön sıkma sırasında çekme+burulma bileşik gerilmesi σb = (σp² + 3τb²)^0,5 ≤ 0,8·σE. Tolerans faktörü Ω = 1,1. Emniyet katsayıları Tablo T.3.2.2.2 (PDF s.101):

| | Case I | Case II | Case III |
|---|---|---|---|
| κ' (elastik limite karşı) | 1,50 | 1,33 | 1,1 |
| κ'' (ayrılmaya karşı) | 1,3 | 1,0 | 1,0 |

Yorulma kontrolü yalnız Case I yükleriyle: σ1 = F1/Sb ≤ 2·σA/δb (σA: grafikten, ISO cıvata 8.8/10.9/12.9).

**Birleşim düzlemine paralel kuvvetler (3.2.2.2.2):** Alın (fitted) cıvatalar perçin değerleriyle; siyah cıvatalar yalnız tali birleşimlerde, yorulmada yasak. Çekme+kesme: σ ≤ 0,65·σa; τ ≤ 0,6·σa (tek) / 0,8·σa (çift); (σ² + 3τ²)^0,5 ≤ σa. Cıvata izin gerilmesi: σa = 0,7·σE(0,2) (normal) veya 0,8·σE(0,2) (diş sıyrılması engellenmiş).

**HS (yüksek mukavemetli) ön germeli cıvatalar:** sürtünmeyle aktarılan izin verilen yük:
**Ta = m · (µ · F) / νT** ; νT = 1,5 / 1,33 / 1,1 (Case I/II/III); m: sürtünme yüzeyi sayısı.
Bileşik: T = µ·(F − N)·m / νT. Çekme elemanlarında net kesit kontrolü: tek sıra cıvatada brüt kesitte tam yük + net kesitte yükün %60'ı; çok sıralıda ilk sıra %60 kuralı.

**Appendix A-3.2.2.2.2.3 (PDF s.113–116):** Sürtünme katsayıları Tablo T.A.3.2.2.2.2.3.1:

| Malzeme | Normal hazırlık (yağ alma+fırça) | Özel hazırlık (kumlama/alevle temizleme) |
|---|---|---|
| E-24 (A.37) Fe 360 | 0,30 | 0,50 |
| E-26 (A.42) | 0,30 | 0,50 |
| E-36 (A.52) Fe 510 | 0,30 | 0,55 |

Sıkma momenti: **Ma = 1,10 · C · d · F** (Nm; d: mm; F: kN; metrik diş, hafif yağlı: C = 0,18). Cıvata σR şartı: σE<700 → σR>1,15σE; 700–850 → >1,12σE; >850 → >1,10σE. Delik çapı ≤ cıvata çapı + 2 mm. Tablo T.A.3.2.2.2.2.3.2: σE=900 N/mm² cıvatalar için çap (10–27 mm) başına sıkma kuvvetleri/momentleri ve Case I/II/III iletilebilir kuvvetler (örn. M20: kesit 245 mm², sıkma 176 kN, tork 697 Nm; µ=0,30 Case I 35,2 kN; µ=0,50 Case I 58,5 kN).

### 5.2.5 Kaynaklı birleşimler (3.2.2.3, PDF s.106–107)
Boyuna çekme/basınçta σa (3.2.1.1) geçerli; kaynakta kayma: **τa = σa/√2**. Kaynak eşdeğer gerilmesi (A-3.2.2.3): σcp = (σ² + 2τ²)^0,5; iki eksenli: σcp = (σx² + σy² − σxσy + 2τxy²)^0,5.

**Tablo T.3.2.2.3 (PDF s.107)** — Kaynaklarda izin verilen maksimum eşdeğer gerilmeler (N/mm²):

| Yükleme tipi | A.37 I | A.37 II | A.37 III | A.42 I | A.42 II | A.42 III | A.52 I | A.52 II | A.52 III |
|---|---|---|---|---|---|---|---|---|---|
| Boyuna eşdeğer gerilme (tüm kaynak tipleri) | 160 | 180 | 215 | 175 | 195 | 240 | 240 | 270 | 325 |
| Enine çekme — küt kaynak ve özel kalite K kaynağı | 160 | 180 | 215 | 175 | 195 | 240 | 240 | 270 | 325 |
| Enine çekme — normal kalite K kaynağı | 140 | 158 | 185 | 153 | 170 | 210 | 210 | 236 | 285 |
| Enine çekme — köşe (fillet) kaynak | 113 | 127 | 152 | 124 | 138 | 170 | 170 | 191 | 230 |
| Enine basınç — küt ve K kaynak | 160 | 180 | 215 | 175 | 195 | 240 | 240 | 270 | 325 |
| Enine basınç — köşe kaynak | 130 | 146 | 175 | 142 | 158 | 195 | 195 | 220 | 265 |
| Kayma (tüm kaynak tipleri) | 113 | 127 | 152 | 124 | 138 | 170 | 170 | 191 | 230 |

## 5.3 Crippling (kolon flambajı) kontrolü (3.3 + A-3.3, PDF s.108, 119–123)
İlke: elastik limitteki aynı emniyet payı; kritik crippling gerilmesi 1,5 / 1,33 / 1,1'e bölünür. Pratik yöntem: hesaplanan gerilme, narinlik oranı λ'ya bağlı **ω katsayısı** ile çarpılır ve T.3.2.1.1 değerleriyle karşılaştırılır.
- Etkili boy: iki ucu mafsallı = mafsallar arası boy; bir ucu ankastre-bir ucu serbest = 2×boy; düğüm noktaları arası basınç çubukları mafsallı kabul edilir.
- Eksantrik/bileşik eğilme+basınç: F/S + Mf·v/I ≤ σa **ve** ω·F/S + 0,9·Mf·v/I ≤ σa (ya da deformasyonlu kesin hesap).
- ω tabloları: T.A.3.3.1 (St 37 hadde profil: λ=20→1,04; 50→1,21; 100→1,90; 150→3,80; 200→6,75; 250→10,55), T.A.3.3.2 (St 52 hadde: λ=20→1,06; 50→1,28; 100→2,53; 150→5,70; 200→10,13; 250→15,83), T.A.3.3.3 (St 37 boru: λ=20→1,00; 100→1,70; λ>115 için T.A.3.3.1), T.A.3.3.4 (St 52 boru: λ=20→1,02; 90→2,05; λ>90 için T.A.3.3.2). Boru tabloları D ≥ 6t şartıyla geçerli.

## 5.4 Buckling (plaka burkulması) kontrolü (3.4, PDF s.109)
Hesaplanan gerilme ≤ kritik burkulma gerilmesi / νV:

| Durum | Case | νV |
|---|---|---|
| Düzlem elemanların burkulması | I | 1,70 + 0,175·(ψ − 1) |
| | II | 1,50 + 0,125·(ψ − 1) |
| | III | 1,35 + 0,075·(ψ − 1) |
| Eğri elemanlar; dairesel silindirler (borular) | I | 1,70 |
| | II | 1,50 |
| | III | 1,35 |

ψ: plaka kenarlarındaki gerilme oranı, +1 ile −1 arasında değişir.

## 5.5 Büyük deformasyonlu yapılar (3.5, PDF s.110)
Gerilme-kuvvet orantısızlığı halinde (örn. vinç kolonu): önce 3.2/3.3/3.4 kontrolleri; sonra yükler ν ile çarpılıp artan deformasyonlarla σ ≤ σcr kontrolü. Pratik:
1) SG ve Sv zıt yönde deformasyon veriyorsa: σ(SG + ν·Sv) ≤ σcr
2) Aynı yönde ise: ν' = 1 + (ν − 1)·r; r = σG/(σG + σV); σ(ν'·SG + ν·Sv) ≤ σcr

## 5.6 Yorulma kontrolü (3.6, PDF s.111–112)
Parametreler: (1) konvansiyonel çevrim sayısı ve gerilme spektrumu → yalnız komponent grubu (E1–E8, madde 2.1.4) üzerinden dikkate alınır; (2) malzeme ve çentik etkisi (notch effect, Appendix A-3.6); (3) maksimum gerilme σmax; (4) uç gerilmeler oranı κ.
- **σmax (3.6.3)**: Case I yüklemesinde (γc **uygulanmadan**) oluşan mutlak değerce en büyük gerilme. Basınçta yorulma kontrolünde ω uygulanmaz.
- **κ (3.6.4)**: κ = σmin/σmax (kaymada τmin/τmax); −1 ≤ κ ≤ +1; aynı işaretli (fluctuating) → pozitif, zıt işaretli (alternating) → negatif.
- **Kontrol (3.6.5)**: σmax ≤ izin verilen yorulma gerilmesi. İzin verilen yorulma gerilmesi = %90 sağkalım (survival) gerilmesi × emniyet katsayısı 4/3'ün tersi: **σa(yorulma) = 0,75 · σ(%90 sağkalım)**.

### 5.6.1 Appendix A-3.6 — Yapısal elemanların yorulma doğrulaması (PDF s.131–151)
**Konstrüksiyon (çentik) sınıfları:**
- Kaynaksız parçalar: **W0** (çentiksiz ana malzeme), **W1** (delinmiş parçalar; perçin/cıvata %20'ye kadar yüklü veya HS cıvatalı %100), **W2** (W2.1 çok tesirli kesmeli, W2.2 tek tesirli desteksiz, W2.3 tek tesirli destekli/kılavuzlu delikli parçalar)
- Kaynaklı parçalar: çentik şiddeti artan sırayla **K0, K1, K2, K3, K4** (K0: hafif; K1: orta; K2: orta-şiddetli; K3: şiddetli; K4: çok şiddetli gerilme yığılması). Kaynak kaliteleri: özel kalite (S.Q.) / normal kalite (O.Q.); muayene sembolleri P100 (%100 kontrol, örn. röntgen), P10 (≥%10 rastgele; hesaplanan gerilme izin verilenin %80'ini aşarsa P100), D (laminasyon kontrolü). Örnek sınıflamalar: köşe kaynak boyuna çekmede K0 (ref 0,31), boyuna kaymada K0 (0,51); enine çekmede K3 (3,2) veya K4 (4,4); alın kaynağı S.Q. enine K0 (0,1), O.Q. enine K1 (1,1); haç birleşim K kaynak S.Q. K2 (2,4), O.Q. K3 (3,4), köşe kaynak O.Q. K4 (4,4).

**Tablo T.A.3.6.1 (PDF s.133)** — σW değerleri (N/mm²), κ = −1 alternatif gerilme, %90 sağkalım + 4/3 emniyet:

| Grup | W0 (St37/St44) | W0 (St52) | W1 (St37/St44) | W1 (St52) | W2 (St37/St44) | W2 (St52) | K0 | K1 | K2 | K3 | K4 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E1 | 249,1 | 298,0 | 211,7 | 253,3 | 174,4 | 208,6 | (361,9) | (323,1) | (271,4) | 193,9 | 116,3 |
| E2 | 224,4 | 261,7 | 190,7 | 222,4 | 157,1 | 183,2 | (293,8) | 262,3 | 220,3 | 157,4 | 94,4 |
| E3 | 202,2 | 229,8 | 171,8 | 195,3 | 141,5 | 160,8 | 238,4 | 212,9 | 178,8 | 127,7 | 76,6 |
| E4 | 182,1 | 201,8 | 154,8 | 171,5 | 127,5 | 141,2 | 193,5 | 172,8 | 145,1 | 103,7 | 62,2 |
| E5 | 164,1 | 177,2 | 139,5 | 150,6 | 114,9 | 124,0 | 157,1 | 140,3 | 117,8 | 84,2 | 50,5 |
| E6 | 147,8 | 155,6 | 125,7 | 132,3 | 103,5 | 108,9 | 127,5 | 113,8 | 95,6 | 68,3 | 41,0 |
| E7 | 133,2 | 136,6 | 113,2 | 116,2 | 93,2 | 95,7 | 103,5 | 92,4 | 77,6 | 55,4 | 33,3 |
| E8 | 120,0 | 120,0 | 102,0 | 102,0 | 84,0 | 84,0 | 84,0 | 75,0 | 63,0 | 45,0 | 27,0 |

- Kaynaklı parçalarda (K0–K4) σW değerleri üç çelik tipi (St 37, St 44, St 52) için aynıdır; kaynaksız parçalarda St 37 = St 44, St 52 daha yüksektir.
- Parantezli değerler 0,75·σR'yi aşan salt teorik değerlerdir (yalnız formül (5) bileşik yük kontrolünde kullanılır).

**İzin verilen yorulma gerilmesi formülleri (PDF s.133–134):**
- κ ≤ 0:
  - çekme: **σt = 5·σw / (3 − 2·κ)**  (1)
  - basınç: **σc = 2·σw / (1 − κ)**  (2)
- κ > 0:
  - çekme: **σt = σ0 / [ 1 − κ·(1 − σ0/σ+1) ]**  (3), burada σ0 = σt(κ=0) = 5·σw/3 = **1,66·σw**; **σ+1 = 0,75·σR**
  - basınç: **σc = 1,2·σt**  (4)
- Her durumda σt ≤ 0,75·σR ile sınırlıdır. (Elastik limit izin gerilmesi de ayrıca tavandır — örnek şekilde A.52 için 240 N/mm² tavanı.)

**Kayma (malzemede):** τa = σt(W0 durumu) / √3.

**Bileşik yorulma yükleri:** κx = σx min/σx max, κy = σy min/σy max, κxy = τxy min/τxy max ile σxa, σya, τxya ayrı ayrı bulunur; σx max < σxa, σy max < σya, τxy max < τxya kontrol edilir; ayrıca:

**(σx max/σxa)² + (σy max/σya)² − σx max·σy max/(|σxa|·|σya|) + (τxy max/τxya)² ≤ 1**  (5)

(Ağır bir koşul olduğundan karekökü ≤ 1,05 olan hafif aşımlar kabul edilebilir.) Tablo T.A.3.6.2 (PDF s.137): σx max/σxa ve σy max/σya'ya karşı izin verilen τxy max/τxya değerleri (örn. 0/0 → 1,000; 1,0/1,0 → 0).

**Birleşim araçlarının yorulması (PDF s.139):**
- Kaynaklar — çekme/basınç: birleştirilen metalin izin gerilmeleri; kayma: **K0 çekme değerinin √2'ye bölümü**; bileşik: yapı elemanları yöntemi.
- Cıvata/perçin — çekme yorulması dikkate alınmaz (çekmeden kaçınılmalı); kesme yorulması: W2 çekme izin değerinin **0,6 katı (tek tesirli)**, **0,8 katı (çok tesirli)**; ezilme: kesme izin değerinin **2,5 katı**.

**Örnek hesaplar (PDF s.152–157):** St 37 köprülü vinç kirişi başlık-gövde kaynağı; E4 grubu köşe kaynak (O.Q.) ve E6 grubu K kaynak (S.Q.) için elastik limit + yorulma kombinasyon kontrolleri (formül (5) ile 0,672 / 0,571 / 0,495 / 0,472 < 1 sonuçları).

---

# 6. APPENDIX A-3.4 — PLAKA BURKULMASI (PLATE BUCKLING) (PDF s.124–130)

## Euler referans gerilmesi
**σE_R = π²·E·(e/b)² / [12·(1 − η²)]**
E = 210 000 N/mm², Poisson η = 0,3 için:

**σE_R = 189 800 · (e/b)²**  [N/mm²]

(e: şerit/plaka kalınlığı — görev metnindeki "t"; b: basınç kuvvetlerine dik plaka genişliği.)

## Kritik burkulma gerilmeleri
- Basınç: **σv_cr = Kσ · σE_R**
- Kayma: **τv_cr = Kτ · σE_R**
Kσ ve Kτ (buckling coefficients) şunlara bağlıdır: kenar oranı α = a/b; kenar mesnet biçimi; düzlem içi yükleme tipi; berkitmeler (stiffeners).

## Tablo T.A.3.4.1 — Dört kenarı mesnetli plakalar için Kσ, Kτ (PDF s.126)

| No | Durum | α = a/b | Kσ veya Kτ |
|---|---|---|---|
| 1 | Basit üniform basınç | α ≥ 1 | Kσ = 4 |
| | | α ≤ 1 | Kσ = (α + 1/α)² |
| 2 | Üniform olmayan basınç (0 ≤ ψ < 1) | α ≥ 1 | Kσ = 8,4 / (ψ + 1,1) |
| | | α ≤ 1 | Kσ = 2,1·(α + 1/α)² / (ψ + 1,1) |
| 3 | Saf eğilme (ψ = −1) veya çekme baskın eğilme | α ≥ 2/3 | Kσ = 23,9 |
| | | α ≤ 2/3 | Kσ = 15,87 + 1,87/α² + 8,6·α² |
| 4 | Basınç baskın eğilme (−1 < ψ < 0) | — | Kσ = (1 + ψ)·K' − ψ·K'' + 10·ψ·(1 + ψ) ; K' = ψ=0 için durum 2 değeri, K'' = saf eğilme (durum 3) değeri |
| 5 | Saf kayma | α ≥ 1 | Kτ = 5,34 + 4/α² |
| | | α ≤ 1 | Kτ = 4 + 5,34/α² |

## Bileşik basınç + kayma (PDF s.125)
Kritik karşılaştırma gerilmesi:

**σv_cr.c = (σ² + 3τ²)^0,5 / { [(1 + ψ)/4]·(σ/σv_cr) + { [0,25·(3 − ψ)·(σ/σv_cr)]² + [τ/τv_cr]² }^0,5 }**

*(Döküm bu formülde parantezleri bozuk aktarmış; s.128'deki sayısal örnek — κσ=18,88, σE_R=8,4, σv_cr=158,6, κτ=11,75, τv_cr=99, σ=28, τ=47, ψ=−0,79 → σv_cr.c=168 N/mm² — yukarıdaki kurulumla (ikinci terim içinde iki karenin toplamının karekökü) tutarlıdır; standart FEM formülü de budur.)*

## Orantı sınırı ve ρ azaltması — Tablo T.A.3.4.2 (PDF s.125–126)
Formüller yalnız orantı sınırının (limit of proportionality) altında geçerlidir: **A.37 için 190 N/mm², A.52 için 290 N/mm²** (kaymada √3·τv_cr sınırın altında olmalı). Üzerindeyse hesaplanan kritik değer ρ ile azaltılır:

**St 37 (Fe 360):**

| σv_cr hesaplanan | τv_cr hesaplanan | ρ | σv_cr azaltılmış | τv_cr azaltılmış |
|---|---|---|---|---|
| 190 | 110 | 1,00 | 190 | 110 |
| 200 | 116 | 0,97 | 194 | 113 |
| 210 | 121 | 0,94 | 197 | 114 |
| 220 | 127 | 0,91 | 200 | 116 |
| 230 | 133 | 0,88 | 202 | 117 |
| 240 | 139 | 0,85 | 204 | 118 |
| 250 | 145 | 0,82 | 206 | 119 |
| 260 | 150 | 0,80 | 208 | 120 |
| 280 | 162 | 0,76 | 212 | 122 |
| 300 | 173 | 0,72 | 215 | 124 |
| 340 | 197 | 0,65 | 221 | 128 |

**St 52 (Fe 510):**

| σv_cr hesaplanan | τv_cr hesaplanan | ρ | σv_cr azaltılmış | τv_cr azaltılmış |
|---|---|---|---|---|
| 290 | 168 | 1,00 | 290 | 168 |
| 300 | 173 | 0,98 | 294 | 169 |
| 310 | 179 | 0,96 | 297 | 172 |
| 320 | 185 | 0,94 | 300 | 174 |
| 330 | 191 | 0,92 | 303 | 175 |
| 340 | 196 | 0,90 | 306 | 176 |
| 350 | 202 | 0,88 | 308 | 177 |
| 360 | 208 | 0,86 | 309 | 178 |
| 380 | 220 | 0,82 | 312 | 180 |
| 400 | 231 | 0,79 | 316 | 182 |
| 440 | 254 | 0,73 | 322 | 185 |

## İzin verilen burkulma gerilmesi (PDF s.127)
İzin verilen gerilme = kritik gerilme / νV (madde 3.4 katsayıları). Bileşik halde σv_cr.c, 3.2.1.3'teki σcp = (σ² + 3τ²)^0,5 ile karşılaştırılır.

**Sayısal örnek (PDF s.127–129):** St 37, açıklık 10 m, kiriş yüksekliği 1,50 m, gövde 10 mm, berkitme aralığı 1,25 m, q=162 kN/m: σ1=−28, σ2=+22, τ=47 N/mm²; ψ=−0,79; α=0,83; K'=7,90; K''=23,9; Kσ=18,88; σE_R=189 800·(10/1500)²=8,4; σv_cr=158,6; Kτ=11,75; τv_cr=99; σv_cr.c=168 N/mm². Karşılaştırma gerilmesi (σ²+3τ²)^0,5=86 < 168/1,4=120 N/mm² (Case I, νV=1,70+0,175·(−0,79−1)≈1,4) → uygun.

## İnce cidarlı dairesel silindirler (PDF s.129–130)
Lokal burkulma kontrolü gerekli koşul: **t/r ≤ 25·σE/E** (t: cidar kalınlığı; r: cidar ortası yarıçapı).
İdeal burkulma gerilmesi: **σv_i = 0,2·E·(t/r)**
σv_i orantı sınırını aşarsa ρ faktörü ile σv'ye indirgenir. Enine berkitmeler en fazla **10·r** aralıkla konulmalı; berkitme atalet momenti en az:
**I = 0,5 · r · t³ / (r/t)^0,5**  *(dökümdeki ifade; [formülün üs düzeni dökümden %100 kesin çıkarılamadı])*
Eksantrik berkitme için: I = I1 + I2 + F1·e1² + F2·e2². Bu hesabın, t/2'ye kadar yerel imalat kusurlarından doğan geometrik sapmaları kapsadığı kabul edilir.

---

# 7. DİĞER ÖNEMLİ APPENDIX'LER

## A.2.1.1 — Aparey ve mekanizma kullanım sınıflarının harmonizasyonu (PDF s.63–67)
- Aparey toplam kullanım süresi: **T = N · tmc / 3600** (saat; N: kaldırma çevrimi sayısı, tmc: ortalama çevrim süresi s). U0/U1/U2 için N, 15 625 / 31 250 / 62 500'e ayarlanır.
- Mekanizma süresi: Ti = αi · T; αi = mekanizmanın bir çevrimdeki kullanım süresi / tmc.
- Tablo T.A.2.1.1.1: tmc = 30–480 s ve U0–U9 için T değerleri (örn. U5, tmc=150 s → T = 20 835 h).
- Tablo T.A.2.1.1.2: T ve αi (1,00 / 0,63 / 0,40 / 0,25 / 0,16 / 0,10) → Ti ve mekanizma kullanım sınıfı (T0–T9).
- Örnek (PDF s.67): rıhtım vinci U5, tmc=150 s → T=20 835 h; kaldırma αi=0,63 → Ti=13 126 h → **T7**; dönme αi=0,25 → 5 209 h → **T5**; yürütme αi=0,10 → 2 084 h → **T4**.

## A.2.2.3 — Yatay hareket ivme yüklerinin hesabı (dinamik katsayı ψh) (PDF s.68–84)
Yöntem (Part 1):
- Eşdeğer kütle: m = m0 + Σ(Ii·wi²/v²); dönme hareketi için m·v² = I·ω²; bom kaldırmada m·v² = 2T (T: kinetik enerji).
- Ortalama ivme: **Jm = F / (m + m1)**; süre: Tm = v/Jm; yükün ortalama atalet kuvveti: **Fcm = m1·Jm**.
- Sarkaç periyodu: **T1 = 2π·(l/g)^0,5** (l: en üst konumda askı boyu; l < 2,00 m alınmaz). Örnek: l=2→T1=2,84 s; l=8→5,67 s.
- Parametreler: **µ = m1/m** (regüle ivmeli sistemlerde µ=0), **β = Tm/T1**; ψh, Şekil A.2.2.1 grafiğinden.
- Yapı hesabında kullanılacak atalet kuvvetleri: yükten gelen = **ψh·Fcm**; yük dışındaki hareketli parçalar = ortalama atalet kuvvetlerinin **2 katı** (yapı için ψh = 2; ancak düşük hızlı, tekerlek kayan çok kısa frenlemelerde istisna olabilir).
- Teorik sonuçlar (Part 2): µ < 1 için ψh ≤ 2 (β ≥ βcrit ise ψh = 2, koşul ωr·td ≥ π); µ > 1 için maksimum **ψh = (2 + µ + 1/µ)^0,5**; regüle sistem: ψh = 2·sin(β·π) (β ≤ 0,5), ψh = 2 (β > 0,5).

## A-3.2.2.3 — Kaynaklı birleşimlerde gerilmeler (PDF s.117–118)
Bkz. §5.2.5. Ek notlar: kaynak yüzeyinin taşlanması dayanımı belirgin iyileştirir; birleşim tasarımından doğan gerilme yığılmaları ve artık gerilmeler ayrıca dikkate alınmaz; köşe kaynakta kesit genişliği = boğaz derinliği, boy = etkin boy − uç kraterleri; yorulma kırılmaları genelde kaynak dikişinde değil bitişik ana metalde oluşur; kaynağın kendisi için bitişik ana metalle aynı yükleri iletebilmesi yeterli sayılır.

## A-3.3 — Crippling ω tabloları (PDF s.119–123)
Bkz. §5.3. Ulusal yöntemlere atıf: DIN 4114 (Almanya), NBN 1 (Belçika), CM 1966 (Fransa), BS 2573 (İngiltere).

---

## NOTLAR / UYARILAR
1. Görevde "Tablo T.2.3.1" olarak anılan γc tablosu metinde **T.2.3.4**'tür; "Tablo T.2.2.2.1.1" olarak anılan ψ verisi metinde **Şekil (Figure) 2.2.2.1.1**'dir; mekanizma grup rehberi **T.2.1.3.5** (görevdeki "T.2.1.3.5.1" değil).
2. S235/S355 karşılıkları: metin E.24/A.37/Fe 360 (σE=240) ve E.36/A.52/Fe 510 (σE=360) adlarını kullanır; günümüz S235/S355 eşdeğerleridir (metinde S235/S355 adları geçmez).
3. Döküm kalitesinden ötürü "[emin değilim]" işaretli yerler: T.2.1.4.4'te B2/P4 hücresi; T.2.2.4.1.4.1'de hadde/kutu profil alt satır eşleşmesi; T.3.1.3'te "5" değerinin anlamı; silindir berkitme atalet formülünün üs düzeni; σv_cr.c formülünün parantez yapısı (sayısal örnekle doğrulanmış kurulum verilmiştir).
4. Metinde geçmeyen, dolayısıyla bu rapora alınmayan hususlar: skewing için ayrıntılı DIN-tipi çarpık yürüyüş hesabı (FEM 1.001'de yalnız λ katsayılı basit yöntem, madde 2.2.3.3 vardır).


---

# FEM 1.001 3rd Edition Revised (1998) — Bölüm B Analizi
## Booklet 4 (Yorulma Kontrolü ve Mekanizma Eleman Seçimi), Booklet 8 (Test Yükleri ve Toleranslar), Booklet 9 (Ekler/Değişiklikler)

Kaynak: `fem.txt` — Booklet 4: PDF sayfa 158–196; Booklet 8: PDF sayfa 258–269; Booklet 9: PDF sayfa 270–312.

---

## 1. BOOKLET 4 MADDE HARİTASI (PDF s.159–160)

| Madde | Başlık (İngilizce) | PDF sayfa |
|---|---|---|
| 4.1. | Calculation procedure (Hesap prosedürü) | 161 |
| 4.1.1. | Checking for ultimate strength (Kopma mukavemeti kontrolü) | 161 |
| 4.1.1.1. | Value of the permissible stress | 161 |
| 4.1.1.2. | Values of the coefficient νR | 162 |
| 4.1.1.3. | Relations between calculated and permissible stresses | 162 |
| 4.1.2. | Checking for crippling (Burkulma/ezilme kontrolü) | 163 |
| 4.1.3. | Checking for fatigue (Yorulma kontrolü) | 163 |
| 4.1.3.1. | General method | 163 |
| 4.1.3.2. | Endurance limit under alternating loading of a polished specimen | 164 |
| 4.1.3.3. | Influence of shape, size, surface condition and corrosion | 165 |
| 4.1.3.4. | Endurance limit as a function of κ, σR and σwk (SMITH diyagramı) | 165–166 |
| 4.1.3.5. | Wöhler curve | 167–168 |
| 4.1.3.6. | Fatigue strength of a mechanical component | 169 |
| 4.1.3.7. | Permissible stresses and calculations | 169–171 |
| 4.1.4. | Checking for wear (Aşınma kontrolü) | 171 |
| 4.2. | Design calculations for particular components | 172 |
| 4.2.1. | Choice of anti-friction bearings (Rulman seçimi) | 172–173 |
| 4.2.2. | Choice of ropes (Halat seçimi) | 173–177 |
| 4.2.3. | Choice of pulleys, drums and rope attachment means | 177–179 |
| 4.2.4. | Choice of rail wheels (Teker seçimi) | 179–184 |
| 4.2.5. | Design of gears (Dişli hesabı) | 184 |
| Appendix A-4.1.3. | Yorulmada izin verilen gerilmelerin tayini (ks, kd, ku, kc + örnek) | 185–190 |
| Appendix A-4.2.2. | Halat seçimi ve emniyet katsayısı problemi üzerine yorumlar | 191–194 |
| Appendix A-4.2.3. | Minimum sarım çaplarının tayini üzerine düşünceler | 195–196 |

---

## 2. MEKANİZMA YORULMA / MUKAVEMET KONTROLÜ (4.1.x) (PDF s.161–171)

### 2.1. Kopma mukavemeti kontrolü (madde 4.1.1, PDF s.161–162)

İzin verilen gerilme (madde 4.1.1.1):

```
σa = σR / νR
```
- σR: malzemenin kopma (ultimate) gerilmesi
- νR: yükleme haline (loading case, bkz. madde 2.3) bağlı emniyet katsayısı

**Tablo T.4.1.1.2 — νR değerleri (madde 4.1.1.2, PDF s.162):**

| Yükleme hali (Case of loading) | νR |
|---|---|
| I ve II | 2,2 |
| III | 1,8 |

Gri dökme demirde (grey cast iron) νR değerleri %25 artırılır.

**Hesaplanan/izin verilen gerilme ilişkileri (madde 4.1.1.3, PDF s.162):**

| No | Yükleme tipi | Koşul |
|---|---|---|
| 1 | Saf çekme | 1,25·σt ≤ σa |
| 2 | Saf basma | σc ≤ σa |
| 3 | Saf eğilme | σf ≤ σa |
| 4 | Eğilme + çekme | 1,25·σt + σf ≤ σa |
| 5 | Eğilme + basma | σc + σf ≤ σa |
| 6 | Saf kayma | 3^0,5·τ ≤ σa |
| 7 | Çekme + eğilme + kayma | [(1,25·σt + σf)² + 3τ²]^0,5 ≤ σa |
| 8 | Basma + eğilme + kayma | [(σc + σf)² + 3τ²]^0,5 ≤ σa |

### 2.2. Crippling kontrolü (madde 4.1.2, PDF s.163)
Booklet 3 madde 3.3'e göre yapılır; mekanizma grubuna bağlı γm katsayısı (Tablo T.2.6) kullanılır.

### 2.3. Yorulma kontrolü (madde 4.1.3, PDF s.163–171)

**Genel yöntem (4.1.3.1):**
- Yorulma kontrolü **sadece yükleme hali I (case I)** için yapılır.
- Gerilme çevrim sayısı (number of stress cycles) **n < 8 000** ise yorulma kontrolü **gerekmez**.
- Yöntem: parlatılmış numunenin alternatif yüklemedeki dayanım sınırından (κ = −1) başlanır → şekil/boyut/yüzey/korozyon faktörleri → SMITH diyagramı ile κ oranına göre dayanım → WÖHLER eğrisi → PALMGREN-MINER hasar birikim hipotezi ile bileşen grubuna (E1…E8) göre yorulma dayanımı.
- Yöntem, kesitte homojen malzeme yapısı olan bileşenlere uygulanır; yüzey işlemi görmüş (sertleştirme, nitrürleme, sementasyon) parçalara doğrudan uygulanamaz.

**Parlatılmış numune dayanım sınırı (4.1.3.2, PDF s.164–165):**
- σbw: dönel eğilmede alternatif dayanım sınırı.
- Eksenel çekme-basma için σbw değerleri **%20 azaltılır**.
- Kaymada: `τw = σbw / 3^0,5`
- Yaygın karbon çelikleri için: `σbw = 0,5 · σR` (σR: minimum kopma dayanımı; değerler istatistiksel olarak %90 hayatta kalma olasılığına karşılık gelir).

**Şekil, boyut, yüzey, korozyon etkisi (4.1.3.3, PDF s.165):**
```
σwk = σbw / (ks · kd · ku · kc)      τwk = τw / (ks · kd · ku · kc)
```
Saf kaymada: τwk = τw. (ks: şekil, kd: boyut, ku: yüzey işleme, kc: korozyon; hepsi ≥ 1; değerleri Appendix A-4.1.3'te.)

**SMITH diyagramı ilişkileri (4.1.3.4, PDF s.165–166):**

Normal gerilmeler:
- −1 ≤ κ < 0 (alternatif): `σd = 5·σwk / (3 − 2κ)`
- 0 ≤ κ < 1 (pulsatif): `σd = (5·σwk/3) / {1 − [(1 − 5·σwk/(3·σR))·κ]}`

Kayma gerilmeleri:
- −1 ≤ κ < 0: `τd = 5·τwk / (3 − 2κ)`
- 0 ≤ κ < 1: `τd = (5·τwk/3) / {1 − [(1 − 5·3^0,5·τwk/(3·σR))·κ]}`

**Wöhler eğrisi (4.1.3.5, PDF s.167–168):**
- n = 8·10³ için: σ = σR (veya τ = σR/3^0,5)
- 8·10³ ≤ n ≤ 2·10⁶ (sınırlı dayanım bölgesi): log-log eksende TD doğrusu; eğim faktörü:
  `c = tanφ = [log(2·10⁶) − log(8·10³)] / (log σR − log σd)`
- n = 2·10⁶ için: σ = σd
- n > 2·10⁶: DN doğrusu (TD uzantısı ile yatayın açıortayı); eğim: `c' = c + (c² + 1)^0,5`
- **c < 2,5 hatalı tasarım işaretidir; böyle bir bileşen servise alınmamalıdır.**
- Spektrum faktörü ksp bu c değeri ile belirlenir; E8 grubu bazı bileşenlerde c yerine c' ile hesaplanır (k'sp).

**Bileşen yorulma dayanımı (4.1.3.6, PDF s.169):**
```
σk = 2^[(8−j)/c] · σd        τk = 2^[(8−j)/c] · τd
```
j: bileşenin grup numarası (E1…E8 → j = 1…8).

E8 grubunda n·k'sp > 2·10⁶ ise:
```
σk = [(2·10⁶/n)·(1/k'sp)]^(1/c') · σd
```

**İzin verilen gerilmeler (4.1.3.7, PDF s.169–171):**
```
νk = 3,2^(1/c)        (E8 özel durumunda: νk = 3,2^(1/c'))
σaf = σk / νk         τaf = τk / νk
Kontrol: σ ≤ σaf ,  τ ≤ τaf
```
Farklı κ oranlı eşzamanlı normal + kayma gerilmeleri için birleşik koşul:
```
(σx/σkx)² + (σy/σky)² − σx·σy/(σkx·σky) + (τ/τk)² ≤ 1,1 / νk²
```
Not: Bu kontroller gevrek kırılmaya (brittle fracture) karşı güvenceyi kapsamaz; o ancak uygun malzeme kalitesi seçimiyle sağlanır.

**Appendix A-4.1.3 katsayı verileri (PDF s.185–187):**

Tablo T.A.4.1.3.1 — D/d ≤ 2 için düzeltme faktörü q (ks eğrisi (r/d)+q ile okunur):

| D/d | 1,05 | 1,1 | 1,2 | 1,3 | 1,4 | 1,6 | 2 |
|---|---|---|---|---|---|---|---|
| q | 0,13 | 0,1 | 0,07 | 0,052 | 0,04 | 0,022 | 0 |

Tablo T.A.4.1.3.2 — Boyut katsayısı kd (metin çıkarımı bozuk; yapı bağlamdan kuruldu, örnekte d=50 → kd=1,45 doğrulanmıştır):

| d (mm) | 10 | 20 | 30 | 50 | 100 | 200 | 400 |
|---|---|---|---|---|---|---|---|
| kd | 1 | 1,1 | 1,25 | 1,45 | 1,65 | 1,75 | 1,8 |

*(Ham metin: "d mm 10 20 30 50 10 02 0 0 400 / kd 11 ,1 1,25 1,45 1,65 1,75 1,8" — 100/200 sütunları ve kd=1/1,1 ayrımı bağlamdan; emin olunamayan kısım budur.)*

ku (yüzey işleme) ve kc (korozyon) Figür A.4.1.3.2'den okunur (grafik — sayısal tablo metinden çıkarılamadı); örnek uygulamada torna edilmiş yüzey için ku = 1,15 kullanılmıştır (PDF s.188).

**Örnek uygulama (PDF s.188–189):** A-550 çeliği mil, E4 grubu, κ=−1: σbw = 275 N/mm², ks=1,4, kd=1,45, ku=1,15 → σwk = 117,8 N/mm², c = 3,58, σk = 255,4 N/mm², νk = 1,38, σaf = 184,6 N/mm².

---

## 3. HALAT SEÇİMİ (4.2.2) (PDF s.173–177)

**Genel kurallar (4.2.2, PDF s.173–174):**
- Halatlar ISO 2408'e uygun; muayene ISO 4309'a göre.
- Seçim, **kaldırma mekanizmasının grubuna (M1–M8)** göre yapılır.
- Sık sökülen vinçlerde (ör. kule vinçler) bir alt grup seçilebilir, ancak **M3'ten aşağı olamaz**.
- Tehlikeli yük elleçlemede (ergimiş metal, radyoaktif vb.) **bir üst grup** kullanılır; tehlikeli yükler için halat/makara çap seçiminde **minimum grup M5**'tir.

**Maksimum halat çekme kuvveti S (4.2.2.1.1.1, PDF s.174):** SWL + kanca bloğu/aksesuar ağırlıkları + palanga oranı + palanga verimi + (%10'u aşıyorsa) ivme yükleri + (kaldırma ekseniyle açı 22,5°'yi aşıyorsa) halat eğikliği dikkate alınır.

**Grab (kepçe) halatları (4.2.2.1.1.3, PDF s.175):**
- Yük kapama/tutma halatları arasında otomatik eşit paylaşılıyorsa: S = dolu kepçe ağırlığının %66'sı / halat sayısı (her iki halat tipi için).
- Paylaşım otomatik değilse: kapama halatları S = toplam dolu kepçe ağırlığı / kapama halatı sayısı; tutma halatları %66.

### 3.1. Zp yöntemi (4.2.2.1.2, PDF s.175–176)

```
Zp = F0 / S
```
- F0: halatın minimum kopma yükü (minimum breaking load)
- S: maksimum halat çekme kuvveti

**Tablo T.4.2.2.1.2 — Minimum pratik emniyet katsayısı Zp (madde 4.2.2.1.2.1, PDF s.176):**

| Mekanizma grubu | Zp — Hareketli halatlar (running ropes) | Zp — Sabit halatlar (static ropes) |
|---|---|---|
| M1 | 3,15 | 2,5 |
| M2 | 3,35 | 2,5 |
| M3 | 3,55 | 3 |
| M4 | 4 | 3,5 |
| M5 | 4,5 | 4 |
| M6 | 5,6 | 4,5 |
| M7 | 7,1 | 5 |
| M8 | 9 | 5 |

### 3.2. C-faktörü yöntemi (4.2.2.1.3, PDF s.176–177) — yalnız hareketli halatlar

```
C = [ Zp / (π·k·f·RO/4) ]^0,5 = [ Zp / (k'·RO) ]^0,5
d ≥ C · S^0,5      (dmin = C·√S)
```
- k' = (π/4)·f·k (ampirik minimum kopma yükü faktörü)
- f: doldurma faktörü (fill factor), k: örme kaybı faktörü (spinning loss factor)
- RO: halat telinin minimum kopma gerilmesi (1600/1800/2000/2200 N/mm² tellere uygulanır; istisnaen 1400 N/mm² telde çap artırılır — Appendix A-4.2.2, PDF s.193)
- Zp: T.4.2.2.1.2'deki hareketli halat değeri.
- k' değerleri ISO 2408'den alınır veya özel konstrüksiyonda halat imalatçısınca sertifikayla garanti edilir (4.2.2.1.3.2).

---

## 4. TAMBUR VE MAKARA ÇAPLARI (4.2.3) (PDF s.177–179)

### 4.1. Minimum sarım çapı (4.2.3.1)

```
D ≥ H · d
```
- D: halat eksenine ölçülen sarım çapı (winding diameter)
- H: mekanizma grubuna bağlı katsayı
- d: halat nominal çapı

Not: FEM 1.001'de katsayı tek harf **H** ile verilir; tambur/makara/dengeleme makarası için ayrı sütunlar vardır (bazı kaynaklardaki "H1/H2" gösterimi bu standardın metninde yoktur — tabloda üç ayrı sütun kullanılır).

**Tablo T.4.2.3.1.1 — H değerleri (madde 4.2.3.1.1, PDF s.178):**

| Mekanizma grubu | Tambur (Drums) | Makara (Pulleys) | Dengeleme makarası (Compensating pulleys) |
|---|---|---|---|
| M1 | 11,2 | 12,5 | 11,2 |
| M2 | 12,5 | 14 | 12,5 |
| M3 | 14 | 16 | 12,5 |
| M4 | 16 | 18 | 14 |
| M5 | 18 | 20 | 14 |
| M6 | 20 | 22,4 | 16 |
| M7 | 22,4 | 25 | 16 |
| M8 | 25 | 28 | 18 |

Gerekçe (Appendix A-4.2.3, PDF s.195): Makarada H tamburdan büyüktür, çünkü bir çevrimde halat makara üzerinde iki kat fazla eğilme tersinmesi görür (düz-eğik-düz); tamburda tek (düz-eğik). Dengeleme makarasında H daha düşüktür (az tersinme, sınırlı hareket). Ters eğilmeler (reverse bends), çok makaralı donanım ve dönmez halatlar için uygun artırım yapılmalıdır.

**Not (4.2.3.1.2, PDF s.178):** Minimum hesap çapından türetilen tambur/makara çapları korunarak, kullanılan halat çapı hesaplanan minimum çapı **%25'ten fazla aşmamak** ve halat çekişi S değerini geçmemek şartıyla daha büyük halat kullanılabilir.

### 4.2. Yiv dip yarıçapı (4.2.3.2, PDF s.178)
```
r = 0,53 · d
```

### 4.3. Halat bağlantıları ve tamburda kalan sarımlar (4.2.3.3, PDF s.179)
- Halat bağlantıları, kalıcı şekil değiştirmeden **2,5·S** çekme kuvvetine dayanmalıdır.
- Tambura bağlantı: sürtünme + tespit kuvvetleri toplamı **2,5·S**'ye dayanmalı; sürtünme katsayısı **µ = 0,1**.
- Halat tamamen açıldığında, halat ucu bağlantısından önce tamburda **en az 2 tam sarım** kalmalıdır.

### 4.4. "t kat sayısı" hakkında
[metinden çıkarılamadı] — Booklet 4'te tambur üzerine çok katlı sarım (number of layers) için ayrı bir "t" katsayısı/tablosu bulunmamaktadır; metin tek katlı sarım varsayımıyla H katsayılarını verir.

---

## 5. RULMAN ÖMRÜ (4.2.1) ve T.2.1.3.2 İLİŞKİSİ (PDF s.172–173)

**Ön kontroller (4.2.1):** Rulman, (i) I/II/III yükleme hallerinin en elverişsizindeki statik yüke ve (ii) I veya II'nin en elverişsizindeki maksimum dinamik yüke dayanmalıdır.

**Teorik ömür (4.2.1.1):** Rulmanlar, mekanizmanın işletme sınıfına (class of operation) bağlı olarak **Tablo T.2.1.3.2'deki** kabul edilebilir teorik ömrü (saat) sağlayacak şekilde, 4.2.1.2/4.2.1.3'te tanımlanan sabit ortalama yük altında seçilir. Yani gerekli L10h ömrü = mekanizmanın kullanım sınıfına karşılık gelen toplam kullanım süresi:

**Tablo T.2.1.3.2 (Booklet 2, PDF s.31) — Kullanım sınıfları / toplam kullanım süresi T (saat):**

| Sınıf | Toplam kullanım süresi T (h) |
|---|---|
| T0 | T ≤ 200 |
| T1 | 200 < T ≤ 400 |
| T2 | 400 < T ≤ 800 |
| T3 | 800 < T ≤ 1 600 |
| T4 | 1 600 < T ≤ 3 200 |
| T5 | 3 200 < T ≤ 6 300 |
| T6 | 6 300 < T ≤ 12 500 |
| T7 | 12 500 < T ≤ 25 000 |
| T8 | 25 000 < T ≤ 50 000 |
| T9 | 50 000 < T |

(M grubu = T sınıfı × L spektrum sınıfı kombinasyonu, Tablo T.2.1.3.4 — Booklet 2.)

**Eşdeğer ortalama yük — SM tipi yükler (4.2.1.2, PDF s.172):**
Metin: "SM mean, SM max II'nin **spektrum faktörü km'nin küp köküyle** çarpılmasıyla elde edilir" (rüzgâra maruz olmayan bileşenler için SM max I):
```
SM mean = km^(1/3) · SM max II
```
*(Basılı formül satırı "SM mean = km . SM max II" görünür; küp kök işareti OCR'da kaybolmuştur — metindeki tanım cümlesi küp kökü açıkça belirtir.)*

**Kombine hareketlerde (4.2.1.2.1, PDF s.172–173):** düşey ağırlık merkezi yer değiştirmesi bileşeni için:
```
SM mean = (2·SM max + SM min) / 3
```

**SR tipi yükler (4.2.1.3, PDF s.173):**
```
SR mean = (2·SR max + SR min) / 3
```
(SR max/min: rüzgârsız vinçte case I, rüzgârlı vinçte case II'de gelişen uç yükler.)

**SM + SR birlikte (4.2.1.4):** Her yük tipi için ayrı ayrı eşdeğer ortalama yük bulunur; rulman iki ortalama yükün birleşiminden doğan eşdeğer ortalama yük için seçilir.

---

## 6. DİŞLİ TASARIMI (4.2.5, PDF s.184)

Booklet 4'te dişli için formül/tablo **verilmez**. Madde 4.2.5:
- Dişli hesap yönteminin seçimi imalatçıya bırakılmıştır; yöntemin kaynağı belirtilmelidir.
- Yükler madde 2.6'ya göre belirlenir.
- İşletme süresini hesaba katan hesaplarda madde 2.1.3.2'deki konvansiyonel saatler kullanılmalıdır.

(Booklet 9 madde 9.13 ile genişletilmiştir — bkz. Bölüm 9.)

Mil boyutlandırma için ayrı madde yoktur; miller 4.1.1 (kopma), 4.1.3 (yorulma) genel prosedürüyle kontrol edilir (Appendix A-4.1.3 örneği bir mildir).

---

## 7. TEKER / RAY BASINCI (4.2.4) (PDF s.179–184)

### 7.1. Teker boyutu (4.2.4.1, PDF s.179–180)

İki kontrol formülü:
```
Pmean III / (b·D) ≤ PL · c1max · c2max  <  1,38·PL ≈ 1,4·PL     (c1max = 1,2 ; c2max = 1,15)
Pmean I,II / (b·D) ≤ PL · c1 · c2
```
*(İlk formülün "/(b·D)" kısmı OCR'da düşmüştür; ikinci formül ve Not 2'deki KL = P/(b·D) tanımından yapı kesindir.)*

- D: teker çapı (mm)
- b: rayın faydalı genişliği (useful width, mm)
- PL: teker malzemesine bağlı sınır basıncı (N/mm²)
- c1: tekerin devir hızına bağlı katsayı
- c2: mekanizma grubuna bağlı katsayı

**Ortalama yük (4.2.4.1.1, PDF s.180):**
```
Pmean I,II,III = (Pmin I,II,III + 2·Pmax I,II,III) / 3
```
Pmean I,II belirlenirken dinamik katsayı ψ **ihmal edilir**; Pmean III vinç kullanım dışıyken hesaplanır.

**Faydalı ray genişliği b (4.2.4.1.2, PDF s.180):**
- Düz oturma yüzeyli, köşe yarıçapı r olan ray: `b = l − 2r`
- Konveks (bombeli) oturma yüzeyli ray: `b = l − 4r/3`
(l: ray başı toplam genişliği.)

**Tablo T.4.2.4.1.3 — PL değerleri (madde 4.2.4.1.3, PDF s.181):**

| Teker malzemesi kopma dayanımı | PL (N/mm²) |
|---|---|
| σR > 500 N/mm² | 5,0 |
| σR > 600 N/mm² | 5,6 |
| σR > 700 N/mm² | 6,5 |
| σR > 800 N/mm² | 7,2 |

- Dökme, dövme, haddelenmiş çelikler ve küresel grafitli dökme demir için geçerlidir.
- Yüzey sertleştirilmiş yüksek mukavemetli çelik tekerlerde PL, **yüzey işlemi öncesi** çelik kalitesine göre sınırlandırılır (ray aşınmasını önlemek için).
- Adi/sertleştirilmiş dökme demir (chilled cast iron) tekerlerde PL = 5 N/mm² alınır; yüksek hızda ve darbeli yüklerde kullanımından kaçınılmalıdır.

**Tablo T.4.2.4.1.4.a — c1 değerleri (devir hızına göre, madde 4.2.4.1.4, PDF s.182):**

| Devir (d/dk) | c1 | Devir (d/dk) | c1 | Devir (d/dk) | c1 |
|---|---|---|---|---|---|
| 200 | 0,66 | 50 | 0,94 | 16 | 1,09 |
| 160 | 0,72 | 45 | 0,96 | 14 | 1,10 |
| 125 | 0,77 | 40 | 0,97 | 12,5 | 1,11 |
| 112 | 0,79 | 35,5 | 0,99 | 11,2 | 1,12 |
| 100 | 0,82 | 31,5 | 1,00 | 10 | 1,13 |
| 90 | 0,84 | 28 | 1,02 | 8 | 1,14 |
| 80 | 0,87 | 25 | 1,03 | 6,3 | 1,15 |
| 71 | 0,89 | 22,4 | 1,04 | 5,6 | 1,16 |
| 63 | 0,91 | 20 | 1,06 | 5 | 1,17 |
| 56 | 0,92 | 18 | 1,07 | | |

(Tablo T.4.2.4.1.4.b aynı c1 değerlerini teker çapı [200–1250 mm] × yürüyüş hızı [10–250 m/dk] matrisi olarak verir, PDF s.182; örn. D=500 mm, v=40 m/dk → c1 = 1,03.)

**Tablo T.4.2.4.1.5 — c2 değerleri (madde 4.2.4.1.5, PDF s.183):**

| Mekanizma grubu | c2 |
|---|---|
| M1 – M4 | 1,12 |
| M5 | 1,00 |
| M6 | 0,90 |
| M7 – M8 | 0,80 |

**Notlar (4.2.4.2, PDF s.183–184):**
- Formüller **D ≤ 1,25 m** tekerler için geçerlidir; daha büyük çap önerilmez.
- PL, HERTZ formülünden türetilmiş kavramsal (notional) bir basınçtır:
  `σcg²/(0,35·E) = P/(b·D)` ; `KL = P/(b·D)` ; `KL = PL·c1·c2`.

---

## 8. BOOKLET 8 — TEST YÜKLERİ VE TOLERANSLAR (PDF s.258–269)

### 8.1. Testler (madde 8.1, PDF s.260)

| Test | Madde | Katsayı | Yük |
|---|---|---|---|
| **Dinamik test** | 8.1.1 | ρ1 = **1,2** | SWL'nin **%120**'si — tüm hareketler sırayla dikkatle çalıştırılır; hız/motor ısınma kontrolü yapılmaz (bkz. 2.3.3.c) |
| **Statik test** | 8.1.2 | ρ2 = **1,4** | SWL'nin **%140**'ı — durgun koşulda; SWL yerden az yükseğe kaldırılır, ek yük şoksuz eklenir (bkz. 2.3.3.c) |

- **Not 1 (8.1.3):** Bu değerler minimum şartlardır; ulusal mevzuat daha yüksek değer istiyorsa ona uyulur. Ülke değerleri Appendix A-8.1.3'te (PDF s.269): örn. Fransa dinamik %120 / statik %150; İngiltere %125 SWL; Almanya DIN 15018/15019/15030'a göre; İtalya dinamik %110–128 (tip bazlı).
- **Not 2 (8.1.4):** Testte sehim ölçmek adettendir, ancak **bu kurallar izin verilen sehim konusunda hiçbir zorunluluk getirmez**; kullanıcı sehim sınırı isterse ihale şartnamesinde belirtmelidir.

### 8.2. Vinç ve yol toleransları (madde 8.2, PDF s.261–268)

Genel: Kurallar bu toleransların korunduğu varsayımına dayanır; köprülü, portal ve bumlu vinçler için geçerli, demiryolu vinçleri hariç (PDF s.261).

**Vinç imalat toleransları (8.2.2):**

| Madde | Konu | Tolerans |
|---|---|---|
| 8.2.2.1 | Açıklık (span) sapması Δs | s ≤ 15 m: ±2 mm; s > 15 m: ±[2 + 0,15·(s−15)] mm, maks. ±15 mm |
| 8.2.2.2 | Kiriş ters sehimi (camber) | Serbest oturan kirişlerde yüksüz vinçte (arabasız) aşağı sapma olmamalı; açıklık > 20 m için geçerli |
| 8.2.2.3 | Teker ekseni eğikliği | Ray üstü düzse, yüksüz vinçte yataydan +0,2 % ile −0,05 % arası |
| 8.2.2.4 | Araba ray eksen aralığı | Nominalden en çok ±3 mm |
| 8.2.2.5 | Karşılıklı iki noktanın kot farkı | Araba ray aralığının %0,15'i, maks. 10 mm |
| 8.2.2.6 | Oturma yüzeyi düzgünsüzlüğü | Ray aralığı ≤ 3 m: ±3 mm; > 3 m: ±%0,1 |
| 8.2.2.7 | Araba rayı düşey ekseni | Kiriş gövde ekseninden sapma ≤ gövde kalınlığının yarısı |
| 8.2.2.8 | Araba rayı doğrusallığı | 2 m'de ±1,0 mm; ek yerlerinde kaçıklık olmamalı |
| 8.2.2.9 | Teker delik eksenleri (yatay düzlem açısal sapma) | ±0,04 % |
| 8.2.2.10 | Karşılıklı teker delikleri (düşey düzlem hizası) | teker aks aralığının < 0,15 %'i, maks. 2 mm |
| 8.2.2.11 | Tekerlerin ray eksenine göre merkezliği | ±1 mm |
| 8.2.2.12 | Kılavuz makaraları merkezi | Ray ekseninden ±1 mm |
| 8.2.2.13 | Teker çapı toleransı | ISO **h9**; elektrik mili ile senkronize tekerlerde daha sıkı olabilir |

**Vinç yolu (kren rayı) toleransları (8.2.3, PDF s.267–268):** yeni yollar için; kullanımda %20 aşılırsa yol yeniden hizalanmalıdır.

| No | Konu | Tolerans |
|---|---|---|
| 1 | Açıklık Δs | s ≤ 15 m: ±3 mm; s > 15 m: ±[3 + 0,25·(s−15)] mm, maks. ±25 mm (tek taraflı kılavuzlamada diğer ray 3 katına çıkabilir, ≤ 25 mm) |
| 3 | Ray üst kotu | Teorik kottan ±10 mm; iki ray arası kot farkı ≤ 10 mm; boyuna eğrilik 2 m'de ±2 mm |
| 4 | Ray yuvarlanma yüzeyi eğimi | Boyuna %0,3; enine %0,3 |
| 5 | Yatay düzlemde yanal sapma | ±10 mm; boyuna eksende 2 m'de ±1 mm |
| 6 | Ray ek yerleri | Kaçıklık dikkate alınmaz; kaynaklı ek önerilir |

---

## 9. BOOKLET 9 — EK VE DEĞİŞİKLİKLER (PDF s.270–312)

Booklet 9 (madde 9.1–9.2, PDF s.273): Booklet 2, 3, 4 ve 8'e ek metinler; **Booklet 6 iptal edilmiştir** (yerine 9.15). Her madde başında "Clause X of booklet Y may be replaced by the following text" formülü kullanılır (ikame opsiyoneldir).

### 9.1. Ana kiriş / yapı hesaplarını etkileyen değişiklikler ("Booklet 2 ve 3'e ekler")

**9.3 — Dinamik katsayı ψ (2.2.2.1.1 yerine) (PDF s.274–275):** ψ yerine EN 13001 tarzı φ2 kullanılabilir:
```
φ2 = φ2min + β2·νh
```

Tablo T.9.3.a — β2 ve φ2min:

| Kaldırma sınıfı (Hoisting class) | β2 (s/m) | φ2min |
|---|---|---|
| HC1 | 0,17 | 1,05 |
| HC2 | 0,34 | 1,10 |
| HC3 | 0,51 | 1,15 |
| HC4 | 0,68 | 1,20 |

Tablo T.9.3.b — φ2 için νh:

| Yük kombinasyonu | HD1 | HD2 | HD3 | HD4 | HD5 |
|---|---|---|---|---|---|
| Case I, Case II | νh,max | νh,CS | νh,CS | 0,5·νh,max | νh = 0 |
| Case III | — | νh,max | — | νh,max | 0,5·νh,max |

(HD1: sürünme hızı yok; HD2: sürücü sürünme hızı seçebilir; HD3: kontrol sistemi yerden kalkışa kadar sürünme hızını garanti eder; HD4: kademesiz hız, sürücü kontrollü; HD5: ön germeli, sürücüden bağımsız kademesiz kontrol.)

**9.4 — Yatay hareket kuvvetleri SH (2.2.3 yerine) (PDF s.276–281):** Çarpılma (skewing) analiz modeli: n teker çifti, p kuplajlı çift; CFF/IFF/CFM/IFM kombinasyonları. Kılavuz kuvveti:
```
Fy = ν·f·mg ,   f = 0,3·(1 − e^(−250α)) , α < 0,015 rad
h = (p·µ·µ'·l² + Σdi²)/Σdi  (F/F)  ;  h = (p·µ·l² + Σdi²)/Σdi  (F/M)
α = αg + αw + αt ;  αg = sg/wb ;  αw = 0,1·(b/wb) ;  αt = 0,001 rad ; α ≤ 0,015 rad
```
Teğetsel kuvvetler Fx1i = ξ1i·f·mg vb.; ξ, ν katsayıları Tablo T.9.4'ten (CFF: ξ=µµ'l/nh; IFF: ξ=0 …).
**9.4.2 — Tampon etkisi:** 2.2.3.4.1'de **0,7 m/s yerine 0,4 m/s** alınır (PDF s.281).

**9.5 — Rüzgâr (2.2.4.1):** Aynı güvenlik seviyesi sağlanmak kaydıyla başka öneri/çalışmalar kullanılabilir (PDF s.282).

**9.6 — Çelik kalitesi (3.1.3 yerine) (PDF s.283–287):** EN 10025 / 10113 / 10137 / 10149 / 10210-1 / 10219-1'e göre modern çelik adları (S235JR…S960Q); 4 kalite grubu, çentik darbe (EN 10045-1) değer ve sıcaklıkları Tablolar T.9.6.a–d.

**9.7 — İzin verilen gerilmeler (3.2.2.1 yerine) (PDF s.288–289):** Ana kiriş hesabını doğrudan etkiler. Tablo T.9.7.a'dan seçmeler (fy, fu ve σa N/mm²):

| Çelik | t (mm) | fy | fu | σa Case I | σa Case II | σa Case III |
|---|---|---|---|---|---|---|
| S235 | ≤16 | 235 | 340 | 157 | 177 | 214 |
| S235 | ≤40 | 225 | 340 | 150 | 169 | 205 |
| S275 | ≤16 | 275 | 410 | 183 | 207 | 250 |
| S355 | ≤16 | 355 | 490 | 237 | 267 | 323 |
| S355 | ≤40 | 345 | 490 | 230 | 259 | 314 |
| S460 (EN 10113) | ≤16 | 460 | 550 | 307 | 346 | 418 |
| S690 (EN 10137) | ≤50 | 690 | 770 | 460 | 519 | 627 |
| S960 (EN 10137) | ≤50 | 960 | 980 | 640 | 722 | 873 |

(Tablo T.9.7.b soğuk şekillendirme çelikleri S315–S700 için benzer değerler verir, PDF s.289.)

**9.8 — Kontrollü sıkmalı bulonlar (3.2.2.2.1):** VDI 2230, FDE 25030 veya CEN/TC185/WG7 kullanılabilir; yöntemler karıştırılamaz (PDF s.290).

**9.9 — Crippling (3.3):** ENV 1993-1 (Eurocode 3) yöntemi kullanılabilir (PDF s.290).

**9.10 — Buckling / buruşma (3.4 yerine) (PDF s.291):** Kritik burkulma gerilmesi ηv'ye bölünür; Tablo T.9.10:

| Durum | Case | ηv |
|---|---|---|
| Düzlem elemanlar | I | 1,70 + 0,175(ψ−1) |
| | II | 1,50 + 0,125(ψ−1) |
| | III | 1,35 + 0,075(ψ−1) |
| Eğri elemanlar (dairesel silindir/boru) | I / II / III | 1,70 / 1,50 / 1,35 |

(ψ: plaka kenar gerilme oranı, +1…−1.)

**9.11 — Önemli deformasyonlu yapılar (3.5 yerine) (PDF s.292–295):** Limit durum yöntemi (limit states) alternatifi; kısmi yük katsayıları Tablo T.9.11 (γm = 1,10):

| Yük | Madde | Case I | Case II | Case III |
|---|---|---|---|---|
| Zati yük — elverişsiz etki | 2.2.1 | 1,22 | 1,16 | 1,10 |
| Zati yük — elverişli (tahmini ağırlık) | | 0,90 | 0,95 | 1,00 |
| Zati yük — elverişli (ölçülmüş ağırlık) | | 1,00 | 1,00 | 1,00 |
| Çalışma yükleri | 2.2.2.1 | 1,34 | 1,22 | — |
| Tahrik ivmeleri | 2.2.3 | 1,34 | 1,22 | 1,10 |
| İklim etkileri | 2.2.4 | 1,16 | 1,10 | — |

Ayrıca zati ağırlığın dengeleyici (favourable) etkide olduğu yapılar (kuleler, fırtına bağlantıları, boji pimleri, ön germeli bulonlu flanşlar) için 3.5 düzeltme yönteminin uygulanması zorunlu kılınır (9.11.2).

### 9.2. Mekanizma hesaplarını etkileyen değişiklikler ("Booklet 2 modified" ve "Booklet 4 modified", madde 9.14, PDF s.297–305)

**Gerekçe (9.14.1):** Wöhler eğrisinin n > 2·10⁶ için ikinci eğimi (c'), çok yüksek çevrim sayılarında aşırı düşük yorulma dayanımları verdiğinden **ikinci eğim iptal edilmiştir**.

**BOOKLET 2 MODIFIED — 2.1.4.3 Stress spectrum (PDF s.298):**
```
ksp = Σ (σi/σmax)^c · (ni/n)
```
Yeni kural: **toplama, ilk ni ≥ 2·10⁶ olan terimde kesilir (truncated); bu ni, nr olarak alınır ve nr = 2·10⁶ ile değiştirilir.** (Yani 2·10⁶ üstündeki çevrimler spektruma katılmaz.) Spektrum sınıfları P1–P4 (Tablo T.2.1.4.3) korunur.

**BOOKLET 4 MODIFIED — 4.1.3.5 Wöhler eğrisi (PDF s.299):**
- n = 8·10³: σ = σR (τ = σR/√3)
- 8·10³ ≤ n ≤ 2·10⁶: eskisi gibi TD doğrusu; `c = [log(2·10⁶)−log(8·10³)] / (logσR − logσd)`
- **n > 2·10⁶: σ = σd (yatay — ikinci eğim c' kaldırıldı)**
- ksp sadece c ile belirlenir (k'sp ve E8 istisnası kalktı).
- (Orijinaldeki "c < 2,5 kusurlu tasarım" cümlesi modifiye metinde tekrarlanmamıştır — [metinde geçmiyor].)

**BOOKLET 4 MODIFIED — 4.1.3.6 Yorulma dayanımı (PDF s.300–301):**
```
σk = 2^((8−j)/c) · σd        τk = 2^((8−j)/c) · τd
```
(E8 için özel c' formülü **kaldırıldı**.) Grup bazlı değerler süreksiz olduğundan, yorum (comment) olarak sürekli formül önerilir:
```
σk = σd · [ 2·10⁶ / (ksp · n) ]^(1/c)
```

**BOOKLET 4 MODIFIED — 4.1.3.7 İzin verilen gerilmeler (PDF s.302):**
```
νk = 3,2^(1/c) ;  σaf = σk/νk ;  τaf = τk/νk ;  σ ≤ σaf , τ ≤ τaf
```
Önemli fark: σ ve τ artık "maximum calculated normal/shear stress **amplitude**" (gerilme **genliği**) olarak tanımlanır. Birleşik gerilme koşulu aynen korunur:
`(σx/σkx)² + (σy/σky)² − σxσy/(σkxσky) + (τ/τk)² ≤ 1,1/νk²`

**BOOKLET 4 MODIFIED — Appendix A-4.1.3 (PDF s.303):**
- ks, kd, ku, kc yaklaşımı korunur; **yüzey işlemlerini hesaba katan "skin factor" kullanılması önerilmez**.
- Alternatif olarak gerilme gradyanı (Siebel) yöntemi kullanılabilir (kaynaklar: Siebel 1958, CETIM/Brand 1980, FKM 183-1 1994, E DIN 743 1996).

**Örnek (9.14.3, PDF s.304–305):** 7 kademeli spektrumlu mil; n_gerçek toplamı 75,76·10⁶ olmasına rağmen kesme kuralıyla efektif n = 3,76·10⁶ (B8 sınıfı, c = 3), ksp = 0,09285 → P1 → **E6** grubu. σd = 100 N/mm² → σk = 2^((8−6)/3)·100 = 158 N/mm², νk = 3,2^(1/3) = 1,473, σaf = 107,3 N/mm²; sürekli formülle σk = 178,9 → σaf = 121,5 N/mm². Maks. genlik 200 N/mm² > σaf → mil yorulma açısından **kabul edilemez**.

### 9.3. Teker seçimi değişikliği (9.12, 4.2.4 yerine) (PDF s.296)

4.2.4.1 yöntemi, aşağıdaki yeni PL ve c2 değerleriyle kullanılabilir:

**Tablo T.9.12.a — PL değerleri (ray mukavemeti şartıyla genişletilmiş):**

| Teker malzemesi fu (N/mm²) | PL (N/mm²) | Ray için min. mukavemet (N/mm²) |
|---|---|---|
| fu > 500 | 5,00 | 350 |
| fu > 600 | 5,60 | 350 |
| fu > 700 | 6,50 | 510 |
| fu > 800 | 7,20 | 510 |
| fu > 900 | 7,80 | 600 |
| fu > 1000 | 8,50 | 700 |

**Tablo T.9.12.b — c2 değerleri (revize):**

| Mekanizma grubu | c2 |
|---|---|
| M1 – M2 | **1,25** |
| M3 – M4 | 1,12 |
| M5 | 1,00 |
| M6 | 0,90 |
| M7 – M8 | 0,80 |

- 0,01·D derinliğe kadar yüzey sertleştirme PL seçiminde dikkate alınabilir.
- Bu tablolar kullanılınca Booklet 4 madde 4.2.4.1.3'ün son 5 paragrafı (yüzey sertleştirme/dökme demir sınırlamaları) uygulanmaz.

### 9.4. Dişli tasarımı (9.13, 4.2.5 yerine) (PDF s.297)
Kullanılabilecek yöntemler: **NF E 23015 (Henriot), DIN 3990, ISO 6336**. γm katsayısı servis faktörü (ka) ile kümülatif değildir; ancak ka en az γm'ye eşit olmalıdır.

### 9.5. Stabilite (9.15, Booklet 6 yerine) (PDF s.306–310) — özet
Devrilme kontrolü: Tablo T.9.15.a yük faktörleri — I Temel stabilite: 1,6P; II Dinamik: 1,35P + 1,0W1 + 1,0D; III Geri devrilme: −0,2P + 1,0W1; IV Ekstrem rüzgâr: 1,0P1 + 1,2W2; V Montaj/söküm: 1,25P2 + 1,0W3 + 1,0D. Kule vinçler için ek durum VI (0,10P2 yatay + 1,16P2 düşey). Rüzgârla kayma (drifting) kontrolü Tablo T.9.15.c (serviste 1,35P + 1,2W1 + 1,0D); sürtünme katsayıları Tablo T.9.15.d: yuvarlanma direnci/radyal yük = 0,02 (kaymalı yatak) / 0,005 (rulmanlı); frenli teker–ray µ = 0,14; ray kıskacı µ = 0,25.

### 9.6. Test yükleri değişikliği (9.16, 8.1 yerine) (PDF s.311)

Dinamik test, her tahrik için maksimum nominal hızda, anma yükünün ρ katıyla yapılır:

**Tablo T.9.16 — ρ dinamik test katsayısı:**

| Yük (t) | ψ ≤ 1,2 | ψ ≤ 1,4 | ψ > 1,4 |
|---|---|---|---|
| ≤ 30 | 1,2 | 1,25 | 1,3 |
| ≤ 100 | 1,15 | 1,2 | 1,25 |
| > 100 | 1,10 | 1,15 | 1,2 |

*(Üçüncü satır ham metinde "< 100" yazılmıştır; bağlamdan "> 100" olması gerekir — OCR/dizgi hatası olarak işaretlendi. ψ: madde 9.3'teki dinamik katsayı.)*

- Seri imalat vinç kaldırma mekanizmalarında (doğrudan etkili kuvvet sınırlayıcılı) FEM 9.751 değerleri kullanılabilir.
- **Önemli:** Bu dinamik test, **statik aşırı yük ve stabilite testi gereksinimlerini de karşılar** (ayrı %140 statik test şartı bu ikame metinde kalkar).

### 9.7. Tolerans değişikliği (9.17, 8.2 yerine) (PDF s.312)

Teker delik eksenlerinin yatay düzlem açısal sapması sabit ±0,04 % yerine, mekanizma sınıfı ve yürüyüş hızına bağlı α değerini aşmamalıdır:

**Tablo T.9.17 — Teker doğrultu sapma açısı α (rad):**

| Mek. sınıfı | v ≤ 25 m/dk | ≤ 50 | ≤ 100 | ≤ 200 | > 200 |
|---|---|---|---|---|---|
| M1 | 0,0012 | 0,0012 | 0,0012 | 0,0010 | 0,0008 |
| M2 | 0,0012 | 0,0012 | 0,0010 | 0,0008 | 0,0007 |
| M3 | 0,0012 | 0,0010 | 0,0008 | 0,0007 | 0,0006 |
| M4 | 0,0010 | 0,0008 | 0,0007 | 0,0006 | 0,0005 |
| M5 | 0,0008 | 0,0007 | 0,0006 | 0,0005 | 0,0004 |
| M6 | 0,0007 | 0,0006 | 0,0005 | 0,0004 | 0,0004 |
| M7 | 0,0006 | 0,0005 | 0,0004 | 0,0004 | 0,0004 |
| M8 | 0,0005 | 0,0004 | 0,0004 | 0,0004 | 0,0004 |

---

## ÇIKARILAMAYAN / BELİRSİZ NOKTALAR
- Figür A.4.1.3.1.a/b (ks eğrileri) ve A.4.1.3.2 (ku, kc eğrileri): grafik olduğundan sayısal değerler [metinden çıkarılamadı]; sadece örnek uygulamadaki noktalar (ks=1,4; 2,2; ku=1,15) mevcut.
- Tablo T.A.4.1.3.2 (kd): sütun başlıkları OCR'da bozuk; 100/200 mm sütunları ve kd=1/1,1 değerleri bağlamdan kuruldu (işaretlendi).
- Teker formülünde Pmean III /(b·D) bölümü OCR'da düşmüş; yapı Not 2'deki KL = P/(b·D) tanımıyla doğrulandı.
- SM mean formülündeki küp kök işareti basılı satırda kayıp; metin tanımı esas alındı.
- Tambur çok katlı sarım için "t" katsayısı: Booklet 4 metninde yok.
- T.9.16 üçüncü satır "< 100": "> 100" olmalı (dizgi hatası şüphesi işaretlendi).
