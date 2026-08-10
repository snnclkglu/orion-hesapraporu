import Link from "next/link";
import { ListOrdered } from "lucide-react";

// Teknik Resimler bölüm kabuğu.
//
// YETKİ KAPISI YOKTUR ve bu bilinçlidir. `worklog/layout.tsx` bölüme girişi
// `canSeeWorkLog` ile keser çünkü orada gizlenecek bir şey var (atölye
// verimliliği). Burada yok: teknik resim atölyenin ortak gerçeğidir ve dört rol
// de ona bakar. RLS'te okuma `true`dur; buraya bir yönlendirme koymak, RLS'in
// izin verdiği bir şeyi arayüzde kapatmak olurdu.
//
// Yazma yetkisi ekranların İÇİNDE sorulur (`canEditDrawings`): yükleme düğmesi
// yalnız yetkisi olana görünür, eylemler ayrıca kendileri de sorar ve asıl
// engel yine RLS'tir.

// BAŞLIK BURADA DEĞİL, HER SAYFANIN KENDİSİNDEDİR.
//
// Kabuğun başlık yuvası TEK bir portal hedefidir: bu katman bir `PageHeader`
// bassaydı `[id]/layout.tsx`in kendi başlığı onu DEĞİŞTİRMEZ, yanına EKLENİRDİ
// (iki başlık, iki geri oku). Bölüm kabuğu bu yüzden yalnız ızgarayı kurar;
// "Teknik Resimler" başlığı liste sayfasına (`page.tsx`), paket başlığı da
// paket kabuğuna (`[id]/layout.tsx`) taşındı — böylece paket sayfalarında üst
// şerit paketin adını ve `/drawings`e dönüş okunu gösterebiliyor.

// AŞAMA DEFTERİNİN KAPISI BURADADIR — VE BİLEREK EN ALTTADIR.
//
// Defter (`/drawings/stages`) ayarlar niteliğinde bir ekrandır: haftada bir
// değil, ayda bir açılır. Üste konan bir gezinme şeridi bunun bedelini HER
// sayfada öderdi — paket sayfalarında zaten bir `PageHeader`, bir kırıntı yolu,
// bir künye kartı ve `PackageNav` üst üste duruyor; beşinci bir şerit telefonda
// içeriği ekranın dışına iterdi.
//
// Alt kenar aynı zamanda İHTİYACIN DOĞDUĞU YERDİR: "bu aşama listesine bir adım
// eklesem" fikri üretim tahtasına (`[id]/progress`) bakarken doğar ve bağlantı
// tam onun altında durur.
//
// Bağlantı `/drawings/stages` sayfasında da çizilir (kendine gösterir). Bunu
// önlemenin tek yolu adres yolunu (pathname) okumaktır, o da bu katmanı istemci
// bileşenine çevirmeyi gerektirirdi; bölüm kabuğu sunucuda kalsın diye bu küçük
// fazlalık kabul edildi.

export default function DrawingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid gap-4">
      {children}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
        <span>Üretim aşamalarının adı, sırası ve rengi defterde tutulur.</span>
        {/* Metin bağlantısı da bir dokunma hedefidir: `.oc-tap` görünmez bir
            katmanla hedefi 44px'e tamamlar, kutu kendi boyunda kalır. */}
        <Link
          href="/drawings/stages"
          className="oc-tap inline-flex min-h-8 items-center gap-1.5 text-foreground hover:underline"
        >
          <ListOrdered className="size-3.5" />
          Aşama Defteri
        </Link>
      </div>
    </div>
  );
}
