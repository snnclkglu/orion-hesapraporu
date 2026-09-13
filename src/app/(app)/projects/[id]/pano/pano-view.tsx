"use client";

// PANO YERLEŞİMİ EKRANI — kabuk: dört bölüm, bir uyarı şeridi (Plan F6).
//
// Bölümler bir İŞ AKIŞIDIR, bir sekme yığını değil: Girdi (sistem neyi
// biliyor) → Panolar (ne buldu, ne seçtiniz) → Kararlar (verdiğiniz her şey,
// geri alınabilir) → Onay ve çıktı. İç yerleşim ayrı sayfadadır (`pano/ic`,
// kullanıcı kararı 08.09.2026).
//
// ÖLÇÜ SEÇİCİLERİ ADRESE YAZAR, veritabanına değil: kullanıcı bir yüksekliği
// deneyip bakabilmeli ve denemesi bir karar sayılmamalıdır. Kalıcı olan
// "Ölçüleri Kaydet" (PANO-34) ve "Onayla"dır (PANO-14).
//
// SEKME YEREL DURUMDUR, ADRESTE DEĞİL — gerekçe `pano-bolum-bari.tsx`te.

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { ComputeResult } from "@/lib/switchboard/compute";
import type { PanelOverride, PlacementOverride } from "@/lib/switchboard/types";
import type { SwitchboardApproval } from "@/lib/switchboard-data";
import {
  approveLayout,
  removePanelDecision,
  removePlacementDecision,
  resetPlacements,
  saveLayoutSettings,
  savePanel,
  unlockPanel,
  withdrawApproval,
} from "./actions";
import { PanoBolumBari, type PanoBolumu } from "./pano-bolum-bari";
import { Baslik, type panoKarariYuku } from "./parcalar";
import { GirdiBolumu } from "./bolumler/girdi";
import { PanolarBolumu } from "./bolumler/panolar";
import { KararlarBolumu, kararlariSay } from "./bolumler/kararlar";
import { OnayBolumu } from "./bolumler/onay";
import { UyariSeridi, uyarilariTuret } from "./bolumler/uyari-seridi";

export function PanoView({
  projectId,
  docNo,
  projectName,
  canEdit,
  belgeVar,
  belgeAdi,
  belgeRevizyon,
  okunduMu,
  parcaSayisi,
  sonuc,
  panoKararlari,
  aygitKararlari = [],
  onay,
}: {
  projectId: string;
  docNo: string;
  projectName: string;
  canEdit: boolean;
  belgeVar: boolean;
  belgeAdi: string;
  belgeRevizyon: string;
  okunduMu: boolean;
  parcaSayisi: number;
  sonuc: ComputeResult;
  panoKararlari: PanelOverride[];
  aygitKararlari?: PlacementOverride[];
  onay: SwitchboardApproval | null;
}) {
  const router = useRouter();
  const arama = useSearchParams();
  const [bekle, basla] = useTransition();
  const [bolum, setBolum] = useState<PanoBolumu>("girdi");

  const kararMap = useMemo(
    () => new Map(panoKararlari.map((p) => [p.code, p])),
    [panoKararlari]
  );

  // ONAY ESKİDİ Mİ? Plan saklanmadığı için "neyi onayladım" sorusunun cevabı
  // değişiklik izidir; tutmuyorsa kullanıcı eski bir belgeye göre sipariş vermesin.
  const onayEskidi = Boolean(onay && onay.inputFingerprint !== sonuc.fingerprint);
  const uyarilar = useMemo(
    () => uyarilariTuret(sonuc, onayEskidi, projectId),
    [sonuc, onayEskidi, projectId]
  );
  const sayim = useMemo(
    () => kararlariSay(panoKararlari, aygitKararlari, sonuc),
    [panoKararlari, aygitKararlari, sonuc]
  );
  const hataliDenetim = sonuc.audits.filter((a) => !a.result.ok).length;
  const girdiSorunu = sonuc.unplaced.filter((u) =>
    ["olcusuz", "siniflanmamis", "etiketsiz", "sigmadi"].includes(u.reason)
  ).length;

  function adresYaz(anahtar: string, deger: string) {
    const p = new URLSearchParams(arama.toString());
    if (deger) p.set(anahtar, deger);
    else p.delete(anahtar);
    basla(() => router.replace(`?${p.toString()}`, { scroll: false }));
  }

  async function calistir(is: () => Promise<{ ok: true } | { error: string }>, basarili: string) {
    const c = await is();
    if ("error" in c) toast.error(c.error);
    else {
      toast.success(basarili);
      router.refresh();
    }
  }

  const bitti = () => router.refresh();
  const panolarVar = sonuc.room.length + sonuc.field.length > 0;

  if (!belgeVar || !okunduMu || parcaSayisi === 0) {
    return (
      <main className="grid gap-4 p-4 md:p-6">
        <Baslik docNo={docNo} projectName={projectName} projectId={projectId} />
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          {!belgeVar
            ? "Bu projeye henüz elektrik projesi yüklenmemiş. Pano yerleşimi, EPLAN malzeme listesinden üretilir."
            : !okunduMu
              ? "Elektrik projesi yüklü ama okunmamış. Elektrik Projesi sekmesinden “Yeniden Oku” deyin."
              : "Elektrik projesinde malzeme satırı bulunamadı; yerleşecek aygıt yok."}
        </div>
      </main>
    );
  }

  return (
    <main className="grid gap-5 p-4 md:p-6">
      <Baslik docNo={docNo} projectName={projectName} projectId={projectId} />

      <PanoBolumBari
        bolum={bolum}
        onBolum={setBolum}
        sayaclar={{
          girdi: girdiSorunu,
          panolar: sonuc.room.length + sonuc.field.length,
          kararlar: sayim.pano + sayim.aygit + sayim.ayar,
          onay: hataliDenetim,
        }}
        icHref={
          panolarVar
            ? `/projects/${projectId}/pano/ic?${(() => {
                const p = new URLSearchParams(arama.toString());
                p.set("pano", (sonuc.room[0] ?? sonuc.field[0]).code);
                return p.toString();
              })()}`
            : null
        }
      />

      <UyariSeridi satirlar={uyarilar} onBolum={setBolum} />

      {bolum === "girdi" && (
        <GirdiBolumu
          projectId={projectId}
          canEdit={canEdit}
          belgeAdi={belgeAdi}
          belgeRevizyon={belgeRevizyon}
          parcaSayisi={parcaSayisi}
          sonuc={sonuc}
          onBitti={bitti}
        />
      )}

      {bolum === "panolar" && (
        <PanolarBolumu
          projectId={projectId}
          canEdit={canEdit}
          bekle={bekle}
          sonuc={sonuc}
          kararMap={kararMap}
          arama={arama.toString()}
          onAdres={adresYaz}
          onKaydetOlcu={() =>
            void calistir(
              () =>
                saveLayoutSettings(projectId, {
                  room: sonuc.settings.room,
                  field: sonuc.settings.field,
                }),
              "Ölçü tercihleri kaydedildi. Onay varsa değişiklik izi değiştiği için eskir."
            )
          }
          onPanoKarari={(yuk: ReturnType<typeof panoKarariYuku>, mesaj) =>
            void calistir(() => savePanel({ projectId, ...yuk }), mesaj)
          }
          onKilitKaldir={(code) =>
            void calistir(() => unlockPanel(projectId, code), "Gövde kilidi kaldırıldı.")
          }
        />
      )}

      {bolum === "kararlar" && (
        <KararlarBolumu
          canEdit={canEdit}
          bekle={bekle}
          sonuc={sonuc}
          panoKararlari={panoKararlari}
          aygitKararlari={aygitKararlari}
          onPanoSil={(code) =>
            void calistir(() => removePanelDecision(projectId, code), `${code} kararı kaldırıldı.`)
          }
          onAygitSil={(key) =>
            void calistir(() => removePlacementDecision(projectId, key), "Aygıt kararı kaldırıldı.")
          }
          onYenidenYerlestir={() =>
            void calistir(
              () => resetPlacements(projectId),
              "Serbest aygıt düzeltmeleri silindi; kilitler ve sabitlemeler duruyor."
            )
          }
        />
      )}

      {bolum === "onay" && (
        <OnayBolumu
          projectId={projectId}
          canEdit={canEdit}
          bekle={bekle}
          sonuc={sonuc}
          onay={onay}
          onayEskidi={onayEskidi}
          arama={arama.toString()}
          onOnayla={() =>
            void calistir(
              () => approveLayout(projectId, sonuc.fingerprint, sonuc.settings),
              "Yerleşim onaylandı."
            )
          }
          onOnayKaldir={() => void calistir(() => withdrawApproval(projectId), "Onay kaldırıldı.")}
        />
      )}
    </main>
  );
}
