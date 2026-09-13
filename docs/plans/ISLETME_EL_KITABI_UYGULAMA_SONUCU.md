# İşletme el kitabı — uygulama ve kontrol kaydı

13.09.2026 · Pilot: 0026-01 / ASTOR A.Ş.

## Fazların sonucu

| Faz | Uygulama | Ara kontrol |
|---|---|---|
| 0 — Temel kayıt | Gerçek V1 gövdesi, tam paket, kaynak JSON ve seçimler alındı. | 267 blok, 111 bölüm, 12 kök; kullanıcı düzenlemesi ve ek seçimleri kayıtlı. |
| 1 — Görsel sistem | 10,5 pt metin, tam genişlik, belirgin bölüm başlığı, uyarı şeridi, ortak marka renkleri. | Konecranes örneğinin sayfa hiyerarşisi incelendi; teknik metni kopyalanmadı. |
| 2 — Prototip | Kapak, künye, prosedür, görsel/açıklama, hesap şeması, bakım tablosu. | Gerçek PDF PNG'leri: kapak, s. 9, 16, 20, 31 ve 40 gözle kontrol edildi. |
| 3 — Veri sözleşmesi | v2, tasarım sürümü, üç zengin içerik türü, kalıcı şablon blok anahtarı. | Geçiş, kayıt döngüsü, kullanıcı metni/kimliği/kapsam koruması testleri. |
| 4 — Sayfalama | İki çizicinin ortak sayfa planı; gerçek font ölçüsü; uzun satır bölme; tablo başlığı tekrarı. | 53 sayfanın tamamında 0 eksik metin satırı, 0 dış taşma. A4 ölçüsü gerçek PDF testiyle doğrulandı. |
| 5 — Editör | Yeni blok menüsü, doğrudan görsel yükleme, adım sonuçları, şekil numaraları, geri al/yinele, okunur önizleme boyutu. | Tarayıcıda blok ekleme, düzenleme, geri al, yinele, yerel taslak kurtarma ve kalite ekranı kontrol edildi. |
| 6 — Şablon/pilot | Eski düzenlemelere dokunmadan sıralı listeler ve hasar fotoğrafları yeniden düzenlendi; 0026'nın yayımlanmış hesabından halat donanımı şeması eklendi. | 267 eski blok kimliği korundu; yalnız bir yeni hesap şeması eklendi. V1 korunur, V2 inceleme taslağı ayrı açılır. |
| 7 — Ek/yayım | Seçili ek sırası korunur. Eksik dosya yayımı durdurur. İki teslim PDF'i hash ve kaynak manifestiyle arşivlenir. | Gerçek mekanik hesap + elektrik projesi + katalog paketi üretildi. Eksik teknik şartname açıkça saptandı. DB eski istemci/arşivsiz yayım testleri geçti. |
| 8 — Kabul | Üretim derlemesi, TypeScript, lint, birim ve PDF testleri. Kullanıcı onayıyla tüm tamamlanan çalışmalar birlikte Git'e alınır. | Son Git ve test sonucu aşağıdaki teslim notlarında kayıtlıdır. |

## Korunan davranışlar

- Bölüm, alt bölüm, serbest metin, görsel, tablo ve kullanıcıya özel içerik düzenlenebilir.
- Kapsam paketi ve tek tek ek seçimi korunur. Gizlemek silmek değildir.
- Elektrik projesi, hesap raporu, teknik resim ve katalog kaynak seçicileri çalışmaya devam eder.
- Eski yayınlar dönüştürülmez. Yeni tasarım taslak üzerinde veya yeni revizyonda uygulanır.
- Teknik değerler uydurulmaz; kaynak verileri değiştirilmedi.

## 0026'nın son incelemesinde görülecek açık içerikler

Bunlar tasarım hatası değil, kaynak belgenin mevcut hazırlık durumudur:

- Teknik şartname eki seçili, fakat yüklenmiş dosya yok. Seçimi korunmuştur.
- Önceki taslakta üretici ve 24 vince özel bölüm boş/eksik işaretlidir. Pilotun
  künyesi mevcut proje kaynaklarından tamamlanır; teknik açıklamalar otomatik uydurulmaz.
- Yağ ürünleri ve cıvata momenti gibi sahaya/ekipmana özgü boş alanlar korunur.
- Eski iş emri PDF'indeki 15,50 m ile güncel hesap/projedeki 14,85 m farkı kayıtlıdır.
  Pilot, güncel yayımlanmış hesap kaynağının 14,85 m açıklığını kullanır.

## Kontrol betikleri ve yerel kanıt

- `scripts/manual-audit.ts`: gerçek V1 ve ekli paket; `--pilot` yeni tasarımın aynı kaynaklarla çıktısı.
- `scripts/manual-pilot.ts`: 0026 inceleme kopyası ve ortak sayfa planı.
- `scripts/check-manual-plan.py <pdf> <plan.json>`: her gerçek PDF satırının planda karşılığı, A4 ölçüsü ve dış taşma.
- `scripts/manual-db-tests.sql`: gerçek taslak üzerinde transaction içinde koruma provası; sonunda rollback.
- `src/lib/manual/__tests__/modern.test.tsx`: sürüm, içerik, şablon dönüşü, sayfalama, atıf ve gerçek PDF.
- `src/lib/manual/__tests__/delivery.test.ts`: iki dosyalı yayım, hash, eksik ek, eşzamanlı kaynak değişimi, atomik kayıt hatası.
- `tmp/manual-redesign/`: gerçek iş verileri ve PDF'ler; Git'e gönderilmez.

## Kontrol sırasında giderilen kusurlar

1. Mutlak konumlu React-PDF Page yüksekliğinin sıfıra düşmesi.
2. Kesirli metin kutusunda başlık ve sinyal kelimesinin kaybolması.
3. Eklenen bloktan sonra standarda dönüşün yanlış sıra üzerinden eşleşmesi.
4. Normal tablo satırının sayfa sonunda ikiye bölünmesi.
5. Kısa paragraf/madde sonunun sonraki sayfada tek satır kalması.
6. Yeni önizlemede seçili sayfaya kaydırma kimliğinin eksik olması.
7. Atıf kontrolünün JSON tablo köşeli parantezlerini yanlışlıkla atıf sayması.
8. Teknik resim otomasyonu eklendikten sonra hesap kaydetme testinin eski dönüş sözleşmesini beklemesi.

Yayım arşivi teknik olarak hazırdır; pilot bir **inceleme taslağıdır**. Kullanıcının
son belge kontrolü yapılmadan eksik teknik alanları tamamlanmış veya belgeyi
teslim edilmiş kabul eden bir durum atanmaz.


## Son kontrol sonuçları

- Tüm depo: **295 test dosyası geçti, 2 dosya atlandı; 4184 test geçti, 10 test atlandı.**
  Komut: `vitest run --maxWorkers=2 --testTimeout=30000`.
- Son eklenen tablo/atıf regresyonu dahil el kitabı: **13 dosya, 180/180 test**.
- Üretim derlemesi başarılı; TypeScript kontrolü başarılı.
- El kitabı kapsamındaki ESLint: hata ve uyarı yok.
- Migration `20260913010000_manual_design_delivery` uygulandı; eski istemci ve arşivsiz yayım
  reddi transaction içinde doğrulandı ve prova değişiklikleri geri alındı.
- Gövde: 53 sayfa. PDF-plan karşılaştırması: 0 eksik satır / 0 dış taşma.
- İlk genel paralel koşudaki PDF süre aşımı testleri ayrı koşuda 63/63 geçti;
  ardından bütün depo düşük paralellikte baştan sona geçti.
- Eski doküman bölme betiği `PLAN ESKİMİŞ: Mimari ilkeler|hesap motoru saftır`
  nedeniyle daha yazma aşamasına gelmeden durdu. El kitabı kural yönlendiricisi ve
  manifest kapsamı mevcut biçimle doğrudan güncellendi; alan dokümanı asıl kaynaktır.
