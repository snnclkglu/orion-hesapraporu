"use client";
import { useBottomBarGuard } from "../section-bottom-bar";
import { useEffect } from "react";

/** Aynı sekmedeki bağlantılarda ve sayfa kapatılırken kayıp uyarısı. */
export function useUnsavedForm(dirty: boolean) {
  useBottomBarGuard(dirty);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    const navigate = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      if (link.closest(".oc-bottom-bar,.oc-bottom-sheet")) return;
      const destination = new URL(link.href);
      if (destination.pathname === location.pathname && destination.search === location.search) return;
      if (!window.confirm("Kaydedilmemiş değişiklikler var. Bu sayfadan ayrılmak istiyor musunuz?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
}
