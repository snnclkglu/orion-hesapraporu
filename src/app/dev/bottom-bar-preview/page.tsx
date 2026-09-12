import { HammaddeNav } from "@/app/(app)/purchasing/hammadde/hammadde-nav";
import { PersonnelNav } from "@/app/(app)/personnel/personnel-nav";
import { OffersNav } from "@/app/(app)/offers/offers-nav";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminNav } from "@/app/(app)/admin/admin-nav";
import { ToolsNav } from "@/app/(app)/tools/tools-nav";
import { PackageNav } from "@/app/(app)/drawings/[id]/package-nav";
import { PackagesTable } from "@/app/(app)/drawings/packages-table";
import { JobNav } from "@/app/(app)/jobs/[id]/job-nav";
import { NotificationsBottomBar } from "@/app/(app)/notifications/bottom-bar";
import { BottomBarFixture } from "./fixture";
import { CatalogBottomTools } from "@/components/catalog-bottom-tools";

export default async function Page({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { section = "tools" } = await searchParams;
  return <AppShell role="admin" displayName="Önizleme" email="preview@example.invalid">
    <h1 className="mb-4 text-xl">Alt bar kontrolü · {section}</h1>
    {section === "hammadde" && <HammaddeNav />}
    {section === "personnel" && <PersonnelNav />}
    {section === "offers" && <OffersNav />}
    {section === "admin" && <AdminNav feedbackCount={3} />}
    {section === "tools" && <ToolsNav />}
    {section === "package" && <PackageNav packageId="preview" />}
    {section === "drawings" && <PackagesTable packages={[]} />}
    {section === "job" && <JobNav jobId="preview" hasOfferDocument />}
    {section === "notifications" && <><NotificationsBottomBar unread={0} /><p id="notifications-unread">Okunmamış bildirim yok.</p></>}
    {section === "catalog" && <CatalogBottomTools pages={2} downloadUrl="/dev/drawing-viewer-preview/content"><p id="catalog-page-0">Birinci sayfa</p><p id="catalog-page-1">İkinci sayfa</p></CatalogBottomTools>}
    {section === "guard" && <BottomBarFixture />}
    <p className="my-6 text-sm text-muted-foreground">Gerçek menü bileşenleri · kayıt işlemi yapılmaz.</p>
  </AppShell>;
}
