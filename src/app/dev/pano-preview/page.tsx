// PANO YERLEŞİM ŞEMASI ÖNİZLEME (dev) — auth'suz, gerçekçi fikstürle.
//
// Değişmez md. 11: ekran değiştiyse ÖNCE buraya bakılır. Fikstür iki ucu birden
// taşır — 0019-00 gibi çok panolu karmaşık bir iş ve 0026-01 gibi tek panolu
// standart bir vinç. Bir tanesiyle iyi görünen bir şema ötekinde dağılabilir.

// SAYFA DEVİNGEN İSTENİR. Statik ön-render'da `useSearchParams` kullanan
// istemci bileşenleri Suspense YEDEĞİNDE donuyordu: ekranın kendisi — bu
// sayfanın var oluş sebebi — hiç görünmüyordu, yalnız "Yükleniyor…" yazıyordu.
// Değişmez md. 11 buraya BAKMAYI şart koşuyor; bakılacak bir şey olmalı.
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import { PanoView } from "@/app/(app)/projects/[id]/pano/pano-view";
import { IcYerlesimView } from "@/app/(app)/projects/[id]/pano/ic/ic-view";
import { DefterView } from "@/app/(app)/projects/[id]/pano/defter/defter-view";
import { buildBook } from "@/lib/switchboard/book";
import {
  panoDizilimDiagram,
  panoIcYerlesimDiagram,
} from "@/lib/diagrams/panoLayout";
import { computeSwitchboardLayout } from "@/lib/switchboard/compute";
import type { ElectricalPart } from "@/lib/electrical/types";
import type { PanelOverride, PlacementOverride } from "@/lib/switchboard/types";

/**
 * ÖRNEK KARARLAR — Kararlar bölümü boş fikstürle görünmezdi (PANO-40).
 * Bir kilit, bir UYKUDA kilit (dizide olmayan kod) ve bir komşuya bağlı
 * sabitleme: üç rozet de ekranda denenebilsin.
 */
const ORNEK_PANO_KARARLARI: PanelOverride[] = [
  { code: "LVD01", name: "", kind: null, widthMm: 600, heightMm: null, depthMm: null, baseMm: null, doorConfig: null, orderIndex: null, widthLocked: true, heightLocked: false, depthLocked: false, note: "" },
  { code: "LVD01-A", name: "", kind: null, widthMm: 1000, heightMm: null, depthMm: null, baseMm: null, doorConfig: null, orderIndex: null, widthLocked: true, heightLocked: false, depthLocked: false, note: "" },
];
const ORNEK_AYGIT_KARARLARI: PlacementOverride[] = [
  { deviceKey: "185T|LVD01|F2", panelCode: null, mountType: null, zone: null, railIndex: null, orderInRail: null, anchorDeviceKey: "185T|LVD01|F4", anchorSide: "sonra", widthMm: null, heightMm: null, depthMm: null, pinned: true, note: "" },
];

function p(over: Partial<ElectricalPart>): ElectricalPart {
  return {
    deviceTag: "",
    installation: "185T",
    location: "LVD01",
    device: "",
    qty: 1,
    designation: "",
    typeNo: "",
    supplier: "",
    partNo: "",
    page: 145,
    ...over,
  };
}

const SALTER = {
  designation: "CIRCUIT BREAKER 400V 6KA, 3POLE, C, 16A",
  typeNo: "5SL6316-7",
  supplier: "Siemens",
  partNo: "SIE.5SL6316-7",
};
const KONTAKTOR = {
  designation: "CONTACTOR 3-POLE 9A AC-3 24VDC",
  typeNo: "3RT2016-1BB41",
  supplier: "Siemens",
  partNo: "SIE.3RT2016",
};
const TERMIK = {
  designation: "MOTOR PROTECTION CIRCUIT BREAKER 2,8-4A",
  typeNo: "3RV2011-1EA10",
  supplier: "Siemens",
  partNo: "SIE.3RV2011",
};
const ROLE = {
  designation: "INTERFACE RELAY 24VDC 6A",
  typeNo: "G2RV-SL700",
  supplier: "OMRON",
  partNo: "OMR.G2RV",
};
const PSU = {
  designation: "POWER SUPPLY SITOP 24VDC 10A",
  typeNo: "6EP1334-3BA10",
  supplier: "Siemens",
  partNo: "SIE.6EP1334",
};
const PLC = {
  designation: "SIMATIC S7-1500 DIGITAL INPUT MODULE 32x24VDC",
  typeNo: "6ES7521-1BL00-0AB0",
  supplier: "Siemens",
  partNo: "SIE.6ES7521",
};
const KLEMENS = {
  designation: "TERMINAL BLOCK 2,5MM2 GREY",
  typeNo: "UT 2,5",
  supplier: "Phoenix Contact",
  partNo: "PXC.3044076",
};
/** Ölçüsü ailesinden ÇIKARILAMAZ — "ölçüsü yok" kuyruğunu besler (PANO-5). */
const SURUCU = {
  designation: "SINAMICS S120 MOTOR MODULE 30A",
  typeNo: "6SL3120-1TE23-0AC0",
  supplier: "Siemens",
  partNo: "SIE.6SL3120",
};
/** Pano DIŞI — saha kuyruğunu besler (PANO-6). */
const MOTOR = {
  designation: "ASYNCHRONOUS MOTOR 15KW",
  typeNo: "1LE1001-1DB23",
  supplier: "Siemens",
  partNo: "SIE.1LE1001",
};
const BUTON = {
  designation: "PUSH BUTTON 22MM GREEN",
  typeNo: "3SU1000-0AB40",
  supplier: "Siemens",
  partNo: "SIE.3SU1000",
};
const LAMBA = {
  designation: "INDICATOR LIGHT 22MM RED 24V",
  typeNo: "3SU1001-6AA20",
  supplier: "Siemens",
  partNo: "SIE.3SU1001",
};

function seri(
  n: number,
  onek: string,
  konum: string,
  urun: Partial<ElectricalPart>,
  adet = 1
): ElectricalPart[] {
  return Array.from({ length: n }, (_, i) =>
    p({
      ...urun,
      location: konum,
      device: `${onek}${i + 1}`,
      deviceTag: `=185T+${konum}-${onek}${i + 1}`,
      qty: adet,
    })
  );
}

/** 0019-00 benzeri: çok panolu, klemens ağırlıklı, saha panoları ayrı. */
const KARMASIK: ElectricalPart[] = [
  ...seri(14, "F", "LVD01", SALTER),
  ...seri(6, "K", "LVD01", KONTAKTOR),
  ...seri(6, "Q", "LVD01", TERMIK),
  ...seri(10, "KA", "LVD01", ROLE),
  ...seri(2, "G", "LVD01", PSU),
  ...seri(5, "A", "LVD01", PLC),
  ...seri(3, "X", "LVD01", KLEMENS, 60),
  ...seri(2, "T", "LVD01", SURUCU),
  ...seri(2, "M", "LVD01", MOTOR),
  ...seri(4, "S", "CB1", BUTON),
  ...seri(4, "H", "CB1", LAMBA),
  ...seri(6, "F", "TB1", SALTER),
  ...seri(2, "X", "TB1", KLEMENS, 40),
  ...seri(4, "F", "TB2", SALTER),
  ...seri(2, "X", "TB2", KLEMENS, 55),
];

/** 0026-01 benzeri: tek büyük pano. */
const BASIT: ElectricalPart[] = [
  ...seri(8, "F", "P1", SALTER),
  ...seri(4, "K", "P1", KONTAKTOR),
  ...seri(4, "Q", "P1", TERMIK),
  ...seri(6, "KA", "P1", ROLE),
  ...seri(1, "G", "P1", PSU),
  ...seri(2, "X", "P1", KLEMENS, 45),
  ...seri(2, "S", "P1", BUTON),
];

export default async function PanoPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const varyantlar = [
    { ad: "Karmaşık iş (0019 benzeri)", parts: KARMASIK },
    { ad: "Standart vinç (0026 benzeri)", parts: BASIT },
  ];

  // EN KALABALIK PANO GÖSTERİLİR. İlk pano çoğu zaman yalnız kapak elemanı
  // taşıyan bir kumanda kutusudur ve iç yerleşimi boş çıkar — tıkla-baloncuk
  // davranışı boş bir plakada denenemez.
  const KARMASIK_SONUC = computeSwitchboardLayout({ parts: KARMASIK });
  const KALABALIK_PANO =
    [...KARMASIK_SONUC.room].sort((a, b) => b.placements.length - a.placements.length)[0]?.code ??
    "";

  return (
    <main className="grid gap-8 p-6">
      <h1 className="text-lg font-semibold">Pano Yerleşimi Önizleme (dev)</h1>

      {/* ÖLÇÜ DEFTERİ — arama ve süzgeçleriyle. */}
      <section className="grid gap-2">
        <h2 className="oc-kicker text-foreground/80">Ölçü Defteri (DefterView)</h2>
        <div className="rounded-lg border">
          <DefterView
            projectId="00000000-0000-0000-0000-000000000000"
            docNo="0019-00"
            projectName="185/40T ŞARJ VİNCİ (fikstür)"
            canEdit
            rows={buildBook({ parts: KARMASIK, models: [] })}
            bookSize={0}
          />
        </div>
      </section>

      {/* EKRANIN KENDİSİ — auth'suz. Değişmez md. 11 ekranı burada görmeyi
          ister; gerçek sayfa oturum arkasındadır ve ajan oraya giremez.
          `useSearchParams` Suspense sınırı gerektirir. */}
      <section className="grid gap-2">
        <h2 className="oc-kicker text-foreground/80">Ekran (PanoView) — karmaşık iş</h2>
        <div className="rounded-lg border">
          <Suspense fallback={<div className="p-6 text-sm">Yükleniyor…</div>}>
            <PanoView
              projectId="00000000-0000-0000-0000-000000000000"
              docNo="0019-00"
              projectName="185/40T ŞARJ VİNCİ (fikstür)"
              canEdit
              belgeVar
              belgeAdi="028.00 185-40T Şarj Vinci Elektrik Projeleri_rev3.pdf"
              belgeRevizyon="rev3"
              okunduMu
              parcaSayisi={KARMASIK.length}
              sonuc={computeSwitchboardLayout({ parts: KARMASIK, panelOverrides: ORNEK_PANO_KARARLARI, placementOverrides: ORNEK_AYGIT_KARARLARI })}
              panoKararlari={ORNEK_PANO_KARARLARI}
              aygitKararlari={ORNEK_AYGIT_KARARLARI}
              onay={null}
            />
          </Suspense>
        </div>
      </section>

      {/* İÇ YERLEŞİM AYRI SAYFADIR (08.09.2026) ve değişmez md. 11 onu da
          auth'suz görmeyi ister: şemadaki tıkla-baloncuk davranışı yalnız
          burada denenebilir. */}
      <section className="grid gap-2">
        <h2 className="oc-kicker text-foreground/80">Ekran (İç yerleşim) — tıklanabilir şema</h2>
        <div className="rounded-lg border">
          <Suspense fallback={<div className="p-6 text-sm">Yükleniyor…</div>}>
            <IcYerlesimView
              projectId="00000000-0000-0000-0000-000000000000"
              docNo="0019-00"
              projectName="185/40T ŞARJ VİNCİ (fikstür)"
              canEdit
              sonuc={KARMASIK_SONUC}
              istenenPano={KALABALIK_PANO}
              olcek={4}
            />
          </Suspense>
        </div>
      </section>

      {varyantlar.map((v) => {
        const sonuc = computeSwitchboardLayout({ parts: v.parts });
        // EN KALABALIK pano gösterilir: ilk pano çoğu zaman yalnız kapak
        // elemanı taşıyan bir kumanda kutusudur ve iç yerleşimi boş çıkar.
        const ic = [...sonuc.room].sort((a, b) => b.placements.length - a.placements.length)[0];
        return (
          <section key={v.ad} className="grid gap-4">
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="oc-kicker text-foreground/80">{v.ad}</h2>
              <span className="text-xs text-muted-foreground">
                {sonuc.room.length} oda · {sonuc.field.length} saha · ortak{" "}
                {sonuc.roomSize.heightMm ?? sonuc.fieldSize.heightMm}×{sonuc.roomSize.depthMm ?? sonuc.fieldSize.depthMm} mm · tahmin{" "}
                {sonuc.estimatedCount} · yerleşmeyen {sonuc.unplaced.length}
              </span>
            </div>

            <div className="oc-diagram-theme oc-scrollx overflow-x-auto rounded-lg border bg-[var(--oc-diagram-canvas)] p-4">
              <DiagramSvg
                diagram={panoDizilimDiagram({
                  panels: sonuc.room,
                  baslik: "Pano dizilimi",
                  not: `${sonuc.room.length} göz · ön görünüş`,
                })}
                themeAware
              />
            </div>

            {sonuc.field.length > 0 && (
              <div className="oc-diagram-theme oc-scrollx overflow-x-auto rounded-lg border bg-[var(--oc-diagram-canvas)] p-4">
                <DiagramSvg
                  diagram={panoDizilimDiagram({
                    panels: sonuc.field,
                    baslik: "Saha panoları",
                    not: `${sonuc.field.length} göz · ön görünüş`,
                  })}
                  themeAware
                />
              </div>
            )}

            {ic && (
              <div className="oc-diagram-theme oc-scrollx overflow-x-auto rounded-lg border bg-[var(--oc-diagram-canvas)] p-4">
                <DiagramSvg
                  diagram={panoIcYerlesimDiagram({ panel: ic, settings: sonuc.settings })}
                  themeAware
                />
              </div>
            )}

            {/* AYNI PANO 1:2'DE — ölçek seçeneği gerçekten çalışıyor mu, iki
                çizimi yan yana görmeden anlaşılmaz (öntanım 1:4). */}
            {ic && (
              <div className="oc-diagram-theme oc-scrollx overflow-x-auto rounded-lg border bg-[var(--oc-diagram-canvas)] p-4">
                <DiagramSvg
                  diagram={panoIcYerlesimDiagram({ panel: ic, settings: sonuc.settings, olcek: 2 })}
                  themeAware
                />
              </div>
            )}

          </section>
        );
      })}
    </main>
  );
}
