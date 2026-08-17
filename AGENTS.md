<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ORION Cranes — İş Yönetim Sistemi

Vinç işlerinin tek yerden takibi: iş emri → ürün → mühendislik → imalat → satış.
Uygulama bir HESAP RAPORU aracı olarak başladı ve adı bir süre onu taşıdı; bugün
hesap raporu bölümlerden BİRİDİR. Kapsam: iş emirleri (`/jobs`), hesap raporu
projeleri ve revizyon arşivi (`/projects`), **teknik resim paketleri**
(`/drawings` — ressamın klasörü olduğu gibi girer, RESIM-18), **satın alma**
(`/purchasing` — çok projeli talep havuzu EKİPMAN ve HAMMADDE olmak üzere iki
yüzlüdür, teklif, sipariş, teslim, fiyat arşivi, sac plaka yerleşimi; SATIN-21 / HAM-24), ekipman listeleri, üretici katalogları
(`/katalog`), atölye çalışma saatleri (`/worklog`), satış takibi (`/sales`) ve
**personel** (`/personnel` — künye ve özlük dosyaları, maaş ve fazla mesai,
bordro, harcirah, döviz kurları; PERSONEL-22).
Çok kullanıcılı: **sekiz rol**, görev etiketi YOK (ROL-15).

Uygulamanın adı TEK YERDE tanımlıdır: `src/lib/app.ts` (`APP_NAME`,
`APP_TITLE`, `APP_SHORT_NAME`, `APP_TAGLINE`) — kabuk, giriş sayfası, sekme
başlığı ve telefondaki kısayol oradan okur.

**SEKME BAŞLIĞI BÜYÜK HARFTİR — ve dönüşüm VERİDE yapılır** (kullanıcı kararı,
12.08.2026). Kabukta ad zaten büyük görünüyordu ama harfleri CSS büyütüyordu
(`.oc-kicker { text-transform: uppercase }`); sekmeye, yer imine ve ana ekran
kısayoluna metnin KENDİSİ gidiyor ve orada küçük harfle duruyordu. `adBuyuk`
kullanılır, `toUpperCase()` DEĞİL (IS-14 kuralı: "İş" → "IS" olurdu).
`APP_SHORT_NAME` ayrıdır çünkü ana ekran ikonunun altında ~12 karakter
görünür — orada kimlik markanın kendisidir ("ORION").

**İKONLAR ÜRETİLİR, ELLE ÇİZİLMEZ** (`scripts/make-icons.ts`). Tek kaynak
`public/brand/orion-symbol.svg`; betik ondan sekme ikonunu (`app/icon.svg`,
`favicon.ico` — 16·32·48 PNG'li gerçek bir ICO kabı), iOS ana ekran ikonunu
(`app/apple-icon.png`) ve PWA ikonlarını üretir. **MASKELENEBİLİR SÜRÜM
AYRIDIR**: Android launcher ikonu daireye/squircle'a kırpar ve yalnız ortadaki
%80'i garanti eder, o yüzden orada sembol küçülür ve köşe yuvarlaması olmaz.
Tek dosyayı ikisine birden vermek sembolü kenarlarından kestirirdi.

**MANİFEST ÇEREZSİZ İSTENİR.** `proxy.ts` matcher'ı `manifest.webmanifest`i
MUAF TUTAR: tarayıcı manifesti `credentials: "omit"` ile çeker, muafiyet
olmadan oturumsuz sayılıp `/login`e yönlendiriliyordu ve Chrome bir HTML
sayfası okuyup manifesti geçersiz sayıyordu — telefona eklenen kısayolda ne ad
ne logo çıkmasının sebebi buydu. İkon dosyaları uzantılarıyla zaten muaftı.

## Temel ilke: hesap yöntemi standartlara dayanır, bir tabloya değil

Uygulama ilk sürümünde bir Excel dosyasından port edilmişti. **Bu bağımlılık
kaldırılmıştır.** Hesap motoru artık kendi yöntemini doğrudan standartlara
dayandırır:

- **FEM 1.001** (3rd Ed. Rev. 1998) — sınıflandırma, yükler, halat/tambur/
  makara/tekerlek/rulman seçimi, plaka burkulması; **Kitapçık 9** ile
  güncellenen dinamik katsayı φ2 (md. 9.3) ve savrulma modeli (md. 9.4.1)
- **DIN 15018** — çelik yapı yorulması (Tablo 17/18, Tablo 2 dinamik katsayı)
- **DIN 15400 / 15401 / 15402** — dövme kanca taşıma kapasiteleri
- **DIN 15407 / 15408** — lamel (sac perçinli) kanca; kapasite ve ana ölçüler
  standardın kendi satırındadır (bkz. HESAP-8e)
- **DIN 15061** — halat yivi adımı
- **CMAA 70** — motor gücü, mil gerilmeleri, sehim sınırı

**Excel'e bakarak kod yazma.** Yeni bir hesap eklerken kaynak standardın
maddesidir. `reference/excel-dump/` ve `src/lib/calc/__tests__/legacy/`
yalnızca **tarihsel doğrulama fikstürüdür** — şartname değildir. Bir sayı
uyuşmuyorsa öncelik uygulamanın kendi yöntemindedir; sapma gerekçesiyle
birlikte belgelenir (bkz. `__tests__/legacy/README.md`).

## Stack

Next.js 16 (App Router, TS strict) · Tailwind v4 + shadcn/ui · Supabase
(Postgres/Auth/RLS/Storage) · Zod · Vitest · @react-pdf/renderer · exceljs ·
Vercel. **Arayüz, rapor ve kod yorumları tamamen Türkçedir**; tanımlayıcılar
(değişken/tip/alan adları) İngilizce lowerCamelCase.

## Güvenlik

- Token/secret asla commit edilmez; `.env*` gitignored. Service-role key sadece
  server tarafında.
- RLS: katalog tabloları herkese okuma / admin yazma; issued revizyon
  güncellenemez; audit_log insert-only.
- Admin bootstrap e-postaları: scolakoglu@orioncranes.com, sinan@vigowood.com
  (`handle_new_user` trigger'ı).

## Değişmezler

Bunlar alan dosyası okunmadan da geçerlidir. Gerekçeleri atıf verilen dosyadadır.

1. **Excel'e bakarak kod yazma** — kaynak standardın maddesidir (yukarıdaki temel ilke).
2. **Arayüz, rapor ve kod yorumları TÜRKÇE**; tanımlayıcılar İngilizce lowerCamelCase.
3. **Ad alanları BÜYÜK HARF saklanır** — `adBuyuk`/`kimlikBuyuk`, düz `toUpperCase()` DEĞİL
   ("İş" → "IS" olurdu). Dönüşüm hem formda hem Zod şemasında yapılır (`IS-14`).
4. **UYDURMA VERİ GİRİLMEZ.** Bilinmeyen alan BOŞ kalır; `0` ya da `1` varsayılmaz —
   sessiz bir varsayım, yanlış adet sipariş ettirmenin en kısa yoludur (`SATIN-21`).
5. **YER TUTUCU BİR DEĞER DEĞİLDİR.** Veri örneği taşıyan `placeholder` yasaktır;
   boş kutu `null` üretir, ekranda `—` görünür (`SATIS-16`).
6. **Renk HEX değil AÇIdır** (OKLCH ton). Doygunluk/parlaklık `globals.css`te ve tema
   başına verilir; grafikte, çipte, satır zemininde elle hex yazılmaz (`IS-14`).
7. **Çekirdekler SAFTIR.** `lib/calc`, `lib/purchasing`, `lib/personnel`, `lib/drawings`,
   `lib/panel` DB/HTTP/React içe aktarmaz.
8. **Bir kural iki yerde yaşıyorsa** (TS + SQL) ayrışmayı bir test KAYNAK DOSYAYI
   okuyarak engeller (`terms.test.ts` deseni).
9. **Migration'ı ajan uygular.** Yeni migration eklerken `ls supabase/migrations` ile
   aynı gün başka bir dosyanın aynı damgayı taşımadığı doğrulanır — çakışan sürüm
   `db push`u uzak veritabanında düşürür.
10. **Dokunmatik tabanı:** hedef `.oc-tap` ile 44px, girdi yazısı 16px, yükseklik `dvh`,
    telefonda ANA TABLO yatay kaymaz — listeye katlanır. Ayrıntı: `docs/agent/arayuz.md`.
11. **Ekran değiştirdiysen `/dev/*-preview` sayfasına ÖNCE bak** (auth'suz, gerçek fikstür).
12. **Yeni kural bu dosyaya değil alan dosyasına yazılır** (aşağıdaki harita).

## HARİTA — hangi işte hangi dosyayı okumalısın

Kural gövdeleri bu dosyada DEĞİL, alan dosyalarındadır. Bir bölüme dokunmadan
önce satırındaki dosyayı OKU. `.claude/rules/` altındaki yol kapsamlı
işaretçiler aynı yönlendirmeyi otomatik yapar; harita onların yedeğidir.

| Alan | Dosya | Kapsam |
|---|---|---|
| Hesap motoru ve modüller | `docs/agent/hesap.md` | Hesap motoru, modüller, revizyon snapshot'ı, vinç topolojisi, kesitler, birimler |
| Üretici katalogları ve katalog sayfaları | `docs/agent/katalog.md` | Katalog ürünü ↔ kullanım grubu, katalog sayfası defteri, ek belge (mühendisin kendi yaprağı) |
| Satın Alma | `docs/agent/satinalma.md` | Talep havuzu (ekipman), teklif/sipariş/teslim, fiyat arşivi, sarf gideri, KDV, tedarikçi defteri |
| Hammadde Havuzu | `docs/agent/hammadde.md` | Ayıklama dilbilgisi, beş sınıf, sac plaka yerleşimi, teklif partisi/talebi, alım analizi |
| Personel | `docs/agent/personel.md` | Dönemli kayıt, fazla mesai, ücret planı, bordro, özlük dosyası, döviz kuru |
| Teknik Resimler | `docs/agent/resimler.md` | Paket yükleme ve tanıma, hoşgörü ilkeleri, defter/ilerleme, Teknik Resim Takibi planı |
| İşler ve iş kalemleri | `docs/agent/isler.md` | İş emri → kalem → rapor bağı, doküman no, BÜYÜK HARF kuralı, müşteri defteri, İşler hub'ı |
| Teklif | `docs/agent/teklif.md` | Teklif numarası, revizyon snapshot'ı, gizleme, defter (offer_options), takip sayacı, analiz |
| Maliyet Çalışması | `docs/agent/maliyet.md` | Ayrı revizyon zinciri, ağırlık/boyutlandırma modeli, dört ana başlık, oran tabanı, iç belge |
| Satış Takibi | `docs/agent/satis.md` | job_item_sales, kur satırda donar, fiyatsız Güncel İş Listesi |
| İş Takibi | `docs/agent/worklog.md` | GÜN × KALEM × PARÇA × TÜR çizelgesi, parça/tür defteri, ortak süzgeç tanımı |
| Açılış Panosu | `docs/agent/panel.md` | Kök adres, LANDING_PATH, arama (trKatla), sinyal süzgeci, yaklaşan şeridi |
| Roller ve yetki | `docs/agent/roller.md` | Sekiz rol, yetki SORUSU (liste değil), RLS, WORKSPACE_SECTIONS, yetki ızgarası |
| Dokunmatik ve dar ekran | `docs/agent/arayuz.md` | 44px hedef, dvh, pencere kelepçesi, sütun önceliklendirme, telefonda tablo katlama |
| Belge kimliği, PDF ve Excel | `docs/agent/belge.md` | BrandBand/CompanyBlock, rapor seviyeleri, doküman kodu ve dosya adı kuralı |
| Komutlar ve duman testleri | `docs/agent/komutlar.md` | Bütün npm/tsx/python betikleri ve ne sınadıkları |
| Dizin haritası | `docs/agent/dizin.md` | Hangi kavram hangi dosyada — dosya dosya tarif |

**Madde kimliği ALAN ÖNEKİ taşır** (`ROL-15`, `HESAP-15`, `MOBIL-15`). Numara
korunmuştur; önek, aynı numaranın üç ayrı maddeye denk gelmesinden doğan
belirsizliği kapatır. Kod yorumlarındaki atıflar da bu biçimdedir.

**Yeni kural buraya YAZILMAZ**, alan dosyasına yazılır. Bu dosya her oturumda
ve her alt-ajanda bütünüyle yüklenir; büyümesi bütün ajanların bedelidir.
Yeni bir alan açılırsa `scripts/agent-docs/manifest.ts`e eklenir ve
`npx tsx scripts/agent-docs/split.ts --uygula` haritayı, alan dosyasını ve
kural işaretçisini birlikte tazeler. Denetim: `npx tsx scripts/agent-docs/doctor.ts`.

