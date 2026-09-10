# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

ORION'un mühendislik, planlama, satın alma, imalat, satış ve personel ekipleri. Kullanıcılar günlük operasyon içinde iş emrini, teknik hesabı, revizyonu, çizimi, malzemeyi ve ticari süreci aynı iş bağlamında izler; hızlı karar vermek ve bir sonraki sorumluya güvenilir bilgi aktarmak ister.

## Product Purpose

ORION, vinç işlerini iş emrinden satışa kadar uçtan uca yönetmek için vardır. Proje, revizyon, hesap raporu, teknik resim, satın alma, hammadde, katalog, çalışma kaydı, satış ve personel süreçlerini birbirinden kopuk kayıtlar yerine aynı operasyonel omurga üzerinde buluşturur.

Başarı; ekiplerin güncel iş durumunu hızla anlayabilmesi, teknik kararların izinin korunması, bölümler arası devirlerin açık olması ve tekrar veri girişinin azalmasıdır.

## Positioning

Ürün genel amaçlı bir görev yöneticisi değildir. ORION'un vinç üretim sürecine özgü teknik hesap, revizyon, çizim, malzeme ve operasyon kayıtlarını aynı iş kimliği altında birleştiren şirket içi kontrol masasıdır.

## Operating Context

- İş emirleri ve projeler birden fazla bölümün ardışık veya eşzamanlı katkısıyla ilerler.
- Teknik hesaplar revizyonlanır; rapor, çizim ve ilgili kararların geçmişi korunur.
- Satın alma ve imalat, teknik gereksinimlerle malzeme/katalog verisini birlikte değerlendirir.
- Satış ve yönetim, teknik ayrıntıyı kaybetmeden işin genel durumunu görür.
- Kullanım masaüstü ağırlıklıdır; saha ve hareket hâlindeki kullanım için mobil web de aynı bilgi yapısını korur.
- Arayüz dili Türkçedir; teknik ölçüler, kodlar ve sayısal değerler kesin ve taranabilir gösterilir.

## Capabilities and Constraints

- Kimlik ve yetkiye bağlı bölüm erişimi, proje/iş kaydı ve revizyon yönetimi temel ürün davranışıdır.
- Hesap raporları, teknik resimler, satın alma ve hammadde kayıtları gerçek proje verisine dayanır.
- Boş veya bilinmeyen veri uydurulmaz; veri modelinde `null`, arayüzde gerektiğinde uzun çizgi ile gösterilir.
- Mevcut belge, hesap ve rapor üretim akışları korunmalıdır; görsel iyileştirme hesaplama doğruluğunu veya çıktı sürekliliğini değiştiremez.
- Masaüstü ve mobil görünüm aynı içerik ve eylem yapısını paylaşır; sırf kırılım için yinelenmiş arayüz akışları oluşturulmaz.
- Uygulama adı ve marka varlıkları merkezi kaynaklardan kullanılır; logo ve sembol yeniden çizilmez.

## Brand Commitments

- Ürün adı ORION'dur; bağlama göre ORION Cranes markasıyla birlikte kullanılır.
- Marka karakteri endüstriyel, teknik, düzenli, köşeli ve kompakttır.
- Arayüzün amacı dekorasyon değil, işin durumunu ve sonraki eylemi hızlıca anlaşılır kılmaktır.
- ORION kırmızısı yalnızca marka, birincil eylem, etkin durum ve kritik vurgu için kullanılır.
- Archivo görünür arayüz metinlerini, IBM Plex Mono teknik değerleri ve kodları taşır.
- Onaylı marka varlıkları `public/brand/` altında korunur; yeni yorumla çizilmez veya orantısı değiştirilmez.
- Kullanıcıya dönük arayüz, rapor ve yorum dili Türkçedir; kısa ve doğrudan fiiller tercih edilir.

## Evidence on Hand

- Marka kimliği ve uygulama kararları: `../Orion Cranes Brand Identity/Orion Cranes Uygulama UI Tasarım Kararları.md`
- Uygulama arayüz kuralları ve ekran envanteri: `docs/agent/arayuz.md`
- Marka token kaynakları: `design-system/tokens/`
- Çalışma zamanı tema ve yardımcı sınıfları: `src/app/globals.css`
- Onaylı logo ve semboller: `public/brand/`
- Uygulama adı kaynağı: `src/lib/app.ts`
- Gerçek iş verileri uygulamanın veri kaynaklarından gelir. Gelecekteki tasarım çalışmaları müşteri, referans, başarı ölçütü, fiyat veya örnek proje verisi uydurmamalıdır.

## Product Principles

1. **Tek iş bağlamı:** Teknik, operasyonel ve ticari kayıtlar aynı iş kimliği etrafında ilişkilendirilir.
2. **İzlenebilir karar:** Revizyon, hesap ve durum değişikliklerinde geçmiş ve sorumluluk kaybolmaz.
3. **Hızlı tarama, kesin detay:** İlk bakışta durum anlaşılır; ihtiyaç olduğunda teknik ayrıntıya güvenle inilir.
4. **Gerçek veri, açık boşluk:** Eksik bilgi örnek veya tahminle doldurulmaz; bilinmeyen durum açıkça görünür.
5. **Bölümler arası süreklilik:** Bir ekibin çıktısı, sonraki ekibin güvenilir girdisi olur.

## Accessibility & Inclusion

- Klavye ile erişim ve görünür odak durumu korunur.
- Renk tek başına durum veya hata taşımaz; metin, ikon ya da biçimle desteklenir.
- Dokunmatik hedefler en az 44 × 44 CSS piksel etkin alan sağlar.
- Dokunmatik cihazlarda form metni en az 16 CSS piksel tutulur.
- Hareket azaltma tercihi olan kullanıcılar için zorunlu olmayan animasyonlar kapatılmalı veya anlık hâle getirilmelidir.
- İçerik yakınlaştırmada ve dar ekranlarda yatay sayfa taşmasına yol açmamalıdır; yoğun tablolar kontrollü kaydırma veya uygun satır düzeni kullanır.
