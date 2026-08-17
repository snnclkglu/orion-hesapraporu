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
import { BookmarkPlus, Eye, EyeOff, Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import { EditableCombobox } from "@/components/editable-combobox";
import { Input } from "@/components/ui/input";
import { composeValue, derivedParts } from "@/lib/offers/compose";
import { isMultiValueList, joinMulti, splitMulti } from "@/lib/offers/multi";
import { parentOption } from "@/lib/offers/options";
import { offerRowDef } from "@/lib/offers/registry";
import { trKatla } from "@/lib/drawings/tr-text";
import {
  OFFER_ROW_SCOPES,
  OFFER_ROW_SCOPE_LABELS,
  type OfferPartDef,
  type OfferRow,
  type OfferRowScope,
} from "@/lib/offers/types";
import { cn } from "@/lib/utils";
import { ensureOfferOption } from "@/app/(app)/offers/actions";
import type { OfferOptionRow } from "@/app/(app)/offers/data";

export interface OptionBook {
  /** `list_key` → kök seçenekler. */
  byList: Record<string, OfferOptionRow[]>;
  /** Ebeveyn kimliği → çocuk seçenekler. */
  byParent: Record<string, OfferOptionRow[]>;
}

/**
 * Kademeli listenin EBEVEYN maddesi.
 *
 * Eşleşme kuralı çekirdektedir (`parentOption`): çok markalı değerde İLK marka
 * okunur — marka "SEW/FLENDER" olduğunda defterde o adla bir madde yoktur ve
 * seri listesi bomboş kalırdı.
 */
function ebeveynMaddesi(
  part: OfferPartDef,
  parts: Record<string, string>,
  parcaTanimlari: readonly OfferPartDef[],
  book: OptionBook
): OfferOptionRow | undefined {
  const ebeveynDef = parcaTanimlari.find((p) => p.key === part.childOf);
  if (!ebeveynDef?.list) return undefined;
  return parentOption(book.byList[ebeveynDef.list] ?? [], parts[part.childOf ?? ""] ?? "");
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
  const ebeveyn = ebeveynMaddesi(part, parts, parcaTanimlari, book);
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

  // SATIRIN ÜÇ KİPİ VAR ve ayrımı defterdeki tanım yapar:
  //
  //   · PARÇALI  — `def.parts` dolu (motor, redüktör, tekerlek…)
  //   · LİSTELİ  — `def.list` dolu, parçası yok (teslim süresi, halat donanımı,
  //                vinç sınıfı, kanca…). Defterin BÜYÜK ÇOĞUNLUĞU böyledir.
  //   · SERBEST  — ikisi de yok (serbest satır, KST, yürüme yolu…)
  //
  // LİSTELİ KİP BİR SÜRE HİÇ ÇİZİLMİYORDU (kullanıcı bildirimi, 17.08.2026:
  // *"ticari şartlarda dropdown seçenekler gelsin"*): kip yalnız parça sayısına
  // bakıyordu ve parçası olmayan her satır düz metin kutusuna düşüyordu — yani
  // ticari şartların tamamı, kanca, ray, boya, vinç sınıfı ve daha onlarcası
  // defterdeki seçenekleri hiç göstermiyordu.
  const tekListe = parcalar.length === 0 ? def?.list : undefined;
  const elle = row.manual === true || (parcalar.length === 0 && !tekListe);

  function setParts(next: Record<string, string>) {
    // TÜRETİLEN PARÇALAR BURADA HESAPLANIR (sürücünün toplam gücü): kullanıcı
    // gücü ya da adedi değiştirdiği ANDA toplam tazelenir ve derlenen değer
    // onunla birlikte yazılır. Kaydetme yoluna bırakılsaydı ekran belgeden
    // farklı bir şey gösterirdi.
    const turetilmis = derivedParts(parcalar, next);
    onChange({ ...row, parts: turetilmis, value: composeValue(parcalar, turetilmis) });
  }

  return (
    <div
      className={cn(
        // TEK ÇERÇEVE, DÖRT SÜTUN: etiket · değer · kapsam · eylemler.
        //
        // Etiket bir süre KENDİ kutusundaydı ve satır yüksekliği parçalı
        // satırlarda büyüdükçe etiketle değer birbirinden kayıyordu (kullanıcı
        // bildirimi, 17.08.2026: *"satır başlıklarını kutuların içine
        // yazabilirsin, kayma olmasın"*). Artık ikisi AYNI çerçevenin içinde ve
        // `items-start` ile ilk satırlarından hizalı; etiketin kendi kenarlığı
        // yok, yazının kendisi düzenlenebilir.
        "grid gap-x-3 gap-y-2 rounded-md border p-2",
        "sm:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)_auto_auto] sm:items-start",
        gizli && "border-dashed opacity-55"
      )}
    >
      {/* ETİKET DÜZENLENEBİLİRDİR: aynı kavram yıllar içinde iki yazımla
          basılmış ("Köprü ve Araba Limiti" / "Araba Limiti") ve ikisi de
          meşrudur. Kanonik anahtar sabit kalır, etiket belgeye aittir. */}
      <input
        value={row.label}
        onChange={(e) => onChange({ ...row, label: e.target.value })}
        aria-label="Satır etiketi"
        className="h-9 w-full min-w-0 rounded-sm bg-transparent px-1 text-base font-medium outline-none focus:bg-muted pointer-fine:text-sm"
      />

      <div className="grid min-w-0 gap-2">
        {elle ? (
          <Input
            value={row.value}
            onChange={(e) => onChange({ ...row, value: e.target.value, manual: true })}
            aria-label={`${row.label} değeri`}
            className="h-9 text-base pointer-fine:text-sm"
          />
        ) : tekListe ? (
          <ListeAlani
            listKey={tekListe}
            secenekler={book.byList[tekListe] ?? []}
            value={row.value}
            ariaLabel={`${row.label} değeri`}
            // MARKA SATIRLARI DA ÇOK DEĞERLİDİR: "Güç Kaynağı : Omron /
            // Phoenix" devralınan bir teklifin kendi satırıdır ve o satır
            // parçalı değil LİSTELİdir.
            multi={isMultiValueList(tekListe)}
            onChange={(v) => onChange({ ...row, value: v })}
          />
        ) : (
          // DERLENMİŞ DEĞER SATIRIN YANINDA, ALTINDA DEĞİL (kullanıcı isteği):
          // altta duran bir önizleme her satırı bir kat uzatıyor ve göz onu
          // parçalarla ilişkilendiremiyordu. Kutular bir miktar daralır,
          // karşılığında belgeye ne basılacağı aynı hizada görünür.
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_11rem] lg:items-start">
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
            <p
              title={row.value || undefined}
              className="min-w-0 self-center truncate font-mono text-xs text-muted-foreground lg:pt-5"
            >
              {row.value || "—"}
            </p>
          </div>
        )}
      </div>

      {/* KAPSAM SÜTUNU — kimin tedarik ettiği. Varsayılan Orion'dur ve belgede
          İZ BIRAKMAZ; yalnız "Müşteri Kapsamı" seçilirse PDF'te görünür
          (kullanıcı isteği, 17.08.2026). */}
      <select
        value={row.scope ?? "orion"}
        onChange={(e) => onChange({ ...row, scope: e.target.value as OfferRowScope })}
        aria-label={`${row.label} kapsamı`}
        title="Bu satırı kim tedarik ediyor — Müşteri Kapsamı seçilirse belgede görünür"
        className={cn(
          "oc-tap h-9 rounded-md border bg-background px-2 text-base pointer-fine:text-xs",
          row.scope === "customer" && "border-primary/50 bg-primary/[0.06] font-medium"
        )}
      >
        {OFFER_ROW_SCOPES.map((k) => (
          <option key={k} value={k}>
            {OFFER_ROW_SCOPE_LABELS[k]}
          </option>
        ))}
      </select>

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

/**
 * DEFTERDEN SEÇİLEN ALAN — tek ya da ÇOK değerli.
 *
 * `multi` açıkken alan birden çok madde taşır ve değer `A/B` olarak SAKLANIR
 * (`lib/offers/multi.ts`): kutular ayrı çizilir, belge tek metin okur. Kullanıcı
 * isteği (17.08.2026): *"Ekipmanlara ekstra marka ekleme özelliği olsun; örneğin
 * redüktör Yılmaz Redüktör ve Flender olarak ikisini belirtebileyim."*
 *
 * BOŞ KUTU DEĞERDE DURMAZ, o yüzden "marka ekle" düğmesinin açtığı kutu YEREL
 * bir durumdur: `splitMulti` boş dilimleri düşürür (belgeye "SEW/" girmesin
 * diye) ve kutu yalnız yazılınca değere katılır.
 */
function ListeAlani({
  listKey,
  secenekler,
  value,
  ariaLabel,
  parentId,
  parentEksikMesaji,
  multi,
  onChange,
}: {
  listKey: string;
  secenekler: readonly OfferOptionRow[];
  value: string;
  ariaLabel: string;
  /** Kademeli listede ebeveyn maddenin kimliği; kök listelerde `null`. */
  parentId?: string | null;
  /** Ebeveyn seçilmeden çocuk eklenmeye kalkılırsa gösterilecek uyarı. */
  parentEksikMesaji?: string;
  /** Alan birden çok madde taşıyabilir (marka listeleri). */
  multi?: boolean;
  onChange: (value: string) => void;
}) {
  const [bosKutu, setBosKutu] = useState(false);

  const degerler = multi ? splitMulti(value) : [value];
  const kutular = multi && bosKutu ? [...degerler, ""] : degerler;

  function kutuyuYaz(index: number, yeni: string) {
    if (!multi) {
      onChange(yeni);
      return;
    }
    // Son (boş) kutuya yazıldığında kutu artık değerin bir parçasıdır; silinip
    // boşaltıldığında ise kutu ekranda KALIR, yoksa yazmaya devam edecek
    // kullanıcının altından çekilirdi.
    setBosKutu(index === kutular.length - 1 ? yeni.trim() === "" : bosKutu);
    onChange(joinMulti(kutular.map((k, i) => (i === index ? yeni : k))));
  }

  return (
    <div className={cn("grid gap-1", multi && kutular.length > 1 && "sm:min-w-[12rem]")}>
      {kutular.map((kutu, i) => (
        <div key={i} className="flex items-center gap-1">
          <EditableCombobox
            options={secenekler.map((o) => o.value)}
            value={kutu}
            onChange={(v) => kutuyuYaz(i, v)}
            aria-label={i === 0 ? ariaLabel : `${ariaLabel} — ${i + 1}. madde`}
            className="min-w-0 flex-1"
            inputClassName="h-9 text-base pointer-fine:text-sm"
          />
          <DeftereEkle
            listKey={listKey}
            value={kutu}
            secenekler={secenekler}
            parentId={parentId}
            parentEksikMesaji={parentEksikMesaji}
          />
          {multi && kutular.length > 1 ? (
            <button
              type="button"
              title="Bu maddeyi kaldır"
              aria-label={`${ariaLabel} — ${i + 1}. maddeyi kaldır`}
              className="oc-tap-square inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                if (i === kutular.length - 1 && bosKutu) setBosKutu(false);
                onChange(joinMulti(kutular.filter((_, j) => j !== i)));
              }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      ))}

      {multi && !bosKutu && degerler.some((d) => d.trim() !== "") ? (
        <button
          type="button"
          className="oc-tap inline-flex w-fit items-center gap-1 rounded-md px-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setBosKutu(true)}
          title="İkinci bir marka ekle — belgede eğik çizgiyle yazılır (SEW/FLENDER)"
        >
          <Plus className="size-3" /> marka ekle
        </button>
      ) : null}
    </div>
  );
}

/**
 * "DEFTERE EKLE" YALNIZ GEREKİNCE BELİRİR: yazılan değer listede zaten varsa
 * hiçbir şey çizilmez. Her kutunun yanında duran bir kaydet düğmesi, vakaların
 * çoğunda gürültü olurdu ve asıl gerektiği anda fark edilmezdi (`YeniFirma`
 * bileşeninin kuralı). Çok değerli alanda düğme MADDE BAŞINA durur — deftere
 * giren şey "SEW/FLENDER" değil, SEW ve FLENDER'dır.
 */
function DeftereEkle({
  listKey,
  value,
  secenekler,
  parentId,
  parentEksikMesaji,
}: {
  listKey: string;
  value: string;
  secenekler: readonly OfferOptionRow[];
  parentId?: string | null;
  parentEksikMesaji?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [yazildi, setYazildi] = useState(false);

  const madde = value.trim();
  const eklenebilir =
    madde.length > 1 && !secenekler.some((o) => trKatla(o.value) === trKatla(madde));
  if (!eklenebilir || yazildi) return null;

  return (
    <button
      type="button"
      disabled={pending}
      title={`"${madde}" değerini deftere ekle — bir dahaki sefere listede çıkar`}
      aria-label="Deftere ekle"
      className="oc-tap-square inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={() =>
        startTransition(async () => {
          if (parentId === null && parentEksikMesaji) {
            toast.error(parentEksikMesaji);
            return;
          }
          const res = await ensureOfferOption({ listKey, value: madde, parentId: parentId ?? null });
          if (res.error) toast.error(res.error);
          else {
            setYazildi(true);
            toast.success(`"${madde}" deftere eklendi.`);
          }
        })
      }
    >
      <BookmarkPlus className="size-4" />
    </button>
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
  const secenekler = partOptions(part, parts, parcaTanimlari, book);
  const deger = parts[part.key] ?? "";

  // Kademeli parçada ebeveyn kimliği gerekir: seri, markanın ÇOCUĞU olarak
  // yazılır, kök madde olarak değil. Ebeveyn henüz seçilmemişse `null` döner ve
  // "deftere ekle" anlaşılır bir uyarıyla durur.
  const parentId = part.childOf
    ? (ebeveynMaddesi(part, parts, parcaTanimlari, book)?.id ?? null)
    : undefined;

  return (
    <div className="grid min-w-[8rem] flex-1 gap-1">
      <label className="text-[11px] text-muted-foreground">
        {part.label}
        {/* TÜRETİLEN KUTU NEDEN YAZILAMADIĞINI SÖYLER: kilitli ama sebebi
            görünmeyen bir alan, kullanıcıya bozuk gelir. */}
        {part.derived ? <span className="ml-1 opacity-70">(otomatik)</span> : null}
      </label>
      {part.derived ? (
        <Input
          value={deger}
          readOnly
          tabIndex={-1}
          aria-label={`${part.label} — otomatik hesaplanır`}
          title="Güç × Adet ile hesaplanır; adet 1 ise belgeye yazılmaz"
          className="h-9 min-w-0 flex-1 cursor-default bg-muted/50 text-base text-muted-foreground pointer-fine:text-sm"
        />
      ) : part.list ? (
        <ListeAlani
          listKey={part.list}
          secenekler={secenekler}
          value={deger}
          ariaLabel={part.label}
          parentId={parentId}
          parentEksikMesaji="Önce markayı seçin ya da deftere ekleyin."
          multi={isMultiValueList(part.list)}
          onChange={onChange}
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
