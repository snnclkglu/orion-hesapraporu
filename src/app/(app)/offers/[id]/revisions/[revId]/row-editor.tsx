"use client";

// TEKLİF SATIRI DÜZENLEYİCİSİ — bir `Etiket : Değer` satırının tamamı.
//
// Satırın üç kipi vardır ve üçü de kullanıcının açık isteğidir:
//
//   · **PARÇALI** — marka, güç, devir gibi alanlar ayrı ayrı seçilir; basılan
//     metin onlardan DERLENİR (`composeValue`). Hız buradan gelir: liste
//     defterden okunur, yazmak gerekmez.
//   · **ELLE** (*"istersem elle hızlı değiştirebilme özelliğim olsun"*) —
//     kutu tek bir serbest metne döner ve derleme onu bir daha EZMEZ.
//   · **GİZLİ** (*"satır bazında da gizlemeler yapabileyim"*) — satır solgun
//     ama düzenlenebilir kalır; belgeye GİRMEZ ve orada iz bırakmaz.
//
// LİSTELER KAPALI DEĞİLDİR: `EditableCombobox` hem yazmaya hem seçmeye açıktır
// ve defterde olmayan bir değer yazıldığında satırın yanında "deftere ekle"
// düğmesi belirir (`YeniFirma` bileşeninin kuralı: kayıt, teklifin ŞARTI
// değildir — yalnız bir dahaki sefere listede çıkmasını sağlar).

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BookmarkPlus, Eye, EyeOff, Pencil, Trash2, Wand2 } from "lucide-react";
import { EditableCombobox } from "@/components/editable-combobox";
import { Input } from "@/components/ui/input";
import { composeValue } from "@/lib/offers/compose";
import { offerRowDef } from "@/lib/offers/registry";
import { trKatla } from "@/lib/drawings/tr-text";
import type { OfferPartDef, OfferRow } from "@/lib/offers/types";
import { cn } from "@/lib/utils";
import { ensureOfferOption } from "@/app/(app)/offers/actions";
import type { OfferOptionRow } from "@/app/(app)/offers/data";

export interface OptionBook {
  /** `list_key` → kök seçenekler. */
  byList: Record<string, OfferOptionRow[]>;
  /** Ebeveyn kimliği → çocuk seçenekler. */
  byParent: Record<string, OfferOptionRow[]>;
}

/** Bir parçanın seçeneklerini çözer — kademeli listede ebeveyne bakar. */
function partOptions(
  part: OfferPartDef,
  parts: Record<string, string>,
  parcaTanimlari: readonly OfferPartDef[],
  book: OptionBook
): OfferOptionRow[] {
  if (!part.list) return [];
  if (!part.childOf) return book.byList[part.list] ?? [];

  const ebeveynDef = parcaTanimlari.find((p) => p.key === part.childOf);
  const ebeveynDeger = parts[part.childOf] ?? "";
  if (!ebeveynDef?.list || !ebeveynDeger) return [];
  const ebeveyn = (book.byList[ebeveynDef.list] ?? []).find(
    (o) => trKatla(o.value) === trKatla(ebeveynDeger)
  );
  return ebeveyn ? (book.byParent[ebeveyn.id] ?? []) : [];
}

export function RowEditor({
  groupKey,
  row,
  book,
  onChange,
  onRemove,
}: {
  groupKey: string;
  row: OfferRow;
  book: OptionBook;
  onChange: (next: OfferRow) => void;
  onRemove?: () => void;
}) {
  const def = offerRowDef(groupKey, row.key);
  const parcalar = def?.parts ?? [];
  const gizli = row.hidden === true;
  const elle = row.manual === true || parcalar.length === 0;

  function setParts(next: Record<string, string>) {
    onChange({ ...row, parts: next, value: composeValue(parcalar, next) });
  }

  return (
    <div
      className={cn(
        "grid gap-2 rounded-md border p-2 sm:grid-cols-[minmax(9rem,14rem)_1fr_auto] sm:items-start",
        gizli && "border-dashed opacity-55"
      )}
    >
      {/* ETİKET DÜZENLENEBİLİRDİR: aynı kavram yıllar içinde iki yazımla
          basılmış ("Köprü ve Araba Limiti" / "Araba Limiti") ve ikisi de
          meşrudur. Kanonik anahtar sabit kalır, etiket belgeye aittir. */}
      <Input
        value={row.label}
        onChange={(e) => onChange({ ...row, label: e.target.value })}
        aria-label="Satır etiketi"
        className="h-9 text-base font-medium pointer-fine:text-sm"
      />

      <div className="grid gap-2">
        {elle ? (
          <Input
            value={row.value}
            onChange={(e) => onChange({ ...row, value: e.target.value, manual: true })}
            aria-label={`${row.label} değeri`}
            className="h-9 text-base pointer-fine:text-sm"
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {parcalar.map((part) => (
                <PartField
                  key={part.key}
                  part={part}
                  parts={row.parts ?? {}}
                  parcaTanimlari={parcalar}
                  book={book}
                  onChange={(v) => setParts({ ...(row.parts ?? {}), [part.key]: v })}
                />
              ))}
            </div>
            {/* DERLENMİŞ DEĞER SALT OKUNUR GÖSTERİLİR: kullanıcı belgeye ne
                basılacağını parçaları girerken görür; sürpriz olmaz. */}
            <p className="font-mono text-xs text-muted-foreground">{row.value || "—"}</p>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        {parcalar.length > 0 ? (
          <IkonDugme
            aktif={elle}
            baslik={elle ? "Parçalı girişe dön" : "Elle yaz — derleme değeri ezmez"}
            onClick={() =>
              onChange(
                elle
                  ? { ...row, manual: false, value: composeValue(parcalar, row.parts ?? {}) }
                  : { ...row, manual: true }
              )
            }
          >
            {elle ? <Wand2 className="size-4" /> : <Pencil className="size-4" />}
          </IkonDugme>
        ) : null}

        <IkonDugme
          aktif={gizli}
          baslik={gizli ? "Belgede göster" : "Belgede gizle — müşteri görmez"}
          onClick={() => onChange({ ...row, hidden: !gizli })}
        >
          {gizli ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </IkonDugme>

        {onRemove ? (
          <IkonDugme baslik="Satırı kaldır" onClick={onRemove}>
            <Trash2 className="size-4" />
          </IkonDugme>
        ) : null}
      </div>
    </div>
  );
}

function PartField({
  part,
  parts,
  parcaTanimlari,
  book,
  onChange,
}: {
  part: OfferPartDef;
  parts: Record<string, string>;
  parcaTanimlari: readonly OfferPartDef[];
  book: OptionBook;
  onChange: (value: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [yazildi, setYazildi] = useState(false);
  const secenekler = partOptions(part, parts, parcaTanimlari, book);
  const deger = parts[part.key] ?? "";

  // "DEFTERE EKLE" YALNIZ GEREKİNCE BELİRİR: yazılan değer listede zaten varsa
  // hiçbir şey çizilmez. Her kutunun yanında duran bir kaydet düğmesi,
  // vakaların çoğunda gürültü olurdu ve asıl gerektiği anda fark edilmezdi.
  const deftereEklenebilir =
    Boolean(part.list) &&
    deger.trim().length > 1 &&
    !secenekler.some((o) => trKatla(o.value) === trKatla(deger));

  return (
    <div className="grid min-w-[8rem] flex-1 gap-1">
      <label className="text-[11px] text-muted-foreground">{part.label}</label>
      <div className="flex items-center gap-1">
        {part.list ? (
          <EditableCombobox
            options={secenekler.map((o) => o.value)}
            value={deger}
            onChange={onChange}
            aria-label={part.label}
            className="min-w-0 flex-1"
            inputClassName="h-9 text-base pointer-fine:text-sm"
          />
        ) : (
          <Input
            value={deger}
            onChange={(e) => onChange(e.target.value)}
            aria-label={part.label}
            inputMode={part.numeric ? "decimal" : undefined}
            className="h-9 min-w-0 flex-1 text-base pointer-fine:text-sm"
          />
        )}

        {deftereEklenebilir && !yazildi ? (
          <button
            type="button"
            disabled={pending}
            title={`"${deger}" değerini deftere ekle — bir dahaki sefere listede çıkar`}
            aria-label="Deftere ekle"
            className="oc-tap-square inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() =>
              startTransition(async () => {
                // Kademeli listede ebeveyn kimliği gerekir: seri, markanın
                // ÇOCUĞU olarak yazılır, kök madde olarak değil.
                let parentId: string | null = null;
                if (part.childOf) {
                  const ebeveynDef = parcaTanimlari.find((p) => p.key === part.childOf);
                  const ebeveynDeger = parts[part.childOf] ?? "";
                  const ebeveyn = ebeveynDef?.list
                    ? (book.byList[ebeveynDef.list] ?? []).find(
                        (o) => trKatla(o.value) === trKatla(ebeveynDeger)
                      )
                    : undefined;
                  if (!ebeveyn) {
                    toast.error("Önce markayı seçin ya da deftere ekleyin.");
                    return;
                  }
                  parentId = ebeveyn.id;
                }
                const res = await ensureOfferOption({
                  listKey: part.list!,
                  value: deger.trim(),
                  parentId,
                });
                if (res.error) toast.error(res.error);
                else {
                  setYazildi(true);
                  toast.success(`"${deger.trim()}" deftere eklendi.`);
                }
              })
            }
          >
            <BookmarkPlus className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function IkonDugme({
  children,
  baslik,
  aktif,
  onClick,
}: {
  children: React.ReactNode;
  baslik: string;
  aktif?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={baslik}
      aria-label={baslik}
      aria-pressed={aktif}
      onClick={onClick}
      className={cn(
        "oc-tap-square inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
        aktif && "bg-muted text-foreground"
      )}
    >
      {children}
    </button>
  );
}
