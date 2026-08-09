// Katalog sayfası görüntüleyici — ekipman listesindeki (uygulama · Excel · PDF)
// ekipman adına tıklandığında açılan sayfa.
//
// Adres ÜRÜN KİMLİĞİNİ taşır (`?tur=coupling&marka=SIBRE&model=TE 250`),
// defterin iç kimliğini değil: `manifest.json` yeniden üretildiğinde sayfa
// kimlikleri değişebilir ama ürün kimliği değişmez — daha önce indirilmiş bir
// Excel'in bağlantısı ölü kalmaz.
//
// Sayfa görüntüleri `/api/catalog-sheet/...` ucundan gelir ve oturum ister;
// bu sayfa da (app) grubunda olduğu için oturumsuz erişimde girişe yönlenir.

import Link from "next/link";
import { BookOpen, Download, ExternalLink } from "lucide-react";
import { catalogSheetUrl, findCatalogSheet } from "@/lib/catalog-sheets";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Katalog Sayfası — ORION" };

export default async function CatalogSheetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const kind = first(sp.tur);
  const brand = first(sp.marka);
  const model = first(sp.model);

  const sheet = kind && model ? findCatalogSheet(kind, brand || null, model) : undefined;

  if (!sheet) {
    return (
      <div className="mx-auto grid max-w-2xl gap-3 py-16 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Katalog sayfası bulunamadı</h1>
        <p className="text-sm text-muted-foreground">
          {model
            ? `${[brand, model].filter(Boolean).join(" ")} için üretici katalog sayfası deftere eklenmemiş.`
            : "Adreste ürün bilgisi yok."}{" "}
          Katalog sayfaları yalnız kaynak PDF&apos;i elimizde olan ürünler için
          çıkarılmıştır.
        </p>
        <div>
          <Button asChild variant="outline" size="sm">
            <Link href="/projects">Projelere dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="oc-kicker text-muted-foreground">Katalog Sayfası</div>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">
            <BookOpen className="size-4 shrink-0 text-primary" />
            {sheet.title}
            <span className="border px-1.5 py-px font-mono text-[11px] tracking-wide text-muted-foreground">
              {model}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kaynak: {sheet.source} · {sheet.printedPages} — sayfa katalogtan
            birebir alınmıştır, yeniden çizilmemiştir.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <a href={catalogSheetUrl(sheet.images[0])} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" /> Görüntüyü aç
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <a
              href={catalogSheetUrl(sheet.images[0])}
              download={`${sheet.title} — ${sheet.printedPages}.webp`}
            >
              <Download className="size-3.5" /> İndir
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {sheet.images.map((image, i) => (
          <figure key={image} className="grid gap-1.5">
            {sheet.images.length > 1 && (
              <figcaption className="oc-kicker text-muted-foreground">
                Sayfa {i + 1} / {sheet.images.length}
              </figcaption>
            )}
            {/* next/image KULLANILMAZ — kaynak kimlik doğrulamalı bir uçtur ve
                görüntü iyileştiricisinden geçirmenin faydası yoktur. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={catalogSheetUrl(image)}
              alt={`${sheet.title} — ${sheet.printedPages}`}
              className="h-auto w-full border bg-white"
            />
          </figure>
        ))}
      </div>
    </div>
  );
}
