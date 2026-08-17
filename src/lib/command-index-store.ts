"use client";

// KOMUT DEFTERİ DEPOSU — panonun satır içi araması ile Ctrl/⌘+K paleti AYNI
// defteri paylaşır ve defter istemciye BİR KEZ iner.
//
// Eskiden defter iki kez taşınıyordu: pano her ziyarette RSC yüküyle (yedi
// tablo, sınırsız satır), palet de açılınca `/api/command-index`ten. Depo
// modül düzeyindedir: hangi bileşen önce isterse o çeker, ikincisi hazır
// olanı okur. Durum `useSyncExternalStore` ile okunur — bu projede durum
// senkronu `useEffect`e taşınmaz (react-hooks/set-state-in-effect kapalı).

import { useSyncExternalStore } from "react";
import type { PanelHit } from "@/lib/panel";

export interface CommandIndexData {
  sections: { href: string; label: string }[];
  hits: PanelHit[];
}

export type CommandIndexState =
  | { status: "idle" | "loading" | "error"; data: null }
  | { status: "ready"; data: CommandIndexData };

let state: CommandIndexState = { status: "idle", data: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/**
 * Defteri gerekiyorsa çeker. `ready` ve `loading` durumlarında sessizce döner;
 * `error` durumunda YENİDEN DENER — kullanıcı kutuya bir daha odaklandığında
 * geçici bir ağ hatası kalıcı bir "arama bozuk"a dönüşmemelidir.
 */
export function ensureCommandIndex(): void {
  if (state.status === "loading" || state.status === "ready") return;
  state = { status: "loading", data: null };
  emit();
  void fetch("/api/command-index")
    .then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as Partial<CommandIndexData> | null;
      state = {
        status: "ready",
        data: { sections: data?.sections ?? [], hits: data?.hits ?? [] },
      };
    })
    .catch(() => {
      state = { status: "error", data: null };
    })
    .finally(emit);
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => state;
// Sunucu anlık görüntüsü SABİT bir referanstır: her çağrıda yeni nesne dönse
// React hidrasyonda sonsuz yeniden çizime düşerdi.
const SERVER_STATE: CommandIndexState = { status: "idle", data: null };
const getServerSnapshot = () => SERVER_STATE;

export function useCommandIndex(): CommandIndexState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
