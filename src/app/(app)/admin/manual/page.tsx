// EL KİTABI DEFTERLERİ — bakım kuralları · yağlama noktaları · metin parçaları.
//
// İKİ KATMAN BİR ARADA GÖSTERİLİR. Kod defteri (standart dayanaklı, sürümlü)
// salt okunur satırlar olarak listede DURUR; "Değiştir" bir override satırı
// doğurur ve satırın kaynağı "Defter"e döner. Kod kurallarını gizleseydik
// kullanıcı neyin zaten geçerli olduğunu göremez ve aynı görevi ikinci kez
// yazardı.

import { createClient } from "@/lib/supabase/server";
import { MAINTENANCE_RULE_BOOK, mergeMaintenanceRules } from "@/lib/manual/maintenance-rules";
import { LUBRICATION_POINT_BOOK, mergeLubricationPoints } from "@/lib/manual/lubrication-rules";
import { loadManualSnippets } from "@/lib/manual/books-data";
import { ManualBooksView, type BakimSatiri, type YaglamaSatiri } from "./manual-books-view";

export const dynamic = "force-dynamic";

export default async function AdminManualBooksPage() {
  const supabase = await createClient();

  const [bakimSonuc, yaglamaSonuc, parcalar] = await Promise.all([
    supabase
      .from("manual_maintenance_rules")
      .select(
        "rule_id, match_pattern, part, task, person, freq, state, basis, min_group, disabled, sort"
      )
      .order("sort", { ascending: true }),
    supabase
      .from("manual_lubrication_points")
      .select("point_id, match_pattern, place, klass, basis, disabled, sort")
      .order("sort", { ascending: true }),
    loadManualSnippets(supabase),
  ]);

  const bakimPanel = new Map<string, Record<string, unknown>>();
  for (const r of (bakimSonuc.data ?? []) as Record<string, unknown>[]) {
    bakimPanel.set(String(r.rule_id), r);
  }
  const yaglamaPanel = new Map<string, Record<string, unknown>>();
  for (const r of (yaglamaSonuc.data ?? []) as Record<string, unknown>[]) {
    yaglamaPanel.set(String(r.point_id), r);
  }

  // GEÇERLİ HÂL, panelin kendisi değil, BİRLEŞİMİ gösterir: kullanıcı listede
  // belgede basılacak satırı görmelidir.
  const birlesikBakim = mergeMaintenanceRules(
    MAINTENANCE_RULE_BOOK,
    [...bakimPanel.values()].map((r) => ({
      id: String(r.rule_id),
      ...(r.match_pattern ? { match: String(r.match_pattern) } : {}),
      ...(r.part ? { part: String(r.part) } : {}),
      ...(r.task ? { task: String(r.task) } : {}),
      ...(r.person ? { person: r.person } : {}),
      ...(r.freq ? { freq: r.freq } : {}),
      ...(r.state ? { state: r.state } : {}),
      ...(r.basis ? { basis: String(r.basis) } : {}),
      ...(r.min_group ? { minGroup: String(r.min_group) } : {}),
      ...(r.disabled === true ? { disabled: true } : {}),
    })) as never
  );

  const kodBakim = new Set(MAINTENANCE_RULE_BOOK.map((r) => r.id));
  const bakimSatirlari: BakimSatiri[] = [
    ...MAINTENANCE_RULE_BOOK.map((k) => k.id),
    ...[...bakimPanel.keys()].filter((id) => !kodBakim.has(id)),
  ].map((id) => {
    const panel = bakimPanel.get(id);
    const gecerli = birlesikBakim.find((r) => r.id === id);
    const kodKurali = MAINTENANCE_RULE_BOOK.find((r) => r.id === id);
    return {
      id,
      kodda: Boolean(kodKurali),
      defterde: Boolean(panel),
      kapali: panel?.disabled === true,
      match: gecerli?.match ?? kodKurali?.match ?? String(panel?.match_pattern ?? ""),
      part: gecerli?.part ?? String(panel?.part ?? ""),
      task: gecerli?.task ?? String(panel?.task ?? ""),
      person: gecerli?.person ?? String(panel?.person ?? ""),
      freq: gecerli?.freq ?? String(panel?.freq ?? ""),
      state: gecerli?.state ?? String(panel?.state ?? ""),
      basis: gecerli?.basis ?? String(panel?.basis ?? ""),
      minGroup: gecerli?.minGroup ?? String(panel?.min_group ?? ""),
      sort: Number(panel?.sort ?? 0),
    };
  });

  const birlesikYaglama = mergeLubricationPoints(
    LUBRICATION_POINT_BOOK,
    [...yaglamaPanel.values()].map((r) => ({
      id: String(r.point_id),
      ...(r.match_pattern ? { match: String(r.match_pattern) } : {}),
      ...(r.place ? { place: String(r.place) } : {}),
      ...(r.klass ? { klass: String(r.klass) } : {}),
      ...(r.basis ? { basis: String(r.basis) } : {}),
      ...(r.disabled === true ? { disabled: true } : {}),
    })) as never
  );

  const kodYaglama = new Set(LUBRICATION_POINT_BOOK.map((r) => r.id));
  const yaglamaSatirlari: YaglamaSatiri[] = [
    ...LUBRICATION_POINT_BOOK.map((r) => r.id),
    ...[...yaglamaPanel.keys()].filter((id) => !kodYaglama.has(id)),
  ].map((id) => {
    const panel = yaglamaPanel.get(id);
    const gecerli = birlesikYaglama.find((r) => r.id === id);
    const kodNoktasi = LUBRICATION_POINT_BOOK.find((r) => r.id === id);
    return {
      id,
      kodda: Boolean(kodNoktasi),
      defterde: Boolean(panel),
      kapali: panel?.disabled === true,
      match: gecerli?.match ?? kodNoktasi?.match ?? String(panel?.match_pattern ?? ""),
      place: gecerli?.place ?? String(panel?.place ?? ""),
      klass: gecerli?.klass ?? String(panel?.klass ?? ""),
      basis: gecerli?.basis ?? String(panel?.basis ?? ""),
      sort: Number(panel?.sort ?? 0),
    };
  });

  return (
    <ManualBooksView
      bakim={bakimSatirlari}
      yaglama={yaglamaSatirlari}
      parcalar={parcalar.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        sectionHint: p.sectionHint,
        kind: p.block.kind,
      }))}
      hata={bakimSonuc.error?.message ?? yaglamaSonuc.error?.message ?? ""}
    />
  );
}
