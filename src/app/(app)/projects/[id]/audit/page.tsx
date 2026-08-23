// İşlem kaydı (audit log): proje üzerindeki tüm aksiyonların izi.
// Kayıtlar insert-only'dir; kim, ne zaman, ne yaptı.

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const ACTION_LABELS: Record<string, string> = {
  "project.create": "Proje oluşturuldu",
  "project.archive": "Proje arşivlendi",
  "project.unarchive": "Proje arşivden çıkarıldı",
  "revision.create": "Revizyon oluşturuldu",
  "revision.save": "Revizyon kaydedildi",
  "revision.issue": "Revizyon yayınlandı",
  "revision.template_set": "Şablon yapıldı",
  "revision.template_unset": "Şablon kaldırıldı",
  "drawing.create": "Çizim eklendi",
  "drawing.update": "Çizim güncellendi",
  "drawing.delete": "Çizim silindi",
};

function detailSummary(action: string, detail: Record<string, unknown>): string {
  const parts: string[] = [];
  if (detail.rev_no !== undefined) parts.push(`V${detail.rev_no}`);
  if (detail.label) parts.push(String(detail.label));
  if (detail.copied_from !== undefined && detail.copied_from !== null)
    parts.push(`V${detail.copied_from} kopyası`);
  if (detail.engine_version) parts.push(`motor v${detail.engine_version}`);
  if (detail.all_pass === false) parts.push("uygun olmayan kontroller var");
  if (detail.all_pass === true) parts.push("tüm kontroller uygun");
  if (detail.doc_no) parts.push(String(detail.doc_no));
  if (detail.drawing_no) parts.push(String(detail.drawing_no));
  if (detail.revision && action.startsWith("drawing."))
    parts.push(`Rev ${detail.revision}`);
  return parts.join(" · ");
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, doc_no, name")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const { data: entries } = await supabase
    .from("audit_log")
    .select("id, action, detail, created_at, revision_id, profiles:actor(full_name)")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden">
      <div>
        <div className="text-sm text-muted-foreground">
          {/* `.oc-tap`: kırıntı bağlantısı yazı boyunda kalır, dokunma katmanı
              44px'e tamamlanır (kutu büyütülmez — MOBIL-1). */}
          <Link href="/projects" className="oc-tap hover:underline">Mühendislik</Link>
          {" / "}
          <Link href={`/projects/${id}`} className="oc-tap hover:underline">
            <span className="font-mono">{project.doc_no}</span>
          </Link>
          {" / İşlem Kaydı"}
        </div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          İşlem Kaydı — {project.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Son 200 kayıt. Kayıtlar silinemez ve değiştirilemez.
        </p>
      </div>

      {/* TELEFONDA TABLO LİSTEYE KATLANIR (kabuk kuralı 15): "yana kaydırın"
          notu kalktı — `sm` altında yalnız İşlem + Detay kalır, tarih ve
          kullanıcı rozetin alt satırına iner. Defter BÜYÜR (son 200 kayıt);
          `oc-table-clamp` + `oc-sticky-head` uzun listede başlığı tepede
          tutar. `.oc-scrollx` tablet ara genişlikleri için kalır (kural 8). */}
      <div className="relative overflow-hidden rounded-lg border bg-card">
        <Table
          containerClassName="oc-mobile-table-wrap oc-table-clamp [--oc-scroll-bg:var(--card)]"
          className="oc-mobile-table"
        >
          <TableHeader className="oc-sticky-head">
            {/* "Kullanıcı" mobilde işlem rozetinin altına iner; dört sütun
                + serbest metin detay telefonda tabloyu ~900px yapıyordu. */}
            <TableRow>
              <TableHead className="hidden sm:table-cell">Tarih</TableHead>
              <TableHead className="hidden md:table-cell">Kullanıcı</TableHead>
              <TableHead>İşlem</TableHead>
              <TableHead>Detay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(entries ?? []).map((e) => {
              // Tarih ve ad İKİ yerde okunur (sütun + telefon alt satırı);
              // tek değişkende kurulur ki iki yazım ayrışamasın (kural 15).
              const tarih = new Date(e.created_at).toLocaleString("tr-TR");
              const kullanici =
                (e.profiles as unknown as { full_name: string } | null)?.full_name ?? "—";
              return (
                <TableRow key={e.id}>
                  {/* Tarih + saat tablette sarsın: nowrap hâlinde tek başına
                      ~150px yiyordu. */}
                  <TableCell
                    data-label="Tarih"
                    className="hidden text-sm whitespace-normal text-muted-foreground sm:table-cell md:whitespace-nowrap"
                  >
                    {tarih}
                  </TableCell>
                  <TableCell data-label="Kullanıcı" className="hidden text-sm md:table-cell">
                    {kullanici}
                  </TableCell>
                  <TableCell data-label="İşlem" className="whitespace-normal">
                    <Badge variant={e.action === "revision.issue" ? "default" : "outline"}>
                      {ACTION_LABELS[e.action] ?? e.action}
                    </Badge>
                    <div className="mt-0.5 text-[11px] text-muted-foreground md:hidden">
                      <span className="sm:hidden">{tarih} · </span>
                      {kullanici}
                    </div>
                  </TableCell>
                  {/* Serbest metin: taban `whitespace-nowrap`u devralınca uzun
                      detay tabloyu tek başına ~900px'e çıkarıyordu;
                      `break-words` boşluksuz jetonu da sardırır. */}
                  <TableCell
                    data-label="Detay"
                    data-mobile-span="full"
                    className="text-sm break-words whitespace-normal text-muted-foreground md:min-w-[16rem]"
                  >
                    {detailSummary(e.action, (e.detail ?? {}) as Record<string, unknown>)}
                  </TableCell>
                </TableRow>
              );
            })}
            {(entries ?? []).length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  data-mobile-span="full"
                  data-mobile-hide-label
                  className="h-24 text-center text-muted-foreground"
                >
                  Henüz kayıt yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
