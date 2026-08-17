"use client";

// YAKLAŞAN — ±30 günlük tarih şeridi, artık YEDİ TÜRLÜ birleşik ajanda.
// Aylık takvim ızgarası BİLEREK yok: bugünkü veri yoğunluğunda ayın
// günlerinin çoğu boş kalırdı (kullanıcı kararı — model değişmedi, kaynaklar
// çoğaldı).
//
// TÜR ÇİPLERİ yereldir, adrese YAZILMAZ: bu paylaşılabilir bir süzgeç değil
// kişisel bir bakıştır. Çip yalnız GÖRÜNEN pencerede kaydı olan tür için
// çizilir (sıfır kuralı — pencere dışındaki bir türe çip koymak boş sonuç
// üretirdi). Süzme saf çekirdekle: çipler ham listeyi süzer, mevcut
// `panelTakvim` aynen bantlar.

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  panelTakvim,
  takvimTurler,
  type PanelDate,
} from "@/lib/panel";
import { cn } from "@/lib/utils";
import { Baslik, PanelEmpty } from "./section-frame";

/** Gün başına gösterilen kayıt sınırı — kalabalık gün şeridi boğmasın. */
const GUN_SINIRI = 6;

export function AgendaSection({
  dates,
  today,
}: {
  dates: PanelDate[];
  today: string;
}) {
  // Çipler PENCEREDEKİ kayıtlardan türetilir: pencere dışında kalan bir tür
  // için çip çizmek, tıklayana boş liste göstermek olurdu.
  const penceredeki = useMemo(
    () => panelTakvim(dates, today).flatMap((g) => g.items),
    [dates, today]
  );
  const turler = useMemo(() => takvimTurler(penceredeki), [penceredeki]);
  const [secili, setSecili] = useState<ReadonlySet<string>>(new Set());

  const days = useMemo(() => {
    const suzulmus =
      secili.size === 0 ? dates : dates.filter((d) => secili.has(d.kind));
    return panelTakvim(suzulmus, today);
  }, [dates, today, secili]);

  function cevir(tur: string) {
    setSecili((eski) => {
      const yeni = new Set(eski);
      if (yeni.has(tur)) yeni.delete(tur);
      else yeni.add(tur);
      return yeni;
    });
  }

  return (
    <section>
      <Baslik>Yaklaşan</Baslik>

      {turler.length > 1 && (
        <div
          className="oc-scrollx mb-3 flex items-center gap-1.5 overflow-x-auto overscroll-x-contain pb-1"
          role="group"
          aria-label="Tür süzgeci"
        >
          <button
            type="button"
            onClick={() => setSecili(new Set())}
            aria-pressed={secili.size === 0}
            className={cn(
              "oc-tap shrink-0 border px-2 py-0.5 font-mono text-[11px] transition-colors",
              secili.size === 0
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:border-primary hover:text-foreground"
            )}
          >
            Tümü
          </button>
          {turler.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => cevir(t)}
              aria-pressed={secili.has(t)}
              className={cn(
                "oc-tap shrink-0 border px-2 py-0.5 font-mono text-[11px] whitespace-nowrap transition-colors",
                secili.has(t)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:border-primary hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {days.length === 0 ? (
        <PanelEmpty>
          Önümüzdeki otuz günde tarihli bir kayıt yok. Buraya satış termin ve
          sevk günleri, satın alma teslimleri, size atanan görev ve yapılacak
          vadeleri ile aktif işlerin teslim tarihleri düşer.
        </PanelEmpty>
      ) : (
        <ol className="grid gap-px border bg-border">
          {days.map((gun) => (
            <li
              key={gun.date}
              className="grid gap-2 bg-card px-3 py-2.5 sm:grid-cols-[6rem_1fr] sm:gap-3"
            >
              <div className="flex items-baseline gap-2 sm:flex-col sm:gap-0.5">
                <span
                  className={
                    gun.overdue
                      ? "font-mono text-[13px] font-semibold text-amber-700 dark:text-amber-400"
                      : "font-mono text-[13px] font-semibold"
                  }
                >
                  {gun.label}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {gun.date.split("-").reverse().join(".")}
                </span>
              </div>
              <ul className="grid gap-1">
                {gun.items.slice(0, GUN_SINIRI).map((k, i) => (
                  <li key={`${k.kind}-${k.label}-${i}`}>
                    <Link
                      href={k.href}
                      // DOKUNMA HEDEFİ: satır 20px ölçüldü (telefon ve
                      // tablette). `.oc-tap` DEĞİL `pointer-coarse:py-*`
                      // kullanılır — evin kuralı liste SATIRLARINI istisna
                      // tutar (dar ekran md. 1): görünmez bir 44px katman
                      // burada üst üste binen hedefler üretirdi, satırın
                      // kendi ritmini büyütmek doğru olandır.
                      className="-mx-1 flex items-baseline gap-2 rounded-none px-1 py-1 text-[13px] hover:bg-muted/60 hover:underline pointer-coarse:py-2.5"
                    >
                      <span className="oc-bullet mt-1.5" aria-hidden />
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {k.kind}
                      </span>
                      <span className="min-w-0 truncate" title={k.hint ?? k.label}>
                        <span className="font-medium">{k.label}</span>
                        {k.hint && (
                          <span className="text-muted-foreground"> · {k.hint}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
                {/* KIRPMA SESSİZ OLMAZ (arama listesinin kuralı). */}
                {gun.items.length > GUN_SINIRI && (
                  <li className="px-1 text-[11px] text-muted-foreground">
                    + {gun.items.length - GUN_SINIRI} kayıt daha — tür
                    çipleriyle daraltın
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
