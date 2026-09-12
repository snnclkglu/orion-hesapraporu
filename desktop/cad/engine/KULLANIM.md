# Pafta Ayıklama Aracı

Bir DWG'nin veya seçilen klasördeki DWG'lerin model uzayına yan yana çizilmiş paftaları **tek tek PDF**'e basar
ve **malzeme listelerini tek bir Excel/JSON**'da toplar.
PDF adı = antetteki **Resim No** (örn. `0063-00-0405.pdf`).

---

## 1. Kurulum (tek seferlik)

### Yeni: klasör seçerek toplu ayıklama

`7-KLASORDEN-AYIKLA.bat` dosyasına çift tıklayın. Açılan pencerede:

1. **DWG klasörü** seçin. İsterseniz **Alt klasörleri de dahil et** seçeneğini açın.
2. Çıktıların yazılacağı üst klasörü seçin. Varsayılan, kaynak klasördeki `Toplu_Cikti` klasörüdür.
3. Listeden istemediğiniz dosyaları seçip **Seçilenleri listeden çıkar** düğmesine basın. Bu, diskteki dosyaları silmez. Listede kalan bütün dosyalar işlenir.
4. İsterseniz **Önizleme** seçeneğiyle PDF basmadan paftaları kontrol edin. Bu seçenek de AutoCAD kullanır ve rapor üretir.
5. **Tümünü ayıkla / Devam et** düğmesine basın. DWG’ler sırayla işlenir; durum, pafta/PDF sayıları ve işlem günlüğü ekranda görünür.
6. **Sonuç klasörünü aç** düğmesiyle bütün sonuçlara, bir satırı seçip **Seçilenin çıktısını aç** düğmesiyle o çizimin dosyalarına ulaşın.

PDF'ler üretildiğinde otomatik açılmaz. Araç, AutoCAD PDF yazıcısının
`Orion_Sessiz_...pc3` adlı kopyasında görüntüleyiciyi açma seçeneğini kapatır.
Bu davranış tek DWG ve klasörden toplu baskıda geçerlidir. Asıl yazıcı ayarınız
korunur. Kullanılan özel PC3'te görüntüleme seçeneği bulunamazsa araç açık bir
hata bildirir; PDF'leri kendiliğinden açacak ayarla baskıya devam etmez.

Her başlatılan yeni toplu işlem, tarih ve benzersiz kimlik içeren ayrı bir klasör oluşturur:

```text
Toplu_Cikti/
  Toplu_20260911_143000_<kimlik>/
    toplu_is.json             ← ilerleme ve yeniden açma kaydı
    toplu_rapor.csv           ← çizim bazında durum, sayılar ve çıktı yolları
    <çizim kimliği>/
      deneme_001/
        islem.log
        _sonuc.json
        <DWG adı>_PDF/
          <resim numarası>.pdf
          <DWG adı>_BIRLESIK.pdf
          malzeme_listesi.xlsx
          malzeme_listesi.json
          pafta_raporu.csv
          tani_*.txt / .json
```

Aynı isimli DWG’ler farklı çizim kimlikleriyle ayrılır. Yeniden denemede
`deneme_002` gibi yeni bir klasör açılır; önceki çıktılar korunur.

**Hata ve devam etme:** Bir DWG hata alırsa diğer dosyalara geçilir. Kısmi PDF
hataları veya hiç pafta bulunamaması başarılı sayılmaz. **Hatalıları yeniden dene**
yalnızca hatalı dosyaları işler. **Bu çizim bitince durdur** devam eden DWG’yi
tamamlar ve sonraki çizime geçmez. **Devam et** bekleyenleri işler.

Pencere kapandıktan sonra **Kayıtlı işlemi aç** ile `toplu_is.json` seçilebilir.
Beklenmedik kapanışta yarım kalan çizim, çalıştırma sırasında hatalı işaretlenir;
**Hatalıları yeniden dene** ile tekrar işlenir. Kaynak DWG’ler aynı yerde kalmalıdır.
Çıktı klasörünü taşımak kaydedilmiş çıktı kısayollarını geçersiz kılabilir.

Başlamış işlemin çıktı hedefi ve önizleme modu sabittir. Önizlemeden gerçek PDF
üretimine geçmek için **Listeyi yenile**, ardından önizlemeyi kapatıp yeni işlem
başlatın. Varsayılan baskı ayarları mevcut araçtaki A3 ve monochrome ayarlarıdır.
İki yerel toplu pencere aynı anda çalışamaz. Eski komut satırı aracı veya sunucu
yardımcısını aynı AutoCAD oturumunda eşzamanlı çalıştırmayın.

AutoCAD bir iletişim kutusunda beklerse, kutuyu AutoCAD üzerinden sonuçlandırın.
Durdurma düğmesi AutoCAD’i zorla kapatmaz; mevcut çizimin tamamlanmasını bekler.

Bu pencere **yerel kullanım** içindir; Supabase’e dosya yüklemez. Web uygulamasının
kaynak kodu bu pakette bulunmadığından webde klasör yükleme ve toplu kayıt ekranı
ayrı entegrasyon gerektirir.

Başlatıcı varsa proje içindeki `.venv` ortamını kullanır; yoksa normal Python
kurulumunu kullanır. Başka bilgisayara taşırken `.venv` klasörünü taşımak yerine
o bilgisayarda Python (Tcl/Tk dahil) ve aşağıdaki paketleri kurun.

**Doğrulama (11 Eylül 2026):** Kuyruk, yeniden deneme, dosya ayrımı, açık çizimi
koruma ve pencere akışı için 16 otomatik test bulunur. Gerçek AutoCAD denemesinde
`0026-01-0100 - KÖPRÜ YÜRÜTME.dwg` için 14, `0026-01-0300 - BAŞKİRİŞ.dwg` için
8 ayrı PDF üretildi. İki birleşik PDF'nin sayfa sayıları doğrulandı; kaynak
DWG'lerin SHA-256 değerleri değişmedi. Bu kontrol çıktı üretimi ve dosya
bütünlüğünü kapsar; çizimdeki mevcut ölçek/antet bulguları tanı raporlarında kalır.

Geliştirici testleri `pafta_araci` klasöründe
`python -m unittest -v test_pafta_toplu test_pafta_klasor` ile çalıştırılır.
`dogrula_toplu_autocad.py` gerçek AutoCAD ve yukarıdaki iki örnek DWG ile ayrıca
çalıştırılabilen kabul testidir; çıktılarını `dogrulama_ciktilari` altına yazar.

### Mevcut kurulum

Gereken: **Windows + AutoCAD tam sürüm** (LT değil — LT'de ActiveX yok) + **64-bit Python**.

En kolayı, klasördeki numaralı `.bat` dosyalarını sırayla çalıştırmak:

| Dosya | Ne yapar |
|---|---|
| `1-KUR.bat` | Python'u bulur, `pywin32 + openpyxl + ezdxf` kurar, COM kaydını yapar |
| `2-CIHAZLARI-LISTELE.bat` | Plotter / kağıt / ctb isimlerini listeler (bir kez bak yeter) |
| `3-ONIZLEME.bat` | DWG veya klasörü üzerine sürükle → **PDF basmadan** ne bulduğunu gösterir |
| `4-PDF-BAS.bat` | DWG veya klasörü üzerine sürükle → PDF + Excel üretir |
| `5-TANI.bat` | Bir çizimde sonuç tuhafsa: çerçeveleri, antet etiketlerini, blok ölçeklerini ve tabloları ayrıntılı döker (`PDF\tani_*.txt`) |
| `7-KLASORDEN-AYIKLA.bat` | Çift tıkla → klasör seç, dosyaları gözden geçir, toplu ayıkla; durdur/devam et ve hatalıları yeniden dene |

Elle kurmak istersen:

```bat
pip install pywin32 openpyxl ezdxf
python -m pywin32_postinstall -install
```

---

## 2. Hızlı başlangıç (komut satırı)

```bat
cd "C:\Users\HP\Downloads\Proje Ayıklama\pafta_araci"

:: Önce sadece bak, hiçbir şey basma:
python pafta_ayikla.py "..\0063-00-0400-1 (TAMBUR TAHRIK).dwg" --dry-run

:: Beğendiysen bas:
python pafta_ayikla.py "..\0063-00-0400-1 (TAMBUR TAHRIK).dwg"

:: Bütün bir proje klasörü:
python pafta_ayikla.py "C:\Projeler\0063" --out "C:\Projeler\0063\PDF"
```

Her çizim, DWG'nin yanında **kendi adıyla bir klasöre** yazılır:

```
0063-00-0400-1 (TAMBUR TAHRIK)_PDF\
    0063-00-0400.pdf
    0063-00-0404.pdf
    ... 0063-00-0410.pdf
    0063-00-0400-1 (TAMBUR TAHRIK)_BIRLESIK.pdf   <- hepsi sıralı, tek dosya
    malzeme_listesi.xlsx      <- "Malzeme Listesi" + "Paftalar" sayfaları
    malzeme_listesi.json
    pafta_raporu.csv
    tani_....txt / .json      <- teşhis kayıtları
```

**Birleşik PDF**, paftaları resim numarasına göre küçükten büyüğe sıralayıp tek
dosyada birleştirir — toplu çıktı almak için bunu bas. Sıralama insan mantığıyla
yapılır (`0400 < 0404 < 0410`, `2200 < 2200-A < 2200-B < 2201`) ve her pafta için
bir yer imi (bookmark) eklenir, 20+ paftalık dosyada aradığını tek tıkla bulursun.
İstemezsen `--birlesik-yok`.

Toplu işlemede her DWG kendi klasörüne gittiği için dosyalar birbirine karışmaz;
ortak Excel raporu üst klasöre yazılır.

---

## 3. Seçenekler

| Seçenek | Ne yapar |
|---|---|
| `--out KLASÖR` | çıktı **üst** klasörü. Her DWG bunun altında `<dwg adı>_PDF` klasörüne yazılır (varsayılan: DWG'nin bulunduğu klasör) |
| `--birlesik-yok` | birleşik (tek dosya) PDF üretme |
| `--paper A3` | kağıt boyu. **Varsayılan A3.** `AUTO` dersen çerçeveden tahmin eder |
| `--device "DWG To PDF.pc3"` | plotter. `AutoCAD PDF (High Quality Print).pc3` de olur |
| `--ctb monochrome.ctb` | plot stili. Boş bırakırsan çizimdeki ayar kullanılır |
| `--alt-klasor` | alt klasörleri de tarar |
| `--kopya alt` | eski revizyon da çizimdeyse hangi kopya basılsın: `alt` (varsayılan) / `ust` / `hepsi` / `dur` |
| `--dry-run` | PDF basmaz, ne bulduğunu raporlar |
| `--sadece-liste` | PDF basmaz, sadece malzeme listesi + rapor üretir |
| `--gizli` | AutoCAD penceresini göstermez |
| `--liste-cihazlar` | plotter / kağıt / ctb isimlerini listeler |

İlk kurulumda bir kez şunu çalıştır — plotter'ında hangi kağıt isimlerinin
olduğunu görürsün (özellikle `full bleed` olanları):

```bat
python pafta_ayikla.py --liste-cihazlar
```

---

## 4. Ölçek nasıl belirleniyor? (önemli)

Antetteki **"Ölçek / Scale"** yazısı **kullanılmıyor** — sadece kontrol için okunuyor.

Kullanılan ölçek, çerçevenin **gerçek model ölçüsünden** hesaplanıyor:

```
N  =  çerçeve genişliği (model)  /  kağıt genişliği (mm)
```

Bu dosyada çerçeveler `5040 / 2100 / 1260 / 840 / 420` mm çıktı; A3 = 420 mm
olduğu için ölçekler sırasıyla `1/12, 1/5, 1/3, 1/2, 1/1`. Sekizinde de antetle
birebir tuttu.

Teknik ressam antete yanlış ölçek yazarsa:

* PDF **doğru** ölçekte basılır (geometriden hesaplanan),
* rapora şu satır düşer:
  `ANTET OLCEGI HATALI: antette '1/4' yaziyor, cercevenin gercek olcegi 1/3.`
* Excel'in `Paftalar` sayfasındaki **Ölçek uyumu** sütunu `UYUSMUYOR` olur.

Yani araç aynı zamanda bir **antet denetçisi** gibi çalışıyor.

> `--paper AUTO` kullanırsan dikkat: 840×595 bir çerçeve matematiksel olarak hem
> "A3 1/2" hem "A1 1/1" olabilir. Araç aynı çizimdeki diğer paftalara bakıp
> çoğunluğa uyar ve belirsizse uyarı yazar. Büro standardın A3 olduğu için
> **varsayılanı A3'te bırakman en güvenlisi.**

---

## 5. Paftalar nasıl bulunuyor?

Blok adına **bağlı değil** (bu dosyada çerçeve dinamik blok, DXF'e çevrilince
adı `*U1` oluyor — isim üzerinden aramak kırılgan olurdu). Bunun yerine:

1. Model uzayında `"Resim No / Drawing No"` yazan **her etiket** bir antettir.
2. Bu etiketi içine alan, en/boy oranı A serisine uyan (≈1.41) **en küçük blok
   çerçevesi** o paftanın sınırıdır.
3. Resim No değeri, etiketin hemen altındaki metindir — **etiketle aynı
   katmandaki** metinler öncelikli seçilir (çizimdeki ölçü/kaynak yazıları
   yanlışlıkla alınmasın diye).

Aynı mantıkla `İş / Project No`, `İş / Job Name`, `Proje / Project`,
`Firma Adı`, `Pafta No` da okunur ve rapora yazılır.

---

## 5b. Aynı çizimde "Resim No" iki yerde geçerse

Bazı şablonlarda "Resim No" hem antette (alan etiketi) hem malzeme listesinde
(sütun başlığı) geçiyor. Araç hangisinin antet olduğunu **deneyerek** buluyor:
`:` ile bitenler, iki dilin aynı metinde geçtiği hâller, katman bazlı gruplar
ve hepsi — her aday küme için çerçeveleri çıkarıp *en inandırıcı* sonucu
seçiyor. İnandırıcılık ölçütü: çerçeve boyu gerçekten `standart kağıt ×
standart ölçek` mi. Seçilen strateji `5-TANI.bat` çıktısında yazıyor.

Alan değeri seçilirken de `Poz, Item, Adet, Std, Malzeme, Tarih…` gibi başlık
kelimeleri elenir; Resim No / İş No gibi alanlarda içinde **rakam** geçen
adaylar önceliklidir.

---

## 5c. Çizimde eski revizyon da duruyorsa

Teknik ressam revize ederken çoğu zaman eski seti çizimde bırakıp yenisini
**altına** kopyalar, eskisinin üzerine de çapraz çizerek iptal eder. Bu durumda
her pafta iki kez bulunur.

Araç her pafta için bir **içerik parmak izi** çıkarır (çerçeveye göre
konumlanmış tüm metinlerin özeti) ve:

- **Parmak izleri aynı** → birebir kopya. Varsayılan olarak **en alttaki**
  tutulur (genelde güncel olan), diğeri atlanır. Ekrana hangi kümenin basıldığı,
  hangisinin atlandığı ve y konumları yazılır.
- **Parmak izleri farklı** → aynı numarayı taşıyan *farklı* iki pafta.
  Bu tehlikelidir, **ikisi de basılır** ve `DİKKAT` uyarısı düşer.

Eski set alttaysa `--kopya ust`, ikisini de istiyorsan `--kopya hepsi`,
hiç işlemesin istiyorsan `--kopya dur`. Atlanan paftalar Excel raporuna
`tekrar-atlandi` durumuyla yine girer — hiçbir şey gizlenmez.

> Bu bir tahmindir, kesin kural değil. Çizimde iki set varsa çıktıyı bir kez
> gözünle doğrula.

---

## 6. Malzeme listeleri

Her ACAD_TABLE, içine düştüğü paftaya bağlanır. Başlık satırı (`Poz / Item ...`)
tablodan **okunarak** sütunlar eşlenir; sütun sırası şablonda değişirse araç
kendini ayarlar. Üstteki `NOTE:` satırından `Toplam Ağırlık` alınır, veri
satırları Poz'a göre küçükten büyüğe sıralanır.

Excel'deki `Malzeme Listesi` sayfası sütunları:

```
Dosya | Pafta (Resim No) | Poz | Resim No / Ad | Adet | Tanımı |
Std | Malzeme | Notlar | Birim Ağ. [kg] | Toplam Ağ. [kg]
```

Bu dosyada 8 paftadan **45 malzeme satırı** çıktı.

### Elle çizilmiş (eski tip) listeler

Eski çizimlerde malzeme listesi AutoCAD tablosu değil, **çizgi + yazı** ile
yapılmış olabiliyor. Paftada hiç ACAD_TABLE yoksa araç listeyi metinlerden
kurar:

1. Başlık satırını bulur (`Poz / Item / Resim No / Adet / Tanımı …` —
   en az 4 başlık kelimesi aynı satırda).
2. Başlıktaki yazıların x konumlarını **sütun sınırı** kabul eder. Yazılar
   sola dayalı olduğu için bir metin, x'i kendisinden küçük ya da eşit en son
   sütuna aittir — böylece `Ø120 / Ø100 x 34.5` gibi parçalı yazılar tek
   hücrede birleşir.
3. Başlığın üstündeki satırları düzenli satır aralığıyla yukarı doğru tarar,
   aralık bozulunca tabloyu bitirir.
4. İki dilli başlıkları (`Poz` üstte, `Item` altta) tek başlık satırında
   birleştirir.

Bu yolla okunan listeler rapora `Malzeme listesi elle cizilmis…` notuyla
işaretlenir. `%%C`, `%%D`, `%%P` gibi AutoCAD kodları `Ø`, `°`, `±` olarak
çözülür.

---

## 7. AutoCAD'siz ön kontrol

DWG'yi DXF olarak kaydedip:

```
python pafta_dxf.py "cizim.dxf" --out kontrol
```

Aynı çekirdek mantığı kullanır; PDF basmaz ama paftaları, ölçekleri ve malzeme
listelerini saniyeler içinde çıkarır. Şablon değiştiğinde veya bir çizimde
sonuç tuhaf geldiğinde AutoCAD açmadan bakmak için pratik.

---

## 8. Sorun giderme

**"PDF olusmadi"**
`BACKGROUNDPLOT` 0 olmalı (araç kendisi ayarlıyor). Plotter adını
`--liste-cihazlar` ile doğrula.

**PDF kayık / boş çıkıyor**
Model uzayında pencere plotu görünümün `TARGET` noktasına göre yorumlanır.
Araç UCS'i World'e alıp `TARGET`'ı okuyor ve pencereden çıkarıyor; `VIEWTWIST`
sıfır değilse plan görünüme dönüyor. Yine de sorun olursa çizimi normal plan
görünümde kaydedip tekrar dene.

**Kenarlardan birkaç mm kırpılıyor**
Plotter'da `ISO full bleed A3 (420.00 x 297.00 MM)` kağıdı yoksa normal A3'ün
basılabilir alanı 420×297'den küçüktür. `--liste-cihazlar` ile kontrol et;
yoksa PC3 içinde full bleed kağıt tanımla. Araç bu durumu uyarı olarak yazar.

**"Antet bulunamadi"**
Antet metni `Resim No` ile başlamıyordur (farklı şablon). `pafta_core.py`
içindeki `LBL_DRAWING_NO` listesine kendi yazımını ekleyebilirsin.

---

## 9. Dosyalar

| Dosya | Görevi |
|---|---|
| `pafta_ayikla.py` | **Ana araç.** AutoCAD'i COM ile sürer, PDF basar, Excel üretir |
| `pafta_core.py` | Pafta/antet/ölçek/malzeme çözümleme mantığı (AutoCAD'siz, test edilebilir) |
| `pafta_report.py` | Excel / JSON / CSV yazıcıları |
| `pafta_dxf.py` | AutoCAD'siz ön kontrol (ezdxf ile DXF okur) |

Mantık `pafta_core.py`'de toplandığı için, ileride şablon değişirse tek dosyaya
dokunman yeterli; AutoCAD tarafı aynı kalır.
