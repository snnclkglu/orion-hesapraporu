"use client";

// Depodaki dosyayı açar.
//
// Bucket ÖZELDİR; bağlantı her tıklamada kısa ömürlü imzalanır — `contracts`
// bucket'ındaki `ContractOpenButton` ile aynı desen. Depo anahtarı OPAKTIR
// (`{package_id}/{file_id}`) çünkü Türkçe "İ" (U+0130) taşıyan gerçek yolu
// anahtar yapmak imzalı bağlantı ve kodlama tarafında sessiz hatalar üretir.

import { useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { opensInBrowser } from "@/lib/drawings/mime";

const BUCKET = "drawings";

export function FileOpenButton({
  storagePath,
  fileName,
  label,
  title,
  className,
  disabled,
}: {
  storagePath: string;
  /** GERÇEK dosya adı — depo anahtarı opak olduğu için indirmede bu kullanılır. */
  fileName: string;
  label: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [aciliyor, basla] = useTransition();

  function ac() {
    if (!storagePath) {
      toast.error("Bu dosya depoya yüklenmemiş.");
      return;
    }
    basla(async () => {
      const supabase = createClient();

      // PDF YENİ SEKMEDE AÇILIR — üretime inen resim odur, mühendis ona bakmak
      // ister. İmzalı bağlantı yeter; indirme adı gerekmez.
      if (opensInBrowser(fileName)) {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(storagePath, 120);
        if (error || !data?.signedUrl) {
          toast.error("Dosya açılamadı.");
          return;
        }
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }

      // GERİ KALANI BLOB OLARAK İNER ve adı TARAYICIDA verilir.
      //
      // Neden imzalı bağlantının `download` seçeneği kullanılmıyor: o seçenek
      // adı sunucunun `Content-Disposition` başlığına yüzde kodlanmış yazıyor
      // ve tarayıcı onu düz metin sanıyor — dosya
      // `S235JR - 15MM - 0057-00-0510-01 - %281 ADET%29.dxf` diye iniyordu.
      // Parantez, boşluk ve Türkçe harf taşıyan gerçek adlarda bu kaçınılmaz.
      //
      // Blob aynı kökenli bir `blob:` adresi ürettiği için `<a download>`
      // özniteliği ARTIK GEÇERLİDİR (çapraz kökende yok sayılıyordu) ve ad
      // neyse o olur. Bedeli dosyanın tarayıcı belleğinden geçmesi; bucket
      // sınırı 50 MB ve gözlenen en büyük dosya 5,6 MB olduğu için kabul
      // edilebilir.
      const { data: blob, error } = await supabase.storage.from(BUCKET).download(storagePath);
      if (error || !blob) {
        toast.error("Dosya indirilemedi.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Serbest bırakma tıklamadan HEMEN sonra olmaz: bazı tarayıcılar indirmeyi
      // başlatmadan adresi kaybeder.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }

  return (
    <button
      type="button"
      onClick={ac}
      disabled={disabled || aciliyor || !storagePath}
      title={title}
      className={cn(
        // Elle yazılmış tıklanabilir öğe: dokunmatik payı `pointer-coarse:`
        // ile verilir, kırılımla değil (AGENTS, dokunmatik MOBIL-1).
        "relative z-10 inline-flex min-h-6 items-center border px-1.5 font-mono text-[11px] transition-colors pointer-coarse:min-h-8 pointer-coarse:px-2",
        storagePath
          ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
          : "border-dashed text-muted-foreground",
        className
      )}
    >
      {aciliyor ? "…" : label}
    </button>
  );
}
