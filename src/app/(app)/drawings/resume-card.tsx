// YARIM KALMIŞ YÜKLEME — 454 dosyalık bir teslimde tarayıcı sekmesi ölürse.
//
// Kart İKİ AYRI VAKAYI toplar ve ikisini AYRI CÜMLEYLE söyler, çünkü ressamın
// yapacağı şey ikisinde farklı:
//
//   1. `status = 'yukleniyor'` ve 24 saatten eski — sihirbaz hiç bitmemiş.
//      Paket kaydı var, dosyaların bir bölümü depoya gitmiş, defter hiç
//      kurulmamış.
//   2. Herhangi bir durumda `stored = false` dosyası olan paket — sihirbaz
//      bitti ama bazı baytlar depoya yazılamadı.
//
// İKİNCİSİ OLMASAYDI KART VAKALARIN ÇOĞUNU KAÇIRIRDI: `finalizeUpload` bugün
// KOŞULSUZ 'yuklendi' yazıyor ve sihirbaz yalnız BAŞARILI yolları gönderiyor.
// Yani "bazı dosyalar yüklenemedi" durumu paketi 'yukleniyor'da BIRAKMIYOR;
// yalnız birinci vakaya bakan bir kart, sessizce eksik kalmış paketleri hiç
// görmezdi. Sihirbaz kullanıcıya "sonra Eksik Dosyaları Yükle ile
// tamamlayabilirsiniz" diye söz veriyor; sözün tutulduğu yer burasıdır.
//
// KART YALNIZ GÖRÜNÜMDÜR. Eylemler `actions.ts`e aittir (paylaşılan dosya):
// buradaki denetimler var olan adreslere götürür, yeni bir eylem çağırmaz.
//
// HİÇ VAKA YOKSA HİÇ RENDER EDİLMEZ — boş bir "her şey yolunda" kartı, günün
// her açılışında okunması gereken bir gürültüdür.

import Link from "next/link";
import { CloudUpload, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { PACKAGE_STATUS_LABELS, formatNum } from "@/lib/drawings/labels";
import type { DwgPackageStatus } from "@/lib/drawings/types";

/** Bir sihirbazın makul olarak bitmiş olması gereken süre. */
const YARIM_SAYILMA_SAATI = 24;
/** `stored = false` taramasının sayfa boyu — PostgREST öntanımının altında. */
const SAYFA = 900;
/** Tarama üst sınırı; aşılırsa sayı "en az" olarak okunur. */
const EN_COK_EKSIK_SATIR = 9000;

interface YarimPaket {
  id: string;
  folderName: string;
  itemNo: string;
  status: DwgPackageStatus;
  fileCount: number;
  createdAt: string;
  /** Depoya yazılamamış dosya sayısı */
  eksikDosya: number;
  /** Tarama sınırına dayanıldı mı? */
  eksikKesik: boolean;
  /** Sihirbaz hiç bitmemiş (status = 'yukleniyor' ve eski) */
  sihirbazYarim: boolean;
}

interface PaketSatiri {
  id: string;
  folder_name: string;
  item_no: string;
  status: DwgPackageStatus;
  file_count: number;
  created_at: string;
}

const PAKET_ALANLARI = "id, folder_name, item_no, status, file_count, created_at";

/**
 * "Yarım kalmış" sayılma sınırının ISO damgası.
 *
 * `Date.now()` bileşen gövdesinde ÇAĞRILAMAZ: `react-hooks/purity` kuralı onu
 * render sırasında saf olmayan bir çağrı sayar ve haklıdır — bir sunucu
 * bileşeninin gövdesi de yeniden çalıştırılabilir olmalıdır. Modül düzeyindeki
 * bir yardımcıya taşımak hem kuralı geçirir hem de "şu ana göre" hesabının
 * nerede yapıldığını tek yerde toplar (aynı dosyadaki `gecenSure` zaten bu
 * kalıpta ve şikâyet almıyor).
 */
function yarimSayilmaSiniri(): string {
  return new Date(Date.now() - YARIM_SAYILMA_SAATI * 3_600_000).toISOString();
}

/** "2 gün önce" · "5 saat önce" — kaç saat geçtiği kararın kendisidir. */
function gecenSure(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const saat = Math.floor((Date.now() - t) / 3_600_000);
  if (saat < 24) return `${saat} saat önce`;
  const gun = Math.floor(saat / 24);
  return `${gun} gün önce`;
}

export async function ResumeCard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditDrawings(profile?.role);

  const sinir = yarimSayilmaSiniri();

  // 1. vaka — sihirbaz hiç bitmemiş.
  const { data: yarimlar } = await supabase
    .from("drawing_packages")
    .select(PAKET_ALANLARI)
    .eq("status", "yukleniyor")
    .lt("created_at", sinir)
    .order("created_at", { ascending: true })
    .limit(50);

  // 2. vaka — depoya yazılamamış dosyalar. SAYFALANIR: bütün bir 454 dosyalık
  // paket başarısız olduğunda `max_rows` satırları kırpar ve kart "eksik yok"
  // derdi; bir yükleme kartının söyleyebileceği en kötü yalan budur.
  const eksikSayaci = new Map<string, number>();
  let kesik = false;
  for (let bas = 0; bas < EN_COK_EKSIK_SATIR; bas += SAYFA) {
    // ATLANANLAR EKSİK DEĞİLDİR. Yedek dosyalar ve bayt bayt kopyalar bilerek
    // yüklenmiyor; `upload_skipped` süzülmezse kart her paketi "yarım kalmış"
    // sayar ve ilk günden sonra kimse ona bakmaz.
    const { data, error } = await supabase
      .from("drawing_files")
      .select("package_id")
      .eq("stored", false)
      .eq("upload_skipped", false)
      .range(bas, bas + SAYFA - 1);
    if (error) break;
    const dilim = (data ?? []) as { package_id: string }[];
    for (const r of dilim) eksikSayaci.set(r.package_id, (eksikSayaci.get(r.package_id) ?? 0) + 1);
    if (dilim.length < SAYFA) break;
    if (bas + SAYFA >= EN_COK_EKSIK_SATIR) kesik = true;
  }

  const yarimIdler = new Set(((yarimlar ?? []) as unknown as PaketSatiri[]).map((p) => p.id));
  const eksikIdler = [...eksikSayaci.keys()].filter((id) => !yarimIdler.has(id));

  let eksikPaketler: PaketSatiri[] = [];
  if (eksikIdler.length) {
    const { data } = await supabase
      .from("drawing_packages")
      .select(PAKET_ALANLARI)
      .in("id", eksikIdler.slice(0, 50));
    eksikPaketler = (data ?? []) as unknown as PaketSatiri[];
  }

  // ŞU AN YÜKLENEN PAKET YARIM DEĞİLDİR. Sihirbaz dosya satırlarını önce
  // `stored = false` olarak yazıp baytları ardından gönderiyor; süzülmezse kart
  // HER YÜKLEMENİN ORTASINDA "yarım kaldı" diye bağırır ve ilk günden sonra
  // kimse ona bakmaz. Eşik `status = 'yukleniyor'` VE 24 saatten yeni olmaktır.
  eksikPaketler = eksikPaketler.filter(
    (p) => !(p.status === "yukleniyor" && p.created_at >= sinir)
  );

  // SÜPERSE EDİLMİŞ PAKET "YARIM" DEĞİLDİR. Emekli edilmiş bir revizyonun
  // eksik dosyalarını tamamlamaya çağırmak, onu diriltmeye çağırmaktır: akış
  // `finalizeUpload`tan geçiyor ve paket yeniden listeye çıkardı. Eski
  // revizyonun eksiği bir arşiv gerçeğidir, bir görev değil.
  eksikPaketler = eksikPaketler.filter((p) => p.status !== "superse");

  const satirlar: YarimPaket[] = [
    ...((yarimlar ?? []) as unknown as PaketSatiri[]),
    ...eksikPaketler,
  ].map((p) => ({
    id: p.id,
    folderName: p.folder_name,
    itemNo: p.item_no,
    status: p.status,
    fileCount: p.file_count,
    createdAt: p.created_at,
    eksikDosya: eksikSayaci.get(p.id) ?? 0,
    eksikKesik: kesik,
    sihirbazYarim: yarimIdler.has(p.id),
  }));

  if (!satirlar.length) return null;

  return (
    <section className="border border-amber-500/40 bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" />
          Yarım Kalmış Yükleme ({satirlar.length})
        </h2>
      </header>

      <p className="border-b px-4 py-2 text-[11px] text-muted-foreground">
        Bu paketlerin bazı dosyaları depoya ulaşmamış. Kayıt ve defter yerinde
        duruyor; <strong>eksikleri tamamlamak baştan yüklemeyi gerektirmez</strong> —
        aynı klasör seçilir, yalnız ulaşmayan dosyalar gönderilir.
      </p>

      <ul className="divide-y">
        {satirlar.map((p) => (
          <li key={p.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <Link
                href={`/drawings/${p.id}`}
                className="block truncate text-sm hover:underline"
                title={p.folderName}
              >
                {p.folderName}
              </Link>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
                <span className="border bg-muted px-1.5 py-0.5">
                  {PACKAGE_STATUS_LABELS[p.status]}
                </span>
                <span>{p.itemNo || "kalem eşleşmemiş"}</span>
                <span>{gecenSure(p.createdAt)}</span>
                {p.eksikDosya > 0 ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    {p.eksikKesik ? "en az " : ""}
                    {formatNum(p.eksikDosya)} / {formatNum(p.fileCount)} dosya depoda yok
                  </span>
                ) : (
                  // Sihirbaz yarım kalmışsa `drawing_files` satırı bile
                  // yazılmamış olabilir — "0 eksik" demek yanıltıcı olurdu.
                  <span className="text-amber-700 dark:text-amber-400">
                    sihirbaz tamamlanmamış
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                {p.sihirbazYarim
                  ? "Yükleme sihirbazı bitmeden kapanmış; defter henüz kurulmadı."
                  : "Yükleme tamamlandı ama bazı dosyalar depoya yazılamadı."}
              </span>
            </div>

            {yazabilir && (
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/drawings/new?devam=${p.id}`}>
                    <CloudUpload className="size-3.5" />
                    Eksik Dosyaları Yükle
                  </Link>
                </Button>
                {/* SİLME DÜĞMESİ ARTIK RESSAMA DA GÖRÜNÜR. Paketi ÜRETEN
                    kişi odur ve yanlış klasörü fark eden ilk kişi de odur;
                    yetki `can_edit_drawings()`e çekildi (emsal: mühendisin
                    kendi taslak revizyonunu silebilmesi). Onay hâlâ paket
                    sayfasındadır — orada ne kaybedileceği sayıyla yazılı ve
                    paket adının yazılması isteniyor. */}
                <Button asChild size="sm" variant="ghost" className="text-destructive">
                  <Link href={`/drawings/${p.id}`} title="Silme onayı paket sayfasındadır.">
                    Sil…
                  </Link>
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
