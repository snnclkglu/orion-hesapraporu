// BÖLÜM YÜKLEYİCİLERİ — her bölüm kendi Suspense sınırının arkasında kendi
// verisini çeker. Sayfanın kritik yolu yalnız oturum + profildir; bölümler
// PARALEL akar ve biri düşerse yalnız o bölüm "okunamadı" der (yokluk iyi
// haber gibi gösterilmez — SectionError, "0 kayıt"tan ayrı bir hâldir).
//
// try/catch YALNIZ VERİ ADIMINI sarar, JSX dışarıda kurulur: React JSX'i
// tembel çizer, çizim hatası buradaki catch'e zaten düşmez
// (react-hooks/error-boundaries kuralı da bunu şart koşar).

import { createClient } from "@/lib/supabase/server";
import type { PanelDate, PanelSignal } from "@/lib/panel";
import {
  loadAgendaDates,
  loadCounts,
  loadMine,
  loadSignals,
  type MineRow,
  type SectionCounts,
} from "./data";
import { SectionError } from "./sections/section-frame";
import { WorkspaceSection } from "./sections/workspace";
import { SignalsSection } from "./sections/signals";
import { AgendaSection } from "./sections/agenda";
import {
  NotificationsSection,
  type PanelNotificationRow,
} from "./sections/notifications";
import { MyDayRegion } from "./sections/my-day";
import type { MyTaskRow } from "./sections/my-tasks";
import type { FavoriteJobRef } from "./sections/favorites-recents";
import { TodoWidget } from "./sections/todo-widget";
import { todoSirala, todoTamamlanan, type TodoRow } from "@/lib/todos";
import { ActivitySection, type ActivityRow } from "./sections/activity";

export async function WorkspaceLoader({
  role,
  today,
}: {
  role: string;
  today: string;
}) {
  let counts: SectionCounts | null = null;
  try {
    const supabase = await createClient();
    counts = await loadCounts(supabase, { role, today });
  } catch {
    counts = null;
  }
  if (counts === null) return <SectionError baslik="Çalışma Alanı" />;
  return <WorkspaceSection role={role} counts={counts} />;
}

export async function SignalsLoader({
  role,
  today,
}: {
  role: string;
  today: string;
}) {
  let signals: PanelSignal[] | null = null;
  try {
    const supabase = await createClient();
    signals = await loadSignals(supabase, { role, today });
  } catch {
    signals = null;
  }
  if (signals === null) return <SectionError baslik="Dikkat İsteyenler" />;
  return <SignalsSection signals={signals} />;
}

export async function AgendaLoader({
  role,
  userId,
  today,
}: {
  role: string;
  userId: string;
  today: string;
}) {
  // Ham tarihler istemciye gider; pencereleme ve tür süzme bölümün içinde
  // (saf çekirdek istemcide de koşar — çipler sunucu turu istemez).
  let dates: PanelDate[] | null = null;
  try {
    const supabase = await createClient();
    dates = await loadAgendaDates(supabase, { role, userId });
  } catch {
    dates = null;
  }
  if (dates === null) return <SectionError baslik="Yaklaşan" />;
  return <AgendaSection dates={dates} today={today} />;
}

export async function ActivityLoader() {
  // Kaynak yalnız `job_events` — `(at desc)` indeksi hazır. Aktör adları tek
  // ek sorguyla çözülür; ad çözülemezse satır adsız basılır, uydurulmaz.
  let rows: ActivityRow[] | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("job_events")
      .select("id, job_id, job_no, event, detail, actor, at")
      .order("at", { ascending: false })
      .limit(15);
    if (error) throw error;

    type Ham = {
      id: string;
      job_id: string | null;
      job_no: string;
      event: string;
      detail: Record<string, unknown> | null;
      actor: string | null;
      at: string;
    };
    const ham = (data ?? []) as Ham[];

    const aktorIdleri = [...new Set(ham.map((r) => r.actor).filter(Boolean))] as string[];
    const adlar = new Map<string, string>();
    if (aktorIdleri.length > 0) {
      const { data: kisiler } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", aktorIdleri);
      for (const k of (kisiler ?? []) as { id: string; full_name: string }[]) {
        adlar.set(k.id, k.full_name);
      }
    }

    rows = ham.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      jobNo: r.job_no,
      event: r.event,
      detail: r.detail ?? {},
      actorName: r.actor ? (adlar.get(r.actor) ?? "") : "",
      at: r.at,
    }));
  } catch {
    rows = null;
  }
  if (rows === null) return <SectionError baslik="Son Hareketler" />;
  return <ActivitySection rows={rows} />;
}

export async function NotificationsLoader() {
  // RLS satırları kişiye kelepçeler — rol ya da kimlik prop'u gerekmez.
  // Okunmamışlar ÖNCE (null read_at grubu), kendi içinde yeniden eskiye;
  // okunmuşlar en son okunandan geriye.
  let rows: PanelNotificationRow[] | null = null;
  let unread = 0;
  try {
    const supabase = await createClient();
    const [liste, sayim] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, title, href, created_at, read_at")
        .order("read_at", { ascending: false, nullsFirst: true })
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null),
    ]);
    if (liste.error) throw liste.error;
    type Row = {
      id: string;
      title: string;
      href: string;
      created_at: string;
      read_at: string | null;
    };
    rows = ((liste.data ?? []) as Row[]).map((r) => ({
      id: r.id,
      title: r.title,
      href: r.href,
      createdAt: r.created_at,
      readAt: r.read_at,
    }));
    unread = sayim.error ? 0 : (sayim.count ?? 0);
  } catch {
    rows = null;
  }
  if (rows === null) return <SectionError baslik="Bildirimler" />;
  return <NotificationsSection rows={rows} unreadCount={unread} />;
}

export async function MyDayLoader({
  userId,
  today,
  gunumGizli = false,
  yapilacakGizli = false,
}: {
  userId: string;
  today: string;
  /** "Benim Günüm" çeyrekleri (görev/favori/resim) gizlendiyse sorguları koşmaz. */
  gunumGizli?: boolean;
  /** Yapılacaklar çeyreği gizlendiyse madde sorgusu koşmaz. */
  yapilacakGizli?: boolean;
}) {
  // Kişiye özel bölge: bana atanan açık görevler (kısmi indeks tam bunu
  // sayar) + favoriler (RLS sahibine kelepçeli) + bana atanan resim grupları.
  // GİZLİ ÇEYREĞİN SORGUSU HİÇ KURULMAZ (tercih = sorgu tasarrufu).
  let veri: {
    tasks: MyTaskRow[];
    taskTotal: number;
    favorites: FavoriteJobRef[];
    mine: MineRow[];
    todos: TodoRow[];
  } | null = null;
  try {
    const supabase = await createClient();
    const [gorevler, gorevSayisi, favoriler, mine, maddeler] = await Promise.all([
      gunumGizli
        ? null
        : supabase
            .from("job_tasks")
            .select("id, title, due_date, job_id, jobs ( job_no, title )")
            .eq("assignee", userId)
            .is("done_at", null)
            .order("due_date", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: true })
            .limit(10),
      gunumGizli
        ? null
        : supabase
            .from("job_tasks")
            .select("*", { count: "exact", head: true })
            .eq("assignee", userId)
            .is("done_at", null),
      gunumGizli
        ? null
        : supabase
            .from("job_favorites")
            .select("job_id, created_at, jobs ( job_no, title )")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(6),
      gunumGizli ? Promise.resolve([] as MineRow[]) : loadMine(supabase, userId),
      yapilacakGizli
        ? null
        : supabase
            .from("user_todos")
            .select("id, title, note, due_date, done_at, sort")
            .eq("user_id", userId),
    ]);
    if (gorevler?.error) throw gorevler.error;

    type JobRef = { job_no?: string | null; title?: string | null };
    type TaskRow = {
      id: string;
      title: string;
      due_date: string | null;
      job_id: string;
      jobs?: JobRef | JobRef[] | null;
    };
    type FavRow = { job_id: string; jobs?: JobRef | JobRef[] | null };
    const isRef = (j: JobRef | JobRef[] | null | undefined) =>
      Array.isArray(j) ? j[0] : j;

    veri = {
      tasks: ((gorevler?.data ?? []) as TaskRow[]).map((t) => {
        const is = isRef(t.jobs);
        return {
          taskId: t.id,
          title: t.title,
          dueDate: t.due_date,
          jobId: t.job_id,
          jobNo: is?.job_no ?? "",
          jobTitle: is?.title ?? "",
        };
      }),
      taskTotal: gorevSayisi && !gorevSayisi.error ? (gorevSayisi.count ?? 0) : 0,
      favorites: ((favoriler?.data ?? []) as FavRow[]).map((f) => {
        const is = isRef(f.jobs);
        return { id: f.job_id, jobNo: is?.job_no ?? "", title: is?.title ?? "" };
      }),
      mine,
      // Tablo henüz yoksa (migration bekliyor) madde listesi boş kalır —
      // hızlı ekleme kutusu yine durur, ilk ekleme dürüst bir hata verir.
      todos: !maddeler || maddeler.error
        ? []
        : ((maddeler.data ?? []) as {
            id: string;
            title: string;
            note: string;
            due_date: string | null;
            done_at: string | null;
            sort: number;
          }[]).map((m) => ({
            id: m.id,
            title: m.title,
            note: m.note,
            dueDate: m.due_date,
            doneAt: m.done_at,
            sort: m.sort,
          })),
    };
  } catch {
    veri = null;
  }
  if (veri === null) return <SectionError baslik="Benim Günüm" />;
  return (
    <MyDayRegion
      tasks={veri.tasks}
      taskTotal={veri.taskTotal}
      favorites={gunumGizli ? [] : veri.favorites}
      mine={veri.mine}
      today={today}
      gunumGizli={gunumGizli}
      todos={
        yapilacakGizli ? undefined : (
          <TodoWidget
            acik={todoSirala(veri.todos)}
            tamamlanan={todoTamamlanan(veri.todos, today)}
            today={today}
          />
        )
      }
    />
  );
}
