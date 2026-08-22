"use client";

import { useState, useTransition } from "react";
import { Link2, Link2Off, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createDrawingShare, revokeDrawingShare } from "./share-actions";

async function copyLink(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function DrawingShareButton({
  packageId,
  fileId,
  initiallyActive,
}: {
  packageId: string;
  fileId: string;
  initiallyActive: boolean;
}) {
  const [active, setActive] = useState(initiallyActive);
  const [pending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const result = await createDrawingShare(packageId, fileId);
      if (result.error || !result.path) {
        toast.error(result.error ?? "Bağlantı oluşturulamadı.");
        return;
      }

      const url = new URL(result.path, window.location.origin).toString();
      setActive(true);
      if (await copyLink(url)) {
        toast.success(
          active
            ? "Yeni müşteri linki kopyalandı; eski link kapatıldı."
            : "Müşteri linki panoya kopyalandı."
        );
      } else {
        // Panoya erişim tarayıcı/HTTP politikası yüzünden reddedilirse link
        // kaybolmaz; seçilip elle kopyalanabileceği yerleşik pencere açılır.
        window.prompt("Müşteri bağlantısını kopyalayın:", url);
      }
    });
  }

  function revoke() {
    startTransition(async () => {
      const result = await revokeDrawingShare(packageId, fileId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setActive(false);
      toast.success("Müşteri bağlantısı kapatıldı.");
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={create}
        disabled={pending}
        title={
          active
            ? "Eski bağlantıyı kapatıp yeni müşteri bağlantısını kopyala"
            : "Üyelik istemeyen müşteri bağlantısı oluştur ve kopyala"
        }
        className="inline-flex min-h-6 items-center gap-1 border border-primary/30 bg-primary/5 px-1.5 font-mono text-[11px] text-primary transition-colors hover:bg-primary/10 disabled:opacity-50 pointer-coarse:min-h-8 pointer-coarse:px-2"
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Link2 className="size-3" />}
        {active ? "Linki yenile" : "Müşteri linki"}
      </button>
      {active && (
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          title="Bu PDF'in müşteri bağlantısını kapat"
          aria-label="Müşteri bağlantısını kapat"
          className="inline-flex min-h-6 items-center border border-destructive/30 bg-destructive/5 px-1.5 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 pointer-coarse:min-h-8 pointer-coarse:px-2"
        >
          <Link2Off className="size-3" />
        </button>
      )}
    </span>
  );
}
