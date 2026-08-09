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

import { PageHeader } from "@/components/page-header";

export default function DrawingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Teknik Resimler"
        hint="Teknik ressamın klasörü olduğu gibi yüklenir; sistem içindekini okur ve neyi anlayamadığını söyler"
      />
      {children}
    </div>
  );
}
