"use client";

// YAPILACAKLARIM — kişisel, işe bağlı olmayan maddeler (Notion tarzı hızlı
// liste). Yalnız sahibine görünür; RLS kelepçesi migration'da.
//
// HIZLI EKLEME kutusu her zaman durur (boş durumda da — girdisi olan bir
// bölüm gizlenmez, aksi hâlde özellik keşfedilemezdi). Tarih İSTEĞE BAĞLIDIR:
// kutunun yanındaki tarih alanı boş bırakılabilir; satır menüsünde Bugün /
// Yarın kısayolları ve kaldırma vardır — takvim penceresi açılmaz.
//
// Optimistik güncelleme YOK (ev sadeliği): eylem biter, `router.refresh()`
// sunucu listesini tazeler.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Ellipsis, Plus } from "lucide-react";
import { fmtJobDate } from "@/lib/jobs/filter";
import type { TodoRow } from "@/lib/todos";
import {
  createTodo,
  deleteTodo,
  setTodoDueDate,
  toggleTodo,
} from "../todo-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Baslik } from "./section-frame";

/** "YYYY-MM-DD" + n gün — saat dilimi taşımadan. */
function gunEkle(iso: string, gun: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

function TodoSatiri({
  todo,
  today,
}: {
  todo: TodoRow;
  today: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const bitti = !!todo.doneAt;
  const gec = !bitti && !!todo.dueDate && todo.dueDate < today;

  function calistir(islem: () => Promise<{ error?: string }>, mesaj?: string) {
    startTransition(async () => {
      const res = await islem();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (mesaj) toast.success(mesaj);
      router.refresh();
    });
  }

  return (
    <li className="flex items-start gap-3 px-3 py-2 pointer-coarse:py-2.5">
      <button
        type="button"
        disabled={pending}
        aria-label={bitti ? `Yeniden aç: ${todo.title}` : `Tamamla: ${todo.title}`}
        onClick={() => calistir(() => toggleTodo(todo.id, !bitti))}
        className={cn(
          "oc-tap-square mt-0.5 grid size-5 shrink-0 place-items-center border transition-colors",
          bitti
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border hover:border-primary"
        )}
      >
        {bitti && <Check className="size-3.5" />}
      </button>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm break-words",
            bitti && "text-muted-foreground line-through"
          )}
        >
          {todo.title}
        </span>
        {todo.dueDate && !bitti && (
          <span
            className={cn(
              "mt-0.5 block font-mono text-[11px] tabular-nums",
              gec
                ? "font-semibold text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            )}
          >
            {fmtJobDate(todo.dueDate)}
            {gec && " · gecikti"}
          </span>
        )}
      </span>

      {!bitti && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Madde menüsü: ${todo.title}`}
              className="oc-tap-square grid size-6 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Ellipsis className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => calistir(() => setTodoDueDate(todo.id, today))}
            >
              Vade: Bugün
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                calistir(() => setTodoDueDate(todo.id, gunEkle(today, 1)))
              }
            >
              Vade: Yarın
            </DropdownMenuItem>
            {todo.dueDate && (
              <DropdownMenuItem
                onSelect={() => calistir(() => setTodoDueDate(todo.id, null))}
              >
                Vadeyi Kaldır
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                calistir(() => deleteTodo(todo.id), "Madde silindi.")
              }
            >
              Sil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

export function TodoWidget({
  acik,
  tamamlanan,
  today,
}: {
  acik: TodoRow[];
  tamamlanan: TodoRow[];
  today: string;
}) {
  const [baslik, setBaslik] = useState("");
  const [vade, setVade] = useState("");
  const [tamamGoster, setTamamGoster] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function ekle() {
    const temiz = baslik.trim();
    if (!temiz) return;
    startTransition(async () => {
      const res = await createTodo({ title: temiz, dueDate: vade || null });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setBaslik("");
      setVade("");
      router.refresh();
    });
  }

  return (
    <section>
      <Baslik>
        Yapılacaklarım
        {acik.length > 0 && (
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">
            {acik.length} açık
          </span>
        )}
      </Baslik>

      <div className="border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ekle();
          }}
          className="flex items-stretch gap-0 border-b"
        >
          <input
            value={baslik}
            onChange={(e) => setBaslik(e.target.value)}
            placeholder="Yeni madde — Enter ile ekleyin"
            aria-label="Yeni yapılacak madde"
            maxLength={300}
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground/70 pointer-fine:text-sm"
          />
          <input
            type="date"
            value={vade}
            onChange={(e) => setVade(e.target.value)}
            aria-label="Vade (isteğe bağlı)"
            className="h-11 w-[8.5rem] shrink-0 border-l bg-transparent px-2 font-mono text-base text-muted-foreground outline-none pointer-fine:text-sm"
          />
          <button
            type="submit"
            disabled={pending || !baslik.trim()}
            aria-label="Madde ekle"
            className="grid w-11 shrink-0 place-items-center border-l text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </form>

        {acik.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {tamamlanan.length === 0
              ? "İlk maddenizi yazın — bu liste yalnız size görünür, işe bağlanmaz."
              : "Açık madde kalmadı."}
          </p>
        ) : (
          <ul className="divide-y">
            {acik.map((t) => (
              <TodoSatiri key={t.id} todo={t} today={today} />
            ))}
          </ul>
        )}
      </div>

      {tamamlanan.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setTamamGoster((v) => !v)}
            aria-expanded={tamamGoster}
            className="text-[12px] text-muted-foreground hover:text-foreground hover:underline pointer-coarse:py-2"
          >
            Son 7 günde tamamlanan {tamamlanan.length} madde
            {tamamGoster ? " — gizle" : " — göster"}
          </button>
          {tamamGoster && (
            <ul className="mt-1 divide-y border">
              {tamamlanan.map((t) => (
                <TodoSatiri key={t.id} todo={t} today={today} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
