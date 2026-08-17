"use client";

// TEKLİF EDİTÖRÜ — belgenin tamamı, bölüm bölüm.
//
// Düzen mühendislik editörünün teklif karşılığıdır: solda bölüm rayı, sağda o
// bölümün formu, üstte kaydet ve belge eylemleri. Kullanıcının tercihi
// budur — bölüm içinde kal, sırayla ilerle.
//
// GİZLEME HER DÜZEYDE VARDIR (kalem · bölüm · satır) ve hepsinin belgeye
// yansıması TEK süzgeçten geçer (`printedPayload`): gizlenen şey PDF'e
// GİRMEZ, boşluk ya da iz bırakmaz. Editörde ise solgun ama düzenlenebilir
// kalır ve verisi korunur — gizlemek silmek değildir.
//
// YAYIMLANMIŞ REVİZYON SALT OKUNURDUR. Kilit veritabanındaki tetikleyicidedir;
// buradaki `readOnly` yalnız görgü kuralıdır ve kullanıcıyı boşuna yazmaktan
// kurtarır.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { BookmarkPlus, Check, Download, Eye, EyeOff, Plus, Save, Send, Trash2 } from "lucide-react";
import { EditableCombobox } from "@/components/editable-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtMoney } from "@/lib/currency";
import {
  greetingFor,
  hiddenCount,
  newOfferId,
  newPriceLine,
  newTextLine,
} from "@/lib/offers/payload";
import {
  lineAmount,
  offerTotal,
  paymentLineText,
  paymentPercentTotal,
  vatNote,
} from "@/lib/offers/pricing";
import {
  PRICE_UNIT_LIST,
  TERMS_GROUP_KEY,
  TERM_ROW_DEFS,
  TEST_LOAD_GROUP_KEY,
  TEST_LOAD_ROW_DEFS,
} from "@/lib/offers/registry";
import { offerDocLine } from "@/lib/offers/no";
import type {
  OfferPayload,
  OfferPriceLine,
  OfferRow,
  OfferTextLine,
} from "@/lib/offers/types";
import { activeContacts, coverFieldsFromContact, type CustomerContact } from "@/lib/customer-contacts";
import { adBuyuk } from "@/lib/tr-text";
import { cn } from "@/lib/utils";
import {
  indexChildren,
  indexOptions,
  type OfferAuthor,
  type OfferOptionRow,
  type OfferTemplateRow,
} from "@/app/(app)/offers/data";
import { ensureOfferOption, issueOfferRevision, saveOfferRevision } from "@/app/(app)/offers/actions";
import { ItemEditor } from "./item-editor";
import { KalemEkleDialog } from "./kalem-ekle-dialog";
import { RowEditor, type OptionBook } from "./row-editor";

type BolumKey = string;

export function OfferEditor({
  offerId,
  offerNo,
  revisionId,
  revNo,
  readOnly,
  initial,
  options,
  contacts,
  authors,
  templates,
  currency,
}: {
  offerId: string;
  offerNo: string;
  revisionId: string;
  revNo: number;
  readOnly: boolean;
  initial: OfferPayload;
  options: readonly OfferOptionRow[];
  /** Müşterinin iletişim kişileri — kapaktaki muhatap seçicisini besler. */
  contacts: readonly CustomerContact[];
  /** Teklifi hazırlayabilecek kişiler (Yönetici · Müdür) — "KİMDEN" seçicisi. */
  authors: readonly OfferAuthor[];
  /** Vinc sablonlari — yeni kalem eklerken bolumleri onlar kurar. */
  templates: readonly OfferTemplateRow[];
  currency: string;
}) {
  const [payload, setPayload] = useState<OfferPayload>(initial);
  const [kirli, setKirli] = useState(false);
  const [aktif, setAktif] = useState<BolumKey>("kapak");
  const [pending, startTransition] = useTransition();
  const [onizleme, setOnizleme] = useState(false);
  const [kalemEkle, setKalemEkle] = useState(false);

  const book: OptionBook = useMemo(
    () => ({ byList: indexOptions(options), byParent: indexChildren(options) }),
    [options]
  );
  const listesi = (key: string) => (book.byList[key] ?? []).map((o) => o.value);

  function guncelle(next: OfferPayload) {
    setPayload(next);
    setKirli(true);
  }

  /**
   * BİR ÖNCEKİ HÂLDEN türeten güncelleme.
   *
   * `guncelle` çağıran bileşenin ELİNDEKİ payload'dan yeni bir nesne kurar; iki
   * değişiklik aynı boyama turunda olursa ikincisi birincisini SESSİZCE geri
   * alır. Tik listesinde ölçüldü (17.08.2026): arka arkaya iki madde
   * işaretlendiğinde yalnız sonuncusu kalıyordu. Hızlı tıklayan bir kullanıcı
   * için bu, girdiğini kaybetmek demektir — belge editöründe kabul edilemez.
   */
  function guncelleIle(fn: (onceki: OfferPayload) => OfferPayload) {
    setPayload(fn);
    setKirli(true);
  }

  const bolumler = useMemo(
    () => [
      { key: "kapak", label: "Kapak" },
      ...payload.items.map((it, i) => ({
        key: `item:${it.id}`,
        label: it.title || `Kalem ${i + 1}`,
      })),
      { key: "test", label: "Test Yükü" },
      { key: "ticari", label: "Ticari Şartlar" },
      { key: "fiyat", label: "Fiyat" },
      { key: "notlar", label: "Notlar" },
      { key: "kapsam", label: "Kapsam Dışı" },
    ],
    [payload.items]
  );

  const gizliSayisi = hiddenCount(payload);
  const toplam = offerTotal(payload.pricing.lines);

  function kaydet(sonra?: () => void) {
    startTransition(async () => {
      const res = await saveOfferRevision(offerId, revisionId, {
        payload: payload as unknown as Record<string, unknown>,
        notes: "",
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setKirli(false);
      toast.success("Teklif kaydedildi.");
      sonra?.();
    });
  }

  function yayimlaVeIndir() {
    kaydet(() =>
      startTransition(async () => {
        const res = await issueOfferRevision(offerId, revisionId);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (res.warning) toast.warning(res.warning);
        else toast.success("Teklif yayımlandı ve arşivlendi.");
        window.location.href = `/offers/${offerId}/revisions/${revisionId}/pdf`;
      })
    );
  }

  return (
    // KAYDIRMA KABI BURADA KURULUR (bkz. page.tsx'teki gerekçe): `lg` üstünde
    // üst şerit ve bölüm rayı SABİT kalır, yalnız bölüm gövdesi kayar — uzun
    // bir belgede kaydet düğmesinin ekrandan çıkmaması istenen davranıştır.
    // `lg` altında kap devreye girmez, sayfa normal biçimde kayar.
    //
    // `lg:flex-1`, `lg:h-full` DEĞİL: kardeşi (`PageHeader`) portallandığı için
    // kimi bağlamda hiç DOM düğümü bırakmaz, kimi bağlamda (dev önizleme)
    // bırakır. `flex-1` ikisinde de kalan yüksekliği alır; `h-full` ikincisinde
    // kabı taşırırdı.
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      {/* ————————————————————————————————————————————— üst şerit */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <div className="min-w-0">
          <div className="font-mono text-sm">{offerDocLine(offerNo, revNo)}</div>
          <div className="text-xs text-muted-foreground">
            {payload.items.length} kalem · {payload.pricing.lines.length} fiyat satırı
            {gizliSayisi > 0 ? ` · ${gizliSayisi} gizli satır` : ""}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm">
            {toplam === null ? "—" : fmtMoney(toplam, payload.pricing.currency || currency)}
          </span>
          <Button type="button" variant="outline" className="oc-tap" onClick={() => setOnizleme(true)}>
            <Eye className="size-4" /> Önizle
          </Button>
          <Button asChild variant="outline" className="oc-tap">
            <a href={`/offers/${offerId}/revisions/${revisionId}/pdf`}>
              <Download className="size-4" /> PDF İndir
            </a>
          </Button>
          {readOnly ? null : (
            <>
              <Button type="button" onClick={() => kaydet()} disabled={pending || !kirli} className="oc-tap">
                <Save className="size-4" /> {kirli ? "Kaydet" : "Kayıtlı"}
              </Button>
              <Button
                type="button"
                variant="default"
                className="oc-tap"
                disabled={pending}
                onClick={yayimlaVeIndir}
                title="Kaydeder, revizyonu kilitler ve gönderim tarihini bugüne çeker"
              >
                <Send className="size-4" /> PDF İndir ve Yayımla
              </Button>
            </>
          )}
        </div>
      </div>

      {readOnly ? (
        <p className="shrink-0 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Bu revizyon yayımlanmıştır ve değiştirilemez. Değişiklik için teklif
          panelinden <span className="font-medium">Yeni Revizyon</span> açın.
          Yanlışlıkla yayımlandıysa yönetici aynı panelden{" "}
          <span className="font-medium">Geri Çek</span> ile taslağa alabilir.
        </p>
      ) : null}

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[13rem_minmax(0,1fr)]">
        {/* ————————————————————————————————————————————— bölüm rayı */}
        <nav
          className="flex gap-1 overflow-x-auto lg:min-h-0 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto"
          aria-label="Teklif bölümleri"
        >
          {bolumler.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setAktif(b.key)}
              aria-current={aktif === b.key ? "page" : undefined}
              className={cn(
                "oc-tap shrink-0 rounded-md border-b-2 px-3 py-2 text-left text-sm transition-colors lg:border-b-0 lg:border-l-2",
                aktif === b.key
                  ? "border-b-primary bg-muted font-medium text-foreground lg:border-l-primary"
                  : "border-b-transparent text-muted-foreground hover:bg-muted hover:text-foreground lg:border-l-transparent"
              )}
            >
              <span className="line-clamp-1">{b.label}</span>
            </button>
          ))}
          {readOnly ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="oc-tap shrink-0 justify-start"
              onClick={() => setKalemEkle(true)}
            >
              <Plus className="size-3.5" /> Kalem Ekle
            </Button>
          )}
        </nav>

        {/* ————————————————————————————————————————————— bölüm gövdesi */}
        <div
          className={cn(
            "grid content-start gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:pb-4",
            readOnly && "pointer-events-none opacity-70"
          )}
        >
          {aktif === "kapak" ? (
            <KapakEditor
              payload={payload}
              listesi={listesi}
              contacts={contacts}
              authors={authors}
              onChange={guncelle}
            />
          ) : null}

          {payload.items.map((item, i) =>
            aktif === `item:${item.id}` ? (
              <ItemEditor
                key={item.id}
                item={item}
                book={book}
                craneTypes={listesi("val.craneType")}
                onChange={(next) =>
                  guncelle({ ...payload, items: payload.items.map((x, j) => (j === i ? next : x)) })
                }
                onRemove={() => {
                  guncelle({
                    ...payload,
                    items: payload.items.filter((x) => x.id !== item.id),
                    // Kaleme bağlı fiyat satırları YETİM KALMAZ: bağ kopar,
                    // satır serbest satıra döner. Silinselerdi kullanıcının
                    // girdiği fiyat sessizce kaybolurdu.
                    pricing: {
                      ...payload.pricing,
                      lines: payload.pricing.lines.map((l) =>
                        l.itemId === item.id ? { ...l, itemId: null } : l
                      ),
                    },
                  });
                  setAktif("kapak");
                }}
              />
            ) : null
          )}

          {aktif === "test" ? (
            <TestYukuEditor payload={payload} book={book} onChange={guncelle} />
          ) : null}

          {aktif === "ticari" ? (
            <TicariEditor payload={payload} book={book} listesi={listesi} onChange={guncelle} />
          ) : null}

          {aktif === "fiyat" ? (
            <FiyatEditor payload={payload} listesi={listesi} onChange={guncelle} />
          ) : null}

          {aktif === "notlar" ? (
            <MetinListesi
              baslik="NOTLAR"
              aciklama="Defterden tik atarak seçin; belgenin sonunda, fiyat tablosunun altında basılır."
              listKey="term.note"
              satirlar={payload.notes}
              oneriler={listesi("term.note")}
              onChange={(fn) => guncelleIle((p) => ({ ...p, notes: fn(p.notes) }))}
            />
          ) : null}

          {aktif === "kapsam" ? (
            <MetinListesi
              baslik="KAPSAM DIŞI İŞLER"
              aciklama="Defterden tik atarak seçin; belgede madde işaretli liste olarak basılır."
              listKey="term.exclusion"
              satirlar={payload.exclusions}
              oneriler={listesi("term.exclusion")}
              onChange={(fn) => guncelleIle((p) => ({ ...p, exclusions: fn(p.exclusions) }))}
            />
          ) : null}
        </div>
      </div>

      {kalemEkle ? (
        <KalemEkleDialog
          templates={templates}
          kaynak={payload.items[0]}
          sira={payload.items.length + 1}
          onClose={() => setKalemEkle(false)}
          onEkle={(item) => {
            guncelleIle((p) => ({ ...p, items: [...p.items, item] }));
            setAktif(`item:${item.id}`);
            setKalemEkle(false);
          }}
        />
      ) : null}

      {onizleme ? (
        <Dialog open onOpenChange={(o) => !o && setOnizleme(false)}>
          <DialogContent className="max-w-[min(64rem,95vw)] sm:max-w-[min(64rem,95vw)]">
            <DialogHeader>
              <DialogTitle>Teklif Önizleme</DialogTitle>
              <DialogDescription>
                {kirli
                  ? "Kaydedilmemiş değişiklikler var — önizleme SON KAYDEDİLEN hâli gösterir."
                  : offerDocLine(offerNo, revNo)}
              </DialogDescription>
            </DialogHeader>
            <iframe
              src={`/offers/${offerId}/revisions/${revisionId}/pdf?inline=1`}
              title="Teklif PDF önizleme"
              className="h-[70dvh] w-full rounded-md border bg-muted"
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

// ————————————————————————————————————————————————————————— kapak

function KapakEditor({
  payload,
  listesi,
  contacts,
  authors,
  onChange,
}: {
  payload: OfferPayload;
  listesi: (key: string) => string[];
  contacts: readonly CustomerContact[];
  authors: readonly OfferAuthor[];
  onChange: (next: OfferPayload) => void;
}) {
  const c = payload.cover;
  const set = (patch: Partial<typeof c>) => onChange({ ...payload, cover: { ...c, ...patch } });
  const kisiler = activeContacts(contacts);
  const ekler = listesi("cover.honorific");

  return (
    <div className="grid gap-4">
      <Bolum baslik="KİMDEN" aciklama="Teklifi hazırlayan; kapağın sol sütununda basılır.">
        {/*
          HAZIRLAYAN DEFTERDEN SEÇİLİR (kullanıcı isteği, 17.08.2026: *"KİMDEN
          kısmı bizim kullanıcılardan dropdown seçmeli gelsin, yönetici ve
          müdürler"*). Küme teklif bölümünü GÖREBİLEN rollerdir — ikinci bir
          rol listesi yazmak yetkiyi iki yerden sordurmak olurdu (ROL-15).
          Alanlar seçimden SONRA da düzenlenebilir: belge basıldığı andaki
          bilginin fotoğrafıdır.
        */}
        {authors.length > 0 ? (
          <div className="mb-3 grid max-w-md gap-1.5">
            <Label htmlFor="kapak_hazirlayan">Defterden hazırlayan seç</Label>
            <Select
              value={authors.find((a) => a.name === c.fromName)?.id ?? "__none__"}
              onValueChange={(id) => {
                const kisi = authors.find((a) => a.id === id);
                if (kisi) set({ fromName: kisi.name, fromTitle: kisi.title });
              }}
            >
              <SelectTrigger id="kapak_hazirlayan" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" disabled>
                  Kişi seçin
                </SelectItem>
                {authors.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.title ? ` — ${a.title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <Alan etiket="Adı ve Soyadı" value={c.fromName} onChange={(v) => set({ fromName: v })} />
          <Alan etiket="Unvan" value={c.fromTitle} onChange={(v) => set({ fromTitle: v })} />
          <Alan etiket="E-posta" value={c.fromEmail} onChange={(v) => set({ fromEmail: v })} />
        </div>
      </Bolum>

      <Bolum
        baslik="KİME"
        aciklama="Muhatap; boş bırakılan satır belgeye HİÇ basılmaz."
      >
        {/*
          MUHATAP DEFTERDEN SEÇİLİR (kullanıcı isteği, 17.08.2026): müşterinin
          birden çok iletişim kişisi olabilir ve teklifte kişi adı geçer.
          Seçim ad, bölüm ve telefonu birlikte doldurur; hitap cümlesi de
          onunla kurulur. Alanlar SONRADAN DÜZENLENEBİLİR kalır — belge,
          basıldığı andaki bilginin fotoğrafıdır.
        */}
        {kisiler.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="grid min-w-[14rem] flex-1 gap-1.5">
              <Label htmlFor="kapak_muhatap">Defterden muhatap seç</Label>
              <Select
                value={kisiler.find((k) => k.name === c.toName)?.id ?? "__none__"}
                onValueChange={(id) => {
                  const kisi = kisiler.find((k) => k.id === id);
                  if (!kisi) return;
                  set({
                    ...coverFieldsFromContact(kisi),
                    greeting: greetingFor(kisi.name, ekler[0] ?? ""),
                  });
                }}
              >
                <SelectTrigger id="kapak_muhatap" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" disabled>
                    Kişi seçin
                  </SelectItem>
                  {kisiler.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                      {k.title ? ` — ${k.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Kişi defteri Yönetim → Müşteriler ekranındadır.
            </p>
          </div>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">
            Bu müşterinin defterinde iletişim kişisi yok. Yönetim → Müşteriler
            ekranından ekleyebilir, sonraki tekliflerde listeden seçebilirsiniz.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Alan etiket="Adı ve Soyadı" value={c.toName} onChange={(v) => set({ toName: v })} />
          <Alan etiket="Bölüm" value={c.toDept} onChange={(v) => set({ toDept: v })} />
          <Alan etiket="Telefon" value={c.toPhone} onChange={(v) => set({ toPhone: v })} />
          <Alan
            etiket="Müşteri Referansı"
            value={c.customerRef}
            onChange={(v) => set({ customerRef: v })}
          />
        </div>
      </Bolum>

      <Bolum baslik="HİTAP VE GİRİŞ">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Hitap</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={c.greeting}
                onChange={(e) => set({ greeting: e.target.value })}
                aria-label="Hitap satırı"
                className="min-w-[14rem] flex-1 text-base pointer-fine:text-sm"
              />
              {/*
                HİTAP EKİ TAHMİN EDİLMEZ. Addan cinsiyet çıkarmak yanlış
                yazılmış bir hitap üretir ve bu, kapağın en görünür satırıdır.
                Kullanıcı eki seçer, cümleyi uygulama kurar.
              */}
              {ekler.map((ek) => (
                <Button
                  key={ek}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="oc-tap"
                  onClick={() => set({ greeting: `Sn. ${c.toName} ${ek}`.replace(/\s+/g, " ").trim() })}
                >
                  {ek}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Giriş Paragrafı</Label>
            <EditableCombobox
              options={listesi("cover.intro")}
              value={c.intro}
              onChange={(v) => set({ intro: v })}
              aria-label="Giriş paragrafı"
              inputClassName="text-base pointer-fine:text-sm"
            />
          </div>
        </div>
      </Bolum>

      <Bolum baslik="İMZALAR" aciklama="Kapağın altında yan yana basılır.">
        <div className="grid gap-2">
          {c.signatories.map((s, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <Alan
                etiket="Ad Soyad"
                value={s.name}
                onChange={(v) =>
                  set({
                    signatories: c.signatories.map((x, j) => (j === i ? { ...x, name: v } : x)),
                  })
                }
              />
              <Alan
                etiket="Unvan"
                value={s.title}
                onChange={(v) =>
                  set({
                    signatories: c.signatories.map((x, j) => (j === i ? { ...x, title: v } : x)),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="oc-tap text-destructive hover:text-destructive"
                onClick={() => set({ signatories: c.signatories.filter((_, j) => j !== i) })}
                aria-label="İmzayı kaldır"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="oc-tap"
              onClick={() => set({ signatories: [...c.signatories, { name: "", title: "" }] })}
            >
              <Plus className="size-3.5" /> İmza Ekle
            </Button>
          </div>
        </div>
      </Bolum>

      <Bolum baslik="KAPAK GÖRÜNÜRLÜĞÜ">
        <Button
          type="button"
          variant="outline"
          className="oc-tap"
          onClick={() => onChange({ ...payload, cover: { ...c, hidden: !c.hidden } })}
        >
          {c.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {c.hidden ? "Kapak gizli — belgeye girmiyor" : "Kapağı gizle"}
        </Button>
      </Bolum>
    </div>
  );
}

// ————————————————————————————————————————————————————— test yükü

function TestYukuEditor({
  payload,
  book,
  onChange,
}: {
  payload: OfferPayload;
  book: OptionBook;
  onChange: (next: OfferPayload) => void;
}) {
  const t = payload.testLoad;
  return (
    <Bolum baslik="TEST YÜKÜ" aciklama="Belgede TS 10116 atfıyla basılır.">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="oc-tap"
            onClick={() => onChange({ ...payload, testLoad: { ...t, enabled: !t.enabled } })}
          >
            {t.enabled ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            {t.enabled ? "Belgede var" : "Belgede yok"}
          </Button>
          <div className="grid gap-1.5">
            <Label>Konum</Label>
            <Select
              value={t.position}
              onValueChange={(v) =>
                onChange({ ...payload, testLoad: { ...t, position: v as "teknik" | "ticari" } })
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teknik">Teknik sayfaların sonunda</SelectItem>
                <SelectItem value="ticari">Ticari şartların üstünde</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          {t.rows.map((row, i) => (
            <RowEditor
              key={`${row.key}-${i}`}
              groupKey={TEST_LOAD_GROUP_KEY}
              row={row}
              book={book}
              onChange={(next) =>
                onChange({
                  ...payload,
                  testLoad: { ...t, rows: t.rows.map((r, j) => (j === i ? next : r)) },
                })
              }
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Defterdeki satırlar: {TEST_LOAD_ROW_DEFS.map((r) => r.label).join(" · ")}
        </p>
      </div>
    </Bolum>
  );
}

// ————————————————————————————————————————————————————— ticari

function TicariEditor({
  payload,
  book,
  listesi,
  onChange,
}: {
  payload: OfferPayload;
  book: OptionBook;
  listesi: (key: string) => string[];
  onChange: (next: OfferPayload) => void;
}) {
  const t = payload.terms;
  const setRows = (rows: OfferRow[]) => onChange({ ...payload, terms: { ...t, rows } });

  return (
    <div className="grid gap-4">
      <Bolum
        baslik={t.title}
        aciklama="Belgede künye olarak basılır; boş bırakılan satır hiç görünmez."
      >
        <div className="grid gap-2">
          {t.rows.map((row, i) => (
            <RowEditor
              key={`${row.key}-${i}`}
              groupKey={TERMS_GROUP_KEY}
              row={row}
              book={book}
              onChange={(next) => setRows(t.rows.map((r, j) => (j === i ? next : r)))}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Defterdeki satırlar: {TERM_ROW_DEFS.map((r) => r.label).join(" · ")}
        </p>
      </Bolum>

      <Bolum
        baslik="ÖDEME PLANI"
        aciklama="Ödeme satırının hemen altında, girintili olarak basılır."
      >
        {/*
          YÜZDE VE AÇIKLAMA AYRI KUTULAR (kullanıcı isteği, 17.08.2026: *"4 kutu
          yaptıysam %30 %30 %20 %20 seçeyim, toplamı kesin %100 olsun; kutuların
          yanında bir tane daha kutu olsun, oraya açıklamasını seçeyim"*).
          Basılan metin ikisinden DERLENİR (`paymentLineText`).

          TOPLAM ZORLANMAZ, GÖSTERİLİR: kullanıcı planı yazarken ara adımlarda
          toplam kaçınılmaz olarak 100'den farklıdır ve kaydetmeyi engellemek
          onu düzenlerken kilitlerdi. Ayrıca yüzdesiz satır MEŞRUDUR —
          devralınan tekliflerde "Montaj Sonrası Kalan Nakit" gibi satırlar var.
        */}
        <div className="grid gap-2">
          {t.paymentLines.map((line, i) => {
            const guncelleSatir = (patch: Partial<typeof line>) =>
              onChange({
                ...payload,
                terms: {
                  ...t,
                  paymentLines: t.paymentLines.map((x, j) => {
                    if (j !== i) return x;
                    const next = { ...x, ...patch };
                    return { ...next, text: paymentLineText(next) };
                  }),
                },
              });
            return (
              <div
                key={line.id}
                className={cn(
                  "grid gap-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto_auto] sm:items-center",
                  line.hidden && "opacity-55"
                )}
              >
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">%</span>
                  <Input
                    value={line.percent ?? ""}
                    inputMode="decimal"
                    onChange={(e) => guncelleSatir({ percent: sayiVeyaNull(e.target.value) })}
                    aria-label={`Ödeme satırı ${i + 1} yüzdesi`}
                    className="h-9 text-base pointer-fine:text-sm"
                  />
                </div>
                <EditableCombobox
                  options={listesi("term.paymentLine")}
                  value={line.desc ?? ""}
                  onChange={(v) => guncelleSatir({ desc: v })}
                  aria-label={`Ödeme satırı ${i + 1} açıklaması`}
                  className="min-w-0"
                  inputClassName="text-base pointer-fine:text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="oc-tap"
                  aria-label={line.hidden ? "Belgede göster" : "Belgede gizle"}
                  onClick={() => guncelleSatir({ hidden: !line.hidden })}
                >
                  {line.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="oc-tap text-destructive hover:text-destructive"
                  aria-label="Ödeme satırını kaldır"
                  onClick={() =>
                    onChange({
                      ...payload,
                      terms: { ...t, paymentLines: t.paymentLines.filter((_, j) => j !== i) },
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
                <p className="font-mono text-xs text-muted-foreground sm:col-span-4">
                  {line.text || "—"}
                </p>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="oc-tap"
              onClick={() =>
                onChange({
                  ...payload,
                  terms: {
                    ...t,
                    paymentLines: [
                      ...t.paymentLines,
                      { id: newOfferId(), text: "", percent: null, desc: "" },
                    ],
                  },
                })
              }
            >
              <Plus className="size-3.5" /> Ödeme Satırı Ekle
            </Button>

            {(() => {
              const y = paymentPercentTotal(t.paymentLines);
              if (y.yuzdeli === 0 && y.yuzdesiz === 0) return null;
              return (
                <span
                  className={cn(
                    "text-sm",
                    y.tam ? "text-muted-foreground" : "font-medium text-destructive"
                  )}
                >
                  Toplam %{y.toplam}
                  {y.tam ? " — tamam" : " — %100 olmalı"}
                  {y.yuzdesiz > 0 ? ` · ${y.yuzdesiz} satır yüzdesiz` : ""}
                </span>
              );
            })()}
          </div>
        </div>
      </Bolum>
    </div>
  );
}

// ————————————————————————————————————————————————————— fiyat

function FiyatEditor({
  payload,
  listesi,
  onChange,
}: {
  payload: OfferPayload;
  listesi: (key: string) => string[];
  onChange: (next: OfferPayload) => void;
}) {
  const p = payload.pricing;
  const toplam = offerTotal(p.lines);

  function setLine(index: number, next: OfferPriceLine | null) {
    onChange({
      ...payload,
      pricing: {
        ...p,
        lines: next ? p.lines.map((l, i) => (i === index ? next : l)) : p.lines.filter((_, i) => i !== index),
      },
    });
  }

  return (
    <Bolum baslik="FİYAT" aciklama="Belgede tek şemalı bir tablo olarak basılır.">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid gap-1.5">
            <Label>Para Birimi</Label>
            <Select
              value={p.currency}
              onValueChange={(v) => onChange({ ...payload, pricing: { ...p, currency: v } })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["EUR", "USD", "TRY"].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            className="oc-tap self-end"
            onClick={() => onChange({ ...payload, pricing: { ...p, vatIncluded: !p.vatIncluded } })}
          >
            {vatNote(p.vatIncluded)}
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Tanımı</TableHead>
              <TableHead className="w-24">Kalem</TableHead>
              <TableHead className="w-20">Adet</TableHead>
              <TableHead className="w-28">Birim</TableHead>
              <TableHead className="w-32">Birim Fiyat</TableHead>
              <TableHead className="w-32 text-right">Tutar</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.lines.map((line, i) => (
              <TableRow key={line.id} className={cn(line.hidden && "opacity-55")}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <Input
                    value={line.description}
                    onChange={(e) => setLine(i, { ...line, description: e.target.value })}
                    aria-label="Kalem tanımı"
                    className="h-9 text-base pointer-fine:text-sm"
                  />
                </TableCell>
                <TableCell>
                  {/* FİYAT SATIRI KALEME KİMLİKLE BAĞLANIR: devralınan
                      tekliflerde bağ yalnız başlık metniyle kuruluyordu ve bir
                      belgede tonaj sütunu yanlış satıra düşmüştü. */}
                  <Select
                    value={line.itemId ?? "__none__"}
                    onValueChange={(v) => setLine(i, { ...line, itemId: v === "__none__" ? null : v })}
                  >
                    <SelectTrigger className="h-9 w-full" aria-label="Bağlı kalem">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Serbest</SelectItem>
                      {payload.items.map((it, j) => (
                        <SelectItem key={it.id} value={it.id}>
                          {it.title || `Kalem ${j + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={line.qty ?? ""}
                    inputMode="decimal"
                    onChange={(e) => setLine(i, { ...line, qty: sayiVeyaNull(e.target.value) })}
                    aria-label="Adet"
                    className="h-9 text-base pointer-fine:text-sm"
                  />
                </TableCell>
                <TableCell>
                  <EditableCombobox
                    options={listesi(PRICE_UNIT_LIST)}
                    value={line.unit}
                    onChange={(v) => setLine(i, { ...line, unit: v })}
                    aria-label="Birim"
                    inputClassName="h-9 text-base pointer-fine:text-sm"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={line.unitPrice ?? ""}
                    inputMode="decimal"
                    onChange={(e) => setLine(i, { ...line, unitPrice: sayiVeyaNull(e.target.value) })}
                    aria-label="Birim fiyat"
                    className="h-9 text-base pointer-fine:text-sm"
                  />
                </TableCell>
                <TableCell className="text-right font-mono">
                  {lineAmount(line) === null ? "—" : fmtMoney(lineAmount(line), p.currency)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <MiniDugme
                      baslik={line.inTotal ? "Toplama giriyor" : "Toplama GİRMİYOR"}
                      aktif={!line.inTotal}
                      onClick={() => setLine(i, { ...line, inTotal: !line.inTotal })}
                    >
                      Σ
                    </MiniDugme>
                    <MiniDugme
                      baslik={line.optional ? "Opsiyonel" : "Opsiyonel işaretle"}
                      aktif={line.optional === true}
                      onClick={() => setLine(i, { ...line, optional: !line.optional })}
                    >
                      Ops
                    </MiniDugme>
                    <MiniDugme
                      baslik={line.hidden ? "Belgede gizli" : "Belgede gizle"}
                      aktif={line.hidden === true}
                      onClick={() => setLine(i, { ...line, hidden: !line.hidden })}
                    >
                      {line.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </MiniDugme>
                    <MiniDugme baslik="Satırı sil" onClick={() => setLine(i, null)}>
                      <Trash2 className="size-3.5" />
                    </MiniDugme>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={6} className="text-right font-medium">
                TOPLAM
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {toplam === null ? "—" : fmtMoney(toplam, p.currency)}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="oc-tap"
            onClick={() => onChange({ ...payload, pricing: { ...p, lines: [...p.lines, newPriceLine()] } })}
          >
            <Plus className="size-3.5" /> Satır Ekle
          </Button>
          {payload.items.map((it, j) =>
            p.lines.some((l) => l.itemId === it.id) ? null : (
              <Button
                key={it.id}
                type="button"
                variant="ghost"
                size="sm"
                className="oc-tap"
                onClick={() =>
                  onChange({
                    ...payload,
                    pricing: {
                      ...p,
                      lines: [
                        ...p.lines,
                        { ...newPriceLine(it.id), description: it.title || `Kalem ${j + 1}` },
                      ],
                    },
                  })
                }
              >
                <Plus className="size-3.5" /> {it.title || `Kalem ${j + 1}`} için satır
              </Button>
            )
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Σ işaretli satır toplama girmez ve belgede dipnotla işaretlenir
          (günlük ücretli süpervizörlük gibi kalemler için).
        </p>
      </div>
    </Bolum>
  );
}

// ————————————————————————————————————————————————————— metin listesi

/**
 * ŞABLONDAN TİK ATARAK SEÇİLEN METİN LİSTESİ (notlar · kapsam dışı işler).
 *
 * Kullanıcı isteği (17.08.2026): *"Kapsam dışı olanlar da seçenekli gelsin ben
 * istediğimi seçeyim … hazır şablonlar yap. Ben tik atarak seçebileyim.
 * İstersem kendim ekleyebileyim. Eklediğim de kayıt altına alınsın sonra onu
 * da seçebileyim."*
 *
 * Üç bölgeden oluşur ve üçü de gerçek bir ihtiyaca karşılık gelir:
 *   1. DEFTER — firmanın on dört teklifinden derlenmiş maddeler; tik kutusu.
 *   2. BELGEYE ÖZEL — defterde karşılığı olmayan, bu teklife elle yazılmış
 *      maddeler. Ayrı durur çünkü tik listesinde görünmeleri, defterde varmış
 *      izlenimi verirdi.
 *   3. EKLEME — yazılan madde belgeye girer; "deftere de ekle" düğmesi ONU
 *      kalıcı yapar. Deftere yazmak belgeye eklemenin ŞARTI DEĞİLDİR
 *      (`YeniFirma` bileşeninin kuralı).
 *
 * SIRA TIKLAMA SIRASIDIR, defterin sırası değil: kullanıcı maddeleri önem
 * sırasına göre seçer ve belgede o sırayla görmek ister.
 */
function MetinListesi({
  baslik,
  aciklama,
  listKey,
  satirlar,
  oneriler,
  onChange,
}: {
  baslik: string;
  aciklama: string;
  /** Defter listesi anahtarı — elle eklenen madde buraya yazılır. */
  listKey: string;
  satirlar: OfferTextLine[];
  oneriler: string[];
  /**
   * GÜNCELLEME BİR FONKSİYONDUR, hazır bir dizi değil: iki tik aynı boyama
   * turunda gelirse ikincisi birincisini geri almamalıdır (bkz. `guncelleIle`).
   */
  onChange: (fn: (onceki: OfferTextLine[]) => OfferTextLine[]) => void;
}) {
  const [yeni, setYeni] = useState("");
  const [pending, startTransition] = useTransition();

  const secili = new Set(satirlar.map((s) => s.text.trim()));
  const serbest = satirlar.filter((s) => !oneriler.includes(s.text.trim()));

  function degistir(metin: string) {
    onChange((onceki) =>
      onceki.some((s) => s.text.trim() === metin)
        ? onceki.filter((s) => s.text.trim() !== metin)
        : [...onceki, newTextLine(metin)]
    );
  }

  function ekle(deftereDe: boolean) {
    const metin = yeni.trim();
    if (!metin) return;
    onChange((onceki) =>
      onceki.some((s) => s.text.trim() === metin) ? onceki : [...onceki, newTextLine(metin)]
    );
    setYeni("");
    if (!deftereDe) return;
    startTransition(async () => {
      const res = await ensureOfferOption({ listKey, value: metin, parentId: null });
      if (res.error) toast.error(res.error);
      else toast.success("Madde deftere eklendi — bundan sonra listede çıkacak.");
    });
  }

  return (
    <Bolum baslik={baslik} aciklama={aciklama}>
      <div className="grid gap-3">
        {/* ————— 1. DEFTER */}
        {oneriler.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Defter boş. Aşağıdan madde ekleyip &quot;deftere de ekle&quot; ile kalıcı yapabilirsiniz.
          </p>
        ) : (
          <ul className="grid gap-1">
            {oneriler.map((metin) => {
              const isaretli = secili.has(metin);
              return (
                <li key={metin}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isaretli}
                    onClick={() => degistir(metin)}
                    className={cn(
                      "oc-tap flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                      isaretli && "bg-muted/60"
                    )}
                  >
                    {/* Kare onay kutusu — çoklu süzgecin işaret diliyle aynı. */}
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] border",
                        isaretli ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                      )}
                    >
                      {isaretli ? <Check className="size-3" /> : null}
                    </span>
                    <span className={cn(!isaretli && "text-muted-foreground")}>{metin}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* ————— 2. BELGEYE ÖZEL */}
        {serbest.length > 0 ? (
          <div className="grid gap-2 rounded-md border border-dashed p-2">
            <p className="text-xs text-muted-foreground">
              Bu teklife özel maddeler — defterde karşılıkları yok.
            </p>
            {serbest.map((line) => {
              return (
                <div key={line.id} className="flex items-start gap-2">
                  <Textarea
                    value={line.text}
                    onChange={(e) =>
                      onChange((onceki) =>
                        onceki.map((x) => (x.id === line.id ? { ...x, text: e.target.value } : x))
                      )
                    }
                    aria-label={`${baslik} maddesi`}
                    rows={2}
                    className={cn(
                      "min-w-0 flex-1 text-base pointer-fine:text-sm",
                      line.hidden && "opacity-55"
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="oc-tap"
                    aria-label={line.hidden ? "Belgede göster" : "Belgede gizle"}
                    onClick={() =>
                      onChange((onceki) =>
                          onceki.map((x) => (x.id === line.id ? { ...x, hidden: !x.hidden } : x))
                        )
                    }
                  >
                    {line.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="oc-tap text-destructive hover:text-destructive"
                    aria-label="Maddeyi kaldır"
                    onClick={() => onChange((onceki) => onceki.filter((x) => x.id !== line.id))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* ————— 3. EKLEME */}
        <div className="grid gap-2">
          <Label htmlFor={`yeni_${listKey}`}>Yeni madde</Label>
          <Textarea
            id={`yeni_${listKey}`}
            value={yeni}
            onChange={(e) => setYeni(e.target.value)}
            rows={2}
            className="text-base pointer-fine:text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="oc-tap"
              disabled={!yeni.trim()}
              onClick={() => ekle(false)}
            >
              <Plus className="size-3.5" /> Yalnız bu teklife ekle
            </Button>
            <Button
              type="button"
              size="sm"
              className="oc-tap"
              disabled={!yeni.trim() || pending}
              onClick={() => ekle(true)}
            >
              <BookmarkPlus className="size-3.5" /> Ekle ve deftere kaydet
            </Button>
          </div>
        </div>
      </div>
    </Bolum>
  );
}

// ————————————————————————————————————————————————————————— ortaklar

function Bolum({
  baslik,
  aciklama,
  children,
}: {
  baslik: string;
  aciklama?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-lg border p-3">
      <header>
        <h2 className="text-sm font-semibold tracking-wide">{baslik}</h2>
        {aciklama ? <p className="text-xs text-muted-foreground">{aciklama}</p> : null}
      </header>
      {children}
    </section>
  );
}

function Alan({
  etiket,
  value,
  onChange,
  buyuk,
}: {
  etiket: string;
  value: string;
  onChange: (v: string) => void;
  buyuk?: boolean;
}) {
  return (
    <div className="grid min-w-[10rem] flex-1 gap-1.5">
      <Label>{etiket}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(buyuk ? adBuyuk(e.target.value) : e.target.value)}
        aria-label={etiket}
        className="text-base pointer-fine:text-sm"
      />
    </div>
  );
}

function MiniDugme({
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
        "oc-tap-square inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
        aktif && "bg-muted font-medium text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/** Boş kutu `null` üretir, `0` DEĞİL (SATIS-16). */
function sayiVeyaNull(raw: string): number | null {
  const s = raw.trim().replace(/\./g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
