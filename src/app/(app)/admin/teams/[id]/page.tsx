import { notFound } from "next/navigation";
import { accountContext } from "@/lib/account/server";
import { TeamManager } from "@/components/account/team-manager";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { db } = await accountContext();
  const { data, error } = await db.rpc("team_detail", {
    p_id: (await params).id,
  });
  if (error || !data?.team) notFound();
  return (
    <TeamManager
      key={data.team.version}
      team={data.team}
      members={data.members}
    />
  );
}
