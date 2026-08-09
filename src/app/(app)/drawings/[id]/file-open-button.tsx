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
      const tarayicidaAcilir = opensInBrowser(fileName);

      // `download` seçeneği `Content-Disposition: attachment; filename=…`
      // yazar. Depo anahtarı bir UUID olduğu için bu OLMADAN indirilen dosya
      // uzantısız iniyor ve DXF kesim programında açılmıyordu. PDF'te
      // verilmez — o yeni sekmede görüntülensin.
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, 120, tarayicidaAcilir ? undefined : { download: fileName });

      if (error || !data?.signedUrl) {
        toast.error("Dosya açılamadı.");
        return;
      }

      if (tarayicidaAcilir) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }
      // İndirme yeni sekme AÇMAZ: `Content-Disposition: attachment` yüzünden
      // sekme boş açılıp hemen kapanıyor ve kullanıcı bir şey olmadı sanıyor.
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
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
        // ile verilir, kırılımla değil (AGENTS, dokunmatik md. 1).
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
