// Sadece development: uygulama kabuğunu (sol menü + üst şerit) auth olmadan
// görsel test etmek için. Production'da 404 döner.
//
// Menünün daralt/genişlet davranışı yalnız gerçek kabukta görülebiliyordu ve
// oraya girmek oturum istiyordu; tercih localStorage'da tutulduğu için de
// "açılışta doğru genişlikte mi çiziliyor" sorusu ancak burada sınanabilir.

import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function ShellPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <AppShell role="admin" displayName="Sinan Çolakoğlu" email="sinan@vigowood.com">
      <div className="grid gap-3">
        {/* Başlık ve eylemler ÜST ŞERİDE çıkar (components/page-header.tsx);
            kabuk önizlemesinin işe yaraması için bu taşıma da görülebilmeli. */}
        <PageHeader
          title="Kabuk Önizleme (dev)"
          hint="Başlık, açıklama ve eylemler üst şeride portalla taşınır"
        >
          <Button size="sm" variant="outline">İkincil</Button>
          <Button size="sm">Birincil</Button>
        </PageHeader>
        <p className="text-sm text-muted-foreground">
          Sol menüdeki &quot;Menüyü daralt&quot; ile ray daralır; tercih
          tarayıcıda saklanır ve sonraki açılışta korunur (Ctrl+B de aynı işi
          yapar).
        </p>
        <Link
          href="/dev/shell-preview/revisions/ornek"
          className="text-sm text-primary hover:underline"
        >
          → Revizyon ekranına geç (menü kendiliğinden daralmalı)
        </Link>
        <div className="h-64 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          İçerik alanı — menü daraldığında bu kutu genişler.
        </div>
      </div>
    </AppShell>
  );
}
