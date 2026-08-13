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

/** Rehberin soyut açıklama değil, seçili tamponun gerçek değerleriyle konuşmasını sağlar. */
export interface BufferGuideSnapshot {
  model?: string;
  type?: string;
  impactSpeedMps?: number;
  massPerBufferT?: number;
  impactEnergyKj?: number;
  driveEnergyKj?: number;
  totalEnergyKj?: number;
  catalogEnergyKj?: number;
  compressionPct?: number;
  compressionLimitPct?: number;
  reactionForceKn?: number;
  avgDecelerationMps2?: number;
  maxDecelerationMps2?: number;
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

function ArrangementMini({ count }: { count: 1 | 2 | 4 }) {
  const active = count === 4 ? 2 : count;
  return (
    <div className="border bg-background p-2.5">
      <svg className="w-full text-foreground" viewBox="0 0 190 88" role="img" aria-label={`${count} kurulu tampon yerleşimi`}>
        <rect x="9" y="8" width="12" height="57" fill="var(--muted)" stroke="var(--border)" />
        <rect x="169" y="8" width="12" height="57" fill="var(--muted)" stroke="var(--border)" />
        <rect x="73" y="24" width="44" height="27" rx="3" fill="var(--accent)" stroke="var(--border)" />
        {count === 1 && <rect x="25" y="32" width="23" height="9" rx="2" fill="var(--primary)" />}
        {count >= 2 && <><rect x="25" y="19" width="23" height="9" rx="2" fill="var(--primary)" /><rect x="25" y="47" width="23" height="9" rx="2" fill="var(--primary)" /></>}
        {count === 4 && <><rect x="142" y="19" width="23" height="9" rx="2" fill="var(--muted-foreground)" opacity=".55" /><rect x="142" y="47" width="23" height="9" rx="2" fill="var(--muted-foreground)" opacity=".55" /></>}
        <path d="M123 38h16m-5-5 5 5-5 5" fill="none" stroke="var(--primary)" strokeWidth="1.8" />
        <text x="95" y="80" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">yeşil: bu çarpmada çalışan</text>
      </svg>
      <p className="mt-1 text-center text-sm font-medium">{count} kurulu / {active} aktif</p>
    </div>
  );
}

function BufferTypePathDiagram() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="border bg-background p-3">
        <p className="font-medium">Hidrolik tampon</p>
        <svg className="mt-2 w-full text-foreground" viewBox="0 0 260 106" role="img" aria-label="Hidrolik tampon kuvvet stroku diyagramı">
          <path d="M28 80H240M28 80V16" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M34 37H224" stroke="var(--primary)" strokeWidth="3" />
          <path d="M208 80V37" stroke="var(--primary)" strokeDasharray="4 3" />
          <text x="39" y="30" fontSize="11" fill="var(--primary)">yaklaşık sabit F_t</text>
          <text x="170" y="96" fontSize="10" fill="var(--muted-foreground)">tam strok s</text>
        </svg>
        <p className="mt-2 text-sm text-muted-foreground"><code>F_t = E_a / (s · η)</code>. Tam strok kullanılır; η katalogdaki sönümleme verimidir.</p>
      </div>
      <div className="border bg-background p-3">
        <p className="font-medium">Kauçuk / hücresel tampon</p>
        <svg className="mt-2 w-full text-foreground" viewBox="0 0 260 106" role="img" aria-label="Elastomer tampon kuvvet stroku diyagramı">
          <path d="M28 80H240M28 80V16" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M34 77 C85 74, 125 68, 157 52 S202 27, 225 20" fill="none" stroke="var(--destructive)" strokeWidth="3" />
          <circle cx="157" cy="52" r="4" fill="var(--primary)" />
          <text x="164" y="47" fontSize="11" fill="var(--primary)">F_t, eğriden okunur</text>
          <text x="145" y="96" fontSize="10" fill="var(--muted-foreground)">gerçek sıkışma f′</text>
        </svg>
        <p className="mt-2 text-sm text-muted-foreground">Önce enerji eğrisinden sıkışma bulunur; sonra aynı sıkışmada kuvvet eğrisinden <code>F_t</code> okunur.</p>
      </div>
    </div>
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

const number = (value: number | undefined, digits = 2) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("tr-TR", { maximumFractionDigits: digits })
    : "—";

function StepHeader({ number: step, title, eyebrow }: { number: string; title: string; eyebrow: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-sm font-semibold text-primary-foreground">{step}</span>
      <div>
        <p className="oc-kicker text-muted-foreground">{eyebrow}</p>
        <h3 className="mt-0.5 text-lg font-medium tracking-tight">{title}</h3>
      </div>
    </div>
  );
}

function EnergyFlowDiagram({ activeCount, snapshot }: { activeCount: number; snapshot?: BufferGuideSnapshot }) {
  const ea = number(snapshot?.totalEnergyKj, 3);
  const wmax = number(snapshot?.catalogEnergyKj, 3);
  return (
    <svg className="w-full text-foreground" viewBox="0 0 720 184" role="img" aria-label="Tampon enerjisi akış şeması">
      <rect x="12" y="35" width="170" height="88" rx="8" fill="var(--muted)" stroke="var(--border)" />
      <text x="97" y="62" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor">1. Çarpışan kütle</text>
      <text x="97" y="84" textAnchor="middle" fontSize="12" fill="currentColor">m_t = {number(snapshot?.massPerBufferT, 3)} t</text>
      <text x="97" y="104" textAnchor="middle" fontSize="12" fill="currentColor">vç = {number(snapshot?.impactSpeedMps, 3)} m/s</text>
      <path d="M188 79h62m-12-8 12 8-12 8" fill="none" stroke="var(--primary)" strokeWidth="2.5" />
      <rect x="255" y="22" width="208" height="115" rx="8" fill="var(--accent)" stroke="var(--primary)" strokeWidth="1.5" />
      <text x="359" y="49" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor">2. Tampon başına talep</text>
      <text x="359" y="78" textAnchor="middle" fontSize="23" fontWeight="700" fill="currentColor">E_a = {ea} kJ</text>
      <text x="359" y="102" textAnchor="middle" fontSize="12" fill="currentColor">E_kin {number(snapshot?.impactEnergyKj, 3)} kJ</text>
      <text x="359" y="120" textAnchor="middle" fontSize="12" fill="currentColor">+ E_tahrik {number(snapshot?.driveEnergyKj, 3)} kJ</text>
      <path d="M469 79h62m-12-8 12 8-12 8" fill="none" stroke="var(--primary)" strokeWidth="2.5" />
      <rect x="536" y="35" width="170" height="88" rx="8" fill="var(--muted)" stroke="var(--border)" />
      <text x="621" y="62" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor">3. Katalog kapasitesi</text>
      <text x="621" y="87" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">W_maks = {wmax} kJ</text>
      <text x="621" y="108" textAnchor="middle" fontSize="12" fill="currentColor">Gerekli: W_maks ≥ E_a</text>
      <text x="360" y="166" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">Toplam çarpma enerjisi, o anda aktif olan {activeCount} tampona bölünür.</text>
    </svg>
  );
}

function CurveReadingDiagram({ snapshot }: { snapshot?: BufferGuideSnapshot }) {
  return (
    <svg className="w-full text-foreground" viewBox="0 0 720 264" role="img" aria-label="Enerji ve kuvvet eğrilerinin aynı sıkışma oranından okunması">
      <text x="18" y="15" fontSize="11" fontWeight="600" fill="currentColor">1. Enerji – sıkışma</text>
      <path d="M45 204V40M45 204H314" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M52 197 C93 195, 136 180, 179 147 S252 78, 307 48" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M196 204V119H45" fill="none" stroke="var(--primary)" strokeDasharray="5 4" strokeWidth="1.8" />
      <circle cx="196" cy="119" r="5" fill="var(--primary)" />
      <text x="205" y="111" fontSize="12" fontWeight="600" fill="var(--primary)">E_a = {number(snapshot?.totalEnergyKj, 3)} kJ</text>
      <text x="151" y="225" fontSize="11" fill="var(--muted-foreground)">gereken sıkışma = {number(snapshot?.compressionPct, 1)} %</text>
      <text x="15" y="57" fontSize="11" fill="var(--muted-foreground)">enerji</text>

      <path d="M360 25V226" stroke="var(--border)" />
      <text x="386" y="15" fontSize="11" fontWeight="600" fill="currentColor">2. Kuvvet – sıkışma</text>
      <path d="M404 204V40M404 204H674" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M411 198 C459 176, 496 159, 535 150 S612 105, 667 48" fill="none" stroke="var(--destructive)" strokeWidth="2.5" />
      <path d="M555 204V132H404" fill="none" stroke="var(--primary)" strokeDasharray="5 4" strokeWidth="1.8" />
      <circle cx="555" cy="132" r="5" fill="var(--primary)" />
      <text x="565" y="124" fontSize="12" fontWeight="600" fill="var(--primary)">F_t = {number(snapshot?.reactionForceKn, 2)} kN</text>
      <text x="489" y="225" fontSize="11" fill="var(--muted-foreground)">aynı sıkışma yüzdesi</text>
      <text x="375" y="57" fontSize="11" fill="var(--muted-foreground)">kuvvet</text>
      <text x="360" y="256" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">E_a önce sıkışmayı belirler; aynı sıkışma, kuvvet eğrisinde F_t olarak okunur.</text>
    </svg>
  );
}

function DecelerationDiagram({ snapshot }: { snapshot?: BufferGuideSnapshot }) {
  return (
    <svg className="w-full text-foreground" viewBox="0 0 600 190" role="img" aria-label="Ortalama ve tepe yavaşlama farkı">
      <path d="M52 138H564M52 138V28" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M60 130 C148 127, 255 109, 356 74 S479 38, 555 33" fill="none" stroke="var(--destructive)" strokeWidth="2.8" />
      <path d="M60 112H555" stroke="var(--primary)" strokeDasharray="6 5" strokeWidth="1.8" />
      <path d="M482 138V33" stroke="var(--primary)" strokeDasharray="5 4" strokeWidth="1.4" />
      <text x="69" y="99" fontSize="12" fontWeight="600" fill="var(--primary)">a_ort = {number(snapshot?.avgDecelerationMps2, 2)} m/s²</text>
      <text x="377" y="25" fontSize="12" fontWeight="600" fill="var(--destructive)">a_maks = {number(snapshot?.maxDecelerationMps2, 2)} m/s²</text>
      <text x="430" y="160" fontSize="11" fill="var(--muted-foreground)">sıkışma yolu f′</text>
      <text x="12" y="44" fontSize="11" fill="var(--muted-foreground)">yavaşlama</text>
      <text x="307" y="184" textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">Kırmızı eğrinin en yüksek noktası, katalog kuvvetinden bulunan a_maks değeridir.</text>
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

export function BufferCalculationGuide({
  installedCount,
  axisTitle,
  snapshot,
}: BufferArrangementGuideProps & { snapshot?: BufferGuideSnapshot }) {
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
        <div className="grid gap-7 text-base leading-7">
          <section className="border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="oc-kicker text-muted-foreground">Bu hesapta seçilen tampon</p>
                <p className="mt-1 text-lg font-medium">{snapshot?.model || "Katalog seçimi bekleniyor"}</p>
              </div>
              <p className="text-sm text-muted-foreground">{axisTitle ?? "Hareket Ekseni"} · {count} kurulu / {activeCount} aktif tampon</p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border bg-background p-3"><div className="text-xs text-muted-foreground">Çarpma hızı</div><div className="mt-1 font-mono text-lg font-semibold">{number(snapshot?.impactSpeedMps, 3)} m/s</div></div>
              <div className="border bg-background p-3"><div className="text-xs text-muted-foreground">Tampon başına kütle</div><div className="mt-1 font-mono text-lg font-semibold">{number(snapshot?.massPerBufferT, 3)} t</div></div>
              <div className="border bg-background p-3"><div className="text-xs text-muted-foreground">Gereken enerji E_a</div><div className="mt-1 font-mono text-lg font-semibold">{number(snapshot?.totalEnergyKj, 3)} kJ</div></div>
              <div className="border bg-background p-3"><div className="text-xs text-muted-foreground">Katalog kapasitesi W_maks</div><div className="mt-1 font-mono text-lg font-semibold">{number(snapshot?.catalogEnergyKj, 3)} kJ</div></div>
            </div>
          </section>
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="space-y-2">
              <StepHeader number="1" eyebrow="Yerleşimi belirle" title="Bir çarpmada kaç tampon gerçekten çalışıyor?" />
              <p>{arrangementCopy(count)}</p>
              <p className="text-muted-foreground">Hesapta esas olan “kurulu” sayı değil, çarpma anında eşzamanlı temas eden tampon sayısıdır. 4 kurulu tampon, iki yön için iki ayrı ikilidir; tek yön çarpmasında aktif sayı yine 2’dir.</p>
              <p><code>m_t = çarpışan kütle / aktif tampon adedi</code></p>
            </div>
            <BufferArrangementSchematic installedCount={count} axisTitle={axisTitle} />
          </section>

          <Figure title="Katalog yerleşimini uygulamadaki seçimle eşleştirme">
            <div className="grid gap-3 sm:grid-cols-3">
              <ArrangementMini count={1} />
              <ArrangementMini count={2} />
              <ArrangementMini count={4} />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Bu uygulamadaki “4 kurulu” seçeneği, hareketin iki yönünde ikişer tampon bulunduğunu ifade eder. Tek çarpışmada sadece çarpılan yöndeki ikili enerji alır. Bir kurulum gerçekten aynı çarpışmada dört tamponu çalıştırıyorsa, bu özel fiziksel düzen ayrı olarak doğrulanmalıdır.</p>
          </Figure>

          <section className="grid gap-3 border-t pt-4">
            <div>
              <StepHeader number="2" eyebrow="Enerjiyi hesapla" title="Tamponun yutması gereken enerji nedir?" />
              <p><code>E_kin = 0,5 · m_t · vç²</code> hareketli kütlenin çarpma anındaki kinetik enerjisidir. Tahrik çarpmada itmeye devam ediyorsa, bunun yaptığı ek iş de eklenir: <code>E_tahrik = F₀ · f′</code>.</p>
            </div>
            <Figure title="Enerjinin hesap zinciri"><EnergyFlowDiagram activeCount={activeCount} snapshot={snapshot} /></Figure>
            <p className="text-muted-foreground"><strong className="text-foreground">E_a</strong> bir talep değeridir; <strong className="text-foreground">W_maks</strong> ise katalogdaki tampon başına izin verilen kapasitedir. Bunlar aynı şey değildir. Seçim kontrolü: <code>W_maks ≥ E_a</code>.</p>
          </section>

          <section className="grid gap-3 border-t pt-4">
            <div>
              <StepHeader number="3" eyebrow="Eğriden sıkışma ve kuvveti oku" title="Elastomer / hücresel tampon nasıl okunur?" />
              <p>Önce <code>E_a</code> değeri enerji–sıkışma eğrisine yerleştirilir ve gereken sıkışma yüzdesi bulunur. Sonra <em>aynı sıkışma yüzdesi</em> kuvvet–sıkışma eğrisinde okunarak <code>F_t</code> elde edilir.</p>
            </div>
            <Figure title="Katalog eğrisini doğru okuma sırası"><CurveReadingDiagram snapshot={snapshot} /></Figure>
            <p className="text-muted-foreground">Hücresel tamponda katalog 0, 1, 2, 3 ve 4 m/s için eğri verir. Gerçek çarpma hızı aradaysa, enerji ve kuvvet birlikte aynı ara hız eğrisinden hesaplanır. Enerjiyi 0 m/s, kuvveti 1 m/s eğrisinden okumak tek bir fiziksel çalışma durumu temsil etmez.</p>
            <BufferTypePathDiagram />
          </section>

          <section className="grid gap-3 border-t pt-4 lg:grid-cols-2">
            <div className="space-y-2">
              <StepHeader number="4" eyebrow="İki yavaşlamayı ayır" title="a_ort ile a_maks neden farklı?" />
              <p><code>a_ort = vç² / (2 · f′)</code> toplam sıkışma yolu üzerinden bulunan ortalama değerdir. Strok uzarsa, aynı hız için bu değer azalır.</p>
              <p><code>a_maks = F_t / m_t</code> ise kataloğun tepe tampon kuvvetinden gelen en yüksek değerdir. Sadece stroku büyütmek bunu garanti olarak düşürmez; eğrinin şekli ve tampon sertliği belirler.</p>
            </div>
            <Figure title="Yavaşlamanın strok boyunca değişimi"><DecelerationDiagram snapshot={snapshot} /></Figure>
          </section>

          <section className="grid gap-3 border-t pt-4 lg:grid-cols-2">
            <div>
              <StepHeader number="5" eyebrow="Seçimi doğrula" title="Dört temel kontrol" />
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
