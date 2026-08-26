"use client";

// YENİ TEKLİF — üç alanda açılır.
//
// Kullanıcı hedefi: *"Teklif bölümünde hızlı seçimlerle teklifi oluşturma."*
// Bu pencere teklifin TAMAMINI sormaz, yalnız BELGEYE ait olanı sorar: müşteri,
// konu, dil ve para birimi. Teknik içerik editörde kurulur ve ŞABLON ARTIK
// BURADA SORULMAZ — bir teklifte birden çok vinç tipi olabiliyor, o yüzden
// şablon KALEMİN sorusudur (TEKLIF-32).
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

export function NewOfferButton({ customers }: { customers: readonly CustomerOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [subject, setSubject] = useState("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [issuerCustomerId, setIssuerCustomerId] = useState<string>("__orion__");

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
        issuerCustomerId: issuerCustomerId === "__orion__" ? null : issuerCustomerId,
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
            <Label htmlFor="offer_issuer">Teklifi Hazırlayan Firma</Label>
            <Select value={issuerCustomerId} onValueChange={setIssuerCustomerId}>
              <SelectTrigger id="offer_issuer" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__orion__">ORION VİNÇ (Standart)</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Partner seçilirse PDF logosu ve firma künyesi Yönetim → Müşteriler
              defterindeki bilgilerden hazırlanır.
            </p>
          </div>

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

          {/*
            NE KALEMİN ADI NE ŞABLON BURADA SORULUR.
            · Ad (17.08.2026): *"girdiğim teklif konusu ekleyeceğim vinç ile aynı
              olmayabilir; konu kapak bölümüne gelsin"* — konu BELGENİN adıdır.
            · Şablon (17.08.2026): *"şablon seçimini teklifi oluştururken değil de
              kalem eklerken yapsak daha iyi olur … çünkü bir teklif içerisinde
              hem tek kirişli hem çift kirişli hem portal olabilir; 3 4 farklı
              şablon kullanmak gerekebilir."*
            Teklif KALEMSİZ açılır; her kalem kendi şablonuyla eklenir.
          */}
          <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            Teklif boş açılır. Teknik kalemleri editördeki{" "}
            <span className="font-medium">Kalem Ekle</span> ile eklersiniz; şablon (vinç
            tipi) orada kalem kalem seçilir.
          </p>

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
