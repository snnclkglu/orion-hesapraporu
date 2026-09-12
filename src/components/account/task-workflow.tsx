"use client";
import { useEffect, useState } from "react";
import { CheckCheck, Repeat2, Link2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Task, TaskFlow, WorkflowInput } from "@/lib/tasks/model";
import {
  loadTaskFlow,
  searchDependencyTasks,
} from "@/app/(app)/panel/workspace-actions";

const templates: Record<string, string[]> = {
  drawing: [
    "Resim numarası ve revizyonu kontrol et",
    "Ölçü ve toleransları kontrol et",
    "Malzeme ve adetleri doğrula",
    "Kontrol sonucunu paylaş",
  ],
  handoff: [
    "İş kapsamını doğrula",
    "Açık konuları not et",
    "İlgili dosyaları ekle",
    "Teslim alan kişiyle teyitleş",
  ],
};
type Candidate = Pick<
  Task,
  | "id"
  | "title"
  | "status"
  | "visibility"
  | "board_id"
  | "created_by"
  | "assignee"
  | "job_id"
>;
export function TaskWorkflow({
  task,
  busy,
  preview,
  candidates,
  onSave,
  onOpen,
}: {
  task: Task;
  busy: boolean;
  preview: boolean;
  candidates: Task[];
  onSave: (input: WorkflowInput) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const [flow, setFlow] = useState<TaskFlow>({
    waiting_for: [],
    next_task: null,
  });
  const [flowError, setFlowError] = useState("");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [mode, setMode] = useState(task.recurrence?.mode ?? "");
  const [interval, setInterval] = useState(
    String(task.recurrence?.interval ?? 1),
  );
  const [saving, setSaving] = useState(false);
  const [ruleVersion, setRuleVersion] = useState<number | null>(null);
  const disabled = busy || saving || task.can_edit === false;
  useEffect(() => {
    if (preview) return;
    let active = true;
    loadTaskFlow(task.id)
      .then((r) => {
        if (active) {
          if (r.data) {
            setFlow(r.data);
            setFlowError("");
          } else setFlowError(r.error ?? "Akış okunamadı");
        }
      })
      .catch(() => {
        if (active) setFlowError("Akış okunamadı. Görevi yeniden açın.");
      });
    return () => {
      active = false;
    };
  }, [task.id, task.version, preview]);
  useEffect(() => {
    if (!query.trim()) return;
    let active = true;
    const timer = setTimeout(() => {
      if (preview) {
        setResults(
          candidates.filter((t) =>
            t.title
              .toLocaleLowerCase("tr")
              .includes(query.toLocaleLowerCase("tr")),
          ),
        );
        return;
      }
      searchDependencyTasks(query)
        .then((r) => {
          if (active) {
            setResults(r.data ?? []);
            if (r.error) toast.error(r.error);
          }
        })
        .catch(() => {
          if (active) toast.error("Görev araması tamamlanamadı");
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, preview, candidates]);
  async function save(fields: Omit<WorkflowInput, "id" | "version">) {
    if (disabled) return false;
    setSaving(true);
    try {
      const ok = await onSave({
        id: task.id,
        version:
          fields.recurrence !== undefined
            ? (ruleVersion ?? task.version)
            : task.version,
        ...fields,
      });
      if (ok && fields.recurrence !== undefined) setRuleVersion(null);
      return ok;
    } finally {
      setSaving(false);
    }
  }
  const items = task.checklist ?? [];
  const allowed = results.filter(
    (t) =>
      t.id !== task.id &&
      !flow.waiting_for.some((w) => w.id === t.id) &&
      t.visibility === task.visibility &&
      t.board_id === task.board_id &&
      (task.visibility !== "job" || t.job_id === task.job_id) &&
      (!["private", "direct"].includes(task.visibility) ||
        (t.created_by === task.created_by && t.assignee === task.assignee)),
  );
  return (
    <section className="tw-workflow" aria-label="Görev akışı">
      <details open={items.length > 0}>
        <summary>
          <CheckCheck size={17} /> Kontrol listesi{" "}
          <span>
            {items.filter((i) => i.done).length}/{items.length}
          </span>
        </summary>
        {items.map((item) => (
          <div className="tw-check-item" key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={item.done}
                disabled={disabled}
                onChange={() =>
                  void save({
                    checklist: items.map((i) =>
                      i.id === item.id ? { ...i, done: !i.done } : i,
                    ),
                  })
                }
              />
              <span>{item.text}</span>
            </label>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={`${item.text}: kaldır`}
              onClick={() =>
                void save({ checklist: items.filter((i) => i.id !== item.id) })
              }
            >
              <X size={15} />
            </Button>
          </div>
        ))}
        {task.can_edit !== false && (
          <>
            <form
              className="tw-flow-add"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  text.trim() &&
                  (await save({
                    checklist: [
                      ...items,
                      {
                        id: crypto.randomUUID(),
                        text: text.trim(),
                        done: false,
                      },
                    ],
                  }))
                )
                  setText("");
              }}
            >
              <Input
                aria-label="Yeni kontrol adımı"
                placeholder="Kontrol adımı ekle"
                maxLength={180}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={disabled || items.length >= 30}
              />
              <Button
                aria-label="Kontrol adımını ekle"
                disabled={disabled || !text.trim() || items.length >= 30}
                size="icon"
              >
                <Plus size={17} />
              </Button>
            </form>
            {!items.length && (
              <label className="tw-flow-field">
                Şablonla başla
                <select
                  disabled={disabled}
                  value=""
                  onChange={(e) => {
                    const steps = templates[e.target.value];
                    if (steps)
                      void save({
                        checklist: steps.map((text) => ({
                          id: crypto.randomUUID(),
                          text,
                          done: false,
                        })),
                      });
                  }}
                >
                  <option value="">Şablon seç</option>
                  <option value="drawing">Çizim kontrolü</option>
                  <option value="handoff">İş teslimi</option>
                </select>
              </label>
            )}
          </>
        )}
      </details>
      {task.kind === "task" && (
        <details>
          <summary>
            <Repeat2 size={17} /> Tekrar{" "}
            <span>{task.recurrence ? "Açık" : "Yok"}</span>
          </summary>
          <p>
            Tamamlandığında yeni görev açılır. Yorumlar ve dosyalar eski görevde
            kalır.
          </p>
          <label className="tw-flow-field">
            Tekrar düzeni
            <select
              aria-label="Tekrar düzeni"
              value={mode}
              disabled={disabled}
              onChange={(e) => {
                setRuleVersion((v) => v ?? task.version);
                setMode(e.target.value);
              }}
            >
              <option value="">Tekrarlama</option>
              <option value="weekly">Termin tarihinden, haftalık</option>
              <option value="monthly">Termin tarihinden, aylık</option>
              <option value="after">Tamamlanmadan sonra, gün</option>
            </select>
          </label>
          {mode && (
            <label className="tw-flow-field">
              Aralık
              <Input
                type="number"
                min={1}
                max={52}
                value={interval}
                onChange={(e) => {
                  setRuleVersion((v) => v ?? task.version);
                  setInterval(e.target.value);
                }}
                disabled={disabled}
              />
            </label>
          )}
          {!task.due_date && mode && (
            <p role="status">Önce görev için bir termin seçin.</p>
          )}
          {ruleVersion !== null && ruleVersion !== task.version && (
            <p role="alert">
              Görev değişti. Güncel tekrar ayarını görmek için görevi kapatıp
              yeniden açın.
            </p>
          )}
          <Button
            variant="outline"
            disabled={
              disabled ||
              (!!mode &&
                (!task.due_date ||
                  !Number.isInteger(Number(interval)) ||
                  Number(interval) < 1 ||
                  Number(interval) > 52))
            }
            onClick={async () => {
              if (
                await save({
                  recurrence: mode
                    ? {
                        mode: mode as "weekly" | "monthly" | "after",
                        interval: Number(interval),
                      }
                    : null,
                })
              )
                toast.success("Tekrar ayarı kaydedildi");
            }}
          >
            Tekrarı kaydet
          </Button>
          {flow.next_task && (
            <Button variant="ghost" onClick={() => onOpen(flow.next_task!)}>
              Sonraki görevi aç
            </Button>
          )}
          {task.status === "done" &&
            task.recurrence &&
            !flow.next_task &&
            !preview && (
              <p>
                Sonraki görev görünmüyor. Pano arşivini ve ekip erişimini
                kontrol edin.
              </p>
            )}
        </details>
      )}
      <details>
        <summary>
          <Link2 size={17} /> Şunu bekliyor{" "}
          <span>{flow.waiting_for.length || "Yok"}</span>
        </summary>
        <p>
          Aynı paylaşım kapsamındaki görevler bağlanabilir. Ön koşullar
          tamamlanınca bu görev kapatılabilir.
        </p>
        {flowError ? (
          <p role="alert">{flowError}</p>
        ) : (
          <>
            {flow.waiting_for.map((w) => (
              <div className="tw-check-item" key={w.id}>
                <button className="oc-tap" onClick={() => onOpen(w.id)}>
                  {w.status === "done" ? "✓ " : "○ "}
                  {w.title}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  aria-label={`${w.title}: bağlantıyı kaldır`}
                  onClick={async () => {
                    const list = flow.waiting_for.filter((i) => i.id !== w.id);
                    if (await save({ waiting_for: list.map((i) => i.id) }))
                      setFlow((f) => ({ ...f, waiting_for: list }));
                  }}
                >
                  <X size={15} />
                </Button>
              </div>
            ))}
            {task.can_edit !== false && (
              <Input
                aria-label="Beklenen görevi ara"
                placeholder="Görev ara"
                value={query}
                maxLength={100}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setResults([]);
                }}
                disabled={disabled || flow.waiting_for.length >= 10}
              />
            )}
            {query.trim() && (
              <div className="tw-flow-results">
                {allowed.map((t) => (
                  <button
                    className="oc-tap"
                    key={t.id}
                    disabled={disabled}
                    onClick={async () => {
                      if (
                        await save({
                          waiting_for: [
                            ...flow.waiting_for.map((i) => i.id),
                            t.id,
                          ],
                        })
                      ) {
                        setFlow((f) => ({
                          ...f,
                          waiting_for: [...f.waiting_for, t],
                        }));
                        setQuery("");
                      }
                    }}
                  >
                    {t.title}
                  </button>
                ))}
                {!allowed.length && (
                  <p>Uygun görev bulunamadı. Aramayı daraltabilirsiniz.</p>
                )}
              </div>
            )}
          </>
        )}
      </details>
    </section>
  );
}
