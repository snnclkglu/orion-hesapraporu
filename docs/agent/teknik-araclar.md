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
JIS B 0401:1999 ölçü basamaklarını kullanır. İlk sürüm, çift kontrol edilen
H6–H10 delik ve h5–h9/js5–js7 mil sınıflarıyla sınırlıdır. Kaynağın diğer
harf bölgeleri tam aktarılmadan hesaplanmaz; ekran kapsamı açıkça söyler.
Sonuç tasarım/ön seçim desteğidir, yayımlanmış imalat resminin yerine geçmez.

## ARAC-6 — ALT ARAÇLAR AYRI ADRESTİR

Genel, Ağırlık, Profiller, Kama ve Tolerans ayrı App Router sayfalarıdır.
Mobilde beş hedef `MobileRouteGrid` ile görünür kutu ızgarası, masaüstünde ince
bir rota şeridi olarak basılır. Etkileşimli hesaplayıcılar dar istemci
sınırlarıdır; yerleşim ve sayfalar sunucu bileşeni kalır. Auth'suz görsel
kontrol `/dev/tools-preview` adresindedir ve production'da 404 döner.
