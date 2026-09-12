"use client";
import { SectionBottomBar } from "@/components/section-bottom-bar";
import { MarkAllReadButton } from "./client";
export function NotificationsBottomBar({ unread }: { unread: number }) {
  return <SectionBottomBar label="Bildirimler" priority={25} items={[
    {id:"all",label:"Tümü",icon:"list",active:true,onSelect:()=>window.scrollTo({top:0})},
    {id:"unread",label:"Okunmamış",icon:"bell",badge:unread || undefined,onSelect:()=>document.getElementById("notifications-unread")?.scrollIntoView({block:"start"})},
    {id:"panel",label:"Panel",icon:"grid",href:"/"},
  ]} more={[{id:"profile",label:"Profilim",icon:"person",href:"/profile"}]} moreContent={unread>0?<MarkAllReadButton />:undefined} />;
}
