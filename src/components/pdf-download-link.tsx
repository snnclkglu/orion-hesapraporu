"use client";

import { forwardRef, useState } from "react";
import type {
  AnchorHTMLAttributes,
  FormHTMLAttributes,
  MouseEvent,
  SubmitEvent,
} from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fileNameFromDisposition } from "@/lib/file-download";

export interface PdfDownloadLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  /** Başlıkta dosya adı gelmezse kullanılacak ad. */
  fallbackFileName?: string;
  /** Telefonun paylaşım sayfasında görünen kısa başlık. */
  shareTitle?: string;
  disabled?: boolean;
}

/**
 * MOBİL PDF İNDİRME.
 *
 * Düz `<a>` bağlantısı iOS/Android'de `Content-Disposition: attachment` olsa
 * bile PDF görüntüleyicisini açabiliyor. Bu bağlantı aynı uçtan dosya baytını
 * alır, gerçek `.pdf` dosyası olarak İndirilenler/Dosyalar'a bırakır ve dosya
 * paylaşımını gerçekten destekleyen cihazlarda bildirim üzerinde “PDF Paylaş”
 * sunar. Yalnız `navigator.share` bulunması yeterli sayılmaz: bazı mobil web
 * görünümleri dosyayı yok sayıp sayfa bağlantısını paylaşır.
 *
 * `href` yine gerçek bağlantıdır: JavaScript yüklenmezse sunucunun attachment
 * davranışı çalışır. Ctrl/Cmd tıklaması da tarayıcının doğal davranışına
 * bırakılır; yalnız olağan birincil tıklama yakalanır.
 */
export const PdfDownloadLink = forwardRef<HTMLAnchorElement, PdfDownloadLinkProps>(
  function PdfDownloadLink(
    {
      href,
      fallbackFileName = "belge.pdf",
      shareTitle,
      disabled = false,
      className,
      children,
      onClick,
      ...props
    },
    ref
  ) {
    const [busy, setBusy] = useState(false);

    async function downloadPdf(event: MouseEvent<HTMLAnchorElement>) {
      onClick?.(event);
      if (event.defaultPrevented) return;
      if (
        disabled ||
        busy ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        if (disabled || busy) event.preventDefault();
        return;
      }

      event.preventDefault();
      setBusy(true);
      try {
        await downloadPdfFromApp(href, { fallbackFileName, shareTitle });
      } finally {
        setBusy(false);
      }
    }

    return (
      <a
        {...props}
        ref={ref}
        href={disabled ? undefined : href}
        download=""
        aria-disabled={disabled || undefined}
        aria-busy={busy || undefined}
        onClick={downloadPdf}
        className={cn(busy && "pointer-events-none opacity-60", className)}
      >
        {children}
      </a>
    );
  }
);

export interface PdfDownloadFormProps
  extends Omit<FormHTMLAttributes<HTMLFormElement>, "action"> {
  action: string;
  fallbackFileName?: string;
  shareTitle?: string;
}

/** POST ile üretilen, ekrandaki süzgeci taşıyan PDF çıktılarının mobil eşi. */
export const PdfDownloadForm = forwardRef<HTMLFormElement, PdfDownloadFormProps>(
  function PdfDownloadForm(
    {
      action,
      method = "GET",
      fallbackFileName,
      shareTitle,
      className,
      children,
      onSubmit,
      ...props
    },
    ref
  ) {
    const [busy, setBusy] = useState(false);

    async function submit(event: SubmitEvent<HTMLFormElement>) {
      onSubmit?.(event);
      if (event.defaultPrevented || busy) return;

      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const verb = String(method).toUpperCase();
      let href = action;
      let requestInit: RequestInit | undefined;

      if (verb === "GET") {
        const params = new URLSearchParams();
        formData.forEach((value, key) => params.append(key, String(value)));
        href += `${href.includes("?") ? "&" : "?"}${params.toString()}`;
      } else {
        requestInit = { method: verb, body: formData };
      }

      setBusy(true);
      try {
        await downloadPdfFromApp(href, { fallbackFileName, shareTitle, requestInit });
      } finally {
        setBusy(false);
      }
    }

    return (
      <form
        {...props}
        ref={ref}
        action={action}
        method={method}
        aria-busy={busy || undefined}
        onSubmit={submit}
        className={cn(busy && "pointer-events-none opacity-60", className)}
      >
        {children}
      </form>
    );
  }
);

export async function downloadPdfFromApp(
  href: string,
  options: {
    fallbackFileName?: string;
    shareTitle?: string;
    requestInit?: RequestInit;
  } = {}
): Promise<boolean> {
  const toastId = toast.loading("PDF hazırlanıyor…", {
    description: "Büyük belgeler birkaç saniye sürebilir.",
  });

  try {
    const response = await fetch(href, {
      ...options.requestInit,
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`PDF alınamadı (${response.status})`);

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/pdf")) {
      throw new Error("Sunucu PDF yerine farklı bir yanıt döndürdü.");
    }

    const blob = await response.blob();
    const fileName = fileNameFromDisposition(
      response.headers.get("content-disposition"),
      options.fallbackFileName ?? "belge.pdf"
    );
    const file = new File([blob], fileName, {
      type: "application/pdf",
      lastModified: Date.now(),
    });

    // `download` burada aynı kaynaklı BLOB'a uygulanır; mobil tarayıcının
    // PDF görüntüleyicisine gitmek yerine dosya kaydetmesini sağlar.
    const objectUrl = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = file.name;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);

    const canShare = canShareFile(file);
    toast.success("PDF indirildi", {
      id: toastId,
      // Paylaş düğmesi okunacak kadar kalır; bildirimin ekranda asılı kalması
      // engellenir. İsteyen kullanıcı sağ üstteki × ile hemen kapatabilir.
      duration: 10_000,
      closeButton: true,
      description: canShare
        ? "PDF dosyası seçili. İsterseniz doğrudan dosya olarak paylaşabilirsiniz."
        : "Dosyalar / İndirilenler klasörüne kaydedildi.",
      action: canShare
        ? {
            label: "PDF Paylaş",
            onClick: () => void shareFile(file, options.shareTitle),
          }
        : undefined,
    });
    return true;
  } catch (error) {
    toast.error("PDF indirilemedi", {
      id: toastId,
      description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.",
    });
    return false;
  }
}

function canShareFile(file: File): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  // `canShare({files})` yoksa dosya paylaşımını varsaymayız. Aksi hâlde bazı
  // WebView'lar `files` alanını sessizce atıp açık sayfanın bağlantısını yollar.
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

async function shareFile(file: File, title?: string): Promise<void> {
  try {
    await navigator.share({ files: [file], title: title || file.name });
  } catch (error) {
    // Kullanıcının paylaşım sayfasını kapatması hata değildir.
    if (error instanceof DOMException && error.name === "AbortError") return;
    toast.error("Bu cihaz dosya paylaşımını tamamlayamadı.");
  }
}
