"use client";
import { SectionBottomBar } from "../section-bottom-bar";
import { openBottomTool } from "../bottom-bar-tools";
export function FeedbackBottomBar({ admin }: { admin: boolean }) {
  return <SectionBottomBar label="Geri bildirimler" priority={25} items={[
    {id:"list",label:"Gönderiler",icon:"inbox",active:true,onSelect:()=>window.scrollTo({top:0})},
    {id:"filter",label:"Filtrele",icon:"filter",onSelect:()=>openBottomTool("feedback-filters")},
    admin ? {id:"unread",label:"Okunmamış",icon:"bell",href:"/admin/feedback?unread=true"} : {id:"new",label:"Yeni",icon:"file",href:"/profile/feedback/new"},
    admin ? {id:"archive",label:"Arşiv",icon:"folder",href:"/admin/feedback?archived=true"} : {id:"profile",label:"Profilim",icon:"person",href:"/profile"},
  ]} />;
}
