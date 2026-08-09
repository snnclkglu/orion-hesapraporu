"use client";

// Tarayıcıda kalıcı aç/kapa tercihi (daralt/genişlet gibi).
//
// `useState` + `useEffect` ile okumak İKİ soruna yol açıyor: sunucuda çizilen
// değer ile istemcideki tercih farklıysa arayüz bir kare yanlış genişlikte
// boyanıyor, ve efekt içinde eşzamanlı `setState` çağrısı zincirleme boyamayı
// tetikliyor (react-hooks/set-state-in-effect). `useSyncExternalStore` ikisini
// birden çözer: sunucu anlık görüntüsü varsayılandır, istemci ilk boyamada
// gerçek tercihi okur.
//
// Değişiklik aynı sekmedeki diğer kullanıcılarına da duyurulur; `storage`
// olayı yalnız DİĞER sekmelerde tetiklendiği için abonelik listesi elde
// tutulur.

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  for (const cb of listeners.get(key) ?? []) cb();
}

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false; // localStorage kapalı (gizli sekme, katı çerez ayarı)
  }
}

export function useStoredFlag(key: string): [boolean, () => void] {
  const subscribe = useCallback(
    (cb: () => void) => {
      let set = listeners.get(key);
      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }
      set.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        set.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    [key]
  );

  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false // sunucuda tercih bilinemez: geniş (varsayılan) çizilir
  );

  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(key, read(key) ? "0" : "1");
    } catch {
      /* yoksay */
    }
    notify(key);
  }, [key]);

  return [value, toggle];
}
