"use client";

import Image from "next/image";
import { TriangleAlert } from "lucide-react";

/*
 * MÜŞTERİ YÜZÜNÜN HATA EKRANI DA TÜRKÇEDİR — VE HİÇBİR ŞEY SIZDIRMAZ.
 *
 * Dış portalın bir `error.tsx`i yoktu; sunucuda bir istisna olduğunda müşteri
 * Next'in İngilizce varsayılan ekranını görüyordu. Burada `error.message`
 * BASILMAZ: mesaj veritabanı tablosu, sütun adı veya iç yol taşıyabilir ve
 * bu sayfa kimlik doğrulaması olmayan bir yüzdür. `digest` sunucu günlüğüyle
 * eşleşen tek bağdır; onu göstermek destek için yeter.
 */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 px-3 py-10">
      <section className="w-full max-w-md border bg-card">
        <header className="border-b-4 border-primary bg-[#262626] px-6 py-6 text-[#F4F1EF]">
          <Image src="/brand/orion-logo-white.svg" alt="ORION CRANES" width={788} height={96} className="h-auto w-[200px] max-w-full" />
        </header>
        <div className="p-5 sm:p-6">
          <div className="grid size-11 place-items-center border bg-muted text-primary">
            <TriangleAlert className="size-5" />
          </div>
          <h1 className="mt-4 text-xl font-bold">Sayfa açılamadı</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Beklenmeyen bir sorun oluştu. Birkaç saniye sonra yeniden deneyin.
          </p>
          <button
            type="button"
            onClick={reset}
            className="oc-tap mt-5 inline-flex min-h-11 items-center justify-center bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Yeniden dene
          </button>
          {error.digest && (
            <p className="mt-5 border-t pt-4 font-mono text-[11px] text-muted-foreground">
              Destek kodu: {error.digest}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
