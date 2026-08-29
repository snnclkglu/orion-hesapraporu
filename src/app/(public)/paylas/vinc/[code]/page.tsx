import type { Metadata } from "next";
import Image from "next/image";
import { cookies } from "next/headers";
import { KeyRound, LockKeyhole } from "lucide-react";
import { CustomerPortalView } from "@/components/customer-portal/customer-portal-view";
import {
  loadCustomerPortalDto,
  normalizedPublicCode,
  portalCookieName,
} from "@/lib/product-portal/access-server";

export const metadata: Metadata = {
  title: "Teknik Dokümanlar — ORION CRANES",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

export default async function CustomerPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ hata?: string }>;
}) {
  const { code: rawCode } = await params;
  const code = normalizedPublicCode(rawCode);
  const cookieStore = await cookies();
  const token = cookieStore.get(portalCookieName(code))?.value;
  const dto = await loadCustomerPortalDto(code, token).catch(() => null);
  if (dto) return <CustomerPortalView dto={dto} />;
  const query = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 px-3 py-8">
      <section className="w-full max-w-md border bg-card">
        <header className="border-b-4 border-primary bg-[#262626] px-6 py-6 text-[#F4F1EF]">
          <Image src="/brand/orion-logo-white.svg" alt="ORION CRANES" width={788} height={96} className="h-auto w-[210px] max-w-full" />
          <p className="mt-4 font-mono text-[10px] font-semibold tracking-[0.2em] text-white/60">GÜVENLİ MÜŞTERİ DOKÜMAN PORTALI</p>
        </header>
        <div className="p-5 sm:p-6">
          <div className="grid size-11 place-items-center border bg-muted text-primary"><LockKeyhole className="size-5" /></div>
          <h1 className="mt-4 text-xl font-bold">Teknik dokümanlara erişim</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Vinçle birlikte paylaşılan müşteri parolasını girin. QR kodu yalnız vinç kimliğini taşır; parola kodun içinde değildir.
          </p>
          {query.hata && (
            <div role="alert" className="mt-4 border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Erişim sağlanamadı. Parolayı kontrol edin veya kısa bir süre sonra yeniden deneyin.
            </div>
          )}
          <form action={`/paylas/vinc/${encodeURIComponent(code)}/giris`} method="post" className="mt-5 grid gap-3">
            <label htmlFor="portal-password" className="text-sm font-medium">Müşteri parolası</label>
            <div className="flex min-h-11 items-center gap-2 border bg-background px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
              <KeyRound className="size-4 shrink-0 text-muted-foreground" />
              <input id="portal-password" name="password" type="password" autoComplete="current-password" required maxLength={128} className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none" />
            </div>
            <button type="submit" className="oc-tap mt-1 inline-flex min-h-11 items-center justify-center bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Dokümanları Aç
            </button>
          </form>
          <p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">
            Şifrenizi unuttuysanız, proje dokümanlarında belirtilen ORION iletişim adresine yazın. Güvenlik nedeniyle mevcut parola gösterilmez; yeni parola üretilir.
          </p>
        </div>
      </section>
    </main>
  );
}
