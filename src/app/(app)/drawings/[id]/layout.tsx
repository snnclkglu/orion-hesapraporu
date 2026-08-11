// Paket kabuğu: kırıntı yolu + künye + bölüm rayı.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PACKAGE_STATUS_LABELS, formatBytes, formatNum, recognitionClass } from "@/lib/drawings/labels";
import { RECONCILER_VERSION } from "@/lib/drawings/reconcile";
import { loadPackage, storageState } from "../data";
import { PackageNav } from "./package-nav";
import { PackageOutputs } from "./package-outputs";
import { PackageSiblings } from "./package-siblings";

export default async function PackageLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const supabase = await createClient();
  const paket = await loadPackage(supabase, id);
  if (!paket) notFound();

  const eskiKural = paket.reconciler_version > 0 && paket.reconciler_version < RECONCILER_VERSION;
  const depo = storageState(paket);

  return (
    <div className="grid gap-3">
      {/* Paketin kimliği kabuğun üst şeridine de çıkar: telefonda şerit
          yapışkandır, yani kullanıcı listeyi aşağı kaydırırken hangi pakette
          olduğunu ve nasıl geri döneceğini kaybetmez. */}
      <PageHeader
        backHref="/drawings"
        backLabel="Teknik Resimler"
        title={paket.description || paket.folder_name}
        hint={paket.capacity ?? undefined}
      />
      {/* Kırıntı yolu YALNIZ `xl` üstünde: altında aynı işi üst şeritteki geri
          oku görüyor ve iki "yukarı" göstergesi yan yana gürültü oluyordu. */}
      <nav className="hidden flex-wrap items-center gap-1 text-sm text-muted-foreground xl:flex">
        <Link href="/drawings" className="inline-flex items-center hover:underline">
          <ChevronLeft className="size-4" />
          Teknik Resimler
        </Link>
        <span aria-hidden>/</span>
        <span className="min-w-0 truncate text-foreground" title={paket.folder_name}>
          {paket.description || paket.folder_name}
        </span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3 border bg-card p-4">
        <div className="min-w-0">
          {/* `h2`: sayfanın `h1`i artık kabuğun üst şeridindedir (PageHeader). */}
          <h2 className="truncate text-base font-medium" title={paket.folder_name}>
            {paket.description || paket.folder_name}
            {paket.capacity && <span className="ml-1 text-muted-foreground">({paket.capacity})</span>}
          </h2>
          {/* KÜNYE ARTIK BEYANI DEĞİL ÖLÇÜMÜ BASAR.
              Eski satır `file_count` ve `bytes_total` yazıyordu; ikisi de paket
              AÇILIRKEN bir kez yazılıp bir daha güncellenmiyordu. Yani 107 MB'ın
              hiçbiri depoya ulaşmasa bile başlık "174 dosya · 107 MB" diyordu.
              Artık depodaki gerçek sayı yazılır; eksik varsa kırmızı görünür. */}
          {/* KÜNYE BAŞLIK DÜZENİNDE YAZILIR. Küçük harfli "kalem … · grup … ·
              174/174 dosya depoda" satırı bir not gibi duruyordu; bu satır
              paketin kimliğidir ve müşteriye giden belgelerle aynı ağırlıkta
              görünmelidir. Sözcük başları büyük, KODLAR VE BİRİMLER olduğu
              gibi ("0057-00", "MB") — bir kod büyütülmez, bir birim küçültülmez. */}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {[
              paket.item_no ? `Kalem ${paket.item_no}` : "Kalem Eşleşmemiş",
              paket.group_code && `Grup ${paket.group_code}`,
              paket.rev_no > 1 && `R${String(paket.rev_no).padStart(2, "0")}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            {" · "}
            <span className={depo.missing > 0 ? "font-semibold text-destructive" : undefined}>
              {formatNum(depo.stored)}/{formatNum(depo.expected)} Dosya Depoda
            </span>
            {" · "}
            {formatBytes(depo.storedBytes)}
            {/* PAYDA ATLANANLARI DÜŞER. `bytes_total` ile karşılaştırmak,
                hiçbir bayt kaybetmemiş bir pakette bile kalıcı olarak
                "91,6 MB / 107 MB" gösterirdi — atlanan 15,4 MB'ın nesnesi hiç
                yoktur. İki sayı ancak aynı şeyi sayarken karşılaştırılabilir. */}
            {depo.storedBytes < depo.expectedBytes && (
              <span className="text-muted-foreground/70">
                {" / "}
                {formatBytes(depo.expectedBytes)}
              </span>
            )}
            {" · "}
            {formatNum(paket.part_count)} Parça
            {depo.skipped > 0 && ` · ${formatNum(depo.skipped)} Dosya Atlandı`}
            {!depo.verifiedAt && " · Henüz Doğrulanmadı"}
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground/70" title={paket.folder_name}>
            {paket.folder_name}
          </p>
        </div>

        {/* `shrink-0` DEĞİL `min-w-0`: `shrink-0` verilen bir flex öğesinin
            kullanılan genişliği max-content'tir ve içindeki `flex-wrap` hiç
            devreye girmez — satır kırmak için daralması gerekir, daralamaz.
            Bu faz düğme sayısını ikiden beşe çıkardı; blok ~1150px'e ulaşıp
            375px'lik telefonda bütün sayfayı yana kaydırıyordu (AGENTS
            dokunmatik md. 8: görünmeyen yatay kaydırma). */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-right">
            <span className="oc-kicker block text-muted-foreground">Tanıma</span>
            <span className={`font-mono text-lg font-semibold ${recognitionClass(paket.recognition_pct)}`}>
              {paket.recognition_pct == null ? "—" : `%${paket.recognition_pct}`}
            </span>
          </span>
          <span className="border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {PACKAGE_STATUS_LABELS[paket.status]}
          </span>
          {eskiKural && (
            <span className="border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">
              Kural Eski
            </span>
          )}
          {/* ÇIKTILAR yetki kapısının DIŞINDA: indirmek okumadır, paketi
              değiştirmez. Müdürün satın alma listesine erişememesi anlamsız
              olurdu.

              PAKETİ DEĞİŞTİREN EYLEMLER BU ŞERİTTE DEĞİL, SÜRÜMLER BÖLÜMÜNDE.
              "Yeniden Eşleştir · Depoyu Doğrula · İçerikleri Yeniden Oku ·
              Sil" her sekmede görünüyordu; oysa bu sayfayı atölye, satınalma
              ve müdür de açıyor ve onların işi paketi yeniden kurmak değil
              okumaktır. Yetkisi olmayan zaten göremiyordu ama yetkisi OLAN da
              günde otuz kez yanından geçtiği bir düğmeye yanlışlıkla basabilir.
              Arşiv ve bakım işleri arşiv sekmesinde durur. */}
          <PackageOutputs packageId={paket.id} />
        </div>
      </header>

      {/* KARDEŞ PAKETLER KÜNYENİN HEMEN ALTINDA. "Bu vincin başka paketi var
          mı" sorusu paketin KİMLİĞİNE aittir, bir alt sayfaya değil — bu yüzden
          bölüm rayının üstünde ve her sekmede durur. Kardeş yoksa bileşen hiç
          render edilmez; boş bir kutu bırakmaz (`grid gap-3` de o yüzden
          fazladan boşluk üretmez). */}
      <PackageSiblings itemNo={paket.item_no} packageId={paket.id} />

      <PackageNav packageId={paket.id} />

      {children}
    </div>
  );
}
