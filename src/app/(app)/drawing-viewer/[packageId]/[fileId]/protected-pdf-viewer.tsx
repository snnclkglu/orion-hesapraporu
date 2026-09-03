"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "unpdf/pdfjs";
import {
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

export function ProtectedPdfViewer({
  contentUrl,
  fileName,
  notice = "İndirme ve yazdırma kapalı · görüntü kişisel filigran taşır",
  fillHeight = false,
}: {
  contentUrl: string;
  fileName: string;
  notice?: string;
  /** Dış paylaşım kabuğunda görüntüleyiciyi kalan ekran yüksekliğine yayar. */
  fillHeight?: boolean;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const viewerRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreen = nativeFullscreen || fallbackFullscreen;

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
          /*
           * SUNUCUNUN HAM GÖVDESİ EKRANA BASILMAZ.
           *
           * Önceki hâl `response.text()` sonucunu doğrudan hata mesajı yapıyordu:
           * müşteri "Belge bulunamadı" gibi bir iç metni ya da bir yığın izini
           * görüyor, ne olduğunu ve ne yapacağını anlamıyordu. En sık sebep
           * oturumun DÜŞMESİDİR (12 saat) — ve orada söylenmesi gereken şey
           * "yeniden giriş yapın"dır.
           */
          await response.text().catch(() => "");
          throw new Error(
            response.status === 401 || response.status === 403 || response.status === 404
              ? "Oturumunuz sona ermiş olabilir. Bu belgeyi görmek için yeniden giriş yapın."
              : "Belge şu anda açılamıyor. Birkaç saniye sonra yeniden deneyin."
          );
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

  useEffect(() => {
    const syncFullscreen = () => {
      setNativeFullscreen(globalThis.document.fullscreenElement === viewerRef.current);
    };
    globalThis.document.addEventListener("fullscreenchange", syncFullscreen);
    return () => globalThis.document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = globalThis.document.body.style.overflow;
    globalThis.document.body.style.overflow = "hidden";
    const closeFallback = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFallbackFullscreen(false);
    };
    globalThis.window.addEventListener("keydown", closeFallback);
    return () => {
      globalThis.document.body.style.overflow = previousOverflow;
      globalThis.window.removeEventListener("keydown", closeFallback);
    };
  }, [fullscreen]);

  async function toggleFullscreen() {
    const node = viewerRef.current;
    if (!node) return;

    if (fallbackFullscreen) {
      setFallbackFullscreen(false);
      return;
    }

    if (globalThis.document.fullscreenElement) {
      await globalThis.document.exitFullscreen();
      return;
    }

    try {
      await node.requestFullscreen();
    } catch {
      // Bazı tablet tarayıcıları belge dışındaki öğeler için Fullscreen API'yi
      // kapatır. Bu durumda görünür alanı kaplayan uygulama içi kip kullanılır.
      setFallbackFullscreen(true);
    }
  }

  /*
   * SAYFALAR TALEBE GÖRE ÇİZİLİR — HEPSİ BİRDEN DEĞİL.
   *
   * Önceki hâl `document.numPages` kadar tuvali AYNI ANDA basıyordu ve her
   * yakınlaştırmada hepsini yeniden çiziyordu. 140 sayfalık işletme-bakım
   * kılavuzu telefonda yüzlerce megabaytlık tuval demektir; sekme sessizce
   * çöküyordu. Artık yalnız görünen pencere ve komşuları çizilir; kaydırdıkça
   * pencere ilerler. Kapsayıcı yüksekliği korunur, o yüzden kaydırma çubuğu
   * ve sayfa konumu doğru kalır.
   */
  const pages = document
    ? Array.from({ length: document.numPages }, (_, index) => index + 1)
    : [];

  return (
    <>
      <p className="hidden border p-4 text-sm print:block">
        Bu teknik resim yalnız korumalı uygulama görüntüleyicisinde gösterilir.
      </p>
      <section
        ref={viewerRef}
        className={cn(
          "min-w-0 border bg-card print:hidden",
          fillHeight && "flex min-h-0 flex-col",
          fullscreen && "fixed inset-0 z-[100] flex h-dvh w-screen flex-col border-0"
        )}
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
          <span className="inline-flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="size-4 shrink-0" />
            <span className="truncate" title={fileName}>
              {notice}
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
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={() => void toggleFullscreen()}
              title={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
              aria-label={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
              aria-pressed={fullscreen}
            >
              {fullscreen ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </Button>
          </span>
        </header>

        <div
          ref={containerRef}
          onContextMenu={(event) => event.preventDefault()}
          className={cn(
            "oc-scrollx overflow-auto bg-muted/60 p-3 [--oc-scroll-bg:var(--muted)] sm:p-4",
            fillHeight || fullscreen
              ? "h-auto min-h-0 flex-1"
              : "h-[calc(100dvh-13rem)] min-h-80"
          )}
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
                <LazyPdfPage
                  key={pageNumber}
                  document={document}
                  pageNumber={pageNumber}
                  // 32px gövde dolgusu + 2px figure kenarlığı. Kenarlığı
                  // düşmemek tablette anlamsız, iki piksellik yatay kayma
                  // üretiyordu.
                  availableWidth={Math.max(280, width - 34)}
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

/**
 * Sayfayı yalnız görünür alana YAKLAŞTIĞINDA çizer.
 *
 * `IntersectionObserver` 600 px'lik bir payla bakar: kullanıcı kaydırmadan önce
 * bir sonraki sayfa hazır olur, ama uzaktaki 130 sayfa hiç çizilmez. Çizilmeden
 * önce sayfa, PDF'in kendi en-boy oranıyla YER TUTAR — yoksa kaydırma çubuğu
 * her sayfa geldiğinde zıplardı.
 */
function LazyPdfPage({
  document: pdfDocument,
  pageNumber,
  availableWidth,
  zoom,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  availableWidth: number;
  zoom: number;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [ratio, setRatio] = useState(1.414);

  useEffect(() => {
    let active = true;
    void pdfDocument.getPage(pageNumber).then((page) => {
      if (!active) return;
      const viewport = page.getViewport({ scale: 1 });
      if (viewport.width > 0) setRatio(viewport.height / viewport.width);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [pdfDocument, pageNumber]);

  useEffect(() => {
    const node = holderRef.current;
    if (!node) return;
    // Ortam gözlemciyi desteklemiyorsa (çok eski tarayıcı) hepsini çiz:
    // yavaş olması, hiç görünmemesinden iyidir.
    if (typeof IntersectionObserver === "undefined") {
      const timeout = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timeout);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting);
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const placeholderHeight = Math.round(availableWidth * zoom * ratio);

  return (
    <div ref={holderRef} style={visible ? undefined : { height: placeholderHeight }}>
      {visible ? (
        <PdfCanvas
          document={pdfDocument}
          pageNumber={pageNumber}
          availableWidth={availableWidth}
          zoom={zoom}
        />
      ) : (
        <div
          aria-hidden
          className="grid h-full place-items-center border bg-muted/30 text-xs text-muted-foreground"
        >
          {pageNumber}
        </div>
      )}
    </div>
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
