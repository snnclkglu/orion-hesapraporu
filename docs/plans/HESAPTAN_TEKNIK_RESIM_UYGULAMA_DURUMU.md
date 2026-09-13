# Hesaptan Teknik Resim Takibi — uygulama ve kontrol kaydı

Tarih: 12–13.09.2026. Durum: Uygulama tamamlandı; Supabase migration uygulandı. Web uygulaması yayına alınmadı.

## Tamamlanan davranış

- Hızlı otomatik seçim penceresi genişletildi. Tercihler masaüstünde üç sütun; içerik kayar, işlem düğmeleri sabit alt bölümde kalır.
- Mühendislik hesabının ilk başarılı kullanıcı kaydı boş teknik resim planını oluşturur. Teklif hesaplarında çalışmaz.
- Mevcut hesap motorunun modül ve topoloji yardımcıları kullanılır. Ortak arabadaki iki kaldırma aynı şasi/yürütme grubuna; ayrı arabalar ayrı montajlara bağlanır.
- Operatör kabini, elektrik odası/klimalar, panolar, enerji besleme tipi, halat donanımı, emniyet freni ve kanca/kaldırma kirişi hesapta tanımlanan kapsamdan çıkarılır. Platform/yaşam hattı gibi kesin olmayan imalat grupları isteğe bağlı önerilir.
- Ana araba başlangıcı 1500, ikinci araba 2500. Başlangıçlar ve tek tek kodlar değiştirilebilir. Numara alanı dolduğunda uyarı verilir; mevcut kodlar kendiliğinden kaydırılmaz.
- Görünüm sırası numaradan bağımsızdır. Fare/klavye ile sürükleme, yukarı/aşağı, açık üst montaj seçimi, ekleme, silme, geri alma ve kaldırılmış otomatik grubu geri getirme bulunur.
- Otomatik kaynak kimliği ve alan bazında manuel tercihler korunur. Hesapta artık bulunmayan satır mühendis kararıyla kaldırılır veya manuel tutulur. Eski manuel planlar otomatik olarak yeniden yazılmaz; hesap grupları mevcut satırlarla eşleştirilebilir.
- Kaynak revizyon değişiklikleri ve yeniden numaralandırma taslağa uygulanmadan önce karşılaştırmalı gösterilir. Sekmeler arasında geçiş taslağı kaybetmez. Kayıt hatası taslağı temizlemez; kayıt sürerken alanlar kilitlenir.
- Ekipman + Teknik Özet indirmesinde son bölüm Teknik Resim Numaralandırmasıdır. Notlar önce gelir. PDF, Excel ve el kitabı kaynağı aynı montaj sırasını kullanır. Yalnız ekipman/müşteri kapsamına iç plan eklenmez.

## Kontrol fazları

| Faz | Sonuç | Kanıt |
| --- | --- | --- |
| 1. Çıkarım ve numaralandırma | Geçti | Ortak/ayrı araba, sabit düzen, monoray, kabin/oda, enerji beslemesi, çift tambur, manuel tercihler, silme ve alan dolması testleri |
| 2. Kayıt ve veri bütünlüğü | Geçti | Geri alınan PostgreSQL testleri: kod takası, eski sürüm, tekrar kod, döngü, kaldırılmış ebeveyn, yetkisiz yazma, yabancı proje/kaynak, eski hesap damgası, tekrar kayıt |
| 3. Revizyon bağlantısı | Geçti | İlk üretim ve idempotans; mevcut manuel planın korunması; başka kaynak revizyonuna müdahale etmeme; okuma hatasında yazmama |
| 4. Arayüz | Geçti | 320/375/768/1024/1440 genişlikleri; 0/1/25/120 satır; uzun adların sarılması; fare ve klavye sürükleme; silme/geri getirme; 2500 → 4000 önizlemesi |
| 5. Çıktılar | Geçti | Gerçek üreticilerle 120 satırlı Excel/PDF; geri okunan bütün numaralar ve sıra eşleşti. PDF'nin 13–16. sayfaları ve Excel numaralandırma bölümü görsel incelendi |
| 6. Regresyon ve derleme | Özellik kontrolleri geçti; son ortak derleme engelli | 9 test dosyasında 113 test, yapılan TypeScript/lint kontrolleri ve ilk üretim derlemesi geçti. Sonraki eşzamanlı el kitabı değişiklikleri son ortak derlemeyi durdurdu; ayrıntı aşağıda |
| 7. Supabase | Uygulandı | `20260912233000_drawing_plan_automation.sql`; mevcut satır içeriği işlem öncesi/sonrası karşılaştırıldı; RLS doğrulandı |

Kaynak silinmesi testi uygulamanın mevcut yönetici onay akışı üzerinden yalnız test revizyonunda çalıştırıldı. Planın korunması ve kaynak bağlantısının boşalması doğrulandı. Bütün test kayıtları geri alındı; şirket projelerine test verisi yazılmadı.

## Teknik sınırlar

Plan proje düzeyindedir; hesap revizyonu snapshot'ına gömülmez. Mevcut bir plan başka revizyona kendiliğinden bağlanmaz. Yayımlanmış eski bir rapordan indirme de projenin güncel resim planını kullanır.

Montaj ilişkisi kod aralığından türetilmez: 2300 kancası ana arabada, 4000 ikinci araba olabilir. Eski bant yardımcıları tarihsel uyumluluk için korunur. Yeni kod önerileri yüzlüktür; mevcut ara kodlar ve elle verilmiş dört haneli kodlar saklanabilir.

Satır sınırı kaldırma tercihlerini saklayan otomatik satırlar dahil 120'dir. Belirsiz imalat kapsamı otomatik kesinleştirilmez. Ressamın teslim ettiği teknik resim paketlerine bağlantı eklenmez.

## Kontrolleri yeniden çalıştırma

- `npx vitest run src/lib/drawing-plan src/lib/__tests__/drawing-plan.test.ts src/lib/__tests__/equipment-summary.test.ts src/lib/__tests__/equipment-sections.test.ts src/lib/calc/__tests__/ground-crane.test.ts src/lib/calc/__tests__/topology.test.ts src/lib/calc/presentation/__tests__/module-access.test.ts src/lib/pdf/__tests__/equipment-report.test.tsx`
- `npx tsc --noEmit`
- `npm run build`
- `npx tsx scripts/test-drawing-plan-output.ts` — `.test-output/drawing-plan-120.xlsx` ve `.pdf`; 120 satır, baştaki sıfırlar, sıra ve kapsam kontrolleri.
- `npx tsx scripts/test-equipment.ts .test-output/drawing-plan-equipment.xlsx` — mevcut ekipman, müşteri ve katalog ekli belge regresyonu.
- `python scripts/drawing-plan-db-check.py test` — pg8000, yerel Supabase bağlantı ayarları ve gerektiğinde `PYTHONPATH=tmp/db-libs`; test işlem sonunda geri alınır.
- `python scripts/drawing-plan-db-check.py verify` — uygulanmış migration kaynağı ve RLS.
- `/dev/drawing-plan-preview` — yalnız development; örnek kayıtlar ve gerçek düzenleyici.

Çalışma ağacındaki bağımsız katalog ve diğer çalışmalar korunmuştur. Bu geliştirme için web yayını, git commit veya push yapılmamıştır.
## Ek doküman denetimi

`agent-docs/doctor.ts` çalıştırıldı. Bu geliştirmeden bağımsız mevcut PANO-38, PANO-39, PANO-40 ve PANO-41 atıfları için dört eksik madde hatası ve 14 uyarı bildiriyor. İlgisiz pano dokümanları bu çalışma kapsamında değiştirilmedi. Teknik resim kodu, migration, TypeScript/lint ve belirtilen regresyon kontrolleri başarılıdır.

## Son ortak derleme durumu — 13.09.2026

İlk üretim derlemesi tamamlandı. Son tekrar sırasında çalışma alanında bağımsız
el kitabı geliştirmesi devam ediyordu. Güncel derleme derleme aşamasını geçti,
TypeScript aşamasında `src/lib/manual/payload.ts:118` üzerinde durdu:
`templateToSection` içindeki `blocks` dizisi `null` içerebilen bir tipten
`ManualBlock[]` tipine daraltılamıyor. Önceki tekrar aynı dosyanın
`blockHasContent` fonksiyonunda, bu sırada değişen yeni blok türlerine bağlı
bir hata bildirmişti. Bu dosyalara teknik resim çalışması tarafından müdahale
edilmedi. Canlı web yayını yapılmadı; ortak çalışma ağacı için yayın öncesi
başarılı derleme tekrar alınmalıdır.

Bu engel teknik resim migration'ının uygulanmasına veya geçen 113 regresyon
testine ait değildir. Son derleme çıktısı `.test-output/drawing-plan-build.log`
içindedir. Resim planı, kayıt testleri, tarayıcı kontrolleri ve PDF/Excel
kabul kontrolleri tamamlanmıştır.
