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

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
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
import { trKatla } from "@/lib/drawings/tr-text";
import { tarihGoster } from "@/lib/purchasing/terms";
import { FilterBar, SearchBox } from "../../drawings/sortable-head";
import { CokluSuzgec } from "../filters";
import { deletePriceHistory } from "../actions";

export interface FiyatOlayi {
  id: string;
  /**
   * ÜÇ KAYNAK, ÜÇÜ DE AYRI DURUR:
   *   teklif  — istenen fiyat, alınmamış olabilir
   *   siparis — bu uygulamadan verilmiş sipariş
   *   gecmis  — DEVRALINAN alım (Excel, 2024-03…2026-12; md. 21)
   *
   * Devralınanı "sipariş" saymak, uygulamanın kendi kaydıyla dışarıdan gelen
   * bir faturayı aynı güvenle göstermek olurdu; kullanıcı hangisinin
   * denetlenebilir olduğunu ayırt edebilmeli.
   */
  tur: "teklif" | "siparis" | "gecmis";
  supplier: string;
  gun: string;
  birim: number;
  currency: string;
  birimEur: number | null;
  adet: number | null;
  secildi: boolean;
  iptal: boolean;
  itemNo: string;
  /** Devralınan satırın kaynak kategorisi ("Rulman ve Rulman Yatakları"). */
  kategori?: string;
}

export interface FiyatKalemi {
  key: string;
  tanim: string;
  olaylar: FiyatOlayi[];
}

/** Bir kalemin özeti — son sipariş, son teklif, en düşük/yüksek. */
function ozet(k: FiyatKalemi) {
  // GERÇEKLEŞMİŞ ALIM = kendi siparişimiz + devralınan fatura. Arşivin sorusu
  // "kaça ALDIK"tır; devralınanı dışarıda bırakmak 4722 satırlık geçmişi
  // "referansı yok" gösterirdi.
  const siparisler = k.olaylar.filter(
    (o) => (o.tur === "siparis" || o.tur === "gecmis") && !o.iptal && o.birimEur != null
  );
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

export function PriceArchive({
  kalemler,
  isAdmin = false,
}: {
  kalemler: FiyatKalemi[];
  /** Devralınan satırı YALNIZ yönetici silebilir (kullanıcı kararı 13.08.2026). */
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();
  const [q, setQ] = useState("");
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [kategoriler, setKategoriler] = useState<string[]>([]);
  const [tedarikciler, setTedarikciler] = useState<string[]>([]);
  const [kaynaklar, setKaynaklar] = useState<string[]>([]);

  // SÜZGEÇ SEÇENEKLERİ VERİDEN ÇIKAR, elle yazılmaz: devralınan kategoriler
  // uygulamanın kendi on beş ürün ailesiyle AYNI DEĞİL (kaynak dosya kendi
  // dilini konuşuyor) ve sabit bir liste onları gizlerdi.
  const secenekler = useMemo(() => {
    const say = (fn: (o: FiyatOlayi) => string[]) => {
      const m = new Map<string, number>();
      for (const k of kalemler) for (const o of k.olaylar) for (const v of fn(o)) {
        if (v) m.set(v, (m.get(v) ?? 0) + 1);
      }
      return [...m.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
        .map(([value, count]) => ({ value, label: value, count }));
    };
    return {
      kategoriler: say((o) => [o.kategori ?? ""]),
      tedarikciler: say((o) => [o.supplier]),
      kaynaklar: [
        { value: "gecmis", label: "Devralınan", count: undefined },
        { value: "siparis", label: "Sipariş", count: undefined },
        { value: "teklif", label: "Teklif", count: undefined },
      ],
    };
  }, [kalemler]);

  const temiz =
    !q && kategoriler.length === 0 && tedarikciler.length === 0 && kaynaklar.length === 0;

  const gorunen = useMemo(() => {
    const a = trKatla(q);
    const kat = new Set(kategoriler);
    const ted = new Set(tedarikciler);
    const kay = new Set(kaynaklar);
    return kalemler.filter((k) => {
      // SÜZGEÇ OLAY DÜZEYİNDE ELER, KALEM DÜZEYİNDE GÖSTERİR: bir kalemin
      // BİR olayı "Rulman" kategorisindeyse kalem listede kalır. Kalemi
      // bütünüyle düşürmek, aynı ürünün başka bir alımını da gizlerdi.
      if (kat.size > 0 && !k.olaylar.some((o) => kat.has(o.kategori ?? ""))) return false;
      if (ted.size > 0 && !k.olaylar.some((o) => ted.has(o.supplier))) return false;
      if (kay.size > 0 && !k.olaylar.some((o) => kay.has(o.tur))) return false;
      if (!a) return true;
      const havuz = [k.tanim, ...k.olaylar.map((o) => `${o.supplier} ${o.itemNo}`)].join(" ");
      return trKatla(havuz).includes(a);
    });
  }, [kalemler, q, kategoriler, tedarikciler, kaynaklar]);

  /**
   * SAYFALAMA — SÜZGEÇTEN SONRA (kullanıcı bildirimi, 13.08.2026: *"Fiyat
   * arşivinde çok satır olduğu için sanırım kasma yapıyor … 100'erli sayfalara
   * ayıralım. Ama arama ve filtreyi TÜM SAYFALAR için yapsın."*).
   *
   * SIRA ÖNEMLİ ve tam olarak kullanıcının söylediği gibi: önce bütün arşiv
   * süzülür, SONRA görünen dilim kesilir. Ters sırada çalışan bir sayfalama
   * (önce 100 satır al, sonra içinde ara) aramayı "bu sayfada ara"ya
   * indirgerdi ve arşivin var oluş sebebini bitirirdi.
   *
   * KASMANIN SEBEBİ SATIR SAYISI DEĞİL DOM: 1675 kalem × açılır ayrıntı
   * tablosu, tarayıcının tek seferde çizemeyeceği bir ağaç. Dilim yalnız
   * ÇİZİMİ sınırlar; süzgeç ve sayaçlar hep tam veri üzerinde çalışır.
   */
  const SAYFA_BOYU = 100;
  const [sayfa, setSayfa] = useState(1);
  const sayfaSayisi = Math.max(1, Math.ceil(gorunen.length / SAYFA_BOYU));
  // Süzgeç daraldığında elde olmayan bir sayfada kalınmaz.
  const gecerliSayfa = Math.min(sayfa, sayfaSayisi);
  const dilim = useMemo(
    () => gorunen.slice((gecerliSayfa - 1) * SAYFA_BOYU, gecerliSayfa * SAYFA_BOYU),
    [gorunen, gecerliSayfa]
  );

  /** Süzgeç değişince ilk sayfaya dönülür — olay içinde, efektte değil. */
  function suzgecDegisti<T>(ayarla: (v: T) => void) {
    return (v: T) => {
      ayarla(v);
      setSayfa(1);
    };
  }

  /** Devralınan satırı siler. Teklif/sipariş BURADAN silinmez — kendi yolları var. */
  function sil(olay: FiyatOlayi) {
    if (!isAdmin || olay.tur !== "gecmis") return;
    if (!window.confirm(`Devralınan fiyat kaydı silinsin mi?

${olay.supplier} · ${olay.gun}`)) return;
    basla(async () => {
      const sonuc = await deletePriceHistory({ ids: [olay.id.replace(/^g-/, "")] });
      if (sonuc.error) toast.error(sonuc.error);
      else {
        toast.success("Arşiv kaydı silindi.");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-3">
      <FilterBar
        gorunen={gorunen.length}
        toplam={kalemler.length}
        temiz={temiz}
        onTemizle={() => {
          setQ("");
          setKategoriler([]);
          setTedarikciler([]);
          setKaynaklar([]);
          setSayfa(1);
        }}
      >
        <SearchBox
          value={q}
          onChange={suzgecDegisti(setQ)}
          placeholder="Ürün, Tedarikçi Ara… (ör. rulman 6205)"
          className="w-[min(24rem,calc(100vw-4rem))]"
        />
        {/* Talep havuzuyla AYNI süzgeç bileşeni (kullanıcı isteği 13.08.2026):
            iki ekranın süzgeci farklı davranırsa kullanıcı her seferinde
            yeniden öğrenir. */}
        <CokluSuzgec
          baslik="Kategori"
          secenekler={secenekler.kategoriler}
          secili={kategoriler}
          onChange={suzgecDegisti(setKategoriler)}
        />
        <CokluSuzgec
          baslik="Tedarikçi"
          secenekler={secenekler.tedarikciler}
          secili={tedarikciler}
          onChange={suzgecDegisti(setTedarikciler)}
        />
        <CokluSuzgec
          baslik="Kaynak"
          secenekler={secenekler.kaynaklar}
          secili={kaynaklar}
          onChange={suzgecDegisti(setKaynaklar)}
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
              {dilim.map((k) => {
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
                                  {isAdmin && <th className="w-8" />}
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
                                      ) : ol.tur === "gecmis" ? (
                                        // DEVRALINAN AYIRT EDİLİR: uygulamanın
                                        // kendi kaydıyla dışarıdan gelen bir
                                        // fatura aynı güvende değildir.
                                        <span
                                          className="text-muted-foreground"
                                          title={ol.kategori || "Devralınan alım kaydı"}
                                        >
                                          Devralınan
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
                                    {/* SİLME YALNIZ YÖNETİCİDE ve YALNIZ
                                        DEVRALINAN satırda. Teklif ve siparişin
                                        kendi yolu var; tek düğmenin üç defteri
                                        birden silmesi, kullanıcının neyi
                                        kaybettiğini bilmemesi demekti. */}
                                    {isAdmin && (
                                      <td className="py-1 pl-3 text-right">
                                        {ol.tur === "gecmis" && (
                                          <button
                                            type="button"
                                            onClick={() => sil(ol)}
                                            disabled={calisiyor}
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

          {/* SAYFA ŞERİDİ — YALNIZ GEREKİNCE. Tek sayfalık bir listede
              "1/1" yazmak, kullanıcıya olmayan bir karmaşıklık gösterirdi. */}
          {sayfaSayisi > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {formatNum((gecerliSayfa - 1) * SAYFA_BOYU + 1)}–
                {formatNum(Math.min(gecerliSayfa * SAYFA_BOYU, gorunen.length))} /{" "}
                {formatNum(gorunen.length)} kalem
              </span>
              <span className="flex items-center gap-1">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={gecerliSayfa <= 1}
                  onClick={() => setSayfa(1)}
                  title="İlk sayfa"
                >
                  «
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={gecerliSayfa <= 1}
                  onClick={() => setSayfa(gecerliSayfa - 1)}
                >
                  Önceki
                </Button>
                <span className="px-2 font-mono text-[12px] tabular-nums">
                  {formatNum(gecerliSayfa)} / {formatNum(sayfaSayisi)}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={gecerliSayfa >= sayfaSayisi}
                  onClick={() => setSayfa(gecerliSayfa + 1)}
                >
                  Sonraki
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={gecerliSayfa >= sayfaSayisi}
                  onClick={() => setSayfa(sayfaSayisi)}
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
