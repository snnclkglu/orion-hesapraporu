import "server-only";

// FİRMA KÜNYESİ MÜŞTERİ DEFTERİNDEN OKUNUR.
//
// Kullanıcı kararı (01.09.2026): belgelerdeki üretici/partner künyesi
// `app_settings.report`taki serbest metinlerden değil, `customers` defterinden
// gelir — "kendi firmamız" da orada bir kayıttır (`is_self`). Böylece adres,
// vergi no ve logo TEK yerde durur; teklif akışının `payload.issuer`
// snapshot'ı ile aynı desendir.
//
// SNAPSHOT KURALI DEĞİŞMEZ: okuyan taraf değerleri belgeye KOPYALAR
// (`ManualIdentity`), defterde sonradan yapılan bir düzeltme teslim edilmiş
// bir kılavuzu değiştirmez (KITAP-2).
//
// ————————————————————————————— MIGRATION'DAN ÖNCE DE ÇALIŞIR
//
// `is_self`, `email` ve `web` sütunları `20260901000001` ile gelir. Migration
// uygulanmadan önce bu sütunları isteyen bir `select` PostgREST'te 42703 ile
// düşer ve el kitabı editörü AÇILMAZ. Bir sütun eksikliği yüzünden bütün
// ekranın 500 vermesi kabul edilemez: okuyucu bir kez eski sütun kümesiyle
// yeniden dener, bayrağı hatırlar ve firma seçicisi eksik alanlarla (ama
// çalışır hâlde) gelir.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Belgeye basılabilen firma künyesi. Bilinmeyen alan BOŞ metindir. */
export interface CustomerCompany {
  id: string;
  name: string;
  shortName: string;
  address: string;
  taxOffice: string;
  taxNo: string;
  phone: string;
  fax: string;
  email: string;
  web: string;
  /** Logo yüklenmiş mi — baytlar ayrı uçlardan çözülür. */
  hasLogo: boolean;
  /** Bu kayıt BİZİM firmamız mı (`customers.is_self`). */
  isSelf: boolean;
}

const YENI_SUTUNLAR =
  "id, name, short_name, address, tax_office, tax_no, phone, fax, logo_path, is_self, email, web";
const ESKI_SUTUNLAR = "id, name, short_name, address, tax_office, tax_no, phone, fax, logo_path";

/** Migration uygulandı mı — ilk başarısız okumadan sonra hatırlanır. */
let yeniSutunlarVar = true;

function satirdan(row: Record<string, unknown> | null): CustomerCompany | null {
  if (!row) return null;
  const metin = (key: string) => String(row[key] ?? "").trim();
  return {
    id: String(row.id),
    name: metin("name"),
    shortName: metin("short_name"),
    address: metin("address"),
    taxOffice: metin("tax_office"),
    taxNo: metin("tax_no"),
    phone: metin("phone"),
    fax: metin("fax"),
    email: metin("email"),
    web: metin("web"),
    hasLogo: metin("logo_path").length > 0,
    isSelf: row.is_self === true,
  };
}

/**
 * Defter sorgusunu önce yeni, gerekirse eski sütun kümesiyle koşturur.
 *
 * `kurgu` sorguyu kurar; `is_self` süzgeci ancak sütun varsa uygulanabilir,
 * o yüzden süzgeç de çağırana bırakılır.
 */
async function defterSorgusu(
  kurgu: (sutunlar: string, yeniSurum: boolean) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<Record<string, unknown>[]> {
  if (yeniSutunlarVar) {
    const { data, error } = await kurgu(YENI_SUTUNLAR, true);
    if (!error) return (data ?? []) as Record<string, unknown>[];
    yeniSutunlarVar = false;
  }
  const { data } = await kurgu(ESKI_SUTUNLAR, false);
  return (data ?? []) as Record<string, unknown>[];
}

/**
 * "Kendi firmamız" kaydı (`customers.is_self`).
 *
 * ADA GÖRE ARANMAZ: unvan bir kez küçük "i" ile yazılıp sonra düzeltildi ve
 * Türkçe ı/I tuzağı yüzünden desen eşlemesi güvenilir değildir. Yalnız sütun
 * henüz yoksa (migration uygulanmadan) kısaltmaya düşülür — ve kısaltma
 * `short_name` alanıdır, serbest metin değil.
 */
export async function loadSelfCompany(
  supabase: SupabaseClient
): Promise<CustomerCompany | null> {
  const rows = await defterSorgusu((sutunlar, yeniSurum) =>
    yeniSurum
      ? supabase.from("customers").select(sutunlar).eq("is_self", true).limit(1)
      : supabase.from("customers").select(sutunlar).eq("short_name", "ORION").limit(1)
  );
  return satirdan(rows[0] ?? null);
}

/** Defterdeki tek firmanın künyesi. */
export async function loadCustomerCompany(
  supabase: SupabaseClient,
  customerId: string | null | undefined
): Promise<CustomerCompany | null> {
  if (!customerId) return null;
  const rows = await defterSorgusu((sutunlar) =>
    supabase.from("customers").select(sutunlar).eq("id", customerId).limit(1)
  );
  return satirdan(rows[0] ?? null);
}

/** Firma seçicisinin defteri — ad, kısaltma ve logo VARLIĞI; bayt taşımaz. */
export async function loadCustomerBook(
  supabase: SupabaseClient
): Promise<CustomerCompany[]> {
  const rows = await defterSorgusu((sutunlar) =>
    supabase.from("customers").select(sutunlar).order("name", { ascending: true })
  );
  return rows
    .map(satirdan)
    .filter((entry): entry is CustomerCompany => entry !== null);
}
