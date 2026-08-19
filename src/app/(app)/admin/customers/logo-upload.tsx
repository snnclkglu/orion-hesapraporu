"use client";

// MÜŞTERİ LOGOSU — yükleme, önizleme, kaldırma.
//
// Logo teklif kapağındaki künyenin KİME sütununda görünür (kullanıcı isteği,
// 19.08.2026, md. 21). Dosya doğrudan tarayıcıdan `customer-logos` kovasına
// gider (özel/private); server action yalnız ÖLÇER ve satıra yolu yazar —
// Next server action gövdesinin sınırı 1 MB'tır ve baytların oradan geçmesi
// gerekmez (sözleşme PDF'i ve özlük dosyası kalıbı).
//
// ÖNİZLEME BLOB ÜZERİNDENDİR, imzalı adresle değil: uygulamanın CSP'si
// `img-src 'self' data: blob:` der (next.config.ts) ve Supabase kökeni orada
// YOKTUR — imzalı bir adres `<img src>`e verilseydi tarayıcı onu sessizce
// engellerdi ve kullanıcı "logo bozuk" sanırdı. Baytlar indirilip
// `URL.createObjectURL` ile gösterilir; böylece ekranda görülen şey PDF'e
// giden şeyin TA KENDİSİdir (sunucunun normalleştirdiği hâli).

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CUSTOMER_LOGO_BUCKET,
  CUSTOMER_LOGO_MIME,
  MAX_CUSTOMER_LOGO_BYTES,
  customerLogoPath,
} from "@/lib/customers/logo";
import { clearCustomerLogo, setCustomerLogo } from "../actions";

export function CustomerLogoUpload({
  customerId,
  path,
  fileName,
  onChange,
}: {
  customerId: string;
  path: string;
  fileName: string;
  onChange: (next: { path: string; fileName: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  /**
   * Önizleme YOLUYLA BİRLİKTE saklanır ve gösterim ondan TÜRETİLİR.
   *
   * Yol değişince state'i etkinin içinde sıfırlamak bir basamak fazladan
   * render demekti (`react-hooks/set-state-in-effect`); üstelik logo
   * kaldırıldığında eski görüntü bir kare boyunca ekranda kalırdı. Kayıtlı yol
   * ile önizlemenin yolu eşleşmiyorsa görüntü yok sayılır.
   */
  const [preview, setPreview] = useState<{ path: string; url: string } | null>(null);
  const gorsel = preview?.path === path ? preview.url : null;

  useEffect(() => {
    if (!path) return;
    let iptal = false;
    let url = "";
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.storage.from(CUSTOMER_LOGO_BUCKET).download(path);
      if (!data || iptal) return;
      url = URL.createObjectURL(data);
      setPreview({ path, url });
    })();
    return () => {
      iptal = true;
      // Nesne adresi elle bırakılır: bırakılmazsa pencere her açılışta bir
      // öncekinin baytları bellekte kalırdı.
      if (url) URL.revokeObjectURL(url);
    };
  }, [path]);

  async function upload(file: File) {
    // İSTEMCİ KONTROLÜ BİR KOLAYLIKTIR, kelepçe değil: asıl ölçüm sunucudadır
    // (`normalizeCustomerLogo`) ve kova da 2 MB'ta keser. Burada olması,
    // kullanıcının yanlış dosyayı yüklemesini BEKLEMEDEN öğrenmesi içindir.
    if (file.type !== CUSTOMER_LOGO_MIME) {
      toast.error("Logo PNG olmalıdır. Dosyayı PNG olarak kaydedip tekrar deneyin.");
      return;
    }
    if (file.size > MAX_CUSTOMER_LOGO_BYTES) {
      toast.error("Logo 2 MB sınırını aşıyor.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const target = customerLogoPath(customerId, crypto.randomUUID());
    const { error } = await supabase.storage
      .from(CUSTOMER_LOGO_BUCKET)
      .upload(target, file, { contentType: CUSTOMER_LOGO_MIME, upsert: false });
    if (error) {
      setBusy(false);
      toast.error(`Logo yüklenemedi: ${error.message}`);
      return;
    }

    const res = await setCustomerLogo(customerId, { path: target, fileName: file.name });
    setBusy(false);
    if (res.error) {
      // YÜKLENEN NESNEYİ BURADAN SİLMİYORUZ: sunucu reddettiği dosyayı zaten
      // kendisi kaldırıyor. Buradan da silmek, cevabı yolda kaybolan BAŞARILI
      // bir isteğin ardından geçerli bir logoyu silme riski taşırdı.
      toast.error(res.error);
      return;
    }
    onChange({ path: target, fileName: file.name });
    toast.success("Logo yüklendi.");
  }

  async function remove() {
    setBusy(true);
    const res = await clearCustomerLogo(customerId);
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    onChange({ path: "", fileName: "" });
    toast.success("Logo kaldırıldı.");
  }

  const secici = (
    <label className={busy ? "pointer-events-none opacity-50" : "cursor-pointer"}>
      <input
        type="file"
        accept="image/png,.png"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Aynı dosya ikinci kez seçilebilsin diye kutu boşaltılır.
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      <span className="oc-tap inline-flex items-center gap-2 border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? "Yükleniyor…" : path ? "Değiştir" : "PNG logo seçin"}
      </span>
    </label>
  );

  if (!path) {
    return (
      <div className="grid gap-1.5">
        {secici}
        <p className="text-xs text-muted-foreground">
          {/* Logo YOKSA bir eksiklik yoktur: teklif kapağı logosuz basılır ve
              yerinde boşluk ya da tire bırakmaz (SATIS-16). Kullanıcı bunu
              denemeden bilmeli. */}
          Teklif kapağındaki künyede müşteri firmanın logosu olarak basılır.
          Logo yüklenmezse teklif logosuz basılır, belgede boşluk kalmaz.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {/* ZEMİN BEYAZDIR ÇÜNKÜ KÂĞIT BEYAZDIR: saydam zeminli bir logo koyu
            temada okunuyormuş gibi görünüp basılan belgede kaybolabilirdi.
            Önizleme belgenin koşullarını taklit eder. */}
        <div className="flex h-14 w-32 items-center justify-center border bg-white p-1">
          {gorsel ? (
            // `next/image` DEĞİL: kaynak bir `blob:` adresidir, optimize
            // edilecek uzak bir dosya değil (depodaki kalıp — login, katalog).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gorsel} alt="Müşteri logosu" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm" title={fileName || "logo.png"}>
            {fileName || "logo.png"}
          </p>
          <p className="text-xs text-muted-foreground">
            Teklif kapağındaki künyede basılır.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {secici}
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
      </div>
    </div>
  );
}
