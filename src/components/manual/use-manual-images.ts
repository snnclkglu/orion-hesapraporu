"use client";

// ÖNİZLEMENİN GÖRSEL ADRESLERİ — tek yerden, tek turda.
//
// İKİ KAYNAK VARDIR (KITAP-12) ve önizleme ikisini AYIRT ETMEZ:
//   ŞABLON VARLIĞI — baytları repoda, adresi statik (`/manual-assets/…`),
//     oranı defterde (`lib/manual/assets.ts`). İmzalı bağlantı gerekmez.
//   YÜKLENEN GÖRSEL — baytları `manual-images` kovasında, adresi İMZALI ve
//     süreli; oranı yüklemede ÖLÇÜLDÜ ve satırda duruyor.
//
// BÜTÜN GÖRSELLER TEK TURDA imzalanır (`createSignedUrls`), blok blok değil:
// eski `GorselBloku` her blok için ayrı bir istek atıyordu ve on resimli bir
// bölümde on tur oluyordu. Önizleme bütün belgeyi çizdiği için o sayı
// belgedeki resim sayısı kadar olurdu.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MANUAL_ASSETS } from "@/lib/manual/assets";
import { MANUAL_IMAGE_BUCKET, type ManualImageRow } from "@/lib/manual/data";
import type { OnizlemeGorsel } from "./manual-paper";

/** İmzanın ömrü — bir düzenleme oturumu bundan uzun sürerse tazelenir. */
const IMZA_SANIYE = 3600;

/** Şablon varlıkları DEĞİŞMEZ: harita bir kez kurulur. */
const SABLON: ReadonlyMap<string, OnizlemeGorsel> = new Map(
  MANUAL_ASSETS.map((a) => [a.key, { url: `/manual-assets/${a.file}`, oran: a.ratio }])
);

export function useManualImages(
  images: readonly ManualImageRow[]
): ReadonlyMap<string, OnizlemeGorsel> {
  const [imzali, setImzali] = useState<ReadonlyMap<string, string>>(new Map());

  // Bağımlılık DİZİNİN KENDİSİ değil YOLLARIN LİSTESİDİR: `images` her
  // render'da yeni bir referans olabilir ve etki sonsuz döngüye girerdi.
  const yollar = useMemo(() => images.map((g) => g.storagePath).join("|"), [images]);

  useEffect(() => {
    const liste = yollar ? yollar.split("|") : [];
    // GÖRSEL YOKSA DURUM TEMİZLENMEZ ve buna gerek de yoktur: harita
    // YOL'a göre anahtarlıdır ve aşağıdaki birleştirme yalnız o an var olan
    // kayıtları dolaşır — artakalan imza hiç okunmaz. Burada `setImzali`
    // çağırmak, etkinin içinden eşzamanlı bir render zinciri başlatırdı.
    if (liste.length === 0) return;
    let iptal = false;
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from(MANUAL_IMAGE_BUCKET)
        .createSignedUrls(liste, IMZA_SANIYE);
      if (iptal || !data) return;
      const m = new Map<string, string>();
      for (const d of data) {
        if (d.path && d.signedUrl) m.set(d.path, d.signedUrl);
      }
      setImzali(m);
    })();
    return () => {
      iptal = true;
    };
  }, [yollar]);

  return useMemo(() => {
    const m = new Map<string, OnizlemeGorsel>(SABLON);
    for (const g of images) {
      const url = imzali.get(g.storagePath);
      // ORAN ÖLÇÜLDÜ, BEYAN EDİLMEDİ (KITAP-9). Ölçüsü olmayan kayıt
      // haritaya GİRMEZ: yerleşim onu kare varsayar ve önizleme, belgeyle
      // aynı yanılgıyı paylaşır — ayrı bir tahmin yapmaz.
      if (url && g.width > 0) m.set(g.id, { url, oran: g.height / g.width });
    }
    return m;
  }, [images, imzali]);
}

/** Tek bir görselin adresi — blok kartındaki küçük önizleme bunu kullanır. */
export function manualGorselAdresi(
  harita: ReadonlyMap<string, OnizlemeGorsel>,
  assetKey?: string,
  imageId?: string
): OnizlemeGorsel | null {
  return harita.get(assetKey ?? imageId ?? "") ?? null;
}
