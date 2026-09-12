"use client";

import { useEffect } from "react";

/** Klavye açıldığında yalnız görünmeyen alanı en yakın kaydırma kabında açığa çıkarır. */
export function useMobileFormViewport(
  node: HTMLElement | null,
  dialog = false,
) {
  useEffect(() => {
    if (!node) return;
    const media = window.matchMedia(
      "(max-width: 767px), (pointer: coarse)",
    );
    const viewport = window.visualViewport;
    let frame = 0;
    let revealFrame = 0;
    const reveal = () => {
      if (!media.matches) return;
      const active = document.activeElement;
      if (
        !(active instanceof HTMLElement) ||
        !node.contains(active) ||
        !active.matches(
          "input:not([type=checkbox]):not([type=radio]), textarea, select, [contenteditable=true]",
        )
      )
        return;
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const rect = active.getBoundingClientRect();
      let scroller: HTMLElement | null = active.parentElement;
      while (scroller && scroller !== document.body) {
        if (
          /(auto|scroll)/.test(getComputedStyle(scroller).overflowY) &&
          scroller.scrollHeight > scroller.clientHeight
        )
          break;
        scroller = scroller.parentElement;
      }
      const container = scroller?.getBoundingClientRect();
      const header = dialog
        ? 12
        : parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              "--app-header-h",
            ),
          ) || 64;
      const lower = Math.min(bottom, container?.bottom ?? bottom) - 16;
      const upper = Math.max(top + header, container?.top ?? top) + 12;
      const delta =
        rect.top < upper
          ? rect.top - upper
          : rect.bottom > lower
            ? Math.min(rect.bottom - lower, rect.top - upper)
            : 0;
      if (Math.abs(delta) < 1) return;
      if (scroller && scroller !== document.body) scroller.scrollTop += delta;
      else window.scrollBy({ top: delta, behavior: "instant" });
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (dialog && media.matches) {
          // Safari ve Tailwind'in ayrı translate özelliği aynı anda sıfırlanır.
          node.style.setProperty("translate", window.matchMedia("(min-width: 768px) and (pointer: coarse)").matches ? "-50% 0" : "none", "important");
          node.style.setProperty(
            "--form-viewport-top",
            `${viewport?.offsetTop ?? 0}px`,
          );
          node.style.setProperty(
            "--form-viewport-height",
            `${viewport?.height ?? window.innerHeight}px`,
          );
          node.style.setProperty("--form-viewport-left", `${viewport?.offsetLeft ?? 0}px`);
          node.style.setProperty("--form-viewport-width", `${viewport?.width ?? window.innerWidth}px`);
        } else if (dialog) {
          node.style.removeProperty("translate");
        }
        cancelAnimationFrame(revealFrame);
        revealFrame = requestAnimationFrame(reveal);
      });
    };
    // Safari odak kaydırmasını ilk çizimden sonra tamamlayabilir. Son konumu
    // iki sınırlı kontrolde düzeltiriz; kullanıcı kaydırırsa bu kontroller iptal olur.
    let settleTimers: ReturnType<typeof setTimeout>[] = [];
    const cancelSettle = () => {
      settleTimers.forEach(clearTimeout);
      settleTimers = [];
    };
    const settle = () => {
      cancelSettle();
      update();
      settleTimers = [120, 350].map((delay) => setTimeout(reveal, delay));
    };
    update();
    node.addEventListener("touchstart", cancelSettle, { passive: true });
    node.addEventListener("wheel", cancelSettle, { passive: true });
    node.addEventListener("focusin", settle);
    viewport?.addEventListener("resize", settle);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    media.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(revealFrame);
      cancelSettle();
      node.removeEventListener("touchstart", cancelSettle);
      node.removeEventListener("wheel", cancelSettle);
      node.removeEventListener("focusin", settle);
      viewport?.removeEventListener("resize", settle);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      media.removeEventListener("change", update);
    };
  }, [node, dialog]);
}
