import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePublicDrawingShare } from "@/lib/drawing-public-share";
import { protectDrawingPdf } from "@/lib/pdf/drawing-viewer";
import {
  PORTAL_SESSION_HOURS,
  PUBLIC_CODE_PATTERN,
  normalizedPublicCode,
  portalCookieName,
  portalRequestFingerprints,
  resolvePortalDocument,
} from "@/lib/product-portal/access-server";
import {
  hashPortalPassword,
  newSessionToken,
  sha256,
  verifyPortalPassword,
} from "@/lib/product-portal/secrets";

// VERCEL HOBBY SINIRI: bu mevcut teknik-resim paylaşım fonksiyonu, rewrite
// üzerinden vinç portalının giriş, filigranlı görüntüleme ve açık indirme
// işlemlerini de taşır. Ayrı bir portal route.ts dağıtımı 13 fonksiyona çıkarır.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShareRouteParams = Promise<{ token: string }>;

function safeFileName(value: string, fallback = "dokuman.pdf"): string {
  return value.replace(/[\r\n"]/g, " ").trim() || fallback;
}

/**
 * KİLİT İLE YANLIŞ PAROLA MÜŞTERİYE AYNI ŞEYİ SÖYLEMEZ.
 *
 * Tek bir `hata=1` vardı: parolasını yanlış yazan da, deneme hakkını doldurup
 * kilitlenen de aynı cümleyi görüyordu. Kilitli olduğunu bilmeyen müşteri
 * denemeye devam ediyor ve (eski sayaç hatasıyla birlikte) kilidi kendi eliyle
 * uzatıyordu. Sebep artık adreste taşınır; sayfa ona göre konuşur.
 */
type PortalFailure = "parola" | "kilit" | "yayin";

function failure(request: Request, code: string, reason: PortalFailure = "parola", status = 303) {
  const url = new URL(`/paylas/vinc/${encodeURIComponent(code)}`, request.url);
  url.searchParams.set("hata", reason);
  return NextResponse.redirect(url, status);
}

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function externalPortalPath(request: Request): string[] | null {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  if (parts[0] !== "paylas" || parts[1] !== "vinc") return null;
  try {
    return parts.map((part) => decodeURIComponent(part));
  } catch {
    return [];
  }
}

async function loginPortal(request: Request, rawCode: string): Promise<Response> {
  const code = normalizedPublicCode(rawCode);
  if (!PUBLIC_CODE_PATTERN.test(code)) return failure(request, code, "parola");
  const fingerprints = portalRequestFingerprints(request, code);
  const admin = createAdminClient();
  const { data: rateRows, error: rateError } = await admin.rpc(
    "consume_product_portal_login_attempt",
    { p_code_hash: fingerprints.codeHash, p_ip_hash: fingerprints.ipHash }
  );
  const rate = Array.isArray(rateRows) ? rateRows[0] : rateRows;
  if (rateError || !rate?.allowed) {
    await admin.from("product_portal_access_events").insert({
      code_hash: fingerprints.codeHash,
      ip_hash: fingerprints.ipHash,
      user_agent_hash: fingerprints.userAgentHash,
      result: "rate_limited",
    });
    // `Retry-After` bir 303 yönlendirmesinde tarayıcıya hiçbir şey ifade etmez;
    // asıl bilgi sayfaya adresle taşınır. Başlık yine de yazılır: otomatik
    // istemciler ve günlükler için anlamlıdır.
    const response = failure(request, code, "kilit");
    response.headers.set("Retry-After", String(Math.max(1, Number(rate?.retry_after ?? 900))));
    return response;
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const { data: unit } = await admin
    .from("crane_units")
    .select("id, portal_id, password_salt, password_hash, password_version, portal_enabled")
    .eq("public_code", code)
    .eq("portal_enabled", true)
    .maybeSingle();

  let valid = false;
  if (unit?.password_salt && unit.password_hash) {
    valid = await verifyPortalPassword(password, unit.password_salt, unit.password_hash);
  } else {
    /*
     * SAHTE HESAPLAMA — zamanlama sızıntısını kapatır, ama KENDİ DÜŞMEMELİDİR.
     *
     * `hashPortalPassword` 8–128 BAYT dışındaki girdide fırlatır ve buradaki
     * ön kontrol KARAKTER sayısına bakıyordu; NFKC normalizasyonu uzunluğu
     * değiştirebildiği için sınır durumunda giriş ucu 500 veriyordu. Sahte
     * hesabın amacı yalnız süre yakmaktır; hatası hiçbir şeyi değiştirmez.
     */
    await hashPortalPassword("gecersiz-portal-parolasi").catch(() => undefined);
  }
  if (!unit || !valid) {
    await admin.from("product_portal_access_events").insert({
      unit_id: unit?.id ?? null,
      code_hash: fingerprints.codeHash,
      ip_hash: fingerprints.ipHash,
      user_agent_hash: fingerprints.userAgentHash,
      result: "invalid",
    });
    return failure(request, code, "parola");
  }

  // Yayım işaretçisi veya dosya paketi yoksa oturum üretme. Aksi hâlde giriş
  // başarılı görünür, sonraki sayfa current revision bulamayınca tekrar parola
  // ekranına düşer ve müşteri QR'ın bozuk olduğunu sanır.
  const { data: portal } = await admin
    .from("product_portals")
    .select("current_revision_id")
    .eq("id", unit.portal_id)
    .maybeSingle();
  const currentRevisionId = portal?.current_revision_id
    ? String(portal.current_revision_id)
    : "";
  const [{ data: revision }, { count: fileCount }] = currentRevisionId
    ? await Promise.all([
        admin
          .from("product_portal_revisions")
          .select("id")
          .eq("id", currentRevisionId)
          .eq("portal_id", unit.portal_id)
          .eq("status", "issued")
          .maybeSingle(),
        admin
          .from("product_portal_files")
          .select("id", { count: "exact", head: true })
          .eq("revision_id", currentRevisionId),
      ])
    : [{ data: null }, { count: 0 }];
  if (!revision || !fileCount) {
    await admin.from("product_portal_access_events").insert({
      unit_id: unit.id,
      code_hash: fingerprints.codeHash,
      ip_hash: fingerprints.ipHash,
      user_agent_hash: fingerprints.userAgentHash,
      result: "inactive_release",
    });
    return failure(request, code, "yayin");
  }

  await admin.rpc("reset_product_portal_login_attempt", {
    p_code_hash: fingerprints.codeHash,
    p_ip_hash: fingerprints.ipHash,
  });
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + PORTAL_SESSION_HOURS * 60 * 60 * 1000);
  const { error: sessionError } = await admin.from("product_portal_sessions").insert({
    unit_id: unit.id,
    token_hash: sha256(token),
    password_version: unit.password_version,
    expires_at: expiresAt.toISOString(),
  });
  if (sessionError) return failure(request, code, "yayin");

  await admin.from("product_portal_access_events").insert({
    unit_id: unit.id,
    code_hash: fingerprints.codeHash,
    ip_hash: fingerprints.ipHash,
    user_agent_hash: fingerprints.userAgentHash,
    result: "success",
  });
  const response = NextResponse.redirect(new URL(`/paylas/vinc/${encodeURIComponent(code)}`, request.url), 303);
  response.cookies.set(portalCookieName(code), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/paylas/vinc/${code}`,
    expires: expiresAt,
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/**
 * ÇIKIŞ — oturum SUNUCUDA iptal edilir, sonra çerez silinir.
 *
 * Portal ortak bir bilgisayardan da açılır (şantiye ofisi, müşteri bakım
 * odası). Yalnız çerezi silmek, kopyalanmış bir çerezi 12 saat daha geçerli
 * bırakırdı; oturum satırı `revoked_at` ile kapatılır.
 */
async function logoutPortal(request: Request, rawCode: string): Promise<Response> {
  const code = normalizedPublicCode(rawCode);
  const token = cookieValue(request, portalCookieName(code));
  const admin = createAdminClient();
  if (token) {
    const { data: session } = await admin
      .from("product_portal_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", sha256(token))
      .is("revoked_at", null)
      .select("unit_id")
      .maybeSingle();
    if (session?.unit_id) {
      const fingerprints = portalRequestFingerprints(request, code);
      await admin.from("product_portal_access_events").insert({
        unit_id: session.unit_id,
        code_hash: fingerprints.codeHash,
        ip_hash: fingerprints.ipHash,
        user_agent_hash: fingerprints.userAgentHash,
        result: "logout",
      });
    }
  }
  const response = NextResponse.redirect(
    new URL(`/paylas/vinc/${encodeURIComponent(code)}`, request.url),
    303
  );
  response.cookies.set(portalCookieName(code), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: `/paylas/vinc/${code}`,
    maxAge: 0,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

async function servePortalDocument(
  request: Request,
  rawCode: string,
  documentId: string,
  mode: "content" | "indir"
): Promise<Response> {
  const code = normalizedPublicCode(rawCode);

  /*
   * FİLİGRANLI BELGE ADRES ÇUBUĞUNDAN AÇILAMAZ.
   *
   * "Filigranlı görüntüle" bir indirme engeli olarak sunuluyor ama uç HAM PDF
   * baytı döndürüyor: müşteri ağ sekmesinden adresi kopyalayıp yeni sekmede
   * açtığında tarayıcının kendi görüntüleyicisi açılıyor ve Kaydet çalışıyordu.
   *
   * Tam koruma sayfayı görüntüye çevirmeden mümkün değildir (kullanıcı kararı,
   * 30.08.2026: görüntüye çevirme YOK). Kapatılabilecek olan KOLAY yoldur:
   * `Sec-Fetch-Dest` üst gezinme isteğini (`document`) belge alımından (`empty`)
   * ayırır. Görüntüleyici `fetch` ile çeker → `empty`; adres çubuğu → `document`.
   * Başlığı göndermeyen eski tarayıcılarda kısıtlama uygulanmaz; amaç sızıntıyı
   * kapatmaktır, DRM iddia etmek değil.
   *
   * `indir` kipi BİLEREK muaftır: orada niyet zaten dosyayı vermektir.
   */
  if (mode === "content") {
    const dest = request.headers.get("sec-fetch-dest");
    if (dest === "document" || dest === "iframe" || dest === "object" || dest === "embed") {
      return new Response("Bu belge yalnız müşteri portalı görüntüleyicisinde açılır.", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  }

  const resolved = await resolvePortalDocument(
    code,
    cookieValue(request, portalCookieName(code)),
    documentId
  ).catch(() => null);
  const requiredAccess = mode === "indir" ? "download" : "view_watermarked";
  if (!resolved || resolved.file.accessMode !== requiredAccess) {
    /*
     * REDDEDİLEN ERİŞİM DE BİR OLAYDIR.
     *
     * Yalnız başarılı görüntüleme ve indirme yazılıyordu; oturumu düşmüş ya da
     * başkasının belgesini deneyen bir istek denetim defterinde HİÇ iz
     * bırakmıyordu. Bir sızıntı şüphesinde bakılacak ilk kayıt tam olarak budur.
     */
    const fingerprints = portalRequestFingerprints(request, code);
    await createAdminClient().from("product_portal_access_events").insert({
      unit_id: null,
      code_hash: fingerprints.codeHash,
      ip_hash: fingerprints.ipHash,
      user_agent_hash: fingerprints.userAgentHash,
      result: "document_denied",
      document_id: /^[0-9a-f-]{36}$/i.test(documentId) ? documentId : null,
    });
    return new Response("Belge bulunamadı", { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("customer-portal").download(resolved.file.storagePath);
  if (error || !data) return new Response("Belge açılamadı", { status: 404 });
  const source = new Uint8Array(await data.arrayBuffer());
  let responseBytes = source;
  if (mode === "content") {
    try {
      const stamp = new Date().toLocaleDateString("tr-TR");
      const mark = `MÜŞTERİ PORTALI · ${resolved.session.unit.serialNo} · ${resolved.session.sessionId.slice(0, 8).toUpperCase()} · ${stamp}`;
      const protectedBytes = await protectDrawingPdf(source, mark);
      responseBytes = new Uint8Array(protectedBytes.byteLength);
      responseBytes.set(protectedBytes);
    } catch {
      return new Response("PDF güvenli görüntüleme için hazırlanamadı", { status: 422 });
    }
  }

  const fingerprints = portalRequestFingerprints(request, code);
  await admin.from("product_portal_access_events").insert({
    unit_id: resolved.session.unit.id,
    code_hash: fingerprints.codeHash,
    ip_hash: fingerprints.ipHash,
    user_agent_hash: fingerprints.userAgentHash,
    result: mode === "indir" ? "document_download" : "document_view",
    document_id: documentId,
  });
  const disposition = mode === "indir" ? "attachment" : "inline";
  return new Response(responseBytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": resolved.file.mimeType,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(safeFileName(resolved.file.fileName))}`,
      "Content-Length": String(responseBytes.byteLength),
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function serveDrawing(token: string): Promise<Response> {
  const share = await resolvePublicDrawingShare(token).catch(() => null);
  if (!share) return new Response("Bağlantı bulunamadı veya kapatıldı", { status: 404 });

  const admin = createAdminClient();
  const { data: blob, error } = await admin.storage
    .from("drawings")
    .download(share.storagePath);
  if (error || !blob) return new Response("Dosya açılamadı", { status: 404 });

  try {
    const source = new Uint8Array(await blob.arrayBuffer());
    const mark = `MÜŞTERİ PAYLAŞIMI · ${share.shareId.slice(0, 8).toUpperCase()}`;
    const protectedBytes = await protectDrawingPdf(source, mark);
    const responseBytes = new Uint8Array(protectedBytes.byteLength);
    responseBytes.set(protectedBytes);
    return new Response(responseBytes.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(safeFileName(share.fileName, "teknik-resim.pdf"))}`,
        "Content-Length": String(responseBytes.byteLength),
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response("PDF güvenli görüntüleme için hazırlanamadı", { status: 422 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: ShareRouteParams }
) {
  const { token } = await params;
  const query = request.nextUrl.searchParams;
  const path = externalPortalPath(request);
  const rewrittenAction = path?.length === 4 ? path[3] : null;
  const action = rewrittenAction
    ?? (query.get("portal") === "vinc" ? query.get("action") : null);
  if (action === "cikis") return logoutPortal(request, token);
  if (action !== "giris") return new Response("Bulunamadı", { status: 404 });
  return loginPortal(request, token);
}

export async function GET(
  request: NextRequest,
  { params }: { params: ShareRouteParams }
) {
  const { token } = await params;
  const query = request.nextUrl.searchParams;
  const path = externalPortalPath(request);
  const rewrittenDocument = path?.length === 6 && path[3] === "belge"
    ? { documentId: path[4], action: path[5] }
    : null;
  if (query.get("portal") !== "vinc" && !rewrittenDocument) return serveDrawing(token);
  const action = rewrittenDocument?.action ?? query.get("action");
  const documentId = rewrittenDocument?.documentId ?? query.get("documentId") ?? "";
  if ((action !== "content" && action !== "indir") || !documentId) {
    return new Response("Bulunamadı", { status: 404 });
  }
  return servePortalDocument(request, token, documentId, action);
}
