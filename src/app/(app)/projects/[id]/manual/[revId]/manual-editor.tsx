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
  ArrowUp,
  BookOpen,
  Eye,
  EyeOff,
  FileDown,
  Image as ImageIcon,
  Layers,
  List,
  Loader2,
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
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { MANUAL_IMAGE_BUCKET, type ManualImageRow } from "@/lib/manual/data";
import { manualAsset } from "@/lib/manual/assets";
import { manualDocCode, MANUAL_DOC_TITLE } from "@/lib/manual/naming";
import {
  blockHasContent,
  flattenManual,
  numberManual,
  printedManual,
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
  const [etiket, setEtiket] = useState(label);
  const [seciliId, setSeciliId] = useState<string>(initialPayload.sections[0]?.id ?? "");
  const [kirli, setKirli] = useState(false);
  const [kaydediliyor, kaydetBasla] = useTransition();
  const [yayimlaniyor, yayimlaBasla] = useTransition();
  const [kunyeAcik, setKunyeAcik] = useState(false);

  // YAYIMLANMIŞ REVİZYON SALT OKUNURDUR — engel DB tetikleyicisindedir
  // (`guard_issued_manual_revision`), buradaki yalnız ekranı dürüst tutar.
  const yazilabilir = canEdit && status === "draft";

  const numarali = useMemo(() => numberManual(payload.sections), [payload.sections]);
  const duz = useMemo(() => flattenManual(numarali), [numarali]);
  const basilan = useMemo(() => printedManual(payload), [payload]);
  const basilanSayisi = useMemo(
    () => flattenManual(numberManual(basilan.sections)).length,
    [basilan]
  );

  const secili = useMemo(() => bolumBul(payload.sections, seciliId), [payload.sections, seciliId]);
  const seciliNumarali = useMemo(
    () => duz.find((s) => s.id === seciliId) ?? null,
    [duz, seciliId]
  );

  const gorselHaritasi = useMemo(() => {
    const m = new Map<string, ManualImageRow>();
    for (const g of images) m.set(g.id, g);
    return m;
  }, [images]);

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
          · {basilanSayisi} bölüm basılıyor
        </span>
        {kirli && (
          <span className="inline-flex items-center gap-1 text-sm text-destructive">
            <TriangleAlert className="size-3.5" /> Kaydedilmedi
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setKunyeAcik((v) => !v)}>
            <BookOpen className="size-3.5" /> Künye
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={`/projects/${projectId}/manual/${revisionId}/pdf`}>
              <FileDown className="size-3.5" /> Gövde PDF
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={`/projects/${projectId}/manual/${revisionId}/pdf?ekler=1`}>
              <Layers className="size-3.5" /> Tam Sürüm
            </a>
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

      {kunyeAcik && (
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
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_1fr]">
        {/* ————————————————————————————————————— bölüm ağacı */}
        <nav className="max-h-[70dvh] overflow-y-auto rounded-lg border bg-card p-2">
          <ul className="grid gap-0.5">
            {duz.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSeciliId(s.id)}
                  className={`oc-tap flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    s.id === seciliId ? "bg-muted font-medium" : "hover:bg-muted/60"
                  } ${s.hidden ? "opacity-45" : ""}`}
                  style={{ paddingLeft: `${0.5 + (s.depth - 1) * 0.85}rem` }}
                >
                  <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground">
                    {s.number}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{s.title}</span>
                  {s.hidden && <EyeOff className="size-3 shrink-0 text-muted-foreground" />}
                  {s.appendix && <Layers className="size-3 shrink-0 text-muted-foreground" />}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* ————————————————————————————————————— bölüm içeriği */}
        <section className="grid gap-3">
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
            />
          )}
        </section>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————— bölüm paneli

function BolumPaneli({
  bolum,
  numarali,
  sources,
  images,
  revisionId,
  readOnly,
  onBaslik,
  onGizle,
  onBlok,
  onBlokSil,
  onBlokTasi,
  onBlokEkle,
  onStandardaDon,
}: {
  bolum: ManualSection;
  numarali: NumberedSection;
  sources: ManualSourceData;
  images: Map<string, ManualImageRow>;
  revisionId: string;
  readOnly: boolean;
  onBaslik: (v: string) => void;
  onGizle: () => void;
  onBlok: (blokId: string, f: (b: ManualBlock) => ManualBlock) => void;
  onBlokSil: (blokId: string) => void;
  onBlokTasi: (blokId: string, yon: "yukari" | "asagi") => void;
  onBlokEkle: (b: ManualBlock) => void;
  onStandardaDon: (blokId: string) => void;
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
              <strong>{MANUAL_APPENDIX_LABELS[bolum.appendix]}</strong> eki. Gövdede yalnız bir
              ayraç kapağı basılır; belgenin kendisi &quot;Tam Sürüm&quot; indirilirken bu
              kapağın ardına eklenir.
            </span>
          </p>
        )}
      </div>

      {bolum.blocks.map((b, i) => (
        <BlokKarti
          key={b.id}
          blok={b}
          ilk={i === 0}
          son={i === bolum.blocks.length - 1}
          sources={sources}
          images={images}
          revisionId={revisionId}
          readOnly={readOnly}
          onDegis={(f) => onBlok(b.id, f)}
          onSil={() => onBlokSil(b.id)}
          onTasi={(yon) => onBlokTasi(b.id, yon)}
          onStandardaDon={() => onStandardaDon(b.id)}
        />
      ))}

      {!readOnly && <BlokEkleSeridi onEkle={onBlokEkle} />}
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
    <div className="oc-scrollx overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
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
                <td key={j} className="px-2 py-1">
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
      <div className="oc-scrollx overflow-x-auto">
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
  assetKey,
  readOnly,
  onDegis,
}: {
  blok: Extract<ManualBlock, { kind: "image" }>;
  kayit: ManualImageRow | null;
  /** Şablon varlığının anahtarı — yüklenmiş görselde boştur. */
  assetKey?: string;
  readOnly: boolean;
  onDegis: (f: (b: ManualBlock) => ManualBlock) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  // ŞABLON GÖRSELİ DEPODAN DEĞİL REPODAN gelir; önizlemesi de statik bir
  // adrestir (`/manual-assets/…`), imzalı bağlantı gerektirmez.
  const varlik = assetKey ? manualAsset(assetKey) : null;

  useEffect(() => {
    if (!kayit) return;
    let iptal = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from(MANUAL_IMAGE_BUCKET)
        .createSignedUrl(kayit.storagePath, 600);
      if (!iptal && data?.signedUrl) setUrl(data.signedUrl);
    })();
    return () => {
      iptal = true;
    };
  }, [kayit]);

  const gosterilen = varlik ? `/manual-assets/${varlik.file}` : url;

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

function BlokEkleSeridi({ onEkle }: { onEkle: (b: ManualBlock) => void }) {
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
      <GorselEkle onEkle={onEkle} />
    </div>
  );
}

function GorselEkle({ onEkle }: { onEkle: (b: ManualBlock) => void }) {
  const girdi = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function yukle(file: File) {
    if (file.size > EN_BUYUK_GORSEL) {
      toast.error("Görsel 25 MB sınırını aşıyor.");
      return;
    }
    setYukleniyor(true);
    try {
      // Görsel kaydı SUNUCUDA yazılır: boyut ÖLÇÜLÜR (sharp), beyan
      // edilmez — yanlış bir en-boy oranı PDF'te resmi ezerdi.
      const gövde = new FormData();
      gövde.set("dosya", file);
      const r = await fetch(window.location.pathname + "/gorsel", {
        method: "POST",
        body: gövde,
      });
      const j = (await r.json()) as { imageId?: string; error?: string };
      if (!r.ok || j.error || !j.imageId) {
        toast.error(j.error ?? "Görsel yüklenemedi.");
        return;
      }
      onEkle({ id: yeniId(), kind: "image", imageId: j.imageId });
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
}: {
  identity: ManualIdentity;
  docTitle: string;
  coverTitle: string;
  etiket: string;
  readOnly: boolean;
  onChange: (alan: keyof ManualIdentity, deger: string) => void;
  onDoc: (alan: "docTitle" | "coverTitle", deger: string) => void;
  onEtiket: (v: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">
        Kapak künyesi. Bilinmeyen alan BOŞ bırakılır — belgede o satır hiç
        basılmaz; bir örnek değer yazmak, teslim edilen kılavuzda başka bir
        vincin seri numarası olarak kalabilir.
      </p>
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
