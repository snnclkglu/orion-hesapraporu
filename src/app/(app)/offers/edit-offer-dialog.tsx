"use client";

// TEKLİF KÜNYESİNİ LİSTE SATIRINDAN DÜZENLEME.
//
// Bu pencere revizyon gövdesine dokunmaz: müşteri, konu, durum ve para birimi
// teklifin kendisine aittir. Teknik özellikler ile fiyat satırları revizyon
// editöründe kalır; iki ayrı sahiplik tek formda karıştırılmaz.

import { useState, useTransition } from "react";
import { Pencil, Save } from "lucide-react";
import { toast } from "sonner";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS, type Currency } from "@/lib/currency";
import { OFFER_STATUSES, offerStatusLabel, type OfferStatus } from "@/lib/offers/status";
import { adBuyuk } from "@/lib/tr-text";
import { updateOfferDetails } from "./actions";

export interface EditableOffer {
  id: string;
  offer_no: string;
  subject: string;
  customer_name: string;
  customerId: string | null;
  status: string | null;
  currency: string;
  wonOn?: string | null;
}

export function EditOfferDialog({
  offer,
  customers,
  onClose,
}: {
  offer: EditableOffer;
  customers: readonly CustomerOption[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<CustomerOption | null>(
    customers.find((c) => c.id === offer.customerId) ?? null
  );
  const [subject, setSubject] = useState(offer.subject);
  const [status, setStatus] = useState<OfferStatus>(
    OFFER_STATUSES.includes(offer.status as OfferStatus) ? (offer.status as OfferStatus) : "draft"
  );
  const [currency, setCurrency] = useState<Currency>(
    CURRENCIES.includes(offer.currency as Currency) ? (offer.currency as Currency) : "EUR"
  );
  const [wonOn, setWonOn] = useState<string | null>(offer.wonOn ?? null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customer) {
      toast.error("Müşteri seçin ya da deftere yeni müşteri ekleyin.");
      return;
    }
    startTransition(async () => {
      const res = await updateOfferDetails(offer.id, {
        customerId: customer.id,
        subject,
        status,
        currency,
        wonOn: status === "won" ? wonOn : null,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Teklif bilgileri güncellendi.");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" /> Teklifi Düzenle
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono">{offer.offer_no}</span> teklifinin müşteri ve künye
            bilgilerini değiştirir. Teknik kalemler ile fiyat satırları kendi revizyonunda kalır.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-3">
          <CustomerPicker
            customers={[...customers]}
            value={customer?.id ?? null}
            currentName={customer?.name ?? offer.customer_name}
            onPick={setCustomer}
          />

          <div className="grid gap-1.5">
            <Label htmlFor={`edit_offer_subject_${offer.id}`}>Konu</Label>
            <Input
              id={`edit_offer_subject_${offer.id}`}
              value={subject}
              onChange={(e) => setSubject(adBuyuk(e.target.value))}
              required
              className="text-base pointer-fine:text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`edit_offer_status_${offer.id}`}>Durum</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  const next = value as OfferStatus;
                  setStatus(next);
                  // Tarih yalnız kullanıcı `Kazanıldı`yı seçtiği ANDA önerilir;
                  // eski tarihsiz kayıt pencere açılışında sessizce bugüne taşınmaz.
                  if (next === "won" && !wonOn) setWonOn(new Date().toISOString().slice(0, 10));
                }}
              >
                <SelectTrigger id={`edit_offer_status_${offer.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFER_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {offerStatusLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor={`edit_offer_currency_${offer.id}`}>Para Birimi</Label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
                <SelectTrigger id={`edit_offer_currency_${offer.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CURRENCY_SYMBOLS[value]} {CURRENCY_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {status === "won" ? (
            <div className="grid gap-1.5 sm:max-w-[calc(50%-0.375rem)]">
              <Label htmlFor={`edit_offer_won_on_${offer.id}`}>Kazanılma Tarihi</Label>
              <Input
                id={`edit_offer_won_on_${offer.id}`}
                type="date"
                value={wonOn ?? ""}
                onChange={(e) => setWonOn(e.target.value || null)}
                className="font-mono text-base pointer-fine:text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Kazanılan İşler grafiği bu günü kullanır. Bilinmiyorsa boş bırakabilirsiniz.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              <Save className="size-4" /> {pending ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
