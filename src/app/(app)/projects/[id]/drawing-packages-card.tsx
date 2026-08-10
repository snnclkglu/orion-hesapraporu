// Teknik Resim Paketleri — proje detayındaki SALT-OKUNUR köprü kartı.
//
// NEDEN VAR. Aynı sekmedeki eski "Teknik Çizimler" defteri (`public.drawings`)
// elle yazılmış bir Google Drive linkidir — bir NİYET kaydı. Gerçek paketler
// `drawing_packages`tadır ve imzası doğrulanmış baytlar taşır; migration
// 20260810000001 ikisinin neden aynı tabloda olmadığını anlatır ve köprü olarak
// tam bu kartı söz verir. Köprü olmadan mühendis aynı vinç için İKİ AYRI GERÇEK
// görüyordu ve ikisi birbirini hiç bilmiyordu: defter "Rev B · Onaylı" derken
// paket "R02 · süperse edilmiş" olabiliyordu. Kart bu yüzden defterin ÜSTÜNDE
// durur — gerçek önce okunur.
//
// OKUMA YETKİSİ SORULMAZ. `drawing_packages` RLS'inde select `true`dur;
// `can_edit_drawings()` yalnız YAZMA sorusudur (20260810000001:33-45). Teknik
// resim atölyenin ortak gerçeğidir, satış rakamı değildir. Kartı bir yetkinin
// arkasına koymak o kararı sessizce geri alırdı.

import Link from "next/link";
import { Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { itemNoOf } from "@/lib/drawings/part-code";
import type { DwgPackageStatus } from "@/lib/drawings/types";
import {
  PACKAGE_STATUS_LABELS, formatBytes, formatNum,
} from "@/lib/drawings/labels";
// DEPO ÖLÇÜMÜNÜN TEK HESAP YERİ. Beklenen dosya sayısı `file_count` DEĞİLDİR
// (atlananlar düşülür) ve her ekranda yeniden yazılsaydı biri er geç yanlış
// sayardı — bu kart da o hesabı kendi yapmaz.
import { storageState } from "../../drawings/data";

/** Kartın okuduğu alanlar — `storageState`in istediği yedi alan dahil. */
interface PackageSummary {
  id: string;
  folder_name: string;
  description: string;
  capacity: string;
  item_no: string;
  group_code: string;
  rev_no: number;
  status: DwgPackageStatus;
  part_count: number;
  file_count: number;
  bytes_total: number;
  stored_count: number;
  stored_bytes: number;
  skipped_count: number;
  skipped_bytes: number;
  verified_at: string | null;
}

const PAKET_ALANLARI =
  "id, folder_name, description, capacity, item_no, group_code, rev_no, status, " +
  "part_count, file_count, bytes_total, stored_count, stored_bytes, skipped_count, " +
  "skipped_bytes, verified_at";

/**
 * Bu vincin gerçek teknik resim paketleri. Eşleşme yoksa `null` döner ve kart
 * hiç çizilmez — boş bir kutu, olmayan bir bağı varmış gibi gösterirdi.
 */
export async function DrawingPackagesCard({
  projectId,
  docNo,
}: {
  projectId: string;
  /** `projects.doc_no` — YALNIZ son çare olarak kullanılır (aşağıdaki gerekçe). */
  docNo: string | null;
}) {
  const supabase = await createClient();

  // ---------------------------------------------------------------- BAĞ
  // İKİ ADAY VAR ve ikisi eşit güvenilir DEĞİL:
  //
  //   A) METİN — `projects.doc_no` ↔ `drawing_packages.item_no`
  //      `doc_no` serbest metindir ve AGENTS md. 14 üç yazımın birden
  //      dolaştığını yazar: `0055` (kalemsiz), `0055-01` (doğru olan) ve
  //      `0055-HR-001`. Eski kayıtlar BİLİNÇLİ olarak dönüştürülmedi
  //      (yayınlanmış raporların kodu teslim edilmiş PDF'lerle aynı kalmalı).
  //      Yani bu alan bir anahtar değil, mühendisin belge kodu beyanıdır.
  //
  //   B) YABANCI ANAHTAR — `job_items.project_id` ↔ `drawing_packages.job_item_id`
  //      İki uçta da uygulamanın KENDİ yazdığı kimlikler var
  //      (`assignProjectToJob` ve `remapPackageItemNo`); kimse elle yazmaz.
  //
  // GÖVDE B'DİR. Ama B tek başına gerçek bir durumu kaçırır: paket kalem
  // açılmadan yüklenmişse `job_item_id` hâlâ boştur ve şema bunu BİLEREK hoş
  // görür — "kalem numarası METİN, bağlantı TÜREVDİR" (20260810000001:89-93).
  // Bu yüzden ikinci bir ağ olarak kalem numarası METNİ de sorulur; ama o metin
  // `doc_no`dan değil `job_items.item_no`dan okunur: sistemin kendi
  // numaralandırması, mühendisin yazdığı belge kodu değil.
  //
  // `maybeSingle()` KULLANILMAZ: `job_items.project_id` üzerinde tekillik
  // kısıtı yoktur ve iki kalem aynı rapora bakıyorsa `maybeSingle` hata verip
  // kartı tümden düşürürdü. Hoşgörü ilkesi: ne bulursak birleştiririz.
  const { data: itemRows } = await supabase
    .from("job_items")
    .select("id, item_no")
    .eq("project_id", projectId);

  const items = itemRows ?? [];
  const jobItemIds = items.map((i) => i.id as string).filter(Boolean);

  // Kalem numaraları KANONİKLEŞTİRİLİR (`itemNoOf` → "0043-00"). Üç işi
  // birden görür:
  //   1. Paketin `item_no`su da aynı çözümleyiciden geçtiği için "00057-00"
  //      gibi bir yazım farkı burada kapanır.
  //   2. Süzgeç dizgesi PostgREST için bir SORGU DİLİDİR ve `item_no` serbest
  //      metin sütunudur; yalnız `NNNN-NN` biçimini geçirmek enjeksiyon
  //      yüzeyini kapatır.
  //   3. BOŞ KALEM NUMARASI SÜZGECE HİÇ GİRMEZ. Sütun `text not null
  //      default ''`tir; boş değer bir değer değil bir EKSİKLİKTİR ve
  //      `item_no.in.("")` henüz eşleşmemiş BÜTÜN paketleri bu vincin
  //      paketiymiş gibi gösterirdi. Aynı tuzak `loadSiblingPackages` ve
  //      `versions/page.tsx` içinde de belgelidir.
  const itemNos = new Set(
    items.map((i) => itemNoOf(String(i.item_no ?? ""))).filter(Boolean)
  );

  // SON ÇARE. Proje hiçbir iş kalemine bağlanmamışsa elimizde başka kimlik
  // yoktur; `doc_no` yalnız KANONİK biçimdeyken kabul edilir. `0055` ve
  // `0055-HR-001` yazımlarından `itemNoOf` boş döner ve kart sessizce
  // çizilmez — bu modülde sessizlik, yanlış vincin resimlerini göstermekten
  // iyidir (Teknik Resimler ilkesi 3: yanlış alarm en büyük düşman).
  if (jobItemIds.length === 0 && itemNos.size === 0) {
    const kanonik = itemNoOf(docNo ?? "");
    if (kanonik) itemNos.add(kanonik);
  }

  const filtreler: string[] = [];
  if (jobItemIds.length > 0) filtreler.push(`job_item_id.in.(${jobItemIds.join(",")})`);
  if (itemNos.size > 0) {
    filtreler.push(`item_no.in.(${[...itemNos].map((n) => `"${n}"`).join(",")})`);
  }
  if (filtreler.length === 0) return null;

  const { data } = await supabase
    .from("drawing_packages")
    .select(PAKET_ALANLARI)
    .or(filtreler.join(","))
    .order("item_no", { ascending: true })
    .order("group_code", { ascending: true })
    // Aynı grubun en yeni revizyonu üstte: süperse edilmiş sürüm listeden
    // DÜŞÜRÜLMEZ (kayıt silinmez), yalnız altta kalır ve durum rozetiyle
    // kendini söyler.
    .order("rev_no", { ascending: false });

  const paketler = (data ?? []) as unknown as PackageSummary[];
  if (paketler.length === 0) return null;

  const kalemEtiketi = [...itemNos].join(" · ");

  return (
    <section className="border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Layers className="size-4 text-primary" />
          Teknik Resim Paketleri ({paketler.length})
        </h3>
        <Link
          href="/drawings"
          className="oc-tap inline-flex items-center text-[11px] text-primary hover:underline"
        >
          Teknik Resimler
        </Link>
      </header>

      <p className="border-b px-4 py-2 text-[11px] text-muted-foreground">
        {kalemEtiketi
          ? `Bu vincin iş kalemine (${kalemEtiketi}) bağlı paketler.`
          : "Bu vincin iş kalemine bağlı paketler."}{" "}
        Dosya sayısı depodaki ÖLÇÜMdür, yükleme beyanı değil. Paketler Teknik
        Resimler bölümünde açılır ve yönetilir.
      </p>

      <ul className="divide-y">
        {paketler.map((p) => {
          const depo = storageState(p);
          return (
            <li key={p.id}>
              {/* Bağlantı satırın TAMAMIDIR: `px-4 py-3` + iki satır metin
                  dokunma hedefini kendiliğinden 44px'in üstüne çıkarır, ayrıca
                  `.oc-tap` gerekmez (AGENTS dokunmatik md. 1). */}
              <Link
                href={`/drawings/${p.id}`}
                className="block px-4 py-3 hover:bg-muted/40"
              >
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span
                    className="min-w-0 truncate text-sm font-medium"
                    title={p.folder_name}
                  >
                    {p.description || p.folder_name}
                    {p.capacity && (
                      <span className="ml-1 text-muted-foreground">({p.capacity})</span>
                    )}
                  </span>
                  <span className="border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {PACKAGE_STATUS_LABELS[p.status]}
                  </span>
                </span>

                {/* REVİZYON HER ZAMAN YAZILIR — paket künyesinde (layout.tsx)
                    yalnız R01'in üstünde görünür, çünkü orada gürültüdür.
                    Burada tam tersi: bu kart var olma sebebini eski defterle
                    ÇELİŞMEKTEN alır ("Rev B · Onaylı" ↔ "R02 · süperse") ve
                    çelişkinin görünmesi için revizyonun hep okunması gerekir. */}
                <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                  {[
                    p.group_code && `grup ${p.group_code}`,
                    `R${String(p.rev_no).padStart(2, "0")}`,
                    `${formatNum(p.part_count)} parça`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  {" · "}
                  <span
                    className={depo.missing > 0 ? "font-semibold text-destructive" : undefined}
                  >
                    {formatNum(depo.stored)}/{formatNum(depo.expected)} dosya depoda
                  </span>
                  {" · "}
                  {formatBytes(depo.storedBytes)}
                  {/* Ölçülmemiş sayı ile ölçülmüş sayı aynı yazıyla basılmaz:
                      doğrulanmamış pakette rakamlar devralınmıştır. */}
                  {!depo.verifiedAt && " · henüz doğrulanmadı"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
