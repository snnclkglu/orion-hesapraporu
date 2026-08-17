"use client";

// YENİ TEKLİF — dört alanda açılır.
//
// Kullanıcı hedefi: *"Teklif bölümünde hızlı seçimlerle teklifi oluşturma."*
// Bu pencere teklifin TAMAMINI sormaz, yalnız DEĞİŞTİRİLEMEYECEK olanı sorar:
// müşteri (numaranın değil ama belgenin sahibi), konu, dil ve para birimi.
// Teknik içerik editörde kurulur; şablon seçimi orayı hazır getirir.
//
// MÜŞTERİ SEÇİCİSİ İŞ EMRİNDEN DEVRALINIR (`CustomerPicker`): defterden seçme
// ve akışı kesmeden yeni müşteri açma zaten orada çözülmüş. İkinci bir seçici
// yazmak, kısaltma ve renk kurallarını iki yerde yaşatmak olurdu.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS } from "@/lib/currency";
import { OFFER_LANGS_ACTIVE, OFFER_LANG_LABELS } from "@/lib/offers/lang";
import { adBuyuk } from "@/lib/tr-text";
import { createOffer } from "./actions";
import type { OfferTemplateRow } from "./data";

/** Şablonsuz teklif — Select boş string değere izin vermez. */
const NO_TEMPLATE = "__none__";

export function NewOfferButton({
  customers,
  templates,
}: {
  customers: readonly CustomerOption[];
  templates: readonly OfferTemplateRow[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [subject, setSubject] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [templateId, setTemplateId] = useState<string>(NO_TEMPLATE);
  const [currency, setCurrency] = useState<string>("EUR");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customer) {
      toast.error("Müşteri seçin ya da deftere yeni müşteri ekleyin.");
      return;
    }
    startTransition(async () => {
      const res = await createOffer({
        customerId: customer.id,
        subject,
        lang: "tr",
        currency: currency as (typeof CURRENCIES)[number],
        templateId: templateId === NO_TEMPLATE ? null : templateId,
        itemTitle,
      });
      // Başarıda action `redirect` eder ve buraya hiç dönmez.
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="oc-tap">
          <Plus className="size-4" /> Yeni Teklif
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Yeni Teklif</DialogTitle>
          <DialogDescription>
            Teklif numarası bugünün tarihinden üretilir. Teknik içerik bir
            sonraki adımda, teklif editöründe doldurulur.
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
            <Label htmlFor="offer_subject">Konu</Label>
            <Input
              id="offer_subject"
              value={subject}
              onChange={(e) => setSubject(adBuyuk(e.target.value))}
              required
              className="text-base pointer-fine:text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Teklifin kapağındaki &quot;Konu&quot; satırı ve dosya adı bundan gelir.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="offer_template">Şablon</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger id="offer_template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>Şablonsuz (boş teklif)</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="offer_item_title">İlk Kalemin Adı</Label>
              <Input
                id="offer_item_title"
                value={itemTitle}
                onChange={(e) => setItemTitle(adBuyuk(e.target.value))}
                className="text-base pointer-fine:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Boş bırakılırsa konu kullanılır.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="offer_currency">Para Birimi</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="offer_currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CURRENCY_SYMBOLS[c]} {CURRENCY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="offer_lang">Belge Dili</Label>
              {/*
                DİL SEÇİCİSİ BUGÜN TEK MADDELİDİR ve bu bilinçli: İngilizce
                belge henüz üretilmiyor. Yarım bir çeviri, yanlış bir belge
                demektir; alan şemada bugünden var çünkü teklif numarası
                (TETR/TEEN) ondan türer.
              */}
              <Select value="tr" disabled>
                <SelectTrigger id="offer_lang" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFER_LANGS_ACTIVE.map((l) => (
                    <SelectItem key={l} value={l}>
                      {OFFER_LANG_LABELS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending}>
              <Plus className="size-4" /> {pending ? "Açılıyor…" : "Teklifi Aç"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
