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

export default function DrawingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="grid gap-4">{children}</div>;
}
