"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LANDING_PATH } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { APP_NAME, APP_TAGLINE, COMPANY_NAME } from "@/lib/app";

export default function LoginPage() {
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
    /*
     * Giriş sonrası AÇILIŞ PANOSU (kullanıcı kararı, 13.08.2026).
     *
     * GEÇİŞ TAM SAYFA YÜKLEMESİDİR, istemci gezinmesi değil. `router.replace`
     * bir RSC isteği atar ve o istek, `signInWithPassword`ün yazdığı oturum
     * çerezini bazen bir an ıskalar: proxy isteği oturumsuz sayıp `/login`e
     * döndürür, çerez o arada yerine oturur ve kullanıcı ikinci turda
     * "oturumu var ama /login'de" dalına düşer. Telefonda çok daha sık olur —
     * bildirilen "mobilde ilk açılışta mühendislik sayfası geliyor" hatasının
     * yarısı buydu (öbür yarısı o dalın hedefiydi, bkz. proxy.ts).
     *
     * `replace` KORUNUR: geri tuşu giriş formuna dönmemelidir. Adres
     * `LANDING_PATH`ten okunur — menü, proxy ve bu form tek kaynaktan.
     */
    window.location.replace(LANDING_PATH);
  }

  return (
    // `dvh`: mobil tarayıcıda `vh` adres çubuğu gizliyken ölçülen büyük alandır,
    // yani `min-h-screen` giriş formunu adres çubuğunun altına taşırıyordu.
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Sol: marka paneli */}
      {/* Kırmızı omurga solda (14px) — kılavuzun yapısal imzası */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-l-[14px] border-l-primary bg-sidebar p-10 text-sidebar-foreground lg:flex">
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
            alt={COMPANY_NAME}
            className="h-6 w-auto"
          />
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-sidebar-foreground/60">
            {APP_NAME}
          </div>
          <div className="oc-rule-red mt-3" aria-hidden />
        </div>

        {/* TEK CÜMLE. Giriş ekranı bir tanıtım sayfası değildir: burada duran
            kişi zaten şirkette çalışıyor ve ne yaptığımızı biliyor. Eski
            sürümdeki başlık, paragraf ve üç maddelik standart listesi
            uygulamayı yalnız hesap raporundan ibaret gösteriyordu. */}
        <div className="relative max-w-md">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-sidebar-accent-foreground">
            {APP_TAGLINE}
          </h1>
        </div>

        <p className="relative text-[11px] text-sidebar-foreground/50">
          © {new Date().getFullYear()} {COMPANY_NAME}
        </p>
      </section>

      {/* Sağ: giriş formu */}
      <section className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            {/* Açık zeminde kırmızı logo (marka kılavuzu: kağıt zemin → kırmızı) */}
            {/* Telefonda logo tek marka işareti olarak KALIYOR (sol panel gizli);
                24px yükseklikte kelime işareti okunmuyordu. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/orion-logo.svg" alt={COMPANY_NAME} className="h-7 w-auto sm:h-6" />
            <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {APP_NAME}
            </div>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">Oturum açın</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kurumsal hesabınızla giriş yapın.
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
              {/* Kılavuz: yön göstergesi ok glifi ile (→), ikon setiyle değil */}
              {!loading && <span aria-hidden>→</span>}
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
