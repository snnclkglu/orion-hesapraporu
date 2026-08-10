// Aşama defteri yönetimi — YÖNETİM PANELİNDE DEĞİL, BÖLÜMÜN İÇİNDE.
//
// Ekranın `/admin` altına KONMAMASI bir yerleşim tercihi değil bir YETKİ
// kararıdır. `admin/layout.tsx` admin olmayan herkesi `/projects`e yönlendirir;
// oysa 20260810000002 bu defterin yazma yetkisini bilinçle
// `can_edit_drawings()` yapmıştır ve satır 124-126 bunu "…`is_admin()` değil"
// diye açıkça yazar. Defteri yönetim paneline koymak, RLS'in Mühendis ve
// TEKNİK RESSAM'a verdiği yetkiyi arayüzün geri alması olurdu — üstelik
// aşamaları gerçekten bilen roller tam olarak onlar.
//
// OKUMA HERKESE AÇIKTIR (RLS'te `select … using (true)`, bölüm kabuğunda da
// yetki kapısı yok): defteri görmek, üretim tahtasındaki çipin ne anlama
// geldiğini görmektir. Yazma `canEditDrawings` ile sorulur ve salt-okunur
// kullanıcı listeyi görür, düğmeleri görmez; asıl engel yine RLS'tir.

import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { StagesBoard, type StageAdminRow } from "./stages-board";

interface AsamaSatiri {
  id: string;
  slug: string;
  name: string;
  sort: number;
  color_hue: number;
  active: boolean;
  note: string;
}

export default async function DrawingStagesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditDrawings(profile?.role);

  // Sıralama `actions.ts`teki `defteriOku` ile BİREBİR AYNI olmalı: "bir yukarı"
  // kullanıcının GÖRDÜĞÜ listede bir yukarıdır (gerekçe orada yazılı).
  const { data: satirlar, error } = await supabase
    .from("drawing_stages")
    .select("id, slug, name, sort, color_hue, active, note")
    .order("sort", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    // Defter okunamıyorsa ekran ÇÖKMEZ. `[id]/progress/page.tsx`teki ile aynı
    // ilke: bir ekranın 500 vermesi, kullanıcının modüle olan güvenini bir
    // defada bitirir. Burada yedek sözlükle çalışmak anlamsız olurdu (bu ekran
    // defterin KENDİSİDİR), o yüzden sakin bir açıklama basılır.
    return (
      <>
        <PageHeader
          backHref="/drawings"
          backLabel="Teknik Resimler"
          title="Aşama Defteri"
          hint="Üretim aşamalarının adı, sırası ve rengi"
        />
        <div className="flex flex-col items-center justify-center gap-3 border bg-card px-6 py-16 text-center">
          <h2 className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em]">
            [ DEFTER OKUNAMADI ]
          </h2>
          <p className="max-w-md text-sm text-foreground/70">
            Aşama defteri şu anda okunamıyor; veritabanı güncellemesi henüz
            uygulanmamış olabilir. Üretim tahtası bu sırada yedek sözlükle
            çalışmaya devam eder, işaretlemeler kaybolmaz.
          </p>
          <p className="max-w-md font-mono text-[11px] text-muted-foreground">{error.message}</p>
        </div>
      </>
    );
  }

  const defter = (satirlar ?? []) as unknown as AsamaSatiri[];

  // KULLANIM AŞAMA AŞAMA SAYILIR, tek sorguda okunup JS'te gruplanmaz.
  //
  // `drawing_part_progress` binlerce satır olabilir (261 parçalık bir pakette
  // yedi aşama × birden çok paket) ve PostgREST varsayılan olarak satır sayısını
  // kırpar. Kırpılmış bir liste kullanımı EKSİK gösterirdi — eksik gösterilen
  // kullanım ise gerçekten kullanılan bir aşamayı "hiç kullanılmamış" sanıp
  // silme düğmesini açardı. `head: true` ile yalnız sayı gelir; defter onlarca
  // satır olduğu için bu istek sayısı da sabit ve küçüktür.
  const kullanimlar = await Promise.all(
    defter.map(async (s) => {
      const { count } = await supabase
        .from("drawing_part_progress")
        .select("id", { count: "exact", head: true })
        .eq("stage", s.slug);
      return count ?? 0;
    })
  );

  const rows: StageAdminRow[] = defter.map((s, i) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    sort: Number(s.sort) || 0,
    colorHue: Number(s.color_hue) || 0,
    active: s.active !== false,
    note: s.note ?? "",
    usage: kullanimlar[i],
  }));

  return (
    <>
      <PageHeader
        backHref="/drawings"
        backLabel="Teknik Resimler"
        title="Aşama Defteri"
        hint="Üretim aşamalarının adı, sırası ve rengi"
      />
      <StagesBoard rows={rows} canWrite={yazabilir} />
    </>
  );
}
