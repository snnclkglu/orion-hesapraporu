# Roller ve yetki

> ORION Cranes — İş Yönetim Sistemi · alan dokümanı.
> Kök kurallar ve harita: `AGENTS.md`. Bu dosya ELLE düzenlenir;
> `.claude/rules/roller.md` ve haritadaki satır ondan ÜRETİLİR
> (`npx tsx scripts/agent-docs/split.ts --uygula`).

**Kapsam:** `src/lib/roles.ts` · `src/proxy.ts` · `src/app/(app)/admin/**` · `src/app/(auth)/**` · `supabase/migrations/**`

## ROL-15 — Roller yetki SORUSUYLA sorulur, listeyle değil.

`user_role` sekiz değer
taşır: `admin` (Yönetici) · `manager` (Müdür) · `engineer` (Mühendis) ·
`draftsman` (Teknik Ressam) · `purchasing` (Satın Alma) · `planning`
(Planlama) · `quality` (Kalite) · `production` (Üretim). Kod hiçbir yerde
rol listesi karşılaştırmaz;
`lib/roles.ts`teki `isAdminRole` / `canSeeSales` / `canEditReports` sorulur.
Roller HİYERARŞİ DEĞİLDİR — müdür satış rakamlarını görür ama yönetim
paneline giremez ve hesap raporu yazamaz; mühendis rapor yazar ve taslağını
siler ama satış rakamını görmez. Veritabanı karşılığı `is_admin()`,
`can_see_sales()` ve `can_edit_reports()` fonksiyonlarıdır; menüden
gizlemek yalnız görgü kuralıdır, asıl engel RLS'tir. Rol kümeleri
`lib/__tests__/roles.test.ts`te dondurulmuştur: bir yetkiyi genişleten,
hangi rollerin etkilendiğini orada görür.

**GÖREV ETİKETLERİ AÇILDI VE AYNI GÜN KALDIRILDI — dördü de artık ROL**
(kullanıcı kararı, 12.08.2026). Satın Alma · Planlama · Üretim sabah
`profiles.tags` altında ÇOK DEĞERLİ etiketler olarak açılmıştı; gerekçe
"rol tek değerlidir ve «hem Müdür hem Planlama» olan kişiyi ifade edemez"
idi. Kullanıcı akşam bunu tersine çevirdi — *"görev etiketi olarak değil
direkt Rol olarak … görev etiketine gerek yok"* — ve dördüncüsünü ekledi:
*"Hatta Kalite de olsun toplam 4 olsun."*

**BEDELİ AÇIKÇA KABUL EDİLDİ:** rol TEK DEĞERLİdir, yani Planlama
rolündeki bir kişi aynı anda Müdür olamaz (satış, iş takibi ve personel
bölümlerini göremez). Kişinin hangi kimlikte duracağı kullanıcının
kararıdır. GEÇİŞ YARIM BIRAKILMADI: `profiles.tags` sütunu, `has_tag()`
ve `tagsOf`/`hasTag` yardımcıları hem koddan hem veritabanından
DÜŞÜRÜLDÜ (migration `20260812150000`) — ikisi bir arada yaşasaydı aynı
yetki iki ayrı yerden sorulabilir hâle gelirdi (`drawn` sütununun düşürülme
gerekçesiyle birebir aynı). Veri kaybı YOKTU: sütun beş profilin beşinde de
boştu, ölçüldü.

**KALİTE VE ÜRETİM BUGÜN EK BİR KAPI AÇMAZ** ve bu bir eksiklik değil bir
kuraldır: rol bir KİMLİKtir, kapı açmak AYRI bir karardır. İkisi de yalnız
herkese açık bölümleri görür (İşler · Mühendislik · Teknik Resimler) ve bu
`roles.test.ts`te dondurulmuştur. Satın Alma kümesi taşınırken DEĞİŞMEDİ:
Yönetici · Satın Alma · Planlama — müdür orada hâlâ yoktur. Veritabanı
karşılığı `can_see_purchasing()`.

**İŞLER BÖLÜMÜ GÖRÜNÜRLÜĞÜ GENİŞLERKEN YAZMASI DARALDI** (kullanıcı kararı,
18.08.2026). `/jobs` bugüne kadar yazma sorusu OLMAYAN bir bölümdü (gören
yazardı); artık `canEditJobs` taşır: Yönetici · Müdür. Bölüm hâlâ HERKESE
görünür — ayrışan şey yalnız yazmadır ve ızgara bu farkı basar. Mühendisin iş
emri açma yetkisini kaybetmesi açık bir karardır (`canEditReports` ondan
bağımsızdır); kapsam iş emrinin KENDİSİDİR, hub'ın tamamı değil — görev,
yorum, favori ve resim çarpanı herkeste kalır (`docs/agent/isler.md` IS-27).

**YETKİ EKRANI ÜÇ TABLODAN TEK IZGARAYA İNDİ** (kullanıcı bildirimi,
13.08.2026: *"üst bölümdeki Roller kısmı ve Bölümler kısmı anlamsız
geliyor bana."*). Haklıydı: "Roller" ve "Bölümler" AYNI gerçeği iki kez,
üstelik düzyazıyla anlatıyordu — biri satır, öbürü sütun okumasıydı.
Izgaranın kendisini basmak ikisini birden yapar. **HÜCRE ÜÇ DEĞERLİDİR**
(`sectionAccess`): "görür" ile "görür ve değiştirir" farkı bu uygulamanın
en sık sorulan sorusudur (mühendis teknik resmi yazar, müdür yazmaz) ve
tek bir ✓ onu gizlerdi. Yazma sorusu OLMAYAN bölümde gören yazar — orada
"bilinmiyor" diye üçüncü bir hâl uydurmak, ekranın veriden fazlasını iddia
etmesi olurdu. Kişi matrisi KALDI: ızgara KURALI, o tablo GERÇEĞİ söyler.

**YETKİLER EKRANDAN DEĞİŞTİRİLMEZ — bilerek** (kullanıcı kararı,
13.08.2026). Kullanıcı rol yetkilerini açıp kapatmayı sordu; riskler
ölçülüp vazgeçildi. Karar üç bulguya dayanıyor ve tekrar sorulursa cevap
burada:
  · **Yeni bir saldırı yolu açmazdı.** Ele geçirilmiş bir yönetici hesabı
    BUGÜN de Kullanıcılar sayfasından herkesi Yönetici yapabiliyor; editör
    tavanı değil yalnız inceliği değiştirirdi.
  · **Yeni bir KAZA yolu açardı.** Yanlış bir tık Personel'i (TC kimlik no,
    IBAN, sağlık raporu) atölyeye açardı — saldırı değil ama sonuç aynı.
  · **Asıl risk uygulamadaydı.** 128 RLS politikası dokuz yetki
    fonksiyonuna bağlı; biri yanlış yazılırsa veri SESSİZCE sızar ve ekran
    doğru görünmeye devam eder.
Yapılacaksa ŞARTI şudur: değişiklikten sonra her rolün kimliğiyle
veritabanına gerçekten sorgu atıp kapıyı ölçen bir sınama takımı. Onsuz
"ekranda kapalı ama gerçekte açık" durumu görünmez kalır. Düğmelerin yalnız
menüyü etkilediği sığ sürüm ise ASLA yapılmaz: o ekran iki yönde birden
yalan söyler.

**SATIN ALMA YETKİ ROZETİ ÜST BARDADIR** (kullanıcı kararı, 14.08.2026:
*"Yönetici · Satın Alma · Planlama yazıyı üst bara alalım, bu bölümde yer
kaybetmemiş oluruz"*). Rozet önce sayfanın içinde ayrı bir satırdaydı çünkü
bir künyedir, eylem değildir; ama o satır bölümün en dar olduğu yerde bir
kat yer yiyordu. `PageHeader`ın çocuğu olarak verilince EYLEM yuvasına (üst
şeridin sağı) portallanır — `lg` üstünde başlığın hizasında, `lg` altında
kendi kayan satırında durur ve dikey yer yemez.

**YETKİ EKRANINDA KOD ADI GEÇMEZ** (kullanıcı bildirimi, 12.08.2026:
*"yetkiler sayfası biraz karmaşık, İngilizce terimler var"*).
`WorkspaceSection.kime`/`yazma` doğrudan ekrana basılır; oraya
`(canEditReports)` gibi bir iç ad yazmak, ekranı okuyan yöneticiye hiçbir
şey anlatmaz. Kural bir testle korunur (`roles.test.ts` — metinlerde
`can[A-Z]` ve `()` aranır). Aynı sebeple `/admin/access` sayfasından bölüm
ADRESLERİ (`/jobs`, `/drawings`) ve "RLS" kısaltması kaldırıldı; etiket
sözlüğünün yerini ROL sözlüğü aldı.

**MENÜ İLE YETKİ MATRİSİ TEK KAYNAKTAN OKUR** — `WORKSPACE_SECTIONS`
(`lib/roles.ts`). Liste bir süre `app-shell.tsx`in içindeydi; Yönetim'e
"hangi bölüm kime açık" ekranı eklenince (`/admin/access`) ikinci bir liste
yazma ihtiyacı doğdu ve iki listenin ayrışması bir yetki ekranında
olabilecek EN KÖTÜ hatadır: matris, menünün gerçekte yaptığından başka bir
şey anlatırdı. Matriste elle yazılmış tek bir yetki bilgisi yoktur —
her hücre `visible()` sorusunun cevabıdır, menünün çağırdığı fonksiyonun
aynısı. `kime` alanı yalnız o sorunun İNSAN OKUNUR özetidir.

## ROL-16 — Kalıcı silme iki aşamalıdır ve karar izi silinmez.

İş, hesap raporu/revizyonu, teknik resim paketi, teklif/maliyet revizyonu,
personel kaydı ve uygulamadaki dosya belgeleri doğrudan `DELETE` edilmez.
Yetkili kullanıcı yalnız `request_deletion()` ile niyet kaydı açar; hedef adı
ve silme öncesi fotoğraf istemciden alınmaz, veritabanından yeniden okunur. Yönetici
`/admin/deletion-requests` ekranında onaylar veya gerekçeyle reddeder.

Bu kural yalnız arayüz değildir: korunan tablolardaki
`guard_approved_deletion` tetikleyicisi, silmeyi ancak
`approve_deletion_request()` aynı transaction içinde talebi kilitlediyse
geçirir. Talep satırı güncellenemez/silinemez; karar veren, zaman, not ve hedef
fotoğrafı kalır. Dosya baytları veritabanı satırından SONRA temizlenir; temizlik
başarısızsa ana karar geri alınmış gibi gösterilmez, `cleanup_status=failed`
ile görünür kalır ve Yönetici yeniden dener.

## ROL-17 — Yönetim mobilde seçici ve erişim kartları kullanır.

Yönetimin bölüm listesi `lg` altında tek seçicidir; masaüstünde soldaki dikey
ray korunur. Rol × bölüm ve kişi × bölüm erişim tabloları telefonda bölüm adı
`data-label` olan kartlara katlanır. Hücreler hâlâ `sectionAccess()` ile aynı
kaynaktan hesaplanır; yalnız sunum değişir. Böylece yetki anlamı korunurken
matris için yatay kaydırma gerekmez.

## ROL-18 — Kullanım ölçümü bölüm bazlıdır; içerik toplamaz ve performans puanı değildir.

Yönetici, `/admin/users/[id]` profilinde kullanıcının uygulamaya dönüşünü,
aktif süresini, bölüm dağılımını, cihaz sınıfını, son oturumlarını ve var olan
`audit_log` işlem izini görür. Kullanıcılar listesindeki **Profil** eylemi bu
sayfaya gider; rota da yönetim kabuğunun Yönetici kontrolü altındadır.

Ölçümün mahremiyet sınırı veritabanı şemasında başlar: `user_usage_metrics`
tam URL, kayıt kimliği, müşteri/personel/belge adı, arama metni, form içeriği
ve tuş bilgisi için alan taşımaz. `UsageTracker`, `usePathname()` değerini
istemcide `usageSectionForPath()` ile ana bölüme indirger ve yalnız bölüm
anahtarını gönderir. SQL RPC aynı kapalı sözlüğü yeniden doğrular; TypeScript
ve migration sözlüğü `usage.test.ts`te migration kaynak dosyası okunarak
birbirine bağlanır.

**AKTİF SÜRE DUVAR SAATİ DEĞİLDİR.** Sekme arka plandayken sayaç durur;
son işaretçi/klavye/kaydırma etkileşiminin üzerinden beş dakika geçince kişi
boşta sayılır. Otuz dakikalık boşluk yeni oturum açar. Dönemsel darbe en çok
60 saniyedir ve yazma doğrudan tabloya değil, `auth.uid()` adına çalışan dar
`record_user_usage()` RPC'sine yapılır. Kişi kendi satırlarını, Yönetici bütün
satırları okur; anonim erişim yoktur.

**KULLANIM SKORU ÇALIŞAN PERFORMANSI DEĞİLDİR.** Son 30 gün için güncellik,
aktif gün düzenliliği ve arka plan hariç aktif süre toplamıdır. Varsayılan
ağırlıklar 35/35/30, hedefler 12 aktif gün ve 10 aktif saattir; Yönetim →
Profil Puanlama bu ağırlık ve hedefleri değiştirir. Her profil türünde ağırlık
toplamı 100 değilse ayar kaydedilmez; bozuk/eski bir saklı ayar güvenli
varsayılanlara iner. Profil ve PDF puanı saklanmaz, her okumada güncel ayar ve
güncel ölçümden yeniden hesaplanır.
Rol veya erişilebilen bölüm sayısı puana girmez; aksi, dar yetkili bir rolü
tasarım gereği cezalandırırdı. Ekran formülü ve tavanları açıkça gösterir,
kullanıcıları sıralamaz. Veri yoksa `0` hükmü üretmek yerine skor `—` görünür;
takip öncesi geçmiş geriye dönük uydurulmaz.
