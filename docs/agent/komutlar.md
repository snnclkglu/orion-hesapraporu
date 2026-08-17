# Komutlar ve duman testleri

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).


- `npm run dev` — dev sunucu
- `npm test` — vitest (mühendislik doğrulama + tarihsel karşılaştırma)
- `npm run build` — production build
- `npx tsx scripts/test-pdf.ts` — PDF raporu üç seviyede üret (duman testi)
- `npx tsx scripts/test-equipment.ts` — ekipman listesi duman testi
- `npx tsx scripts/test-offer-pdf.ts` — TEKLİF belgesini ÜÇ fikstürle üret ve
  `unpdf` ile GERİ OKU: sade (tek kalem) · **gizlemeli** (bir satır, bir grup ve
  bir fiyat satırı gizli) · sekiz kalemli. Sınanan şey biçim değil KURALDIR —
  gizlenen satırın metni belgede YOK, toplam satırlarla tutuyor, altbilgi
  künyesi her sayfada. Bileşen ağacına bakmak bunların hiçbirini göstermez
- `npx tsx scripts/test-offer-cost-pdf.ts` — MALİYET ÇALIŞMASI iç belgesini
  devralınan "ÖRNEK ASTOR 32T × 30 m Portal Vinç" çalışma kitabının girdileri ve
  birim fiyatlarıyla üret, `unpdf` ile GERİ OKU. Sınanan üç şey: modelin
  sayıları belgede gerçekten var mı (51.000 kg çelik, 194.257,74 € proje
  maliyeti, toplam = proje × 1,19), **İÇ BELGE damgası HER SAYFADA mı**
  (bileşen ağacına bakmak bir sayfada düştüğünü göstermez) ve satırın
  teklifteki karşılığı basılıyor mu
- `npx tsx scripts/gen-offer-seed.ts` — teklif defterinin seed migration'ını
  ÜRET (`20260819000002_offer_options_seed.sql`). Üretilen dosya elle
  düzenlenmez; `match_key` katlamasını yalnız TypeScript bilir (Postgres'in
  `upper()`ı Türkçe farkında değildir)
- `/dev/offer-editor-preview` — teklif EDİTÖRÜNÜN auth'suz önizlemesi. Editör
  600px'lik `overflow-hidden` bir kutuya SARILIR: kabuğun sabit çerçeve kabının
  birebir taklidi. Taklit edilmezse "scroll çalışmıyor" hatası önizlemede HİÇ
  görünmez — kullanıcı bildirimi (17.08.2026) tam o koşuldan çıkmıştı
- `/dev/offer-cost-preview` — MALİYET EDİTÖRÜNÜN auth'suz önizlemesi. Fikstür
  GERÇEKTİR: ASTOR 32T × 30 m tam portal, devralınan V3 çalışmasının girdileri
  ve birim fiyatlarıyla. Ekrandaki ağırlıklar (51.000 / 59.500 kg) ve toplam
  (231.166,71 €) o çalışmayla birebir tutmalıdır — tutmuyorsa model ya da
  defter bozulmuştur. Kabuğun ata zinciri birebir kurulur (teklif editörünün
  önizlemesiyle aynı gerekçe: TEKLIF-17'de kırılan halka önizlemede yoktu)
- `/dev/offers-preview` — teklif listesinin AUTH'SUZ görsel önizlemesi;
  takip sayacının tam yelpazesi (bugün · 3 gün · 12 gün · 5 hafta · 13 hafta)
  yan yana basılır, sarı→kırmızı ölçek ancak birlikte denetlenebilir
- `npx tsx scripts/test-work-order.ts` — iş emri PDF'ini 1…16 kalemle üret
  (sayfa dengesi görsel kontrolü)
- `npx tsx scripts/test-work-log-excel.ts` — İş Takibi Excel çıktısını üret
  (sayfa yapısı, süzgeç, dondurulmuş başlık — duman testi)
- `npx tsx scripts/test-job-list.ts` — Güncel İş Listesi PDF'ini GERÇEK liste
  (88 kalem) ve BEŞ KATIYLA (440 kalem) üret; ikincisi büyüme sınamasıdır —
  başlık satırı her sayfada tekrar ediyor mu, yıl bandı sayfa dibinde yalnız
  kalıyor mu, satır ikiye bölünüyor mu
- `npx tsx scripts/test-safety-brake-diagram.tsx` — emniyet freni şemasını altı
  yerleşim düzeninde SVG olarak üret (kaliper konumları + yazı çakışması)
- `npx tsx scripts/test-lifting-beam-diagram.tsx` — kaldırma kirişinin üç
  şemasını (görünüş · moment · kesitler) SİMETRİK ve ASİMETRİK askıyla üret
  (SVG + PNG). İkinci fikstür olmadan "Kesit 1'in kesmesi sıfır değildir" hâli
  hiç görülmez
- `python scripts/catalog-sheets.py [--verify] [--only <tür>]` — katalog
  sayfalarını kaynak PDF'lerden kes; `--verify` yalnız haritayı sınar
- `npx tsx scripts/make-icons.ts` — sekme ve uygulama ikonlarını MARKA
  SEMBOLÜNDEN üret (`app/icon.svg` · `favicon.ico` · `apple-icon.png` ·
  `public/brand/icon-{192,512,maskable-512}.png`). Üretilen dosyalar elle
  düzenlenmez; sembol değişirse betik yeniden koşturulur
- `npx tsx scripts/test-drawings.ts` — iki gerçek teslim klasörünün içe
  aktarım raporunu bas (Teknik Resimler duman testi)
- `npx tsx scripts/test-drawings-register.ts` / `-outputs.ts` — parça defteri
  ve üç türev çalışma kitabını gerçekten üret ve geri oku
- `npx tsx scripts/test-hammadde.ts [ek-excel…]` — HAMMADDE ayıklama dilbilgisini
  gerçek teslim Excel'lerine uygula: sınıf dağılımı, DİĞER'e düşen HER tanım ve
  ölçüsü okunamayan satırlar. Yeni bir kalıp eklemeden önce koştur
- `npx tsx scripts/test-hammadde-pool.ts` — hammadde havuzunu CANLI veritabanı
  satırlarıyla kur; defterin ekipman/imalat/montaj olarak ARTIKSIZ bölündüğünü de
  sayar. Salt okunur; `.env.admin` jetonunu ister
- `npx tsx scripts/test-nesting-plan.ts` — KESİM PLANI PDF'ini gerçekten üret
  (fontlar kayıtlı mı, çizim ve tablo basılıyor mu). Belge üretilmezse betik
  yığın iziyle patlar; tarayıcıdan bakmak hatayı 500'ün arkasına saklıyordu
- `npx tsx scripts/test-alim-analizi.ts` — SAC · PROFİL · RAY alım analizini
  CANLI veritabanıyla bas: yıl × kategori matrisi kullanıcının kendi Excel
  "Özet" sayfasıyla yan yana konup karşılaştırılmak içindir. Salt okunur
- `node scripts/generate-raw-purchase-import.mjs` — devralınan alım geçmişini
  Excel'den migration'a ÜRET (`20260815000006_import_raw_purchases.sql`).
  Üretilen dosya elle düzenlenmez; ikinci koşuda bayt bayt aynı çıkar
- `python scripts/gen-profile-sections.py` — profil kesit tablosunu workspace
  kökündeki `Profiller.xls`ten ÜRET (`src/lib/purchasing/hammadde/
  profil-kesitleri.ts`). Üretilen dosya elle düzenlenmez
- `npx tsx scripts/test-normalize.ts` — tanım normalizasyonunu iki GERÇEK teslim
  klasörünün tamamına uygula; hangi kuralın kaç kez çalıştığını, hangi ham
  yazımların tek anahtarda BİRLEŞTİĞİNİ ve ana grup adlarını bas. Sözlüğe kural
  eklemeden önce koştur: yanlış birleşme (iki farklı ürünün tek kaleme düşmesi)
  "BİRLEŞENLER" listesinde görünür
- `npx tsx scripts/test-purchasing-pool.ts` — talep havuzunu CANLI veritabanı
  satırlarıyla kur ve bas (çarpan, çok projeli birleşme, ana grup adı). Salt
  okunur; `.env.admin`deki Management API jetonunu ister
- `npx tsx scripts/test-purchase-request.ts` — satın alma talebi PDF'ini
  40 ve 400 kalemle üret ve GERİ OKU: yatay sayfa + Türkçe karakter + on
  sütunlu tablo bir arada ilk kez burada kullanılıyor. Betik ayrıca belgede
  FİYAT İZİ olmadığını da doğrular (talep belgesi fiyatsızdır)
- `npx tsx scripts/test-fx-source.ts [gün]` — döviz kuru kaynağını GERÇEK
  servise karşı sına: TCMB kaç günü okudu, hangi günler tatil, ECB yedeği aynı
  aralığı veriyor mu ve **iki kaynağın aylık ortalaması %0,3'ten fazla
  ayrışıyor mu**. Ayrıca paritenin gün gün hesaplandığını sayıyla gösterir
- `npx tsx scripts/test-payroll-docs.ts` — ücret bordrosunu ÜÇ varyantta
  (parametreli · parametresiz · toplu) ve Personel/Maaş Excel'ini üret;
  brütleştirmenin kendi içinde tuttuğunu (brüt − kesinti = net) ve Excel'de
  kuru girilmemiş ayın avro hücresinin BOŞ (sıfır değil) olduğunu doğrula
- `/dev/drawings-preview` · `/dev/personnel-preview` — Teknik Resimler ve Personel
  ekranlarının AUTH'SUZ görsel önizlemesi (yalnız development). Ekran
  değiştirdiysen ÖNCE orada bak
- Migration push: `npx supabase db push` (SUPABASE_ACCESS_TOKEN env ile; token asla commit etme)
