// Sadece development: uygulama kabuğunu (sol menü + üst şerit) auth olmadan
// görsel test etmek için. Production'da 404 döner.
//
// Menünün daralt/genişlet davranışı yalnız gerçek kabukta görülebiliyordu ve
// oraya girmek oturum istiyordu; tercih localStorage'da tutulduğu için de
// "açılışta doğru genişlikte mi çiziliyor" sorusu ancak burada sınanabilir.

import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default function ShellPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <AppShell role="admin" displayName="Sinan Çolakoğlu" email="sinan@vigowood.com">
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Kabuk Önizleme (dev)</h1>
        <p className="text-sm text-muted-foreground">
          Sol menüdeki &quot;Menüyü daralt&quot; ile ray daralır; tercih
          tarayıcıda saklanır ve sonraki açılışta korunur (Ctrl+B de aynı işi
          yapar).
        </p>
        <div className="h-64 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          İçerik alanı — menü daraldığında bu kutu genişler.
        </div>
      </div>
    </AppShell>
  );
}
