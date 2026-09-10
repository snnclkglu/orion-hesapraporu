import { PageHeader } from "@/components/page-header";
import { ToolsNav } from "./tools-nav";

export default function ToolsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-w-0 max-w-full gap-3 overflow-x-clip pb-6">
      <PageHeader
        title="Teknik Araçlar"
        hint="Metrik hesaplar, kesit tabloları ve atölye başvuru bilgileri"
      />
      <p className="w-fit border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
        Herkese açık · yalnız metrik
      </p>
      <ToolsNav />
      {children}
    </div>
  );
}
