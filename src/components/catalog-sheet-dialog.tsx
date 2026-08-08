"use client";

// "Katalog Sayfası" — seçilen ürünün ÜRETİCİ KATALOĞUNDAKİ GERÇEK sayfasını
// pop-up olarak gösterir.
//
// Gösterilen şey sayfanın benzeri değil, kaynak PDF'ten kesilmiş sayfanın
// kendisidir (bkz. `scripts/catalog-sheets.py`). Pencerede sayfanın görüntüsü
// açılır; başlıktaki düğmelerle sayfanın PDF'i yeni sekmede açılabilir ya da
// indirilebilir (teklife/dosyaya eklenmek üzere).
//
// Düğme, katalog seçiminin YANINDA durur ve ürün seçilene kadar pasiftir —
// hangi sayfanın açılacağı seçilen modele bağlıdır.

import { useState } from "react";
import { BookOpen, Download, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import {
  catalogSheetUrl,
  findCatalogSheet,
  hasCatalogSheets,
  type CatalogSheet,
} from "@/lib/catalog-sheets";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function SheetPages({ sheet, zoomed }: { sheet: CatalogSheet; zoomed: boolean }) {
  return (
    <div className="grid gap-4">
      {sheet.images.map((image, i) => (
        <figure key={image} className="grid gap-1.5">
          {sheet.images.length > 1 && (
            <figcaption className="oc-kicker text-muted-foreground">
              Sayfa {i + 1} / {sheet.images.length}
            </figcaption>
          )}
          {/* Katalog sayfası ölçü tablosu içerir: küçültülmüş hâli okunur
              olsun diye "sığdır" varsayılan, "büyüt" yatay kaydırmalıdır.
              next/image KULLANILMAZ — kaynak kimlik doğrulamalı bir uçtur ve
              görüntü iyileştiricisinden geçirmenin faydası yoktur. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={catalogSheetUrl(image)}
            alt={`${sheet.title} — ${sheet.printedPages}`}
            className={cn(
              "h-auto border bg-white",
              zoomed ? "max-w-none" : "w-full"
            )}
            style={zoomed ? { width: "180%" } : undefined}
          />
        </figure>
      ))}
    </div>
  );
}

export function CatalogSheetButton({
  kind,
  brand,
  model,
}: {
  kind: string;
  brand?: string | null;
  model?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  // Bu ekipman türü için defterde hiç sayfa yoksa düğme hiç görünmez —
  // henüz kapsanmayan türlerde ölü bir düğme durmaz.
  if (!hasCatalogSheets(kind)) return null;

  const sheet = findCatalogSheet(kind, brand, model);
  const reason = !model
    ? "Önce katalogdan bir ürün seçin"
    : !sheet
      ? `${brand ?? ""} ${model} için katalog sayfası deftere eklenmemiş`.trim()
      : undefined;

  if (!sheet) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        title={reason}
        className="h-7 gap-1.5 text-xs"
      >
        <BookOpen className="size-3.5" />
        Katalog Sayfası
      </Button>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setZoomed(false);
      }}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        title={`${sheet.title} — ${sheet.source} ${sheet.printedPages}`}
        className="h-7 gap-1.5 text-xs"
      >
        <BookOpen className="size-3.5 text-primary" />
        Katalog Sayfası
      </Button>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-5 py-3.5">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <BookOpen className="size-4 text-primary" />
            {sheet.title}
            <span className="border px-1.5 py-px font-mono text-[10px] tracking-wide text-muted-foreground">
              {model}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Kaynak: {sheet.source} · {sheet.printedPages} — sayfa katalogtan
            birebir alınmıştır, yeniden çizilmemiştir.
          </DialogDescription>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoomed((z) => !z)}
              className="h-7 gap-1.5 text-xs"
            >
              {zoomed ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              {zoomed ? "Sayfaya sığdır" : "Büyüt"}
            </Button>
            <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <a href={catalogSheetUrl(sheet.pdf)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
                PDF&apos;i yeni sekmede aç
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <a href={catalogSheetUrl(sheet.pdf)} download>
                <Download className="size-3.5" />
                İndir
              </a>
            </Button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
          <SheetPages sheet={sheet} zoomed={zoomed} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
