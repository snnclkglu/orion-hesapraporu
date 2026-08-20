"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "unpdf/pdfjs";
import { LoaderCircle, LockKeyhole, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

export function ProtectedPdfViewer({
  contentUrl,
  fileName,
}: {
  contentUrl: string;
  fileName: string;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(contentUrl, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "PDF açılamadı.");
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        const { getDocument } = await import("unpdf/pdfjs");
        // React development Strict Mode etkileri bir kez kurup söker. İlk
        // istek söküldükten sonra PDF.js işçisi başlatılırsa ikinci etkinin
        // kullandığı ortak işçiyi kapatıp yüklemeyi beklemede bırakabilir.
        if (!active) return;
        loadingTask = getDocument({ data: bytes });
        const loaded = await loadingTask.promise;
        if (active) setDocument(loaded);
        else await loadingTask.destroy();
      } catch (reason) {
        if (active && !(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(reason instanceof Error ? reason.message : "PDF açılamadı.");
        }
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
      if (loadingTask) void loadingTask.destroy();
    };
  }, [contentUrl]);

  // Tarayıcı menüsü ve geliştirici araçları mutlak bir DRM engeli değildir;
  // yine de sıradan Kaydet/Yazdır akışını görüntüleyici içinde kapatır.
  useEffect(() => {
    const preventSaveAndPrint = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["p", "s"].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", preventSaveAndPrint);
    return () => window.removeEventListener("keydown", preventSaveAndPrint);
  }, []);

  const pages = document
    ? Array.from({ length: document.numPages }, (_, index) => index + 1)
    : [];

  return (
    <>
      <p className="hidden border p-4 text-sm print:block">
        Bu teknik resim yalnız korumalı uygulama görüntüleyicisinde gösterilir.
      </p>
      <section className="min-w-0 border bg-card print:hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
          <span className="inline-flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="size-4 shrink-0" />
            <span className="truncate" title={fileName}>
              İndirme ve yazdırma kapalı · görüntü kişisel filigran taşır
            </span>
          </span>
          <span className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              disabled={zoom <= MIN_ZOOM}
              onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))}
              title="Uzaklaştır"
              aria-label="Uzaklaştır"
            >
              <ZoomOut className="size-4" />
            </Button>
            <span className="min-w-14 text-center font-mono text-[11px] text-muted-foreground">
              %{Math.round(zoom * 100)}
            </span>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              disabled={zoom >= MAX_ZOOM}
              onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))}
              title="Yakınlaştır"
              aria-label="Yakınlaştır"
            >
              <ZoomIn className="size-4" />
            </Button>
          </span>
        </header>

        <div
          ref={containerRef}
          onContextMenu={(event) => event.preventDefault()}
          className="oc-scrollx h-[calc(100dvh-13rem)] min-h-80 overflow-auto bg-muted/60 p-3 [--oc-scroll-bg:var(--muted)] sm:p-4"
        >
          {!document && !error && (
            <p className="flex min-h-56 items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" /> Güvenli kopya hazırlanıyor…
            </p>
          )}
          {error && (
            <p className="mx-auto mt-10 max-w-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </p>
          )}
          {document && width > 0 && (
            <div className="grid min-w-max justify-center gap-4">
              {pages.map((pageNumber) => (
                <PdfCanvas
                  key={pageNumber}
                  document={document}
                  pageNumber={pageNumber}
                  availableWidth={Math.max(280, width - 32)}
                  zoom={zoom}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function PdfCanvas({
  document,
  pageNumber,
  availableWidth,
  zoom,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  availableWidth: number;
  zoom: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let page: PDFPageProxy | null = null;
    let task: RenderTask | null = null;

    async function render() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setLoading(true);
      page = await document.getPage(pageNumber);
      const natural = page.getViewport({ scale: 1 });
      const cssScale = (availableWidth / natural.width) * zoom;
      const outputScale = Math.min(window.devicePixelRatio || 1, 1.75);
      const viewport = page.getViewport({ scale: cssScale });
      // PDF.js bazı paftalarda çizime başlamadan tuvali saydamlaştırır.
      // `alpha:false` saydamı SİYAH yapar; kâğıt zemin için varsayılan alpha
      // bağlamı + aşağıdaki beyaz dolgu birlikte korunur.
      const context = canvas.getContext("2d");
      if (!context || !active) return;

      canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
      canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      context.save();
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();
      task = page.render({
        canvas,
        canvasContext: context,
        viewport,
        // Sayfasında açık zemin boyamayan teknik PDF'ler alpha=false tuvalde
        // siyaha düşer; görüntüleyici kâğıt zeminini açıkça verir.
        background: "#ffffff",
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      });
      await task.promise;
      if (active) setLoading(false);
    }

    void render().catch((reason) => {
      if (active && reason instanceof Error && reason.name !== "RenderingCancelledException") {
        setLoading(false);
      }
    });
    return () => {
      active = false;
      task?.cancel();
      page?.cleanup();
    };
  }, [availableWidth, document, pageNumber, zoom]);

  return (
    <figure className="relative mx-auto border bg-white shadow-sm">
      {loading && (
        <span className="absolute inset-0 z-10 flex min-h-56 items-center justify-center bg-white text-xs text-slate-500">
          Sayfa {pageNumber} hazırlanıyor…
        </span>
      )}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`PDF sayfa ${pageNumber}`}
        className="block bg-white"
      />
      <figcaption className="absolute right-2 bottom-2 border bg-white/85 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
        {pageNumber}
      </figcaption>
    </figure>
  );
}
