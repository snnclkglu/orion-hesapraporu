"use client";

// ARKA PLANDA SÜREN YÜKLEMENİN GÖSTERGESİ — kabuğun içinde, her sayfada.
//
// Yükleme artık sihirbazdan çıkınca da sürüyor (`upload-store.ts`). Bunun
// bedeli şudur: görünmeyen bir iş, olmayan bir iştir. Ressam İşler'e geçtiğinde
// 107 MB'ın hâlâ gittiğini bir yerden görebilmeli, yoksa sekmeyi kapatır ve
// yüklemeyi kendi eliyle keser.
//
// ÜÇ İŞİ VAR ve üçü de aynı sebeple burada:
//   1. İŞ SÜRÜYOR DEMEK — kaç dosya gitti, hangi aşamada.
//   2. SEKMEYİ KAPATMAYA KARŞI UYARMAK (`beforeunload`). Modül düzeyindeki
//      akış gezinmeye dayanır ama sayfa yenilenmesine DAYANMAZ; tek dürüst
//      davranış kullanıcıyı uyarmaktır.
//   3. GERİ DÖNÜŞ YOLU — sihirbaza tek tıkla dönmek.
//
// Bitmiş iş de KISA SÜRE GÖSTERİLİR: kullanıcı başka sayfadayken biten bir
// yükleme hiçbir iz bırakmasaydı, "acaba tamamlandı mı" sorusunun cevabı
// yalnız paket listesine gidip bakmak olurdu.

import Link from "next/link";
import { useEffect } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { formatBytes, formatNum } from "@/lib/drawings/labels";
import { useYukleme, yuklemeSifirla } from "./upload-store";

export function UploadIndicator() {
  const durum = useYukleme();
  const pathname = usePathname();
  const { calisiyor, asama, klasorAdi, ilerleme, durumMetni, sonuc } = durum;

  // SEKME KAPANIRSA AKIŞ ÖLÜR — bunu söylemeyen bir uygulama, kullanıcının
  // 107 MB'ını sessizce kaybeder. Tarayıcılar özel metni artık göstermiyor;
  // önemli olan diyaloğun ÇIKMASIDIR.
  useEffect(() => {
    if (!calisiyor) return;
    const uyar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", uyar);
    return () => window.removeEventListener("beforeunload", uyar);
  }, [calisiyor]);

  // SİHİRBAZIN ÜSTÜNDE ÇİZİLMEZ: orada zaten tam bir ilerleme kartı var ve
  // aynı sayıyı iki yerde göstermek "hangisi doğru" sorusunu doğururdu.
  if (pathname === "/drawings/new") return null;

  const bitti = !calisiyor && Boolean(sonuc);
  if (!calisiyor && !bitti) return null;

  const yuzde =
    ilerleme.toplam > 0 ? Math.round((ilerleme.yapilan / ilerleme.toplam) * 100) : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      // `dvh` değil sabit alt boşluk: gösterge kısa ve alt kenara sabit.
      className="fixed bottom-3 right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] border bg-card p-3 shadow-lg"
    >
      <div className="flex items-start gap-2">
        {calisiyor ? (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium" title={klasorAdi}>
            {klasorAdi || "Teknik resim paketi"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {calisiyor
              ? durumMetni || (asama === "imza" ? "Dosyalar hazırlanıyor…" : "Çalışıyor…")
              : sonuc && sonuc.missing > 0
                ? `${formatNum(sonuc.missing)} dosya depoya ulaşmadı`
                : "Paket açıldı."}
          </p>
        </div>
      </div>

      {calisiyor && (
        <>
          <div className="mt-2 h-1.5 w-full overflow-hidden bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-200"
              style={{ width: `${asama === "yukleme" || asama === "imza" ? yuzde : 100}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {asama === "yukleme"
              ? `${formatNum(ilerleme.yapilan)}/${formatNum(ilerleme.toplam)} dosya · ${formatBytes(ilerleme.bayt)}`
              : asama === "imza"
                ? `${formatNum(ilerleme.yapilan)}/${formatNum(ilerleme.toplam)} dosya okundu`
                : "Sunucu çalışıyor…"}
          </p>
        </>
      )}

      <div className="mt-2 flex justify-end gap-3 text-[11px]">
        {calisiyor && (
          <Link href="/drawings/new" className="oc-tap text-muted-foreground hover:underline">
            Sihirbaza dön
          </Link>
        )}
        {bitti && sonuc && sonuc.missing > 0 && (
          // EKSİK VARSA RAPOR DEĞİL ÖZET AÇILIR: hangi dosyanın neden
          // ulaşmadığı ve "Eksikleri Yeniden Dene" orada duruyor.
          <Link
            href="/drawings/new"
            className="oc-tap font-medium text-destructive hover:underline"
          >
            Özeti aç
          </Link>
        )}
        {bitti && sonuc && sonuc.missing === 0 && (
          <Link
            href={`/drawings/${sonuc.packageId}/report`}
            onClick={() => yuklemeSifirla()}
            className="oc-tap font-medium text-primary hover:underline"
          >
            Rapora git
          </Link>
        )}
        {bitti && (
          <button
            type="button"
            onClick={() => yuklemeSifirla()}
            className="oc-tap text-muted-foreground hover:underline"
          >
            Kapat
          </button>
        )}
      </div>

      {calisiyor && (
        <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
          Sayfalar arasında gezinebilirsiniz. <strong>Sekmeyi kapatmayın</strong> — yükleme durur
          (kaldığı yerden sürdürülebilir).
        </p>
      )}
    </div>
  );
}
