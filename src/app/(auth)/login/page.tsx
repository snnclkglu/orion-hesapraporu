"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      toast.error("Giriş başarısız: e-posta veya şifre hatalı.");
      setLoading(false);
      return;
    }
    router.replace("/projects");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Sol: marka paneli */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative">
          {/* Koyu zeminde beyaz logo (marka kılavuzu: kömür zemin → beyaz) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/orion-logo-white.svg"
            alt="Orion Cranes"
            className="h-6 w-auto"
          />
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/60">
            Hesap Raporu Sistemi
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-sidebar-accent-foreground">
            Vinç hesap raporları — girdiden yayınlanmış rapora, tek akışta.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-sidebar-foreground/70">
            Çift kirişli gezer köprülü vinçler için mekanizma ve çelik konstrüksiyon
            hesapları, revizyon arşivi ve teslim edilebilir PDF raporlar.
          </p>
          <ul className="mt-6 grid gap-2 text-sm text-sidebar-foreground/80">
            {["FEM 1.001 mekanizma sınıflandırması", "DIN 15018 çelik konstrüksiyon kontrolleri", "CMAA 70 uyumlu hesap zinciri"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0 text-sidebar-primary" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-sidebar-foreground/50">
          © {new Date().getFullYear()} ORION Cranes · Revizyon arşivli, çok kullanıcılı
          hesap sistemi
        </p>
      </section>

      {/* Sağ: giriş formu */}
      <section className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            {/* Açık zeminde kırmızı logo (marka kılavuzu: kağıt zemin → kırmızı) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/orion-logo.svg" alt="Orion Cranes" className="h-6 w-auto" />
            <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Hesap Raporu Sistemi
            </div>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">Oturum açın</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hesap raporu projelerinize erişmek için kurumsal hesabınızla giriş yapın.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="ad.soyad@orioncranes.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
              {!loading && <ArrowRight data-icon="inline-end" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Hesabınız yok mu? Sistem yöneticinizle iletişime geçin.
          </p>
        </div>
      </section>
    </main>
  );
}
