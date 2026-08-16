"use client";

// Paketin satın alma özeti — SALT OKUNUR tablo.
//
// EKRANIN CEVAPLADIĞI TEK SORU: *"bu ekipman satın alınmış mı, ne zaman
// gelir?"* Mühendis ve ressam `/purchasing` bölümünü görmüyor (kullanıcı
// kararı, 12.08.2026) ve bu bilgiyi bugüne kadar telefonla soruyordu.
//
// ————————————————————————————————— NE YOKSA O DA BİR KARARDIR
//
// Tabloda tedarikçi, fiyat, para birimi, kur ve ödeme koşulu SÜTUNU YOKTUR —
// ve bunlar "gösterilmiyor" değil, sunucudan HİÇ GELMİYOR: veri
// `drawing_purchase_summary(uuid)` fonksiyonundan çıkar ve o fonksiyonun sütun
// listesi güvenlik sınırının kendisidir. Gizlemekle getirmemek arasındaki fark
// budur ve bu ekranda ikincisi seçilmiştir.
//
// Hiçbir düğme, form ya da server action da yoktur. Sipariş vermek, teklif
// girmek ve "satın alındı" işaretlemek `/purchasing`in işidir; iki YAZAN ekran
// "hangisi doğru" sorusunu doğururdu (sekmenin bir kez kaldırılma sebebi).

import { useMemo, useState } from "react";
import { CalendarClock, PackageCheck, ShoppingCart, TriangleAlert } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/stat-card";
import { formatNum } from "@/lib/drawings/labels";
import { trKatla } from "@/lib/drawings/tr-text";
import { tarihGoster } from "@/lib/purchasing/terms";
import {
  DURUM_ETIKETLERI,
  DURUM_SIRASI,
  type OzetSatiri,
  type PaketOzeti,
  type SatinAlmaDurumu,
} from "@/lib/purchasing/package-summary";
import { FilterBar, SearchBox } from "../../sortable-head";

const TUMU = "__tumu__";

/**
 * Durum çipinin rengi.
 *
 * KIRMIZI YALNIZ GECİKMEDE. "Sipariş bekliyor" bir kusur değil bir haldir ve
 * kırmızıya boyanınca yeni açılmış her paket alarm tablosuna dönerdi — bu
 * modülün en büyük düşmanı yanlış alarmdır (md. 18/3). Kırmızı, gerçekten bir
 * şeyin geciktiği tek yerde durur ve o da satırın kendi rozetidir.
 */
const DURUM_SINIFI: Record<SatinAlmaDurumu, string> = {
  bekliyor: "border-border text-muted-foreground",
  siparis: "border-primary/40 text-primary",
  kismi: "border-amber-500/50 text-amber-600 dark:text-amber-400",
  teslim: "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
};

export function PurchaseSummaryTable({
  ozet,
  ozetKapisiVar,
}: {
  ozet: PaketOzeti;
  /** `drawing_purchase_summary` okunabildi mi (migration uygulandı mı)? */
  ozetKapisiVar: boolean;
}) {
  const [arama, setArama] = useState("");
  const [durum, setDurum] = useState<string>(TUMU);

  const gorunen = useMemo(() => {
    const q = trKatla(arama).trim();
    return ozet.satirlar.filter((s) => {
      if (durum !== TUMU && s.durum !== durum) return false;
      if (!q) return true;
      return (
        trKatla(s.tanim).includes(q) ||
        trKatla(s.parcaKodu).includes(q) ||
        trKatla(s.malzeme).includes(q) ||
        trKatla(s.sinif).includes(q)
      );
    });
  }, [ozet.satirlar, arama, durum]);

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Satın Alma Kalemi"
          value={formatNum(ozet.toplam)}
          hint={`${formatNum(ozet.bekleyen)} kalem henüz sipariş edilmedi`}
          icon={ShoppingCart}
        />
        {/* TERMİN "SİPARİŞTE" KARTININ İPUCUDUR, "TESLİM ALINDI"NIN DEĞİL:
            beklenen gün, bekleyen kalemin sorusudur. Gelmiş bir kalemin
            yanında termin göstermek okuyanı "bu daha gelmedi mi?" diye
            düşündürürdü. */}
        <StatCard
          label="Siparişte"
          value={formatNum(ozet.siparisVerilen)}
          hint={
            ozet.enYakinTermin
              ? `En yakın termin ${tarihGoster(ozet.enYakinTermin)}`
              : "Termin girilmemiş"
          }
          icon={CalendarClock}
        />
        <StatCard
          label="Teslim Alındı"
          value={formatNum(ozet.teslimAlinan)}
          hint={`${formatNum(ozet.toplam - ozet.teslimAlinan)} kalem bekleniyor`}
          icon={PackageCheck}
        />
        <StatCard
          label="Termini Geçen"
          value={formatNum(ozet.geciken)}
          hint={ozet.geciken > 0 ? "beklenen gün geçti, teslim yok" : "gecikme yok"}
          icon={TriangleAlert}
        />
      </div>

      {/* KAPI YOKSA SESSİZ KALINMAZ. Fonksiyon uygulanmadıysa her kalem
          "sipariş bekliyor" görünür ve bu, sipariş verilmemiş olmasıyla
          KARIŞIR — ekran farkı kendisi söyler (md. 18/2'nin ruhu: sistem ne
          bilmediğini de yazar). */}
      {!ozetKapisiVar && (
        <p className="border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
          Sipariş kayıtları okunamadı (veritabanı güncellemesi henüz
          uygulanmamış olabilir). Aşağıdaki liste defterden geliyor, sipariş ve
          teslim bilgisi eksik.
        </p>
      )}

      <FilterBar
        gorunen={gorunen.length}
        toplam={ozet.satirlar.length}
        temiz={!arama && durum === TUMU}
        onTemizle={() => {
          setArama("");
          setDurum(TUMU);
        }}
      >
        <SearchBox
          value={arama}
          onChange={setArama}
          placeholder="Tanım, Kod, Malzeme Ara…"
          className="w-[min(20rem,calc(100vw-4rem))]"
        />
        <Select value={durum} onValueChange={setDurum}>
          <SelectTrigger size="sm" className="w-auto min-w-[9rem] text-base pointer-fine:text-sm">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TUMU}>Durum: Tümü</SelectItem>
            {DURUM_SIRASI.map((d) => (
              <SelectItem key={d} value={d}>
                {DURUM_ETIKETLERI[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <p className="text-[11px] text-muted-foreground">
        Bu sayfa yalnız <strong>bilgilendirme</strong> içindir; sipariş, teklif
        ve işaretleme Satın Alma bölümünde yapılır. Fiyat ve tedarikçi bilgisi
        burada <strong>gösterilmez</strong>.
      </p>

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Bu süzgeçle eşleşen kalem yok. Süzgeci temizleyip yeniden deneyin.
          </p>
        </div>
      ) : (
        <div className="border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Tanım</TableHead>
                {/* Kullanıcı bildirimi 13.08.2026: "Satın alma bunların hangi
                    grup içerisinde olduğunu görmek istiyor." Sütun `md`den
                    açılır; dar ekranda birincil hücrenin altına iner. */}
                <TableHead className="hidden md:table-cell">Kullanıldığı Yer</TableHead>
                <TableHead className="hidden lg:table-cell">Kategori</TableHead>
                <TableHead className="hidden xl:table-cell">Malzeme</TableHead>
                <TableHead className="text-right">Gereken</TableHead>
                <TableHead className="hidden md:table-cell text-right">Sipariş</TableHead>
                <TableHead className="hidden md:table-cell text-right">Teslim</TableHead>
                <TableHead>Durum</TableHead>
                {/* Telefonda termin Durum hücresinin altına iner (md. 15). */}
                <TableHead className="hidden sm:table-cell">Termin</TableHead>
                <TableHead className="hidden lg:table-cell">Teslim Tarihi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.map((s) => (
                <Satir key={s.key} s={s} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Satir({ s }: { s: OzetSatiri }) {
  return (
    <TableRow>
      {/* `overflow-wrap:anywhere` (yalnız telefonda): `break-word` tablo
          sütununun min-content'ini küçültmez; uzun ölçü jetonu 375px'te
          tabloyu taşırıyordu (parts-table ölçümünün aynısı, md. 15). */}
      <TableCell className="align-top whitespace-normal max-sm:[overflow-wrap:anywhere]">
        <span className="text-[12px]">{s.tanim}</span>
        {s.parcaKodu && (
          <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
            {s.parcaKodu}
          </span>
        )}
        {/* DAR EKRANDA GİZLENEN SÜTUNUN KRİTİK PARÇASI BİRİNCİL HÜCREYE İNER
            (AGENTS md. 7); ikinci bir kart markup'ı yazılmaz. */}
        <span className="mt-0.5 block text-[11px] text-muted-foreground md:hidden">
          {s.kullanildigiYer ? `${s.kullanildigiYer} · ` : ""}
          {s.siparisAdedi ? `Sipariş ${formatNum(s.siparisAdedi)}` : "Sipariş yok"}
          {s.teslimAdedi ? ` · Teslim ${formatNum(s.teslimAdedi)}` : ""}
        </span>
      </TableCell>
      {/* UZUNLUĞU VERİDEN GELEN SÜTUN KELEPÇELENİR (AGENTS md. 7): grup adları
          "15 T X 24 M … GENEL KOMPLE" kadar uzayabilir ve tek satır tabloyu
          ekranın dışına iterdi. Tam metin `title` ile durur. */}
      <TableCell
        className="hidden max-w-[12rem] truncate align-top text-[12px] md:table-cell xl:max-w-[18rem]"
        title={s.kullanildigiYer || undefined}
      >
        {s.kullanildigiYer || "—"}
      </TableCell>
      <TableCell className="hidden align-top text-[12px] whitespace-normal lg:table-cell">
        {s.sinif || "—"}
      </TableCell>
      <TableCell className="hidden align-top font-mono text-[11px] whitespace-normal xl:table-cell">
        {s.malzeme || "—"}
      </TableCell>
      <TableCell className="align-top text-right font-mono text-[12px] tabular-nums">
        {s.gereken == null ? "—" : formatNum(s.gereken)}
      </TableCell>
      <TableCell className="hidden align-top text-right font-mono text-[12px] tabular-nums md:table-cell">
        {s.siparisAdedi ? formatNum(s.siparisAdedi) : "—"}
      </TableCell>
      <TableCell className="hidden align-top text-right font-mono text-[12px] tabular-nums md:table-cell">
        {s.teslimAdedi ? formatNum(s.teslimAdedi) : "—"}
      </TableCell>
      <TableCell className="align-top">
        <span
          className={`inline-block w-fit border px-1.5 py-0.5 text-[11px] whitespace-nowrap ${DURUM_SINIFI[s.durum]}`}
        >
          {DURUM_ETIKETLERI[s.durum]}
        </span>
        {/* SİPARİŞ KAYDI OLMADAN GELEN İŞARET AÇIKÇA YAZILIR: "sipariş
            verildi" diyip hiçbir tarih gösterememek, eksik bilgiyi tam
            göstermek olurdu. */}
        {s.yalnizIsaret && (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            elle işaretlenmiş · sipariş kaydı yok
          </span>
        )}
        {s.siparisSayisi > 1 && (
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {formatNum(s.siparisSayisi)} sipariş
            {s.acikSiparis > 0 ? ` · ${formatNum(s.acikSiparis)} açık` : ""}
          </span>
        )}
        {/* Telefonda termin buraya iner — sütunu orada gizli. */}
        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground sm:hidden">
          {tarihGoster(s.termin)}
          {s.gecikmeGun > 0 && (
            <span className="ml-1 font-sans text-destructive">
              {formatNum(s.gecikmeGun)} gün gecikme
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className="hidden align-top font-mono text-[12px] whitespace-nowrap sm:table-cell">
        {tarihGoster(s.termin)}
        {s.gecikmeGun > 0 && (
          <span className="mt-0.5 block text-[11px] font-sans text-destructive">
            {formatNum(s.gecikmeGun)} gün gecikme
          </span>
        )}
      </TableCell>
      <TableCell className="hidden align-top font-mono text-[12px] whitespace-nowrap lg:table-cell">
        {tarihGoster(s.teslimTarihi)}
      </TableCell>
    </TableRow>
  );
}
