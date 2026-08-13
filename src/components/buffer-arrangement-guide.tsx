"use client";

import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export interface BufferArrangementGuideProps {
  installedCount?: number;
  axisTitle?: string;
}

const normalizedCount = (count: number | undefined): 1 | 2 | 4 =>
  count !== undefined && count >= 4 ? 4 : count === 1 ? 1 : 2;

const arrangementCopy = (count: 1 | 2 | 4) => {
  if (count === 1) {
    return "Tek hareket yönünde tek tampon (1W). Yük tek tampona gelir.";
  }
  if (count === 4) {
    return "Her iki hareket yönünde ikişer tampon kurulur. Bu çarpmada yalnız çarpılan taraftaki iki tampon aktiftir (2W).";
  }
  return "Tek hareket yönünde paralel iki tampon aynı anda yük alır (2W). Bu uygulamadaki tipik seçim budur.";
};

function BufferSymbol({ x, y, active }: { x: number; y: number; active: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width="28" height="10" rx="3" fill={active ? "#1d8a68" : "#94a3b8"} />
      <rect x={x + 4} y={y + 2} width="20" height="6" rx="2" fill="white" opacity=".35" />
    </g>
  );
}

/** KAT0170 s.6'daki düzenleri, mevcut seçim mantığıyla gösteren yerleşim şeması. */
export function BufferArrangementSchematic({ installedCount, axisTitle }: BufferArrangementGuideProps) {
  const count = normalizedCount(installedCount);
  const activeCount = count === 4 ? 2 : count;
  const showLeftPair = count >= 2;
  const showRightPair = count === 4;

  return (
    <aside className="border bg-muted/20 p-3" aria-label="Tampon yerleşim şeması">
      <div className="oc-kicker text-muted-foreground">Tampon Yerleşimi</div>
      <p className="mt-1 text-sm font-medium">{axisTitle ?? "Hareket Ekseni"} · {count} kurulu / {activeCount} aktif</p>
      <svg className="mt-2 w-full" viewBox="0 0 300 132" role="img" aria-label={arrangementCopy(count)}>
        <defs>
          <pattern id="buffer-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#94a3b8" strokeWidth="2" />
          </pattern>
        </defs>
        <rect x="22" y="19" width="18" height="94" fill="url(#buffer-hatch)" stroke="#64748b" />
        <rect x="260" y="19" width="18" height="94" fill="url(#buffer-hatch)" stroke="#64748b" />
        <rect x="106" y="36" width="88" height="60" rx="5" fill="#e2e8f0" stroke="#64748b" />
        <text x="150" y="70" textAnchor="middle" fontSize="10" fill="#334155">hareketli kütle</text>
        {count === 1 && <BufferSymbol x={45} y={61} active />}
        {showLeftPair && <><BufferSymbol x={45} y={40} active /><BufferSymbol x={45} y={82} active /></>}
        {showRightPair && <><BufferSymbol x={227} y={40} active={false} /><BufferSymbol x={227} y={82} active={false} /></>}
        <path d="M205 66h35m-7-6 7 6-7 6" fill="none" stroke="#1d8a68" strokeWidth="2" />
        <text x="150" y="126" textAnchor="middle" fontSize="10" fill="#475569">yeşil: bu çarpmada aktif tamponlar</text>
      </svg>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{arrangementCopy(count)}</p>
    </aside>
  );
}

export function BufferCalculationGuide({ installedCount, axisTitle }: BufferArrangementGuideProps) {
  const count = normalizedCount(installedCount);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <CircleHelp className="size-3.5" /> Yerleşim ve hesap rehberi
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Tampon yerleşimi ve hesap rehberi</DialogTitle>
          <DialogDescription>
            KAT0170-0002-EN, Program 0170 / 0180, s.6–7. {axisTitle ?? "Bu hareket ekseni"} için seçili düzen aşağıda gösterilir.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="space-y-3 text-sm leading-6">
            <section className="border-l-2 border-primary pl-3">
              <h3 className="font-medium">Kurulu ve aktif tampon adedi</h3>
              <p>{arrangementCopy(count)}</p>
              <p className="text-muted-foreground">Enerji, tek çarpmada aktif olan tamponlara bölünür. Bu nedenle 4 kurulu tampon, tek yön çarpması için 4’e bölünmez.</p>
            </section>
            <section className="border-l-2 border-primary pl-3">
              <h3 className="font-medium">Enerji ve sıkışma</h3>
              <p><code>E_a = E_kin + F₀ · f′</code>. E_a tampon başına sönümlenmesi gereken enerjidir; <code>W_maks</code> ise seçilen tamponun katalog kapasitesidir. Kontrol: <code>W_maks ≥ E_a</code>.</p>
              <p className="text-muted-foreground">Hücresel tamponda enerji ve kuvvet, aynı çarpma hızındaki tek eğriden okunur. Ara hızlarda komşu katalog eğrileri arasında hesap yaklaşımı kullanılır; kritik seçim üreticiyle teyit edilmelidir.</p>
            </section>
            <section className="border-l-2 border-primary pl-3">
              <h3 className="font-medium">Yavaşlama</h3>
              <p><code>a_ort = vç² / (2 · f′)</code> ortalama kinematik yavaşlamadır. <code>a_maks = F_t / m_t</code> ise katalogdaki tepe tampon kuvvetinden bulunan yavaşlamadır.</p>
              <p className="text-muted-foreground">Strok büyüse de a_maks otomatik azalmaz: tamponun kuvvet–sıkışma eğrisi ve hareketli kütle belirleyicidir.</p>
            </section>
            <section className="border-l-2 border-amber-500 pl-3">
              <h3 className="font-medium">FEM 1.001, 7.7.1.2 kapsamı</h3>
              <p>5 m/s² (sık sınır yaklaşmasında 2,5 m/s²) sınırı operatör kabini içindeki yavaşlamadır. Uygulama bunu yalnız kabinli köprü yürütmesinde engelleyici kontrol olarak uygular; araba veya kabinsiz köprüde a_maks tasarım bilgisi olarak gösterilir.</p>
            </section>
          </div>
          <BufferArrangementSchematic installedCount={count} axisTitle={axisTitle} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
