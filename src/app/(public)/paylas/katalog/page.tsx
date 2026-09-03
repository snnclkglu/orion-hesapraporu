import type { Metadata } from "next";
import { BookOpen, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  catalogSheetDownloadUrl,
  catalogSheetImages,
  catalogSheetUrl,
  findCatalogSheet,
} from "@/lib/catalog-sheets";

export const metadata: Metadata = {
  title: "Katalog Sayfası — ORION",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function PublicCatalogSheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? "";
  const kind = first(sp.tur);
  const brand = first(sp.marka);
  const model = first(sp.model);
  const inputRpmRaw = first(sp.n1);
  const inputRpm = inputRpmRaw !== "" ? Number(inputRpmRaw) : undefined;
  const sheet = kind && model
    ? findCatalogSheet(kind, brand || null, model, {
        inputRpm: Number.isFinite(inputRpm) ? inputRpm : undefined,
      })
    : undefined;

  if (!sheet) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-2xl place-content-center gap-3 px-5 py-16 text-center">
        <div className="oc-kicker text-muted-foreground">ORION CRANES</div>
        <h1 className="text-xl font-semibold tracking-tight">Katalog sayfası bulunamadı</h1>
        <p className="text-sm text-muted-foreground">
          Bağlantı eksik olabilir veya bu ürünün katalog sayfası artık paylaşılmıyor.
        </p>
      </main>
    );
  }
  const images = catalogSheetImages(sheet);

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-6xl content-start gap-4 px-3 py-4 sm:px-5 sm:py-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border bg-card px-4 py-3">
        <div className="min-w-0">
          <div className="oc-kicker text-muted-foreground">ORION CRANES · Katalog Sayfası</div>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            <BookOpen className="size-4 shrink-0 text-primary" />
            {sheet.title}
            <span className="border px-1.5 py-px font-mono text-xs tracking-wide text-muted-foreground">
              {model}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kaynak: {sheet.source} · {sheet.printedPages} — üretici katalog sayfası
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={catalogSheetDownloadUrl(kind, brand || null, model, "", { inputRpm })}>
              <Download className="size-3.5" />
              PDF indir ({images.length} sayfa)
            </a>
          </Button>
          <span className="border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
            Üyelik gerekmez
          </span>
        </div>
      </header>

      <p className="text-[11px] text-muted-foreground md:hidden">
        → Katalog sayfasını yana ve aşağı kaydırarak inceleyin.
      </p>
      <div className="grid gap-4">
        {images.map((image, index) => (
          <figure key={image} className="grid gap-1.5">
            {images.length > 1 && (
              <figcaption className="oc-kicker text-muted-foreground">
                Sayfa {index + 1} / {images.length}
              </figcaption>
            )}
            <div className="oc-scrollx overflow-auto overscroll-x-contain border bg-white [--oc-scroll-bg:#fff] md:overflow-visible">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={catalogSheetUrl(image)}
                alt={`${sheet.title} — ${sheet.printedPages}`}
                className="h-auto max-w-none md:w-full"
              />
            </div>
          </figure>
        ))}
      </div>
      <p className="border-t pt-3 text-xs text-muted-foreground">
        Bu bağlantı yalnız seçilen üretici katalog sayfasını gösterir; ORION iç uygulamasına erişim vermez.
      </p>
    </main>
  );
}
