# Teknik resim klasörü — adlandırma önerileri

Bu bir **kural listesi değildir.** Sistem klasöre biçim dayatmaz: adını
çözemese de dosyaları saklar, çözebildiğini deftere yazar ve anlayamadığını
raporda söyler. **Hiçbir madde bir yüklemeyi engellemez.**

Aşağıdakiler "şöyle yaparsan sistem şunu da anlar" listesidir. Uymadığınızda
bir hata almazsınız; yalnızca o bilgiyi elle girmeniz ya da eksik bırakmanız
gerekir.

Neden böyle: incelenen iki gerçek teslim klasörü birbirine benzemiyordu ve
üçüncüsü de benzemeyecek. Biri tek bir monorayın paketi (174 dosya, düz yapı,
tek Excel), diğeri 15 tonluk bir köprülü vincin tamamı (454 dosya, üç seviye
iç içe, yedi Excel). Yapı işin kendisine göre değişiyor — bu bir ihmal değil.

Maddelerin kimlikleri **kararlıdır**: içe aktarım raporundaki her bulgu ilgili
maddeye bağlanır ve `src/lib/drawings/standard.ts` ile bu belge bir koruma
testiyle eşleştirilir.

---

## Ö-1 · Klasör adı parça koduyla başlasın

**Kazanç:** Paket iş kalemine kendiliğinden bağlanır; yoksa sihirbaz numarayı
sorar.

Bugün çalışan yazımların hepsi kabul ediliyor — ayraç serbest:

```
0057-00-0500 - MONORAY (1 TON)      ✓  tire ayraç, parantezde kapasite
0043-00-0000_MTC PASLANMAZ          ✓  alt çizgi ayraç
0043-00-0700 KANCA BLOĞU            ✓  boşluk ayraç
0057-00-0500                        ✓  yalnız kod
HALAT KLAVUZU (Ø325)                ✓  kod yok — içerikten çözülüyor
```

Son satır önemli: adında hiç kod olmasa bile, içindeki dosyaların ortak kod
öneki varsa sistem klasörün kodunu oradan çıkarır.

## Ö-2 · Dosya adında parça kodu geçsin

**Kazanç:** Dosya deftere ve montaj ağacına oturur; yoksa arşivde durur ve
raporda "tanınmadı" olarak listelenip elle bağlanır.

Kod `4 haneli iş - 2 haneli ek - alt segmentler` biçimindedir ve derinlik
serbesttir (üçten altıya kadar gördük):

```
0057-00-0500                 üst montaj
0057-00-0510-01              parça
0043-00-0802-00-02-06        altı segment — sorun değil
```

Fazladan bir sıfır (`00057-00-0700-02`) düzeltiliyor ve rapora bilgi olarak
düşüyor.

**Elle bağladığınız bir dosya hatırlanır:** aynı desen başka bir pakette
geçtiğinde kendiliğinden çözülür.

## Ö-3 · DXF adında malzeme, kalınlık, kod ve adet bulunsun

**Kazanç:** Kesim listesi ve sac ihtiyacı hesabı kendiliğinden çıkar.

**Sıra önemli değil.** Ad `" - "` ile bölünüp her parça kendi başına
tanınıyor:

```
S235JR - 10MM - 0057-00-0510-04 - (2 ADET).dxf      ✓
BDS - 3,6MM - 0043-00-0400-02 - (2 ADET).dxf        ✓  S'siz malzeme, ondalıklı kalınlık
0043-00-0300-01 - TEKER - (4 ADET).pdf              ✓  kod, ad, adet
0043-00-0600-01 - (2 ADET) - KANCA ASKI SACI.dwg    ✓  kod, adet, ad
```

Malzemeye desen dayatılmıyor: `S355JR` de geçerli, `BDS` de, `Kestamid` de.

## Ö-4 · Her canlı `.dwg`'nin aynı adlı bir `.pdf` eşi olsun

**Kazanç:** Üretime inen PDF'tir; eşi olmayan model imalatta görünmez.

`_Sheet` sonekli çalışma dosyaları bu maddenin dışındadır, otomatik atlanır.

İki farklı parçanın **bayt bayt aynı** PDF'i taşıması ayrıca bildirilir — bu
genellikle yanlış görünümün dışa aktarıldığı anlamına gelir. Sistem hangisinin
yanlış olduğunu bilemez, ikisini de canlı bırakır ve kararı size verir.

## Ö-5 · `İPTAL` klasörü yalnız canlı bir adın eski sürümünü barındırsın

**Kazanç:** Süperse zinciri doğru kurulur; aynı resim iki farklı içerikle canlı
görünmez.

`İPTAL` bir klasör değil bir **durumdur** ve paketin herhangi bir yerinde
olabilir (`DWG/İPTAL/`, `EXCEL/İPTAL/`). Noktasız yazım (`IPTAL`) da tanınır.

Canlıda karşılığı olmayan bir İPTAL dosyası "vazgeçilmiş olabilir" diye bilgi
olarak geçilir, deftere alınmaz.

## Ö-6 · DXF klasörünün adı içindeki dosyalarla aynı olsun

**Kazanç:** Çelişki bildirimi düşer.

`S235JR-6MM` klasörünün içinde adı `S355JR - 6MM` diyen dosyalar **iki gerçek
pakette de** vardı ve BOM her ikisinde de dosya adını doğruladı. Bu yüzden
kural şudur: **çelişkide dosya adı esas alınır.** Veri kaybolmaz, yalnız rapora
bir çelişki satırı düşer.

## Ö-7 · Excel adında tür, kod ve tarih bulunsun

**Kazanç:** Hangi sürümün geçerli olduğu ve hangi kaleme ait olduğu belli olur.

```
2.0057-00-0500_DEPO_31.07.2026.xlsx           ✓
1.0043-01-0000_URUN AGACI_25.02.2026.xlsx     ✓
1.0043-00-0050_DEPO_04,06,2026.xlsx           ✓  tarih ayracı virgül de olabilir
```

Baştaki sayı sürüm sayacıdır. Dosya adındaki kod ile içerideki satırların
kodu farklıysa **içerik esas alınır** ve fark rapora yazılır.

### Ürün ağacı Excel'i en yüksek getirili tek öneridir

`DEPO` dosyası satın almaya gider. Ama pakette bir de `ÜRÜN AĞACI` dosyası
varsa **iki şey bedava gelir**:

- `Item` sütunundaki `1 · 1.1 · 6.9.1.1` numaralandırması **gerçek montaj
  ağacıdır** (Inventor'ın yapısının kendisi) ve koddan türetilen ağaçtan daha
  doğrudur;
- `Mass` sütunu **parça ağırlıklarını** verir.

Bu dosya olmadığında ağaç kodlardan kuruluyor ve ağırlık hiç bilinmiyor.

Çalışma sayfası adı serbest (`BOM`, `Sayfa1`, `Sayfa2` — hepsi okunuyor) ve
sütun sayısı da serbest; başlıklar adlarıyla eşleniyor. Tanınmayan sütunlar
atılmaz, saklanır.

## Ö-8 · Kesilecek her parçanın DXF'i pakette bulunsun

**Kazanç:** Kesimciye eksiksiz paket çıkar.

`Plazma` ve `Lazer` kategorisindeki her BOM satırı için bir DXF bekleniyor;
eksikse rapora düşüyor.

`.bak` yedekleri **temizlemeye gerek yok** — otomatik atlanıyor ve sayımlara
girmiyor. `BÜKÜM PDF` gibi kopya dosyalar da tanınıp bir kez sayılıyor.

## Ö-9 · Üretilecek her parçanın bir resmi olsun

**Kazanç:** İmalata resimsiz parça inmez.

Kapsam dışı olanlar — bunlar için resim **beklenmiyor** ve bildirim de
yapılmıyor:

- **Satın alınan kalemler** (DIN cıvata, kama, rulman…). Katalog ürünüdür.
- **Montajlar.** Parça listesinde satırlarının olmaması doğrudur.
- **`Testere` kategorisi** — boya kesilen standart profil (`NPL 50x50x5
  L=23500`, `KARE DEMİR 30x40x24000`, `DİKİŞLİ BORU Ø33,7x3,25 L=424`).
  Tanımın kendisi imalat talimatıdır; testereciye verilecek başka bir bilgi
  yoktur. Yine de resim çizerseniz sorun olmaz.

---

## Uymadığınızda ne olur

Hiçbir şey bozulmaz. Paket açılır, dosyalar arşive girer, açılabilir ve
indirilebilir. Yalnızca:

- tanınmayan dosyalar raporda listelenir ve elle bağlanabilir,
- defter daha az bilgiyle kurulur (ağırlık, kalınlık, adet eksik kalabilir),
- paket "Eşleşmemiş" olarak listelenip elle bir iş kalemine bağlanır.

Rapordaki **tanıma oranı** sizin notunuz değildir — sistemin o paketten ne
kadarını anlayabildiğidir.
