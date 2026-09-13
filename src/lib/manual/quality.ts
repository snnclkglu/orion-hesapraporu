import { allBlocks, flattenManual, numberManual, printedManual } from "./payload";
import { blockMedia, mediaHasContent } from "./rich-content";
import type { ManualPayload, ManualSection } from "./types";

export interface ManualContentIssue { blockId: string; message: string }
/** Gizli içerik korunur; teslim kapısı yalnız basılacak içeriği denetler. */
export function manualContentIssues(payload: ManualPayload, availableMedia?: ReadonlySet<string>): ManualContentIssue[] {
  const printed = printedManual(payload);
  const targets = new Set(flattenManual(numberManual(printed.sections)).map(s => s.id));
  const issues: ManualContentIssue[] = [];
  const visible = (sections: ManualSection[]): ManualSection[] => sections.filter(s=>!s.hidden).map(s=>({...s,blocks:s.blocks.filter(b=>!b.hidden),children:visible(s.children)}));
  for (const block of allBlocks(visible(payload.sections))) {
    const add = (message: string) => issues.push({ blockId: block.id, message });
    const strings = (value: unknown): string[] => typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(strings) : [];
    // JSON tablo satırları da [[ ile başlar; yalnız metin değerleri atıftır.
    const content = strings(block).join("\n");
    for (const match of content.matchAll(/\[\[([^\]]+)\]\]/g)) if (!targets.has(match[1])) add(`Atıf hedefi görünür değil: ${match[1]}`);
    for (const media of blockMedia(block)) {
      if (!mediaHasContent(media) && (block.kind === "media" || block.kind === "figure")) add("Görsel alanı boş.");
      const key = media.imageId || media.assetKey;
      if (key && availableMedia && !availableMedia.has(key)) add(`Görsel dosyası bulunamadı: ${key}`);
    }
    if (block.kind === "procedure" && (!block.steps.length || block.steps.some(s => !s.text.trim()))) add("İşlem adımlarında boş açıklama var.");
    if (block.kind === "figure" && block.markers.some(m => !m.label.trim() || !m.text.trim())) add("Numaralı şeklin açıklama listesi eksik.");
  }
  return issues;
}
