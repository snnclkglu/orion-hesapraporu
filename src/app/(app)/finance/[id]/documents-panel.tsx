"use client";

// ÖZLÜK DOSYALARI — sözleşme, İSG eğitimi, sağlık raporu, kimlik, sertifika.
//
// BAYTLAR SERVER ACTION'DAN GEÇMEZ. Tarayıcı dosyayı doğrudan `personnel`
// bucket'ına yükler, eylem yalnız TABLO SATIRINI yazar. Sebebi ölçülmüştür:
// Next.js server action gövdesinin varsayılan sınırı 1 MB'tır ve taranmış bir
// sözleşme bunu aşar (`equipment-panel.tsx` ile birebir aynı kalıp).
//
// SIRA ÖNEMLİDİR ve tersine çevrilmez:
//   1. istemci `documentId` üretir  → depo yolu satır yazılmadan bilinir
//   2. baytlar depoya gider
//   3. `registerDocument` çağrılır  → sunucu dosyayı GERİ İNDİRİR, PDF ise
//      sayfasını SAYAR, açılamıyorsa nesneyi SİLER ve kaydı YAZMAZ
// Tersi (önce kayıt, sonra bayt) "kaydı var, dosyası yok" bir satır bırakırdı
// ve o satır yıllar sonra bir denetimde ortaya çıkardı.
//
// SÜRELİ BELGE BİR HATIRLATMADIR, BİR ENGEL DEĞİL. İSG eğitimi (6331 md. 17)
// ve periyodik muayene (md. 15) süreye bağlıdır; süresi geçmiş bir rapor
// personeli sistemden düşürmez, insanın bakması gereken bir satır üretir.
// Dil de bunu yansıtır: "süresi dolmuş" denir, "eksik" ya da "hatalı" denmez.

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2, Paperclip, Pencil, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABELS,
  EXPIRY_LABELS,
  MAX_DOCUMENT_BYTES,
  PERSONNEL_BUCKET,
  belgeMimeTuru,
  belgeTuruUygunMu,
  documentKindHue,
  documentKindLabel,
  expiresByDefault,
  expiryState,
  personnelStoragePath,
  type ExpiryState,
} from "@/lib/finance/personnel";
import { tagStyle } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { deleteDocument, registerDocument, signDocumentUrl, updateDocumentMeta } from "../document-actions";
import type { DocumentRow } from "../schema";

const AT_MD = "hidden md:table-cell";
const AT_LG = "hidden lg:table-cell";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Bayt → okunur boy. Ondalık yalnız MB'ta anlamlı. */
function fmtBytes(n: number): string {
  if (!n) return "—";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Geçerlilik rozetinin görsel ağırlığı: geçmiş > yaklaşan > sessiz. */
const DURUM_SINIF: Record<ExpiryState, string> = {
  yok: "hidden",
  gecerli: "border-border text-muted-foreground",
  yaklasiyor: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  gecti: "border-destructive/40 bg-destructive/10 text-destructive",
};

interface YuklemeFormu {
  kind: string;
  title: string;
  issuedOn: string;
  expiresOn: string;
  notes: string;
}

const BOS_FORM: YuklemeFormu = {
  kind: "sozlesme",
  title: "",
  issuedOn: "",
  expiresOn: "",
  notes: "",
};

export function DocumentsPanel({
  employeeId,
  documents,
  bugun,
  canWrite,
}: {
  employeeId: string;
  documents: DocumentRow[];
  bugun: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<YuklemeFormu>(BOS_FORM);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [aciliyor, setAciliyor] = useState<string | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<DocumentRow | null>(null);
  const [silinecek, setSilinecek] = useState<DocumentRow | null>(null);
  const girdiRef = useRef<HTMLInputElement>(null);

  /** Süresi dolan/dolmak üzere olanlar — üstteki hatırlatma şeridi. */
  const uyarilar = useMemo(() => {
    const gecti: DocumentRow[] = [];
    const yaklasiyor: DocumentRow[] = [];
    for (const d of documents) {
      const s = expiryState(d.expiresOn, bugun);
      if (s === "gecti") gecti.push(d);
      else if (s === "yaklasiyor") yaklasiyor.push(d);
    }
    return { gecti, yaklasiyor };
  }, [documents, bugun]);

  /** Tür sırası ekranda sabittir: aynı belge listesi her açılışta aynı düzende. */
  const sirali = useMemo(
    () =>
      [...documents].sort((a, b) => {
        const fa = DOCUMENT_KINDS.indexOf(a.kind as never);
        const fb = DOCUMENT_KINDS.indexOf(b.kind as never);
        if (fa !== fb) return (fa < 0 ? 99 : fa) - (fb < 0 ? 99 : fb);
        return a.createdAt < b.createdAt ? 1 : -1;
      }),
    [documents]
  );

  async function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    // Canlı `FileList` yerinde boşalır: ÖNCE kopyala, SONRA girdiyi temizle.
    const dosyalar = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (dosyalar.length === 0) return;

    const dosya = dosyalar[0];
    if (!belgeTuruUygunMu(dosya.name, dosya.type)) {
      toast.error("Yalnız PDF ve görüntü (JPG · PNG · WEBP) yüklenebilir.");
      return;
    }
    if (dosya.size > MAX_DOCUMENT_BYTES) {
      toast.error(`Dosya 25 MB sınırını aşıyor (${fmtBytes(dosya.size)}).`);
      return;
    }

    setYukleniyor(true);
    try {
      const supabase = createClient();
      // Kimlik İSTEMCİDE üretilir ki depo yolu satır yazılmadan bilinsin.
      const documentId = crypto.randomUUID();
      const mime = belgeMimeTuru(dosya.name, dosya.type);
      const hedef = personnelStoragePath(employeeId, documentId, dosya.name);

      // `slice` KOPYA ÇIKARMAZ, yalnız TİPİ olan yeni bir görünüm verir:
      // storage-js gövde bir `File` olduğunda FormData dalına düşer ve
      // `contentType` seçeneğini YOK SAYAR — nesne `application/octet-stream`
      // yazılır ve tarayıcıda açılmazdı.
      const govde = dosya.slice(0, dosya.size, mime);
      const { error: yuklemeHatasi } = await supabase.storage
        .from(PERSONNEL_BUCKET)
        .upload(hedef, govde, { contentType: mime, upsert: false });
      if (yuklemeHatasi) {
        toast.error(`Yükleme başarısız: ${yuklemeHatasi.message}`);
        return;
      }

      const sonuc = await registerDocument({
        employeeId,
        documentId,
        kind: form.kind as (typeof DOCUMENT_KINDS)[number],
        title: form.title,
        fileName: dosya.name,
        mimeType: mime,
        sizeBytes: dosya.size,
        issuedOn: form.issuedOn,
        expiresOn: form.expiresOn,
        notes: form.notes,
      });
      if (sonuc.error) {
        // Sunucu doğrulaması düştüyse nesneyi ZATEN o temizledi; burada
        // ikinci bir silme denemesi yapmıyoruz (kayıt yoksa yol da yok).
        toast.error(sonuc.error);
        return;
      }
      toast.success("Belge yüklendi.");
      setForm((f) => ({ ...BOS_FORM, kind: f.kind }));
      router.refresh();
    } catch (hata) {
      toast.error(hata instanceof Error ? hata.message : "Yükleme sırasında bir hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  }

  function ac(d: DocumentRow) {
    setAciliyor(d.id);
    startTransition(async () => {
      const sonuc = await signDocumentUrl(d.id);
      setAciliyor(null);
      if (sonuc.error || !sonuc.url) {
        toast.error(sonuc.error ?? "Bağlantı üretilemedi.");
        return;
      }
      window.open(sonuc.url, "_blank", "noopener,noreferrer");
    });
  }

  function sil(d: DocumentRow) {
    startTransition(async () => {
      const sonuc = await deleteDocument(d.id, employeeId);
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Belge silindi.");
      setSilinecek(null);
      router.refresh();
    });
  }

  const sureliTur = expiresByDefault(form.kind);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="size-4 text-muted-foreground" />
          Özlük Dosyaları
          {documents.length > 0 && (
            <span className="font-mono text-xs font-normal text-muted-foreground">
              {documents.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-4">
        {/* HATIRLATMA ŞERİDİ — suçlamayan dil, engelleyici değil. */}
        {(uyarilar.gecti.length > 0 || uyarilar.yaklasiyor.length > 0) && (
          <div className="border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
            <div className="font-medium text-amber-700 dark:text-amber-400">
              Süresi dolan belgeler
            </div>
            <p className="mt-0.5 text-foreground/80">
              {uyarilar.gecti.length > 0 && (
                <>
                  <strong>{uyarilar.gecti.length}</strong> belgenin süresi geçmiş
                  {uyarilar.yaklasiyor.length > 0 && ", "}
                </>
              )}
              {uyarilar.yaklasiyor.length > 0 && (
                <>
                  <strong>{uyarilar.yaklasiyor.length}</strong> belgenin süresi 30 gün içinde
                  doluyor
                </>
              )}
              . Yenilenen belgeyi yükleyip eskisini bırakabilirsiniz — geçmiş bir kayıttır.
            </p>
          </div>
        )}

        {/* YÜKLEME FORMU */}
        {canWrite && (
          <div className="grid gap-3 border bg-muted/30 p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="grid gap-1.5">
                <Label htmlFor="belge-tur">Belge Türü</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}
                >
                  <SelectTrigger id="belge-tur" className="oc-tap">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {DOCUMENT_KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="belge-baslik">Başlık</Label>
                <Input
                  id="belge-baslik"
                  className="text-base pointer-fine:text-sm"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="belge-tarih">Belge Tarihi</Label>
                <Input
                  id="belge-tarih"
                  type="date"
                  className="text-base pointer-fine:text-sm"
                  value={form.issuedOn}
                  onChange={(e) => setForm((f) => ({ ...f, issuedOn: e.target.value }))}
                />
              </div>

              {/* GEÇERLİLİK yalnız SÜRELİ türlerde öne çıkar; diğerlerinde de
                  girilebilir ama vurgulanmaz — kimlik fotokopisinin süresi
                  yoktur ve o alanı her belgede sormak gürültüdür. */}
              <div className="grid gap-1.5">
                <Label htmlFor="belge-son" className={cn(sureliTur && "text-foreground")}>
                  Geçerlilik Bitişi
                  {sureliTur && <span className="ml-1 text-primary">•</span>}
                </Label>
                <Input
                  id="belge-son"
                  type="date"
                  className={cn(
                    "text-base pointer-fine:text-sm",
                    sureliTur && "border-primary/40"
                  )}
                  value={form.expiresOn}
                  onChange={(e) => setForm((f) => ({ ...f, expiresOn: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Ham dosya düğmesi tarayıcıdan tarayıcıya değişir ve Türkçe
                  metni yazdırılamaz; `label` hem 44px dokunma hedefi verir hem
                  metni uygulamanın diline getirir. */}
              <input
                ref={girdiRef}
                type="file"
                accept={DOCUMENT_ACCEPT}
                className="sr-only"
                id="belge-dosya"
                onChange={dosyaSecildi}
                disabled={yukleniyor}
              />
              <Label
                htmlFor="belge-dosya"
                className={cn(
                  "oc-tap inline-flex cursor-pointer items-center gap-2 border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
                  yukleniyor && "pointer-events-none opacity-60"
                )}
              >
                {yukleniyor ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {yukleniyor ? "Yükleniyor…" : "Dosya Seç ve Yükle"}
              </Label>
              <span className="text-xs text-muted-foreground">
                PDF ya da görüntü · en çok 25 MB · sayfa sayısı yüklendikten sonra ÖLÇÜLÜR
              </span>
            </div>
          </div>
        )}

        {/* LİSTE */}
        {sirali.length === 0 ? (
          <p className="border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Bu personelin henüz yüklenmiş bir belgesi yok.
          </p>
        ) : (
          <div className="oc-scrollx overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Belge</TableHead>
                  <TableHead className={AT_MD}>Tür</TableHead>
                  <TableHead className={AT_LG}>Tarih</TableHead>
                  <TableHead>Geçerlilik</TableHead>
                  <TableHead className={cn(AT_LG, "text-right")}>Boyut</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sirali.map((d) => {
                  const durum = expiryState(d.expiresOn, bugun);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="max-w-[18rem]">
                        <div className="flex items-start gap-2">
                          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="truncate font-medium" title={d.title}>
                              {d.title || d.fileName}
                            </div>
                            <div className="truncate text-xs text-muted-foreground" title={d.fileName}>
                              {d.fileName}
                              {d.pageCount > 0 && ` · ${d.pageCount} sayfa`}
                            </div>
                            {/* Dar ekranda gizlenen tür bilgisini burada göster. */}
                            <div className="mt-1 md:hidden">
                              <span
                                className="oc-tag px-1.5 py-0.5 text-[11px]"
                                style={tagStyle(documentKindHue(d.kind))}
                              >
                                {documentKindLabel(d.kind)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={AT_MD}>
                        <span
                          className="oc-tag px-1.5 py-0.5 text-[11px]"
                          style={tagStyle(documentKindHue(d.kind))}
                        >
                          {documentKindLabel(d.kind)}
                        </span>
                      </TableCell>
                      <TableCell className={cn(AT_LG, "text-muted-foreground")}>
                        {fmtDate(d.issuedOn)}
                      </TableCell>
                      <TableCell>
                        {durum === "yok" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn("font-normal", DURUM_SINIF[durum])}
                            title={`Geçerlilik: ${fmtDate(d.expiresOn)}`}
                          >
                            {EXPIRY_LABELS[durum]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={cn(AT_LG, "text-right text-muted-foreground")}>
                        {fmtBytes(d.sizeBytes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="oc-tap-square"
                            title="Belgeyi aç"
                            aria-label="Belgeyi aç"
                            disabled={pending && aciliyor === d.id}
                            onClick={() => ac(d)}
                          >
                            {aciliyor === d.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <ExternalLink className="size-4" />
                            )}
                          </Button>
                          {canWrite && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="oc-tap-square"
                                title="Künyeyi düzenle"
                                aria-label="Künyeyi düzenle"
                                onClick={() => setDuzenlenen(d)}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="oc-tap-square text-destructive"
                                title="Belgeyi sil"
                                aria-label="Belgeyi sil"
                                onClick={() => setSilinecek(d)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Pencereler KOŞULLU MONTE edilir: her açılış taze bir bileşendir. */}
      {duzenlenen && (
        <MetaDialog
          doc={duzenlenen}
          employeeId={employeeId}
          onClose={() => setDuzenlenen(null)}
        />
      )}

      {silinecek && (
        <Dialog open onOpenChange={(o) => !o && setSilinecek(null)}>
          <DialogContent className="sm:max-w-[min(28rem,calc(100%-2rem))]">
            <DialogHeader>
              <DialogTitle>Belge silinsin mi?</DialogTitle>
              <DialogDescription>
                <strong>{silinecek.title || silinecek.fileName}</strong> hem kayıttan hem
                depodan kaldırılacak. Bu işlem geri alınamaz.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="oc-tap" onClick={() => setSilinecek(null)}>
                Vazgeç
              </Button>
              <Button
                variant="destructive"
                className="oc-tap"
                disabled={pending}
                onClick={() => sil(silinecek)}
              >
                {pending ? "Siliniyor…" : "Sil"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

/** Belgenin künyesini düzeltir — BAYTLARA DOKUNMAZ. */
function MetaDialog({
  doc,
  employeeId,
  onClose,
}: {
  doc: DocumentRow;
  employeeId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState(doc.kind);
  const [title, setTitle] = useState(doc.title);
  const [issuedOn, setIssuedOn] = useState(doc.issuedOn ?? "");
  const [expiresOn, setExpiresOn] = useState(doc.expiresOn ?? "");
  const [notes, setNotes] = useState(doc.notes);

  function kaydet() {
    startTransition(async () => {
      const sonuc = await updateDocumentMeta(doc.id, employeeId, {
        kind,
        title,
        issuedOn,
        expiresOn,
        notes,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Belge künyesi güncellendi.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(34rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Belge Künyesi</DialogTitle>
          <DialogDescription>
            {doc.fileName} — dosyanın kendisi değişmez, yalnız künyesi düzeltilir.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="meta-tur">Belge Türü</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="meta-tur" className="oc-tap">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {DOCUMENT_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="meta-baslik">Başlık</Label>
            <Input
              id="meta-baslik"
              className="text-base pointer-fine:text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="meta-tarih">Belge Tarihi</Label>
              <Input
                id="meta-tarih"
                type="date"
                className="text-base pointer-fine:text-sm"
                value={issuedOn}
                onChange={(e) => setIssuedOn(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="meta-son">Geçerlilik Bitişi</Label>
              <Input
                id="meta-son"
                type="date"
                className="text-base pointer-fine:text-sm"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="meta-not">Not</Label>
            <Textarea
              id="meta-not"
              rows={2}
              className="text-base pointer-fine:text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="oc-tap" onClick={onClose}>
            Vazgeç
          </Button>
          <Button className="oc-tap" disabled={pending} onClick={kaydet}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
