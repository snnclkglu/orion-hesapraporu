"use client";

// İŞLETME VE BAKIM EL KİTABI SEKMESİ — revizyon defteri ve giriş kapısı.
//
// SEKME EN SONDADIR çünkü ötekilerin hepsinden beslenir: hesap raporu,
// elektrik projesi, teknik resim defteri ve şartname. Kart bunların hangisinin
// HAZIR olduğunu da gösterir — eksik bir kaynak, kılavuzda boş bir tablo
// demektir ve bunu yayımdan ÖNCE görmek gerekir.
//
// İKİ ÇIKTI VAR (kullanıcı kararı, 19.08.2026):
//   GÖVDE       — react-pdf ile üretilen kılavuzun kendisi; hızlı ve küçük
//   TAM SÜRÜM   — gövde + ekler (mekanik/elektrik projeleri, katalog
//                 sayfaları, şartname) pdf-lib ile birleştirilmiş teslim
//                 paketi. Her önizlemede yüz megabaytı yeniden üretmemek için
//                 ayrıdır.

import { useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  CircleDashed,
  FileDown,
  Layers,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { revisionStatusLabel, revisionStatusVariant } from "@/lib/revision-status";
import { MANUAL_LABEL } from "@/lib/manual/naming";
import type { ManualRevisionRow, ManualRow } from "@/lib/manual/data";
import { createManual, deleteManualRevision, newManualRevision } from "./actions";

/** Kaynak hazırlık göstergesi — yayımdan önce eksiklik görünür olmalı. */
export interface ManualSourceStatus {
  label: string;
  ready: boolean;
  hint: string;
}

export function ManualCard({
  projectId,
  manual,
  revisions,
  sources,
  canEdit,
}: {
  projectId: string;
  manual: ManualRow | null;
  revisions: ManualRevisionRow[];
  sources: ManualSourceStatus[];
  canEdit: boolean;
}) {
  const [bekle, basla] = useTransition();

  function olustur() {
    basla(async () => {
      const r = await createManual(projectId);
      if (r.error) toast.error(r.error);
      else if (r.revisionId) window.location.href = `/projects/${projectId}/manual/${r.revisionId}`;
    });
  }

  function yeniRevizyon() {
    if (!manual) return;
    basla(async () => {
      const r = await newManualRevision(projectId, manual.id);
      if (r.error) toast.error(r.error);
      else if (r.revisionId) window.location.href = `/projects/${projectId}/manual/${r.revisionId}`;
    });
  }

  if (!manual) {
    return (
      <div className="grid gap-3">
        <KaynakSeridi sources={sources} />
        <EmptyState
          title="EL KİTABI AÇILMAMIŞ"
          description={`${MANUAL_LABEL} şablondan açılır: bölümler ve standart metinler hazır gelir, vince özel yerler boş kalır. Sınıflandırma, ekipman ve elektrik malzeme tabloları kaynaklardan otomatik dolar.`}
          className="rounded-lg"
        >
          {canEdit && (
            <Button onClick={olustur} disabled={bekle}>
              {bekle ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
              El Kitabı Oluştur
            </Button>
          )}
        </EmptyState>
      </div>
    );
  }

  const taslak = revisions.find((r) => r.status === "draft");

  return (
    <div className="grid gap-3">
      <KaynakSeridi sources={sources} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {revisions.length} revizyon
          {manual.customerDocNo ? ` · Müşteri doküman no: ${manual.customerDocNo}` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {canEdit && taslak && (
            <Button asChild>
              <Link href={`/projects/${projectId}/manual/${taslak.id}`}>
                Düzenlemeye Devam (V{taslak.revNo})
              </Link>
            </Button>
          )}
          {canEdit && !taslak && (
            <Button onClick={yeniRevizyon} disabled={bekle} variant="outline">
              {bekle ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Yeni Revizyon
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Revizyon</TableHead>
              <TableHead>Etiket</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="hidden md:table-cell">Oluşturan</TableHead>
              <TableHead className="hidden md:table-cell">Tarih</TableHead>
              <TableHead className="text-right">Belge</TableHead>
              <TableHead className="w-12 text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {revisions.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">
                  <Link
                    href={`/projects/${projectId}/manual/${r.id}`}
                    className="inline-flex min-h-9 items-center text-primary hover:underline pointer-coarse:min-h-10"
                  >
                    V{r.revNo}
                  </Link>
                </TableCell>
                <TableCell className="break-words whitespace-normal">
                  {r.label || "—"}
                  <div className="mt-0.5 text-[11px] whitespace-normal text-muted-foreground md:hidden">
                    {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                    {" · "}
                    {r.createdByName || "—"}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={revisionStatusVariant(r.status)}>
                    {revisionStatusLabel(r.status)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">
                  {r.createdByName || "—"}
                </TableCell>
                <TableCell className="hidden font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
                  {new Date(r.createdAt).toLocaleDateString("tr-TR")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex flex-wrap justify-end gap-1">
                    <Button asChild size="sm" variant="outline">
                      <a href={`/projects/${projectId}/manual/${r.id}/pdf`}>
                        <FileDown className="size-3.5" /> Gövde
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={`/projects/${projectId}/manual/${r.id}/pdf?ekler=1`}>
                        <Layers className="size-3.5" /> Tam Sürüm
                      </a>
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {/* Silme YALNIZ taslakta: yayımlanmış kılavuz teslim
                      edilmiştir (DB tetikleyicisi de engeller). */}
                  {canEdit && r.status === "draft" && (
                    <button
                      type="button"
                      title="Taslak revizyonu sil"
                      onClick={() =>
                        basla(async () => {
                          const s = await deleteManualRevision(projectId, r.id);
                          if (s.error) toast.error(s.error);
                          else window.location.reload();
                        })
                      }
                      className="oc-tap text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * KAYNAK ŞERİDİ — kılavuzun beslendiği dört kaynağın hazır olup olmadığı.
 *
 * Eksik bir kaynak sessiz kalırsa kılavuzda boş bir tablo olur ve o boşluk
 * ancak müşteri belgeyi okurken görülür. Şerit bunu yayımdan ÖNCE söyler.
 */
function KaynakSeridi({ sources }: { sources: ManualSourceStatus[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((s) => (
        <span
          key={s.label}
          title={s.hint}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
            s.ready ? "bg-card" : "border-dashed text-muted-foreground"
          }`}
        >
          {s.ready ? (
            <CheckCircle2 className="size-3.5 text-primary" />
          ) : (
            <CircleDashed className="size-3.5" />
          )}
          {s.label}
        </span>
      ))}
    </div>
  );
}
