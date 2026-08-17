# Belge kimliği, PDF ve Excel

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/belge.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/pdf/**` · `src/lib/excel/**` · `scripts/check-pdf-layout.py`


Marka altyapısı `pdf/brand.tsx`tedir ve TÜM belgeler onu paylaşır:

- **`BrandBand`** — ilk sayfanın üst bandı: solda lockup logo, sağda doküman
  kodu + revizyon/tarih, altında kömür kural. Müşteriye TESLİM EDİLEN her
  belgenin ilk sayfası markayı taşır; kırmızı omurga ve folio tek başına
  logonun yerini tutmaz. Hesap raporu kapağı ile ekipman listesinin ilk sayfası
  aynı bileşeni kullanır, ikisi aynı yüksekliğe oturur.
- **`CompanyBlock`** — sayfa dibindeki firma künyesi, folio satırının ÜSTÜNDE.
  İki sütundur: solda KİMLİK (firma adı gövde ailesinde + adres), sağda
  İLETİŞİM. Üç satır alt alta mono gri metin okunmuyordu — firma adı adresten
  ayrışmıyor, iletişim adresin devamı gibi duruyordu.

  **AYIRICI ÇİZGİ KÜNYENİN ALTINDADIR, ÜSTÜNDE DEĞİL** (kullanıcı bildirimi,
  12.08.2026: *"ilk sayfa footer bana hâlâ karmaşık geliyor"*). Çizgi üstteyken
  künye ile folio satırı tek bir üç satırlık gri yığın gibi okunuyor, adresin
  nerede bitip doküman satırının nerede başladığı seçilemiyordu. Çizgi araya
  alınınca iki bölge ayrışır: üstte FİRMA kimliği, altta BELGE kimliği. Çizgi
  hâlâ TEKTİR — künye yokken aynı çizgiyi folio satırının kendisi çizer.

  **KAPAKTA MARKA ADI BİR KEZ GEÇER.** Altbilgi doküman satırı normalde
  `ORION CRANES · HESAP RAPORU · REV 05 · 2026`tır ve diğer sayfalarda markayı
  taşıyan tek satır odur. Kapakta ise künye hemen üstündedir; önek orada
  düşürülür (`coverDocLineFor`), yoksa aynı ad altbilgide iki kez yazılırdı.

### Hesap raporunun üç seviyesi

`ReportLevel` yalnız ayrıntı düzeyi değil BÖLÜM KAPSAMI da seçer (kullanıcı
kararı, 12.08.2026):

| | Özet | Standart | Detaylı |
|---|---|---|---|
| Kapak + Özet bölümü | ✓ | ✓ | ✓ |
| İçindekiler | — | ✓ | ✓ |
| Hesap bölümleri | — | ✓ (yalnız sonuç) | ✓ (formüllerle) |
| Kontrol Özeti | — | — | ✓ |
| Ek — Kaynaklar | — | ✓ | ✓ |
| Gizlilik koşulları | — | KISA | TAM |

**Kontrol Özeti bir DİZİNdir**, bir liste değil: her satırın solunda kontrolün
dayandığı hesabın SAYFA NUMARASI durur ve o numara tıklanabilir. O hesap yalnız
detaylı raporda tam basıldığı için dizin başka seviyede kendi kaynağını
gösteremezdi; standart raporda satır içi kontroller zaten bölümlerinde durur.
Aynı sebeple içindekiler de o satırı yalnız detaylıda listeler — basılmayan bir
bölümün sayfa numarası "—" kalır ve bağlantı hiçbir yere gitmezdi.

**GİZLİLİK VE KULLANIM KOŞULLARI Ek'in ALTINDADIR, ayrı bir yaprak değil**
(kullanıcı kararı: *"Ek ve bu yazı 1 sayfayı geçmesin"*). Metin kaynak
listesinden daha küçük (6,5pt) ve daha silik basılır — aynı ağırlıkta dizilseydi
belgenin son sözü mühendislik değil hukuk metni olurdu. Metin bir HUKUKÎ
BEYANdır: sözcükleri kullanıcı yazmıştır ve düzenlenmez; standart raporun kısa
sürümü hiçbir koşulu GEVŞETMEZ, aynı koşulları daha az sözcükle söyler. Hukukî
metinde ticari ad değil TÜZEL KİŞİ adı geçer (`LEGAL_ENTITY`).

Üç kural da PDF'in METNİNDEN ölçülerek korunur
(`__tests__/report.smoke.test.tsx` — "rapor seviyeleri" bloğu): bileşen ağacına
bakmak, seviyenin gerçekten belgeye yansıdığını göstermez. Yerleşim denetçisi
(`scripts/check-pdf-layout.py`) özet raporda içindekiler ARAMAZ; ayrımı dosya
adından değil belgenin kendisinden okur (`has_module_sections`).

**Dosya adı tek yerdedir: `pdf/doc-naming.ts`.** Firma kuralı
**İŞ ADI - DOKÜMAN KODU - VERSİYON**, tamamı BÜYÜK HARF, sonda belgenin
türü/seviyesi:

    AMONYUM SÜLFAT TESİSİ VİNCİ - ORC-HR-0055-R01 - V1 - DETAYLI.pdf
    AMONYUM SÜLFAT TESİSİ VİNCİ - ORC-EQ-0055-R01 - V1 - EKİPMAN LİSTESİ - DETAYLI.pdf
    MUHTELİF VİNÇLER - 0075 - FR.11.02 - İŞ EMRİ.pdf

Büyük harf `tr-TR` ile yapılır (`toUpperCase()` "i"yi "I" yapar). Doküman kodu
`docCode(kind, docNo, revNo)` ile üretilir ve PDF'in kendi künyesiyle AYNI
fonksiyondan gelir — dosya adı ile belgenin içi ayrışamaz.
