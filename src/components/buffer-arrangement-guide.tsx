"use client";

import type { ReactNode } from "react";
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

function Figure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <figure className="border bg-muted/20 p-3">
      <figcaption className="mb-2 font-medium">{title}</figcaption>
      {children}
    </figure>
  );
}

function EnergyFlowDiagram({ activeCount }: { activeCount: number }) {
  return (
    <svg className="w-full" viewBox="0 0 520 176" role="img" aria-label="Tampon enerjisi akış şeması">
      <rect x="10" y="40" width="128" height="72" rx="6" fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
      <text x="74" y="67" textAnchor="middle" fontSize="12" fill="currentColor">Hareketli kütle</text>
      <text x="74" y="88" textAnchor="middle" fontSize="11" fill="currentColor">m_t · vç</text>
      <path d="M142 76h48m-10-7 10 7-10 7" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
      <rect x="194" y="29" width="140" height="94" rx="6" fill="hsl(var(--primary) / 0.08)" stroke="hsl(var(--primary))" />
      <text x="264" y="56" textAnchor="middle" fontSize="12" fill="currentColor">Tampon başına enerji</text>
      <text x="264" y="79" textAnchor="middle" fontSize="16" fontWeight="600" fill="currentColor">E_a</text>
      <text x="264" y="101" textAnchor="middle" fontSize="11" fill="currentColor">E_kin + E_tahrik</text>
      <path d="M338 76h48m-10-7 10 7-10 7" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
      <rect x="390" y="40" width="120" height="72" rx="6" fill="hsl(var(--muted))" stroke="hsl(var(--border))" />
      <text x="450" y="67" textAnchor="middle" fontSize="12" fill="currentColor">Katalog sınırı</text>
      <text x="450" y="90" textAnchor="middle" fontSize="15" fontWeight="600" fill="currentColor">W_maks ≥ E_a</text>
      <text x="264" y="153" textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">Toplam çarpma enerjisi, o anda aktif olan {activeCount} tampona eşit paylaştırılır.</text>
    </svg>
  );
}

function CurveReadingDiagram() {
  return (
    <svg className="w-full" viewBox="0 0 520 208" role="img" aria-label="Enerji ve kuvvet eğrilerinin aynı sıkışma oranından okunması">
      <text x="18" y="15" fontSize="11" fontWeight="600" fill="currentColor">1. Enerji – sıkışma</text>
      <path d="M36 166V32M36 166H226" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.2" />
      <path d="M42 160 C74 158, 96 146, 126 119 S178 66, 218 40" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2" />
      <path d="M151 166V94H36" fill="none" stroke="hsl(var(--primary))" strokeDasharray="4 3" strokeWidth="1.5" />
      <circle cx="151" cy="94" r="4" fill="hsl(var(--primary))" />
      <text x="155" y="87" fontSize="10" fill="hsl(var(--primary))">E_a</text>
      <text x="122" y="183" fontSize="10" fill="hsl(var(--muted-foreground))">sıkışma %</text>
      <text x="10" y="48" fontSize="10" fill="hsl(var(--muted-foreground))">enerji</text>

      <path d="M260 22V185" stroke="hsl(var(--border))" />

      <text x="280" y="15" fontSize="11" fontWeight="600" fill="currentColor">2. Kuvvet – sıkışma</text>
      <path d="M298 166V32M298 166H488" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.2" />
      <path d="M304 160 C338 143, 362 130, 391 122 S447 90, 480 43" fill="none" stroke="hsl(var(--destructive))" strokeWidth="2" />
      <path d="M413 166V105H298" fill="none" stroke="hsl(var(--primary))" strokeDasharray="4 3" strokeWidth="1.5" />
      <circle cx="413" cy="105" r="4" fill="hsl(var(--primary))" />
      <text x="418" y="99" fontSize="10" fill="hsl(var(--primary))">F_t</text>
      <text x="384" y="183" fontSize="10" fill="hsl(var(--muted-foreground))">aynı sıkışma %</text>
      <text x="272" y="48" fontSize="10" fill="hsl(var(--muted-foreground))">kuvvet</text>
      <text x="260" y="204" textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))">E_a önce enerji eğrisinde sıkışmayı verir; aynı sıkışma kuvvet eğrisinde F_t olarak okunur.</text>
    </svg>
  );
}

function DecelerationDiagram() {
  return (
    <svg className="w-full" viewBox="0 0 520 145" role="img" aria-label="Ortalama ve tepe yavaşlama farkı">
      <path d="M38 104H486M38 104V22" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.2" />
      <path d="M42 96 C132 94, 232 80, 326 59 S428 32, 480 28" fill="none" stroke="hsl(var(--destructive))" strokeWidth="2.2" />
      <path d="M42 84H480" stroke="hsl(var(--primary))" strokeDasharray="5 4" strokeWidth="1.6" />
      <path d="M422 104V28" stroke="hsl(var(--primary))" strokeDasharray="4 3" />
      <text x="50" y="74" fontSize="11" fill="hsl(var(--primary))">a_ort: toplam yolun ortalaması</text>
      <text x="365" y="23" fontSize="11" fill="hsl(var(--destructive))">a_maks: F_t / m_t</text>
      <text x="440" y="122" fontSize="10" fill="hsl(var(--muted-foreground))">sıkışma yolu f′</text>
      <text x="9" y="34" fontSize="10" fill="hsl(var(--muted-foreground))">yavaşlama</text>
    </svg>
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
  const activeCount = count === 4 ? 2 : count;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <CircleHelp className="size-3.5" /> Yerleşim ve hesap rehberi
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Tampon yerleşimi ve hesap rehberi</DialogTitle>
          <DialogDescription>
            KAT0170-0002-EN, Program 0170 / 0180, s.6–7. {axisTitle ?? "Bu hareket ekseni"} için seçili düzen aşağıda gösterilir.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 text-sm leading-6">
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="space-y-2">
              <div className="oc-kicker text-muted-foreground">Adım 1 · Yerleşimi belirle</div>
              <h3 className="text-base font-medium">Bir çarpmada kaç tampon gerçekten çalışıyor?</h3>
              <p>{arrangementCopy(count)}</p>
              <p className="text-muted-foreground">Hesapta esas olan “kurulu” sayı değil, çarpma anında eşzamanlı temas eden tampon sayısıdır. 4 kurulu tampon, iki yön için iki ayrı ikilidir; tek yön çarpmasında aktif sayı yine 2’dir.</p>
              <p><code>m_t = çarpışan kütle / aktif tampon adedi</code></p>
            </div>
            <BufferArrangementSchematic installedCount={count} axisTitle={axisTitle} />
          </section>

          <section className="grid gap-3 border-t pt-4">
            <div>
              <div className="oc-kicker text-muted-foreground">Adım 2 · Enerjiyi hesapla</div>
              <h3 className="text-base font-medium">Tamponun yutması gereken enerji nedir?</h3>
              <p><code>E_kin = 0,5 · m_t · vç²</code> hareketli kütlenin çarpma anındaki kinetik enerjisidir. Tahrik çarpmada itmeye devam ediyorsa, bunun yaptığı ek iş de eklenir: <code>E_tahrik = F₀ · f′</code>.</p>
            </div>
            <EnergyFlowDiagram activeCount={activeCount} />
            <p className="text-muted-foreground"><strong className="text-foreground">E_a</strong> bir talep değeridir; <strong className="text-foreground">W_maks</strong> ise katalogdaki tampon başına izin verilen kapasitedir. Bunlar aynı şey değildir. Seçim kontrolü: <code>W_maks ≥ E_a</code>.</p>
          </section>

          <section className="grid gap-3 border-t pt-4">
            <div>
              <div className="oc-kicker text-muted-foreground">Adım 3 · Eğriden sıkışma ve kuvveti oku</div>
              <h3 className="text-base font-medium">Elastomer / hücresel tampon nasıl okunur?</h3>
              <p>Önce <code>E_a</code> değeri enerji–sıkışma eğrisine yerleştirilir ve gereken sıkışma yüzdesi bulunur. Sonra <em>aynı sıkışma yüzdesi</em> kuvvet–sıkışma eğrisinde okunarak <code>F_t</code> elde edilir.</p>
            </div>
            <Figure title="Katalog eğrisini doğru okuma sırası"><CurveReadingDiagram /></Figure>
            <p className="text-muted-foreground">Hücresel tamponda katalog 0, 1, 2, 3 ve 4 m/s için eğri verir. Gerçek çarpma hızı aradaysa, enerji ve kuvvet birlikte aynı ara hız eğrisinden hesaplanır. Enerjiyi 0 m/s, kuvveti 1 m/s eğrisinden okumak tek bir fiziksel çalışma durumu temsil etmez.</p>
          </section>

          <section className="grid gap-3 border-t pt-4 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="oc-kicker text-muted-foreground">Adım 4 · İki yavaşlamayı ayır</div>
              <h3 className="text-base font-medium">a_ort ile a_maks neden farklı?</h3>
              <p><code>a_ort = vç² / (2 · f′)</code> toplam sıkışma yolu üzerinden bulunan ortalama değerdir. Strok uzarsa, aynı hız için bu değer azalır.</p>
              <p><code>a_maks = F_t / m_t</code> ise kataloğun tepe tampon kuvvetinden gelen en yüksek değerdir. Sadece stroku büyütmek bunu garanti olarak düşürmez; eğrinin şekli ve tampon sertliği belirler.</p>
            </div>
            <Figure title="Yavaşlamanın strok boyunca değişimi"><DecelerationDiagram /></Figure>
          </section>

          <section className="grid gap-3 border-t pt-4 lg:grid-cols-2">
            <div>
              <div className="oc-kicker text-muted-foreground">Adım 5 · Seçimi doğrula</div>
              <ul className="list-disc space-y-1 pl-5">
                <li><code>W_maks ≥ E_a</code>: tamponun enerji kapasitesi yeterli mi?</li>
                <li>Sıkışma oranı, katalogdaki izinli üst sınırı geçiyor mu?</li>
                <li><code>F_t</code>, katalog son kuvvet sınırını geçiyor mu?</li>
                <li>Hız 0,4 m/s üzerindeyse tampon tepkisi yapı hesabına aktarılıyor mu?</li>
              </ul>
            </div>
            <div className="border-l-2 border-amber-500 pl-3">
              <div className="oc-kicker text-muted-foreground">FEM 1.001, 7.7.1.2</div>
              <h3 className="font-medium">5 m/s² sınırı ne zaman zorunlu?</h3>
              <p>5 m/s²; normal işletmede sınıra sık ulaşılıyorsa 2,5 m/s², operatör kabini içindeki yavaşlama sınırıdır. Bu uygulama bunu yalnız kabinli köprü yürütmesinde engelleyici kontrol yapar. Araba veya kabinsiz köprüde a_maks, tampon/struktur tasarımını değerlendiren bir bilgi değeridir.</p>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
