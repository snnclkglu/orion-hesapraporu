"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Link2, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { linkOfferToExistingJob } from "../../actions";

export interface ExistingOfferOption {
  id: string;
  offerNo: string;
  customerName: string;
  subject: string;
  revisionNo: number;
}

export interface LinkedOfferSummary {
  offerNo: string;
  customerName: string;
  subject: string;
  revisionNo: number;
}

/**
 * Eski bir işi eski bir teklife bağlayan ayrı kayıt kapısı.
 *
 * Bileşen JobForm'un dışında durur; dolayısıyla bu düğme formu göndermez ve
 * iş emri alanlarını taşıyamaz. Sunucudaki RPC de aynı sınırı uygular.
 */
export function ExistingOfferLinker({
  jobId,
  linked,
  options,
}: {
  jobId: string;
  linked: LinkedOfferSummary | null;
  options: ExistingOfferOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

  function linkOffer() {
    if (!selected) return;
    startTransition(async () => {
      const result = await linkOfferToExistingJob(jobId, selected);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Teklif dokümanı iş emrine bağlandı.");
      router.refresh();
    });
  }

  return (
    <section className="mb-4 grid gap-3 rounded-lg border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-start gap-2">
        {linked ? (
          <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
        ) : (
          <Trophy className="mt-0.5 size-4 shrink-0 text-primary" />
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Teklif Dokümanı</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Kazanılmış bir teklifin son yayımlanmış revizyonunu bu işe bağlar.
            Yalnız fiyat ve ödeme şartları çıkarılmış teklif dokümanı eklenir;
            aşağıdaki iş emri bilgileri ve iş kalemleri değişmez.
          </p>
        </div>
      </div>

      {linked ? (
        <div className="flex flex-col gap-2 rounded-md border bg-background/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <span className="font-mono font-medium text-primary">{linked.offerNo}</span>
            <span className="text-muted-foreground"> · R{linked.revisionNo}</span>
            <p className="truncate text-xs text-muted-foreground">
              {linked.customerName} · {linked.subject}
            </p>
          </div>
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={`/jobs/${jobId}/teklif`}>
              <FileText className="size-3.5" /> Dokümanı Aç
            </Link>
          </Button>
        </div>
      ) : options.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={selected} onValueChange={setSelected} disabled={pending}>
            <SelectTrigger className="w-full sm:flex-1" aria-label="İşe bağlanacak kazanılmış teklif">
              <SelectValue placeholder="Kazanılmış teklif seçin" />
            </SelectTrigger>
            <SelectContent>
              {options.map((offer) => (
                <SelectItem key={offer.id} value={offer.id}>
                  {offer.offerNo} · R{offer.revisionNo} · {offer.customerName} · {offer.subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" disabled={!selected || pending} onClick={linkOffer}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            Teklifi Bağla
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Bağlanabilecek, yayımlanmış revizyonu olan kazanılmış teklif bulunmuyor.
        </p>
      )}
    </section>
  );
}
