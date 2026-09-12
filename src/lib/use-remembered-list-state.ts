"use client";
import { useCallback, useMemo, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { usePathname } from "next/navigation";

const memory = new Map<string, string>();
function subscribe(listener: () => void) {
  window.addEventListener("orion-list-state", listener);
  return () => window.removeEventListener("orion-list-state", listener);
}
function compatible(value: unknown, initial: unknown): boolean {
  if (Array.isArray(initial)) return Array.isArray(value);
  if (initial && typeof initial === "object") return !!value && typeof value === "object" && Object.entries(initial).every(([key, item]) => compatible((value as Record<string, unknown>)[key], item));
  return typeof value === typeof initial;
}

/** Kayıttan geri gelince aynı sekmenin filtreleri döner; sunucu verisi depolanmaz. */
export function useRememberedListState<T>(name: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const pathname = usePathname();
  const key = `orion.list.v1:${pathname}:${name}`;
  const fallback = JSON.stringify(initial);
  const read = useCallback(() => {
    if (memory.has(key)) return memory.get(key)!;
    try { return sessionStorage.getItem(key) ?? fallback; } catch { return fallback; }
  }, [key, fallback]);
  const serialized = useSyncExternalStore(subscribe, read, () => fallback);
  const decode = useCallback((text: string): T => {
    try { const value: unknown = JSON.parse(text); return compatible(value, JSON.parse(fallback)) ? value as T : JSON.parse(fallback); }
    catch { return JSON.parse(fallback); }
  }, [fallback]);
  const value = useMemo(() => decode(serialized), [decode, serialized]);
  const setValue: Dispatch<SetStateAction<T>> = useCallback(next => {
    const value = typeof next === "function" ? (next as (previous: T) => T)(decode(read())) : next;
    const serialized = JSON.stringify(value);
    memory.set(key, serialized);
    try { sessionStorage.setItem(key, serialized); } catch { /* Sekme belleği yeterlidir. */ }
    window.dispatchEvent(new Event("orion-list-state"));
  }, [key, read, decode]);
  return [value, setValue];
}
