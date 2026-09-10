// Yalnız development: sunucu taraflı katalog sayfalarını auth olmadan doğrular.

import Link from "next/link";
import { notFound } from "next/navigation";
import SealsPage from "@/app/(app)/tools/kece/page";
import AccessSafetyPage from "@/app/(app)/tools/erisim-emniyeti/page";

export default function CatalogsPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto grid min-h-dvh max-w-[96rem] gap-12 overflow-x-clip bg-background p-3 text-foreground sm:p-6">
      <header className="border-b pb-4">
        <p className="oc-kicker text-muted-foreground">Görsel önizleme</p>
        <h1 className="text-2xl font-semibold">Katalog ve emniyet sayfaları</h1>
        <Link href="/dev/tools-preview" className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Hesap araçlarına dön
        </Link>
      </header>
      <SealsPage searchParams={Promise.resolve({ q: "", material: "" })} />
      <AccessSafetyPage />
    </main>
  );
}
