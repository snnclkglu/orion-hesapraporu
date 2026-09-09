# Hızlı otomatik seçim — ortak editör ve teklif entegrasyonu incelemesi

Tarih: 08.09.2026. Bu not yalnız yerel kaynak kodu/doküman incelemesidir. Uygulama kodu, veritabanı ve canlı kayıtlar değiştirilmedi; migration dosyalarının canlı ortama uygulanmış olduğu varsayılmadı.

## 1. Mimari karar

Yeni özellik `RevisionEditor` içinde bir kez kurulmalıdır. Teklif Hesap Raporları için ikinci algoritma veya küçültülmüş formül seti gerekmez. Buna karşılık **Teklif Hesap Raporları**, **müşteriye gönderilen teklif belgesi** ve **maliyet çalışması** bugün üç ayrı veri akışıdır. Birincide otomatik seçim yapmak diğer ikisini kendiliğinden doldurmaz. Bunlar için ayrıca kimlikli, sürümlü, kullanıcı denetimindeki aktarım gerekir.

| Akış | Bugünkü gerçek kaynak | Entegrasyon kararı |
|---|---|---|
| Mühendislik raporu | `projects.report_context=engineering` + `revisions` | Ortak seçim servisi ve editör düğmesi |
| Teklif hesap raporu | `projects.report_context=offer` + aynı `revisions` | Aynı servis, farklı yetki ve gezinme |
| Teklif teknik tablosu | `offer_revisions.payload.items[].groups[].rows[]` | Rapor seçiminden kanonik satır/parça eşleyicisi; formül kopyası yok |
| Maliyet | `offer_cost_revisions`, bağımsız M0/M1 zinciri | Rapor kaynaklı miktar/seçim snapshot'ı; maliyet modelinin tahminiyle karıştırılmaz |
| Ekipman listesi | `buildEquipmentGroups(CalcInput, …)` | Mevcut adet/alternatif/gizleme kurallarını tekrar yazmadan kullan |

Kanıtlar: `src/app/(app)/offers/hesap-raporlari/[id]/revisions/[revId]/page.tsx:1`, `src/app/(app)/projects/[id]/revisions/[revId]/page.tsx:1`, `src/lib/report-context.ts:1`, `docs/agent/hesap.md:1261`, `docs/agent/teklif.md:1523`, `src/lib/offers/types.ts:96`, `docs/agent/maliyet.md:10`.

## 2. Ortak düğme ve marka penceresi

Somut yer `revision-editor.tsx:2224` içindeki `renderSpecs`, `CardTitle` içindeki “Teknik Özellikler” metninin yanıdır (`:2233`). Tek düğme her iki bağlamda görünür; yazma yetkisi/draft durumu ayrı denetlenir. Masaüstünde başlığın yanında, dar ekranda kendi satırına katlanmalı; mevcut 44 px dokunma, 16 px girdi ve `dvh` pencere kuralları kullanılmalıdır.

Önerilen akış:

1. **Hızlı otomatik seçim** düğmesi, o anki kaydedilmemiş teknik özellikler dahil tam editör snapshot'ını sabitler. Marka penceresi yalnız aktif topolojideki ekipmanları gösterir.
2. Varsayılan görünüm: kaldırma/yürütme motoru, redüktör, çalışma freni, varsa emniyet freni, motor/tambur/teker kaplinleri; ardından halat, rulman, tampon, varsa sürücü ve elektrik ekipmanları. Bir markayı bütün uygun eksenlere uygulamak kolay, eksen bazlı istisna vermek mümkün olmalı.
3. Marka seçimi `offer_options.brand.*` serbest metin defterinden değil, gerçekten seçilebilir `cat_equipment` satırlarının tür/uygulama uyumundan oluşmalı. Teklif defterinde yazılabilen bir marka o ekipman türünde doğrulanmış ürün var demek değildir.
4. Marka tercihi **zorunlu marka / sıralı tercih / serbest** anlamını taşımalı. Zorunlu marka içinde ürün yoksa başka marka sessizce seçilmemeli; sonuç “bu marka ve sınırlar içinde aday yok” olmalı.
5. “Hesap raporunu oluştur” işlemi React alanlarını tek tek tıklayan otomasyon çalıştırmaz. Bağımsız bir aday snapshot üzerinde sırayla hesap/eleme/geri besleme yapar; ilerleme, iptal, eksik veri ve kısıt gerekçeleri görünür.
6. Seçilen kapsamın tamamı için doğrulanan tutarlı aday, aynı “Hesap raporunu oluştur” eylemi sonunda tek editör işlemiyle çalışma taslağına uygulanır; ikinci zorunlu onay ekranı açılmaz. Sonuç özeti hangi seçimlerin değiştiğini ve hangi kullanıcı kararlarının korunduğunu gösterir. Eksik/kısmi sonuç başarı veya otomatik uygulama sayılmaz: mevcut çalışma taslağı korunur, tamamlanması gereken alanlar açıklanır. Kullanıcı mevcut alanlarda düzenlemeye devam eder. Tek adım geri al gerekir. Hesabı oluşturmak yayım anlamına gelmez.

Katalog arayüzü bugün marka → kilitli facet → ürün zinciri kurar (`src/components/catalog-picker.tsx:1`, `:179`, `:221`). Sayfalama 1.000 satır, üst sınır 50.000'dir (`:44`, `:56`, `:74`); `fetchAllPages` hata alınca kısmi satırlarla döner (`:81`). Seçim servisi bunu “tam katalog” kabul edemez: katalog erişimi hata/tamamlandı/kırpıldı durumlarını ayırmalı, aday evreni tam değilse optimum iddiası üretmemeli.

## 3. Kullanıcı gibi seçim yapmanın doğru kod karşılığı

Bugünkü alan değişikliği yalnız sayıyı yazmaz:

- `writeModule` bütün modül türetmelerini yeniler; köprü teker adedi değişince ölçüm teyidini kaldırır (`revision-editor.tsx:1689`).
- `setModuleSelections` ray ailesi/kodunu eşler, teker çapı değişince redüktör oranı otomatiğini yeniden açar, bağlı rulman markalarını yayar (`:1718`).
- Katalog seçimi tür dönüştürür, rulman değişince uyumsuz yatağı temizler, tampon değişince eski eğrileri temizler, yazılan katalog değerinin otomatiğini kapatır (`:3203`).
- Aktif alternatif kayıtta canlı seçimden yeniden eşitlenir (`:1946`).
- Teknik özellik değişimi topolojide yeni olanaklı modülleri açar (`:1870`).

Bu kurallar saf bir `applySelectionDecision`/`applyCatalogSelection` komut katmanına çıkarılmalı; manuel editör ve toplu seçim aynı komutu çağırmalıdır. React callback'lerini sıralı çağırmak yarış/eskimiş closure üretir; JSON'a doğrudan `selections` yaması yapmak ise yukarıdaki davranışları atlar.

`applyCatalogPick` sadece gelen alanları yazar; eksik katalog alanını atlar (`src/lib/catalog-mapping.ts:1440`, `:1454`). Editör mevcut seçimi bununla birleştirir (`revision-editor.tsx:3213`). Dolayısıyla genel otomatik seçim için her ürün türünde **ürünün sahip olduğu alanlar** tanımlanmalı: yeni üründe bulunmayan eski ürün verisi silinmeli veya bilinmiyor durumuna alınmalı. Aksi halde yeni marka/model ile önceki üründen kalan moment/ölçü/ağırlık birleşebilir. Yeni ürünün ham kimliği, doğrulanmış nitelik snapshot'ı, kaynak/katalog sürümü ve alan bazlı köken de tutulmalı.

## 4. Snapshot, kaydetme ve eşzamanlılık ön koşulları

| Bulgu | Kanıt | Etki / gerekli çözüm |
|---|---|---|
| `saveRevision` JSON'u baştan kuruyor | `actions.ts:290`, `:361`, `:378` | Yeni `autoSelection` köken/kilit/çalıştırma kaydı açık bir codec ile load/save/copy/export/import yollarından geçmezse ilk Kaydet'te kaybolur. `fileImport` için mevcut özel koruma aynı geçmiş sorunu belgeler (`:330`). |
| Kaydetme karşılaştırmalı sürüm kontrolü taşımıyor | `actions.ts:385` yalnız `id`, `:386` yalnız `status=draft` | İki sekme/iki kullanıcı son yazan kazanır. `expectedVersion` veya `expectedUpdatedAt` ile atomik compare-and-swap gerekir. |
| Update hedefi proje kimliğiyle bağlanmıyor | `actions.ts:339-340` okuma iki kimlikle; `:385-386` update tek kimlikle | Yeni endpoint revision/proje/bağlamı birlikte doğrulamalı. Bu RLS'i aşma kanıtı değildir; yanlış çağrıda kaynak/audit/proje kimliğinin ayrışma riskidir. |
| Kaydetme sürerken yeni düzenleme yapılınca cevap tüm formu temiz sayıyor | `revision-editor.tsx:2020`, `:2042` | Gönderilen editör sürümünden sonra değişiklik olmuşsa `dirty=false` yapılmamalı. Otomatik seçim de başladığı girdi sürümüne bağlı olmalı. |
| Üstteki Yayınla son kaydedilmiş sonucu kullanıyor | `revision-page-view.tsx:201`, `issue-button.tsx:57`, `actions.ts:48` | Seçim sonucu dirty iken eski raporun yayımlanması engellenmeli veya açık save-then-issue zinciri kurulmalı. Yeni özellik kendiliğinden yayınlamamalı. |
| Ağırlık kökeni kayıtta eksik taşınıyor | `RevisionWeightBreakdown.applied`: `revision-load.ts:120`; editör kaydetmesi `:2034` yalnız overrides/notes/serbest/ayakYuksekligiM geçiriyor | Otomatik seçim ağırlık kapatma döngüsü kuracaksa bu köken izi de kalıcı yazılıp round-trip testiyle korunmalı. |
| İlk mühendislik ve teklif revizyonu global son şablonu sorguluyor | `projects/actions.ts:354-360`, `:1114-1121` | Erişim rolüne göre görülen şablon kümesi farklı olabilir; kaynak şablon kimliği/sürümü seçim politikasında açık olmalı. Şablonda hazır gelen sayı kullanıcının verdiği kesin veri sayılmamalı. |

Buradaki kısaltılmış `actions.ts` = `src/app/(app)/projects/[id]/revisions/[revId]/actions.ts`; `revision-editor.tsx` ve `revision-page-view.tsx` aynı dizindedir.

Yeni alanların eski raporlar açılırken otomatikleşmesi yasak olmalı. Mevcut `keepManualValues`/`AUTO_FLAGS` deseni eski kayıtta eksik bayrağı manuel kabul eder (`src/lib/revision-load.ts:563`, `:642`, `:1080`). Kayıtlı yeni özelliğin codec'i ayrıca sürümlenmelidir. Açılışta otomatik seçim çalıştırılmaz; sadece kullanıcının düğmesi çalıştırır.

## 5. Yetki ve issued davranışı

- Mühendislik okuma: admin, manager, engineer; yazma: admin, engineer. Teklif ve teklif hesap raporu: admin, manager. `src/lib/roles.ts:155`, `:168`, `:181`, `:198`; SQL karşılığı `supabase/migrations/20260905000002_offer_win_and_engineering_v0_fix.sql:117`, `:160`, `:175`.
- Mevcut `RevisionEditor.readOnly` yalnız `status===issued` olarak kuruluyor (`revision-page-view.tsx:248`). Bu yüzden mühendislikte manager taslak alanlarını yazılabilir görüp kayıtta RLS reddi alabilir. Yeni düğme eklenirken ortak sayfaya `canEditContext` hesaplanmalı ve editör + Kaydet + Yayınla + yeni düğme aynı yetkiyi kullanmalı. RLS korunmalı; servis role anahtarı istemciye verilmemeli.
- 08.09.2026 tarihli `guard_issued_revision` dar geri çekme kapısı açmış: yalnız `status/issued_at/issued_by/updated_at` değişebilir; içerik aynı işlemde değişemez (`supabase/migrations/20260908000007_revision_withdraw.sql:20`). Otomatik seçim issued kaydı doğrudan değiştirmemeli. Yeni taslak revizyon veya kullanıcının ayrı “Geri çek” işlemi sonrasında çalışabilir.
- Uzun seçim işi için kalıcı çalışma tablosu kullanılırsa RLS rolünü kullanıcının başlangıç isteğiyle dondurmak yetmez; uygulama anında mevcut yetki, revision durumu ve kaynak sürüm tekrar kontrol edilmelidir. Mühendislikten fiyat/marj alanlarına erişim açılmaz.

## 6. Teklif teknik tablosuna aktarım için eksikler

Bugünkü `OfferItem` modelinde hesap raporu/revizyonuna bağlantı yok (`src/lib/offers/types.ts:96`). `OFFER_SUGGESTERS` boş, `itemBasics` kaldırma yüksekliği/hızı/sınıfını boş döndürüyor (`src/lib/offers/suggest.ts:35`, `:57`). Sadece bunu birkaç motor formülüyle doldurmak yeni ortak seçimi devre dışı bırakan ikinci hesap motoru yaratır.

Öneri: ayrı ilişki veya teknik kaynak modeli `offerRevisionId + offerItemId → calculationProjectId + calculationRevisionId + appliedRunId + inputDigest + mappingVersion` taşımalı. Sayı/marka/model `CalcInput` ve doğrulanmış seçim niteliklerinden kanonik `group.key/row.key/parts` alanlarına yazılmalı; metin benzerliği ile eşleme yapılmamalı. Yayınlanan teklif kendi metin snapshot'ını korur; daha sonra rapor değişirse yalnız “hesap kaynağı güncellendi” bildirimi doğar. Yeni aktarım kullanıcının eylemidir.

Aktarım **başlık, manuel satır, müşteri kapsamı, gizleme, özel satırlar ve fiyatı** korumalı. `OfferRow.manual` veya kullanıcı değiştirdiği part kilitliyse önce farkı göstermeli; satır bazında kabul/koru mümkün olmalı. `composeValue` ve `withAutoTitle` mevcut metin üretimini kullanmalı. `source` bugünkü manual/catalog/suggested ayrımından ileri köken gerektiriyorsa şema sürümünü ve bütün codec'leri birlikte genişletmek gerekir.

Somut ayrışmalar:

1. Maliyet teklif hızında aralık/çift hızın üst ucunu alıyor (`src/lib/offers/cost/payload.ts:284`, `src/lib/offers/cost/oku.ts:47`); mühendislik devir `singleNumber` ile iki sayıyı reddediyor (`src/lib/offers/job-transfer.ts:210`, `:299`). `1–6` aynı belgede maliyete 6, mühendisliğe “eksik” gider. Yeni özellik açık çalışma hızı/hız aralığı semantiği kurmalı, sessiz dönüştürmemeli.
2. Manuel teklif satırı eski `parts` nesnesini koruyor (`row-editor.tsx:175`); mühendislik devirdeki `part()` doğrudan `parts` okuyor, `manual` kontrolü yapmıyor (`job-transfer.ts:224`). Görünen değer elle “8 m/dak” yapılmış, eski `parts.range=4` ise teknik devir 4 alabilir. Ön aktarım doğrulaması manuel metin/kanonik sayı çelişkisini kullanıcı teyidi gerektiren durum saymalı.
3. Maliyet varsayılan sınıfı M5 (`src/lib/offers/cost/params.ts:27`), yeni rapor A6/M6/T6 (`src/lib/calc/defaults.ts:360`, `:389`); maliyet 40 °C ve sayılara varsayılan verir (`cost/payload.ts:82`). Bunlar bağımsız amaçlarla seçilmiş değerlerdir; otomatik seçimin ortak politika/girdi kökeni olmadan eşdeğer olduğu varsayılamaz.
4. Kazanılmış tekliften mühendislik V0'ına geçiş yalnız dar `TechnicalSpecs` beyaz listesini aktarır, motor/redüktör/teker/marka aktarmaz (`projects/actions.ts:399-405`, `job-transfer.ts:36`, `:672`). Bu bilinçli mevcut sınırdır (`docs/agent/hesap.md:1661`); yeni rapor bağlantısı üzerinden seçili ekipmanı devretmek ayrıca faz ve sürümleme gerektirir.

## 7. BOM ve maliyet aktarımı

`buildEquipmentGroups` halihazırda ekipmanları aktif modüllerden oluşturur, alternatifleri ekler, gizli alt bölümleri çıkarır ve ikiz kaldırma set çarpanını uygular (`src/lib/equipment-list.ts:1444`, `:1472`, `:1499`). Yeni BOM/adet hesabı tekrar yazılmamalı. Aktif ekipman ile alternatif satır satın alma/maliyet için ayrılmalı; alternatifler toplam miktara eklenmemeli. `rowKey` kalıcı eşleme için kullanılmalı, etiket metni kullanılmamalı.

Maliyet modeli açıkça tahmindir, standart doğrulaması değildir (`src/lib/offers/cost/model.ts:7`); halat/motor/teker seçimlerini kendi sıra ve tablolarından hesaplıyor (`:235`, `:263`, `:527`, `:667`). Hızlı otomatik seçimin kaynağı bu model olamaz. Rapor kaynaklı kesin katalog seçimi geldiğinde maliyet satırına `quantitySource=calculation` benzeri açık köken ve kaynak revizyon taşınmalı; tahmin modelinden yeniden motor/teker seçilerek gerçek sonuç ezilmemeli. Tahmin, seçilmemiş yapı/imalat kalemlerinde ayrı rozetle kullanılabilir.

Maliyet fiyatları otomatik uydurulmamalı. Mevcut model hiçbir katalog fiyatı okumuyor (`model.ts:3`); güncel fiyat bulunmadan “en ucuz çözüm” sözü verilemez. İlk fazın optimumu mühendisçe onaylanan güvenli yeterlilik + boyut/standart seri/sadelik tercih sıralaması olabilir. Fiyat optimizasyonu ayrı güncel fiyat/para birimi/teslim/tarih kapsamı gerektirir.

## 8. Fazlara yerleştirilecek kabul kriterleri

1. Aynı normalize edilmiş girdi, kısıt, katalog snapshot'ı ve politika sürümü mühendislik/teklif bağlamında aynı teknik sonucu ve karar izini verir; sadece yetki/yol değişir.
2. Marka penceresinde teknik olarak kapsam dışı eksen ve ekipman görünmez. Sabit yer vinci yürütme seçmez; yardımcı/monoray açıldığında ilgili aileler bağımsız çalışır.
3. Zorunlu marka aday vermezse açıkça çözümsüz döner. Eksik/kırpılmış katalogla “optimum” veya tam uygun denmez. Katalog hatası kısmi kayıt bırakmaz.
4. Toplu ve manuel aynı seçim komutunu kullanınca katalog alanları, ray/oran otomatikleri, uyumsuz yatak temizliği ve rulman marka bağı aynı sonuca ulaşır.
5. Eski snapshot aç/kaydet döngüsünde manuel değerler, alternatifler, notlar, gizleme, ağırlık kararları, AI dosya kökeni korunur; yeni özellik kendiliğinden çalışmaz.
6. Otomatik seçim başlamasından sonra teknik girdi değişirse eski sonuç uygulanmaz. Başka sekme/kullanıcı kaydetmiş veya raporu yayımlamışsa CAS reddi alınır, kullanıcı çalışması korunur.
7. Kullanıcı bir ekipmanı değiştirdiğinde yalnız bağımlı seçimler yeniden değerlendirme gerektirir; hiçbiri düğmeye basmadan sessizce katalogdan değiştirilmez. Seçilen kapsamın tamamı doğrulanmış yeni sonuç bir işlemde uygulanır ve bir işlemde geri alınabilir; eksik/kısmi sonuç çalışma taslağını değiştirmez. İkinci zorunlu onay ekranı yoktur.
8. Yetki matrisi UI + sunucu + RLS üzerinde sınanır. Manager teklif hesabı oluşturabilir, mühendislikte okuyabilir; engineer mühendislikte yazabilir, teklif fiyat/marjını okuyamaz. Issued içeriği seçim yoluyla değişmez.
9. Teklif aktarımı doğru kalem kimliğine, doğru kaynak revizyona gider; aynı başlıklı iki vinç karışmaz. Manuel satır/müşteri kapsamı/gizleme/fiyat korunur. Yeni kaynak eski teklif revizyonunun basılan metnini değiştirmez.
10. `1–6`, `4/1`, Türkçe ondalık, manuel metin ile eski parts çelişkisi ve yardımcı kapasite için aktarım testleri vardır; belirsiz değer sessizce sayıya çevrilmez.
11. BOM'da tek/çift tambur, ikiz kaldırma, çoklu motor, alternatif ve gizleme senaryoları mevcut ekipman listesiyle aynı miktarı verir. Aynı ürün iki farklı kaynaktan iki kez fiyatlanmaz.
12. Maliyet rapor kaynaklı motor/redüktör/teker seçimini ikinci tahminle değiştirmez; eski maliyet elle fiyat/miktar/kararları silinmez. Kaynak revizyon eskimesi görünürdür.
13. Auth'suz gerçek fikstürlü önizlemede düğme/pencere 320/375 px genişlikte yatay taşmaz; klavye, Esc, odak dönüşü ve iptal işlemleri çalışır.

## 9. Önerilen entegrasyon sırası

**Ön koşul:** ortak snapshot codec'i + bağlam yetkisi + CAS + saf seçim uygulama komutu. **İlk kullanım:** iki hesap raporu editöründe aynı düğme. **Sonraki faz:** teklif kalemi → teknik ön girdi → bağlı teklif hesap raporu → açık fark aktarımı. **Ardından:** ekipman/miktar → maliyet kaynak bağlantısı. **En son:** kazanılan teklifin bu kaynağından yeni mühendislik V0 önerisi; bağımsız arşivler ve mühendis incelemesi korunur.

Standart hesap sırası, güvenlik kontrolleri, katalog doğruluğu ve optimizasyon algoritması bu entegrasyon notunun dışında, ana teknik planın ayrı incelemeleridir.
