"use client";

// TEKNİK RESİM TAKİBİ — ana grup numaralandırma ve ilerleme defteri.
//
// Ressam çizime oturmadan önce mühendise "bu grup kaç olacak?" diye sorar ve
// cevabı bugüne kadar telefonla ya da hafızadan veriliyordu. Bu kart o soruyu
// projenin kendi sayfasına yazar; aynı liste ekipman listesindeki Teknik Ressam
// Özeti'nin, onun Excel'inin ve PDF'inin sonuna da basılır (tek kaynak:
// `project_drawing_plan`).
//
// EKRAN OTOMATİK DOLDURMAZ. Numaralandırma projenin BAŞINDA verilen bir
// karardır; hesap raporundaki bölümlerden türetilseydi mühendisin henüz
// vermediği bir kararı uygulama vermiş olurdu. Öneri listesi vardır, dayatma
// yoktur: grup adı alanı serbest metin kutusudur (`EditableCombobox`), liste
// yalnız yazmayı hızlandırır.
//
// YÜZDE ELLE GİRİLMEZ. Tamamlanma oranı satırların durumlarından TÜRETİLİR
// (`drawingPlanProgress`): elle girilen bir yüzde ilk haftadan sonra kimsenin
// güncellemediği bir sayı olur, buradaki ise bir grup eklendiği anda
// kendiliğinden düşer.
//
// TEKNİK RESİMLER MODÜLÜNE BAĞLI DEĞİLDİR (kullanıcı kararı). Aynı sekmedeki
// "Teknik Resim Paketleri" kartı ressamın TESLİM ETTİĞİNİ gösterir; bu kart
// mühendisin PLANLADIĞINI. İkisini bağlamak, henüz var olmayan bir teslimi
// bekleyen bir soruya cevap vermek olurdu.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ListOrdered, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboOption } from "@/components/combobox";
import { EditableCombobox } from "@/components/editable-combobox";
import {
  DRAWING_BANDS,
  DRAWING_GROUP_PRESETS,
  DRAWING_PLAN_STATUSES,
  bandOfCode,
  codesOfBand,
  drawingPlanProgress,
  fullDrawingNo,
  groupDrawingPlan,
  nextFreeCode,
  type DrawingBand,
  type DrawingPlanRow,
  type DrawingPlanStatus,
} from "@/lib/drawing-plan";
import { saveDrawingPlan } from "./drawing-plan-actions";

/**
 * Ekrandaki satır. `key` YALNIZ React içindir ve veritabanına gitmez; `dbId`
 * ise var olan kaydın kimliğidir ve yeni satırda boştur. İkisini tek alanda
 * tutmak, kaydedilmemiş bir satırın kimliğini varmış gibi göstermek olurdu.
 */
interface PlanRowState {
  key: string;
  dbId?: string;
  code: string;
  name: string;
  status: DrawingPlanStatus;
  note: string;
}

function yeniAnahtar(): string {
  return `yeni-${crypto.randomUUID()}`;
}

function toState(rows: readonly DrawingPlanRow[]): PlanRowState[] {
  return rows.map((r) => ({
    key: r.id,
    dbId: r.id,
    code: r.code,
    name: r.name,
    status: r.status,
    note: r.note,
  }));
}

/** Kaydedilmemiş değişiklik var mı — "Kaydet" düğmesi buna göre canlanır. */
function imza(rows: readonly PlanRowState[]): string {
  return JSON.stringify(
    rows.map((r) => [r.dbId ?? "", r.code, r.name, r.status, r.note])
  );
}

/**
 * Bir bandın ad önerileri: ÖNCE kendi bandınınkiler, sonra diğerleri.
 *
 * Liste bant başına daraltılmaz — köprü grubuna araba adı yazmak yasak
 * değildir, yalnız olası değildir. Kendi bandını başa almak, aranan adın ilk
 * üç satırda çıkmasını sağlar.
 */
function adOnerileri(band: DrawingBand | null): string[] {
  const oncelikli = band ? DRAWING_GROUP_PRESETS[band] : [];
  const gorulen = new Set(oncelikli);
  const kalan = DRAWING_BANDS.flatMap((b) => DRAWING_GROUP_PRESETS[b.band]).filter(
    (ad) => !gorulen.has(ad)
  );
  return [...oncelikli, ...kalan];
}

/** İlerleme çubuğu — başlıktaki tek satırlık özet. */
function IlerlemeCubugu({ percent, done, total }: { percent: number; done: number; total: number }) {
  return (
    <div className="flex min-w-[10rem] flex-1 items-center gap-2 sm:max-w-[18rem]">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Teknik resim tamamlanma oranı"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">%{percent}</span>
      <span className="shrink-0 text-[11px] whitespace-nowrap text-muted-foreground">
        {done}/{total} Çizildi
      </span>
    </div>
  );
}

export function DrawingPlanCard({
  projectId,
  itemNo,
  initialRows,
  canEdit,
}: {
  projectId: string;
  /** Resim numarasının kökü ("0055-00"); boşsa yalnız grup kodu gösterilir. */
  itemNo: string;
  initialRows: DrawingPlanRow[];
  canEdit: boolean;
}) {
  const [rows, setRows] = useState<PlanRowState[]>(() => toState(initialRows));
  const [kayitli, setKayitli] = useState<string>(() => imza(toState(initialRows)));
  const [pending, startTransition] = useTransition();

  const kirli = imza(rows) !== kayitli;

  // Kod HAVUZU proje geneldir: aynı numara iki ana gruba verilemez (veritabanı
  // kısıtı da bunu söyler). Seçici bu yüzden BAŞKA satırların kodlarını hiç
  // göstermez — kullanıcıya önce yasak bir seçenek sunup sonra hata mesajı
  // basmaktansa, seçeneği hiç sunmamak doğrudur.
  const kullanilan = useMemo(
    () => new Set(rows.map((r) => r.code)),
    [rows]
  );

  const gruplar = useMemo(
    () =>
      groupDrawingPlan(
        rows.map((r) => ({
          id: r.key,
          code: r.code,
          name: r.name,
          status: r.status,
          note: r.note,
        }))
      ),
    [rows]
  );

  const ilerleme = useMemo(() => drawingPlanProgress(rows), [rows]);

  function setRow(key: string, patch: Partial<PlanRowState>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow(band: DrawingBand) {
    const code = nextFreeCode(band, kullanilan);
    if (!code) {
      toast.error("Bu bandın bütün numaraları kullanılmış.");
      return;
    }
    setRows((prev) => [
      ...prev,
      { key: yeniAnahtar(), code, name: "", status: "bekliyor", note: "" },
    ]);
  }

  function kaydet() {
    const eksik = rows.filter((r) => !r.name.trim());
    if (eksik.length > 0) {
      toast.error("Adı girilmemiş grup var — her numaraya bir ad verin.");
      return;
    }
    startTransition(async () => {
      const sonuc = await saveDrawingPlan(
        projectId,
        rows.map((r) => ({
          id: r.dbId,
          code: r.code,
          name: r.name,
          status: r.status,
          note: r.note,
        }))
      );
      if (sonuc?.error) {
        toast.error(sonuc.error);
        return;
      }
      // Yeni satırların kimliği SUNUCUDA üretilir ve geri döner. Ekran onu
      // almazsa aynı satır ikinci kaydetmede yeniden eklenmeye çalışılır ve
      // numara tekillik kısıtına takılır (bkz. `DrawingPlanResult.saved`).
      const kimlikler = new Map((sonuc?.saved ?? []).map((s) => [s.code, s.id]));
      const sonrasi = rows.map((r) => ({ ...r, dbId: kimlikler.get(r.code) ?? r.dbId }));
      setRows(sonrasi);
      setKayitli(imza(sonrasi));
      toast.success("Teknik resim numaralandırması kaydedildi");
    });
  }

  /**
   * Bir satırın kod seçenekleri: kendi kodu + hiç kullanılmamışlar.
   *
   * Kendi kodu havuzda OLMASA DA listeye girer (ilk satır): numaralandırma bir
   * süre 50'şer adımlıydı ve o dönemde yazılmış bir "0150" havuzda yoktur —
   * seçeneği hiç sunmamak, kutuyu açan mühendise kendi numarasını kaybettirirdi.
   */
  function kodSecenekleri(row: PlanRowState): ComboOption[] {
    const havuz = DRAWING_BANDS.flatMap((b) =>
      codesOfBand(b.band)
        .filter((c) => c === row.code || !kullanilan.has(c))
        .map((c) => ({
          value: c,
          label: fullDrawingNo(itemNo, c),
          hint: b.label,
          keywords: [c, b.label],
        }))
    );
    if (row.code && !havuz.some((o) => o.value === row.code)) {
      const band = bandOfCode(row.code);
      havuz.unshift({
        value: row.code,
        label: fullDrawingNo(itemNo, row.code),
        hint: band ? DRAWING_BANDS.find((b) => b.band === band)!.label : "Bant Dışı",
        keywords: [row.code],
      });
    }
    return havuz;
  }

  return (
    <section className="border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-muted/40 px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <ListOrdered className="size-4 text-primary" />
          Teknik Resim Takibi
          <span className="font-mono text-[11px] font-normal text-muted-foreground">
            {rows.length} Grup
          </span>
        </h3>
        {/* İlerleme başlıktadır: kart açıldığında ilk okunan sayı "ne kadarı
            bitti"dir, satırların tek tek durumu ondan sonra gelir. */}
        {rows.length > 0 && <IlerlemeCubugu {...ilerleme} />}
        {canEdit && (
          <Button type="button" size="sm" onClick={kaydet} disabled={pending || !kirli}>
            <Save className="size-3.5" />
            {pending ? "Kaydediliyor…" : kirli ? "Kaydet" : "Kayıtlı"}
          </Button>
        )}
      </header>

      {gruplar.length === 0 && (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          Henüz ana grup tanımlanmadı.{" "}
          {canEdit
            ? "Aşağıdaki düğmelerle köprü ve araba gruplarını ekleyin."
            : "Numaralandırmayı hesap raporunu yazan mühendis tanımlar."}
        </p>
      )}

      <div className="divide-y">
        {gruplar.map((grup) => (
          <div key={grup.label} className="px-4 py-3">
            <div
              className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase"
              title={
                grup.band
                  ? `Numara aralığı ${DRAWING_BANDS.find((b) => b.band === grup.band)?.rangeText}`
                  : undefined
              }
            >
              {grup.label}
            </div>
            <ul className="grid gap-2">
              {grup.rows.map((satir) => {
                const row = rows.find((r) => r.key === satir.id);
                if (!row) return null;
                // DAR EKRANDA ÜÇ SATIR, beş değil: numara ve ad kendi tam
                // genişlik satırlarını alır, "durum · not · sil" tek satırda
                // toplanır. Beşi alt alta inince tek bir grup satırı 224px
                // tutuyordu ve altı gruplu bir listede ekran sonsuz kayıyordu.
                return (
                  <li
                    key={row.key}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2 md:grid-cols-[10.5rem_1fr_11rem_12rem_2.5rem]"
                  >
                    <div className="col-span-3 md:col-span-1">
                      {canEdit ? (
                        <Combobox
                          options={kodSecenekleri(row)}
                          value={row.code}
                          onChange={(v) => setRow(row.key, { code: v })}
                          placeholder="Numara"
                          searchPlaceholder="Numara Ara…"
                          className="h-9 font-mono text-xs pointer-coarse:h-11"
                        />
                      ) : (
                        <span className="font-mono text-sm">
                          {fullDrawingNo(itemNo, row.code)}
                        </span>
                      )}
                    </div>

                    <div className="col-span-3 md:col-span-1">
                      {canEdit ? (
                        // Ad ALANI YAZILABİLİRDİR ve listeden de seçilir:
                        // ekstra gruplarda (kepçe, mıknatıs, müşteriye özel
                        // aparat) hazır listenin karşılığı çoğu zaman yoktur.
                        <EditableCombobox
                          options={adOnerileri(bandOfCode(row.code))}
                          value={row.name}
                          onChange={(v) => setRow(row.key, { name: v })}
                          placeholder="Grup Adı"
                          aria-label="Grup adı"
                          uppercase
                          inputClassName="h-9 pointer-coarse:h-11"
                        />
                      ) : (
                        <span className="text-sm font-medium">{row.name || "—"}</span>
                      )}
                    </div>

                    {canEdit ? (
                      <Select
                        value={row.status}
                        onValueChange={(v) =>
                          setRow(row.key, { status: v as DrawingPlanStatus })
                        }
                      >
                        <SelectTrigger
                          className="h-9 w-full text-xs pointer-coarse:h-11"
                          aria-label="Çizim durumu"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DRAWING_PLAN_STATUSES.map((s) => (
                            <SelectItem key={s.status} value={s.status}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {DRAWING_PLAN_STATUSES.find((s) => s.status === row.status)?.label}
                      </span>
                    )}

                    {canEdit ? (
                      <Input
                        value={row.note}
                        onChange={(e) => setRow(row.key, { note: e.target.value })}
                        placeholder="Not"
                        className="h-9 pointer-coarse:h-11"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{row.note}</span>
                    )}

                    {canEdit ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`${fullDrawingNo(itemNo, row.code)} satırını sil`}
                        className="justify-self-end text-destructive md:justify-self-auto"
                        onClick={() => removeRow(row.key)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    ) : (
                      // Salt-okunur kipte de bir hücre bırakılır: ızgarada
                      // boşluk atlanırsa not sütunu kayar.
                      <span aria-hidden />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/20 px-4 py-2.5">
          {DRAWING_BANDS.map((b) => (
            <Button
              key={b.band}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addRow(b.band)}
            >
              <Plus className="size-3.5" />
              {b.shortLabel}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
