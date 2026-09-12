# Teknik Araçlar

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.

**Kapsam:** `src/lib/engineering-tools/**` · `src/app/(app)/tools/**` · `src/app/dev/tools-preview/**`

## ARAC-1 — BÖLÜM HER OTURUMLU KULLANICIYA AÇIKTIR

`/tools`, `WORKSPACE_SECTIONS` içinde görünürlük sorusu taşımayan bir ana
bölümdür. Yönetici, Müdür, Mühendis, Teknik Ressam, Satın Alma, Planlama,
Kalite ve Üretim aynı araçları kullanır. Araçlar kayıt açmaz ve ticari/kişisel
veri okumaz; bu yüzden ayrıca Supabase tablosu, RLS politikası ya da sunucu
eylemi yoktur. “Herkese açık” anonim internet anlamına gelmez: rota `(app)`
grubundadır ve oturum kapısı uygulamanın ortak yerleşimindedir.

## ARAC-2 — BİRİM SİSTEMİ YALNIZ METRİKTİR

Kullanıcı kararı (10.09.2026): “her şey metrik olacak, inch'e ihtiyaç yok.”
Uzunluk girişi mm, profil uzunluğu mm, profil anma ağırlığı kg/m, kütle kg,
yoğunluk g/cm³ ve tolerans sapması µm'dir. İnç dönüşümü, birim seçici ve inç
tablosu eklenmez. Türkçe ondalık virgül kabul edilir.

## ARAC-3 — AĞIRLIK ÇEKİRDEĞİ GEOMETRİDEN HESAPLAR

`lib/engineering-tools/weight.ts` saftır. Çelik varsayılanı 7,85 g/cm³'tür;
kullanıcı değiştirebilir ve ekran varsayımı açıkça gösterir. Sac/lama, disk,
halka, dolu mil, boru ve kare/dikdörtgen kutu profil desteklenir. Sonuç tek
parça, adetli toplam, kesit alanı ve doğrusal parçalarda kg/m taşır. Eksik ya
da fiziksel olarak olanaksız ölçü sonuçta sıfır üretmez; açıklamalı hata verir.
Çok parçalı liste yalnız istemci oturumunda yaşar ve kalıcı kayıt değildir.

## ARAC-4 — PROFİL DEFTERİNİN İKİNCİ KOPYASI YOKTUR

Profil sayfası `Profiller.xls`ten daha önce üretilmiş kanonik
`PROFIL_KESITLERI` defterini kullanır. 477 kesitin kodu, ailesi, h/b anma
ölçüsü ve kg/m değeri ikinci bir dosyaya kopyalanmaz. NPI araması IPN, NPU
araması UPN ailesine katlanır; bu hammadde dilbilgisiyle aynıdır.

## ARAC-5 — KAMA VE TOLERANS KAPSAMI KAYNAKTAN DAHA FAZLASINI İDDİA ETMEZ

Kama tablosu kullanıcının verdiği `Keyway-and-Key-Size-Dimensions.pdf`
belgesinin metrik yarısıdır. Belge standart numarası söylemediği için ekran
DIN/ISO adı uydurmaz. Kaynaktaki 86 ve 96 mm sınır çakışmaları iki olası satır
olarak görünür ve uyarı taşır.

Tolerans aracı kullanıcının verdiği `fit_tolerances.pdf` içindeki
JIS B 0401:1999 ölçü basamaklarını kullanır. Çift kontrol edilen H6–H10 delik
ve h5–h9/js5–js7/p6 mil sınıflarıyla sınırlıdır. Kaynağın diğer harf bölgeleri
tam aktarılmadan hesaplanmaz; ekran kapsamı açıkça söyler. Seçilen geçme,
tolerans bantlarının sıfır çizgisine göre konumuyla şematik olarak gösterilir.
Sonuç tasarım/ön seçim desteğidir, yayımlanmış imalat resminin yerine geçmez.

## ARAC-6 — ALT ARAÇLAR AYRI ADRESTİR

Genel, Ağırlık, Profiller, Kama, Tolerans, Raylar, Cıvata, Segman, Keçe, Aks
tutucu ve Erişim ayrı App Router sayfalarıdır. Mobilde hedefler
`MobileRouteGrid` ile görünür kutu ızgarası, masaüstünde ince
bir rota şeridi olarak basılır. Etkileşimli hesaplayıcılar dar istemci
sınırlarıdır; yerleşim ve sayfalar sunucu bileşeni kalır. Auth'suz görsel
kontrol `/dev/tools-preview` adresindedir ve production'da 404 döner.

## ARAC-7 — ÜRETİCİ KATALOĞU HAM DEĞERİ KORUR

Suptex keçe tablosu verilen Excel'in `DMK-mm 2013` sayfasındaki 3896 veri
satırından üretilir. Bir hücrede birleşik ölçü veya açıklama varsa parçalanıp
tahmin edilmez; katalog yazımı aynen korunur. Ray–ped eşlemesi verilen Beket
belgesinden, ray–krapo eşlemesi Crapex ürün sayfalarından gelir. Kaynakta
olmayan boyut `—` gösterilir.

## ARAC-8 — RAY KÜTLESİ TEK KANONİK TABLODAN GELİR

A ve S raylarının anma geometrisi ile kütlesi mevcut `RAILS` tablosundan
okunur. Kare/dikdörtgen ray, yoğunlığı 7,85 g/cm³ olan dolu çelik kesit olarak
hesaplanır. Üretici kataloğu sonucu ile hesap sonucu birbirine karıştırılmaz.

## ARAC-9 — CIVATA SONUÇLARI ÖN SEÇİMDİR

Cıvata ekranı metrik kaba diş, kılavuz matkabı, gerilme kesiti, ISO 273 geçiş
deliği, anahtar ağzı, DIN 974-1 yuva, somun ve pul boyutlarını tek satırda
toplar. Tork, sürtünme katsayısını açık girdi yapar ve 0,06–0,30 dışında sonuç
üretmez. Boy önerisi standart ticari boylara yuvarlanan ön seçimdir. EN
1993-1-8 değerleri açıkça eski nesil 2005 Tablo 3.3 katsayılarıdır; güncel proje
standardı ve ulusal ek doğrulanmadan nihai detay sayılmaz.

## ARAC-10 — STANDART TABLOLARI SINIRLI KAPSAMINI SÖYLER

DIN 471/472 ekranı yalnız doğrulanmış yaygın çap satırlarını içerir; tam
standardı temsil etmez. DIN 15058 aks tutucu seçimi altı çap aralığını, tek/çift
tutucu kuralını ve belge malzemesini aktarır. Standart sürümünün değişmiş
olabileceği her yerde kaynak ve kapsam uyarısı görünür.

## ARAC-11 — ERİŞİM EKRANI TASARIMIN YERİNE GEÇMEZ

EN ISO 14122 ölçüleri ön tasarım kontrol kartlarıdır. EN ISO 13857 emniyet
mesafeleri açıklık şekli, uzuv yönü, koruyucu yüksekliği ve risk birlikte
değerlendirilmeden otomatik seçilmez. Vinç erişimi EN 13586:2026 kapsam notuyla
ayrılır. Lisanslı güncel standart ve risk değerlendirmesi nihai kaynaktır.


## Mobil ve tablet alt erişimi — Plan 013

12.09.2026 kullanıcı onayıyla bu alan ortak alt barı kullanır: **Ağırlık · Profiller · Kama · Tolerans · Tümü**.
Önceki mobil üst ızgara/yan ray kapsam notları için güncel kural
`arayuz.md` MOBIL-35’tir. Masaüstü düzeni korunur; yerel durum, mevcut yetkiler
ve kayıt yolları aynı kalır. Kontrol kanıtları Plan 013’te tutulur.
