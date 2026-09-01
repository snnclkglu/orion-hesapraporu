"use client";

// KIRILIM SORUSU — TEK YERDE.
//
// Bazı yerleşim kararları CSS'le verilemez: bir panel `xl` altında bir
// TABAKAYA taşınıyorsa o panel `xl` altında hiç MONTE EDİLMEMELİDİR. El
// kitabının A4 önizlemesi yirmi yaprağı çizer; onu iki yere birden basıp
// birini `hidden` ile saklamak bedeli iki katına çıkarır.
//
// Sunucuda genişlik bilinemez: DAR düzen varsayılır (`false`), ilk istemci
// boyaması gerçek değeri okur — hidrasyon uyumludur. Abonelik ve anlık
// görüntü işlevleri MODÜL DÜZEYİNDEDİR: her boyamada yeni bir işlev
// üretilseydi React aboneliği baştan kurardı.
//
// Desen `revision-editor.tsx`teki `useIsDesktop`ten geldi ve oraya da buradan
// döndü; iki kopya zamanla ayrışırdı.

import { useSyncExternalStore } from "react";

/** Kabuğun kenar çubuğunun belirdiği genişlik; sabit çerçeve kipi de budur. */
export const DESKTOP_MQ = "(min-width: 1024px)";

/** Üç panelin yan yana sığdığı genişlik (MOBIL-26). */
export const WIDE_MQ = "(min-width: 1280px)";

const abonelikler = new Map<string, (onChange: () => void) => () => void>();
const anlik = new Map<string, () => boolean>();

function abone(query: string) {
  let f = abonelikler.get(query);
  if (!f) {
    f = (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    };
    abonelikler.set(query, f);
  }
  return f;
}

function anlikGoruntu(query: string) {
  let f = anlik.get(query);
  if (!f) {
    f = () => window.matchMedia(query).matches;
    anlik.set(query, f);
  }
  return f;
}

const sunucuGoruntusu = () => false;

/** Verilen medya sorgusu şu an geçerli mi (sunucuda ve ilk karede `false`). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(abone(query), anlikGoruntu(query), sunucuGoruntusu);
}

/** Ekran sabit çerçeve genişliğinde mi (≥1024 px). */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_MQ);
}

/** Üç panel yan yana sığıyor mu (≥1280 px). */
export function useIsWide(): boolean {
  return useMediaQuery(WIDE_MQ);
}
