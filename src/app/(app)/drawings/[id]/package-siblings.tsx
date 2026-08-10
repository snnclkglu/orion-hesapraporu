// KARDEŞ PAKET ŞERİDİ — aynı iş kaleminin DİĞER paketleri.
//
// Bir iş birden çok paketle gelir ve bu ilk günden destekleniyor: anahtar
// (kalem, grup) çiftidir, tekillik kısıtı BİLİNÇLİ olarak yoktur.
// `0057-00` + `0500` (monoray) ile `0057-00` + `2000` (köprü) aynı vincin ayrı
// teslimleridir ve birbirini etkilemez.
//
// EKSİK OLAN GEÇİŞTİ. Monoraya bakan mühendis köprüye geçmek için paketten
// TAMAMEN çıkmak zorundaydı (Geri → "Kalem No" başlığı → doğru satır); künye o
// vincin başka paketleri OLDUĞUNU bile söylemiyordu. Oysa bunlar ayrı işler
// değil, aynı işin parçalarıdır — birinden diğerine geçmek listeye dönmeyi
// gerektirmemeli.
//
// SÜRÜMLER SEKMESİYLE KARIŞMAZ ve onun yerini de tutmaz. Orası TEK BİR
// (kalem, grup) çiftinin ZAMANDAKİ zinciridir; bu şerit GRUPLARI yan yana
// koyar. Biri "bu paketin geçmişi", diğeri "bu vincin geri kalanı".
//
// KARDEŞ YOKSA HİÇ RENDER EDİLMEZ — boş bir kutu, her açılışta okunması gereken
// bir gürültüdür (`resume-card.tsx`teki emsalin aynısı). Tek paketli işler
// çoğunlukta olduğu için bu şerit sayfaların çoğunda hiç görünmeyecektir; onu
// gördüğü an kullanıcı bir şey ÖĞRENİR.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { PACKAGE_STATUS_LABELS, formatNum } from "@/lib/drawings/labels";
import { KARDES_SINIRI, loadSiblingPackages } from "../data";

export async function PackageSiblings({
  itemNo,
  packageId,
}: {
  itemNo: string;
  packageId: string;
}) {
  const supabase = await createClient();
  const kardesler = await loadSiblingPackages(supabase, itemNo, packageId);
  if (!kardesler.length) return null;

  const gosterilen = kardesler.slice(0, KARDES_SINIRI);
  const kesildi = kardesler.length > KARDES_SINIRI;

  return (
    <section className="border bg-card px-3 py-2" aria-label="Aynı kalemin diğer paketleri">
      {/* Künyenin tipografisiyle aynı satır dili (mono · 11px · soluk): bu
          şerit yeni bir kart değil, künyenin devamıdır. */}
      <p className="font-mono text-[11px] text-muted-foreground">
        Aynı kalemin diğer paketleri ·{" "}
        {kesildi
          ? `ilk ${formatNum(KARDES_SINIRI)} paket gösteriliyor`
          : `${formatNum(gosterilen.length)} paket`}
      </p>

      {/* YATAY KAYDIRMA GÖRÜNÜR OLMALI (AGENTS dokunmatik md. 8): mobil
          tarayıcı çubuk çizmez, `.oc-scrollx` yalnız o yönde içerik varken
          kenar gölgesi gösterir. Negatif kenar boşluğu gölgeyi kartın ta
          kenarına taşır, `px-3` çiplerin dolgusunu geri verir — aksi hâlde
          gölge içeriden başlar ve "burada devam ediyor" demez.
          Çipler `shrink-0`dır: sığdırmak için daralsalardı 375px'te üç kardeş
          okunamayacak kadar incelir, taşma da hiç görünmezdi. */}
      <div className="oc-scrollx -mx-3 mt-1.5 flex gap-2 overflow-x-auto overscroll-x-contain px-3 [--oc-scroll-bg:var(--card)]">
        {gosterilen.map((k) => {
          // SÜPERSE EDİLMİŞ KARDEŞ GİZLENMEZ: emekli bir teslim de o vincin
          // gerçeğidir ve mühendis bazen tam onu arar. Ama hangisinin geçerli
          // olduğu görünmelidir — kesikli çerçeve + durum rozeti + revizyon
          // numarası birlikte bunu söyler. Uyarı rengi KULLANILMAZ: süperse bir
          // kusur değil bir arşiv gerçeğidir (modülün rapor dili suçlamaz).
          const emekli = k.status === "superse";
          return (
            <Link
              key={k.id}
              href={`/drawings/${k.id}`}
              title={k.folder_name}
              className={cn(
                // Genişlik SABİT: çipler eşit boyda olunca göz onları tek bir
                // liste olarak okur ve kırpma noktası öngörülebilir olur.
                // 14rem, 375px'lik ekranda bir sonraki çipin kenarını görünür
                // bırakır — kaydırılabildiğinin ikinci kanıtı.
                "oc-tap flex w-[14rem] shrink-0 flex-col gap-1 border px-2.5 py-2 transition-colors hover:border-primary/50 hover:bg-muted/50",
                emekli ? "border-dashed" : "bg-background"
              )}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {/* Grup kodu YOKSA uydurulmaz. Boş olması "tanıyamadım"
                    demektir; yerine bir etiket koymak paketin sahip olmadığı
                    bir bilgiyi varmış gibi gösterirdi. Kimliği alttaki açıklama
                    satırı taşır. */}
                {k.group_code && (
                  <span className="truncate font-mono text-[11px] font-semibold">
                    grup {k.group_code}
                  </span>
                )}
                <span className="shrink-0 border bg-muted px-1 py-px font-mono text-[11px] text-muted-foreground">
                  {PACKAGE_STATUS_LABELS[k.status]}
                </span>
                {k.rev_no > 1 && (
                  <span className="shrink-0 border bg-muted px-1 py-px font-mono text-[11px] text-muted-foreground">
                    R{String(k.rev_no).padStart(2, "0")}
                  </span>
                )}
              </span>
              <span className={cn("truncate text-[12px]", emekli && "text-muted-foreground")}>
                {k.description || k.folder_name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
