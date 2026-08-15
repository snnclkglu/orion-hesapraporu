"use client";

// TEKLİFLER — liste.
//
// ═══════════════════════════════════════════ SATIR BİR TEKLİFTİR, BİR FİYAT DEĞİL
//
// Kullanıcı kararı (15.08.2026): *"Teklif Karşılaştırma bölümünü teklifler
// yapalım … Birkaç firmadan aynı teklifi aldığımda burada görebileyim. Teklifin
// üstüne tıkladığımda bir pop up açılsın ve hangi firma ne teklif verdi
// görebileyim."*
//
// Sayfa bu yüzden İKİ KATMANDIR ve matris artık ekranın kendisinde DEĞİLDİR:
//
//   1. LİSTE (burası) — her satır bir teklif: kod, ad, kaç kalem, kaç firma,
//      en ucuz dağılımın bedeli. Göz bir bakışta "hangi teklife bakacağım"ı
//      cevaplar.
//   2. PENCERE (`request-dialog.tsx`) — o teklifin firma firma karşılaştırması,
//      kullanıcının gösterdiği çalışma dosyasının sütun düzeninde.
//
// Matris sayfanın gövdesindeyken iki teklif yan yana okunamıyordu: ekran tek
// bir karşılaştırmayı gösteriyor ve ötekine geçmek seçim kutularıyla
// oynamayı gerektiriyordu. Liste + pencere, "hangisi" ile "ne kadar"ı ayırır.

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TedarikciKaydi } from "../../data";
import type { GunlukKur } from "@/lib/purchasing/kur";
import { formatNum } from "@/lib/drawings/labels";
import { tarihGoster } from "@/lib/purchasing/terms";
import { HAMMADDE_ADLARI, type HammaddeSinifi } from "@/lib/purchasing/hammadde/siniflar";
import { cn } from "@/lib/utils";
import { mergeQuoteRequests } from "../../actions";
import { RequestDialog } from "./request-dialog";
import type { Pay, TalepGorunumu } from "./types";

export function QuotesView({
  talepler,
  tur,
  turSayaclari,
  siparisAdetleri,
  paylar,
  tedarikciler,
  defter,
  siparisNolari,
  sonKur,
  qualities,
  canWrite,
  isAdmin,
}: {
  talepler: TalepGorunumu[];
  tur: HammaddeSinifi | null;
  turSayaclari: { tur: HammaddeSinifi; adet: number }[];
  siparisAdetleri: [string, number][];
  paylar: Record<string, Pay[]>;
  tedarikciler: string[];
  defter: TedarikciKaydi[];
  siparisNolari: string[];
  sonKur?: GunlukKur | null;
  qualities: string[];
  canWrite: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [calisiyor, basla] = useTransition();
  const [acilan, setAcilan] = useState<string | null>(null);
  const [secili, setSecili] = useState<Set<string>>(new Set());

  const acikTalep = useMemo(
    () => talepler.find((t) => t.id === acilan) ?? null,
    [talepler, acilan]
  );

  function turSec(v: HammaddeSinifi | null) {
    const p = new URLSearchParams(params?.toString() ?? "");
    if (v) p.set("tur", v);
    else p.delete("tur");
    basla(() => router.replace(`/purchasing/hammadde/teklifler?${p.toString()}`));
  }

  function sec(id: string, ac: boolean) {
    setSecili((o) => {
      const y = new Set(o);
      if (ac) y.add(id);
      else y.delete(id);
      return y;
    });
  }

  /**
   * TEKLİFLERİ BİRLEŞTİR — "aynı teklifi bu firmadan da almışım".
   *
   * Otomatik eşleşme KALEM KÜMESİNE bakar ve bir firma yalnız iki kaleme fiyat
   * verdiğinde küme tutmaz; teklif ayrı bir satır olur. Bu düğme o durumu
   * insanın kararına bırakır — teklif girerken "hangi talebe ait" diye sormak,
   * her girişe bir soru eklemek olurdu.
   *
   * HEDEF EN ESKİ TALEPTİR: kod bir kimliktir ve birleştirmenin sonunda
   * kullanıcının elinde ilk açtığı numara kalmalı (parti birleştirmesinin
   * kuralının aynısı).
   */
  function birlestir() {
    const secilenler = talepler.filter((t) => secili.has(t.id) && t.gercek);
    if (secilenler.length < 2) {
      toast.error("Birleştirmek için en az iki teklif seçin.");
      return;
    }
    const sirali = [...secilenler].sort((a, b) => a.ilkTarih.localeCompare(b.ilkTarih));
    basla(async () => {
      const sonuc = await mergeQuoteRequests(
        sirali[0].id,
        sirali.slice(1).map((t) => t.id)
      );
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(`Teklifler birleştirildi${sonuc.no ? ` (${sonuc.no})` : ""}`);
      setSecili(new Set());
      router.refresh();
    });
  }

  const birlestirilebilir = talepler.filter((t) => secili.has(t.id) && t.gercek).length;

  return (
    <div className="grid gap-3">
      {/* ————————————————————————————————————— tür şeridi */}
      <div className="oc-scrollx flex items-center gap-1.5 overflow-x-auto overscroll-x-contain [--oc-scroll-bg:var(--background)]">
        <button type="button" onClick={() => turSec(null)} className={cip(tur === null)}>
          Tümü{" "}
          <span className="ml-1 opacity-60">
            {formatNum(turSayaclari.reduce((t, x) => t + x.adet, 0))}
          </span>
        </button>
        {turSayaclari
          .filter((x) => x.adet > 0)
          .map((x) => (
            <button
              key={x.tur}
              type="button"
              onClick={() => turSec(x.tur)}
              className={cip(tur === x.tur)}
            >
              {HAMMADDE_ADLARI[x.tur]} <span className="ml-1 opacity-60">{formatNum(x.adet)}</span>
            </button>
          ))}
        {calisiyor && (
          <span className="ml-2 inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Yükleniyor
          </span>
        )}
      </div>

      {talepler.length === 0 ? (
        <div className="border bg-card px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Henüz teklif yok. Hammadde Havuzu&apos;ndan ya da Plaka Yerleşimi&apos;nden “Teklif
            Aç” ile firmaların fiyatlarını girin; her teklif kendi koduyla burada listelenir.
          </p>
        </div>
      ) : (
        <section className="border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <p className="oc-kicker text-[10px] text-muted-foreground">Teklifler</p>
            <span className="font-mono text-[11px] text-muted-foreground">
              {formatNum(talepler.length)} teklif
              {secili.size > 0 && ` · ${formatNum(secili.size)} seçili`}
            </span>
            {canWrite && (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={birlestir}
                disabled={calisiyor || birlestirilebilir < 2}
                title="Seçili teklifleri tek bir teklifte topla — firmalar ayrı ayrı durur, yalnız karşılaştırma kapsamı birleşir"
                className="ml-auto"
              >
                <Layers className="size-3" />
                Teklifleri Birleştir
              </Button>
            )}
          </div>

          <div className="oc-scrollx overflow-x-auto [--oc-scroll-bg:var(--card)]">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-muted/50 text-left text-muted-foreground">
                  <th className="w-10 px-2 py-1.5 font-normal" />
                  <th className="px-2 py-1.5 font-normal">Kod</th>
                  <th className="px-2 py-1.5 font-normal">Teklif</th>
                  <th className="px-2 py-1.5 text-right font-normal">Kalem</th>
                  <th className="px-2 py-1.5 text-right font-normal">Firma</th>
                  <th className="hidden px-2 py-1.5 font-normal md:table-cell">Tarih</th>
                  <th className="px-2 py-1.5 text-right font-normal">En Ucuz Dağılım</th>
                  <th className="hidden px-2 py-1.5 font-normal lg:table-cell">
                    Tek Firmadan En Ucuz
                  </th>
                </tr>
              </thead>
              <tbody>
                {talepler.map((t) => {
                  const isaretli = secili.has(t.id);
                  return (
                    <tr
                      key={t.id}
                      className={cn(
                        "border-t transition-colors hover:bg-muted/40",
                        isaretli && "bg-primary/[0.05]",
                        t.tamameniIptal && "text-muted-foreground"
                      )}
                    >
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={isaretli}
                          onChange={(e) => sec(t.id, e.target.checked)}
                          disabled={!t.gercek}
                          aria-label={`${t.code || t.baslik} teklifini seç`}
                          title={
                            t.gercek
                              ? "Birleştirmek için seç"
                              : "Devralınan teklif — birleştirilemez"
                          }
                          className="size-4 accent-[var(--primary)] disabled:opacity-40"
                        />
                      </td>
                      {/* KOD VE AD TEK BİR DÜĞMEDİR: kullanıcının cümlesi
                          *"teklifin üstüne tıkladığımda"* — satırın kendisi
                          tıklanabilir olmalı, kenardaki küçük bir "Aç" bağı
                          değil. */}
                      <td className="px-2 py-1.5 font-mono font-medium whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setAcilan(t.id)}
                          className="oc-tap underline-offset-2 hover:underline"
                        >
                          {t.code || "—"}
                        </button>
                      </td>
                      <td className="max-w-[22rem] truncate px-2 py-1.5" title={t.baslik}>
                        <button
                          type="button"
                          onClick={() => setAcilan(t.id)}
                          className="oc-tap max-w-full truncate text-left underline-offset-2 hover:underline"
                        >
                          {t.baslik}
                        </button>
                        {t.tamameniIptal && (
                          <span className="ml-2 border border-destructive/40 px-1.5 py-0.5 text-[10px] text-destructive">
                            İptal
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {formatNum(t.kalemSayisi)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums">
                        {formatNum(t.firmaSayisi)}
                      </td>
                      <td className="hidden px-2 py-1.5 font-mono whitespace-nowrap md:table-cell">
                        {tarihGoster(t.sonTarih)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-medium tabular-nums">
                        {formatNum(Math.round(t.tablo.enIyiBolunmusToplamEur))}
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          €
                        </span>
                      </td>
                      <td className="hidden px-2 py-1.5 whitespace-nowrap lg:table-cell">
                        {t.tablo.enIyiTekFirma ? (
                          <span className="font-mono tabular-nums">
                            {formatNum(Math.round(t.tablo.enIyiTekFirma.toplamEur))} €
                            <span className="ml-1.5 font-sans text-[11px] text-muted-foreground">
                              {t.tablo.enIyiTekFirma.tedarikci}
                            </span>
                          </span>
                        ) : (
                          // BOŞ BIRAKILMAZ, NEDENİ YAZILIR: tek firmadan
                          // alınamıyor olması bir bilgidir.
                          <span className="text-[11px] text-muted-foreground">
                            Bütün kalemlere fiyat veren firma yok
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {acikTalep && (
        <RequestDialog
          key={acikTalep.id}
          talep={acikTalep}
          siparisAdetleri={siparisAdetleri}
          paylar={paylar}
          tedarikciler={tedarikciler}
          defter={defter}
          siparisNolari={siparisNolari}
          sonKur={sonKur}
          qualities={qualities}
          canWrite={canWrite}
          isAdmin={isAdmin}
          onClose={() => setAcilan(null)}
        />
      )}
    </div>
  );
}

function cip(aktif: boolean): string {
  return cn(
    "shrink-0 border px-2.5 py-1.5 font-mono text-[12px] whitespace-nowrap transition-colors pointer-coarse:py-2.5",
    aktif
      ? "border-primary/60 bg-primary/[0.10] font-medium text-foreground"
      : "border-border text-muted-foreground hover:text-foreground"
  );
}
