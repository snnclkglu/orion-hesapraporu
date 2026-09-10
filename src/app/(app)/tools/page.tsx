import Link from "next/link";
import { ArrowRight, CircleDot, Construction, Disc3, Footprints, LockKeyhole, Ruler, Scale, TableProperties, TrainFront, Wrench } from "lucide-react";

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
  { href: "/tools/raylar", title: "Ray Sistemleri", hint: "A, S ve çubuk ray; uyumlu Crapex krapo ve Beket pedi", meta: "Ray · krapo · ped", icon: TrainFront },
  { href: "/tools/civata", title: "Cıvata Merkezi", hint: "Diş, delik, pul, somun, tork, boy ve Eurocode aralıkları", meta: "M6–M36", icon: Wrench },
  { href: "/tools/segman", title: "Segman Ölçüleri", hint: "Mil ve delik için dış/iç segman kanal ölçüleri", meta: "DIN 471 · DIN 472", icon: Disc3 },
  { href: "/tools/kece", title: "Keçe Kataloğu", hint: "Mil, yuva, yükseklik, tip ve malzemeye göre Suptex araması", meta: "3.896 kayıt", icon: Construction },
  { href: "/tools/aks-tutucu", title: "Aks Tutucu", hint: "Mil çapından DIN 15058 tutucu ve bağlantı ölçüleri", meta: "16–250 mm", icon: LockKeyhole },
  { href: "/tools/erisim-emniyeti", title: "Erişim ve Emniyet", hint: "Platform, merdiven, korkuluk ve tehlikeli bölge kaynak rehberi", meta: "EN ISO 14122 · EN 13586", icon: Footprints },
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
