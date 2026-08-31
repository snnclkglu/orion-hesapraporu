import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { resolvePublicDrawingShare } from "@/lib/drawing-public-share";
import { ProtectedPdfViewer } from "@/app/(app)/drawing-viewer/[packageId]/[fileId]/protected-pdf-viewer";
import { CustomerPortalView } from "@/components/customer-portal/customer-portal-view";
import { PortalLoginButton } from "@/components/customer-portal/portal-login-button";
import {
  PORTAL_SUPPORT_EMAIL,
  loadCustomerPortalDto,
  normalizedPublicCode,
  portalCookieName,
  resolvePortalDocument,
} from "@/lib/product-portal/access-server";

type PageQuery = { portal?: string; hata?: string; belge?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<PageQuery>;
}): Promise<Metadata> {
  const query = await searchParams;
  return {
    title: query.portal === "vinc"
      ? "Teknik Dokümanlar — ORION CRANES"
      : "Paylaşılan Teknik Resim — ORION",
    robots: { index: false, follow: false, noarchive: true },
  };
}

export const dynamic = "force-dynamic";

async function customerPortal(codeValue: string, query: PageQuery) {
  const code = normalizedPublicCode(codeValue);
  const cookieStore = await cookies();
  const token = cookieStore.get(portalCookieName(code))?.value;

  if (query.belge) {
    const resolved = await resolvePortalDocument(code, token, query.belge).catch(() => null);
    if (!resolved || resolved.file.accessMode !== "view_watermarked") notFound();
    return (
      <main className="mx-auto grid h-dvh w-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden px-2 py-2 sm:px-4 sm:py-4">
        <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border bg-card px-3 py-3 print:hidden sm:px-4">
          <span className="flex min-w-0 items-center gap-3">
            <Link href={`/paylas/vinc/${encodeURIComponent(code)}`} className="oc-tap inline-grid size-11 shrink-0 place-items-center border text-primary" aria-label="Dokümanlara dön">
              <ArrowLeft className="size-4" />
            </Link>
            <span className="min-w-0">
              <span className="oc-kicker text-muted-foreground">ORION CRANES · Müşteri Portalı</span>
              <h1 className="truncate text-sm font-medium" title={resolved.file.title}>{resolved.file.title}</h1>
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5 border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" /> {resolved.session.unit.serialNo} · Filigranlı
          </span>
        </header>
        <ProtectedPdfViewer
          contentUrl={`/paylas/vinc/${encodeURIComponent(code)}/belge/${encodeURIComponent(query.belge)}/content`}
          fileName={resolved.file.fileName}
          notice="İndirme ve yazdırma düğmeleri kapalı · kopya seri ve oturum iziyle filigranlı"
          fillHeight
        />
      </main>
    );
  }

  const dto = await loadCustomerPortalDto(code, token).catch(() => null);
  if (dto) return <CustomerPortalView dto={dto} />;

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
          {/*
            * SEBEP AYRI SÖYLENİR.
            *
            * Tek bir "erişim sağlanamadı" cümlesi vardı: kilitlenen müşteri de,
            * parolayı yanlış yazan da, paketi henüz yayımlanmamış olan da aynı
            * şeyi okuyordu. Kilitli olduğunu bilmeyen müşteri denemeye devam
            * ediyordu — bu, eski sayaç hatasıyla birleşince kilidi kalıcı yapan
            * döngünün ta kendisiydi (bkz. migration 20260830000002).
            */}
          {query.hata && (
            <div role="alert" className="mt-4 border border-destructive/35 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {query.hata === "kilit"
                ? "Çok fazla hatalı deneme yapıldı. Güvenlik için erişim kısa süreyle durduruldu; yaklaşık 15 dakika sonra yeniden deneyin. Bu süre içinde yapılan denemeler süreyi uzatmaz."
                : query.hata === "yayin"
                  ? "Bu vinç için yayımlanmış bir doküman paketi bulunamadı. Parolanız doğru olsa bile paket yayına alınana kadar erişim açılmaz; aşağıdaki adrese yazın."
                  : "Parola doğrulanamadı. Vinçle birlikte paylaşılan müşteri parolasını kontrol edin."}
            </div>
          )}
          <form action={`/paylas/vinc/${encodeURIComponent(code)}/giris`} method="post" className="mt-5 grid gap-3">
            <label htmlFor="portal-password" className="text-sm font-medium">Müşteri parolası</label>
            <div className="flex min-h-11 items-center gap-2 border bg-background px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30">
              <KeyRound className="size-4 shrink-0 text-muted-foreground" />
              <input id="portal-password" name="password" type="password" autoComplete="current-password" required maxLength={128} className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none" />
            </div>
            <PortalLoginButton />
          </form>
          <p className="mt-5 border-t pt-4 text-xs leading-5 text-muted-foreground">
            Parolanızı unuttuysanız{" "}
            <a href={`mailto:${PORTAL_SUPPORT_EMAIL}?subject=${encodeURIComponent(`Vinç doküman erişimi · ${code}`)}`} className="font-semibold text-primary underline underline-offset-2">
              {PORTAL_SUPPORT_EMAIL}
            </a>{" "}
            adresine yazın ve <span className="font-mono">{code}</span> kodunu belirtin. Güvenlik nedeniyle mevcut parola gösterilmez; yenisi üretilir.
          </p>
        </div>
      </section>
    </main>
  );
}

export default async function PublicDrawingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<PageQuery>;
}) {
  const { token } = await params;
  const query = await searchParams;
  if (query.portal === "vinc") return customerPortal(token, query);
  const share = await resolvePublicDrawingShare(token).catch(() => null);
  if (!share) notFound();

  return (
    <main className="mx-auto grid h-dvh w-full max-w-[1600px] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden px-2 py-2 sm:px-4 sm:py-4">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3 border bg-card px-4 py-3 print:hidden">
        <span className="min-w-0">
          <span className="oc-kicker text-muted-foreground">ORION CRANES · Müşteri Paylaşımı</span>
          <h1 className="truncate font-mono text-sm font-medium" title={share.fileName}>
            {share.fileName}
          </h1>
        </span>
        <span className="inline-flex items-center gap-1.5 border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" /> Üyelik gerekmez · Tek dosya
        </span>
      </header>

      <ProtectedPdfViewer
        contentUrl={`/paylas/resim/${encodeURIComponent(token)}/content`}
        fileName={share.fileName}
        notice="İndirme ve yazdırma kapalı · paylaşılan kopya filigranlı"
        fillHeight
      />
    </main>
  );
}
