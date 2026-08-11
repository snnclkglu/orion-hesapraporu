// SÜRÜMLER — aynı (kalem, grup) için yapılmış teslimlerin zinciri ve farkları.
//
// Tekillik kısıtı BİLİNÇLİ OLARAK YOKTUR (şema yorumu: "bir yüklemeyi kısıt
// hatasıyla düşürmek, ressamın bir daha denememesidir"). Çözüm kısıt değil
// İLİŞKİ ve FARK: paketler `supersedes_id` ile birbirine bağlanır, bu ekran da
// zinciri gezip aradaki farkı satır satır çıkarır.
//
// ZİNCİR İKİ KAYNAKTAN KURULUR ve ikisi de gereklidir:
//   1. `supersedes_id` — kullanıcı sihirbazda "öncekini süperse et" dediyse.
//   2. (item_no, group_code) KARDEŞLİĞİ — bugün bağlanmamış ikizler zaten var
//      ve bunlar meşru olabilir (aynı grubun iki ayrı teslimi). Şemadaki
//      `dwg_packages_group_idx` tam bu sorgu için duruyor.
// `item_no` boşsa kardeş taraması YAPILMAZ: eşleşmemiş bütün paketleri aynı
// zincire doldururdu.
//
// FARK CANLI HESAPLANIR, SAKLANMAZ. Süperse anında bir özet yazmak hızlı olurdu
// ama kural geliştikçe o özet yalan söyler — `RECONCILER_VERSION`ın öğrettiği
// ders tam tersidir: türetilmiş olan yeniden üretilebilir kalmalıdır. Bedeli
// okuma hacmidir ve üç yerden kısılır: yalnız ardışık çiftler, yalnız gereken
// sütunlar, yalnız son birkaç sürüm.
//
// `data.ts` PAYLAŞILAN dosyadır; bu ekranın okumaları bilerek burada durur.

import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GitBranch, Unlink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { loadPackage, storageState, tumSatirlar } from "../../data";
import { PackageActions } from "../package-actions";
import { packageDiff, type DiffFile, type DiffPart, type PackageSide } from "@/lib/drawings/diff";
import { formatNum } from "@/lib/drawings/labels";
import type { DwgPackageStatus, FileLifecycle, FileRole } from "@/lib/drawings/types";
import { EventTimeline, type PackageEvent } from "./event-timeline";
import { VersionList, type VersionBlockData } from "./version-list";

/** PostgREST `max_rows` sınırının altında bir sayfa. */
const SAYFA = 900;
/** Zincirde en çok kaç sürüm gezilir — döngü ve kopyalama patlamasına karşı. */
const ZINCIR_SINIRI = 12;
/** Kaç sürümün dosya/parça verisi okunur — gerisi fark HESAPLANMADAN listelenir. */
const VERI_SINIRI = 5;

interface SurumRow {
  id: string;
  folder_name: string;
  item_no: string;
  group_code: string;
  rev_no: number;
  status: DwgPackageStatus;
  supersedes_id: string | null;
  file_count: number;
  part_count: number;
  bytes_total: number;
  created_at: string;
}

const SURUM_ALANLARI =
  "id, folder_name, item_no, group_code, rev_no, status, supersedes_id, " +
  "file_count, part_count, bytes_total, created_at";

async function surumOku(supabase: SupabaseClient, id: string): Promise<SurumRow | null> {
  const { data } = await supabase
    .from("drawing_packages")
    .select(SURUM_ALANLARI)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as SurumRow) ?? null;
}

/**
 * Zinciri toplar: kardeşler + `supersedes_id` grafiği (yukarı ve aşağı).
 *
 * Aşağı yön de gereklidir — kullanıcı zincirin ORTASINDAKİ bir sürümün
 * adresini açmış olabilir ve yalnız yukarı bakan bir gezinti ona kendisini
 * "en yeni" gösterirdi.
 */
async function zinciriTopla(supabase: SupabaseClient, kok: SurumRow): Promise<SurumRow[]> {
  const bulunan = new Map<string, SurumRow>([[kok.id, kok]]);

  if (kok.item_no) {
    const { data } = await supabase
      .from("drawing_packages")
      .select(SURUM_ALANLARI)
      .eq("item_no", kok.item_no)
      .eq("group_code", kok.group_code)
      .limit(ZINCIR_SINIRI);
    for (const r of (data ?? []) as unknown as SurumRow[]) bulunan.set(r.id, r);
  }

  // BFS TUR TUR ilerler, düğüm düğüm değil: her tur İKİ sorgu eder (yukarısı
  // `in(id, …)`, aşağısı `in(supersedes_id, …)`). Düğüm başına sorgu açmak
  // on iki sürümlük bir zincirde yirmi dört gidiş-geliş demekti.
  let cephe = [...bulunan.keys()];
  for (let tur = 0; tur < ZINCIR_SINIRI && cephe.length && bulunan.size < ZINCIR_SINIRI; tur++) {
    const ustler = cephe
      .map((id) => bulunan.get(id)?.supersedes_id)
      .filter((x): x is string => Boolean(x) && !bulunan.has(x!));

    const [ustSonuc, altSonuc] = await Promise.all([
      ustler.length
        ? supabase.from("drawing_packages").select(SURUM_ALANLARI).in("id", ustler)
        : Promise.resolve({ data: [] }),
      supabase
        .from("drawing_packages")
        .select(SURUM_ALANLARI)
        .in("supersedes_id", cephe)
        .limit(ZINCIR_SINIRI),
    ]);

    const yeniler: string[] = [];
    for (const r of [
      ...((ustSonuc.data ?? []) as unknown as SurumRow[]),
      ...((altSonuc.data ?? []) as unknown as SurumRow[]),
    ]) {
      if (bulunan.has(r.id)) continue;
      bulunan.set(r.id, r);
      yeniler.push(r.id);
    }
    cephe = yeniler;
  }

  // ESKİDEN YENİYE. `rev_no` eşitse tarih ayırır: süperse edilmemiş ikizlerin
  // ikisi de R1'dir ve aralarındaki tek gerçek sıra yükleme anıdır.
  return [...bulunan.values()].sort(
    (a, b) => a.rev_no - b.rev_no || a.created_at.localeCompare(b.created_at)
  );
}

/** Farkın ihtiyacı olan SÜTUNLAR — satırın tamamı okunmaz. */
async function tarafOku(supabase: SupabaseClient, packageId: string): Promise<PackageSide> {
  const [dosyalar, parcalar] = await Promise.all([
    tumSatirlar<{
      rel_path: string;
      checksum: string;
      size_bytes: number;
      role: FileRole;
      lifecycle: FileLifecycle;
    }>((bas, son) =>
      supabase
        .from("drawing_files")
        .select("rel_path, checksum, size_bytes, role, lifecycle")
        .eq("package_id", packageId)
        .order("rel_path")
        .range(bas, son)
    ),
    tumSatirlar<{
      register_key: string;
      part_code: string;
      description: string;
      qty: number | null;
      material: string;
      weight_kg: number | string | null;
      thickness_mm: number | string | null;
      cut_length_mm: number | string | null;
      category: string;
    }>((bas, son) =>
      supabase
        .from("drawing_parts")
        .select(
          "register_key, part_code, description, qty, material, weight_kg, thickness_mm, " +
            "cut_length_mm, category"
        )
        .eq("package_id", packageId)
        .order("sort")
        .range(bas, son)
    ),
  ]);

  const files: DiffFile[] = dosyalar.map((f) => ({
    relPath: f.rel_path,
    checksum: f.checksum,
    size: Number(f.size_bytes ?? 0),
    role: f.role,
    lifecycle: f.lifecycle,
  }));
  const parts: DiffPart[] = parcalar.map((p) => ({
    registerKey: p.register_key,
    partCode: p.part_code,
    description: p.description,
    qty: p.qty,
    material: p.material,
    // `numeric` sütunlar supabase-js'ten METİN gelebilir; çekirdek ikisini de
    // kabul eder ve ölçeğine yuvarlayarak karşılaştırır.
    weightKg: p.weight_kg,
    thicknessMm: p.thickness_mm,
    cutLengthMm: p.cut_length_mm,
    category: p.category,
  }));
  return { files, parts };
}

/** `drawing_package_events` satırının okunan yüzü. */
interface EventRow {
  id: string;
  package_id: string | null;
  event: string;
  detail: Record<string, unknown> | null;
  at: string;
  profiles: { full_name: string | null } | null;
}

export default async function PackageVersionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const paket = await surumOku(supabase, id);
  if (!paket) notFound();

  const zincir = await zinciriTopla(supabase, paket);

  // Yalnız SON birkaç sürümün verisi okunur: 454 dosyalık iki sürüm ~1.800
  // satır demek ve zincir uzadıkça bu doğrusal büyür.
  const veriBaslangici = Math.max(0, zincir.length - VERI_SINIRI);
  const okunanlar = zincir.slice(veriBaslangici);
  const veriler = new Map<string, PackageSide>(
    await Promise.all(
      okunanlar.map(async (s) => [s.id, await tarafOku(supabase, s.id)] as const)
    )
  );

  const cocukOlan = new Set(zincir.map((s) => s.supersedes_id).filter(Boolean) as string[]);

  // Eskiden yeniye kurulur (fark bir ÖNCEKİNE göredir), sonuna doğru ters çevrilir.
  const bloklar: VersionBlockData[] = zincir.map((s, i) => {
    const onceki = i > 0 ? zincir[i - 1] : null;
    const buTaraf = veriler.get(s.id);
    const onceTaraf = onceki ? veriler.get(onceki.id) : undefined;
    return {
      id: s.id,
      revNo: s.rev_no,
      status: s.status,
      folderName: s.folder_name,
      createdAt: s.created_at,
      fileCount: s.file_count,
      partCount: s.part_count,
      bytesTotal: Number(s.bytes_total ?? 0),
      bugunku: s.id === paket.id,
      zincirBagli: Boolean(s.supersedes_id) || cocukOlan.has(s.id),
      fark: onceTaraf && buTaraf ? packageDiff(onceTaraf, buTaraf) : null,
      olculmedi: Boolean(onceki) && (!onceTaraf || !buTaraf),
    };
  });

  const bagsiz = bloklar.filter((b) => !b.zincirBagli);
  const kopukZincir = zincir.some((s) => s.rev_no > 1 && !s.supersedes_id);

  // DENETİM AKIŞI — zincirin BÜTÜN paketleri için, tek sorguda.
  //
  // Sürüm bloklarının anlatamadığı şey ZAMAN ve FAİLDİR: kim yükledi, kim
  // doğruladı, hangi revizyonda kaç üretim kaydı taşındı. `audit_log` bu iş
  // için kullanılamazdı — o tablo `project_id`/`revision_id` ile hesap
  // raporuna bağlıdır ve teknik resim paketi bambaşka bir tanedir.
  const { data: olayVerisi } = await supabase
    .from("drawing_package_events")
    .select("id, package_id, event, detail, at, profiles:actor (full_name)")
    .in("package_id", zincir.map((s) => s.id))
    .order("at", { ascending: false })
    .limit(60);

  const olaylar: PackageEvent[] = ((olayVerisi ?? []) as unknown as EventRow[]).map((o) => ({
    id: o.id,
    event: o.event,
    at: o.at,
    actor: o.profiles?.full_name ?? "",
    detail: o.detail ?? {},
    revNo: zincir.find((s) => s.id === o.package_id)?.rev_no ?? null,
  }));

  // ————————————————————————————————— paketin bakım eylemleri
  //
  // BU DÜĞMELER ARTIK KABUKTA DEĞİL BURADA. Her sekmede duruyorlardı ve bu
  // sayfayı atölye, satınalma ve müdür de açıyor; onların işi paketi yeniden
  // kurmak değil okumaktır. Arşiv ve bakım aynı yerde toplanır.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditDrawings(profile?.role);

  // Silme onayı NE KAYBEDİLECEĞİNİ sayıyla söyler; bu ekranın kendi `SurumRow`u
  // depo ölçümünü taşımadığı için paketin tam satırı okunur.
  const tamPaket = yazabilir ? await loadPackage(supabase, id) : null;
  const depo = tamPaket ? storageState(tamPaket) : null;

  // ÜRETİME GİRMİŞ PAKET SİLİNEMEZ. Kural veritabanı tetikleyicisindedir; bu
  // sayı yalnız düğmenin daha tıklanmadan bunu SÖYLEYEBİLMESİ için okunur
  // (projeyi silmedeki `hasIssuedRevision` kalıbının aynısı). Anlamlı ilerleme
  // aranır: pano bir aşamayı geri alırken sıfır satır bırakabilir ve o satır
  // yüzünden silmeyi kilitlemek yanlış alarm olurdu.
  const { count: uretimKaydi } = await supabase
    .from("drawing_part_progress")
    .select("id", { count: "exact", head: true })
    .eq("package_id", paket.id)
    .gt("qty_done", 0);

  return (
    <div className="grid gap-4">
      {yazabilir && depo && (
        <section className="border bg-card px-4 py-3">
          <h2 className="text-sm font-medium">Paket Bakımı</h2>
          <p className="mt-1 mb-2 max-w-prose text-[12px] text-muted-foreground">
            Paketi yeniden kuran ve silen eylemler. Üç düğmenin maliyeti çok
            farklıdır ve her birinin üstünde yazılıdır: <strong>Yeniden
            Eşleştir</strong> depoya hiç dokunmaz, <strong>Depoyu Doğrula</strong>{" "}
            yalnız listeler, <strong>İçerikleri Yeniden Oku</strong> her resmi ve
            DXF&apos;i yeniden indirir.
          </p>
          <PackageActions
            packageId={paket.id}
            folderName={paket.folder_name}
            storedCount={depo.stored}
            bytes={depo.storedBytes || depo.expectedBytes}
            partCount={paket.part_count}
            progressCount={uretimKaydi ?? 0}
            missing={depo.missing}
          />
        </section>
      )}

      <section className="border bg-card p-4">
        <h1 className="flex items-center gap-2 text-sm font-medium">
          <GitBranch className="size-4 text-primary" />
          Sürüm Zinciri
          <span className="font-mono text-[11px] font-normal text-muted-foreground">
            {formatNum(zincir.length)} sürüm
          </span>
        </h1>
        <p className="mt-1 max-w-prose text-[12px] text-muted-foreground">
          Aynı iş kalemi ve grubu için yapılmış teslimler. Fark her açılışta
          yeniden hesaplanır — kaydedilmiş bir özet, kurallar geliştikçe yanlış
          söylemeye başlardı. <strong>Üretim kaydı süpersedeyi aşar:</strong>{" "}
          &quot;bu parça kesildi&quot; bilgisi parça koduna bağlıdır, pakete değil.
        </p>
        {zincir.length > VERI_SINIRI && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Fark yalnız en yeni {VERI_SINIRI} sürüm için hesaplandı; daha eskisi
            listede durur ama satırları okunmaz.
          </p>
        )}
      </section>

      {(bagsiz.length > 1 || kopukZincir) && (
        <section className="border bg-card px-4 py-3">
          <h2 className="flex items-center gap-2 text-[12px] font-medium">
            <Unlink className="size-3.5 text-muted-foreground" />
            {bagsiz.length > 1 ? "Bağlanmamış ikiz" : "Zincir kopmuş görünüyor"}
          </h2>
          <p className="mt-1 max-w-prose text-[11px] text-muted-foreground">
            {bagsiz.length > 1
              ? `Aynı kalem ve grup için ${formatNum(bagsiz.length)} paket var ama aralarında süperse bağı yok. Bu bir hata olmayabilir — aynı grubun iki ayrı teslimi meşrudur. Bağlamak isterseniz yeni sürümü açıp "Öncekini Süperse Et" diyebilirsiniz.`
              : "Bir sürümün numarası 1'in üstünde ama bağlı olduğu önceki sürüm bulunamadı; arada silinmiş bir paket olabilir. Kalan sürümler kalem ve grup kardeşliğinden toplandı."}
          </p>
        </section>
      )}

      <VersionList surumler={[...bloklar].reverse()} />

      <EventTimeline olaylar={olaylar} />
    </div>
  );
}
