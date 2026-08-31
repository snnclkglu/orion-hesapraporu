"use client";

// KÜNYE — kapak kimliği ve logo yuvaları. AYRI BİR ÇALIŞMA YÜZÜDÜR (KITAP-19):
// içerik formlarıyla aynı uzun sayfada karışmaz.
//
// Dosya `manual-editor.tsx`ten OLDUĞU GİBİ taşındı; davranışı değişmedi.

import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ManualImageRow } from "@/lib/manual/data";
import type { ManualIdentity, ManualPartnerLogos } from "@/lib/manual/types";

const KUNYE_ALANLARI: { alan: keyof ManualIdentity; etiket: string }[] = [
  { alan: "manufacturer", etiket: "Üretici" },
  { alan: "product", etiket: "Ürün" },
  { alan: "craneType", etiket: "Vinç Tipi" },
  { alan: "serialNo", etiket: "Seri Numara" },
  { alan: "productionYear", etiket: "Üretim Yılı" },
  { alan: "customer", etiket: "Müşteri" },
  { alan: "site", etiket: "Saha / Konum" },
  { alan: "customerDocNo", etiket: "Doküman No" },
  { alan: "customerRevision", etiket: "Versiyon / Revizyon" },
  { alan: "preparedOn", etiket: "Hazırlama Tarihi" },
  { alan: "revisedOn", etiket: "Son Revizyon Tarihi" },
];

export function IdentityForm({
  identity,
  docTitle,
  coverTitle,
  etiket,
  readOnly,
  onChange,
  onDoc,
  onEtiket,
  coverImageId,
  partnerLogos,
  images,
  gorseller,
  onGorselYukle,
  onCoverImage,
  onPartnerLogo,
}: {
  identity: ManualIdentity;
  docTitle: string;
  coverTitle: string;
  etiket: string;
  readOnly: boolean;
  onChange: (alan: keyof ManualIdentity, deger: string) => void;
  onDoc: (alan: "docTitle" | "coverTitle", deger: string) => void;
  onEtiket: (v: string) => void;
  coverImageId?: string;
  partnerLogos: ManualPartnerLogos;
  images: ReadonlyMap<string, ManualImageRow>;
  gorseller: ReadonlyMap<string, { url: string; oran: number }>;
  onGorselYukle: (file: File) => Promise<ManualImageRow | null>;
  onCoverImage: (imageId: string | undefined) => void;
  onPartnerLogo: (slot: keyof ManualPartnerLogos, imageId: string | undefined) => void;
}) {
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        Kapak künyesi. Bilinmeyen alan BOŞ bırakılır — belgede o satır hiç basılmaz;
        bir örnek değer yazmak, teslim edilen kılavuzda başka bir vincin seri numarası
        olarak kalabilir.
      </p>
      <div className="grid gap-2 border-y py-3">
        <div>
          <p className="text-sm font-medium">Üst logo bandı</p>
          <p className="text-xs text-muted-foreground">
            ORION logosu solda sabittir. Ek firma logoları kapakta ve üst bantta orta ve
            sağ yuvalara yerleşir; oranları bozulmaz.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="grid min-h-28 content-between gap-2 border bg-card p-2 text-center">
            <div className="grid min-h-14 place-items-center bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/orion-logo.png"
                alt="ORION Cranes logosu"
                className="max-h-12 max-w-full object-contain"
              />
            </div>
            <span className="text-[11px] text-muted-foreground">SOL · ORION (sabit)</span>
          </div>
          <BelgeGorselYuvasi
            etiket="ORTA · EK FİRMA 1"
            imageId={partnerLogos.centerImageId}
            readOnly={readOnly}
            images={images}
            gorseller={gorseller}
            onGorselYukle={onGorselYukle}
            onChange={(id) => onPartnerLogo("centerImageId", id)}
          />
          <BelgeGorselYuvasi
            etiket="SAĞ · EK FİRMA 2"
            imageId={partnerLogos.rightImageId}
            readOnly={readOnly}
            images={images}
            gorseller={gorseller}
            onGorselYukle={onGorselYukle}
            onChange={(id) => onPartnerLogo("rightImageId", id)}
          />
        </div>
        <div className="max-w-sm">
          <BelgeGorselYuvasi
            etiket="KAPAK FOTOĞRAFI"
            imageId={coverImageId}
            readOnly={readOnly}
            images={images}
            gorseller={gorseller}
            onGorselYukle={onGorselYukle}
            onChange={onCoverImage}
          />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Alan
          etiket="Belge Adı"
          deger={docTitle}
          readOnly={readOnly}
          onChange={(v) => onDoc("docTitle", v)}
        />
        {/* KAPAK BAŞLIĞI SALT OKUNURDUR (KITAP-3): PDF güncel `projects.name`i
            basar ve burada düzenlenebilir görünseydi kullanıcı teslim belgesini
            etkilemeyen bir başlığı düzelttiğini sanırdı. */}
        <Alan
          etiket="Kapak Başlığı (Proje Adı)"
          deger={coverTitle}
          readOnly
          onChange={() => undefined}
        />
        <Alan etiket="Revizyon Etiketi" deger={etiket} readOnly={readOnly} onChange={onEtiket} />
        {KUNYE_ALANLARI.map((k) => (
          <Alan
            key={k.alan}
            etiket={k.etiket}
            deger={identity[k.alan]}
            readOnly={readOnly}
            onChange={(v) => onChange(k.alan, v)}
          />
        ))}
      </div>
      <Alan
        etiket="Üretici Adresi"
        deger={identity.manufacturerAddress}
        readOnly={readOnly}
        cokSatir
        onChange={(v) => onChange("manufacturerAddress", v)}
      />
      <Alan
        etiket="Telif Satırı"
        deger={identity.copyright}
        readOnly={readOnly}
        onChange={(v) => onChange("copyright", v)}
      />
    </div>
  );
}

function BelgeGorselYuvasi({
  etiket,
  imageId,
  readOnly,
  images,
  gorseller,
  onGorselYukle,
  onChange,
}: {
  etiket: string;
  imageId?: string;
  readOnly: boolean;
  images: ReadonlyMap<string, ManualImageRow>;
  gorseller: ReadonlyMap<string, { url: string; oran: number }>;
  onGorselYukle: (file: File) => Promise<ManualImageRow | null>;
  onChange: (imageId: string | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const gorsel = imageId ? gorseller.get(imageId) : null;
  const kayit = imageId ? images.get(imageId) : null;

  async function yukle(file: File) {
    setYukleniyor(true);
    try {
      const yeni = await onGorselYukle(file);
      if (yeni) {
        onChange(yeni.id);
        toast.success(`${etiket} yerleştirildi — kaydetmeyi unutmayın.`);
      }
    } finally {
      setYukleniyor(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="grid min-h-28 content-between gap-2 border bg-card p-2">
      <div className="grid min-h-14 place-items-center bg-white p-2">
        {gorsel ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gorsel.url} alt={etiket} className="max-h-16 max-w-full object-contain" />
        ) : (
          <span className="text-xs text-gray-500">Görsel seçilmedi</span>
        )}
      </div>
      <div className="grid gap-1">
        <span
          className="truncate text-[11px] text-muted-foreground"
          title={kayit?.fileName ?? etiket}
        >
          {etiket}
          {kayit ? ` · ${kayit.fileName}` : ""}
        </span>
        {!readOnly && (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="oc-tap flex-1"
              disabled={yukleniyor}
              onClick={() => input.current?.click()}
            >
              {yukleniyor ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImageIcon className="size-3.5" />
              )}
              {imageId ? "Değiştir" : "Seç"}
            </Button>
            {imageId && (
              <Button size="sm" variant="ghost" className="oc-tap" onClick={() => onChange(undefined)}>
                Kaldır
              </Button>
            )}
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void yukle(file);
        }}
      />
    </div>
  );
}

function Alan({
  etiket,
  deger,
  readOnly,
  cokSatir,
  onChange,
}: {
  etiket: string;
  deger: string;
  readOnly: boolean;
  cokSatir?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{etiket}</span>
      {cokSatir ? (
        <Textarea
          value={deger}
          disabled={readOnly}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          value={deger}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          className="h-9"
        />
      )}
    </label>
  );
}
