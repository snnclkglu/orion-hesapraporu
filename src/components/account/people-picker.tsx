"use client";
import { useEffect, useState } from "react";
import { searchDirectory } from "@/app/(app)/admin/teams/actions";
import type { DirectoryPerson } from "@/lib/tasks/teams";
import { roleLabel, USER_ROLE_LABELS } from "@/lib/roles";
import { UserAvatar } from "@/components/user-avatar";
export function PeoplePicker({
  team,
  onSave,
  busy,
  previewPeople,
}: {
  team?: string;
  onSave: (ids: string[]) => Promise<boolean>;
  busy: boolean;
  previewPeople?: DirectoryPerson[];
}) {
  const [query, setQuery] = useState(""),
    [role, setRole] = useState(""),
    [page, setPage] = useState(0),
    [people, setPeople] = useState<DirectoryPerson[]>([]),
    [selected, setSelected] = useState<DirectoryPerson[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const r = previewPeople
          ? {
              people: previewPeople.filter(
                (p) =>
                  p.full_name
                    .toLocaleLowerCase("tr-TR")
                    .includes(query.toLocaleLowerCase("tr-TR")) &&
                  (!role || p.role === role),
              ),
            }
          : await searchDirectory(query, role, page, team);
        if (active) {
          setPeople(r.people ?? []);
          setError(r.error ?? "");
        }
      } catch {
        if (active) setError("Kişiler yüklenemedi. Aramayı yeniden deneyin.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, role, page, team, previewPeople]);
  return (
    <section className="ac-card">
      <h2>Üye ekle</h2>
      <label>
        Kullanıcı ara
        <input
          value={query}
          maxLength={100}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          autoComplete="off"
        />
      </label>
      <label>
        Uygulama rolü
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Tüm roller</option>
          {Object.entries(USER_ROLE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <p role="status" className="ac-muted">
        {loading ? "Kişiler aranıyor…" : `${selected.length} kişi seçildi`}
      </p>
      {error && (
        <p role="alert" className="ac-error">
          {error}
        </p>
      )}
      {!!selected.length && (
        <div className="ac-row">
          {selected.map((p) => (
            <button
              type="button"
              className="ac-button"
              key={p.id}
              disabled={busy}
              onClick={() => setSelected(selected.filter((s) => s.id !== p.id))}
            >
              {p.full_name} · Kaldır
            </button>
          ))}
        </div>
      )}
      <div className="ac-list max-h-[45dvh] overflow-y-auto">
        {people.map((p) => (
          <label
            key={p.id}
            className="!flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-3"
          >
            <input
              type="checkbox"
              className="size-5 shrink-0"
              disabled={
                busy ||
                p.member ||
                (selected.length >= 100 && !selected.some((s) => s.id === p.id))
              }
              checked={!!p.member || selected.some((s) => s.id === p.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, p]
                    : selected.filter((s) => s.id !== p.id),
                )
              }
            />
            <UserAvatar
              userId={p.id}
              photo={!!p.avatar_path}
              version={p.avatar_path ?? ""}
              name={p.full_name}
              size={32}
            />
            <span className="min-w-0 flex-1">
              <span className="block break-words">{p.full_name}</span>
              <span className="ac-muted block break-all">{p.email}</span>
              <span className="ac-muted">
                {roleLabel(p.role)}
                {p.member ? " · Zaten üye" : ""}
              </span>
            </span>
          </label>
        ))}
      </div>
      {!loading && !people.length && (
        <p className="ac-muted">Aramanıza uygun kullanıcı bulunamadı.</p>
      )}
      <div className="ac-row">
        {page > 0 && (
          <button
            className="ac-button"
            type="button"
            onClick={() => setPage(page - 1)}
          >
            Önceki
          </button>
        )}
        {people.length === 30 && (
          <button
            className="ac-button"
            type="button"
            onClick={() => setPage(page + 1)}
          >
            Sonraki
          </button>
        )}
      </div>
      <button
        type="button"
        className="ac-button ac-primary"
        disabled={busy || !selected.length}
        onClick={async () => {
          if (await onSave(selected.map((p) => p.id))) setSelected([]);
        }}
      >
        {busy ? "Kaydediliyor…" : `${selected.length || "Seçilen"} kişiyi ekle`}
      </button>
    </section>
  );
}
