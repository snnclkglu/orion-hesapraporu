"use client";

// SİPARİŞ PENCERESİ — kullanıcı kararı (md. 11):
//
//   "Durum kısmında üzerine basıldığında 'Satın Alındı' olması yerine pop-up
//    açılsa, termini ve sipariş tarihini girse daha iyi olur. Ayrıca pop-up
//    içerisine ödeme vadesi de dropdown seçilsin: Peşin, Kredi Kartı, 15 gün
//    30 gün 45 gün 60 gün 90 gün gibi. Ayrıca Avans miktarı da zorunlu
//    olmasada girilebilsin — dropdown %5 10 15 20 25 30 gibi, ayrıca elle
//    fiyat da yazılabilsin. Ödeme vadesi var ise ürün teslimi + vade süresi
//    şeklinde öderiz. Sipariş tarihi + Vade DEĞİL."
//
// Son cümle penceredeki en önemli bilgidir ve ekranda CANLI olarak gösterilir:
// kullanıcı vadeyi seçtiği anda "ödeme günü şu olur" yazısını görür. Kural bir
// dipnot değil, pencerenin ürettiği asıl çıktıdır.
//
// PENCERE ÇOK KALEMLİDİR (md. 7): havuzdan seçilen bütün kalemler tek siparişe
// girer ve her satır kendi işine bağlı kalır. Tek kalemlik bir pencere,
// satınalmacının gerçekte yaptığı işi modelleyemezdi.
//
// ————————————————————————————————————————————————— 13.08.2026 düzenlemeleri
//
// KUTU ADLARI "Baş Harfler Büyük"tür (kullanıcı kararı): *"kutu yazılarının
// isimleri örneğin Sipariş no, sipariş tarihi, Birim Fiyat, Para birimi gibi
// yazıların baş harfi büyük olsun."* Metinler ELLE öyle yazılır, bir
// dönüştürücüden geçirilmez — Personel özet kartlarında verilen kararın aynısı:
// aralarında simge ve kısaltma var ("1 € = ?", "Avans %").
//
// ALT BAŞLIK KALDIRILDI ("7 kalem · tek tedarikçi. Kalemler birden çok işe
// gidiyor…", kullanıcı kararı). Yazı doğruydu ama pencerenin en üstünde,
// kullanıcının hiçbir kararını değiştirmeyen bir dipnottu.
//
// ————————————————————————————————————————————————— 14.08.2026 düzenlemeleri
//
// PENCERE "SARF GİDERİ GİR" EKRANININ GÖRSEL YAPISINI ALDI (kullanıcı kararı).
// Üç şey değişti ve üçü de o ekranda zaten çözülmüş sorunlardı:
//
//   · TEDARİKÇİ ARTIK ARANABİLİR BİR LİSTEDİR (`Combobox`), `datalist` taşıyan
//     bir metin kutusu değil. `datalist` tarayıcıya bırakılmış bir öneridir:
//     Türkçe katlaması yoktur ("isdemir" yazan "İSDEMİR"i bulamıyordu), kodu
//     (TD0007) göstermez ve dokunmatikte açılmaz. Yeni firma yine BURADAN
//     açılır — listede yoksa "+ Yeni tedarikçi" satırı yazılan adı deftere
//     yazar ve kodu anında gelir (sipariş numarası ondan türüyor).
//   · ALANLAR ETİKETLİ BÖLÜMLERE ayrıldı (`Label` + `border bg-muted/30`):
//     tek bir `flex-wrap` şeritte on kutu yan yana duruyordu ve hangisinin
//     hangi başlığa ait olduğu dar ekranda okunmuyordu.
//   · HIZLI TERMİN eklendi (`DELIVERY_WEEKS`) — sarf girişindeki listenin
//     aynısı, artı kullanıcının istediği 10/12/16/20 hafta.
//
// KDV SATIRDADIR (kullanıcı kararı): *"kullanıcı hep kdv hariç fiyat girer,
// kdv otomatik gelir."* Birim fiyat KDV HARİÇ kaydedilir ve fiyat arşivi ile
// bütün panolar onu okur; KDV yalnız fatura kontrolü ve ÖDEME TAKVİMİ içindir.

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox, type ComboOption } from "@/components/combobox";
import { CURRENCIES, CURRENCY_LABELS, currencyOf, fmtMoney, parseNum } from "@/lib/currency";
import {
  ADVANCE_PERCENTS,
  DELIVERY_WEEKS,
  PAYMENT_TERMS,
  advanceAmount,
  bugunISO,
  eurKarsiligi,
  gunEkle,
  gunFarki,
  kurGerekli,
  odemeGunu,
  tarihGoster,
} from "@/lib/purchasing/terms";
import { DEFAULT_VAT_RATE, VAT_RATES, vatTotals, type VatRate } from "@/lib/purchasing/vat";
import { formatNum } from "@/lib/drawings/labels";
import { kurMetni, kurOnerisi, type GunlukKur } from "@/lib/purchasing/kur";
import { trKatla } from "@/lib/drawings/tr-text";
import { siparisNoCakisiyorMu, siparisNoOner } from "@/lib/purchasing/order-no";
import { createOrder, ensureQuality, ensureSupplier } from "./actions";
import type { TedarikciKaydi } from "./data";
import type { OrderLineInput } from "./schema";
import { TAM_BOY_PENCERE } from "./pencere";

/** Havuzdan gelen bir kalemin sipariş penceresindeki hâli. */
export interface SiparisKalemi {
  matchKey: string;
  tanim: string;
  kalan: number;
  birimFiyat: number | null;
  paraBirimi: string | null;
  tedarikci: string;
  /**
   * SİPARİŞ BİRİMİ — varsayılan "Adet".
   *
   * Sac plakası KİLOYLA sipariş edilir (kullanıcının verdiği DESSAN
   * proforması: `3.537 KG × 0,690 USD`), plaka adedi bir NİTELİKTİR ve nota
   * yazılır. Birim satırda taşınmasaydı hammadde siparişi adet gibi
   * görünür ve birim fiyat kilo fiyatı olduğu için tutar otuz kat şaşardı.
   */
  birim?: string;
  /** Satır notu — plaka siparişinde "5 plaka × 707 kg". */
  not?: string;
  /** Kalemin işlere dağılımı — satırın hangi pakete işaret yazacağını belirler. */
  paylar: { itemNo: string; packageId: string; partKey: string; adet: number }[];
}

/** Kullanıcının pencerede düzenlediği satır. */
interface Satir {
  matchKey: string;
  tanim: string;
  adet: string;
  fiyat: string;
  kdv: VatRate;
  /** MARKA/KALİTE (md. 16) — snapshot olarak kaydedilir. */
  kalite: string;
  /** Sipariş birimi — sacda "Kg", ekipmanda "Adet". */
  birim: string;
  /** Satır notu — plaka siparişinde plaka adedi burada durur. */
  not: string;
  paylar: SiparisKalemi["paylar"];
}

/** Serbest gün girişi için açılırdaki özel değer. */
const OZEL = "ozel";
/** Hızlı terminde "tarih girilmedi" — termin İSTEĞE BAĞLIDIR. */
const TERMIN_YOK = "yok";
/** Hızlı terminde "takvimden seç". */
const TERMIN_SERBEST = "serbest";

export function OrderDialog({
  kalemler,
  tedarikciler,
  defter,
  siparisNolari,
  sonKur,
  qualities = [],
  onClose,
  onSaved,
}: {
  kalemler: SiparisKalemi[];
  tedarikciler: string[];
  /** Firma defteri — sipariş numarası önerisinin kaynağı olan KODLAR burada. */
  defter: TedarikciKaydi[];
  /** Kullanılmış bütün sipariş numaraları (iptaller dâhil). */
  siparisNolari: string[];
  /** En son yayımlanmış günlük kur — kur kutusunun önerisi buradan gelir. */
  sonKur?: GunlukKur | null;
  /** Marka/Kalite öneri listesi (md. 16). */
  qualities?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [calisiyor, basla] = useTransition();
  const [kaliteler, setKaliteler] = useState<string[]>(qualities);

  /**
   * Katlanmış firma adı → kod.
   *
   * Pencere açıkken YENİ FİRMA da eklenebilir (`firmaOlustur`), o yüzden harita
   * bir `useMemo` değil bir DURUMdur: yeni kod anında burada belirir ve numara
   * önerisi bir sayfa yenilemesi beklemez.
   */
  const [kodlar, setKodlar] = useState<Map<string, string>>(
    () => new Map(defter.filter((t) => t.code).map((t) => [trKatla(t.name), t.code]))
  );

  // TEDARİKÇİ SEÇİLİ TEKLİFTEN ÖNERİLİR. Satınalmacı çoğu zaman en ucuz
  // teklifi verene sipariş açar; boş bir alan sunmak o bilgiyi çöpe atardı.
  const ilkFirma = kalemler.find((k) => k.tedarikci)?.tedarikci ?? "";
  const [firma, setFirma] = useState(ilkFirma);
  const [firmaKodu, setFirmaKodu] = useState(() => kodlar.get(trKatla(ilkFirma)) ?? "");
  const [firmaYaziliyor, setFirmaYaziliyor] = useState(false);
  const [yeniFirmaKodu, setYeniFirmaKodu] = useState("");
  // SİPARİŞ NUMARASI ÖNERİLİR, DAYATILMAZ: kullanıcı kutuya dokunduğu anda
  // öneri susar (uygulamanın `*Auto` deseninin aynısı — türetilen değer,
  // insanın yazdığını asla ezmez).
  const [noDokunuldu, setNoDokunuldu] = useState(false);
  const [siparisTarihi, setSiparisTarihi] = useState(bugunISO());
  const [siparisNo, setSiparisNo] = useState(() =>
    siparisNoOner(kodlar.get(trKatla(ilkFirma)) ?? "", siparisNolari, bugunISO())
  );
  const [termin, setTermin] = useState("");
  const [terminSecimi, setTerminSecimi] = useState(TERMIN_YOK);
  const [vade, setVade] = useState("pesin");
  const [ozelGun, setOzelGun] = useState("");
  const [avansYuzde, setAvansYuzde] = useState("");
  const [avansTutar, setAvansTutar] = useState("");
  const [paraBirimi, setParaBirimi] = useState(
    currencyOf(kalemler.find((k) => k.paraBirimi)?.paraBirimi ?? "EUR")
  );
  // KUR AÇILIŞTA DOLU GELİR (kullanıcı kararı, 13.08.2026). Seçili para birimi
  // teklif satırından geliyor; kutuyu boş bırakmak, referansı elinde olan bir
  // uygulamada kullanıcıyı TCMB sayfasına göndermekti.
  const [kur, setKur] = useState(() => {
    const o = kurOnerisi(
      currencyOf(kalemler.find((k) => k.paraBirimi)?.paraBirimi ?? "EUR"),
      sonKur
    );
    return o ? kurMetni(o.kur) : "";
  });
  const [not, setNot] = useState("");

  const [satirlar, setSatirlar] = useState<Satir[]>(() =>
    kalemler.map((k) => ({
      matchKey: k.matchKey,
      tanim: k.tanim,
      adet: String(k.kalan || 1),
      // Fiyat SEÇİLİ TEKLİFTEN gelir ama yalnız para birimi tutuyorsa: farklı
      // para biriminden bir fiyatı sessizce taşımak yanlış tutar üretirdi.
      fiyat:
        k.birimFiyat != null && currencyOf(k.paraBirimi) === currencyOf(paraBirimi)
          ? String(k.birimFiyat)
          : "",
      kdv: DEFAULT_VAT_RATE,
      kalite: "",
      // Birim ve not kalemden gelir; verilmezse ekipman varsayılanı.
      birim: k.birim ?? "Adet",
      not: k.not ?? "",
      paylar: k.paylar,
    }))
  );

  const kaliteSecenekleri: ComboOption[] = useMemo(
    () => kaliteler.map((k) => ({ value: k, label: k })),
    [kaliteler]
  );

  /** Yeni marka/kalite deftere yazılır ve satıra uygulanır (md. 16). */
  function kaliteEkle(i: number, ad: string) {
    const temiz = ad.trim();
    if (!temiz) return;
    guncelle(i, { kalite: temiz.toLocaleUpperCase("tr-TR") });
    ensureQuality({ name: temiz }).then((sonuc) => {
      if (sonuc.error || !sonuc.name) return;
      setKaliteler((o) => (o.includes(sonuc.name!) ? o : [...o, sonuc.name!].sort((a, b) => a.localeCompare(b, "tr"))));
      guncelle(i, { kalite: sonuc.name! });
    });
  }

  /**
   * Tedarikçi seçenekleri — ÖNERİ LİSTESİ, defterin tamamı değil.
   *
   * Pasif firmalar (banka, otel, kargo) `loadTedarikciler` tarafında zaten
   * elenmiştir; kod ise defterden gelir ve rozet olarak görünür. Seçili firma
   * listede yoksa KENDİ SEÇENEĞİ olarak korunur — korunmasaydı dolu bir alan
   * ekranda boş görünürdü (Teknik Resim Takibi'ndeki "Çizen" kuralının aynısı).
   */
  const firmaSecenekleri: ComboOption[] = useMemo(() => {
    const harita = new Map<string, ComboOption>();
    for (const ad of tedarikciler) {
      const kod = kodlar.get(trKatla(ad)) ?? "";
      harita.set(trKatla(ad), { value: ad, label: ad, badge: kod, keywords: kod ? [kod] : [] });
    }
    if (firma && !harita.has(trKatla(firma))) {
      harita.set(trKatla(firma), { value: firma, label: firma, badge: firmaKodu });
    }
    return [...harita.values()].sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [tedarikciler, kodlar, firma, firmaKodu]);

  const secenek = PAYMENT_TERMS.find((t) => t.value === vade);
  const vadeGunu =
    vade === OZEL ? Math.max(0, Math.round(parseNum(ozelGun) ?? 0)) : (secenek?.days ?? 0);
  const vadeBicimi = vade === OZEL ? "vadeli" : (secenek?.method ?? "pesin");

  const kurLazim = kurGerekli(paraBirimi);
  /** Kur kutusunun altındaki kaynak satırı — öneri bir kilit değil bir ipucu. */
  const kurOneri = kurLazim ? kurOnerisi(paraBirimi, sonKur) : null;
  const kurSayi = parseNum(kur);

  // ÜÇ TOPLAM: net (deftere yazılan), KDV, KDV dahil (kasadan çıkan).
  const toplamlar = useMemo(
    () =>
      vatTotals(
        satirlar.map((s) => ({
          net: (parseNum(s.adet) ?? 0) * (parseNum(s.fiyat) ?? 0),
          vatRate: s.kdv,
        }))
      ),
    [satirlar]
  );
  const kurBolen = kurLazim ? kurSayi : 1;
  const netEur = eurKarsiligi(toplamlar.net, paraBirimi, kurBolen);
  const brutEur = eurKarsiligi(toplamlar.gross, paraBirimi, kurBolen);

  /**
   * SÖZLÜ İSKONTO — hedef KDV hariç tutara göre birim fiyatları oranlar.
   *
   * Katsayı = hedef / mevcut net; her satırın birim fiyatı bununla çarpılır.
   * Fiyatı girilmemiş satır (null) atlanır — sıfırla çarpmak onu "bedava"
   * yapardı. Yuvarlama satır fiyatındadır (4 hane); toplam hedeften kuruş
   * sapabilir ama birim fiyatlar tedarikçiye yazılabilir sayılar kalır.
   */
  function iskontoUygula(ham: string) {
    const hedef = parseNum(ham);
    const mevcut = toplamlar.net;
    if (hedef == null || hedef <= 0 || mevcut <= 0) return;
    const katsayi = hedef / mevcut;
    if (Math.abs(katsayi - 1) < 1e-9) return;
    setSatirlar((o) =>
      o.map((s) => {
        const f = parseNum(s.fiyat);
        if (f == null) return s;
        return { ...s, fiyat: String(Number((f * katsayi).toFixed(4))) };
      })
    );
  }

  // AVANS KDV DAHİL TUTARDAN HESAPLANIR: peşinat kasadan çıkan paranın bir
  // yüzdesidir ve tedarikçi faturanın tamamı üzerinden ister. Elle yazılmış
  // tutar yine yüzdeyi yener (`advanceAmount`).
  const avans = advanceAmount(toplamlar.gross, parseNum(avansYuzde), parseNum(avansTutar));
  const odeme = odemeGunu({
    dueAt: termin || null,
    receivedAt: null,
    paymentTermDays: vadeBicimi === "vadeli" ? vadeGunu : 0,
  });

  /** Numara başka bir siparişte kullanılıyor mu? Kaydetmeyi ENGELLER. */
  const noCakisiyor = siparisNoCakisiyorMu(siparisNo, siparisNolari);

  const gecerli =
    firma.trim().length > 0 &&
    siparisTarihi.length > 0 &&
    satirlar.length > 0 &&
    satirlar.every((s) => (parseNum(s.adet) ?? 0) > 0) &&
    (!kurLazim || (kurSayi != null && kurSayi > 0)) &&
    (vadeBicimi !== "vadeli" || vadeGunu > 0) &&
    !noCakisiyor;

  function guncelle(i: number, yama: Partial<Satir>) {
    setSatirlar((o) => o.map((s, j) => (j === i ? { ...s, ...yama } : s)));
  }

  /** Kod değişince numara önerisi tazelenir — kutuya dokunulmadıysa. */
  function koduUygula(kod: string) {
    setFirmaKodu(kod);
    if (!noDokunuldu) setSiparisNo(siparisNoOner(kod, siparisNolari, siparisTarihi));
  }

  function firmaSec(ad: string) {
    setFirma(ad);
    setYeniFirmaKodu("");
    koduUygula(kodlar.get(trKatla(ad)) ?? "");
  }

  /** Hızlı termin — sipariş tarihinden itibaren kaç hafta. */
  function terminSec(deger: string) {
    setTerminSecimi(deger);
    if (deger === TERMIN_YOK) setTermin("");
    else if (deger !== TERMIN_SERBEST) setTermin(gunEkle(siparisTarihi, Number(deger)));
  }

  function siparisTarihiYaz(deger: string) {
    setSiparisTarihi(deger);
    // Hafta seçiliyken sipariş tarihi değişirse termin ONA GÖRE kayar: "altı
    // hafta sonra" bir tarih değil bir mesafedir.
    if (deger && terminSecimi !== TERMIN_YOK && terminSecimi !== TERMIN_SERBEST) {
      setTermin(gunEkle(deger, Number(terminSecimi)));
    }
    // NUMARA ÖNEKİ AY-YIL TAŞIR (md. 9): tarih değişince öneri tazelenir —
    // kutuya dokunulmadıysa.
    if (deger && !noDokunuldu) setSiparisNo(siparisNoOner(firmaKodu, siparisNolari, deger));
  }

  /**
   * Yazılan yeni firmayı deftere yazar ve seçer.
   *
   * Kullanıcının cümlesi net: *"yeni bir tedarikçi ismi girilirse, otomatik
   * yeni bir tedarikçi açılsın."* Kayıt KAYDETMEDEN ÖNCE yapılır çünkü sipariş
   * numarası firmanın kodundan türüyor; sipariş kaydedilirken yazılsaydı numara
   * alanı o ana kadar boş kalır ve kullanıcı elle bir şey uydururdu.
   */
  function firmaOlustur(ad: string) {
    const temiz = ad.trim();
    if (temiz.length < 2 || firmaYaziliyor) return;
    setFirmaYaziliyor(true);
    ensureSupplier({ name: temiz })
      .then((sonuc) => {
        if (sonuc.error || !sonuc.name) {
          toast.error(sonuc.error ?? "Tedarikçi oluşturulamadı.");
          return;
        }
        const kayitliAd = sonuc.name;
        const kod = sonuc.code ?? "";
        setKodlar((o) => new Map(o).set(trKatla(kayitliAd), kod));
        setFirma(kayitliAd);
        koduUygula(kod);
        if (sonuc.ok) {
          setYeniFirmaKodu(kod);
          toast.success(`${kayitliAd} tedarikçi defterine eklendi${kod ? ` · ${kod}` : ""}.`);
        }
      })
      .finally(() => setFirmaYaziliyor(false));
  }

  function kaydet() {
    if (!gecerli) return;
    basla(async () => {
      // BİR KALEM BİRDEN ÇOK İŞE GİDİYORSA SATIR BÖLÜNÜR. Sipariş tek olsa da
      // satırlar iş kalemine bağlı kalmalıdır: hangi projeye ne kadar
      // düştüğü sonradan hesaplanamaz, o an bilinir. Adet paylara ORANLA
      // dağıtılır ve yuvarlama farkı SON satıra eklenir — toplam hiçbir zaman
      // kaymaz.
      const lines: OrderLineInput[] = [];
      for (const s of satirlar) {
        const adet = parseNum(s.adet) ?? 0;
        const fiyat = parseNum(s.fiyat);
        const paylar = s.paylar.filter((p) => p.packageId);
        const payToplami = paylar.reduce((t, p) => t + p.adet, 0);

        if (paylar.length === 0 || payToplami <= 0) {
          lines.push({
            matchKey: s.matchKey,
            sample: s.tanim,
            itemNo: "",
            packageId: null,
            partKey: "",
            qty: adet,
            unit: s.birim,
            unitPrice: fiyat,
            vatRate: s.kdv,
            quality: s.kalite,
            note: s.not,
          });
          continue;
        }

        let dagitilan = 0;
        paylar.forEach((p, i) => {
          const son = i === paylar.length - 1;
          const pay = son
            ? Math.max(0, adet - dagitilan)
            : Math.round((adet * p.adet) / payToplami);
          dagitilan += pay;
          if (pay <= 0) return;
          lines.push({
            matchKey: s.matchKey,
            sample: s.tanim,
            itemNo: p.itemNo,
            packageId: p.packageId,
            partKey: p.partKey,
            qty: pay,
            unit: s.birim,
            unitPrice: fiyat,
            vatRate: s.kdv,
            quality: s.kalite,
            note: s.not,
          });
        });
      }

      const sonuc = await createOrder({
        orderNo: siparisNo,
        supplier: firma,
        orderedAt: siparisTarihi,
        dueAt: termin,
        paymentMethod: vadeBicimi,
        paymentTermDays: vadeBicimi === "vadeli" ? vadeGunu : 0,
        advancePct: parseNum(avansYuzde),
        advanceAmount: parseNum(avansTutar),
        currency: paraBirimi,
        fxRate: kurLazim ? kurSayi : 1,
        note: not,
        lines,
      });

      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(
        sonuc.ok
          ? `Sipariş açıldı; ${formatNum(sonuc.ok)} kalem paket ekranında “satın alındı” işaretlendi.`
          : "Sipariş açıldı."
      );
      onSaved();
    });
  }

  const terminGun = gunFarki(termin);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={`sm:max-w-[min(72rem,calc(100%-2rem))] ${TAM_BOY_PENCERE}`}>
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <DialogTitle className="text-base">Sipariş Aç</DialogTitle>
              {/* ALT BAŞLIK YOK (kullanıcı kararı, 13.08.2026). `DialogDescription`
                  erişilebilirlik için gereklidir ama EKRANDA görünmez: Radix
                  `aria-describedby` bağını arar ve bulamayınca uyarı basar. */}
              <DialogDescription className="sr-only">
                Seçili kalemler için tek tedarikçiye sipariş açar.
              </DialogDescription>
            </div>
            {/* Sarf girişinin başlık şeridiyle aynı: karar verdiren sayı
                başlığın hizasında durur ve aşağı kaydırmak gerekmez. */}
            <div className="text-right">
              <div className="font-mono text-sm font-semibold tabular-nums">
                {netEur == null ? "—" : fmtMoney(netEur, "EUR")}
              </div>
              <div className="text-[11px] text-muted-foreground">KDV hariç Avro karşılığı</div>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-3">
          {/* ————————————————————————————————— künye */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_10rem_9rem]">
            <div className="grid content-start gap-1.5">
              <Label>Tedarikçi</Label>
              <span className="relative flex items-center">
                <Combobox
                  options={firmaSecenekleri}
                  value={firma || null}
                  onChange={firmaSec}
                  onCreate={firmaOlustur}
                  createLabel="Yeni tedarikçi"
                  placeholder="Tedarikçi seçin veya yazın"
                  searchPlaceholder="Firma adı veya TD kodu…"
                  className="h-9 text-base pointer-fine:text-sm"
                />
                {firmaYaziliyor && (
                  <Loader2 className="pointer-events-none absolute right-7 size-4 animate-spin text-muted-foreground" />
                )}
              </span>
              {/* Kod bir SONUÇtur, bir alan değil: kullanıcı onu yazmaz, defter
                  verir ve sipariş numarası ondan türer. */}
              <span className="font-mono text-[10px] text-muted-foreground">
                {firmaKodu
                  ? `${firmaKodu}${yeniFirmaKodu ? " · yeni firma deftere eklendi" : ""}`
                  : firma.trim()
                    ? "Defterde kodu yok — kaydedilirken eklenecek"
                    : ""}
              </span>
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="siparis-no">Sipariş No</Label>
              <Input
                id="siparis-no"
                value={siparisNo}
                onChange={(e) => {
                  setNoDokunuldu(true);
                  setSiparisNo(e.target.value);
                }}
                maxLength={60}
                placeholder={firmaKodu ? "" : "—"}
                aria-invalid={noCakisiyor}
                className="h-9 font-mono text-base pointer-fine:text-sm"
              />
              {noCakisiyor && (
                <span className="text-[10px] text-destructive">Bu numara zaten kullanılmış.</span>
              )}
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="siparis-tarihi">Sipariş Tarihi</Label>
              <Input
                id="siparis-tarihi"
                type="date"
                value={siparisTarihi}
                onChange={(e) => siparisTarihiYaz(e.target.value)}
                className="h-9 font-mono text-base pointer-fine:text-sm"
              />
            </div>
          </div>

          {/* ————————————————————————————————— para birimi + kur */}
          <div className="grid gap-3 border bg-muted/30 p-3 sm:grid-cols-[10rem_10rem_1fr]">
            <div className="grid content-start gap-1.5">
              <Label>Para Birimi</Label>
              <Select
                value={paraBirimi}
                onValueChange={(v) => {
                  // PARA BİRİMİ VE KUR BİRLİKTE DEĞİŞİR: dolardan liraya
                  // geçilip kur alanı 1,08'de kalsaydı sipariş otuz kat ucuz
                  // kaydedilirdi (quote-dialog'daki kuralın aynısı).
                  const yeni = currencyOf(v);
                  setParaBirimi(yeni);
                  const o = kurOnerisi(yeni, sonKur);
                  setKur(o ? kurMetni(o.kur) : "");
                }}
              >
                <SelectTrigger className="w-full text-base pointer-fine:text-sm">
                  <SelectValue>
                    {paraBirimi} · {CURRENCY_LABELS[paraBirimi]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c} · {CURRENCY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="siparis-kur">1 € = ?</Label>
              <Input
                id="siparis-kur"
                value={kurLazim ? kur : "1"}
                onChange={(e) => setKur(e.target.value)}
                inputMode="decimal"
                disabled={!kurLazim}
                className="h-9 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
              />
            </div>
            <div className="self-end text-[12px] text-muted-foreground">
              1 EUR = {kurLazim ? kur || "—" : "1"} {paraBirimi}
              {kurOneri && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => setKur(kurMetni(kurOneri.kur))}
                    title={`TCMB ${tarihGoster(kurOneri.gun)} — dokunmak kutuyu bu kurla doldurur`}
                    className="underline-offset-2 hover:text-foreground hover:underline"
                  >
                    {tarihGoster(kurOneri.gun)} · {kurMetni(kurOneri.kur)}
                    {kurOneri.yas > 3 ? ` (${formatNum(kurOneri.yas)} gün önce)` : ""}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ————————————————————————————————— termin + ödeme koşulu */}
          <div className="grid gap-3 border bg-muted/30 p-3 lg:grid-cols-[minmax(16rem,1fr)_minmax(14rem,1fr)_minmax(16rem,1fr)]">
            <div className="grid content-start gap-1.5">
              <Label>Hızlı Termin</Label>
              <Select value={terminSecimi} onValueChange={terminSec}>
                <SelectTrigger className="w-full text-base pointer-fine:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* TERMİN İSTEĞE BAĞLIDIR (kullanıcı kararı, 13.08.2026):
                      boş bırakılan bir alan, unutulmuş mu yoksa bilinmiyor mu,
                      ekrandan anlaşılmalıdır. */}
                  <SelectItem value={TERMIN_YOK}>Termin Yok</SelectItem>
                  <SelectItem value="0">Hemen</SelectItem>
                  {DELIVERY_WEEKS.map((hafta) => (
                    <SelectItem key={hafta} value={String(hafta * 7)}>
                      {hafta} hafta
                    </SelectItem>
                  ))}
                  <SelectItem value={TERMIN_SERBEST}>Tarih Seç</SelectItem>
                </SelectContent>
              </Select>
              <Input
                aria-label="Termin tarihi"
                type="date"
                value={termin}
                onChange={(e) => {
                  setTermin(e.target.value);
                  setTerminSecimi(e.target.value ? TERMIN_SERBEST : TERMIN_YOK);
                }}
                className="font-mono text-base pointer-fine:text-sm"
              />
            </div>

            <div className="grid content-start gap-1.5">
              <Label>Ödeme Vadesi</Label>
              <Select value={vade} onValueChange={setVade}>
                <SelectTrigger className="w-full text-base pointer-fine:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                  {/* Liste KAPALI DEĞİLDİR: 120 gün için migration yazmak
                      gerekmemeli (SALE_SCOPES kuralının aynısı). */}
                  <SelectItem value={OZEL}>Diğer (Gün Gir)</SelectItem>
                </SelectContent>
              </Select>
              {vade === OZEL && (
                <Input
                  aria-label="Özel vade gün sayısı"
                  value={ozelGun}
                  onChange={(e) => setOzelGun(e.target.value)}
                  inputMode="numeric"
                  placeholder="Örn. 120"
                  className="font-mono text-base tabular-nums pointer-fine:text-sm"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <span className="grid gap-1.5">
                  <Label className="text-[11px]">Avans %</Label>
                  <Select
                    value={avansYuzde || "yok"}
                    onValueChange={(v) => setAvansYuzde(v === "yok" ? "" : v)}
                  >
                    <SelectTrigger size="sm" className="w-full text-base pointer-fine:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yok">Yok</SelectItem>
                      {ADVANCE_PERCENTS.map((p) => (
                        <SelectItem key={p} value={String(p)}>
                          %{p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </span>
                <span className="grid gap-1.5">
                  <Label className="text-[11px]" htmlFor="avans-tutar">
                    Veya Avans Tutarı
                  </Label>
                  <Input
                    id="avans-tutar"
                    value={avansTutar}
                    onChange={(e) => setAvansTutar(e.target.value)}
                    inputMode="decimal"
                    className="h-8 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                  />
                </span>
              </div>
            </div>

            {/* ÖDEME GÜNÜ CANLI HESAPLANIR — kuralın kendisi ekranda görünür. */}
            <div className="grid content-start gap-1.5">
              <Label>Planlanan Ödeme</Label>
              <div className="min-h-10 border-l-2 border-primary/40 bg-primary/[0.04] px-3 py-2 text-sm">
                <strong>{odeme ? tarihGoster(odeme) : "—"}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {vadeBicimi === "vadeli" ? (
                    termin ? (
                      <>
                        Termin {tarihGoster(termin)} + {vadeGunu} gün vade
                        {terminGun != null && ` · termine ${terminGun} gün`}
                      </>
                    ) : (
                      <>
                        Vade {vadeGunu} gün — ödeme günü TERMİNDEN sayılır, sipariş tarihinden
                        değil. Termin girilmeden hesaplanamaz.
                      </>
                    )
                  ) : (
                    <>
                      Peşin/kredi kartı: ödeme{" "}
                      {termin ? tarihGoster(termin) : "teslim günü"} yapılır.
                    </>
                  )}
                </span>
              </div>
              {avans > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Avans <strong>{fmtMoney(avans, paraBirimi)}</strong> sipariş günü (
                  {tarihGoster(siparisTarihi)}) ödenir · KDV dahil tutardan.
                </span>
              )}
            </div>
          </div>

          {/* ————————————————————————————————— kalemler
              ÇİFT SCROLL YOK (kullanıcı bildirimi, 14.08.2026): kalem
              bölümünün kendi dikey kaydırması kaldırıldı; pencerenin tamamı
              tek bir kaydırma kabıdır (DialogContent). Yalnız yatay taşma
              (dar ekranda 46rem tablo) kendi içinde kayar. Başlık ARTIK
              OPAKtır (`bg-muted`, yarı saydam + backdrop-blur değil): kaydırma
              sırasında satırdaki KDV açılırının başlığın içinden görünüp iç
              içe geçmesinin sebebi yarı saydam zemindi. */}
          <div className="oc-scrollx overflow-x-auto border [--oc-scroll-bg:var(--card)]">
            <table className="w-full min-w-[58rem] text-[12px]">
              <thead className="sticky top-0 z-20 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-normal">Kalem</th>
                  <th className="w-40 px-2 py-1.5 text-left font-normal">Marka/Kalite</th>
                  <th className="w-20 px-2 py-1.5 text-right font-normal">Adet</th>
                  <th className="w-28 px-2 py-1.5 text-right font-normal">
                    Birim Fiyat <span className="block text-[10px]">(KDV hariç)</span>
                  </th>
                  <th className="w-20 px-2 py-1.5 text-left font-normal">KDV</th>
                  <th className="w-28 px-2 py-1.5 text-right font-normal">Tutar</th>
                  <th className="w-28 px-2 py-1.5 text-right font-normal">KDV Dahil</th>
                  <th className="w-8 px-1 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s, i) => {
                  const a = parseNum(s.adet) ?? 0;
                  const fi = parseNum(s.fiyat) ?? 0;
                  const net = a * fi;
                  return (
                    <tr key={s.matchKey} className="border-t">
                      <td className="px-2 py-1.5">
                        <span className="block">{s.tanim}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {[...new Set(s.paylar.map((p) => p.itemNo).filter(Boolean))].join(" · ") ||
                            "iş kalemi yok"}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <Combobox
                          options={kaliteSecenekleri}
                          value={s.kalite || null}
                          onChange={(v) => guncelle(i, { kalite: v })}
                          onCreate={(name) => kaliteEkle(i, name)}
                          createLabel="Yeni marka/kalite"
                          placeholder="—"
                          searchPlaceholder="Marka/Kalite ara veya yaz…"
                          className="h-8 text-base pointer-fine:text-sm"
                          contentClassName="w-[min(24rem,calc(100vw-1.5rem))]"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={s.adet}
                          onChange={(e) => guncelle(i, { adet: e.target.value })}
                          inputMode="numeric"
                          className="h-8 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                          aria-label={`${s.tanim} adedi`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={s.fiyat}
                          onChange={(e) => guncelle(i, { fiyat: e.target.value })}
                          inputMode="decimal"
                          className="h-8 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                          aria-label={`${s.tanim} birim fiyatı (KDV hariç)`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select
                          value={String(s.kdv)}
                          onValueChange={(v) => guncelle(i, { kdv: Number(v) as VatRate })}
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-full px-2 font-mono text-base pointer-fine:text-sm"
                            aria-label={`${s.tanim} KDV oranı`}
                          >
                            <SelectValue>%{s.kdv}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {VAT_RATES.map((oran) => (
                              <SelectItem key={oran} value={String(oran)}>
                                %{oran}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {fmtMoney(net, paraBirimi)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-medium tabular-nums">
                        {fmtMoney(net * (1 + s.kdv / 100), paraBirimi)}
                      </td>
                      <td className="px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => setSatirlar((o) => o.filter((_, j) => j !== i))}
                          aria-label={`${s.tanim} kalemini çıkar`}
                          className="grid size-7 place-items-center text-muted-foreground transition-colors pointer-coarse:size-9 hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ————————————————————————————————— toplamlar
              TEK SÜTUN (kullanıcı bildirimi, 14.08.2026: "iki kere yazıyor
              gerek yok, tek olsun"): yerel para ile avro aynı kolonda
              yazılıyordu; avro yalnız para birimi avro DIŞINDAYSA ikincil bir
              satır olur.

              KDV HARİÇ TUTAR DÜZENLENEBİLİR — SÖZLÜ İSKONTO (kullanıcı isteği):
              *"birim fiyatları 500 girdim, sonra 450 anlaştık; KDV hariç tutara
              450 yazınca birim fiyatlar o oranda düşsün."* Alana yazılan hedef
              net, mevcut nete oranlanır ve bütün birim fiyatlar aynı katsayıyla
              çarpılır. Değer `key` ile tazelenir (bir `useEffect` DEĞİL —
              projenin `TerminAlani` deseni): satırlar değişince kutu yeni net
              ile yeniden kurulur, kullanıcının yazdığını efekt ezmez. */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid min-w-[12rem] flex-1 gap-1.5">
              <Label htmlFor="siparis-not">Not (İsteğe Bağlı)</Label>
              <Input
                id="siparis-not"
                value={not}
                onChange={(e) => setNot(e.target.value)}
                maxLength={1000}
                className="h-9 text-base pointer-fine:text-sm"
              />
            </div>
            <div className="grid w-full gap-1.5 text-sm sm:w-auto sm:min-w-[20rem]">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="siparis-net" className="text-muted-foreground">
                  KDV Hariç Tutar
                </Label>
                <Input
                  id="siparis-net"
                  key={`net-${Math.round(toplamlar.net * 100)}`}
                  defaultValue={toplamlar.net > 0 ? String(Number(toplamlar.net.toFixed(2))) : ""}
                  onBlur={(e) => iskontoUygula(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      iskontoUygula((e.target as HTMLInputElement).value);
                    }
                  }}
                  inputMode="decimal"
                  aria-label="KDV hariç tutar — yeni değer yazınca birim fiyatlar oranlanır"
                  className="h-8 w-32 text-right font-mono text-base tabular-nums pointer-fine:text-sm"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">KDV</span>
                <span className="font-mono tabular-nums">{fmtMoney(toplamlar.vat, paraBirimi)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t pt-1">
                <span className="font-semibold">KDV Dahil Tutar</span>
                <span className="font-mono font-semibold tabular-nums">
                  {fmtMoney(toplamlar.gross, paraBirimi)}
                </span>
              </div>
              {paraBirimi !== "EUR" && (
                <div className="text-right font-mono text-[11px] text-muted-foreground">
                  ≈ {netEur == null ? "—" : fmtMoney(netEur, "EUR")} ·{" "}
                  {brutEur == null ? "—" : fmtMoney(brutEur, "EUR")} dahil
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                İskonto: KDV Hariç Tutar’a yeni değer yazın; birim fiyatlar aynı oranda düşer.
                Fiyat arşivi ve panolar KDV hariç okur.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={calisiyor}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={!gecerli || calisiyor}>
            {calisiyor && <Loader2 className="size-4 animate-spin" />}
            Siparişi Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
