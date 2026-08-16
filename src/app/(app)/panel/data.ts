// AÇILIŞ PANOSUNUN OKUMA KATMANI.
//
// Panoda gösterilen HER SAYI GERÇEKTİR ve ROLE GÖRE kesilir. İki kural bu
// dosyanın tamamını yönetir:
//
// 1. HİÇBİR ŞEY UYDURULMAZ. Uygulamanın "yer tutucu bir değer değildir"
//    kuralının (AGENTS md. 16) açılış sayfasındaki karşılığı: sıfır sayan bir
//    sinyal listeye hiç girmez, okunamayan bir tablo panoyu düşürmez, boş bir
//    bölüm "henüz kayıt yok" der. Sahte bir "3 yeni bildirim", kullanıcının
//    panoya bir daha bakmaması demektir.
//
// 2. YETKİ İKİ KEZ SORULUR. RLS zaten keser (satış rakamını mühendis okuyamaz)
//    ama kesilmiş bir sorgu BOŞ döner ve ekranda "0 gecikme" gibi görünürdü —
//    yani yokluk, iyi haber sanılırdı. Bu yüzden sorgu ROL SORUSUNDAN GEÇMEDEN
//    hiç çalışmaz ve o bölüm panoda hiç çizilmez.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canSeePersonnel,
  canSeePurchasing,
  canSeeSales,
  canSeeWorkLog,
  isAdminRole,
} from "@/lib/roles";
import { buildPanelHits } from "@/lib/panel-index";
import {
  panelSinyalleri,
  panelTakvim,
  type PanelDate,
  type PanelDay,
  type PanelHit,
  type PanelSignal,
} from "@/lib/panel";

/** Bir bölüm satırının canlı sayacı — "62 iş · 4 aktif" gibi. */
export type SectionCounts = Record<string, string>;

export interface PanelData {
  hits: PanelHit[];
  signals: PanelSignal[];
  days: PanelDay[];
  /** Oturumdaki kişiye atanmış teknik resim grupları */
  mine: { code: string; name: string; status: string; href: string; project: string }[];
  counts: SectionCounts;
}

/**
  * `count: exact, head: true` sorgusunu sayıya çevirir.
  *
  * TABLO YA DA SÜTUN HENÜZ OLMAYABİLİR ve o zaman PANO DÜŞMEZ, sayaç 0 olur
  * (AGENTS md. 21'in "veritabanı sütunu olmayabilir" kuralı). Bir sayacın
  * eksikliği, açılış sayfasının hiç açılmamasından ucuzdur.
  */
async function say(
  sorgu: PromiseLike<{ count: number | null; error: unknown }>
): Promise<number> {
  try {
    const { count, error } = await sorgu;
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

/** `head: true` sayım sorgusu — tekrar eden üç argümanı tek yerde tutar. */
function sayac(supabase: SupabaseClient, tablo: string) {
  return supabase.from(tablo).select("*", { count: "exact", head: true });
}

/**
 * BUGÜN — TÜRKİYE SAATİYLE, sunucunun saatiyle değil.
 *
 * Vercel UTC'de koşar. `new Date().toISOString().slice(0,10)` Türkiye'de gece
 * 00:00–03:00 arasında BİR ÖNCEKİ GÜNÜ verir; panonun "Bugün" bandı, gecikme
 * kıyası ve otuz günlük penceresi o saatlerde bir gün kayardı. Sabahın üçünde
 * atölyeye bakan biri için bu gerçek bir hatadır.
 */
export function bugunIstanbul(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function loadPanel(
  supabase: SupabaseClient,
  opts: { role: string; userId: string; today: string }
): Promise<PanelData> {
  const { role, userId, today } = opts;
  const satis = canSeeSales(role);
  const satinAlma = canSeePurchasing(role);
  const personel = canSeePersonnel(role);
  const isTakibi = canSeeWorkLog(role);
  const yonetici = isAdminRole(role);

  const [
    isler,
    kalemler,
    musteriler,
    projeler,
    paketler,
    grupAdlari,
    benim,
  ] = await Promise.all([
    supabase.from("jobs").select("id, job_no, title, customer, status").order("job_no", { ascending: false }),
    supabase.from("job_items").select("id, job_id, item_no, product_name"),
    supabase.from("customers").select("id, name, short_name"),
    supabase.from("projects").select("id, name, doc_no, status").order("created_at", { ascending: false }),
    supabase.from("drawing_packages").select("id, item_no, group_code, description"),
    supabase.from("drawing_group_names").select("group_code, name"),
    supabase
      .from("project_drawing_plan")
      .select("code, name, status, project_id, projects ( name )")
      .eq("drawn_by", userId)
      .order("code"),
  ]);

  type Job = { id: string; job_no: string; title: string; customer: string; status: string };
  type Item = { id: string; job_id: string; item_no: string; product_name: string };
  type Pkg = { id: string; item_no: string; group_code: string; description: string };

  const jobRows = (isler.data ?? []) as Job[];
  const itemRows = (kalemler.data ?? []) as Item[];
  const pkgRows = (paketler.data ?? []) as Pkg[];

  // ————————————————————————————————————————————— arama defteri
  //
  // DEFTER İSTEMCİYE BÜTÜN OLARAK GİDER ve süzme orada yapılır (İşler ve Satış
  // listeleriyle aynı gerekçe): satır sayısı yüzlerle ölçülür, her tuş
  // vuruşunda sunucuya gitmek aramayı yavaş ve pahalı yapardı.
  //
  // HIT ÜRETİMİ ARTIK ORTAK ÇEKİRDEKTE (`lib/panel-index.ts`): komut paleti
  // (Ctrl+K) aynı defteri kurar — iki üretici zamanla ayrışırdı.
  const hits: PanelHit[] = buildPanelHits({
    jobs: jobRows,
    items: itemRows,
    customers: (musteriler.data ?? []) as { id: string; name: string; short_name: string }[],
    projects: (projeler.data ?? []) as { id: string; name: string; doc_no: string; status: string }[],
    packages: pkgRows,
    groupNames: (grupAdlari.data ?? []) as { group_code: string; name: string }[],
    isAdmin: yonetici,
  });

  // ————————————————————————————————————————————— sinyaller + takvim
  const signals: PanelSignal[] = [];
  const dates: PanelDate[] = [];

  if (satis) {
    const { data: satislar } = await supabase
      .from("job_item_sales")
      .select("job_item_id, unit_price, due_date, shipment_date");
    type Sale = {
      job_item_id: string;
      unit_price: number | null;
      due_date: string | null;
      shipment_date: string | null;
    };
    const saleRows = (satislar ?? []) as Sale[];
    const fiyatli = new Set(saleRows.filter((s) => s.unit_price !== null).map((s) => s.job_item_id));
    const fiyatsiz = itemRows.filter((i) => !fiyatli.has(i.id)).length;

    signals.push({
      key: "sales-unpriced",
      count: fiyatsiz,
      label: "iş kaleminin fiyatı girilmedi",
      href: "/sales",
      tone: "bilgi",
    });

    const kalemAdi = new Map(itemRows.map((i) => [i.id, i]));
    for (const s of saleRows) {
      const kalem = kalemAdi.get(s.job_item_id);
      if (!kalem) continue;
      if (s.due_date) {
        dates.push({
          date: s.due_date,
          kind: "Termin",
          label: kalem.item_no,
          hint: kalem.product_name,
          href: "/sales",
        });
      }
      if (s.shipment_date) {
        dates.push({
          date: s.shipment_date,
          kind: "Sevk",
          label: kalem.item_no,
          hint: kalem.product_name,
          href: "/sales",
        });
      }
    }
  }

  if (satinAlma) {
    // İPTAL `cancelled_at` iledir, bir `status` sütunu YOKTUR (canlı şemada
    // doğrulandı). İptal edilmiş sipariş ne gecikir ne beklenir.
    const { data: siparisler } = await supabase
      .from("purchase_orders")
      .select("id, order_no, supplier, due_at, received_at, cancelled_at");
    type Order = {
      id: string;
      order_no: string;
      supplier: string;
      due_at: string | null;
      received_at: string | null;
      cancelled_at: string | null;
    };
    const acik = ((siparisler ?? []) as Order[]).filter(
      (o) => !o.received_at && !o.cancelled_at
    );

    signals.push({
      key: "po-overdue",
      count: acik.filter((o) => o.due_at && o.due_at < today).length,
      label: "siparişin termini geçti, teslim alınmadı",
      href: "/purchasing/teslimat",
      tone: "uyari",
    });

    for (const o of acik) {
      if (!o.due_at) continue;
      dates.push({
        date: o.due_at,
        kind: "Teslim",
        label: o.order_no || o.supplier,
        hint: o.order_no ? o.supplier : undefined,
        href: "/purchasing/teslimat",
      });
    }
  }

  // TEKNİK RESİM İŞARETİ HERKESE AÇIKTIR — okuma zaten `true` (md. 18) ve
  // "yeni revizyonda değişmiş bir parçayı atölye hâlâ kesilmiş sayıyor"
  // sorusu mühendisi de ressamı de ilgilendirir.
  signals.push({
    key: "review",
    count: await say(sayac(supabase, "drawing_part_progress").eq("review_required", true)),
    label: "üretim kaydı revizyon sonrası kontrol bekliyor",
    href: "/drawings",
    tone: "uyari",
  });

  if (personel) {
    const otuzGun = new Date(`${today}T00:00:00Z`);
    otuzGun.setUTCDate(otuzGun.getUTCDate() + 30);
    const sinir = otuzGun.toISOString().slice(0, 10);
    signals.push({
      key: "doc-expiry",
      count: await say(sayac(supabase, "hr_employee_documents").lte("expires_on", sinir)),
      label: "personel belgesinin süresi doldu ya da 30 gün içinde doluyor",
      href: "/personnel",
      tone: "uyari",
    });
  }

  // ————————————————————————————————————————————— bölüm sayaçları
  const counts: SectionCounts = {};
  const aktifIs = jobRows.filter((j) => j.status === "active").length;
  counts["/jobs"] = `${jobRows.length} iş · ${aktifIs} aktif`;
  counts["/projects"] = `${(projeler.data ?? []).length} rapor`;
  counts["/drawings"] = `${pkgRows.length} paket`;
  if (satinAlma) {
    counts["/purchasing"] = `${await say(
      sayac(supabase, "purchase_orders").is("received_at", null).is("cancelled_at", null)
    )} açık sipariş`;
  }
  if (isTakibi) {
    counts["/worklog"] = `${await say(
      sayac(supabase, "work_logs").gte("work_date", `${today.slice(0, 7)}-01`)
    )} kayıt · bu ay`;
  }
  if (satis) counts["/sales"] = `${itemRows.length} kalem`;
  if (personel) {
    // AÇIK DÖNEM = çalışıyor. Sütun `end_date`tir (`ended_on` DEĞİL — canlı
    // şemada doğrulandı); kişi bir kez daha işe girmiş olabilir, o yüzden
    // sayılan kişi değil AÇIK DÖNEMdir ve aynı anda en fazla bir tane olabilir.
    counts["/personnel"] = `${await say(
      sayac(supabase, "hr_employment").is("end_date", null)
    )} çalışan`;
  }
  if (yonetici) {
    counts["/admin"] = `${await say(sayac(supabase, "profiles"))} kullanıcı`;
  }

  // ————————————————————————————————————————————— sana ait
  type Plan = {
    code: string;
    name: string;
    status: string;
    project_id: string;
    projects?: { name?: string } | { name?: string }[] | null;
  };
  const mine = ((benim.data ?? []) as Plan[]).map((p) => {
    const proje = Array.isArray(p.projects) ? p.projects[0] : p.projects;
    return {
      code: p.code,
      name: p.name,
      status: p.status,
      project: proje?.name ?? "",
      href: `/projects/${p.project_id}`,
    };
  });

  return {
    hits,
    signals: panelSinyalleri(signals),
    days: panelTakvim(dates, today),
    mine,
    counts,
  };
}
