# Dizin haritası

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).


- `src/lib/calc/` — hesap motoru (saf): `engine.ts`, `modules/`, `beam.ts`,
  `shaftStress.ts`, `reeving.ts`, `derive.ts`, `hook-table.ts`, `coefficients.ts`,
  `plate-buckling.ts`, `tables.ts`, `types.ts`
- `src/lib/calc/modules/` — kaldırma, kanca bloğu, yürütme, **teker yükleri**
  (`wheelLoads.ts` — yol kirişine aktarılan kuvvetler), ana kiriş, buruşma,
  başkiriş, kabin ve elektrik odası (`cabin.ts`)
- `src/lib/calc/climate-load.ts` — mahal iklimlendirme yükü çekirdeği
  (psikrometri + zarf ısı geçişi + güneş-hava sıcaklığı)
- `src/lib/calc/drive-losses.ts` — ABB ACS880 sürücü atık ısısı tablosu
- `src/lib/calc/presentation/` — sunum tanımları: bölümler, alan metadata'sı,
  kontrol bağlantıları, modül erişimi
- `src/lib/standards/` — standart kayıt defteri (tablolar + bağıntılar)
- `src/lib/roles.ts` — SEKİZ kullanıcı rolü ve yetki soruları
  (`canSeeSales` · `canSeePurchasing` vb.), `DRAWING_AUTHOR_ROLES` (Teknik
  Resim Takibi'ndeki "Çizen" seçicisinin sırası) + `WORKSPACE_SECTIONS`: sol
  menünün ve `/admin/access` yetki matrisinin TEK kaynağı. Görev etiketleri
  (`profiles.tags`) 12.08.2026'da role dönüştü ve mekanizma kaldırıldı
- `src/lib/purchasing/` — Satın Alma ÇEKİRDEĞİ, **saf** (DB/HTTP yok):
  `demand.ts` (talep havuzu + `drawingCarpani` resim çarpanı) ·
  `order-no.ts` (tedarikçi kodundan sipariş numarası ÖNERİSİ + çakışma
  denetimi; öneri bir kilit değildir) ·
  `terms.ts` (ödeme koşulu, avans, ödeme/teslim günü, dönem gruplama, avro,
  `DELIVERY_WEEKS` hızlı termin) ·
  `vat.ts` (KDV oranları ve üç toplam — sipariş ve sarf ORTAK kullanır) ·
  `talep.ts` (TEKLİF TALEBİ: kalem kümesinin kanonik imzası — otomatik
  eşleşmenin tek dayanağı; türetilmiş ad; `teklifMiktari` — havuz mu teklif mi
  konuşur) ·
  `siparis-turu.ts` (siparişin hammadde/ekipman/karma türü satırlarından
  TÜRETİLİR — ton açıları, süzgeç kuralı «karma ikisine de girer», kilo
  toplamı) ·
  `consumables.ts` (dense ay/yıl serisi, grup matrisi, anomali ve tedarikçi
  drilldown) · `consumable-key.ts` (SM tekillik anahtarı) ·
  `package-summary.ts` (Teknik Resimler'in SALT OKUNUR paket özeti: durum
  çıkarımı ve gecikme; fiyat/tedarikçi taşımaz) ·
  `hammadde/` HAMMADDE alt çekirdeği (aşağıda ayrıca)
- `src/lib/purchasing/hammadde/` — HAMMADDE ÇEKİRDEĞİ, **saf** (DB/HTTP/React yok):
  `siniflar.ts` (beş sınıf + DİĞER, OKLCH tonları, özkütle sözlüğü, kalite
  ayıklama, stok boyları, plaka/pay sabitleri) · `cozumle.ts` (AYIKLAMA
  DİLBİLGİSİNİN TAMAMI — tek kural yeri) · `havuz.ts` (stok kalemi birleştirme,
  çarpan, 1B boy planı `boyaYerlestir`, `adediCoz`) · `nesting.ts` (2B sac
  plaka yerleşimi, MaxRects-BSSF + `yerlesimiDenetle` + `yerlesimDenetimi`) ·
  `karsilastirma.ts` (teklif matrisi: satır kalem, sütun tedarikçi; bölünmüş
  ve tek firmalı toplamlar) · `profil-kesitleri.ts`
  (ÜRETİLMİŞ — `python scripts/gen-profile-sections.py`, 477 kesit kg/m)
- `src/lib/diagrams/nesting.ts` — plaka kesim planı çizimi (web + PDF ortak model)
- `src/lib/purchasing/hammadde/olcu-duzelt.ts` — KESİM PARÇASININ ölçü
  düzeltmesi (saf): tanımdaki doğru sayı jetonunu bulup değiştirir; saklanan
  şey sayı değil TANIMdır
- `src/lib/purchasing/hammadde/alim-analizi.ts` — SAC · PROFİL · RAY alım
  analizi çekirdeği (saf): ağırlıklı ortalama, yıl × kategori matrisi, yoğun
  aylık seri, kalem ve tedarikçi kırılımı, stok adından kategori çözücüsü
- `src/app/(app)/purchasing/hammadde/` — Hammadde Havuzu: `data.ts` (imalat
  satırları okuma katmanı — ekipman havuzunun AYNADAKİ görüntüsü) · `raw-table.tsx`
  (tür kipi + değişken ölçü bloğu) · `raw-dialogs.tsx` (taşı/düzenle + yeni talep)
  · `yerlesim/` (plaka yerleşimi + alınacak plaka özeti + denetim; parametreler
  adreste, `yerlesim/pdf/` kesim planı belgesi) · `teklifler/` (TEKLİFLER:
  `page.tsx` okuma + talep gruplaması · `quotes-view.tsx` liste ·
  `request-dialog.tsx` firma karşılaştırma matrisi + ayır/birleştir/sipariş ·
  `batch-dialog.tsx` bir firmanın teklifini düzenle · `types.ts` ortak
  sözleşme) · `export/` (Excel:
  havuz + kesim listesi; PDF: fiyatsız hammadde talebi)
- `src/lib/pdf/nesting-plan.tsx` — A4 YATAY kesim planı: alınacak plakalar,
  denetim özeti, plaka çizimleri ve parça listesi
- `src/lib/drawings/normalize.ts` — ham depo tanımı → standart satın alma
  tanımı (saf, değişmez); ayrıca ana grup kodu ve grup adı çıkarımı
- `src/lib/panel.ts` — AÇILIŞ PANOSU çekirdeği, **saf**: arama eşleşmesi
  (`trKatla` ile Türkçe katlama), tür sırası, gün adı ve ±30 günlük bantlama,
  sinyal süzgeci (sıfır sayan sinyal listeye girmez)
- `src/app/(app)/page.tsx` + `panel/` — giriş sonrası açılış panosu (`/`):
  `data.ts` rol bazlı okuma · `panel-view.tsx` görünüm (önizlemeyle ORTAK) ·
  `panel-search.tsx` istemci araması (Ctrl/⌘ K)
- `src/lib/electrical/` — ELEKTRİK PROJESİ ÇEKİRDEĞİ, **saf**:
  `types.ts` · `parts-list.ts` (malzeme listesi okuyucusu — sütun kenarları
  VERİDEN kümelenir, başlıklarla MONOTON eşlenir) · `device-tag.ts`
  (IEC 81346: `=` tesis · `+` konum · `-` aygıt) · `sheet-index.ts` (yer imi
  ağacındaki "Page list" kökü) · `title-block.ts` (kapak künyesi; şekil
  denetimi tarih şekilli bir değeri isim saymaz) · `rollup.ts` (panel/tedarikçi
  dökümü ve `materialRows` — 726 aygıt satırı → 187 malzeme).
  `read-pdf.ts` çekirdeğin PARÇASI DEĞİLDİR: `unpdf` ile besleyen Node
  adaptörüdür. `data.ts` Supabase okuma katmanı (sorgu SAYFALANIR)
- `src/app/(app)/projects/[id]/electrical/` — Elektrik Projesi sekmesi:
  `electrical-card.tsx` (yükleme · künye · üç görünüm: malzeme/aygıt/sayfalar) ·
  `actions.ts` (kayıt, güncel sürüm seçimi, silme) · `import/route.ts` (PDF'i
  OKUYAN uç; satırlar yeniden ÜRETİLİR) · `export/route.ts` (iki sayfalı Excel)
- `src/lib/project-specs.ts` + `[id]/spec-actions.ts` + `[id]/spec-button.tsx` —
  ŞARTNAME: eylem şeridinde yoksa KIRMIZI "Şartnameyi Yükle", varsa sakin
  "Şartname" (basılınca imzalı bağlantıyla açılır)
- `src/lib/manual/` — İŞLETME VE BAKIM EL KİTABI ÇEKİRDEĞİ, **saf**:
  `types.ts` (bölüm ağacı · altı blok türü · yedi ek türü · künye) ·
  `template.ts` (14 ana bölümlük şablon ve STANDART METİNLER — vince özel
  hiçbir sayı YOK) · `payload.ts` (`withManualDefaults` taşıma,
  **`printedManual` — gizleme süzgecinin TEK yeri**, `numberManual` 1·1.1 ve
  EK-A·EK-B zincirleri) · `sources.ts` (otomatik blokların saf çözücüsü) ·
  `naming.ts` (belge adı ve `ORC-BK-…` kodu) · `data.ts` okuma katmanı
- `src/app/(app)/projects/[id]/manual/` — El Kitabı sekmesi ve editörü:
  `manual-card.tsx` (revizyon defteri + KAYNAK ŞERİDİ) · `actions.ts` (aç,
  kaydet, yayımla — yayımda otomatik tablolar DONAR, yeni revizyon onları
  ÇÖZER) · `sources-data.ts` (sunucu adaptörü: hesap raporu · elektrik projesi ·
  resim defteri) · `[revId]/manual-editor.tsx` (bölüm bölüm sihirbaz) ·
  `[revId]/gorsel/route.ts` (görsel SUNUCUDA yeniden kodlanır) ·
  `[revId]/pdf/route.ts` (`?ekler=1` → tam sürüm)
- `src/lib/pdf/manual.tsx` — el kitabı gövdesi; `manualAppendixOrder` ek
  sırasının TEK kaynağıdır (`pdfEkleriYerlestir` sözleşmesi)
- `src/lib/product-portal/` — VİNÇ KİMLİĞİ VE MÜŞTERİ PORTALI çekirdeği:
  `identity.ts` (proje kaynakları + alan bazlı override) · `nameplate.ts`
  (240 × 160 mm SVG ve Q seviyeli QR, ekran/baskı tek geometri) ·
  `secrets.ts` (scrypt parola, oturum ve hash) · `data-server.ts` (otomatik
  belge adayları) · `materialize-server.ts` (yayımda PDF snapshot) ·
  `access-server.ts` (public DTO, oturum ve dosya allowlist'i)
- `src/app/(app)/projects/[id]/product-portal/` — Mühendislik sekmesindeki
  **Vinç Kimliği** yönetimi: A/B/C fiziksel üniteler, kimlik
  override/gizleme, belge seçimi ve özel PDF, parola yenileme, yayımlama,
  birebir plaka/müşteri önizlemesi ve baskı SVG ucu
- `src/app/(public)/paylas/vinc/` + `src/components/customer-portal/` — iç
  uygulama kabuğundan bağımsız, noindex, parola korumalı müşteri doküman
  portalı; dosya bazında filigranlı görüntüleme veya açık indirme
- `src/lib/offers/` — TEKLİF ÇEKİRDEĞİ, **saf** (DB/HTTP/React yok):
  `types.ts` (belge modeli: kapak · kalem · grup · satır · fiyat) ·
  `registry.ts` (grup/satır/parça defteri — firmanın on dört gerçek teklifinden
  çıkarıldı; liste anahtarları defterin KENDİSİNDEN türetilir) ·
  `compose.ts` (parçalardan değer derleme; elle yazılan değer EZİLMEZ) ·
  `payload.ts` (boş belge, `withDefaults` taşıma, **`printedPayload` — gizleme
  süzgecinin TEK yeri**) · `pricing.ts` (toplam, toplama girmeyen satır, KDV
  cümlesi) · `no.ts` (`TETR-YYYYMMDD-N`, revizyon etiketi) · `status.ts` ·
  `lang.ts` · `filter.ts` (liste süzgeci + sıralama, TEK tanım) ·
  `takip.ts` (gönderimden bu yana geçen süre; 14 güne kadar gün, sonrası hafta;
  sarı→kırmızı ton) · `analiz.ts` (kazanma puanı, ağırlıklı projeksiyon, aylık
  yoğun seri) · `copy.ts` (başka müşteriye kopyalama) · `suggest.ts` (öneri
  altyapısı — bugün BOŞ, yeri hazır)
- `src/app/(app)/offers/` — Teklif (Yönetici · Müdür): `page.tsx` **teklif
  takibi listesi** (süzgeçler, müşteri renkli satırlar, takip sayacı) ·
  `data.ts` ORTAK okuma katmanı · `[id]/` teklif paneli (revizyon zinciri, PDF
  İndir / PDF İndir ve Yayımla / pop-up önizleme) ·
  `[id]/revisions/[revId]/` **EDİTÖR** (bölüm rayı, kalem/grup/satır düzenleme,
  üç düzeyde gizleme) ve `pdf/` belge ucu (`?inline=1` önizleme) ·
  `analiz/` sıcaklık puanı ve projeksiyon · `tanimlar/` marka ve ticari şart
  defteri
- `src/app/(app)/offers/hesap-raporlari/` — Teklif aşamasındaki hesap raporu
  listesi + detay/editör/ekipman/PDF rota kabukları. Hesap kodu burada
  kopyalanmaz; `projects` altındaki ortak görünümleri ve `lib/calc` motorunu
  kullanır, yalnız `projects.report_context = 'offer'` kayıtlarını gösterir.
- `src/lib/pdf/offer.tsx` — TEKLİF BELGESİ: kapak (KİMDEN/KİME) → kalem başına
  teknik sayfalar → test yükü → ticari blok → tek şemalı fiyat tablosu →
  notlar → kapsam dışı; altbilgi künyesi her sayfada
- `src/lib/currency.ts` — para birimleri, tr-TR sayı okuma/biçimleme
- `src/lib/tags.ts` + `src/components/tags.tsx` — pastel etiket dili (müşteri
  kısaltması/rengi, satış kapsamı); renk TANIMI `globals.css` `.oc-tag`
- `src/lib/use-stored-flag.ts` — tarayıcıda kalıcı aç/kapa tercihi
  (`useSyncExternalStore`; ilk boyamada doğru genişlik, hidrasyon uyumlu)
- `src/app/(app)/projects/projects-table.tsx` — Mühendislik listesi: hızlı
  süzgeçler (yıl · müşteri · durum) + proje adı araması. **Arşivli proje AYRI
  BİR EKRANDA DEĞİLDİR**: aynı listede kalır, "Arşiv" rozetiyle görünür ve
  Durum süzgeciyle ayrılır — arşivlemek bir silme değil bir işarettir. Yıl
  varsayılanı "Tümü"dür (İşler'in aksine, orada bu yıl): iki yıl önceki bir
  vincin raporuna revizyon açmak sıradan bir iştir ve süzgeç onu gizlerse
  kullanıcı raporu silinmiş sanır
- `src/components/editable-combobox.tsx` — hem yazılan hem seçilen alan
  (serbest metin + öneri listesi); `combobox.tsx` ile KARIŞTIRILMAZ, orada
  değer yalnız listeden seçilir
- `src/app/(app)/sales/` — Satış Takibi (Yönetici + Müdür): `data.ts` ekran ve
  belge için ORTAK okuma katmanı · `is-listesi/` müşteriye giden **Güncel İş
  Listesi** PDF ucu (fiyatsız) · `job-list-button.tsx` başlık şeridindeki eylem
- `src/app/(app)/worklog/` — İş Takibi (Yönetici + Müdür): günlük giriş ·
  `analysis/` grafik panosu · `records/` kayıt listesi · `export/` Excel ucu ·
  `filters.ts` üç ekranın ortak süzgeç tanımı
- `src/lib/personnel/` — Personel ÇEKİRDEĞİ, **saf** (DB/HTTP yok):
  `payroll.ts` (fazla mesai bağıntısı, dönem özeti, kıdem, `donemIzinRapor` —
  izin/rapor saatinin kişi mi devralınan ay değeri mi olduğuna karar veren tek
  yer) · `salary-plan.ts` (zam aritmetiği, yuvarlama adımı, bir dönemde
  geçerli ücret, plandan sapma) · `bordro.ts`
  (brüt↔net, kümülatif vergi matrahı, asgari ücret istisnası, saatlik
  maliyet) · `employee.ts` (kategori/belge/sözleşme sözlükleri, TC doğrulama,
  belge geçerliliği, depo yolu kuralı)
- `src/lib/fx/` — döviz kuru, bölümden BAĞIMSIZ: `rates.ts` (aylık ortalama,
  parite, eksik gün penceresi) · `source.ts` uygulamadaki TEK dış servis
  çağrısı (TCMB XML + Frankfurter JSON, timeout + üstel bekleme) ·
  `refresh.ts` iki çağıranın (server action + cron) ortak yolu
- `src/app/(app)/personnel/` — Personel (Yönetici + Müdür): `page.tsx` personel
  listesi · `[id]/` personel profili + özlük dosyaları · `ucret/` **Ücret
  Planı** (yıl başı zammı + yıl içi ayarlama; maaşı besleyen karar defteri) ·
  `maas/` aylık maaş girişi · `ozet/` analiz · `harcirah/` tarife ·
  `kurlar/` ortalama kurlar ·
  `bordro/` ücret bordrosu PDF'i (tek kişi ya da `&hepsi=1` ile dönemin
  tamamı) · `export/` Excel ucu · `document-actions.ts` özlük dosyası
  yükleme/silme/imzalı bağlantı
- `src/app/api/cron/fx/` — aylık otomatik kur tazeleme (Vercel Cron;
  `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` ister, `proxy.ts`te muaf)
- `docs/personel-kur-kaynagi.md` — kur kaynağının seçim gerekçesi (TCMB ↔ ECB
  ölçümü), parite kuralı, dönem kurunun otomatik yazılması ve cron kurulumu
- `src/lib/drawings/` — Teknik Resimler ÇEKİRDEĞİ, **saf** (DB/HTTP yok):
  `recognize` · `folder-name` · `file-name` · `part-code` · `tr-text` ·
  `excel` · `reconcile` · `titleblock` · `dxf-header` · `derive` · `diff` ·
  `revision` · `progress` · `types` · `labels` · `mime` · `standard`
- `src/app/(app)/drawings/` — paket listesi, yükleme sihirbazı
  (`new/` — akış modül düzeyindedir, md. 18) ve paketin altı bölümü: Genel
  Bakış (montaj ağacı) · Dosyalar (gezgin) · Parçalar (defter) · **Satın Alma
  (SALT OKUNUR özet)** · Üretim · İçe Aktarım Raporu · Sürümler; ayrıca aşama
  defteri. Satın Alma sekmesi 12.08.2026'da önce bir İŞLEM ekranı olarak
  KALDIRILDI, sonra bir PENCERE olarak döndü: sipariş/teklif/işaret hâlâ yalnız
  `/purchasing`te yazılır (md. 21), bu sekme yalnız "geldi mi, ne zaman gelir"i
  gösterir ve fiyat/tedarikçi TAŞIMAZ. `[id]/import/` içerik okuma ucu (Node
  çalışma zamanı), `[id]/export/` türev çıktılar
- `docs/teknik-resim-adlandirma-onerileri.md` — ressama ÖNERİLER (Ö-1…Ö-9).
  Kural listesi DEĞİL kazanç listesidir; hiçbir madde bir yüklemeyi engellemez
  ve `lib/drawings/standard.ts` ile iki yönlü koruma testine bağlıdır
- `src/lib/work-log.ts` — İş Takibi sözlüğü + saf toplama/pivot/dönem çekirdeği
- `src/components/charts.tsx` — pano grafikleri (zaman serisi, sıralı çubuk,
  halka, ısı haritası, özet kartı); `lib/diagrams` ile KARIŞTIRILMAZ
- `src/components/combobox.tsx` — aranabilir tek seçimli liste (Türkçe süzgeç)
- `src/app/(app)/purchasing/` — Satın Alma (Yönetici · Satın Alma · Planlama
  ROLLERİ): `data.ts` proje alımlarının ORTAK okuma katmanı · `page.tsx` EKİPMAN
  talep havuzu · `hammadde/` HAMMADDE havuzu + plaka yerleşimi (md. 24) ·
  `siparisler/` (TEK sipariş ekranı — hammadde ve ekipman birlikte; tür süzgeci
  ve satır rengi) · `teslimat/` · `fiyatlar/` · `sarf/` (hızlı giriş + sunucu
  kayıt listesi + EUR analiz) · `export/` Excel ucu
- `src/app/(app)/admin/access/` — YETKİ IZGARASI (rol × bölüm, üç değerli
  hücre) + kişi matrisi; hesaplanır, elle yazılmaz ve EKRANDAN
  DEĞİŞTİRİLMEZ (md. 15'teki gerekçe). `access-grid.tsx` görünüm,
  `page.tsx` yalnız kişileri okur — `/dev/access-preview` aynı görünümü
  auth'suz basar
- `src/app/(app)/jobs/[id]/drawing-qty-card.tsx` — resim çarpanı ve kalem
  eşleştirme kartı (iş emri formunda DEĞİL: orada satır kimlikleri her
  kaydetmede değişir ve eşleştirme bağı kopardı)
- `src/app/(app)/admin/customers/` — müşteri defteri yönetimi (kısaltma + renk)
- `src/app/(app)/admin/suppliers/` — TEDARİKÇİ DEFTERİ yönetimi (kod, pasife
  çekme, kullanım izi). Defterin YERİ buradadır ama KAPISI Satın Alma'dır:
  yeni firma teklif/sipariş penceresinden de açılır (md. 21)
- `src/app/(app)/admin/consumables/` — SARF MALZEME DEFTERİ yönetimi (SM kodu,
  grup, varsayılan birim, kullanım izi, pasif); yeni tanım hızlı sarf girişinden
  de açılır
- `src/app/(app)/katalog/` — oturumlu iç katalog görüntüleyici
- `src/app/(public)/paylas/` — üyelik istemeyen müşteri kapısı: katalog
  yaprağı ve iptal edilebilir tek-PDF teknik resim bağlantıları; ekipman
  listesi, Excel ve PDF ekipman ADINDAN açık katalog sayfasına bağlanır
- `src/app/dev/*-preview/` — auth'suz görsel önizleme sayfaları (yalnız
  development; production'da 404): **açılış panosu** (`/dev/panel-preview` —
  yönetici ve teknik ressam rollerini ÜST ÜSTE basar; rol bazlı bir ekranı tek
  rolle sınamak, kesilen tarafı hiç görmemektir), kabuk, editör, işler, satış, ekipman listesi,
  **mühendislik listesi** (`/dev/projects-preview` — kabuğu ÇİZMEZ ama kenar
  çubuğunun YERİNİ birebir taklit eder: kırılım sınıfları pencereye bakar, sütuna
  kalan yer ise kaba ve ikisi 1024px'te ayrışır — kabuğu gerçekten çizseydi
  `isWide` yolu tutmaz ve sayfa `max-w-6xl`e düşerdi, MOBIL-16),
  **iş takibi** (`/dev/worklog-preview` — üç ekranı sahte veriyle üst üste basar),
  **hammadde** (`/dev/hammadde-preview` — havuz + plaka yerleşimi + TEKLİFLER;
  fikstür GERÇEK 0053 LITEC satırlarıdır, uydurma küçük sayılarla 12 m'lik bir
  plakanın ne yaptığı görülmez; teklif fikstürü ise kullanıcının kendi çalışma
  dosyasının sayılarıdır — 266.240 · 261.165 · 298.685 — ve
  `karsilastirma.test.ts` ile AYNI gerçeği gösterir),
  **siparişler** (`/dev/siparisler-preview` — üç türü de basar: hammadde ·
  ekipman · karma; tek türlü bir fikstür renk ayrımının çalıştığını
  gösteremez),
  **personel** (`/dev/personnel-preview` — altı ekranı üst üste basar; fikstür
  GERÇEK büyüklüklerdedir: 71.000 ₺'lik maaş ve 48.753,33 ₺'lik mesai tutarı
  sütuna sığıyor mu, uydurma küçük sayılarla bu görülmezdi)
- `src/lib/diagrams/` — parametrik teknik resimler (saf veri modeli; web + PDF ortak)
- `src/lib/pdf/`, `src/lib/excel/` — rapor, ekipman listesi ve iş takibi çıktıları
- `src/lib/pdf/diagram.tsx` — `Diagram` modelinin react-pdf çevirisi ve
  `PdfDiagram` kabı. TEK ÇEVİRİCİ: hesap raporu, ekipman listesi ve kesim planı
  aynı dosyayı kullanır (ikinci kopya `circle`/`bold`/çizgi ucunu düşürüyordu)
- `src/lib/equipment-drawing-note.ts` — teknik ressam özetinin "Notlar"
  bölümünün okuma katmanı (`equipment_drawing_notes`); panel ve indirme ucu
  aynı fonksiyondan okur
- `catalog-sheets/` — üretici katalog sayfalarının kesilmiş görüntüleri
  (üretilir; `public/` altında değildir, `/api/catalog-sheet/` ucundan sunulur)
- `src/lib/calc/__tests__/` — mühendislik doğrulama + bağlantı koruma testleri
- `src/lib/calc/__tests__/legacy/` — **tarihsel** karşılaştırma katmanı
  (eşleme tabloları + gerekçeli kapsam dışı/sapma sözlükleri). Şartname değil.
- `reference/excel-dump/` — ilk portun kaynak dökümü. DOKUNMA; yalnız tarihsel
  karşılaştırma okur. Yeni hesap için kaynak DEĞİLDİR.
- `supabase/migrations/` — şema + RLS + seed
- `docs/standards/` — FEM 1.001 / CMAA 70 inceleme notları + çapraz referans
