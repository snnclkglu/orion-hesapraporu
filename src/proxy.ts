import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LANDING_PATH } from "@/lib/roles";

// Oturum tazeleme + korumalı rotalar (Next 16: middleware yerine proxy)
export async function proxy(request: NextRequest) {
  // MÜŞTERİ PAYLAŞIMLARI OTURUM İSTEMEZ. Yetki, `/paylas/resim/...` altında
  // tahmin edilemeyen ve iptal edilebilir tek-dosya anahtarıyla; katalogda ise
  // yalnız manifest izin listesindeki üretici sayfasıyla sınırlandırılır.
  if (request.nextUrl.pathname === "/paylas" || request.nextUrl.pathname.startsWith("/paylas/")) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLogin = request.nextUrl.pathname.startsWith("/login");

  // Development önizleme rotası auth dışıdır (production'da sayfa 404 döner)
  if (
    process.env.NODE_ENV === "development" &&
    request.nextUrl.pathname.startsWith("/dev/")
  ) {
    return response;
  }

  // ZAMANLANMIŞ İŞ UCU ÇEREZ TAŞIMAZ.
  //
  // Matcher `/api/...`i de kapsar ve aşağıdaki `!user` dalı çerezsiz her isteği
  // `/login`e yönlendirir. Vercel Cron'un GET'i handler'a HİÇ ULAŞMAZ, 307
  // döner ve cron kendini BAŞARILI sayar — yani kur sessizce hiç güncellenmez.
  // Bu yüzden muafiyet AÇIKÇA yazılır; doğrulama handler'ın kendi içinde
  // `Authorization: Bearer <CRON_SECRET>` ile yapılır (gizli anahtar yoksa uç
  // 403 döner, yani muafiyet tek başına bir kapı açmaz).
  if (request.nextUrl.pathname.startsWith("/api/cron/")) {
    return response;
  }

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  /*
   * OTURUMU OLAN KULLANICI AÇILIŞ PANOSUNA DÜŞER — Mühendislik listesine DEĞİL.
   *
   * Bu satır panodan (13.08.2026) önce yazılmıştı ve kalınca uygulamanın İKİ
   * ayrı açılış adresi oldu: giriş formu `/`ye gider, bu dal `/projects`e.
   * İkincisi telefonda çok daha sık çalışır ve kullanıcının bildirdiği hata
   * odur (16.08.2026: *"mobilde ilk açılışta mühendislik sayfası geliyor"*) —
   * oturum çerezi bir an gecikirse `/` isteği `/login`e döner, çerez oraya
   * yetişir ve bu dal kullanıcıyı panonun yanından geçirip Mühendislik'e
   * bırakır. Adres `LANDING_PATH`tedir (`lib/roles.ts`): menünün ilk satırı,
   * giriş formunun hedefi ve bu dal TEK kaynaktan okur.
   */
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = LANDING_PATH;
    return NextResponse.redirect(url);
  }

  return response;
}

/*
 * MANİFEST ÇEREZSİZ İSTENİR — muafiyet bu yüzden ŞART.
 *
 * Tarayıcı `<link rel="manifest">`i şartnameye göre `credentials: "omit"` ile
 * çeker. Muaf tutulmasaydı istek oturumsuz görünür, aşağıdaki `!user` dalı onu
 * `/login`e 307'lerdi ve Chrome bir HTML sayfası okuyup manifesti "geçersiz"
 * sayardı: telefona eklenen kısayolda ne ad ne logo çıkardı — kullanıcının
 * bildirdiği hatanın ta kendisi (12.08.2026).
 *
 * Açılan kapı yok: manifest yalnız uygulama adını, renklerini ve ikon
 * yollarını taşır; ikon dosyaları zaten uzantılarıyla muaftı.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
