// AYLIK OTOMATİK KUR TAZELEME — Vercel Cron ucu.
//
// ═══════════════════════════════════════════════════════════ NEDEN VAR
// Kullanıcı "her ay otomatik yenilensin" istedi. Bu uç o isteğin GÜVENCESİDİR,
// ÇALIŞMA YOLU DEĞİL: asıl mekanizma Kurlar ekranındaki "Şimdi Güncelle"
// eylemidir ve o HİÇBİR AYAR GEREKTİRMEZ. Bu uç, aylarca kimse Finans'a
// girmese bile verinin durmasını sağlar.
//
// ═══════════════════════════════════════════════════════ NASIL KURULUR
// 1. `vercel.json` içindeki `crons` girdisi bu yolu ayda bir çağırır.
// 2. İKİ ORTAM DEĞİŞKENİ gerekir (ikisi de Vercel proje ayarlarından):
//      CRON_SECRET               — uç bunu `Authorization: Bearer …` bekler
//      SUPABASE_SERVICE_ROLE_KEY — RLS'i aşan yazma anahtarı
//    İkisi de YOKSA uç 503 döner ve NEDENİNİ söyler. Sessizce başarılı
//    görünmez: cron panelinde yeşil bir tik gördüğü hâlde kurun hiç
//    güncellenmemesi, bu işin en kötü sonucudur.
//
// ═══════════════════════════════ NEDEN SERVICE-ROLE, NEDEN ÇEREZ DEĞİL
// Cron isteği bir OTURUM TAŞIMAZ. `fin_fx_daily` yazma politikası
// `can_edit_finance()` ister ve o soru `auth.uid()`e bakar — kullanıcısı
// olmayan bir istek RLS'i geçemez. Service-role anahtarı RLS'i aşar ve bu
// yüzden YALNIZ BURADA, yalnız sunucuda kullanılır; `NEXT_PUBLIC_` öneki
// ALMAZ (alsaydı tarayıcı paketine girerdi).
//
// Uç yalnız TCMB'den okunmuş kur satırı yazar; kullanıcı verisine dokunmaz.
// Gizli anahtar sızsa bile yapılabilecek en kötü şey bir kur satırı
// eklemektir — yine de anahtar zorunludur, çünkü `proxy.ts`teki muafiyet bu
// yolu auth dışına çıkarır ve tek kapı budur.

import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { tazeleKurlar } from "@/lib/finance/fx-refresh";

export const runtime = "nodejs";
// TCMB gün başına bir istek ister; 62 günlük pencere en kötü ihtimalle ~44 iş
// günü eder ve dört işçiyle paralel koşar. 60 saniye cömert bir tavandır.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const beklenen = process.env.CRON_SECRET;
  const gelen = request.headers.get("authorization");
  if (!beklenen || gelen !== `Bearer ${beklenen}`) {
    return new Response("Yetki yok", { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return Response.json(
      {
        ok: false,
        hata:
          "SUPABASE_SERVICE_ROLE_KEY tanımlı değil; zamanlanmış tazeleme çalışamaz. " +
          "Kurlar ekranındaki 'Şimdi Güncelle' düğmesi bu anahtar olmadan da çalışır.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bugun = new Date().toISOString().slice(0, 10);
  const sonuc = await tazeleKurlar(supabase, bugun);

  if (sonuc.error) {
    return Response.json(
      { ok: false, hata: sonuc.error },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  await supabase.from("audit_log").insert({
    // `actor` boştur: bunu bir kullanıcı yapmadı, zamanlayıcı yaptı. Sahte bir
    // kullanıcı kimliği yazmak denetim izini yalan söyletirdi.
    actor: null,
    action: "finance.fx.cron",
    detail: {
      from: sonuc.aralik?.from ?? null,
      to: sonuc.aralik?.to ?? null,
      eklenen: sonuc.eklenen,
      yayin_yok: sonuc.yayinYok,
      yedek: sonuc.yedek,
      hata: sonuc.hatalar.length,
    },
  });

  // Cron günlüğünde okunur olsun: sayılar İNSAN İÇİN, ayrıca ham hâlleriyle.
  return Response.json(
    {
      ok: sonuc.hatalar.length === 0,
      ozet:
        `${sonuc.eklenen} gün eklendi · ${sonuc.yayinYok} gün bülten yok (tatil)` +
        (sonuc.yedek > 0 ? ` · ${sonuc.yedek} gün ECB yedeğinden` : "") +
        (sonuc.kalanVar ? " · daha eski günler kaldı" : ""),
      ...sonuc,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
