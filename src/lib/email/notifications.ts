import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notificationMessage } from "./message";

export function emailNotificationsEnabled() {
  return process.env.EMAIL_NOTIFICATIONS_ENABLED === "true" &&
    process.env.VERCEL_ENV === "production" && !!process.env.RESEND_API_KEY;
}

type OutboxRow = {
  id: string; user_id: string; title: string; href: string;
  payload: Record<string, unknown> | null; attempts: number;
};

/** Kimlik, başlık ve hedefler yalnız yetkili sunucu eyleminden gelir. */
export async function queueNotificationEmails(rows: {
  id: string; user_id: string; title: string; href: string;
}[]) {
  if (!emailNotificationsEnabled() || !rows.length) return;
  const { error } = await createAdminClient().from("notification_email_outbox").insert(
    rows.map(({ id, user_id, title, href }) => ({ id, user_id, title, href }))
  );
  if (error) throw new Error("E-posta kuyruğu yazılamadı.");
}

/** Sağlayıcı arızaları ana iş kaydını etkilemez; cron kuyrukta kalanları tekrar dener. */
export async function processNotificationEmails(limit = 3) {
  if (!emailNotificationsEnabled()) return { processed: 0, disabled: true };
  const admin = createAdminClient();
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    const { data, error } = await admin.rpc("claim_notification_email");
    if (error) throw new Error("E-posta kuyruğu okunamadı.");
    const row = (data as OutboxRow[] | null)?.[0];
    if (!row) break;
    const update = async (values: Record<string, unknown>) => {
      const { error } = await admin.from("notification_email_outbox").update(values)
        .eq("id", row.id).eq("attempts", row.attempts).eq("status", "processing");
      if (error) throw new Error("E-posta sonucu kaydedilemedi.");
    };
    try {
      const { data: auth, error: authError } = await admin.auth.admin.getUserById(row.user_id);
      if (authError && authError.status !== 404) throw new Error("recipient_lookup_failed");
      const user = auth?.user;
      const bannedUntil = (user as { banned_until?: string } | null)?.banned_until;
      if (!user?.email || !user.email_confirmed_at ||
          (bannedUntil && Date.parse(bannedUntil) > Date.now())) {
        await update({ status: "skipped", last_error: "recipient_unavailable", lease_until: null });
        continue;
      }
      // Yeniden denemelerde aynı anahtar AYNI gövdeyi taşır. E-posta değişmişse eskiye gönderilmez.
      let payload = row.payload;
      if (payload && JSON.stringify(payload.to) !== JSON.stringify([user.email])) {
        await update({ status: "skipped", last_error: "recipient_changed", lease_until: null });
        continue;
      }
      if (!payload) {
        payload = { ...notificationMessage(row.title, row.href), to: [user.email] };
        await update({ payload });
      }
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json", "Idempotency-Key": `notification/${row.id}` },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status === 409 || response.status >= 500;
        await update({ status: retryable && row.attempts < 8 ? "pending" : "failed",
          next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** row.attempts) * 60_000).toISOString(),
          lease_until: null, last_error: `resend_http_${response.status}` });
      } else {
        const result = await response.json() as { id?: string };
        if (!result.id) throw new Error("provider_id_missing");
        await update({ status: "sent", sent_at: new Date().toISOString(),
          provider_id: result.id, last_error: null, lease_until: null });
      }
    } catch {
      await update({ status: row.attempts < 8 ? "pending" : "failed", lease_until: null,
        next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** row.attempts) * 60_000).toISOString(),
        last_error: "delivery_or_storage_error" });
    }
    processed++;
    // Resend'in saniyelik sınırını tek çalışan içinde aşma.
    await new Promise((resolve) => setTimeout(resolve, 600));
  }
  return { processed, disabled: false };
}
