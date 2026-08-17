"use client";

// BEKLENEN İŞ PENCERESİ — henüz verilmemiş ama verileceği bilinen iş.
//
// Kullanıcı isteği (17.08.2026): *"ben yakında hızlıca verebileceğim teklifi
// kısa bir satır olarak buraya ekleyebileyim. Henüz o teklifi vermemiş
// olabilirim ama vereceğimi biliyor oluyor bazı durumlarda."*
//
// FORM KISADIR ve bu bilinçlidir: kayıt bir NİYETTİR, bir belge değil. Teklif
// açmanın kendi ekranı var; burada sorulan altı şey "kim, ne, ne zaman, ne
// kadar, ne kadar yakın, not"tur. Zorunlu olan yalnız müşteri ve konudur —
// gerisi bilinmiyorsa BOŞ kalır, `0` ya da bugünün tarihi varsayılmaz
// (değişmez md. 4).
//
// MÜŞTERİ İKİ YOLDAN GELİR: defterden (`CustomerPicker`, iş emrinden
// devralınır) ya da serbest metin. Serbest metin teklifin kendisinde YASAKTIR
// (IS-14) ama beklenen iş çoğu zaman bir telefon görüşmesidir ve firmayı
// deftere yazacak bilgi henüz yoktur; gevşeme migration'da da gerekçelidir.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { CustomerPicker } from "@/app/(app)/jobs/customer-picker";
import type { CustomerOption } from "@/app/(app)/offers/data";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TAM_BOY_PENCERE } from "@/components/pencere";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  currencyOf,
  parseNum,
  type Currency,
} from "@/lib/currency";
import { scoreHue, scoreLabel, type AnalizSatiri } from "@/lib/offers/analiz";
import { tagStyle } from "@/lib/tags";
import { adBuyuk } from "@/lib/tr-text";
import { cn } from "@/lib/utils";
import { createLead, deleteLead, updateLead } from "./actions";

/**
 * Ekrandaki satır — çekirdeğin `AnalizSatiri`si + YALNIZ DÜZENLEME İÇİN gereken
 * iki alan.
 *
 * `notes` ve `customerId` çekirdekte YOKTUR ve olmamalıdır: projeksiyon
 * matematiği ikisini de okumaz. Burada dururlar çünkü satır içi puan değişimi
 * beklenen işin TAMAMINI yazar (`updateLead`) — eksik alanla çağırmak, notu ve
 * defter bağını sessizce silerdi.
 */
export interface AnalizSatiriDetay extends AnalizSatiri {
  customerId: string | null;
  notes: string;
}

/** `Select` boş dizeyi değer olarak kabul etmez; puansızlık ayrı bir anahtardır. */
export const PUANSIZ = "__puansiz__";

export const PUANLAR = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

/**
 * PUAN SEÇİCİ — 1–10, satır içinde de pencerede de aynı bileşen.
 *
 * Rozetin rengi `scoreHue`dan gelir (soğuk mavi → sıcak kırmızı); doygunluk ve
 * parlaklık `.oc-tag` kuralında, tema başına verilir. PUANSIZ SEÇENEK RENKSİZDİR
 * ve "—" ile yazılır: uydurma bir orta ton, verilmemiş bir kararı verilmiş gibi
 * gösterirdi.
 *
 * Renk TEK TAŞIYICI DEĞİLDİR: rozetin içinde sayı, listede ayrıca sözel
 * karşılığı ("Çok yakın") yazar.
 */
export function PuanSecici({
  score,
  onChange,
  disabled,
  className,
}: {
  score: number | null;
  onChange: (score: number | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const hue = scoreHue(score);
  return (
    <Select
      value={score === null ? PUANSIZ : String(score)}
      onValueChange={(v) => onChange(v === PUANSIZ ? null : Number(v))}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label="Kazanma puanı"
        title={`Kazanma yakınlığı: ${scoreLabel(score)}`}
        className={cn("w-full min-w-0 justify-between", className)}
      >
        {/* `SelectValue` yerine denetimli değerin kendisi basılır: rozetin
            rengi puana bağlıdır ve Radix'in seçili öğeyi kopyalaması bu stili
            taşımıyordu. */}
        {hue === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className="oc-tag px-1.5 py-0.5 font-mono text-xs font-medium"
            style={tagStyle(hue)}
          >
            {score}
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={PUANSIZ}>
          <span className="text-muted-foreground">— Puansız</span>
        </SelectItem>
        {PUANLAR.map((p) => (
          <SelectItem key={p} value={String(p)}>
            <span className="flex items-center gap-2">
              <span
                className="oc-tag px-1.5 py-0.5 font-mono text-xs font-medium"
                style={tagStyle(scoreHue(p) as number)}
              >
                {p}
              </span>
              <span className="text-muted-foreground">{scoreLabel(p)}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Sayı METİN olarak tutulur: her tuş vuruşunda sayıya çevrilseydi kullanıcı
 *  "1.250.000,5" yazarken imleç ve ondalık virgül kaybolurdu (sale-dialog'un
 *  dersi). */
function sayiMetni(v: number | null): string {
  return v === null || v === undefined ? "" : String(v).replace(".", ",");
}

function Alan({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function LeadDialog({
  satir,
  customers,
  open,
  onOpenChange,
}: {
  /** `null` = yeni kayıt. Düzenleme ve silme aynı penceredendir. */
  satir: AnalizSatiriDetay | null;
  customers: readonly CustomerOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Alanlar yalnız başlangıç değerinden dolar; senkronize eden bir efekt
  // YOKTUR — pencere satır seçilince monte edilir, kapanınca sökülür.
  const [customerId, setCustomerId] = useState<string | null>(satir?.customerId ?? null);
  const [customerName, setCustomerName] = useState(satir?.customerName ?? "");
  const [subject, setSubject] = useState(satir?.subject ?? "");
  const [expectedOn, setExpectedOn] = useState(satir?.expectedOn ?? "");
  const [amount, setAmount] = useState(sayiMetni(satir?.amount ?? null));
  const [currency, setCurrency] = useState<Currency>(currencyOf(satir?.currency));
  const [score, setScore] = useState<number | null>(satir?.score ?? null);
  const [notes, setNotes] = useState(satir?.notes ?? "");

  const duzenleme = satir !== null;

  function kaydet() {
    const girdi = {
      customerId,
      customerName: customerName.trim(),
      subject: subject.trim(),
      // BOŞ TARİH `null`DIR, bugünün tarihi değil: tarihi bilinmeyen bir işi
      // bir döneme yerleştirmek projeksiyonu uydurulmuş bir varsayımla
      // şişirirdi (çekirdeğin `pencereyeGirer` kuralı).
      expectedOn: expectedOn || null,
      amount: parseNum(amount),
      currency,
      winScore: score,
      notes: notes.trim(),
      active: satir?.active ?? true,
    };
    startTransition(async () => {
      const res = duzenleme ? await updateLead(satir.id, girdi) : await createLead(girdi);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(duzenleme ? "Beklenen iş güncellendi." : "Beklenen iş eklendi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  function sil() {
    if (!satir) return;
    if (
      !window.confirm(
        `"${satir.subject || satir.customerName}" beklenen iş kaydı silinecek. Devam edilsin mi?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteLead(satir.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Beklenen iş silindi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${TAM_BOY_PENCERE} sm:max-w-[min(38rem,calc(100%-2rem))]`}>
        <DialogHeader>
          <DialogTitle>{duzenleme ? "Beklenen İşi Düzenle" : "Beklenen İş Ekle"}</DialogTitle>
          <DialogDescription>
            Henüz teklif verilmemiş ama verileceği bilinen iş. Projeksiyona
            teklifler gibi girer; teklife dönüştüğünde bu satır düşer.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3">
            {/* `currentName` BOŞ GEÇİLİR: seçicinin "deftere bağlı değil"
                uyarısı iş emri içindir ve burada YANLIŞ olurdu — defterde
                olmayan firma bu ekranda meşru bir kayıttır. */}
            <CustomerPicker
              customers={[...customers]}
              value={customerId}
              currentName=""
              onPick={(c) => {
                setCustomerId(c?.id ?? null);
                if (c) setCustomerName(adBuyuk(c.name));
              }}
            />
            <Alan
              label="Defterde Olmayan Firma"
              hint="Firma henüz defterde değilse adını buraya yazın; listeden seçim yaparsanız bu alan defterdeki adla dolar."
            >
              <Input
                value={customerName}
                onChange={(e) => {
                  setCustomerName(adBuyuk(e.target.value));
                  // Elle yazılan ad defter bağını KOPARIR: iki kaynak birden
                  // dolu kalsaydı hangisinin geçerli olduğu belirsizleşirdi.
                  setCustomerId(null);
                }}
              />
            </Alan>
          </div>

          <Alan label="Konu">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
          </Alan>

          <div className="grid gap-3 sm:grid-cols-2">
            <Alan label="Beklenen Tarih" hint="Kararın beklendiği gün — dönem bundan okunur.">
              <Input
                type="date"
                value={expectedOn}
                onChange={(e) => setExpectedOn(e.target.value)}
                className="font-mono"
              />
            </Alan>
            <Alan label="Kazanma Puanı" hint={`1–10 · ${scoreLabel(score)}`}>
              <PuanSecici score={score} onChange={setScore} className="h-10" />
            </Alan>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Alan label="Tutar">
              {/* YER TUTUCU YOK (değişmez md. 5): grileşmiş bir örnek sayı
                  girilmiş bir değer sanılıyordu. */}
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono tabular-nums"
              />
            </Alan>
            <Alan label="Para Birimi">
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="w-full">
                  <span>
                    {CURRENCY_SYMBOLS[currency]} {CURRENCY_LABELS[currency]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CURRENCY_SYMBOLS[c]} {CURRENCY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Alan>
          </div>

          <Alan label="Not">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Alan>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {duzenleme && (
              <Button type="button" variant="ghost" onClick={sil} disabled={pending}>
                <Trash2 className="size-3.5" /> Sil
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={kaydet} disabled={pending}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
