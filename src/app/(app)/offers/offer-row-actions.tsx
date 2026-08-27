"use client";

// TEKLİF SATIRININ EYLEMLERİ — kopyala · iptal · sil.
//
// Kullanıcı isteği (22.08.2026): *"teklif bazen iptal edilebiliyor. satırda
// silme ve iptal özelliği olsun."*
//
// ÜÇ EYLEM TEK MENÜDE. Kopyalama bugüne kadar satırın son hücresinde tek
// başına bir ikondu; ona iki ikon daha eklemek üç küçük hedefi yan yana
// dizmek demekti ve `w-[4%]`lik hücreye sığmazdı. Menü ayrıca eylemleri
// ADLARIYLA yazar — çöp kutusu ikonu "sil" mi "iptal et" mi, ancak
// tıklandığında anlaşılırdı.
//
// İPTAL SİLME DEĞİLDİR ve ikisi bilerek ayrı durur:
//
// - **İPTAL** bir DURUMDUR (`cancelled`, `offers/status.ts`). Kayıt yerinde
//   kalır; gelecek yıl "geçen sene bu müşteriye ne vermiştik" sorusunun
//   cevabı odur. Tek tıkla geri de alınır — teklif paneli durumu değiştirir.
// - **SİLME** kalıcıdır ve bu yüzden DOĞRUDAN YAPILMAZ: uygulamanın kendi
//   onay mekanizmasından geçer (`request_deletion` → Yönetim → Silme
//   Talepleri). Kayıt, Yönetici onaylayana kadar değişmeden kalır. Yayımlanmış
//   revizyonu olan teklifte sunucu talebi zaten reddeder — müşterinin elindeki
//   bir belgenin izi silinemez.

import { useState, useTransition } from "react";
import { Ban, Copy, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { offerStatusOf } from "@/lib/offers/status";
import { deleteOffer, updateOfferStatus } from "./actions";
import type { CustomerOption } from "@/app/(app)/jobs/schema";
import { CopyOfferDialog, type CopyableOffer } from "./copy-offer-dialog";
import { EditOfferDialog, type EditableOffer } from "./edit-offer-dialog";

export function OfferRowActions({
  offer,
  customers,
}: {
  offer: CopyableOffer & EditableOffer;
  customers: readonly CustomerOption[];
}) {
  const [duzenle, setDuzenle] = useState(false);
  const [kopyala, setKopyala] = useState(false);
  const [silme, setSilme] = useState(false);
  const [pending, startTransition] = useTransition();
  const iptalli = offerStatusOf(offer.status) === "cancelled";

  function durumDegistir(hedef: "cancelled" | "draft") {
    startTransition(async () => {
      const res = await updateOfferStatus(offer.id, hedef);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(hedef === "cancelled" ? "Teklif iptal edildi." : "Teklif yeniden açıldı.");
    });
  }

  function sil() {
    startTransition(async () => {
      const res = await deleteOffer(offer.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Teklif silme talebi Yönetici onayına gönderildi.");
      setSilme(false);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Teklif eylemleri"
            aria-label="Teklif eylemleri"
            className="oc-tap-square inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDuzenle(true)}>
            <Pencil className="size-4" /> Düzenle
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setKopyala(true)}>
            <Copy className="size-4" /> Başka Müşteriye Kopyala
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {iptalli ? (
            <DropdownMenuItem disabled={pending} onSelect={() => durumDegistir("draft")}>
              <RotateCcw className="size-4" /> İptali Geri Al
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={pending} onSelect={() => durumDegistir("cancelled")}>
              <Ban className="size-4" /> İptal Et
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={pending}
            variant="destructive"
            onSelect={() => setSilme(true)}
          >
            <Trash2 className="size-4" /> Sil…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {duzenle ? (
        <EditOfferDialog offer={offer} customers={customers} onClose={() => setDuzenle(false)} />
      ) : null}

      {kopyala ? (
        <CopyOfferDialog offer={offer} customers={customers} onClose={() => setKopyala(false)} />
      ) : null}

      {/* SİLME BİR PENCEREYLE SORULUR, `confirm()` ile DEĞİL: cümle uzundur
          (ne siliniyor, kim onaylıyor, ne zaman gerçekleşiyor) ve tarayıcının
          kendi kutusu onu okunmaz bir blok hâlinde basar. */}
      <Dialog open={silme} onOpenChange={(o) => !o && setSilme(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Teklifi Sil</DialogTitle>
            <DialogDescription>
              <span className="font-mono">{offer.offer_no}</span> teklifi ve bütün revizyonları için{" "}
              <strong className="font-medium">kalıcı silme talebi</strong> oluşturulacak. Kayıt,
              Yönetici onaylayana kadar değişmeden kalır. Yayımlanmış revizyonu olan teklif
              silinemez — onu <span className="font-medium">İptal Et</span> ile kapatabilirsiniz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setSilme(false)}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={sil}>
              <Trash2 className="size-4" /> Silme Talebi Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
