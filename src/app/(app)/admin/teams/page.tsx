import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { accountContext, checkDb } from "@/lib/account/server";
import type { ManagedTeam } from "@/lib/tasks/teams";
import "@/components/account/account.css";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams,
    page = Math.max(0, Number(p.page) || 0);
  const { db } = await accountContext();
  const { data, error } = await db.rpc("team_list", {
    p_q: p.q ?? "",
    p_archived: p.archived === "true",
    p_page: page,
  });
  checkDb(error);
  const teams = data.items as ManagedTeam[];
  return (
    <div className="ac-page">
      <header className="ac-row justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ekipler</h1>
          <p className="ac-muted">
            Birlikte çalışan kişileri ve ortak görevleri düzenleyin.
          </p>
        </div>
        <Link className="ac-button ac-primary" href="/admin/teams/new">
          <Plus size={17} /> Ekip oluştur
        </Link>
      </header>
      <form className="ac-card">
        <div className="ac-row">
          <label className="flex-1">
            Ekip ara
            <input name="q" defaultValue={p.q} maxLength={100} />
          </label>
          <label>
            Kayıtlar
            <select name="archived" defaultValue={p.archived ?? "false"}>
              <option value="false">Aktif ekipler</option>
              <option value="true">Arşiv</option>
            </select>
          </label>
          <button className="ac-button">Süz</button>
        </div>
      </form>
      <div className="ac-grid">
        {teams.map((t) => (
          <Link className="ac-item" href={`/admin/teams/${t.id}`} key={t.id}>
            <div className="ac-row">
              <Users size={22} />
              <h2 className="font-semibold break-words">{t.name}</h2>
            </div>
            {t.description && (
              <p className="ac-muted ac-clamp">{t.description}</p>
            )}
            <div className="ac-row">
              <span className="ac-badge">{t.member_count} üye</span>
              <span className="ac-badge">{t.open_count} açık</span>
              <span className="ac-badge">{t.unassigned_count} atamasız</span>
              {!!t.overdue_count && (
                <span className="ac-badge text-destructive">
                  {t.overdue_count} gecikmiş
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
      {!teams.length && (
        <section className="ac-card">
          <h2>Henüz ekip bulunamadı</h2>
          <p className="ac-muted">
            Yeni ekip oluşturabilir veya aramanızı değiştirebilirsiniz.
          </p>
        </section>
      )}
      <nav className="ac-row">
        {page > 0 && (
          <Link
            className="ac-button"
            href={`?${new URLSearchParams({ ...p, page: String(page - 1) } as Record<string, string>)}`}
          >
            Önceki
          </Link>
        )}
        {(page + 1) * 25 < data.total && (
          <Link
            className="ac-button"
            href={`?${new URLSearchParams({ ...p, page: String(page + 1) } as Record<string, string>)}`}
          >
            Sonraki
          </Link>
        )}
      </nav>
    </div>
  );
}
