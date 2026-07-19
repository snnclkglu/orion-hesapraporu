# Hesap Motoru ↔ Standart Çapraz Referans Tablosu

> Amaç: `src/lib/calc/modules/*.ts` ve `src/lib/calc/presentation/*Sections.ts` dosyalarındaki her hesap adımının FEM 1.001 (3rd Ed. 1998) / CMAA 70 (elimizdeki 1983 baskısı) karşılığını sabitlemek; yanlış/eksik `standard` alanlarını listelemek; FEM'e göre derinleştirilebilecek hesapları önceliklendirmek.
>
> Kaynak notlar: `docs/standards/fem-1001-notes.md`, `docs/standards/cmaa-70-notes.md`. Bu doküman **yalnız rapor** niteliğindedir — kod değişikliği içermez.
>
> Doğrulama yöntemi: Standart tablo değerleri PDF metin dökümünden çıkarılıp motor sabitleriyle sayısal olarak karşılaştırılmıştır (aşağıda "değer doğrulandı" ibareleri buna dayanır).

---

## 1. Modül bazında çapraz referans

Durum sütunu: ✓ = mevcut referans doğru · ~ = doğru ama kesinleştirilmeli (madde/tablo no eksik) · ✗ = yanlış/yanıltıcı · — = referans yok.

### 1.1 hoistGroup (Ana/Yrd Kaldırma) — `modules/hoistGroup.ts`

| Hesap adımı (check id / hücre) | Koddaki `standard` | Doğru referans | Durum | Not |
|---|---|---|---|---|
| Halat emniyet katsayısı `rope.safety` (L18/L30) | `FEM 1.001` | **FEM 1.001 4.2.2.1.2, Tablo T.4.2.2.1.2** | ~ | Zp değerleri (M1–M8: 3,15…9 hareketli; 2,5…5 sabit) `coefficients.ts` ROPE_SAFETY ile birebir **değer doğrulandı** |
| Min. tambur çapı `drum.dia` (L36/L38) | `FEM 1.001` | **FEM 1.001 4.2.3.1, Tablo T.4.2.3.1.1** (D ≥ H·d) | ~ | H tambur değerleri (11,2…25) DRUM_SHEAVE_COEFF ile **değer doğrulandı** |
| Tambur gerilmeleri `drum.stress` (L44–L50) | — | FEM'de tambur kabuk formülü yok; genel çerçeve **FEM 1.001 4.1.1** (σa = σR/νR). İzin 500/700 kg/cm² Excel kabulüdür | — | Referanssız bırakmak yerine "FEM 1.001 4.1.1 (genel)" + firma kabulü notu önerilir |
| Oluk adımı (L41) | `DIN 15061` (presentation) | DIN 15061-1 | ✓ | FEM 4.2.3.2 yalnız yiv dip yarıçapı ≥ 0,5375·d ister |
| Tambur mili `shaft.stress` (L86–L94) | — | **FEM 1.001 4.1.1** (kopma) + **4.1.3** (yorulma, bkz. §3) | — | İzin gerilmeleri Excel malzeme tablosundan |
| Tambur/mil kaynağı `drumWeld/shaftWeld` | — | FEM 1.001 3.2.2.3 (kaynak) yapı tarafı; mekanizmada genel 4.1.1 | — | |
| Rulman ömrü `bearing.life` (L152/L154) | `FEM 1.001 T.2.1.3.2` | **FEM 1.001 4.2.1.1 + Tablo T.2.1.3.2** | ~ | Ömür bantları (T0–T9: 200…50 000 h) MECHANISM_LIFE ile **değer doğrulandı**. Eksiklik: bkz. §2.5 (sınıf seçimi) |
| Redüktör tork/oran/radyal | — | Standart dışı (imalatçı kataloğu); FEM 4.2.5 dişli yöntemini imalatçıya bırakır (Booklet 9 9.13: DIN 3990 / ISO 6336) | — | |
| Motor gücü `motor.power` (L215) | `CMAA 70` | **CMAA 70 5.2.9.1.1** (Mekanik HP = W·V/(33000·E); gerekli HP = ×Kc) | ~ | Motor tork zinciriyle eşdeğer kurulum |
| Fren torku `brake.torque` (L220) | — | **CMAA 70 4.9.1.2** (tutma freni ≥ %125 / %100 nominal moment) | — | `brakeServiceFactor` girdisinin 4.9.1.2 yüzdeleriyle ilişkilendirilmesi önerilir |
| Kaplinler | — | Standart dışı (katalog + servis faktörü) | — | |

### 1.2 hookBlock (Kanca Bloğu) — `modules/hookBlock.ts`

| Hesap adımı | Koddaki `standard` | Doğru referans | Durum | Not |
|---|---|---|---|---|
| Makara çapı `sheave.dia` | `FEM 1.001 T.4.2.3.1.1` | Aynı | ✓ | Makara H (12,5…28) ve denge makarası H (11,2…18) **değer doğrulandı** |
| Makara rulmanı ömrü | `FEM 1.001 T.2.1.3.2` | FEM 1.001 4.2.1.1 + T.2.1.3.2 | ~ | |
| Kanca bloğu mili `shaft.stress` | `CMAA #74, 4.5` | **Doğrulanamadı.** CMAA 70-1983'te 4.5 = Makaralar (Sheaves); mil gerilmeleri **CMAA 70 4.11.4.1** (σ ≤ Su/5, τ ≤ Su/(5√3), σt = √(σ²+3τ²) ≤ Su/5). CMAA 74 elimizde yok | ✗ | Öneri: `CMAA 70 4.11.4.1` (veya CMAA 74'ün ilgili maddesi temin edilip doğrulanmalı) |
| Kanca rulmanı statik (S0 ≥ 0,5) | — | Rulman üreticisi kriteri (SKF); standart dışı | — | |
| Kiriş statik gerilme `girder.static` | `FEM T.3.2.1.1` | FEM 1.001 T.3.2.1.1 — **fakat değerler uyumsuz**, bkz. §2.1 | ✗ | 2300/1530 kg/cm² ≠ T.3.2.1.1 Case I (2450/1630) |
| Kiriş yorulması | `DIN 15018 T.17/18, 7.4.5` | DIN 15018 (FEM kapsamı dışında bilinçli tercih) | ✓ | FEM karşılığı: 3.6 + A-3.6 (Booklet 3) |

### 1.3 mainGirder (Ana Kiriş) — `modules/mainGirder.ts`

| Hesap adımı | Koddaki `standard` | Doğru referans | Durum | Not |
|---|---|---|---|---|
| Dinamik katsayı ψ (D46) | `FEM 2.3` (girderSections.ts:135) | **FEM 1.001 2.2.2.1.1** (ψ = 1 + ξ·VL; ξ = 0,6 köprülü vinç; VL ≤ 1 m/s; ψ ≥ 1,15) | ✗ | 2.3 yük kombinasyonları maddesidir. Motor formülü (`<0,25→1,15; >1→1,6; 1+0,6·v`) standartla **birebir doğrulandı** (1+0,6·0,25=1,15 alt sınırla çakışır) |
| Araba/köprü yatay yükleri Fha1/Fhk1 (D105/D124) | `FEM T.2.2.3.1.1` (girderSections.ts:153/163) | **FEM 1.001 2.2.3.1.1** (madde; Tablo T.2.2.3.1.1 yalnız ivme/süre kılavuz değerleridir) | ~ | Sınır kuralı: yatay kuvvet tahrikli teker yükünün 1/30…1/4'ü. Motorun `/14` katsayısı Excel'in bu bandı uygulama biçimidir — bkz. §2.6 |
| Çapraz yürüyüş yükleri Fha2/Fhk2 (D109/D128) | — | **FEM 1.001 2.2.3.3** (λ = f(p/a); p/a 2…8 → λ 0,05…0,2) | — | Motor `clampLambda(0.025·p/a; 0,05–0,2)` doğrusal yaklaşımı grafiğin uç noktalarıyla uyumlu |
| Yük kombinasyonu Case I (E362–E376, γc) | `FEM T.3.2.1.1` (kontrol) | Kombinasyon: **FEM 1.001 2.3.1** (γc·(SG + ψ·SL + SH)); γc değeri: **Tablo T.2.3.4** (A1–A8: 1,00…1,20) | ~ | Görev/yol haritasındaki "T.2.3.1" anımsaması **yanlış**tı; doğru tablo numarası **T.2.3.4**. Motor γc'yi elle alır (E138, A6→1,14 ile tutarlı) |
| Case III test durumu (D386–D391) | `FEM T.3.2.1.1` | Kombinasyon: **FEM 1.001 2.3.3.c** (SG + ψ·ρ1·SL veya SG + ρ2·SL); katsayılar: **Booklet 8 8.1.1 (ρ1 = 1,2), 8.1.2 (ρ2 = 1,4)** | ~ | Booklet 9 9.16 alternatif ρ tablosu verir (yüke/ψ'ye bağlı 1,1…1,3) |
| İzin gerilmeleri (statik) | `FEM T.3.2.1.1` | FEM 1.001 3.2.1.1, Tablo T.3.2.1.1 | ✓ | GIRDER_ALLOWABLE_STRESS: St37 1630/1834/2191, St44 1783/1987/2450, St52 2450/2750/3310 kg/cm² = 160/180/215, 175/195/240, 240/270/325 N/mm² — **birebir doğrulandı** |
| Eşdeğer gerilme (von Mises) | — | **FEM 1.001 3.2.1.3** (σcp = √(σx²+σy²−σx·σy+3τ²) ≤ σa) | — | Motor formülü birebir (mutlak değerli ara terimle) |
| Yorulma (F396–E435) | `DIN 15018 T.17/18, 7.4.5` | DIN 15018 (bilinçli tercih); FEM karşılığı 3.6 | ✓ | |
| Sehim `girder.deflection` (G447) | — | FEM'de kiriş sehim limiti **yok**; kaynak **CMAA 70 3.5.5.1** (0,001125 in/in ≈ **L/888**; VIF'siz, araba + nominal yük) | — | Limit şu an kullanıcı girdisi; CMAA referansı eklenmeli |

### 1.4 buckling (Buruşma) — `modules/buckling.ts`

| Hesap adımı | Koddaki `standard` | Doğru referans | Durum | Not |
|---|---|---|---|---|
| σER, Kσ, Kτ, σvcr, etkileşim | `FEM 1.001 3.4` / `T.A.3.4.1` | **FEM 1.001 3.4 + Appendix A-3.4, Tablo T.A.3.4.1** | ~ | Kσ dalları (ψ≥0: 8,4/(ψ+1,1); −1<ψ<0 enterpolasyon; ψ≤−1: 23,9 / 15,87+1,87/α²+8,6α²) ve Kτ (5,34+4/α² | 4+5,34/α²) tabloyla **birebir doğrulandı**. CMAA 70 Table 3.4.8.2-1 aynı katsayıları verir |
| Emniyet katsayısı vv = 1,7 + 0,175(ψ−1) | `FEM 1.001 3.4` | FEM 1.001 A-3.4 — **yalnız Case I** değeri | ~ | Case II: 1,5+0,125(ψ−1); Case III: 1,35+0,075(ψ−1) (Booklet 9 T.9.10; CMAA 3.4.8.3 DFB aynı, Case III'te 0,05 katsayısıyla). Bkz. §3 derinleştirme |
| AA33 son dalındaki `8,6/α²` | — | Standart formül **8,6·α²** (T.A.3.4.1, ψ≤−1 dalı K″ için) | ✗ | Excel'e sadakat notu kodda mevcut; α<2/3 + −1<ψ≤0 kombinasyonunda standarttan sapar — düzeltme adayı (golden test etkisi değerlendirilerek) |

### 1.5 travelGroup (Araba/Köprü Yürütme) — `modules/travelGroup.ts`

| Hesap adımı | Koddaki `standard` | Doğru referans | Durum | Not |
|---|---|---|---|---|
| Teker basıncı `wheel.pressure` | `FEM 1.001 T.4.2.4.1` | **FEM 1.001 4.2.4.1** (böyle bir tablo yok; tablolar T.4.2.4.1.3/.4.a/.4.b/.5) | ~ | Pmean = (Pmin+2Pmax)/3 (4.2.4.1.1, ψ'siz) motorla uyumlu; kontrol Pmean/(b·D) ≤ PL·c1·c2 |
| PL limit basıncı | `FEM 1.001 T.4.2.4.1.3` (travelSections.ts:124) | T.4.2.4.1.3 yalnız 500→5,0 / 600→5,6 / 700→6,5 / 800→7,2 verir; motordaki **7,8 (≥900) ve 8,5 (≥1000) satırlarının kaynağı Booklet 9 Tablo T.9.12.a**'dır | ~ | T.9.12.a bu değerleri **ray min. mukavemet şartına** bağlar (900→ray ≥600, 1000→ray ≥700 N/mm²); motor bu şartı kontrol etmiyor — bkz. §3 |
| c1 katsayısı | `FEM 1.001 T.4.2.4.1.4.a` (travelSections.ts:112) | Aynı | ✓ | |
| c2 katsayısı | `FEM 1.001 T.4.2.4.1.5` (travelSections.ts:118) | Tablo doğru (M1–M4: 1,12; M5: 1,00; M6: 0,90; M7–M8: 0,80 — **değer doğrulandı**); **fakat girdi yanlış sınıftan**: motor `specs.hoistMechanismClass` (Excel P12) okur; 4.2.4.1.5'e göre **yürütme mekanizmasının kendi grubu** kullanılmalı | ✗ | Excel sadakati kaynaklı; ayrıca Booklet 9 T.9.12.b M1–M2 için 1,25 verir |
| Teker mili `shaft.stress` | — | FEM 1.001 4.1.1 (+ 4.1.3 yorulma — bkz. §3 öncelik) | — | İzin gerilmeleri sabit 42CrMo4 satırından |
| Teker rulmanı ömrü | `FEM 1.001 T.2.1.3.2` | FEM 1.001 4.2.1.1 + T.2.1.3.2; **sınıf girdisi**: motor `hoistUsageClass` (Excel P13) okur — yürütme mekanizmasının kendi T sınıfı olmalı | ✗ | Excel sadakati kaynaklı, bkz. §2.5 |
| Yürütme motoru `motor.power` | `CMAA 70 5.2.9.1.2.1` | Aynı: Gerekli HP = Ka·W·V·Ks | ✓ | Ka = [f + 2000·a·Cr/(g·E)]/(33000·Kt) motorla birebir; **Cr = 1,05 + a/7,5** (CMAA 70-2000 ile çapraz doğrulandı; 1983 taramasında OCR bozuk). Eksik: CMAA formülündeki **Nr/Nf** çarpanı motorda yok (=1 kabul) |
| Sürtünme f | `CMAA 70 T.5.2.9.1.2.1-D` | Aynı (tablo inç bazlı: 36–24″→10–12, 21–10″→12–15, 8–6″→16 lb/ton) | ~ | Motor eşlemesi: 200 mm→16, 250–500→15, 630–900→12. CMAA'da 30″/36″ (≈800/900 mm) **10 lb/ton**'dur; motor 12 kullanır (muhafazakâr sapma). 500 mm (≈20″)→15 de tabloda 21″→12 ile çelişir (yine muhafazakâr) |
| Redüktör oran sapması (+5/−10, +10/−5) | — | CMAA 70 5.2.10.3: gerçek tam yük hızı belirtilenin **±%10**'u içinde | — | Excel'in asimetrik bantları firma kabulü |
| Köprü freni `brake.torque` | — | **CMAA 70 4.9.4** (durdurma mesafesi ≤ nominal hızın %10'u ft; park ≥ %50 motor momenti) | — | |
| Tampon (köprü 0,7·v) | — | **FEM 1.001 2.2.3.4.1** (kinetik enerji 0,7·Vt hızında; >0,7 m/s ise zorunlu) | — | CMAA 3.3.2.1.3.2 ise **0,4·V** kullanır; Booklet 9 9.4.2 FEM eşiğini 0,4 m/s'ye indirir. **Araba tamponunda motor 1,0·v kullanıyor** (Excel sadakati) — FEM'e göre 0,7·v yeterlidir, mevcut hâl muhafazakâr |
| Tampon kuvveti (0,8 verim böleni) | — | Tampon üreticisi kabulü; standart dışı | — | |

### 1.6 endCarriage (Başkiriş) — `modules/endCarriage.ts`

| Hesap adımı | Koddaki `standard` | Doğru referans | Durum | Not |
|---|---|---|---|---|
| Dinamik katsayı ψ (H1–H4, k+l·v) | `DIN 15018 Tablo 2` | DIN 15018-1 Tablo 2 | ✓ | FEM karşılığı 2.2.2.1.1 (tek formül) veya Booklet 9 9.3 (HC1–HC4: φ2min 1,05–1,20; β2 0,17–0,68) |
| Statik izin gerilme L50 (S355→2300, S235→1530) | `FEM T.3.2.1.1` | **Değerler T.3.2.1.1 ile uyumsuz** — bkz. §2.1 | ✗ | |
| Yorulma | `DIN 15018 T.17/18, 7.4.5` | DIN 15018 | ✓ | |

---

## 2. Tespit edilen yanlış/eksik referanslar (düzeltme listesi)

> Kod DEĞİŞTİRİLMEDİ — aşağıdakiler Faz A/F uygulama listesi içindir.

### 2.1 Değer uyuşmazlığı: başkiriş/kanca bloğu statik izin gerilmeleri
- `endCarriage.ts:143` (L50) ve `hookBlock.ts` `ALLOWABLE_STATIC_KGCM2`: S235→**1530**, S355→**2300 kg/cm²**, etiket `FEM T.3.2.1.1`.
- FEM T.3.2.1.1 Case I: S235(A.37)→**1630**, S355(A.52)→**2450 kg/cm²** (mainGirder bu doğru değerleri kullanıyor).
- 1530 kg/cm² = 150 N/mm², **Booklet 9 Tablo T.9.7.a** (S235, t ≤ 40 mm, Case I) ile birebir örtüşür; 2300 kg/cm² = 225,6 N/mm² ise hiçbir tabloyla örtüşmez (T.9.7.a S355 t≤40 → 230 N/mm² = 2345 kg/cm²).
- Öneri: ya T.3.2.1.1 değerlerine (1630/2450) geçilip etiket korunmalı, ya da T.9.7.a (kalınlığa bağlı) benimsenip etiket `FEM 1.001 T.9.7.a` yapılmalı. Mevcut karışım tutarsız (muhafazakâr yönde).

### 2.2 Yanlış madde numaraları (presentation `standard` alanları)
| Dosya:satır | Mevcut | Olması gereken |
|---|---|---|
| `girderSections.ts:135` (ψ) | `FEM 2.3` | `FEM 1.001 2.2.2.1.1` |
| `girderSections.ts:153, 163` (Fha1/Fhk1) | `FEM T.2.2.3.1.1` | `FEM 1.001 2.2.3.1.1` (tablo yalnız ivme kılavuzu) |
| `hoistSections.ts:77` (Zp) | `FEM 1.001` | `FEM 1.001 T.4.2.2.1.2` |
| `hoistSections.ts:107` (H) | `FEM 1.001` | `FEM 1.001 T.4.2.3.1.1` |
| `hookBlockSections.ts:191` (mil) | `CMAA #74, 4.5` | `CMAA 70 4.11.4.1` (veya CMAA 74 temin edilip doğrulanmalı) |
| `travelSections.ts` PL satırı bağlamı | `FEM 1.001 T.4.2.4.1.3` | ≥900 N/mm² satırları için ek not: `FEM 1.001 T.9.12.a` |

### 2.3 Yanlış madde numaraları (modül `checks[]` `standard` alanları)
| Dosya:satır | Mevcut | Olması gereken |
|---|---|---|
| `hoistGroup.ts:214` (halat) | `FEM 1.001` | `FEM 1.001 4.2.2.1.2 / T.4.2.2.1.2` |
| `hoistGroup.ts:237` (tambur çapı) | `FEM 1.001` | `FEM 1.001 4.2.3.1 / T.4.2.3.1.1` |
| `hoistGroup.ts:395` (motor) | `CMAA 70` | `CMAA 70 5.2.9.1.1` |
| `hookBlock.ts:260` (mil) | `CMAA #74, 4.5` | `CMAA 70 4.11.4.1` (bkz. §2.2) |
| `travelGroup.ts:290` (teker) | `FEM 1.001 T.4.2.4.1` | `FEM 1.001 4.2.4.1` (tablolar ayrıca .3/.4.a/.5) |
| `buckling.ts:156/164/175` | `FEM 1.001 3.4` | `FEM 1.001 3.4 / A-3.4 (T.A.3.4.1)` |
| `mainGirder.ts:400/407`, `endCarriage.ts:150` | `FEM T.3.2.1.1` | Biçim birliği: `FEM 1.001 T.3.2.1.1` |
| Tüm `FEM 1.001 T.2.1.3.2` ömür referansları | — | Kesinleştirme: `FEM 1.001 4.2.1.1 + T.2.1.3.2` |

### 2.4 Yol haritası / kurum içi anımsama düzeltmeleri
- γc tablosu **T.2.3.1 değil T.2.3.4**'tür (2.3.1 yalnız Case I kombinasyon formülüdür).
- ψ için "Tablo T.2.2.2.1.1" yoktur; ψ **madde 2.2.2.1.1 formülü + Şekil 2.2.2.1.1** ile verilir (T.2.2.3.1.1 ivme tablosuyla karıştırılmamalı).
- CMAA tarafında elimizdeki PDF **1983 baskısıdır**: dişli hesabı 4.7, mil 4.11, fren 4.9 + 5.3, teker 4.13 (yol haritasındaki 5.2.8/5.2.7/5.2.9.1.3 numaraları bu baskıda motor bölümü dışına denk gelmez; motor 5.2.9 aynıdır).

### 2.5 Sınıf girdisi hataları (Excel sadakatinden miras, hesap sonucunu etkiler)
1. **c2 katsayısı** (`travelGroup.ts:274`): kaldırma mekanizma sınıfından okunuyor; FEM 4.2.4.1.5'e göre **yürütme mekanizmasının kendi grubu** olmalı (araba/köprü yürütme genelde M4–M5 iken kaldırma M5–M8 olabilir → c2 farkı %12–40).
2. **Rulman ömrü sınıfı** (`travelGroup.ts:338`, `hoistGroup.ts:323`, `hookBlock.ts`): tüm mekanizmalarda `hoistUsageClass` (Excel P13) kullanılıyor; FEM 4.2.1.1 her mekanizmanın **kendi T sınıfını** ister (yürütme mekanizması kaldırmadan farklı sınıflandırılabilir — T.2.1.3.5 rehber tablosu farklı gruplar önerir).
3. **Buruşma AA33 son dalı**: `8,6/α²` — standartta `8,6·α²` (yalnız α<2/3 ve −1<ψ≤0 kesişiminde etkir).

### 2.6 Kaynağı belgelenemeyen ampirik katsayılar (araştırma/doğrulama listesi)
- `mainGirder.ts` D103/D122: yatay kuvvet üst sınırı olarak `tahrikli teker yükü / 14` — FEM 2.2.3.1.1'deki 1/30…1/4 bandı içinde kalan bir firma kabulü görünümünde (1/14 ≈ 0,071); kesin karşılığı yok.
- `mainGirder.ts` D184/D210 `/80`, D218 `/20`, D247/D255 `/50`, D232 `/10`: moment dağıtım kabulleri (basit kiriş + süreklilik payları) — standart formülü değil mühendislik modeli.
- Sehim formülündeki E = 2 100 000 kg/cm² ve tekil yük konumu kabulleri.

---

## 3. FEM'e göre derinleştirilebilecek hesaplar (öncelik sırasıyla)

### 3.1 Ana kiriş (öncelik 1)
1. **Case II kombinasyonu yok**: FEM 2.3.2 (γc·(SG+ψSL+SH) + SW, çalışma rüzgârı T.2.2.4.1.2.1: 250 N/m² tipik). Açık saha vinçleri için gerekli; kapalı sahada "uygulanamaz" notuyla geçilebilir.
2. **γc'nin aparey grubundan otomatik türetilmesi** (T.2.3.4; şu an elle E138 girdisi).
3. **ψ alternatifi**: Booklet 9 9.3 (HC1–HC4, φ2 = φ2min + β2·νh) — modern EN 13001 uyumu.
4. **Kayma/eşdeğer gerilme kontrol setinin 3.2.1.3 üçlü kombinasyonu** (σx-maks / σy-maks / τ-maks ayrı ayrı) — şu an tek kombinasyon.
5. **Sehim limiti referansı**: CMAA 3.5.5.1 (L/888) + kutu kirişe ters sehim (camber = ölü + ½ canlı yük sehimi, CMAA 3.5.5) raporda öneri olarak.
6. **Kutu kesit oran sınırları**: CMAA 3.5.1 (L/h ≤ 25, L/b ≤ 65) hızlı geometri kontrolü.
7. FEM 3.6 yorulması (W0–W2/K0–K4, kappa, Tablo T.3.6.3.3/A-3.6) DIN 15018'e paralel ikinci kontrol olarak eklenebilir (uzun vade).

### 3.2 Teker mili (öncelik 2)
1. Şu an yalnız statik bileşik gerilme + sabit izin değeri var. **FEM 4.1.1**: σa = σR/νR ile Case I/II/III ayrımı (νR Tablo T.4.1.1.2'ye göre; bkz. fem-1001-notes §2.1).
2. **FEM 4.1.3 yorulma kontrolü**: komponent grubu (E1–E8, B/P sınıflarından) → Wöhler c üssü, σd → σk = 2^((8−j)/c)·σd → νk = 3,2^(1/c) → σaf. Çentik faktörleri kd/ks/ku (A-4.1.3). **Booklet 9 9.14** modifikasyonları (2·10⁶ kesme kuralı, ikinci eğim iptali, gerilme genliği tanımı) esas alınmalı.
3. Gerilme yığılması: motor `stressConcFactor` girdisi CMAA 4.11.4.2 (Kt eğilme, Ks kesme) ile ilişkilendirilebilir.
4. CMAA alternatifi: 4.11.4.1 statik (%20 Su) + 4.11.4.2 yorulma (Se = 0,36·Su′·Ksc; Kc sınıf faktörü A–F: 1,0–1,25).

### 3.3 Buruşma (öncelik 3)
1. **Case II/III emniyet katsayıları**: vv yalnız Case I (1,7+0,175(ψ−1)); Booklet 9 T.9.10 → Case II: 1,5+0,125(ψ−1), Case III: 1,35+0,075(ψ−1). Test durumu (Case III) gerilmeleriyle buruşma kontrolü şu an hiç yapılmıyor.
2. **İnelastik bölge indirgemesi**: kritik gerilme orantı sınırını (σp ≈ σy/1,32) aşarsa indirgenmiş σkR kullanılmalı (CMAA 3.4.8.2; FEM A-3.4 ρ katsayısı). Şu an elle `sideCorrectedCriticalNmm2` girdisiyle karşılanıyor — formülleştirilebilir.
3. AA33 `8,6/α²` → `8,6·α²` düzeltmesi (§2.5).
4. Berkitme tasarım kuralları (CMAA 3.5.2–3.5.4: boyuna berkitme konumu 0,4·c; düşey berkitme aralığı; diyafram) rapor önerisi olarak.

### 3.4 Diğer
- **Teker basıncı**: c2 ve ömür sınıfı düzeltmeleri (§2.5); PL ≥ 7,8 kullanımında ray mukavemet şartı (T.9.12.a); Case III kontrolü `Pmean III/(b·D) ≤ PL·1,2·1,15` eklenebilir (4.2.4.1).
- **Yürütme motoru**: Nr/Nf çarpanı; f tablosunun inç karşılıklarına hizalanması (30–36″ → 10 lb/ton); dış saha için CMAA 5.2.9.1.2.3 rüzgârlı formül seti.
- **Fren**: kaldırma freni yüzdeleri (CMAA 4.9.1.2), köprü/araba durdurma mesafesi (4.9.3/4.9.4) açık kontrole dönüştürülebilir.
- **Tampon**: FEM 0,7·v / CMAA 0,4·v / Booklet 9 0,4 m/s eşiği arasındaki tercihin raporda belgelenmesi; araba tamponunda 1,0·v muhafazakârlığının notlanması.
- **Halat**: Zp yönteminin yanına C-faktörü yöntemi (4.2.2.1.3, d ≥ C·√S) alternatif kontrol olarak.
- **Test yükleri**: ρ1/ρ2 girdi varsayılanlarının Booklet 8 (1,2/1,4) ile bağlanması; Booklet 9 9.16 tablosu seçenek olarak.
