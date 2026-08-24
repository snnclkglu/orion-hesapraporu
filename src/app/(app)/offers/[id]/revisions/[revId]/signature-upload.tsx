"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  isOfferSignaturePath,
  MAX_OFFER_SIGNATURE_BYTES,
  OFFER_SIGNATURE_BUCKET,
  OFFER_SIGNATURE_MIME,
  offerSignaturePath,
} from "@/lib/offers/signature";
import { prepareOfferSignature, removeOfferSignature } from "@/app/(app)/offers/actions";

export function SignatureUpload({
  offerId,
  revisionId,
  userId,
  path,
  fileName,
  onChange,
}: {
  offerId: string;
  revisionId: string;
  userId: string | null;
  path: string;
  fileName: string;
  onChange: (next: { path: string; fileName: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ path: string; url: string } | null>(null);
  const image = preview?.path === path ? preview.url : null;

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    let url = "";
    void (async () => {
      const { data } = await createClient().storage.from(OFFER_SIGNATURE_BUCKET).download(path);
      if (!data || cancelled) return;
      url = URL.createObjectURL(data);
      setPreview({ path, url });
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  async function upload(file: File) {
    if (!userId) {
      toast.error("Önce imza sahibini kullanıcı listesinden seçin.");
      return;
    }
    if (file.type !== OFFER_SIGNATURE_MIME) {
      toast.error("İmza dosyası PNG olmalıdır.");
      return;
    }
    if (file.size > MAX_OFFER_SIGNATURE_BYTES) {
      toast.error("İmza 1 MB sınırını aşıyor.");
      return;
    }

    setBusy(true);
    const target = offerSignaturePath(offerId, revisionId, userId, crypto.randomUUID());
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(OFFER_SIGNATURE_BUCKET)
      .upload(target, file, { contentType: OFFER_SIGNATURE_MIME, upsert: false });
    if (error) {
      setBusy(false);
      toast.error(`İmza yüklenemedi: ${error.message}`);
      return;
    }
    const result = await prepareOfferSignature(offerId, revisionId, { path: target, fileName: file.name });
    setBusy(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const previous = path;
    onChange({ path: target, fileName: file.name });
    if (previous && isOfferSignaturePath(offerId, revisionId, previous)) {
      void removeOfferSignature(offerId, revisionId, previous);
    }
    toast.success("PNG imza teklife eklendi.");
  }

  async function remove() {
    setBusy(true);
    if (isOfferSignaturePath(offerId, revisionId, path)) {
      const result = await removeOfferSignature(offerId, revisionId, path);
      if (result.error) {
        setBusy(false);
        toast.error(result.error);
        return;
      }
    }
    setBusy(false);
    onChange({ path: "", fileName: "" });
  }

  return (
    <div className="grid min-w-[13rem] gap-1.5">
      <span className="text-sm font-medium">PNG İmza</span>
      {path ? (
        <div className="flex h-16 items-center gap-2 border bg-white p-2">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Teklif imzası" className="h-full min-w-0 flex-1 object-contain" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
          <Button type="button" variant="ghost" size="icon-sm" disabled={busy} onClick={remove} aria-label="PNG imzayı kaldır">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
          </Button>
        </div>
      ) : null}
      <label className={busy || !userId ? "pointer-events-none opacity-50" : "cursor-pointer"}>
        <input
          type="file"
          accept="image/png,.png"
          className="hidden"
          disabled={busy || !userId}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        <span className="oc-tap inline-flex w-full items-center justify-center gap-2 border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-primary/5">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy ? "Hazırlanıyor…" : path ? "İmzayı değiştir" : "PNG imza seçin"}
        </span>
      </label>
      {fileName ? <span className="truncate text-[11px] text-muted-foreground" title={fileName}>{fileName}</span> : null}
    </div>
  );
}
