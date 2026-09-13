"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Save,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { adBuyuk } from "@/lib/tr-text";
import {
  DRAWING_PLAN_STATUSES,
  drawingPlanProgress,
  fullDrawingNo,
  type DrawingPlanRow,
  type DrawingAuthor,
} from "@/lib/drawing-plan";
import {
  emptyDrawingPlanState,
  type DrawingDerivation,
  type DrawingPlanDocument,
  type DrawingCandidate,
} from "@/lib/drawing-plan/types";
import {
  orderedDrawingPlan,
  moveDrawingRow,
  drawingDescendants,
  removeDrawingGroup,
} from "@/lib/drawing-plan/presentation";
import { reconcileDrawingPlan } from "@/lib/drawing-plan/reconcile";
import {
  candidateCode,
  renumberDrawingPlan,
  numberingError,
} from "@/lib/drawing-plan/numbering";
import { getDrawingPlanEditor, saveDrawingPlan } from "./drawing-plan-actions";

const field =
  "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-base";
function SortableRow({
  row,
  disabled,
  children,
}: {
  row: DrawingPlanRow;
  disabled: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: row.id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex min-w-0 gap-1 rounded-lg border bg-card p-2"
    >
      <button
        type="button"
        className="oc-tap size-8 shrink-0 self-start touch-none rounded text-muted-foreground disabled:opacity-30"
        aria-label={`${row.name} grubunu sürükle`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="mx-auto size-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function DrawingPlanCard({
  projectId,
  itemNo,
  initialRows,
  authors,
  canEdit,
  previewDerivation,
  previewDocument,
}: {
  projectId: string;
  itemNo: string | null;
  initialRows: DrawingPlanRow[];
  authors: DrawingAuthor[];
  canEdit: boolean;
  previewDerivation?: DrawingDerivation;
  previewDocument?: DrawingPlanDocument;
}) {
  const demo = projectId === "dev";
  const initial = previewDocument ?? {
    rows: initialRows,
    state: emptyDrawingPlanState(),
  };
  const [saved, setSaved] = useState(initial);
  const [rows, setRows] = useState(initial.rows);
  const [numbering, setNumbering] = useState(initial.state.numbering);
  const [revisionId, setRevisionId] = useState<string | null>(
    initial.state.sourceRevisionId,
  );
  const [sourceChanged, setSourceChanged] = useState(false);
  const [revisions, setRevisions] = useState<{ id: string; label: string }[]>(
    [],
  );
  const [derivation, setDerivation] = useState<DrawingDerivation | null>(
    previewDerivation ?? null,
  );
  const [ready, setReady] = useState(demo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<DrawingPlanRow[][]>([]);
  const [preview, setPreview] = useState<{
    title: string;
    rows: DrawingPlanRow[];
  } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [numberOpen, setNumberOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    if (demo) return;
    let live = true;
    getDrawingPlanEditor(projectId).then((result) => {
      if (!live) return;
      if (result.error || !result.document) {
        setError(result.error ?? "Plan okunamadı.");
        return;
      }
      setSaved(result.document);
      setRows(result.document.rows);
      setNumbering(result.document.state.numbering);
      setRevisionId(result.revisionId ?? null);
      setRevisions(result.revisions ?? []);
      setDerivation(result.derivation ?? null);
      setReady(true);
    }).catch(() => {
      if (live) setError("Plan yüklenemedi. Bağlantınızı kontrol edip sayfayı yeniden açın.");
    });
    return () => {
      live = false;
    };
  }, [projectId, demo]);
  const dirty =
    canEdit &&
    ready &&
    (JSON.stringify(rows) !== JSON.stringify(saved.rows) ||
      JSON.stringify(numbering) !== JSON.stringify(saved.state.numbering) ||
      (sourceChanged && revisionId !== saved.state.sourceRevisionId));
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const leave = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        target &&
        !target.closest("[data-drawing-editor]") &&
        !window.confirm(
          "Kaydedilmemiş resim planı değişiklikleri var. Ayrılmak istiyor musunuz?",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty]);
  const editable = canEdit && ready && !busy;
  const ordered = orderedDrawingPlan(rows);
  const progress = drawingPlanProgress(ordered.map((x) => x.row));
  const displayed = ordered.filter(
    ({ row }) =>
      ![...collapsed].some(
        (id) => id !== row.id && drawingDescendants(rows, id).has(row.id),
      ),
  );
  const candidates = derivation?.candidates ?? [];
  const changes = derivation
    ? reconcileDrawingPlan(rows, candidates, numbering).changes
    : [];
  const choices = candidates.filter(
    (c) => !rows.some((r) => r.sourceKey === c.key),
  );
  function replace(next: DrawingPlanRow[]) {
    setHistory((h) => [...h.slice(-19), rows]);
    setRows(next);
    setError("");
  }
  function patch(
    id: string,
    values: Partial<DrawingPlanRow>,
    override?: "name" | "code" | "parentId",
  ) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              ...values,
              overrides: override
                ? [...new Set([...(row.overrides ?? []), override])]
                : row.overrides,
            }
          : row,
      ),
    );
  }
  function add(candidate?: DrawingCandidate, parentId: string | null = null) {
    if (rows.length >= 120) {
      setError("En fazla 120 satır saklanabilir.");
      return;
    }
    const parent = candidate?.parentKey
      ? rows.find((r) => r.sourceKey === candidate.parentKey && !r.suppressed)
      : rows.find((r) => r.id === parentId);
    if (candidate?.parentKey && !parent) {
      setError("Önce üst montajı ekleyin.");
      return;
    }
    const fallback: DrawingCandidate = {
      key: "manual",
      name: "",
      reason: "",
      parentKey: parent?.sourceKey ?? null,
      block:
        candidates.find((c) => c.key === parent?.sourceKey)?.block ?? "general",
    };
    const code = candidateCode(
      candidate ?? fallback,
      new Set(rows.map((r) => r.code)),
      numbering,
    );
    if (!code) {
      setError("Numara alanı dolu. Numara düzenini genişletin.");
      return;
    }
    replace([
      ...rows,
      {
        id: crypto.randomUUID(),
        code,
        name: candidate?.name ?? "",
        status: "bekliyor",
        drawnBy: null,
        drawnByName: "",
        note: "",
        parentId: parent?.id ?? null,
        sortOrder:
          Math.max(0, ...rows.map((r) => r.sortOrder ?? Number(r.code))) + 1,
        sourceKey: candidate?.key ?? null,
        origin: candidate ? "auto" : "manual",
        overrides: candidate ? [] : ["code"],
        generated: candidate
          ? { name: candidate.name, parentKey: candidate.parentKey, code }
          : null,
        reason: candidate?.reason ?? "Mühendis tarafından eklendi.",
      },
    ]);
  }
  function dragEnd(event: DragEndEvent) {
    const source = rows.find((r) => r.id === event.active.id),
      target = rows.find((r) => r.id === event.over?.id);
    if (!source || !target || source.id === target.id) return;
    if ((source.parentId ?? null) !== (target.parentId ?? null)) {
      toast.info(
        "Montaj değiştirmek için satırın Üst montaj alanını kullanın.",
      );
      return;
    }
    const siblings = ordered
      .map((x) => x.row)
      .filter((r) => (r.parentId ?? null) === (source.parentId ?? null));
    const from = siblings.indexOf(source),
      to = siblings.indexOf(target);
    siblings.splice(from, 1);
    siblings.splice(to, 0, source);
    replace(
      rows.map((r) => {
        const index = siblings.findIndex((s) => s.id === r.id);
        return index < 0
          ? r
          : {
              ...r,
              sortOrder: index,
              overrides: [
                ...new Set([...(r.overrides ?? []), "sortOrder" as const]),
              ],
            };
      }),
    );
  }
  function remove(keepChildren: boolean) {
    if (!deleting) return;
    replace(removeDrawingGroup(rows, deleting, keepChildren));
    setDeleting(null);
  }
  function compare() {
    const invalid = numberingError(numbering);
    if (invalid) {
      setError(invalid);
      return;
    }
    const result = reconcileDrawingPlan(rows, candidates, numbering, {
      applyChanges: true,
      allowExisting: true,
    });
    const blocked = result.changes.find((c) => c.kind === "space");
    if (blocked) {
      setError(blocked.message);
      return;
    }
    setPreview({ title: "Hesaptan gelen değişiklikler", rows: result.rows });
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (demo) {
        setSaved({
          rows,
          state: {
            ...saved.state,
            numbering,
            sourceRevisionId: revisionId,
            version: saved.state.version + 1,
          },
        });
        setHistory([]);
        toast.success("Önizleme taslağı kaydedildi.");
        return;
      }
      const result = await saveDrawingPlan(
        projectId,
        rows,
        saved.state.version,
        revisionId,
        numbering,
      );
      if (result.error || !result.document) {
        setError(result.error ?? "Kaydedilemedi.");
        return;
      }
      setSaved(result.document);
      setRows(result.document.rows);
      setSourceChanged(false);
      setHistory([]);
      toast.success("Teknik resim planı kaydedildi.");
    } catch {
      setError(
        "Bağlantı kurulamadı; taslağınız korundu. Tekrar kaydedebilirsiniz.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      data-drawing-editor
      className="min-w-0 space-y-4 rounded-xl border bg-card p-3 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Teknik Resim Takibi</h2>
          <p className="text-sm text-muted-foreground">
            {progress.total} grup · {progress.done} tamamlandı · %
            {progress.percent} · Sürüm {saved.state.version}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sıralama numarayı değiştirmez. Kaydedilen liste teknik özetin sonuna
            eklenir.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!editable || !history.length}
              onClick={() => {
                setRows(history[history.length - 1]);
                setHistory(history.slice(0, -1));
              }}
            >
              <Undo2 className="size-4" />
              Geri al
            </Button>
            <Button disabled={!editable || !dirty} onClick={save}>
              <Save className="size-4" />
              {busy ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>
        )}
      </div>
      {saved.state.sourceUpdatedAt && (
        <p className="text-xs text-muted-foreground">
          Kaynak: {saved.state.sourceRevisionLabel || "Hesap raporu"} · Son
          eşitleme:{" "}
          {new Date(saved.state.sourceUpdatedAt).toLocaleString("tr-TR")}
        </p>
      )}
      {dirty && (
        <p className="text-sm font-medium" role="status">
          Kaydedilmemiş değişiklikler var.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {!ready && !error && (
        <p role="status">Plan ve kaynak hesap yükleniyor…</p>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-sm">
            Kaynak hesap
            <select
              className={field}
              value={revisionId ?? ""}
              disabled={!editable || demo}
              onChange={async (e) => {
                const id = e.target.value;
                if (!id) { setRevisionId(null); setDerivation(null); setSourceChanged(true); return; }
                setBusy(true);
                try {
                  const result = await getDrawingPlanEditor(projectId, id);
                  if (result.error) setError(result.error);
                  else {
                    setRevisionId(id);
                    setSourceChanged(true);
                    setDerivation(result.derivation ?? null);
                  }
                } catch {
                  setError("Kaynak hesap okunamadı; mevcut taslağınız korundu.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <option value="">Kaynak seçilmedi</option>
              {revisions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" disabled={!editable} onClick={() => add()}>
            <Plus className="size-4" />
            Grup ekle
          </Button>
          <Button
            variant="outline"
            disabled={!editable}
            onClick={() => setNumberOpen(!numberOpen)}
          >
            Numara düzeni
          </Button>
          <Button
            variant="outline"
            disabled={!editable || !derivation}
            onClick={compare}
          >
            Hesapla karşılaştır{changes.length ? ` (${changes.length})` : ""}
          </Button>
        </div>
      )}
      {numberOpen && (
        <div className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-3">
          <label className="text-sm">
            Ana araba başlangıcı
            <input
              type="number"
              step="100"
              disabled={!editable}
              className={field}
              value={Number.isNaN(numbering.main) ? "" : numbering.main}
              onChange={(e) =>
                setNumbering({
                  ...numbering,
                  main: e.target.value ? Number(e.target.value) : NaN,
                })
              }
            />
          </label>
          <label className="text-sm">
            İkinci araba başlangıcı
            <input
              type="number"
              step="100"
              disabled={!editable}
              className={field}
              value={
                Number.isNaN(numbering.auxiliary) ? "" : numbering.auxiliary
              }
              onChange={(e) =>
                setNumbering({
                  ...numbering,
                  auxiliary: e.target.value ? Number(e.target.value) : NaN,
                })
              }
            />
          </label>
          <Button
            className="self-end"
            variant="outline"
            disabled={!editable}
            onClick={() => {
              const result = renumberDrawingPlan(rows, candidates, numbering);
              if (result.error) setError(result.error);
              else
                setPreview({ title: "Yeni numara düzeni", rows: result.rows });
            }}
          >
            Numaraları önizle
          </Button>
          <p className="text-sm text-muted-foreground sm:col-span-3">
            Başlangıçları değiştirmek mevcut numaraları değiştirmez. Yeniden
            numaralandırmayı önizleyip uygulayın; sabitlenen kodlar korunur.
          </p>
        </div>
      )}
      {!!derivation?.warnings.length && (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            Hesap inceleme notları ({derivation.warnings.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {derivation.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      {!!changes.length && (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">
            İncelenecek farklar ({changes.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {changes.map((c, i) => (
              <li key={i}>
                {c.message}
                {c.kind === "removed" && canEdit && (
                  <Button
                    variant="outline"
                    disabled={!editable}
                    className="ml-2"
                    onClick={() =>
                      replace(
                        rows.map((r) =>
                          r.sourceKey === c.key
                            ? {
                                ...r,
                                origin: "manual",
                                overrides: [
                                  "name",
                                  "code",
                                  "parentId",
                                  "sortOrder",
                                ],
                              }
                            : r,
                        ),
                      )
                    }
                  >
                    Manuel tut
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      <DndContext
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Taşımayı başlatmak için boşluk tuşuna basın. Yön tuşlarıyla hedefi seçin; boşlukla bırakın, Escape ile vazgeçin.",
          },
          announcements: {
            onDragStart: ({ active }) =>
              `${rows.find((r) => r.id === active.id)?.name ?? "Grup"} taşınıyor.`,
            onDragOver: ({ over }) =>
              over
                ? `Hedef: ${rows.find((r) => r.id === over.id)?.name ?? "grup"}.`
                : "Bir hedef seçin.",
            onDragEnd: () => "Taşıma tamamlandı.",
            onDragCancel: () => "Taşımadan vazgeçildi.",
          },
        }}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={dragEnd}
      >
        <SortableContext
          items={displayed.map((x) => x.row.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {displayed.map(({ row, depth }) => (
              <div key={row.id} style={{ marginLeft: Math.min(depth, 2) * 12 }}>
                <SortableRow row={row} disabled={!editable}>
                  {rows.some((r) => r.parentId === row.id && !r.suppressed) && (
                    <button
                      type="button"
                      className="min-h-11 text-sm font-medium"
                      aria-expanded={!collapsed.has(row.id)}
                      onClick={() =>
                        setCollapsed((current) => {
                          const next = new Set(current);
                          if (next.has(row.id)) next.delete(row.id);
                          else next.add(row.id);
                          return next;
                        })
                      }
                    >
                      {collapsed.has(row.id)
                        ? "Alt grupları göster"
                        : "Alt grupları daralt"}
                    </button>
                  )}
                  <div
                    onFocusCapture={(e) => {
                      if (
                        e.target instanceof HTMLInputElement ||
                        e.target instanceof HTMLTextAreaElement ||
                        e.target instanceof HTMLSelectElement
                      )
                        setHistory((h) => [...h.slice(-19), rows]);
                    }}
                    className="grid min-w-0 gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
                  >
                    <label className="text-xs text-muted-foreground">
                      Resim kodu
                      <input
                        aria-label={`${row.name || "Yeni grup"} resim kodu`}
                        className={`${field} font-mono`}
                        disabled={!editable}
                        maxLength={4}
                        value={row.code}
                        onChange={(e) =>
                          patch(
                            row.id,
                            { code: e.target.value.replace(/\D/g, "") },
                            "code",
                          )
                        }
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Grup adı
                      <textarea
                        rows={1}
                        aria-label="Grup adı"
                        className={`${field} [field-sizing:content] resize-none`}
                        disabled={!editable}
                        maxLength={120}
                        value={row.name}
                        onChange={(e) =>
                          patch(
                            row.id,
                            { name: adBuyuk(e.target.value) },
                            "name",
                          )
                        }
                      />
                    </label>
                    <div className="flex items-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${row.name} yukarı`}
                        disabled={!editable}
                        onClick={() =>
                          replace(moveDrawingRow(rows, row.id, -1))
                        }
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${row.name} aşağı`}
                        disabled={!editable}
                        onClick={() => replace(moveDrawingRow(rows, row.id, 1))}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${row.name} kaldır`}
                        disabled={!editable}
                        onClick={() => setDeleting(row.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <details
                    onFocusCapture={(e) => {
                      if (
                        e.target instanceof HTMLInputElement ||
                        e.target instanceof HTMLTextAreaElement ||
                        e.target instanceof HTMLSelectElement
                      )
                        setHistory((h) => [...h.slice(-19), rows]);
                    }}
                    className="mt-2 text-sm"
                  >
                    <summary className="min-h-11 cursor-pointer py-2 text-muted-foreground">
                      <span className="font-mono">
                        {fullDrawingNo(itemNo, row.code)}
                      </span>{" "}
                      ·{" "}
                      {
                        DRAWING_PLAN_STATUSES.find(
                          (s) => s.status === row.status,
                        )?.label
                      }{" "}
                      ·{" "}
                      {row.sourceKey && row.origin !== "manual"
                        ? "Hesaptan"
                        : "Manuel"}{" "}
                      · Ayrıntılar
                    </summary>
                    <div className="grid gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-3">
                      <label>
                        Durum
                        <select
                          className={field}
                          value={row.status}
                          disabled={!editable}
                          onChange={(e) =>
                            patch(row.id, {
                              status: e.target
                                .value as DrawingPlanRow["status"],
                            })
                          }
                        >
                          {DRAWING_PLAN_STATUSES.map((s) => (
                            <option key={s.status} value={s.status}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Çizen
                        <select
                          className={field}
                          value={row.drawnBy ?? ""}
                          disabled={!editable}
                          onChange={(e) =>
                            patch(row.id, {
                              drawnBy: e.target.value || null,
                              drawnByName:
                                authors.find((a) => a.id === e.target.value)
                                  ?.name ?? "",
                            })
                          }
                        >
                          <option value="">Atanmadı</option>
                          {row.drawnBy &&
                            !authors.some((a) => a.id === row.drawnBy) && (
                              <option value={row.drawnBy}>
                                {row.drawnByName || "Önceki atama"}
                              </option>
                            )}
                          {authors.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Üst montaj
                        <select
                          className={field}
                          disabled={!editable}
                          value={row.parentId ?? ""}
                          onChange={(e) =>
                            patch(
                              row.id,
                              { parentId: e.target.value || null },
                              "parentId",
                            )
                          }
                        >
                          <option value="">Genel montaj</option>
                          {ordered
                            .filter(
                              (x) =>
                                !drawingDescendants(rows, row.id).has(x.row.id),
                            )
                            .map((x) => (
                              <option key={x.row.id} value={x.row.id}>
                                {x.row.code} · {x.row.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="sm:col-span-2">
                        Not
                        <input
                          className={field}
                          value={row.note}
                          maxLength={300}
                          disabled={!editable}
                          onChange={(e) =>
                            patch(row.id, { note: e.target.value })
                          }
                        />
                      </label>
                      <label className="flex min-h-11 items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={!editable}
                          checked={row.overrides?.includes("code") ?? false}
                          onChange={(e) =>
                            patch(row.id, {
                              overrides: e.target.checked
                                ? [
                                    ...new Set([
                                      ...(row.overrides ?? []),
                                      "code" as const,
                                    ]),
                                  ]
                                : row.overrides?.filter((x) => x !== "code"),
                            })
                          }
                        />
                        Numarayı sabitle
                      </label>
                      <p className="text-muted-foreground sm:col-span-2">
                        {row.reason}
                      </p>
                      {canEdit && (
                        <Button
                          variant="outline"
                          disabled={!editable}
                          onClick={() => add(undefined, row.id)}
                        >
                          Alt grup ekle
                        </Button>
                      )}
                    </div>
                  </details>
                </SortableRow>
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {!ordered.length && (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
          Henüz resim grubu yok. Hesabı karşılaştırarak oluşturun veya grup
          ekleyin.
        </p>
      )}
      {canEdit && !!choices.length && (
        <details className="rounded-lg border p-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            Eklenebilir hesap grupları ({choices.length})
          </summary>
          <div className="space-y-2">
            {choices.map((c) => (
              <div
                key={c.key}
                className="flex flex-wrap items-center gap-2 border-t py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {c.name}
                    {c.optional ? " · isteğe bağlı" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
                <Button
                  variant="outline"
                  disabled={!editable}
                  onClick={() => add(c)}
                >
                  Ekle
                </Button>
                <select
                  aria-label={`${c.name} mevcut satırla eşleştir`}
                  className={`${field} max-w-64`}
                  value=""
                  disabled={!editable}
                  onChange={(e) => {
                    const old = rows.find((r) => r.id === e.target.value);
                    if (old)
                      replace(
                        rows.map((r) =>
                          r.id === old.id
                            ? {
                                ...r,
                                sourceKey: c.key,
                                origin: "auto",
                                reason: c.reason,
                                overrides: [
                                  "name",
                                  "code",
                                  "parentId",
                                  "sortOrder",
                                ],
                              }
                            : r,
                        ),
                      );
                  }}
                >
                  <option value="">Mevcut satırla eşleştir</option>
                  {ordered
                    .filter((x) => !x.row.sourceKey)
                    .map((x) => (
                      <option key={x.row.id} value={x.row.id}>
                        {x.row.code} · {x.row.name}
                      </option>
                    ))}
                </select>
              </div>
            ))}
          </div>
        </details>
      )}
      {canEdit && rows.some((r) => r.suppressed) && (
        <details className="rounded-lg border p-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm">
            Kaldırılan otomatik gruplar
          </summary>
          {rows
            .filter((r) => r.suppressed)
            .map((r) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm"
                key={r.id}
              >
                <span>
                  {r.code} · {r.name}
                </span>
                <Button
                  variant="outline"
                  disabled={!editable}
                  onClick={() => {
                    if (
                      r.parentId &&
                      rows.find((p) => p.id === r.parentId)?.suppressed
                    ) {
                      setError("Önce üst montajı geri alın.");
                      return;
                    }
                    replace(
                      rows.map((p) =>
                        p.id === r.id ? { ...p, suppressed: false } : p,
                      ),
                    );
                  }}
                >
                  Geri getir
                </Button>
              </div>
            ))}
        </details>
      )}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>
              Kontrol edip taslağa uygulayın. Veritabanına yazmak için ayrıca
              Kaydet düğmesine basın.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {preview &&
              orderedDrawingPlan(preview.rows).map(({ row, depth }) => {
                const old = rows.find((r) => r.id === row.id);
                return (
                  <div
                    key={row.id}
                    className="rounded border p-2 text-sm"
                    style={{ marginLeft: Math.min(depth, 2) * 12 }}
                  >
                    <p className="font-medium">
                      {!old
                        ? "Yeni · "
                        : old.code !== row.code
                          ? `${old.code} → `
                          : ""}
                      {row.code} · {row.name}
                    </p>
                    {old && old.name !== row.name && (
                      <p>Önceki ad: {old.name}</p>
                    )}
                    {old && old.parentId !== row.parentId && (
                      <p>
                        Üst montaj:{" "}
                        {rows.find((r) => r.id === old.parentId)?.name ??
                          "Genel"}{" "}
                        →{" "}
                        {preview.rows.find((r) => r.id === row.parentId)
                          ?.name ?? "Genel"}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
          <Button
            onClick={() => {
              if (preview) {
                replace(preview.rows);
                setSourceChanged(true);
              }
              setPreview(null);
            }}
          >
            Taslağa uygula
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grubu kaldır</DialogTitle>
            <DialogDescription>
              {rows.find((r) => r.id === deleting)?.name} kaldırılacak. Otomatik
              gruplar siz geri getirene kadar yeniden eklenmez.
            </DialogDescription>
          </DialogHeader>
          {rows.some((r) => r.parentId === deleting && !r.suppressed) && (
            <Button variant="outline" onClick={() => remove(true)}>
              Alt grupları bir üst seviyeye taşı
            </Button>
          )}
          <Button variant="destructive" onClick={() => remove(false)}>
            Alt gruplarıyla birlikte kaldır
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
