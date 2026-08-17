"use client";

// Görev listesi — hızlı giriş + açık/kapalı ayrımı + düzenleme penceresi.
//
// HIZLI GİRİŞ TEK ALANDIR (başlık + Ekle): atama, termin ve kalem detaydır
// ve pencerede durur — beş alanlı bir satır formu günlük kullanımda hızlı
// girişi öldürürdü (İş Takibi'nin "tekrar hedeflenir" dersi).
//
// KAPALI GÖREVLER LİSTEyi TERK ETMEZ, katlanır: silinmemiş iş görünür kalır
// (arşiv kuralı) ama açık işin önünü kesmez.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  ClipboardList,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  addTemplateTasks,
  createTask,
  deleteTask,
  toggleTask,
  updateTask,
} from "../../hub-actions";
import type { TaskInput } from "../../../hub-schema";
import { fmtJobDate } from "@/lib/jobs/filter";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export interface TaskRow {
  id: string;
  title: string;
  note: string;
  itemNo: string;
  assigneeId: string | null;
  assigneeName: string;
  dueDate: string | null;
  doneAt: string | null;
  doneByName: string;
  createdBy: string;
}

export interface TaskPerson {
  id: string;
  fullName: string;
  title: string;
}

/** Radix Select boş dizge kabul etmez — "yok" atanmamış demektir. */
const YOK = "yok";

function bugunISO(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Gecikme yalnız AÇIK görevde anlamlıdır (RESIM-18'in termin kuralı). */
function gecikti(t: TaskRow): boolean {
  return !t.doneAt && !!t.dueDate && t.dueDate < bugunISO();
}

function TaskDialog({
  jobId,
  task,
  people,
  itemNos,
  open,
  onOpenChange,
}: {
  jobId: string;
  task: TaskRow;
  people: TaskPerson[];
  itemNos: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [assignee, setAssignee] = useState(task.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [itemNo, setItemNo] = useState(task.itemNo || YOK);

  function kaydet() {
    const input: TaskInput = {
      title,
      note,
      assignee: assignee || null,
      due_date: dueDate || null,
      item_no: itemNo === YOK ? "" : itemNo,
    };
    startTransition(async () => {
      const res = await updateTask(jobId, task.id, input);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Görev güncellendi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Görevi Düzenle</DialogTitle>
          <DialogDescription className="sr-only">
            Görev başlığı, notu, atanan kişi, termin ve kalem bağlamı.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="gorev-baslik">Görev</Label>
            <Input
              id="gorev-baslik"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gorev-not">Not</Label>
            <Textarea
              id="gorev-not"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Atanan</Label>
              <Combobox
                options={[
                  { value: "", label: "Atanmadı" },
                  ...people.map((p) => ({
                    value: p.id,
                    label: p.fullName,
                    hint: p.title || undefined,
                  })),
                ]}
                value={assignee}
                onChange={setAssignee}
                placeholder="Atanmadı"
                searchPlaceholder="Kişi ara…"
                emptyText="Kişi bulunamadı"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gorev-termin">Termin</Label>
              <Input
                id="gorev-termin"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          {itemNos.length > 0 && (
            <div className="grid gap-1.5">
              <Label>İş Kalemi</Label>
              <Select value={itemNo} onValueChange={setItemNo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={YOK}>Kalem bağlamı yok</SelectItem>
                  {itemNos.map((no) => (
                    <SelectItem key={no} value={no}>
                      <span className="font-mono">{no}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="button" onClick={kaydet} disabled={pending || !title.trim()}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskItem({
  jobId,
  task,
  people,
  itemNos,
  canDelete,
}: {
  jobId: string;
  task: TaskRow;
  people: TaskPerson[];
  itemNos: string[];
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const done = !!task.doneAt;

  function toggle() {
    startTransition(async () => {
      const res = await toggleTask(jobId, task.id, !done);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  function sil() {
    startTransition(async () => {
      const res = await deleteTask(jobId, task.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Görev silindi.");
      router.refresh();
    });
  }

  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      {/* Kare onay kutusu — CokluSuzgec'in işaret diliyle aynı. */}
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={done ? "Görevi yeniden aç" : "Görevi tamamla"}
        className={cn(
          "oc-tap-square mt-0.5 grid size-5 shrink-0 place-items-center border transition-colors",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border hover:border-primary"
        )}
      >
        {done && <Check className="size-3.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm break-words",
            done && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </p>
        {task.note && (
          <p className="mt-0.5 text-xs break-words whitespace-pre-line text-muted-foreground">
            {task.note}
          </p>
        )}
        <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
          {task.itemNo && <span className="font-mono">{task.itemNo}</span>}
          {task.dueDate && (
            <span
              className={cn(
                "font-mono tabular-nums",
                gecikti(task) && "font-semibold text-amber-600 dark:text-amber-400"
              )}
            >
              {fmtJobDate(task.dueDate)}
              {gecikti(task) && " · gecikti"}
            </span>
          )}
          {task.assigneeName && <span>{task.assigneeName}</span>}
          {done && task.doneByName && <span>kapatan: {task.doneByName}</span>}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Görev Eylemleri</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="size-3.5" /> Düzenle
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={sil}>
                <Trash2 className="size-3.5" /> Sil
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {editing && (
        <TaskDialog
          jobId={jobId}
          task={task}
          people={people}
          itemNos={itemNos}
          open
          onOpenChange={(o) => !o && setEditing(false)}
        />
      )}
    </li>
  );
}

export function TaskList({
  jobId,
  tasks,
  people,
  itemNos,
  sablonSayisi,
  meId,
  isAdmin,
}: {
  jobId: string;
  tasks: TaskRow[];
  people: TaskPerson[];
  itemNos: string[];
  sablonSayisi: number;
  meId: string;
  isAdmin: boolean;
}) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const [kapaliAcik, setKapaliAcik] = useState(false);
  const router = useRouter();

  const acik = useMemo(() => tasks.filter((t) => !t.doneAt), [tasks]);
  const kapali = useMemo(() => tasks.filter((t) => !!t.doneAt), [tasks]);

  function ekle() {
    const v = title.trim();
    if (!v) return;
    startTransition(async () => {
      const res = await createTask(jobId, {
        title: v,
        note: "",
        assignee: null,
        due_date: null,
        item_no: "",
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setTitle("");
      router.refresh();
    });
  }

  function sablondanEkle() {
    startTransition(async () => {
      const res = await addTemplateTasks(jobId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Şablon görevleri eklendi.");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3">
      {/* Hızlı giriş: başlık + Ekle. Detay (atama · termin · kalem · not)
          satırın Düzenle penceresindedir. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ekle();
          }}
          placeholder="Yeni görev yazın…"
          className="min-w-[12rem] flex-1"
        />
        <Button type="button" onClick={ekle} disabled={pending || !title.trim()}>
          Ekle
        </Button>
        {sablonSayisi > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={sablondanEkle}
            disabled={pending}
          >
            <ClipboardList className="size-3.5" /> Şablondan Ekle ({sablonSayisi})
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="HENÜZ GÖREV YOK"
          description="İlk görevi yukarıdan ekleyin; görevler kişiye atanır, termin alır ve kapatılınca akışa düşer."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
            <span className="text-sm font-semibold">Açık Görevler</span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {acik.length} açık · {kapali.length} tamamlandı
            </span>
          </div>
          {acik.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              Açık görev kalmadı.
            </p>
          ) : (
            <ul className="divide-y">
              {acik.map((t) => (
                <TaskItem
                  key={t.id}
                  jobId={jobId}
                  task={t}
                  people={people}
                  itemNos={itemNos}
                  canDelete={isAdmin || t.createdBy === meId}
                />
              ))}
            </ul>
          )}

          {kapali.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setKapaliAcik((v) => !v)}
                className="oc-tap flex w-full items-center justify-between border-t bg-muted/30 px-4 py-2 text-left text-sm text-muted-foreground hover:text-foreground"
              >
                <span>Tamamlananlar ({kapali.length})</span>
                <span className="font-mono text-[11px]">{kapaliAcik ? "−" : "+"}</span>
              </button>
              {kapaliAcik && (
                <ul className="divide-y border-t">
                  {kapali.map((t) => (
                    <TaskItem
                      key={t.id}
                      jobId={jobId}
                      task={t}
                      people={people}
                      itemNos={itemNos}
                      canDelete={isAdmin || t.createdBy === meId}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
