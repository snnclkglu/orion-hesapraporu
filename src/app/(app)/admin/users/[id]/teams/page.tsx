import Link from "next/link";
import { notFound } from "next/navigation";
import { accountContext, checkDb } from "@/lib/account/server";
import { UserTeams } from "@/components/account/user-teams";
import "@/components/account/account.css";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const p = await searchParams;
  const page = Math.max(0, Number(p.page) || 0);
  const { db } = await accountContext();
  const [profile, list, members] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", id).single(),
    db.rpc("team_list", {
      p_q: p.q ?? "",
      p_archived: p.archived === "true",
      p_page: page,
    }),
    db.from("task_team_members").select("team_id").eq("user_id", id),
  ]);
  if (!profile.data) notFound();
  checkDb(list.error);
  checkDb(members.error);
  const pageUrl = (n: number) =>
    `?${new URLSearchParams({ q: p.q ?? "", archived: p.archived ?? "false", page: String(n) })}`;
  return (
    <div className="ac-page">
      <Link className="ac-button w-fit" href="/admin/users">
        Kullanıcılara dön
      </Link>
      <h1 className="text-2xl font-semibold">Kullanıcının ekipleri</h1>
      <form className="ac-card">
        <label>
          Ekip ara
          <input name="q" defaultValue={p.q} />
        </label>
        <label>
          Kayıtlar
          <select name="archived" defaultValue={p.archived ?? "false"}>
            <option value="false">Aktif</option>
            <option value="true">Arşiv</option>
          </select>
        </label>
        <button className="ac-button">Ara</button>
      </form>
      <UserTeams
        userId={id}
        name={profile.data.full_name}
        teams={list.data.items}
        memberIds={members.data?.map((m) => m.team_id) ?? []}
      />
      <nav className="ac-row">
        {page > 0 && (
          <Link className="ac-button" href={pageUrl(page - 1)}>
            Önceki
          </Link>
        )}
        {(page + 1) * 25 < list.data.total && (
          <Link className="ac-button" href={pageUrl(page + 1)}>
            Sonraki
          </Link>
        )}
      </nav>
    </div>
  );
}
