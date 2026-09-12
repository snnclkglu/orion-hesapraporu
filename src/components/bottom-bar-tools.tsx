"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SectionBottomBar, type BottomBarItem } from "./section-bottom-bar";

/** Açıkça bağlanan sayfa araçları; metin/DOM taramasıyla düğme aranmaz. */
export function openBottomTool(id: string) { window.dispatchEvent(new CustomEvent("orion-bottom-tool", { detail: id })); }
export function BottomToolPanel({ id, title, children, desktop = true }: { id: string; title: string; children: ReactNode; desktop?: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const handle = (event: Event) => { if ((event as CustomEvent<string>).detail === id) setOpen(true); }; window.addEventListener("orion-bottom-tool", handle); return () => window.removeEventListener("orion-bottom-tool", handle); }, [id]);
  return <><div className="oc-section-desktop">{desktop && !open && children}</div><Dialog open={open} onOpenChange={setOpen}><DialogContent mobileKeyboardSafe><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Seçimleriniz açık görünümde uygulanır.</DialogDescription></DialogHeader>{open && children}<Button onClick={() => setOpen(false)}>Sonuçları göster</Button></DialogContent></Dialog></>;
}

export function ListBottomTools({ label, children, more = [], moreContent, priority = 15 }: { label: string; children: ReactNode; more?: readonly BottomBarItem[]; moreContent?: ReactNode; priority?: number }) {
  const [mode, setMode] = useState<"search" | "filter" | null>(null);
  const start = useRef<HTMLDivElement>(null);
  const fields = useRef<HTMLDivElement>(null);
  return <>
    <div ref={start} className="oc-section-desktop">{!mode && children}</div>
    <SectionBottomBar label={label} priority={priority} items={[
      { id: "list", label, icon: "list", active: true, onSelect: () => { setMode(null); window.scrollTo({top:0,behavior:"instant"}); } },
      { id: "search", label: "Ara", icon: "search", action: true, onSelect: () => setMode("search") },
      { id: "filter", label: "Filtrele", icon: "filter", action: true, onSelect: () => setMode("filter") },
    ]} more={more.length ? more : [{id:"options",label:"Liste seçenekleri",icon:"settings",onSelect:()=>setMode("filter")}]} moreContent={moreContent} />
    <Dialog open={!!mode} onOpenChange={open => { if (!open) setMode(null); }}><DialogContent mobileKeyboardSafe onOpenAutoFocus={event => { if (mode === "search") { event.preventDefault(); fields.current?.querySelector<HTMLInputElement>('input:not([type=checkbox]):not([type=radio])')?.focus(); } }}>
      <DialogHeader><DialogTitle>{label} · {mode === "search" ? "Ara" : "Filtrele"}</DialogTitle><DialogDescription>Seçimleriniz listeye anında uygulanır; kapatınca korunur.</DialogDescription></DialogHeader>
      <div ref={fields} className="oc-bottom-tool-fields">{mode && children}</div><Button onClick={() => setMode(null)}>Sonuçları göster</Button>
    </DialogContent></Dialog>
  </>;
}
