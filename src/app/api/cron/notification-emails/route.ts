import { NextRequest, NextResponse } from "next/server";
import { processNotificationEmails } from "@/lib/email/notifications";
import { processEmailCenter } from '@/lib/email-center/worker';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
  }
  try {
    const {data,error}=await createAdminClient().from('email_settings').select('paused').single();
    if(error) throw new Error('Gönderim ayarları okunamadı.');
    if(data.paused) return NextResponse.json({paused:true});
    // Önceki sürümde sıraya girmiş mesajlar yalnız eski işleyicide boşaltılır.
    // Yeni bildirimler bu eski tabloya artık yazılmaz.
    const legacy=await processNotificationEmails(1);
    const current=await processEmailCenter(2);
    return NextResponse.json({legacy,...current});
  } catch {
    return NextResponse.json({ error: "E-posta kuyruğu işlenemedi." }, { status: 503 });
  }
}
