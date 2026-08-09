"use client";

// Sözleşme PDF'i — "Sözleşme var" işaretlendiğinde açılan yükleme alanı.
//
// Dosya doğrudan tarayıcıdan `contracts` bucket'ına yüklenir (özel/private);
// forma yalnız YOL yazılır. Yükleme işin kaydedilmesini BEKLEMEZ: yol istemcide
// üretilen bir klasör altındadır, böylece yeni iş açarken de dosya seçilebilir.
// Görüntüleme kısa ömürlü imzalı bağlantı ile yapılır — bucket herkese açık
// değildir, sözleşme yalnız oturum açmış kullanıcıya gider.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const BUCKET = "contracts";
const MAX_MB = 25;

/**
 * Yalnız AÇMA düğmesi — iş detayında sözleşmeyi görüntülemek için.
 * Bucket özel olduğundan bağlantı her tıklamada kısa ömürlü imzalanır.
 */
export function ContractOpenButton({
  path,
  fileName,
}: {
  path: string;
  fileName?: string;
}) {
  const [opening, startOpening] = useTransition();

  function open() {
    startOpening(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 120);
      if (error || !data?.signedUrl) {
        toast.error("Sözleşme açılamadı.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    });
  }

  return (
    // Birincil eylem telefonda tam genişlik ve 40px yükseklik alır; `sm`den
    // itibaren masaüstünün yoğun düzeni geri gelir. (Dokunmatik payı zaten
    // `size="sm"` tabanındaki `pointer-coarse:h-10`ten gelir; buradaki
    // `max-sm:` yalnız dar pencerede görsel ağırlık içindir.)
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full max-sm:h-10 max-sm:px-3 sm:w-auto"
      onClick={open}
      disabled={opening}
    >
      <FileText className="size-3.5" />
      <span className="min-w-0 truncate">
        {opening ? "Açılıyor…" : fileName?.trim() || "Sözleşmeyi Aç"}
      </span>
    </Button>
  );
}

export function ContractUpload({
  path,
  fileName,
  onChange,
  disabled,
}: {
  path: string;
  fileName: string;
  onChange: (next: { path: string; fileName: string }) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [opening, startOpening] = useTransition();

  async function upload(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Sözleşme PDF olmalıdır.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Dosya ${MAX_MB} MB sınırını aşıyor.`);
      return;
    }
    setBusy(true);
    const supabase = createClient();
    // Aynı ada sahip iki sözleşme birbirini ezmesin diye her yükleme kendi
    // klasörüne gider; dosya adı kullanıcıya gösterilmek üzere korunur.
    const folder = crypto.randomUUID();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const target = `${folder}/${safeName}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(target, file, { contentType: "application/pdf", upsert: false });
    setBusy(false);
    if (error) {
      toast.error(`Sözleşme yüklenemedi: ${error.message}`);
      return;
    }
    // Önceki dosya varsa depoda yer kaplamasın.
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    onChange({ path: target, fileName: file.name });
    toast.success("Sözleşme yüklendi.");
  }

  function open() {
    startOpening(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 120);
      if (error || !data?.signedUrl) {
        toast.error("Sözleşme açılamadı.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    });
  }

  async function remove() {
    setBusy(true);
    const supabase = createClient();
    await supabase.storage.from(BUCKET).remove([path]);
    setBusy(false);
    onChange({ path: "", fileName: "" });
  }

  if (path) {
    return (
      <div className="flex flex-wrap items-center gap-2 border bg-muted/30 px-3 py-2">
        <FileText className="size-4 shrink-0 text-primary" />
        {/* Dosya adı iki düğmeyle aynı satırı paylaşınca telefonda ~10
            karakterde kesiliyordu; mobilde kendi satırını alır. */}
        <span
          className="min-w-0 basis-full truncate text-sm sm:flex-1 sm:basis-auto"
          title={fileName || "Sözleşme.pdf"}
        >
          {fileName || "Sözleşme.pdf"}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 max-sm:h-10 max-sm:px-3 sm:flex-none"
          onClick={open}
          disabled={opening}
        >
          {opening ? "Açılıyor…" : "Aç"}
        </Button>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1 text-destructive max-sm:h-10 max-sm:px-3 sm:flex-none"
            onClick={remove}
            disabled={busy}
          >
            <Trash2 className="size-3.5" /> Kaldır
          </Button>
        )}
      </div>
    );
  }

  return (
    <label
      className={
        "flex min-h-10 cursor-pointer flex-wrap items-center gap-2 border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5" +
        (disabled ? " pointer-events-none opacity-50" : "")
      }
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
      {busy ? (
        "Yükleniyor…"
      ) : (
        <span>
          {"Sözleşme PDF'ini seçin"}
          {/* Dokunmatikte sürükle-bırak yoktur; ipucu yalnız fare düzeninde
              anlamlı ve telefonda satırı ikiye bölüyordu. */}
          <span className="hidden sm:inline">{" veya buraya sürükleyin"}</span>
        </span>
      )}
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </label>
  );
}
