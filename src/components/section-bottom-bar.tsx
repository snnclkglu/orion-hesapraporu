"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Bell, BookOpen, Boxes, CalendarDays, CheckCheck, CircleUser, ClipboardList, FileText, FolderOpen, Grid2X2, Inbox, List, MoreHorizontal, Search, Settings2, ShieldCheck, ShoppingCart, SlidersHorizontal, Users, Wrench, ZoomIn, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { activeRoute, highestPriority, shouldUseBottomLayout, type NavigationAppearance } from "@/lib/bottom-bar";
import "./section-bottom-bar.css";

const icons = { list: List, search: Search, filter: SlidersHorizontal, more: MoreHorizontal, tasks: CheckCheck, team: Users, grid: Grid2X2, inbox: Inbox, file: FileText, folder: FolderOpen, calendar: CalendarDays, tools: Wrench, settings: Settings2, person: CircleUser, shield: ShieldCheck, cart: ShoppingCart, boxes: Boxes, book: BookOpen, bell: Bell, back: ArrowLeft, zoom: ZoomIn, records: ClipboardList };
export type BottomBarIcon = keyof typeof icons;
export interface BottomBarItem {
  id: string;
  label: string;
  icon?: BottomBarIcon | LucideIcon;
  href?: string;
  onSelect?: () => void;
  active?: boolean;
  badge?: ReactNode;
  /** Eylem düğmesi, açık sayfa olarak işaretlenmez. */
  action?: boolean;
}
interface BarDefinition {
  label: string;
  items: readonly BottomBarItem[];
  more?: readonly BottomBarItem[];
  moreContent?: ReactNode;
  priority?: number;
}
interface Entry extends BarDefinition { id: string; path: string; priority: number }
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let snapshot: Entry[] = [];
const empty: Entry[] = [];
function emit() { snapshot = [...entries.values()]; listeners.forEach(fn => fn()); }
function subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** Sayfa yalnız kendi hedeflerini bildirir; sabit yüzey kökte bir kez çizilir. */
export function SectionBottomBar({ priority = 10, label, items, more, moreContent }: BarDefinition) {
  const id = useId();
  const path = usePathname() ?? "";
  useLayoutEffect(() => {
    entries.set(id, { label, items, more, moreContent, id, path, priority }); emit();
    return () => { entries.delete(id); emit(); };
  }, [id, path, priority, label, items, more, moreContent]);
  return null;
}

export interface BottomRouteOption { href: string; label: string; badge?: ReactNode; exact?: boolean }
/** Var olan rota defterini kullanır; masaüstü ve alt bar hedefleri ayrışmaz. */
export function RouteBottomBar({ options, primary, label, value, priority = 10, extra = [], moreContent }: {
  options: readonly BottomRouteOption[]; primary: readonly string[]; label: string; value?: string;
  priority?: number; extra?: readonly BottomBarItem[]; moreContent?: ReactNode;
}) {
  const path = usePathname() ?? "";
  const selected = value ?? activeRoute(options, path)?.href;
  const convert = (o: BottomRouteOption): BottomBarItem => ({ id: o.href, href: o.href, label: shortLabel(o.label), badge: o.badge, active: o.href === selected, icon: labelIcon(o.label) });
  const items = primary.flatMap(href => { const item = options.find(o => o.href === href); return item ? [convert(item)] : []; });
  return <SectionBottomBar label={label} priority={priority} items={items} more={[...options.filter(o => !primary.includes(o.href)).map(convert), ...extra]} moreContent={moreContent} />;
}

function shortLabel(label: string) {
  return ({ "Teslim Takvimi": "Teslim", "Günlük Giriş": "Günlük", "Müşteri Bazında Ciro": "Ciro", "Satış Takibi": "Satış", "Satış Faturaları": "Faturalar", "Teklif Hesap Raporları": "Hesaplar", "Hammadde Havuzu": "Havuz", "Plaka Yerleşimi": "Yerleşim", "Genel Bakış": "Özet", "Sarf Girişi": "Giriş", "Sarf Kayıtları": "Kayıtlar", "Sarf Analizi": "Analiz", "Kullanıcılar": "Kullanıcı", "Geri Bildirimler": "Geri Bildirim" } as Record<string, string>)[label] ?? label;
}
function labelIcon(label: string): BottomBarIcon {
  if (/Ara$|Arama/.test(label)) return "search";
  if (/Filtre/.test(label)) return "filter";
  if (/Ekip|Kullanıcı|Personel/.test(label)) return "team";
  if (/Yetki/.test(label)) return "shield";
  if (/Bildirim/.test(label)) return "bell";
  if (/Teslim|Gün|Dönem/.test(label)) return "calendar";
  if (/Sipariş/.test(label)) return "cart";
  if (/Hammadde|Ekipman|Parça/.test(label)) return "boxes";
  if (/Tanım|Katsayı/.test(label)) return "settings";
  if (/Dosya|Paket/.test(label)) return "folder";
  if (/Görev/.test(label)) return "tasks";
  if (/Analiz|Özet|Ciro/.test(label)) return "grid";
  return "file";
}

type Guard = { dirty: boolean; save?: () => Promise<boolean> };
const guards = new Map<string, Guard>();
/** Kaydet true döndürmedikçe gezinme sürmez. */
export function useBottomBarGuard(dirty: boolean, save?: () => Promise<boolean>) {
  const id = useId();
  useLayoutEffect(() => { guards.set(id, { dirty, save }); return () => { guards.delete(id); }; }, [id, dirty, save]);
}

function subscribeLayout(listener: () => void) {
  window.addEventListener("orion-navigation-layout", listener);
  return () => window.removeEventListener("orion-navigation-layout", listener);
}
export function useBottomNavigation() {
  return useSyncExternalStore(subscribeLayout, () => document.documentElement.dataset.navigation === "bottom", () => false);
}

const preferenceKey = "orion.navigation-appearance";
export function NavigationAppearanceControl() {
  const [value, setValue] = useState<NavigationAppearance>("auto");
  useEffect(() => {
    const read = () => { try { const v = localStorage.getItem(preferenceKey); setValue(v === "bottom" || v === "desktop" ? v : "auto"); } catch { setValue("auto"); } };
    read(); window.addEventListener("orion-navigation-appearance", read);
    return () => window.removeEventListener("orion-navigation-appearance", read);
  }, []);
  return <label className="grid gap-2 text-sm">Gezinme görünümü<select className="min-h-11 rounded-md border bg-background p-2 text-base" value={value} onChange={e => { const next = e.target.value as NavigationAppearance; setValue(next); try { localStorage.setItem(preferenceKey, next); } catch {} window.dispatchEvent(new Event("orion-navigation-appearance")); }}><option value="auto">Otomatik</option><option value="bottom">Alt bar</option><option value="desktop">Masaüstü</option></select></label>;
}

export function SectionBottomBarHost() {
  const path = usePathname() ?? "";
  const router = useRouter();
  const registered = useSyncExternalStore(subscribe, () => snapshot, () => empty);
  const definition = highestPriority(registered.filter(entry => entry.path === path));
  const [compact, setCompact] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [pending, setPending] = useState<BottomBarItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = matchMedia("(pointer: coarse)");
    const update = () => {
      let value: NavigationAppearance = "auto";
      try { const stored = localStorage.getItem(preferenceKey); if (stored === "bottom" || stored === "desktop") value = stored; } catch {}
      const useBottom = shouldUseBottomLayout(value, innerWidth, media.matches);
      setCompact(useBottom);
      document.documentElement.dataset.navigation = useBottom ? "bottom" : "desktop";
      window.dispatchEvent(new Event("orion-navigation-layout"));
    };
    update(); window.addEventListener("resize", update); window.addEventListener("storage", update); window.addEventListener("orion-navigation-appearance", update); media.addEventListener("change", update);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("storage", update); window.removeEventListener("orion-navigation-appearance", update); media.removeEventListener("change", update); delete document.documentElement.dataset.navigation; };
  }, []);
  useEffect(() => {
    const update = () => {
      const viewport = window.visualViewport;
      const editing = document.activeElement?.matches("input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]");
      setKeyboard(!!editing && !!viewport && viewport.scale === 1 && innerHeight - viewport.height - viewport.offsetTop > 150);
    };
    window.visualViewport?.addEventListener("resize", update); document.addEventListener("focusin", update); document.addEventListener("focusout", update);
    return () => { window.visualViewport?.removeEventListener("resize", update); document.removeEventListener("focusin", update); document.removeEventListener("focusout", update); };
  }, []);
  const visible = !!definition && compact && !keyboard;
  useLayoutEffect(() => {
    const el = barRef.current;
    const update = () => {
      document.documentElement.style.setProperty("--app-bottom-bar-h", `${visible && el ? Math.ceil(el.getBoundingClientRect().height) : 0}px`);
      document.documentElement.dataset.bottomBar = visible ? "visible" : "hidden";
    };
    update(); const observer = new ResizeObserver(update); if (el) observer.observe(el);
    return () => { observer.disconnect(); document.documentElement.style.setProperty("--app-bottom-bar-h", "0px"); };
  }, [visible, definition]);
  const perform = (item: BottomBarItem) => {
    setMoreFor(null); setPending(null); setSaveError(false);
    if (item.href) router.push(item.href); else item.onSelect?.();
  };
  const select = (item: BottomBarItem) => {
    if (item.href) { const destination = new URL(item.href, window.location.href); if (destination.pathname === window.location.pathname && destination.search === window.location.search && !destination.hash) { setMoreFor(null); return; } }
    if (item.href && [...guards.values()].some(g => g.dirty)) { setMoreFor(null); setPending(item); return; }
    perform(item);
  };
  const renderItem = (item: BottomBarItem, inMore = false) => {
    const Icon = typeof item.icon === "function" || typeof item.icon === "object" ? item.icon : icons[item.icon ?? "list"];
    const contents = <><Icon size={20} aria-hidden="true" /><span>{item.label}</span>{item.badge && <b className="oc-bottom-badge">{item.badge}</b>}</>;
    const props = { className: inMore ? "oc-bottom-more-item" : "oc-bottom-item", "aria-current": item.active && !item.action ? "page" as const : undefined };
    return item.href ? <Link key={item.id} {...props} href={item.href} prefetch={false} onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); select(item); } }}>{contents}</Link> : <button key={item.id} {...props} type="button" onClick={() => select(item)}>{contents}</button>;
  };
  const moreOpen = !!definition && moreFor === definition.id && compact;
  const hasMore = !!definition && (!!definition.more?.length || !!definition.moreContent);
  return <>
    {definition && <nav ref={barRef} hidden={!visible} className="oc-bottom-bar" aria-label={definition.label} data-bottom-owner={definition.label}>
      <div className="oc-bottom-items" style={{ gridTemplateColumns: `repeat(${definition.items.length + (hasMore ? 1 : 0)}, minmax(0,1fr))` }}>
        {definition.items.map(item => renderItem(item))}
        {hasMore && <button ref={moreButton} type="button" className="oc-bottom-item" aria-current={definition.more?.some(item => item.active) ? "page" : undefined} aria-expanded={moreOpen} aria-haspopup="dialog" onClick={() => setMoreFor(definition.id)}><MoreHorizontal size={20} aria-hidden="true" /><span>Diğer</span></button>}
      </div>
    </nav>}
    <Dialog open={moreOpen} onOpenChange={open => { if (!open) setMoreFor(null); }}>
      <DialogContent mobileKeyboardSafe className="oc-bottom-sheet" onCloseAutoFocus={event => { event.preventDefault(); if (!pending) moreButton.current?.focus({ preventScroll: true }); }}>
        <DialogHeader><DialogTitle>{definition?.label}</DialogTitle><DialogDescription>Diğer bölümler ve işlemler</DialogDescription></DialogHeader>
        <div className="grid gap-2">{definition?.more?.some(item=>!item.action) && <p className="text-xs font-medium text-muted-foreground">Bölümler</p>}{definition?.more?.filter(item=>!item.action).map(item => renderItem(item, true))}{(definition?.more?.some(item=>item.action) || definition?.moreContent) && <p className="mt-2 text-xs font-medium text-muted-foreground">İşlemler</p>}{definition?.more?.filter(item=>item.action).map(item=>renderItem(item,true))}{definition?.moreContent}</div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!pending} onOpenChange={open => { if (!open && !saving) { setPending(null); setSaveError(false); } }}>
      <DialogContent mobileKeyboardSafe><DialogHeader><DialogTitle>Kaydedilmemiş değişiklikler</DialogTitle><DialogDescription>Bu ekrandan ayrılmadan önce değişikliklerinizi kaydedebilirsiniz.</DialogDescription></DialogHeader>
        {saveError && <p role="alert">Kaydedilemedi. Değişiklikleriniz bu ekranda korunuyor.</p>}
        <div className="grid gap-2">
          {[...guards.values()].filter(g => g.dirty).every(g => g.save) && <Button disabled={saving} onClick={async () => { setSaving(true); setSaveError(false); try { for (const guard of [...guards.values()].filter(guard => guard.dirty)) if (!guard.save || !(await guard.save())) throw new Error("save"); if (pending) perform(pending); } catch { setSaveError(true); } finally { setSaving(false); } }}>{saving ? "Kaydediliyor…" : "Kaydet ve devam et"}</Button>}
          <Button variant="outline" disabled={saving} onClick={() => pending && perform(pending)}>Değişiklikleri bırak</Button>
          <Button variant="ghost" disabled={saving} onClick={() => setPending(null)}>Bu ekranda kal</Button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
