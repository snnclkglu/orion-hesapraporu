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

  // ETİKET SÜTUNU İKİ DENEMEDE OKUNUR: `tags` 20260812 migration'ıyla geliyor
  // ve o uygulanmadan önce sütunu isteyen bir `select` BÜTÜN listeyi düşürür —
  // yönetici kullanıcıları hiç göremezdi. Sütun yoksa etiket seçici kapanır.
  const zengin = await supabase
    .from("profiles")
    .select("id, full_name, email, title, role, tags, created_at")
    .order("created_at", { ascending: true });
  const profiles = zengin.error
    ? (
        await supabase
          .from("profiles")
          .select("id, full_name, email, title, role, created_at")
          .order("created_at", { ascending: true })
      ).data
    : zengin.data;
  const etiketDefteriVar = !zengin.error;

  const adminCount = (profiles ?? []).filter((p) => p.role === "admin").length;

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Kullanıcılar</h2>
        <p className="text-sm text-muted-foreground">
          Rol, unvan ve görev etiketi düzenleme. Yeni kullanıcılar Supabase Auth üzerinden
          davet edilir; burada sadece profil bilgileri yönetilir. Hangi bölümün kime açık
          olduğunu <strong>Yetkiler</strong> sayfası gösterir.
        </p>
      </div>
      {!etiketDefteriVar && (
        <p className="border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
          Görev etiketi defteri henüz kurulmamış (migration uygulanmadı). Rol ve unvan
          düzenlemesi çalışıyor; Satın Alma · Planlama · Üretim etiketleri migration
          uygulandığında açılır.
        </p>
      )}
      <div className="rounded-lg border">
        {/* `max-xl:block`: dar kipte tablo yerleşimi tamamen bırakılır (tablo ·
            gövde · satır · hücre blok olur), satırlar ızgaraya döner. Yalnız
            satırı ızgara yapmak tarayıcıyı anonim tablo kutuları üretmeye
            zorlardı; sonuç aynı görünse de sütun genişliği hesabı öngörülemez
            olurdu. */}
        <Table className="max-xl:block">
          {/*
            SÜTUN BAŞLIKLARI YALNIZ GENİŞ EKRANDA. Bu tablo aslında satır başına
            bir FORMdur: dört düzenleme alanı + Kaydet yan yana ~730px istiyor
            ve 360px'te satır iki buçuk ekran genişliğine çıkıyordu — kullanıcı
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
              <TableHead>Görev Etiketleri</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody className="max-xl:block">
            {(profiles ?? []).map((p) => (
              <UserRow
                key={p.id}
                profile={{ ...p, tags: (p as { tags?: string[] }).tags ?? [] }}
                isSelf={p.id === user?.id}
                adminCount={adminCount}
                canEditTags={etiketDefteriVar}
              />
            ))}
            {(profiles ?? []).length === 0 && (
              <TableRow className="max-xl:block">
                <TableCell
                  colSpan={6}
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
