"use client";

// Bildirim zili — kabuğun kimlik satırında, her sayfada.
//
// OKUMA İSTEMCİDEN, YAZMA ACTION'DAN: sayaç 60 sn'de bir (ve sekme öne
// gelince) tarayıcı istemcisiyle kendi satırlarını sayar — RLS satırları
// zaten kişiye kelepçeliyor ve bir RSC turu başlatmak sayaç için israftı.
// Gerçek zamanlılık BİLEREK yok (uygulamada realtime kanalı hiç açılmadı);
// atölye temposunda bir dakikalık gecikme ayırt edilemez.
//
// OTURUM YOKSA ZİL YOKTUR: dev önizlemeleri kabuğu auth'suz basar ve
// oturumsuz bir sorgu döngüsü hem gürültü hem 401 yağmuru olurdu.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface BellRow {
  id: string;
  title: string;
  href: string;
  created_at: string;
  read_at: string | null;
}

const POLL_MS = 60_000;

function zaman(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export function NotificationBell() {
  const supabase = useRef(createClient()).current;
  const [oturumVar, setOturumVar] = useState(false);
  const [okunmamis, setOkunmamis] = useState(0);
  const [acik, setAcik] = useState(false);
  const [satirlar, setSatirlar] = useState<BellRow[] | null>(null);
  const router = useRouter();

  const say = useCallback(async () => {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .is("read_at", null);
    // Tablo yoksa (migration bekliyor) zil sessizce 0 gösterir.
    setOkunmamis(error ? 0 : (count ?? 0));
  }, [supabase]);

  useEffect(() => {
    let iptal = false;
    let zamanlayici: ReturnType<typeof setInterval> | null = null;

    async function basla() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (iptal || !user) return;
      setOturumVar(true);
      void say();
      zamanlayici = setInterval(() => void say(), POLL_MS);
    }
    void basla();

    const gorunum = () => {
      if (document.visibilityState === "visible") void say();
    };
    document.addEventListener("visibilitychange", gorunum);
    return () => {
      iptal = true;
      if (zamanlayici) clearInterval(zamanlayici);
      document.removeEventListener("visibilitychange", gorunum);
    };
  }, [supabase, say]);

  async function listeyiYukle() {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, href, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(15);
    setSatirlar(error ? [] : ((data ?? []) as BellRow[]));
  }

  if (!oturumVar) return null;

  return (
    <Popover
      open={acik}
      onOpenChange={(o) => {
        setAcik(o);
        if (o) void listeyiYukle();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            okunmamis > 0 ? `Bildirimler — ${okunmamis} okunmamış` : "Bildirimler"
          }
          className="oc-tap-square relative shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-4.5" />
          {okunmamis > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center bg-primary px-0.5 font-mono text-[10px] leading-4 text-primary-foreground">
              {okunmamis > 9 ? "9+" : okunmamis}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <header className="flex items-center justify-between border-b px-3 py-2">
          <span className="oc-kicker text-muted-foreground">Bildirimler</span>
          {okunmamis > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                void markAllNotificationsRead().then(() => {
                  void say();
                  void listeyiYukle();
                });
              }}
            >
              Tümünü Okundu Say
            </Button>
          )}
        </header>
        {satirlar === null ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Yükleniyor…</p>
        ) : satirlar.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            Bildirim yok. Görev ataması, anılma ve izlediğiniz işlerin durum
            değişiklikleri burada birikir.
          </p>
        ) : (
          <ul className="max-h-[min(20rem,60dvh)] divide-y overflow-y-auto overscroll-contain">
            {satirlar.map((s) => (
              <li key={s.id}>
                <Link
                  href={s.href || "/jobs"}
                  onClick={() => {
                    // İşaret gecikebilir, gezinme bekletilmez.
                    if (!s.read_at) void markNotificationRead(s.id).then(() => void say());
                    setAcik(false);
                    router.refresh();
                  }}
                  className={cn(
                    "block px-3 py-2 text-sm transition-colors hover:bg-muted/40",
                    !s.read_at && "font-medium"
                  )}
                >
                  <span className="block break-words">{s.title}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                    {zaman(s.created_at)}
                    {!s.read_at && " · yeni"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
