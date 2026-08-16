// ARAMA DEFTERİ KURUCUSU — panonun ve komut paletinin ORTAK çekirdeği (saf).
//
// Hit üretimi bir süre `panel/data.ts`in içindeydi; komut paleti (Ctrl+K)
// aynı defteri isteyince buraya çıkarıldı — iki üretici, "panoda bulunan
// paletede bulunamıyor" ayrışmasının en kısa yoluydu. Sorgu katmanları ayrı
// kalabilir (basit select'ler); KIRILGAN olan şey satırın nasıl hit'e
// dönüştüğüdür (kod, ipucu, adres kuralları) ve o artık TEK yerdedir.
//
// PARÇA DEFTERİ LİSTEYE GİRMEZ (bilinçli sınır): bugün üç pakette 490 parça
// var, yirmi pakette on binleri bulur ve defteri taşınamaz yapar. Parçanın
// yerine ANA GRUP adları girer — atölyenin aradığı da zaten gruptur.

import { jobStatusLabel } from "@/lib/job-status";
import type { PanelHit } from "@/lib/panel";

export interface PanelIndexInput {
  jobs: { id: string; job_no: string; title: string; customer: string; status: string }[];
  items: { id: string; job_id: string; item_no: string; product_name: string }[];
  customers: { id: string; name: string; short_name: string }[];
  projects: { id: string; name: string; doc_no: string; status: string }[];
  packages: { id: string; item_no: string; group_code: string; description: string }[];
  groupNames: { group_code: string; name: string }[];
  /** Müşteri satırının adresi yönetici olup olmamaya göre değişir. */
  isAdmin: boolean;
}

export function buildPanelHits(input: PanelIndexInput): PanelHit[] {
  const hits: PanelHit[] = [];
  const { jobs, items, customers, projects, packages, groupNames, isAdmin } = input;

  for (const j of jobs) {
    hits.push({
      kind: "job",
      code: j.job_no,
      label: j.title,
      hint: `${j.customer} · ${jobStatusLabel(j.status)}`,
      href: `/jobs/${j.id}`,
    });
  }
  for (const i of items) {
    const is = jobs.find((j) => j.id === i.job_id);
    hits.push({
      kind: "item",
      code: i.item_no,
      label: i.product_name,
      // MÜŞTERİ DE İPUCUNA GİRER ve bu bir süs değil: sorgu parçalarının hepsi
      // TEK satırda geçmek zorundadır, yani müşteri yazılmasa "astor pergel"
      // hiçbir kalemi bulamazdı — müşteri işin satırında, ürün adı kalemin
      // satırındaydı. Tarayıcıda ölçüldü.
      hint: [is?.title, is?.customer].filter(Boolean).join(" · ") || undefined,
      href: `/jobs/${i.job_id}`,
    });
  }
  for (const c of customers) {
    hits.push({
      kind: "customer",
      code: c.short_name || "",
      label: c.name,
      hint: `${jobs.filter((j) => j.customer === c.name).length} iş`,
      // Müşteri defteri yönetimdedir ama aranan şey çoğu zaman "bu müşterinin
      // işleri"dir; yönetici olmayan biri deftere zaten giremez.
      href: isAdmin ? "/admin/customers" : "/jobs",
    });
  }
  for (const p of projects) {
    hits.push({
      kind: "project",
      code: p.doc_no || "",
      label: p.name,
      hint: p.status === "archived" ? "Arşiv" : undefined,
      href: `/projects/${p.id}`,
    });
  }
  for (const p of packages) {
    hits.push({
      kind: "package",
      code: [p.item_no, p.group_code].filter(Boolean).join("-"),
      label: p.description || p.item_no,
      href: `/drawings/${p.id}`,
    });
  }
  for (const g of groupNames) {
    // Ad kodun kendisiyse defter adı çözememiş demektir; arama sonucunda aynı
    // kodu iki kez basmak bilgi değil gürültüdür (üretim tahtasıyla aynı kural).
    if (!g.name || g.name === g.group_code) continue;
    const paket = packages.find((p) => g.group_code.startsWith(p.item_no));
    hits.push({
      kind: "group",
      code: g.group_code,
      label: g.name,
      hint: paket?.description,
      href: paket ? `/drawings/${paket.id}/parts` : "/drawings",
    });
  }

  return hits;
}
