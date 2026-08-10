"use client";

// Örtü davranışı — TEK YERDE.
//
// Uygulamada ekranı kaplayan iki tabaka var: kabuğun mobil menü çekmecesi ve
// hesap raporu editörünün bölüm listesi. İkisi de aynı dört şeyi istiyor ve
// ikisinde de ayrı ayrı yazılırsa biri eksik kalır (nitekim çekmecede odak
// tuzağı hiç yoktu: `aria-modal` yazıyordu ama Tab arkadaki sayfaya kaçıp
// görünmeyen bağlantılara odaklanıyordu — ekran okuyucu ve klavye kullanıcısı
// için tabaka hiç kapanmamış gibiydi).
//
// Radix `Dialog` bu işi zaten yapıyor ama iki çağrı yeri de tabakayı KENDİ
// yerleşim akışının parçası olarak çiziyor (çekmece kabuğun içinde, bölüm rayı
// `lg` üstünde normal bir sütun): Radix portalı onları kökten koparır ve `lg`
// üstündeki düzen bozulurdu. Davranışı ayırmak, yerleşimi yerinde bırakır.

import { useEffect, useRef } from "react";

/** Klavyeyle sırayla gezilebilen öğeler. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tabaka açıkken: gövde kaymaz · Esc kapatır · Tab tabakanın içinde döner ·
 * kapanınca odak tetikleyiciye geri döner.
 *
 * @param open    tabaka görünür mü
 * @param onClose Esc'e basılınca çağrılır
 * @param ref     tabakanın kök öğesi (odak tuzağının sınırı)
 */
export function useOverlay(
  open: boolean,
  onClose: () => void,
  ref: React.RefObject<HTMLElement | null>
) {
  /**
   * Kapanışta odağın döneceği öğe. State DEĞİL ref: değeri okumak yeniden
   * boyama gerektirmiyor ve `open` değiştiği anda okunmalı — state olsaydı bir
   * kare geç yazılır, o karede odak çoktan tabakaya geçmiş olurdu.
   */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  /**
   * `onClose` her boyamada yeni bir işlev olabilir ve asıl efektin ona
   * bağlanması dinleyicileri söküp takmakla kalmaz — açılıştaki "odağı
   * tabakaya al" adımını da her boyamada tekrarlar, yani kullanıcı listede
   * gezerken odak başa fırlar. En güncel işlev bu yüzden bir ref'te taşınır;
   * yazma RENDER SIRASINDA değil kendi efektinde olur (react-hooks/refs).
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Odak tabakaya GİRER. Girmezse tuzak boşta kalır: ilk Tab hâlâ arkadaki
    // sayfanın ilk bağlantısına gider ve ekran okuyucu tabakayı hiç duyurmaz.
    const root = ref.current;
    const first = root?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? root)?.focus?.();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const el = ref.current;
      if (!el) return;
      // Gizlenmiş öğeler (ör. `lg:hidden` bir düğme) sırada durmamalı:
      // `offsetParent` null ise öğe çizilmiyordur.
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      );
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstItem || !el.contains(active))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && (active === lastItem || !el.contains(active))) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      // Odak tabakanın İÇİNDEYSE geri ver. Kullanıcı bu arada başka bir yere
      // tıkladıysa odağı ondan çalmak daha kötü olurdu.
      const back = returnFocusRef.current;
      if (back && document.body.contains(back)) back.focus();
    };
  }, [open, ref]);
}
