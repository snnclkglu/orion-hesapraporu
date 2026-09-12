"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Plus,
  Search,
  Users,
  LayoutGrid,
  Inbox,
  CheckCheck,
  Lock,
  ArrowUpRight,
  Paperclip,
  Flag,
  CalendarDays,
  List,
  Archive,
  ArrowLeft,
  Target,
  StickyNote,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TaskQuickPicker } from "@/components/account/task-quick-picker";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import {
  statuses,
  priorities,
  kinds,
  todayIstanbul,
  weekDays,
  dateLabel,
  isOverdue,
  goalProgress,
  type Task,
  type Workspace,
  type TaskDetail,
  type TaskFilters,
  type TaskInput,
  type TaskPatch,
  type Board,
} from "@/lib/tasks/model";
import type { TaskOperation } from "@/lib/tasks/service";
import {
  loadWorkspace,
  loadTaskDetail,
  mutateWorkspace,
  readWorkspaceInbox,
  uploadTaskFile,
  getTaskFile,
  searchTaskJobs,
} from "./workspace-actions";
import "./task-workspace.css";
import { ResponsiveTaskFilters } from "@/components/account/responsive-task-filters";
import { TaskWorkflow } from "@/components/account/task-workflow";
import { TaskSavedViews } from "@/components/account/task-saved-views";
import { TaskReminders } from "@/components/account/task-reminders";

const nav = [
  { id: "mine", label: "Görevlerim", icon: CheckCheck },
  { id: "team", label: "Ekip", icon: Users },
  { id: "boards", label: "Panolar", icon: LayoutGrid },
  { id: "inbox", label: "Gelen", icon: Inbox },
] as const;
type View = (typeof nav)[number]["id"];
const empty: Workspace = {
  tasks: [],
  total: 0,
  boards: [],
  teams: [],
  members: [],
  people: [],
  jobs: [],
  inbox: [],
};
function Avatar({ name }: { name: string }) {
  return (
    <span className="tw-avatar" title={name} aria-label={name}>
      {name
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join("") || "—"}
    </span>
  );
}
function Select({
  label,
  value,
  onChange,
  children,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <span className="tw-select">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
      <ChevronDown size={13} aria-hidden />
    </span>
  );
}

export function TaskWorkspace({
  initial = empty,
  userId,
  role,
  name,
  initialTask = null,
  preview = false,
  initialError,
  initialFilters = {},
}: {
  initial?: Workspace;
  userId: string;
  role: string;
  name: string;
  initialTask?: string | null;
  preview?: boolean;
  initialError?: string;
  initialFilters?: TaskFilters;
}) {
  const [data, setData] = useState(initial),
    [view, setView] = useState<View>(
      initialFilters.view === "menu" ? "mine" : (initialFilters.view ?? "mine"),
    ),
    [period, setPeriod] = useState<string>(initialFilters.period ?? "all"),
    [query, setQuery] = useState(initialFilters.q ?? ""),
    [boardId, setBoardId] = useState(initialFilters.board ?? ""),
    [teamId, setTeamId] = useState(initialFilters.team ?? ""),
    [sent, setSent] = useState(initialFilters.sent ?? false),
    [unassigned, setUnassigned] = useState(initialFilters.unassigned ?? false),
    [person, setPerson] = useState(initialFilters.assignee ?? ""),
    [status, setStatus] = useState<string>(initialFilters.status ?? ""),
    [priority, setPriority] = useState<string>(initialFilters.priority ?? ""),
    [layout, setLayout] = useState<"list" | "board">("list"),
    [mobileColumn, setMobileColumn] = useState("todo");
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(initialError ?? ""),
    [busy, setBusy] = useState(false),
    [creating, setCreating] = useState(false),
    [manage, setManage] = useState<"board" | "team" | null>(null),
    [taskId, setTaskId] = useState<string | null>(initialTask),
    [detail, setDetail] = useState<TaskDetail | null>(null),
    [detailError, setDetailError] = useState(""),
    [detailTab, setDetailTab] = useState("comments"),
    [revision, setRevision] = useState(0);
  const previewDetails = useRef<Record<string, TaskDetail>>({});
  const pending = useRef(false);
  // Yanıt ağda kaybolursa aynı kullanıcı denemesi ikinci bir görev üretmez.
  const retryCommand = useRef<{ signature: string; key: string } | null>(null);
  const mounted = useRef(true);
  const request = useRef(0);
  const today = todayIstanbul();
  const week = weekDays(today);
  const filters: TaskFilters = {
    view,
    period: period as TaskFilters["period"],
    q: query,
    ...(view === "mine" && sent ? { sent: true } : {}),
    ...(view === "team" && unassigned ? { unassigned: true } : {}),
    ...(teamId ? { team: teamId } : {}),
    ...(boardId ? { board: boardId } : {}),
    ...(person ? { assignee: person } : {}),
    ...(status ? { status: status as Task["status"] } : {}),
    ...(priority ? { priority: priority as Task["priority"] } : {}),
  };
  const serialized = JSON.stringify(filters);
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const key of [
      "view",
      "period",
      "q",
      "board",
      "team",
      "assignee",
      "status",
      "priority",
      "sent",
      "unassigned",
    ])
      url.searchParams.delete(key);
    for (const [key, value] of Object.entries(JSON.parse(serialized)))
      if (value) url.searchParams.set(key, String(value));
    window.history.replaceState({}, "", url);
  }, [serialized]);
  const board = data.boards.find((b) => b.id === boardId);
  const personName = (id: string | null) =>
    data.people.find((p) => p.id === id)?.full_name || "Atanmamış";
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (preview) return;
    const id = ++request.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const r = await loadWorkspace(JSON.parse(serialized));
      if (mounted.current && id === request.current) {
        if (r.data) {
          setData(r.data);
          setError("");
        } else setError(r.error ?? "Yüklenemedi");
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [serialized, revision, preview]);
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  useEffect(() => {
    const read = () =>
      setTaskId(new URL(window.location.href).searchParams.get("task"));
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  useEffect(() => {
    if (!taskId) return;
    let current = true;
    const timer = setTimeout(async () => {
      setDetail((previous) => (previous?.task.id === taskId ? previous : null));
      setDetailError("");
      if (preview) {
        const t = data.tasks.find((t) => t.id === taskId);
        if (t)
          setDetail({
            ...(previewDetails.current[taskId] ?? {
              comments: [],
              events: [],
              attachments: [],
            }),
            task: t,
          });
        else setDetailError("Görev bulunamadı");
        return;
      }
      const r = await loadTaskDetail(taskId);
      if (current) {
        if (r.data) setDetail(r.data);
        else {
          setDetail(null);
          setDetailError(r.error ?? "Görev okunamadı");
        }
      }
    }, 0);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [taskId, revision, preview, data.tasks]);
  function openTask(id: string | null) {
    setTaskId(id);
    setDetailTab("comments");
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("task", id);
    else u.searchParams.delete("task");
    window.history.pushState({}, "", u);
  }
  async function command(op: TaskOperation, input: unknown) {
    if (pending.current) return null;
    pending.current = true;
    setBusy(true);
    try {
      if (preview) {
        const p = input as Record<string, unknown>;
        let result: { task?: Task; board?: Board; ok?: boolean } = { ok: true };
        if (op === "create") {
          const t = {
            id: crypto.randomUUID(),
            title: "",
            note: "",
            created_by: userId,
            assignee: userId,
            job_id: null,
            board_id: null,
            visibility: "private",
            kind: "task",
            status: "todo",
            previous_status: "todo",
            priority: "none",
            due_date: null,
            done_at: null,
            version: 1,
            archived_at: null,
            goal_id: null,
            source_ref: null,
            updated_at: new Date().toISOString(),
            can_edit: true,
            ...p,
          } as Task;
          setData((d) => ({
            ...d,
            tasks: [t, ...d.tasks],
            total: d.total + 1,
          }));
          result = { task: t };
        }
        if (op === "update" || op === "workflow") {
          setData((d) => ({
            ...d,
            tasks: d.tasks.map((t) =>
              t.id === p.id
                ? ({
                    ...t,
                    ...p,
                    version: t.version + 1,
                    archived_at:
                      p.archived === undefined
                        ? t.archived_at
                        : p.archived
                          ? new Date().toISOString()
                          : null,
                  } as Task)
                : t,
            ),
          }));
        }
        if (op === "comment" && detail) {
          const d = {
            ...detail,
            comments: [
              ...detail.comments,
              {
                id: crypto.randomUUID(),
                author_id: userId,
                body: String(p.body),
                created_at: new Date().toISOString(),
              },
            ],
          };
          previewDetails.current[detail.task.id] = d;
          setDetail(d);
        }
        if (op === "board.create") {
          const b = {
            id: crypto.randomUUID(),
            owner_id: userId,
            archived_at: null,
            can_edit: true,
            ...p,
          } as unknown as Board;
          setData((d) => ({ ...d, boards: [...d.boards, b] }));
          result = { board: b };
        }
        if (op === "team.create")
          setData((d) => ({
            ...d,
            teams: [
              ...d.teams,
              {
                id: crypto.randomUUID(),
                name: String(p.name),
                owner_id: userId,
              },
            ],
          }));
        if (op === "team.member")
          setData((d) => ({
            ...d,
            members: [
              ...d.members.filter(
                (m) => !(m.team_id === p.team_id && m.user_id === p.user_id),
              ),
              ...(p.role === "remove"
                ? []
                : [p as unknown as Workspace["members"][number]]),
            ],
          }));
        if (op === "board.archive")
          setData((d) => ({
            ...d,
            boards: d.boards.map((b) =>
              b.id === p.id
                ? {
                    ...b,
                    archived_at: p.archived ? new Date().toISOString() : null,
                  }
                : b,
            ),
          }));
        return result;
      }
      const signature = JSON.stringify({ op, input });
      if (retryCommand.current?.signature !== signature)
        retryCommand.current = { signature, key: crypto.randomUUID() };
      const r = await mutateWorkspace(op, input, retryCommand.current.key);
      if (r.error) {
        toast.error(r.error);
        refresh();
        return null;
      }
      retryCommand.current = null;
      if (r.data?.task) {
        const changed = r.data.task;
        setData((d) => ({
          ...d,
          tasks: d.tasks.some((t) => t.id === changed.id)
            ? d.tasks.map((t) =>
                t.id === changed.id ? { ...t, ...changed } : t,
              )
            : [{ ...changed, can_edit: true }, ...d.tasks],
        }));
      }
      refresh();
      return r.data ?? null;
    } catch {
      toast.error("Bağlantı kesildi. Girdiğiniz bilgiler korunuyor.");
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function patch(
    t: Task,
    fields: Omit<Partial<TaskPatch>, "id" | "version">,
  ) {
    return command("update", { id: t.id, version: t.version, ...fields });
  }
  async function toggle(t: Task) {
    const result = await patch(t, {
      status: t.status === "done" ? t.previous_status : "done",
    });
    if (result && t.status !== "done")
      toast.success("Görev tamamlandı", {
        action: {
          label: "Geri al",
          onClick: () =>
            void command("update", {
              id: t.id,
              version: result.task?.version ?? t.version + 1,
              status: t.status,
            }),
        },
      });
  }
  function navigate(v: View) {
    setView(v);
    setTeamId("");
    setBoardId("");
    setPerson("");
    setStatus("");
    setPriority("");
    setPeriod("all");
    setQuery("");
  }
  let tasks = data.tasks;
  if (preview) {
    tasks = tasks.filter(
      (t) =>
        (view !== "mine" ||
          t.assignee === userId ||
          (t.visibility === "private" && t.created_by === userId) ||
          (sent && t.visibility === "direct" && t.created_by === userId)) &&
        (!sent ||
          view !== "mine" ||
          (t.visibility === "direct" && t.created_by === userId)) &&
        (!unassigned || view !== "team" || !t.assignee) &&
        (view !== "team" || !["private", "direct"].includes(t.visibility)) &&
        (!teamId ||
          data.boards.some(
            (b) => b.id === t.board_id && b.team_id === teamId,
          )) &&
        (!boardId || t.board_id === boardId) &&
        (!person || t.assignee === person) &&
        (!status || t.status === status) &&
        (!priority || t.priority === priority) &&
        (period === "archived") === !!t.archived_at &&
        (!query ||
          `${t.title} ${t.job_no ?? ""}`
            .toLocaleLowerCase("tr")
            .includes(query.toLocaleLowerCase("tr"))) &&
        (period !== "today" ||
          (!!t.due_date && t.due_date <= today && t.status !== "done")) &&
        (period !== "upcoming" ||
          (!!t.due_date && t.due_date > today && t.status !== "done")) &&
        (period !== "week" || (!!t.due_date && week.includes(t.due_date))) &&
        (period !== "overdue" || isOverdue(t, today)) &&
        (period !== "done" || t.status === "done"),
    );
  }
  const title =
    board?.name ??
    {
      mine: "Görevlerim",
      team: "Ekibin işleri",
      boards: "Panolar",
      inbox: "Gelen kutusu",
    }[view];
  const unread = data.inbox.filter((n) => !n.read_at).length;
  function renderRow(t: Task) {
    return (
      <div
        className={cn("tw-task", t.status === "done" && "tw-completed")}
        key={t.id}
      >
        {t.kind === "note" ? (
          <StickyNote className="tw-kind" size={19} />
        ) : (
          <button
            className={cn(
              "tw-check oc-tap-square",
              t.status === "done" && "checked",
            )}
            aria-label={`${t.title}: ${t.status === "done" ? "Yeniden aç" : "Tamamla"}`}
            disabled={busy || t.can_edit === false}
            onClick={() => void toggle(t)}
          >
            {t.status === "done" ? (
              <Check size={15} />
            ) : t.kind === "goal" ? (
              <Target size={16} />
            ) : null}
          </button>
        )}
        <button
          className="tw-task-body"
          aria-label={t.title}
          onClick={() => openTask(t.id)}
        >
          <span className="tw-task-title">{t.title}</span>
          <span className="tw-task-meta">
            {t.job_no && <span className="tw-code">{t.job_no}</span>}
            {["private", "direct"].includes(t.visibility) && (
              <span>
                <Lock size={11} />
                {t.visibility === "direct" ? "Kişiye özel" : "Bana özel"}
              </span>
            )}
            {view === "team" && t.assignee && (
              <span>{personName(t.assignee)}</span>
            )}
            {t.board_id && (
              <span className="tw-task-board">
                {data.boards.find((b) => b.id === t.board_id)?.name}
              </span>
            )}
            {t.status !== "todo" && (
              <span className={`tw-mobile-status tw-status status-${t.status}`}>
                {statuses[t.status]}
              </span>
            )}
            {t.due_date && (
              <span
                className={cn(
                  "tw-mobile-date",
                  isOverdue(t, today) && "tw-overdue-label",
                )}
              >
                <CalendarDays size={11} />
                {dateLabel(t.due_date, today)}
              </span>
            )}
            {isOverdue(t, today) && (
              <span className="tw-overdue-label">Gecikmiş</span>
            )}
            {t.priority !== "none" && (
              <span className={`tw-priority priority-${t.priority}`}>
                <Flag size={11} />
                {priorities[t.priority]}
              </span>
            )}
            {t.kind === "goal" && (
              <span>
                {goalProgress(t.goal_total ?? 0, t.goal_done ?? 0) === null
                  ? "Görev bağlanmadı"
                  : `%${goalProgress(t.goal_total ?? 0, t.goal_done ?? 0)} tamamlandı`}
              </span>
            )}
          </span>
        </button>
        <QuickTaskActions
          task={t}
          data={data}
          today={today}
          busy={busy}
          onPatch={(fields) => patch(t, fields)}
        />
      </div>
    );
  }
  return (
    <div className="tw-workspace">
      <PageHeader title="Panel" hint="Görevler, ekip ve iş akışı" />
      {preview && (
        <div className="tw-preview">
          Etkileşimli önizleme · Bu ekrandaki değişiklikler kaydedilmez.
        </div>
      )}
      <header className="tw-heading">
        <div>
          <p className="tw-eyebrow">
            {new Date(`${today}T12:00:00Z`).toLocaleDateString("tr-TR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1>{title}</h1>
          <p className="tw-subtitle">
            {view === "mine"
              ? `${name.split(" ")[0] || ""}, sıradaki işine odaklan.`
              : view === "team"
                ? "Kimin, hangi işi, ne zaman yapacağı bir arada."
                : board
                  ? `${kinds[board.kind]} · ${board.team_id ? "Ekiple paylaşılıyor" : "Yalnızca sana özel"}`
                  : view === "boards"
                    ? "İşlerini, notlarını ve hedeflerini düzenle."
                    : view === "inbox"
                      ? "Seni ilgilendiren güncellemeler."
                      : "ORION bölümlerine hızlı erişim."}
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="tw-desktop-create">
          <Plus size={16} />
          Yeni görev
        </Button>
      </header>
      <nav className="tw-navigation" aria-label="Panel gezinme">
        {nav.map((n) => (
          <button
            key={n.id}
            aria-current={view === n.id ? "page" : undefined}
            onClick={() => navigate(n.id)}
            className={cn("oc-tap", view === n.id && "active")}
          >
            <n.icon size={18} />
            <span>{n.label}</span>
            {n.id === "inbox" && unread > 0 && <b>{unread}</b>}
          </button>
        ))}
      </nav>
      {error && (
        <div className="tw-error" role="alert">
          {error}
          <Button variant="outline" onClick={refresh}>
            Yeniden dene
          </Button>
        </div>
      )}
      {(view === "mine" || view === "team" || board) && (
        <>
          <div className="tw-toolbar">
            <label className="tw-search">
              <Search size={17} />
              <input
                aria-label="Görev veya iş kodu ara"
                placeholder="Görev veya iş kodu ara"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {loading && <Loader2 size={16} className="animate-spin" />}
            </label>
            <div className="tw-view-toggle">
              <button
                aria-label="Liste görünümü"
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
              >
                <List size={17} />
              </button>
              <button
                aria-label="Pano görünümü"
                aria-pressed={layout === "board"}
                onClick={() => setLayout("board")}
              >
                <LayoutGrid size={17} />
              </button>
            </div>
          </div>
          <div className="tw-filterbar">
            <div className="tw-periods">
              {[
                ["all", "Tümü"],
                ["today", "Bugün"],
                ["week", "Bu hafta"],
                ["overdue", "Geciken"],
                ["done", "Tamamlanan"],
                ["archived", "Arşiv"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={cn(
                    "oc-tap",
                    period === id && "active",
                    ["done", "archived"].includes(id) && "tw-period-secondary",
                  )}
                  aria-pressed={period === id}
                  onClick={() => setPeriod(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <ResponsiveTaskFilters
              count={
                [
                  person,
                  status,
                  priority,
                  period !== "all" ? period : "",
                ].filter(Boolean).length
              }
            >
              <Select
                label="Dönem filtresi"
                value={period}
                onChange={setPeriod}
              >
                <option value="all">Tüm tarihler</option>
                <option value="today">Bugün</option>
                <option value="week">Bu hafta</option>
                <option value="overdue">Geciken</option>
                {period === "upcoming" && (
                  <option value="upcoming">Yaklaşan · kayıtlı filtre</option>
                )}
                <option value="done">Tamamlanan</option>
                <option value="archived">Arşiv</option>
              </Select>
              <Select
                label="Sorumlu filtresi"
                value={person}
                onChange={setPerson}
              >
                <option value="">Tüm kişiler</option>
                {data.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </Select>
              <Select
                label="Durum filtresi"
                value={status}
                onChange={setStatus}
              >
                <option value="">Tüm durumlar</option>
                {Object.entries(statuses).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
              <Select
                label="Öncelik filtresi"
                value={priority}
                onChange={setPriority}
              >
                <option value="">Tüm öncelikler</option>
                {Object.entries(priorities).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </ResponsiveTaskFilters>
            <TaskSavedViews
              preview={preview}
              filters={filters}
              onApply={(f) => {
                setView(f.view === "menu" ? "mine" : (f.view ?? "mine"));
                setPeriod(f.period ?? "all");
                setQuery(f.q ?? "");
                setBoardId(f.board ?? "");
                setTeamId(f.team ?? "");
                setPerson(f.assignee ?? "");
                setStatus(f.status ?? "");
                setPriority(f.priority ?? "");
                setSent(f.sent ?? false);
                setUnassigned(f.unassigned ?? false);
              }}
            />
          </div>
          {["done", "archived", "upcoming"].includes(period) && (
            <div className="tw-active-period" role="status">
              <span>
                {period === "done"
                  ? "Tamamlanan görevler"
                  : period === "archived"
                    ? "Arşiv"
                    : "Yaklaşan · kayıtlı filtre"}
              </span>
              <button className="oc-tap" onClick={() => setPeriod("all")}>
                Filtreyi temizle
              </button>
            </div>
          )}
          {view === "team" && (
            <div className="tw-team-summary">
              <Select label="Ekip filtresi" value={teamId} onChange={setTeamId}>
                <option value="">Tüm ekipler</option>
                {data.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <span>
                <strong>{preview ? tasks.length : data.total}</strong> görünür
                görev <small>· Seçili süzgeçlere göre</small>
              </span>
              <Button
                variant={unassigned ? "secondary" : "ghost"}
                aria-pressed={unassigned}
                onClick={() => setUnassigned(!unassigned)}
              >
                Atanmamış
              </Button>
            </div>
          )}
          {view === "mine" && (
            <Button
              className="mb-3"
              variant={sent ? "secondary" : "ghost"}
              aria-pressed={sent}
              onClick={() => setSent(!sent)}
            >
              Gönderdiklerim
            </Button>
          )}
          {board && (
            <div className="tw-board-context">
              <button onClick={() => setBoardId("")} className="oc-tap">
                <ArrowLeft size={15} />
                Tüm panolar
              </button>
              {(board.owner_id === userId ||
                (role === "admin" && board.team_id)) && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void command("board.archive", {
                      id: board.id,
                      archived: !board.archived_at,
                    })
                  }
                >
                  <Archive size={14} />
                  {board.archived_at ? "Arşivden çıkar" : "Panoyu arşivle"}
                </Button>
              )}
            </div>
          )}
          <section
            aria-label="Görev listesi"
            aria-busy={loading}
            className={cn("tw-content", loading && "is-loading")}
          >
            {period === "week" ? (
              <div className="tw-agenda">
                <p className="tw-muted">
                  {dateLabel(week[0], "")} – {dateLabel(week[6], "")} · Yüklenen{" "}
                  {tasks.length} / {preview ? tasks.length : data.total} kayıt
                </p>
                {week.map((day) => (
                  <section
                    key={day}
                    className={cn("tw-agenda-day", day === today && "is-today")}
                  >
                    <h3>
                      {new Date(`${day}T12:00:00Z`).toLocaleDateString(
                        "tr-TR",
                        { weekday: "long", day: "numeric", month: "short" },
                      )}
                      {day === today && <span>Bugün</span>}
                    </h3>
                    {tasks.filter((t) => t.due_date === day).map(renderRow)}
                    {!tasks.some((t) => t.due_date === day) && (
                      <p className="tw-muted">
                        {data.total > tasks.length && !preview
                          ? "Yüklenen kayıtlarda görev yok"
                          : "Planlanmış görev yok"}
                      </p>
                    )}
                  </section>
                ))}
              </div>
            ) : layout === "list" ? (
              <>
                <div className="tw-list-caption">
                  <span>
                    {period === "today"
                      ? "Bugün ve gecikenler"
                      : board?.kind === "note"
                        ? "Notlar"
                        : "Görev"}
                  </span>
                  <span>{preview ? tasks.length : data.total} kayıt</span>
                </div>
                {tasks.map(renderRow)}
              </>
            ) : (
              <>
                <div className="tw-mobile-column">
                  <Select
                    label="Pano sütunu"
                    value={mobileColumn}
                    onChange={setMobileColumn}
                  >
                    {Object.entries(statuses).map(([k, v]) => (
                      <option value={k} key={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="tw-kanban">
                  {Object.entries(statuses).map(([key, label]) => (
                    <section
                      key={key}
                      className={cn(
                        "tw-column",
                        mobileColumn === key && "mobile-active",
                      )}
                    >
                      <h2>
                        <i className={`status-${key}`} />
                        {label}
                        <span>
                          {tasks.filter((t) => t.status === key).length}
                        </span>
                      </h2>
                      {tasks
                        .filter((t) => t.status === key)
                        .map((t) => (
                          <div key={t.id} className="tw-kanban-card">
                            {renderRow(t)}
                            {t.can_edit !== false && (
                              <Select
                                label={`${t.title}: durum değiştir`}
                                value={t.status}
                                onChange={(v) =>
                                  void patch(t, { status: v as Task["status"] })
                                }
                                disabled={busy}
                              >
                                {Object.entries(statuses).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </Select>
                            )}
                          </div>
                        ))}
                      <button
                        className="tw-add-inline oc-tap"
                        onClick={() => setCreating(true)}
                      >
                        <Plus size={15} />
                        Görev ekle
                      </button>
                    </section>
                  ))}
                </div>
              </>
            )}
            {tasks.length === 0 && !loading && (
              <div className="tw-empty">
                <CheckCheck size={34} />
                <h2>
                  {query || person || status || priority
                    ? "Bu süzgeçlerle görev bulunamadı"
                    : "Burada henüz bir kayıt yok"}
                </h2>
                <p>
                  {period === "today"
                    ? "Bugüne ait veya gecikmiş görevin görünmüyor."
                    : "Bir görev ekle; ayrıntılarını ihtiyaç duydukça doldur."}
                </p>
                <Button variant="outline" onClick={() => setCreating(true)}>
                  <Plus size={15} />
                  Görev oluştur
                </Button>
              </div>
            )}
            {layout === "list" && tasks.length > 0 && (
              <button
                className="tw-add-inline oc-tap"
                onClick={() => setCreating(true)}
              >
                <Plus size={16} />
                {board?.kind === "note"
                  ? "Not ekle"
                  : board?.kind === "goal"
                    ? "Hedef ekle"
                    : "Görev ekle"}
              </button>
            )}
          </section>
          {!preview &&
            data.total > data.tasks.length &&
            data.tasks.length > 0 && (
              <Button
                variant="outline"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  const last = data.tasks.at(-1)!;
                  const r = await loadWorkspace({
                    ...filters,
                    cursor: `${last.updated_at}|${last.id}`,
                  });
                  if (r.data)
                    setData((d) => ({
                      ...r.data!,
                      tasks: [
                        ...d.tasks,
                        ...r.data!.tasks.filter(
                          (t) => !d.tasks.some((x) => x.id === t.id),
                        ),
                      ],
                    }));
                  else toast.error(r.error);
                  setLoading(false);
                }}
              >
                Daha fazla göster
              </Button>
            )}
        </>
      )}
      {view === "boards" && !board && (
        <>
          <div className="tw-section-heading">
            <span>{data.boards.length} pano</span>
            <Button onClick={() => setManage("board")}>
              <Plus size={16} />
              Pano oluştur
            </Button>
          </div>
          <div className="tw-boards">
            {data.boards.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setBoardId(b.id);
                  setPeriod("all");
                }}
                className={cn("tw-board-card", b.archived_at && "opacity-60")}
              >
                <span className={`tw-board-icon kind-${b.kind}`}>
                  {b.kind === "task" ? (
                    <LayoutGrid />
                  ) : b.kind === "note" ? (
                    <StickyNote />
                  ) : (
                    <Target />
                  )}
                </span>
                <h2>{b.name}</h2>
                <p>
                  {b.team_id
                    ? data.teams.find((t) => t.id === b.team_id)?.name
                    : "Bana özel"}{" "}
                  · {kinds[b.kind]}
                </p>
                {b.archived_at && <small>Arşivlendi</small>}
                <ArrowUpRight className="tw-board-arrow" size={18} />
              </button>
            ))}
          </div>
          {!data.boards.length && (
            <div className="tw-empty">
              <LayoutGrid size={32} />
              <h2>Her işin bir yeri olsun</h2>
              <p>
                Kendin veya ekibin için görev, not ve hedef panoları oluştur.
              </p>
            </div>
          )}
        </>
      )}
      {view === "inbox" && (
        <section className="tw-inbox">
          <TaskReminders preview={preview} />
          {data.inbox.map((n) => (
            <div key={n.id} className="tw-inbox-row">
              <button
                key={n.id}
                className={cn("tw-inbox-item", !n.read_at && "unread")}
                onClick={async () => {
                  if (!preview) {
                    const r = await readWorkspaceInbox(n.id);
                    if (r.error) {
                      toast.error(r.error);
                      return;
                    }
                  }
                  setData((d) => ({
                    ...d,
                    inbox: d.inbox.map((x) =>
                      x.id === n.id
                        ? { ...x, read_at: new Date().toISOString() }
                        : x,
                    ),
                  }));
                  openTask(n.task_id);
                }}
              >
                <span className="tw-inbox-dot" />
                <div>
                  <p>
                    {n.event === "assigned"
                      ? "Sana bir görev atandı"
                      : n.event === "due_soon"
                        ? "Görevin termini yaklaşıyor veya geçti"
                        : n.event === "unblocked"
                          ? "Ön koşullar tamamlandı; görev hazır"
                          : "Göreve yeni yorum eklendi"}
                  </p>
                  <strong>{n.title}</strong>
                  <small>
                    {new Date(n.created_at).toLocaleString("tr-TR")}
                  </small>
                </div>
                <ArrowUpRight size={17} />
              </button>
              <Button
                variant="ghost"
                className="oc-tap"
                onClick={async () => {
                  if (!preview) {
                    const r = await readWorkspaceInbox(n.id, !n.read_at);
                    if (r.error) {
                      toast.error(r.error);
                      return;
                    }
                  }
                  setData((d) => ({
                    ...d,
                    inbox: d.inbox.map((x) =>
                      x.id === n.id
                        ? {
                            ...x,
                            read_at: n.read_at
                              ? null
                              : new Date().toISOString(),
                          }
                        : x,
                    ),
                  }));
                }}
              >
                {n.read_at ? "Okunmadı işaretle" : "Okundu işaretle"}
              </Button>
            </div>
          ))}
          {!data.inbox.length && (
            <div className="tw-empty">
              <Inbox size={34} />
              <h2>Her şey güncel</h2>
              <p>Atamalar ve görev yorumları burada görünecek.</p>
            </div>
          )}
        </section>
      )}
      <button
        className="tw-mobile-create"
        aria-label="Yeni görev oluştur"
        onClick={() => setCreating(true)}
      >
        <Plus size={21} />
        <span>Yeni görev</span>
      </button>
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent mobileKeyboardSafe className="tw-create-dialog">
          <DialogTitle>
            {board?.kind === "note"
              ? "Yeni not"
              : board?.kind === "goal"
                ? "Yeni hedef"
                : "Yeni görev"}
          </DialogTitle>
          <DialogDescription>
            Başlık yeterli. Diğer alanları sonra da ekleyebilirsin.
          </DialogDescription>
          <TaskForm
            data={data}
            userId={userId}
            board={
              board ??
              (view === "team" && teamId
                ? (data.boards.find(
                    (b) => b.team_id === teamId && b.is_default,
                  ) ??
                  data.boards.find(
                    (b) => b.team_id === teamId && !b.archived_at,
                  ))
                : undefined)
            }
            busy={busy}
            onSubmit={async (input) => {
              const r = await command("create", input);
              if (r) {
                setCreating(false);
                toast.success("Kaydedildi");
              }
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!taskId}
        onOpenChange={(open) => {
          if (!open) openTask(null);
        }}
      >
        <DialogContent mobileKeyboardSafe className="tw-detail-dialog">
          <DialogTitle className="sr-only">Görev ayrıntısı</DialogTitle>
          <DialogDescription className="sr-only">
            Açıklama, sorumlu, tarih, yorumlar, ekler ve değişiklik geçmişi
          </DialogDescription>
          {detailError ? (
            <div role="alert">
              {detailError}
              <Button onClick={refresh}>Yeniden dene</Button>
            </div>
          ) : !detail ? (
            <div className="tw-detail-loading">
              <Loader2 className="animate-spin" />
              Görev yükleniyor…
            </div>
          ) : (
            <>
              <div className="tw-detail-top">
                <Button
                  variant={
                    detail.task.status === "done" ? "default" : "outline"
                  }
                  disabled={
                    busy ||
                    detail.task.can_edit === false ||
                    detail.task.kind === "note"
                  }
                  onClick={() => void toggle(detail.task)}
                >
                  <Check size={16} />
                  {detail.task.status === "done" ? "Tamamlandı" : "Tamamla"}
                </Button>
                <span>
                  {["private", "direct"].includes(detail.task.visibility) ? (
                    <>
                      <Lock size={12} />
                      {detail.task.visibility === "direct"
                        ? "Kişiye özel"
                        : "Bana özel"}
                    </>
                  ) : (
                    "Paylaşılan görev"
                  )}
                </span>
              </div>
              <button
                className="tw-jump-comments oc-tap"
                onClick={() => {
                  setDetailTab("comments");
                  document
                    .getElementById("task-discussion")
                    ?.scrollIntoView({ block: "start" });
                }}
              >
                Yorumlara git · {detail.comments.length}
              </button>
              <TaskEditor
                key={detail.task.id}
                task={detail.task}
                userId={userId}
                data={data}
                busy={busy}
                onSave={async (fields, version) =>
                  !!(await command("update", {
                    id: detail.task.id,
                    version: version ?? detail.task.version,
                    ...fields,
                  }))
                }
              />
              <div className="tw-detail-extras">
                {detail.task.job_id && (
                  <Link href={`/jobs/${detail.task.job_id}`}>
                    <span className="tw-code">{detail.task.job_no}</span> İşe
                    git <ArrowUpRight size={13} />
                  </Link>
                )}
                <Button
                  variant="ghost"
                  disabled={busy || detail.task.can_edit === false}
                  onClick={() =>
                    void patch(detail.task, {
                      archived: !detail.task.archived_at,
                    })
                  }
                >
                  <Archive size={14} />
                  {detail.task.archived_at ? "Arşivden çıkar" : "Arşivle"}
                </Button>
              </div>
              <TaskWorkflow
                key={`flow-${detail.task.id}`}
                task={detail.task}
                busy={busy}
                preview={preview}
                candidates={data.tasks}
                onOpen={setTaskId}
                onSave={async (input) => !!(await command("workflow", input))}
              />
              <section className="tw-attachments">
                <h3>
                  <Paperclip size={15} />
                  Ekler <span>{detail.attachments.length}</span>
                </h3>
                {detail.attachments.map((a) => (
                  <button
                    className="oc-tap"
                    key={a.id}
                    onClick={async () => {
                      const r = await getTaskFile(a.id);
                      if (r.url) window.location.assign(r.url);
                      else toast.error(r.error);
                    }}
                  >
                    <Paperclip size={15} />
                    {a.name}
                    <small>{Math.ceil(a.bytes / 1024)} KB</small>
                  </button>
                ))}
                {detail.task.can_edit !== false && (
                  <label className="tw-upload">
                    <Plus size={15} />
                    {busy ? "Yükleniyor…" : "Dosya veya fotoğraf ekle"}
                    <input
                      type="file"
                      className="sr-only"
                      disabled={busy}
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.docx,.xlsx"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (preview) {
                          toast.info(
                            "Dosya ekleme gerçek görevlerde kullanılabilir.",
                          );
                          return;
                        }
                        setBusy(true);
                        const form = new FormData();
                        form.set("file", f);
                        try {
                          const r = await uploadTaskFile(detail.task.id, form);
                          if (r.error) toast.error(r.error);
                          else refresh();
                        } catch {
                          toast.error("Dosya yüklenemedi. Yeniden deneyin.");
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </label>
                )}
                <small>Görevi destekleyen dosyalar · En fazla 20 MB</small>
              </section>
              <div className="tw-detail-tabs" id="task-discussion">
                {[
                  ["comments", "Yorumlar"],
                  ["history", "Geçmiş"],
                ].map(([k, v]) => (
                  <button
                    className={cn("oc-tap", detailTab === k && "active")}
                    key={k}
                    onClick={() => setDetailTab(k)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {detailTab === "comments" ? (
                <>
                  <div className="tw-comments">
                    {detail.comments.map((c) => (
                      <article key={c.id}>
                        <Avatar name={personName(c.author_id)} />
                        <div>
                          <header>
                            <strong>{personName(c.author_id)}</strong>
                            <time>
                              {new Date(c.created_at).toLocaleString("tr-TR")}
                            </time>
                          </header>
                          <p>{c.body}</p>
                        </div>
                      </article>
                    ))}
                    {!detail.comments.length && (
                      <p className="tw-muted">
                        İlk güncellemeyi paylaş. Görevle ilgili konuşmalar
                        burada kalsın.
                      </p>
                    )}
                  </div>
                  {detail.task.can_edit !== false && (
                    <TaskCommentForm
                      key={detail.task.id}
                      people={data.people}
                      busy={busy}
                      onSend={async (body, mentions) =>
                        !!(await command("comment", {
                          id: detail.task.id,
                          body,
                          mentions,
                        }))
                      }
                    />
                  )}
                </>
              ) : (
                <ol className="tw-history">
                  {detail.events.map((e) => (
                    <li key={e.id}>
                      <strong>{e.agent_name || personName(e.actor_id)}</strong>
                      <span>
                        {(
                          {
                            created: "oluşturdu",
                            updated: "güncelledi",
                            commented: "yorum ekledi",
                            attached: "dosya ekledi",
                            workflow_updated:
                              "kontrol listesini veya akış ayarlarını güncelledi",
                            recurrence_created: "sonraki tekrarı oluşturdu",
                          } as Record<string, string>
                        )[e.event] ?? e.event}
                      </span>
                      <time>
                        {new Date(e.created_at).toLocaleString("tr-TR")}
                      </time>
                      <TaskHistoryChanges changes={e.changes} data={data} />
                    </li>
                  ))}
                  {!detail.events.length && (
                    <p className="tw-muted">
                      Aktarım öncesi değişiklik geçmişi bulunmuyor.
                    </p>
                  )}
                </ol>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!manage}
        onOpenChange={(o) => {
          if (!o) setManage(null);
        }}
      >
        <DialogContent mobileKeyboardSafe className="tw-create-dialog">
          <DialogTitle>
            {manage === "board" ? "Pano oluştur" : "Ekip yönetimi"}
          </DialogTitle>
          <DialogDescription>
            {manage === "board"
              ? "Görevlerini, notlarını veya hedeflerini bir araya getir."
              : "Üyelikleri bir kez düzenle; görevlerde tekrar doldurma."}
          </DialogDescription>
          <form
            className="tw-management"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              const r = await command(
                manage === "board" ? "board.create" : "team.create",
                manage === "board"
                  ? {
                      name: f.get("name"),
                      kind: f.get("kind"),
                      team_id: f.get("team") || null,
                    }
                  : { name: f.get("name") },
              );
              if (r) {
                form.reset();
                if (manage === "board") setManage(null);
              }
            }}
          >
            <label>
              Ad
              <input name="name" required maxLength={120} />
            </label>
            {manage === "board" && (
              <>
                <label>
                  Tür
                  <select name="kind">
                    {Object.entries(kinds).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Paylaşım
                  <select name="team">
                    <option value="">Bana özel</option>
                    {data.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <Button type="submit" disabled={busy}>
              <Plus size={15} />
              {manage === "board" ? "Pano oluştur" : "Yeni ekip oluştur"}
            </Button>
          </form>
          {manage === "team" &&
            data.teams.map((t) => (
              <section className="tw-team-editor" key={t.id}>
                <h3>{t.name}</h3>
                {data.members
                  .filter((m) => m.team_id === t.id)
                  .map((m) => (
                    <div key={m.user_id}>
                      <span>{personName(m.user_id)}</span>
                      <Select
                        label={`${personName(m.user_id)} yetkisi`}
                        value={m.role}
                        disabled={
                          busy ||
                          t.owner_id === m.user_id ||
                          (t.owner_id !== userId &&
                            role !== "admin" &&
                            !data.members.some(
                              (m) =>
                                m.team_id === t.id &&
                                m.user_id === userId &&
                                m.role === "manager",
                            ))
                        }
                        onChange={(v) =>
                          void command("team.member", {
                            team_id: t.id,
                            user_id: m.user_id,
                            role: v,
                          })
                        }
                      >
                        <option value="manager">Yönetir</option>
                        <option value="editor">Düzenler</option>
                        <option value="viewer">Görüntüler</option>
                        <option value="remove">Ekipten çıkar</option>
                      </Select>
                    </div>
                  ))}
                {(t.owner_id === userId ||
                  role === "admin" ||
                  data.members.some(
                    (m) =>
                      m.team_id === t.id &&
                      m.user_id === userId &&
                      m.role === "manager",
                  )) && (
                  <Select
                    label={`${t.name}: üye ekle`}
                    value=""
                    onChange={(v) => {
                      if (v)
                        void command("team.member", {
                          team_id: t.id,
                          user_id: v,
                          role: "editor",
                        });
                    }}
                  >
                    <option value="">Üye ekle</option>
                    {data.people
                      .filter(
                        (p) =>
                          !data.members.some(
                            (m) => m.team_id === t.id && m.user_id === p.id,
                          ),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                  </Select>
                )}
              </section>
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskHistoryChanges({
  changes,
  data,
}: {
  changes: TaskDetail["events"][number]["changes"];
  data: Workspace;
}) {
  const labels: Record<string, string> = {
    checklist: "Kontrol listesi",
    recurrence: "Tekrar",
    waiting_count: "Beklenen görev sayısı",
    title: "Başlık",
    note: "Açıklama",
    job_id: "İş kodu",
    status: "Durum",
    priority: "Öncelik",
    assignee: "Sorumlu",
    due_date: "Termin",
    visibility: "Paylaşım",
    board_id: "Pano",
    archived_at: "Arşiv",
    kind: "Tür",
    goal_id: "Hedef",
  };
  function value(key: string, raw: unknown): string {
    if (raw === null || raw === undefined || raw === "") return "Yok";
    if (key === "checklist" && Array.isArray(raw))
      return raw.length
        ? raw.map((i) => `${i.done ? "✓" : "○"} ${i.text}`).join(" · ")
        : "Boş liste";
    if (key === "recurrence" && typeof raw === "object") {
      const rule = raw as { mode: string; interval: number };
      return `${rule.interval} ${rule.mode === "monthly" ? "ay" : rule.mode === "weekly" ? "hafta" : "gün (tamamlanmadan sonra)"}`;
    }
    const text = String(raw);
    if (key === "status") return statuses[text as Task["status"]] ?? text;
    if (key === "priority") return priorities[text as Task["priority"]] ?? text;
    if (key === "kind") return kinds[text as Task["kind"]] ?? text;
    if (key === "visibility")
      return (
        (
          {
            private: "Bana özel",
            direct: "Kişiye özel",
            team: "Ekip",
            job: "İş",
          } as Record<string, string>
        )[text] ?? text
      );
    if (key === "assignee")
      return data.people.find((p) => p.id === text)?.full_name ?? "Kişi kaydı";
    if (key === "board_id")
      return data.boards.find((b) => b.id === text)?.name ?? "Önceki pano";
    if (key === "job_id")
      return data.jobs.find((j) => j.id === text)?.job_no ?? "İş bağlantısı";
    if (key === "goal_id")
      return (
        (data.goals ?? data.tasks).find((t) => t.id === text)?.title ??
        "Hedef bağlantısı"
      );
    if (key === "archived_at") return "Arşivlendi";
    return text;
  }
  return (
    <dl className="tw-history-changes">
      {Object.entries(changes)
        .filter(([key]) => labels[key])
        .map(([key, change]) => (
          <div key={key}>
            <dt>{labels[key]}</dt>
            <dd>
              <span>{value(key, change.before)}</span>
              <span aria-label="yerine"> → </span>
              <strong>{value(key, change.after)}</strong>
            </dd>
          </div>
        ))}
    </dl>
  );
}

function TaskCommentForm({
  people,
  busy,
  onSend,
}: {
  people: Workspace["people"];
  busy: boolean;
  onSend: (body: string, mentions: string[]) => Promise<boolean>;
}) {
  const [body, setBody] = useState(""),
    [mentioned, setMentioned] = useState<string[]>([]);
  return (
    <form
      className="tw-comment-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await onSend(
            body,
            mentioned.filter((id) =>
              body.includes(`@${people.find((p) => p.id === id)?.full_name}`),
            ),
          )
        ) {
          setBody("");
          setMentioned([]);
        }
      }}
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        maxLength={4000}
        aria-label="Yorum"
        placeholder="Bir güncelleme veya soru yaz"
        rows={3}
      />
      <div className="tw-comment-actions">
        <Select
          label="Kişiden bahset"
          value=""
          onChange={(id) => {
            const person = people.find((p) => p.id === id);
            if (person) {
              setBody((v) => `${v}${v ? " " : ""}@${person.full_name} `);
              setMentioned((v) => Array.from(new Set([...v, id])));
            }
          }}
        >
          <option value="">@ Kişiden bahset</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
            </option>
          ))}
        </Select>
        <Button disabled={busy} type="submit">
          Gönder
        </Button>
      </div>
    </form>
  );
}

function QuickTaskActions({
  task: t,
  data,
  today,
  busy,
  onPatch,
}: {
  task: Task;
  data: Workspace;
  today: string;
  busy: boolean;
  onPatch: (
    fields: Omit<Partial<TaskPatch>, "id" | "version">,
  ) => Promise<unknown>;
}) {
  const [dateOpen, setDateOpen] = useState(false),
    [personOpen, setPersonOpen] = useState(false),
    [search, setSearch] = useState("");
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const name =
    data.people.find((p) => p.id === t.assignee)?.full_name ?? "Atanmamış";
  const board = data.boards.find((b) => b.id === t.board_id);
  const people = data.people.filter(
    (p) =>
      (t.visibility === "job" ||
        (t.visibility === "private" && p.id === t.created_by) ||
        (board?.team_id &&
          (data.members.some(
            (m) => m.team_id === board.team_id && m.user_id === p.id,
          ) ||
            data.teams.some(
              (team) => team.id === board.team_id && team.owner_id === p.id,
            )))) &&
      p.full_name
        .toLocaleLowerCase("tr")
        .includes(search.toLocaleLowerCase("tr")),
  );
  return (
    <div className="tw-task-trailing">
      <TaskQuickPicker
        open={dateOpen}
        onOpenChange={setDateOpen}
        title="Termin"
        trigger={
          <button
            className={cn("tw-date oc-tap", isOverdue(t, today) && "overdue")}
            disabled={busy || t.can_edit === false}
            aria-label={`${t.title}: tarih ${dateLabel(t.due_date, today)}`}
          >
            {t.due_date ? (
              dateLabel(t.due_date, today)
            ) : (
              <CalendarDays size={16} />
            )}
          </button>
        }
      >
        {[
          [today, "Bugün"],
          [tomorrow.toISOString().slice(0, 10), "Yarın"],
          ["", "Tarihi kaldır"],
        ].map(([date, label]) => (
          <button
            className="oc-tap"
            key={label}
            onClick={async () => {
              if (await onPatch({ due_date: date || null })) setDateOpen(false);
            }}
          >
            {label}
          </button>
        ))}
        <input
          type="date"
          aria-label="Başka bir tarih seç"
          value={t.due_date ?? ""}
          onChange={async (e) => {
            if (await onPatch({ due_date: e.target.value || null }))
              setDateOpen(false);
          }}
        />
      </TaskQuickPicker>
      <span className={`tw-status status-${t.status}`}>
        {statuses[t.status]}
      </span>
      <TaskQuickPicker
        open={personOpen}
        onOpenChange={setPersonOpen}
        title="Sorumlu"
        trigger={
          <button
            className="oc-tap-square"
            aria-label={`${t.title}: sorumlu ${name}`}
            disabled={
              busy ||
              t.can_edit === false ||
              t.visibility === "private" ||
              t.visibility === "direct"
            }
          >
            <Avatar name={name} />
          </button>
        }
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Kişi ara"
          placeholder="Kişi ara"
        />
        {people.map((p) => (
          <button
            key={p.id}
            aria-label={p.full_name}
            className="oc-tap"
            onClick={async () => {
              if (await onPatch({ assignee: p.id })) setPersonOpen(false);
            }}
          >
            <Avatar name={p.full_name} />
            {p.full_name}
          </button>
        ))}
        <button
          className="oc-tap"
          onClick={async () => {
            if (await onPatch({ assignee: null })) setPersonOpen(false);
          }}
        >
          Atamayı kaldır
        </button>
      </TaskQuickPicker>
    </div>
  );
}

function TaskForm({
  data,
  userId,
  board,
  busy,
  onSubmit,
}: {
  data: Workspace;
  userId: string;
  board?: Board;
  busy: boolean;
  onSubmit: (input: TaskInput) => Promise<void>;
}) {
  const [selected, setSelected] = useState(board?.id ?? ""),
    [scope, setScope] = useState(board?.team_id ?? "private"),
    [assigneeQuery, setAssigneeQuery] = useState(""),
    [assigneeId, setAssigneeId] = useState(""),
    [jobQuery, setJobQuery] = useState(""),
    [kind, setKind] = useState<Task["kind"]>(board?.kind ?? "task"),
    [jobs, setJobs] = useState(data.jobs);
  useEffect(() => {
    if (!jobQuery) return;
    let current = true;
    const timer = setTimeout(async () => {
      const r = await searchTaskJobs(jobQuery);
      if (current && r.data) setJobs(r.data);
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [jobQuery]);
  const b = data.boards.find((x) => x.id === selected);
  return (
    <form
      className="tw-task-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        await onSubmit({
          title: String(f.get("title")),
          note: String(f.get("note") ?? ""),
          board_id: scope === "direct" ? null : selected || null,
          visibility:
            scope === "direct" ? "direct" : b?.team_id ? "team" : "private",
          kind,
          assignee:
            scope === "direct" || b?.team_id ? assigneeId || null : userId,
          due_date: String(f.get("due_date") || "") || null,
          job_id: String(f.get("job_id") || "") || null,
          priority: String(f.get("priority") || "none") as Task["priority"],
        });
      }}
    >
      <input
        name="title"
        required
        maxLength={300}
        aria-label="Görev başlığı"
        placeholder="Ne yapılacak?"
        className="tw-title-input"
      />
      <label>
        Paylaşım
        <select
          aria-label="Görev paylaşımı"
          value={scope}
          onChange={(e) => {
            const s = e.target.value;
            setScope(s);
            setAssigneeId("");
            setSelected(
              s === "private" || s === "direct"
                ? ""
                : (data.boards.find((b) => b.team_id === s && b.is_default)
                    ?.id ??
                    data.boards.find((b) => b.team_id === s && !b.archived_at)
                      ?.id ??
                    ""),
            );
            if (s === "direct" && kind === "goal") setKind("task");
          }}
        >
          <option value="private">Bana özel</option>
          <option value="direct">Kişiye özel ata</option>
          {data.teams
            .filter((t) => !t.archived_at)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </label>
      {scope === "direct" && (
        <p className="text-sm text-muted-foreground">
          Yalnız siz ve seçtiğiniz kişi görebilir. Ekiplerde görünmez.
        </p>
      )}
      {(scope === "direct" || !!b?.team_id) && (
        <label>
          Sorumlu · {scope === "direct" ? "gerekli" : "isteğe bağlı"}
          <input
            aria-label="Atanacak kişi ara"
            value={assigneeQuery}
            onChange={(e) => setAssigneeQuery(e.target.value)}
          />
          <select
            aria-label="Görev atanacak kişi"
            required={scope === "direct"}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">
              {scope === "direct"
                ? "Kişi seç"
                : "Ekibin atamasız havuzuna bırak"}
            </option>
            {data.people
              .filter(
                (p) =>
                  (scope === "direct" ||
                    data.members.some(
                      (m) => m.team_id === b?.team_id && m.user_id === p.id,
                    )) &&
                  (p.id === assigneeId ||
                    p.full_name
                      .toLocaleLowerCase("tr-TR")
                      .includes(assigneeQuery.toLocaleLowerCase("tr-TR"))),
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </select>
        </label>
      )}
      {scope !== "direct" && (
        <label>
          Pano · isteğe bağlı
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setKind(
                data.boards.find((b) => b.id === e.target.value)?.kind ??
                  "task",
              );
            }}
          >
            <option value="" disabled={scope !== "private"}>
              Bana özel görev
            </option>
            {data.boards
              .filter(
                (b) =>
                  !b.archived_at &&
                  b.can_edit !== false &&
                  (scope === "private" ? !b.team_id : b.team_id === scope),
              )
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <details>
        <summary>Tarih, sorumlu, iş kodu ve diğer ayrıntılar</summary>
        <div className="tw-form-grid">
          <label>
            Tür
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Task["kind"])}
            >
              {Object.entries(kinds)
                .filter(([k]) => scope !== "direct" || k !== "goal")
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Termin
            <input name="due_date" type="date" />
          </label>
          <label>
            Öncelik
            <select name="priority">
              {Object.entries(priorities).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          İş kodu
          <input
            aria-label="İş kodu süz"
            value={jobQuery}
            onChange={(e) => setJobQuery(e.target.value)}
            placeholder="İş kodu ara"
          />
          <select name="job_id">
            <option value="">İş seçilmedi</option>
            {jobs
              .filter((j) => !jobQuery || j.job_no.includes(jobQuery))
              .map((j) => (
                <option key={j.id} value={j.id}>
                  {j.job_no} · {j.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          Açıklama
          <textarea
            name="note"
            rows={4}
            maxLength={20000}
            placeholder="Görevle ilgili ayrıntılar"
          />
        </label>
      </details>
      <div className="tw-form-footer">
        <span>
          {b?.team_id ? (
            <>
              <Users size={13} />
              Ekibinle paylaşılıyor
            </>
          ) : (
            <>
              <Lock size={13} />
              {scope === "direct"
                ? "Yalnız gönderen ve sorumlu"
                : "Yalnızca sana özel"}
            </>
          )}
        </span>
        <Button type="submit" disabled={busy}>
          {busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Plus size={15} />
          )}
          Ekle
        </Button>
      </div>
    </form>
  );
}
function TaskEditor({
  task: t,
  userId,
  data,
  busy,
  onSave,
}: {
  task: Task;
  userId: string;
  data: Workspace;
  busy: boolean;
  onSave: (
    fields: Omit<Partial<TaskPatch>, "id" | "version">,
    version?: number,
  ) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(t.title),
    [note, setNote] = useState(t.note),
    [selectedBoard, setSelectedBoard] = useState(t.board_id ?? "");
  const canEdit = t.can_edit !== false;
  const [editVersion, setEditVersion] = useState(t.version);
  const [jobQuery, setJobQuery] = useState("");
  const [jobs, setJobs] = useState(data.jobs);
  const currentBoard = data.boards.find((b) => b.id === t.board_id);
  useEffect(() => {
    if (!jobQuery) return;
    let current = true;
    const timer = setTimeout(async () => {
      const result = await searchTaskJobs(jobQuery);
      if (current && result.data) setJobs(result.data);
    }, 250);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [jobQuery]);
  const [baseline, setBaseline] = useState({
    title: t.title,
    note: t.note,
    version: t.version,
  });
  if (
    baseline.version !== t.version &&
    title === baseline.title &&
    note === baseline.note
  ) {
    setTitle(t.title);
    setNote(t.note);
    setEditVersion(t.version);
    setBaseline({ title: t.title, note: t.note, version: t.version });
  } else if (
    baseline.version !== t.version &&
    title === t.title &&
    note === t.note
  ) {
    setEditVersion(t.version);
    setBaseline({ title: t.title, note: t.note, version: t.version });
  }
  return (
    <div className="tw-task-editor">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onSave({ title, note }, editVersion))
            setEditVersion(editVersion + 1);
        }}
      >
        <textarea
          className="tw-detail-title"
          aria-label="Görev başlığını düzenle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          rows={2}
          maxLength={300}
          readOnly={!canEdit}
        />
        <div className="tw-detail-fields">
          <label>
            Sorumlu
            <Select
              label="Görev sorumlusu"
              value={t.assignee ?? ""}
              onChange={(v) => void onSave({ assignee: v || null })}
              disabled={
                busy ||
                !canEdit ||
                t.visibility === "private" ||
                (t.visibility === "direct" && t.created_by !== userId)
              }
            >
              <option value="" disabled={t.visibility === "direct"}>
                Atanmamış
              </option>
              {data.people
                .filter(
                  (p) =>
                    p.id === t.assignee ||
                    t.visibility === "job" ||
                    t.visibility === "direct" ||
                    (t.visibility === "private" && p.id === t.created_by) ||
                    (currentBoard?.team_id &&
                      (data.members.some(
                        (m) =>
                          m.team_id === currentBoard.team_id &&
                          m.user_id === p.id,
                      ) ||
                        data.teams.some(
                          (team) =>
                            team.id === currentBoard.team_id &&
                            team.owner_id === p.id,
                        ))),
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
            </Select>
          </label>
          <label>
            Termin
            <input
              aria-label="Görev termini"
              type="date"
              value={t.due_date ?? ""}
              disabled={busy || !canEdit}
              onChange={(e) =>
                void onSave({ due_date: e.target.value || null })
              }
            />
          </label>
          <label>
            Durum
            <Select
              label="Görev durumu"
              value={t.status}
              onChange={(v) => void onSave({ status: v as Task["status"] })}
              disabled={busy || !canEdit || t.kind === "note"}
            >
              {Object.entries(statuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Öncelik
            <Select
              label="Görev önceliği"
              value={t.priority}
              onChange={(v) => void onSave({ priority: v as Task["priority"] })}
              disabled={busy || !canEdit}
            >
              {Object.entries(priorities).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </label>
          <label>
            İş kodu
            <span className="tw-job-picker">
              <input
                aria-label="Görev için iş kodu ara"
                placeholder="İş kodu ara"
                value={jobQuery}
                onChange={(e) => setJobQuery(e.target.value)}
                disabled={busy || !canEdit}
              />
              <Select
                label="Görevin iş kodu"
                value={t.job_id ?? ""}
                onChange={(v) => void onSave({ job_id: v || null })}
                disabled={busy || !canEdit}
              >
                <option value="" disabled={t.visibility === "job"}>
                  İş seçilmedi
                </option>
                {t.job_id && !jobs.some((j) => j.id === t.job_id) && (
                  <option value={t.job_id}>{t.job_no || "Bağlı iş"}</option>
                )}
                {jobs.map((j) => (
                  <option value={j.id} key={j.id}>
                    {j.job_no}
                  </option>
                ))}
              </Select>
            </span>
          </label>
          <label>
            Hedef
            <Select
              label="Bağlı hedef"
              value={t.goal_id ?? ""}
              onChange={(v) => void onSave({ goal_id: v || null })}
              disabled={busy || !canEdit || t.kind !== "task"}
            >
              <option value="">Hedef seçilmedi</option>
              {(data.goals ?? data.tasks)
                .filter(
                  (g) =>
                    g.kind === "goal" &&
                    g.board_id === t.board_id &&
                    g.visibility === t.visibility,
                )
                .map((g) => (
                  <option value={g.id} key={g.id}>
                    {g.title}
                  </option>
                ))}
            </Select>
          </label>
        </div>
        {editVersion !== t.version && (
          <details className="tw-conflict" open>
            <summary>Görev değişti. Taslağın korunuyor.</summary>
            <p>
              Güncel başlık: <strong>{t.title}</strong>
            </p>
            <p className="tw-conflict-note">
              {t.note || "Güncel açıklama boş."}
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditVersion(t.version);
                setBaseline({
                  title: t.title,
                  note: t.note,
                  version: t.version,
                });
              }}
            >
              Gözden geçirdim, taslağımı kullan
            </Button>
          </details>
        )}
        <label className="tw-description-label">
          Açıklama
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            maxLength={20000}
            readOnly={!canEdit}
            placeholder="Bu işi tamamlamak için bilinmesi gerekenler"
          />
        </label>
        {canEdit && (title !== t.title || note !== t.note) && (
          <Button type="submit" disabled={busy || editVersion !== t.version}>
            Değişiklikleri kaydet
          </Button>
        )}
      </form>
      {canEdit && t.created_by === userId && (
        <details className="tw-sharing">
          <summary>Pano ve paylaşım</summary>
          <p>
            Ekibe taşıdığında görev içeriği, yorumlar ve ekler o ekip tarafından
            görülebilir.
          </p>
          <select
            aria-label="Hedef pano"
            value={selectedBoard}
            onChange={(e) => setSelectedBoard(e.target.value)}
          >
            <option value="" disabled={t.visibility === "team"}>
              Bana özel
            </option>
            {data.boards
              .filter(
                (b) =>
                  b.can_edit !== false &&
                  !b.archived_at &&
                  (t.visibility !== "team" || !!b.team_id),
              )
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.team_id ? "Ekip" : "Özel"}
                </option>
              ))}
          </select>
          <Button
            variant="outline"
            disabled={busy || selectedBoard === (t.board_id ?? "")}
            onClick={() => {
              const b = data.boards.find((b) => b.id === selectedBoard);
              const member =
                !b?.team_id ||
                !t.assignee ||
                data.members.some(
                  (m) => m.team_id === b.team_id && m.user_id === t.assignee,
                );
              if (
                b?.team_id &&
                !window.confirm(
                  `Görev, yorumlar ve ekler seçilen ekibe açılacak.${member ? "" : " Mevcut sorumlu bu ekipte değil; görev atamasız havuzuna taşınacak."} Devam edilsin mi?`,
                )
              )
                return;
              void onSave({
                board_id: selectedBoard || null,
                visibility: b?.team_id ? "team" : "private",
                goal_id: null,
                assignee: b?.team_id
                  ? member
                    ? t.assignee
                    : null
                  : t.created_by,
              });
            }}
          >
            Taşı ve paylaşımı güncelle
          </Button>
          {t.kind === "note" && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void onSave({ kind: "task" })}
            >
              Göreve dönüştür
            </Button>
          )}
        </details>
      )}
    </div>
  );
}
