"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users, ArrowUpRight } from "lucide-react";
import { saveTeam } from "@/app/(app)/admin/teams/actions";
import type {
  DirectoryPerson,
  ManagedTeam,
  TeamMember,
  TeamOperation,
} from "@/lib/tasks/teams";
import { PeoplePicker } from "./people-picker";
import { UserAvatar } from "@/components/user-avatar";
import { roleLabel } from "@/lib/roles";
import "./account.css";
export function TeamManager({
  team,
  members = [],
  preview = false,
  previewPeople,
}: {
  team?: ManagedTeam;
  members?: TeamMember[];
  preview?: boolean;
  previewPeople?: DirectoryPerson[];
}) {
  const [current, setCurrent] = useState(team),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState("members"),
    [remove, setRemove] = useState<TeamMember | null>(null),
    [replacement, setReplacement] = useState("");
  const key = useRef<string | null>(null);
  const router = useRouter();
  async function run(operation: TeamOperation, input: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      if (preview) {
        setError("Önizleme: değişiklikler kaydedilmez.");
        return true;
      }
      key.current ??= crypto.randomUUID();
      const r = await saveTeam(
        operation,
        {
          ...(current ? { id: current.id, version: current.version } : {}),
          ...input,
        },
        key.current,
      );
      if (r.error) {
        setError(r.error);
        key.current = null;
        return false;
      }
      key.current = null;
      setCurrent(r.team);
      router.refresh();
      if (!current) router.replace(`/admin/teams/${r.team.id}`);
      return true;
    } catch {
      setError("Bağlantı kurulamadı. Seçimleriniz korunuyor; yeniden deneyin.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ac-page">
      <Link href="/admin/teams" className="ac-button w-fit">
        <ArrowLeft size={16} /> Ekipler
      </Link>
      <header className="ac-hero">
        <Users size={32} />
        <div>
          <h1>{current?.name ?? "Yeni ekip"}</h1>
          <p className="ac-muted">
            {current?.archived_at
              ? "Arşivlenmiş ekip"
              : "Üyeleri bir kez düzenleyin, görevleri birlikte takip edin."}
          </p>
        </div>
      </header>
      {error && (
        <p className="ac-status" role="alert">
          {error}
        </p>
      )}
      {current && (
        <div className="ac-row">
          <button
            className="ac-button"
            aria-pressed={tab === "members"}
            onClick={() => setTab("members")}
          >
            Üyeler · {members.length}
          </button>
          <button
            className="ac-button"
            aria-pressed={tab === "settings"}
            onClick={() => setTab("settings")}
          >
            Ayarlar
          </button>
          <Link
            className="ac-button ac-primary"
            href={`/?view=team&team=${current.id}`}
          >
            Görevleri aç <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      {(!current || tab === "settings") && (
        <form
          className="ac-card"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(current ? "update" : "create", {
              name: f.get("name"),
              description: f.get("description"),
            });
          }}
        >
          <h2>{current ? "Ekip bilgileri" : "Ekibini oluştur"}</h2>
          <label>
            Ekip adı
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={current?.name}
              disabled={busy || !!current?.archived_at}
            />
          </label>
          <label>
            Kısa açıklama · isteğe bağlı
            <textarea
              name="description"
              maxLength={500}
              defaultValue={current?.description}
              disabled={busy || !!current?.archived_at}
            />
          </label>
          <button
            className="ac-button ac-primary"
            disabled={busy || !!current?.archived_at}
          >
            {current ? "Bilgileri kaydet" : "Ekibi oluştur"}
          </button>
          <p className="ac-muted">
            Ekip adı veya üyeliği uygulama rolünü değiştirmez.
          </p>
        </form>
      )}
      {current && tab === "members" && (
        <div className="ac-grid">
          <section className="ac-card">
            <h2>Üyeler</h2>
            {members.map((m) => (
              <div className="ac-item" key={m.id}>
                <div className="ac-row">
                  <UserAvatar
                    name={m.full_name}
                    userId={m.id}
                    photo={!!m.avatar_path}
                    version={m.avatar_path ?? ""}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <strong className="break-words">{m.full_name}</strong>
                    <p className="ac-muted break-all">{m.email}</p>
                    <p className="ac-muted">
                      {roleLabel(m.app_role)} · {m.open_count} açık görev
                    </p>
                  </div>
                </div>
                {m.id === current.owner_id ? (
                  <span className="ac-badge w-fit">Ekip sahibi</span>
                ) : (
                  <div className="ac-row">
                    <label className="flex-1">
                      Ekip içi yetki
                      <select
                        value={m.role}
                        disabled={busy || !!current.archived_at}
                        onChange={(e) =>
                          void run("member", {
                            user_id: m.id,
                            role: e.target.value,
                          })
                        }
                      >
                        <option value="manager">Ekip sorumlusu</option>
                        <option value="editor">Düzenler</option>
                        <option value="viewer">Görüntüler</option>
                      </select>
                    </label>
                    <button
                      className="ac-button"
                      disabled={busy || !!current.archived_at}
                      onClick={() => {
                        setRemove(m);
                        setReplacement("");
                      }}
                    >
                      Çıkar
                    </button>
                  </div>
                )}
              </div>
            ))}
            {remove && (
              <section className="ac-card">
                <h2>{remove.full_name} ekipten çıkarılacak</h2>
                <p className="ac-muted">
                  {remove.open_count} açık görev için sorumlu seçin. Boş
                  bırakırsanız görevler ekibin atamasız havuzunda kalır.
                </p>
                <label>
                  Görevleri devret
                  <select
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                  >
                    <option value="">Atamasız havuzuna bırak</option>
                    {members
                      .filter((m) => m.id !== remove.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="ac-row">
                  <button
                    className="ac-button"
                    disabled={busy}
                    onClick={() => setRemove(null)}
                  >
                    Vazgeç
                  </button>
                  <button
                    className="ac-button"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await run("member", {
                          user_id: remove.id,
                          role: "remove",
                          replacement: replacement || null,
                        })
                      )
                        setRemove(null);
                    }}
                  >
                    Görevleri düzenle ve çıkar
                  </button>
                </div>
              </section>
            )}
          </section>
          {!current.archived_at && (
            <PeoplePicker
              key={current.version}
              team={current.id}
              busy={busy}
              previewPeople={previewPeople}
              onSave={(ids) => run("members", { users: ids })}
            />
          )}
        </div>
      )}
      {current && tab === "settings" && (
        <section className="ac-card">
          <h2>Ekip yaşam döngüsü</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run("transfer", { user_id: f.get("owner") });
            }}
          >
            <label>
              Ekip sahipliğini devret
              <select name="owner" required defaultValue="">
                <option value="" disabled>
                  Yeni sahibi seç
                </option>
                {members
                  .filter((m) => m.id !== current.owner_id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
              </select>
            </label>
            <button className="ac-button mt-3" disabled={busy}>
              Sahipliği devret
            </button>
          </form>
          <p className="ac-muted">
            Arşivlenen ekibin görevleri ve geçmişi korunur. Yeni görev ve
            düzenleme için ekip yeniden açılmalıdır.
          </p>
          <button
            className="ac-button"
            disabled={busy}
            onClick={() => {
              if (
                current.archived_at ||
                window.confirm(
                  "Ekibin açık görevleri de dahil tüm geçmişi korunacak; ekip yeniden açılana kadar görev düzenlenemeyecek. Arşivlensin mi?",
                )
              )
                void run(current.archived_at ? "restore" : "archive", {});
            }}
          >
            {current.archived_at ? "Ekibi yeniden aç" : "Ekibi arşivle"}
          </button>
        </section>
      )}
    </div>
  );
}
