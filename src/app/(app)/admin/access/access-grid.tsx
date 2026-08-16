// YETKİ IZGARASININ GÖRÜNÜMÜ — "hangi rol neyi görür, neyi değiştirir?"
//
// ═══════════════════════════════════════════ IZGARA HESAPLANIR, YAZILMAZ
//
// Bu sayfada elle yazılmış TEK BİR yetki bilgisi yoktur. Satırlar rol
// defterinden, sütunlar `WORKSPACE_SECTIONS`ten (sol menünün ta kendisi) gelir
// ve her hücre `sectionAccess()` SORUSUNUN cevabıdır — menünün çağırdığı
// fonksiyonların aynısı.
//
// Gerekçe: elle yazılmış bir matris, kodun gerçekte yaptığından başka bir şey
// anlatabilir ve bu, bir yetki ekranında olabilecek en kötü hatadır. Kural
// değişince ızgara kendiliğinden değişir; kimse güncellemeyi unutamaz.
//
// ═════════════════════════════ ÜÇ TABLO BİRE İNDİ (13.08.2026, kullanıcı)
//
// Sayfada "Roller", "Bölümler" ve "Kişi Bazında Erişim" diye üç tablo vardı ve
// ilk ikisi AYNI GERÇEĞİ iki kez, üstelik düzyazıyla anlatıyordu: rol satırında
// "görebildiği bölümler" bir cümle, bölüm satırında "kimler görebilir" başka
// bir cümleydi. Kullanıcının sözü: *"üst bölümdeki Roller kısmı ve Bölümler
// kısmı anlamsız geliyor bana."* Haklıydı — iki liste bir IZGARANIN satır ve
// sütun okumasıydı; ızgaranın kendisini basmak ikisini birden yapar.
//
// ÜÇ DEĞERLİ HÜCRE, İKİ DEĞİLDİ: "görür" ile "görür ve değiştirir" arasındaki
// fark bu uygulamanın en sık sorulan sorusudur (mühendis teknik resmi yazar,
// müdür yazmaz) ve tek bir ✓ onu gizlerdi.
//
// ═══════════════════════════════════════ NEDEN DÜZENLENEBİLİR DEĞİL
//
// Kullanıcı yetkileri ekrandan açıp kapatmayı sordu; riskler konuşulup
// BİLEREK VAZGEÇİLDİ (13.08.2026). Karar üç ölçüme dayanıyor:
//   · Yeni bir saldırı yolu açmazdı — ele geçirilmiş bir yönetici hesabı bugün
//     de Kullanıcılar sayfasından herkesi Yönetici yapabiliyor.
//   · Yeni bir KAZA yolu açardı: yanlış bir tık Personel'i (TC kimlik no,
//     IBAN, sağlık raporu) atölyeye açardı.
//   · Asıl risk uygulamadaydı: 128 RLS politikası dokuz yetki fonksiyonuna
//     bağlı ve biri yanlış yazılırsa veri SESSİZCE sızar.
// Düzenlenebilir sürüm, her rolün kimliğiyle veritabanına gerçekten sorgu atıp
// kapıyı ölçen bir sınama takımı olmadan yapılmamalıdır.

import { Eye, Minus, PencilLine } from "lucide-react";
import {
  USER_ROLES,
  USER_ROLE_HINTS,
  USER_ROLE_LABELS,
  WORKSPACE_SECTIONS,
  roleLabel,
  roleOf,
  sectionAccess,
  type SectionAccess,
  type WorkspaceSection,
} from "@/lib/roles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Hücre işareti — ÜÇ durum, üç ayrı ikon. */
function Hucre({ access }: { access: SectionAccess }) {
  if (access === "kapali") {
    return <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Kapalı" />;
  }
  if (access === "yazar") {
    return (
      <PencilLine
        className="mx-auto size-4 text-emerald-600 dark:text-emerald-400"
        aria-label="Görür ve değiştirir"
      />
    );
  }
  return <Eye className="mx-auto size-4 text-foreground/60" aria-label="Yalnız görür" />;
}

/** Sütun başlığı — bölüm adı, ipucunda kuralın insan okunur özeti. */
function BolumBasligi({ s }: { s: WorkspaceSection }) {
  return (
    <TableHead
      className="text-center align-bottom"
      title={`${s.hint}\nGörür: ${s.kime}\nDeğiştirir: ${s.yazma ?? "Görebilenlerin tamamı"}`}
    >
      <span className="block text-[11px] leading-tight font-medium">{s.label}</span>
    </TableHead>
  );
}

/** Ekrandaki bir kişi satırı — veri katmanı bu biçime indirger. */
export interface AccessPerson {
  id: string;
  ad: string;
  rol: string;
}

export function AccessGrid({ kisiler }: { kisiler: AccessPerson[] }) {
  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Yetkiler</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Her kullanıcının <strong>tek bir rolü</strong> vardır; uygulamada neyi görebildiğini
          ve neyi değiştirebildiğini o rol belirler. Aşağıdaki ızgara elle yazılmaz,{" "}
          <strong>hesaplanır</strong>: sol menü ile bu sayfa aynı kaynağı okur, ayrışamazlar.
          Rolü değiştirmek için <strong>Kullanıcılar</strong> sayfasına gidin.
        </p>
      </div>

      {/* ————————————————————————————————————— açıklama şeridi */}
      <p className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border bg-muted/30 px-3 py-2 text-[12px]">
        <span className="inline-flex items-center gap-1.5">
          <PencilLine className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
          görür ve değiştirir
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Eye className="size-4 text-foreground/60" aria-hidden />
          yalnız görür
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Minus className="size-4 text-muted-foreground/40" aria-hidden />
          kapalı
        </span>
      </p>

      {/* ————————————————————————————————————— 1. ROL × BÖLÜM IZGARASI */}
      {/* BİLİNÇLİ İSTİSNA (md. 15): bu bir rol × bölüm MATRİSİDİR, listeye
          katlanmaz — satır ve sütunun kesişimi anlamın kendisidir, sütunları
          alt satıra indirmek "hangi bölüm" bilgisini yok ederdi. Telefonda
          içte kaymaya devam eder; kaydırma ipucunu `Table`ın varsayılan
          `.oc-scrollx` kabı verir, ilk sütun yapışkan kalır. */}
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Rol Bazında Erişim</h3>
        {/* KAP `Table`in KENDİSİNİNKİDİR, ikinci bir sarmalayıcı DEĞİL.
            Bileşen tabloyu zaten `.oc-scrollx` bir kaba alıyor; dışına bir
            tane daha koymak kaydırmayan bir kabuk üretir ve kenar gölgesi
            yanlış katmana çizilirdi. Çerçeve ve zemin `containerClassName`
            ile o tek kaba verilir. */}
        <Table containerClassName="rounded-lg border [--oc-scroll-bg:var(--card)]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {/* Rol sütunu YAPIŞKAN: dokuz bölümlü ızgara telefonda yana
                    kayar ve satırın hangi role ait olduğu kaybolurdu. */}
                <TableHead className="sticky left-0 z-10 bg-muted/50">Rol</TableHead>
                {WORKSPACE_SECTIONS.map((s) => (
                  <BolumBasligi key={s.href} s={s} />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {USER_ROLES.map((r) => (
                <TableRow key={r}>
                  <TableCell className="sticky left-0 z-10 bg-card align-top whitespace-nowrap">
                    <span className="block text-[13px] font-medium">{USER_ROLE_LABELS[r]}</span>
                    <span className="block max-w-[15rem] text-[11px] whitespace-normal text-muted-foreground">
                      {USER_ROLE_HINTS[r]}
                    </span>
                  </TableCell>
                  {WORKSPACE_SECTIONS.map((s) => (
                    <TableCell key={s.href} className="text-center align-middle">
                      <Hucre access={sectionAccess(s, r)} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
        </Table>
      </section>

      {/* ————————————————————————————————————— 2. KİŞİ MATRİSİ
          Izgara KURALI, bu tablo GERÇEĞİ söyler. İkincisi olmadan yönetici
          "Akif bu sayfayı görüyor mu" sorusunu ancak Akif'in rolünü hatırlayıp
          yukarıdaki ızgarada elle aramakla cevaplayabilirdi. */}
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Kişi Bazında Erişim</h3>
        {/* KAP `Table`in KENDİSİNİNKİDİR, ikinci bir sarmalayıcı DEĞİL.
            Bileşen tabloyu zaten `.oc-scrollx` bir kaba alıyor; dışına bir
            tane daha koymak kaydırmayan bir kabuk üretir ve kenar gölgesi
            yanlış katmana çizilirdi. Çerçeve ve zemin `containerClassName`
            ile o tek kaba verilir. */}
        <Table containerClassName="rounded-lg border [--oc-scroll-bg:var(--card)]">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="sticky left-0 z-10 bg-muted/50">Kullanıcı</TableHead>
                {WORKSPACE_SECTIONS.map((s) => (
                  <BolumBasligi key={s.href} s={s} />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {kisiler.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="sticky left-0 z-10 bg-card align-top whitespace-nowrap">
                    <span className="block text-[13px] font-medium">{k.ad}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {roleLabel(k.rol)}
                    </span>
                  </TableCell>
                  {WORKSPACE_SECTIONS.map((s) => (
                    <TableCell key={s.href} className="text-center align-middle">
                      {/* Rol METNİ değil ÇÖZÜLMÜŞ rol geçilir: bozuk bir değer
                          `roleOf` ile güvenli role düşer ve satır ızgarayla
                          aynı cevabı verir. */}
                      <Hucre access={sectionAccess(s, roleOf(k.rol))} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {kisiler.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={WORKSPACE_SECTIONS.length + 1}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Kayıtlı kullanıcı yok.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
        </Table>
      </section>

      <p className="max-w-3xl text-[12px] text-muted-foreground">
        Bir bölümü menüden gizlemek tek başına yeterli değildir; asıl engel veritabanının
        kendi güvenlik kurallarındadır ve aynı soru orada bir kez daha sorulur. Yani adresi
        elle yazan bir kullanıcı da veriyi göremez. Yetkiler bu sayfadan değiştirilmez:
        kural kodda tanımlıdır ve testlerle dondurulmuştur.
      </p>
    </div>
  );
}
