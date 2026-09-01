"use client";

// KÜNYE — kapak kimliği, üst bant firmaları ve kapak fotoğrafı.
// AYRI BİR ÇALIŞMA YÜZÜDÜR (KITAP-19): içerik formlarıyla aynı uzun sayfada
// karışmaz.
//
// ————————————————————————————— LOGO SEÇİLİR, YÜKLENMEZ
//
// Kullanıcı kararı (01.09.2026): *"Künye'de logoları seçmeyi değiştirelim.
// Firma seçeyim. Firmalarım zaten Müşteriler kısmında kayıtlı ve logoları
// mevcut. Firma seçtiğimde otomatik o firmanın hem logosunu hem de diğer
// bilgilerini alabiliriz."*
//
// Eski yuvalar yalnız bir `<input type="file">` açıyordu: kullanıcı her
// kılavuzda aynı firmanın logosunu diskten yeniden buluyor, defterdeki
// `customers.logo_path` hiç okunmuyordu. Artık yuva bir SEÇİCİDİR; elle
// yükleme defterde olmayan kurumlar için GERİYE DÖNÜK YEDEK olarak kalır.
//
// ————————————————————————————— ALANLAR KAYNAĞINI SÖYLER
//
// Her künye alanının altında hangi bölümden geldiği yazar (Vinç Kimliği'ndeki
// desenin aynısı). "Kaynaktan Doldur" boş alanları çeker, "Hepsini Tazele"
// elle yazılmış olanları da kaynağa döndürür — makine önerir, insan son sözü
// söyler (KITAP-4).

import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ManualImageRow } from "@/lib/manual/data";
import type { ManualIdentity, ManualPartnerLogos } from "@/lib/manual/types";

/** Firma seçicisinin defteri — sunucudan gelir, bayt taşımaz. */
export interface FirmaSecenegi {
  id: string;
  name: string;
  shortName: string;
  address: string;
  taxOffice: string;
  taxNo: string;
  hasLogo: boolean;
}

/** Seçiciye "firma yok" satırı — `Select` boş değeri kabul etmez. */
const FIRMA_YOK = "__yok__";

const KUNYE_ALANLARI: { alan: keyof ManualIdentity; etiket: string }[] = [
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
  identitySources,
  docTitle,
  coverTitle,
  etiket,
  readOnly,
  onChange,
  onManufacturerCompany,
  onDoc,
  onEtiket,
  onRefreshIdentity,
  coverImageId,
  partnerLogos,
  images,
  gorseller,
  firmalar,
  firmaLogolari,
  projectBrandName,
  onGorselYukle,
  onCoverImage,
  onPartnerLogo,
  onPartnerCompany,
}: {
  identity: ManualIdentity;
  /** Alan → kaynak adı; boşsa satırın altında bir şey yazmaz. */
  identitySources: Partial<Record<keyof ManualIdentity, string>>;
  docTitle: string;
  coverTitle: string;
  etiket: string;
  readOnly: boolean;
  onChange: (alan: keyof ManualIdentity, deger: string) => void;
  onManufacturerCompany: (firma: FirmaSecenegi | null) => void;
  onDoc: (alan: "docTitle" | "coverTitle", deger: string) => void;
  onEtiket: (v: string) => void;
  onRefreshIdentity: (hepsiniTazele: boolean) => Promise<void>;
  coverImageId?: string;
  partnerLogos: ManualPartnerLogos;
  images: ReadonlyMap<string, ManualImageRow>;
  gorseller: ReadonlyMap<string, { url: string; oran: number }>;
  firmalar: readonly FirmaSecenegi[];
  /** `customers.id` → normalize edilmiş logo (veri adresi + ölçülmüş oran). */
  firmaLogolari: ReadonlyMap<string, { url: string; oran: number }>;
  /** Proje düzeyinde seçili Rapor Firması — orta yuvanın öntanımı. */
  projectBrandName: string;
  onGorselYukle: (file: File) => Promise<ManualImageRow | null>;
  onCoverImage: (imageId: string | undefined) => void;
  onPartnerLogo: (slot: "centerImageId" | "rightImageId", imageId: string | undefined) => void;
  onPartnerCompany: (slot: "centerCustomerId" | "rightCustomerId", customerId: string | undefined) => void;
}) {
  const [tazeleniyor, setTazeleniyor] = useState<"bos" | "hepsi" | null>(null);

  async function tazele(hepsi: boolean) {
    setTazeleniyor(hepsi ? "hepsi" : "bos");
    try {
      await onRefreshIdentity(hepsi);
    } finally {
      setTazeleniyor(null);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-xl text-xs text-muted-foreground">
          Kapak künyesi. Alanların çoğu projeden, iş emrinden, hesap raporundan ve müşteri
          defterinden OTOMATİK gelir; kaynağı olmayan alan BOŞ bırakılır — bir örnek değer
          yazmak, teslim edilen kılavuzda başka bir vincin seri numarası olarak kalabilir.
        </p>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="oc-tap"
              disabled={tazeleniyor !== null}
              onClick={() => void tazele(false)}
            >
              {tazeleniyor === "bos" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Kaynaktan Doldur
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="oc-tap"
              disabled={tazeleniyor !== null}
              title="Elle yazılmış künye alanları da kaynağın güncel değerine döner."
              onClick={() => void tazele(true)}
            >
              {tazeleniyor === "hepsi" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Hepsini Tazele
            </Button>
          </div>
        )}
      </div>

      {/* ——————————————————————————————————————— üretici firması */}
      <div className="grid gap-2 border-y py-3">
        <div>
          <p className="text-sm font-medium">Üretici firma</p>
          <p className="text-xs text-muted-foreground">
            Müşteri defterinden seçilir; adı, adresi ve vergi künyesi belgeye KOPYALANIR.
            Defter sonradan düzeltilirse teslim edilmiş kılavuz değişmez (KITAP-2).
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,20rem)_1fr] sm:items-start">
          <FirmaSecici
            etiket="Üretici"
            deger={identity.manufacturerCustomerId}
            readOnly={readOnly}
            firmalar={firmalar}
            onChange={(firma) => onManufacturerCompany(firma)}
          />
          <Alan
            etiket="Üretici Adı"
            deger={identity.manufacturer}
            kaynak={identitySources.manufacturer}
            readOnly={readOnly}
            onChange={(v) => onChange("manufacturer", v)}
          />
        </div>
        <Alan
          etiket="Üretici Adresi"
          deger={identity.manufacturerAddress}
          kaynak={identitySources.manufacturerAddress}
          readOnly={readOnly}
          cokSatir
          onChange={(v) => onChange("manufacturerAddress", v)}
        />
      </div>

      {/* ——————————————————————————————————————— üst logo bandı */}
      <div className="grid gap-2 border-b pb-3">
        <div>
          <p className="text-sm font-medium">Üst logo bandı</p>
          <p className="text-xs text-muted-foreground">
            ORION logosu solda sabittir. Orta ve sağ yuvalara müşteri defterinden firma
            seçilir; logo defterdeki kayıttan gelir, oranı bozulmaz.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="grid min-h-28 content-between gap-2 border bg-card p-2 text-center">
            <div className="grid min-h-14 place-items-center bg-card p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/orion-logo.png"
                alt="ORION Cranes logosu"
                className="max-h-12 max-w-full object-contain"
              />
            </div>
            <span className="text-[11px] text-muted-foreground">SOL · ORION (sabit)</span>
          </div>
          <FirmaYuvasi
            etiket="ORTA · FİRMA"
            ipucu={
              partnerLogos.centerCustomerId
                ? undefined
                : projectBrandName
                  ? `Seçim yoksa proje Rapor Firması basılır: ${projectBrandName}`
                  : "Seçim yoksa orta yuva açılmaz."
            }
            customerId={partnerLogos.centerCustomerId}
            imageId={partnerLogos.centerImageId}
            readOnly={readOnly}
            firmalar={firmalar}
            firmaLogolari={firmaLogolari}
            images={images}
            gorseller={gorseller}
            onGorselYukle={onGorselYukle}
            onCompany={(id) => onPartnerCompany("centerCustomerId", id)}
            onImage={(id) => onPartnerLogo("centerImageId", id)}
          />
          <FirmaYuvasi
            etiket="SAĞ · FİRMA"
            customerId={partnerLogos.rightCustomerId}
            imageId={partnerLogos.rightImageId}
            readOnly={readOnly}
            firmalar={firmalar}
            firmaLogolari={firmaLogolari}
            images={images}
            gorseller={gorseller}
            onGorselYukle={onGorselYukle}
            onCompany={(id) => onPartnerCompany("rightCustomerId", id)}
            onImage={(id) => onPartnerLogo("rightImageId", id)}
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

      {/* ——————————————————————————————————————— künye alanları */}
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
          kaynak="Proje künyesi · salt okunur"
          readOnly
          onChange={() => undefined}
        />
        <Alan etiket="Revizyon Etiketi" deger={etiket} readOnly={readOnly} onChange={onEtiket} />
        {KUNYE_ALANLARI.map((k) => (
          <Alan
            key={k.alan}
            etiket={k.etiket}
            deger={identity[k.alan] ?? ""}
            kaynak={identitySources[k.alan]}
            readOnly={readOnly}
            onChange={(v) => onChange(k.alan, v)}
          />
        ))}
      </div>
      <Alan
        etiket="Telif Satırı"
        deger={identity.copyright}
        kaynak={identitySources.copyright}
        readOnly={readOnly}
        cokSatir
        onChange={(v) => onChange("copyright", v)}
      />
    </div>
  );
}

/** Defterden firma seçer; seçim `customers.id` olarak saklanır. */
function FirmaSecici({
  etiket,
  deger,
  readOnly,
  firmalar,
  onChange,
}: {
  etiket: string;
  deger?: string;
  readOnly: boolean;
  firmalar: readonly FirmaSecenegi[];
  onChange: (firma: FirmaSecenegi | null) => void;
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{etiket}</span>
      <Select
        value={deger || FIRMA_YOK}
        disabled={readOnly}
        onValueChange={(v) =>
          onChange(v === FIRMA_YOK ? null : (firmalar.find((f) => f.id === v) ?? null))
        }
      >
        <SelectTrigger className="oc-tap w-full">
          <SelectValue placeholder="Firma seçin" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FIRMA_YOK}>— Elle yazılacak —</SelectItem>
          {firmalar.map((firma) => (
            <SelectItem key={firma.id} value={firma.id}>
              {firma.shortName || firma.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * Üst bandın bir yuvası: önce DEFTERDEN FİRMA, olmadı elle yüklenmiş görsel.
 *
 * İki yol da açık tutulur çünkü defterde kaydı olmayan bir kurumun logosu
 * (ortak yürütülen bir proje, bir gözetim firması) yalnız elle gelebilir.
 */
function FirmaYuvasi({
  etiket,
  ipucu,
  customerId,
  imageId,
  readOnly,
  firmalar,
  firmaLogolari,
  images,
  gorseller,
  onGorselYukle,
  onCompany,
  onImage,
}: {
  etiket: string;
  ipucu?: string;
  customerId?: string;
  imageId?: string;
  readOnly: boolean;
  firmalar: readonly FirmaSecenegi[];
  firmaLogolari: ReadonlyMap<string, { url: string; oran: number }>;
  images: ReadonlyMap<string, ManualImageRow>;
  gorseller: ReadonlyMap<string, { url: string; oran: number }>;
  onGorselYukle: (file: File) => Promise<ManualImageRow | null>;
  onCompany: (customerId: string | undefined) => void;
  onImage: (imageId: string | undefined) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const firma = customerId ? firmalar.find((f) => f.id === customerId) ?? null : null;
  const firmaLogo = customerId ? firmaLogolari.get(customerId)?.url ?? null : null;
  const elleGorsel = imageId ? gorseller.get(imageId) ?? null : null;

  async function yukle(file: File) {
    setYukleniyor(true);
    try {
      const yeni = await onGorselYukle(file);
      if (yeni) {
        onImage(yeni.id);
        toast.success(`${etiket} yerleştirildi — kaydetmeyi unutmayın.`);
      }
    } finally {
      setYukleniyor(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="grid min-h-28 content-start gap-2 border bg-card p-2">
      <div className="grid min-h-14 place-items-center bg-card p-2">
        {firmaLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={firmaLogo} alt={etiket} className="max-h-16 max-w-full object-contain" />
        ) : elleGorsel ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={elleGorsel.url} alt={etiket} className="max-h-16 max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">
            {firma ? "Bu firmanın logosu yüklenmemiş" : "Firma seçilmedi"}
          </span>
        )}
      </div>
      <div className="grid gap-1">
        <span className="oc-kicker text-[11px] text-muted-foreground">{etiket}</span>
        <FirmaSecici
          etiket="Firma"
          deger={customerId}
          readOnly={readOnly}
          firmalar={firmalar}
          onChange={(secilen) => onCompany(secilen?.id)}
        />
        {firma && !firma.hasLogo ? (
          <Badge variant="outline" className="w-fit text-[10px]">
            Defterde logo yok — Müşteriler ekranından yükleyin
          </Badge>
        ) : null}
        {ipucu ? <span className="text-[11px] text-muted-foreground">{ipucu}</span> : null}
        {!readOnly && (
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="oc-tap"
              disabled={yukleniyor}
              title="Defterde olmayan bir kurum için logoyu doğrudan yükleyin."
              onClick={() => input.current?.click()}
            >
              {yukleniyor ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImageIcon className="size-3.5" />
              )}
              {imageId ? "Görseli Değiştir" : "Elle Yükle"}
            </Button>
            {imageId && (
              <Button size="sm" variant="ghost" className="oc-tap" onClick={() => onImage(undefined)}>
                Görseli Kaldır
              </Button>
            )}
          </div>
        )}
        {imageId ? (
          <span className="truncate text-[11px] text-muted-foreground" title={images.get(imageId)?.fileName}>
            Elle yüklenen: {images.get(imageId)?.fileName ?? "—"}
          </span>
        ) : null}
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
      <div className="grid min-h-14 place-items-center bg-card p-2">
        {gorsel ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gorsel.url} alt={etiket} className="max-h-16 max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">Görsel seçilmedi</span>
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
  kaynak,
  readOnly,
  cokSatir,
  onChange,
}: {
  etiket: string;
  deger: string;
  kaynak?: string;
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
        />
      )}
      {/* KAYNAK GÖRÜNÜR KALIR: kullanıcı "bu değer nereden geldi" sorusunu
          alanı silip denemeden cevaplayabilmeli (Vinç Kimliği'nin deseni). */}
      {kaynak ? (
        <span className="truncate font-mono text-[10px] uppercase text-muted-foreground" title={kaynak}>
          {kaynak}
        </span>
      ) : null}
    </label>
  );
}
