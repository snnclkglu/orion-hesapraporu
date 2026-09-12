import { accountContext, checkDb } from "@/lib/account/server";
import { AccountView } from "@/components/account/account-view";
export default async function ProfilePage() {
  const { db, user } = await accountContext();
  const [profile, details, membership] = await Promise.all([
    db
      .from("profiles")
      .select("full_name,title,role,avatar_path,account_version")
      .eq("id", user.id)
      .single(),
    db
      .from("profile_private_details")
      .select("phone,note")
      .eq("user_id", user.id)
      .maybeSingle(),
    db
      .from("task_team_members")
      .select("task_teams(id,name)")
      .eq("user_id", user.id),
  ]);
  checkDb(profile.error);
  checkDb(details.error);
  checkDb(membership.error);
  const p = profile.data!;
  return (
    <AccountView
      initial={{
        id: user.id,
        name: p.full_name,
        email: user.email ?? "",
        title: p.title,
        role: p.role,
        avatar: p.avatar_path,
        version: p.account_version,
        phone: details.data?.phone ?? "",
        note: details.data?.note ?? "",
        teams:
          (membership.data?.flatMap((m) => m.task_teams ?? []) as unknown as {
            id: string;
            name: string;
          }[]) ?? [],
      }}
    />
  );
}
