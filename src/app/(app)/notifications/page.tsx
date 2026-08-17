// BİLDİRİM DEFTERİ — zilin ve paneldeki bölümün "Tümünü Gör" hedefi.
//
// Son 100 satır; okunmamışlar kendi bloklarında ÖNCE gelir. Yazma yolu
// tekildir (actions.ts) ve satır tıklaması okundu işaretini bekletmez.
// Sayfa menüde YOKTUR — zilden ve panelden ulaşılır; `PageHeader` geri oku
// panele döner.

import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { tarihSaatIstanbul } from "@/lib/format-time";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";
import { MarkAllReadButton, NotificationRowLink } from "./client";

interface Row {
  id: string;
  title: string;
  href: string;
  created_at: string;
  read_at: string | null;
}

function Blok({ baslik, rows }: { baslik: string; rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="oc-kicker mb-2 text-muted-foreground">{baslik}</h2>
      <ul className="divide-y border">
        {rows.map((r) => (
          <li key={r.id}>
            <NotificationRowLink
              id={r.id}
              href={r.href}
              okunmamis={!r.read_at}
              className={cn(
                "block px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 pointer-coarse:py-3",
                !r.read_at && "font-medium"
              )}
            >
              <span className="block break-words">{r.title}</span>
              <span className="mt-0.5 block font-mono text-[11px] font-normal text-muted-foreground">
                {tarihSaatIstanbul(r.created_at)}
                {!r.read_at && <span className="text-primary"> · yeni</span>}
              </span>
            </NotificationRowLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function NotificationsPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, href, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as Row[];
  const okunmamis = rows.filter((r) => !r.read_at);
  const okunmus = rows.filter((r) => r.read_at);

  return (
    <div className="grid gap-6 pb-4">
      <PageHeader
        title="Bildirimler"
        hint="Görev atamaları, anılmalar ve izlenen işlerin durum değişiklikleri"
        backHref="/"
        backLabel="Panel"
      >
        {okunmamis.length > 0 && <MarkAllReadButton />}
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState
          title="BİLDİRİM YOK"
          description="Bir işte size görev atandığında, adınız bir yorumda geçtiğinde ya da izlediğiniz işin durumu değiştiğinde burada listelenir."
        />
      ) : (
        <div className="grid gap-6">
          <Blok baslik={`Okunmamış · ${okunmamis.length}`} rows={okunmamis} />
          <Blok baslik="Okunmuş" rows={okunmus} />
          {rows.length === 100 && (
            <p className="text-[12px] text-muted-foreground">
              Son 100 bildirim gösteriliyor; okunmuş satırlar 90 gün sonra
              kendiliğinden silinir.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
