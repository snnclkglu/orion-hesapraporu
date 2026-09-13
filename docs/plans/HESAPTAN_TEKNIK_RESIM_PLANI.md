# Hesap raporundan otomatik Teknik Resim Takibi

Tarih: 12.09.2026
Durum: Uygulandı. Fazlar ve doğrulamalar: [Uygulama durumu](HESAPTAN_TEKNIK_RESIM_UYGULAMA_DURUMU.md).
Kullanıcı kararı: Yeni projelerde ana araba başlangıcı **1500**, ikinci araba başlangıcı **2500**; mühendis değiştirebilir.

## 1. Hedef ve kapsam

Mühendis hesap raporunun teknik özelliklerini ve mekanik düzenini tanımlayıp kaydettiğinde, projenin Teknik Resim Takibi defteri otomatik hazırlanacak. Mühendis aynı ekranda adları ve numaraları değiştirebilecek, satır ekleyip silebilecek, sürükleyerek veya yukarı/aşağı düğmeleriyle sıralayabilecek. Son düzen, Ekipman Listesi + Teknik Özet çıktısının teknik özet bölümünün sonunda yer alacak.

Bu liste bir montaj/resim planıdır. Her katalog motoruna, rulmana ve cıvataya ayrı resim numarası üretmeyeceğiz. Örneklerin gösterdiği köprü, araba kompleleri ve onların imalat/montaj grupları seviyesinde çalışacağız. Ekran görüntülerindeki adet/ağırlık sütunlarını bu geliştirmeye taşımayacağız; istenen numaralandırma için bunlar gerekli değil. Mevcut durum, çizen ve not alanları korunacak.

Hesap formüllerinde değişiklik yok. `/drawings` teslim paketleriyle otomatik eşleme veya paket oluşturma yok. Teklif ön hesapları mühendislik defterini kendiliğinden doldurmayacak.

## 2. Ekran görüntülerinden çıkan somut kurallar

| Örnek | Gözlenen yapı | Tasarıma etkisi |
|---|---|---|
| 0019 genel liste | 0100 köprü yürütme, 0200 çelik yapı, ayrı platformlar, iki feston hattı, kabin, elektrik odası, elektrik grubu, yaşam hattı, 2000 ana araba, 4000 yardımcı araba | Donanım varlığı ve fiziksel araba sayısı satırları belirliyor; tüm projelere aynı sabit liste uygun değil. |
| 0019 ana araba | 2100 yürütme, 2200 şasi, 2300 tambur, 2400 tahrik, 2500 üst makara, 2600 travers, 2700 emniyet freni, 2800 platform, 2900 kaldırma kirişi, 3000 pano | Alt gruplar bir araba komplesine bağlı. Dokuzdan fazla alt resim olabilir. |
| 0019 yardımcı araba | 4100–4900; ana arabadan farklı alt grup listesi, kanca bloğu var | Aynı vinçte iki araba aynı şablonu birebir kopyalamayabilir. |
| 0045 genel liste | 0100 yürütme, 0200 çelik yapı, 0600 platform, 0700 feston, 1500 araba-1, 2500 araba-2 | Boş numaralar geçerli; liste sıkıştırılırken numaralar zorunlu olarak değişmemeli. |
| 0045 araba detayı | 1600 yürütme, 1700 şasi, 1800 tambur, 1900 tahrik, 2000 üst makara, 2100 denge traversi, 2200 platform, **2300 kanca bloğu** | 2300 her zaman yardımcı araba demek değil. Grup üyeliği numaradan bağımsız olmalı. |

Görüntüler ters poz sırasıyla çizilmiş anted tabloları. Uygulama varsayılan olarak üst montajdan alt montaja ve artan sırada gösterilecek; görüntüdeki ters sıralama zorunlu kural sayılmayacak. 0019'daki 0950 gibi mevcut ara numaralar korunacak, yeni öneriler 100 adımla ilerleyecek. Kapasite, adet veya kilogram bilgileri başka projelere kopyalanmayacak.

## 3. Mevcut kodda bulunan altyapı ve eksikler

| Dosya / işlev | Bugünkü davranış | Gerekli değişiklik |
|---|---|---|
| `src/lib/drawing-plan.ts` | Dört sabit bant; `bandOfCode`, `nextFreeCode`, `groupDrawingPlan`; düz satır listesi, kod sıralaması | Yeni planlarda açık üst grup ilişkisi, ayrı görünüm sırası ve düzenlenebilir numara alanları. Eski bant yardımcıları yalnız geriye uyumda kalacak. |
| `src/lib/drawing-plan-data.ts` | `loadDrawingPlan` kodla sıralıyor; `resolveProjectItemNo` önce `job_items.item_no`, sonra `projects.doc_no` okuyor | Zengin plan okuma, kaynak revizyon/sürüm ve ağaç sırasını taşıma. Numara kökü aynı kaynaktan kalacak. |
| `src/app/(app)/projects/[id]/drawing-plan-card.tsx` | Elle ekleme, silme, ad/kod/durum/çizen/not düzenleme var. Sürükleme yok. Kod seçenekleri sabit bant havuzuyla sınırlı | Otomatik kaynak özeti, ağaç düzenleyici, taşıma ve yeniden numaralandırma önizlemesi. |
| `src/app/(app)/projects/[id]/drawing-plan-actions.ts` | Silme, upsert ve insert ayrı istekler; bütün defter sürümü kontrol edilmiyor | Transaction içinde toplu kayıt, plan sürümü kontrolü, projeye ait satır kimliği doğrulaması. |
| `supabase/migrations/20260811000003_project_drawing_plan.sql` ve sonraki durum/çizen migration'ları | `(project_id, code)` tekil; durum, çizen, audit alanları var | Hiyerarşi ve kaynak alanları; ertelenebilir numara tekilliği ve güvenli toplu kayıt RPC'si. |
| `src/lib/calc/types.ts` | `auxTrolleyMode`, monoray sayısı, sabit/yürütmeli düzen, ikiz/çift tambur, kabin/oda/pano, emniyet freni bilgileri mevcut | Yeni form alanı icat etmeden bu tanımlar kullanılacak. |
| `src/lib/calc/engine.ts` | `activeModules` ve `moduleAllowedByConfig` konfigürasyonu/kapalı bölümleri çözüyor | Üretici aynı kuralları çağıracak; kendi ikinci aktif modül listesi olmayacak. |
| `src/lib/revision-load.ts` | `calcInputFromRevision` eski kayıtları normalize ediyor | Kaynak revizyon bu yükleyiciden geçecek; ham kayıt da alanın gerçekten girilmiş olup olmadığını ayırt etmek için tutulacak. |
| `src/lib/weights/defter.ts` | `hoistTrolleyKey` kaldırmanın hangi arabada olduğunu biliyor | Bu saf eşleme ortak topoloji yardımcısına alınarak veya doğrudan yeniden kullanılarak tek tutulacak. |
| `src/lib/weights/topla.ts`, `ledger.ts` | Platform/şasi/üst makara gibi bazı ağırlık satırlarını tahmin ediyor | Tahmini ağırlık, parçanın kesin varlığı sayılmayacak. |
| `src/lib/equipment-list.ts:buildSummarySections` | Teknik resim defterini özetin sonuna ekliyor; **Notlar şu an numaralardan sonra geliyor** | Ağaç/sıra desteği; Notlar numaralandırmanın önüne alınacak, numaralandırma son özet bölümü olacak. |
| `.../equipment/equipment-page-view.tsx`, `.../equipment/download/route.ts` | Aynı proje defteri panel ve indirmeye aktarılıyor | Tek ortak sunum modeli korunacak; GET isteği plan oluşturmayacak. |
| `src/lib/excel/equipment.ts`, `src/lib/pdf/equipment-report.tsx` | Ortak özet satırlarından çıktı üretiyor | Üst grup/alt grup, tam numara ve görünüm sırasını aynı şekilde basacak. |
| `.../manual/sources-data.ts` | Defteri el kitabının resim listesinde de kullanıyor | Yeni sırayı ve yalnız görünür satırları okuyacak; silinmiş öneriler dışarı sızmayacak. |

Mevcut kod yorumunda silmeleri önce yapmanın numara değiş tokuşunu çözdüğü yazıyor. Bu yalnız kaldırılan satırların numarasını boşaltır; kimliği korunan iki satırın 0100/0200 değiş tokuşunu tek başına güvenceye almaz. Ayrıca sonraki upsert başarısız olduğunda önceki silmeler geri alınmaz. Bu, yeni sürükleme/numaralandırma özelliği için giderilmesi gereken bir tasarım açığıdır; canlı veride denenmiş bir hata iddiası değildir.

`docs/agent/resimler.md` RESIM-20'deki “ekran otomatik doldurmaz” ve “bant koddan türer” kuralları bu yeni kullanıcı talebiyle değişiyor. Uygulamada ilgili doküman ve yorumlar da güncellenecek. Bu eski kurallar yeni talebe engel veya yeniden izin isteme gerekçesi değildir.

## 4. Kullanıcı akışı

1. Mühendis yeni raporu açar, teknik özellikleri düzenler. Şablon revizyon kopyalanırken henüz kesin teknik resim defteri yazılmaz.
2. İlk başarılı **hesap raporu kaydında** otomatik plan oluşturulur. Elle hesap düzenlemek ve Hızlı Otomatik Seçim sonucunu kaydetmek aynı yolu kullanır. Kaydedilmemiş seçim sonucu proje defterine yazılmaz.
3. Kayıt sonucu “Teknik resim planı oluşturuldu · N grup” ve ilgili sekmeye bağlantı gösterir.
4. Sekmede kaynak revizyon, ana gruplar, resim numaraları ve kısa gerekçeler görünür. Hesap uygunluk kontrollerinin tamamının geçmiş olması plan üretmenin şartı değildir; defter çizime hazırlık içindir.
5. Mühendis düzenler ve tek Kaydet ile uygular. Yerel geri al, kaydedilmemiş değişiklik koruması ve hata halinde taslağın korunması sağlanır.
6. Sonraki rapor kayıtlarında yalnız planı etkileyen değişiklikler değerlendirilir. Elle düzenlemeler korunur; kararı gereken farklar “Hesaptaki değişiklikler” alanına gelir.
7. Ekipman Listesi + Teknik Özet, kaydedilmiş son planı gösterir. İndirme sırasında yeniden numara üretimi yapılmaz.

İlk sürümde hesap kaydı ve plan eşitlemesi ardışık olabilir; ancak sonuç dürüstçe raporlanmalı: “Hesap kaydedildi; teknik resim planı güncellenemedi.” Yeniden deneme kaydedilmiş revizyonu okur, hesap kaydını veya satırları çoğaltmaz. Bu durum plan kartında kaynak parmak izi karşılaştırmasıyla da görünür; yalnız geçici toast'a bağlı kalmaz.

## 5. Otomatik çıkarım matrisi

Üretici üç sonuç üretir: **otomatik satır**, **mühendis tercihi gereken öneri**, **kaynak çelişkisi**. Gerekçe kısa ve izlenebilir olur. Öneriler kabul edilmeden resim numarası tüketmez ve çıktıya girmez.

| Kaynak / koşul | Üretilecek grup veya davranış |
|---|---|
| Aktif `bridge` | KÖPRÜ YÜRÜTME GRUBU. |
| Köprü taşıyıcı yapı kapsamı (`girder`, gerektiğinde `girder2`, `endCarriage`) | VİNÇ ÇELİK YAPI üst montajı. Her hesap bölümü ayrı resim değildir; ana kiriş/başkiriş detayına bölme mühendis tercihi olarak sunulur. |
| Aktif `trolley` | ANA ARABA KOMPLESİ; bir yürütme ve bir şasi grubu. Şasi montajın yapısal parçası önerisidir, kilosundan çıkarılmaz. |
| Aktif `aux`, `auxTrolleyMode=shared` | Tek fiziksel araba. Ana ve yardımcı kaldırmanın tambur/tahrik/makara/kanca grupları aynı arabanın altında ayrı ad ve kararlı kimlikle yer alır. İkinci şasi/yürütme/feston oluşturulmaz. |
| Aktif `aux` ve ayrı `auxTrolley` | İkinci araba komplesi; kendi yürütmesi, şasisi ve kaldırma alt grupları. |
| `auxTrolleyMode=separate`, fakat yardımcı kaldırma kapsam dışı | Yalnız moda bakarak ikinci araba üretilmez; tutarsızlık varsa açıklanır. |
| Her aktif kaldırma | TAMBUR GRUBU ve TAHRİK GRUBU; satın alınan motor/redüktör ayrı resim numaralarına bölünmez. |
| Geçerli donanım ve `deriveReeving(hoistReeving(...)).topSheaveCount > 0` | ÜST MAKARA GRUBU. Hatalı donanımın güvenli yedek değerleri kanıt sayılmaz; belirsizse öneri gösterilir. |
| `ropeBalancingType=equalizerBeam` | DENGE TRAVERSİ. |
| `ropeBalancingType=equalizerSheave` | DENGE MAKARASI GRUBU; travers olarak adlandırılmaz. `none` ise ikisi de eklenmez. |
| Aktif ilgili kanca bloğu ve seçilen alt taşıyıcı sistemi | KANCA BLOĞU; çift tamburda `doubleDrumHookSystem` kararı ayrıca değerlendirilir. |
| `doubleDrumHookSystem=liftingBeam` ve ilgili çift tambur | KALDIRMA KİRİŞİ; simetrik alt makara/kanca grupları mevcut hesap semantiğine göre gösterilir. Denge traversiyle birleştirilmez. |
| `hasSafetyBrake(specs, which)` | İlgili kaldırmanın EMNİYET FRENİ GRUBU. Monoraylara veya kapsam dışı yardımcı kaldırmaya kopyalanmaz. |
| `twin` veya `doubleDrum` | Araba sayısını artırmaz. Aynı imalat tasarımının iki fiziksel örneği otomatik iki resim sayılmaz; ortak grup adı ve düzen notuyla başlar, farklı resimlere bölme mühendise açıktır. |
| `hasOperatorCabin=yes` | OPERATÖR KABİNİ; klima seçilmişse adı/notu buna göre zenginleşebilir. |
| `electricalAccommodationType=room` | ELEKTRİK ODASI; klima `yes` ise ELEKTRİK ODASI & KLİMALAR. Klima yokken adın sonuna klima eklenmez. |
| `electricalAccommodationType=panel` | ELEKTRİK PANOLARI; elektrik odası eklenmez. Panoların her birine ayrı resim açmak adet kadar otomatik tekrar değildir. |
| Fiziksel kabin/oda `yes`, hesap bölümü kapalı | “Hesabı kapalı” ile “fiziksel olarak yok” ayrılır. Açık teknik beyan korunur ve kapsam notu gösterilir; satır yalnız hesap görünürlüğü nedeniyle yok edilmez. |
| Fiziksel araba ekseni ve onun `*PowerSupply=festoon` seçimi | O arabanın FESTON HATTI. Ortak arabada bir kez, ayrı arabalarda ayrı ayrı. |
| `*PowerSupply=cableChain` | KABLO ZİNCİRİ GRUBU; feston adı kullanılmaz. Köprü enerji beslemesi kendi enum/seçiminden ayrı çözülür. |
| Aktif monoray grupları | Her fiziksel monoray için ayrı montaj başlığı. Hazır satın alınan komple donanım, doğrulanmadan özel şasi/tambur imalat resimlerine ayrılmaz; kapsam önerisi sunulur. |
| `travelArrangement=fixed` | Araba/köprü/yürütme/feston hayali grupları oluşmaz; SABİT KALDIRMA DÜZENİ altında mevcut kaldırmalar, kabin ve elektrik yerleşimi değerlendirilir. |
| Yalnız araba yenileme, köprü kapalı | Araba takımı üretilir; köprü yapısı otomatik eklenmez. |
| Dört kiriş / portal gibi proje kapsamları | Mevcut topoloji ve doğrulanmış proje türünden kapsam önerisi; örnekte olmayan ayak sayısı veya montaj düzeni uydurulmaz. |

**Kaynaktan kesin çıkmayanlar:** elektrik odası tarafı/karşı taraf platform ayrımı, bakım platformunun bağımsız resim olması, sabit yaşam hattı, merdiven-korkuluk ayrıntısı, araba üstünde ayrı pano, özel kepçe/mıknatıs aparatı. Mevcut hesapta açık özellik varsa kullanılır; yoksa isteğe bağlı montaj önerileridir. Ağırlık defterindeki tahmin veya serbest metin benzerliği tek başına otomatik ekleme gerekçesi olamaz.

`hiddenSections` ve `hiddenDiagrams` çoğunlukla rapor sunum tercihidir; fiziksel ekipman yokluğu anlamına çevrilmez. Kullanıcının açıkça kapattığı mekanik kapsam ile yalnız PDF'de gizlediği çizim ayrılır.

## 6. Numara ve hiyerarşi modeli

Numara: `resolveProjectItemNo(...) + '-' + dört haneli kod`. İş kalemi numarası varsa o kullanılır, yoksa mevcut doküman numarası; kök yoksa uydurulmaz, eksik kimlik görünür. Raporun revizyon numarası resim köküne eklenmez.

Yeni planda montaj kimliği ile kod iki ayrı bilgidir. 2300 kodlu KANCA BLOĞU, ana arabanın altında kalabilir; 4000 kodlu yardımcı araba da “bant dışı” diye kaybolmaz.

- Köprü/vinç genel grupları: varsayılan 0100'den 100'er artış; ana araba başlangıcına kadar.
- Ana araba komple: 1500; alt gruplar 1600'den 100'er artış.
- İkinci araba komple: 2500; alt gruplar 2600'den 100'er artış.
- Yeni monoray/ek montajlar: kullanılmayan, çakışmasız bir sonraki uygun blok önerilir; başlangıcı ekranda açıkça görünür ve değiştirilebilir. Hazır 3000 “ekstra” kuralı yeni modele dayatılmaz.
- Kod dört haneli kalır; mevcut 0950, 2250, 4000 veya 9999 gibi geçerli özel kodlar korunur. Otomatik öneri 100 adımlıdır.
- Bir satır sonradan eklenirse önce uygun boş yer aranır. Yer yoksa mevcut numaralar otomatik kaydırılmaz.
- 1500–2400 alanı bir komple + dokuz alt numara taşır. Aynı arabada iki kaldırma veya 0019 örneğindeki on alt grup bu alana sığmayabilir. Sistem ikinci arabanın numarasını ezmez; boş blok/başlangıç değişikliğini önce–sonra listesiyle önerir. Uygulanmadan mevcut defter ve çıktı korunur.

**Sürükleme numara değiştirmez.** Görünüm sırası `sortOrder` ile saklanır. “Bu sıraya göre numaralandır” ayrı eylemdir: etkilenecek numaralar önizlenir, sabitlenmiş kodlar korunur, çakışma varsa işlem uygulanmaz. Böylece bir satırı yukarı taşımak çizilmiş bir paftanın kimliğini değiştirmez.

Örnek yeni plan (yalnız düzen örneği, gerçek projeye yazılmaz):

```text
0045-00-0100  KÖPRÜ YÜRÜTME GRUBU
0045-00-0200  VİNÇ ÇELİK YAPI
0045-00-1500  ANA ARABA KOMPLESİ
  0045-00-1600  ARABA YÜRÜTME GRUBU
  0045-00-1700  ARABA ŞASİ
  0045-00-1800  ANA KALDIRMA TAMBUR GRUBU
  0045-00-1900  ANA KALDIRMA TAHRİK GRUBU
  ... donanıma göre gereken diğer gruplar
0045-00-2500  İKİNCİ ARABA KOMPLESİ       [yalnız ayrı araba varsa]
  0045-00-2600  İKİNCİ ARABA YÜRÜTME GRUBU
  ...
```

Aynı arabada yardımcı kaldırma varsa 2500 ikinci araba komplesi eklenmez; yardımcı kaldırmanın grupları 1500 komplesinin altında oluşur.

## 7. Mühendis kararlarını koruyan eşitleme

Her otomatik satırın adı/kodu yerine kararlı kaynak anahtarı olur: `trolley:main:assembly`, `hoist:main:drum`, `hoist:aux:drive`, `cabin:operator` gibi. Yardımcı kaldırmanın araba değiştirmesi kaynak kimliğini değiştirmez; üst grubu değiştirir.

Satırda üretilen son değerler ile mühendisin değiştirdiği alanlar ayrılır. Numara, ad, üst grup veya sıra elle değiştirilmişse otomatik işlem bunları ezmez. Durum, çizen ve not zaten yalnız insan yönetimindedir. Satırın “Çizildi” olması hesap değişti diye otomatik “Bekliyor” yapılmaz; gerekli kontrol ayrı işaretlenir.

| Olay | Davranış |
|---|---|
| İlk kayıt, boş defter | Kesin kapsam grupları otomatik oluşturulur. |
| Aynı kaynakla tekrar kayıt/yeniden deneme | Aynı satırlar ve kodlar kalır; çoğalma olmaz. |
| Hesapta motor markası değişti, montaj yapısı değişmedi | Yeni resim satırı veya yeniden numaralandırma yok. |
| Kabin sonradan eklendi | Boş numara varsa yeni otomatik satır; yer yoksa çözülmesi gereken öneri. |
| Mühendis otomatik satırı sildi | Kaynak anahtarı için silme tercihi saklanır; sonraki kayıtta geri gelmez. “Silinen otomatik önerileri göster/geri ekle” vardır. |
| Kaynakta grup kaldırıldı | Eski numaralı satır sessiz silinmez; “Hesapta artık bulunmuyor” farkı sunulur. Mühendis siler veya manuel tutar. |
| Ortak araba ayrı arabalara dönüştü | Taşınacak gruplar/kurulacak şasi ve yürütme için tek toplu değişiklik önizlemesi; kısmi uygulamayla iki yerde aynı grup oluşturulmaz. |
| Mühendis manuel özel grup ekledi | Otomatik eşitlemeden bağımsız korunur. |
| Önceden elle hazırlanmış defter | Yerinde korunur. Yeni çıkarımlarla ad benzerliği üzerinden otomatik birleştirme yapılmaz; ilk eşleme önizlemesinde mevcut satıra bağlama veya yeni satır ekleme seçilir. |
| Başka revizyon kaydedildi | Planın kaynak revizyonu sessiz değişmez. Kaynak revizyon değiştirme fark önizlemesiyle yapılır. |

Plan proje düzeyinde kalır. Kaynak revizyon ID'si ve son değerlendirilen rapor parmak izi kaydedilir. İlk kaynak mühendisin ilk kaydettiği revizyon olur; yeni V1/V2 oluşturmak defteri sıfırlamaz. Eski revizyonun düzenlenmesi güncel planı geri sarmaz. Kaynak revizyon silinirse plan yaşar ve yeni kaynak seçme durumu gösterilir.

Mevcut davranış gibi eski hesap revizyonundan indirilen ekipman özeti de projenin güncel resim planını okur. Bu nedenle çıktı küçük bir satırla “Teknik resim planı: kaynak Vx · plan sürümü N” belirtir. Değişmez tarihsel çizim planı arşivi bu talebin zorunlu parçası değildir; hesap snapshot'ına canlı defter gizlice gömülmez.

## 8. Veri modeli ve kayıt güvenliği

Mevcut `project_drawing_plan` genişletilir; paralel ikinci görünür resim listesi kurulmaz.

Önerilen satır alanları:

- `parent_id`: üst montaj; aynı projede olmalı, döngü yasak.
- `sort_order`: kardeşler içindeki sıra; numaradan bağımsız.
- `source_key`: otomatik kaynak kimliği, manuel satırda boş; proje içinde tekil.
- `origin`: otomatik / manuel / devralınmış.
- `generated_values`: son otomatik ad, önerilen üst grup ve kod gibi değerler.
- `overrides`: elle değiştirilen alanların açık listesi; otomatiğe geri dönme mümkün.
- `suppressed_at`: mühendisin kaldırdığı otomatik satırın tekrar oluşmasını önleyen iz; normal okuma, ilerleme ve çıktılardan hariç.
- Gerekçe/rule kimliği: “Elektrik odası seçili”, “Yardımcı kaldırma ayrı arabada” gibi kısa açıklama için.

Proje başına tek `project_drawing_plan_state` kaydı:

- `version` (artan tamsayı), `source_revision_id`, kaynak `updated_at`/fingerprint.
- Üretici kural sürümü, numara başlangıç tercihleri.
- Eski defterin ilk eşleme durumunu ve bekleyen değişiklikleri saptamak için temel metadata.
- `updated_by`, `updated_at`.

Saklanan eski kodlar ilk migration'da yeniden numaralandırılmaz. Eski bantlar geçici görünüm kategorisi olarak korunur; 2300'ün gerçekte hangi arabaya ait olduğu gibi belirsizlikler koddan otomatik çözülmüş sayılmaz. Yeni üretim yalnız yeni hiyerarşi modelini kullanır. Eski satırın durum/çizen/not/kimliği aynı kalır.

Toplu kayıt RPC'si tek transaction'da:

1. Oturum ve `can_edit_reports()` yetkisi; mühendislik proje kapsamı.
2. Plan state kaydını kilitleme ve beklenen sürümü doğrulama.
3. Tüm ID'lerin aynı projeye ait olduğunu doğrulama; başka projedeki satıra upsert yasak.
4. Kod tekilliği, ad, satır sınırı, üst grup döngüsü, sıra ve kaynak kimliği kontrolleri.
5. Numara tekilliğini transaction sonuna erteleyen constraint ile yer değiştirmeleri uygulama.
6. Güncelleme/ekleme/silme tercihi, audit ve sürüm artışı; hata varsa tümü geri alınır.

RLS korunur; yalnız ekran kontrolüne güvenilmez. RPC yaklaşımı mümkünse invoker yetkileriyle çalışır. Otomatik kaynak/override metadata'sı istemcinin iddiasından körlemesine kabul edilmez; sunucu mevcut kayda ve doğrulanmış revizyona göre kurar. Otomatik eşitleme revizyonun okunan `updated_at` değerini commit öncesi tekrar denetler; arada değişmiş raporun planı yazılmaz.

Mevcut `loadDrawingPlan` sorgu hatasında boş dönebiliyor. Otomatik üretim ve yazma yolunda **“okuma başarısız” ile “defter boş” aynı olamaz**. Sıkı bir state yükleyicisi hata durumunu açık döndürmeli; aksi halde geçici DB hatası defteri yeniden oluşturma sebebi olabilir. Eski salt çıktı toleransı ayrı ele alınabilir, fakat eksik migration sessizce plan verisi kaybettirmemeli.

## 9. Teknik Resim Takibi ekranı

Üstte kaynak rapor, son eşitleme, toplam grup ve mevcut ilerleme. Araçlar: Hesaptaki Değişiklikler, Grup Ekle, Numara Düzeni, Kaydet.

Ana montajlar açılır başlıklardır; başlıkta komplesinin numarası görünür. Alt satırda sürükleme tutamacı, numara, grup adı, durum, çizen, not ve işlemler vardır. Uzun adlar mobilde sarılır; masaüstünde sütun genişliği sınırlandırılır. Sadece ikonla anlaşılmayan işlemler erişilebilir ad taşır.

- Sürükleme aynı montaj içinde sıralar; başka montaja taşımada açık hedef seçimi de bulunur.
- Üst montaj taşındığında çocuklar beraber taşınır; döngü veya kendi altına taşıma engellenir.
- Yukarı/aşağı düğmeleri klavye ve dokunma için aynı işlemi yapar.
- Üst grup silinirken “alt gruplarla sil” veya “alt grupları başka gruba taşı” kararı görünür; çocuklar sessiz kaybolmaz.
- Tek satır düzenlemesinde kaydet öncesi geri al; bütün form için kirli taslak koruması.
- Kaydet sürerken formun sonradan değişip kaydedilmiş sanılmasını engelleyen davranış; başarısız kayıt taslağı temizlemez.
- 320/375/768/1024/1440 genişliklerinde yatay taşma yok; ağaç dar ekranda tek kolon karttır.

`@dnd-kit/core` mevcuttu; uygulamada aynı altyapının `@dnd-kit/sortable` paketi eklendi. Fare ve klavye aynı sıralama çekirdeğini kullanır.

## 10. Ekipman + Teknik Özet çıktısı

Tek `buildDrawingPlanPresentation` yardımcı modeli hem ekranı, hem `buildSummarySections` üzerinden PDF/Excel'i besler. Ağaç pre-order sırasıyla düzleştirilir; mühendis sırası korunur, kodla tekrar sıralanmaz. Ana grup başlığı ve alt grup girintisi aynı ilişkiyi anlatır.

Son teknik özet bloğu: **Teknik Resim Numaralandırması**. İçerik: tam resim numarası + tanım + üst montajın anlaşılmasını sağlayan başlık. Çizen, iç takip durumu ve gizlenmiş otomatik öneriler bu çıktıya eklenmez. Satır bir yerde görülüp başka çıktıda kaybolmamalı.

Notlar bu bloktan önce gelir. Mevcut katalog/ek belge sayfaları teknik özetten sonra devam edebilir; numaralandırmanın yeri teknik özetin sonudur. “Yalnız ekipman / müşteri” kapsamına kullanıcı istemeden iç teknik plan eklenmez. Mekanik + teknik özet seçildiğinde mevcut koşullar üzerinden görünür; yalnız elektrik listesi kapsamı ayrıca genişletilmez.

PDF'de uzun ad, sayfa sonu, üst başlığın çocuksuz sayfada kalması ve çok sayfalı plan görsel olarak doğrulanır. Excel'de metin hücreleri baştaki sıfırları korur; yazdırma alanı ve satır yükseklikleri kontrol edilir.

## 11. Uygulama adımları ve dosya sınırları

1. **Saf çıkarım ve fikstürler:** `src/lib/drawing-plan/derive.ts`, `topology.ts`, `types.ts`. Normalize edilmiş hesap + ham kaynak + proje bağlamından montaj ağacı/öneriler. Ortak araba eşlemesi kopyalanmaz.
2. **Numara ve karşılaştırma çekirdeği:** `numbering.ts`, `reconcile.ts`, `presentation.ts`. Kaynak kimliği, boş yer, manuel override, silme tercihi, topoloji değişikliği, sıralama.
3. **Veritabanı ve okuma/yazma:** Yeni tarih damgalı migration; state ve satır alanları, RPC, RLS/audit, legacy uyumu. `drawing-plan-data.ts` ve `drawing-plan-actions.ts` güncellenir. Migration aynı günün diğer dosyalarıyla çakışmayan sürüm alır.
4. **Hesap kaydı bağlantısı:** `.../revisions/[revId]/actions.ts:saveRevision`; salt mühendislikte başarılı kayıt sonrası idempotent eşitleme. Yeni/şablondan kopyalanan revizyon ve dosyadan oluşturma yolları incelenerek aynı ilk kullanıcı kaydı sınırı korunur.
5. **Düzenleyici:** `drawing-plan-card.tsx`, `project-page-view.tsx`; kaynak farkı, ağaç, sürükleme, klavye, yeni grup, yeniden numaralandırma, sürüm çatışması.
6. **Çıktı tüketicileri:** `equipment-list.ts`, equipment panel/download, Excel/PDF, el kitabı kaynak okuyucusu; tek sunum sırası.
7. **Önizleme ve kabul:** `/dev/project-preview`, `/dev/auto-selection-preview` ve ekipman önizlemeleri; yeni senaryo fikstürleri, PDF/Excel görsel QA.
8. **Dokümantasyon:** RESIM-20, ilgili hesap kayıt davranışı ve kod yorumları. Canlı eski defterler otomatik dönüştürülmeden yeni sürüm devreye alınır.

Bu plan yazılırken çalışma ağacında daha önce yapılmış pop-up düzenlemeleri ve ayrı katalog/ekipman değişiklikleri bulunuyor. Uygulama bunları geri almayacak; özellikle `equipment-list.ts` değişiklikleri korunarak dar kapsamlı düzenlenecek.

## 12. Kabul ve test matrisi

### Çıkarım ve numaralandırma

- Tek araba/tek kaldırma; tek araba/iki kaldırma; iki ayrı araba/iki kaldırma.
- Ana ve yardımcı kaldırmanın emniyet frenleri ayrı; monorayda yanlış fren yok.
- İkiz ve çift tambur araba sayısını artırmıyor; kaldırma kirişi ile denge traversi karışmıyor.
- Kabin yok/var; oda yok/var; pano yerleşimi; klimalı/klimasız adlandırma.
- Feston/kablo zinciri; paylaşımlı arabada mükerrer hat yok.
- 0/1/2 monoray; sabit yer vinci; yalnız araba yenileme; dört kiriş.
- Gizli alt bölüm ile fiziksel kapsam ayrımı; eksik/eski alanlarda sahte kesinlik yok.
- 0045 örneğindeki 2300 kanca ana arabada; 0019'daki 4000 yardımcı araba doğru üst grup altında.
- Dokuzdan fazla alt resim; kod çakışması, 0950 eski ara kod, 9999 sınırı, numara kökü eksikliği.

### Kayıt ve karar koruma

- Aynı raporla iki çalıştırma aynı kimlikleri/kodları üretir.
- Elle ad/kod/sıra/üst grup değişikliği ve not/çizen/durum tekrar kayıtta korunur.
- Silinen otomatik satır geri gelmez; isteyerek geri eklenebilir.
- Ortak → ayrı → ortak araba değişiminde satır çoğalmaz, kimlik ve çizim ilerlemesi kaybolmaz.
- Eski manuel defter ilk eşitlemede bozulmaz.
- 0100 ↔ 0200 değiş tokuşu başarılı; arada hata verilince kayıt tamamen geri alınır.
- İki kullanıcı aynı sürümü kaydettiğinde ikincisi anlaşılır çakışma alır ve taslağı korunur.
- Başka projeye ait satır ID'si, yetkisiz kullanıcı ve döngülü üst grup reddedilir.
- Hesap kaydı başarılı/plan kaydı başarısız durumu doğru görünür; tekrar deneme çoğaltmaz.
- Eski revizyon kaydı güncel plan kaynağını değiştirmez; kaynak silinmesi planı silmez.
- DB okuma hatası boş defter sayılmaz.

### Arayüz ve çıktı

- Sürükleme ve yukarı/aşağı aynı sıralamayı kaydeder; taşıma kodları değiştirmez.
- Yeni sıra sayfa yenileme, ekipman paneli, PDF, Excel ve el kitabı kaynağında aynı.
- Teknik özetin son bloğu numaralandırma; Notlar önce.
- Silinen/öneri durumundaki satırlar ilerleme hesabına ve çıktıya girmez.
- 0/1/25/120 satırlı plan; uzun Türkçe adlar; çok sayfalı PDF; baştaki sıfırlar.
- Mevcut `drawing-plan.test.ts`, ekipman özet testleri, ilgili topoloji/ground-crane testleri korunup genişletilir. TypeScript/lint ve gerekli regresyonlar tamamlanır.
- PDF/Excel dosyaları üretildiğinde ilgili artifact skill'lerinin render/inceleme adımları uygulanır; yalnız JSX'e bakılarak görsel kabul verilmez.

## 13. Başlangıç kararları

Kesin kullanıcı kararı: **1500 / 2500 ve değiştirilebilir başlangıçlar.**

Bu planın önerdiği diğer davranışlar: ilk başarılı kullanıcı kaydında üretim; sonraki kayıtlarda mevcut numaraları koruma; sürüklemede yalnız sıra değiştirme; yetersiz numara alanında önizlemeli yeniden düzenleme; belirsiz platform/yaşam hattı gibi gruplarda mühendis tercihi; proje düzeyindeki güncel planın teknik özetin sonunda basılması.

Uygulama için yeterli tasarım yönü mevcut. Kesinleşmemiş montaj ayrıntıları planı durdurmak yerine ekranda mühendis tercihi olarak ele alınacak.
