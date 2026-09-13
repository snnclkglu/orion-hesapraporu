"use client";

// PANO İÇ YERLEŞİMİ EKRANI — plaka, kapak, gövde gereçleri ve cihaz listesi.
//
// ŞEMA ARTIK GERÇEKTEN TIKLANABİLİR. Bu dosyanın atası olan ekranın başında
// "bir cihaza tıklamak onu seçer" yazıyordu ama şemada hiçbir olay dinleyicisi
// yoktu; seçim yalnız listeden yapılabiliyordu. Kullanıcı (08.09.2026)
// "ekipman üzerine bastığında küçük pop-up ile ne olduğu da görülebilsin"
// dedi — vaat edilen davranış nihayet var.
//
// VURUŞ KUTULARI ÇİZİMİN KENDİ GEÇİŞİNDEN GELİR (`panoIcYerlesim`), ikinci bir
// hesaptan değil: iki paralel geometri bir gün ayrışır ve baloncuk YANLIŞ
// cihazı anlatırdı.

import { SectionBottomBar } from "@/components/section-bottom-bar";
import { BottomToolPanel, openBottomTool } from "@/components/bottom-bar-tools";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import {
  IC_OLCEKLERI,
  birakmaHedefi,
  kutuBul,
  olcekMetni,
  panoIcYerlesim,
  type BirakmaHedefi,
  type IcKutu,
  type IcOlcek,
} from "@/lib/diagrams/panoLayout";
import { COLOR_GROUP_LABEL, MOUNT_LABEL, ZONE_LABEL } from "@/lib/switchboard/mount";
import type { ComputeResult } from "@/lib/switchboard/compute";
import type { DeviceBox } from "@/lib/switchboard/types";
import { movePlacement, unpinPlacement } from "../actions";
import {
  AygitFormu,
  Baslik,
  CihazListesi,
  OlcuDiyalogu,
  SemaKabi,
  sayi,
} from "../parcalar";

/** Bu kadar birimden az hareket bir SÜRÜKLEME değil bir TIKLAMADIR. */
const SURUKLEME_ESIGI = 6;

export function IcYerlesimView({
  projectId,
  docNo,
  projectName,
  canEdit,
  sonuc,
  istenenPano,
  olcek,
}: {
  projectId: string;
  docNo: string;
  projectName: string;
  canEdit: boolean;
  sonuc: ComputeResult;
  istenenPano: string;
  olcek: IcOlcek;
}) {
  const router = useRouter();
  const arama = useSearchParams();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [secilenAygit, setSecilenAygit] = useState<string>("");
  const [baloncuk, setBaloncuk] = useState<IcKutu | null>(null);
  const [surukleme, setSurukleme] = useState<{ kutu: IcKutu; x: number; y: number } | null>(null);
  const [hedef, setHedef] = useState<BirakmaHedefi | null>(null);
  const basladi = useRef<{ x: number; y: number } | null>(null);

  const panolar = useMemo(() => [...sonuc.room, ...sonuc.field], [sonuc]);
  const aktif = panolar.find((p) => p.code === istenenPano) ?? panolar[0] ?? null;

  // Aygıt kimliği `Placement`ta DEĞİL `DeviceBox`ta: yerleşim yalnız geometridir
  // ve bölünmüş bir klemens şeridi aynı kimliği onlarca kez taşırdı.
  const kutular = useMemo(
    () => new Map(sonuc.devices.map((d) => [d.key, d])),
    [sonuc.devices]
  );

  const cizim = useMemo(
    () => (aktif ? panoIcYerlesim({ panel: aktif, settings: sonuc.settings, olcek }) : null),
    [aktif, sonuc.settings, olcek]
  );

  /**
   * PANONUN AYGIT SIRASI — ÇÖZÜCÜDEN gelir, çizimden türetilmez (PANO-38).
   *
   * Eski sürüm sırayı ray ray, soldan sağa çizim sırasından türetiyordu ve
   * çözücü kendi `sirala()` sırasını sayıyordu. First-fit ikisini ayırdı;
   * ölçüldü (0026): bırakılan komşuluk ile yazılan indeks başka yerlere denk
   * geldi. Artık iki taraf da `PanelLayout.order` okur.
   */
  const siraliAnahtarlar = useMemo(() => aktif?.order ?? [], [aktif]);

  /** DIN mi plaka mı — sürükleme tür sınırını aşamaz (PANO-38). */
  const turu = (key: string): "din" | "plaka" =>
    kutular.get(key)?.mountType === "plaka" ? "plaka" : "din";

  /** Aynı türden komşular arasında sıra (1 tabanlı) ve toplam. */
  function turIcindeSira(key: string): { sira: number; adet: number } {
    const t = turu(key);
    const ayni = siraliAnahtarlar.filter((k) => turu(k) === t);
    return { sira: ayni.indexOf(key), adet: ayni.length };
  }

  /** Ekran noktasını çizimin kendi eksenine çevirir. */
  function noktaCoz(e: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  /**
   * Bırakılan noktanın karşılık geldiği KOMŞULUK.
   *
   * En yakın kutunun ORTASINA göre karar verilir: solundaysa onun ÖNÜNE,
   * sağındaysa ARKASINA. Komşu farklı türdense (DIN ↔ plaka) karar YOKTUR —
   * bırakma sırasında gösterge çıkmaz, bırakınca uyarı verilir.
   */
  function hedefCoz(nokta: { x: number; y: number }, tasinan: string): BirakmaHedefi | null {
    if (!cizim) return null;
    // Bırakma hoşgörüsü tıklamadan GENİŞTİR (40 birim): sürüklerken imleç iki
    // cihazın arasında durur, tam üstünde değil.
    const kutu = kutuBul(cizim.kutular, nokta.x, nokta.y, 40);
    if (!kutu) return null;
    if (turu(kutu.deviceKey) !== turu(tasinan)) return null;
    return birakmaHedefi(siraliAnahtarlar, tasinan, kutu.deviceKey, nokta.x < kutu.x + kutu.w / 2);
  }

  async function calistir(is: () => Promise<{ ok: true } | { error: string }>, basarili: string) {
    const c = await is();
    if ("error" in c) toast.error(c.error);
    else {
      toast.success(basarili);
      router.refresh();
    }
  }

  /**
   * Aygıtı SIRADA bir adım kaydırır — dokunmatik ve klavye yolu.
   *
   * Adım KENDİ TÜRÜNÜN komşusuna atılır: bir röle bir sürücünün önüne
   * geçemez (PANO-38). Komşu yoksa düğme zaten pasiftir.
   */
  function kaydir(deviceKey: string, yon: -1 | 1) {
    if (!aktif) return;
    const t = turu(deviceKey);
    const ayni = siraliAnahtarlar.filter((k) => turu(k) === t);
    const i = ayni.indexOf(deviceKey);
    if (i < 0) return;
    const komsu = ayni[i + yon];
    if (!komsu) return;
    void calistir(
      () =>
        movePlacement({
          projectId,
          deviceKey,
          anchorDeviceKey: komsu,
          anchorSide: yon < 0 ? "once" : "sonra",
          railIndex: null,
        }),
      "Aygıt taşındı."
    );
  }

  // KAÇIŞ TUŞU SÜRÜKLEMEYİ İPTAL EDER. Boşluğa bırakmak da iptal eder (hedef
  // bulunamaz), ama kullanıcı bir cihazın üstündeyken vazgeçtiğinde elinde
  // başka bir yol kalmazdı.
  useEffect(() => {
    if (!surukleme) return;
    const dinle = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSurukleme(null);
      setHedef(null);
      basladi.current = null;
    };
    window.addEventListener("keydown", dinle);
    return () => window.removeEventListener("keydown", dinle);
  }, [surukleme]);

  function adresYaz(anahtar: string, deger: string) {
    const p = new URLSearchParams(arama.toString());
    if (deger) p.set(anahtar, deger);
    else p.delete(anahtar);
    router.replace(`?${p.toString()}`, { scroll: false });
  }

  /**
   * BASMA: cihazı seçer ve — fare/kalemse — sürüklemeyi başlatır.
   *
   * DOKUNMATİKTE SÜRÜKLEME YOK ve bu bilinçli: şema kabı yatay kaydırılıyor
   * (MOBIL-9 — diyagramlar küçülmez, kaydırılır) ve parmakla sürüklemeyi
   * yakalamak o kaydırmayı öldürürdü. 2.500 mm'lik bir diziyi telefonda
   * sürükleyerek düzenlemek zaten gerçek bir iş akışı değil; dokunmatik ve
   * klavye yolu baloncuktaki "öne/arkaya al" düğmeleridir.
   */
  function semayaBas(e: React.PointerEvent<SVGRectElement>) {
    if (!cizim) return;
    const nokta = noktaCoz(e);
    if (!nokta) return;
    const kutu = kutuBul(cizim.kutular, nokta.x, nokta.y);
    setBaloncuk(kutu);
    if (kutu) setSecilenAygit(kutu.deviceKey);
    if (!kutu || !canEdit || e.pointerType === "touch") return;

    basladi.current = nokta;
    setSurukleme({ kutu, x: nokta.x, y: nokta.y });
    setHedef(null);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function semadaSurukle(e: React.PointerEvent<SVGRectElement>) {
    if (!surukleme || !basladi.current) return;
    const nokta = noktaCoz(e);
    if (!nokta) return;
    setSurukleme({ ...surukleme, x: nokta.x, y: nokta.y });
    const uzaklik = Math.hypot(nokta.x - basladi.current.x, nokta.y - basladi.current.y);
    setHedef(uzaklik < SURUKLEME_ESIGI ? null : hedefCoz(nokta, surukleme.kutu.deviceKey));
  }

  function semadaBirak(e: React.PointerEvent<SVGRectElement>) {
    const tasinan = surukleme;
    const baslangic = basladi.current;
    setSurukleme(null);
    setHedef(null);
    basladi.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!tasinan || !baslangic || !aktif) return;

    const nokta = noktaCoz(e);
    if (!nokta) return;
    // EŞİĞİN ALTI BİR TIKLAMADIR: elin titremesi bir aygıtı taşımamalı.
    if (Math.hypot(nokta.x - baslangic.x, nokta.y - baslangic.y) < SURUKLEME_ESIGI) return;

    // TÜR SINIRI: DIN cihazı plaka cihazının yanına bırakıldıysa söylenir,
    // sessizce yok sayılmaz (Plan S3).
    const yakin = cizim ? kutuBul(cizim.kutular, nokta.x, nokta.y, 40) : null;
    if (yakin && turu(yakin.deviceKey) !== turu(tasinan.kutu.deviceKey)) {
      toast.error(
        turu(tasinan.kutu.deviceKey) === "din"
          ? "Ray cihazı plakaya vidalanan cihazın yanına taşınamaz; montaj tipini aygıt formundan değiştirin."
          : "Plaka cihazı ray cihazının yanına taşınamaz; montaj tipini aygıt formundan değiştirin."
      );
      return;
    }
    const karar = hedefCoz(nokta, tasinan.kutu.deviceKey);
    if (karar === null) return;

    void calistir(
      () =>
        movePlacement({
          projectId,
          deviceKey: tasinan.kutu.deviceKey,
          anchorDeviceKey: karar.komsu,
          anchorSide: karar.yon,
          railIndex: null,
        }),
      `${tasinan.kutu.label} taşındı ve sabitlendi.`
    );
  }

  const bitti = () => router.refresh();

  if (!aktif || !cizim) {
    return (
      <main className="grid gap-4 p-4 md:p-6">
        <Baslik docNo={docNo} projectName={projectName} projectId={projectId} />
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Bu projede çizilecek pano yok.
        </div>
      </main>
    );
  }

  const govdeGerec = [...aktif.bodyDevices, ...aktif.sideDevices];

  return (
    <main className="grid gap-5 p-4 md:p-6">
      <SectionBottomBar label="Pano iç yerleşimi" priority={40} items={[{id:"panels",label:"Panolar",icon:"boxes",onSelect:()=>openBottomTool("pano-controls")},{id:"layout",label:"Yerleşim",icon:"grid",active:true,onSelect:()=>svgRef.current?.scrollIntoView({block:"center"})},{id:"check",label:"Denetim",icon:"tasks",onSelect:()=>document.getElementById("pano-inner-check")?.scrollIntoView({block:"start"})}]} more={[{id:"settings",label:"Ölçek ve dışa aktarım",icon:"settings",onSelect:()=>openBottomTool("pano-controls")},{id:"back",label:"Pano Yerleşimi",href:`/projects/${projectId}/pano`,icon:"back"}]} />
      <Baslik docNo={docNo} projectName={projectName} projectId={projectId} />

      {/* ————————————————————————————————————— üst bar */}
      <BottomToolPanel id="pano-controls" title="Panolar ve görünüm"><div className="sticky top-[var(--app-header-h,48px)] z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2 md:-mx-6 md:px-6">
        <Button size="sm" variant="ghost" asChild>
          <Link href={`/projects/${projectId}/pano`}>
            <ArrowLeft className="size-3.5" /> Pano Yerleşimi
          </Link>
        </Button>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Pano
          <select
            value={aktif.code}
            onChange={(e) => adresYaz("pano", e.target.value)}
            className="oc-tap h-9 rounded-md border bg-background px-2 text-base pointer-fine:text-sm"
            aria-label="Pano seç"
          >
            {panolar.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Ölçek
          <select
            value={String(olcek)}
            onChange={(e) => adresYaz("olcek", e.target.value)}
            className="oc-tap h-9 rounded-md border bg-background px-2 text-base pointer-fine:text-sm"
            aria-label="Şema ölçeği"
          >
            {IC_OLCEKLERI.map((n) => (
              <option key={n} value={n}>
                {olcekMetni(n)}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto">
          <Button size="sm" variant="outline" asChild>
            <a href={`/projects/${projectId}/pano/svg?${arama.toString()}`}>
              <Download className="size-3.5" /> Bu panonun SVG&apos;si
            </a>
          </Button>
        </div>
      </div></BottomToolPanel>

      <div id="pano-inner-check" className="scroll-mt-20">
        <h2 className="text-base font-semibold">{aktif.code} iç yerleşimi</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {sayi(aktif.widthMm)} × {sayi(aktif.heightMm)} × {sayi(aktif.depthMm)} mm ·{" "}
          {aktif.rails.length} ray · doluluk %{Math.round(aktif.fillRatio * 100)} ·{" "}
          {aktif.placements.length} yerleşim
        </p>
      </div>

      {aktif.warnings.length > 0 && (
        <ul className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
          {aktif.warnings.map((u) => (
            <li key={u}>· {u}</li>
          ))}
        </ul>
      )}

      {/* ————————————————————————————————————— tıklanabilir plaka şeması */}
      {/* SÜRÜKLEME KEŞFEDİLEBİLİR OLMALI: hiçbir imleç değişikliği "bu cihaz
          taşınabilir" demiyor ve kullanıcı denemeyi akıl etmezse yetenek yok
          sayılır. */}
      <p className="text-xs text-muted-foreground">
        Bir cihaza tıklayın: ne olduğu, ölçüsü ve ölçünün kaynağı görünür.
        {canEdit &&
          " Fareyle bir komşunun yanına sürükleyin; cihaz o komşuluğa SABİTLENİR ve Kararlar bölümünde listelenir. Ray cihazı plaka cihazının yanına taşınamaz."}
      </p>
      <div className="relative">
        <SemaKabi>
          <DiagramSvg
            diagram={cizim.diagram}
            themeAware
            svgRef={svgRef}
            ariaLabel={`${aktif.code} iç yerleşimi`}
            overlay={
              <>
                {/* BIRAKMA GÖSTERGESİ: aygıtın hangi KOMŞULUĞA gideceğini
                    söyleyen dikey çizgi. Koordinat değil SIRA taşınıyor
                    (PANO-23), o yüzden gösterge bir hayalet kutu değil bir
                    EKLEME NOKTASIDIR. */}
                {surukleme && hedef !== null && (() => {
                  const k = cizim.kutular.find((x) => x.deviceKey === hedef.komsu);
                  if (!k) return null;
                  const xCizgi = hedef.yon === "once" ? k.x - 1.5 : k.x + k.w + 1.5;
                  return (
                    <line
                      x1={xCizgi}
                      y1={k.y - 3}
                      x2={xCizgi}
                      y2={k.y + k.h + 3}
                      stroke="var(--oc-diagram-accent)"
                      strokeWidth={2}
                      pointerEvents="none"
                    />
                  );
                })()}

                {/* Sürüklenen aygıtın kendisi soluklaşır. */}
                {surukleme && (
                  <rect
                    x={surukleme.kutu.x}
                    y={surukleme.kutu.y}
                    width={surukleme.kutu.w}
                    height={surukleme.kutu.h}
                    fill="var(--oc-diagram-canvas)"
                    fillOpacity={0.55}
                    stroke="var(--oc-diagram-accent)"
                    strokeWidth={1.2}
                    strokeDasharray="3 2"
                    pointerEvents="none"
                  />
                )}

                {/* Seçili cihazın vurgusu — "tıkladım" geri bildirimi. */}
                {baloncuk && (
                  <rect
                    x={baloncuk.x}
                    y={baloncuk.y}
                    width={baloncuk.w}
                    height={baloncuk.h}
                    fill="none"
                    stroke="var(--oc-diagram-accent)"
                    strokeWidth={1.6}
                    pointerEvents="none"
                  />
                )}
                {/* TEK SAYDAM DİKDÖRTGEN, nokta sınamasıyla. Cihaz başına bir
                    hedef çizmek en kalabalık panoda 659 düğüm demekti ve o
                    düğümlerin çoğu 1,3 birimlik klemenslerdir: üst üste binen
                    44 px hedefler (MOBIL-28'in ölçülmüş hatası). */}
                <rect
                  x={cizim.diagram.x0 ?? 0}
                  y={cizim.diagram.y0 ?? 0}
                  width={cizim.diagram.width}
                  height={cizim.diagram.height}
                  fill="transparent"
                  onPointerDown={semayaBas}
                  onPointerMove={semadaSurukle}
                  onPointerUp={semadaBirak}
                  onPointerCancel={semadaBirak}
                  style={{ cursor: surukleme ? "grabbing" : "pointer" }}
                />
              </>
            }
          />
        </SemaKabi>

        {baloncuk && (
          <AygitBaloncugu
            kutu={baloncuk}
            device={kutular.get(baloncuk.deviceKey) ?? null}
            projectId={projectId}
            canEdit={canEdit}
            sira={turIcindeSira(baloncuk.deviceKey).sira}
            adet={turIcindeSira(baloncuk.deviceKey).adet}
            onKaydir={(yon) => kaydir(baloncuk.deviceKey, yon)}
            onSerbest={() =>
              void calistir(
                () => unpinPlacement(projectId, baloncuk.deviceKey),
                "Sabitleme kaldırıldı; sıra sisteme döndü."
              )
            }
            onKapat={() => setBaloncuk(null)}
            onBitti={bitti}
          />
        )}
      </div>


      {govdeGerec.length > 0 && <GovdeGerecleri
        projectId={projectId}
        canEdit={canEdit}
        gerecler={govdeGerec}
        onBitti={bitti}
      />}

      {canEdit && secilenAygit && (
        <AygitFormu
          projectId={projectId}
          panel={aktif}
          deviceKey={secilenAygit}
          panolar={panolar}
          onBitti={bitti}
        />
      )}

      <CihazListesi panel={aktif} secilen={secilenAygit} onSec={setSecilenAygit} />
    </main>
  );
}

/**
 * ŞEMADAKİ CİHAZIN KİMLİK KARTI.
 *
 * Ölçü kaynağı özellikle görünür: "tahmin" yazan bir satır sipariş edilemez
 * (PANO-12) ve kullanıcı bunu şemaya bakarken bilmelidir.
 */
function AygitBaloncugu({
  kutu,
  device,
  projectId,
  canEdit,
  sira,
  adet,
  onKaydir,
  onSerbest,
  onKapat,
  onBitti,
}: {
  kutu: IcKutu;
  device: DeviceBox | null;
  projectId: string;
  canEdit: boolean;
  /** Aygıtın panonun sırasındaki yeri (0 tabanlı); bulunamazsa -1. */
  sira: number;
  adet: number;
  onKaydir: (yon: -1 | 1) => void;
  onSerbest: () => void;
  onKapat: () => void;
  onBitti: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label={`${kutu.label} bilgisi`}
      className="absolute left-2 top-2 z-10 w-[min(20rem,calc(100vw-2.5rem))] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{kutu.label}</span>
            {kutu.no !== null && (
              <Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
                #{kutu.no}
              </Badge>
            )}
          </div>
          {device && (
            <p className="mt-0.5 text-xs text-muted-foreground">{device.designation}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onKapat}
          className="oc-tap text-xs text-muted-foreground hover:text-foreground"
          aria-label="Kapat"
        >
          ✕
        </button>
      </div>

      {device ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Ürün</dt>
          <dd className="font-mono">
            {device.supplier} {device.typeNo || "—"}
          </dd>
          <dt className="text-muted-foreground">Kategori</dt>
          <dd>{device.category}</dd>
          <dt className="text-muted-foreground">Yer</dt>
          <dd>
            {device.mountType ? MOUNT_LABEL[device.mountType] : "—"}
            {device.zone ? ` · ${ZONE_LABEL[device.zone]}` : ""}
          </dd>
          <dt className="text-muted-foreground">Renk grubu</dt>
          <dd>{COLOR_GROUP_LABEL[device.colorGroup]}</dd>
          <dt className="text-muted-foreground">Ölçü</dt>
          <dd>
            {device.widthMm !== null
              ? `${sayi(device.widthMm)} × ${sayi(device.heightMm ?? 0)} × ${sayi(
                  device.depthMm ?? 0
                )} mm`
              : "bilinmiyor"}
            {device.unitCount > 1 && ` · ${sayi(device.unitCount)} birim`}
          </dd>
          <dt className="text-muted-foreground">Kaynak</dt>
          <dd>
            {device.dimSource === "tahmin" ? (
              <span className="text-amber-700 dark:text-amber-400">
                tahmin — sipariş edilemez
              </span>
            ) : (
              (device.dimSource ?? "—")
            )}
          </dd>
        </dl>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Bu cihazın kaydı yerleşim dışında; ayrıntı için cihaz listesine bakın.
        </p>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
          {/* SÜRÜKLEMENİN KLAVYE VE DOKUNMATİK KARŞILIĞI. Fareyle şemada
              sürüklemek daha hızlı ama tek yol OLAMAZ: sürükleme klavyeyle
              erişilemez ve dokunmatikte şemanın yatay kaydırmasını yer. */}
          <span className="text-[11px] text-muted-foreground">
            Sıra {sira >= 0 ? `${sira + 1}/${adet}` : "—"}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            disabled={sira <= 0}
            onClick={() => onKaydir(-1)}
            title="Sırada bir öne al"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            disabled={sira < 0 || sira >= adet - 1}
            onClick={() => onKaydir(1)}
            title="Sırada bir arkaya al"
          >
            <ChevronRight className="size-3.5" />
          </Button>
          {device?.pinned ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={onSerbest}
              title="Sabitlemeyi kaldır — sıra sisteme döner"
            >
              <PinOff className="size-3.5" /> Serbest bırak
            </Button>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Pin className="size-3" /> serbest
            </span>
          )}
          {device && device.typeNo && (
            <div className="ml-auto">
              <OlcuDiyalogu projectId={projectId} device={device} onBitti={onBitti} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * GÖVDE GEREÇLERİ ve PANO YANI EKİPMAN — çizilmeyen ama sipariş edilen kalemler.
 *
 * Ölçüldü (08.09.2026): `bodyDevices` hesaplanıyor, tipin kendi yorumu "listede
 * durur" diyor ve BÖYLE BİR LİSTE HİÇBİR YERDE YOKTU. Fan, termostat ve pano
 * lambası ne çizimde ne listede ne kuyrukta görünüyordu — 0026'da dört aygıt
 * sessizce kayıptı.
 */
function GovdeGerecleri({
  projectId,
  canEdit,
  gerecler,
  onBitti,
}: {
  projectId: string;
  canEdit: boolean;
  gerecler: DeviceBox[];
  onBitti: () => void;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <h3 className="oc-kicker border-b px-4 py-3 text-foreground/80">
        Gövde gereçleri ve pano yanı ({sayi(gerecler.length)})
      </h3>
      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Bunlar montaj plakasına yerleşmez — fan, termostat ve pano lambası gövdeye,
        siren ve projektör panonun yanına gider. Sipariş listesine girer, iç
        yerleşim çizimine girmez.
      </p>
      <ul className="grid gap-1 p-4 text-xs">
        {gerecler.map((d) => (
          <li key={d.key} className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold">{d.label}</span>
            <Badge variant="outline" className="px-1 py-0 text-[10px]">
              {d.mountType ? MOUNT_LABEL[d.mountType] : "—"}
            </Badge>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {d.supplier} {d.typeNo} — {d.designation}
            </span>
            <span className="font-mono text-muted-foreground">
              {d.widthMm !== null
                ? `${sayi(d.widthMm)}×${sayi(d.heightMm ?? 0)}×${sayi(d.depthMm ?? 0)}`
                : "ölçü yok"}
            </span>
            {canEdit && d.typeNo && (
              <OlcuDiyalogu projectId={projectId} device={d} onBitti={onBitti} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
