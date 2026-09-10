import Link from "next/link";
import { ArrowRight, CircleDot, Ruler, Scale, TableProperties } from "lucide-react";

const TOOLS = [
  {
    href: "/tools/agirlik",
    title: "Ağırlık Hesabı",
    hint: "Sac, disk, halka, dolu mil, boru ve kutu profil",
    meta: "7,85 g/cm³ çelik varsayılanı",
    icon: Scale,
  },
  {
    href: "/tools/profiller",
    title: "Profil Kütüphanesi",
    hint: "Kesit ara, anma kg/m değerini ve toplam ağırlığı gör",
    meta: "477 doğrulanmış kesit",
    icon: TableProperties,
  },
  {
    href: "/tools/kama",
    title: "Kama Ölçüleri",
    hint: "Mil çapından kama ve kama kanalı ölçülerine geç",
    meta: "6–500 mm kaynak tablosu",
    icon: Ruler,
  },
  {
    href: "/tools/tolerans",
    title: "Geçme Toleransları",
    hint: "Delik ve mil sınır ölçülerini mikrometre hassasiyetinde hesapla",
    meta: "JIS B 0401:1999 · 0–500 mm",
    icon: CircleDot,
  },
] as const;

export default function ToolsPage() {
  return (
    <main className="grid gap-6">
      <header className="grid gap-1 border-b pb-4">
        <p className="oc-kicker text-muted-foreground">Atölye başvuru merkezi</p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Tek ölçü sistemi, tek kaynak</h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Tüm girişler milimetre, sonuçlar kilogramdır. İnç dönüşümü ve inç tablosu bulunmaz.
          Araçlar kayıt açmadan çalışır; ileride yeni teknik tablolar bu bölümün altına eklenebilir.
        </p>
      </header>

      <ul className="border-t">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className="group flex min-h-20 items-center gap-3 border-b px-2 py-3 transition-colors hover:bg-muted/50 sm:gap-4 sm:px-3"
              >
                <span className="flex size-10 shrink-0 items-center justify-center border bg-muted/40 text-foreground/80 group-hover:border-primary group-hover:text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{tool.title}</span>
                  <span className="block text-[12px] leading-5 text-muted-foreground">{tool.hint}</span>
                </span>
                <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
                  {tool.meta}
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-primary" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
