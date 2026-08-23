"use client";

// Ekipman listesi paneli (client) — sekmeli tablo görünümü + ek satır editörü +
// Excel/PDF indirme. Otomatik satırların hesap alanları salt-okunurdur; her
// satırın "Ek Özellikler" hücresi düzenlenebilir ve odak çıkışında kendiliğinden
// kaydedilir (equipment_notes, madde 34). "Ek Ekipman / Özellikler" bölümündeki
// serbest satırlar düzenlenebilir/silinebilir ve topluca kaydedilir.
//
// Kaydırma: sayfa app-shell'in normal (sabit çerçeve OLMAYAN) kipinde açılır;
// tablo yalnız YATAY kendi kabında kayar, dikey kaydırma sayfanındır (madde 35).
//
// SÜTUN KAYMASI (madde 36). İki ayrı sorun aynı ekranda birleşiyordu:
//   1. Tablo hücreleri `whitespace-nowrap` devralıyordu; "Özellikler" sütunundaki
//      uzun katalog metni satırı tek satıra zorlayınca tablo ekrandan taşıyor,
//      yüzdeyle verilen sütun genişlikleri taşan genişliğe göre hesaplandığı için
//      başlıklar da içerikle birlikte sağa kayıyordu. Uzun metin sütunları artık
//      SARILIR (`whitespace-normal`), tablo ekrana oturur.
//   2. Ek satır editöründe başlık şeridi ile satırlar AYRI ızgaralardı ve
//      başlıkta silme düğmesinin yeri yoktu (`auto` sütun 0 px, satırlarda 32 px);
//      etiketler sütunlarından bir düğme boyu kayıyordu. Izgara tanımı tek yerde
//      toplandı ve başlığa aynı genişlikte boşluk kondu.

import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BookOpen, ExternalLink, FileDown, FilePlus2, FileSpreadsheet, Link2, Loader2, Plus, Save, Trash2,
} from "lucide-react";
import type { EqGroup, EquipmentExtraRow, SummarySection } from "@/lib/excel/equipment";
import { dsKey, summaryRowValue } from "@/lib/excel/equipment";
import { EQUIPMENT_ATTACHMENT_BUCKET } from "@/lib/equipment-attachments";
import { customerDrawingPathOf } from "@/lib/equipment-customer-link";
import { createClient } from "@/lib/supabase/client";
import { kimlikBuyuk } from "@/lib/tr-text";
import {
  saveCustomerDrawingLink, saveDrawingNote, saveEquipmentExtras, saveEquipmentNote,
} from "./actions";
import { Textarea } from "@/components/ui/textarea";
import { DiagramSvg } from "@/components/diagrams/diagram-svg";
import {
  deleteEquipmentAttachment,
  registerEquipmentAttachment,
} from "./attachment-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PdfDownloadLink } from "@/components/pdf-download-link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

type Scope = "customer" | "full";

const EMPTY: EquipmentExtraRow = {
  group: "Ek Ekipman", component: "", brand: "", model: "", spec: "", qty: "",
};

/**
 * Ek satır editörünün sütun tanımı — başlık şeridi ve satırlar AYNI tanımı
 * kullanır.
 *
 * Sütunlar YALNIZ md üstünde yan yanadır: 375px'lik ekranda altı sütunun her
 * biri ~47px'e düşüyordu ve alanlara yazmak imkânsızdı. Mobilde alanlar alt
 * alta iner, her biri kendi görünür etiketini taşır ve başlık şeridi gizlenir
 * (sözleşme §7).
 */
// Son sütun silme düğmesinindir; dokunmatikte düğme 40px'e çıktığı için ray
// 2rem yerine 2.5rem'dir (yoksa düğme sütunundan taşıyordu).
const EXTRA_COLS = "md:grid-cols-[1fr_1fr_1fr_1.6fr_0.5fr_2.5rem]";
const EXTRA_GRID = `grid grid-cols-1 gap-2 ${EXTRA_COLS} md:items-center`;
const EXTRA_HEAD = `hidden gap-2 md:grid md:items-center ${EXTRA_COLS}`;

/**
 * Ek satır alanı: mobilde girdinin üstünde görünür etiket durur; md üstünde
 * sütun adları başlık şeridinden okunduğu için etiket gizlenir.
 */
function ExtraField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-medium text-muted-foreground md:hidden">{label}</span>
      {children}
    </label>
  );
}

/**
 * Bir ekipman satırının "Ek Özellikler" hücresi (madde 34).
 * Yazma durduktan ~700 ms sonra ve odak çıkışında kendiliğinden kaydeder;
 * ayrı bir "Kaydet" düğmesi yoktur — not bir hesap değeri değil açıklamadır.
 */
function NoteCell({
  rowKey,
  initial,
  onSave,
}: {
  rowKey: string;
  initial: string;
  onSave: (rowKey: string, note: string) => Promise<string | null>;
}) {
  const [value, setValue] = useState(initial);
  const [durum, setDurum] = useState<"temiz" | "bekliyor" | "kaydedildi">("temiz");
  // En son BAŞARIYLA kaydedilen değer; gereksiz yazma isteği göndermemek için.
  const sonKayit = useRef(initial);

  const kaydet = useCallback(
    async (yeni: string) => {
      if (yeni === sonKayit.current) return;
      const hata = await onSave(rowKey, yeni);
      if (hata) {
        toast.error(hata);
        setDurum("temiz");
        return;
      }
      sonKayit.current = yeni;
      setDurum("kaydedildi");
    },
    [onSave, rowKey]
  );

  // Yazma durduğunda kaydet (debounce). Bileşen sökülürse zamanlayıcı iptal
  // olur; odak çıkışı (onBlur) ikinci güvenceyi verir.
  useEffect(() => {
    if (value === sonKayit.current) return;
    setDurum("bekliyor");
    const t = setTimeout(() => void kaydet(value), 700);
    return () => clearTimeout(t);
  }, [value, kaydet]);

  return (
    <div className="relative">
      <textarea
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void kaydet(value)}
        placeholder="Ek Özellik"
        aria-label="Ek özellikler"
        // Ham `<textarea>` de dokunmatik payını korumalıdır (sözleşme §3):
        // iOS Safari 16px altındaki alana odaklanınca sayfayı kendiliğinden
        // yakınlaştırır ve geri çıkmaz.
        className="field-sizing-content min-h-8 w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 hover:border-input focus:border-ring focus:bg-background focus:ring-[3px] focus:ring-ring/30 pointer-fine:text-xs pointer-coarse:min-h-10"
      />
      {durum !== "temiz" && (
        <span
          aria-hidden
          title={durum === "bekliyor" ? "Kaydediliyor…" : "Kaydedildi"}
          className={`pointer-events-none absolute top-1 right-1 size-1.5 rounded-full ${
            durum === "bekliyor" ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
      )}
    </div>
  );
}

/** Ekranda tutulan ek kaydı — baytlar değil, kimlik + ölçü. */
export interface PanelAttachment {
  id: string;
  rowKey: string;
  fileName: string;
  pageCount: number;
}

/** Bucket'ın kabul ettiği en büyük dosya (migration ile aynı sayı). */
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function EquipmentPanel({
  projectId, revisionId, autoGroups, summary, initialExtras, initialAttachments,
  initialDrawingNote, initialCustomerDrawingPath, datasheetUrls, sheetUrls, locked,
}: {
  projectId: string;
  revisionId: string;
  autoGroups: EqGroup[];
  summary: SummarySection[];
  /**
   * Ressam notu — özetin en altındaki serbest metin. İSTEĞE BAĞLIDIR: dev
   * önizleme sayfası bu prop'u vermez ve vermemesi gerekir (orada kayıt yolu
   * yoktur).
   */
  initialDrawingNote?: string;
  /** Ekipman PDF/Excel'inde "Proje Ana Paftası" olarak açılan müşteri yolu. */
  initialCustomerDrawingPath?: string;
  initialExtras: EquipmentExtraRow[];
  /** Satırlara yüklenmiş PDF ekleri (equipment_attachments) */
  initialAttachments: PanelAttachment[];
  datasheetUrls: Record<string, string>;
  /** kind|brand|model → uygulamadaki katalog sayfası adresi (ekipman adına bağlanır) */
  sheetUrls: Record<string, string>;
  locked: boolean;
}) {
  const [extras, setExtras] = useState<EquipmentExtraRow[]>(initialExtras);
  const [attachments, setAttachments] = useState<PanelAttachment[]>(initialAttachments);
  /** Yükleme/silme sürerken o satırın denetimleri kilitlenir. */
  const [busyRows, setBusyRows] = useState<Set<string>>(() => new Set());
  const [scope, setScope] = useState<Scope>("customer");
  const [pending, startTransition] = useTransition();
  /**
   * Ressam notu. Özet listesi SUNUCUDAN gelir ve "Notlar" bölümünü zaten
   * içerir; buradaki durum yalnız DÜZENLEME kutusunundur. İkisi aynı kaynağı
   * gösterir, kayıt sonrası sayfa tazelenir (revalidatePath).
   */
  const [drawingNote, setDrawingNote] = useState(initialDrawingNote ?? "");
  const [customerDrawingPath, setCustomerDrawingPath] = useState(
    initialCustomerDrawingPath ?? ""
  );
  const [customerLinkPending, startCustomerLinkTransition] = useTransition();
  const customerDrawingPreviewPath = customerDrawingPathOf(customerDrawingPath);
  const [noteState, setNoteState] = useState<"temiz" | "bekliyor" | "kaydedildi">("temiz");

  const dlBase = `/projects/${projectId}/revisions/${revisionId}/equipment/download`;
  const dl = (format: "xlsx" | "pdf", detailed = false) =>
    `${dlBase}?format=${format}&scope=${scope}${detailed ? "&detay=1" : ""}`;

  function setRow(i: number, patch: Partial<EquipmentExtraRow>) {
    setExtras((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setExtras((rows) => [...rows, { ...EMPTY }]);
  }
  function removeRow(i: number) {
    setExtras((rows) => rows.filter((_, idx) => idx !== i));
  }
  // Not kaydı: hata mesajını döndürür (null = başarılı). Kimliği sabit
  // kalmalı ki NoteCell'in debounce etkisi her boyamada yeniden kurulmasın.
  const saveNote = useCallback(
    async (rowKey: string, note: string): Promise<string | null> => {
      const result = await saveEquipmentNote(projectId, revisionId, rowKey, note);
      return result?.error ?? null;
    },
    [projectId, revisionId]
  );

  /**
   * Ressam notu kaydı — satır notlarıyla AYNI mekanik: 700 ms gecikmeli
   * otomatik kayıt + odak kaybında ikinci güvence. Panelde "Kaydet" düğmesi
   * yalnız ek satırlar içindir; not için ikinci bir düğme, iki farklı kayıt
   * ritmi demek olurdu.
   */
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedNote = useRef(initialDrawingNote ?? "");
  const flushNote = useCallback(
    async (value: string) => {
      if (value === savedNote.current) return;
      savedNote.current = value;
      const result = await saveDrawingNote(projectId, revisionId, value);
      if (result?.error) {
        toast.error(result.error);
        setNoteState("temiz");
        return;
      }
      setNoteState("kaydedildi");
    },
    [projectId, revisionId]
  );
  function onNoteChange(value: string) {
    setDrawingNote(value);
    setNoteState("bekliyor");
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => void flushNote(value), 700);
  }

  function save() {
    startTransition(async () => {
      const result = await saveEquipmentExtras(projectId, revisionId, extras);
      if (result?.error) toast.error(result.error);
      else toast.success("Ek satırlar kaydedildi");
    });
  }

  function saveMainDrawingLink() {
    startCustomerLinkTransition(async () => {
      const result = await saveCustomerDrawingLink(
        projectId,
        revisionId,
        customerDrawingPath
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setCustomerDrawingPath(result.path ?? "");
      toast.success(result.path ? "Ana pafta ekipman listesine bağlandı." : "Ana pafta bağlantısı kaldırıldı.");
    });
  }

  // ------------------------------------------------------------- Ek Belge
  //
  // BAYTLAR SUNUCU ACTION'INDAN GEÇMEZ: dosya doğrudan depoya yüklenir
  // (`folder-picker.tsx` deseni), action yalnız kaydı yazar ve dosyayı
  // depodan OKUYUP sayfasını sayar. Server action gövdesinin varsayılan
  // sınırı 1 MB'tır; taranmış bir katalog yaprağı bunu rahatça aşar.

  const setRowBusy = useCallback((rowKey: string, busy: boolean) => {
    setBusyRows((prev) => {
      const next = new Set(prev);
      if (busy) next.add(rowKey);
      else next.delete(rowKey);
      return next;
    });
  }, []);

  const uploadAttachments = useCallback(
    async (rowKey: string, files: File[]) => {
      if (files.length === 0) return;
      setRowBusy(rowKey, true);
      const supabase = createClient();
      // Sıra numarası mevcut ek adedinden devam eder: kullanıcının yükleme
      // sırası destede de korunur.
      let sort = attachments.filter((a) => a.rowKey === rowKey).length;

      for (const file of files) {
        const pdfMi =
          file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        if (!pdfMi) {
          toast.error(`${file.name}: yalnız PDF eklenebilir.`);
          continue;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          toast.error(`${file.name}: dosya 25 MB sınırını aşıyor.`);
          continue;
        }

        const attachmentId = crypto.randomUUID();
        // TİP DOĞRU OLSUN DİYE `slice`: storage-js, gövde bir File olduğunda
        // `contentType` seçeneğini YOK SAYAR ve nesne octet-stream olarak
        // yazılırdı (folder-picker.tsx'te belgelenmiş tuzak). `slice` kopya
        // çıkarmaz, yalnız tipi olan yeni bir görünüm verir.
        const govde = file.slice(0, file.size, "application/pdf");
        const { error } = await supabase.storage
          .from(EQUIPMENT_ATTACHMENT_BUCKET)
          .upload(`${revisionId}/${attachmentId}.pdf`, govde, {
            contentType: "application/pdf",
          });
        if (error) {
          toast.error(`${file.name}: yüklenemedi — ${error.message}`);
          continue;
        }

        const sonuc = await registerEquipmentAttachment(projectId, revisionId, {
          attachmentId,
          rowKey,
          fileName: file.name,
          sort,
        });
        if (sonuc?.error) {
          toast.error(`${file.name}: ${sonuc.error}`);
          continue;
        }
        sort += 1;
        setAttachments((prev) => [
          ...prev,
          {
            id: attachmentId,
            rowKey,
            fileName: file.name,
            pageCount: sonuc?.pageCount ?? 0,
          },
        ]);
        toast.success(`${file.name} eklendi (${sonuc?.pageCount ?? 0} sayfa)`);
      }
      setRowBusy(rowKey, false);
    },
    [attachments, projectId, revisionId, setRowBusy]
  );

  const removeAttachment = useCallback(
    async (attachment: PanelAttachment) => {
      setRowBusy(attachment.rowKey, true);
      const sonuc = await deleteEquipmentAttachment(projectId, revisionId, attachment.id);
      setRowBusy(attachment.rowKey, false);
      if (sonuc?.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Ek belge silme talebi Yönetici onayına gönderildi.");
    },
    [projectId, revisionId, setRowBusy]
  );

  /**
   * Bir satırın "Ek Belge" hücresi.
   *
   * Katalog sayfası düğmesinden (ekipman adındaki kitap ikonu) FARKLIDIR: o,
   * defterden gelen üretici sayfasını açar; bu, defterin kapsamı dışında kalan
   * ürünler için mühendisin kendi yaprağını ekler. İkisi bir arada durabilir ve
   * detaylı PDF'te ikisi de basılır.
   */
  function AttachmentCell({ rowKey }: { rowKey: string }) {
    const list = attachments.filter((a) => a.rowKey === rowKey);
    const busy = busyRows.has(rowKey);
    return (
      <div className="grid gap-1">
        {list.map((a) => (
          <span key={a.id} className="flex items-start gap-1">
            <span className="min-w-0 flex-1 text-[11px] leading-tight break-words">
              <span className="font-mono text-muted-foreground">{a.pageCount} sf</span>{" "}
              <span title={a.fileName}>{a.fileName}</span>
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void removeAttachment(a)}
              aria-label={`${a.fileName} ekini kaldır`}
              className="oc-tap-square inline-flex size-5 shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10 disabled:opacity-40"
            >
              <Trash2 className="size-3" />
            </button>
          </span>
        ))}
        {/* Dosya girdisi görünmez, TETİKLEYİCİ ETİKETTİR: ham `<input
            type="file">` düğmesi tarayıcıdan tarayıcıya değişir ve Türkçe
            metni yazdırılamaz. `label` hem hedefi 44px'e taşır hem metni
            uygulamanın diline getirir. */}
        <label className="oc-tap inline-flex min-h-8 cursor-pointer items-center gap-1 text-[11px] text-primary hover:underline pointer-coarse:min-h-10">
          {busy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <FilePlus2 className="size-3" />
          )}
          {busy ? "Yükleniyor…" : "PDF ekle"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              // Girdi SIFIRLANIR: aynı dosya ikinci kez seçildiğinde `change`
              // olayı yoksa kullanıcı hiçbir şey olmadığını sanır.
              e.target.value = "";
              void uploadAttachments(rowKey, files);
            }}
          />
        </label>
      </div>
    );
  }

  function ModelCell({ row }: { row: EqGroup["rows"][number] }) {
    const url = row.kind ? datasheetUrls[dsKey(row.kind, row.brand, row.model)] : undefined;
    if (url && row.model && row.model !== "-") {
      return (
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          {row.model}
          <ExternalLink className="size-3" />
        </a>
      );
    }
    return <span>{row.model}</span>;
  }

  /**
   * Ekipman adı — ürünün katalog sayfası varsa YENİ SEKMEDE açılır.
   *
   * Model hücresindeki bağlantıdan farklıdır: o üretici websitesine (yönetim
   * panelinden girilen datasheet), bu uygulamanın kendi katalog sayfası
   * görüntüleyicisine gider. Aynı adres Excel ve PDF çıktılarında da kullanılır.
   */
  function ComponentCell({ row }: { row: EqGroup["rows"][number] }) {
    const url = row.kind ? sheetUrls[dsKey(row.kind, row.brand, row.model)] : undefined;
    if (!url) return <span>{row.component}</span>;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Katalog sayfasını yeni sekmede aç"
        // Dokunmatikte 36px: bağlantı satır yüksekliğini fareyle kullanan
        // kullanıcıda büyütmez, parmakla kullananda hedefi tutulabilir yapar.
        className="inline-flex items-center gap-1 hover:text-primary hover:underline pointer-coarse:min-h-9"
      >
        {row.component}
        <BookOpen className="size-3 shrink-0 text-primary/70" />
      </a>
    );
  }

  return (
    <div className="grid gap-4">
      {/* İndirme çubuğu */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card p-3">
        <div className="text-sm font-medium">İndir:</div>
        {/* Kapsam düğmeleri ~28px'ti; parmakla tutulabilmesi gerekir (§2) */}
        <div className="inline-flex overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={() => setScope("customer")}
            className={`inline-flex min-h-9 items-center px-3 py-1.5 text-xs pointer-coarse:min-h-10 ${scope === "customer" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            Müşteri
          </button>
          <button
            type="button"
            onClick={() => setScope("full")}
            className={`inline-flex min-h-9 items-center px-3 py-1.5 text-xs pointer-coarse:min-h-10 ${scope === "full" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            + Teknik Özet
          </button>
        </div>
        <a href={dl("xlsx")} className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm shadow-xs hover:bg-muted pointer-coarse:h-10">
          <FileSpreadsheet className="size-3.5 text-emerald-600" />
          Excel indir
        </a>
        {/* İki PDF: standart liste ve KATALOG SAYFALARI EKLİ detaylı liste.
            Detaylı dosya onlarca taranmış sayfa taşıdığı için MB'larca tutar;
            müşteriye gidecek olan çoğu zaman standarttır, bu yüzden ikisi ayrı
            düğmedir ve hangisinin ne getirdiği yazılıdır. */}
        <PdfDownloadLink
          href={dl("pdf")}
          shareTitle="Standart Ekipman Listesi"
          title={
            scope === "full"
              ? "Teknik özellikler yaprağı + ekipman listesi + teknik ressam özeti (şemalar ve notlarla)"
              : "Ekipman listesi; ekipman adı katalog sayfasına bağlanır"
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm shadow-xs hover:bg-muted pointer-coarse:h-10"
        >
          <FileDown className="size-3.5 text-red-600" />
          Standart Ekipman Listesi
        </PdfDownloadLink>
        <PdfDownloadLink
          href={dl("pdf", true)}
          shareTitle="Detaylı Ekipman Listesi"
          title={
            scope === "full"
              ? "Standart paketin tamamı + ürünlerin katalog sayfaları + satırlara yüklenen PDF ekleri"
              : "Ekipman listesi + ürünlerin katalog sayfaları + satırlara yüklenen PDF ekleri; ad tıklanınca ilgili sayfaya gider"
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-sm shadow-xs hover:bg-muted pointer-coarse:h-10"
        >
          <BookOpen className="size-3.5 text-red-600" />
          Detaylı Ekipman Listesi
        </PdfDownloadLink>
        {/* KAPSAM İKİ PDF DÜĞMESİNİN DE ÜSTÜNDEDİR: "+ Teknik Özet" seçiliyken
            standart ve detaylı listenin ikisi de aynı ressam paketini taşır
            (teknik özellikler yaprağı + şemalı özet + notlar); `detay`
            yalnız katalog sayfası eklerini değiştirir. */}
        {scope === "full" && (
          <span className="w-full text-[11px] text-muted-foreground">
            Teknik özet açıkken PDF ressam paketidir: ilk yaprakta teknik
            özellikler, sonunda şemalı ölçü özeti ve notlar.
          </span>
        )}
        {/* `ml-auto` dar ekranda sayaç sardığında tek başına bir satır
            kaplıyordu; sağa itme yalnız sm üstünde. */}
        <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto sm:text-right">
          {autoGroups.reduce((n, g) => n + g.rows.length, 0)} otomatik · {extras.length} ek satır
          {Object.keys(sheetUrls).length > 0 && ` · ${Object.keys(sheetUrls).length} katalog sayfası`}
          {attachments.length > 0 &&
            ` · ${attachments.length} ek belge (${attachments.reduce((n, a) => n + a.pageCount, 0)} sayfa)`}
        </span>
        <div className="grid w-full gap-1.5 border-t pt-3 sm:grid-cols-[auto_minmax(16rem,1fr)_auto_auto] sm:items-center">
          <label htmlFor="customer-main-drawing" className="inline-flex items-center gap-1.5 text-xs font-medium">
            <Link2 className="size-3.5 text-primary" /> Proje Ana Paftası
          </label>
          <Input
            id="customer-main-drawing"
            value={customerDrawingPath}
            onChange={(event) => setCustomerDrawingPath(event.target.value)}
            aria-label="Proje ana paftası müşteri bağlantısı"
            className="h-8 font-mono text-xs pointer-coarse:h-10"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={customerLinkPending}
            onClick={saveMainDrawingLink}
          >
            {customerLinkPending && <Loader2 className="size-3.5 animate-spin" />}
            Bağlantıyı kaydet
          </Button>
          {customerDrawingPreviewPath && (
            <a
              href={customerDrawingPreviewPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-8 items-center gap-1 text-xs text-primary hover:underline pointer-coarse:min-h-10"
            >
              Kontrol et <ExternalLink className="size-3" />
            </a>
          )}
          <p className="text-[11px] text-muted-foreground sm:col-span-4">
            Teknik Resimler → Dosyalar bölümündeki “Müşteri linki”ni buraya yapıştırın. Standart PDF ve Excel bu tek paftayı müşteriye açar.
          </p>
        </div>
      </div>

      <Tabs defaultValue="equipment">
        <TabsList>
          <TabsTrigger value="equipment">Ekipman Listesi</TabsTrigger>
          <TabsTrigger value="summary">Teknik Ressam Özeti</TabsTrigger>
        </TabsList>

        {/* ---- Ekipman Listesi ---- */}
        <TabsContent value="equipment" className="mt-3">
          {/* `table-fixed`: sütun genişlikleri BAŞLIKTAN belirlenir, hücre
              içeriğinden değil. Otomatik yerleşimde tek bir uzun katalog metni
              yüzdelik genişlikleri kendine göre yeniden bölüştürüyor ve
              sütunlar satırdan satıra kayıyordu.

              SÜTUN ÖNCELİKLENDİRME (sözleşme §6): 375px'te altı sütun 22–46px'e
              sıkışıyor, hücrelerin içeriği okunmuyor ve not alanına yazılamıyordu.
              md ALTINDA aynı satır kart olur; marka/model/özellik bilgileri
              ekipman adının altına iner, not alanı tam genişliği kullanır
              (tek kaynak, ayrı kart markup'ı yok). */}
          <div className="relative overflow-hidden rounded-lg border">
            <Table
              containerClassName="oc-mobile-table-wrap"
              className="oc-mobile-table table-fixed"
            >
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[46%] md:w-[17%]">Ekipman</TableHead>
                  <TableHead className="hidden md:table-cell md:w-[9%]">Marka</TableHead>
                  <TableHead className="hidden md:table-cell md:w-[13%]">Model</TableHead>
                  <TableHead className="hidden md:table-cell">Özellikler</TableHead>
                  <TableHead className="w-[36%] md:w-[16%]">Ek Özellikler</TableHead>
                  {/* Ek Belge YALNIZ lg üstünde kendi sütunudur; altında
                      denetim ekipman adının altına iner (sözleşme §7 —
                      ikinci bir kart markup'ı yazılmaz, aynı bileşen
                      kırılıma göre bir kez basılır). */}
                  <TableHead className="hidden lg:table-cell lg:w-[13%]">Ek Belge</TableHead>
                  <TableHead className="w-[18%] text-center md:w-[6%]">Adet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoGroups.map((g) => (
                  <Fragment key={`g-${g.name}`}>
                    <TableRow
                      data-mobile-summary
                      className="bg-primary/5 hover:bg-primary/5"
                    >
                      <TableCell
                        colSpan={7}
                        data-mobile-span="full"
                        data-mobile-hide-label
                        className="py-1.5 text-xs font-semibold uppercase tracking-wide text-primary"
                      >
                        {g.name}
                      </TableCell>
                    </TableRow>
                    {g.rows.map((r, i) => (
                      <TableRow key={`${g.name}-${i}`} className="align-top">
                        <TableCell
                          data-label="Ekipman"
                          data-mobile-span="full"
                          className="font-medium break-words whitespace-normal"
                        >
                          <ComponentCell row={r} />
                          {/* Mobilde gizlenen sütunların kritik bilgisi burada;
                              model bağlantısı da korunur. */}
                          <div className="mt-0.5 text-[11px] font-normal break-words text-muted-foreground md:hidden">
                            {r.brand && r.brand !== "-" ? `${r.brand} · ` : ""}
                            <ModelCell row={r} />
                          </div>
                          {r.spec && (
                            <div className="mt-0.5 text-[11px] font-normal break-words text-muted-foreground md:hidden">
                              {r.spec}
                            </div>
                          )}
                          {/* Ek Belge denetimi lg ALTINDA burada durur: dar
                              ekranda yedi sütun okunmaz hâle geliyordu. */}
                          {r.rowKey && (
                            <div className="mt-1 font-normal lg:hidden">
                              <AttachmentCell rowKey={r.rowKey} />
                            </div>
                          )}
                        </TableCell>
                        <TableCell data-label="Marka" className="hidden whitespace-normal md:table-cell">{r.brand}</TableCell>
                        <TableCell data-label="Model" className="hidden break-words whitespace-normal md:table-cell"><ModelCell row={r} /></TableCell>
                        <TableCell data-label="Özellikler" className="hidden text-xs whitespace-normal text-muted-foreground md:table-cell">{r.spec}</TableCell>
                        {/* Ek Özellikler: satırın tek düzenlenebilir hücresi (madde 34).
                            Satırın kararlı anahtarı yoksa (kuramsal) not tutulamaz. */}
                        <TableCell
                          data-label="Ek Özellikler"
                          data-mobile-span="full"
                          className="p-1 align-middle"
                        >
                          {r.rowKey ? (
                            <NoteCell
                              rowKey={r.rowKey}
                              initial={r.note ?? ""}
                              onSave={saveNote}
                            />
                          ) : (
                            <span className="px-2 text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell data-label="Ek Belge" className="hidden align-top lg:table-cell">
                          {r.rowKey ? (
                            <AttachmentCell rowKey={r.rowKey} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell data-label="Adet" className="text-center tabular-nums">
                          {String(r.qty)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Ek satır editörü */}
          <div className="mt-5 rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b bg-muted/40 px-3 py-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">
                Ek Ekipman / Özellikler
                {locked && (
                  <Badge variant="outline" className="text-[11px]">Revizyon yayınlandı — ek satırlar serbest</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={addRow}>
                  <Plus className="size-3.5" /> Satır ekle
                </Button>
                <Button type="button" size="sm" onClick={save} disabled={pending}>
                  <Save className="size-3.5" /> {pending ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              </div>
            </div>
            {extras.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Ek satır yok. Müşteriye özel ekipman veya özellik eklemek için &quot;Satır ekle&quot;.
              </p>
            ) : (
              <div className="grid gap-3 p-3 md:gap-2">
                <div className={`${EXTRA_HEAD} text-[11px] font-medium text-muted-foreground`}>
                  <span>Grup</span><span>Ekipman</span><span>Marka</span><span>Model / Özellik</span><span>Adet</span><span />
                </div>
                {extras.map((r, i) => (
                  // Mobilde satırlar alt alta indiği için birbirinden ince bir
                  // çizgiyle ayrılır; md üstünde ızgara zaten ayırıyor.
                  <div key={i} className={`${EXTRA_GRID} border-b pb-3 last:border-0 last:pb-0 md:border-0 md:pb-0`}>
                    <ExtraField label="Grup">
                      <Input className="h-8 pointer-coarse:h-10" placeholder="Ek Ekipman" value={r.group} onChange={(e) => setRow(i, { group: e.target.value })} />
                    </ExtraField>
                    <ExtraField label="Ekipman">
                      <Input className="h-8 pointer-coarse:h-10" placeholder="Ekipman" value={r.component} onChange={(e) => setRow(i, { component: e.target.value })} />
                    </ExtraField>
                    <ExtraField label="Marka">
                      {/* Marka BÜYÜK HARF yazılır — listedeki otomatik
                          satırlarla aynı kural (`baslikDuzeniniUygula`).
                          Dönüşüm burada da yapılır ki kullanıcı yazarken
                          görsün; kaydın kendisini `mergeExtras` garanti eder. */}
                      <Input className="h-8 pointer-coarse:h-10" placeholder="MARKA" value={r.brand} onChange={(e) => setRow(i, { brand: kimlikBuyuk(e.target.value) })} />
                    </ExtraField>
                    <ExtraField label="Model / Özellik">
                      <Input className="h-8 pointer-coarse:h-10" placeholder="Model / Özellik" value={r.spec || r.model} onChange={(e) => setRow(i, { spec: e.target.value })} />
                    </ExtraField>
                    <ExtraField label="Adet">
                      <Input className="h-8 pointer-coarse:h-10" value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} />
                    </ExtraField>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Satırı sil"
                      className="justify-self-end text-destructive md:justify-self-auto"
                      onClick={() => removeRow(i)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ---- Teknik Ressam Özeti ---- */}
        <TabsContent value="summary" className="mt-3">
          {/* ŞEMALAR ÇİZELGENİN İÇİNDE, BÖLÜM BAŞLIĞININ ALTINDA durur:
              ressamın baktığı ilk şey resmin kendisidir, sayılar onu okur.
              Çizim hesap raporundakiyle AYNI üreticiden gelir (`lib/diagrams`),
              yani ekrandaki ile kâğıttaki resim ayrışamaz. */}
          <div className="grid gap-4">
            {summary.map((sec) => (
              <div key={`s-${sec.name}`} className="relative overflow-hidden rounded-lg border">
                <div className="border-b bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  {sec.name}
                </div>
                {sec.kind === "notes" ? (
                  <p className="border-l-2 border-primary/70 bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
                    {sec.text}
                  </p>
                ) : (
                  <>
                    {sec.diagram && (
                      <div className="oc-scrollx relative overflow-x-auto border-b bg-card p-2">
                        <DiagramSvg diagram={sec.diagram} />
                      </div>
                    )}
                    {sec.rows.length > 0 && (
                      <Table
                        containerClassName="oc-mobile-table-wrap"
                        className="oc-mobile-table table-fixed"
                      >
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Ölçü / Özellik</TableHead>
                            <TableHead className="w-[20%] text-right">Değer</TableHead>
                            <TableHead className="w-[14%] text-center">Birim</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sec.rows.map((r, i) => (
                            <TableRow key={`${sec.name}-${i}`}>
                              <TableCell
                                data-label="Ölçü / Özellik"
                                data-mobile-span="full"
                                className="whitespace-normal"
                              >
                                {r.label}
                                {r.note && (
                                  <span className="block text-[11px] text-muted-foreground">
                                    {r.note}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell data-label="Değer" className="text-right tabular-nums">
                                {summaryRowValue(r)}
                              </TableCell>
                              <TableCell data-label="Birim" className="text-center text-muted-foreground">
                                {r.unit ?? ""}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* NOTLAR — mühendisin ressama yazdığı serbest metin. Kayıt satır
              notlarıyla aynı ritmi taşır (700 ms + odak kaybı); panelde ayrı
              bir "Kaydet" düğmesi YOKTUR, o yalnız ek satırlarındır. */}
          <div className="mt-4 grid gap-1.5 rounded-lg border border-dashed bg-muted/20 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="oc-kicker text-foreground/80">Ressama Notlar</span>
              <span className="text-[11px] text-muted-foreground">
                {noteState === "bekliyor"
                  ? "kaydediliyor…"
                  : noteState === "kaydedildi"
                    ? "kaydedildi"
                    : ""}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Çizim yapılırken bilinmesi gereken, hiçbir ölçünün yanına sığmayan
              şeyler. Özetin en altına kendi bölümüyle basılır; müşteri
              listesine girmez.
            </p>
            <Textarea
              rows={4}
              value={drawingNote}
              onChange={(e) => onNoteChange(e.target.value)}
              onBlur={() => void flushNote(drawingNote)}
              className="text-base pointer-fine:text-sm"
            />
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Teknik ressam özeti dahili bir çıktıdır; müşteri dosyasına dahil edilmez.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
