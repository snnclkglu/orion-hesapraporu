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
    <Button type="button" variant="outline" size="sm" onClick={open} disabled={opening}>
      <FileText className="size-3.5" />
      {opening ? "Açılıyor…" : fileName?.trim() || "Sözleşmeyi Aç"}
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
        <span className="min-w-0 flex-1 truncate text-sm">{fileName || "Sözleşme.pdf"}</span>
        <Button type="button" variant="outline" size="sm" onClick={open} disabled={opening}>
          {opening ? "Açılıyor…" : "Aç"}
        </Button>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
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
        "flex cursor-pointer flex-wrap items-center gap-2 border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5" +
        (disabled ? " pointer-events-none opacity-50" : "")
      }
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
      {busy ? "Yükleniyor…" : "Sözleşme PDF'ini seçin veya buraya sürükleyin"}
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
