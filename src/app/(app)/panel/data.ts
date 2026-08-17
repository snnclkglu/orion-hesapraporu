// AÇILIŞ PANOSUNUN OKUMA KATMANI — BÖLÜM BAŞINA BİR FONKSİYON.
//
// Panoda gösterilen HER SAYI GERÇEKTİR ve ROLE GÖRE kesilir. İki kural bu
// dosyanın tamamını yönetir:
//
// 1. HİÇBİR ŞEY UYDURULMAZ. Uygulamanın "yer tutucu bir değer değildir"
//    kuralının (AGENTS SATIS-16) açılış sayfasındaki karşılığı: sıfır sayan bir
//    sinyal listeye hiç girmez, okunamayan bir tablo panoyu düşürmez, boş bir
//    bölüm "henüz kayıt yok" der. Sahte bir "3 yeni bildirim", kullanıcının
//    panoya bir daha bakmaması demektir.
//
// 2. YETKİ İKİ KEZ SORULUR. RLS zaten keser (satış rakamını mühendis okuyamaz)
//    ama kesilmiş bir sorgu BOŞ döner ve ekranda "0 gecikme" gibi görünürdü —
//    yani yokluk, iyi haber sanılırdı. Bu yüzden sorgu ROL SORUSUNDAN GEÇMEDEN
//    hiç çalışmaz ve o bölüm panoda hiç çizilmez.
//
// Fonksiyonlar BÖLÜM BAŞINA ayrıdır: her bölüm kendi Suspense sınırının
// arkasında kendi verisini çeker (loaders.tsx), biri yavaşsa diğerleri
// beklemez, biri düşerse yalnız o bölüm "okunamadı" der. Arama defteri artık
// burada DEĞİL: istemci `/api/command-index`ten çeker ve paletle paylaşır
// (`lib/command-index-store.ts`) — defter RSC yüküyle her ziyarette taşınmaz.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canSeePersonnel,
  canSeePurchasing,
  canSeeSales,
  canSeeWorkLog,
  isAdminRole,
} from "@/lib/roles";
import {
  panelSinyalleri,
  type PanelDate,
  type PanelSignal,
} from "@/lib/panel";
import { configToPrefs, type PanelPrefs } from "@/lib/panel-prefs";

/** Bir bölüm satırının canlı sayacı — "62 iş · 4 aktif" gibi. */
export type SectionCounts = Record<string, string>;

/** "Sana ait" teknik resim grubu satırı. */
export interface MineRow {
  code: string;
  name: string;
  status: string;
  href: string;
  project: string;
}

/**
  * `count: exact, head: true` sorgusunu sayıya çevirir.
  *
  * TABLO YA DA SÜTUN HENÜZ OLMAYABİLİR ve o zaman PANO DÜŞMEZ, sayaç 0 olur
  * (AGENTS SATIN-21'in "veritabanı sütunu olmayabilir" kuralı). Bir sayacın
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

// ————————————————————————————————————————————— tercih

/**
 * Bölüm tercihleri — KRİTİK YOLDA okunur (PK'den tek satır, ucuz): gizli
 * bölümün loader'ı hiç kurulmaz, sorgusu hiç koşmaz. Bozuk kayıt varsayılana
 * döner (saf çekirdek), sayfa asla düşmez.
 */
export async function loadPanelPrefs(
  supabase: SupabaseClient,
  userId: string
): Promise<PanelPrefs> {
  try {
    const { data } = await supabase
      .from("user_panel_prefs")
      .select("config")
      .eq("user_id", userId)
      .maybeSingle();
    return configToPrefs((data as { config?: unknown } | null)?.config);
  } catch {
    return configToPrefs(null);
  }
}

// ————————————————————————————————————————————— Çalışma Alanı sayaçları

/**
 * Bölüm satırlarının canlı sayaçları. Hepsi `head: true` sayımdır — defter
 * satırı için satır çekmek gerekmez. (Eskiden sayılar arama defterinin
 * satırlarından türetiliyordu; defter istemciye taşınınca sayaçlar kendi
 * sayımına döndü.)
 */
export async function loadCounts(
  supabase: SupabaseClient,
  opts: { role: string; today: string }
): Promise<SectionCounts> {
  const { role, today } = opts;
  const satis = canSeeSales(role);
  const satinAlma = canSeePurchasing(role);
  const personel = canSeePersonnel(role);
  const isTakibi = canSeeWorkLog(role);
  const yonetici = isAdminRole(role);

  const [
    isSayisi,
    aktifIs,
    raporSayisi,
    paketSayisi,
    kalemSayisi,
    acikSiparis,
    kayitBuAy,
    calisan,
    kullanici,
  ] = await Promise.all([
    say(sayac(supabase, "jobs")),
    say(sayac(supabase, "jobs").eq("status", "active")),
    say(sayac(supabase, "projects")),
    say(sayac(supabase, "drawing_packages")),
    satis ? say(sayac(supabase, "job_items")) : null,
    satinAlma
      ? say(sayac(supabase, "purchase_orders").is("received_at", null).is("cancelled_at", null))
      : null,
    isTakibi
      ? say(sayac(supabase, "work_logs").gte("work_date", `${today.slice(0, 7)}-01`))
      : null,
    personel
      ? // AÇIK DÖNEM = çalışıyor. Sütun `end_date`tir (`ended_on` DEĞİL — canlı
        // şemada doğrulandı); kişi bir kez daha işe girmiş olabilir, o yüzden
        // sayılan kişi değil AÇIK DÖNEMdir ve aynı anda en fazla bir tane olur.
        say(sayac(supabase, "hr_employment").is("end_date", null))
      : null,
    yonetici ? say(sayac(supabase, "profiles")) : null,
  ]);

  const counts: SectionCounts = {};
  counts["/jobs"] = `${isSayisi} iş · ${aktifIs} aktif`;
  counts["/projects"] = `${raporSayisi} rapor`;
  counts["/drawings"] = `${paketSayisi} paket`;
  if (kalemSayisi !== null) counts["/sales"] = `${kalemSayisi} kalem`;
  if (acikSiparis !== null) counts["/purchasing"] = `${acikSiparis} açık sipariş`;
  if (kayitBuAy !== null) counts["/worklog"] = `${kayitBuAy} kayıt · bu ay`;
  if (calisan !== null) counts["/personnel"] = `${calisan} çalışan`;
  if (kullanici !== null) counts["/admin"] = `${kullanici} kullanıcı`;
  return counts;
}

// ————————————————————————————————————————————— Dikkat İsteyenler

export async function loadSignals(
  supabase: SupabaseClient,
  opts: { role: string; today: string }
): Promise<PanelSignal[]> {
  const { role, today } = opts;
  const satis = canSeeSales(role);
  const satinAlma = canSeePurchasing(role);
  const personel = canSeePersonnel(role);

  // Personel belgesi sinyalinin 30 günlük sınırı.
  const belgeSiniri = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  const [kalemSayisi, fiyatliSayisi, gecikenSiparis, kontrolSayisi, belgeSayisi] =
    await Promise.all([
      satis ? say(sayac(supabase, "job_items")) : null,
      // `job_item_sales.job_item_id` TEKİLDİR (şemada unique): fiyatı girilmiş
      // satış satırı sayısı = fiyatlı kalem sayısı. Fiyatsız = toplam − fiyatlı.
      satis
        ? say(sayac(supabase, "job_item_sales").not("unit_price", "is", null))
        : null,
      // İPTAL `cancelled_at` iledir, bir `status` sütunu YOKTUR (canlı şemada
      // doğrulandı). İptal edilmiş sipariş ne gecikir ne beklenir.
      satinAlma
        ? say(
            sayac(supabase, "purchase_orders")
              .is("received_at", null)
              .is("cancelled_at", null)
              .lt("due_at", today)
          )
        : null,
      say(sayac(supabase, "drawing_part_progress").eq("review_required", true)),
      personel
        ? say(sayac(supabase, "hr_employee_documents").lte("expires_on", belgeSiniri))
        : null,
    ]);

  const signals: PanelSignal[] = [];

  if (kalemSayisi !== null && fiyatliSayisi !== null) {
    signals.push({
      key: "sales-unpriced",
      count: Math.max(0, kalemSayisi - fiyatliSayisi),
      label: "iş kaleminin fiyatı girilmedi",
      href: "/sales",
      tone: "bilgi",
    });
  }

  if (gecikenSiparis !== null) {
    signals.push({
      key: "po-overdue",
      count: gecikenSiparis,
      label: "siparişin termini geçti, teslim alınmadı",
      href: "/purchasing/teslimat",
      tone: "uyari",
    });
  }

  // TEKNİK RESİM İŞARETİ HERKESE AÇIKTIR — okuma zaten `true` (md. 18) ve
  // "yeni revizyonda değişmiş bir parçayı atölye hâlâ kesilmiş sayıyor"
  // sorusu mühendisi de ressamı de ilgilendirir.
  signals.push({
    key: "review",
    count: kontrolSayisi,
    label: "üretim kaydı revizyon sonrası kontrol bekliyor",
    href: "/drawings",
    tone: "uyari",
  });

  if (belgeSayisi !== null) {
    signals.push({
      key: "doc-expiry",
      count: belgeSayisi,
      label: "personel belgesinin süresi doldu ya da 30 gün içinde doluyor",
      href: "/personnel",
      tone: "uyari",
    });
  }

  return panelSinyalleri(signals);
}

// ————————————————————————————————————————————— Yaklaşan (ajanda)

/**
 * Yaklaşan şeridin ham tarihleri. Bantlaması saf çekirdekte (`panelTakvim`),
 * çağıran yapar — böylece ekleyen her yeni kaynak aynı pencereden geçer.
 *
 * YEDİ TÜR, DÖRT KAYNAK KÜMESİ: satış termin/sevk (`canSeeSales`), satın alma
 * teslimleri (`canSeePurchasing`), kişiye düşenler (bana atanan görev vadeleri
 * + kendi yapılacak vadelerim — herkes) ve AKTİF işlerin teslim/atölye çıkış
 * tarihleri (işler herkese açık). Ödeme günleri BİLEREK dışarıda
 * (`AGENDA_KINDS` notu).
 */
export async function loadAgendaDates(
  supabase: SupabaseClient,
  opts: { role: string; userId: string }
): Promise<PanelDate[]> {
  const { role, userId } = opts;
  const satis = canSeeSales(role);
  const satinAlma = canSeePurchasing(role);

  const [satislar, siparisler, gorevler, maddeler, isler] = await Promise.all([
    satis
      ? supabase
          .from("job_item_sales")
          .select("due_date, shipment_date, job_items ( item_no, product_name )")
      : null,
    satinAlma
      ? supabase
          .from("purchase_orders")
          .select("order_no, supplier, due_at, received_at, cancelled_at")
      : null,
    supabase
      .from("job_tasks")
      .select("due_date, job_id, title, jobs ( job_no )")
      .eq("assignee", userId)
      .is("done_at", null)
      .not("due_date", "is", null),
    supabase
      .from("user_todos")
      .select("title, due_date")
      .eq("user_id", userId)
      .is("done_at", null)
      .not("due_date", "is", null),
    supabase
      .from("jobs")
      .select("id, job_no, title, delivery_date, workshop_exit_date")
      .eq("status", "active"),
  ]);

  const dates: PanelDate[] = [];

  if (satislar) {
    type Kalem = { item_no?: string | null; product_name?: string | null };
    type Sale = {
      due_date: string | null;
      shipment_date: string | null;
      job_items?: Kalem | Kalem[] | null;
    };
    for (const s of (satislar.data ?? []) as Sale[]) {
      const kalem = Array.isArray(s.job_items) ? s.job_items[0] : s.job_items;
      if (!kalem) continue;
      const label = kalem.item_no ?? "";
      const hint = kalem.product_name ?? undefined;
      if (s.due_date) {
        dates.push({ date: s.due_date, kind: "Termin", label, hint, href: "/sales" });
      }
      if (s.shipment_date) {
        dates.push({ date: s.shipment_date, kind: "Sevk", label, hint, href: "/sales" });
      }
    }
  }

  if (siparisler) {
    type Order = {
      order_no: string;
      supplier: string;
      due_at: string | null;
      received_at: string | null;
      cancelled_at: string | null;
    };
    for (const o of (siparisler.data ?? []) as Order[]) {
      if (o.received_at || o.cancelled_at || !o.due_at) continue;
      dates.push({
        date: o.due_at,
        kind: "Teslim",
        label: o.order_no || o.supplier,
        hint: o.order_no ? o.supplier : undefined,
        href: "/purchasing/teslimat",
      });
    }
  }

  {
    type IsRef = { job_no?: string | null };
    type Gorev = {
      due_date: string | null;
      job_id: string;
      title: string;
      jobs?: IsRef | IsRef[] | null;
    };
    for (const g of (gorevler.data ?? []) as Gorev[]) {
      if (!g.due_date) continue;
      const is = Array.isArray(g.jobs) ? g.jobs[0] : g.jobs;
      dates.push({
        date: g.due_date,
        kind: "Görev",
        label: is?.job_no ?? "",
        hint: g.title,
        href: `/jobs/${g.job_id}/gorevler`,
      });
    }
  }

  {
    type Madde = { title: string; due_date: string | null };
    for (const m of (maddeler.data ?? []) as Madde[]) {
      if (!m.due_date) continue;
      // Madde panelin kendi bölümünde yaşar; adres köke döner.
      dates.push({ date: m.due_date, kind: "Yapılacak", label: m.title, href: "/" });
    }
  }

  {
    type Is = {
      id: string;
      job_no: string;
      title: string;
      delivery_date: string | null;
      workshop_exit_date: string | null;
    };
    for (const j of (isler.data ?? []) as Is[]) {
      if (j.delivery_date) {
        dates.push({
          date: j.delivery_date,
          kind: "İş Teslimi",
          label: j.job_no,
          hint: j.title,
          href: `/jobs/${j.id}`,
        });
      }
      if (j.workshop_exit_date) {
        dates.push({
          date: j.workshop_exit_date,
          kind: "Atölye Çıkışı",
          label: j.job_no,
          hint: j.title,
          href: `/jobs/${j.id}`,
        });
      }
    }
  }

  return dates;
}

// ————————————————————————————————————————————— Sana ait

export async function loadMine(
  supabase: SupabaseClient,
  userId: string
): Promise<MineRow[]> {
  const { data } = await supabase
    .from("project_drawing_plan")
    .select("code, name, status, project_id, projects ( name )")
    .eq("drawn_by", userId)
    .order("code");

  type Plan = {
    code: string;
    name: string;
    status: string;
    project_id: string;
    projects?: { name?: string } | { name?: string }[] | null;
  };
  return ((data ?? []) as Plan[]).map((p) => {
    const proje = Array.isArray(p.projects) ? p.projects[0] : p.projects;
    return {
      code: p.code,
      name: p.name,
      status: p.status,
      project: proje?.name ?? "",
      href: `/projects/${p.project_id}`,
    };
  });
}
