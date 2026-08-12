// YETKİ MATRİSİ — "hangi bölüm kime açık?"
//
// Kullanıcı kararı (md. 4): "Çalışma Alanındaki her bölümün kimlere açık
// olduğunu gösteren bir ekranı yönetim bölümü içerisine Kullanıcılar sayfasının
// altına yapalım."
//
// ═══════════════════════════════════════════ MATRİS HESAPLANIR, YAZILMAZ
//
// Bu sayfada elle yazılmış TEK BİR yetki bilgisi yoktur. Satırlar
// `WORKSPACE_SECTIONS`ten (sol menünün ta kendisi), sütunlar gerçek kullanıcı
// kayıtlarından gelir ve her hücre `visible()` SORUSUNUN cevabıdır — menünün
// çağırdığı fonksiyonun aynısı.
//
// Gerekçe: elle yazılmış bir matris, kodun gerçekte yaptığından başka bir şey
// anlatabilir ve bu, bir yetki ekranında olabilecek en kötü hatadır. Kural
// değişince matris kendiliğinden değişir; kimse güncellemeyi unutamaz.
//
// ═════════════════════════════ EKRAN SADELEŞTİRİLDİ (12.08.2026, kullanıcı)
//
// Bildirim aynen şuydu: *"yetkiler sayfası biraz karmaşık. İngilizce terimler
// var. düzeltelim."* Üç şey kaldırıldı ve üçü de KURALDIR:
//
//   1. FONKSİYON ADLARI. Sütunlarda "Yönetici · Mühendis (canEditReports)"
//      yazıyordu. Bu ekranı okuyan kişi yönetici ya da müdürdür; kodun iç adı
//      ona hiçbir şey anlatmaz, yalnız cümleyi okunmaz yapar. Kodun kaynağı
//      zaten `lib/roles.ts`tir ve orayı açan kişinin ekrana ihtiyacı yoktur.
//   2. ADRESLER. Bölüm adının altında `/jobs`, `/drawings` gibi yollar duruyordu
//      — bölümün kimliği ekranda ADIdır, adresi değil.
//   3. KISALTMALAR. "RLS" yerine ne olduğu Türkçe yazılır.
//
// Etiket sözlüğünün yerini ROL sözlüğü aldı: görev etiketleri (Satın Alma ·
// Planlama · Üretim) aynı gün role dönüştü, yani artık tek bir sözlük var.

import { Check, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  USER_ROLES,
  USER_ROLE_HINTS,
  USER_ROLE_LABELS,
  WORKSPACE_SECTIONS,
  roleLabel,
  roleOf,
} from "@/lib/roles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminAccessPage() {
  const supabase = await createClient();

  const { data: profiller } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .order("full_name");

  const kisiler = (profiller ?? []).map((p) => ({
    id: p.id,
    ad: p.full_name || p.email || "—",
    rol: p.role ?? "",
  }));

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Yetkiler</h2>
        <p className="text-sm text-muted-foreground">
          Her kullanıcının <strong>tek bir rolü</strong> vardır; uygulamada neyi görebildiğini
          ve neyi değiştirebildiğini o rol belirler. Aşağıdaki tablolar elle yazılmaz,{" "}
          <strong>hesaplanır</strong>: sol menü ile bu sayfa aynı kaynağı okur, ayrışamazlar.
          Rolü değiştirmek için <strong>Kullanıcılar</strong> sayfasına gidin.
        </p>
      </div>

      {/* ————————————————————————————————————— 1. ROL SÖZLÜĞÜ */}
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Roller</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-44">Rol</TableHead>
                <TableHead>Ne yapabilir</TableHead>
                <TableHead className="w-40 whitespace-normal">Görebildiği bölümler</TableHead>
                <TableHead className="w-20 text-right">Kişi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {USER_ROLES.map((r) => (
                <TableRow key={r}>
                  <TableCell className="align-top font-medium">{USER_ROLE_LABELS[r]}</TableCell>
                  <TableCell className="align-top text-[12px] whitespace-normal text-muted-foreground">
                    {USER_ROLE_HINTS[r]}
                  </TableCell>
                  {/* Sayı da SORULARIN cevabından çıkar, elle yazılmaz. */}
                  <TableCell className="align-top text-[12px] whitespace-normal">
                    {WORKSPACE_SECTIONS.filter((s) => !s.visible || s.visible(r))
                      .map((s) => s.label)
                      .join(" · ")}
                  </TableCell>
                  <TableCell className="align-top text-right font-mono text-[12px] tabular-nums">
                    {kisiler.filter((k) => roleOf(k.rol) === r).length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ————————————————————————————————————— 2. BÖLÜM KURALLARI */}
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Bölümler</h3>
        <div className="oc-scrollx rounded-lg border [--oc-scroll-bg:var(--card)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-40">Bölüm</TableHead>
                <TableHead>Ne işe yarar</TableHead>
                <TableHead className="w-52">Kimler görebilir</TableHead>
                <TableHead className="hidden w-52 lg:table-cell">
                  Kimler değiştirebilir
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {WORKSPACE_SECTIONS.map((s) => (
                <TableRow key={s.href}>
                  <TableCell className="align-top font-medium whitespace-normal">
                    {s.label}
                  </TableCell>
                  <TableCell className="max-w-[22rem] align-top text-[12px] whitespace-normal text-muted-foreground">
                    {s.hint}
                  </TableCell>
                  <TableCell className="align-top text-[12px] whitespace-normal">
                    {s.kime}
                  </TableCell>
                  <TableCell className="hidden align-top text-[12px] whitespace-normal text-muted-foreground lg:table-cell">
                    {s.yazma ?? "Görebilenlerin tamamı"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ————————————————————————————————————— 3. KİŞİ MATRİSİ */}
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Kişi Bazında Erişim</h3>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          <span>Her hücre, sol menünün o kullanıcı için verdiği cevaptır.</span>
          <span className="inline-flex items-center gap-1">
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" /> açık
          </span>
          <span className="inline-flex items-center gap-1">
            <Minus className="size-3.5 text-muted-foreground/40" /> kapalı
          </span>
        </p>
        <div className="oc-scrollx rounded-lg border [--oc-scroll-bg:var(--card)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="sticky left-0 bg-muted/50">Kullanıcı</TableHead>
                {WORKSPACE_SECTIONS.map((s) => (
                  <TableHead key={s.href} className="text-center">
                    <span className="block text-[11px] leading-tight">{s.label}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {kisiler.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="sticky left-0 bg-card align-top whitespace-nowrap">
                    <span className="block text-[13px] font-medium">{k.ad}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {roleLabel(k.rol)}
                    </span>
                  </TableCell>
                  {WORKSPACE_SECTIONS.map((s) => {
                    const acik = !s.visible || s.visible(k.rol);
                    return (
                      <TableCell key={s.href} className="text-center align-top">
                        {acik ? (
                          <Check
                            className="mx-auto size-4 text-emerald-600 dark:text-emerald-400"
                            aria-label="Açık"
                          />
                        ) : (
                          <Minus
                            className="mx-auto size-4 text-muted-foreground/40"
                            aria-label="Kapalı"
                          />
                        )}
                      </TableCell>
                    );
                  })}
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
        </div>
      </section>

      <p className="text-[12px] text-muted-foreground">
        Bir bölümü menüden gizlemek tek başına yeterli değildir; asıl engel veritabanının
        kendi güvenlik kurallarındadır ve aynı soru orada bir kez daha sorulur. Yani adresi
        elle yazan bir kullanıcı da veriyi göremez.
      </p>
    </div>
  );
}
