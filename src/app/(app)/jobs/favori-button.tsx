"use client";

// Favori yıldızı — durumu SUNUCUDAN gelir (props), tıklama iyimser çevirir.
// Dolu yıldız kehribardır: kırmızı tehlikeye ayrılmıştır (marka kuralı) ve
// sarı yıldız favori işaretinin evrensel dilidir.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { toggleJobFavorite } from "./favorite-actions";
import { cn } from "@/lib/utils";

export function FavoriButton({
  jobId,
  favori,
  className,
}: {
  jobId: string;
  favori: boolean;
  className?: string;
}) {
  const [istemci, setIstemci] = useState(favori);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function degistir() {
    const yeni = !istemci;
    setIstemci(yeni);
    startTransition(async () => {
      const res = await toggleJobFavorite(jobId, yeni);
      if (res?.error) {
        setIstemci(!yeni);
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={degistir}
      aria-pressed={istemci}
      aria-label={istemci ? "Favorilerden çıkar" : "Favorilere ekle"}
      title={istemci ? "Favorilerden çıkar" : "Favorilere ekle"}
      className={cn(
        "oc-tap-square relative z-10 grid size-8 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      <Star
        className={cn(
          "size-4",
          istemci && "fill-amber-400 text-amber-500 dark:fill-amber-500/80"
        )}
      />
    </button>
  );
}
