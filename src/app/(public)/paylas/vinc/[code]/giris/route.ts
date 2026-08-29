import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PORTAL_SESSION_HOURS,
  PUBLIC_CODE_PATTERN,
  normalizedPublicCode,
  portalCookieName,
  portalRequestFingerprints,
} from "@/lib/product-portal/access-server";
import {
  hashPortalPassword,
  newSessionToken,
  sha256,
  verifyPortalPassword,
} from "@/lib/product-portal/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(request: Request, code: string, status = 303) {
  const url = new URL(`/paylas/vinc/${encodeURIComponent(code)}`, request.url);
  url.searchParams.set("hata", "1");
  return NextResponse.redirect(url, status);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = normalizedPublicCode(rawCode);
  if (!PUBLIC_CODE_PATTERN.test(code)) return failure(request, code);
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
    const response = failure(request, code, 303);
    response.headers.set("Retry-After", String(Math.max(1, Number(rate?.retry_after ?? 900))));
    return response;
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const { data: unit } = await admin
    .from("crane_units")
    .select("id, password_salt, password_hash, password_version, portal_enabled")
    .eq("public_code", code)
    .eq("portal_enabled", true)
    .maybeSingle();

  // Bilinmeyen kod da bir scrypt çalıştırır; zaman farkı portal varlığını açık
  // etmesin. Kota bundan ÖNCE tüketildiği için CPU kötüye kullanımına açık değildir.
  let valid = false;
  if (unit?.password_salt && unit.password_hash) {
    valid = await verifyPortalPassword(password, unit.password_salt, unit.password_hash);
  } else {
    await hashPortalPassword(password.length >= 8 && Buffer.byteLength(password, "utf8") <= 128
      ? password
      : "gecersiz-portal-parolasi");
  }
  if (!unit || !valid) {
    await admin.from("product_portal_access_events").insert({
      unit_id: unit?.id ?? null,
      code_hash: fingerprints.codeHash,
      ip_hash: fingerprints.ipHash,
      user_agent_hash: fingerprints.userAgentHash,
      result: "invalid",
    });
    return failure(request, code);
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
  if (sessionError) return failure(request, code);

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
