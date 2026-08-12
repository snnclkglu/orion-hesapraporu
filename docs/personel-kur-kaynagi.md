# Personel — döviz kuru kaynağı ve otomatik tazeleme

Bu not iki soruyu cevaplar: **ekrandaki sayı nereden geliyor** ve **kendini
nasıl güncel tutuyor**. İkisi de finans müdürünün kendi defteriyle
karşılaştırma yapabilmesi için yazılıdır.

## Kaynak: TCMB döviz alış

`fx_rate_daily` tablosundaki her satır **T.C. Merkez Bankası günlük döviz kuru
bülteninin** o güne ait `ForexBuying` (döviz alış) ve `ForexSelling` (döviz
satış) alanlarıdır. Adres kalıbı:

```
https://www.tcmb.gov.tr/kurlar/<yyyyaa>/<ggaayyyy>.xml
```

**Neden TCMB, neden Frankfurter (ECB) değil.** Kullanıcı Frankfurter'ı önerdi
ve karar geliştirmeye bırakıldı. İki kaynak 2024-01 … 2026-08 arasındaki
**32 ayın tamamında** karşılaştırıldı: aylık ortalama farkı **%0,1–0,2**
bandında kaldı. Yani sayı olarak ikisi de doğrudur. Seçim başka gerekçelerle
yapıldı:

- Firma Türkiye'de muhasebe tutuyor; kur değerlemesinin yasal referansı TCMB.
- TCMB **USD/TRY'yi doğrudan** yayımlar. ECB yalnız avro tabanlıdır ve USD/TRY
  oradan çapraz hesaplanır — bir bölme, bir yuvarlama daha.
- TCMB **alış ve satışı ayrı** verir; ECB'de tek referans kuru vardır.

**ECB yedektir, alternatif değil.** TCMB'ye ulaşılamayan gün(ler) için
Frankfurter tek istekte aralığı verir, satır `source = 'ECB'` ile yazılır ve
ay künyesinde iki kaynak birden görünür (`fx_rate_monthly.sources`).

## Parite gün gün hesaplanır

```
avg(EUR/USD)  ≠  avg(EUR/TRY) / avg(USD/TRY)
```

İkincisi yanlıştır. Parite her gün ölçülen bir büyüklüktür; ortalaması
alınacak olan o günlük değerlerdir. `fx_rate_monthly` view'ı bu yüzden
`avg(eur_try / usd_try)` yazar. Fark küçüktür ve tam da bu yüzden sessizce
yanlış yazılabilir — `lib/fx/__tests__/rates.test.ts` sayıyla dondurur.

## Gün sayısı bir künyedir

Ortalama kaç yayın gününden çıktı? Tablodaki **Gün** sütunu bunu söyler.
TCMB hafta sonu ve resmî tatilde bülten yayımlamaz; **o günün kuru yoktur,
sıfır değildir.** Ayın 7. gününde bakılan bir "Ağustos ortalaması" 7 günün
ortalamasıdır ve ekran bunu "kısmi" diye işaretler.

## Geçmiş neden migration'da?

TCMB'nin aralık ucu yoktur; her gün için ayrı bir XML vardır. 2024-01 → bugün
arası **645 istek** eder ve bunu bir serverless fonksiyonda yapmak zaman
aşımına düşerdi. Geçmiş değişmez bir veridir: bir kez ölçüldü,
`20260812000011_finance_fx_seed.sql` ile depoya yazıldı.

Çalışma zamanı yalnız **son kayıttan bugüne** olan farkı çeker — normalde
20-25 istek. Pencere 62 günle kelepçelidir (`eksikGunAraligi`); daha eskisi
kalırsa ekran söyler ve kullanıcı tekrar basar.

## Tazeleme iki yoldan olur

| Yol | Ne gerektirir | Ne zaman çalışır |
|---|---|---|
| **Kurlar ekranı → "Şimdi Güncelle"** | hiçbir ayar | kullanıcı bastığında |
| **Vercel Cron → `/api/cron/fx`** | `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` | her gün 15:30 UTC (18:30 TR — TCMB bülteni yayımlandıktan sonra) |

İkisi de **aynı çekirdeği** çağırır (`lib/fx/refresh.ts`); iki yerde
ayrı yazılsaydı biri "atlanan gün"ü eksik sayar, öbürü saymazdı.

**Cron kurulmasa bile sistem çalışır.** Bölüm açıldıkça veri kendini toparlar;
cron yalnız "kimse girmese de dursun" güvencesidir. Ortam değişkenleri
eksikse uç `503` ve **nedenini** döner — cron panelinde yeşil tik görünüp
kurun hiç güncellenmemesi, bu işin en kötü sonucudur.

### Kurulum adımları (Vercel)

1. Proje ayarlarında iki değişken tanımla:
   - `CRON_SECRET` — rastgele uzun bir dizgi
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API
     (`NEXT_PUBLIC_` öneki **almaz**; alsaydı tarayıcı paketine girerdi)
2. `vercel.json` zaten depoda; dağıtımdan sonra Vercel → Cron Jobs'ta görünür.
3. `src/proxy.ts` `/api/cron/` yolunu auth dışına çıkarır. Bu satır olmadan
   çerezsiz cron isteği `/login`e 307 döner ve **cron kendini başarılı sayar**.

## Dönem kuru OTOMATİKTİR ve DONAR

`hr_periods.eur_try_rate` bir ayın **ödeme kurudur** ve satırın kendinde
durur. Merkezî kur tablosundan okunsaydı, tablo tazelendiğinde geçmiş ayların
avro karşılığı da değişirdi — Satış Takibi'ndeki `job_item_sales.fx_rate` ile
birebir aynı gerekçe (AGENTS md. 16).

Devralınan 27 ay Excel'deki kurla aktarıldı ve **o kurlar aylık ortalama
değildir**: ay sonu / ödeme günü spot kurudur. 27 ayın tamamı TCMB
ortalamasıyla karşılaştırıldı, sapma −%1,3 … +%7,8 arasında (en uç örnek
2025 Mart: Excel 43,1181 · TCMB ay ortalaması 40,0145 · ay sonu ≈ 43,2).
**Kullanıcıya SORULMAZ** (karar 12.08.2026). Maaş ekranı açıldığında
`ensurePeriodRates` çalışır ve kapanmış her ayın kuru, o ayın **son yayın
gününün** TCMB kurundan yazılır. Dört kural:

1. **"Son gün" takvimin 31'i değildir.** Ay hafta sonu ya da resmî tatille
   bitiyorsa o günün kuru yoktur; bir öncekine düşülür.
2. **İçinde bulunulan ay atlanır.** Ay bitmeden "ay sonu kuru" diye bir şey
   yoktur; şimdilik yazılan değer birkaç gün sonra yanlış olurdu.
3. **Yazılmış kur ezilmez** (`is("eur_try_rate", null)` süzgeci). Devralınan
   27 ayın Excel'den gelen kuru bu yüzden yerinde kalır.
4. **İdempotenttir.** Yapacak iş yoksa hiçbir şey yazmaz; iki kullanıcı aynı
   anda girerse ikincisinin `update`i sıfır satır etkiler.

Aylık ortalama artık yalnız **karşılaştırma** için gösterilir.
