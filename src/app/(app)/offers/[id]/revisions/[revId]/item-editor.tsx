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
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2, Wand2 } from "lucide-react";
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
import {
  newOfferId,
  rowFromDef,
  setTrolleyCount,
  trolleyCount,
  withGroup,
} from "@/lib/offers/payload";
import {
  AUX_HOIST_GROUP_KEY,
  CUSTOM_GROUP_KEY,
  OFFER_GROUP_DEFS,
  OFFER_GROUP_DEF_BY_KEY,
  auxCapacity,
} from "@/lib/offers/registry";
import { composeItemTitle, kalemBasligiBuyuk, withAutoTitle } from "@/lib/offers/title";
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
  /**
   * KALEMİN HER DEĞİŞİMİ BURADAN GEÇER ve iki şeyi kendiliğinden yapar:
   *
   *   1. BAŞLIĞI TAZELER (`withAutoTitle`) — kapasite, açıklık ya da vinç tipi
   *      değiştiğinde başlık onlarla birlikte değişir. Elle yazılmış başlığa
   *      dokunulmaz.
   *   2. YARDIMCI KALDIRMA TONAJI GİRİLDİYSE BÖLÜMÜ AÇAR (kullanıcı isteği,
   *      17.08.2026: *"Yardımcı Kaldırmaya tonaj girersem altta yardımcı
   *      kaldırma adında bölüm açılsın."*). Tetik BOŞTAN DOLUYA geçiştir, "dolu
   *      olması" değil: sonrası olsaydı kullanıcının bilerek kaldırdığı bölüm
   *      her tuş vuruşunda geri gelirdi.
   */
  function degistir(next: OfferItem) {
    const oncekiAux = auxCapacity(item.groups);
    const yeniAux = auxCapacity(next.groups);
    let sonuc = withAutoTitle(next);
    if (!oncekiAux && yeniAux && !sonuc.groups.some((g) => g.key === AUX_HOIST_GROUP_KEY)) {
      sonuc = withGroup(sonuc, AUX_HOIST_GROUP_KEY);
      toast.success("YARDIMCI KALDIRMA GRUBU bölümü eklendi.");
    }
    onChange(sonuc);
  }

  function setGroup(id: string, next: OfferGroup | null) {
    degistir({
      ...item,
      groups: next
        ? item.groups.map((g) => (g.id === id ? next : g))
        : item.groups.filter((g) => g.id !== id),
    });
  }

  function grupEkle(key: string) {
    const def = OFFER_GROUP_DEF_BY_KEY[key];
    degistir({
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

  /** ARABA SAYISI — bölümün varlığından okunur, ayrı bir alanda saklanmaz. */
  function arabaSayisiDegistir(adet: 1 | 2) {
    const { item: next, korunanVeri } = setTrolleyCount(item, adet);
    onChange(next);
    if (korunanVeri) {
      toast.warning(
        "İkinci araba bölümünde girilmiş veri var; bölüm SİLİNMEDİ. Gerçekten kaldıracaksanız bölüm başlığındaki çöp kutusunu kullanın."
      );
    }
  }

  const arabaAdedi = trolleyCount(item);
  const otomatikBaslik = composeItemTitle(item.groups);

  return (
    <div className={cn("grid gap-4", item.hidden && "opacity-60")}>
      {/* ————————————————————————————————————————————— künye */}
      {/*
        KÜNYE YALNIZ BAŞLIK VE VİNÇ TİPİDİR.
        Kapasite ve açıklık BURADAN KALDIRILDI (kullanıcı isteği, 17.08.2026:
        *"Kapasite ve açıklığı genel özelliklerde sorsun, üstte sormasına gerek
        yok, aynı bilgiyi iki defa alıyoruz"*). İkisi artık GENEL ÖZELLİKLER'de
        sorulur ve teklif listesindeki tonaj süzgecini besleyen sayılar
        kaydetme yolunda O SATIRLARDAN türetilir (`itemFactsFromRows`) — iki
        yerde yaşayan bir sayının ayrışma ihtimali de böylece kalkar.
      */}
      <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid gap-1.5">
          <Label htmlFor={`item_title_${item.id}`}>Kalem Başlığı</Label>
          {/*
            BAŞLIK OTOMATİK GELİR, KİLİTLİ DEĞİL (kullanıcı isteği, 17.08.2026:
            *"Kalem başlığını da otomatize edelim hata olmasın … istersem
            düzenleyebileyim"*). Kutuya yazmak `titleManual`ı açar ve türetme
            bir daha ezmez; asa düğmesi otomatiğe geri döndürür. Satır
            düzenleyicideki elle/parçalı anahtarının aynısı.
          */}
          <div className="flex items-center gap-1">
            <Input
              id={`item_title_${item.id}`}
              value={item.title}
              onChange={(e) =>
                onChange({ ...item, title: kalemBasligiBuyuk(e.target.value), titleManual: true })
              }
              className="min-w-0 flex-1 text-base pointer-fine:text-sm"
            />
            {item.titleManual && otomatikBaslik ? (
              <IkonDugme
                baslik={`Otomatik başlığa dön — "${otomatikBaslik}"`}
                onClick={() => onChange({ ...item, title: otomatikBaslik, titleManual: false })}
              >
                <Wand2 className="size-4" />
              </IkonDugme>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {item.titleManual
              ? "Elle yazıldı — teknik satırlar değişse de korunur."
              : "Kapasite × açıklık + vinç tipinden otomatik yazılır."}
          </p>
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

        {/*
          ARABA SAYISI (kullanıcı isteği, 17.08.2026): çift seçilirse ikinci
          araba bölümü kurulur ve ikisi "VİNÇ ARABASI - 1 / - 2" olarak
          adlandırılır. Seçim AYRI BİR ALANDA SAKLANMAZ, bölümün varlığından
          okunur — iki yazıcısı olan bir sayı er geç ayrışır (TEKLIF-20).
        */}
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor={`item_trolley_${item.id}`}>Araba Sayısı</Label>
          <select
            id={`item_trolley_${item.id}`}
            value={arabaAdedi}
            onChange={(e) => arabaSayisiDegistir(Number(e.target.value) === 2 ? 2 : 1)}
            className="oc-tap h-9 w-full max-w-xs rounded-md border bg-background px-2 text-base pointer-fine:text-sm"
          >
            <option value={1}>Tek Arabalı</option>
            <option value={2}>Çift Arabalı</option>
          </select>
        </div>

        <p className="text-xs text-muted-foreground sm:col-span-2">
          Kapasite ve açıklık aşağıdaki GENEL ÖZELLİKLER bölümünde sorulur;
          teklif listesindeki tonaj süzgeci oradan beslenir. Yardımcı kaldırma
          tonajı girildiğinde yardımcı kaldırma bölümü kendiliğinden açılır.
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

