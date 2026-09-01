"use client";

// EL KİTABI EDİTÖRÜ — üç panelli BELGE ÇALIŞMA YÜZÜ.
//
// KITAP-19'un "sol ray yalnız ana bölümleri gösterir, alt bölümler orta
// alandaki kısa seçicide açılır" kararı GERİ ALINDI (kullanıcı kararı,
// 30.08.2026: *"şu anki arayüz bana hiç iyi gelmiyor"*). O karar seksen beş
// satırlık düz bir ağacın çalışma yüzü olmadığını doğru tespit etmişti; ama
// çözümü kullanıcıyı iki ayrı listeden konum çıkarmaya zorluyordu ve belgeyi
// hâlâ bir FORM gibi gösteriyordu.
//
//   SOL   Belge Haritası — ağacın tamamı; arama ve "yalnız eksikler" onu o
//         anki işe indirger (`editor/document-map.tsx`)
//   ORTA  Tomar — seçili bölümün BÜTÜN alt ağacı, basılı belgeye benzer
//         tipografiyle ve yerinde düzenlenebilir (`editor/tomar.tsx`)
//   SAĞ   Müfettiş — seçili bloğun seyrek ama gerekli ayarları; «Kâğıt» açıkken
//         yerini A4 önizlemesine bırakır (`editor/inspector.tsx`)
//
// SEKMELER AYRI ÇALIŞMA YÜZLERİDİR: İçerik · Kapsam · Künye · Kalite ·
// Kaynaklar. Künye içerik formlarıyla aynı uzun sayfada karışmaz (KITAP-19).
//
// KAYDETME AÇIKTIR (KITAP-10). Altında yalnız bir YEREL KURTARMA KOPYASI
// vardır: `localStorage`a yazılır, veritabanına DEĞİL. Tıklamadan hiçbir şey
// kaydedilmez; belirsizlik yoktur. Ama yerinde düzenleme kayıp riskini
// artırdığı için sekme kazayla kapanırsa yazdıkları geri getirilebilir.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  BookOpen,
  Columns2,
  FileDown,
  Layers,
  Loader2,
  PanelRightClose,
  Save,
  Send,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PdfDownloadLink } from "@/components/pdf-download-link";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileSectionGrid } from "@/components/mobile-nav-grid";
import { useIsWide } from "@/lib/use-breakpoint";
import { useOverlay } from "@/lib/use-overlay";
import { manualOnizlemeOlcusu } from "@/components/manual/manual-paper";
import { useManualImages } from "@/components/manual/use-manual-images";
import { manualPublishReadiness } from "@/lib/manual/guide";
import { addTemplateSection, templateAdditions } from "@/lib/manual/payload";
import { MANUAL_DOC_TITLE, manualDocCode } from "@/lib/manual/naming";
import type { ManualSourceData } from "@/lib/manual/sources";
import type { ManualImageRow } from "@/lib/manual/data";
import type {
  ManualBlock,
  ManualIdentity,
  ManualPayload,
  ManualSection,
} from "@/lib/manual/types";
import { saveManualSnippet } from "../../../../admin/manual/actions";
import {
  autofillManualRevision,
  issueManualRevision,
  refreshManualIdentity,
  saveManualRevision,
} from "../actions";
import { DiagramPicker } from "./editor/diagram-picker";
import { DocumentMap } from "./editor/document-map";
import { IdentityForm, type FirmaSecenegi } from "./editor/identity-form";
import { Inspector } from "./editor/inspector";
import { MediaPicker, type MediaTuru } from "./editor/media-picker";
import { PaperPanel } from "./editor/paper-panel";
import { ScopePanel } from "./editor/scope-panel";
import { Tomar } from "./editor/tomar";
import type { SnippetSecenegi } from "./editor/slash-menu";
import { bolumBul, useManualDoc, yeniBlokId } from "./editor/use-manual-doc";

/** Görsel kovasının sınırı 25 MB; istemci de aynı sayıyı bilir. */
const EN_BUYUK_GORSEL = 26_214_400;

/** Yerel kurtarma kopyasının anahtarı — revizyon başına. */
const kurtarmaAnahtari = (revisionId: string) => `orion.manual.draft.${revisionId}`;

type Sekme = "icerik" | "kapsam" | "kunye" | "kalite" | "kaynak";

/**
 * `xl` ALTINDA GÖRÜNEN TEK ÇALIŞMA YÜZÜ.
 *
 * Üç panel ancak 1280 px'ten itibaren yan yana durur (MOBIL-26); altında
 * kullanıcı bunlar arasında açık bir geçişle dolaşır. `lg`de (1024–1279)
 * Harita kendi sütununda KALICI olarak durduğu için orada bu değer yalnız
 * ortadaki sütunu seçer: `harita` seçiliyken orta yine belgedir.
 */
type DarPanel = "harita" | "tomar" | "kagit";

/** Müfettiş tabakasının kimliği — `aria-controls` için. */
const MUFETTIS_ID = "elkitabi-mufettis";

/*
 * SEKME RAYI DAR EKRANDA GÖRÜNÜR KUTU IZGARASIDIR (MOBIL-21).
 *
 * Taban `TabsList` `overflow-x-auto` ile yatay KAYAN bir şerittir: beş sekmenin
 * son ikisi 375 px'te görünmüyor ve kullanıcı orada bir şey olduğunu bilmiyordu.
 * Kural gezinme hedeflerinin AYNI ANDA görünmesini ister. Şerit bu yüzden `md`
 * altında iki/üç sütunlu bir ızgaraya döner; `md` üstünde bugünkü hap rayı
 * OLDUĞU GİBİ kalır — masaüstü yoğunluğu bu turun konusu değil.
 *
 * Ezmeler taban ile AYNI belirteçle yazılır (`group-data-horizontal/tabs:`),
 * yoksa düz bir `h-auto` aynı özgüllükteki taban kuralını yenemez.
 */
const SEKME_RAYI =
  "grid h-auto w-full grid-cols-2 items-stretch gap-1.5 overflow-visible rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-auto group-data-horizontal/tabs:pointer-coarse:h-auto min-[360px]:grid-cols-3 md:inline-flex md:h-9 md:w-fit md:gap-0 md:rounded-lg md:bg-muted md:p-[3px] md:group-data-horizontal/tabs:h-9 md:group-data-horizontal/tabs:pointer-coarse:h-11";

const SEKME =
  "h-auto min-h-11 w-full min-w-0 rounded-none border-border bg-card text-[13px] leading-tight whitespace-normal data-active:border-primary data-active:bg-primary/[0.08] data-active:shadow-[inset_0_-3px_0_var(--primary)] md:h-[calc(100%-1px)] md:min-h-0 md:w-auto md:rounded-md md:border-transparent md:bg-transparent md:text-sm md:whitespace-nowrap md:data-active:bg-background md:data-active:shadow-none";

export function ManualEditor({
  projectId,
  revisionId,
  revNo,
  status,
  label,
  initialPayload,
  projectTitle,
  sources,
  images,
  snippets,
  itemNo,
  canEdit,
  identitySources,
  firmalar,
  firmaLogolari,
  projectBrandName,
  projectBrandId,
}: {
  projectId: string;
  revisionId: string;
  revNo: number;
  status: "draft" | "issued";
  label: string;
  initialPayload: ManualPayload;
  projectTitle: string;
  sources: ManualSourceData;
  images: ManualImageRow[];
  snippets: SnippetSecenegi[];
  itemNo: string;
  canEdit: boolean;
  /** Künye alanı → kaynak adı; sunucuda çözülür, editör yalnız gösterir. */
  identitySources: Partial<Record<keyof ManualIdentity, string>>;
  /** Müşteri defteri — üst bant ve üretici seçicilerinin kaynağı. */
  firmalar: FirmaSecenegi[];
  /** Yalnız SEÇİLİ firmaların logoları; defterin tamamı bayt taşımaz. */
  firmaLogolari: Record<string, { url: string; oran: number }>;
  /** Proje düzeyinde seçili Rapor Firması — orta yuvanın öntanımı. */
  projectBrandName: string;
  /** Proje Rapor Firmasının `customers.id`si; kâğıt önizlemesi logoyu ondan çözer. */
  projectBrandId: string;
}) {
  const yayimHazirligiIlk = useMemo(
    () => manualPublishReadiness(initialPayload),
    [initialPayload]
  );
  // EDİTÖR YAPILACAK İLK GERÇEK İŞLE AÇILIR (KITAP-19), boş bir başlık
  // kapsayıcısıyla değil.
  const ilkSecili =
    yayimHazirligiIlk.missingSections[0]?.id ?? initialPayload.sections[0]?.id ?? "";

  const doc = useManualDoc(initialPayload, ilkSecili);
  const [imageRows, setImageRows] = useState<ManualImageRow[]>(images);
  const [etiket, setEtiket] = useState(label);
  const [sekme, setSekme] = useState<Sekme>("icerik");
  const [darPanel, setDarPanel] = useState<DarPanel>("tomar");
  const [kagitAcik, setKagitAcik] = useState(false);
  const [mufettisAcik, setMufettisAcik] = useState(false);
  const [yayimOnayi, setYayimOnayi] = useState(false);
  const [kurtarma, setKurtarma] = useState<{ payload: ManualPayload; an: string } | null>(null);
  const [parcaKaydi, setParcaKaydi] = useState<{ blok: ManualBlock; bolum: ManualSection } | null>(
    null
  );
  const [parcaBaslik, setParcaBaslik] = useState("");
  const [semaSecici, setSemaSecici] = useState(false);
  const [medyaSecici, setMedyaSecici] = useState<MediaTuru | null>(null);
  const [kaydediliyor, kaydetBasla] = useTransition();
  const [yayimlaniyor, yayimlaBasla] = useTransition();
  const [turetiliyor, turetBasla] = useTransition();

  /*
   * ÜÇ PANEL ANCAK `xl`DEN İTİBAREN SIĞAR (MOBIL-26).
   *
   * Ölçüldü: kabuğun kenar çubuğu (15 rem) tam 1024 px'te belirir ve içerik
   * kabını 703 px'e indirir (MOBIL-16'nın ölçüm tablosu). Eski düzen orada
   * 280 px harita + 320 px müfettiş + 32 px boşluk = 632 px'i SABİT olarak
   * ayırıyordu; belgenin kendisine ~71 px kalıyordu. Kırılımı `xl`e almak
   * tek düzeltmedir; sütunları daraltmak 1024'te yine dar bir belge bırakırdı.
   *
   * Soru CSS'le sorulamaz çünkü cevabı YERLEŞİM DEĞİL MONTAJ değiştirir:
   * `xl` altında Müfettiş bir TABAKADIR ve Kâğıt ORTA sütundadır; ikisini de
   * ikinci kez basıp `hidden` ile saklamak A4 önizlemesinin bedelini iki
   * katına çıkarırdı.
   */
  const genis = useIsWide();
  const mufettisKabi = useRef<HTMLElement | null>(null);
  // Tabaka açıkken: gövde kaymaz · Esc kapatır · Tab içeride döner · kapanınca
  // odak tetikleyiciye döner. `xl`de tabaka yok, kanca da devrede değil.
  useOverlay(mufettisAcik && !genis, () => setMufettisAcik(false), mufettisKabi);

  // YAYIMLANMIŞ REVİZYON SALT OKUNURDUR — asıl engel DB tetikleyicisidir
  // (`guard_issued_manual_revision`); buradaki yalnız ekranı dürüst tutar.
  const yazilabilir = canEdit && status === "draft";

  const gorselHaritasi = useMemo(() => {
    const m = new Map<string, ManualImageRow>();
    for (const g of imageRows) m.set(g.id, g);
    return m;
  }, [imageRows]);

  const kagitGorselleri = useManualImages(imageRows);
  const firmaLogoHaritasi = useMemo(
    () => new Map(Object.entries(firmaLogolari)),
    [firmaLogolari]
  );
  /** Proje Rapor Firmasının logosu — orta yuvanın öntanımı (KITAP-18). */
  const projectBrandLogo = projectBrandId ? firmaLogoHaritasi.get(projectBrandId) : undefined;

  /*
   * KÜNYEYİ KAYNAKTAN TAZELE — SUNUCU ÇÖZER, GÖVDEYE İSTEMCİ İŞLER.
   *
   * Eylem veritabanına hiçbir şey yazmaz; `Kaydet` tek yazma eylemi olarak
   * kalır (KITAP-10). Kullanıcı önce sonucu görür, beğenmezse kaydetmez.
   */
  const kunyeyiTazele = useCallback(
    async (hepsiniTazele: boolean) => {
      const r = await refreshManualIdentity(projectId, {
        revisionId,
        revNo,
        identity: doc.payload.identity,
        hepsiniTazele,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      doc.govdeyiBenimse({ ...doc.payload, identity: r.identity });
      toast.success(
        r.doldurulan === 0
          ? "Künyede kaynaktan gelecek yeni bir değer yok."
          : `${r.doldurulan} alan kaynaktan dolduruldu${r.korunan > 0 ? `, ${r.korunan} alan sizin yazdığınız hâliyle korundu` : ""}.`
      );
    },
    [doc, projectId, revisionId, revNo]
  );
  const oranlar = useMemo(() => {
    const m = new Map<string, number>();
    for (const [k, g] of kagitGorselleri) m.set(k, g.oran);
    return m;
  }, [kagitGorselleri]);

  // YERLEŞİM ÇEKİRDEĞİ BURADA DA ÇALIŞIR: bölümün belgede KAÇINCI YAPRAĞA
  // düştüğü ancak bütün dağıtım bitince belli olur (KITAP-14 md. 3).
  const olcu = useMemo(
    () => manualOnizlemeOlcusu(doc.payload, sources, oranlar),
    [doc.payload, sources, oranlar]
  );
  const yaprakSayisi = olcu.govdeOfset + olcu.sayfalar.length;

  const yayimHazirligi = useMemo(() => manualPublishReadiness(doc.payload), [doc.payload]);
  const eksikKimlikleri = useMemo(
    () => new Set(yayimHazirligi.missingSections.map((s) => s.id)),
    [yayimHazirligi]
  );
  const kalanIs = yayimHazirligi.missingIdentity.length + yayimHazirligi.missingSections.length;

  // ŞABLON BÜYÜDÜĞÜNDE VAR OLAN BELGE DEĞİŞMEZ (KITAP-4): editör yalnız
  // haber verir, eklemeyi kullanıcı seçer.
  const yeniBolumler = useMemo(() => templateAdditions(doc.payload), [doc.payload]);

  /** Tomar'ın gösterdiği alt ağacın kökü — seçili bölümün kendisi. */
  const gosterilen = useMemo(
    () => doc.duz.find((s) => s.id === doc.seciliBolumId) ?? doc.numarali[0] ?? null,
    [doc.duz, doc.numarali, doc.seciliBolumId]
  );
  const seciliBolum = useMemo(
    () => bolumBul(doc.payload, doc.seciliBolumId),
    [doc.payload, doc.seciliBolumId]
  );
  const seciliBlok = useMemo(
    () => seciliBolum?.blocks.find((b) => b.id === doc.seciliBlokId) ?? null,
    [seciliBolum, doc.seciliBlokId]
  );

  // ————————————————————————————————————— yerel kurtarma kopyası

  // KURTARMA KOPYASI BİR SONRAKİ TIK'TA OKUNUR. Render sırasında okumak
  // sunucuda `window`u bulamaz; etkinin GÖVDESİNDE setState çağırmak ise
  // zincirleme render üretir. Zamanlayıcı geri çağrımı ikisini de çözer:
  // sayfa önce çizilir, kurtarma sorusu hemen ardından gelir.
  useEffect(() => {
    if (!yazilabilir) return;
    const zaman = window.setTimeout(() => {
      try {
        const ham = window.localStorage.getItem(kurtarmaAnahtari(revisionId));
        if (!ham) return;
        const kayit = JSON.parse(ham) as { an: string; payload: ManualPayload };
        if (kayit?.payload) setKurtarma({ payload: kayit.payload, an: kayit.an });
      } catch {
        // Bozuk bir kurtarma kaydı sessizce yok sayılır: kullanıcıyı açılışta
        // anlamadığı bir hatayla karşılamak, kopyayı hiç tutmamaktan kötüdür.
      }
    }, 0);
    return () => window.clearTimeout(zaman);
  }, [revisionId, yazilabilir]);

  useEffect(() => {
    if (!yazilabilir || !doc.kirli) return;
    const zaman = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          kurtarmaAnahtari(revisionId),
          JSON.stringify({ an: new Date().toISOString(), payload: doc.payload })
        );
      } catch {
        // Kota dolduysa kurtarma kopyası tutulamaz; belge yine de düzenlenebilir.
      }
    }, 800);
    return () => window.clearTimeout(zaman);
  }, [doc.payload, doc.kirli, revisionId, yazilabilir]);

  // KAYDEDİLMEMİŞ DEĞİŞİKLİKLE ÇIKIŞ UYARIR.
  useEffect(() => {
    if (!doc.kirli) return;
    const uyar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", uyar);
    return () => window.removeEventListener("beforeunload", uyar);
  }, [doc.kirli]);

  // ————————————————————————————————————————————————— görsel

  const gorselYukle = useCallback(
    async (file: File): Promise<ManualImageRow | null> => {
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
    },
    [projectId, revisionId]
  );

  /** Tomar'daki "Görsel" komutunun hedefi — dosya seçildiğinde buraya düşer. */
  const gorselHedefi = useRef<{ bolumId: string; index: number } | null>(null);
  const dosyaGirisi = useRef<HTMLInputElement>(null);

  const gorselBlokEkle = useCallback(
    async (file: File) => {
      const hedef = gorselHedefi.current;
      if (!hedef) return;
      const kayit = await gorselYukle(file);
      if (!kayit) return;
      doc.blokEkle(hedef.bolumId, hedef.index, {
        id: yeniBlokId(),
        kind: "image",
        imageId: kayit.id,
      });
      toast.success("Görsel eklendi — kaydetmeyi unutmayın.");
    },
    [doc, gorselYukle]
  );

  // PANOYA YAPIŞTIRMA: bir ekran görüntüsünü kaydedip yüklemek üç adımdır;
  // Ctrl+V bir adımdır ve HMI/kabin fotoğrafları çoğunlukla ekran görüntüsüdür.
  useEffect(() => {
    if (!yazilabilir || sekme !== "icerik") return;
    const yapistir = (e: ClipboardEvent) => {
      const dosya = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/")
      );
      if (!dosya || !seciliBolum || seciliBolum.appendix) return;
      e.preventDefault();
      gorselHedefi.current = { bolumId: seciliBolum.id, index: seciliBolum.blocks.length };
      void gorselBlokEkle(dosya);
    };
    window.addEventListener("paste", yapistir);
    return () => window.removeEventListener("paste", yapistir);
  }, [yazilabilir, sekme, seciliBolum, gorselBlokEkle]);

  // ————————————————————————————————————————————— kaydet / yayımla

  const kaydet = useCallback(
    (sonra?: () => void) => {
      kaydetBasla(async () => {
        const r = await saveManualRevision(projectId, {
          revisionId,
          payload: doc.payload,
          label: etiket,
        });
        if (r.error) {
          toast.error(r.error);
          return;
        }
        doc.temizle();
        try {
          window.localStorage.removeItem(kurtarmaAnahtari(revisionId));
        } catch {
          /* kurtarma kopyası silinemedi; zararsız */
        }
        toast.success("Kaydedildi.");
        sonra?.();
      });
    },
    [doc, etiket, projectId, revisionId]
  );

  // Ctrl/⌘ + S — yerinde düzenlemede en sık istenen kısayol.
  useEffect(() => {
    if (!yazilabilir) return;
    const tus = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (doc.kirli) kaydet();
      }
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [doc.kirli, kaydet, yazilabilir]);

  function yayimla() {
    if (doc.kirli) {
      toast.error("Önce kaydedin — yayımlanan belge kaydedilmiş hâldir.");
      return;
    }
    if (yayimHazirligi.missingIdentity.length > 0) {
      setSekme("kunye");
      toast.error(
        `Yayım için eksik künye alanları: ${yayimHazirligi.missingIdentity.join(", ")}.`
      );
      return;
    }
    if (yayimHazirligi.missingSections.length > 0) {
      setSekme("icerik");
      doc.bolumSec(yayimHazirligi.missingSections[0].id);
      toast.error(
        `${yayimHazirligi.missingSections.length} vince özel bölüm bekliyor. Doldurun ya da bilinçli olarak gizleyin.`
      );
      return;
    }
    setYayimOnayi(true);
  }

  // ————————————————————————————————————————————————— türetim

  const kaynaktanDoldur = useCallback(
    (sectionKey?: string, blockId?: string) => {
      turetBasla(async () => {
        const r = await autofillManualRevision(projectId, {
          revisionId,
          payload: doc.payload,
          ...(sectionKey ? { sectionKey } : {}),
          ...(blockId ? { blockId } : {}),
        });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        doc.govdeyiBenimse(r.payload);
        toast.success(
          r.uretilen === 0 && r.korunan === 0
            ? "Kaynaktan üretilecek yeni bir şey yok."
            : `${r.uretilen} blok yazıldı${r.korunan > 0 ? `, ${r.korunan} blok sizin düzenlemenizle korundu` : ""}.`
        );
      });
    },
    [doc, projectId, revisionId]
  );

  // ————————————————————————————————————————————————— görünüm

  const docLine = `ORION CRANES · ${doc.payload.docTitle || MANUAL_DOC_TITLE} · V${revNo} · ${new Date().getFullYear()}`;
  const seciliSayfa = olcu.sayfaNo.get(doc.seciliBolumId) ?? null;

  const harita = (
    <DocumentMap
      numarali={doc.numarali}
      seciliId={doc.seciliBolumId}
      eksikKimlikleri={eksikKimlikleri}
      yazilabilir={yazilabilir}
      onSec={(id) => {
        doc.bolumSec(id);
        setDarPanel("tomar");
      }}
      onGizle={doc.bolumGizle}
    />
  );

  const tomar = gosterilen ? (
    <Tomar
      kok={gosterilen}
      seciliBlokId={doc.seciliBlokId}
      yazilabilir={yazilabilir}
      sources={sources}
      gorseller={kagitGorselleri}
      parcalar={snippets}
      eylem={{
        onBolumSec: doc.bolumSec,
        onBaslik: doc.bolumBaslik,
        onBolumGizle: doc.bolumGizle,
        onBlokSec: doc.blokSec,
        onBlokDegis: doc.blokGuncelle,
        onBlokEkle: doc.blokEkle,
        onBlokSil: doc.blokSil,
        onBlokTasi: doc.blokTasi,
        onBlokGizle: doc.blokGizle,
        onStandardaDon: doc.standardaDon,
        onKaynaktanTazele: (_bolumId, blokId) => kaynaktanDoldur(undefined, blokId),
        onDeftereKaydet: (bolum, blok) => {
          setParcaKaydi({ bolum, blok });
          setParcaBaslik("");
        },
        onGorselEkle: (bolumId, index) => {
          gorselHedefi.current = { bolumId, index };
          dosyaGirisi.current?.click();
        },
        onSemaEkle: (bolumId, index) => {
          gorselHedefi.current = { bolumId, index };
          setSemaSecici(true);
        },
        onPaftaEkle: (bolumId, index) => {
          gorselHedefi.current = { bolumId, index };
          setMedyaSecici("pafta");
        },
        onKatalogEkle: (bolumId, index) => {
          gorselHedefi.current = { bolumId, index };
          setMedyaSecici("katalog");
        },
      }}
    />
  ) : (
    <p className="text-sm text-muted-foreground">Bölüm yok.</p>
  );

  // KÂĞIT TEK YERDE MONTE EDİLİR. `ManualPaper` yirmi yaprağı çizer; iki yere
  // birden basıp birini `hidden` ile saklamak bedeli iki katına çıkarırdı.
  // Hangi sütuna gireceğini `genis` söyler, ikizleme yoktur.
  const kagitPaneli = (ek: string) => (
    <PaperPanel
      payload={doc.payload}
      projectTitle={projectTitle}
      sources={sources}
      gorseller={kagitGorselleri}
      docLine={docLine}
      docCode={manualDocCode(itemNo, revNo)}
      vurguId={doc.seciliBolumId}
      sayfa={seciliSayfa}
      yaprakSayisi={yaprakSayisi}
      className={ek}
      firmaLogolari={firmaLogoHaritasi}
      projeFirmaLogosu={projectBrandLogo}
    />
  );

  const mufettis = (
    <Inspector
      bolum={gosterilen}
      blok={seciliBlok}
      yazilabilir={yazilabilir}
      onBlokDegis={(f) => {
        if (seciliBolum && doc.seciliBlokId) doc.blokGuncelle(seciliBolum.id, doc.seciliBlokId, f);
      }}
      onBlokGizle={() => {
        if (seciliBolum && doc.seciliBlokId) doc.blokGizle(seciliBolum.id, doc.seciliBlokId);
      }}
      onBolumGizle={() => doc.bolumGizle(doc.seciliBolumId)}
    />
  );

  // `xl`de sağ sütun: Kâğıt açıksa kâğıt, değilse Müfettiş (bugünkü davranış).
  const sagSutun = kagitAcik ? (
    kagitPaneli("min-h-0 flex-1")
  ) : (
    <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">{mufettis}</div>
  );

  // KÂĞIT DÜĞMESİ İKİ ŞEY DEĞİL TEK ŞEY SORAR: "kâğıdı göster".
  // `xl`de sağ sütunun içeriğini değiştirir; altında ise ORTA sütunu
  // değiştirir, çünkü orada sağ sütun yoktur. İki durumun uzlaştığı tek nokta
  // burasıdır; ayrı iki düğme kullanıcıya aynı şeyi iki kez sordururdu.
  const kagitGorunur = genis ? kagitAcik : darPanel === "kagit";
  /** Kâğıt ORTA sütunda mı — yalnız `xl` altında olur. */
  const kagitOrtada = !genis && darPanel === "kagit";
  const kagidiCevir = () => {
    if (genis) setKagitAcik((v) => !v);
    else setDarPanel((p) => (p === "kagit" ? "tomar" : "kagit"));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ————————————————————————————————————————————— üst şerit */}
      <div className="flex flex-wrap items-center gap-2 border bg-card p-3">
        <Badge variant={status === "issued" ? "default" : "secondary"}>
          {status === "issued" ? "Yayınlandı" : "Taslak"}
        </Badge>
        <span className="font-mono text-sm text-muted-foreground">
          {manualDocCode(itemNo, revNo)}
        </span>
        <span className="text-sm text-muted-foreground">
          <span className="max-sm:hidden">· gövde {yaprakSayisi} yaprak</span>
          <span className="sm:hidden">{yaprakSayisi} yaprak</span>
          {kalanIs > 0 ? ` · ${kalanIs} eksik` : " · yayıma hazır"}
        </span>
        {doc.kirli && (
          <span className="inline-flex items-center gap-1 text-sm text-destructive">
            <TriangleAlert className="size-3.5" /> Kaydedilmedi
          </span>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={kagitGorunur ? "secondary" : "outline"}
            className="oc-tap"
            aria-pressed={kagitGorunur}
            onClick={kagidiCevir}
          >
            {kagitGorunur ? (
              <PanelRightClose className="size-3.5" />
            ) : (
              <Columns2 className="size-3.5" />
            )}
            Kâğıt
          </Button>
          {/* MÜFETTİŞ `xl` ALTINDA BİR TABAKADIR — girişi de burada olmalıdır.
              `xl` üstünde sağ sütunda zaten açık, düğme gösterilmez. */}
          <Button
            size="sm"
            variant={mufettisAcik ? "secondary" : "outline"}
            className="oc-tap xl:hidden"
            aria-expanded={mufettisAcik}
            aria-controls={MUFETTIS_ID}
            onClick={() => setMufettisAcik((v) => !v)}
          >
            <SlidersHorizontal className="size-3.5" /> Müfettiş
          </Button>
          <Button size="sm" variant="outline" className="oc-tap" asChild>
            <PdfDownloadLink
              href={`/projects/${projectId}/manual/${revisionId}/pdf`}
              disabled={doc.kirli}
              shareTitle="İşletme ve Bakım El Kitabı"
              title={doc.kirli ? "PDF için önce değişiklikleri kaydedin" : "Gövde PDF'i indir"}
            >
              <FileDown className="size-3.5" /> Gövde PDF
            </PdfDownloadLink>
          </Button>
          <Button size="sm" variant="outline" className="oc-tap" asChild>
            <PdfDownloadLink
              href={`/projects/${projectId}/manual/${revisionId}/pdf?ekler=1`}
              disabled={doc.kirli}
              shareTitle="İşletme ve Bakım El Kitabı · Tam Sürüm"
              title={doc.kirli ? "PDF için önce değişiklikleri kaydedin" : "Tam sürümü indir"}
            >
              <Layers className="size-3.5" /> Tam Sürüm
            </PdfDownloadLink>
          </Button>
          {yazilabilir && (
            <>
              {/* Kaydet `lg` ALTINDA burada DEĞİL, ekranın altındaki yapışkan
                  kumandadadır (MOBIL-24): uzun bir belgede başparmak orada. */}
              <Button
                size="sm"
                className="oc-tap max-lg:hidden"
                onClick={() => kaydet()}
                disabled={kaydediliyor || !doc.kirli}
                title="Ctrl + S"
              >
                {kaydediliyor ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Kaydet
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="oc-tap"
                onClick={yayimla}
                disabled={yayimlaniyor}
              >
                <Send className="size-3.5" /> Yayımla
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ————————————————————————————————————————————— sekmeler */}
      <Tabs value={sekme} onValueChange={(v) => setSekme(v as Sekme)}>
        <TabsList className={SEKME_RAYI}>
          <TabsTrigger value="icerik" className={SEKME}>
            İçerik
          </TabsTrigger>
          <TabsTrigger value="kapsam" className={SEKME}>
            Kapsam
          </TabsTrigger>
          <TabsTrigger value="kunye" className={SEKME}>
            Künye
          </TabsTrigger>
          <TabsTrigger value="kalite" className={SEKME}>
            Kalite{kalanIs > 0 ? ` (${kalanIs})` : ""}
          </TabsTrigger>
          <TabsTrigger value="kaynak" className={SEKME}>
            Kaynaklar
          </TabsTrigger>
        </TabsList>

        {/* ————————————————————————————————————————————— içerik */}
        <TabsContent value="icerik">
          {/* `lg`de İKİ, `xl`de ÜÇ sütun (MOBIL-26). Harita `lg`den itibaren
              KALICIDIR; orta sütun belgeyi ya da (xl altında) kâğıdı taşır. */}
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
            <div className={darPanel === "harita" ? "min-w-0" : "hidden min-w-0 lg:block"}>
              <div className="lg:sticky lg:top-2 lg:max-h-[calc(100dvh-9rem)]">{harita}</div>
            </div>

            {/* ORTA — belge. `harita` seçiliyken de `lg` üstünde burası belgedir:
                harita zaten kendi sütununda duruyor, ikinci kez göstermek yer
                harcardı. */}
            <div
              className={
                kagitOrtada
                  ? "hidden"
                  : darPanel === "tomar"
                    ? "min-w-0"
                    : "hidden min-w-0 lg:block"
              }
            >
              {tomar}
            </div>

            {/* ORTA — kâğıt. Yalnız `xl` ALTINDA buraya girer; yükseklik açıkça
                kelepçelenir, yoksa `PaperPanel`in kaydırıcısı boy alamaz. */}
            {kagitOrtada && (
              <div className="relative flex max-h-[calc(100dvh-15rem)] min-w-0 flex-col sm:max-h-[calc(100dvh-13rem)] lg:max-h-[calc(100dvh-9rem)]">
                {kagitPaneli("min-h-0 flex-1")}
              </div>
            )}

            {/* SAĞ — yalnız `xl`. Altında Müfettiş tabakadadır. */}
            {genis && (
              <div className="hidden min-w-0 xl:block">
                <div className="sticky top-2 flex max-h-[calc(100dvh-9rem)] flex-col">
                  {sagSutun}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ————————————————————————————————————————————— kapsam */}
        <TabsContent value="kapsam" className="mt-3 max-w-3xl">
          <ScopePanel
            payload={doc.payload}
            yazilabilir={yazilabilir}
            onPaket={(key, bastan) => {
              const sonuc = doc.paketUygula(key, bastan);
              toast.success(
                `Paket uygulandı: ${sonuc.degisen} değişiklik` +
                  (sonuc.korunan.length > 0
                    ? `, ${sonuc.korunan.length} bölüm sizin kararınızla korundu`
                    : "")
              );
            }}
            onEkSecenegi={doc.ekSecenegi}
            onBolumGizle={doc.bolumGizle}
          />
        </TabsContent>

        {/* ————————————————————————————————————————————— künye */}
        <TabsContent value="kunye" className="mt-3">
          <IdentityForm
            identity={doc.payload.identity}
            identitySources={identitySources}
            docTitle={doc.payload.docTitle}
            coverTitle={doc.payload.coverTitle}
            etiket={etiket}
            readOnly={!yazilabilir}
            images={gorselHaritasi}
            gorseller={kagitGorselleri}
            firmalar={firmalar}
            firmaLogolari={firmaLogoHaritasi}
            projectBrandName={projectBrandName}
            coverImageId={doc.payload.coverImageId}
            partnerLogos={doc.payload.partnerLogos}
            onGorselYukle={gorselYukle}
            onChange={(alan: keyof ManualIdentity, deger) =>
              doc.govdeyiBenimse({
                ...doc.payload,
                identity: { ...doc.payload.identity, [alan]: deger },
              })
            }
            /* FİRMA SEÇİMİ KÜNYEYE SNAPSHOT'LANIR (teklifin `payload.issuer`
               deseni): ad ve adres belgeye kopyalanır, defter sonradan
               düzeltilse bile teslim edilmiş kılavuz değişmez (KITAP-2). */
            onManufacturerCompany={(firma) =>
              doc.govdeyiBenimse({
                ...doc.payload,
                identity: {
                  ...doc.payload.identity,
                  manufacturerCustomerId: firma?.id ?? "",
                  ...(firma
                    ? {
                        manufacturer: firma.name,
                        manufacturerAddress: [
                          firma.address,
                          [firma.taxOffice, firma.taxNo].filter(Boolean).join(" \u00b7 "),
                        ]
                          .filter(Boolean)
                          .join("\n"),
                      }
                    : {}),
                },
              })
            }
            onRefreshIdentity={kunyeyiTazele}
            onDoc={(alan, deger) => doc.govdeyiBenimse({ ...doc.payload, [alan]: deger })}
            onEtiket={setEtiket}
            onCoverImage={(imageId) =>
              doc.govdeyiBenimse({ ...doc.payload, coverImageId: imageId })
            }
            onPartnerLogo={(slot: "centerImageId" | "rightImageId", imageId) =>
              doc.govdeyiBenimse({
                ...doc.payload,
                partnerLogos: { ...doc.payload.partnerLogos, [slot]: imageId },
              })
            }
            onPartnerCompany={(slot: "centerCustomerId" | "rightCustomerId", customerId) =>
              doc.govdeyiBenimse({
                ...doc.payload,
                partnerLogos: { ...doc.payload.partnerLogos, [slot]: customerId ?? "" },
              })
            }
          />
        </TabsContent>

        {/* ————————————————————————————————————————————— kalite */}
        <TabsContent value="kalite" className="mt-3 flex max-w-2xl flex-col gap-3">
          {kalanIs === 0 ? (
            <p className="border bg-muted/40 p-3 text-sm">
              Yayım kapısı açık: zorunlu künye alanları dolu ve vince özel bekleyen bölüm yok.
            </p>
          ) : null}
          {yayimHazirligi.missingIdentity.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Eksik künye alanları
              </p>
              <ul className="flex flex-wrap gap-1">
                {yayimHazirligi.missingIdentity.map((a) => (
                  <li key={a}>
                    <Badge variant="outline">{a}</Badge>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="oc-tap self-start"
                onClick={() => setSekme("kunye")}
              >
                <BookOpen className="size-3.5" /> Künyeye git
              </Button>
            </div>
          ) : null}
          {yayimHazirligi.missingSections.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Vince özel bekleyen bölümler ({yayimHazirligi.missingSections.length})
              </p>
              <p className="text-xs text-muted-foreground">
                Bölümü doldurun ya da bu teslimat için BİLİNÇLİ OLARAK gizleyin — gizlenen
                bölüm eksik sayılmaz.
              </p>
              <ul className="flex flex-col gap-1">
                {yayimHazirligi.missingSections.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="oc-tap w-full border px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setSekme("icerik");
                        doc.bolumSec(s.id);
                        setDarPanel("tomar");
                      }}
                    >
                      {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </TabsContent>

        {/* ————————————————————————————————————————————— kaynaklar */}
        <TabsContent value="kaynak" className="mt-3 flex max-w-2xl flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Bakım çizelgesi, yağlama tablosu ve vince özel özet cümleleri hesap raporundan,
            elektrik projesinden ve yönetim panelindeki defterlerden ÜRETİLİR. Ürettiğiniz
            blok belgeye somut metin olarak yazılır; dokunduğunuz blok bir daha ezilmez.
          </p>
          <Button
            className="oc-tap self-start"
            disabled={!yazilabilir || turetiliyor}
            onClick={() => kaynaktanDoldur()}
          >
            {turetiliyor ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Kaynaktan Doldur
          </Button>
          <p className="text-xs text-muted-foreground">
            {"Kaynak yetersizse hiçbir blok üretilmez — uydurma veri girilmez. Tek bir bloğu tazelemek için Tomar'da o bloğun üstündeki dairesel ok düğmesini kullanın."}
          </p>

          {yeniBolumler.length > 0 ? (
            <div className="mt-2 flex flex-col gap-2 border p-3">
              <p className="text-sm font-medium">
                Şablonda {yeniBolumler.length} yeni bölüm var
              </p>
              <p className="text-xs text-muted-foreground">
                Şablon bu belge açıldıktan sonra büyüdü. Var olan belgeye hiçbir bölüm
                KENDİLİĞİNDEN eklenmez — belge sizindir. Eklemek istediklerinizi seçin;
                bölüm şablondaki sırasına yerleşir.
              </p>
              <ul className="flex flex-col gap-1">
                {yeniBolumler.map((b) => (
                  <li key={b.key} className="flex items-center gap-2 border px-2 py-1 text-sm">
                    <span className="truncate">{b.title}</span>
                    <code className="hidden text-xs text-muted-foreground sm:inline">{b.key}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      className="oc-tap ml-auto"
                      disabled={!yazilabilir}
                      onClick={() => doc.govdeyiBenimse(addTemplateSection(doc.payload, b.key))}
                    >
                      Ekle
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="oc-tap self-start"
                disabled={!yazilabilir}
                onClick={() => {
                  // Sırayla eklenir: bir bölüm eklendiğinde sonraki için
                  // hedef ağaç değişmiş olur.
                  let sonraki = doc.payload;
                  for (const b of yeniBolumler) sonraki = addTemplateSection(sonraki, b.key);
                  doc.govdeyiBenimse(sonraki);
                  toast.success(`${yeniBolumler.length} bölüm eklendi — kaydetmeyi unutmayın.`);
                }}
              >
                Hepsini Ekle
              </Button>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      {/*
       * YAPIŞKAN KUMANDA — `lg` ALTINDA EKRANIN ALTINDA (MOBIL-24).
       *
       * Hesap editöründeki adım şeridinin ikizidir ve aynı gerekçeyle vardır:
       * el kitabı yüzlerce satırlık bir belgedir, kullanıcı ortasındayken
       * Kaydet ve panel geçişi ekranın en üstünde kalıyordu — her kayıt için
       * başa sarmak gerekiyordu. Panel seçici ÇOĞALTILMADI, yukarıdan buraya
       * TAŞINDI; iki yerde durursa biri diğerinden ayrışır.
       *
       * Seçici üç sütuna ÇİVİLENİR (`grid-cols-3`): ortak bileşen 360 px altında
       * iki sütuna iner ve çubuk iki satıra çıkardı — MOBIL-24 tek satır ister.
       */}
      {(sekme === "icerik" || yazilabilir) && (
        <div className="sticky bottom-0 z-20 shrink-0 border bg-card px-2 py-2 lg:hidden">
          <div className="flex items-center gap-2">
            {sekme === "icerik" && (
              <MobileSectionGrid<DarPanel>
                value={darPanel}
                onValueChange={setDarPanel}
                label="Çalışma yüzü"
                className="min-w-0 flex-1 grid-cols-3"
                options={[
                  { value: "harita", label: "Harita" },
                  { value: "tomar", label: "Belge" },
                  { value: "kagit", label: "Kâğıt" },
                ]}
              />
            )}
            {yazilabilir && (
              <Button
                size="sm"
                className="oc-tap shrink-0 max-sm:px-2.5"
                onClick={() => kaydet()}
                disabled={kaydediliyor || !doc.kirli}
                title="Ctrl + S"
              >
                {kaydediliyor ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Kaydet
              </Button>
            )}
          </div>
        </div>
      )}

      {/*
       * MÜFETTİŞ TABAKASI — `xl` altında sağ sütunun yerine geçer.
       *
       * Radix `Dialog` DEĞİL: aynı `mufettis` düğümü `xl` üstünde ızgaranın
       * normal bir sütunudur ve portal onu kökten koparırdı (aynı gerekçe
       * `use-overlay.ts` başlığında yazılı). Davranışı ayırmak yerleşimi
       * yerinde bırakır: gövde kilidi, Esc ve odak tuzağı kancadan gelir.
       */}
      {mufettisAcik && !genis && (
        <>
          <div
            className="fixed inset-0 z-40 bg-foreground/40 xl:hidden"
            aria-hidden
            onClick={() => setMufettisAcik(false)}
          />
          <aside
            id={MUFETTIS_ID}
            ref={mufettisKabi}
            role="dialog"
            aria-modal="true"
            aria-label="Müfettiş"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(22rem,calc(100vw-3rem))] flex-col border-l bg-background shadow-2xl xl:hidden"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
              <span className="oc-kicker">MÜFETTİŞ</span>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Müfettişi kapat"
                onClick={() => setMufettisAcik(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
              {mufettis}
            </div>
          </aside>
        </>
      )}

      <DiagramPicker
        acik={semaSecici}
        projectId={projectId}
        revisionId={revisionId}
        onKapat={() => setSemaSecici(false)}
        onSec={(sema) => {
          const hedef = gorselHedefi.current;
          if (!hedef) return;
          doc.blokEkle(hedef.bolumId, hedef.index, {
            id: yeniBlokId(),
            kind: "diagram",
            diagramKey: sema.diagramKey,
            diagram: sema.diagram,
            caption: sema.baslik,
          });
          toast.success("Şema eklendi — kaydetmeyi unutmayın.");
        }}
      />

      <MediaPicker
        tur={medyaSecici ?? "pafta"}
        acik={medyaSecici !== null}
        projectId={projectId}
        revisionId={revisionId}
        onKapat={() => setMedyaSecici(null)}
        onSec={({ image, baslik }) => {
          const hedef = gorselHedefi.current;
          if (!hedef) return;
          setImageRows((onceki) =>
            onceki.some((g) => g.id === image.id) ? onceki : [...onceki, image]
          );
          doc.blokEkle(hedef.bolumId, hedef.index, {
            id: yeniBlokId(),
            kind: "image",
            imageId: image.id,
            ...(baslik ? { caption: baslik } : {}),
          });
          toast.success("Görsel eklendi — kaydetmeyi unutmayın.");
        }}
      />

      {/* Görsel ekleme için gizli dosya girişi — Tomar'daki komut bunu tıklar. */}
      <input
        ref={dosyaGirisi}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void gorselBlokEkle(f);
          e.target.value = "";
        }}
      />

      {/* ————————————————————————————————————————— kurtarma kopyası */}
      <Dialog open={kurtarma !== null} onOpenChange={(a) => !a && setKurtarma(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kaydedilmemiş değişiklik bulundu</DialogTitle>
            <DialogDescription>
              Bu tarayıcıda {kurtarma ? new Date(kurtarma.an).toLocaleString("tr-TR") : ""}{" "}
              tarihli, kaydedilmemiş bir çalışma duruyor. Geri yüklerseniz ekrandaki belge o
              hâle döner; kaydetmeden veritabanına hiçbir şey yazılmaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="oc-tap"
              onClick={() => {
                try {
                  window.localStorage.removeItem(kurtarmaAnahtari(revisionId));
                } catch {
                  /* zararsız */
                }
                setKurtarma(null);
              }}
            >
              Yoksay
            </Button>
            <Button
              className="oc-tap"
              onClick={() => {
                if (kurtarma) doc.govdeyiBenimse(kurtarma.payload);
                setKurtarma(null);
                toast.success("Geri yüklendi — kaydetmeyi unutmayın.");
              }}
            >
              Geri Yükle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* —————————————————————————————————————— deftere parça kaydet */}
      <Dialog open={parcaKaydi !== null} onOpenChange={(a) => !a && setParcaKaydi(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Metin parçaları defterine kaydet</DialogTitle>
            <DialogDescription>
              Blok deftere KOPYALANIR. Sonraki kılavuzlarda blok ekleme menüsünden tek tıkla
              eklenir; defter sonradan değişse bu belge değişmez.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="parca-baslik">Başlık</Label>
            <Input
              id="parca-baslik"
              value={parcaBaslik}
              onChange={(e) => setParcaBaslik(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="oc-tap" onClick={() => setParcaKaydi(null)}>
              Vazgeç
            </Button>
            <Button
              className="oc-tap"
              disabled={!parcaBaslik.trim()}
              onClick={() => {
                const kayit = parcaKaydi;
                if (!kayit) return;
                void (async () => {
                  const r = await saveManualSnippet({
                    title: parcaBaslik,
                    category: kayit.blok.kind,
                    sectionHint: kayit.bolum.key ?? "",
                    block: kayit.blok,
                  });
                  if (r.error) toast.error(r.error);
                  else {
                    toast.success("Deftere kaydedildi.");
                    setParcaKaydi(null);
                  }
                })();
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ————————————————————————————————————————————— yayım onayı */}
      <Dialog open={yayimOnayi} onOpenChange={setYayimOnayi}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revizyonu yayımla</DialogTitle>
            <DialogDescription>
              Yayımlanan revizyon DEĞİŞTİRİLEMEZ ve silinemez; otomatik tablolar bu anda
              dondurulur. Teslim edilmiş bir kılavuz vincin yanında asılıdır — sonradan
              düzeltilirse operatör başka bir belgeye bakar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="oc-tap" onClick={() => setYayimOnayi(false)}>
              Vazgeç
            </Button>
            <Button
              className="oc-tap"
              disabled={yayimlaniyor}
              onClick={() => {
                setYayimOnayi(false);
                yayimlaBasla(async () => {
                  const r = await issueManualRevision(projectId, revisionId);
                  if (r.error) toast.error(r.error);
                  else window.location.reload();
                });
              }}
            >
              {yayimlaniyor ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Yayımla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
