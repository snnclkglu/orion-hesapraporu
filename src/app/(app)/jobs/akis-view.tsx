"use client";

// İşin AKIŞI — olaylar + yorumlar TEK kronolojide.
//
// "İşte ne oldu" sorusunun cevabı iki sekmeye bölünmez: durum geçişi ile onun
// üzerine yazılmış yorum aynı zaman çizgisinde yan yana durur. "Yalnız
// Yorumlar" çipi konuşmayı süzer, ayrı bir sayfaya taşımaz.
//
// Zaman çizelgesi deseni `event-timeline.tsx`ten; yorum vurgusu
// `lib/jobs/mentions.ts`ten gelir. Composer'daki "@ Kişi" düğmesi gövdeye
// DÜZ METİN ekler — kimlikler kayıt anında SON METİNDEN çıkarılır
// (hub-actions.ts), yani eklenen ama sonra silinen anma bildirim üretmez.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AtSign, History, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { olayAdi, olayOzeti, olaySinifi } from "@/lib/jobs/event-labels";
import { splitMentions, type MentionPerson } from "@/lib/jobs/mentions";
import {
  createComment,
  deleteComment,
  updateComment,
} from "./[id]/hub-actions";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface JobEventRow {
  id: string;
  event: string;
  at: string;
  /** Boş dizge = aktör çözülemedi (silinmiş kullanıcı). */
  actorName: string;
  detail: Record<string, unknown>;
}

export interface JobCommentRow {
  id: string;
  at: string;
  authorId: string;
  authorName: string;
  body: string;
  edited: boolean;
}

// Olay adı, rengi ve tek cümlelik özeti ORTAK sözlükten gelir
// (`lib/jobs/event-labels.ts`) — panelin Son Hareketler bölümü aynı defteri
// basar, iki sözlük zamanla ayrışırdı.

function zaman(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

/** Yorum gövdesi — anmalar vurgulu basılır. */
function YorumGovdesi({
  body,
  people,
}: {
  body: string;
  people: MentionPerson[];
}) {
  const parcalar = useMemo(() => splitMentions(body, people), [body, people]);
  return (
    <p className="text-sm break-words whitespace-pre-line">
      {parcalar.map((s, i) =>
        s.personId ? (
          <span key={i} className="font-medium text-primary">
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </p>
  );
}

function YorumComposer({ jobId, people }: { jobId: string; people: MentionPerson[] }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function gonder() {
    const v = body.trim();
    if (!v) return;
    startTransition(async () => {
      const res = await createComment(jobId, { body: v });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2 rounded-lg border bg-card p-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Yorum yazın… (@ Kişi ile birini anabilirsiniz)"
        className="min-h-20"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Anma ekleme: seçilen ad gövdeye DÜZ METİN olarak eklenir. Değer hep
            boş kalır — bu bir seçim kutusu değil bir EKLEME kapısıdır ve aynı
            kişi arka arkaya iki kez anılabilmelidir. */}
        <div className="w-[11rem] max-w-full">
          <Combobox
            options={people
              .filter((p) => p.fullName)
              .map((p) => ({ value: p.id, label: p.fullName }))}
            value=""
            onChange={(id) => {
              const kisi = people.find((p) => p.id === id);
              if (!kisi) return;
              setBody((b) => `${b}${b && !b.endsWith(" ") ? " " : ""}@${kisi.fullName} `);
            }}
            placeholder="@ Kişi An"
            searchPlaceholder="Kişi ara…"
            emptyText="Kişi bulunamadı"
            renderTrigger={() => (
              <span className="inline-flex items-center gap-1 text-foreground">
                <AtSign className="size-3.5" /> Kişi An
              </span>
            )}
          />
        </div>
        <Button type="button" onClick={gonder} disabled={pending || !body.trim()}>
          {pending ? "Gönderiliyor…" : "Gönder"}
        </Button>
      </div>
    </div>
  );
}

function YorumSatiri({
  jobId,
  yorum,
  people,
  canEdit,
  canDelete,
}: {
  jobId: string;
  yorum: JobCommentRow;
  people: MentionPerson[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(yorum.body);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function kaydet() {
    startTransition(async () => {
      const res = await updateComment(jobId, yorum.id, { body: draft });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function sil() {
    startTransition(async () => {
      const res = await deleteComment(jobId, yorum.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Yorum silindi.");
      router.refresh();
    });
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-sky-700 dark:text-sky-400">
          Yorum
        </span>
        <span className="text-[12px] font-medium">{yorum.authorName}</span>
        <span className="font-mono text-[11px] text-muted-foreground/70">
          {zaman(yorum.at)}
          {yorum.edited && " · düzenlendi"}
        </span>
        {(canEdit || canDelete) && (
          <span className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs">
                  <MoreHorizontal className="size-3.5" />
                  <span className="sr-only">Yorum Eylemleri</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                {canEdit && (
                  <DropdownMenuItem onSelect={() => setEditing(true)}>
                    <Pencil className="size-3.5" /> Düzenle
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem variant="destructive" onSelect={sil}>
                    <Trash2 className="size-3.5" /> Sil
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}
      </div>
      {editing ? (
        <div className="mt-2 grid gap-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft(yorum.body);
                setEditing(false);
              }}
            >
              Vazgeç
            </Button>
            <Button type="button" size="sm" onClick={kaydet} disabled={pending || !draft.trim()}>
              Kaydet
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5">
          <YorumGovdesi body={yorum.body} people={people} />
        </div>
      )}
    </li>
  );
}

type AkisGirdisi =
  | { kind: "olay"; at: string; olay: JobEventRow }
  | { kind: "yorum"; at: string; yorum: JobCommentRow };

export function JobAkisi({
  jobId,
  olaylar,
  yorumlar,
  people,
  meId,
  isAdmin,
}: {
  jobId: string;
  olaylar: JobEventRow[];
  yorumlar: JobCommentRow[];
  people: MentionPerson[];
  meId: string;
  isAdmin: boolean;
}) {
  const [yalnizYorum, setYalnizYorum] = useState(false);

  const girdiler = useMemo<AkisGirdisi[]>(() => {
    const o: AkisGirdisi[] = yalnizYorum
      ? []
      : // "yorum" OLAYI akışta ayrıca basılmaz: yorumun kendisi zaten
        // satır olarak duruyor; ikisi birden aynı sözü iki kez söylerdi.
        olaylar
          .filter((e) => e.event !== "yorum")
          .map((e) => ({ kind: "olay" as const, at: e.at, olay: e }));
    const y: AkisGirdisi[] = yorumlar.map((c) => ({
      kind: "yorum" as const,
      at: c.at,
      yorum: c,
    }));
    return [...o, ...y].sort((a, b) => b.at.localeCompare(a.at));
  }, [olaylar, yorumlar, yalnizYorum]);

  return (
    <div className="grid gap-3">
      <YorumComposer jobId={jobId} people={people} />

      <section className="border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <History className="size-4 text-muted-foreground" />
            Akış
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setYalnizYorum((v) => !v)}
              className={cn(
                "oc-tap border px-2 py-0.5 font-mono text-[11px] transition-colors",
                yalnizYorum
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              Yalnız Yorumlar
            </button>
            <span className="font-mono text-[11px] text-muted-foreground">
              {girdiler.length} kayıt
            </span>
          </div>
        </header>

        {girdiler.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {yalnizYorum
              ? "Henüz yorum yok — ilk yorumu yukarıdan yazın."
              : "Henüz kayıt yok — akış, bu işte yapılan değişikliklerle dolar."}
          </p>
        ) : (
          <ul className="divide-y">
            {girdiler.map((g) =>
              g.kind === "yorum" ? (
                <YorumSatiri
                  key={`y-${g.yorum.id}`}
                  jobId={jobId}
                  yorum={g.yorum}
                  people={people}
                  canEdit={g.yorum.authorId === meId}
                  canDelete={g.yorum.authorId === meId || isAdmin}
                />
              ) : (
                <li
                  key={`o-${g.olay.id}`}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2"
                >
                  <span
                    className={`border px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap ${olaySinifi(g.olay.event)}`}
                  >
                    {olayAdi(g.olay.event)}
                  </span>
                  <span className="min-w-0 flex-1 text-[12px] text-muted-foreground">
                    {olayOzeti(g.olay)}
                  </span>
                  {g.olay.actorName && (
                    <span className="text-[11px] text-muted-foreground/80">
                      {g.olay.actorName}
                    </span>
                  )}
                  <span className="font-mono text-[11px] text-muted-foreground/70">
                    {zaman(g.olay.at)}
                  </span>
                </li>
              )
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
