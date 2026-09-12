"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveTeam } from "@/app/(app)/admin/teams/actions";
import type { ManagedTeam } from "@/lib/tasks/teams";
import "./account.css";
export function UserTeams({
  userId,
  name,
  teams,
  memberIds,
}: {
  userId: string;
  name: string;
  teams: ManagedTeam[];
  memberIds: string[];
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function toggle(t: ManagedTeam, member: boolean) {
    if (
      member &&
      !window.confirm(
        `${name} bu ekipten çıkarılacak. Açık görevleri ekibin atamasız havuzuna bırakılacak. Devam edilsin mi?`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const r = await saveTeam(
        member ? "member" : "members",
        member
          ? {
              id: t.id,
              version: t.version,
              user_id: userId,
              role: "remove",
              replacement: null,
            }
          : { id: t.id, version: t.version, users: [userId] },
      );
      setMessage(r.error ?? "Üyelik güncellendi.");
      if (!r.error) router.refresh();
    } catch {
      setMessage("Kaydedilemedi. Yeniden deneyin.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ac-list">
      <p className="ac-muted">
        {name} · Ekip üyeliği uygulama rolünü değiştirmez. Görev devri ve
        sahiplik işlemleri ekip ayrıntısındadır.
      </p>
      {message && (
        <p role="status" className="ac-status">
          {message}
        </p>
      )}
      {teams.map((t) => (
        <div className="ac-item" key={t.id}>
          <div className="ac-row">
            <Link
              className="flex-1 min-h-11 content-center font-semibold break-words"
              href={`/admin/teams/${t.id}`}
            >
              {t.name}
            </Link>
            {t.owner_id === userId ? (
              <span className="ac-badge">Ekip sahibi</span>
            ) : (
              <button
                className="ac-button"
                disabled={busy || !!t.archived_at}
                onClick={() => void toggle(t, memberIds.includes(t.id))}
              >
                {memberIds.includes(t.id) ? "Ekipten çıkar" : "Ekibe ekle"}
              </button>
            )}
          </div>
          <p className="ac-muted">
            {memberIds.includes(t.id) ? "Üye" : "Üye değil"}
            {t.archived_at ? " · Arşiv" : ""}
          </p>
        </div>
      ))}
    </div>
  );
}
