// BİLDİRİMLER — kişiye yazılmış defter satırları (sinyalin zıddı: okunur,
// biriktirir, sebebi geçse de duran bir kayıttır). Yazma yolu `notifications/
// actions.ts`tedir; bu bölüm yalnız basar.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { tarihSaatIstanbul } from "@/lib/format-time";
import {
  MarkAllReadButton,
  NotificationRowLink,
} from "@/app/(app)/notifications/client";
import { cn } from "@/lib/utils";
import { Baslik, PanelEmpty } from "./section-frame";

export interface PanelNotificationRow {
  id: string;
  title: string;
  href: string;
  createdAt: string;
  readAt: string | null;
}

export function NotificationsSection({
  rows,
  unreadCount,
}: {
  rows: PanelNotificationRow[];
  unreadCount: number;
}) {
  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <Baslik>
          Bildirimler
          {unreadCount > 0 && (
            <span className="ml-2 font-mono text-[11px] text-primary">
              {unreadCount} yeni
            </span>
          )}
        </Baslik>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>
      {rows.length === 0 ? (
        <PanelEmpty>
          Bildiriminiz yok. Bir işte size görev atandığında, adınız bir yorumda
          geçtiğinde ya da izlediğiniz işin durumu değiştiğinde burada listelenir.
        </PanelEmpty>
      ) : (
        <>
          <ul className="divide-y border">
            {rows.map((r) => (
              <li key={r.id}>
                <NotificationRowLink
                  id={r.id}
                  href={r.href}
                  okunmamis={!r.readAt}
                  className={cn(
                    "block px-3 py-2 text-sm transition-colors hover:bg-muted/40 pointer-coarse:py-2.5",
                    !r.readAt && "font-medium"
                  )}
                >
                  <span className="block break-words">{r.title}</span>
                  <span className="mt-0.5 block font-mono text-[11px] font-normal text-muted-foreground">
                    {tarihSaatIstanbul(r.createdAt)}
                    {!r.readAt && <span className="text-primary"> · yeni</span>}
                  </span>
                </NotificationRowLink>
              </li>
            ))}
          </ul>
          <Link
            href="/notifications"
            className="mt-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground hover:underline pointer-coarse:py-2"
          >
            Tümünü Gör
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </>
      )}
    </section>
  );
}
