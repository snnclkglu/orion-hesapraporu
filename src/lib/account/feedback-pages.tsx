import { notFound } from "next/navigation";
import { accountContext, checkDb } from "./server";
import { FeedbackList } from "@/components/account/feedback-list";
import { FeedbackDetail } from "@/components/account/feedback-detail";
import { z } from "zod";
import { dateSchema } from "@/lib/tasks/model";
import { MaintenanceStatus } from "@/components/account/maintenance-status";
export async function feedbackListPage(
  params: Record<string, string | string[] | undefined>,
  admin: boolean,
) {
  const filters = Object.fromEntries(
    Object.entries(params).filter(
      ([k, v]) =>
        [
          "q",
          "page",
          "category",
          "archived",
          "unread",
          "from",
          "to",
          "user",
        ].includes(k) && typeof v === "string",
    ),
  ) as Record<string, string>;
  filters.q = (filters.q ?? "").slice(0, 100);
  filters.page = String(Math.min(10000, Math.max(0, Math.floor(Number(filters.page) || 0))));
  if (!["general", "bug", "idea", "other"].includes(filters.category)) delete filters.category;
  for (const field of ["from", "to"]) if (!dateSchema.safeParse(filters[field]).success) delete filters[field];
  if (!z.uuid().safeParse(filters.user).success) delete filters.user;
  const { db } = await accountContext();
  const { data, error } = await db.rpc("feedback_list", {
    p_filters: { ...filters, admin },
  });
  checkDb(error);
  if (!admin) return <FeedbackList {...data} admin={admin} filters={filters} />;
  const maintenance = await db.from("account_maintenance_runs")
    .select("started_at,mode,status,candidates,removed,failed")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  return <><FeedbackList {...data} admin={admin} filters={filters} /><MaintenanceStatus now={Date.now()} run={maintenance.data} unavailable={!!maintenance.error} /></>;
}
export async function feedbackDetailPage(
  id: string,
  params: Record<string, string | string[] | undefined>,
  admin: boolean,
) {
  const { db } = await accountContext();
  const { data, error } = await db.rpc("feedback_detail", {
    p_id: id,
    p_admin: admin,
  });
  if (error || !data) notFound();
  return (
    <FeedbackDetail
      {...data}
      admin={admin}
      sent={!admin && params.sent === "1"}
      back={typeof params.return === "string" ? params.return : ""}
    />
  );
}
