"use client";

// TEKNİK RESİM TAKİBİ — ana grup numaralandırma defteri.
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
// yoktur (`SALE_SCOPES` ile aynı ilke): listede olmayan bir ad aramada
// yazılarak eklenir.
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
import { Combobox, type ComboOption } from "@/components/combobox";
import {
  DRAWING_BANDS,
  DRAWING_GROUP_PRESETS,
  codesOfBand,
  fullDrawingNo,
  groupDrawingPlan,
  nextFreeCode,
  type DrawingBand,
  type DrawingPlanRow,
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
  drawn: boolean;
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
    drawn: r.drawn,
    note: r.note,
  }));
}

/** Kaydedilmemiş değişiklik var mı — "Kaydet" düğmesi buna göre canlanır. */
function imza(rows: readonly PlanRowState[]): string {
  return JSON.stringify(
    rows.map((r) => [r.dbId ?? "", r.code, r.name, r.drawn, r.note])
  );
}

/** Ana grup adı önerileri — bütün bantlar tek listede, bandı ipucu olarak. */
const AD_ONERILERI: ComboOption[] = DRAWING_BANDS.flatMap((b) =>
  DRAWING_GROUP_PRESETS[b.band].map((ad) => ({
    value: ad,
    label: ad,
    hint: b.label,
  }))
);

/**
 * Seçim kutusu — `components/ui`da Checkbox yoktur (progress-board.tsx ile aynı
 * gerekçe): ham kutu 13px'lik bir hedeftir, 44px'lik bir `label` içine sarmak
 * dokunma kuralını karşılamanın en ucuz yoludur.
 */
function CizildiKutusu({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className="flex min-h-9 cursor-pointer items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground pointer-coarse:min-h-11"
      title="Bu ana grubun resimleri çizildi mi?"
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--primary)]"
        aria-label="Çizildi"
      />
      Çizildi
    </label>
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
          drawn: r.drawn,
          note: r.note,
        }))
      ),
    [rows]
  );

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
    setRows((prev) => [...prev, { key: yeniAnahtar(), code, name: "", drawn: false, note: "" }]);
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
          drawn: r.drawn,
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

  /** Bir satırın kod seçenekleri: kendi kodu + hiç kullanılmamışlar. */
  function kodSecenekleri(row: PlanRowState): ComboOption[] {
    return DRAWING_BANDS.flatMap((b) =>
      codesOfBand(b.band)
        .filter((c) => c === row.code || !kullanilan.has(c))
        .map((c) => ({
          value: c,
          label: fullDrawingNo(itemNo, c),
          hint: b.label,
          keywords: [c, b.label],
        }))
    );
  }

  function adSecenekleri(row: PlanRowState): ComboOption[] {
    const ad = row.name.trim();
    if (!ad || AD_ONERILERI.some((o) => o.value === ad)) return AD_ONERILERI;
    // Listede olmayan ad KENDİ SEÇENEĞİ olarak korunur; aksi hâlde tetikleyici
    // boş görünür ve ilk düzenlemede kullanıcının yazdığı ad silinirdi.
    return [{ value: ad, label: ad, hint: "Elle yazıldı" }, ...AD_ONERILERI];
  }

  return (
    <section className="border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b bg-muted/40 px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <ListOrdered className="size-4 text-primary" />
          Teknik Resim Takibi
          <span className="font-mono text-[11px] font-normal text-muted-foreground">
            ({rows.length} ana grup)
          </span>
        </h3>
        {canEdit && (
          <Button type="button" size="sm" onClick={kaydet} disabled={pending || !kirli}>
            <Save className="size-3.5" />
            {pending ? "Kaydediliyor…" : kirli ? "Kaydet" : "Kayıtlı"}
          </Button>
        )}
      </header>

      <p className="border-b px-4 py-2 text-[11px] text-muted-foreground">
        Ana grup numaralandırması projenin başında burada verilir; ressam
        numarayı buradan okur. Numara{" "}
        <span className="font-mono">
          {itemNo ? `${itemNo}-` : ""}
          <span className="text-foreground">XXXX</span>
        </span>{" "}
        biçimindedir — köprü grupları {DRAWING_BANDS[0].rangeText}, araba
        grupları {DRAWING_BANDS[1].rangeText}, ekstra gruplar (kepçe, mıknatıs…){" "}
        {DRAWING_BANDS[2].rangeText}{" "}
        arasında numaralanır. Aynı liste ekipman
        listesindeki Teknik Ressam Özeti&apos;nin ve onun Excel/PDF çıktısının
        sonunda da görünür.
      </p>

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
            <div className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">
              {grup.label}
            </div>
            <ul className="grid gap-2">
              {grup.rows.map((satir) => {
                const row = rows.find((r) => r.key === satir.id);
                if (!row) return null;
                // DAR EKRANDA ÜÇ SATIR, beş değil: numara ve ad kendi tam
                // genişlik satırlarını alır, "çizildi · not · sil" tek satırda
                // toplanır. Beşi alt alta inince tek bir grup satırı 224px
                // tutuyordu ve altı gruplu bir listede ekran sonsuz kayıyordu.
                return (
                  <li
                    key={row.key}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2 md:grid-cols-[10.5rem_1fr_6rem_12rem_2.5rem]"
                  >
                    <div className="col-span-3 md:col-span-1">
                      {canEdit ? (
                        <Combobox
                          options={kodSecenekleri(row)}
                          value={row.code}
                          onChange={(v) => setRow(row.key, { code: v })}
                          placeholder="Numara"
                          searchPlaceholder="Numara ara…"
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
                        <Combobox
                          options={adSecenekleri(row)}
                          value={row.name.trim() || null}
                          onChange={(v) => setRow(row.key, { name: v })}
                          onCreate={(v) => setRow(row.key, { name: v.toLocaleUpperCase("tr") })}
                          createLabel="Yeni grup adı"
                          placeholder="Ana grup adı"
                          searchPlaceholder="Grup ara ya da yaz…"
                          className="h-9 pointer-coarse:h-11"
                        />
                      ) : (
                        <span className="text-sm font-medium">{row.name || "—"}</span>
                      )}
                    </div>

                    <CizildiKutusu
                      checked={row.drawn}
                      disabled={!canEdit}
                      onChange={(v) => setRow(row.key, { drawn: v })}
                    />

                    {canEdit ? (
                      <Input
                        value={row.note}
                        onChange={(e) => setRow(row.key, { note: e.target.value })}
                        placeholder="Not (isteğe bağlı)"
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
                      // Salt-okunur kipte de bir hücre bırakılır: üç sütunlu
                      // ızgarada boşluk atlanırsa not sütunu kayar.
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
              {b.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
