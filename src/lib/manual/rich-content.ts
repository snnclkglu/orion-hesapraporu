import type { ManualBlock, ManualMediaRef, ManualPayload } from "./types";

const str = (v: unknown) => typeof v === "string" ? v : "";
const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};

export function readManualMedia(raw: unknown): ManualMediaRef {
  const o = obj(raw), d = obj(o.diagram);
  return {
    ...(str(o.imageId) ? { imageId: str(o.imageId) } : {}),
    ...(str(o.assetKey) && !str(o.imageId) ? { assetKey: str(o.assetKey) } : {}),
    ...(Array.isArray(d.els) && Number.isFinite(d.width) && Number.isFinite(d.height) && Number(d.width) > 0 && Number(d.height) > 0 ? {
      diagram: { width: Number(d.width), height: Number(d.height), els: d.els,
        ...(Number.isFinite(d.x0) ? { x0: Number(d.x0) } : {}), ...(Number.isFinite(d.y0) ? { y0: Number(d.y0) } : {}) },
      diagramKey: str(o.diagramKey),
    } : {}),
  };
}

export function readRichBlock(raw: unknown, base: { id: string }): ManualBlock | null {
  const o = obj(raw);
  if(o.kind === "media") return { ...base, kind: "media", title: str(o.title), text: str(o.text), ...(typeof o.caption === "string" ? {caption:o.caption} : {}), media: readManualMedia(o.media), side: o.side === "left" || o.side === "top" ? o.side : "right" };
  if(o.kind === "figure") return { ...base, kind: "figure", title: str(o.title), ...(typeof o.caption === "string" ? {caption:o.caption} : {}), media: readManualMedia(o.media), markers: (Array.isArray(o.markers) ? o.markers : []).map((m, i) => {
    const a = obj(m); const coord = (v: unknown) => Number.isFinite(v) ? Math.max(0, Math.min(1, Number(v))) : 0.5;
    return { id: str(a.id) || `${base.id}-m${i}`, x: coord(a.x), y: coord(a.y), label: str(a.label), text: str(a.text) };
  }) };
  if(o.kind === "procedure") return { ...base, kind: "procedure", title: str(o.title), steps: (Array.isArray(o.steps) ? o.steps : []).map((s, i) => {
    const a = obj(s); return { id: str(a.id) || `${base.id}-s${i}`, text: str(a.text), ...(typeof a.result === "string" ? {result:a.result} : {}), ...(a.media ? { media: readManualMedia(a.media) } : {}) };
  }) };
  return null;
}

export function blockMedia(block: ManualBlock): ManualMediaRef[] {
  if(block.kind === "image" || block.kind === "diagram") return [block];
  if(block.kind === "media" || block.kind === "figure") return [block.media];
  if(block.kind === "procedure") return block.steps.flatMap(s => s.media ? [s.media] : []);
  return [];
}

export function mediaHasContent(media: ManualMediaRef): boolean {
  return Boolean(media.imageId || media.assetKey || media.diagram?.els.length);
}

/** Yeni sözleşmede bozuk içeriği düşürmek yerine kaydetmeyi durdurur. */
export function manualWriteError(raw: unknown): string | null {
  const p = obj(raw);
  if(p.v !== undefined && p.v !== 1 && p.v !== 2) return "Bu belge sürümü desteklenmiyor. Güncel uygulamayla açın.";
  if(p.designVersion !== undefined && p.designVersion !== 1 && p.designVersion !== 2) return "Bu tasarım sürümü desteklenmiyor.";
  const allowed = new Set(["text","list","note","table","image","diagram","auto","media","procedure","figure"]);
  let error: string | null = null;
  const visit = (sections: unknown, depth = 0) => {
    if(depth > 20) { error = "Bölüm ağacı çok derin."; return; }
    for(const rawSection of Array.isArray(sections) ? sections : []) {
      const s = obj(rawSection);
      for(const b of Array.isArray(s.blocks) ? s.blocks : []) {
        const block = obj(b);
        if(!allowed.has(str(block.kind))) error = "Desteklenmeyen içerik var. Veri kaybını önlemek için kayıt durduruldu.";
        if(["media","procedure","figure"].includes(str(block.kind)) && (p.v !== 2 || p.designVersion !== 2)) error = "Görselli içerikler için şematik tasarıma geçin.";
      }
      visit(s.children, depth + 1);
    }
  };
  visit(p.sections);
  return error;
}

export function upgradeManualDesign(payload: ManualPayload): ManualPayload {
  return { ...payload, v: 2, designVersion: 2 };
}

/** Yalnız sunumu dönüştürür; metinler, kimlikler, kapsam ve kullanıcı düzenlemeleri korunur. */
export function modernizeManualContent(payload: ManualPayload): ManualPayload {
  const visit = (sections: ManualPayload["sections"]): ManualPayload["sections"] => sections.map(s => ({ ...s,
    blocks: s.blocks.map(b => {
      if (b.edited) return b;
      if (b.kind === "list" && b.ordered) {
        const { items, result, ordered: _ordered, ...base } = b;
        void _ordered;
        return { ...base, kind: "procedure" as const, title: "", steps: items.map((text, i) => ({ id: `${b.id}-step-${i}`, text, ...(i === items.length - 1 && result ? { result } : {}) })) };
      }
      if (b.kind === "image" && b.caption?.trim() && b.assetKey?.startsWith("halatHasar")) {
        const { caption, assetKey, imageId, widthPct: _width, fullWidth: _full, ...base } = b;
        void _width; void _full;
        return { ...base, kind: "media" as const, title: "", text: caption, media: { assetKey, imageId }, side: "left" as const };
      }
      return b;
    }), children: visit(s.children) }));
  return { ...upgradeManualDesign(payload), sections: visit(payload.sections) };
}
