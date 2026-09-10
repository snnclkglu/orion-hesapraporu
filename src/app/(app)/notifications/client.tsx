"use client";

// Bildirim listelerinin İSTEMCİ parçaları — panel bölümü ve /notifications
// sayfası ikisi de bunları kullanır (yazma yolu tekildir: actions.ts).
//
// Satıra tıklamak okundu İŞARETİNİ BEKLETMEZ: işaret arkada atılır, gezinme
// hemen olur (zilin kuralı). `router.refresh()` sunucu bölümlerini tazeler —
// panel bölümündeki "okunmamış" vurgusu ve sayaç birlikte düşer.

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "./actions";
import { Button } from "@/components/ui/button";

export function NotificationRowLink({
  id,
  href,
  okunmamis,
  className,
  children,
}: {
  id: string;
  href: string;
  okunmamis: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={href || "/jobs"}
      onClick={() => {
        if (okunmamis) {
          void markNotificationRead(id)
            .then((sonuc) => {
              if (sonuc.error) toast.error("Bildirim okundu olarak işaretlenemedi.");
              router.refresh();
            })
            .catch(() => toast.error("Bildirim okundu olarak işaretlenemedi."));
        }
      }}
      className={className}
    >
      {children}
    </Link>
  );
}

export function MarkAllReadButton() {
  const router = useRouter();
  const [bekliyor, basla] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      disabled={bekliyor}
      onClick={() =>
        basla(async () => {
          try {
            const sonuc = await markAllNotificationsRead();
            if (sonuc.error) {
              toast.error("Bildirimler güncellenemedi. Yeniden deneyin.");
              return;
            }
            toast.success("Bildirimlerin tümü okundu olarak işaretlendi.");
            router.refresh();
          } catch {
            toast.error("Bildirimler güncellenemedi. Yeniden deneyin.");
          }
        })
      }
    >
      {bekliyor ? "İşaretleniyor…" : "Tümünü Okundu Say"}
    </Button>
  );
}

export function RetryNotificationsButton() {
  const router = useRouter();
  const [bekliyor, basla] = useTransition();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={bekliyor}
      onClick={() => basla(() => router.refresh())}
    >
      {bekliyor ? "Yenileniyor…" : "Tekrar Dene"}
    </Button>
  );
}
