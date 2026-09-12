"use client";
import { SectionBottomBar, type BottomBarItem } from "./section-bottom-bar";
import { useSectionTabs } from "./ui/tabs";
export function LocalTabsBottomBar({ label, options, primary, more = [], extraItems = [] }: { label: string; options: readonly { value: string; label: string }[]; primary: readonly string[]; more?: readonly BottomBarItem[]; extraItems?: readonly BottomBarItem[] }) {
  const tabs = useSectionTabs();
  if (!tabs) return null;
  const convert = (option: typeof options[number]): BottomBarItem => ({ id: option.value, label: option.label, active: tabs.value === option.value, onSelect: () => tabs.select(option.value), icon: "file" });
  return <SectionBottomBar label={label} priority={30} items={[...primary.flatMap(value => { const option = options.find(o => o.value === value); return option ? [convert(option)] : []; }), ...extraItems]} more={[...options.filter(o => !primary.includes(o.value)).map(convert), ...more]} />;
}
