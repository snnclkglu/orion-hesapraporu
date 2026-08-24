// EKİPMAN LİSTESİ SÜRÜM DEFTERİ.
//
// Ekipman listesi bağımsız bir snapshot DEĞİLDİR; hesap raporu revizyonunun
// girdileri ve seçimlerinden türetilir. Bu tablo o bağı gizlemek yerine her
// satırda açıkça gösterir: Ekipman Listesi Vn ↔ Hesap Raporu Vn.

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { revisionStatusLabel, revisionStatusVariant } from "@/lib/revision-status";

export interface EquipmentRevisionRow {
  id: string;
  revNo: number;
  label: string;
  status: string;
  createdAt: string;
  createdBy: string;
}

export function EquipmentRevisionsTable({
  projectId,
  revisions,
}: {
  projectId: string;
  revisions: EquipmentRevisionRow[];
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border bg-card">
      <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:px-4">
        Her ekipman listesi, aynı sürüm numarasındaki hesap raporundan otomatik oluşur.
      </div>
      <Table containerClassName="oc-mobile-table-wrap oc-tablet-table-wrap" className="oc-mobile-table oc-tablet-table oc-compact-mobile-table oc-engineering-ledger-table">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="max-sm:whitespace-normal">Ekipman Listesi</TableHead>
            <TableHead className="max-sm:whitespace-normal">Bağlı Hesap Raporu</TableHead>
            <TableHead className="hidden md:table-cell">Etiket</TableHead>
            <TableHead>Rapor Durumu</TableHead>
            <TableHead className="hidden lg:table-cell">Oluşturan</TableHead>
            <TableHead className="hidden md:table-cell">Tarih</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {revisions.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={6}
                data-mobile-span="full"
                data-mobile-hide-label
                className="h-32 text-center"
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="border bg-background px-3 py-1.5 font-mono text-xs font-medium tracking-[0.15em] text-foreground">
                    [ HENÜZ EKİPMAN LİSTESİ YOK ]
                  </span>
                  <span className="text-sm text-muted-foreground">
                    İlk hesap raporu oluşturulduğunda ekipman listesi de burada görünür.
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            revisions.map((revision) => (
              <TableRow key={revision.id}>
                <TableCell
                  data-label="Ekipman Listesi"
                  data-mobile-span="full"
                  data-mobile-primary
                  data-mobile-hide-label
                  className="font-medium whitespace-normal"
                >
                  <Link
                    href={`/projects/${projectId}/revisions/${revision.id}/equipment`}
                    className="oc-tap inline-flex items-center text-primary hover:underline"
                  >
                    Ekipman V{revision.revNo}
                  </Link>
                  <div className="mt-0.5 text-[11px] text-muted-foreground md:hidden">
                    {revision.label || "Etiketsiz"} · {revision.createdBy || "—"}
                  </div>
                </TableCell>
                <TableCell data-label="Bağlı Hesap" data-mobile-hide-label className="font-mono whitespace-normal">
                  <Link
                    href={`/projects/${projectId}/revisions/${revision.id}`}
                    className="oc-tap inline-flex items-center text-primary hover:underline"
                  >
                    Hesap V{revision.revNo}
                  </Link>
                </TableCell>
                <TableCell
                  data-label="Etiket"
                  className="hidden break-words whitespace-normal md:table-cell"
                >
                  {revision.label || "—"}
                </TableCell>
                <TableCell data-label="Rapor Durumu" data-mobile-status data-mobile-hide-label>
                  <Badge variant={revisionStatusVariant(revision.status)}>
                    {revisionStatusLabel(revision.status)}
                  </Badge>
                </TableCell>
                <TableCell data-label="Oluşturan" className="hidden text-sm lg:table-cell">
                  {revision.createdBy || "—"}
                </TableCell>
                <TableCell
                  data-label="Tarih"
                  className="hidden font-mono text-sm tabular-nums text-muted-foreground md:table-cell"
                >
                  {new Date(revision.createdAt).toLocaleDateString("tr-TR")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
