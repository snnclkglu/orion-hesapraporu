import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Oturum tazeleme + korumalı rotalar (Next 16: middleware yerine proxy)
export async function proxy(request: NextRequest) {
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
  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/projects";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
