"use client";

// Fiyat arşivi ekranı — aranabilir referans fiyat listesi.
//
// ═══════════════════════════════════ SÜZGEÇ SUNUCUDA, DURUM ADRESTE
//
// Ekran bir süre bütün arşivi (1675 kalem, 360 KB) alıp istemcide süzüyordu ve
// kullanıcı iki kez "yavaş" dedi. Ölçüldü: görünümün kendisi 54 ms, maliyet
// TAŞIMAydı. Artık yalnız görünen 100 satır geliyor (~58 KB) ve arama `where`
// ile TÜM arşivde çalışıyor — kullanıcının şartı ("arama ve filtreyi tüm
// sayfalar için yapsın") gevşemedi, gerçek anlamını kazandı: artık istemciye
// hiç gelmemiş satırlarda da arıyor.
//
// BU BİLEŞEN ARTIK SÜZMÜYOR, SORUYOR. Her denetim adresi (`searchParams`)
// günceller, sunucu bileşeni doğru dilimi kurar. Kazancı üç katlı: bağlantı
// paylaşılabilir, tarayıcının geri düğmesi çalışır ve aynı süzgeç iki yerde
// iki türlü yazılmaz.
//
// ARAMA GECİKTİRİLİR (350 ms), SÜZGEÇ GECİKMEZ. Her tuşa basışta sunucuya
// gitmek hem gereksiz hem de kutuyu takılgan yapardı; açılır süzgeçte ise
// tıklama zaten nihai bir karardır ve beklemek yalnız yavaş hissettirirdi.
//
// SON FİYAT VURGULANIR: arşivin var oluş sebebi "en son kaça aldık" sorusudur.
// Ortalama HESAPLANMAZ — üç yıl önceki bir fiyatla bugünkünü ortalamak,
// enflasyon altında anlamsız bir sayı üretir ve kullanıcıyı yanıltırdı.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/currency";
import { formatNum } from "@/lib/drawings/labels";
import { tarihGoster } from "@/lib/purchasing/terms";
import { FilterBar, SearchBox } from "../../drawings/sortable-head";
import { CokluSuzgec } from "../filters";
import { deletePriceHistory, fetchPriceHistory } from "../actions";
import type { ArsivOlayi, ArsivSatiri, ArsivSonucu } from "../data";

/** Kaynak süzgecinin sabit üç değeri — veriden çıkarılamaz, TANIMdır. */
const KAYNAKLAR = [
  { value: "gecmis", label: "Devralınan" },
  { value: "siparis", label: "Sipariş" },
  { value: "teklif", label: "Teklif" },
];

const TUR_ETIKET: Record<ArsivOlayi["tur"], string> = {
  teklif: "Teklif",
  siparis: "Sipariş",
  gecmis: "Devralınan",
};

export interface ArsivFiltresi {
  q: string;
  kategoriler: string[];
  tedarikciler: string[];
  kaynaklar: string[];
}

export function PriceArchive({
  sonuc,
  secenekler,
  filtre,
  isAdmin = false,
}: {
  sonuc: ArsivSonucu;
  secenekler: { kategoriler: string[]; tedarikciler: string[]; toplam: number };
  filtre: ArsivFiltresi;
  /** Devralınan satırı YALNIZ yönetici silebilir (kullanıcı kararı 13.08.2026). */
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [gecis, basla] = useTransition();
  const [silmeCalisiyor, silmeBasla] = useTransition();

  // Arama kutusu YEREL yazılır, adres GECİKMELİ güncellenir. Kutunun değeri
  // doğrudan adresten okunsaydı her harf bir sunucu turu ve bir imleç
  // sıçraması olurdu.
  const [q, setQ] = useState(filtre.q);
  const ilkBoyama = useRef(true);

  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [olaylar, setOlaylar] = useState<Record<string, ArsivOlayi[]>>({});
  const [yukleniyor, setYukleniyor] = useState<Set<string>>(new Set());

  /** Adresi günceller — verilmeyen alanlar korunur, sayfa BAŞA döner. */
  function adresYaz(degisen: Record<string, string | undefined>, sayfayiKoru = false) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(degisen)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    // SÜZGEÇ DEĞİŞİNCE İLK SAYFA. Elde olmayan bir sayfada kalmak, kullanıcıya
    // "sonuç yok" gösterirdi — oysa sonuç var, yalnız başka sayfada.
    if (!sayfayiKoru) p.delete("sayfa");
    basla(() => router.replace(`?${p.toString()}`, { scroll: false }));
  }

  // ARAMA GECİKMESİ. `useEffect` burada doğru araçtır: geciktirme bir ZAMAN
  // olayıdır, bir kullanıcı olayı değil — tuşa basıldığında değil, basılmayı
  // BIRAKTIĞINDA çalışır.
  useEffect(() => {
    if (ilkBoyama.current) {
      ilkBoyama.current = false;
      return;
    }
    if (q === filtre.q) return;
    const t = setTimeout(() => adresYaz({ q: q.trim() || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const sayfaSayisi = Math.max(1, Math.ceil(sonuc.toplam / sonuc.sayfaBoyu));
  const temiz =
    !filtre.q &&
    filtre.kategoriler.length === 0 &&
    filtre.tedarikciler.length === 0 &&
    filtre.kaynaklar.length === 0;

  function ac(satir: ArsivSatiri) {
    setAcik((s) => {
      const y = new Set(s);
      if (y.has(satir.matchKey)) y.delete(satir.matchKey);
      else y.add(satir.matchKey);
      return y;
    });
    if (olaylar[satir.matchKey] !== undefined || yukleniyor.has(satir.matchKey)) return;
    setYukleniyor((s) => new Set(s).add(satir.matchKey));
    fetchPriceHistory({ matchKey: satir.matchKey }).then((sonuc) => {
      setOlaylar((o) => ({ ...o, [satir.matchKey]: sonuc.satirlar ?? [] }));
      setYukleniyor((s) => {
        const y = new Set(s);
        y.delete(satir.matchKey);
        return y;
      });
      if (sonuc.error) toast.error(sonuc.error);
    });
  }

  /** Devralınan satırı siler; teklif ve siparişin kendi yolu var. */
  function sil(matchKey: string, olay: ArsivOlayi) {
    if (!isAdmin || !olay.silinebilir) return;
    if (
      !window.confirm(
        `Devralınan fiyat kaydı silinsin mi?\n\n${olay.supplier} · ${tarihGoster(olay.gun)}`
      )
    ) {
      return;
    }
    silmeBasla(async () => {
      const cevap = await deletePriceHistory({ ids: [olay.id] });
      if (cevap.error) {
        toast.error(cevap.error);
        return;
      }
      toast.success("Arşiv kaydı silindi.");
      // Açık satırın ayrıntısı yeniden çekilsin: `router.refresh()` yalnız
      // ÖZETİ tazeler, tembel yüklenen ayrıntıyı bilmez.
      setOlaylar((o) => {
        const y = { ...o };
        delete y[matchKey];
        return y;
      });
      setAcik((s) => {
        const y = new Set(s);
        y.delete(matchKey);
        return y;
      });
      router.refresh();
    });
  }

  const sutunSayisi = 7;

  return (
    <div className="grid gap-3">
      <FilterBar
        gorunen={sonuc.toplam}
        toplam={secenekler.toplam || sonuc.toplam}
        temiz={temiz}
        onTemizle={() => {
          setQ("");
          basla(() => router.replace("?", { scroll: false }));
        }}
      >
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Ürün, Tedarikçi Ara… (ör. rulman 6205)"
          className="w-[min(24rem,calc(100vw-4rem))]"
        />
        <CokluSuzgec
          baslik="Kategori"
          secenekler={secenekler.kategoriler.map((v) => ({ value: v, label: v }))}
          secili={filtre.kategoriler}
          onChange={(v) => adresYaz({ kat: v.join(",") || undefined })}
        />
        <CokluSuzgec
          baslik="Tedarikçi"
          secenekler={secenekler.tedarikciler.map((v) => ({ value: v, label: v }))}
          secili={filtre.tedarikciler}
          onChange={(v) => adresYaz({ ted: v.join(",") || undefined })}
        />
        <CokluSuzgec
          baslik="Kaynak"
          secenekler={KAYNAKLAR}
          secili={filtre.kaynaklar}
          onChange={(v) => adresYaz({ kaynak: v.join(",") || undefined })}
        />
        {gecis && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </FilterBar>

      {sonuc.satirlar.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {temiz
              ? "Arşiv henüz boş. Teklif girdikçe ve sipariş açtıkça referans fiyatlar burada birikir."
              : "Bu aramayla eşleşen ürün yok."}
          </p>
        </div>
      ) : (
        <div className={"border bg-card" + (gecis ? " opacity-60 transition-opacity" : "")}>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-8 p-0" />
                <TableHead>Ürün</TableHead>
                <TableHead className="text-right">Son Alış (€)</TableHead>
                <TableHead className="hidden md:table-cell">Tarih</TableHead>
                <TableHead className="hidden lg:table-cell">Tedarikçi</TableHead>
                <TableHead className="hidden text-right xl:table-cell">Aralık (€)</TableHead>
                <TableHead className="text-right">Kayıt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sonuc.satirlar.map((s) => {
                const genis = acik.has(s.matchKey);
                const kayit = s.teklifSayisi + s.siparisSayisi + s.gecmisSayisi;
                return (
                  <>
                    <TableRow key={s.matchKey}>
                      <TableCell className="p-0 align-top">
                        <button
                          type="button"
                          onClick={() => ac(s)}
                          aria-expanded={genis}
                          aria-label={genis ? "Geçmişi gizle" : "Fiyat geçmişini göster"}
                          className="flex min-h-10 w-8 items-center justify-center text-muted-foreground pointer-coarse:min-h-11 hover:text-foreground"
                        >
                          {genis ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </button>
                      </TableCell>

                      {/* UZUNLUĞU VERİDEN GELEN SÜTUN KELEPÇELENİR (md. 7):
                          devralınan tanımlar çok satırlı olabiliyor. */}
                      <TableCell className="max-w-[18rem] align-top whitespace-normal 2xl:max-w-[34rem]">
                        <span className="line-clamp-2 text-[13px]" title={s.sample}>
                          {s.sample || s.matchKey}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground md:hidden">
                          {tarihGoster(s.sonAlisGun)} · {s.sonAlisFirma || "—"}
                        </span>
                      </TableCell>

                      <TableCell className="align-top text-right font-mono text-sm tabular-nums">
                        {s.sonAlisEur == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          fmtMoney(s.sonAlisEur, "EUR")
                        )}
                      </TableCell>

                      <TableCell className="hidden align-top font-mono text-[12px] whitespace-nowrap md:table-cell">
                        {tarihGoster(s.sonAlisGun)}
                      </TableCell>

                      <TableCell className="hidden max-w-[14rem] truncate align-top text-[12px] lg:table-cell">
                        {s.sonAlisFirma || "—"}
                      </TableCell>

                      <TableCell className="hidden align-top text-right font-mono text-[12px] tabular-nums xl:table-cell">
                        {s.enDusuk == null || s.enYuksek == null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : s.enDusuk === s.enYuksek ? (
                          fmtMoney(s.enDusuk, "EUR")
                        ) : (
                          `${fmtMoney(s.enDusuk, "EUR")} – ${fmtMoney(s.enYuksek, "EUR")}`
                        )}
                      </TableCell>

                      <TableCell className="align-top text-right font-mono text-[12px] tabular-nums">
                        {formatNum(kayit)}
                        {s.teklifSayisi > 0 && (
                          <span
                            className="ml-1 text-sky-700 dark:text-sky-400"
                            title={`${s.teklifSayisi} teklif`}
                          >
                            ·{formatNum(s.teklifSayisi)}T
                          </span>
                        )}
                      </TableCell>
                    </TableRow>

                    {genis && (
                      <TableRow key={`${s.matchKey}-ayrinti`} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={sutunSayisi} className="p-0 whitespace-normal">
                          <div className="oc-scrollx px-3 py-2 [--oc-scroll-bg:var(--muted)]">
                            <table className="w-full text-[12px]">
                              <thead className="text-muted-foreground">
                                <tr>
                                  <th className="py-1 pr-3 text-left font-normal">Tarih</th>
                                  <th className="py-1 pr-3 text-left font-normal">Tür</th>
                                  <th className="py-1 pr-3 text-left font-normal">Tedarikçi</th>
                                  <th className="py-1 pr-3 text-left font-normal">İş</th>
                                  <th className="py-1 pr-3 text-right font-normal">Adet</th>
                                  <th className="py-1 pr-3 text-right font-normal">Birim</th>
                                  <th className="py-1 text-right font-normal">Avro</th>
                                  {isAdmin && <th className="w-8" />}
                                </tr>
                              </thead>
                              <tbody>
                                {(olaylar[s.matchKey] ?? []).map((ol) => (
                                  <tr
                                    key={ol.id}
                                    className={
                                      "border-t border-border/50 " + (ol.iptal ? "opacity-50" : "")
                                    }
                                  >
                                    <td className="py-1 pr-3 font-mono whitespace-nowrap">
                                      {tarihGoster(ol.gun)}
                                    </td>
                                    <td className="py-1 pr-3">
                                      <span
                                        className={
                                          ol.tur === "siparis"
                                            ? "text-foreground"
                                            : "text-muted-foreground"
                                        }
                                        title={ol.kategori || undefined}
                                      >
                                        {TUR_ETIKET[ol.tur]}
                                        {ol.tur === "siparis" && ol.iptal && " (iptal)"}
                                        {ol.tur === "teklif" && ol.secildi && " ✓"}
                                      </span>
                                    </td>
                                    <td className="py-1 pr-3">{ol.supplier || "—"}</td>
                                    <td className="py-1 pr-3 font-mono">{ol.itemNo || "—"}</td>
                                    <td className="py-1 pr-3 text-right font-mono tabular-nums">
                                      {ol.adet == null ? "—" : formatNum(ol.adet)}
                                    </td>
                                    <td className="py-1 pr-3 text-right font-mono tabular-nums">
                                      {fmtMoney(ol.birim, ol.currency)}
                                    </td>
                                    <td className="py-1 text-right font-mono tabular-nums">
                                      {ol.birimEur == null ? (
                                        <span className="text-amber-700 dark:text-amber-400">
                                          kur yok
                                        </span>
                                      ) : (
                                        fmtMoney(ol.birimEur, "EUR")
                                      )}
                                    </td>
                                    {isAdmin && (
                                      <td className="py-1 pl-3 text-right">
                                        {/* SİLME YALNIZ DEVRALINAN SATIRDA:
                                            teklif ve siparişin kendi yolu var
                                            ve tek düğmenin üç defteri birden
                                            silmesi, kullanıcının neyi
                                            kaybettiğini bilmemesi demekti. */}
                                        {ol.silinebilir && (
                                          <button
                                            type="button"
                                            onClick={() => sil(s.matchKey, ol)}
                                            disabled={silmeCalisiyor}
                                            title="Devralınan kaydı sil"
                                            className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                                          >
                                            <Trash2 className="size-3.5" />
                                          </button>
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                ))}

                                {yukleniyor.has(s.matchKey) && (
                                  <tr className="border-t border-border/50">
                                    <td
                                      colSpan={isAdmin ? 8 : 7}
                                      className="py-2 text-center text-muted-foreground"
                                    >
                                      Geçmiş yükleniyor…
                                    </td>
                                  </tr>
                                )}

                                {!yukleniyor.has(s.matchKey) &&
                                  (olaylar[s.matchKey] ?? []).length === 0 && (
                                    <tr className="border-t border-border/50">
                                      <td
                                        colSpan={isAdmin ? 8 : 7}
                                        className="py-2 text-center text-muted-foreground"
                                      >
                                        Kayıt bulunamadı.
                                      </td>
                                    </tr>
                                  )}
                              </tbody>
                            </table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>

          {/* SAYFA ŞERİDİ — YALNIZ GEREKİNCE. Tek sayfalık bir listede "1/1"
              yazmak, olmayan bir karmaşıklık gösterirdi. */}
          {sayfaSayisi > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {formatNum((sonuc.sayfa - 1) * sonuc.sayfaBoyu + 1)}–
                {formatNum(Math.min(sonuc.sayfa * sonuc.sayfaBoyu, sonuc.toplam))} /{" "}
                {formatNum(sonuc.toplam)} kalem
              </span>
              <span className="flex items-center gap-1">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={sonuc.sayfa <= 1 || gecis}
                  onClick={() => adresYaz({ sayfa: undefined }, true)}
                  title="İlk sayfa"
                >
                  «
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={sonuc.sayfa <= 1 || gecis}
                  onClick={() => adresYaz({ sayfa: String(sonuc.sayfa - 1) }, true)}
                >
                  Önceki
                </Button>
                <span className="px-2 font-mono text-[12px] tabular-nums">
                  {formatNum(sonuc.sayfa)} / {formatNum(sayfaSayisi)}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={sonuc.sayfa >= sayfaSayisi || gecis}
                  onClick={() => adresYaz({ sayfa: String(sonuc.sayfa + 1) }, true)}
                >
                  Sonraki
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={sonuc.sayfa >= sayfaSayisi || gecis}
                  onClick={() => adresYaz({ sayfa: String(sayfaSayisi) }, true)}
                  title="Son sayfa"
                >
                  »
                </Button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
