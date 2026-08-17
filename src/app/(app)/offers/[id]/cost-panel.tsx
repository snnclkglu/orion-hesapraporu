"use client";

// MALİYET REVİZYONLARI — teklif panelinin ikinci tablosu.
//
// Teklif revizyonlarının tablosuyla YAN YANA durur ama AYRI bir zincirdir
// (kullanıcı kararı, 17.08.2026): maliyetin kendi M0/M1'i, kendi yayımı ve
// kendi kilidi vardır. Teklif R1'e geçtiğinde maliyet M0'da kalabilir ve bu
// meşrudur — teklif metni değişip maliyeti değişmeyen bir revizyon olağandır
// (bir not eklenmiştir, bir teslim süresi düzeltilmiştir). Tablo hangi teklif
// revizyonuna göre kurulduğunu YAZAR; sessiz bir ayrışma kâr marjını yanlış
// gösterirdi.

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Eye, FilePlus2, Lock, LockOpen, Pencil, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtMoney } from "@/lib/currency";
import { revisionStatusLabel, revisionStatusVariant } from "@/lib/revision-status";
import { fmtOfferDate } from "@/lib/offers/filter";
import type { OfferCostRecord } from "../cost-data";
import {
  createOfferCostRevision,
  deleteOfferCostRevision,
  issueOfferCostRevision,
  unlockOfferCostRevision,
} from "../cost-actions";

function pdfUrl(offerId: string, costRevId: string, inline = false): string {
  return `/offers/${offerId}/costs/${costRevId}/pdf${inline ? "?inline=1" : ""}`;
}

export function CostPanel({
  offerId,
  currency,
  costs,
  offerRevNo,
  yonetici,
}: {
  offerId: string;
  currency: string;
  costs: readonly OfferCostRecord[];
  /** Teklifin GÜNCEL revizyon numarası — maliyetin geride kalıp kalmadığı. */
  offerRevNo: number | null;
  yonetici: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function yeni() {
    startTransition(async () => {
      const res = await createOfferCostRevision(offerId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Maliyet çalışması açıldı; kalemler teklifden getirildi.");
      if (res.id) window.location.href = `/offers/${offerId}/costs/${res.id}`;
    });
  }

  function yayimla(costRevId: string) {
    startTransition(async () => {
      const res = await issueOfferCostRevision(offerId, costRevId);
      if (res.error) toast.error(res.error);
      else if (res.warning) toast.warning(res.warning);
      else toast.success("Maliyet yayımlandı ve arşivlendi.");
    });
  }

  function geriCek(costRevId: string, revNo: number) {
    if (
      !confirm(
        `M${revNo} yayımdan geri çekilip TASLAĞA alınsın mı? Arşivdeki PDF korunur ve işlem denetim defterine yazılır.`
      )
    )
      return;
    startTransition(async () => {
      const res = await unlockOfferCostRevision(offerId, costRevId);
      if (res.error) toast.error(res.error);
      else toast.success("Maliyet taslağa alındı; düzenleyebilirsiniz.");
    });
  }

  function sil(costRevId: string, revNo: number) {
    if (!confirm(`M${revNo} taslak maliyet revizyonu silinsin mi? Bu işlem geri alınamaz.`)) return;
    startTransition(async () => {
      const res = await deleteOfferCostRevision(offerId, costRevId);
      if (res.error) toast.error(res.error);
      else toast.success("Maliyet revizyonu silindi.");
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold tracking-wide">MALİYET ÇALIŞMASI</h2>
        <p className="text-xs text-muted-foreground">
          İÇ BELGE — müşteriye giden teklifte görünmez.
        </p>
        <Button type="button" size="sm" className="oc-tap ml-auto" onClick={yeni} disabled={pending}>
          <FilePlus2 className="size-3.5" />
          {costs.length === 0 ? "Maliyet Çalışması Aç" : "Yeni Maliyet Revizyonu"}
        </Button>
      </div>

      {costs.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Bu teklifin maliyet çalışması yok. Açtığınızda teklifin kalemleri, kapasite ve
          açıklık gibi ölçüleri buraya taşınır; siz birim fiyatları girersiniz.
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Revizyon</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Proje Maliyeti</TableHead>
                <TableHead className="text-right">Toplam Maliyet</TableHead>
                <TableHead>Güncellendi</TableHead>
                <TableHead className="text-right">Belge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((c) => {
                const taslak = c.status === "draft";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono whitespace-nowrap">M{c.rev_no}</TableCell>
                    <TableCell>
                      <Badge variant={revisionStatusVariant(c.status)}>
                        {revisionStatusLabel(c.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono whitespace-nowrap">
                      {c.direct_amount == null ? "—" : fmtMoney(Number(c.direct_amount), currency)}
                    </TableCell>
                    <TableCell className="text-right font-mono whitespace-nowrap">
                      {c.total_amount == null ? "—" : fmtMoney(Number(c.total_amount), currency)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {fmtOfferDate(c.updated_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button asChild variant="outline" size="sm" className="oc-tap">
                          <Link href={`/offers/${offerId}/costs/${c.id}`}>
                            {taslak ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
                            {taslak ? "Düzenle" : "Görüntüle"}
                          </Link>
                        </Button>
                        {/* ÖNİZLEME YENİ SEKMEDE açılır, çerçevede değil:
                            `next.config.ts`teki çerçeve gevşetmesi yalnız teklif
                            PDF'ine verildi (TEKLIF-18) ve iç belge için ikinci
                            bir gömülebilir adres açmanın karşılığı yok. */}
                        <Button asChild variant="outline" size="sm" className="oc-tap">
                          <a href={pdfUrl(offerId, c.id, true)} target="_blank" rel="noreferrer">
                            <Eye className="size-3.5" /> Önizle
                          </a>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="oc-tap">
                          <a href={pdfUrl(offerId, c.id)}>
                            <Download className="size-3.5" /> PDF
                          </a>
                        </Button>

                        {taslak ? (
                          <Button
                            type="button"
                            size="sm"
                            className="oc-tap"
                            disabled={pending}
                            onClick={() => yayimla(c.id)}
                            title="Maliyet revizyonunu kilitler ve iç PDF'i arşivler"
                          >
                            <Send className="size-3.5" /> Yayımla
                          </Button>
                        ) : yonetici ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="oc-tap"
                            disabled={pending}
                            title="Taslağa geri çek — arşivdeki PDF korunur, işlem denetime yazılır"
                            onClick={() => geriCek(c.id, c.rev_no)}
                          >
                            <LockOpen className="size-3.5" /> Geri Çek
                          </Button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground"
                            title="Yayımlanmış maliyet revizyonu değiştirilemez"
                          >
                            <Lock className="size-3.5" /> Kilitli
                          </span>
                        )}

                        {taslak ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="oc-tap text-destructive hover:text-destructive"
                            disabled={pending}
                            onClick={() => sil(c.id, c.rev_no)}
                            aria-label={`M${c.rev_no} maliyet revizyonunu sil`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {offerRevNo !== null && costs.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Teklif şu an <span className="font-medium">R{offerRevNo}</span>. Maliyet başka bir
          revizyona göre kurulduysa editördeki{" "}
          <span className="font-medium">Tekliften Tazele</span> düğmesi onu eşitler.
        </p>
      ) : null}
    </div>
  );
}
