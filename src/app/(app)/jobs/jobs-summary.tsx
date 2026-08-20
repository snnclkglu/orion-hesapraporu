import { Briefcase, Building2, Construction, History } from "lucide-react";
import { StatCard } from "@/components/stat-card";

/** İşler sayfasının dört temel sayısı; telefonda tek satırlık mikro özet. */
export function JobsSummary({
  total,
  active,
  craneCount,
  customerCount,
  lastCreated,
  lastJobNo,
}: {
  total: number;
  active: number;
  craneCount: number;
  customerCount: number;
  lastCreated: string;
  lastJobNo: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-4 gap-1.5 sm:gap-2 lg:gap-3">
      <StatCard
        responsiveCompact
        label="Toplam İş"
        value={String(total)}
        hint={`${active} Aktif`}
        icon={Briefcase}
      />
      <StatCard
        responsiveCompact
        label="Bağlı Vinç"
        value={String(craneCount)}
        hint="iş emirlerine bağlı"
        icon={Construction}
      />
      <StatCard
        responsiveCompact
        label="Müşteri"
        value={String(customerCount)}
        hint="farklı müşteri"
        icon={Building2}
      />
      <StatCard
        responsiveCompact
        label="Son İş"
        value={lastCreated}
        hint={lastJobNo}
        icon={History}
      />
    </div>
  );
}
