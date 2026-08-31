"use server";

// EL KİTABI DEFTERLERİ — panel katmanının yazma yüzü.
//
// KOD KURALI SİLİNMEZ, ÜZERİNE BİNİLİR. "Bu kuralı değiştir" bir override
// satırı doğurur; "Öntanıma dön" o satırı siler ve kod kuralı yeniden
// geçerli olur. Kod defterini panelden silebilmek, standardına dayanan bir
// bakım görevinin izsiz kaybolması demekti.
//
// KAPATMAK SİLMEK DEĞİLDİR: `disabled` bir override satırıdır ve kararın izini
// bırakır (kim, ne zaman). Silinen bir kural neden silindiğini söylemez.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canEditReports } from "@/lib/roles";
import { withManualDefaults } from "@/lib/manual/payload";

export type BookResult = { ok?: boolean; error?: string };

async function yetki(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };
  const { data: profil } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!canEditReports((profil as { role?: string } | null)?.role)) {
    return { error: "El kitabı defterlerini düzenleme yetkiniz yok." };
  }
  return { userId: user.id };
}

function tazele() {
  revalidatePath("/admin/manual");
}

// ————————————————————————————————————————————————————— bakım kuralları

const bakimSemasi = z.object({
  ruleId: z
    .string()
    .trim()
    .min(1, "Kural kimliği gerekli")
    .max(60)
    // Kimlik kod defterindeki kimliklerle AYNI dilbilgisini taşır: harf ve
    // rakam. Boşluklu bir kimlik iki yerde farklı yazılır ve eşleşme kopar.
    .regex(/^[A-Za-z][A-Za-z0-9]*$/, "Kimlik harfle başlamalı, yalnız harf ve rakam içermeli"),
  matchPattern: z.string().trim().max(200).default(""),
  part: z.string().trim().max(160).default(""),
  task: z.string().trim().max(600).default(""),
  person: z.enum(["", "F", "E", "MA", "I"]).default(""),
  freq: z.enum(["", "d", "w", "2w", "m", "2m", "y", "2y"]).default(""),
  state: z.enum(["", "R", "AR", "LR"]).default(""),
  basis: z.string().trim().max(200).default(""),
  minGroup: z.string().trim().max(8).default(""),
  disabled: z.boolean().default(false),
  sort: z.number().int().min(0).max(9999).default(0),
});

export async function saveManualMaintenanceRule(
  input: z.input<typeof bakimSemasi>
): Promise<BookResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const parsed = bakimSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("manual_maintenance_rules").upsert(
    {
      rule_id: d.ruleId,
      match_pattern: d.matchPattern,
      part: d.part,
      task: d.task,
      person: d.person,
      freq: d.freq,
      state: d.state,
      basis: d.basis,
      min_group: d.minGroup,
      disabled: d.disabled,
      sort: d.sort,
      created_by: izin.userId,
    },
    { onConflict: "rule_id" }
  );
  if (error) return { error: error.message };
  tazele();
  return { ok: true };
}

/** Override satırını siler — kod kuralı yeniden geçerli olur. */
export async function resetManualMaintenanceRule(ruleId: string): Promise<BookResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();
  const { error } = await supabase
    .from("manual_maintenance_rules")
    .delete()
    .eq("rule_id", ruleId);
  if (error) return { error: error.message };
  tazele();
  return { ok: true };
}

// —————————————————————————————————————————————————— yağlama noktaları

const yaglamaSemasi = z.object({
  pointId: z
    .string()
    .trim()
    .min(1, "Nokta kimliği gerekli")
    .max(60)
    .regex(/^[A-Za-z][A-Za-z0-9]*$/, "Kimlik harfle başlamalı, yalnız harf ve rakam içermeli"),
  matchPattern: z.string().trim().max(200).default(""),
  place: z.string().trim().max(160).default(""),
  klass: z.string().trim().max(200).default(""),
  basis: z.string().trim().max(200).default(""),
  disabled: z.boolean().default(false),
  sort: z.number().int().min(0).max(9999).default(0),
});

export async function saveManualLubricationPoint(
  input: z.input<typeof yaglamaSemasi>
): Promise<BookResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const parsed = yaglamaSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("manual_lubrication_points").upsert(
    {
      point_id: d.pointId,
      match_pattern: d.matchPattern,
      place: d.place,
      klass: d.klass,
      basis: d.basis,
      disabled: d.disabled,
      sort: d.sort,
      created_by: izin.userId,
    },
    { onConflict: "point_id" }
  );
  if (error) return { error: error.message };
  tazele();
  return { ok: true };
}

export async function resetManualLubricationPoint(pointId: string): Promise<BookResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();
  const { error } = await supabase
    .from("manual_lubrication_points")
    .delete()
    .eq("point_id", pointId);
  if (error) return { error: error.message };
  tazele();
  return { ok: true };
}

// ———————————————————————————————————————————————————— metin parçaları

const parcaSemasi = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1, "Başlık gerekli").max(160),
  category: z.string().trim().max(80).default(""),
  sectionHint: z.string().trim().max(120).default(""),
  block: z.unknown(),
});

/**
 * Metin parçasını kaydeder.
 *
 * GELEN BLOK OLDUĞU GİBİ YAZILMAZ (KITAP-10 ilkesi): çekirdeğin okuyucusundan
 * geçirilir ve tanınmayan bir şekil REDDEDİLİR. Serbest JSON'u doğrudan
 * yazmak, defteri bir daha açılmaz yapabilirdi.
 */
export async function saveManualSnippet(
  input: z.input<typeof parcaSemasi>
): Promise<BookResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const parsed = parcaSemasi.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const okunan = withManualDefaults({
    sections: [{ id: "s", title: "", blocks: [parsed.data.block], children: [] }],
  });
  const blok = okunan.sections[0]?.blocks[0];
  if (!blok) return { error: "Tanınmayan blok; parça kaydedilmedi." };

  const supabase = await createClient();
  const govde = {
    title: parsed.data.title,
    category: parsed.data.category,
    section_hint: parsed.data.sectionHint,
    block: blok,
    created_by: izin.userId,
  };
  const { error } = parsed.data.id
    ? await supabase.from("manual_snippets").update(govde).eq("id", parsed.data.id)
    : await supabase.from("manual_snippets").insert(govde);
  if (error) return { error: error.message };
  tazele();
  return { ok: true };
}

export async function deleteManualSnippet(id: string): Promise<BookResult> {
  const izin = await yetki();
  if ("error" in izin) return izin;
  const supabase = await createClient();
  const { error } = await supabase.from("manual_snippets").delete().eq("id", id);
  if (error) return { error: error.message };
  tazele();
  return { ok: true };
}
