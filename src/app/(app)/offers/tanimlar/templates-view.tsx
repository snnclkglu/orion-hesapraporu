"use client";

// TEKLİF ŞABLONLARI — yeni teklifin İSKELETİ.
//
// Şablon bir teklifin değerlerini değil GRUPLARINI belirler: "Portal Vinç"
// seçilince belgede genel özellikler, kaldırma, araba, portal yürütme, çelik ve
// elektrik grupları hazır gelir; kullanıcı yalnız satırları doldurur. Bu yüzden
// düzenlenen şey bir metin değil bir KUTUCUK KÜMESİDİR.
//
// GRUPLARIN SIRASI EKRANDAN GELMEZ. İşaretleme sırası bir belge düzeni değildir;
// sıra defterin kendisinden (`OFFER_GROUP_DEFS`) alınır ve yazma yolunda
// dayatılır — ekran da kutucukları o sırayla basar ki ikisi aynı şeyi söylesin.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  createOfferTemplate,
  deleteOfferTemplate,
  updateOfferTemplate,
  type OfferTemplateInput,
} from "./actions";
import type { OfferTemplateRow } from "../data";
import { OFFER_GROUP_DEFS } from "@/lib/offers/registry";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Yeni şablonun sırası: mevcut en büyüğün on fazlası (seed 10'ar artar). */
const SIRA_ADIMI = 10;

function grupAnahtarlari(row: OfferTemplateRow): string[] {
  const keys = row.skeleton?.groupKeys ?? [];
  return OFFER_GROUP_DEFS.map((g) => g.key).filter((k) => keys.includes(k));
}

function girdi(row: OfferTemplateRow): OfferTemplateInput {
  return {
    name: row.name,
    craneType: row.crane_type,
    groupKeys: grupAnahtarlari(row),
    active: row.active,
    sort: row.sort,
  };
}

export function TemplatesView({
  templates,
  craneTypes,
}: {
  templates: OfferTemplateRow[];
  /** `val.craneType` defterindeki etkin vinç tipleri — öneri listesi. */
  craneTypes: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [yeniAcik, setYeniAcik] = useState(false);
  const [silinecek, setSilinecek] = useState<OfferTemplateRow | null>(null);

  function calistir(fn: () => Promise<{ error?: string }>, basari?: string) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (basari) toast.success(basari);
      router.refresh();
    });
  }

  const sonrakiSira =
    templates.reduce((enBuyuk, t) => Math.max(enBuyuk, t.sort), 0) + SIRA_ADIMI;
  const pasifSayisi = templates.filter((t) => !t.active).length;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Yeni teklif açılırken seçilen iskelet. Şablon yalnız belgenin GRUPLARINI kurar;
          değerler defterdeki listelerden gelir. Buradaki değişiklik açılmış tekliflere
          dokunmaz.
        </p>
        <Button type="button" size="sm" onClick={() => setYeniAcik(true)}>
          <Plus className="size-4" /> Yeni Şablon
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="ŞABLON YOK"
          description="Defterde şablon kalmamış. Firmanın gerçekten teklif verdiği vinç tipleri için birer iskelet açın."
        />
      ) : (
        <div className="grid gap-3 2xl:grid-cols-2">
          {templates.map((t) => (
            <SablonKarti
              key={t.id}
              row={t}
              craneTypes={craneTypes}
              pending={pending}
              calistir={calistir}
              onSil={() => setSilinecek(t)}
            />
          ))}
        </div>
      )}

      <p className="text-[12px] text-muted-foreground">
        {templates.length} şablon
        {pasifSayisi > 0 ? ` · ${pasifSayisi} pasif` : ""}. Pasif şablon defterde kalır, yeni
        teklif açarken listelenmez.
      </p>

      {yeniAcik && (
        <YeniSablonPenceresi
          craneTypes={craneTypes}
          sonrakiSira={sonrakiSira}
          pending={pending}
          onKapat={() => setYeniAcik(false)}
          onKaydet={(input) =>
            calistir(async () => {
              const res = await createOfferTemplate(input);
              if (!res.error) setYeniAcik(false);
              return res;
            }, "Şablon deftere eklendi.")
          }
        />
      )}

      {silinecek && (
        <Dialog open onOpenChange={(next) => !next && setSilinecek(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Şablonu Sil</DialogTitle>
              <DialogDescription>
                <span className="font-medium">{silinecek.name}</span> defterden silinecek.
                AÇILMIŞ TEKLİFLER ETKİLENMEZ — şablon yalnız belgenin ilk hâlini kurar. Yine de
                kullanılmaya devam edecekse silmek yerine <em>pasife alın</em>.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setSilinecek(null)}>
                Vazgeç
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  const id = silinecek.id;
                  setSilinecek(null);
                  calistir(() => deleteOfferTemplate(id), "Şablon silindi.");
                }}
              >
                {pending ? "Siliniyor…" : "Kalıcı Olarak Sil"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ————————————————————————————————————————————————————————————— kart

function SablonKarti({
  row,
  craneTypes,
  pending,
  calistir,
  onSil,
}: {
  row: OfferTemplateRow;
  craneTypes: string[];
  pending: boolean;
  calistir: (fn: () => Promise<{ error?: string }>, basari?: string) => void;
  onSil: () => void;
}) {
  const secili = grupAnahtarlari(row);
  const tipListId = "sablon-vinc-tipi-" + row.id;

  /** Kart bütün alanları birlikte yazar; tek alanlık action ötekileri sıfırlardı. */
  function yaz(degisiklik: Partial<OfferTemplateInput>) {
    calistir(() => updateOfferTemplate(row.id, { ...girdi(row), ...degisiklik }));
  }

  return (
    <section className={cn("grid gap-2 rounded-lg border bg-card p-3", !row.active && "bg-muted/30")}>
      <div className="flex items-center gap-1.5">
        <Input
          key={`${row.id}-ad-${row.name}`}
          defaultValue={row.name}
          maxLength={160}
          aria-label="Şablon adı"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== row.name) yaz({ name: v });
          }}
          className={cn("h-9 min-w-0 flex-1 font-medium", !row.active && "text-muted-foreground")}
        />
        <Input
          key={`${row.id}-sira-${row.sort}`}
          type="number"
          min={0}
          max={9999}
          step={10}
          defaultValue={row.sort}
          aria-label="Sıra"
          title="Listedeki sıra"
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v !== row.sort) yaz({ sort: Math.trunc(v) });
          }}
          className="h-9 w-[4.5rem] shrink-0 text-center tabular-nums"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => yaz({ active: !row.active })}
          aria-pressed={row.active}
          aria-label={row.active ? "Pasife al" : "Etkinleştir"}
          title={
            row.active
              ? "Etkin — yeni teklifte seçilebilir; tıklayınca pasife düşer"
              : "Pasif — defterde kalır, yeni teklifte listelenmez"
          }
          className={cn(
            "oc-tap-square grid size-5 shrink-0 place-items-center border transition-colors",
            row.active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-transparent hover:border-primary"
          )}
        >
          <Check className="size-3.5" />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          onClick={onSil}
          aria-label={row.name + " şablonunu sil"}
          title="Sil"
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>

      <div className="grid gap-1">
        <Label htmlFor={"sablon-tip-" + row.id} className="text-[12px] text-muted-foreground">
          Vinç Tipi
        </Label>
        <Input
          id={"sablon-tip-" + row.id}
          key={`${row.id}-tip-${row.crane_type}`}
          list={tipListId}
          defaultValue={row.crane_type}
          maxLength={120}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v !== row.crane_type) yaz({ craneType: v });
          }}
          className="h-9"
        />
        <datalist id={tipListId}>
          {craneTypes.map((tip) => (
            <option key={tip} value={tip} />
          ))}
        </datalist>
      </div>

      <GrupSecimi
        secili={secili}
        pending={pending}
        onDegis={(keys) => yaz({ groupKeys: keys })}
      />
    </section>
  );
}

// —————————————————————————————————————————————————————— grup kutucukları

function GrupSecimi({
  secili,
  pending,
  onDegis,
}: {
  secili: string[];
  pending?: boolean;
  onDegis: (keys: string[]) => void;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-[12px] text-muted-foreground">Belgedeki Gruplar</span>
      {/* Sarmal küme: dar ekranda ikinci satıra iner, yatay kaydırma doğurmaz
          (MOBIL-15). */}
      <div className="flex flex-wrap gap-1.5">
        {OFFER_GROUP_DEFS.map((grup) => {
          const isaretli = secili.includes(grup.key);
          return (
            <label
              key={grup.key}
              className={cn(
                "oc-tap inline-flex cursor-pointer items-center gap-1.5 border px-2 py-1 text-[12px] transition-colors",
                isaretli
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary"
              )}
            >
              <input
                type="checkbox"
                checked={isaretli}
                disabled={pending}
                onChange={(e) =>
                  onDegis(
                    e.target.checked
                      ? [...secili, grup.key]
                      : secili.filter((k) => k !== grup.key)
                  )
                }
                className="size-3.5"
              />
              {grup.title}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ———————————————————————————————————————————————————————— yeni şablon

function YeniSablonPenceresi({
  craneTypes,
  sonrakiSira,
  pending,
  onKapat,
  onKaydet,
}: {
  craneTypes: string[];
  sonrakiSira: number;
  pending: boolean;
  onKapat: () => void;
  onKaydet: (input: OfferTemplateInput) => void;
}) {
  const [form, setForm] = useState<OfferTemplateInput>({
    name: "",
    craneType: "",
    // GENEL ÖZELLİKLER önceden işaretli: on dört teklifin on dördünde var ve
    // bu bir varsayım değil ÖLÇÜLMÜŞ bir olgudur (defterin kendi notu).
    groupKeys: ["general"],
    active: true,
    sort: sonrakiSira,
  });

  return (
    <Dialog open onOpenChange={(next) => !next && onKapat()}>
      <DialogContent className="sm:max-w-[min(40rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Yeni Teklif Şablonu</DialogTitle>
          <DialogDescription>
            Şablon adı teklif açarken listede görünür; vinç tipi belgenin genel özellikler
            satırına gider. Gruplar belgede hangi öbeklerin çıkacağını belirler.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onKaydet(form);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="yeni-sablon-ad">Şablon Adı</Label>
            <Input
              id="yeni-sablon-ad"
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              required
              maxLength={160}
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="yeni-sablon-tip">Vinç Tipi</Label>
            <Input
              id="yeni-sablon-tip"
              list="yeni-sablon-vinc-tipleri"
              value={form.craneType}
              onChange={(e) => setForm((c) => ({ ...c, craneType: e.target.value }))}
              maxLength={120}
            />
            <datalist id="yeni-sablon-vinc-tipleri">
              {craneTypes.map((tip) => (
                <option key={tip} value={tip} />
              ))}
            </datalist>
          </div>

          <GrupSecimi
            secili={form.groupKeys}
            onDegis={(keys) => setForm((c) => ({ ...c, groupKeys: keys }))}
          />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onKapat}>
              Vazgeç
            </Button>
            <Button
              type="submit"
              disabled={pending || !form.name.trim() || form.groupKeys.length === 0}
            >
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
