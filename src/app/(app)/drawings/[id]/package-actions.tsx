"use client";

// Paket eylemleri — "Yeniden Eşleştir" ve "Sil".
//
// İKİ AYRI MALİYET, İKİ AYRI DÜĞME olacak şekilde tasarlandı ve bu Faz 1'de
// yalnız ilkini gerektiriyor: "Yeniden Eşleştir" DEPOYA HİÇ DOKUNMAZ, veritabanı
// üzerinde saniyenin altında biter. (Faz 2'de gelecek "İçerikleri Yeniden Oku"
// ise dosyaları yeniden indirir; ikisi karıştırılırsa kullanıcı ucuz olanı
// pahalı sanıp kullanmaz.)

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
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
