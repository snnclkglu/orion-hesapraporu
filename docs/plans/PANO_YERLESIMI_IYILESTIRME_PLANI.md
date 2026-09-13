# Pano Yerleşimi — yerleştirici, ekran ve kod yapısı iyileştirme planı

Tarih: 12.09.2026
Durum: Kod incelemesi ve 0026-01 üzerinde ölçüme dayalı uygulama planı. Bu belge uygulama veya migration değildir; hiçbir kod değiştirilmedi.
Örnek iş: **0026-01** (100 T tavan vinci, 144 malzeme satırı, 54 ürün). Gerileme koruması: **0019-00**.
Kural dosyası: `docs/agent/panoyerlesimi.md` (PANO-1 … PANO-37). Bu plan o kuralların üstüne yazılır; çelişen yerlerde plan yeni kural numarası önerir, uygulama sırasında kural dosyası güncellenir.

---

## 1. Amaç ve kapsam

Kullanıcının gözlemi: *"Panoya ürünler düzgün yerleşmiyor; sayfalar da pek anlaşılır değil."*

Üç iş birlikte yürür:

1. **Yerleştirici** — cihazların montaj plakasına dağılımı fiziksel gerçeğe ve pano ustasının beklentisine yaklaşır; boşa giden alan ölçülüp düşürülür.
2. **Ekran** — kullanıcının verdiği kararlar (kilit, sabitleme, ölçü tercihi) ve sistemin uyarıları GÖRÜNÜR olur; iki sayfa tek bir akışa oturur.
3. **Kod yapısı** — 969 satırlık `layout.ts`, 899 satırlık `panoLayout.ts` ve 716 satırlık `pano-view.tsx` sorumluluk sınırlarından bölünür; dış API'ler (PDF, SVG, el kitabı ucu) değişmez.

Değişmeyenler: **plan saklanmaz** (PANO-14), ölçü defteri olgu tutar (PANO-12), gövde ızgarası (PANO-1/33), determinizm ve bağımsız denetçi (PANO-11), sürükle-bırak SIRA yazar (PANO-23/31). Elektrik projesi okuma (`docs/agent/elektrik.md`) kapsam dışıdır.

---

## 2. Teşhis — 0026-01'de ölçülen durum

Ölçümler `scripts/test-switchboard-layout.ts` (yerel döküm `.tmp/electrical-parts-all.json`, defter `.tmp/device-models.json`, 116 ürün) ve canlı veritabanından okunan kararlar ile yapıldı. Canlı kararlar (12.09.2026):

| Tablo | Kayıt | Anlamı |
|---|---|---|
| `switchboard_panels` | `LVD0` en **1200 kilitli** (09.09 09:52) | Kilitli pano bölünmez → tek gövdeye sığmayan her şey taşar |
| `switchboard_panels` | `LVD0-A` ve `LVD0-B` en **1000 kilitli** (08.09) | Bölünmüş gözlere ait **hayalet kararlar**; bugün uykuda, LVD0 kilidi kalkınca ikisi 1000+1000 = 2000 mm dayatır |
| `switchboard_placements` | `T14` ve `U30` ikisi de `order_in_rail = 15`, pinned (09.09 09:54) | İki sabitleme aynı indeksi istiyor; `T14` trafo (`zemin`) olduğu için artık çizilmiyor bile |
| `switchboard_approvals` | parmak izi `79006f50` (09:52:50) | Sabitlemeler onaydan SONRA yazıldı → onay eskimiş olmalı |
| `switchboard_settings` | boş | Ölçü tercihi kaydedilmemiş |

### 2.1 Aynı girdi, dört senaryo

| Senaryo | Sonuç | Ray yığını / plaka |
|---|---|---|
| **Temiz** (karar yok) | `LVD0-A` 1200×1800 (3 ray, %53) + `LVD0-B` 400×1800 (6 ray, %79) → toplam **1600 mm** | 1552 / 1650 · 1025 / 1650 |
| **Canlı** (1200 kilidi + 2 sabitleme) | `LVD0` **1200×1400**, 4 ray, **taşıyor** | **2313 / 1250** |
| Yalnız kilit | `LVD0` 1200×**2000**, 4 ray, sığıyor | 1760 / 1850 |
| Yalnız sabitleme | `LVD0-A` 1200 + `LVD0-B` 400 + `LVD0-C` 400 → **2000 mm**, üç göz | — |

Kullanıcının gördüğü ekran "canlı" senaryosudur: ekranda 1800 görünmesi canlı ayar/defterin yerel dökümden küçük farkı olabilir; taşma sayısı (2313 mm) birebir tutuyor. **Sorun tek bir hata değil, birbirini büyüten beş kusurdur.**

### 2.2 Kök sebepler (kanıtıyla)

| No | Kusur | Kanıt / yer | Etki |
|---|---|---|---|
| **T1** | **Sürükle-bırakın indeksi ile yerleştiricinin indeksi farklı sıraları sayıyor.** Ekran sırayı ÇİZİM sırasından türetiyor (`ic-view.tsx` `siraliAnahtarlar`, "SIRA ÇİZİM SIRASINDAN TÜRETİLİR"); yerleştirici ise `sirala()` sırasını sayıyor. PANO-37 md. 5 ile gelen first-fit, cihazları önceki raylara taşıdığı için iki sıra artık aynı değil. Temiz LVD0-A'da çizim sırası `U20 U30 U40 U50 Q12 F14 … F161 Q21 …`, çözücü sırası `U20 … Q12 Q21 Q30 Q40 Q50 F14 …`. | `layout.ts` `sirala`/`paketle`, `ic-view.tsx` | Kullanıcı bir cihazı A'nın yanına bırakır, cihaz B'nin yanına gider; tekrar sürükler, karmaşa büyür. 0026'daki iki sabitleme muhtemelen böyle doğdu. |
| **T2** | **Sabitleme indeksi tür (DIN/plaka) ve bölge bilmiyor.** `U30` (plaka sürücü) 15. sıraya oturunca giriş şalterlerinin arasına düşüyor ve orada **yeni bir plaka rayı** açılıyor (canlı: `ray2 plaka guc y=1392 h=806 :: U30 Q40 Q50 K91`). Aynı indeksi isteyen iki sabitleme sessizce kaydırılıyor. | `layout.ts` `sirala` | 806 mm'lik fazladan ray; taşmanın asıl kaynağı. |
| **T3** | **Kilitli en sığmayınca yükseklik araması en KÜÇÜK boya çöküyor.** `yukseklikSec`te hiçbir aday sığmadığında "daha az pano bırakan" kıyası eşitlikte ilk adayı (1400) tutuyor. Yalnız-kilit senaryosu 2000'de sığarken canlıda 1400 seçildi. | `layout.ts` `yukseklikSec` son döngü | Sığabilecek bir pano taşıyor gösteriliyor. |
| **T4** | **Bölgesi `null` olan cihaz sıralamada en başa geçiyor** (`ZONE_ORDER.indexOf(null) = -1`). 0026'da `S162` (termostat, defterde `din`, bölge yok) ilk DIN rayını **en üstte** açıyor; first-fit yüzünden bütün DIN cihazları (giriş, motor, kumanda) o raya doluyor ve sürücülerin ÜSTÜNE çıkıyor. PANO-37 md. 3 ("sürücüler en üstte") fiilen bozuk. | `layout.ts` `siralaTuretilmis`, canlı `ray0 din kumanda y=25 … 27 cihaz` | Bölge sırası ve ray etiketi ("Kumanda" yazan rayda giriş şalterleri) yanlış. |
| **T5** | **Tam genişlik ray modeli uzun sürücünün yanını boş bırakıyor.** `U20` 290×922 (+100/100 ısı payı) 1182 mm'lik bir satır açıyor; aynı satırdaki `U30/U40/U50` 546 mm. Üçünün altında **≈ 436 × 633 mm = 0,28 m² ölü alan** kalıyor — LVD0-B'nin bütün DIN yığını (250 mm × 1025 mm) buraya sığar. Bu yüzden 0026 iki göz (1600 mm) istiyor; tek 1200 mm gövde yetmeli. | `layout.ts` `paketle` (raf modeli), `LVD0-A.svg` | Fazladan bir 400 mm göz; imalatçıya gereksiz gövde. |
| **T6** | **Hayalet kararlar.** Bölünmüş göz kodlarına (`LVD0-A`, `LVD0-B`) yazılan kilitler, bölme değişince anlamsızlaşıyor ama silinmiyor ve hiçbir ekranda görünmüyor. `movePlacement` bu tuzağı sıra için kapatmış ("PANO KODUNA DOKUNULMAZ"), `savePanel` kapatmamış. | DB kayıtları, `actions.ts` | LVD0 kilidi kalkınca 1000+1000 sürprizi. |
| **T7** | **Uyarılar ve kararlar görünmez.** "Ray yüksekliği 2363 mm; plakada 1250 mm var" ve "En 1200 kilitli" uyarıları Panolar tablosunda **`title` ipucunda** ("1 uyarı"); Özet'te yok. Sabitlenmiş cihazlar yalnız tıklanan baloncukta görünüyor. Hiçbir yerde "bu projede 3 kilit, 2 sabitleme var" listesi yok. | `pano-view.tsx` Panolar/Özet | Kullanıcı sorunun kendi kararlarından doğduğunu göremiyor. |
| **T8** | **Efsane (renk grubu) satırı üst üste biniyor.** Sığmayan öğe `ex = sol`a döndürülüyor ama `ey` ilerlemiyor; dar gövdede (400 mm) ikinci öğe birincinin üstüne yazılıyor. Ekran görüntüsünde ve `LVD0-B.png`de görünür. | `panoLayout.ts` `panoIcYerlesim` efsane döngüsü | Okunmaz etiketler. |
| **T9** | **Küçük cihazlarda numara/etiket çakışıyor**; 1:4'te 15,8 mm'lik röleler 4 birim: numara 6 pt yazı 4 birime sığmaz ama `w >= EN_KUCUK_NUMARA (7)` eşiği tek tek değil rakam sayısına bakmadan geçiyor; iki basamaklı numaralar komşuya taşıyor ("1 2 3 … 21" görüntüsü). | `panoLayout.ts` etiket kuralı | Şema kalabalık. |
| **T10** | **Çift kapakta iki kulp da aynı kenarda** (`kulpX` iki dalı aynı ifade). | `panoLayout.ts:435` | Dizilim çizimi yanlış detay. |
| **T11** | **Yan ekipman soru işaretli kutular** (`R24…R54` fren dirençleri ölçüsüz) diziliminin yarısını kaplıyor; bilgi taşımıyor. | `dizilim.png` | Şemanın ana konusu bastırılıyor. |
| **T12** | **Ekran akışı** beş sekme + ayrı iç yerleşim sayfası + ölçü defteri; Özet'te altı düğme karışık (kaydet / yeniden yerleştir / defter / SVG / PDF / onayla); "Aygıt kuyruğu", "Doluluk", "parmak izi", "Denetim … birim" terimleri; iç yerleşimde aygıt düzeltme formu yalnız listeden seçince beliriyor. | `pano-view.tsx`, `ic-view.tsx`, `parcalar.tsx` | "Sayfalar anlaşılır değil." |
| **T13** | **Kod yapısı:** `layout.ts` sıralama+paketleme+çözüm+bölme+dizi tek dosyada; `panoLayout.ts` dizilim+iç yerleşim+vuruş kutuları+semboller; `pano-view.tsx`te `savePanel` yükü üç kez kopyalanmış; `parcalar.tsx`te 22 kullanılmayan içe aktarım (eslint uyarısı). Testler temiz: 23 dosya / 318 test geçiyor. | eslint çıktısı | Değişiklik maliyeti yüksek; hata yüzeyi geniş. |

**Değerlendirme:** T1+T2 kullanıcı kararlarını zehirliyor, T3+T6+T7 zehirlenmeyi görünmez kılıyor, T4+T5 temiz sonucu bile gereğinden büyük yapıyor. Sıra bu yüzden şöyle: **önce görünürlük ve karar hijyeni, sonra sabitleme, sonra paketleme, en son ekran düzeni.** Paketlemeyi önce yapmak, hatalı sabitlemelerin üstüne yeni bir algoritma koymak olurdu.

---

## 3. Sinan'ın karara bağlayacağı sorular (K0'da)

Bunlar kodu değil davranışı belirler; K0 kontrol fazında cevaplanmadan F2'ye geçilmez. Her soruya bir öneri yazıldı; öneri kabul edilirse ayrıca konuşmaya gerek yok.

| No | Soru | Öneri |
|---|---|---|
| S1 | Kilitli enli pano sığmıyorsa ne olsun? (a) yine bölünmesin, yükseklik büyüsün ve kırmızı uyarı; (b) bölünsün ve kilit yalnız ilk göze uygulansın; (c) kullanıcıya iki düğme. | **(a)** + Özet'te kırmızı şerit "LVD0 1200 kilidiyle sığmıyor — kilidi kaldır / 2000 seç". Kilit bir karardır, sistem ezmez (PANO-9). |
| S2 | Bölünmüş göz koduna (`LVD0-A`) verilen kilit/kapak kararı ne olsun? (a) yazılamasın; (b) yazılsın ama göz yok olunca ekranda "uykuda karar" olarak görünsün ve tek tıkla silinsin. | **(b)** — kullanıcı bölünmüş gözün kapağını seçebilmeli; uykuda karar görünür ve silinebilir olur. |
| S3 | Sürükle-bırak farklı türe (DIN ↔ plaka) bırakılırsa? (a) reddet ve söyle; (b) montaj tipini değiştir. | **(a)** — montaj tipi fizik, sürükleme sıradır. Tip değişikliği aygıt formundan yapılır. |
| S4 | Sürücü yanındaki boşluğa DIN rayı açılsın mı (sütunlu yerleşim, T5)? Gerçek panolarda 90 kW sürücü yanına DIN rayı çekilir mi, yoksa sürücü kendi gözünde mi kalır? | **Evet, ısı payı korunarak:** sürücünün SAĞINDA kalan bölge DIN rayı alır; sürücü sütununun altına/üstüne pay (100 mm) bırakılır. Termik itiraz varsa bu bir AYAR olur (`sideColumnsAllowed`). |
| S5 | Bölge sırası: sürücü en üstte kalsın (PANO-37 md. 3), giriş şalteri (Q12 ana şalter) nereye? | Sürücü sütunu üstte; ana şalter DIN bölgesinin en başında (bugünkü kural). |
| S6 | 0026'daki hatalı kararlar (LVD0 1200 kilidi, hayalet A/B kilitleri, T14/U30 sabitlemeleri) temizlensin mi? | **Evet, F1'de ekrandan "Kararlar" panelinden — migration değil**; kullanıcı görüp kendisi kaldırır ya da bana onay verir. |
| S7 | Yan ekipman (fren direnci) dizilimde soru işaretli kutu yerine dizinin altında liste olsun mu? | **Liste**; ölçüsü bilinen varsa kutu da çizilir. |
| S8 | Hedef: 0026 oda dizisi tek gövde **1200×2000×400** mü, yoksa 1200+400 iki göz mü? Kabul ölçütü bu sayıya bağlanacak. | Tek gövde 1200 (F4 sonunda ölçülür; 1800'e sığarsa daha iyi). |

---

## 4. Fazlar ve kontrol fazları

Gösterim: **F** uygulama fazı, **K** kontrol fazı. Kontrol fazı bir "bakış" değil ölçümdür: sayı yazılır, görüntü alınır, kullanıcıya gösterilir; onay gelmeden bir sonraki F başlamaz. Her F sonunda `npx vitest run src/lib/switchboard src/lib/diagrams`, `npx tsc --noEmit`, değişen ekran varsa `npm run build` ve `/dev/pano-preview` (değişmez md. 11).

### F0 — Ölçüm altyapısı (yarım gün)

Amaç: canlı durumu yerelde yeniden üretebilmek; her fazın "önce/sonra" sayısı aynı komutla çıksın.

- `scripts/switchboard-live-dump.py` (salt okunur, pooler yolu, `cad-db-check.py` deseni): verilen iş no için `electrical_parts`, `electrical_device_models`, `switchboard_panels`, `switchboard_placements`, `switchboard_settings`, `switchboard_approvals` → `.tmp/pano/<is>/…json`. Şirket verisi repoya girmez (`.tmp` gitignore'lu).
- `scripts/test-switchboard-layout.ts`e `--kararlar <klasör>` seçeneği: pano/aygıt kararlarını ve ayarı okuyup `computeSwitchboardLayout`a verir; çıktıya **ray başına** satır (`ray0 din kumanda y=25 h=185 used=1044/1050 :: …`) ve **ölü alan** (plaka alanı − cihaz alanı − kanal alanı, m²) eklenir.
- `--png` seçeneği (mevcut `sharp` bağımlılığıyla): SVG'ler PNG'ye çevrilir; kontrol fazlarında görüntü kanıtı budur.
- Çıkış ölçütü: `--is 0026-01 --kararlar .tmp/pano/0026-01` komutu **2313 mm taşmayı** yerelde üretir (canlıyla aynı sayı); `0019-00` temiz çıktısı bugünkü sayılarla bit-aynı (19 göz / 11.100 mm).

### K0 — Teşhis ve kararların onayı

- Bu belgenin 2. ve 3. bölümü kullanıcıyla gözden geçirilir; S1–S8 cevaplanır.
- Kanıt: F0 çıktısı (dört senaryo tablosu), `LVD0-A/B.png`, canlı karar tablosu.
- Çıkış: S1–S8 yazılı; kabul matrisindeki hedef sayılar (bölüm 5) kesinleşir.

### F1 — Karar hijyeni ve görünürlük (1 gün)

Amaç: kullanıcı verdiği her kararı ve sistemin her uyarısını tek yerde görsün; hatalı kararı geri alabilsin. Algoritmaya dokunulmaz.

- **Kararlar paneli** (ana sayfada yeni bölüm, "Kararlar"): pano kilitleri (en/yükseklik/derinlik/kapak/tür), aygıt sabitlemeleri (sıra), aygıt düzeltmeleri (montaj/bölge/pano/ölçü), ölçü tercihleri. Her satırda **"Kaldır"**. Bugünkü dizide karşılığı olmayan karar (`LVD0-A` kilidi) **"uykuda"** rozetiyle listelenir (S2).
- **Uyarı şeridi** Özet'in en üstünde: taşan pano, kilitli-sığmayan pano, ölçüsüz cihaz sayısı, onay eskidi. Panolar tablosundaki `title` ipucu kalkar; uyarı metni satırın altına açık yazılır.
- `savePanel` çağrılarındaki üç kopya yük tek yardımcıya (`panoKarariYukle(karar, degisiklik)`) iner.
- T3 düzeltmesi (kilitli en sığmıyorsa en BÜYÜK boy seçilir, "daha az pano bırakan" kıyası boy eşitliğinde büyüğü tutar) — küçük, güvenli, kullanıcıyı hemen rahatlatır.
- Veri: yeni tablo yok. `switchboard_panels`/`placements` mevcut sütunları yeter.
- Çıkış ölçütü: 0026'da panel 3 kilit + 2 sabitleme gösterir; hepsi ekrandan kaldırılabilir; kaldırıldığında sonuç "temiz" senaryoya döner (1600 mm). Uyarı şeridi taşmayı Özet'te yazar.

### K1 — Karar hijyeni kontrolü

- Tarayıcıda (dev sunucu, 0026): ekran görüntüsü ile Kararlar paneli, uyarı şeridi. Kullanıcı 0026'nın hatalı kararlarını kendisi kaldırır ya da bana "kaldır" der (S6).
- Ölçüm: temizlik sonrası `--kararlar` ile 1600 mm / 0 taşma; 0019 değişmedi.
- Çıkış: kullanıcı "kararlarımı görüyorum ve geri alabiliyorum" der.

### F2 — Sabitleme modelinin düzeltilmesi (1,5 gün)

Amaç: T1, T2, T4. Sürükleme, kullanıcının gördüğü komşuluğu yazsın; yerleştirici aynı komşuluğu okusun.

- **Tek sıra kaynağı:** yerleştirici `PanelLayout`a `order: string[]` (çözücünün nihai aygıt sırası, tür ve ray bilgisiyle) yazar; ekran sırayı çizimden TÜRETMEZ, buradan okur. `birakmaIndeksi` bu listeye göre çalışır.
- **Tür-içi sıra:** sabitleme `order_in_rail` yerine iki alan taşır: `anchor_device_key` (komşu) + `anchor_side` (`once`/`sonra`). Komşu aynı türden (DIN/plaka) olmalıdır; değilse `movePlacement` reddeder ve ekranda "DIN cihazı plakaya taşınamaz; montaj tipini aygıt formundan değiştirin" der (S3). Eski `order_in_rail` kayıtları okunmaya devam eder (geriye uyum) ama yenisi yazılmaz; F1'deki panel eskileri "eski biçim" rozetiyle gösterir.
- Çakışan sabitlemeler belirsizlik bırakmaz: aynı komşuya iki cihaz bağlanırsa doğal kod sırası ayırır ve bu **Kararlar panelinde görünür**.
- **Bölgesiz cihaz** (`zone === null`) kendi ailesinin bölgesine düşer (`iklim` → `kumanda`), asla `-1` ile öne geçmez (T4). `mount.ts`teki kategori kuralına `zone` zorunlu yapılır; defterde bölgesi boş satırlar için migration **gerekmez** (kural kazanır) — ama `pano-defter-mount-tuzagi` hatırlatması: defterdeki `zone` doluysa o kazanır, `select zone, count(*)` ile bakılır.
- Migration: `switchboard_placements`e `anchor_device_key text null`, `anchor_side text null` (tek dosya, aynı gün damga çakışması `ls supabase/migrations` ile doğrulanır; uygulama bende — `[[migration-uygulamasi-bende]]`).
- Testler: `layout.test.ts`e "sürükleme sonrası sıra ekrandaki komşuluğu verir" (order dizisi ile), "farklı türe bırakma reddedilir", "bölgesiz cihaz öne geçmez"; `is0026.guard.test.ts`e `S162` satırı.
- Çıkış ölçütü: 0026'da `U30`u `U20`nun sağına sürükleyince `U20 U30 U40 U50` olur ve yeni ray AÇILMAZ; toplam en değişmez.

### K2 — Sabitleme kontrolü (kullanıcıyla birlikte)

- Kullanıcı üç sürükleme yapar (aynı ray içinde, farklı raya, farklı türe); her birinin sonucu ekranda ve `--kararlar` çıktısında yazılır.
- Ölçüm: hiçbir sürükleme ray sayısını artırmaz; determinizm ("aynı plan") korunur.
- Çıkış: kullanıcı "bıraktığım yere gidiyor" der.

### F3 — Paketleme: bölge sırası, ray etiketi, ısı payı (1 gün)

Amaç: sütunlu modele geçmeden raf modelinin görünen kusurlarını kapatmak; F4'ün karşılaştırma tabanını netleştirmek.

- **Ray etiketi baskın bölgeye göre** yazılır (rayda en çok en kaplayan bölge), tek cihazlık ilk rayın etiketi değil.
- **First-fit yalnız GERİYE, ama bölge sırasını bozmayan raya:** bir DIN cihazı, kendi bölgesinden SONRAKİ bölgeye ait bir rayın üstündeki raya gidemez (giriş şalteri kumanda rayının altına düşmez). Kural: aday ray, cihazın bölgesinden küçük-eşit bölgeli olmalı.
- **Isı payı model bazlı:** `electrical_device_models.clearance_top/bottom` doluysa o; yoksa aile öntanımı (sürücü 100/100, reaktör 50/50, öteki 0). Bugün yalnız `surucu || plaka` → 100/100; `Q12` gibi plakaya vidalanan 105×165 şalter 200 mm pay almıyor (doğru) ama `K91` kontaktör plaka ise alıyor mu kontrol edilir (bugün 0 — defterden geliyor, iyi).
- **Klemens şeridi** için dilim etiketi ve alt raya devam mantığı korunur (0019 gerilemesi).
- Çıkış ölçütü: 0026 temiz çıktıda DIN rayları sürücülerin ALTINDA; ray etiketleri içerikle tutarlı; 0019 oda dizisi 19 göz / 11.100 mm ±0.

### F4 — Paketleme: sütunlu yerleşim (2–3 gün, en riskli faz)

Amaç: T5. Uzun plaka cihazının yanındaki ölü alanı DIN raylarına açmak; 0026'yı tek gövdeye indirmek.

- **Model:** plaka bir **bölge ağacı**dır (giyotin kesim). Kök bölge = ray kapasitesi × plaka boyu. Plaka cihazları (sürücü, reaktör) boyca büyükten küçüğe **sol sütuna** dizilir; her sürücünün sağında kalan dikdörtgen (kalan en × sürücü boyu) alt bölge olur. DIN rayları bölgelere **sırayla** (bölge ağacında yukarıdan aşağı, soldan sağa) yerleşir; bir ray bir bölgenin tam enini kullanır (ray yine yataydır, PANO-4 korunur — yalnız boyu bölgenin eni kadardır).
- **Kısıtlar:** bölge eni < `minRailMm` (öntanım 200 mm) ise ray açılmaz (kanal + bir kontaktör sığmaz); sürücü sütununun sağında `sideDuctMm` kadar dikey kanal bırakılır (kablo iniş yolu); ısı payı sütunun üstünde/altında korunur (S4).
- **Determinizm:** bölge ağacı yalnız cihaz boyutlarından ve sıradan üretilir; rastgelelik yok. `Placement.railIndex` korunur; `Rail`e `xMm` ve `regionId` eklenir (bugün ray `x=0` varsayıyor).
- **Denetçi** (`audit.ts`) bölge-farkındalıklı olur: (1) hiçbir iki yerleşim 2B'de çakışmaz (yalnız aynı raydakiler değil), (2) her ray kendi bölgesinin içinde, (3) her bölge plakanın içinde, (4) eksiksizlik (mevcut). "Ray satırları üst üste binmiyor" denetimi bölge içinde çalışır.
- **Çizim:** `panoIcYerlesim` rayı `rail.xMm`den başlatır ve `rail.capacityMm` kadar çizer; dikey kanal her sütun sınırında çizilir. Vuruş kutuları aynı geçişten gelir (PANO-29).
- **Bölme (`splitPanel`)** öncelik sırası değişmez; ama bölmeden önce artık sütunlu deneme yapıldığı için 0026'da bölme hiç gerekmemeli.
- **Ayar:** `columnsEnabled` (öntanım açık) — kapatılırsa bugünkü raf modeli aynen çalışır; 0019 gerilemesi bu anahtarla ölçülür, sonra açık hâliyle de ölçülür ve iki sayı yazılır.
- Testler: `sutun.test.ts` — (a) tek uzun sürücü + 20 röle → röleler sürücünün sağında, toplam yükseklik sürücü boyu; (b) sürücü sağı 150 mm ise ray açılmaz; (c) sütun kapalı iken eski çıktı bit-aynı; (d) denetçi 2B çakışmayı yakalar (bilerek bozuk yerleşim).
- Çıkış ölçütü: **0026 oda dizisi tek göz 1200 mm, taşma yok, denetim 0 hata** (S8'e göre 1800 ya da 2000). 0019: göz sayısı ≤ 19, toplam en ≤ 11.100 mm, klemens şeritleri hâlâ bölünüyor ve tamam.

### K3 — Paketleme kontrolü

- Ölçüm tablosu (0026 ve 0019, sütun açık/kapalı): göz sayısı, toplam en, ray yığını, ölü alan m², denetim sonucu. PNG'ler yan yana (önce/sonra).
- Kullanıcı 0026 iç yerleşimini pano ustası gözüyle okur: kablo iniş yolu, sürücü soğuma payı, ana şalter yeri. "Gerçekte böyle dizerdik" denmezse F4 ayarla (`minRailMm`, kanal) geri alınır ya da düzeltilir.
- Çıkış: kabul matrisi (bölüm 5) satır 1–6 yeşil.

### F5 — Çizim düzeltmeleri (1 gün)

- T8 efsane sarması (satır atlar, `ey` ilerler; `fitDiagram` çerçeveyi büyütür).
- T9 etiket merdiveni: rakam sayısına göre eşik (`String(n).length * 3.4`), sığmazsa numarasız; numara sığmayan cihazlar için ray sonuna **"+N cihaz, listede"** notu.
- T10 kulp yerleri (çift kapakta ortaya bakar).
- T11 yan ekipman: ölçüsü olmayan yan ekipman kutu yerine dizinin altında liste (S7); ölçüsü olan kutu kalır.
- Ray etiketi ve bölge ayırıcı çizgi baskın bölgeye göre (F3 verisini kullanır).
- Taşma çizimi (PANO-37 md. 8) korunur ve sütunlu modelde bölge bazında çalışır.
- PDF (`pdf/pano-layout.tsx`) ve el kitabı ucu (`manual/[revId]/semalar/pano`) aynı çizim fonksiyonlarını kullandığı için otomatik düzelir; `panoKitap.test.ts` ve `pano-sema-sigar.guard.test.ts` geçmeli.
- Çıkış ölçütü: 0026 ve 0019 SVG'lerinde çakışan metin yok (`resolveTextOverlaps` sonrası kalan çakışma sayısı betikle ölçülür — `[[sema-kalite-cubugu]]` yaklaşımı); PNG'ler kontrol fazına gider.

### F6 — Ekran akışı (2 gün)

Amaç: T12. İki sayfa bir akışa oturur; kullanıcı nerede olduğunu ve sonra ne yapacağını görür.

Yeni bölüm düzeni (aynı adres, aynı yerel sekme mantığı — PANO-30):

| Bölüm | İçerik | Bugünkü karşılığı |
|---|---|---|
| **1 · Girdi** | Belge/revizyon, okundu mu, ölçü defteri eksikleri (kaç ürün, hangileri, "Ölçü Defteri" bağı), sınıflanmamış ürün | Özet'in yarısı + Aygıt kuyruğu'nun sorun kovaları |
| **2 · Panolar** | Dizilim şeması + pano **kartları** (kod, ölçü, kapak, mini şema, uyarılar AÇIK metin, "İç yerleşimi aç"); ölçü tercihleri (yükseklik/derinlik/baza) buradaki bir çekmecede | Dizilim + Panolar tablosu + Özet'in ölçü grubu |
| **3 · Kararlar** | F1 paneli: kilitler, sabitlemeler, düzeltmeler, uykuda kararlar; "Yeniden Yerleştir" burada, ne sildiğini yazarak | Yeniden Yerleştir düğmesi (dağınık) |
| **4 · Onay ve çıktı** | Denetim listesi (geçenler dahil), pano dışı aygıtlar (saha/ürünsüz — "doğru davranış" açıklamasıyla), SVG/PDF, Onayla/Onayı Kaldır, parmak izi "değişiklik izi" adıyla | Denetim + Aygıt kuyruğu + Özet düğmeleri |

- İç yerleşim sayfası kalır (kullanıcı kararı 08.09) ama üst şeridi sadeleşir: pano seçici, ölçek, "SVG", geri. Aygıt formu (montaj/bölge/pano) baloncuğun içine "Düzenle" olarak alınır; ayrı gizli form kalkar. Sürükleme ipucu ilk açılışta bir kez gösterilir, sonra kısa satır.
- Terimler: "Aygıt kuyruğu" → "Panoya girmeyenler"; "Doluluk" → "Ray kullanımı"; "parmak izi" → "değişiklik izi"; "Denetim" başlığı "Yerleşim denetimi — N kontrol" olur.
- Mobil/tablet alt barı (Plan 013, MOBIL-35) aynı dört bölümü verir; `SectionBottomBar` öğeleri yeni bölüm adlarını alır.
- Kod: `pano-view.tsx` dört bölüm bileşenine bölünür (`bolumler/girdi.tsx`, `panolar.tsx`, `kararlar.tsx`, `onay.tsx`); `parcalar.tsx` yalnız gerçekten paylaşılanları tutar (ölçü seçici, cihaz listesi, ölçü diyalogu); kullanılmayan içe aktarımlar temizlenir.
- `/dev/pano-preview` iki fikstürle (0019 benzeri çok panolu, 0026 benzeri tek panolu) yeni bölümleri gösterir.
- Çıkış ölçütü: `impeccable` denetimi (bilişsel yük, hiyerarşi, boş/hatalı durum) uygulanır; her bölümde "sonraki adım" tek bir belirgin eylemdir; eslint 0 uyarı.

### K4 — Ekran kontrolü (kullanıcıyla)

- Dev sunucuda 0026 ve 0019; masaüstü + tablet (1024) + telefon ekran görüntüleri (`resize_window`); koyu tema.
- Kullanıcı senaryosu: "Elektrik projesi yeni okundu → panoyu görüp onaylamaya kadar" akışı hiç açıklama almadan yürütülür; takıldığı her yer not edilir.
- Çıkış: kullanıcı akışı tek başına tamamlar; "anlaşılır" der ya da eksik listesi F6'ya döner.

### F7 — Kod yapısı ve dokümantasyon (1 gün)

- `src/lib/switchboard/layout.ts` → `layout/sirala.ts` (sıra + sabitleme), `layout/bolge.ts` (bölge ağacı, F4), `layout/paketle.ts`, `layout/coz.ts` (`solvePanel`, `splitPanel`), `layout/dizi.ts` (`solveLineup`, yükseklik/derinlik seçimi); `layout.ts` yalnız yeniden dışa aktarır (mevcut içe aktarımlar kırılmaz).
- `src/lib/diagrams/panoLayout.ts` → `pano/semboller.ts`, `pano/dizilim.ts`, `pano/icYerlesim.ts`, `pano/efsane.ts`; `panoLayout.ts` yeniden dışa aktarır (`svg.ts` `switch`i ve el kitabı ucu değişmez, PANO-16).
- `actions.ts`: pano/aygıt/ölçü/onay eylemleri dört dosyaya; ortak yetki kapısı tek yerde.
- Testler dosya yapısını izler; `identity.guard`, `mount.sql.guard`, `sizes.guard` dokunulmaz.
- `docs/agent/panoyerlesimi.md`: yeni kurallar **PANO-38** (tek sıra kaynağı ve komşuya bağlı sabitleme), **PANO-39** (bölge ağacı / sütunlu yerleşim ve denetçinin 2B çakışma kuralı), **PANO-40** (kararlar görünür ve geri alınabilir; uykuda karar), **PANO-41** (kilitli en sığmazsa en büyük boy, bölünmez); PANO-23/31 metinleri güncellenir; PANO-37 md. 5 first-fit kuralına bölge sınırı eklenir. Kapsam satırına yeni dosyalar yazılır. `.claude/skills/pano-olcu-turu/SKILL.md` ölçüm komutuna `--kararlar` eklenir.
- Hafıza: `orion-pano-yerlesimi` notu güncellenir.
- Çıkış ölçütü: `tsc`, eslint (0 uyarı bu alanda), 318+ test, `npm run build`; `git diff --stat` ile taşınan dosyaların yalnız taşındığı (mantık değişikliği yok) doğrulanır.

### K5 — Kapanış kontrolü

- Tam kabul matrisi (bölüm 5) doldurulur; canlıda 0026 açılır, PDF indirilir, el kitabı şema ucu çalışır.
- Kullanıcı 0026'yı onaylar (onay parmak izi yeni). Bir sonraki iş için "ölçü turu" skill'i yeni komutla çalışır.

---

## 5. Kabul ve test matrisi

| # | Ölçüt | Nasıl ölçülür | Hedef |
|---|---|---|---|
| 1 | 0026 canlı kararlar yerelde yeniden üretilir | `--kararlar` çıktısı | 2313 mm taşma birebir (F0) |
| 2 | 0026 temiz oda dizisi | göz sayısı / toplam en | 2 göz 1600 → **1 göz 1200** (F4) |
| 3 | 0026 ölü alan | m² (plaka − cihaz − kanal) | %40'tan fazla azalma (F4) |
| 4 | 0019 gerilemesi | göz / en / klemens dilimleri | ≤ 19 göz, ≤ 11.100 mm, sütun kapalıyken bit-aynı |
| 5 | Denetim | `auditLineup` | 0 hata; 2B çakışma denetimi bilerek bozuk fikstürde ✗ verir |
| 6 | Determinizm | betik "aynı plan" satırı | her fazda |
| 7 | Sürükleme doğruluğu | K2'de üç sürükleme | bırakılan komşuluk = çözücünün komşuluğu; ray sayısı artmaz |
| 8 | Kilitli-sığmayan | 1200 kilidi ile 0026 | en büyük boy seçilir, kırmızı şerit çıkar, bölünmez (S1) |
| 9 | Kararlar görünür | ekran | 3 kilit + 2 sabitleme listede, uykuda rozetiyle; hepsi kaldırılabilir |
| 10 | Metin çakışması | SVG çakışma sayacı | 0026 ve 0019'da 0 |
| 11 | Ekran akışı | K4 senaryosu | kullanıcı yardımsız onaya ulaşır |
| 12 | Kalite kapısı | `tsc` · eslint · vitest · `npm run build` | hepsi temiz; eslint bu alanda 0 uyarı |
| 13 | Dış uçlar | `/pano/pdf`, `/pano/svg`, `/manual/[rev]/semalar/pano` | çalışır; `panoKitap`, `pano-sema-sigar.guard` geçer |

---

## 6. Riskler ve karşılıkları

| Risk | Karşılık |
|---|---|
| Sütunlu yerleşim gerçek pano pratiğine uymaz (termik, kablo yolu) | `columnsEnabled` ayarı; K3'te kullanıcı okur; kapatılınca eski davranış bit-aynı |
| 0019 gibi klemens ağırlıklı işte bölge ağacı şeritleri parçalar | Klemens şeridi dilimleme kuralı bölge eninden bağımsız test edilir; 0019 sayıları kabul kapısı |
| Eski `order_in_rail` sabitlemeleri yeni modelle çelişir | Geriye uyumlu okuma + panelde "eski biçim" rozeti; kullanıcı kaldırır |
| Defterdeki `zone`/`mount_type` kuralı ezer (bilinen tuzak) | F2/F3'te `select mount_type, zone, count(*)` bakılır; gerekirse tek migration |
| Eş zamanlı oturum aynı dosyalara yazıyor (bugün `git status`ta katalog/otomatik seçim dosyaları değişik) | Pano kapsamı dışındaki dosyalara dokunulmaz; commit'ler yalnız pano dosyalarını içerir (`[[es-zamanli-oturum-kurali]]`) |
| `tmp/` altındaki altı proje kopyası | `tsconfig` `tmp`yi dışlıyor; yine de `npm run build` her kontrol fazında koşar |
| Migration damgası çakışması | `ls supabase/migrations` aynı gün kontrolü; uygulama bende, `db push` kullanılmaz |

---

## 7. Dosya haritası (hedef)

```
src/lib/switchboard/
  layout.ts                 → yeniden dışa aktarım (API sabit)
  layout/sirala.ts          sıra + komşuya bağlı sabitleme (F2)
  layout/bolge.ts           bölge ağacı, giyotin kesim (F4)
  layout/paketle.ts         raylara dağıtım, iki geçiş (F3/F4)
  layout/coz.ts             solvePanel · splitPanel
  layout/dizi.ts            solveLineup · yükseklik/derinlik seçimi (T3 düzeltmesi)
  audit.ts                  2B çakışma + bölge içi denetimler (F4)
  types.ts                  Rail.xMm · Rail.regionId · PanelLayout.order · anchor alanları
src/lib/diagrams/
  panoLayout.ts             → yeniden dışa aktarım
  pano/semboller.ts · pano/dizilim.ts · pano/icYerlesim.ts · pano/efsane.ts
src/app/(app)/projects/[id]/pano/
  pano-view.tsx             kabuk + bölüm seçimi
  bolumler/girdi.tsx · panolar.tsx · kararlar.tsx · onay.tsx
  ic/ic-view.tsx            sadeleşmiş üst şerit, baloncuk içinde düzenleme
  actions/pano.ts · aygit.ts · olcu.ts · onay.ts
scripts/
  switchboard-live-dump.py  salt okunur canlı döküm (F0)
  test-switchboard-layout.ts  --kararlar · --png · ray/ölü alan çıktısı
supabase/migrations/
  2026MMDD…_switchboard_anchor.sql  (F2, tek dosya)
```

---

## 8. Sıra ve süre

F0 (0,5 g) → K0 → F1 (1 g) → K1 → F2 (1,5 g) → K2 → F3 (1 g) → F4 (2–3 g) → K3 → F5 (1 g) → F6 (2 g) → K4 → F7 (1 g) → K5.
Toplam yaklaşık **10–11 iş günü** uygulama + 6 kontrol noktası. F3 ve F4 aynı commit dizisinde ama ayrı ölçümle gider; F5 F4'e bağlıdır (ray `xMm`); F6 F1'e bağlıdır (Kararlar paneli); F7 hepsinden sonra.

Acele yok: her kontrol fazında kullanıcı onayı beklenir; onay gelmeden bir sonraki uygulama fazına geçilmez.

---

## 9. Uygulama durumu (13.09.2026)

Kullanıcı "kalan fazlar varsa gerçekleştir" dedi; S1–S8 için plandaki öneriler esas alındı (S6: 0026'nın canlı kararlarına DOKUNULMADI — Kararlar bölümünden kullanıcı kaldırır).

| Faz | Durum | Kanıt |
|---|---|---|
| F0 | tamam | `switchboard-live-dump.py`, `test-switchboard-layout.ts --kararlar/--kararsiz/--png`, ray başına satır, ölü alan. Canlı 0026 yerelde **2313/1250** ile birebir üretildi. |
| K0 | ölçüldü | Bölüm 2 tabloları; karar önerileri uygulandı |
| F1 | tamam | Uyarı şeridi (`bolumler/uyari-seridi.tsx`), Kararlar bölümü, `panoKarariYuku`, T3 (PANO-41) |
| K1 | dev önizleme | `/dev/pano-preview` örnek kararlarla: kilit, uykuda kilit, sabitleme üç rozetle görünür ve kaldırılabilir |
| F2 | tamam | `anchor_device_key`/`anchor_side` (migration `20260913043000`, canlıda uygulandı), `layout/sirala.ts`, `birakmaHedefi`, `movePlacement`, tür sınırı `toast`; `sabitleme.test.ts` |
| K2 | birim testi | 9 test: komşuluk çözümde aynen, zincir, komşusuz uyarı, DIN↔plaka reddi, T4 |
| F3 | tamam | Baskın bölge etiketi, bölgesiz aygıt `kumanda`; ısı payı zaten defterden |
| F4 | tamam | `layout/paketle.ts` bant + cep; `columnsEnabled`; 2B denetçi; `sutun.test.ts` |
| K3 | ölçüldü | 0026 temiz: **2 göz 1600 mm → 1 göz 1200×1800**, ölü alan 1,05 → 0,71 m², denetim 0 hata. 0019: 19 göz 11.100 → 11.000 mm, denetim 0 hata, determinizm aynı. Canlı kararlarla (eski biçim U30 pini) 2000'de 2038/1850 taşıyor ve şerit kilidi gösteriyor. |
| F5 | tamam | Efsane sarma (T8), rakam sayısına göre numara (T9), kulp (T10), ölçüsüz yan ekipman listede (T11), cep rayı ve sütun kanalı çizimi |
| F6 | tamam | Dört bölüm: Girdi · Panolar · Kararlar · Onay ve çıktı; kartlar; `pano-view.tsx` kabuk; alt bar |
| K4 | dev önizleme | Dört bölüm ekran görüntüsüyle doğrulandı; kullanıcı senaryosu (yardımsız onay) kullanıcıya kaldı |
| F7 | tamam | `layout/` bölme, `layout.ts` yeniden dışa aktarım; PANO-38…41; `komutlar.md`; skill; eslint 0 uyarı |
| K5 | kısmen | tsc temiz, 25 dosya / 337 test yeşil; `npm run build` ve canlı 0026 turu kullanıcı oturumunda tamamlanır |

**Ek düzeltme (planda yoktu):** eksiksizlik denetimi kuyruğa düşen (ölçüsüz/sığmadı) aygıtı beklenen kümede tutuyordu ve her ölçüsüz cihazda kırmızıya boyanıyordu; gerçek kaybı gölgeleyen bu davranış `compute.ts`te düzeltildi.

**Kullanıcıya kalan:** 0026'da Kararlar bölümünden `LVD0` 1200 kilidini, `LVD0-A`/`LVD0-B` uykuda kilitlerini ve `T14`/`U30` eski biçim sabitlemelerini kaldırmak; sonucu (tek 1200×1800 gövde) onaylamak.
