// Teknik Resimler görsel önizlemesi — AUTH'SUZ, yalnız development.
//
// NEDEN VAR: bu modülün ilk üç kusuru (sessizce kaybolan klasör seçimi, 454
// ardışık sorgu, uzantısız inen DXF) ancak KULLANICI denediğinde ortaya çıktı.
// Ekranları oturum açmadan, gerçek veriyle basabilen bir yer olmadan her
// değişiklik körlemesine gidiyor.
//
// Veri GERÇEK iki paketin fikstüründen gelir ve tam çekirdekten geçer
// (`parseFile` → `readSheet` → `reconcile`), yani burada gördüğünüz ağaç
// uygulamadakinin aynısıdır — sahte bir tasarım maketi değil.
//
// Depo bağlantısı yoktur: dosya düğmeleri tıklanınca hata verir, bu beklenen
// davranıştır.

import { notFound } from "next/navigation";
import { parseBomFileName, parseFile } from "@/lib/drawings/file-name";
import { parseFolderName } from "@/lib/drawings/folder-name";
import { readSheet } from "@/lib/drawings/excel";
import { reconcile } from "@/lib/drawings/reconcile";
import type { BomRow } from "@/lib/drawings/types";
import { MONORAY, MTC, type FixturePackage } from "@/lib/drawings/__tests__/fixtures/packages";
import {
  MONORAY_SHEETS,
  MTC_SHEETS,
  type FixtureSheet,
} from "@/lib/drawings/__tests__/fixtures/bom-sheets";
import {
  FINDING_SECTIONS,
  findingChipClass,
  formatBytes,
  formatNum,
  recognitionClass,
} from "@/lib/drawings/labels";
import { satinAlmaListesi, type TurevParca } from "@/lib/drawings/derive";
import { AssemblyTree } from "@/app/(app)/drawings/[id]/assembly-tree";
import { FileBrowser } from "@/app/(app)/drawings/[id]/file-browser";
import {
  paketSatinAlmaOzeti,
  type SiparisOzeti,
} from "@/lib/purchasing/package-summary";
import { PackageActions } from "@/app/(app)/drawings/[id]/package-actions";
import { PartsTable } from "@/app/(app)/drawings/[id]/parts/parts-table";
import { PurchaseSummaryTable } from "@/app/(app)/drawings/[id]/purchasing/summary-table";
import type { FileRow, PartRow } from "@/app/(app)/drawings/data";

function kur(pkg: FixturePackage, sheets: FixtureSheet[]) {
  const parsed = pkg.files.map((f) =>
    parseFile({ relPath: f.path, size: f.size, checksum: f.hash })
  );
  const bom: BomRow[] = sheets
    .filter((s) => !s.file.split("/").some((seg) => seg === "İPTAL"))
    .flatMap(
      (s) =>
        readSheet(
          { fileRelPath: s.file, sheetName: s.sheet, rows: s.rows },
          parseBomFileName(s.file.split("/").pop() ?? "").kind
        ).rows
    );

  const sonuc = reconcile({
    folderName: pkg.folder,
    folder: parseFolderName(pkg.folder).value,
    files: parsed,
    bom,
  });

  const kararlar = new Map(sonuc.fileDecisions.map((d) => [d.relPath, d]));
  const files: FileRow[] = parsed.map((f, i) => ({
    id: `f${i}`,
    rel_path: f.relPath,
    folder: f.folder,
    file_name: f.fileName,
    ext: f.ext,
    role: f.role,
    lifecycle: kararlar.get(f.relPath)?.lifecycle ?? f.lifecycle,
    part_code: f.partCode,
    material: f.material,
    thickness_mm: f.thicknessMm,
    qty: f.qty,
    label: f.label,
    recognized_by: f.recognizedBy,
    size_bytes: f.size,
    storage_path: "",
    // ÖNİZLEMENİN DEPOSU YOK. Her satır "depoda yok" görünseydi ekran baştan
    // sona kırmızı olur ve rozetin gerçekten ne zaman çıktığı görülemezdi;
    // bu yüzden hepsi yüklenmiş SAYILIR. Rozeti görmek için her yirminci dosya
    // bilerek eksik bırakılır — tasarım önizlemesinin işi budur.
    stored: i % 20 !== 7,
    upload_skipped: false,
    upload_error: i % 20 === 7 ? "önizleme: bu satır bilerek eksik bırakıldı" : "",
    meta: null,
  }));
  const yolKimlik = new Map(files.map((f) => [f.rel_path, f.id]));

  const parts: PartRow[] = sonuc.parts.map((p) => ({
    id: p.registerKey,
    register_key: p.registerKey,
    part_code: p.partCode,
    parent_code: p.parentCode,
    item_path: p.itemPath,
    level: p.level,
    kind: p.kind,
    name: p.name,
    description: p.description,
    assembly_title: p.assemblyTitle,
    material: p.material,
    category: p.category,
    qty: p.qty,
    cut_length_mm: p.cutLengthMm,
    thickness_mm: p.thicknessMm,
    weight_kg: p.weightKg,
    extents_x_mm: p.extentsXMm,
    extents_y_mm: p.extentsYMm,
    has_model: p.hasModel,
    has_sheet: p.hasSheet,
    has_cut: p.hasCut,
    has_3d: p.has3d,
    sheet_file_id: p.sheetRelPath ? yolKimlik.get(p.sheetRelPath) ?? null : null,
    cut_file_id: p.cutRelPath ? yolKimlik.get(p.cutRelPath) ?? null : null,
    sort: p.sort,
  }));

  const bayt = pkg.files.reduce((t, f) => t + f.size, 0);

  // SATIN ALMA EKRANI KALKTI ama KATEGORİ SÖZLÜĞÜ ölçülmeye devam ediyor:
  // liste yalnız sayı olarak basılır (MONORAY'da hiçbir satır "Diğer"e
  // düşmüyor, MTC'de bir tane) — sözlük bozulursa o sayı burada görünür.
  const alim = satinAlmaListesi(sonuc.parts as unknown as TurevParca[]);

  return { pkg, sonuc, files, parts, bayt, alim };
}

/**
 * Satın alma özetinin fikstürü — SİPARİŞ KAYITLARI UYDURULMUŞTUR.
 *
 * Ekranın anlatmak istediği şey dört durumun ve gecikme rozetinin bir arada
 * nasıl durduğudur; gerçek pakette hiç sipariş yok, yani "hepsi bekliyor"
 * görüntüsü hiçbir yerleşim sorusunu cevaplamazdı. Bugün de SABİTTİR
 * (`ONIZLEME_BUGUN`): tarihe göre kayan bir önizleme, iki gün sonra başka bir
 * ekran gösterirdi ve karşılaştırma yapılamazdı.
 */
const ONIZLEME_BUGUN = "2026-08-12";

function ozetKur(
  satirlar: readonly {
    key: string;
    tanim: string;
    sinif: string;
    malzeme: string;
    parcaKodu: string;
    kullanildigiYer?: string;
    adet: number | null;
  }[]
) {
  const ozetler: SiparisOzeti[] = [];
  satirlar.forEach((s, i) => {
    // Her dördüncü kalem sipariş edilmemiş bırakılır: "bekliyor" da bir hâldir.
    if (i % 4 === 0) return;
    const adet = s.adet ?? 1;
    const teslim = i % 4 === 2 ? adet : i % 4 === 3 ? Math.max(1, Math.floor(adet / 2)) : 0;
    const kapali = teslim >= adet;
    ozetler.push({
      partKey: s.key,
      matchKey: s.key,
      orderedQty: adet,
      receivedQty: teslim,
      firstOrderedAt: "2026-06-20",
      // Bir grup termin GEÇMİŞTİR — gecikme rozeti ancak öyle görünür.
      nextDueAt: kapali ? null : i % 3 === 0 ? "2026-08-01" : "2026-09-15",
      lastReceivedAt: kapali ? "2026-08-05" : null,
      orderCount: 1,
      openOrderCount: kapali ? 0 : 1,
    });
  });
  return paketSatinAlmaOzeti(satirlar, ozetler, [], ONIZLEME_BUGUN);
}

export default function DrawingsPreviewPage() {
  // Üretimde 404 — dev önizlemelerinin evdeki kuralı.
  if (process.env.NODE_ENV !== "development") notFound();

  const paketler = [kur(MONORAY, MONORAY_SHEETS), kur(MTC, MTC_SHEETS)];

  return (
    <div className="mx-auto grid max-w-[1600px] gap-8 p-6">
      <header>
        <h1 className="text-lg font-medium">Teknik Resimler — görsel önizleme</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          İki gerçek teslim klasörünün fikstürü tam çekirdekten geçirilip
          basılıyor. Depo bağlantısı yok: dosya düğmeleri hata verir.
        </p>
      </header>

      {paketler.map(({ pkg, sonuc, files, parts, bayt, alim }) => (
        <section key={pkg.folder} className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-2">
            <div>
              <h2 className="font-mono text-sm font-medium">{pkg.folder}</h2>
              <p className="font-mono text-[11px] text-muted-foreground">
                {formatNum(pkg.files.length)} dosya · {formatBytes(bayt)} ·{" "}
                {formatNum(parts.length)} parça
              </p>
            </div>
            <div className="text-right">
              <span className="oc-kicker block text-muted-foreground">Tanıma</span>
              <span
                className={`font-mono text-xl font-semibold ${recognitionClass(sonuc.recognition.pct)}`}
              >
                %{sonuc.recognition.pct}
              </span>
            </div>
          </div>

          {/* PAKET EYLEMLERİ — asıl görülmesi gereken şey SİLME PENCERESİDİR.
              Onay kutusuna paket adı yerine "ONAY" yazılıyor (12.08.2026) ve
              bu değişiklik ancak pencere gerçekten açılınca doğrulanabilir.
              Düğmeler burada depoya ulaşamaz; amaç yerleşim ve metindir. */}
          <PackageActions
            packageId="00000000-0000-4000-8000-000000000000"
            folderName={pkg.folder}
            storedCount={pkg.files.length}
            bytes={bayt}
            partCount={parts.length}
            progressCount={0}
            missing={0}
          />

          {/* Genel Bakış ile Dosyalar ARTIK AYRI BÖLÜM; önizleme ikisini alt
              alta basar, uygulamadaki gibi her biri tam genişlikte. */}
          <AssemblyTree
            parts={parts}
            files={files.map((f) => ({
              id: f.id,
              storage_path: f.storage_path,
              file_name: f.file_name,
            }))}
          />
          <FileBrowser dosyalar={files} />

          {/* PARÇALAR: sütunların yatayda sığıp sığmadığı ancak burada
              görülür — dokuz sütunlu tablo tarayıcıda ölçülmeden "sığıyor"
              denemez. */}
          <PartsTable packageId="onizleme" parts={parts} files={files} />

          {/* SATIN ALMA ÖZETİ — paketin SALT OKUNUR penceresi (12.08.2026).
              Havuzun kendisi ÇOK PAKETLİDİR ve burada önizlenemez (onun duman
              testi `scripts/test-purchasing-pool.ts`, canlı veriyle koşar); bu
              ekran ise tek paketliktir ve tam olarak burada görülür.
              Sipariş kayıtları UYDURULMUŞTUR ve öyle olmak zorundadır: dört
              durumun (bekliyor · sipariş · kısmi · teslim) ve gecikme
              rozetinin bir arada nasıl durduğu ancak dördü de varken
              ölçülebilir. Kategori DAĞILIMI da basılır: sözlük bu iki gerçek
              pakete karşı ölçülüyor ve bozulursa buradan görünür. */}
          <p className="font-mono text-[11px] text-muted-foreground">
            Satın alma: {formatNum(alim.satirlar.length)} kalem ·{" "}
            {alim.siniflar.map((s) => `${s.sinif} ${s.satirSayisi}`).join(" · ")}
          </p>
          {/* "Kullanıldığı Yer" GERÇEK veriyle basılır: sütunun boş görünmesi
              ile kalemin grubunun çözülememesi AYNI ŞEY DEĞİLDİR ve önizleme
              ikisini ayırt ettirmelidir. */}
          <PurchaseSummaryTable
            ozet={ozetKur(
              alim.satirlar.map((s) => ({
                ...s,
                kullanildigiYer: s.izler.find((i) => i.montajAdi)?.montajAdi ?? "",
              }))
            )}
            ozetKapisiVar
          />

          <div className="grid gap-3 lg:grid-cols-3">
            {FINDING_SECTIONS.map((bolum) => {
              const liste = sonuc.findings.filter((f) => f.kind === bolum.kind);
              return (
                <section key={bolum.kind} className="min-w-0 border bg-card">
                  <header className="border-b bg-muted/40 px-3 py-2">
                    <h3 className="flex items-baseline gap-2 text-sm font-medium">
                      {bolum.title}
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {formatNum(liste.length)}
                      </span>
                    </h3>
                  </header>
                  {liste.length === 0 ? (
                    <p className="px-3 py-5 text-center text-[12px] text-muted-foreground">
                      Bu bölümde bir şey yok.
                    </p>
                  ) : (
                    <ul className="max-h-72 divide-y overflow-y-auto">
                      {liste.map((f, i) => (
                        <li key={`${f.code}-${f.subject}-${i}`} className="grid gap-1 px-3 py-2">
                          <span
                            className={`w-fit border px-1.5 py-0.5 font-mono text-[11px] uppercase ${findingChipClass(f.kind)}`}
                          >
                            {f.code}
                          </span>
                          <span className="text-[12px]">{f.title}</span>
                          {f.detail && (
                            <span className="text-[11px] text-muted-foreground">{f.detail}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
