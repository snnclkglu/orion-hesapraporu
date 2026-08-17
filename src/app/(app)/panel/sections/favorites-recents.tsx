"use client";

// FAVORİLER · SON BAKILANLAR — kişinin kendi işaretledikleri.
//
// İSTEMCİ bileşenidir çünkü "Son Bakılanlar" cihazda yaşar (`useRecentJobs`,
// localStorage — sunucuya taşınmaz, kullanıcı kararı) ve bölümün "ikisi de
// boşsa hiç çizilme" kuralı ancak burada verilebilir. Favoriler sunucudan
// props ile gelir; hidrasyon sonrası cihaz listesi eklenir
// (`useSyncExternalStore` sunucu anlık görüntüsü boştur, uyuşmazlık çıkmaz).

import Link from "next/link";
import { Star } from "lucide-react";
import { useRecentJobs } from "@/lib/jobs/recent";
import { Baslik } from "./section-frame";

export interface FavoriteJobRef {
  id: string;
  jobNo: string;
  title: string;
}

function SatirListe({
  baslik,
  rows,
  ikon,
}: {
  baslik: string;
  rows: { id: string; jobNo: string; title: string }[];
  ikon?: React.ReactNode;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="min-w-0">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {ikon}
        {baslik}
      </p>
      <ul className="grid gap-1">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={`/jobs/${r.id}`}
              className="group flex items-baseline gap-2 py-0.5 text-sm pointer-coarse:py-1.5"
            >
              <span className="shrink-0 font-mono text-xs text-primary">{r.jobNo}</span>
              <span className="min-w-0 flex-1 truncate group-hover:underline" title={r.title}>
                {r.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FavoritesRecentsSection({
  favorites,
}: {
  favorites: FavoriteJobRef[];
}) {
  const recents = useRecentJobs();
  if (favorites.length === 0 && recents.length === 0) return null;

  return (
    <section>
      <Baslik>Favoriler · Son Bakılanlar</Baslik>
      <div className="grid gap-4">
        <SatirListe
          baslik="Favoriler"
          rows={favorites}
          ikon={
            // Yıldız KEHRİBARDIR — kırmızı tehlikeye ayrılmıştır
            // (favori-button ile aynı karar).
            <Star className="size-3.5 fill-amber-500 text-amber-500" aria-hidden />
          }
        />
        <SatirListe
          baslik="Son Bakılanlar"
          rows={recents.slice(0, 6)}
        />
      </div>
    </section>
  );
}
