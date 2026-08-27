"use client";

// TEKLİF PANELİ — künye, revizyon zinciri ve belge eylemleri.
//
// PDF İKİ AYRI DÜĞMEDİR (kullanıcı kararı, 17.08.2026: *"pdf indir ve pdf indir
// ve teklifi yayınla tuşu olsun ikisi ayrı ayrı"*) ve ayrım gerçek bir işe
// karşılık gelir:
//
//   · **Teklifi İndir** — belgeyi ÜRETİR, hiçbir şeyi değiştirmez. Taslağı
//     kontrol etmek, iç görüş almak, müşteriye "ön bilgi" göndermek için.
//   · **Teklifi İndir ve Yayımla** — revizyonu KİLİTLER, arşive yazar ve
//     teklifin GÖNDERİM TARİHİNİ bugüne çeker. Takip sayacı o andan işler.
//
// DÜĞME BELGENİN ADINI SÖYLER, BİÇİMİNİ DEĞİL (kullanıcı isteği, 22.08.2026):
// eskiden ikisi de "PDF İndir"di ve maliyet ekranındaki düğme de öyleydi —
// aynı ada sahip üç düğme, hangisinin hangi belgeyi indirdiğini ancak
// bulunduğu ekrandan söylüyordu. Ad artık soruyu düğmenin kendisi cevaplar.
//
// İkisini tek düğmede birleştirmek, her önizleme denemesini bir yayıma
// çevirirdi; ayırmanın bedeli ise kullanıcının hangi düğmeye bastığını bilmesi
// gerektiğidir ve düğme adları bunu açıkça söyler.
//
// ÖNİZLEME BİR PENCEREDİR, indirme değil (*"pop-up ile pdf çıktısını önizleme
// butonu da olsun"*): aynı uç `?inline=1` ile çağrılır ve tarayıcı belgeyi
// çerçeve içinde açar — dosya indirilenler klasörünü kirletmez.

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Eye, FilePlus2, Lock, LockOpen, Pencil, Send, Trash2 } from "lucide-react";
import { CustomerTag } from "@/components/tags";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CustomerOption } from "@/app/(app)/jobs/schema";
import { fmtMoney } from "@/lib/currency";
import { tagStyle } from "@/lib/tags";
import { offerDocLine, offerRevLabel } from "@/lib/offers/no";
import { OFFER_STATUSES, offerStatusHue, offerStatusLabel } from "@/lib/offers/status";
import { takipBaslangici, takipGorunur, takipYasi } from "@/lib/offers/takip";
import { revisionStatusLabel, revisionStatusVariant } from "@/lib/revision-status";
import { fmtOfferDate } from "@/lib/offers/filter";
import type { OfferRecord, OfferRevisionRecord } from "../data";
import {
  createOfferRevision,
  deleteOffer,
  deleteOfferRevision,
  issueOfferRevision,
  unlockOfferRevision,
  updateOfferDetails,
} from "../actions";
import { CopyOfferButton } from "../copy-offer-dialog";
import { PdfDownloadLink, downloadPdfFromApp } from "@/components/pdf-download-link";

function pdfUrl(offerId: string, revisionId: string, inline = false): string {
  return `/offers/${offerId}/revisions/${revisionId}/pdf${inline ? "?inline=1" : ""}`;
}

export function OfferPanel({
  offer,
  revisions,
  customers,
  bugun,
  yonetici,
}: {
  offer: OfferRecord;
  revisions: readonly OfferRevisionRecord[];
  customers: readonly CustomerOption[];
  bugun: string;
  /** Yayımlanmış revizyonu geri çekme yetkisi — YALNIZ Yönetici. */
  yonetici: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [onizleme, setOnizleme] = useState<{ revisionId: string; baslik: string } | null>(null);

  const defterKaydi = customers.find((c) => c.id === offer.customer_id);
  const guncel = revisions[0];
  const takipTarihi = takipBaslangici(offer.status, offer.issued_on, offer.issue_date);
  const yas = takipGorunur(offer.status, takipTarihi)
    ? takipYasi(takipTarihi!, bugun)
    : null;

  function durumDegistir(status: string) {
    startTransition(async () => {
      const res = await updateOfferDetails(offer.id, {
        subject: offer.subject,
        customerId: offer.customer_id ?? "",
        status: status as (typeof OFFER_STATUSES)[number],
        currency: offer.currency as "EUR" | "TRY" | "USD",
      });
      if (res.error) toast.error(res.error);
      else toast.success(`Durum "${offerStatusLabel(status)}" olarak güncellendi.`);
    });
  }

  function yeniRevizyon() {
    startTransition(async () => {
      const res = await createOfferRevision(offer.id);
      if (res.error) toast.error(res.error);
      else toast.success("Yeni revizyon açıldı.");
    });
  }

  /**
   * YAYIMLA VE İNDİR. Sıra ÖNEMLİDİR: önce yayım, sonra indirme.
   *
   * Tersi olsaydı yayım hatasında kullanıcının elinde yayımlanmamış bir
   * belgenin PDF'i kalırdı ve o belge "gönderildi" sanılırdı. Arşivleme hatası
   * yayımı geri almaz (uyarıyla söylenir) — yayım bir karardır, arşiv bir
   * kolaylıktır.
   */
  function yayimlaVeIndir(revisionId: string) {
    startTransition(async () => {
      const res = await issueOfferRevision(offer.id, revisionId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.warning) toast.warning(res.warning);
      else toast.success("Teklif yayımlandı ve arşivlendi.");
      await downloadPdfFromApp(pdfUrl(offer.id, revisionId), {
        shareTitle: "Teklif",
      });
    });
  }

  function geriCek(revisionId: string, revNo: number) {
    if (
      !confirm(
        `R${revNo} yayımdan geri çekilip TASLAĞA alınsın mı? Arşivdeki PDF korunur ve işlem denetim defterine yazılır.`
      )
    )
      return;
    startTransition(async () => {
      const res = await unlockOfferRevision(offer.id, revisionId);
      if (res.error) toast.error(res.error);
      else toast.success("Revizyon taslağa alındı; düzenleyebilirsiniz.");
    });
  }

  function revizyonSil(revisionId: string, revNo: number) {
    if (!confirm(`R${revNo} taslak revizyonu için Yönetici onayına silme talebi gönderilsin mi?`)) return;
    startTransition(async () => {
      const res = await deleteOfferRevision(offer.id, revisionId);
      if (res.error) toast.error(res.error);
      else toast.success("Revizyon silme talebi Yönetici onayına gönderildi.");
    });
  }

  function teklifSil() {
    if (!confirm("Teklif ve bütün revizyonları için Yönetici onayına silme talebi gönderilsin mi?")) return;
    startTransition(async () => {
      const res = await deleteOffer(offer.id);
      if (res.error) toast.error(res.error);
      else toast.success("Teklif silme talebi Yönetici onayına gönderildi.");
    });
  }

  return (
    <div className="grid gap-3">
      {/* ————————————————————————————————————————————— künye */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border bg-card p-3 lg:grid-cols-4 lg:gap-3 lg:p-4">
        <Kunye etiket="Teklif No">
          <span className="font-mono">{offerDocLine(offer.offer_no, guncel?.rev_no ?? 0)}</span>
        </Kunye>
        <Kunye etiket="Müşteri">
          <CustomerTag
            name={offer.customer_name}
            shortName={defterKaydi?.short_name}
            hue={defterKaydi?.color_hue}
          />
        </Kunye>
        <Kunye etiket="Açılış Tarihi">{fmtOfferDate(offer.issue_date)}</Kunye>
        <Kunye etiket="Gönderim Tarihi">
          {takipTarihi ? (
            <span className="inline-flex items-center gap-1.5">
              {fmtOfferDate(takipTarihi)}
              {yas ? (
                <span
                  style={tagStyle(yas.hue)}
                  title={`Gönderimden bu yana ${yas.gun} gün geçti`}
                  className="oc-tag px-1.5 py-0.5 text-[11px] font-medium"
                >
                  {yas.etiket}
                </span>
              ) : null}
            </span>
          ) : (
            // HENÜZ GÖNDERİLMEDİ: uydurma bir tarih yerine ne olduğu yazılır.
            <span className="text-muted-foreground">Henüz yayımlanmadı</span>
          )}
        </Kunye>
        <Kunye etiket="Durum">
          <Select value={offer.status} onValueChange={durumDegistir} disabled={pending}>
            <SelectTrigger className="h-8 w-full max-w-[12rem]" aria-label="Teklif durumu">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OFFER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  <span
                    style={tagStyle(offerStatusHue(s))}
                    className="oc-tag px-1.5 py-0.5 text-xs font-medium"
                  >
                    {offerStatusLabel(s)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Kunye>
        <Kunye etiket="Para Birimi">{offer.currency}</Kunye>
        <Kunye etiket="Güncel Tutar">
          {guncel?.total_amount == null ? "—" : fmtMoney(Number(guncel.total_amount), offer.currency)}
        </Kunye>
        <Kunye etiket="Konu" className="col-span-2 lg:col-span-1">
          {offer.subject || "—"}
        </Kunye>
      </div>

      {/* ————————————————————————————————————————————— eylemler */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={yeniRevizyon} disabled={pending} className="oc-tap">
          <FilePlus2 className="size-4" /> Yeni Revizyon
        </Button>
        <CopyOfferButton
          offer={{
            id: offer.id,
            offer_no: offer.offer_no,
            subject: offer.subject,
            customer_name: offer.customer_name,
          }}
          customers={customers}
          variant="dugme"
        />
        <Button
          type="button"
          variant="ghost"
          className="oc-tap ml-auto text-destructive hover:text-destructive"
          onClick={teklifSil}
          disabled={pending}
        >
          <Trash2 className="size-4" /> Teklifi Sil
        </Button>
      </div>

      {/* ————————————————————————————————————————————— revizyonlar */}
      <div className="rounded-lg border">
        <Table className="oc-mobile-table oc-compact-mobile-table" containerClassName="oc-mobile-table-wrap">
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Revizyon</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right">Tutar</TableHead>
              <TableHead>Güncellendi</TableHead>
              <TableHead className="text-right">Belge</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {revisions.map((rev) => {
              const taslak = rev.status === "draft";
              return (
                <TableRow key={rev.id}>
                  <TableCell data-label="Revizyon" className="font-mono whitespace-nowrap">
                    {offerRevLabel(rev.rev_no) ?? "İlk"}
                    {rev.rev_no === 0 ? <span className="ml-1 text-muted-foreground">(R0)</span> : null}
                  </TableCell>
                  <TableCell data-label="Durum">
                    <Badge variant={revisionStatusVariant(rev.status)}>
                      {revisionStatusLabel(rev.status)}
                    </Badge>
                  </TableCell>
                  <TableCell data-label="Tutar" className="text-right font-mono whitespace-nowrap">
                    {rev.total_amount == null ? "—" : fmtMoney(Number(rev.total_amount), offer.currency)}
                  </TableCell>
                  <TableCell data-label="Güncellendi" className="whitespace-nowrap text-muted-foreground">
                    {fmtOfferDate(rev.updated_at)}
                  </TableCell>
                  <TableCell data-label="Belge ve İşlemler" data-mobile-span="full">
                    <div className="oc-revision-actions flex flex-wrap items-center justify-end gap-1.5" data-mobile-actions>
                      <Button asChild variant="outline" size="sm" className="oc-tap">
                        <Link href={`/offers/${offer.id}/revisions/${rev.id}`}>
                          {taslak ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
                          {taslak ? "Düzenle" : "Görüntüle"}
                        </Link>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="oc-tap"
                        onClick={() =>
                          setOnizleme({
                            revisionId: rev.id,
                            baslik: offerDocLine(offer.offer_no, rev.rev_no),
                          })
                        }
                      >
                        <Eye className="size-3.5" /> Önizle
                      </Button>

                      <Button asChild variant="outline" size="sm" className="oc-tap">
                        <PdfDownloadLink href={pdfUrl(offer.id, rev.id)} shareTitle="Teklif">
                          <Download className="size-3.5" /> İndir
                        </PdfDownloadLink>
                      </Button>

                      {taslak ? (
                        <Button
                          type="button"
                          size="sm"
                          className="oc-tap"
                          disabled={pending}
                          onClick={() => yayimlaVeIndir(rev.id)}
                          title="Revizyonu kilitler, arşive yazar ve gönderim tarihini bugüne çeker"
                        >
                          <Send className="size-3.5" /> İndir ve Yayımla
                        </Button>
                      ) : yonetici ? (
                        // YAYIMLANMIŞI GERİ ÇEKMEK YALNIZ YÖNETİCİDEDİR
                        // (kullanıcı isteği: *"Yönetici yayınlanan teklifi
                        // düzenleyebilsin, yanlış yayınlamış olabilir"*).
                        // Kilit KALKMAZ, bir kapı açılır: revizyon önce taslağa
                        // çekilir, düzenleme normal yolundan yapılır. Arşivdeki
                        // PDF silinmez ve işlem denetim defterine yazılır.
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="oc-tap"
                          disabled={pending}
                          title="Taslağa geri çek — arşivdeki PDF korunur, işlem denetime yazılır"
                          onClick={() => geriCek(rev.id, rev.rev_no)}
                        >
                          <LockOpen className="size-3.5" /> Geri Çek
                        </Button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground"
                          title="Yayımlanmış revizyon değiştirilemez"
                        >
                          <Lock className="size-3.5" /> Kilitli
                        </span>
                      )}

                      {taslak && revisions.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="oc-tap text-destructive hover:text-destructive"
                          disabled={pending}
                          onClick={() => revizyonSil(rev.id, rev.rev_no)}
                          aria-label={`R${rev.rev_no} revizyonunu sil`}
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

      {/* ————————————————————————————————————————————— önizleme */}
      {onizleme ? (
        <Dialog open onOpenChange={(o) => !o && setOnizleme(null)}>
          <DialogContent className="max-w-[min(64rem,95vw)] sm:max-w-[min(64rem,95vw)]">
            <DialogHeader>
              <DialogTitle>Teklif Önizleme</DialogTitle>
              <DialogDescription className="font-mono">{onizleme.baslik}</DialogDescription>
            </DialogHeader>
            {/*
              ÇERÇEVE YÜKSEKLİĞİ `dvh`DİR, `vh` değil (MOBIL-3): mobil
              tarayıcıda `vh` adres çubuğu gizliyken ölçülen büyük alandır ve
              belge her zaman ekranın altına taşardı.
            */}
            <iframe
              src={pdfUrl(offer.id, onizleme.revisionId, true)}
              title="Teklif PDF önizleme"
              className="h-[70dvh] w-full rounded-md border bg-muted"
            />
            <div className="flex justify-end">
              <Button asChild variant="outline" className="oc-tap">
                <PdfDownloadLink
                  href={pdfUrl(offer.id, onizleme.revisionId)}
                  shareTitle="Teklif"
                >
                  <Download className="size-4" /> Teklifi İndir
                </PdfDownloadLink>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function Kunye({
  etiket,
  children,
  className,
}: {
  etiket: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="oc-kicker truncate text-[9px] tracking-[0.14em] text-muted-foreground lg:text-[11px]" title={etiket}>{etiket}</div>
      <div className="mt-0.5 min-w-0 truncate text-xs font-medium lg:text-sm">{children}</div>
    </div>
  );
}
