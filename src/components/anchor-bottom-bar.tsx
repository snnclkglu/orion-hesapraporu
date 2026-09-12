"use client";

import { useEffect, useState } from "react";
import { SectionBottomBar, type BottomBarItem } from "./section-bottom-bar";

export interface BottomAnchor { id: string; label: string; icon?: BottomBarItem["icon"] }
export function scrollToBottomAnchor(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "instant" });
}

/** Uzun belgeyi yeniden monte etmeden bölümüne gider; kaydırma da seçimi izler. */
export function AnchorBottomBar({ label, sections, more = [], priority = 25 }: {
  label: string; sections: readonly BottomAnchor[]; more?: readonly BottomBarItem[]; priority?: number;
}) {
  const [selected, setSelected] = useState(sections[0]?.id);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
      if (visible[0]) setSelected(visible[0].target.id);
    }, { rootMargin: "-15% 0px -55% 0px" });
    for (const section of sections) { const node = document.getElementById(section.id); if (node) observer.observe(node); }
    return () => observer.disconnect();
  }, [sections]);
  return <SectionBottomBar label={label} priority={priority} items={sections.map(section=>({ ...section, active:selected===section.id, onSelect:()=>{setSelected(section.id);scrollToBottomAnchor(section.id);} }))} more={more} />;
}
