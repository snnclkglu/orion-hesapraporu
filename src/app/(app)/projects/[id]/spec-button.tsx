"use client";

// ŞARTNAME DÜĞMESİ — "Revizyonları Karşılaştır" ve "İşlem Kaydı"nın yanında.
//
// İKİ HÂLİ VAR VE İKİSİ AYNI ŞEYİ SÖYLEMEZ (kullanıcı isteği, 19.08.2026):
//   YOK  → KIRMIZI ZEMİNLİ "Şartnameyi Yükle". Renk bir süs değil: hesap
//          raporu şartnameye cevap verir ve şartnamesiz bir proje EKSİKTİR.
//          Eksikliğin görünür olması, eylem şeridindeki öteki iki bağlantı
//          gibi sessiz durmasından iyidir.
//   VAR  → sakin bir "Şartname". Basıldığında AÇILIR. Uyarı rengi burada
//          kalsaydı çözülmüş bir durum kalıcı bir alarm gibi okunurdu.
//
// KOVA ÖZELDİR: bağlantı her tıklamada kısa ömürlü imzalanır
// (`drawings/file-open-button.tsx` ile aynı desen). Depo anahtarı OPAKTIR
// (`{project_id}/{spec_id}.{uzantı}`) çünkü Türkçe "İ" (U+0130) taşıyan
// gerçek yolu anahtar yapmak imzalı bağlantıda sessiz hatalar üretiyor.

import { useRef, useState, useTransition } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SPEC_BUCKET, specExtension, type ProjectSpec } from "@/lib/project-specs";
import { registerProjectSpec } from "./spec-actions";

/** Kovanın sınırı 50 MB; istemci de aynı sayıyı bilir ki hata erken görünsün. */
const EN_BUYUK = 52_428_800;

export function SpecButton({
  projectId,
  spec,
  canEdit,
}: {
  projectId: string;
  spec: ProjectSpec | null;
  canEdit: boolean;
}) {
  const girdi = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [aciliyor, basla] = useTransition();

  function ac() {
    if (!spec) return;
    basla(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(SPEC_BUCKET)
        .createSignedUrl(spec.storagePath, 120);
      if (error || !data?.signedUrl) {
        toast.error("Şartname açılamadı.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    });
  }

  async function yukle(file: File) {
    if (file.size > EN_BUYUK) {
      toast.error("Dosya 50 MB sınırını aşıyor.");
      return;
    }
    setYukleniyor(true);
    try {
      const specId = crypto.randomUUID();
      const supabase = createClient();
      // İstemci depo yolunu `specExtension` ile kurar; sunucu AYNI yolu
      // BAĞIMSIZ olarak yeniden kurup oradan okur (bkz. `spec-actions.ts`).
      const yol = `${projectId}/${specId}.${specExtension(file.name)}`;
      const { error } = await supabase.storage.from(SPEC_BUCKET).upload(yol, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (error) {
        toast.error(`Yükleme başarısız: ${error.message}`);
        return;
      }
      const sonuc = await registerProjectSpec(projectId, {
        specId,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success(
        sonuc.pageCount
          ? `Şartname yüklendi — ${sonuc.pageCount} sayfa.`
          : "Şartname yüklendi."
      );
    } finally {
      setYukleniyor(false);
      if (girdi.current) girdi.current.value = "";
    }
  }

  const kutu =
    "oc-tap inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm pointer-coarse:h-10";

  if (!spec) {
    // Yetkisi olmayan da EKSİKLİĞİ görür — ama yükleyemez; düğme yerine
    // rozet gibi durur. Eksiklik yalnız yetkilinin sorunu değildir.
    return (
      <>
        <button
          type="button"
          disabled={!canEdit || yukleniyor}
          onClick={() => girdi.current?.click()}
          title={
            canEdit
              ? "Projenin teknik şartnamesini yükleyin"
              : "Şartname yüklenmemiş — yükleme yetkiniz yok"
          }
          className={`${kutu} border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-70`}
        >
          {yukleniyor ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {yukleniyor ? "Yükleniyor…" : "Şartnameyi Yükle"}
        </button>
        <input
          ref={girdi}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void yukle(f);
          }}
        />
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={ac}
      disabled={aciliyor}
      title={`${spec.fileName}${spec.pageCount ? ` · ${spec.pageCount} sayfa` : ""}`}
      className={`${kutu} bg-card hover:bg-muted`}
    >
      {aciliyor ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      ) : (
        <FileText className="size-3.5 text-muted-foreground" />
      )}
      Şartname
    </button>
  );
}
