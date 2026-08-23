# İş Takibi

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/worklog.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/work-log.ts` · `src/app/(app)/worklog/**`

## WORKLOG-17 — İş Takibi bir GÜN × KALEM × PARÇA × TÜR çizelgesidir.

`work_logs` bir
satırda tarih, iş kalemi, parça, imalat türü, KİŞİ SAYISI ve saat tutar;
`man_hours` türetilir. Kişiler İSİMLE tutulmaz — atölye kaydı baştan beri
kişi sayısıyla tutuluyor ve her gün isim yazmak günlük girişi kullanılamaz
yapardı. Yetki `can_see_work_log()` / `canSeeWorkLog` (Yönetici + Müdür);
`canSeeSales` ile aynı kümeyi döndürür ama AYRI bir sorudur.

**Kalem numarası METİN, bağlantı TÜREV.** Atölye çizelgesi sistemdeki
numaralandırmayı beklemez: `item_no` her satırda durur, `job_item_id` ve
`job_id` eşleştiği ölçüde dolar (önce kalem, sonra iş kökü, sonra boş).
Eşleşmeyen kayıt DÜŞÜRÜLMEZ; ekranda ayrıca sayılır ve "Kalem Eşleştirme"
ile bir numaranın bütün satırları tek işlemde bağlanır (`remapItemNo`).
Devralınan veride 0020-00 numarasının 792 satırı böyle bağlanır.

**Parça ve imalat türü DEFTERDEDİR** (`work_parts`, `work_categories`),
serbest metin değildir: kaynak çizelgede aynı parça beş yazımla girilmişti
("Anakiriş"/"Ana Kiriş") ve serbest metinle parça bazında toplam ALINAMAZDI.
Yeni parça günlük girişteki arama kutusundan tek adımda açılır; imalat
türünün rengi `nextDistinctHue` ile verilir (yığılmış grafikte komşu
dilimlerin ayrılabilirliğini veri değil KURAL garanti eder).

**Günlük giriş TEKRARI hedefler.** Devralınan veride bir günün satırlarının
%87'si bir önceki iş gününden aynen devam ediyor ve 381 günün 170'i bir
öncekiyle birebir aynı. Ekran bunu iki harekete indirir: "Önceki günü
kopyala" ve sık kullanılan (kalem · parça · tür) üçlülerini tek tıkla satır
yapan şerit. Gün BİR BÜTÜN olarak kaydedilir (`saveWorkDay`): satırlar
kimlikleriyle eşlenir, kalanlar güncellenir, silinenler silinir — günü silip
yeniden yazmak `created_by`/`created_at` bilgisini yok ederdi.

**Pano grafikleri `lib/diagrams` KULLANMAZ.** O katman `DiagramEl[]` üretir
ve aynı model web + PDF'e basılır; kategorik ekseni, çubuk/dilim ilkeli ve
etkileşimi yoktur, renkleri sabit hex'tir. `components/charts.tsx` düz
HTML/CSS çubuk kullanır (SVG `viewBox` ile ölçeklenirken YAZILAR da ölçeklenir
ve dar kolonda okunmaz); yay gerektiren tek grafik halkadır ve orada yazı
yoktur. Seri rengi veriden yalnız TON AÇISI olarak gelir, L/C `globals.css`
`.oc-series-*` kuralında ve tema başına verilir — grafikte elle hex yazılmaz.

**Süzgeç tanımı TEKTİR** (`worklog/filters.ts`): Analiz ekranı, Kayıtlar
ekranı ve Excel indirme ucu aynı `matchesFilters`'ı çağırır. Üçünde ayrı
yazılsaydı indirilen dosya ile ekrandaki tablo sessizce ayrışırdı. İndirilen
dosyanın adı tarih ve saat taşır (`downloadName`): aynı süzgeçle alınan iki
dosya klasörde birbirini ezmez.

## Mobil düzen — 23.08.2026

Günlük Giriş · Analiz · Kayıtlar rayı telefonda tek bölüm seçicisidir. Son 14
Gün şeridi yatay kaymaz; yedi sütunlu iki satıra katlanır ve bütün günler aynı
anda görünür. Dönem Karşılaştırması listesi mobil karttır. Sayfa gövdesi yatay
taşmaz; yalnız ay eksenli gerçek grafikler ve çapraz ısı matrisi karşılaştırma
anlamını korumak için kendi sınırları içinde gezilebilir.
