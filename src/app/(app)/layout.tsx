import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/logout-button";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/projects" className="font-semibold tracking-tight">
            ORION <span className="text-muted-foreground font-normal">Hesap Raporu</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {profile?.role === "admin" && (
              <Link href="/admin" className="text-muted-foreground hover:text-foreground">
                Yönetim
              </Link>
            )}
            <span className="text-muted-foreground">
              {profile?.full_name || user.email}
              {profile?.role === "admin" && (
                <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">admin</span>
              )}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
