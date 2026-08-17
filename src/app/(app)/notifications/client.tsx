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
          void markNotificationRead(id).then(() => router.refresh());
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
          await markAllNotificationsRead();
          router.refresh();
        })
      }
    >
      Tümünü Okundu Say
    </Button>
  );
}
