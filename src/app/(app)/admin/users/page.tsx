// Kullanıcı yönetimi: profil listesi + rol/unvan düzenleme.
// E-posta gösterilmez — auth.users'a istemciden erişim yok, sadece profil alanları.

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

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, title, role, created_at")
    .order("created_at", { ascending: true });

  const adminCount = (profiles ?? []).filter((p) => p.role === "admin").length;

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Kullanıcılar</h2>
        <p className="text-sm text-muted-foreground">
          Rol ve unvan düzenleme. Yeni kullanıcılar Supabase Auth üzerinden davet edilir;
          burada sadece profil bilgileri yönetilir.
        </p>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad Soyad</TableHead>
              <TableHead>Unvan</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(profiles ?? []).map((p) => (
              <UserRow
                key={p.id}
                profile={p}
                isSelf={p.id === user?.id}
                adminCount={adminCount}
              />
            ))}
            {(profiles ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
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
