import { ExternalLink } from "lucide-react";
import type { TechnicalSource } from "@/lib/engineering-tools/standards";

export function SourceNote({ source }: { source: TechnicalSource }) {
  const content = <><strong className="font-medium text-foreground">{source.title}</strong><span> · {source.edition}</span>{source.note && <span className="block mt-1">{source.note}</span>}</>;
  return <div className="border-l-2 border-primary/40 pl-3 text-[11px] leading-5 text-muted-foreground">{source.url ? <a className="inline-flex items-start gap-1 hover:text-foreground" href={source.url} target="_blank" rel="noreferrer">{content}<ExternalLink className="mt-1 size-3 shrink-0" aria-hidden /></a> : content}</div>;
}
