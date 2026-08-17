// ÇALIŞMA ALANI — bölümler DEFTER SATIRIDIR, kart ızgarası değil.
//
// İlk taslak bölümleri eşit boyda ikon+başlık+açıklama kartlarıyla diziyordu.
// O düzen bir SAYFA YAPISI değil bir dolgudur: sekiz kart aynı ağırlıkta
// bağırır, hiçbiri bir şey söylemez. Satır kartdan hızlı taranır, canlı sayı
// da ekranı bir başlatıcıdan bir duruma çevirir ("62 iş · 4 aktif").

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandIcon, type BrandIconName } from "@/components/brand-icon";
import { visibleSections } from "@/lib/roles";
import { Baslik } from "./section-frame";
import type { SectionCounts } from "../data";

export function WorkspaceSection({
  role,
  counts,
}: {
  role: string;
  counts: SectionCounts;
}) {
  // Pano KENDİNİ LİSTELEMEZ. Menü ile bu liste aynı kaynaktan okunur
  // (`WORKSPACE_SECTIONS`) ve panonun kendisi de o kaynakta bir bölümdür;
  // burada tek bir satır düşülür, ikinci bir liste yazılmaz.
  const sections = visibleSections(role).filter((s) => s.href !== "/");

  return (
    <section>
      <Baslik>Çalışma Alanı</Baslik>
      <ul className="border-t">
        {sections.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group flex min-h-16 items-center gap-3 border-b px-2 py-3 transition-colors hover:bg-muted/50 sm:gap-4 sm:px-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center border bg-muted/40 text-foreground/80 transition-colors group-hover:border-primary group-hover:text-primary">
                <BrandIcon name={s.icon as BrandIconName} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{s.label}</span>
                {/* Açıklama telefonda DÜŞER: orada satırın işi "nereye
                    gidiyorum"u söylemektir, bölümü tanıtmak değil. */}
                <span className="hidden truncate text-[12px] text-muted-foreground sm:block">
                  {s.hint}
                </span>
              </span>
              {counts[s.href] && (
                <span className="shrink-0 font-mono text-[12px] whitespace-nowrap text-muted-foreground">
                  {counts[s.href]}
                </span>
              )}
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
