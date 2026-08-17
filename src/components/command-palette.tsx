"use client";

// KOMUT PALETİ — Ctrl/⌘+K her sayfadan açılır (kullanıcı kararı, 16.08.2026:
// kısayolun sahibi artık palettir; Panel'in satır içi arama kutusu duruyor,
// yalnız kısayol rozetini devretti).
//
// Defter PAYLAŞILAN DEPODAN gelir (`lib/command-index-store`): pano araması
// ya da palet — hangisi önce isterse defteri o çeker, ikincisi hazır olanı
// okur; defter istemciye BİR KEZ iner. Süzme istemcide `panelAra` iledir
// (trKatla — "isdemir" İSDEMİR'i bulur; panonun arama çekirdeğinin ta
// kendisi, iki arama ayrışamaz). Sayfa listesi menüyle tek kaynaktan gelir;
// "Son Bakılanlar" cihazdaki defterden okunur.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PANEL_KIND_LABELS, panelAra } from "@/lib/panel";
import {
  ensureCommandIndex,
  useCommandIndex,
} from "@/lib/command-index-store";
import { useRecentJobs } from "@/lib/jobs/recent";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const durum = useCommandIndex();
  const veri = durum.status === "ready" ? durum.data : null;
  const router = useRouter();
  const recents = useRecentJobs();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function git(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const sonuc = veri ? panelAra(veri.hits, query) : { gruplar: [], toplam: 0 };
  const sorguVar = query.trim().length >= 2;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) ensureCommandIndex();
        else setQuery("");
      }}
      title="Komut Paleti"
      description="İş, müşteri, rapor veya sayfa arayın"
    >
      {/* Süzme panelAra'da (Türkçe katlama); cmdk'nın kendi süzgeci KAPALI —
          açık kalsa slug değerli maddeleri sorguya göre kendisi elerdi. */}
      <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="İş No, Ad, Müşteri veya Sayfa Ara…"
      />
      <CommandList>
        <CommandEmpty>
          {durum.status === "error"
            ? "Defter yüklenemedi — paleti kapatıp yeniden açın."
            : veri === null
              ? "Defter yükleniyor…"
              : sorguVar
                ? "Eşleşen kayıt yok."
                : "En az iki karakter yazın."}
        </CommandEmpty>

        {/* Sorgu yokken: hızlı eylem + son bakılanlar + sayfalar. */}
        {!sorguVar && (
          <>
            <CommandGroup heading="Hızlı">
              <CommandItem value="__yeni_is" onSelect={() => git("/jobs/new")}>
                <Plus className="size-3.5" /> Yeni İş
              </CommandItem>
            </CommandGroup>
            {recents.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Son Bakılanlar">
                  {recents.slice(0, 5).map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`recent-${r.id}`}
                      onSelect={() => git(`/jobs/${r.id}`)}
                    >
                      <span className="font-mono text-xs text-primary">{r.jobNo}</span>
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {veri && veri.sections.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Sayfalar">
                  {veri.sections.map((s) => (
                    <CommandItem
                      key={s.href}
                      value={`sayfa-${s.href}`}
                      onSelect={() => git(s.href)}
                    >
                      {s.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}

        {/* Sorgu varken: panonun gruplu sonuçları. */}
        {sorguVar &&
          sonuc.gruplar.map((g) => (
            <CommandGroup key={g.kind} heading={PANEL_KIND_LABELS[g.kind]}>
              {g.hits.map((h, i) => (
                <CommandItem
                  key={`${g.kind}-${h.code}-${i}`}
                  value={`${g.kind}-${h.code}-${h.label}-${i}`}
                  onSelect={() => git(h.href)}
                >
                  {h.code && (
                    <span className="shrink-0 font-mono text-xs text-primary">
                      {h.code}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{h.label}</span>
                  {h.hint && (
                    <span className="hidden max-w-[14rem] shrink-0 truncate text-[11px] text-muted-foreground sm:inline">
                      {h.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
