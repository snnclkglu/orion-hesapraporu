// Taralı BOŞ DURUM paneli — "henüz kayıt yok" hâlinin marka dili.
//
// İşler listesindeki desen ortaklaştırıldı: çapraz tarama zemin + köşeli mono
// başlık + isteğe bağlı açıklama ve eylem. Başlık KÖŞELİ PARANTEZLE basılır
// (`[ HENÜZ İŞ YOK ]`) — bir hata değil bir durum bildirdiği için ses tonu
// teknik ve sakindir; kırmızı kullanılmaz.
//
// Sunucu bileşenidir ("use client" yok): çağıranlar çoğunlukla RSC sayfalar.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  children,
  className,
}: {
  /** Köşeli parantez içinde basılan mono başlık — BÜYÜK HARF yazılır. */
  title: string;
  description?: ReactNode;
  /** Eylem düğmesi (ör. "Yeni İş") — yoksa yalnız durum bildirilir. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 border bg-card px-6 py-16 text-center",
        className
      )}
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, var(--muted) 0 10px, transparent 10px 20px)",
      }}
    >
      <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
        [ {title} ]
      </h2>
      {description && (
        <p className="max-w-sm bg-card px-3 py-1 text-sm text-foreground/70">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
