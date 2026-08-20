"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ExternalLink, RotateCcw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DELETION_CLEANUP_LABELS,
  DELETION_ENTITY_LABELS,
  DELETION_STATUS_LABELS,
  type DeletionCleanupStatus,
  type DeletionEntityType,
  type DeletionRequestStatus,
} from "@/lib/deletion-requests";
import {
  approveDeletionRequest,
  rejectDeletionRequest,
  retryDeletionCleanup,
} from "./actions";

export interface DeletionRequestRow {
  id: string;
  entityType: DeletionEntityType;
  targetLabel: string;
  targetPath: string;
  snapshot: Record<string, unknown>;
  requestNote: string;
  requesterName: string;
  requestedAt: string;
  status: DeletionRequestStatus;
  reviewerName: string;
  reviewedAt: string | null;
  reviewNote: string;
  cleanupStatus: DeletionCleanupStatus;
  cleanupError: string;
}

type ReviewMode = "approve" | "reject";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function detailText(snapshot: Record<string, unknown>) {
  const parts: string[] = [];
  const add = (label: string, key: string) => {
    const value = snapshot[key];
    if (typeof value === "number" || (typeof value === "string" && value)) {
      parts.push(`${label}: ${value}`);
    }
  };
  add("İş kalemi", "item_count");
  add("Revizyon", "revision_count");
  add("Dosya", "file_count");
  add("Parça", "part_count");
  add("Dosya adı", "file_name");
  add("Sürüm", "revision");
  return parts.join(" · ");
}

function statusVariant(status: DeletionRequestStatus) {
  if (status === "approved") return "default" as const;
  if (status === "rejected") return "destructive" as const;
  return "secondary" as const;
}

export function DeletionRequestsView({ rows }: { rows: DeletionRequestRow[] }) {
  const [review, setReview] = useState<{ row: DeletionRequestRow; mode: ReviewMode } | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function openReview(row: DeletionRequestRow, mode: ReviewMode) {
    setNote("");
    setReview({ row, mode });
  }

  function submitReview() {
    if (!review) return;
    if (review.mode === "reject" && !note.trim()) {
      toast.error("Ret gerekçesi gerekli");
      return;
    }
    startTransition(async () => {
      const action = review.mode === "approve" ? approveDeletionRequest : rejectDeletionRequest;
      const result = await action({ requestId: review.row.id, note });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.warning) toast.warning(result.warning);
      else toast.success(review.mode === "approve" ? "Silme onaylandı ve uygulandı" : "Silme talebi reddedildi");
      setReview(null);
      setNote("");
    });
  }

  function retryCleanup(row: DeletionRequestRow) {
    startTransition(async () => {
      const result = await retryDeletionCleanup(row.id);
      if (result.error) toast.error(result.error);
      else if (result.warning) toast.warning(`Dosya temizliği tamamlanamadı: ${result.warning}`);
      else toast.success("Dosya temizliği tamamlandı");
    });
  }

  if (!rows.length) {
    return (
      <div className="grid min-h-40 place-items-center rounded-lg border border-dashed text-center">
        <div className="grid justify-items-center gap-2 p-6">
          <ShieldCheck className="size-8 text-muted-foreground" />
          <p className="font-medium">Bu görünümde silme talebi yok</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Kalıcı silme istendiğinde hedefin künyesi ve isteyen kullanıcı burada kayıt altına alınır.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3">
        {rows.map((row) => {
          const detail = detailText(row.snapshot);
          return (
            <article key={row.id} className="grid gap-3 rounded-lg border bg-card p-4 shadow-xs">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{DELETION_ENTITY_LABELS[row.entityType]}</Badge>
                    <Badge variant={statusVariant(row.status)}>{DELETION_STATUS_LABELS[row.status]}</Badge>
                    {row.status === "approved" && row.cleanupStatus !== "not_required" && (
                      <Badge variant={row.cleanupStatus === "failed" ? "destructive" : "secondary"}>
                        {DELETION_CLEANUP_LABELS[row.cleanupStatus]}
                      </Badge>
                    )}
                  </div>
                  <h3 className="break-words text-sm font-semibold">{row.targetLabel}</h3>
                  {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
                </div>
                {row.status !== "approved" && row.targetPath && (
                  <Button asChild size="sm" variant="ghost">
                    <Link href={row.targetPath}>
                      Kaydı aç <ExternalLink data-icon="inline-end" />
                    </Link>
                  </Button>
                )}
              </div>

              <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Talep eden</dt>
                  <dd className="font-medium">{row.requesterName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Talep zamanı</dt>
                  <dd>{formatDate(row.requestedAt)}</dd>
                </div>
                {row.reviewedAt && (
                  <>
                    <div>
                      <dt className="text-muted-foreground">Karar veren</dt>
                      <dd className="font-medium">{row.reviewerName}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Karar zamanı</dt>
                      <dd>{formatDate(row.reviewedAt)}</dd>
                    </div>
                  </>
                )}
              </dl>

              {(row.requestNote || row.reviewNote || row.cleanupError) && (
                <div className="grid gap-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
                  {row.requestNote && <p><span className="text-muted-foreground">Talep notu:</span> {row.requestNote}</p>}
                  {row.reviewNote && <p><span className="text-muted-foreground">Karar notu:</span> {row.reviewNote}</p>}
                  {row.cleanupError && <p className="text-destructive"><span>Dosya temizliği:</span> {row.cleanupError}</p>}
                </div>
              )}

              {row.status === "pending" && (
                <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => openReview(row, "reject")}>
                    <X data-icon="inline-start" /> Reddet
                  </Button>
                  <Button size="sm" variant="destructive" disabled={pending} onClick={() => openReview(row, "approve")}>
                    <Check data-icon="inline-start" /> Silmeyi Onayla
                  </Button>
                </div>
              )}
              {row.status === "approved" &&
                (row.cleanupStatus === "pending" || row.cleanupStatus === "failed") && (
                  <div className="flex justify-end border-t pt-3">
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => retryCleanup(row)}>
                      <RotateCcw data-icon="inline-start" />
                      {row.cleanupStatus === "failed"
                        ? "Dosya Temizliğini Yeniden Dene"
                        : "Dosya Temizliğini Tamamla"}
                    </Button>
                  </div>
                )}
            </article>
          );
        })}
      </div>

      <Dialog open={Boolean(review)} onOpenChange={(open) => !open && !pending && setReview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {review?.mode === "approve" ? "Kalıcı silmeyi onayla" : "Silme talebini reddet"}
            </DialogTitle>
            <DialogDescription>
              {review?.mode === "approve"
                ? "Onaydan sonra kayıt veritabanından silinir; varsa dosyaları depodan temizlenir. İşlem geri alınamaz."
                : "Kayıt silinmez. Talep, gerekçenizle birlikte denetim geçmişinde kalır."}
            </DialogDescription>
          </DialogHeader>
          {review && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm font-medium">
              {review.row.targetLabel}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="review-note">
              {review?.mode === "approve" ? "Onay notu (isteğe bağlı)" : "Ret gerekçesi"}
            </Label>
            <Textarea
              id="review-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              required={review?.mode === "reject"}
              disabled={pending}
            />
            <span className="justify-self-end text-[11px] text-muted-foreground">{note.length}/500</span>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setReview(null)}>Vazgeç</Button>
            <Button
              variant={review?.mode === "approve" ? "destructive" : "default"}
              disabled={pending}
              onClick={submitReview}
            >
              {pending ? "İşleniyor…" : review?.mode === "approve" ? "Onayla ve Kalıcı Sil" : "Talebi Reddet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
