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
// KÖK ESNEK SÜTUNDUR, IZGARA DEĞİL — ve bu bir biçim tercihi değil, kaydırmanın
// ÇALIŞMASININ ŞARTIDIR. Kap `grid content-start` iken satırlar içerik boyunda
// kalıyor, alttaki `flex-1 overflow-y-auto` kutusu ızgara çocuğu olduğu için
// hiç yükseklik almıyordu: kâğıt kaymıyor, aşağıdaki `scrollTo` da sessizce
// hiçbir şey yapmıyordu. Yani "seçili bölümün yaprağına git" davranışı dar
// ekranda HİÇ çalışmadı. Esnek sütunda `flex-1` gerçek bir yükseklik üretir;
// karşılığında ÇAĞIRAN kaba bir yükseklik sınırı vermek zorundadır.
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
  firmaLogolari,
  projeFirmaLogosu,
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
  firmaLogolari?: ReadonlyMap<string, { url: string; oran: number }>;
  projeFirmaLogosu?: { url: string; oran: number };
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
    <aside className={`flex min-h-0 flex-col gap-2 ${className ?? ""}`}>
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
      {/*
       * KÂĞIT KÜÇÜLMEZ, KAYDIRILIR (MOBIL-27; MOBIL-9'un belge karşılığı).
       *
       * `ManualPaper` A4'ü `containerType: inline-size` + `cqw` ile kabın
       * genişliğine ORANTILI çizer: 360 px'lik bir sütunda 8,5 pt'lik gövde
       * yazısı ~5 px'e iner. Bu yaprak PDF'e giden dağıtımın TA KENDİSİDİR
       * (KITAP-19: sayfa numarası iki yerde ayrı tahmin edilmez) — mühendis
       * ekranda okuyamadığı bir şeyi doğrulayamaz. Dar ekranda bu yüzden
       * okunur bir taban genişlik çivilenir ve kap yatayda kayar; `.oc-scrollx`
       * kaydırmanın GÖRÜNMESİNİ sağlar (MOBIL-8).
       */}
      <div
        ref={kap}
        className="oc-scrollx relative min-h-0 flex-1 overflow-auto overscroll-contain bg-muted/40 p-3 [--oc-scroll-bg:var(--muted)]"
      >
        <div className="min-w-[40rem] lg:min-w-0">
          <ManualPaper
            payload={payload}
            projectTitle={projectTitle}
            sources={sources}
            gorseller={gorseller}
            docLine={docLine}
            docCode={docCode}
            vurguId={vurguId}
            firmaLogolari={firmaLogolari}
            projeFirmaLogosu={projeFirmaLogosu}
          />
        </div>
      </div>
    </aside>
  );
}
