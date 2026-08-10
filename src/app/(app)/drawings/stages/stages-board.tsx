"use client";

// Aşama defteri — liste, ekleme/düzenleme penceresi, aktiflik ve silme.
//
// Emsal `admin/customers/` ekranıdır (kısaltma + renk düzenleme kalıbı, ton
// ızgarası, satır → pencere akışı). YETKİ KAPISI ORADAN KOPYALANMADI: orası
// `requireAdmin`la çalışır, burası `canEditDrawings`le (gerekçe `page.tsx`te).
//
// ————————————————————————————————————— EKRANIN ÜÇ SÖZÜ
//
// 1. ANAHTAR GÖRÜNÜR AMA DEĞİŞMEZ. Kullanıcı `slug`u ekler ve düzenlerken
//    GÖRÜR; gizlenseydi bir gün "adı düzelttim, sayılar neden bozuldu" sorusu
//    cevapsız kalırdı. Var olan bir satırda alan salt-okunurdur ve neden
//    olduğu yazar.
// 2. SİLME İSTİSNADIR, PASİFE ALMA KURALDIR. Silme düğmesi yalnız kullanımı
//    SIFIR olan satırda çizilir; sayıyı sunucu yeniden sayar (istemcinin
//    gördüğü sayı açık kalmış bir sekmede eskimiş olabilir).
// 3. PASİFE ALMANIN BEDELİ SÖYLENİR. Pasif aşamanın çipi üretim tahtasında
//    çizilmez; kayıtları silinmez ama GÖRÜNMEZ olur. Kullanıcı bunu düğmeye
//    basmadan önce, kaç kaydı etkilediğiyle birlikte okur.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { normalizeHue, nextDistinctHue, tagStyle } from "@/lib/tags";
import { formatNum } from "@/lib/drawings/labels";
import { createStage, deleteStage, moveStage, setStageActive, updateStage } from "./actions";
import { nameKey, slugFromName, SIRA_ADIMI } from "./schema";

export interface StageAdminRow {
  id: string;
  /** KARARLI ANAHTAR — `drawing_part_progress.stage` metni buna eşittir. */
  slug: string;
  name: string;
  sort: number;
  colorHue: number;
  active: boolean;
  note: string;
  /** Bu aşamaya bağlı üretim kaydı sayısı — sunucuda sayılmıştır. */
  usage: number;
}

/**
 * Ton ızgarası — 24 eşit aralıklı açı.
 *
 * Serbest bir renk kutusu (`input[type=color]`) YOKTUR ve bu bilinçlidir: veri
 * OKLCH TON AÇISI saklar, doygunluk ve parlaklık `globals.css`teki `.oc-tag`
 * kuralında ve tema başına verilir. Kullanıcı tonu seçer, açık/koyu temada
 * okunurluğu bozamaz (aynı ızgara `admin/customers`ta da var).
 *
 * Ham `<button>` olduğu için dokunma payı elle verilir; 28px'lik kutular
 * parmakla ayırt edilemiyordu.
 */
function TonIzgarasi({ value, onChange }: { value: number; onChange: (hue: number) => void }) {
  const tonlar = Array.from({ length: 24 }, (_, i) => i * 15);
  const secili = normalizeHue(value);
  return (
    <div className="flex flex-wrap gap-1.5">
      {tonlar.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => onChange(h)}
          aria-label={`Ton ${h}`}
          aria-pressed={secili === h}
          title={`Ton ${h}°`}
          style={tagStyle(h)}
          className={
            "oc-tag size-9 justify-center pointer-coarse:size-10 " +
            (secili === h ? "ring-2 ring-foreground/60" : "hover:opacity-80")
          }
        >
          {secili === h ? "✓" : ""}
        </button>
      ))}
    </div>
  );
}

/** Aşama çipi — üretim tahtasındaki çiple aynı dil (`.oc-tag` + ton açısı). */
function AsamaCipi({ name, hue, className }: { name: string; hue: number; className?: string }) {
  return (
    <span
      style={tagStyle(hue)}
      className={`oc-tag max-w-full px-1.5 py-0.5 text-xs font-medium ${className ?? ""}`}
      title={name}
    >
      <span className="truncate">{name}</span>
    </span>
  );
}

/* ═════════════════════════════════════════════ ekleme / düzenleme ═══ */

/**
 * Aşama penceresi — ekleme ve düzenleme AYNI formdur.
 *
 * Tek fark anahtardır: eklemede addan CANLI türetilir ve önizlenir,
 * düzenlemede salt-okunur durur. İki ayrı pencere yazmak, aynı doğrulamayı iki
 * yerde tutmak demekti.
 */
function AsamaPenceresi({
  row,
  rows,
  open,
  onOpenChange,
}: {
  /** `null` → yeni aşama. */
  row: StageAdminRow | null;
  rows: readonly StageAdminRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Yeni aşamanın tonu var olanlardan EN UZAK boşluktur (`nextDistinctHue`):
  // komşu iki çipin ayırt edilebilirliği veriyle değil KURALLA garanti edilir.
  // Sunucu da aynı hesabı yapıyor; buradaki kopya kullanıcının rengi KAYDETMEDEN
  // görebilmesi içindir (renk seçilebilir bir alan olduğu için önizleme şart).
  const [form, setForm] = useState(() => ({
    name: row?.name ?? "",
    sort: row?.sort ?? enBuyukSira(rows) + SIRA_ADIMI,
    colorHue: row?.colorHue ?? nextDistinctHue(rows.map((r) => r.colorHue)),
    note: row?.note ?? "",
    active: row?.active ?? true,
  }));

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const yeni = row === null;
  const anahtar = row ? row.slug : slugFromName(form.name);
  // Alan kimlikleri satıra özeldir: `admin/customers`taki kalıp. Sabit bir `id`
  // iki pencere aynı anda monte edilirse `label`ı yanlış alana bağlardı.
  const alanOn = row ? row.id : "yeni";

  // İSTEMCİ DOĞRULAMASI BİR NEZAKETTİR, KAPI DEĞİL. Aynı üç soruyu sunucu da
  // sorar; buradaki kopya kullanıcının Kaydet'e basıp hata almasını önler.
  const anahtarCakismasi = useMemo(
    () => (yeni && anahtar ? rows.find((r) => r.slug === anahtar) : undefined),
    [yeni, anahtar, rows]
  );
  const adCakismasi = useMemo(() => {
    const k = nameKey(form.name);
    if (!k) return undefined;
    return rows.find((r) => r.id !== row?.id && nameKey(r.name) === k);
  }, [form.name, rows, row?.id]);

  const anahtarYok = yeni && form.name.trim() !== "" && anahtar === "";
  const engel = Boolean(anahtarYok || anahtarCakismasi || adCakismasi);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const sonuc = row
        ? await updateStage({
            id: row.id,
            name: form.name,
            sort: form.sort,
            colorHue: form.colorHue,
            note: form.note,
            active: form.active,
          })
        : await createStage({
            name: form.name,
            sort: form.sort,
            colorHue: form.colorHue,
            note: form.note,
            active: form.active,
          });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(yeni ? "Aşama defterine eklendi." : "Aşama güncellendi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Genişlik `min(...)` ile: düz `sm:max-w-xl` dar pencerede taban
          `max-w-[calc(100%-1.5rem)]` kelepçesini deler (AGENTS dokunmatik
          md. 5-6). Dikey kaydırma ve yükseklik sınırı tabandan gelir. */}
      <DialogContent className="sm:max-w-[min(38rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>{yeni ? "Yeni Aşama" : "Aşamayı Düzenle"}</DialogTitle>
          <DialogDescription>
            Aşamalar atölyenin ortak sözlüğüdür: üretim tahtasındaki çipler ve
            “kaç parça kesildi” sayıları buradan okunur.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <div className="grid gap-1.5">
              <Label htmlFor={`ad-${alanOn}`}>Aşama Adı</Label>
              <Input
                id={`ad-${alanOn}`}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Sevk edildi"
                required
                maxLength={60}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`sira-${alanOn}`}>Sıra</Label>
              <Input
                id={`sira-${alanOn}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={9999}
                value={form.sort}
                onChange={(e) => set("sort", Number(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* ANAHTAR — kullanıcıdan gizlenmez. */}
          <div className="grid gap-1 border bg-muted/40 px-3 py-2">
            <span className="oc-kicker text-muted-foreground">Anahtar</span>
            <code className="font-mono text-xs break-all text-foreground">{anahtar || "—"}</code>
            <p className="text-[11px] text-muted-foreground">
              {yeni
                ? "Addan türetilir ve bir daha DEĞİŞMEZ: atölyenin üretim kayıtları bu anahtara bağlanır."
                : "Var olan bir aşamanın anahtarı değişmez — bu aşamaya işaretlenmiş bütün üretim kayıtları ona bağlı. Adı serbestçe düzeltebilirsiniz."}
            </p>
          </div>

          {anahtarYok && (
            <p className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Bu addan bir anahtar türetilemiyor; adda en az bir harf ya da rakam
              olmalı.
            </p>
          )}
          {anahtarCakismasi && (
            <p className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              “{anahtarCakismasi.name}” ile aynı anahtara ({anahtarCakismasi.slug})
              düşüyor; iki aşama birbirinden ayırt edilemezdi.
            </p>
          )}
          {adCakismasi && (
            <p className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              “{adCakismasi.name}” defterde zaten var.
            </p>
          )}

          <div className="grid gap-1.5">
            <Label>Renk</Label>
            <div className="flex flex-wrap items-center gap-3">
              <AsamaCipi
                name={form.name.trim() || "Aşama"}
                hue={form.colorHue}
                className="px-2 py-1 text-sm"
              />
              <TonIzgarasi value={form.colorHue} onChange={(h) => set("colorHue", h)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`not-${alanOn}`}>Not</Label>
            <Textarea
              id={`not-${alanOn}`}
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Bu aşama tam olarak neyi anlatıyor? (atölyenin kendi tanımı)"
            />
          </div>

          {/* Ham `<input type=checkbox>` 13px'lik bir hedeftir; 44px'lik bir
              `label` içine sarmak dokunma hedefi kuralının en ucuz karşılığıdır
              (`components/ui`da Checkbox yok ve bu ekran onu eklemez). */}
          <label className="flex min-h-10 items-center gap-2 text-sm pointer-coarse:min-h-11">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="size-4 shrink-0 accent-[var(--primary)]"
            />
            <span>
              Aktif
              <span className="ml-1 text-[11px] text-muted-foreground">
                — pasif aşamanın çipi üretim tahtasında çizilmez, kayıtları silinmez
              </span>
            </span>
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={pending || engel}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════ pasife alma ═══ */

/**
 * Pasife alma onayı.
 *
 * Yalnız KAPATIRKEN sorulur; açmak geri alınabilir ve zararsızdır. Sorulmasının
 * sebebi kayıp değil GÖRÜNMEZLİKTİR: üretim tahtası `active = true` süzer, yani
 * o aşamaya işaretlenmiş kayıtlar yerinde durur ama çip ekrandan kalkar. Sayı
 * bu yüzden metnin içindedir — "143 kayıt" ile "0 kayıt" farklı kararlardır.
 */
function PasifeAlmaPenceresi({
  row,
  open,
  onOpenChange,
}: {
  row: StageAdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function uygula() {
    startTransition(async () => {
      const sonuc = await setStageActive({ id: row.id, active: false });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(`“${row.name}” pasife alındı.`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(28rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Aşamayı Pasife Al</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{row.name}</span> üretim tahtasında
            artık çip olarak görünmeyecek.{" "}
            {row.usage > 0 ? (
              <>
                Bu aşamaya bağlı {formatNum(row.usage)} üretim kaydı SİLİNMEZ —
                yerinde durur, yalnız tahtada çizilmez.
              </>
            ) : (
              <>Bu aşamaya bağlı hiçbir üretim kaydı yok.</>
            )}{" "}
            İstediğiniz zaman geri açabilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={uygula}>
            {pending ? "Uygulanıyor…" : "Pasife Al"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═════════════════════════════════════════════════════════ silme ═══ */

/**
 * Silme onayı — YALNIZ HİÇ KULLANILMAMIŞ AŞAMA İÇİN çizilir.
 *
 * Paket silmedeki gibi ad yazdırılmaz: burada yok edilen şey yedi alanlık bir
 * sözlük satırıdır ve hiçbir üretim kaydına dokunmaz. Onayın ağırlığı işin
 * ağırlığına göre verilir; her yerde ad yazdırmak onayı bir refleks yapardı.
 */
function SilmePenceresi({
  row,
  open,
  onOpenChange,
}: {
  row: StageAdminRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function sil() {
    startTransition(async () => {
      const sonuc = await deleteStage({ id: row.id });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(`“${row.name}” defterden silindi.`);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(28rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Aşamayı Sil</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{row.name}</span> defterden tamamen
            silinecek. Bu aşamaya bağlı hiçbir üretim kaydı yok, yani atölyenin
            hiçbir kaydı adsız kalmaz. Kullanılmaya başlanmış bir aşama
            silinemez; o zaman doğru yol pasife almaktır.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={sil}>
            {pending ? "Siliniyor…" : "Kalıcı Olarak Sil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════ liste ═══ */

function enBuyukSira(rows: readonly StageAdminRow[]): number {
  return rows.reduce((en, r) => Math.max(en, r.sort), 0);
}

export function StagesBoard({
  rows,
  canWrite,
}: {
  rows: StageAdminRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [calisiyor, startTransition] = useTransition();
  const [duzenlenen, setDuzenlenen] = useState<StageAdminRow | null>(null);
  const [yeniAcik, setYeniAcik] = useState(false);
  const [pasifeAlinan, setPasifeAlinan] = useState<StageAdminRow | null>(null);
  const [silinen, setSilinen] = useState<StageAdminRow | null>(null);

  const aktifSayisi = rows.filter((r) => r.active).length;

  function tasi(row: StageAdminRow, direction: "yukari" | "asagi") {
    startTransition(async () => {
      const sonuc = await moveStage({ id: row.id, direction });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      router.refresh();
    });
  }

  function aktifEt(row: StageAdminRow) {
    startTransition(async () => {
      const sonuc = await setStageActive({ id: row.id, active: true });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(`“${row.name}” yeniden aktif.`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Üretim Aşamaları</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Atölyenin ortak sözlüğü. Sıra üretim tahtasındaki çip dizilişini,
            renk çipin tonunu belirler. Kullanımdan kalkan aşama silinmez,
            pasife alınır — geçmiş kayıtların aşaması adsız kalmamalı.
          </p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setYeniAcik(true)}>
            <Plus />
            Yeni Aşama
          </Button>
        )}
      </div>

      {/* Bilgi rozetleri EYLEM DEĞİLDİR, sayfa gövdesine yazılır (AGENTS
          dokunmatik md. 12: eylem yuvası `empty:hidden` taşır ve gizli bir
          çocuk bile telefonda boş bir bant bırakır). */}
      {!canWrite && (
        <p className="border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Bu defteri yalnız Yönetici, Mühendis ve Teknik Ressam düzenleyebilir.
          Listeyi herkes görebilir: çipin ne anlama geldiğini bilmek atölyenin
          ortak hakkıdır.
        </p>
      )}

      <div className="rounded-lg border">
        <Table containerClassName="[--oc-scroll-bg:var(--background)]">
          {/*
            SÜTUN ÖNCELİKLENDİRME (AGENTS dokunmatik md. 7). Altı sütunluk satır
            telefonda kabın iki katına çıkar. Anahtar, sıra ve kullanım `md`
            altında gizlenir; üçü de birincil hücrenin içinde ikinci satır
            olarak durur. İkinci bir kart markup'ı YAZILMAZ — sıralama ve
            eylem mantığını ikiye böler ve zamanla ayrışır.
          */}
          <TableHeader>
            <TableRow>
              <TableHead>Aşama</TableHead>
              <TableHead className="hidden md:table-cell md:w-[10rem]">Anahtar</TableHead>
              <TableHead className="hidden text-right lg:table-cell lg:w-[5rem]">Sıra</TableHead>
              <TableHead
                className="hidden text-right md:table-cell md:w-[7rem]"
                title="Bu aşamaya işaretlenmiş üretim kaydı sayısı"
              >
                Kayıt
              </TableHead>
              {/* Sabit genişlikler yalnız sütunların hepsi görünürken
                  devrededir: dar ekranda otomatik yerleşimle çekişip birincil
                  hücreyi ezerler (`admin/customers` dersi). */}
              <TableHead className="md:w-[6rem]">Durum</TableHead>
              <TableHead className="md:w-[8rem]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.id} className={row.active ? undefined : "opacity-60"}>
                <TableCell className="whitespace-normal">
                  <AsamaCipi name={row.name} hue={row.colorHue} />
                  {row.note && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{row.note}</div>
                  )}
                  {/* Dar ekranda gizlenen üç sütunun özeti — sütun kaybolunca
                      bilgi de kaybolmasın. */}
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground lg:hidden">
                    <span className="md:hidden">
                      {row.slug} · {formatNum(row.usage)} kayıt ·{" "}
                    </span>
                    sıra {row.sort}
                  </div>
                </TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                  {row.slug}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-sm tabular-nums text-muted-foreground lg:table-cell">
                  {row.sort}
                </TableCell>
                <TableCell className="hidden text-right font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
                  {formatNum(row.usage)}
                </TableCell>
                <TableCell>
                  {canWrite ? (
                    <button
                      type="button"
                      disabled={calisiyor}
                      onClick={() => (row.active ? setPasifeAlinan(row) : aktifEt(row))}
                      title={
                        row.active
                          ? "Pasife al — çip üretim tahtasından kalkar"
                          : "Yeniden aktif et"
                      }
                      className={
                        "oc-tap inline-flex min-h-8 items-center border px-2 text-[11px] whitespace-nowrap transition-colors disabled:opacity-50 " +
                        (row.active
                          ? "border-border text-foreground hover:bg-muted"
                          : "border-dashed border-border text-muted-foreground hover:text-foreground")
                      }
                    >
                      {row.active ? "Aktif" : "Pasif"}
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {row.active ? "Aktif" : "Pasif"}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {canWrite && (
                    // Yıkıcı ve yıkıcı olmayan eylem yan yana: `gap-2` (8px)
                    // parmakla yanlış düğmeye basmayı zorlaştırır. Boy ortak
                    // katmanın `icon-sm` varyantından gelir.
                    <div className="flex justify-end gap-2">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={calisiyor || i === 0}
                        onClick={() => tasi(row, "yukari")}
                        aria-label={`${row.name} bir yukarı`}
                        title="Bir yukarı"
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={calisiyor || i === rows.length - 1}
                        onClick={() => tasi(row, "asagi")}
                        aria-label={`${row.name} bir aşağı`}
                        title="Bir aşağı"
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setDuzenlenen(row)}
                        aria-label={`${row.name} düzenle`}
                        title="Düzenle"
                      >
                        <Pencil />
                      </Button>
                      {/* SİLME YALNIZ HİÇ KULLANILMAMIŞ AŞAMADA ÇİZİLİR.
                          Kullanılmış aşamanın yolu pasife almaktır; düğmeyi
                          gösterip sonra reddetmek, kullanıcıya yapılamayacak
                          bir şeyi öğretmek olurdu. Sunucu yine de yeniden
                          sayar — bu görüntü eskimiş olabilir. */}
                      {row.usage === 0 && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setSilinen(row)}
                          aria-label={`${row.name} sil`}
                          title="Sil (bu aşamaya bağlı kayıt yok)"
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Defterde aşama yok. Üretim tahtası yedek sözlükle çalışır.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {rows.length > 0 && (
        <p className="font-mono text-[11px] text-muted-foreground">
          {formatNum(rows.length)} aşama · {formatNum(aktifSayisi)} aktif ·{" "}
          {formatNum(rows.length - aktifSayisi)} pasif
        </p>
      )}

      {/* Pencereler yalnız açıkken monte edilir: form durumu her açılışta
          satırın güncel değerinden başlasın (aksi hâlde bir kez okunan
          `useState` başlangıcı eski satırda donardı). */}
      {yeniAcik && (
        <AsamaPenceresi row={null} rows={rows} open onOpenChange={(o) => !o && setYeniAcik(false)} />
      )}
      {duzenlenen && (
        <AsamaPenceresi
          row={duzenlenen}
          rows={rows}
          open
          onOpenChange={(o) => !o && setDuzenlenen(null)}
        />
      )}
      {pasifeAlinan && (
        <PasifeAlmaPenceresi
          row={pasifeAlinan}
          open
          onOpenChange={(o) => !o && setPasifeAlinan(null)}
        />
      )}
      {silinen && (
        <SilmePenceresi row={silinen} open onOpenChange={(o) => !o && setSilinen(null)} />
      )}
    </div>
  );
}
