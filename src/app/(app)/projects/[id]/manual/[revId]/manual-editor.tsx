"use client";

// EL KİTABI EDİTÖRÜ — bölüm bölüm ilerleyen sihirbaz.
//
// DÜZEN HESAP RAPORU EDİTÖRÜNÜN KARDEŞİDİR (kullanıcı isteği, 19.08.2026:
// *"Hesap raporu yaptığımız bölüm gibi, başlıklara ayrılan…"*): solda bölüm
// ağacı, sağda O bölümün içeriği. Bütün bölümleri tek uzun sayfaya basmak,
// 40'tan fazla alt bölümlü bir belgede kaydırmayı yönetilemez yapardı.
//
// ÜÇ DÜZENLEME KİPİ VE HEPSİ AYNI BLOKTA:
//   STANDART METİN — şablondan gelir, DEĞİŞTİRİLEBİLİR. İlk dokunuşta
//     `edited` açılır; blok "standarttan ayrıldı" rozetini taşır ve
//     "Standarda Dön" ile geri alınabilir.
//   SERBEST İÇERİK — kullanıcının eklediği paragraf, liste, uyarı, tablo,
//     görsel.
//   OTOMATİK TABLO — kaynağından ÜRETİLİR, elle yazılmaz. Taslakta canlıdır
//     (kaynak değişince tazelenir), yayımda donar.
//
// GİZLEMEK SİLMEK DEĞİLDİR (TEKLIF-4): gizlenen bölüm/blok solgun ama
// düzenlenebilir kalır, verisi korunur ve BELGEYE HİÇ GİRMEZ.
//
// KAYDETME AÇIKTIR, otomatik değil: yayımlanmış bir belgenin taslağında
// arka planda dolaşan bir kaydedici, hangi hâlin kaydedildiğini
// belirsizleştirirdi. Kaydedilmemiş değişiklik varken sayfadan çıkış uyarır.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Circle,
  CircleCheck,
  Columns2,
  Eye,
  EyeOff,
  FileDown,
  Image as ImageIcon,
  Layers,
  List,
  Loader2,
  PanelRightClose,
  Plus,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Table as TableIcon,
  Trash2,
  TriangleAlert,
  Type,
} from "lucide-react";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ManualImageRow } from "@/lib/manual/data";
import { manualAsset } from "@/lib/manual/assets";
import { ManualPaper, manualOnizlemeOlcusu } from "@/components/manual/manual-paper";
import { useManualImages } from "@/components/manual/use-manual-images";
import {
  manualFillState,
  manualPublishReadiness,
  manualSectionGuide,
  type ManualFillState,
} from "@/lib/manual/guide";
import { manualDocCode, MANUAL_DOC_TITLE } from "@/lib/manual/naming";
import {
  blockHasContent,
  flattenManual,
  numberManual,
  type NumberedSection,
} from "@/lib/manual/payload";
import { MANUAL_TEMPLATE } from "@/lib/manual/template";
import { autoTableFor, type ManualSourceData } from "@/lib/manual/sources";
import {
  MANUAL_APPENDIX_LABELS,
  MANUAL_AUTO_LABELS,
  MANUAL_NOTE_LABELS,
  MANUAL_NOTE_LEVELS,
  type ManualBlock,
  type ManualIdentity,
  type ManualNoteLevel,
  type ManualPartnerLogos,
  type ManualPayload,
  type ManualSection,
} from "@/lib/manual/types";
import { issueManualRevision, saveManualRevision } from "../actions";

/** Görsel kovasının sınırı 25 MB; istemci de aynı sayıyı bilir. */
const EN_BUYUK_GORSEL = 26_214_400;

/** Şablonun anahtar → standart blok haritası: "Standarda Dön" bunu okur. */
const SABLON_BLOKLARI = (() => {
  const harita = new Map<string, { kind: string; text?: string; items?: string[] }[]>();
  const gez = (liste: typeof MANUAL_TEMPLATE) => {
    for (const s of liste) {
      harita.set(s.key, (s.blocks ?? []) as never);
      if (s.children) gez(s.children);
    }
  };
  gez(MANUAL_TEMPLATE);
  return harita;
})();

// ————————————————————————————————————————————————————— ağaç yardımcıları

/** Ağaçtaki bir bölümü kimliğiyle değiştirir (saf; yeni ağaç döner). */
function bolumDegistir(
  sections: ManualSection[],
  id: string,
  degistir: (s: ManualSection) => ManualSection
): ManualSection[] {
  return sections.map((s) =>
    s.id === id ? degistir(s) : { ...s, children: bolumDegistir(s.children, id, degistir) }
  );
}

function bolumBul(sections: readonly ManualSection[], id: string): ManualSection | null {
  for (const s of sections) {
    if (s.id === id) return s;
    const alt = bolumBul(s.children, id);
    if (alt) return alt;
  }
  return null;
}

/** Editör boş bir bölüm kabıyla değil, yapılacak ilk gerçek işle açılır. */
function ilkCalismaBolumu(sections: readonly ManualSection[]): string {
  const duz = flattenManual(numberManual(sections));
  return (
    duz.find((s) => !s.appendix && editorBolumDurumu(s) === "bos")?.id ??
    duz.find((s) => s.blocks.length > 0 || s.appendix)?.id ??
    duz[0]?.id ??
    ""
  );
}

let sayac = 0;
const yeniId = (): string => `y${Date.now().toString(36)}${(sayac++).toString(36)}`;

// ————————————————————————————————————————————————————————————— bileşen

export function ManualEditor({
  projectId,
  revisionId,
  revNo,
  status,
  label,
  initialPayload,
  sources,
  images,
  itemNo,
  canEdit,
}: {
  projectId: string;
  revisionId: string;
  revNo: number;
  status: "draft" | "issued";
  label: string;
  initialPayload: ManualPayload;
  sources: ManualSourceData;
  images: ManualImageRow[];
  itemNo: string;
  canEdit: boolean;
}) {
  const [payload, setPayload] = useState<ManualPayload>(initialPayload);
  const [imageRows, setImageRows] = useState<ManualImageRow[]>(images);
  const [etiket, setEtiket] = useState(label);
  const [seciliId, setSeciliId] = useState<string>(() => ilkCalismaBolumu(initialPayload.sections));
  const [kirli, setKirli] = useState(false);
  const [kaydediliyor, kaydetBasla] = useTransition();
  const [yayimlaniyor, yayimlaBasla] = useTransition();
  const [kunyeAcik, setKunyeAcik] = useState(false);
  const [darGorunum, setDarGorunum] = useState<"duzenle" | "kagit">("duzenle");
  const [yayimOnayi, setYayimOnayi] = useState(false);
  /**
   * KÂĞIT AÇIK MI — kullanıcı kararı, ekran genişliği değil.
   *
   * Öntanım AÇIK: kullanıcının şikâyeti tam olarak "ne yaptığını
   * anlayamıyor"du ve önizlemeyi bulmak için bir düğmeye basmak gerekseydi
   * çözüm o şikâyetin altında kalırdı. Dar ekranda ikisi yan yana sığmaz;
   * orada düğme ikisi arasında GEÇİŞ yapar.
   */
  const [kagitAcik, setKagitAcik] = useState(true);

  // YAYIMLANMIŞ REVİZYON SALT OKUNURDUR — engel DB tetikleyicisindedir
  // (`guard_issued_manual_revision`), buradaki yalnız ekranı dürüst tutar.
  const yazilabilir = canEdit && status === "draft";

  const numarali = useMemo(() => numberManual(payload.sections), [payload.sections]);
  const duz = useMemo(() => flattenManual(numarali), [numarali]);

  const secili = useMemo(() => bolumBul(payload.sections, seciliId), [payload.sections, seciliId]);
  const seciliNumarali = useMemo(
    () => duz.find((s) => s.id === seciliId) ?? null,
    [duz, seciliId]
  );

  const gorselHaritasi = useMemo(() => {
    const m = new Map<string, ManualImageRow>();
    for (const g of imageRows) m.set(g.id, g);
    return m;
  }, [imageRows]);

  // KÂĞIDIN GÖRSELLERİ: şablon varlıkları statik, yüklenenler TEK TURDA
  // imzalanır (`use-manual-images.ts`).
  const kagitGorselleri = useManualImages(imageRows);
  const oranlar = useMemo(() => {
    const m = new Map<string, number>();
    for (const [k, g] of kagitGorselleri) m.set(k, g.oran);
    return m;
  }, [kagitGorselleri]);

  // YERLEŞİM ÇEKİRDEĞİ BURADA DA ÇALIŞIR: bölümün belgede KAÇINCI YAPRAĞA
  // düştüğü ancak bütün dağıtım bitince belli olur (KITAP-14 md. 2) ve
  // editörde bunu göstermenin başka yolu yok.
  const olcu = useMemo(
    () => manualOnizlemeOlcusu(payload, sources, oranlar),
    [payload, sources, oranlar]
  );

  /** Gövde indirmesinin toplamı: kapak + dizin + kesintisiz bölüm akışı. */
  const yaprakSayisi = olcu.govdeOfset + olcu.sayfalar.length;

  /** İstemci ve sunucu AYNI saf yayım kalite kapısını kullanır. */
  const yayimHazirligi = useMemo(() => manualPublishReadiness(payload), [payload]);
  const eksikBolumler = yayimHazirligi.missingSections;
  const eksikKunye = yayimHazirligi.missingIdentity;
  const eksikKimlikleri = useMemo(
    () => new Set(eksikBolumler.map((s) => s.id)),
    [eksikBolumler]
  );
  const kalanIs = eksikKunye.length + eksikBolumler.length;

  /** Sıradaki gerçek yayım eksiği — standart metinler "iş" gibi sayılmaz. */
  const sonrakiBos = useMemo(() => {
    if (eksikBolumler.length === 0) return null;
    const i = eksikBolumler.findIndex((s) => s.id === seciliId);
    return eksikBolumler[(i + 1) % eksikBolumler.length] ?? eksikBolumler[0];
  }, [eksikBolumler, seciliId]);

  /** Sol ray yalnız ana bölümleri, orta seçici o bölümün gerçek çalışma yüzlerini taşır. */
  const seciliKok = useMemo(
    () => numarali.find((kok) => flattenManual([kok]).some((s) => s.id === seciliId)) ?? numarali[0] ?? null,
    [numarali, seciliId]
  );
  const kokIciBolumler = useMemo(
    () => seciliKok
      ? flattenManual([seciliKok]).filter((s) => s.blocks.length > 0 || Boolean(s.appendix))
      : [],
    [seciliKok]
  );
  const seciliSira = kokIciBolumler.findIndex((s) => s.id === seciliId);
  const oncekiBolum = seciliSira > 0 ? kokIciBolumler[seciliSira - 1] : null;
  const sonrakiBolum = seciliSira >= 0 && seciliSira < kokIciBolumler.length - 1
    ? kokIciBolumler[seciliSira + 1]
    : null;

  // KAYDEDİLMEMİŞ DEĞİŞİKLİKLE ÇIKIŞ UYARIR. Bir kılavuzda yarım saatlik
  // yazının sekme kapanınca kaybolması, kullanıcının bir daha o ekrana
  // güvenmemesi demektir.
  useEffect(() => {
    if (!kirli) return;
    const uyar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", uyar);
    return () => window.removeEventListener("beforeunload", uyar);
  }, [kirli]);

  const guncelle = useCallback((f: (p: ManualPayload) => ManualPayload) => {
    setPayload((p) => f(p));
    setKirli(true);
  }, []);

  /**
   * TEK GÖRSEL YÜKLEME HATTI — içerik resmi, kapak fotoğrafı ve partner
   * logoları aynı sunucu doğrulamasından geçer. Cevaptaki ölçülmüş kayıt
   * yerel listeye hemen eklenir; sayfa yenilemeden kartta ve kâğıtta görünür.
   */
  const gorselYukle = useCallback(async (file: File): Promise<ManualImageRow | null> => {
    if (file.size > EN_BUYUK_GORSEL) {
      toast.error("Görsel 25 MB sınırını aşıyor.");
      return null;
    }
    try {
      const govde = new FormData();
      govde.set("dosya", file);
      const r = await fetch(`/projects/${projectId}/manual/${revisionId}/gorsel`, {
        method: "POST",
        body: govde,
      });
      const j = (await r.json()) as { image?: ManualImageRow; error?: string };
      if (!r.ok || j.error || !j.image) {
        toast.error(j.error ?? "Görsel yüklenemedi.");
        return null;
      }
      setImageRows((onceki) =>
        onceki.some((g) => g.id === j.image!.id) ? onceki : [...onceki, j.image!]
      );
      return j.image;
    } catch {
      toast.error("Görsel yüklenemedi. Ağ bağlantısını denetleyin.");
      return null;
    }
  }, [projectId, revisionId]);

  const bolumGuncelle = useCallback(
    (id: string, f: (s: ManualSection) => ManualSection) => {
      guncelle((p) => ({ ...p, sections: bolumDegistir(p.sections, id, f) }));
    },
    [guncelle]
  );

  const blokGuncelle = useCallback(
    (bolumId: string, blokId: string, f: (b: ManualBlock) => ManualBlock) => {
      bolumGuncelle(bolumId, (s) => ({
        ...s,
        // HER DÜZENLEME `edited` AÇAR: şablon tazelemesi kullanıcının yazdığını
        // bir daha ezmez (`types.ts` başlığı).
        blocks: s.blocks.map((b) => (b.id === blokId ? { ...f(b), edited: true } : b)),
      }));
    },
    [bolumGuncelle]
  );

  function kaydet(sonra?: () => void) {
    kaydetBasla(async () => {
      const r = await saveManualRevision(projectId, {
        revisionId,
        payload,
        label: etiket,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setKirli(false);
      toast.success("Kaydedildi.");
      sonra?.();
    });
  }

  function yayimla() {
    if (kirli) {
      toast.error("Önce kaydedin — yayımlanan belge kaydedilmiş hâldir.");
      return;
    }
    if (eksikKunye.length > 0) {
      setKunyeAcik(true);
      toast.error(`Yayım için eksik künye alanları: ${eksikKunye.join(", ")}.`);
      return;
    }
    if (eksikBolumler.length > 0) {
      setSeciliId(eksikBolumler[0].id);
      toast.error(
        `${eksikBolumler.length} vince özel bölüm bekliyor. Bölümü doldurun veya bilinçli olarak gizleyin.`
      );
      return;
    }
    setYayimOnayi(true);
  }

  function yayimlaOnayli() {
    setYayimOnayi(false);
    yayimlaBasla(async () => {
      const r = await issueManualRevision(projectId, revisionId);
      if (r.error) toast.error(r.error);
      else window.location.reload();
    });
  }

  return (
    <div className="grid gap-4">
      {/* ————————————————————————————————————————————— üst şerit */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Badge variant={status === "issued" ? "default" : "secondary"}>
          {status === "issued" ? "Yayınlandı" : "Taslak"}
        </Badge>
        <span className="font-mono text-sm text-muted-foreground">
          {manualDocCode(itemNo, revNo)}
        </span>
        <span className="text-sm text-muted-foreground">
          · {numarali.length} ana bölüm · gövde {yaprakSayisi} yaprak
        </span>
        {kirli && (
          <span className="inline-flex items-center gap-1 text-sm text-destructive">
            <TriangleAlert className="size-3.5" /> Kaydedilmedi
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            className="2xl:hidden"
            size="sm"
            variant={darGorunum === "kagit" ? "secondary" : "outline"}
            onClick={() => {
              setKagitAcik(true);
              setDarGorunum((v) => (v === "kagit" ? "duzenle" : "kagit"));
            }}
            aria-pressed={darGorunum === "kagit"}
          >
            {darGorunum === "kagit" ? (
              <PanelRightClose className="size-3.5" />
            ) : (
              <Columns2 className="size-3.5" />
            )}
            {darGorunum === "kagit" ? "Düzenle" : "Kâğıt"}
          </Button>
          <Button
            className="hidden 2xl:inline-flex"
            size="sm"
            variant={kagitAcik ? "secondary" : "outline"}
            onClick={() => setKagitAcik((v) => !v)}
            aria-pressed={kagitAcik}
          >
            {kagitAcik ? (
              <PanelRightClose className="size-3.5" />
            ) : (
              <Columns2 className="size-3.5" />
            )}
            Kâğıt
          </Button>
          <Button size="sm" variant="outline" onClick={() => setKunyeAcik((v) => !v)}>
            <BookOpen className="size-3.5" /> {kunyeAcik ? "İçeriğe Dön" : "Künye"}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <PdfDownloadLink
              href={`/projects/${projectId}/manual/${revisionId}/pdf`}
              disabled={kirli}
              shareTitle="İşletme ve Bakım El Kitabı"
              title={kirli ? "PDF için önce değişiklikleri kaydedin" : "Gövde PDF'i indir"}
            >
              <FileDown className="size-3.5" /> Gövde PDF
            </PdfDownloadLink>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <PdfDownloadLink
              href={`/projects/${projectId}/manual/${revisionId}/pdf?ekler=1`}
              disabled={kirli}
              shareTitle="İşletme ve Bakım El Kitabı · Tam Sürüm"
              title={kirli ? "PDF için önce değişiklikleri kaydedin" : "Tam sürümü indir"}
            >
              <Layers className="size-3.5" /> Tam Sürüm
            </PdfDownloadLink>
          </Button>
          {yazilabilir && (
            <>
              <Button size="sm" onClick={() => kaydet()} disabled={kaydediliyor || !kirli}>
                {kaydediliyor ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Kaydet
              </Button>
              <Button size="sm" variant="outline" onClick={yayimla} disabled={yayimlaniyor}>
                {yayimlaniyor ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Yayımla
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KALİTE KAPISI İLERLEME YÜZDESİ DEĞİLDİR: kullanıcıya yayıma engel
          olan somut işleri söyler; standart metinler sahte ilerleme yaratmaz. */}
      <div className="grid gap-3 border border-l-2 border-l-primary bg-card p-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid gap-1">
          <span className="oc-kicker">YAYIM KONTROLÜ</span>
          <p className="text-base font-semibold">
            {kalanIs === 0 ? "Yayıma hazır" : `${kalanIs} iş kaldı`}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {eksikKunye.length > 0
              ? `${eksikKunye.length} künye alanı ve ${eksikBolumler.length} vince özel bölüm bekliyor.`
              : eksikBolumler.length > 0
                ? `${eksikBolumler.length} vince özel bölüm doldurulmalı veya bilinçli olarak gizlenmeli.`
                : `Künye ve içerik tamam · Gövde ${yaprakSayisi} yaprak.`}
          </p>
        </div>
        {eksikKunye.length > 0 ? (
          <Button size="sm" variant="outline" onClick={() => setKunyeAcik(true)}>
            <BookOpen className="size-3.5" /> Künyeyi Tamamla
          </Button>
        ) : sonrakiBos ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setKunyeAcik(false);
              setSeciliId(sonrakiBos.id);
            }}
          >
            <ArrowRight className="size-3.5" /> Sonraki İşi Aç
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-sm text-primary">
            <CircleCheck className="size-4" /> Kontroller tamam
          </div>
        )}
      </div>

      {kunyeAcik && (
        <div className="grid gap-3">
          <div className="border bg-card p-3">
            <span className="oc-kicker">1 · BELGE KİMLİĞİ</span>
            <h2 className="mt-1 text-lg font-semibold">Kapak, marka ortaklığı ve künye</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Bu çalışma yüzü yalnız belgenin kimliğini düzenler. İçeriğe dönmek için üstteki
              “İçeriğe Dön” düğmesini kullanın.
            </p>
          </div>
          <KunyeFormu
          identity={payload.identity}
          docTitle={payload.docTitle || MANUAL_DOC_TITLE}
          coverTitle={payload.coverTitle}
          etiket={etiket}
          readOnly={!yazilabilir}
          onEtiket={(v) => {
            setEtiket(v);
            setKirli(true);
          }}
          onChange={(alan, deger) =>
            guncelle((p) => ({ ...p, identity: { ...p.identity, [alan]: deger } }))
          }
          onDoc={(alan, deger) => guncelle((p) => ({ ...p, [alan]: deger }))}
          coverImageId={payload.coverImageId}
          partnerLogos={payload.partnerLogos}
          images={gorselHaritasi}
          gorseller={kagitGorselleri}
          onGorselYukle={gorselYukle}
          onCoverImage={(imageId) =>
            guncelle((p) => ({
              ...p,
              ...(imageId ? { coverImageId: imageId } : { coverImageId: undefined }),
            }))
          }
          onPartnerLogo={(slot, imageId) =>
            guncelle((p) => ({
              ...p,
              partnerLogos: { ...p.partnerLogos, [slot]: imageId || undefined },
            }))
          }
          />
        </div>
      )}

      {!kunyeAcik && <div
        className={
          kagitAcik
            ? "grid gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(0,1.05fr)]"
            : "grid gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]"
        }
      >
        {/* ————————————————————————————————————— bölüm ağacı */}
        <nav
          aria-label="El kitabı bölümleri"
          className={`grid content-start gap-2 overflow-y-auto rounded-lg border bg-card p-2 lg:sticky lg:top-2 ${darGorunum === "kagit" ? "max-2xl:hidden" : ""}`}
          style={{ maxHeight: "clamp(24rem, 50dvh, calc(100dvh - 6rem))" }}
        >
          <div className="grid gap-1 border-b px-1 pb-2 pt-1">
            <span className="oc-kicker">2 · İÇERİK</span>
            <strong className="text-sm">Ana bölümler</strong>
            <span className="text-xs leading-relaxed text-muted-foreground">
              Bir ana bölüm seçin; alt başlıkları orta alandaki kısa seçiciden açın.
            </span>
          </div>

          <ul className="grid gap-1">
            {numarali.map((kok) => {
              const kokDali = flattenManual([kok]);
              const eksik = kokDali.filter((s) => eksikKimlikleri.has(s.id)).length;
              const etkin = kok.id === seciliKok?.id;
              return (
                <li key={kok.id}>
                  <button
                    type="button"
                    onClick={() => {
                      const hedef =
                        kokDali.find((s) => eksikKimlikleri.has(s.id)) ??
                        kokDali.find((s) => s.blocks.length > 0 || s.appendix) ??
                        kok;
                      setSeciliId(hedef.id);
                    }}
                    aria-current={etkin ? "page" : undefined}
                    className={`oc-tap flex w-full items-start gap-2 border-l-2 px-2 py-2 text-left ${
                      etkin
                        ? "border-l-primary bg-muted font-medium"
                        : "border-l-transparent hover:bg-muted/60"
                    } ${kok.hidden ? "opacity-45" : ""}`}
                  >
                    {eksik > 0 ? (
                      <Circle className="mt-0.5 size-3.5 shrink-0 text-primary" aria-label="Eksik iş var" />
                    ) : (
                      <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-label="Tamam" />
                    )}
                    <span className="w-7 shrink-0 font-mono text-[11px] text-muted-foreground">
                      {kok.number || "EK"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug">{kok.title}</span>
                      <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                        {eksik > 0 ? `${eksik} iş bekliyor` : "Tamam"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ————————————————————————————————————— bölüm içeriği */}
        <section className={`grid content-start gap-3 ${darGorunum === "kagit" ? "max-2xl:hidden" : ""}`}>
          {seciliKok && kokIciBolumler.length > 0 && (
            <div className="grid gap-2 border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="oc-kicker">{seciliKok.number || "EK"} · {seciliKok.title}</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {kokIciBolumler.length} çalışma yüzü · yalnız seçili başlık düzenlenir
                  </p>
                </div>
                {olcu.sayfaNo.get(seciliId) ? (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    PDF s{olcu.sayfaNo.get(seciliId)}
                  </span>
                ) : null}
              </div>
              <label className="grid gap-1 text-xs text-muted-foreground">
                Bölüm içi gezinme
                <select
                  value={seciliId}
                  onChange={(e) => setSeciliId(e.target.value)}
                  className="h-11 w-full border bg-background px-3 text-base text-foreground sm:text-sm"
                >
                  {kokIciBolumler.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.number || "EK"} · {s.title}{eksikKimlikleri.has(s.id) ? " — DOLDURULACAK" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!oncekiBolum}
                  onClick={() => oncekiBolum && setSeciliId(oncekiBolum.id)}
                >
                  <ArrowLeft className="size-3.5" /> Önceki
                </Button>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {seciliSira >= 0 ? seciliSira + 1 : 0}/{kokIciBolumler.length}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!sonrakiBolum}
                  onClick={() => sonrakiBolum && setSeciliId(sonrakiBolum.id)}
                >
                  Sonraki <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

          {!secili && (
            <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
              Soldan bir bölüm seçin.
            </div>
          )}

          {secili && seciliNumarali && (
            <BolumPaneli
              key={secili.id}
              bolum={secili}
              numarali={seciliNumarali}
              sources={sources}
              images={gorselHaritasi}
              previewImages={kagitGorselleri}
              revisionId={revisionId}
              readOnly={!yazilabilir}
              onBaslik={(v) =>
                bolumGuncelle(secili.id, (s) => ({ ...s, title: v, titleEdited: true }))
              }
              onGizle={() => bolumGuncelle(secili.id, (s) => ({ ...s, hidden: !s.hidden }))}
              onBlok={(blokId, f) => blokGuncelle(secili.id, blokId, f)}
              onBlokSil={(blokId) =>
                bolumGuncelle(secili.id, (s) => ({
                  ...s,
                  blocks: s.blocks.filter((b) => b.id !== blokId),
                }))
              }
              onBlokTasi={(blokId, yon) =>
                bolumGuncelle(secili.id, (s) => {
                  const i = s.blocks.findIndex((b) => b.id === blokId);
                  const j = i + (yon === "yukari" ? -1 : 1);
                  if (i < 0 || j < 0 || j >= s.blocks.length) return s;
                  const kopya = [...s.blocks];
                  [kopya[i], kopya[j]] = [kopya[j], kopya[i]];
                  return { ...s, blocks: kopya };
                })
              }
              onBlokEkle={(blok) =>
                bolumGuncelle(secili.id, (s) => ({ ...s, blocks: [...s.blocks, blok] }))
              }
              onStandardaDon={(blokId) =>
                bolumGuncelle(secili.id, (s) => {
                  const sablon = s.key ? SABLON_BLOKLARI.get(s.key) : undefined;
                  if (!sablon) return s;
                  const i = s.blocks.findIndex((b) => b.id === blokId);
                  if (i < 0) return s;
                  // Şablondaki KAÇINCI blok olduğuna göre eşlenir: anahtar
                  // taşımayan bloklar için sıra tek kimliktir ve kullanıcı
                  // blok eklediyse eşleşme kayabilir — o yüzden tür de sınanır.
                  const kaynak = sablon[i];
                  if (!kaynak || kaynak.kind !== s.blocks[i].kind) return s;
                  const kopya = [...s.blocks];
                  kopya[i] = {
                    ...s.blocks[i],
                    ...(kaynak.text !== undefined ? { text: kaynak.text } : {}),
                    ...(kaynak.items !== undefined ? { items: [...kaynak.items] } : {}),
                    edited: false,
                  } as ManualBlock;
                  return { ...s, blocks: kopya };
                })
              }
              onGorselYukle={gorselYukle}
            />
          )}
        </section>

        {/* ————————————————————————————————————— kâğıt önizlemesi */}
        {kagitAcik && (
          <KagitPaneli
            payload={payload}
            sources={sources}
            gorseller={kagitGorselleri}
            docLine={`ORION CRANES · ${payload.docTitle || MANUAL_DOC_TITLE} · V${revNo} · ${new Date().getFullYear()}`}
            docCode={manualDocCode(itemNo, revNo)}
            vurguId={seciliId}
            sayfa={olcu.sayfaNo.get(seciliId) ?? null}
            className={darGorunum === "duzenle" ? "max-2xl:hidden" : "max-2xl:col-span-full"}
          />
        )}
      </div>}

      <Dialog open={yayimOnayi} onOpenChange={setYayimOnayi}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revizyon yayımlansın mı?</DialogTitle>
            <DialogDescription>
              Yayımlanan revizyon değiştirilemez. Sonraki düzeltmeler için yeni bir revizyon açılır.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 border-y py-3 text-sm">
            <p className="flex items-center gap-2"><CircleCheck className="size-4 text-primary" /> Künye alanları tamam</p>
            <p className="flex items-center gap-2"><CircleCheck className="size-4 text-primary" /> Vince özel boş bölüm yok</p>
            <p className="flex items-center gap-2"><CircleCheck className="size-4 text-primary" /> Kaydedilmiş PDF yayımlanacak</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYayimOnayi(false)}>Vazgeç</Button>
            <Button onClick={yayimlaOnayli} disabled={yayimlaniyor}>
              {yayimlaniyor ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              Yayımla ve Dondur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Editörün doluluk kararı, bölümdeki ZORUNLU şablon boşluklarını da görür.
 * Bir standart paragraf dolu diye aynı bölümdeki vince özel boş blok
 * tamamlanmış sayılamaz; aksi hâlde ilerleme %100'e erken ulaşır.
 */
function editorBolumDurumu(section: ManualSection): ManualFillState {
  if (section.hidden) return "gizli";
  if (section.appendix) return "ek";
  if (section.blocks.some((b) => b.fromTemplate && !b.hidden && !blockHasContent(b))) {
    return "bos";
  }
  return manualFillState(section);
}

/**
 * KÂĞIT PANELİ — belgenin kendi yerleşim çekirdeğiyle çizilmiş A4 yaprakları.
 *
 * SEÇİLİ BÖLÜMÜN YAPRAĞINA KENDİLİĞİNDEN KAYAR. Bir mühendis solda "4.8.3.5
 * Muayene Kriterleri"ni açtığında sağda o bölümün bulunduğu yaprağı görmeli;
 * yirmi yaprağı elle aramak, önizlemeyi hiç açmamakla aynı şeydir.
 *
 * Kaydırma YAZI YAZARKEN TEKRARLANMAZ (`sonYaprak`): her tuş vuruşunda
 * dağıtım yeniden çalışır ve sayfa numarası değişmese bile etki tetiklenirdi;
 * kâğıt her harfte zıplardı.
 */
function KagitPaneli({
  payload,
  sources,
  gorseller,
  docLine,
  docCode,
  vurguId,
  sayfa,
  className,
}: {
  payload: ManualPayload;
  sources: ManualSourceData;
  gorseller: ReadonlyMap<string, { url: string; oran: number }>;
  docLine: string;
  docCode: string;
  vurguId: string;
  sayfa: number | null;
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
    <aside className={`grid content-start gap-2 ${className ?? ""}`}>
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <span className="oc-kicker">KÂĞIT</span>
        <span>
          Gövde yerleşimi — sütun bölünmesi, sayfa kırılması ve numaralar PDF
          ile aynı çekirdekten gelir.
        </span>
      </div>
      {sayfa == null && (
        <p className="border border-dashed p-2 text-xs text-muted-foreground">
          Seçili bölüm şu anda belgeye basılmıyor; boş olabilir ya da gizlenmiş olabilir.
        </p>
      )}
      <div
        ref={kap}
        className="max-h-[calc(100dvh-9rem)] overflow-y-auto bg-muted/40 p-3 lg:sticky lg:top-2"
      >
        <ManualPaper
          payload={payload}
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

// ————————————————————————————————————————————————————————— bölüm paneli

function BolumPaneli({
  bolum,
  numarali,
  sources,
  images,
  previewImages,
  revisionId,
  readOnly,
  onBaslik,
  onGizle,
  onBlok,
  onBlokSil,
  onBlokTasi,
  onBlokEkle,
  onStandardaDon,
  onGorselYukle,
}: {
  bolum: ManualSection;
  numarali: NumberedSection;
  sources: ManualSourceData;
  images: Map<string, ManualImageRow>;
  previewImages: ReadonlyMap<string, { url: string; oran: number }>;
  revisionId: string;
  readOnly: boolean;
  onBaslik: (v: string) => void;
  onGizle: () => void;
  onBlok: (blokId: string, f: (b: ManualBlock) => ManualBlock) => void;
  onBlokSil: (blokId: string) => void;
  onBlokTasi: (blokId: string, yon: "yukari" | "asagi") => void;
  onBlokEkle: (b: ManualBlock) => void;
  onStandardaDon: (blokId: string) => void;
  onGorselYukle: (file: File) => Promise<ManualImageRow | null>;
}) {
  return (
    <div className={`grid gap-3 ${bolum.hidden ? "opacity-60" : ""}`}>
      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{numarali.number}</span>
          <Input
            value={bolum.title}
            disabled={readOnly}
            onChange={(e) => onBaslik(e.target.value)}
            className="h-9 flex-1 min-w-48 text-base font-medium"
          />
          <Button size="sm" variant="outline" onClick={onGizle} disabled={readOnly}>
            {bolum.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {bolum.hidden ? "Gizli" : "Görünür"}
          </Button>
        </div>
        {bolum.hidden && (
          <p className="mt-2 text-xs text-muted-foreground">
            Bu bölüm belgeye HİÇ girmez — başlığı, blokları ve alt bölümleri
            basılmaz. Veri korunur; gizlemek silmek değildir.
          </p>
        )}
        {bolum.appendix && (
          <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <Layers className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <strong>{MANUAL_APPENDIX_LABELS[bolum.appendix]}</strong> eki. Gövde PDF&apos;inde
              görünmez; belge bulunup doğrulandığında &quot;Tam Sürüm&quot; içinde ayraç
              kapağının hemen arkasına yerleştirilir.
            </span>
          </p>
        )}
      </div>

      <BolumRehberi bolum={bolum} />

      {bolum.blocks.map((b, i) => (
        <BlokKarti
          key={b.id}
          blok={b}
          ilk={i === 0}
          son={i === bolum.blocks.length - 1}
          sources={sources}
          images={images}
          previewImages={previewImages}
          revisionId={revisionId}
          readOnly={readOnly}
          onDegis={(f) => onBlok(b.id, f)}
          onSil={() => onBlokSil(b.id)}
          onTasi={(yon) => onBlokTasi(b.id, yon)}
          onStandardaDon={() => onStandardaDon(b.id)}
        />
      ))}

      {!readOnly && <BlokEkleSeridi onEkle={onBlokEkle} onGorselYukle={onGorselYukle} />}
    </div>
  );
}

/**
 * BÖLÜM REHBERİ — "burada ne yapmalısın".
 *
 * Metin çoğunlukla BLOKLARDAN TÜRETİLİR (`lib/manual/guide.ts`): boş bir
 * şablon bloğu "sen dolduracaksın", bir `auto` blok "bu tablo kaynağından
 * gelir" demektir. Seksen beş bölüme elle cümle yazmak, şablon değiştiğinde
 * sessizce yalan söyleyen seksen beş cümle demekti.
 */
function BolumRehberi({ bolum }: { bolum: ManualSection }) {
  const rehber = manualSectionGuide(bolum);
  const renk =
    rehber.tone === "doldur"
      ? "border-l-primary"
      : rehber.tone === "otomatik"
        ? "border-l-[color:var(--oc-steel)]"
        : "border-l-border";
  return (
    <div className={`border border-l-2 bg-card/60 p-3 text-xs leading-relaxed ${renk}`}>
      <p className="text-muted-foreground">{rehber.text}</p>
      {rehber.note && <p className="mt-1.5 text-foreground/80">{rehber.note}</p>}
    </div>
  );
}

// ———————————————————————————————————————————————————————————— blok kartı

function BlokKarti({
  blok,
  ilk,
  son,
  sources,
  images,
  previewImages,
  revisionId,
  readOnly,
  onDegis,
  onSil,
  onTasi,
  onStandardaDon,
}: {
  blok: ManualBlock;
  ilk: boolean;
  son: boolean;
  sources: ManualSourceData;
  images: Map<string, ManualImageRow>;
  previewImages: ReadonlyMap<string, { url: string; oran: number }>;
  revisionId: string;
  readOnly: boolean;
  onDegis: (f: (b: ManualBlock) => ManualBlock) => void;
  onSil: () => void;
  onTasi: (yon: "yukari" | "asagi") => void;
  onStandardaDon: () => void;
}) {
  const basilir = blockHasContent(blok) && !blok.hidden;

  return (
    <div
      className={`rounded-lg border bg-card p-3 ${blok.hidden ? "opacity-50" : ""} ${
        basilir ? "" : "border-dashed"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-muted-foreground">{blokAdi(blok)}</span>
        {blok.fromTemplate && !blok.edited && <Badge variant="secondary">Standart metin</Badge>}
        {blok.fromTemplate && blok.edited && <Badge variant="outline">Standarttan ayrıldı</Badge>}
        {!basilir && !blok.hidden && (
          <span className="text-muted-foreground">boş — belgeye girmez</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!readOnly && blok.fromTemplate && blok.edited && (
            <button
              type="button"
              title="Standart metne dön"
              onClick={onStandardaDon}
              className="oc-tap text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
          {!readOnly && (
            <>
              <button
                type="button"
                title={blok.hidden ? "Göster" : "Gizle"}
                onClick={() => onDegis((b) => ({ ...b, hidden: !b.hidden }))}
                className="oc-tap text-muted-foreground hover:text-foreground"
              >
                {blok.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              <button
                type="button"
                title="Yukarı"
                disabled={ilk}
                onClick={() => onTasi("yukari")}
                className="oc-tap text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                title="Aşağı"
                disabled={son}
                onClick={() => onTasi("asagi")}
                className="oc-tap text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" />
              </button>
              <button
                type="button"
                title="Bloğu sil"
                onClick={onSil}
                className="oc-tap text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {blok.kind === "text" && (
        <div className="grid gap-2">
          <Input
            value={blok.margin ?? ""}
            disabled={readOnly}
            onChange={(e) => onDegis((b) => ({ ...b, margin: e.target.value }) as ManualBlock)}
            placeholder=""
            aria-label="Kenar notu"
            className="h-8 max-w-64 text-xs"
          />
          <Textarea
            value={blok.text}
            disabled={readOnly}
            rows={Math.min(14, Math.max(3, blok.text.split("\n").length + 1))}
            onChange={(e) => onDegis((b) => ({ ...b, text: e.target.value }) as ManualBlock)}
          />
        </div>
      )}

      {blok.kind === "list" && (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={Boolean(blok.ordered)}
              disabled={readOnly}
              onChange={(e) =>
                onDegis((b) => ({ ...b, ordered: e.target.checked }) as ManualBlock)
              }
            />
            Sıra önemli (numaralı liste)
          </label>
          <Textarea
            value={blok.items.join("\n")}
            disabled={readOnly}
            rows={Math.min(16, Math.max(3, blok.items.length + 1))}
            onChange={(e) =>
              onDegis((b) => ({ ...b, items: e.target.value.split("\n") }) as ManualBlock)
            }
          />
          <p className="text-xs text-muted-foreground">Her satır bir madde.</p>
          {blok.ordered && (
            <Input
              value={blok.result ?? ""}
              disabled={readOnly}
              onChange={(e) => onDegis((b) => ({ ...b, result: e.target.value }) as ManualBlock)}
              aria-label="Beklenen sonuç"
              className="h-8 text-sm"
            />
          )}
        </div>
      )}

      {blok.kind === "note" && (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-1">
            {MANUAL_NOTE_LEVELS.map((d) => (
              <button
                key={d}
                type="button"
                disabled={readOnly}
                onClick={() => onDegis((b) => ({ ...b, level: d }) as ManualBlock)}
                className={`oc-tap rounded-md border px-2 py-1 text-xs ${
                  blok.level === d ? "bg-muted font-medium" : "text-muted-foreground"
                }`}
              >
                {MANUAL_NOTE_LABELS[d]}
              </button>
            ))}
          </div>
          <Input
            value={blok.title ?? ""}
            disabled={readOnly}
            onChange={(e) => onDegis((b) => ({ ...b, title: e.target.value }) as ManualBlock)}
            aria-label="Kutu başlığı"
            className="h-8 text-sm"
          />
          <Textarea
            value={blok.text}
            disabled={readOnly}
            rows={Math.min(10, Math.max(2, blok.text.split("\n").length + 1))}
            onChange={(e) => onDegis((b) => ({ ...b, text: e.target.value }) as ManualBlock)}
          />
        </div>
      )}

      {blok.kind === "table" && (
        <TabloDuzenleyici
          table={blok.table}
          readOnly={readOnly}
          onChange={(t) => onDegis((b) => ({ ...b, table: t }) as ManualBlock)}
        />
      )}

      {blok.kind === "image" && (
        <GorselBloku
          blok={blok}
          kayit={blok.imageId ? (images.get(blok.imageId) ?? null) : null}
          gorsel={previewImages.get(blok.assetKey ?? blok.imageId ?? "") ?? null}
          assetKey={blok.assetKey}
          readOnly={readOnly}
          onDegis={onDegis}
        />
      )}

      {blok.kind === "auto" && (
        <OtomatikBlok blok={blok} sources={sources} revisionId={revisionId} onDegis={onDegis} readOnly={readOnly} />
      )}
    </div>
  );
}

function blokAdi(b: ManualBlock): string {
  switch (b.kind) {
    case "text":
      return "Paragraf";
    case "list":
      return b.ordered ? "Numaralı liste" : "Madde listesi";
    case "note":
      return `Uyarı kutusu · ${MANUAL_NOTE_LABELS[b.level]}`;
    case "table":
      return "Tablo";
    case "image":
      return "Görsel";
    case "auto":
      return `Otomatik · ${MANUAL_AUTO_LABELS[b.source]}`;
  }
}

// ———————————————————————————————————————————————————————— otomatik blok

function OtomatikBlok({
  blok,
  sources,
  revisionId,
  onDegis,
  readOnly,
}: {
  blok: Extract<ManualBlock, { kind: "auto" }>;
  sources: ManualSourceData;
  revisionId: string;
  onDegis: (f: (b: ManualBlock) => ManualBlock) => void;
  readOnly: boolean;
}) {
  void revisionId;
  const tablo = autoTableFor(blok, sources);
  return (
    <div className="grid gap-2">
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Sparkles className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Bu tablo <strong>{MANUAL_AUTO_LABELS[blok.source]}</strong> kaynağından üretilir ve
          elle yazılmaz. Taslakta kaynak değişince kendiliğinden tazelenir;{" "}
          <strong>yayımda donar</strong> ve belge bir daha değişmez.
          {blok.frozen && " Bu revizyonda tablo DONMUŞTUR."}
        </span>
      </p>
      {tablo.rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Kaynak boş — bu blok belgeye girmez.
          {!readOnly && (
            <>
              {" "}
              <input
                value={blok.emptyText ?? ""}
                onChange={(e) =>
                  onDegis((b) => ({ ...b, emptyText: e.target.value }) as ManualBlock)
                }
                aria-label="Kaynak boşsa görünecek açıklama"
                className="mt-2 block w-full rounded-md border bg-background px-2 py-1 text-sm"
              />
            </>
          )}
        </div>
      ) : (
        <TabloOnizleme table={tablo} />
      )}
    </div>
  );
}

function TabloOnizleme({ table }: { table: { head: string[]; rows: string[][] } }) {
  const ilk = table.rows.slice(0, 6);
  return (
    <div className="oc-mobile-table-wrap rounded-md border">
      <table className="oc-mobile-table w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            {table.head.map((h, i) => (
              <th key={i} className="px-2 py-1.5 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ilk.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((c, j) => (
                <td
                  key={j}
                  data-label={table.head[j] || `Sütun ${j + 1}`}
                  data-mobile-span={j === 0 ? "full" : undefined}
                  className="px-2 py-1"
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > ilk.length && (
        <div className="border-t px-2 py-1 text-xs text-muted-foreground">
          … toplam {table.rows.length} satır (tamamı belgeye basılır)
        </div>
      )}
    </div>
  );
}

// —————————————————————————————————————————————————————— tablo düzenleyici

function TabloDuzenleyici({
  table,
  readOnly,
  onChange,
}: {
  table: { head: string[]; rows: string[][]; caption?: string };
  readOnly: boolean;
  onChange: (t: { head: string[]; rows: string[][]; caption?: string }) => void;
}) {
  const sutun = Math.max(1, table.head.length);
  return (
    <div className="grid gap-2">
      <div className="oc-scrollx relative overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {table.head.map((h, i) => (
                <th key={i} className="p-0.5">
                  <input
                    value={h}
                    disabled={readOnly}
                    onChange={(e) => {
                      const head = [...table.head];
                      head[i] = e.target.value;
                      onChange({ ...table, head });
                    }}
                    className="w-full rounded border bg-muted/40 px-1.5 py-1 font-medium"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>
                {Array.from({ length: sutun }).map((_, j) => (
                  <td key={j} className="p-0.5">
                    <input
                      value={r[j] ?? ""}
                      disabled={readOnly}
                      onChange={(e) => {
                        const rows = table.rows.map((x) => [...x]);
                        while (rows[i].length < sutun) rows[i].push("");
                        rows[i][j] = e.target.value;
                        onChange({ ...table, rows });
                      }}
                      className="w-full rounded border bg-background px-1.5 py-1"
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td className="p-0.5">
                    <button
                      type="button"
                      title="Satırı sil"
                      onClick={() => onChange({ ...table, rows: table.rows.filter((_, k) => k !== i) })}
                      className="oc-tap text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange({ ...table, rows: [...table.rows, Array(sutun).fill("")] })}
          >
            <Plus className="size-3.5" /> Satır
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({
                ...table,
                head: [...table.head, ""],
                rows: table.rows.map((r) => [...r, ""]),
              })
            }
          >
            <Plus className="size-3.5" /> Sütun
          </Button>
        </div>
      )}
    </div>
  );
}

// —————————————————————————————————————————————————————————— görsel bloğu

function GorselBloku({
  blok,
  kayit,
  gorsel,
  assetKey,
  readOnly,
  onDegis,
}: {
  blok: Extract<ManualBlock, { kind: "image" }>;
  kayit: ManualImageRow | null;
  gorsel: { url: string; oran: number } | null;
  /** Şablon varlığının anahtarı — yüklenmiş görselde boştur. */
  assetKey?: string;
  readOnly: boolean;
  onDegis: (f: (b: ManualBlock) => ManualBlock) => void;
}) {
  // ŞABLON GÖRSELİ DEPODAN DEĞİL REPODAN gelir; önizlemesi de statik bir
  // adrestir (`/manual-assets/…`), imzalı bağlantı gerektirmez.
  const varlik = assetKey ? manualAsset(assetKey) : null;

  const gosterilen = gorsel?.url ?? (varlik ? `/manual-assets/${varlik.file}` : null);

  return (
    <div className="grid gap-2">
      {varlik && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground">
          Şablon görseli · {varlik.label}
        </span>
      )}
      {gosterilen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gosterilen}
          alt={blok.caption ?? varlik?.label ?? kayit?.fileName ?? "Görsel"}
          className="max-h-64 rounded-md border bg-white object-contain"
        />
      ) : (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {kayit ? "Görsel yükleniyor…" : "Görsel bulunamadı (kayıt silinmiş olabilir)."}
        </div>
      )}
      <Input
        value={blok.caption ?? ""}
        disabled={readOnly}
        onChange={(e) => onDegis((b) => ({ ...b, caption: e.target.value }) as ManualBlock)}
        aria-label="Görsel açıklaması"
        className="h-8 text-sm"
      />
      {!readOnly && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Genişlik %
          <input
            type="range"
            min={20}
            max={100}
            step={5}
            value={blok.widthPct ?? 100}
            onChange={(e) =>
              onDegis((b) => ({ ...b, widthPct: Number(e.target.value) }) as ManualBlock)
            }
          />
          <span className="font-mono">{blok.widthPct ?? 100}</span>
        </label>
      )}
    </div>
  );
}

// ————————————————————————————————————————————————————————— blok ekleme

function BlokEkleSeridi({
  onEkle,
  onGorselYukle,
}: {
  onEkle: (b: ManualBlock) => void;
  onGorselYukle: (file: File) => Promise<ManualImageRow | null>;
}) {
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-dashed p-2">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onEkle({ id: yeniId(), kind: "text", text: "" })}
      >
        <Type className="size-3.5" /> Paragraf
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onEkle({ id: yeniId(), kind: "list", items: [""] })}
      >
        <List className="size-3.5" /> Liste
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          onEkle({ id: yeniId(), kind: "note", level: "onemli" as ManualNoteLevel, text: "" })
        }
      >
        <TriangleAlert className="size-3.5" /> Uyarı Kutusu
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() =>
          onEkle({ id: yeniId(), kind: "table", table: { head: ["", ""], rows: [["", ""]] } })
        }
      >
        <TableIcon className="size-3.5" /> Tablo
      </Button>
      <GorselEkle onEkle={onEkle} onGorselYukle={onGorselYukle} />
    </div>
  );
}

function GorselEkle({
  onEkle,
  onGorselYukle,
}: {
  onEkle: (b: ManualBlock) => void;
  onGorselYukle: (file: File) => Promise<ManualImageRow | null>;
}) {
  const girdi = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function yukle(file: File) {
    setYukleniyor(true);
    try {
      const kayit = await onGorselYukle(file);
      if (!kayit) return;
      onEkle({ id: yeniId(), kind: "image", imageId: kayit.id });
      toast.success("Görsel eklendi — kaydetmeyi unutmayın.");
    } finally {
      setYukleniyor(false);
      if (girdi.current) girdi.current.value = "";
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" disabled={yukleniyor} onClick={() => girdi.current?.click()}>
        {yukleniyor ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ImageIcon className="size-3.5" />
        )}
        Görsel
      </Button>
      <input
        ref={girdi}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void yukle(f);
        }}
      />
    </>
  );
}

// ————————————————————————————————————————————————————————— künye formu

const KUNYE_ALANLARI: { alan: keyof ManualIdentity; etiket: string }[] = [
  { alan: "manufacturer", etiket: "Üretici" },
  { alan: "product", etiket: "Ürün" },
  { alan: "craneType", etiket: "Vinç Tipi" },
  { alan: "serialNo", etiket: "Seri Numara" },
  { alan: "productionYear", etiket: "Üretim Yılı" },
  { alan: "customer", etiket: "Müşteri" },
  { alan: "site", etiket: "Saha / Konum" },
  { alan: "customerDocNo", etiket: "Doküman No" },
  { alan: "customerRevision", etiket: "Versiyon / Revizyon" },
  { alan: "preparedOn", etiket: "Hazırlama Tarihi" },
  { alan: "revisedOn", etiket: "Son Revizyon Tarihi" },
];

function KunyeFormu({
  identity,
  docTitle,
  coverTitle,
  etiket,
  readOnly,
  onChange,
  onDoc,
  onEtiket,
  coverImageId,
  partnerLogos,
  images,
  gorseller,
  onGorselYukle,
  onCoverImage,
  onPartnerLogo,
}: {
  identity: ManualIdentity;
  docTitle: string;
  coverTitle: string;
  etiket: string;
  readOnly: boolean;
  onChange: (alan: keyof ManualIdentity, deger: string) => void;
  onDoc: (alan: "docTitle" | "coverTitle", deger: string) => void;
  onEtiket: (v: string) => void;
  coverImageId?: string;
  partnerLogos: ManualPartnerLogos;
  images: ReadonlyMap<string, ManualImageRow>;
  gorseller: ReadonlyMap<string, { url: string; oran: number }>;
  onGorselYukle: (file: File) => Promise<ManualImageRow | null>;
  onCoverImage: (imageId: string | undefined) => void;
  onPartnerLogo: (slot: keyof ManualPartnerLogos, imageId: string | undefined) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">
        Kapak künyesi. Bilinmeyen alan BOŞ bırakılır — belgede o satır hiç
        basılmaz; bir örnek değer yazmak, teslim edilen kılavuzda başka bir
        vincin seri numarası olarak kalabilir.
      </p>
      <div className="grid gap-2 border-y py-3">
        <div>
          <p className="text-sm font-medium">Üst logo bandı</p>
          <p className="text-xs text-muted-foreground">
            ORION logosu solda sabittir. Partner logoları kapakta ve üst bantta orta ve sağ yuvalara yerleşir; oranları bozulmaz.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="grid min-h-28 content-between gap-2 border bg-card p-2 text-center">
            <div className="grid min-h-14 place-items-center bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/orion-logo.png" alt="ORION Cranes logosu" className="max-h-12 max-w-full object-contain" />
            </div>
            <span className="text-[11px] text-muted-foreground">SOL · ORION (sabit)</span>
          </div>
          <BelgeGorselYuvasi
            etiket="ORTA · PARTNER 1"
            imageId={partnerLogos.centerImageId}
            readOnly={readOnly}
            images={images}
            gorseller={gorseller}
            onGorselYukle={onGorselYukle}
            onChange={(id) => onPartnerLogo("centerImageId", id)}
          />
          <BelgeGorselYuvasi
            etiket="SAĞ · PARTNER 2"
            imageId={partnerLogos.rightImageId}
            readOnly={readOnly}
            images={images}
            gorseller={gorseller}
            onGorselYukle={onGorselYukle}
            onChange={(id) => onPartnerLogo("rightImageId", id)}
          />
        </div>
        <div className="max-w-sm">
          <BelgeGorselYuvasi
            etiket="KAPAK FOTOĞRAFI"
            imageId={coverImageId}
            readOnly={readOnly}
            images={images}
            gorseller={gorseller}
            onGorselYukle={onGorselYukle}
            onChange={onCoverImage}
          />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Alan
          etiket="Belge Adı"
          deger={docTitle}
          readOnly={readOnly}
          onChange={(v) => onDoc("docTitle", v)}
        />
        <Alan
          etiket="Kapak Başlığı"
          deger={coverTitle}
          readOnly={readOnly}
          onChange={(v) => onDoc("coverTitle", v)}
        />
        <Alan etiket="Revizyon Etiketi" deger={etiket} readOnly={readOnly} onChange={onEtiket} />
        {KUNYE_ALANLARI.map((k) => (
          <Alan
            key={k.alan}
            etiket={k.etiket}
            deger={identity[k.alan]}
            readOnly={readOnly}
            onChange={(v) => onChange(k.alan, v)}
          />
        ))}
      </div>
      <Alan
        etiket="Üretici Adresi"
        deger={identity.manufacturerAddress}
        readOnly={readOnly}
        cokSatir
        onChange={(v) => onChange("manufacturerAddress", v)}
      />
      <Alan
        etiket="Telif Satırı"
        deger={identity.copyright}
        readOnly={readOnly}
        onChange={(v) => onChange("copyright", v)}
      />
    </div>
  );
}

function BelgeGorselYuvasi({
  etiket,
  imageId,
  readOnly,
  images,
  gorseller,
  onGorselYukle,
  onChange,
}: {
  etiket: string;
  imageId?: string;
  readOnly: boolean;
  images: ReadonlyMap<string, ManualImageRow>;
  gorseller: ReadonlyMap<string, { url: string; oran: number }>;
  onGorselYukle: (file: File) => Promise<ManualImageRow | null>;
  onChange: (imageId: string | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const gorsel = imageId ? gorseller.get(imageId) : null;
  const kayit = imageId ? images.get(imageId) : null;

  async function yukle(file: File) {
    setYukleniyor(true);
    try {
      const yeni = await onGorselYukle(file);
      if (yeni) {
        onChange(yeni.id);
        toast.success(`${etiket} yerleştirildi — kaydetmeyi unutmayın.`);
      }
    } finally {
      setYukleniyor(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="grid min-h-28 content-between gap-2 border bg-card p-2">
      <div className="grid min-h-14 place-items-center bg-white p-2">
        {gorsel ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gorsel.url} alt={etiket} className="max-h-16 max-w-full object-contain" />
        ) : (
          <span className="text-xs text-gray-500">Görsel seçilmedi</span>
        )}
      </div>
      <div className="grid gap-1">
        <span className="truncate text-[11px] text-muted-foreground" title={kayit?.fileName ?? etiket}>
          {etiket}{kayit ? ` · ${kayit.fileName}` : ""}
        </span>
        {!readOnly && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="flex-1" disabled={yukleniyor} onClick={() => input.current?.click()}>
              {yukleniyor ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
              {imageId ? "Değiştir" : "Seç"}
            </Button>
            {imageId && <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>Kaldır</Button>}
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void yukle(file);
        }}
      />
    </div>
  );
}

function Alan({
  etiket,
  deger,
  readOnly,
  cokSatir,
  onChange,
}: {
  etiket: string;
  deger: string;
  readOnly: boolean;
  cokSatir?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{etiket}</span>
      {cokSatir ? (
        <Textarea
          value={deger}
          disabled={readOnly}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          value={deger}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          className="h-9"
        />
      )}
    </label>
  );
}
