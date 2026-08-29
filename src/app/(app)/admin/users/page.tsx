// Kullanıcı yönetimi: profil listesi + ad/soyad, rol ve unvan düzenleme.

import { createClient } from "@/lib/supabase/server";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { UserRow } from "./user-row";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Tek sorgu, yedeksiz: görev etiketleri role dönüştü ve `tags` sütunu
  // düşürüldü (12.08.2026), yani "sütun henüz yoksa listeyi kaybetme" kalıbının
  // koruduğu bir şey kalmadı.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, title, role, created_at")
    .order("created_at", { ascending: true });

  const adminCount = (profiles ?? []).filter((p) => p.role === "admin").length;

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Kullanıcılar</h2>
        <p className="text-sm text-muted-foreground">
          Ad soyad, unvan ve rol düzenleme. Her kullanıcının <strong>tek bir rolü</strong> vardır
          ve uygulamada neyi görebildiğini o belirler. Yeni kullanıcılar Supabase Auth üzerinden
          davet edilir; burada sadece profil bilgileri yönetilir. Hangi bölümün kime açık
          olduğunu <strong>Yetkiler</strong> sayfası gösterir. Kullanım süresi, bölüm dağılımı,
          oturumlar ve kayıtlı işlemler için satırdaki <strong>Profil</strong> düğmesini açın.
        </p>
      </div>
      <div className="rounded-lg border">
        {/* `max-xl:block`: dar kipte tablo yerleşimi tamamen bırakılır (tablo ·
            gövde · satır · hücre blok olur), satırlar ızgaraya döner. Yalnız
            satırı ızgara yapmak tarayıcıyı anonim tablo kutuları üretmeye
            zorlardı; sonuç aynı görünse de sütun genişliği hesabı öngörülemez
            olurdu. */}
        <Table className="max-xl:block">
          {/*
            SÜTUN BAŞLIKLARI YALNIZ GENİŞ EKRANDA. Bu tablo aslında satır başına
            bir FORMdur: üç düzenleme alanı + Kaydet yan yana ~640px istiyor
            ve 360px'te satır iki ekran genişliğine çıkıyordu — kullanıcı
            adını yazarken Kaydet düğmesi ekranın dışında kalıyordu.

            Kırılım `xl`, `lg` DEĞİL: yönetim panelinde kullanılabilir genişlik
            lg'de ARTMAZ, azalır — 1024px'te hem kabuk menüsü (240px) hem
            yönetim rayı (200px) devreye girer ve içeriğe ~510px kalır; asıl
            geniş bant 768–1023px tablet aralığıdır. Tablo yalnız gerçekten
            sığdığı yerde tablodur; altında satır ızgaraya döner ve alanlar alt
            alta iner (bkz. user-row.tsx). O kipte başlık satırı alanların
            karşısına düşmediğinden etiketler satırın İÇİNDE verilir.
          */}
          <TableHeader className="max-xl:hidden">
            <TableRow>
              <TableHead>Ad Soyad</TableHead>
              <TableHead>E-posta</TableHead>
              <TableHead>Unvan</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="w-48">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="max-xl:block">
            {(profiles ?? []).map((p) => (
              <UserRow
                key={p.id}
                profile={p}
                isSelf={p.id === user?.id}
                adminCount={adminCount}
              />
            ))}
            {(profiles ?? []).length === 0 && (
              <TableRow className="max-xl:block">
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground max-xl:grid max-xl:place-items-center"
                >
                  Kayıtlı kullanıcı yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
