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
import { Download, FileText, RefreshCw, Save, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { costModels, costWeights, withCostDerived } from "@/lib/offers/cost/payload";
import { costMargin, costTotals } from "@/lib/offers/cost/totals";
import type { CostItem, CostPayload } from "@/lib/offers/cost/types";
import { fmtCostField } from "@/lib/offers/cost/labels";
import type { OfferPayload } from "@/lib/offers/types";
import {
  issueOfferCostRevision,
  saveOfferCostRevision,
  syncOfferCostFromOffer,
} from "@/app/(app)/offers/cost-actions";
import { Bolum } from "./cost-parts";
import { AgirlikSayfasi, HesapSayfasi, KatsayiSayfasi } from "./model-view";
import { MaliyetSayfasi } from "./lines-view";

const BOLUMLER = [
  { key: "agirlik", label: "Ağırlıklar", kalemli: true },
  { key: "hesap", label: "Hesaplar", kalemli: true },
  { key: "maliyet", label: "Maliyetler", kalemli: true },
  { key: "katsayi", label: "Katsayılar", kalemli: false },
  { key: "not", label: "Notlar", kalemli: false },
] as const;

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
  const kar = costMargin(offer.pricing.total ?? null, totals.total);

  const item = payload.items.find((i) => i.id === kalemId) ?? payload.items[0];
  const bolum = BOLUMLER.find((b) => b.key === aktif) ?? BOLUMLER[0];

  const setItem = (next: CostItem) =>
    guncelle((p) => ({ ...p, items: p.items.map((x) => (x.id === next.id ? next : x)) }));

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
          <div className="text-right">
            <div className="font-mono text-sm">{fmtMoney(totals.total, payload.currency)}</div>
            <div className="text-xs text-muted-foreground">
              {kar.profit === null
                ? "kâr —"
                : `kâr ${fmtMoney(kar.profit, payload.currency)} · %${fmtCostField(kar.marginPercent, 1)}`}
            </div>
          </div>
          <Button asChild variant="outline" className="oc-tap">
            <a href={`/offers/${offerId}/costs/${costRevId}/pdf`}>
              <Download className="size-4" /> PDF İndir
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
        <nav
          className="flex gap-1 overflow-x-auto lg:min-h-0 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto"
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

        {/* ————————————————————————————————————————————— bölüm gövdesi */}
        <div
          className={cn(
            "grid content-start gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:pb-4",
            readOnly && "pointer-events-none opacity-70"
          )}
        >
          {/* KALEM SEÇİCİ yalnız kalem bazlı bölümlerde görünür. Çizelgede
              (Excel'de) her vinç bir SATIRDIR; burada bir ÇİPTİR — telefonda
              da sığsın diye ray değil, sarmalayan bir şerit. */}
          {bolum.kalemli && payload.items.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {payload.items.map((it, i) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setKalemId(it.id)}
                  aria-current={it.id === item?.id ? "true" : undefined}
                  className={cn(
                    "oc-tap rounded-md border px-3 py-1.5 text-sm transition-colors",
                    it.id === item?.id
                      ? "border-primary bg-muted font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {it.title || `Kalem ${i + 1}`}
                </button>
              ))}
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
          {aktif === "agirlik" && item ? (
            <AgirlikSayfasi
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
              payload={payload}
              item={item}
              model={item ? models[item.id] : undefined}
              models={models}
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
