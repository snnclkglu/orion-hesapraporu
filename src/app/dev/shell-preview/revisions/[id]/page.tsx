// Sadece development: kabuğun REVİZYON EKRANI davranışını auth olmadan
// sınamak için. Production'da 404 döner.
//
// Menü revizyon ekranlarında kendiliğinden daralır (`isRevisionScreen`,
// app-shell.tsx) ve bu kural `usePathname()` üzerinden çalışır — yani ancak
// yolu `…/revisions/<id>` olan bir sayfada görülebilir. Kardeş önizleme
// (`/dev/shell-preview`) normal sayfayı temsil eder; ikisi arasında gezinerek
// "girişte daralır, çıkışta kullanıcının tercihine döner" turu denenebilir.

import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: "ornek" }];
}

export default function ShellRevisionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <AppShell role="admin" displayName="Sinan Çolakoğlu" email="sinan@vigowood.com">
      <div className="grid gap-3">
        <PageHeader
          title="Kabuk · Revizyon Ekranı (dev)"
          hint="Menü bu ekranda kendiliğinden daralır"
        />
        <p className="text-sm text-muted-foreground">
          Menü buraya girildiğinde daralmış açılır. &quot;Menüyü genişlet&quot;
          (ya da Ctrl+B) bu ziyaret için geçerlidir; kalıcı tercihe yazılmaz —
          çıkıp geri gelince menü yine daralır.
        </p>
        <Link href="/dev/shell-preview" className="text-sm text-primary hover:underline">
          → Normal sayfaya geç (kalıcı tercih geri gelmeli)
        </Link>
        <div className="h-64 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          İçerik alanı — dar rayda bu kutu genişler.
        </div>
      </div>
    </AppShell>
  );
}
