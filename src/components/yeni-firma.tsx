"use client";

// YENİ FİRMA — AKIŞI KESMEDEN.
//
// Kullanıcı kararı (13.08.2026): *"Kullanıcı sipariş açarken veya teklif
// girerken eğer yeni bir firma ise hemen orda yeni firma olarak
// kaydedebilsin."*
//
// Düğme YALNIZ GEREKİNCE BELİRİR: yazılan ad defterde zaten varsa hiçbir şey
// çizilmez. Her firmanın yanında duran bir "kaydet" düğmesi, vakaların
// %95'inde gereksiz bir gürültü olurdu ve asıl gerektiği anda fark edilmezdi.
//
// KAYIT TEKLİFİN ŞARTI DEĞİLDİR. Firma deftere yazılmasa da teklif kaydedilir
// (`supplier` metni satırın kendisinde durur, SATIN-21) — defter bir ÖNERİ
// kaynağıdır, bir kapı değil. Düğmeye basmamak hiçbir şeyi engellemez;
// basmak yalnız bir dahaki sefere listede çıkmasını sağlar.

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus } from "lucide-react";
import { trKatla } from "@/lib/drawings/tr-text";
import { ensureSupplier } from "@/app/(app)/purchasing/actions";

export function YeniFirma({
  ad,
  tedarikciler,
}: {
  ad: string;
  /** Öneri listesi — ad zaten buradaysa düğme çizilmez. */
  tedarikciler: readonly string[];
}) {
  const [calisiyor, setCalisiyor] = useState(false);
  const [yazildi, setYazildi] = useState(false);

  const temiz = (ad ?? "").trim();
  // KARŞILAŞTIRMA KATLANMIŞ: "ÇELİK RULMAN" yazan biri için "CELIK RULMAN"
  // zaten defterdeyse düğme çıkmamalı — yoksa aynı firma iki kez yazılır.
  const anahtar = trKatla(temiz);
  const zatenVar = tedarikciler.some((t) => trKatla(t) === anahtar);

  if (!temiz || temiz.length < 2 || zatenVar) return null;

  if (yazildi) {
    return (
      <span
        className="inline-flex size-9 items-center justify-center text-emerald-600 dark:text-emerald-400"
        title="Firma deftere eklendi"
      >
        <Check className="size-4" />
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={calisiyor}
      title={`"${temiz}" firmasını deftere ekle — bir dahaki sefere listede çıkar`}
      onClick={async () => {
        setCalisiyor(true);
        const sonuc = await ensureSupplier({ name: temiz });
        setCalisiyor(false);
        if (sonuc.error) toast.error(sonuc.error);
        else {
          setYazildi(true);
          toast.success(`${sonuc.name ?? temiz} deftere eklendi.`);
        }
      }}
      className="oc-tap-square inline-flex size-9 shrink-0 items-center justify-center border border-dashed text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
    >
      {calisiyor ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
    </button>
  );
}
