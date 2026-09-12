"use client";
import { useSyncExternalStore } from "react";

const event = "orion-feedback-draft";
const subscribe = (notify: () => void) => {
  window.addEventListener(event, notify);
  return () => window.removeEventListener(event, notify);
};
const serverSnapshot = () => null;

/** Yalnız metin; dosya, parola ve profilin özel alanları saklanmaz. */
export function useFeedbackDraft(userId?: string) {
  const key = userId ? `orion:feedback-draft:${userId}` : null;
  const raw = useSyncExternalStore(subscribe, () => {
    try { return key ? sessionStorage.getItem(key) : null; } catch { return null; }
  }, serverSnapshot);
  const write = (value: { body: string; category: string; section: string } | null) => {
    if (!key) return;
    try {
      if (value?.body.trim()) sessionStorage.setItem(key, JSON.stringify(value));
      else sessionStorage.removeItem(key);
      window.dispatchEvent(new Event(event));
    } catch { /* Depolama kapalıysa form bellekte çalışmaya devam eder. */ }
  };
  return { raw, write };
}
