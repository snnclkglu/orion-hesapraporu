---
name: pano-olcu-turu
description: Bir elektrik projesi için pano yerleşiminin ölçü boşluğunu kapatır — boşluğu ölçer, aile aile ayıklar, her ölçüyü üç lensle çürütmeye çalışır, migration üretir ve uygular. Yeni bir iş (0026 gibi) geldiğinde ya da "panoya girmeyen aygıtlar çok" / "ölçüsü bulunamayan ekipman var" denildiğinde kullanılır.
---

# Pano ölçü turu

Bu bir YORDAMDIR. Kurallar `docs/agent/panoyerlesimi.md` dosyasındadır ve o
defter dosya yoluna göre kendiliğinden yüklenir; burada duran, iki turda
(0019 · 0026) oturmuş ve tekrar edilebilir olan İŞİN SIRASIDIR.

**Neden bir yordam gerekiyor:** sınıflandırıcı hangi işte kurulduysa onun
kelime dağarcığını taşır. Ölçüldü — 0019 (Siemens/ABB) üzerinde kurulan sözlük
0026'da (Schneider) 54 üründen 22'sini sınıflayamadı (%41) ve kullanıcı bunu
"panoya girmeyen aygıtlar (50)" olarak gördü. Yeni bir marka her geldiğinde
aynı tur yeniden yürür.

## 0 · Önce ölç, sonra konuş

```bash
python scripts/switchboard-live-dump.py <IS-NO>
npx tsx scripts/test-switchboard-layout.ts .tmp/pano/<IS-NO>/parts.json --kararlar .tmp/pano/<IS-NO> --svg .tmp/pano/<IS-NO>/svg --png
```

`--kararlar` kullanıcının KARARLARINI da (kilit, sabitleme, ayar) okur;
kararsız ölçüm ekrandakini yeniden üretmez (0026'da kararsız 1600 mm iki göz,
kararlı 2313 mm taşan tek gözdü — Plan F0). "Kararlar kalkarsa ne olur"
sorusu `--kararsiz` ile ölçülür.

Bu çıktı turun BAŞLANGIÇ ÖLÇÜSÜDÜR ve sonunda aynı komutla karşılaştırılır.
Beş sayı not edilir: **sınıflanmamış ürün · kuyruk (sebep dağılımıyla) ·
ölçüsü doğrulanmamış aygıt · dizi ölçüleri · düşen denetim**.

Fikstür repoda değildir (müşteri belgesi). Yoksa `electrical_parts` satırları
veritabanından çekilip `scripts/switchboard-parts-dump.ts`in okuduğu snake_case
JSON olarak yazılır.

## 1 · Boşluğu ETKİYE göre sırala (PANO-18)

```bash
npx tsx scripts/switchboard-dimension-gap.ts .tmp/electrical-parts-all.json --marka SCHNEIDER
```

Sıra ETKİDİR, alfabe değil: 970 adet geçen bir klemensin 1 mm'si panoyu bir
metre büyütür, tek adet geçen bir sinyal lambasının 10 mm'si hiçbir şeyi
değiştirmez. Üç kova: `ölçüldü` · `tahmin` · `eksik`.

## 2 · Kuyruğu SEBEBİYLE oku

Kuyruktaki her sayı bir eksik DEĞİLDİR ve bu ayrım turun en önemli adımıdır:

| Sebep | Anlamı | Yapılacak |
|---|---|---|
| `saha` | Pano dışı ekipman (motor, enkoder, PT100, yük pimi) | **Doğru.** Sayı büyük olmalı. |
| `urunsuz` | Aygıt etiketi var, malzeme satırında ürün yok | Belgenin boşluğu; kullanıcıya söylenir |
| `siniflanmamis` | Sözlük bu ürünü tanımadı | **Gerçek eksik** → adım 3 |
| `olcusuz` | Sınıflandı ama ölçüsü yok | **Gerçek eksik** → adım 4 |
| `sigmadi` | Yerleşemedi | Bölme/ızgara sorunu → yerleştiriciye bak |

## 3 · Sözlüğü AİLE AİLE genişlet (PANO-20 · PANO-25)

`src/lib/electrical/category.ts` ve `src/lib/switchboard/mount.ts`.

- Her yeni anahtar kelime İKİ İŞTE birden sınanır: yeni iş DÜZELMELİ, eski iş
  BİT AYNI kalmalı. `npx vitest run src/lib/switchboard` ve 0019 çıktısı
  gerileme korumasıdır.
- Terim genel mi özel mi, ona bakılır. Ölçüldü: `STAY PUT` sınır şalteri
  işareti sanıldı, oysa 0019'un `XB4BD21` kapak seçici şalteri de öyle diyor —
  o terim mandallı/yaylı ayrımıdır. Eklendi, ölçüldü, GERİ ALINDI.
- Türkçe katlama tuzağı: `trKatla` uygulanmış metinde arama yapılır
  (`/KALDIRMA/i` "Kaldırma"yı BULMAZ).

## 4 · Ölçüyü ÜÇ LENSLE çürütmeye çalış (PANO-20 · PANO-21)

Ölçü üretilmez, BULUNUR. Aday ölçü üç bağımsız lensten geçer:

1. **sahiplik** — bu sayı gerçekten BU ürünün mü? (tip numarasının bir sayfada
   geçmesi sahiplik değildir, PANO-17)
2. **alıntı** — kaynakta birebir geçiyor mu? (belge · sayfa · alıntı)
3. **fizik** — sayı fiziksel olarak tutarlı mı? (kutup sayısı × modül adımı,
   akım sınıfına göre gövde, komşu ürünlerle sıralılık)

**Çoğunluk kuralı:** en az ikisi çürütemiyorsa ölçü kabul edilir. Çürütme
AİLEYE YAYILIR: bir ölçü çürütülünce aynı aileden türetilmiş bütün satırlar
yeniden bakılır — kademeli doğrulamanın kör noktası budur.

Ham arama:

```bash
npx tsx scripts/probe-device-dimensions.ts "<katalog.pdf>" <TİP-NO> "<bağlam>"
```

Betik yalnız belgede GEÇEN sayıları basar; hangisinin en/boy/derinlik olduğuna
insan karar verir (değişmez md. 4). **Bulunamayan ölçü BOŞ kalır.**

## 5 · Migration üret

```bash
npx tsx scripts/seed-device-models.ts <onayli.json> <parts.json> --out supabase/migrations/<damga>_<ad>.sql
```

`lookup_key` plandaki markadan değil GERÇEK malzeme satırlarından üretilir
(`materialCatalogIdentity`, ELEKTRIK-12); aynı ürün iki tedarikçi yazımıyla
geçiyorsa İKİ anahtar da yazılır. Elle girilmiş ölçü EZİLMEZ
(`on conflict … where source <> 'elle'`).

## 6 · Migration'ı UYGULA (değişmez md. 9)

Sırayla, atlamadan:

```bash
ls supabase/migrations | tail -5
```

Aynı gün başka bir dosya aynı damgayı almışsa yeniden adlandır — **bu iki kez
yaşandı** (eş zamanlı bir oturum `…000007` ve `…000009` civarını aldı).

Sonra `begin; … rollback;` provası, sonra gerçek uygulama ve
`supabase_migrations.schema_migrations` kütüğüne damga. Yollar:

- **Management API** — `sbp_…` erişim jetonuyla
  `POST /v1/projects/<ref>/database/query`. Jeton süresi dolmuşsa 401 döner;
  User-Agent başlığı yoksa Cloudflare 403/1010 verir ve bu FARKLI bir hatadır.
- **Havuz (pooler)** — `.env.frankfurt` içindeki `SUPABASE_DB_PASSWORD` ile
  `aws-0-<region>.pooler.supabase.com:5432`, kullanıcı `postgres.<ref>`.
  Python'da `psycopg` kurulu.

`supabase db push` KULLANILMAZ: bekleyen bütün migration'ları uygular ve eş
zamanlı çalışan başka bir oturumun henüz istemediği dosyaları da gönderir.

## 7 · Tekrar ölç ve karşılaştır

Adım 0'ın komutu yeniden koşulur ve beş sayı yan yana yazılır. **Eski iş bir
GERİLEME KORUMASIDIR** — 0019'un dağılımı değişmemelidir.

```bash
npx vitest run src/lib/switchboard src/lib/diagrams src/lib/electrical
npm run build
```

`npm run build` yayından önce ZORUNLUDUR: `"use server"` dosyalarındaki
sabit dışa aktarımlarını ne `tsc` ne `vitest` görür.

## 8 · Deftere yaz

Kapanmayan her ürün `docs/agent/panoyerlesimi.md` içindeki ÖLÇÜM bölümüne
GEREKÇESİYLE yazılır — "üretici kesit ölçüsü yayımlamıyor" bir sonuçtur ve bir
sonraki turun aynı ürünü yeniden aramasını engeller. Yeni bir kural çıktıysa
`PANO-N` olarak eklenir; kök `AGENTS.md`e YAZILMAZ.
