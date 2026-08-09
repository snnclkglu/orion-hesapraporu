"use client";

// Paket eylemleri — "Yeniden Eşleştir" ve "Sil".
//
// İKİ AYRI MALİYET, İKİ AYRI DÜĞME olacak şekilde tasarlandı ve bu Faz 1'de
// İKİ AYRI MALİYET, İKİ AYRI DÜĞME — ve fark her ikisinin `title`ında yazılı:
//   "Yeniden Eşleştir"      depoya HİÇ dokunmaz, saniyenin altında biter
//   "İçerikleri Yeniden Oku" her resmi ve DXF'i YENİDEN İNDİRİR, dakikalar sürer
// Tek düğmede birleşselerdi kullanıcı ucuz olanı pahalı sanıp hiç kullanmazdı.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpenCheck, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deletePackage, reconcilePackage } from "../actions";

export function PackageActions({ packageId }: { packageId: string }) {
  const router = useRouter();
  const [calisiyor, basla] = useTransition();
  const [silmeOnayi, setSilmeOnayi] = useState(false);

  function yenidenEslestir() {
    basla(async () => {
      const sonuc = await reconcilePackage({ packageId });
      if (sonuc.error) toast.error(sonuc.error);
      else toast.success(`Defter yeniden kuruldu — tanıma %${sonuc.recognitionPct ?? 0}.`);
      router.refresh();
    });
  }

  /**
   * İçerikleri yeniden oku — PAHALI YOL.
   *
   * "Yeniden Eşleştir"den farkı budur ve düğme metni bunu söylemeli: bu işlem
   * her resmi ve her DXF'i DEPODAN YENİDEN İNDİRİR (bir pakette 270 dosya, ~200
   * MB olabilir). Yalnız içerik okuyucuları değiştiğinde ya da ilk yüklemede
   * okuma yarıda kaldığında gerekir.
   */
  function icerikleriOku() {
    basla(async () => {
      for (const asama of ["pdf", "dxf"] as const) {
        let ofset = 0;
        for (let tur = 0; tur < 200; tur++) {
          const yanit = await fetch(
            `/drawings/${packageId}/import?asama=${asama}&ofset=${ofset}&adet=${asama === "pdf" ? 20 : 25}`,
            { method: "POST" }
          );
          if (!yanit.ok) {
            toast.error(`${asama.toUpperCase()} okuma tamamlanamadı.`);
            return;
          }
          const sonuc = (await yanit.json()) as { kalan: number; sonraki: number | null };
          if (!sonuc.kalan || sonuc.sonraki == null) break;
          ofset = sonuc.sonraki;
        }
      }
      const es = await reconcilePackage({ packageId });
      if (es.error) toast.error(es.error);
      else toast.success("İçerikler okundu ve defter yenilendi.");
      router.refresh();
    });
  }

  function sil() {
    if (!silmeOnayi) {
      setSilmeOnayi(true);
      return;
    }
    basla(async () => {
      const sonuc = await deletePackage({ packageId });
      if (sonuc.error) {
        toast.error(sonuc.error);
        setSilmeOnayi(false);
        return;
      }
      toast.success("Paket silindi.");
      router.push("/drawings");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={yenidenEslestir}
        disabled={calisiyor}
        title="Dosyalar yeniden indirilmez; yalnız defter ve bulgular yeniden kurulur."
      >
        {calisiyor ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
        Yeniden Eşleştir
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={icerikleriOku}
        disabled={calisiyor}
        title="Her resmi ve DXF'i depodan YENİDEN İNDİRİR — pakette yüzlerce dosya varsa dakikalar sürebilir."
      >
        {calisiyor ? <Loader2 className="size-3.5 animate-spin" /> : <BookOpenCheck className="size-3.5" />}
        İçerikleri Yeniden Oku
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={sil}
        disabled={calisiyor}
        title="Paketi ve bütün depo dosyalarını siler — yalnız Yönetici."
      >
        <Trash2 className="size-3.5" />
        {silmeOnayi ? "Emin misiniz?" : "Sil"}
      </Button>
    </div>
  );
}
