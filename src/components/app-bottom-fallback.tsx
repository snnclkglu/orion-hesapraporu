"use client";
import { usePathname } from "next/navigation";
import { visibleSections } from "@/lib/roles";
import { SectionBottomBar } from "./section-bottom-bar";

/** Form ve yardımcı rotalarda bölümden çıkış daima erişilebilir kalır. */
export function AppBottomFallback({ role }: { role: string }) {
  const path = usePathname() ?? "/";
  const section = [...visibleSections(role)].filter(s => s.href !== "/" && (path === s.href || path.startsWith(s.href + "/"))).sort((a,b)=>b.href.length-a.href.length)[0];
  if (path === "/") return null;
  return <SectionBottomBar label={section?.label ?? "Kişisel alan"} priority={0} items={[
    {id:"section",label:section?.label ?? "Profilim",href:section?.href ?? "/profile",icon:"folder",active:path===(section?.href ?? "/profile")},
    {id:"panel",label:"Panel",href:"/",icon:"grid"},
    {id:"notifications",label:"Bildirimler",href:"/notifications",icon:"bell",active:path==="/notifications"},
    {id:"profile",label:section?"Profilim":"Geri Bildirim",href:section?"/profile":"/profile/feedback",icon:"person"},
  ]} />;
}
