# ORION UI Kütüphane Politikası

Bu belge, yeni bir arayüz ihtiyacında hangi mevcut aracın kullanılacağını ve ne zaman yeni bağımlılık değerlendirmesi yapılacağını sabitler. Amaç kütüphane çeşitliliğini artırmak değil; erişilebilir, tutarlı ve bakım maliyeti düşük bir ORION arayüzü üretmektir.

## Karar sırası

1. Önce `src/components/ui/` altındaki mevcut bileşeni kullan veya genişlet.
2. Erişilebilir davranış gerekiyorsa projede zaten kullanılan Radix/shadcn ilkelini tercih et.
3. Aşağıdaki uzman araçlardan biri mevcut ihtiyacı karşılıyorsa aynı aracı sürdür.
4. Yeni bağımlılık ancak mevcut yapı ihtiyacı karşılamıyorsa, ölçülebilir fayda sağlıyorsa ve paket/bundle etkisi doğrulandıysa eklenebilir.

## Onaylı mevcut seçimler

| İhtiyaç | Seçim | Kullanım kararı |
| --- | --- | --- |
| Dialog, popover, dropdown, select, tabs, label | Radix + shadcn | Mevcut erişilebilir temel. Base UI'ya toplu geçiş yapılmaz. |
| Komut paleti ve aranabilir komut listesi | cmdk | Mevcut `Command` ve combobox katmanı üzerinden kullanılır. |
| Toast ve geçici bildirim | Sonner | Tek kök Toaster; istemci olayından çağrılır. İkinci Toaster eklenmez. |
| Sürükle-bırak | dnd-kit | Mevcut, klavye sensörü ve odak davranışı korunarak kullanılır. |
| Koşullu sınıf birleştirme | clsx + `cn` | Tek seferlik koşullu sınıflar için. |
| Tip güvenli bileşen varyantları | CVA | Boyut, niyet veya durumdan oluşan gerçek varyant API'lerinde. |
| Açık/koyu tema | next-themes | Kök ThemeProvider dışında ikinci tema sağlayıcısı kurulmaz. |
| Basit hover, press, fade | CSS/Tailwind | Yeni hareket paketi eklenmez. |

## Koşullu değerlendirmeler

- **Motion:** yalnızca yay, çıkış animasyonu, karmaşık yerleşim geçişi veya kesilebilir jest değeri gerçekten gerekiyorsa değerlendirilir. Basit kontrol geri bildirimi için kullanılmaz.
- **Virtuoso:** uzun liste veya tabloda gerçek ölçümle render darboğazı kanıtlanırsa değerlendirilir. Sayfalama ve sunucu süzmesi yeterliyse eklenmez.
- **Recharts:** yeni ve genel amaçlı etkileşimli grafik ihtiyacında değerlendirilir. Mevcut ORION grafiklerini yalnız kütüphane standardizasyonu için yeniden yazma gerekçesi değildir.
- **NumberFlow:** değişen sayının hareketle okunması ürün görevini belirgin biçimde kolaylaştırıyorsa değerlendirilir; teknik tablolardaki sık güncellenen değerlerde varsayılan değildir.

## ORION sınırları

- Yeni kütüphane ORION tema tokenlarını, kare geometriyi ve Türkçe erişilebilir adları kullanmalıdır.
- Aynı ihtiyacı karşılayan iki kütüphane yan yana yaşatılmaz.
- Marka bileşeni veya erişilebilir ilkel, sayfa içinde el yapımı `div` davranışıyla kopyalanmaz.
- Kütüphane eklemek yeni bir görsel dil kurma izni değildir; `DESIGN.md` her zaman önceliklidir.
- Yeni bağımlılık kararı tip denetimi, hedefli lint, paket boyutu değerlendirmesi ve ilgili `/dev/*-preview` kontrolü olmadan tamamlanmış sayılmaz.

## Sonner uygulama sözleşmesi

- `<Toaster />` yalnız `src/app/layout.tsx` içinde bir kez monte edilir.
- Toast yalnız istemci olayından veya istemcinin aldığı sunucu sonucu üzerinden çağrılır.
- Sonuç tipi varsa `toast.success`, `toast.error`, `toast.warning` veya `toast.info` kullanılır; nötr `toast()` varsayılan değildir.
- Yönetilen uzun işlemde `toast.loading()` aynı `id` ile success/error durumuna güncellenir veya uygun olduğunda `toast.promise()` kullanılır.
- Kalıcı hata yalnız kullanıcı müdahalesi gerektiğinde `duration: Infinity` kullanır ve kapanış düğmesi taşır.
- Sayfa içi durum zaten görünür ve yeterliyse aynı bilgi ayrıca toast ile yinelenmez.
- Başlık kısa ve eyleme dönüktür; teknik ayrıntı gerekiyorsa `description` alanına taşınır.
