"use client";

// TEKLİF ANALİZİ — açık tekliflerin ve beklenen işlerin İLERİ PROJEKSİYONU.
//
// Kullanıcı isteği (17.08.2026): *"açık teklifler ve bu tekliflerin sıcaklık
// soğukluk oranına göre projeksiyon yapacağım … bu sayfadan bu yıl içinde ya
// da önümüzdeki 6 ay 1 yıl içinde verdiğim verebileceğim teklifler ve
// alabileceğim işleri kontrol etmiş olacağız."*
//
// BÜTÜN MATEMATİK ÇEKİRDEKTEDİR (`lib/offers/analiz.ts`). Burada tek bir
// toplam bile yeniden yazılmaz: özet şeridi, üç grafik ve çizelge AYNI
// fonksiyonlardan geçer — iki hesap yazılsaydı karttaki sayı ile grafikteki
// eğri sessizce ayrışırdı (`filter.ts`in kuralı).
//
// SATIR RENGİ PUANDAN GELİR (`scoreHue`): soğuk mavi → sıcak kırmızı.
// PUANSIZ SATIR RENKSİZDİR — uydurma bir orta ton, kullanıcının henüz
// vermediği bir kararı vermiş gibi gösterirdi. Renk TEK TAŞIYICI DEĞİLDİR:
// aynı bilgi puan rozetinde sayıyla, ipucunda sözle de durur.
//
// TELEFONDA ANA TABLO YATAY KAYMAZ, listeye katlanır (MOBIL-15) ve kart
// markup'ı ÇOĞALTILMAZ: iki yerde okunan hücreler (puan seçici, tutar,
// kaynak rozeti) tek bileşende kurulur.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Euro,
  ExternalLink,
  Eye,
  EyeOff,
  ListOrdered,
  Pencil,
  Plus,
  Search,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { CokluSuzgec } from "@/app/(app)/purchasing/filters";
import type { CustomerOption } from "@/app/(app)/offers/data";
import { PanoKabugu } from "@/app/(app)/purchasing/board-ui";
import {
  RankBars,
  TimeLineChart,
  type ChartColumn,
  type ChartSeries,
  type RankItem,
} from "@/components/charts";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { CustomerTag } from "@/components/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  currencyOf,
  fmtCompactEur,
  fmtCompactEur1,
  fmtMoney,
  fmtNum,
} from "@/lib/currency";
import { monthLabel } from "@/lib/jobs/calendar";
import {
  DEFAULT_PROJEKSIYON_PENCERE,
  PROJEKSIYON_PENCERELERI,
  agirlikliTutar,
  aylikSeri,
  donemSonu,
  musteriKirilimi,
  pencereBitisi,
  pencereyeGirer,
  projeksiyon,
  puanDagilimi,
  scoreHue,
  scoreLabel,
  tekilSatirlar,
  type ProjeksiyonPencere,
} from "@/lib/offers/analiz";
import { fmtOfferDate } from "@/lib/offers/filter";
import { isClosedOffer, offerStatusHue, offerStatusLabel } from "@/lib/offers/status";
import { customerTag, hueFromText, tagStyle } from "@/lib/tags";
import { trKatla } from "@/lib/drawings/tr-text";
import { cn } from "@/lib/utils";
import { setOfferScore, updateLead } from "./actions";
import {
  BeklenenTarih,
  LeadDialog,
  PuanSecici,
  type AnalizSatiriDetay,
} from "./lead-dialog";

// ————————————————————————————————————————————————————————— adlandırma
//
// Kullanıcı bildirimi (17.08.2026): *"Ham Toplam ve Ağırlıklı kelimelerini daha
// açıklayıcı yazalım. Anlaşılmıyor."*
//
// ALAN ADLARI DEĞİŞMEDİ (`hamToplam` / `agirlikliToplam`, çekirdekte): değişen
// yalnız EKRANA BASILAN metindir. İki isim tek yerde durur ki kart, grafik
// efsanesi ve sütun başlığı aynı şeye aynı adı versin — üç yerde ayrı ayrı
// yazılsaydı biri düzeltilip öbürleri unutulurdu.

const HAM_ETIKET = "Teklif Tutarı (tümü)";
const HAM_IPUCU = "Puan hesaba katılmadan, bütün satırların toplamı";
const AGIRLIKLI_ETIKET = "Beklenen Gelir";
const AGIRLIKLI_IPUCU =
  "Her satır kendi kazanma puanıyla çarpılıp toplandı (tutar × puan/10)";

// ————————————————————————————————————————————————————————————— süzgeçler

const KAYNAKLAR = [
  { value: "teklif", label: "Teklif" },
  { value: "beklenen", label: "Beklenen" },
] as const;

/**
 * PUAN BANTLARI — süzgeç için.
 *
 * Bant seçilmesinin sebebi kullanımdır (`CAPACITY_BANDS` ile aynı gerekçe):
 * kullanıcı "sıcak olanları göster" der, "8 ile 10 arası" demez. PUANSIZ AYRI
 * BİR BANTTIR ve bu şart: puanlanmayı bekleyen satırlar tam da gözden kaçan
 * satırlardır.
 */
const PUAN_BANTLARI = [
  { key: "sicak", label: "Sıcak (8–10)", min: 8, max: 10 },
  { key: "orta", label: "Orta (5–7)", min: 5, max: 7 },
  { key: "soguk", label: "Soğuk (1–4)", min: 1, max: 4 },
  { key: "puansiz", label: "Puansız", min: null, max: null },
] as const;

function bandaGirer(score: number | null, secili: readonly string[]): boolean {
  if (secili.length === 0) return true;
  return PUAN_BANTLARI.filter((b) => secili.includes(b.key)).some((b) =>
    b.min === null ? score === null : score !== null && score >= b.min && score <= b.max
  );
}

/**
 * SATIR AÇIK MI.
 *
 * Teklifte açık = `draft` ya da `sent` (`isClosedOffer`in tersi). Beklenen
 * işte açık = etkin ve henüz teklife dönüşmemiş; teklife dönüşen satır zaten
 * `tekilSatirlar` ile düşer ve burada bir kez daha elenmesi gerekmez, ama
 * kullanıcının elle pasife aldığı satır da "kapalı" sayılır.
 */
function acikSatir(s: AnalizSatiriDetay): boolean {
  return s.kaynak === "beklenen" ? s.active : !isClosedOffer(s.status);
}

/** Grafik ekseni: "Eyl 26" — ay adları TEK yerde tanımlıdır (`jobs/calendar`). */
function ayEtiketi(ay: string): string {
  return `${monthLabel(ay).slice(0, 3)} ${ay.slice(2, 4)}`;
}

// ————————————————————————————————————————————————————————— sıralama

/**
 * SATIRIN SIRA TARİHİ — teklifte VERİLDİĞİ gün, beklenen işte beklenen gün.
 *
 * Kullanıcı kararı (17.08.2026): *"Analizde teklif verilme tarihine göre
 * listeleme olsun. Beklenen tarihe göre değil."* Çizelge bir TAKİP listesidir:
 * "en son hangi teklifi verdim" sorusu, "hangi karar en yakın" sorusundan önce
 * gelir — ikincisinin cevabı zaten pencerede, grafikte ve puan renginde durur.
 *
 * BEKLENEN İŞTE VERİLME GÜNÜ YOKTUR ve uydurulmaz (değişmez md. 4): satır
 * henüz bir teklif değildir. Onun elindeki tek gün `expectedOn`dur ve satır
 * onunla dizilir; iki kaynağın tarihleri aynı eksende buluşur çünkü ikisi de
 * "bu satır takvimde nereye düşüyor" sorusunu cevaplar.
 */
export function siraTarihi(
  s: Pick<AnalizSatiriDetay, "kaynak" | "verilisTarihi" | "expectedOn">
): string | null {
  return s.kaynak === "teklif" ? s.verilisTarihi : s.expectedOn;
}

/**
 * ÇİZELGENİN VARSAYILAN SIRASI — yeniden eskiye.
 *
 * TARİHİ OLMAYAN SATIR SONA DÜŞER, SESSİZCE KAYBOLMAZ: yayımlanmamış bir
 * taslak ya da günü henüz konuşulmamış bir beklenti tam da gözden kaçan
 * satırdır; listeden atmak onu görünmez yapardı, başa koymak ise kullanıcının
 * bugün ilgilendiği satırların üstünü örterdi.
 *
 * EŞİTLİK TEKLİF NUMARASIYLA, sonra kimlikle çözülür: aynı gün verilmiş iki
 * teklif her tazelemede yer değiştirmemelidir (`sortOffers`in kuralı —
 * kararsız sıralama listeyi okuyan gözün en çok yorulduğu şeydir).
 */
export function siralaAnaliz(satirlar: readonly AnalizSatiriDetay[]): AnalizSatiriDetay[] {
  return [...satirlar].sort((a, b) => {
    const ta = siraTarihi(a);
    const tb = siraTarihi(b);
    if (ta === null && tb !== null) return 1;
    if (tb === null && ta !== null) return -1;
    const n = ta !== null && tb !== null ? tb.localeCompare(ta) : 0;
    if (n !== 0) return n;
    const no = (b.offerNo ?? "").localeCompare(a.offerNo ?? "", "tr");
    return no !== 0 ? no : a.id.localeCompare(b.id);
  });
}

// ————————————————————————————————————————————————————————————— görünüm

export function AnalizView({
  satirlar,
  customers,
  bugun,
}: {
  satirlar: readonly AnalizSatiriDetay[];
  customers: readonly CustomerOption[];
  /**
   * BUGÜN SUNUCUDAN GELİR. İstemcide `new Date()` çağırmak, sunucu boyamasıyla
   * istemci boyamasının farklı gün üretebileceği (gece yarısı, farklı saat
   * dilimi) bir hidrasyon uyuşmazlığı açardı — üstelik bütün pencere hesabı
   * bu tek tarihe dayanır.
   */
  bugun: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Kullanıcı kararı (03.09.2026): ilk görünüm önümüzdeki 12 aydır. Tarihsiz
  // eski satırlar “Tümü” seçeneğinde erişilebilir kalır; yeni tekliflerde tarih
  // artık bir ay sonrası olarak otomatik dolduğu için olağan akışta kaybolmaz.
  const [pencere, setPencere] = useState<ProjeksiyonPencere>(DEFAULT_PROJEKSIYON_PENCERE);
  const [musteri, setMusteri] = useState<string[]>([]);
  const [kaynak, setKaynak] = useState<string[]>([]);
  const [puanBandi, setPuanBandi] = useState<string[]>([]);
  const [q, setQ] = useState("");
  /**
   * KAPALILAR VARSAYILAN OLARAK GİZLİDİR (kullanıcı: *"kapalı teklifler de bu
   * sayfada olabilir ama istersem açabileyim"*). Sayfanın sorusu ileriye
   * dönüktür; kazanılmış ya da kaybedilmiş bir teklif o soruya cevap vermez.
   */
  const [kapaliGoster, setKapaliGoster] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<AnalizSatiriDetay | null>(null);
  const [yeniAcik, setYeniAcik] = useState(false);

  /** ÇİFT SAYIM ENGELİ ÖNCE: teklife dönüşmüş beklenen iş hiçbir sayıya girmez. */
  const tekil = useMemo(() => tekilSatirlar(satirlar) as AnalizSatiriDetay[], [satirlar]);

  const suzulmus = useMemo(() => {
    const anahtar = trKatla(q).split(/\s+/).filter(Boolean);
    const gecenler = tekil.filter((s) => {
      if (!kapaliGoster && !acikSatir(s)) return false;
      if (!pencereyeGirer(s, pencere, bugun)) return false;
      if (kaynak.length > 0 && !kaynak.includes(s.kaynak)) return false;
      if (musteri.length > 0 && !musteri.includes(s.customerName.trim())) return false;
      if (!bandaGirer(s.score, puanBandi)) return false;
      if (anahtar.length > 0) {
        const hay = trKatla(
          [s.offerNo ?? "", s.subject, s.customerName, s.customerShort ?? ""].join(" ")
        );
        if (!anahtar.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
    // SIRA SÜZGEÇTEN SONRA VERİLİR: sayılar ve grafikler sıradan bağımsızdır,
    // yalnız çizelge ile telefon listesi bu diziyi okur ve ikisi AYNI diziyi
    // okur — iki yerde sıralansaydı masaüstü ile telefon ayrışırdı.
    return siralaAnaliz(gecenler);
  }, [tekil, kapaliGoster, pencere, bugun, kaynak, musteri, puanBandi, q]);

  /**
   * AVRO SATIRLARI TOPLANIR, KARIŞIK PARA BİRİMİ TOPLANMAZ (Satış Takibi'nin
   * kuralı): kuru olmayan bir tutarı avroya çevirmek uydurma bir sayı
   * üretirdi. Başka para birimindeki satırlar çizelgede kendi birimiyle
   * durur, projeksiyonda ise AYRICA SAYILIR — sessizce düşmesinler.
   */
  const avro = useMemo(
    () => suzulmus.filter((s) => currencyOf(s.currency) === "EUR"),
    [suzulmus]
  );
  const digerPara = suzulmus.length - avro.length;
  const ozet = useMemo(() => projeksiyon(avro), [avro]);

  /**
   * SERİNİN SINIRLARI.
   *
   * Bitiş pencerenin bitişidir; "tümü"nde en uzak beklenen tarihtir (yoksa bir
   * yıl). Başlangıç BUGÜN DEĞİL en erken beklenen tarihtir: kararı geçmişte
   * beklenmiş ama hâlâ açık duran bir teklif grafiğin dışında kalsaydı,
   * "gecikmiş" olan tam da en çok bakılması gereken satır görünmezdi. Geriye
   * en fazla altı ay gidilir — daha eskisi eğriyi düzleştirip okunmaz yapar.
   */
  const { seriBas, seriBitis } = useMemo(() => {
    const tarihler = suzulmus.map((s) => s.expectedOn).filter((t): t is string => Boolean(t));
    const enErken = tarihler.length ? tarihler.reduce((a, b) => (a < b ? a : b)) : null;
    const enGec = tarihler.length ? tarihler.reduce((a, b) => (a > b ? a : b)) : null;
    const taban = donemSonu(bugun, -6);
    const bas = enErken && enErken < bugun ? (enErken < taban ? taban : enErken) : bugun;
    const bitis = pencereBitisi(pencere, bugun) ?? enGec ?? donemSonu(bugun, 12);
    return { seriBas: bas, seriBitis: bitis < bas ? bas : bitis };
  }, [suzulmus, pencere, bugun]);

  const seri = useMemo(
    () => aylikSeri(avro, seriBas, seriBitis),
    [avro, seriBas, seriBitis]
  );

  const kolonlar: ChartColumn[] = seri.map((n) => ({
    key: n.ay,
    label: ayEtiketi(n.ay),
    total: n.ham,
    parts: { ham: n.ham, agirlikli: n.agirlikli },
  }));

  // Seri rengi TON AÇISIDIR ve metinden türetilir (`hueFromText`): elle hex
  // yazılmaz, doygunluk/parlaklık `.oc-series-*` kuralında ve tema başına
  // verilir.
  //
  // TON TOHUMU ESKİ METİNDE BIRAKILDI: etiket düzeltmesi (md. 27) bir ADLANDIRMA
  // işidir, serinin KİMLİĞİ değil — tohumu etiketle birlikte değiştirmek
  // kullanıcının tanıdığı iki eğrinin rengini sebepsiz yere takas ederdi.
  const seriler: ChartSeries[] = [
    { key: "ham", label: HAM_ETIKET, hue: hueFromText("Ham Toplam") },
    { key: "agirlikli", label: AGIRLIKLI_ETIKET, hue: hueFromText("Ağırlıklı Projeksiyon") },
  ];

  const musteriKalemleri: RankItem[] = useMemo(() => {
    const kirilim = musteriKirilimi(avro);
    const toplam = kirilim.reduce((n, k) => n + k.agirlikli, 0);
    return kirilim.map((k) => ({
      key: k.musteri,
      label: customerTag({ name: k.musteri, hue: k.hue }).short,
      hue: customerTag({ name: k.musteri, hue: k.hue }).hue,
      hint: `${k.adet} satır · teklif tutarı ${fmtCompactEur(k.ham)}`,
      value: k.agirlikli,
      share: toplam === 0 ? 0 : k.agirlikli / toplam,
    }));
  }, [avro]);

  const puanKalemleri: RankItem[] = useMemo(() => {
    const dagilim = puanDagilimi(avro);
    const toplam = dagilim.reduce((n, d) => n + d.tutar, 0);
    return dagilim.map((d) => ({
      key: String(d.score),
      label: `${d.score} · ${scoreLabel(d.score)}`,
      // Çubuğun rengi PUANIN KENDİSİDİR: sıcak/soğuk dengesi tek bakışta
      // okunur, efsaneye gerek kalmaz.
      hue: scoreHue(d.score) as number,
      hint: `${d.adet} satır`,
      value: d.tutar,
      share: toplam === 0 ? 0 : d.tutar / toplam,
    }));
  }, [avro]);

  const musteriSecenekleri = useMemo(() => {
    const kume = new Set<string>();
    for (const s of tekil) if (s.customerName.trim()) kume.add(s.customerName.trim());
    return [...kume].sort((a, b) => a.localeCompare(b, "tr"));
  }, [tekil]);

  const suzgecVar =
    q.trim() !== "" ||
    musteri.length > 0 ||
    kaynak.length > 0 ||
    puanBandi.length > 0 ||
    kapaliGoster;

  /**
   * SATIR İÇİ YAZIM — puan ve beklenen tarih.
   *
   * İki kaynak iki ayrı tabloya yazar ama ekranda TEK bir çizelge vardır; ayrım
   * burada, tek yerde yapılır. Beklenen iş satırında kaydın TAMAMI yollanır:
   * eksik alanla `updateLead` çağırmak notu ve defter bağını sessizce silerdi.
   */
  function yaz(
    s: AnalizSatiriDetay,
    degisim: { score?: number | null; expectedOn?: string | null },
    basari: string
  ) {
    const score = degisim.score !== undefined ? degisim.score : s.score;
    const expectedOn = degisim.expectedOn !== undefined ? degisim.expectedOn : s.expectedOn;
    startTransition(async () => {
      const res =
        s.kaynak === "teklif"
          ? await setOfferScore(s.id, score, expectedOn)
          : await updateLead(s.id, {
              customerId: s.customerId,
              customerName: s.customerName,
              subject: s.subject,
              expectedOn,
              amount: s.amount,
              currency: currencyOf(s.currency),
              winScore: score,
              notes: s.notes,
              active: s.active,
            });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(basari);
      router.refresh();
    });
  }

  return (
    <div className={cn("grid gap-4", pending && "opacity-70 transition-opacity")}>
      {/* ————————————————————————————————————————————— pencere seçici */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="oc-kicker text-muted-foreground">Projeksiyon</span>
        <div className="flex flex-wrap items-center gap-1">
          {PROJEKSIYON_PENCERELERI.map((p) => (
            <Button
              key={p.key}
              type="button"
              size="sm"
              variant={pencere === p.key ? "default" : "outline"}
              className="oc-tap h-9"
              onClick={() => setPencere(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {pencere === "tumu"
            ? "Beklenen tarihi olmayan satırlar da dâhil"
            : `${fmtOfferDate(bugun)} – ${fmtOfferDate(pencereBitisi(pencere, bugun))}`}
        </span>
      </div>

      {/* ————————————————————————————————————————————— özet şeridi */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={AGIRLIKLI_ETIKET}
          value={fmtMoney(ozet.agirlikliToplam, "EUR")}
          hint={`${fmtNum(ozet.adet)} satır · ${AGIRLIKLI_IPUCU}`}
          icon={TrendingUp}
          dense
        />
        <StatCard
          label={HAM_ETIKET}
          value={fmtMoney(ozet.hamToplam, "EUR")}
          hint={HAM_IPUCU}
          icon={Euro}
          dense
        />
        <StatCard
          label="Satır"
          value={fmtNum(suzulmus.length)}
          hint={
            digerPara > 0
              ? `${digerPara} satır başka para biriminde — toplama girmez`
              : "Süzgeçten geçen"
          }
          icon={ListOrdered}
          dense
        />
        <StatCard
          label="Eksik Satır"
          value={fmtNum(ozet.eksik)}
          hint="Puanı ya da tutarı yok — projeksiyona girmez"
          icon={TriangleAlert}
          dense
        />
      </div>

      {/* ————————————————————————————————————————————— grafikler */}
      <PanoKabugu
        baslik="Aylık Projeksiyon"
        alt={`${fmtCompactEur(ozet.agirlikliToplam)} beklenen gelir`}
      >
        <TimeLineChart
          columns={kolonlar}
          series={seriler}
          valueLabel="EUR"
          format={fmtCompactEur}
          valueLabels
          valueFormat={fmtCompactEur1}
        />
      </PanoKabugu>

      <div className="grid gap-3 xl:grid-cols-2">
        <PanoKabugu baslik="Müşteri Kırılımı" alt={`${musteriKalemleri.length} müşteri`}>
          <RankBars
            items={musteriKalemleri}
            limit={10}
            valueLabel="EUR"
            format={fmtCompactEur}
            emptyText="Bu pencerede tutarı olan satır yok"
          />
        </PanoKabugu>
        <PanoKabugu baslik="Puan Dağılımı" alt="Sıcak / soğuk dengesi">
          <RankBars
            items={puanKalemleri}
            valueLabel="EUR"
            format={fmtCompactEur}
            emptyText="Puanlanmış satır yok"
          />
        </PanoKabugu>
      </div>

      {/* ————————————————————————————————————————————— süzgeçler */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Satır ara"
            className="h-9 pl-8"
          />
        </div>

        <CokluSuzgec
          baslik="Kaynak"
          secenekler={KAYNAKLAR.map((k) => ({
            value: k.value,
            label: k.label,
            count: tekil.filter((s) => s.kaynak === k.value).length,
          }))}
          secili={kaynak}
          onChange={setKaynak}
        />
        <CokluSuzgec
          baslik="Puan"
          secenekler={PUAN_BANTLARI.map((b) => ({ value: b.key, label: b.label }))}
          secili={puanBandi}
          onChange={setPuanBandi}
        />
        <CokluSuzgec
          baslik="Müşteri"
          secenekler={musteriSecenekleri.map((m) => ({
            value: m,
            label: customerTag({ name: m, shortName: kisaltma(customers, m) }).short,
          }))}
          secili={musteri}
          onChange={setMusteri}
        />

        <Button
          type="button"
          size="sm"
          variant={kapaliGoster ? "default" : "outline"}
          className="oc-tap h-9"
          onClick={() => setKapaliGoster((v) => !v)}
          title="Kazanılan, kaybedilen ve iptal edilen teklifler ile pasife alınmış beklenen işler"
        >
          {kapaliGoster ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          Kapalılar
        </Button>

        {suzgecVar ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="oc-tap h-9"
            onClick={() => {
              setQ("");
              setMusteri([]);
              setKaynak([]);
              setPuanBandi([]);
              setKapaliGoster(false);
            }}
          >
            <X className="size-3.5" /> Temizle
          </Button>
        ) : null}

        <Button type="button" size="sm" className="oc-tap h-9" onClick={() => setYeniAcik(true)}>
          <Plus className="size-3.5" /> Beklenen İş
        </Button>
      </div>

      {/* ————————————————————————————————————————————— çizelge */}
      {suzulmus.length === 0 ? (
        <EmptyState
          title={tekil.length === 0 ? "HENÜZ SATIR YOK" : "BU PENCEREDE SATIR YOK"}
          description={
            tekil.length === 0
              ? "Açık teklifler buraya kendiliğinden düşer; henüz vermediğiniz işleri “Beklenen İş” ile ekleyebilirsiniz."
              : "Pencereyi genişletin ya da süzgeçleri temizleyin. Beklenen tarihi girilmemiş satırlar yalnız “Tümü” penceresinde görünür."
          }
        >
          <Button type="button" onClick={() => setYeniAcik(true)}>
            <Plus className="size-4" /> Beklenen İş Ekle
          </Button>
        </EmptyState>
      ) : (
        <>
          {/* Masaüstü: çizelge. Telefonda gizlenir — ana tablo yatay KAYMAZ. */}
          <div className="hidden md:block">
            {/* SABİT IZGARA, YATAY KAYDIRMA YOK (MOBIL-16; kullanıcı
                bildirimi 22.08.2026: *"analiz sayfasında da yatayda kaydırma
                olmasın. Konu kısmı çok uzunsa ... üç nokta yapalım."*).
                Yüzdeler toplamı 100'dür — değiştiren kişi toplamı korumalıdır.
                Beklenen Tarih sütunu bir TARİH KUTUSU taşır ve kutu küçülemez;
                payı bu yüzden en büyük olanlardandır. */}
            <Table className="table-fixed" containerClassName="!overflow-x-hidden">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[6%]">Kaynak</TableHead>
                  <TableHead className="w-[12%]">Teklif No</TableHead>
                  <TableHead className="w-[7%]">Müşteri</TableHead>
                  <TableHead className="w-[19%]">Konu</TableHead>
                  <TableHead className="w-[16%]">Beklenen Tarih</TableHead>
                  {/* Sütun başlıkları kartlarla AYNI adlandırmayı kullanır
                      (md. 27); "(tümü)" yalnız toplamda anlamlıdır, tek satırda
                      değil. */}
                  <TableHead className="w-[11%] text-right" title={HAM_IPUCU}>
                    Teklif Tutarı
                  </TableHead>
                  <TableHead className="w-[8%]">Puan</TableHead>
                  <TableHead className="w-[11%] text-right" title={AGIRLIKLI_IPUCU}>
                    {AGIRLIKLI_ETIKET}
                  </TableHead>
                  <TableHead className="w-[6%]">Durum</TableHead>
                  <TableHead className="w-[4%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suzulmus.map((s) => {
                  const hue = scoreHue(s.score);
                  const agirlikli = agirlikliTutar(s);
                  return (
                    <TableRow
                      key={`${s.kaynak}-${s.id}`}
                      // PUANSIZ SATIR RENKSİZDİR: sınıf da stil de verilmez.
                      className={hue === null ? undefined : "oc-row-hue"}
                      style={hue === null ? undefined : tagStyle(hue)}
                    >
                      <TableCell>
                        <KaynakRozeti satir={s} />
                      </TableCell>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {s.kaynak === "teklif" ? (
                          <Link href={`/offers/${s.id}`} className="hover:underline">
                            {s.offerNo}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <CustomerTag
                          name={s.customerName}
                          shortName={s.customerShort}
                          hue={s.customerHue}
                        />
                      </TableCell>
                      {/* TEK SATIR + ÜÇ NOKTA: `line-clamp-2` satır boyunu
                          içeriğe göre değiştiriyordu; tam metin `title`da durur. */}
                      <TableCell>
                        <span className="block truncate" title={s.subject}>
                          {s.subject || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <TarihHucresi satir={s} bugun={bugun} onYaz={yaz} disabled={pending} />
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {s.amount === null ? "—" : fmtMoney(s.amount, s.currency)}
                      </TableCell>
                      <TableCell>
                        <PuanSecici
                          score={s.score}
                          disabled={pending}
                          onChange={(v) => yaz(s, { score: v }, "Puan kaydedildi.")}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {agirlikli === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          fmtMoney(agirlikli, s.currency)
                        )}
                      </TableCell>
                      <TableCell>
                        <DurumCipi satir={s} />
                      </TableCell>
                      <TableCell>
                        <Eylem satir={s} onDuzenle={setDuzenlenen} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Telefon: tablo LİSTEYE katlanır (MOBIL-15). */}
          <ul className="grid gap-2 md:hidden">
            {suzulmus.map((s) => {
              const hue = scoreHue(s.score);
              const agirlikli = agirlikliTutar(s);
              return (
                <li
                  key={`${s.kaynak}-${s.id}`}
                  className={cn("rounded-md border p-3", hue !== null && "oc-row-hue")}
                  style={hue === null ? undefined : tagStyle(hue)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <KaynakRozeti satir={s} />
                        {s.offerNo && (
                          <Link
                            href={`/offers/${s.id}`}
                            className="font-mono text-xs hover:underline"
                          >
                            {s.offerNo}
                          </Link>
                        )}
                      </div>
                      <p className="mt-1 font-medium [overflow-wrap:anywhere]">
                        {s.subject || "—"}
                      </p>
                    </div>
                    <Eylem satir={s} onDuzenle={setDuzenlenen} />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <CustomerTag
                      name={s.customerName}
                      shortName={s.customerShort}
                      hue={s.customerHue}
                    />
                    <DurumCipi satir={s} />
                    <span className="ml-auto font-mono">
                      {s.amount === null ? "—" : fmtMoney(s.amount, s.currency)}
                    </span>
                  </div>

                  {/* DAR EKRANDA ALT ALTA: tarih kutusuna hızlı seçim düğmesi
                      eklendi ve `<input type="date">`in kendi asgari genişliği
                      var — yarım sütunda ikisi sıkışıp kartı yatay kaydırırdı
                      (MOBIL-15: ana tablo yatay KAYMAZ, listeye katlanır). */}
                  <div className="mt-2 grid grid-cols-1 items-end gap-2 sm:grid-cols-2">
                    <div>
                      <span className="oc-kicker text-muted-foreground">Beklenen</span>
                      <TarihHucresi satir={s} bugun={bugun} onYaz={yaz} disabled={pending} />
                    </div>
                    <div>
                      <span className="oc-kicker text-muted-foreground" title={AGIRLIKLI_IPUCU}>
                        Puan · beklenen{" "}
                        {agirlikli === null ? "—" : fmtMoney(agirlikli, s.currency)}
                      </span>
                      <PuanSecici
                        score={s.score}
                        disabled={pending}
                        onChange={(v) => yaz(s, { score: v }, "Puan kaydedildi.")}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Pencere yalnız GEREKTİĞİNDE monte edilir: her açılış taze bir bileşen
          demektir ve alanları senkronize eden bir efekte gerek kalmaz. */}
      {yeniAcik && (
        <LeadDialog
          satir={null}
          customers={customers}
          bugun={bugun}
          open
          onOpenChange={setYeniAcik}
        />
      )}
      {duzenlenen && (
        <LeadDialog
          satir={duzenlenen}
          customers={customers}
          bugun={bugun}
          open
          onOpenChange={(o) => !o && setDuzenlenen(null)}
        />
      )}
    </div>
  );
}

// ————————————————————————————————————————————————————————————— parçalar

/** Defterdeki kısaltmayı adından bulur — süzgeç etiketleri de kısaltma gösterir. */
function kisaltma(customers: readonly CustomerOption[], name: string): string | null {
  return customers.find((c) => c.name === name)?.short_name ?? null;
}

/**
 * KAYNAK ROZETİ — satır verilmiş bir teklif mi, henüz verilmemiş bir beklenti mi.
 *
 * Ayrım sayfanın en önemli ayrımıdır: ikisi aynı toplamda buluşur ama biri
 * belgeye dayanır, öteki bir öngörüdür.
 */
function KaynakRozeti({ satir }: { satir: AnalizSatiriDetay }) {
  const teklif = satir.kaynak === "teklif";
  return (
    <span
      style={tagStyle(hueFromText(teklif ? "teklif" : "beklenen"))}
      className="oc-tag px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap"
      title={teklif ? "Verilmiş teklif" : "Henüz verilmemiş, beklenen iş"}
    >
      {teklif ? "Teklif" : "Beklenen"}
    </span>
  );
}

function DurumCipi({ satir }: { satir: AnalizSatiriDetay }) {
  if (satir.kaynak === "beklenen") {
    return (
      <span
        style={tagStyle(hueFromText("beklenen"))}
        className="oc-tag px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"
      >
        {satir.active ? "Beklenen" : "Pasif"}
      </span>
    );
  }
  return (
    <span
      style={tagStyle(offerStatusHue(satir.status))}
      className="oc-tag px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"
    >
      {offerStatusLabel(satir.status)}
    </span>
  );
}

/**
 * BEKLENEN TARİH SATIR İÇİNDE DEĞİŞİR.
 *
 * Projeksiyonun dönemi bu tek alandan okunur; onu değiştirmek için pencere
 * açtırmak, sayfanın asıl işini (dönemleri yeniden dizmek) yavaşlatırdı.
 * Boşaltmak meşrudur: tarihi bilinmeyen satır "Tümü" penceresinde durur.
 *
 * KUTUNUN KENDİSİ `BeklenenTarih`TİR (md. 25/26) ve yalnız TAM bir günü yukarı
 * verir: burada her `onChange` doğrudan sunucuya yazar, yani yarım bir tarih
 * ekranda görünüp geçmez — kaydedilirdi.
 */
function TarihHucresi({
  satir,
  bugun,
  onYaz,
  disabled,
}: {
  satir: AnalizSatiriDetay;
  bugun: string;
  onYaz: (
    s: AnalizSatiriDetay,
    degisim: { expectedOn?: string | null },
    basari: string
  ) => void;
  disabled?: boolean;
}) {
  return (
    <BeklenenTarih
      value={satir.expectedOn}
      bugun={bugun}
      disabled={disabled}
      onChange={(iso) => onYaz(satir, { expectedOn: iso }, "Beklenen tarih kaydedildi.")}
      className="md:w-[12rem]"
    />
  );
}

/**
 * SATIR EYLEMİ — beklenen işte düzenle/sil (pencereden), teklifte belgeye git.
 *
 * TEKLİF BU EKRANDAN SİLİNMEZ: teklif bir belgedir ve müşterinin elindedir;
 * silinmesi teklif ekranının kendi kuralına (yayımlanmış revizyon engeli)
 * bağlıdır. Buradaki "düzenleme" teklifin yalnız analiz alanlarına dokunur.
 */
function Eylem({
  satir,
  onDuzenle,
}: {
  satir: AnalizSatiriDetay;
  onDuzenle: (s: AnalizSatiriDetay) => void;
}) {
  if (satir.kaynak === "beklenen") {
    return (
      // Boy varyantın kendisinden gelir (`icon-sm` = 32px + `.oc-tap-square`
      // ile 44px hedef); çağrı yerinde elle yükseklik YAZILMAZ (MOBIL-1).
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Beklenen işi düzenle veya sil"
        aria-label="Beklenen işi düzenle"
        onClick={() => onDuzenle(satir)}
      >
        <Pencil className="size-3.5" />
      </Button>
    );
  }
  return (
    <Button asChild variant="ghost" size="icon-sm">
      <Link href={`/offers/${satir.id}`} title="Teklifi aç" aria-label="Teklifi aç">
        <ExternalLink className="size-3.5" />
      </Link>
    </Button>
  );
}
