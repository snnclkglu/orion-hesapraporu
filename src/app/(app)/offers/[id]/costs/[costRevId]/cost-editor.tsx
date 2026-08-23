"use client";

// MALİYET EDİTÖRÜ — teklifin İÇ yüzü, bölüm bölüm.
//
// Düzen teklif editörünün birebir kardeşidir (solda bölüm rayı, sağda bölüm
// gövdesi, üstte kaydet ve belge eylemleri) ve bu bilinçlidir: kullanıcı iki
// ekran arasında gidip gelecek, ikisinin aynı davranması gerekir. Yükseklik
// zinciri de aynı kuralla kurulur (TEKLIF-17): `lg:flex-1`, `lg:h-full`
// DEĞİL — `PageHeader` kabuğun şeridine portallanır ve sayfada kimi bağlamda
// hiç DOM düğümü bırakmaz.
//
// BÖLÜMLER KULLANICININ TARİFİDİR (17.08.2026): *"Maliyet içerisinde ayrıca
// bir sayfa Ağırlıklar, bir sayfada hesaplar olacak … bir sayfa maliyetler
// bir sayfa maliyet kırılımı."* Katsayılar altıncı bölüm olarak eklendi:
// modelin sayıları oradan geliyor ve nereden geldiği görünmeyen bir model
// güvenilmez olur.
//
// KIRILIM ARTIK AYRI BİR BÖLÜM DEĞİLDİR (kullanıcı isteği 18.08.2026, md. 8:
// *"Maliyetler ve Kırılım sayfasını birleştirelim"*): maliyetler sayfasının
// altında, aynı kaydırmada durur. Beş bölüm kaldı.
//
// YAYIMLANMIŞ MALİYET SALT OKUNURDUR. Kilit veritabanındaki tetikleyicidedir
// (`guard_issued_offer_cost`); buradaki `readOnly` yalnız görgü kuralıdır.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, FileText, RefreshCw, RotateCcw, Save, Send, Sheet, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fmtMoney0 } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { costModels, costSteelWeights, costWeights, withCostDerived } from "@/lib/offers/cost/payload";
import { costOverview, costTotals } from "@/lib/offers/cost/totals";
import type { CostItem, CostPayload } from "@/lib/offers/cost/types";
import { fmtCostField } from "@/lib/offers/cost/labels";
import type { OfferPayload } from "@/lib/offers/types";
import {
  issueOfferCostRevision,
  saveOfferCostRevision,
  syncOfferCostFromOffer,
} from "@/app/(app)/offers/cost-actions";
import { Bolum, MiniDugme, type Katlama } from "./cost-parts";
import { AgirlikSayfasi, HesapSayfasi, KatsayiSayfasi } from "./model-view";
import { MaliyetSayfasi } from "./lines-view";
import { KirilimSayfasi } from "./breakdown-view";
import { OzetSayfasi } from "./overview-view";

const BOLUMLER = [
  // ÖZET EN BAŞTA: kullanıcı maliyeti kalem kalem çalışıyor ama karara BÜTÜNE
  // bakarak varıyor (kullanıcı isteği 19.08.2026, md. 13). Sayfa kalem seçici
  // taşımaz — sorusu "bu vinç ne tutuyor" değil, "bu teklif ne tutuyor".
  { key: "ozet", label: "Özet", kalemli: false },
  { key: "agirlik", label: "Ağırlıklar", kalemli: true },
  { key: "hesap", label: "Hesaplar", kalemli: true },
  { key: "maliyet", label: "Maliyetler", kalemli: true },
  { key: "katsayi", label: "Katsayılar", kalemli: false },
  { key: "not", label: "Notlar", kalemli: false },
] as const;

/**
 * ÜST ŞERİDİN SAYI KUTUSU — soft tonlu, tek satır.
 *
 * `.oc-fieldgroup` sözleşmesi (MALIYET-43): veri yalnız TON AÇISINI taşır,
 * doygunluk ve parlaklık `globals.css`te ve TEMA BAŞINA verilir. Elle hex
 * yazmak değişmez md. 6'yı kırardı.
 *
 * RENK TEK TAŞIYICI DEĞİLDİR: her kutunun başlığı ayrıca YAZIYLA durur
 * ("Maliyet" · "Teklif" · "Kâr") — renk yalnız gözü hızlandırır.
 */
function TutarKutusu({
  baslik,
  tutar,
  currency,
  ton,
  alt,
}: {
  baslik: string;
  tutar: number | null;
  currency: string;
  ton: number;
  /** İkinci satır — kâr kutusunda satış üzerinden yüzde. */
  alt?: string;
}) {
  const tonStili = { "--oc-hue": `${ton}` } as React.CSSProperties;
  return (
    <div className="oc-fieldgroup rounded-md py-1 pr-2.5 pl-2" style={tonStili}>
      <div
        className="oc-fieldgroup-title text-[10px] font-semibold tracking-wide uppercase"
        style={tonStili}
      >
        {baslik}
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums">
        {tutar === null ? "—" : fmtMoney0(tutar, currency)}
      </div>
      {alt ? <div className="text-[10px] text-muted-foreground">{alt}</div> : null}
    </div>
  );
}

export function CostEditor({
  offerId,
  offerNo,
  costRevId,
  costRevNo,
  offerRevNo,
  offerRevisionId,
  readOnly,
  initial,
  offer,
}: {
  offerId: string;
  offerNo: string;
  costRevId: string;
  costRevNo: number;
  /** Teklifin GÜNCEL revizyon numarası — maliyetin kurulduğuyla karşılaştırılır. */
  offerRevNo: number | null;
  /** Teklif editörüne geçiş bağlantısı; teklifin hiç revizyonu yoksa `null`. */
  offerRevisionId: string | null;
  readOnly: boolean;
  initial: CostPayload;
  offer: OfferPayload;
}) {
  // BELGE HER ZAMAN TÜRETİLMİŞ DURUR (`withCostDerived`): model miktarları ve
  // hammadde şeridinin fiyatları satırlara YAZILI olur, toplamlar da öyle.
  //
  // Ekranda çözüp belgeye yazmamak daha az iş olurdu ve bir şeyi bozardı:
  // hammadde şeridinden sac fiyatını değiştiren kullanıcı grup toplamının
  // değiştiğini görür ama PROJE MALİYETİ satırı eski kalırdı — çünkü toplam
  // (`costTotals`) saf aritmetiktir, şeridi okumaz. İki farklı toplamın aynı
  // ekranda dolaşması, hangisinin belgeye gideceğini ekrana bakarak
  // anlaşılmaz yapardı. Sunucudaki kaydetme yolu da aynı fonksiyonu çağırır
  // (`saveOfferCostRevision`), yani ekran ile belge tanım gereği aynıdır.
  const [payload, setPayload] = useState<CostPayload>(() => withCostDerived(initial));
  const [kirli, setKirli] = useState(false);
  const [aktif, setAktif] = useState<string>("agirlik");
  const [kalemId, setKalemId] = useState<string>(initial.items[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  /**
   * KATLANMIŞ BÖLÜMLER (kullanıcı isteği 18.08.2026, md. 6).
   *
   * Durum EDİTÖRDE durur, bölüm bileşenlerinde değil: `MaliyetSayfasi` bölüm
   * değiştirilince sökülür ve katlama her dönüşte sıfırlanırdı. Belgeye de
   * yazılmaz — bir görünüm tercihi maliyet belgesinin içeriği değildir
   * (yayımlanmış bir maliyette bölüm katlanamaz hâle gelirdi).
   */
  const [katliBolumler, setKatliBolumler] = useState<ReadonlySet<string>>(new Set());
  const katlama: Katlama = {
    kapali: (anahtar) => katliBolumler.has(anahtar),
    degistir: (anahtar) =>
      setKatliBolumler((onceki) => {
        const next = new Set(onceki);
        if (next.has(anahtar)) next.delete(anahtar);
        else next.add(anahtar);
        return next;
      }),
  };

  /**
   * BİR ÖNCEKİ HÂLDEN türeten güncelleme (TEKLIF-16'nın `guncelleIle`si).
   * İki değişiklik aynı boyama turunda gelirse ikincisi birincisini SESSİZCE
   * geri almamalıdır — bir belge editöründe bu, girilenin kaybolması demektir.
   */
  function guncelle(fn: (onceki: CostPayload) => CostPayload) {
    setPayload((onceki) => withCostDerived(fn(onceki)));
    setKirli(true);
  }

  const models = useMemo(() => costModels(payload), [payload]);
  const weights = useMemo(() => costWeights(models), [models]);
  const totals = useMemo(() => costTotals(payload, weights), [payload, weights]);
  // ÖZET SAF ÇEKİRDEKTEN GELİR: ekran tek bir toplam bile kendi hesaplamaz.
  const overview = useMemo(
    () => costOverview(totals, offer, costSteelWeights(models), payload),
    [totals, offer, models, payload]
  );

  const item = payload.items.find((i) => i.id === kalemId) ?? payload.items[0];
  const bolum = BOLUMLER.find((b) => b.key === aktif) ?? BOLUMLER[0];

  const setItem = (next: CostItem) =>
    guncelle((p) => ({ ...p, items: p.items.map((x) => (x.id === next.id ? next : x)) }));

  /**
   * KALEMİ MALİYETTEN ÇIKARIR (kullanıcı isteği 18.08.2026, md. 1).
   *
   * Teklif bağı varsa kimliği `removedOfferItemIds`e YAZILIR: tazeleme
   * ekleyicidir ve yazılmasaydı silinen kalem ilk "Tekliften Tazele"de geri
   * gelirdi. Karar geri alınabilir kalır — şeridin altındaki satır bunu söyler.
   */
  function kalemiCikar(hedef: CostItem) {
    const ad = hedef.title || "Bu kalem";
    if (!window.confirm(`${ad} maliyetten çıkarılacak. Girilen bütün birim fiyatları silinir. Devam edilsin mi?`)) return;
    guncelle((p) => {
      const kalanlar = p.items.filter((x) => x.id !== hedef.id);
      return {
        ...p,
        items: kalanlar,
        removedOfferItemIds: hedef.offerItemId
          ? [...new Set([...p.removedOfferItemIds, hedef.offerItemId])]
          : p.removedOfferItemIds,
      };
    });
    setKalemId((onceki) => (onceki === hedef.id ? "" : onceki));
  }

  /** Çıkarma kararını geri alır; kalem bir sonraki tazelemede geri gelir. */
  function cikarmayiGeriAl() {
    guncelle((p) => ({ ...p, removedOfferItemIds: [] }));
  }

  function kaydet(sonra?: () => void) {
    startTransition(async () => {
      const res = await saveOfferCostRevision(offerId, costRevId, {
        payload: payload as unknown as Record<string, unknown>,
        notes: "",
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setKirli(false);
      toast.success("Maliyet kaydedildi.");
      sonra?.();
    });
  }

  function tekliftenTazele() {
    startTransition(async () => {
      // ÖNCE KAYDET: tazeleme sunucuda çalışır ve kaydedilmemiş düzenlemeler
      // sunucudaki hâlin üstüne yazılırdı. Sıra tersine dönerse kullanıcı
      // ekranda gördüğü değişikliği kaybeder.
      if (kirli) {
        const kayit = await saveOfferCostRevision(offerId, costRevId, {
          payload: payload as unknown as Record<string, unknown>,
          notes: "",
        });
        if (kayit.error) {
          toast.error(kayit.error);
          return;
        }
        setKirli(false);
      }
      const res = await syncOfferCostFromOffer(offerId, costRevId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const parcalar = [
        res.eklenen ? `${res.eklenen} kalem eklendi` : null,
        res.yetim ? `${res.yetim} kalemin teklif bağı koptu` : null,
      ].filter(Boolean);
      toast.success(parcalar.length ? parcalar.join(" · ") : "Maliyet teklifle eşitlendi.");
      // Sunucu payload'ı değiştirdi; ekranın onu geri okuması gerekir.
      window.location.reload();
    });
  }

  function yayimlaVeIndir() {
    kaydet(() =>
      startTransition(async () => {
        const res = await issueOfferCostRevision(offerId, costRevId);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        if (res.warning) toast.warning(res.warning);
        else toast.success("Maliyet yayımlandı ve arşivlendi.");
        window.location.href = `/offers/${offerId}/costs/${costRevId}/pdf`;
      })
    );
  }

  const geride =
    payload.sourceRevNo !== null && offerRevNo !== null && payload.sourceRevNo !== offerRevNo;

  return (
    <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1">
      {/* ————————————————————————————————————————————— üst şerit */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <div className="min-w-0">
          <div className="font-mono text-sm">
            {offerNo} · MALİYET M{costRevNo}
          </div>
          <div className="text-xs text-muted-foreground">
            {payload.items.length} kalem
            {/* EK "R0'a mı R1'e mi" DİYE SORDURMAZ: Türkçe ünlü uyumu sayıya
                göre değişir (sıfır→a, bir→e, iki→ye). Ek "revizyon"un üstüne
                konur ve bütün numaralarda aynı kalır. */}
            {payload.sourceRevNo === null
              ? ""
              : ` · teklifin R${payload.sourceRevNo} revizyonuna göre`}
          </div>
        </div>

        {/* TEKLİF ↔ MALİYET GEÇİŞİ. Kullanıcı isteği (17.08.2026): *"teklifin
            içine girildiğinde sayfa ikiye ayrılacak."* İki ekran ayrı
            adreslerdedir (ayrı revizyon zincirleri) ama geçiş tek tıktır. */}
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {offerRevisionId ? (
            <Button asChild variant="ghost" size="sm" className="oc-tap">
              <Link href={`/offers/${offerId}/revisions/${offerRevisionId}`}>
                <FileText className="size-3.5" /> Teklif
              </Link>
            </Button>
          ) : null}
          <span className="oc-tap inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-sm font-medium">
            <Wallet className="size-3.5" /> Maliyet
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* ÜST ŞERİDİN ÜÇ SAYISI — BELGENİN TAMAMI, bir vincin değil.
              Kullanıcı bildirimi (23.08.2026, md. 2): *"Üstte maliyet kâr ve %
              yazan yerdeki değer sadece vincin değil o teklifteki kalemlerin
              tamamının maliyeti olsun … Ayrıca bunun yanına bir kutuda eğer
              oluşturulmuşsa teklif fiyatı da yazmalı."*

              Şerit bugüne kadar `costTotals.total`i basıyordu: MALİYET
              BELGESİNİN toplamı, yani teklifin serbest fiyat satırlarına
              yazılan maliyetler HARİÇ (MALIYET-11). Aynı ekranın Özet bölümü
              ise `costOverview.margin.cost`u gösteriyordu — iki sayı, tek
              ekran. Kâr da bu yüzden yanlış tabandan hesaplanıyordu ve teklif
              tutarını `pricing.total`dan okuyordu, yani İSKONTOYU görmüyordu.
              Üçü de artık `overview.margin`den gelir (MALIYET-29).

              RENK ÜÇÜNÜ AYIRIR (aynı madde: *"her şeyin aynı renk olması
              anlaşılırlığı azaltıyor. Maliyetler sayfasındaki gibi soft
              renklendirme iyi olur."*) — Maliyetler sayfasının grup
              başlıklarıyla AYNI sözleşme (`.oc-fieldgroup`, MALIYET-43): ton
              bir AÇIDIR, doygunluk ve parlaklık temadan gelir. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <TutarKutusu baslik="Maliyet" tutar={overview.margin.cost} currency={payload.currency} ton={25} />
            {/* TEKLİF KUTUSU YALNIZ FİYAT VARSA ÇİZİLİR: *"eğer oluşturulmuşsa"*.
                Fiyatsız bir maliyet çalışması meşrudur (önce maliyet, sonra
                fiyat) ve orada boş bir kutu "fiyat sıfır" diye okunurdu. */}
            {overview.margin.price === null ? null : (
              <TutarKutusu
                baslik="Teklif"
                tutar={overview.margin.price}
                currency={payload.currency}
                ton={255}
              />
            )}
            <TutarKutusu
              baslik="Kâr"
              tutar={overview.margin.profit}
              currency={payload.currency}
              // TON VERİDEN GELİR: zarar eden bir teklif yeşil görünmemelidir.
              ton={overview.margin.profit !== null && overview.margin.profit < 0 ? 25 : 150}
              alt={
                overview.margin.marginPercent === null
                  ? undefined
                  : `satışın %${fmtCostField(overview.margin.marginPercent, 0)}`
              }
            />
          </div>
          <Button asChild variant="outline" className="oc-tap">
            <a href={`/offers/${offerId}/costs/${costRevId}/pdf`}>
              <Download className="size-4" /> Maliyet İndir
            </a>
          </Button>
          {/* EXCEL, PDF'İN YANINDA (kullanıcı isteği 19.08.2026, md. 11). İkisi
              aynı veriden üretilir ama iki ayrı soruya cevap verir: PDF
              okunacak bir BELGEDİR (arşive girer, damgası vardır), Excel ise
              üzerinde ÇALIŞILACAK bir çizelgedir — hücreler sayıdır, toplanır.
              `download` niteliği YOK: dosya adını uç `Content-Disposition` ile
              verir; burada ikinci bir ad yazmak iki adın ayrışması demekti. */}
          <Button asChild variant="outline" className="oc-tap">
            <a href={`/offers/${offerId}/costs/${costRevId}/excel`}>
              <Sheet className="size-4" /> Excel İndir
            </a>
          </Button>
          {readOnly ? null : (
            <>
              <Button
                type="button"
                variant="outline"
                className="oc-tap"
                disabled={pending}
                onClick={tekliftenTazele}
                title="Teklifteki kalemleri ve boş girdileri buraya taşır; girilen fiyatlara dokunmaz"
              >
                <RefreshCw className="size-4" /> Tekliften Tazele
              </Button>
              <Button type="button" onClick={() => kaydet()} disabled={pending || !kirli} className="oc-tap">
                <Save className="size-4" /> {kirli ? "Kaydet" : "Kayıtlı"}
              </Button>
              <Button
                type="button"
                className="oc-tap"
                disabled={pending}
                onClick={yayimlaVeIndir}
                title="Kaydeder, maliyet revizyonunu kilitler ve iç PDF'i arşivler"
              >
                <Send className="size-4" /> Yayımla
              </Button>
            </>
          )}
        </div>
      </div>

      {geride ? (
        <p className="shrink-0 rounded-md border border-dashed border-primary p-3 text-sm">
          Bu maliyet teklifin <span className="font-medium">R{payload.sourceRevNo}</span> revizyonuna
          göre kuruldu; teklif şu an <span className="font-medium">R{offerRevNo}</span>.
          <span className="font-medium"> Tekliften Tazele</span> ile eşitleyebilirsiniz.
        </p>
      ) : null}

      {readOnly ? (
        <p className="shrink-0 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Bu maliyet revizyonu yayımlanmıştır ve değiştirilemez. Değişiklik için teklif
          panelinden <span className="font-medium">Yeni Maliyet Revizyonu</span> açın.
        </p>
      ) : null}

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[11rem_minmax(0,1fr)]">
        {/* ————————————————————————————————————————————— bölüm rayı */}
        <div className="grid min-w-0 gap-1.5 lg:hidden">
          <Label htmlFor="mobil-maliyet-bolumu">Maliyet Bölümü</Label>
          <Select value={aktif} onValueChange={(v) => setAktif(v as (typeof BOLUMLER)[number]["key"])}>
            <SelectTrigger id="mobil-maliyet-bolumu" className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOLUMLER.map((b) => (
                <SelectItem key={b.key} value={b.key}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <nav
          className="hidden gap-1 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto"
          aria-label="Maliyet bölümleri"
        >
          {BOLUMLER.map((b) => (
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
        </nav>

        {/* ————————————————————————————————————————————— bölüm gövdesi
            KAYAN KAP AYNI ZAMANDA BİR KAPSAYICI BLOKTUR (`relative`, MOBIL-18).
            Yoksa içindeki `sr-only` gibi konumlanmış öğeler kaydırma kabından
            KAÇAR ve sayfaya ikinci bir kaydırma açar. */}
        <div
          className={cn(
            "relative grid content-start gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:pb-4",
            readOnly && "pointer-events-none opacity-70"
          )}
        >
          {/* KALEM SEÇİCİ yalnız kalem bazlı bölümlerde görünür. Çizelgede
              (Excel'de) her vinç bir SATIRDIR; burada bir ÇİPTİR — telefonda
              da sığsın diye ray değil, sarmalayan bir şerit. */}
          {bolum.kalemli && payload.items.length > 0 ? (
            <div className="grid gap-1.5">
              <div className="flex flex-wrap gap-1.5">
                {payload.items.map((it, i) => (
                  <div
                    key={it.id}
                    className={cn(
                      "oc-tap flex items-center gap-1 rounded-md border pr-1 pl-3 text-sm transition-colors",
                      it.id === item?.id
                        ? "border-primary bg-muted font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <button type="button" onClick={() => setKalemId(it.id)} className="py-1.5">
                      {it.title || `Kalem ${i + 1}`}
                    </button>
                    {/* SİLME YALNIZ SEÇİLİ ÇİPTE görünür: her çipte bir çöp
                        kutusu, kalem değiştirmek isteyen parmağın yanlışlıkla
                        bir maliyeti silmesi demekti. */}
                    {readOnly || it.id !== item?.id ? null : (
                      <MiniDugme baslik="Kalemi maliyetten çıkar" onClick={() => kalemiCikar(it)}>
                        <Trash2 className="size-3.5" />
                      </MiniDugme>
                    )}
                  </div>
                ))}
              </div>

              {/* ÇIKARILAN KALEM GÖRÜNÜR KALIR. Sessizce eksilen bir kalem,
                  maliyeti olduğundan ucuz gösterirdi. */}
              {payload.removedOfferItemIds.length > 0 && !readOnly ? (
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  Teklifteki {payload.removedOfferItemIds.length} kalem maliyet dışında bırakıldı;
                  tazeleme onları geri getirmez.
                  <button
                    type="button"
                    onClick={cikarmayiGeriAl}
                    className="oc-tap inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium text-foreground hover:bg-muted"
                  >
                    <RotateCcw className="size-3" /> Geri Al
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}

          {bolum.kalemli && !item ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Bu maliyet çalışmasında henüz kalem yok. Teklifte kalem açtıktan sonra
              <span className="font-medium"> Tekliften Tazele</span> düğmesine basın.
            </p>
          ) : null}

          {/* GİRDİLER ARTIK AĞIRLIKLAR SAYFASININ İÇİNDEDİR: özet kartıyla
              aynı satırı paylaşıyor (kullanıcı isteği 18.08.2026). Burada
              ayrıca çizilseydi ekranda iki kez görünürdü. */}
          {/* ÖZET ARTIK KIRILIMI DA TAŞIR (kullanıcı isteği 22.08.2026, md. 8:
              *"Genele Özet sayfasından bakacağım"*). Kırılım bir süre
              Maliyetler sayfasının altındaydı; o sayfa artık BİR VİNCİN
              sayfası olduğu için belgeye ait bir blok orada duramazdı.
              18.08.2026'daki "kırılıma inmek için bütün maliyet tablosunu
              geçmek zorunda kalıyorum" gerekçesi yeni yerde DAHA İYİ
              karşılanıyor: Özet zaten ilk bölümdür. */}
          {aktif === "ozet" ? (
            <>
              <OzetSayfasi
                overview={overview}
                payload={payload}
                readOnly={readOnly}
                onChange={(next) => guncelle(() => next)}
              />
              <KirilimSayfasi payload={payload} models={models} offer={offer} katlama={katlama} />
            </>
          ) : null}

          {aktif === "agirlik" && item ? (
            <AgirlikSayfasi
              offer={offer}
              item={item}
              model={models[item.id]}
              params={payload.params}
              readOnly={readOnly}
              onChange={setItem}
            />
          ) : null}

          {aktif === "hesap" && item ? (
            <HesapSayfasi
              offer={offer}
              item={item}
              model={models[item.id]}
              params={payload.params}
              readOnly={readOnly}
              onChange={setItem}
            />
          ) : null}

          {aktif === "maliyet" ? (
            <MaliyetSayfasi
              katlama={katlama}
              payload={payload}
              item={item}
              model={item ? models[item.id] : undefined}
              offer={offer}
              readOnly={readOnly}
              onItemChange={setItem}
              onChange={(next) => guncelle(() => next)}
            />
          ) : null}

          {aktif === "katsayi" ? (
            <KatsayiSayfasi
              payload={payload}
              readOnly={readOnly}
              onChange={(next) => guncelle(() => next)}
            />
          ) : null}

          {aktif === "not" ? (
            <Bolum
              baslik="NOTLAR"
              aciklama="İÇ NOTTUR — müşteriye giden hiçbir belgede görünmez. Tedarikçi görüşmeleri, riskler, varsayımlar."
            >
              <Textarea
                value={payload.notes}
                rows={12}
                onChange={(e) => guncelle((p) => ({ ...p, notes: e.target.value }))}
                className="text-base pointer-fine:text-sm"
              />
            </Bolum>
          ) : null}
        </div>
      </div>
    </div>
  );
}
