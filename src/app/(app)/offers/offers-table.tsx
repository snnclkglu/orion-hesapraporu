"use client";

// TEKLİF TAKİBİ — liste, süzgeçler, özet şeridi ve satır eylemleri.
//
// Kullanıcı kararı (17.08.2026): *"tekliflerin listelendiği sayfayı bir teklif
// takibi sayfası olarak kullanmak istiyorum."* Sayfa bu yüzden yalnız bir
// döküm değil bir ÇALIŞMA EKRANIdır: gönderimden bu yana geçen süre satırın
// üstünde durur, sıra en son gönderilenden başlar ve süzgeçler "kimi aramam
// gerekiyor"u tek tıkla verir.
//
// SÜZGEÇ KURALI TEKTİR (`lib/offers/filter.ts`): tablo, özet şeridi ve seçenek
// listeleri aynı fonksiyonlardan geçer. İki süzgeç yazılsaydı başlıktaki sayı
// ile listedeki satırlar sessizce ayrışırdı.
//
// SATIR RENGİ MÜŞTERİNİNDİR (*"farklı müşteri teklifleri satırda farklı renk
// görünsün"*). Ton defterdeki `color_hue`dur; defterde karşılığı olmayan ad
// metinden türetilir, yani satır hiçbir zaman renksiz kalmaz. Renk TEK TAŞIYICI
// DEĞİLDİR: aynı bilgi müşteri çipinde yazıyla da durur.

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, FileText, Search, Send, Trophy, X } from "lucide-react";
import { CokluSuzgec } from "@/app/(app)/purchasing/filters";
import { StatCard } from "@/components/stat-card";
import { CustomerTag } from "@/components/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { fmtMoney, fmtNum } from "@/lib/currency";
import { customerTag, tagStyle } from "@/lib/tags";
import {
  CAPACITY_BANDS,
  DEFAULT_OFFER_SORT,
  EMPTY_OFFER_FILTER,
  TAKIP_BANDS,
  effectiveOfferDate,
  fmtOfferDate,
  matchesOfferFilters,
  offerFacets,
  sortOffers,
  type OfferFilterInput,
  type OfferSort,
  type OfferSortKey,
} from "@/lib/offers/filter";
import { OFFER_STATUSES, offerStatusHue, offerStatusLabel, offerStatusOf } from "@/lib/offers/status";
import { takipGorunur, takipYasi } from "@/lib/offers/takip";
import { offerRevLabel } from "@/lib/offers/no";
import type { CustomerOption, OfferListEntry } from "./data";
import { OfferRowActions } from "./offer-row-actions";

/**
 * SÜTUN GENİŞLİKLERİ YÜZDEDİR ÇÜNKÜ TABLO `table-fixed` (MOBIL-16).
 *
 * Kullanıcı bildirimi (22.08.2026): *"teklifler sayfasında yatayda kaydırma
 * olmasın. geniş olduğunda Konu ve Kapsam yazılar uzunsa belli bir uzunluktan
 * sonra ... üç nokta olarak görünsün."*
 *
 * Tablo `auto` düzendeyken uzun bir KONU metni bütün çizelgeyi ekranın dışına
 * itiyordu: `max-w-[22rem]` yalnız o hücreye TAVAN koyuyor, geri kalan yedi
 * sütunun `whitespace-nowrap`ı ise taban genişliği yukarı çekiyordu. Sabit
 * ızgara tabanı bütünüyle kaldırır — esnek iki sütun (Konu, Kapsam) artan
 * yeri paylaşır ve sığmayan metin ÜÇ NOKTAYLA kesilir.
 *
 * Yüzdeler toplamı 100'dür; değiştiren kişi toplamı da korumalıdır.
 */
const SIRA_BASLIKLARI: { key: OfferSortKey; label: string; sag?: boolean; en: string }[] = [
  { key: "no", label: "Teklif No", en: "w-[15%]" },
  { key: "musteri", label: "Müşteri", en: "w-[7%]" },
  { key: "tarih", label: "Tarih", en: "w-[12%]" },
  { key: "durum", label: "Durum", en: "w-[10%]" },
  { key: "tutar", label: "Tutar", sag: true, en: "w-[9%]" },
];

export function OffersTable({
  rows,
  customers,
  bugun,
}: {
  rows: readonly OfferListEntry[];
  customers: readonly CustomerOption[];
  /**
   * SUNUCUDAN GELİR. İstemcide `new Date()` çağırmak, sunucu boyamasıyla
   * istemci boyamasının farklı gün üretebileceği (gece yarısı, farklı saat
   * dilimi) bir hidrasyon uyuşmazlığı açardı.
   */
  bugun: string;
}) {
  const [filtre, setFiltre] = useState<OfferFilterInput>({ ...EMPTY_OFFER_FILTER, bugun });
  const [sira, setSira] = useState<OfferSort>(DEFAULT_OFFER_SORT);

  const secenekler = useMemo(() => offerFacets(rows), [rows]);

  const suzulmus = useMemo(
    () => sortOffers(rows.filter((r) => matchesOfferFilters(r, filtre)), sira),
    [rows, filtre, sira]
  );

  // ÖZET SÜZÜLMÜŞ SATIRLARDAN çıkar: kullanıcı "ETİ BAKIR" seçtiğinde şeritte
  // o müşterinin rakamlarını görmelidir, firmanın tamamının değil.
  const ozet = useMemo(() => {
    const bekleyen = suzulmus.filter((r) => takipGorunur(r.status, r.issuedOn));
    const gecikmis = bekleyen.filter((r) => takipYasi(r.issuedOn!, bugun).gun >= 14);
    const kazanilan = suzulmus.filter((r) => offerStatusOf(r.status) === "won");
    // AVRO SATIRLARI TOPLANIR, karışık para birimi TOPLANMAZ: kuru olmayan bir
    // tutarı avroya çevirmek uydurma bir sayı üretirdi (Satış Takibi'nin
    // kuralı). Farklı para birimindeki satırlar ayrıca sayılır.
    const avro = suzulmus.filter((r) => r.currency === "EUR" && r.latestTotal !== null);
    const digerPara = suzulmus.filter((r) => r.currency !== "EUR" && r.latestTotal !== null);
    return {
      toplam: suzulmus.length,
      bekleyen: bekleyen.length,
      gecikmis: gecikmis.length,
      kazanilan: kazanilan.length,
      avroTutar: avro.reduce((n, r) => n + (r.latestTotal ?? 0), 0),
      avroAdet: avro.length,
      digerPara: digerPara.length,
    };
  }, [suzulmus, bugun]);

  const suzgecVar =
    filtre.q.trim() !== "" ||
    filtre.yil !== "tumu" ||
    filtre.musteri.length > 0 ||
    filtre.durum.length > 0 ||
    filtre.vincTipi.length > 0 ||
    filtre.tonaj.length > 0 ||
    filtre.takip.length > 0;

  function siralaIle(key: OfferSortKey) {
    setSira((s) =>
      s.key === key ? { key, desc: !s.desc } : { key, desc: key === "tarih" || key === "tutar" }
    );
  }

  return (
    <div className="grid gap-4">
      {/* ————————————————————————————————————————————— özet şeridi */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Teklif" value={fmtNum(ozet.toplam)} hint="Süzgeçten geçen" icon={FileText} dense />
        <StatCard
          label="Bekleyen"
          value={fmtNum(ozet.bekleyen)}
          hint={ozet.gecikmis > 0 ? `${ozet.gecikmis} tanesi 2 haftadan eski` : "Gönderildi, cevap bekliyor"}
          icon={ozet.gecikmis > 0 ? BellRing : Send}
          dense
        />
        <StatCard label="Kazanılan" value={fmtNum(ozet.kazanilan)} icon={Trophy} dense />
        <StatCard
          label="Toplam (Avro)"
          value={ozet.avroAdet ? fmtMoney(ozet.avroTutar, "EUR") : "—"}
          hint={
            ozet.digerPara > 0
              ? `${ozet.avroAdet} teklif · ${ozet.digerPara} teklif başka para biriminde`
              : `${ozet.avroAdet} teklif`
          }
          icon={FileText}
          dense
        />
      </div>

      {/* ————————————————————————————————————————————— süzgeçler */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filtre.q}
            onChange={(e) => setFiltre((f) => ({ ...f, q: e.target.value }))}
            aria-label="Teklif ara"
            className="h-9 pl-8 text-base pointer-fine:text-sm"
          />
        </div>

        <CokluSuzgec
          baslik="Takip"
          secenekler={TAKIP_BANDS.map((b) => ({ value: b.key, label: b.label }))}
          secili={filtre.takip}
          onChange={(v) => setFiltre((f) => ({ ...f, takip: v }))}
        />
        <CokluSuzgec
          baslik="Yıl"
          secenekler={secenekler.yillar.map((y) => ({ value: y, label: y }))}
          secili={filtre.yil === "tumu" ? [] : [filtre.yil]}
          onChange={(v) => setFiltre((f) => ({ ...f, yil: v.length ? v[v.length - 1] : "tumu" }))}
        />
        <CokluSuzgec
          baslik="Müşteri"
          secenekler={secenekler.musteriler.map((m) => ({
            value: m,
            label: customerTag({ name: m, shortName: kisaltma(customers, m) }).short,
          }))}
          secili={filtre.musteri}
          onChange={(v) => setFiltre((f) => ({ ...f, musteri: v }))}
        />
        <CokluSuzgec
          baslik="Durum"
          secenekler={OFFER_STATUSES.map((s) => ({ value: s, label: offerStatusLabel(s) }))}
          secili={filtre.durum}
          onChange={(v) => setFiltre((f) => ({ ...f, durum: v }))}
        />
        <CokluSuzgec
          baslik="Vinç Tipi"
          secenekler={secenekler.vincTipleri.map((t) => ({ value: t, label: t }))}
          secili={filtre.vincTipi}
          onChange={(v) => setFiltre((f) => ({ ...f, vincTipi: v }))}
        />
        <CokluSuzgec
          baslik="Tonaj"
          secenekler={CAPACITY_BANDS.map((b) => ({ value: b.key, label: b.label }))}
          secili={filtre.tonaj}
          onChange={(v) => setFiltre((f) => ({ ...f, tonaj: v }))}
        />

        {suzgecVar ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="oc-tap h-9"
            onClick={() => setFiltre({ ...EMPTY_OFFER_FILTER, bugun })}
          >
            <X className="size-3.5" /> Temizle
          </Button>
        ) : null}
      </div>

      {/* ————————————————————————————————————————————— tablo */}
      {suzulmus.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? "HENÜZ TEKLİF YOK" : "SÜZGECE UYAN TEKLİF YOK"}
          description={
            rows.length === 0
              ? "Yeni Teklif ile ilk teklifi açın; numarası bugünün tarihinden üretilir."
              : "Süzgeçleri temizleyerek tüm teklifleri görebilirsiniz."
          }
        />
      ) : (
        <>
          {/* Masaüstü: çizelge. Telefonda gizlenir — ana tablo yatay KAYMAZ. */}
          <div className="hidden md:block">
            {/* YATAY KAYDIRMA KAPALI: sabit ızgara zaten sığdırır ve kap bir
                kaydırıcı açarsa metin kesilmek yerine ekran dışına giderdi. */}
            <Table className="table-fixed" containerClassName="!overflow-x-hidden">
              <TableHeader>
                <TableRow>
                  {SIRA_BASLIKLARI.map((s) => (
                    <TableHead key={s.key} className={cn(s.en, s.sag && "text-right")}>
                      <button
                        type="button"
                        onClick={() => siralaIle(s.key)}
                        className="oc-tap inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {s.label}
                        {sira.key === s.key ? <span aria-hidden>{sira.desc ? "↓" : "↑"}</span> : null}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="w-[23%]">Konu</TableHead>
                  <TableHead className="w-[20%]">Kapsam</TableHead>
                  <TableHead className="w-[4%]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suzulmus.map((row) => {
                  const tag = customerTag({
                    name: row.customer_name,
                    shortName: row.customerShort,
                    hue: row.customerHue,
                  });
                  return (
                    <TableRow key={row.id} className="oc-row-hue" style={tagStyle(tag.hue)}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        <Link href={`/offers/${row.id}`} className="hover:underline">
                          {row.offer_no}
                        </Link>
                        {row.latestRevNo ? (
                          <span className="ml-1.5 text-muted-foreground">
                            {offerRevLabel(row.latestRevNo)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <CustomerTag
                          name={row.customer_name}
                          shortName={row.customerShort}
                          hue={row.customerHue}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {fmtOfferDate(effectiveOfferDate(row))}
                          <TakipCipi row={row} bugun={bugun} />
                        </span>
                      </TableCell>
                      <TableCell>
                        <DurumCipi status={row.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {row.latestTotal === null ? "—" : fmtMoney(row.latestTotal, row.currency)}
                      </TableCell>
                      {/* TEK SATIR + ÜÇ NOKTA: `line-clamp-2` metni iki satıra
                          sarıyordu ve satır yüksekliği içeriğe göre değişiyordu.
                          Kullanıcı sığmayanın KESİLMESİNİ istedi; tam metin
                          `title`da durur, satır da hep aynı boyda kalır. */}
                      <TableCell>
                        <Link
                          href={`/offers/${row.id}`}
                          title={row.subject || undefined}
                          className="block truncate hover:underline"
                        >
                          {row.subject || "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <Kapsam row={row} />
                      </TableCell>
                      <TableCell className="px-1">
                        <OfferRowActions offer={row} customers={customers} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Telefon: tablo LİSTEYE katlanır (MOBIL kuralı). */}
          <ul className="grid gap-2 md:hidden">
            {suzulmus.map((row) => {
              const tag = customerTag({
                name: row.customer_name,
                shortName: row.customerShort,
                hue: row.customerHue,
              });
              return (
                <li key={row.id} className="oc-row-hue rounded-md border p-3" style={tagStyle(tag.hue)}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/offers/${row.id}`} className="grid gap-1">
                      <span className="font-mono text-xs">
                        {row.offer_no}
                        {row.latestRevNo ? (
                          <span className="ml-1.5 text-muted-foreground">
                            {offerRevLabel(row.latestRevNo)}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-medium">{row.subject || "—"}</span>
                    </Link>
                    <OfferRowActions offer={row} customers={customers} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <CustomerTag
                      name={row.customer_name}
                      shortName={row.customerShort}
                      hue={row.customerHue}
                    />
                    <DurumCipi status={row.status} />
                    <span className="text-muted-foreground">{fmtOfferDate(effectiveOfferDate(row))}</span>
                    <TakipCipi row={row} bugun={bugun} />
                    <span className="ml-auto font-mono">
                      {row.latestTotal === null ? "—" : fmtMoney(row.latestTotal, row.currency)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <Kapsam row={row} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

/** Defterdeki kısaltmayı adından bulur — süzgeç etiketleri de kısaltma gösterir. */
function kisaltma(customers: readonly CustomerOption[], name: string): string | null {
  return customers.find((c) => c.name === name)?.short_name ?? null;
}

function DurumCipi({ status }: { status: string }) {
  return (
    <span
      style={tagStyle(offerStatusHue(status))}
      className="oc-tag px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"
    >
      {offerStatusLabel(status)}
    </span>
  );
}

/**
 * TAKİP SAYACI — gönderimden bu yana geçen süre.
 *
 * Renk sarıdan kırmızıya iner (`takipTonu`); kural `lib/offers/takip.ts`tedir
 * ve buradan yalnız TON geçer, doygunluk/parlaklık `.oc-tag` kuralında ve tema
 * başına verilir. Sayaç yalnız gönderilmiş ve sonuçlanmamış tekliflerde
 * görünür — kazanılmış bir teklifin üstündeki "8 hafta" bir uyarı değil
 * gürültü olurdu.
 */
function TakipCipi({ row, bugun }: { row: OfferListEntry; bugun: string }) {
  if (!takipGorunur(row.status, row.issuedOn)) return null;
  const yas = takipYasi(row.issuedOn!, bugun);
  return (
    <span
      style={tagStyle(yas.hue)}
      title={`Gönderimden bu yana ${yas.gun} gün geçti`}
      className="oc-tag px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap"
    >
      {yas.etiket}
    </span>
  );
}

/**
 * Teklifin KAPSAMI: kaç kalem, hangi vinç tipleri, hangi tonajlar.
 *
 * Belgeyi açmadan "bu teklif neydi" sorusunu cevaplayan tek satır. Değerler
 * güncel revizyondan türetilir; ayrı bir alanda saklanmadıkları için belgeden
 * ayrışamazlar.
 */
function Kapsam({ row }: { row: OfferListEntry }) {
  const tipler = [...new Set(row.craneTypes)];
  const tonaj = [...new Set(row.capacities)].sort((a, b) => b - a);
  if (tipler.length === 0 && tonaj.length === 0) {
    return <span>{row.itemCount > 0 ? `${row.itemCount} kalem` : "—"}</span>;
  }
  // METİN BİR KEZ KURULUR: hem basılan hem `title`a giren aynı dizedir —
  // ikisini ayrı kurmak, birinin kısaltılıp ötekinin unutulması demekti.
  const metin = `${tonaj.length ? `${tonaj.map((t) => `${fmtNum(t)} t`).join(" · ")} — ` : ""}${tipler.join(" · ")}${
    row.itemCount > 1 ? ` (${row.itemCount} kalem)` : ""
  }`;
  return (
    <span className="block truncate" title={metin}>
      {metin}
    </span>
  );
}
