"use client";

// KÂĞIT PANELİ — belgenin kendi yerleşim çekirdeğiyle çizilmiş A4 yaprakları.
//
// `manual-editor.tsx`ten taşındı; davranışı korundu. YENİDEN YAZILMADI çünkü
// tek gerçek değeri PDF ile AYNI `manualAnaBolumSayfalari` dağıtımını
// okumasıdır (KITAP-19: sayfa numarası iki yerde ayrı tahmin edilmez).
//
// SEÇİLİ BÖLÜMÜN YAPRAĞINA KENDİLİĞİNDEN KAYAR. Bir mühendis solda
// "4.8.3.5 Muayene Kriterleri"ni açtığında sağda o bölümün bulunduğu yaprağı
// görmeli; yirmi yaprağı elle aramak, önizlemeyi hiç açmamakla aynı şeydir.
//
// Kaydırma YAZI YAZARKEN TEKRARLANMAZ (`sonYaprak`): her tuş vuruşunda dağıtım
// yeniden çalışır ve sayfa numarası değişmese bile etki tetiklenirdi; kâğıt her
// harfte zıplardı.

import { useEffect, useRef } from "react";
import { ManualPaper } from "@/components/manual/manual-paper";
import type { ManualPayload } from "@/lib/manual/types";
import type { ManualSourceData } from "@/lib/manual/sources";

export function PaperPanel({
  payload,
  projectTitle,
  sources,
  gorseller,
  docLine,
  docCode,
  vurguId,
  sayfa,
  yaprakSayisi,
  className,
}: {
  payload: ManualPayload;
  projectTitle: string;
  sources: ManualSourceData;
  gorseller: ReadonlyMap<string, { url: string; oran: number }>;
  docLine: string;
  docCode: string;
  vurguId: string;
  sayfa: number | null;
  yaprakSayisi: number;
  className?: string;
}) {
  const kap = useRef<HTMLDivElement>(null);
  const sonYaprak = useRef<number | null>(null);

  useEffect(() => {
    if (sayfa == null || sayfa === sonYaprak.current) return;
    sonYaprak.current = sayfa;
    const kapsayici = kap.current;
    const hedef = kapsayici?.querySelector<HTMLElement>(`#oc-yaprak-${sayfa}`);
    if (kapsayici && hedef) {
      kapsayici.scrollTo({ top: hedef.offsetTop - kapsayici.offsetTop, behavior: "smooth" });
    }
  }, [sayfa]);

  return (
    <aside className={`grid min-h-0 content-start gap-2 ${className ?? ""}`}>
      <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
        <span className="oc-kicker">KÂĞIT</span>
        <span>Gövde {yaprakSayisi} yaprak</span>
        {sayfa != null ? <span>· seçili bölüm {sayfa}. yaprakta</span> : null}
      </div>
      {sayfa == null && (
        <p className="border border-dashed p-2 text-xs text-muted-foreground">
          Seçili bölüm şu anda belgeye basılmıyor; boş olabilir ya da gizlenmiş olabilir.
        </p>
      )}
      <div ref={kap} className="min-h-0 flex-1 overflow-y-auto bg-muted/40 p-3">
        <ManualPaper
          payload={payload}
          projectTitle={projectTitle}
          sources={sources}
          gorseller={gorseller}
          docLine={docLine}
          docCode={docCode}
          vurguId={vurguId}
        />
      </div>
    </aside>
  );
}
