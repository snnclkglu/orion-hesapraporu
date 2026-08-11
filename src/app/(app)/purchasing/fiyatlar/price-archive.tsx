"use client";

// Fiyat arşivi ekranı — aranabilir referans fiyat listesi.
//
// ARAMA TEK ALANDIR ve KATLANMIŞ karşılaştırır: kullanıcı "rulman 6205" yazar,
// arşivde "RULMAN 6205-Z" durur ve eşleşmelidir. Türkçe klavye kullanmadan
// yazan biri de ("rulman 6205") aynı sonucu görmelidir — `trKatla` i ailesini
// ve aksanları tek harfe indirir (arama kutularının uygulamadaki ortak kuralı).
//
// SON FİYAT VURGULANIR: arşivin var oluş sebebi "en son kaça aldık" sorusudur.
// Ortalama HESAPLANMAZ — üç yıl önceki bir fiyatla bugünkünü ortalamak,
// enflasyon altında anlamsız bir sayı üretir ve kullanıcıyı yanıltırdı.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtMoney } from "@/lib/currency";
import { formatNum } from "@/lib/drawings/labels";
import { trKatla } from "@/lib/drawings/tr-text";
import { tarihGoster } from "@/lib/purchasing/terms";
import { FilterBar, SearchBox } from "../../drawings/sortable-head";

export interface FiyatOlayi {
  id: string;
  tur: "teklif" | "siparis";
  supplier: string;
  gun: string;
  birim: number;
  currency: string;
  birimEur: number | null;
  adet: number | null;
  secildi: boolean;
  iptal: boolean;
  itemNo: string;
}

export interface FiyatKalemi {
  key: string;
  tanim: string;
  olaylar: FiyatOlayi[];
}

/** Bir kalemin özeti — son sipariş, son teklif, en düşük/yüksek. */
function ozet(k: FiyatKalemi) {
  const siparisler = k.olaylar.filter((o) => o.tur === "siparis" && !o.iptal && o.birimEur != null);
  const teklifler = k.olaylar.filter((o) => o.tur === "teklif" && o.birimEur != null);
  const eurler = siparisler.map((o) => o.birimEur ?? 0);
  return {
    sonSiparis: siparisler[0] ?? null,
    sonTeklif: teklifler[0] ?? null,
    enDusuk: eurler.length ? Math.min(...eurler) : null,
    enYuksek: eurler.length ? Math.max(...eurler) : null,
    siparisSayisi: siparisler.length,
    teklifSayisi: teklifler.length,
  };
}

export function PriceArchive({ kalemler }: { kalemler: FiyatKalemi[] }) {
  const [q, setQ] = useState("");
  const [acik, setAcik] = useState<Set<string>>(new Set());

  const gorunen = useMemo(() => {
    const a = trKatla(q);
    if (!a) return kalemler;
    return kalemler.filter((k) => {
      const havuz = [k.tanim, ...k.olaylar.map((o) => `${o.supplier} ${o.itemNo}`)].join(" ");
      return trKatla(havuz).includes(a);
    });
  }, [kalemler, q]);

  return (
    <div className="grid gap-3">
      <FilterBar
        gorunen={gorunen.length}
        toplam={kalemler.length}
        temiz={!q}
        onTemizle={() => setQ("")}
      >
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Ürün, Tedarikçi Ara… (ör. rulman 6205)"
          className="w-[min(24rem,calc(100vw-4rem))]"
        />
      </FilterBar>

      {gorunen.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {kalemler.length === 0
              ? "Arşiv henüz boş. Teklif girdikçe ve sipariş açtıkça referans fiyatlar burada birikir."
              : "Bu aramayla eşleşen ürün yok."}
          </p>
        </div>
      ) : (
        <div className="border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-8 p-0" />
                <TableHead>Ürün</TableHead>
                <TableHead className="text-right">Son Alış (€)</TableHead>
                <TableHead className="hidden md:table-cell">Tarih</TableHead>
                <TableHead className="hidden lg:table-cell">Tedarikçi</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Aralık (€)</TableHead>
                <TableHead className="text-right">Kayıt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.map((k) => {
                const o = ozet(k);
                const genis = acik.has(k.key);
                return (
                  <>
                    <TableRow key={k.key}>
                      <TableCell className="p-0 align-top">
                        <button
                          type="button"
                          onClick={() =>
                            setAcik((s) => {
                              const y = new Set(s);
                              if (y.has(k.key)) y.delete(k.key);
                              else y.add(k.key);
                              return y;
                            })
                          }
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

                      <TableCell className="max-w-[26rem] align-top whitespace-normal text-[13px]">
                        {k.tanim || k.key}
                      </TableCell>

                      <TableCell className="align-top text-right font-mono text-[13px] font-medium tabular-nums">
                        {o.sonSiparis?.birimEur != null ? (
                          fmtMoney(o.sonSiparis.birimEur, "EUR")
                        ) : o.sonTeklif?.birimEur != null ? (
                          <span className="font-normal text-muted-foreground" title="Henüz alınmadı; son teklif fiyatı">
                            ~{fmtMoney(o.sonTeklif.birimEur, "EUR")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="hidden align-top font-mono text-[12px] whitespace-nowrap md:table-cell">
                        {tarihGoster(o.sonSiparis?.gun ?? o.sonTeklif?.gun ?? null)}
                      </TableCell>

                      <TableCell className="hidden align-top text-[12px] lg:table-cell">
                        {o.sonSiparis?.supplier ?? o.sonTeklif?.supplier ?? "—"}
                      </TableCell>

                      <TableCell className="hidden align-top text-right font-mono text-[12px] tabular-nums xl:table-cell">
                        {o.enDusuk == null ? (
                          "—"
                        ) : o.enDusuk === o.enYuksek ? (
                          fmtMoney(o.enDusuk, "EUR")
                        ) : (
                          <>
                            {fmtMoney(o.enDusuk, "EUR")} – {fmtMoney(o.enYuksek, "EUR")}
                          </>
                        )}
                      </TableCell>

                      <TableCell className="align-top text-right font-mono text-[11px] text-muted-foreground tabular-nums">
                        {formatNum(o.siparisSayisi)} alış · {formatNum(o.teklifSayisi)} teklif
                      </TableCell>
                    </TableRow>

                    {genis && (
                      <TableRow key={`${k.key}-gecmis`} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={7} className="whitespace-normal p-0">
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
                                </tr>
                              </thead>
                              <tbody>
                                {k.olaylar.map((ol) => (
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
                                      {ol.tur === "siparis" ? (
                                        <span className="text-foreground">
                                          Sipariş{ol.iptal && " (iptal)"}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">
                                          Teklif{ol.secildi && " ✓"}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1 pr-3">{ol.supplier}</td>
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
                                  </tr>
                                ))}
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
        </div>
      )}
    </div>
  );
}
