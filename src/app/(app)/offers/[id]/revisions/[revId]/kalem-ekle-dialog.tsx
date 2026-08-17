"use client";

// YENİ KALEM SİHİRBAZI — önce vinç tipi, sonra bölümler.
//
// Kullanıcı bildirimi (17.08.2026): *"Kalem ekle deyip yeni vinç eklediğimde
// bölümler otomatik gelmedi. Şöyle olsun: Kalem ekle dediğinde hangi tür vinç
// ekleyeceğini sorsun ve bölümleri ona göre gelsin. Ayrıca o işte ilk yapılan
// vincin özellikleri ön tanımlı seçili olarak gelsin."*
//
// Boş bir kalem eklemek, kullanıcıya sekiz bölümü tek tek kurdurmak demekti.
// Şablon zaten teklif AÇILIRKEN sorulan şeydir; ikinci kalemde de aynı soruyu
// sormak hem tutarlı hem hızlıdır.

import { useState } from "react";
import { Check, Plus } from "lucide-react";
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
import { copySelections, emptyItem } from "@/lib/offers/payload";
import { OFFER_GROUP_DEF_BY_KEY } from "@/lib/offers/registry";
import type { OfferItem } from "@/lib/offers/types";
import { adBuyuk } from "@/lib/tr-text";
import { cn } from "@/lib/utils";
import type { OfferTemplateRow } from "@/app/(app)/offers/data";

export function KalemEkleDialog({
  templates,
  kaynak,
  onClose,
  onEkle,
}: {
  templates: readonly OfferTemplateRow[];
  /** Teklifin İLK kalemi — tercihleri buradan kopyalanır. */
  kaynak: OfferItem | undefined;
  onClose: () => void;
  onEkle: (item: OfferItem) => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [baslik, setBaslik] = useState("");
  const [seciminiKopyala, setSeciminiKopyala] = useState(true);

  const sablon = templates.find((t) => t.id === templateId);
  const gruplar = sablon?.skeleton?.groupKeys ?? [];

  function ekle() {
    let item = emptyItem(baslik, gruplar.length ? gruplar : ["general"]);
    item.craneType = sablon?.crane_type ?? "";
    // SEÇİM TAŞINIR, ÖLÇÜ TAŞINMAZ (`copySelections`): marka tercihleri bir
    // teklifin tamamında aynıdır, kapasite ve güçler her vince özeldir.
    if (kaynak && seciminiKopyala) item = copySelections(kaynak, item);
    onEkle(item);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kalem Ekle</DialogTitle>
          <DialogDescription>
            Vinç tipini seçin; teknik bölümler ona göre kurulur.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="yeni_kalem_sablon">Vinç Tipi / Şablon</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="yeni_kalem_sablon" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {gruplar.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Kurulacak bölümler:{" "}
                {gruplar.map((k) => OFFER_GROUP_DEF_BY_KEY[k]?.title ?? k).join(" · ")}
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="yeni_kalem_baslik">Kalem Başlığı</Label>
            <Input
              id="yeni_kalem_baslik"
              value={baslik}
              onChange={(e) => setBaslik(adBuyuk(e.target.value))}
              className="text-base pointer-fine:text-sm"
            />
          </div>

          {kaynak ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={seciminiKopyala}
              onClick={() => setSeciminiKopyala((v) => !v)}
              className="oc-tap flex items-start gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-muted"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border",
                  seciminiKopyala
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40"
                )}
              >
                {seciminiKopyala ? <Check className="size-3" /> : null}
              </span>
              <span>
                İlk kalemin <span className="font-medium">marka ve tercihlerini</span> kopyala
                <span className="block text-xs text-muted-foreground">
                  Kapasite, açıklık, güç, devir, çap ve adet gibi ölçüler kopyalanmaz —
                  onlar her vince özeldir.
                </span>
              </span>
            </button>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="button" onClick={ekle} disabled={!sablon}>
            <Plus className="size-4" /> Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
