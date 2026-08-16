"use client";

// Son bakılan işler — CİHAZA ÖZEL bir kolaylık, paylaşılan gerçek değil.
//
// localStorage'da yaşar (tablo açılmaz): "az önce baktığım iş" sorusu kişiye
// ve cihaza özeldir; sunucuya taşımak senkron maliyeti ekler, kazandırmazdı.
// Okuma `useSyncExternalStore` iledir (use-stored-flag kalıbı): efektle
// setState senkronizasyonu bu projede kapalıdır ve basamaklı boyama üretir.

import { useSyncExternalStore } from "react";

export interface RecentJob {
  id: string;
  jobNo: string;
  title: string;
  /** İstemci saati — sıralama içindir, gerçek bir zaman damgası değil. */
  at: number;
}

const KEY = "orion.jobs.recent";
const LIMIT = 8;
const BOS: RecentJob[] = [];

// Snapshot REFERANS KARARLI olmalı: her çağrıda yeni dizi döndürmek
// useSyncExternalStore'u sonsuz döngüye sokar. Ham dizge değişmedikçe aynı
// dizi döner.
let cache: RecentJob[] = BOS;
let cacheRaw: string | null = null;

function parse(raw: string): RecentJob[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (r): r is RecentJob =>
          !!r &&
          typeof r.id === "string" &&
          typeof r.jobNo === "string" &&
          typeof r.title === "string" &&
          typeof r.at === "number"
      )
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

function oku(): RecentJob[] {
  if (typeof window === "undefined") return BOS;
  const raw = window.localStorage.getItem(KEY) ?? "";
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = raw ? parse(raw) : BOS;
  }
  return cache;
}

const dinleyiciler = new Set<() => void>();

function bildir() {
  for (const d of dinleyiciler) d();
}

function subscribe(cb: () => void): () => void {
  dinleyiciler.add(cb);
  // Başka sekmede işaretlenen iş bu sekmede de görünsün.
  const h = () => cb();
  window.addEventListener("storage", h);
  return () => {
    dinleyiciler.delete(cb);
    window.removeEventListener("storage", h);
  };
}

/** İş detayına girildiğinde çağrılır (RecentMarker). */
export function markRecentJob(j: { id: string; jobNo: string; title: string }): void {
  if (typeof window === "undefined") return;
  const mevcut = oku().filter((r) => r.id !== j.id);
  const yeni: RecentJob[] = [{ ...j, at: Date.now() }, ...mevcut].slice(0, LIMIT);
  window.localStorage.setItem(KEY, JSON.stringify(yeni));
  bildir();
}

/** Sunucu anlık görüntüsü BOŞTUR; istemci hidrasyon sonrası gerçek listeyi basar. */
export function useRecentJobs(): RecentJob[] {
  return useSyncExternalStore(subscribe, oku, () => BOS);
}
