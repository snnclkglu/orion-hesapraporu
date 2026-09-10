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

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
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
import { StatePanel } from "@/components/state-panel";

interface BellRow {
  id: string;
  title: string;
  href: string;
  created_at: string;
  read_at: string | null;
}

type BellListState =
  | { status: "idle"; rows: null }
  | { status: "loading"; rows: null }
  | { status: "error"; rows: null }
  | { status: "ready"; rows: BellRow[] };

const POLL_MS = 60_000;

function zaman(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export function NotificationBell() {
  // İstemci FONKSİYON İÇİNDE alınır: `createBrowserClient` tarayıcıda
  // TEKİLDİR (singleton), her çağrı aynı örneği döndürür — render sırasında
  // ref tutmak hem gereksizdi hem react-hooks/refs kuralına takılıyordu.
  const [oturumVar, setOturumVar] = useState(false);
  const [okunmamis, setOkunmamis] = useState(0);
  const [acik, setAcik] = useState(false);
  const [liste, setListe] = useState<BellListState>({ status: "idle", rows: null });
  const [tumunuIsaretliyor, setTumunuIsaretliyor] = useState(false);
  const router = useRouter();

  const say = useCallback(async () => {
    const { count, error } = await createClient()
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .is("read_at", null);
    // Tablo yoksa (migration bekliyor) zil sessizce 0 gösterir.
    setOkunmamis(error ? 0 : (count ?? 0));
  }, []);

  useEffect(() => {
    let iptal = false;
    let zamanlayici: ReturnType<typeof setInterval> | null = null;

    async function basla() {
      const {
        data: { user },
      } = await createClient().auth.getUser();
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
  }, [say]);

  async function listeyiYukle() {
    setListe({ status: "loading", rows: null });
    try {
      const { data, error } = await createClient()
        .from("notifications")
        .select("id, title, href, created_at, read_at")
        .order("created_at", { ascending: false })
        .limit(15);
      setListe(
        error
          ? { status: "error", rows: null }
          : { status: "ready", rows: (data ?? []) as BellRow[] }
      );
    } catch {
      setListe({ status: "error", rows: null });
    }
  }

  async function tumunuOkunduSay() {
    setTumunuIsaretliyor(true);
    try {
      const sonuc = await markAllNotificationsRead();
      if (sonuc.error) {
        toast.error("Bildirimler güncellenemedi. Yeniden deneyin.");
        return;
      }
      await Promise.all([say(), listeyiYukle()]);
      toast.success("Bildirimlerin tümü okundu olarak işaretlendi.");
    } catch {
      toast.error("Bildirimler güncellenemedi. Yeniden deneyin.");
    } finally {
      setTumunuIsaretliyor(false);
    }
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
              disabled={tumunuIsaretliyor}
              onClick={() => void tumunuOkunduSay()}
            >
              {tumunuIsaretliyor ? "İşaretleniyor…" : "Tümünü Okundu Say"}
            </Button>
          )}
        </header>
        {liste.status === "idle" || liste.status === "loading" ? (
          <StatePanel kind="loading" title="Bildirimler yükleniyor" compact className="border-0" />
        ) : liste.status === "error" ? (
          <StatePanel
            kind="error"
            title="Bildirimler yüklenemedi"
            description="Bağlantıyı kontrol edip yeniden deneyin."
            compact
            className="border-0"
          >
            <Button type="button" variant="outline" size="xs" onClick={() => void listeyiYukle()}>
              Tekrar Dene
            </Button>
          </StatePanel>
        ) : liste.rows.length === 0 ? (
          <StatePanel
            kind="empty"
            title="Yeni bildirim yok"
            description="Görev atamaları, anılmalar ve izlediğiniz işlerdeki değişiklikler burada görünür."
            compact
            className="border-0"
          />
        ) : (
          <ul className="max-h-[min(20rem,60dvh)] divide-y overflow-y-auto overscroll-contain">
            {liste.rows.map((s) => (
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
        <Link
          href="/notifications"
          onClick={() => setAcik(false)}
          className="block border-t px-3 py-2 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          Tümünü Gör
        </Link>
      </PopoverContent>
    </Popover>
  );
}
