---
name: ORION Engineering Control Desk
description: Vinç işlerini uçtan uca yöneten endüstriyel ve teknik operasyon arayüzü.
colors:
  paper: "oklch(0.98 0.003 49)"
  ink: "oklch(0.269 0 0)"
  card: "oklch(1 0 0)"
  orion-red: "oklch(0.467 0.17 27)"
  on-orion-red: "oklch(0.98 0.003 49)"
  steel-blue: "oklch(0.45 0.078 234)"
  muted-surface: "oklch(0.955 0.004 56)"
  muted-ink: "oklch(0.514 0.008 53)"
  border: "oklch(0.905 0.004 56)"
  input-border: "oklch(0.887 0.004 56)"
  focus-ring: "oklch(0.6 0.12 27)"
  success: "oklch(0.54 0.13 158)"
typography:
  display:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "72px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  body-compact:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  formula:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  caption-compact:
    fontFamily: "Archivo, system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.22em"
  micro:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.08em"
  data:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: "0.06em"
rounded:
  square: "0"
  circle: "50%"
  physical-pill: "9999px"
spacing:
  space-0: "0"
  space-1: "4px"
  space-2: "7px"
  space-3: "9px"
  space-4: "12px"
  space-5: "16px"
  space-6: "22px"
  space-7: "26px"
  space-8: "34px"
  touch: "44px"
  section: "88px"
components:
  button-primary:
    backgroundColor: "{colors.orion-red}"
    textColor: "{colors.on-orion-red}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.square}"
    padding: "0 12px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.square}"
    padding: "0 12px"
    height: "40px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.square}"
    padding: "0 12px"
    height: "40px"
  status-badge:
    backgroundColor: "{colors.muted-surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "0 8px"
    height: "20px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "16px"
  navigation-active:
    backgroundColor: "{colors.orion-red}"
    textColor: "{colors.on-orion-red}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.square}"
    padding: "0 12px"
    height: "40px"
---

# Design System: ORION Engineering Control Desk

## Overview

**Creative North Star: "Mühendislik Kontrol Masası"**

ORION arayüzü bir pazarlama vitrini değil, üretim kararlarının alındığı düzenli bir kontrol masasıdır. Görsel dil; endüstriyel ekipmanın açıklığını, teknik resmin kesinliğini ve yoğun operasyon ekranlarının taranabilirliğini bir araya getirir. Karakteri teknik, düzenli, köşeli ve kompakttır; ayrıntı çoktur fakat hiyerarşi belirsiz değildir.

Kimlik mevcut ORION marka sisteminden gelir ve iyileştirme bu sistemi koruyarak yapılır. Sıcak kâğıt yüzeyler, kömür tonlu iskelet, ince sınırlar ve sınırlı kırmızı vurgu ana malzemedir. Parlak gradyan, ağır gölge, dekoratif animasyon veya tüketici uygulaması yumuşaklığı bu dünyanın parçası değildir.

**Key Characteristics:**

- Endüstriyel, teknik ve ölçülü
- Yüksek bilgi yoğunluğu içinde açık hiyerarşi
- Kare geometri, ince sınırlar ve hassas hizalama
- Kırmızıyı az ve anlamlı kullanan vurgu sistemi
- Teknik veride mono, arayüz dilinde güçlü sans tipografi
- Masaüstü ve mobilde aynı bilgi yapısı

## Colors

Renkler dört işleve ayrılır: ORION kırmızısı birincil vurgu; çelik mavisi teknik/bilgilendirici vurgu; kâğıt ve kart tonları içerik zemini; kömür ve nötrler yapı, metin ve sınırdır. Semantik başarı rengi yalnızca doğrulanmış olumlu durumu gösterir. Hata ve uyarı anlamı metin ya da ikonla desteklenir.

**The Kırmızı Azdır Rule.** ORION kırmızısını marka izi, ekranın birincil eylemi, etkin seçim veya gerçekten kritik durum dışında yaygınlaştırma. Aynı görünümde birden fazla eşit ağırlıklı kırmızı eylem oluşturma.

**The Zemin Sessizdir Rule.** İçeriğin okunabilirliğini kâğıt, kart ve kömür yüzeylerle kur; dekoratif renk bloklarıyla bölüm üretme. Teknik mavi, kırmızının yerine ikinci bir genel çağrı rengine dönüşmemelidir.

Koyu temada roller tersine dönmez: zemin koyulaşır, metin ve sınırlar erişilebilir kontrasta taşınır, ORION kırmızısı kimlik rolünü korur. Renk hiçbir zaman tek durum göstergesi değildir.

## Typography

Archivo bütün görünür arayüz dilini taşır. Geniş ağırlık aralığı başlık, eylem ve yoğun gövde metninin aynı aile içinde ayrışmasını sağlar. IBM Plex Mono; ölçü, kod, revizyon, tarih/saat, hesap sonucu ve teknik etiket gibi karakter hizasının anlam taşıdığı yerlerde kullanılır.

**The Teknik Veri Rule.** Sayı, birim, kod ve revizyonu mono ve mümkün olduğunda tabular rakamlarla göster; açıklama cümlelerini mono yapma. Teknik veri ile insan dilinin rolleri görünür biçimde ayrılmalıdır.

**The Kısa Emir Rule.** Düğme ve işlem metinleri Türkçe, kısa ve doğrudan fiiller kullanır. Büyük harf ve geniş harf aralığı yalnızca kicker/mikro etiket rolünde sistematik olarak uygulanır; uzun gövde metnine yayılmaz.

Ekran ölçeğinin en büyük rolleri yalnızca geniş tanıtıcı veya rapor başlıklarında kullanılır. Operasyon ekranlarında başlık boyutu, çevresindeki yoğunluğu bastırmadan bağlamı kurar.

## Layout

Ana kabuk sabit üst çubuk, masaüstünde kalıcı yan navigasyon ve ORION kırmızısı dikey omurgayla çalışır. İçerik genişliği kontrollüdür; bölüm başlangıçları ritmik, tablo ve form içleri daha kompakttır. Sayfa başlığı tek kaynaktır ve kabuğun başlık alanına taşınır; aynı başlık içerikte tekrar edilmez.

**The Tek DOM Rule.** Masaüstü ve mobil için aynı içerik ve eylem yapısını kullan. Kırılım yalnızca yerleşimi, görünürlüğü ve sıralamayı değiştirir; iki ayrı ekran ağacı üretmez.

**The Yoğun ama Sıkışık Değil Rule.** Boşluğu süs olarak değil, gruplama aracı olarak kullan. Kontroller ve tablolar kompakt olabilir; ancak tıklanabilir etkin alan dokunmatik ortamda erişilebilir boyutu korur.

Dar ekranda yan navigasyon çekmeceye dönüşür; eylem satırları kontrollü kaydırılır veya sarılır. Sayfanın tamamında yatay taşma kabul edilmez. Tablolar bilgi önceliğine göre sütun saklar, kontrollü yatay kaydırma sağlar ya da satır/kart düzenine dönüşür. Her değişiklikte ilgili `/dev/*-preview` yüzeyi masaüstü ve mobil ölçülerde gözden geçirilir.

## Elevation & Depth

Arayüz düz ve yapısaldır. Katman ayrımı öncelikle yüzey tonu, ince sınır, kırmızı omurga ve doğru boşlukla kurulur. Genel kartlara veya tablolara atmosferik gölge eklenmez; gölge yalnızca açılır menü, popover gibi geçici bir yüzeyin başka bir katmanda olduğunu anlatması gerektiğinde çok ölçülü kullanılabilir.

**The Çizgi Önce Rule.** Derinlik ihtiyacında önce sınır, yüzey tonu ve yerleşim hiyerarşisini düzelt; gölgeyi varsayılan kart dekorasyonu yapma. Baskı levhası, tabela veya fiziksel ürün görselleştirmelerine ait gölgeler uygulama bileşenlerine taşınmaz.

## Shapes

Temel geometri karedir. Kart, giriş, düğme, sekme, menü ve bildirim yüzeyleri sıfır köşe yarıçapıyla teknik bir bütünlük taşır. Daire yalnızca gerçek dairesel nesnelerde; rozet, avatar, durum noktası veya fiziksel kontrol metaforunda kullanılır. Hap biçimi yalnızca anlamı gerçekten kapsül/etiket davranışı gerektiriyorsa istisnadır.

**The Geometri İşlevdir Rule.** Köşe biçimini yumuşaklık hissi vermek için rastgele değiştirme. Kare form varsayılandır; daire ve hap, bileşenin fiziksel ya da semantik işleviyle gerekçelendirilmelidir.

İkonlar küçük, çizgisel ve aynı optik ağırlıktadır. Marka sembolü ikon kütüphanesiyle yeniden çizilmez; onaylı varlık kullanılır.

## Components

Düğmeler kısa ve mekanik tepki verir: renk, sınır ve gerektiğinde tek piksellik basılma hareketi. Birincil düğme ORION kırmızısıdır; ikincil/outline eylemler nötr yüzeyde kalır. Aynı bölgede birincil eylem sayısı sınırlıdır.

Girişler düz, açık sınırlı ve güçlü odak halkalıdır. Etiket alanı boş bırakılmaz; hata metni alanla programatik olarak ilişkilendirilir. Dokunmatik ortamda yazı büyüklüğü yakınlaştırma tetiklemeyecek seviyede tutulur.

Kartlar içerik gruplar, dekoratif birer pano değildir. İnce sınır ve kompakt iç boşluk kullanır; iç içe kart yığınları yerine başlık, ayraç ve yüzey tonu tercih edilir. Tablolarda kimlik sütunu önceliklidir; sayısal alanlar mono/tabular, başlıklar kısa ve taranabilirdir.

**The Hareket Açıklamak Zorundadır Rule.** Hareket yalnızca durum değişimini, açılma-kapanmayı, yeniden sıralamayı veya kullanıcının eylemine verilen cevabı açıklamak için vardır. Yaylı sıçrama, dekoratif süzülme ve ölçek gösterisi kullanma. Geçişler kısa ve kontrollüdür; `prefers-reduced-motion` tercihi zorunlu olmayan hareketi kaldırır.

Sonner uygulamanın bildirim kanalıdır. Toast metni kısa ve eyleme dönüktür; aynı sonuç hem sayfa içi durum hem toast ile gereksiz yere yinelenmez. Yeni bir bileşen veya etkileşim deseni eklemeden önce mevcut shadcn/Radix/Sonner altyapısı değerlendirilir.

## Do's and Don'ts

### Do:

- **Do** mevcut semantik tema tokenlarını ve merkezi bileşenleri kullan.
- **Do** ORION kırmızısını tek bir ana vurgu hiyerarşisi için ayır.
- **Do** teknik değerlerde IBM Plex Mono, tabular rakam ve açık birim gösterimi kullan.
- **Do** klavye odağını görünür, dokunmatik etkin alanı erişilebilir tut.
- **Do** mobil ve masaüstü davranışını aynı bilgi yapısıyla ve ilgili önizleme ekranlarında doğrula.
- **Do** logo ve sembol için yalnızca `public/brand/` altındaki onaylı varlıkları kullan.

### Don't:

- **Don't** marka kimliğini yeniden yorumlayan yeni logo, kırmızı tonu veya rastgele köşe yarıçapı üretme.
- **Don't** parlak gradyan, ağır gölge, cam efekti ya da dekoratif animasyon ekleme.
- **Don't** renkleri doğrudan bileşene gömme; çalışma zamanı tema tokenlarını atlama.
- **Don't** durum bilgisini yalnızca renkle anlatma.
- **Don't** dar ekran için ayrı içerik ağacı veya sayfa düzeyinde yatay taşma oluşturma.
- **Don't** eksik iş verisini örnek, tahmin veya sahte içerikle doldurma.
