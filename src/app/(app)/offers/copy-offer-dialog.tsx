"use client";

// TEKLİFİ BAŞKA MÜŞTERİYE KOPYALA.
//
// Kullanıcı isteği (17.08.2026): *"Benzer bir işi başka müşteri isterse hemen
// ona kopyalayıp değiştirebileyim."*
//
// KOPYA YENİ BİR TEKLİFTİR: kendi numarası, kendi revizyon zinciri. Kaynak
// teklifin bir revizyonu OLSAYDI iki müşterinin belgesi tek geçmişte sürer ve
// birine yapılan düzeltme ötekinin arşivini de değiştirirdi.
//
// MUHATAP BİLGİLERİ TAŞINMAZ (`copyPayloadForCustomer`): eski firmanın satın
// alma müdürünün adı ve onun kendi talep numarası yeni teklifte görünmemelidir.
// Bu, fark edilmesi en zor hatadır çünkü belge geri kalan her yerinde doğrudur.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { CustomerPicker } from "@/app/(app)/jobs/customer-picker";
import type { CustomerOption } from "@/app/(app)/jobs/schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adBuyuk } from "@/lib/tr-text";
import { copyOfferToCustomer } from "./actions";

export interface CopyableOffer {
  id: string;
  offer_no: string;
  subject: string;
  customer_name: string;
}

export function CopyOfferButton({
  offer,
  customers,
  variant = "ikon",
}: {
  offer: CopyableOffer;
  customers: readonly CustomerOption[];
  /** `ikon` liste satırında, `dugme` teklif panelinde kullanılır. */
  variant?: "ikon" | "dugme";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "ikon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Başka müşteriye kopyala"
          aria-label="Başka müşteriye kopyala"
          className="oc-tap-square inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Copy className="size-4" />
        </button>
      ) : (
        <Button type="button" variant="outline" className="oc-tap" onClick={() => setOpen(true)}>
          <Copy className="size-4" /> Başka Müşteriye Kopyala
        </Button>
      )}

      {open ? (
        <CopyOfferDialog
          offer={offer}
          customers={customers}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function CopyOfferDialog({
  offer,
  customers,
  onClose,
}: {
  offer: CopyableOffer;
  customers: readonly CustomerOption[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  // Konu KAYNAKTAN GELİR ve düzenlenebilir: kopyalamanın sebebi "benzer bir
  // iş"tir, konunun çoğu zaten aynıdır ve sıfırdan yazdırmak boşuna bir adım
  // olurdu. Müşteri adı konuya girmişse kullanıcı orada düzeltir.
  const [subject, setSubject] = useState(offer.subject);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customer) {
      toast.error("Kopyanın hangi müşteriye açılacağını seçin.");
      return;
    }
    startTransition(async () => {
      const res = await copyOfferToCustomer({
        sourceOfferId: offer.id,
        customerId: customer.id,
        subject,
      });
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Başka Müşteriye Kopyala</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{offer.offer_no}</span> teklifinin GÜNCEL
            revizyonu yeni bir teklif olarak kopyalanır. Teknik içerik ve
            fiyatlar taşınır; muhatap bilgileri ve müşteri referansı boş kalır.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-3">
          <CustomerPicker
            customers={[...customers]}
            value={customer?.id ?? null}
            currentName={customer?.name ?? ""}
            onPick={setCustomer}
          />

          <div className="grid gap-1.5">
            <Label htmlFor="copy_subject">Konu</Label>
            <Input
              id="copy_subject"
              value={subject}
              onChange={(e) => setSubject(adBuyuk(e.target.value))}
              required
              className="text-base pointer-fine:text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              <Copy className="size-4" /> {pending ? "Kopyalanıyor…" : "Kopyala ve Aç"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
