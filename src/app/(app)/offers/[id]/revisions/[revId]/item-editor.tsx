"use client";

// TEKLİF KALEMİ — bir vinç, bir kaldırma kirişi, bir kabin.
//
// Kalem KÜNYESİ (vinç tipi · kapasite · açıklık) teknik özellik satırlarından
// AYRIDIR ve bu bilinçlidir: künyedeki sayı her zaman TONDUR ve tek anlamlıdır;
// basılan `Kaldırma Kapasiteleri (Q)` satırının yazımı ise yıllar içinde kg,
// ton ve "30 / 5 Ton" arasında gidip gelmiştir. Künye SÜZGEÇTİR (teklif
// listesinde "32 tonluk portal vinç" aranır) ve ileride öneri motorunun
// girdisidir; belgeyi kelepçelemez.
//
// GRUP EKLENİR, ÇIKARILIR, YENİDEN ADLANDIRILIR. Defter bir ŞABLON kaynağıdır,
// bir kelepçe değil: firmanın gerçek tekliflerinde tek gruplu bir kaldırma
// kirişi de, on dört kalemli bir filo teklifi de var.

import { Fragment } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { EditableCombobox } from "@/components/editable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { newOfferId, rowFromDef } from "@/lib/offers/payload";
import { CUSTOM_GROUP_KEY, OFFER_GROUP_DEFS, OFFER_GROUP_DEF_BY_KEY } from "@/lib/offers/registry";
import type { OfferGroup, OfferItem, OfferRow } from "@/lib/offers/types";
import { adBuyuk } from "@/lib/tr-text";
import { cn } from "@/lib/utils";
import { RowEditor, type OptionBook } from "./row-editor";

export function ItemEditor({
  item,
  book,
  craneTypes,
  onChange,
  onRemove,
}: {
  item: OfferItem;
  book: OptionBook;
  craneTypes: readonly string[];
  onChange: (next: OfferItem) => void;
  onRemove: () => void;
}) {
  function setGroup(id: string, next: OfferGroup | null) {
    onChange({
      ...item,
      groups: next
        ? item.groups.map((g) => (g.id === id ? next : g))
        : item.groups.filter((g) => g.id !== id),
    });
  }

  function grupEkle(key: string) {
    const def = OFFER_GROUP_DEF_BY_KEY[key];
    onChange({
      ...item,
      groups: [
        ...item.groups,
        {
          id: newOfferId(),
          key: def ? key : CUSTOM_GROUP_KEY,
          title: def?.title ?? "YENİ BÖLÜM",
          rows: (def?.rows ?? []).map(rowFromDef),
        },
      ],
    });
  }

  function grupTasi(index: number, yon: -1 | 1) {
    const hedef = index + yon;
    if (hedef < 0 || hedef >= item.groups.length) return;
    const yeni = [...item.groups];
    [yeni[index], yeni[hedef]] = [yeni[hedef], yeni[index]];
    onChange({ ...item, groups: yeni });
  }

  return (
    <div className={cn("grid gap-4", item.hidden && "opacity-60")}>
      {/* ————————————————————————————————————————————— künye */}
      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor={`item_title_${item.id}`}>Kalem Başlığı</Label>
          <Input
            id={`item_title_${item.id}`}
            value={item.title}
            onChange={(e) => onChange({ ...item, title: adBuyuk(e.target.value) })}
            className="text-base pointer-fine:text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Vinç Tipi</Label>
          <EditableCombobox
            options={craneTypes}
            value={item.craneType ?? ""}
            onChange={(v) => onChange({ ...item, craneType: v })}
            aria-label="Vinç tipi"
            inputClassName="text-base pointer-fine:text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`item_cap_${item.id}`}>Kapasite (ton)</Label>
          <Input
            id={`item_cap_${item.id}`}
            value={item.capacityT ?? ""}
            inputMode="decimal"
            onChange={(e) =>
              onChange({ ...item, capacityT: sayiVeyaNull(e.target.value) })
            }
            className="text-base pointer-fine:text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`item_span_${item.id}`}>Açıklık (m)</Label>
          <Input
            id={`item_span_${item.id}`}
            value={item.spanM ?? ""}
            inputMode="decimal"
            onChange={(e) => onChange({ ...item, spanM: sayiVeyaNull(e.target.value) })}
            className="text-base pointer-fine:text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">
          Vinç tipi, kapasite ve açıklık teklif listesindeki süzgeçleri besler;
          belgeye basılan teknik satırlar aşağıdaki bölümlerden gelir.
        </p>
      </div>

      {/* ————————————————————————————————————————————— gruplar */}
      {item.groups.map((group, i) => (
        <Fragment key={group.id}>
          <GroupEditor
            group={group}
            book={book}
            ilk={i === 0}
            son={i === item.groups.length - 1}
            onChange={(g) => setGroup(group.id, g)}
            onRemove={() => setGroup(group.id, null)}
            onMove={(yon) => grupTasi(i, yon)}
          />
        </Fragment>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="oc-tap">
              <Plus className="size-4" /> Bölüm Ekle
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {OFFER_GROUP_DEFS.map((g) => (
              <DropdownMenuItem key={g.key} onSelect={() => grupEkle(g.key)}>
                {g.title}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => grupEkle(CUSTOM_GROUP_KEY)}>
              Serbest Bölüm
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="ghost"
          className="oc-tap"
          onClick={() => onChange({ ...item, hidden: !item.hidden })}
        >
          {item.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {item.hidden ? "Kalem gizli" : "Kalemi gizle"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="oc-tap ml-auto text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="size-4" /> Kalemi Sil
        </Button>
      </div>
    </div>
  );
}

function GroupEditor({
  group,
  book,
  ilk,
  son,
  onChange,
  onRemove,
  onMove,
}: {
  group: OfferGroup;
  book: OptionBook;
  ilk: boolean;
  son: boolean;
  onChange: (next: OfferGroup) => void;
  onRemove: () => void;
  onMove: (yon: -1 | 1) => void;
}) {
  const def = OFFER_GROUP_DEF_BY_KEY[group.key];
  // Defterdeki satırlardan HENÜZ EKLENMEMİŞ olanlar — "satır ekle" listesi
  // bunlardan kurulur, yani aynı satır iki kez eklenemez.
  const eklenebilir = (def?.rows ?? []).filter((r) => !group.rows.some((x) => x.key === r.key));

  function setRow(index: number, next: OfferRow | null) {
    onChange({
      ...group,
      rows: next
        ? group.rows.map((r, i) => (i === index ? next : r))
        : group.rows.filter((_, i) => i !== index),
    });
  }

  return (
    <section className={cn("grid gap-2 rounded-lg border p-3", group.hidden && "border-dashed opacity-55")}>
      <header className="flex flex-wrap items-center gap-2">
        <Input
          value={group.title}
          onChange={(e) => onChange({ ...group, title: adBuyuk(e.target.value) })}
          aria-label="Bölüm başlığı"
          className="h-9 max-w-xs text-base font-semibold pointer-fine:text-sm"
        />
        <span className="text-xs text-muted-foreground">{group.rows.length} satır</span>

        <div className="ml-auto flex items-center gap-1">
          <IkonDugme baslik="Yukarı taşı" disabled={ilk} onClick={() => onMove(-1)}>
            <ChevronUp className="size-4" />
          </IkonDugme>
          <IkonDugme baslik="Aşağı taşı" disabled={son} onClick={() => onMove(1)}>
            <ChevronDown className="size-4" />
          </IkonDugme>
          <IkonDugme
            baslik={group.hidden ? "Belgede göster" : "Belgede gizle — müşteri görmez"}
            aktif={group.hidden}
            onClick={() => onChange({ ...group, hidden: !group.hidden })}
          >
            {group.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </IkonDugme>
          <IkonDugme baslik="Bölümü kaldır" onClick={onRemove}>
            <Trash2 className="size-4" />
          </IkonDugme>
        </div>
      </header>

      <div className="grid gap-2">
        {group.rows.map((row, i) => (
          <RowEditor
            key={`${row.key}-${i}`}
            groupKey={group.key}
            row={row}
            book={book}
            onChange={(next) => setRow(i, next)}
            onRemove={() => setRow(i, null)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {eklenebilir.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="oc-tap">
                <Plus className="size-3.5" /> Satır Ekle
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              {eklenebilir.map((r) => (
                <DropdownMenuItem
                  key={r.key}
                  onSelect={() => onChange({ ...group, rows: [...group.rows, rowFromDef(r)] })}
                >
                  {r.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="oc-tap"
          onClick={() =>
            onChange({
              ...group,
              // SERBEST SATIR: defterde karşılığı olmayan bir bilgi de basılabilmeli.
              // Anahtar benzersizdir ki iki serbest satır birbirine karışmasın.
              rows: [...group.rows, { key: `serbest-${newOfferId().slice(0, 8)}`, label: "", value: "" }],
            })
          }
        >
          <Plus className="size-3.5" /> Serbest Satır
        </Button>
      </div>
    </section>
  );
}

function IkonDugme({
  children,
  baslik,
  aktif,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  baslik: string;
  aktif?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={baslik}
      aria-label={baslik}
      aria-pressed={aktif}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "oc-tap-square inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40",
        aktif && "bg-muted text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/** Boş kutu `null` üretir, `0` DEĞİL (SATIS-16: yer tutucu bir değer değildir). */
function sayiVeyaNull(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
