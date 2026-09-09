// ÜRÜN ÖLÇÜ DEFTERİ TOHUMU — doğrulanmış ölçüleri migration'a çevirir.
//
// Girdi, katalog ayıklama turunun ONAYLANMIŞ satırlarıdır (üç lensin en az
// ikisi çürütememiş). Betik hiçbir ölçü ÜRETMEZ; yalnız gelen satırları
// `electrical_device_models` tablosuna yazacak SQL'e çevirir ve kaynak izini
// (belge + sayfa + birebir alıntı) satıra iliştirir.
//
// ═══════════════════════════════════════════ ANAHTAR PARÇALARDAN HESAPLANIR
//
// `lookup_key` plandaki markadan DEĞİL, gerçek malzeme satırlarından
// `materialCatalogIdentity` ile üretilir — çalışma anında aranan anahtar odur
// (ELEKTRIK-12). Aynı ürün listede iki farklı tedarikçi yazımıyla geçiyorsa
// (ölçüldü: `PT 2,5` hem "Phoenix Contact" hem BOŞ tedarikçiyle) İKİ anahtar
// da yazılır; tek satır yazmak parçaların dörtte birini ıskalardı.
//
// ═══════════════════════════════════════════ ELLE GİRİLEN ÖLÇÜ EZİLMEZ
//
// `on conflict ... do update` yalnız `source <> 'elle'` satırlarda çalışır.
// Mühendisin kendi ölçtüğü ve deftere yazdığı bir değeri toplu bir katalog
// turu sessizce değiştiremez — o değer bir beyandır (PANO-12).
//
//   npx tsx scripts/seed-device-models.ts <onayli.json> <parts.json> [--out <migration.sql>]

import { readFileSync, writeFileSync } from "node:fs";
import { materialCatalogIdentity } from "@/lib/electrical/catalogs";
import { readPartsDump } from "./switchboard-parts-dump";

interface OnayliSatir {
  typeNo: string;
  family: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  sourceFile?: string;
  sourcePage?: number | null;
  quote?: string;
  ownershipEvidence?: string;
  mountHint?: string;
  note?: string;
  votes?: number;
  refutes?: number;
}

const MOUNT_TIPLERI = ["din", "plaka", "zemin", "kapak", "govde", "yan", "saha"];

function sql(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function kisalt(s: string, n: number): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function main() {
  const [onayliYolu, partsYolu] = process.argv.slice(2);
  if (!onayliYolu || !partsYolu) {
    console.error(
      "Kullanım: npx tsx scripts/seed-device-models.ts <onayli.json> <parts.json> [--out <migration.sql>]"
    );
    process.exit(1);
  }

  const onayli = JSON.parse(readFileSync(onayliYolu, "utf8")) as OnayliSatir[];
  // ORTAK OKUYUCU ZORUNLUDUR: temizlenmemiş bir satırdan üretilen anahtar
  // (`SEASTOR|RXG22BDIMZA100T…`) çalışma anında HİÇ ARANMAZ ve deftere yazılan
  // ölçü sessizce ölü kalırdı.
  const dokum = readPartsDump(partsYolu);
  const parts = dokum.parts;

  // Tip numarası → gerçek malzeme satırlarındaki KİMLİKLER.
  const kimlikler = new Map<string, Map<string, { supplier: string; typeNo: string }>>();
  for (const p of parts) {
    const typeNo = p.typeNo;
    if (!typeNo.trim()) continue;
    const kimlik = materialCatalogIdentity(p);
    const kutu = kimlikler.get(typeNo) ?? new Map();
    kutu.set(kimlik.lookupKey, { supplier: kimlik.supplier, typeNo: kimlik.typeNo });
    kimlikler.set(typeNo, kutu);
  }

  const satirlar: string[] = [];
  const eslesmeyen: string[] = [];
  let anahtarSayisi = 0;

  for (const r of onayli) {
    if (
      !(r.widthMm > 0) ||
      !(r.heightMm > 0) ||
      !(r.depthMm > 0)
    ) {
      eslesmeyen.push(`${r.typeNo} — ölçü eksik/sıfır, atlandı`);
      continue;
    }
    const kutu = kimlikler.get(r.typeNo);
    if (!kutu || kutu.size === 0) {
      eslesmeyen.push(`${r.typeNo} — malzeme listesinde bu tip numarası yok, atlandı`);
      continue;
    }

    const mount = MOUNT_TIPLERI.includes(r.mountHint ?? "") ? (r.mountHint as string) : null;
    // Kaynak izi NOTA yazılır: alıntı ve sahiplik kanıtı olmadan bir ölçü
    // gelecekte denetlenemez (PANO-17).
    const not = kisalt(
      [
        r.sourceFile ? `Kaynak: ${r.sourceFile}${r.sourcePage ? ` s.${r.sourcePage}` : ""}` : "",
        r.quote ? `Alıntı: ${kisalt(r.quote, 180)}` : "",
        r.ownershipEvidence ? `Sahiplik: ${kisalt(r.ownershipEvidence, 140)}` : "",
        typeof r.votes === "number" ? `Denetim: ${r.votes - (r.refutes ?? 0)}/${r.votes} lens onayladı` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      480
    );

    for (const [lookupKey, kimlik] of kutu) {
      anahtarSayisi++;
      satirlar.push(
        [
          "  (",
          `    ${sql(lookupKey)}, ${sql(kimlik.supplier)}, ${sql(kimlik.typeNo)},`,
          `    ${r.widthMm}, ${r.heightMm}, ${r.depthMm},`,
          `    ${mount ? sql(mount) : "null"},`,
          `    ${r.sourceFile ? sql(r.sourceFile) : "null"},`,
          `    ${r.sourcePage ? r.sourcePage : "null"},`,
          `    ${sql(not)}`,
          "  )",
        ].join("\n")
      );
    }
  }

  const govde = `-- ÜRÜN ÖLÇÜ DEFTERİ — üretici kataloglarından doğrulanmış cihaz ölçüleri.
--
-- Satırlar bir AYIKLAMA TURUNUN çıktısıdır: her ölçü üretici PDF'inin metin
-- katmanından okundu ve ÜÇ BAĞIMSIZ LENSLE çürütülmeye çalışıldı — sahiplik
-- (PANO-17: tip numarasının sayfada geçmesi ölçünün ona ait olduğu anlamına
-- gelmez), birebir alıntı ve fiziksel makullük. En az iki lensi geçemeyen
-- ölçü buraya GİRMEDİ.
--
-- ELLE GİRİLEN ÖLÇÜ EZİLMEZ: çakışmada güncelleme yalnız \`source <> 'elle'\`
-- satırlarda çalışır. Mühendisin kendi beyanı toplu bir turla değişmez
-- (PANO-12).
--
-- Kaynak izi \`note\` alanındadır (belge · sayfa · birebir alıntı · sahiplik
-- kanıtı) ve \`source_document_id\` katalog defterindeki belgeye bağlanır.

with gelen (lookup_key, supplier, type_no, width_mm, height_mm, depth_mm,
            mount_type, source_file, source_page, note) as (
  values
${satirlar.join(",\n")}
)
insert into public.electrical_device_models (
  lookup_key, supplier, type_no, width_mm, height_mm, depth_mm,
  mount_type, source, source_document_id, source_page, note, updated_at
)
select
  g.lookup_key, g.supplier, g.type_no, g.width_mm, g.height_mm, g.depth_mm,
  g.mount_type, 'katalog',
  (select d.id from public.electrical_catalog_documents d
    where d.file_name = split_part(g.source_file, '/', -1) limit 1),
  g.source_page, g.note, now()
from gelen g
on conflict (lookup_key) do update set
  supplier = excluded.supplier,
  type_no = excluded.type_no,
  width_mm = excluded.width_mm,
  height_mm = excluded.height_mm,
  depth_mm = excluded.depth_mm,
  mount_type = coalesce(excluded.mount_type, public.electrical_device_models.mount_type),
  source = 'katalog',
  source_document_id = coalesce(excluded.source_document_id, public.electrical_device_models.source_document_id),
  source_page = excluded.source_page,
  note = excluded.note,
  updated_at = now()
where public.electrical_device_models.source <> 'elle';
`;

  console.log(`Onaylı satır: ${onayli.length} · yazılacak anahtar: ${anahtarSayisi}`);
  if (eslesmeyen.length) {
    console.log(`\nAtlanan ${eslesmeyen.length} satır:`);
    for (const e of eslesmeyen) console.log(`  · ${e}`);
  }

  const outIdx = process.argv.indexOf("--out");
  if (outIdx > 0) {
    const yol = process.argv[outIdx + 1];
    writeFileSync(yol, govde, "utf8");
    console.log(`\nMigration yazıldı: ${yol}`);
  } else {
    console.log("\n--out verilmedi; SQL basılmadı.");
  }
}

main();
