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
// EKRAN İKİ TABLODUR ÇÜNKÜ İKİ AYRI SORU VAR:
//   1. KURAL — bölüm hangi role/etikete açık? (tanım)
//   2. KİŞİ  — bugün kim neyi görüyor? (gerçek)
// İkincisi olmadan yönetici "Akif bu sayfayı görüyor mu" sorusunu ancak Akif'in
// hesabına girerek cevaplayabilirdi.

import { Check, Minus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  USER_TAGS,
  USER_TAG_HINTS,
  USER_TAG_LABELS,
  WORKSPACE_SECTIONS,
  roleLabel,
  tagsOf,
  type Yetki,
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

  // Etiket sütunu iki denemede okunur (migration öncesi de çalışsın).
  const zengin = await supabase
    .from("profiles")
    .select("id, full_name, email, role, tags")
    .order("full_name");
  const profiller = (zengin.error
    ? (
        await supabase.from("profiles").select("id, full_name, email, role").order("full_name")
      ).data
    : zengin.data) as
    | { id: string; full_name: string; email: string; role: string; tags?: string[] }[]
    | null;
  const etiketDefteriVar = !zengin.error;

  const kisiler = (profiller ?? []).map((p) => ({
    id: p.id,
    ad: p.full_name || p.email || "—",
    email: p.email ?? "",
    yetki: { role: p.role ?? "", tags: tagsOf(p.tags) } satisfies Yetki,
  }));

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Yetkiler</h2>
        <p className="text-sm text-muted-foreground">
          Çalışma Alanındaki her bölümün kimlere açık olduğunu gösterir. Tablo{" "}
          <strong>hesaplanır</strong>: sol menü ile bu sayfa aynı kaynağı okur, ayrışamazlar.
          Menüden gizlemek yalnız görgü kuralıdır — asıl engel veritabanındaki satır düzeyi
          güvenliktir (RLS).
        </p>
      </div>

      {/* ————————————————————————————————————— 1. KURAL TABLOSU */}
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Bölüm Kuralları</h3>
        <div className="oc-scrollx rounded-lg border [--oc-scroll-bg:var(--card)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Bölüm</TableHead>
                <TableHead>Ne işe yarar</TableHead>
                <TableHead>Kimler görür</TableHead>
                <TableHead className="hidden lg:table-cell">Kimler yazar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {WORKSPACE_SECTIONS.map((s) => (
                <TableRow key={s.href}>
                  <TableCell className="align-top font-medium whitespace-nowrap">
                    {s.label}
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {s.href}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[22rem] align-top text-[12px] whitespace-normal text-muted-foreground">
                    {s.hint}
                  </TableCell>
                  <TableCell className="align-top text-[12px] whitespace-normal">
                    {s.kime}
                  </TableCell>
                  <TableCell className="hidden max-w-[18rem] align-top text-[12px] whitespace-normal text-muted-foreground lg:table-cell">
                    {s.yazma ?? "Görenlerin tamamı"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ————————————————————————————————————— 2. KİŞİ MATRİSİ */}
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Kişi Bazında Erişim</h3>
        <p className="text-[12px] text-muted-foreground">
          Her hücre, sol menünün o kullanıcı için sorduğu sorunun cevabıdır. Rolü ve görev
          etiketlerini değiştirmek için <strong>Kullanıcılar</strong> sayfasına gidin.
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
                      {roleLabel(k.yetki.role)}
                      {k.yetki.tags.length > 0 &&
                        ` · ${k.yetki.tags.map((t) => USER_TAG_LABELS[t]).join(" · ")}`}
                    </span>
                  </TableCell>
                  {WORKSPACE_SECTIONS.map((s) => {
                    const acik = !s.visible || s.visible(k.yetki);
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

      {/* ————————————————————————————————————— 3. ETİKET SÖZLÜĞÜ */}
      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Görev Etiketleri</h3>
        <p className="text-[12px] text-muted-foreground">
          Etiket rolün <strong>yerine geçmez, yanına gelir</strong>: rol tek değerlidir (kişinin
          uygulamadaki ana kimliği), etiket birden çok olabilir (kişinin firmadaki işi). Etiket
          yalnız <strong>kapı açar</strong> — bir etiketi olmayan kimse bugünkü yetkilerinden
          hiçbirini kaybetmez.
        </p>
        {!etiketDefteriVar && (
          <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
            Etiket defteri henüz kurulmamış (migration uygulanmadı); tablodaki etiket sütunları
            boş görünür.
          </p>
        )}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-40">Etiket</TableHead>
                <TableHead>Ne açar</TableHead>
                <TableHead className="w-24 text-right">Kişi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {USER_TAGS.map((t) => (
                <TableRow key={t}>
                  <TableCell className="font-medium">{USER_TAG_LABELS[t]}</TableCell>
                  <TableCell className="text-[12px] whitespace-normal text-muted-foreground">
                    {USER_TAG_HINTS[t]}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[12px] tabular-nums">
                    {kisiler.filter((k) => k.yetki.tags.includes(t)).length}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
