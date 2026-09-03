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
  catalogSheetDownloadUrl,
  catalogSheetImages,
  catalogSheetPageUrl,
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

/**
 * Zum kademeleri. Eskiden yalnız iki kademe vardı — "sığdır" ve %180 — ve
 * telefonda ikisi de işe yaramıyordu: 375px'lik ekranda pencere gövdesi
 * ~311px, A4 bir taramanın %180'i bile sayfanın dörtte birini gösteriyor,
 * ölçü tablosu okunmuyordu. Pencere içinde parmakla yakınlaştırma da yoktur
 * (pencere `fixed`tir), tek kaldıraç kademelerdir.
 * `width` = null → kabın genişliğine sığdır.
 */
const ZOOM_LEVELS: readonly { width: string | null; next: string }[] = [
  { width: null, next: "Büyüt (%200)" },
  { width: "200%", next: "Daha büyüt (%400)" },
  { width: "400%", next: "Sayfaya sığdır" },
];

function SheetPages({ sheet, zoomWidth }: { sheet: CatalogSheet; zoomWidth: string | null }) {
  const images = catalogSheetImages(sheet);
  return (
    <div className="grid gap-4">
      {images.map((image, i) => (
        <figure key={image} className="grid gap-1.5">
          {images.length > 1 && (
            <figcaption className="oc-kicker text-muted-foreground">
              Sayfa {i + 1} / {images.length}
            </figcaption>
          )}
          {/* Katalog sayfası ölçü tablosu içerir: küçültülmüş hâli okunur
              olsun diye "sığdır" varsayılan, büyütme kademeleri yatay
              kaydırmalıdır.
              next/image KULLANILMAZ — kaynak kimlik doğrulamalı bir uçtur ve
              görüntü iyileştiricisinden geçirmenin faydası yoktur. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={catalogSheetUrl(image)}
            alt={`${sheet.title} — ${sheet.printedPages}`}
            className={cn(
              "h-auto border bg-white",
              zoomWidth ? "max-w-none" : "w-full"
            )}
            style={zoomWidth ? { width: zoomWidth } : undefined}
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
  inputRpm,
}: {
  kind: string;
  brand?: string | null;
  model?: string | null;
  /** Yılmaz H gibi aynı modeli birden çok n1 tablosunda basan kataloglar. */
  inputRpm?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(0);
  const level = ZOOM_LEVELS[zoom];

  // Bu ekipman türü için defterde hiç sayfa yoksa düğme hiç görünmez —
  // henüz kapsanmayan türlerde ölü bir düğme durmaz.
  if (!hasCatalogSheets(kind)) return null;

  const sheet = findCatalogSheet(kind, brand, model, { inputRpm });
  const images = sheet ? catalogSheetImages(sheet) : [];
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
        className="gap-1.5 text-xs"
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
        if (!next) setZoom(0);
      }}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        title={`${sheet.title} — ${sheet.source} ${sheet.printedPages}`}
        className="gap-1.5 text-xs"
      >
        <BookOpen className="size-3.5 text-primary" />
        Katalog Sayfası
      </Button>
      {/* DialogContent varsayılanı GRID'dir; içindeki `flex-1 min-h-0` gövde o
          düzende çalışmaz ve sayfa görüntüsü kırpılıp KAYDIRILAMAZ olur.
          Bu pencere sütun flex'e çevrilir: başlık sabit kalır, gövde kalan
          yüksekliği alır ve kendi içinde kayar. */}
      {/* `vh` mobilde adres çubuğu gizliyken ölçülür → pencerenin altı ekranın
          dışında kalıyordu. `sm:gap-0 sm:p-0`: taban `sm:p-6`/`sm:gap-6`
          taşıyor ve `p-0`/`gap-0` yalnız ön eksiz sınıfı eziyor. */}
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(64rem,calc(100%-2rem))] sm:gap-0 sm:p-0">
        {/* `px-*` tabanın `pr-8`ini siler (tailwind-merge); sarılan başlığın
            ilk satırı kapatma X'inin altına giriyordu. */}
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 sm:px-5 sm:py-3.5 sm:pr-14">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <BookOpen className="size-4 text-primary" />
            {sheet.title}
            <span className="border px-1.5 py-px font-mono text-[11px] tracking-wide text-muted-foreground">
              {model}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Kaynak: {sheet.source} · {sheet.printedPages} — sayfa katalogtan
            birebir alınmıştır, yeniden çizilmemiştir.
          </DialogDescription>
          {/* 375px'te üç düğme sarıp iki satıra taşıyor ve sayfa görüntüsüne
              kalan yüksekliği yiyordu; mobilde ikişerli ızgaraya oturur. */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 sm:flex sm:flex-wrap sm:items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom((z) => (z + 1) % ZOOM_LEVELS.length)}
              className="col-span-2 h-7 gap-1.5 text-xs sm:col-auto"
            >
              {zoom === ZOOM_LEVELS.length - 1 ? (
                <Minimize2 className="size-3.5" />
              ) : (
                <Maximize2 className="size-3.5" />
              )}
              {level.next}
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
              <a
                href={catalogSheetPageUrl(kind, brand, model!, "", { inputRpm })}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-3.5" />
                Yeni sekmede aç
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
              <a
                href={catalogSheetDownloadUrl(kind, brand, model!, "", { inputRpm })}
              >
                <Download className="size-3.5" />
                PDF indir ({images.length} sayfa)
              </a>
            </Button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-muted/30 p-2 sm:p-4">
          <SheetPages sheet={sheet} zoomWidth={level.width} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
