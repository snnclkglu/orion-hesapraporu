import { NextRequest, NextResponse } from "next/server";
import { processNotificationEmails } from "@/lib/email/notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
  }
  try {
    return NextResponse.json(await processNotificationEmails());
  } catch {
    return NextResponse.json({ error: "E-posta kuyruğu işlenemedi." }, { status: 503 });
  }
}
