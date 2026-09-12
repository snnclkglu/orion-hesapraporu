"use client";
import { useState } from "react";
import { SectionBottomBar, useBottomBarGuard } from "@/components/section-bottom-bar";

export function BottomBarFixture() {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");
  const [fail, setFail] = useState(true);
  useBottomBarGuard(value !== saved, async () => { if (fail) return false; setSaved(value); return true; });
  return <>
    <label className="grid gap-2">Deneme metni<input className="min-h-11 border p-2 text-base" value={value} onChange={event=>setValue(event.target.value)} /></label>
    <label className="my-4 flex min-h-11 items-center gap-2"><input type="checkbox" checked={fail} onChange={event=>setFail(event.target.checked)} />Kayıt başarısız olsun</label>
    <SectionBottomBar label="Kayıt kontrolü" priority={40} items={[
      {id:"current",label:"Düzenle",icon:"file",active:true,onSelect:()=>{}},
      {id:"next",label:"Devam",icon:"folder",href:"/dev/bottom-bar-preview?section=tools"},
      {id:"stay",label:"Metne dön",icon:"list",onSelect:()=>document.querySelector<HTMLInputElement>('input:not([type])')?.focus()},
      {id:"back",label:"Profil",icon:"person",href:"/dev/account-preview"},
    ]} />
  </>;
}
