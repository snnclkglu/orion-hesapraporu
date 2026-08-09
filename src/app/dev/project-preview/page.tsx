// Sadece development: proje detayının iki etkileşimli parçasını auth olmadan
// görsel test etmek için. Production'da 404 döner.
//
// Sayfanın KENDİ markup'ı kopyalanmaz — buradaki bileşenler gerçek sayfanın
// kullandığı bileşenlerin ta kendisidir; kopya bir düzen zamanla gerçeğinden
// ayrışır ve önizleme yanlış güven verirdi. Sunucu eylemleri sahte kimlikle
// hata döner; amaç yerleşim ve metinlerin gözle doğrulanmasıdır.

import { notFound } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProjectSignatoryCard, type SignatoryOption } from "@/app/(app)/projects/[id]/signatory-card";
import { DeleteRevisionButton } from "@/app/(app)/projects/[id]/delete-revision-button";

const PEOPLE: SignatoryOption[] = [
  { id: "p1", full_name: "Alkım Kelleci", role: "engineer" },
  { id: "p2", full_name: "Sinan Çolakoğlu", role: "admin" },
];

const REVISIONS = [
  { id: "r1", rev_no: 1, label: "V1", status: "draft" as const, who: "Sinan Çolakoğlu", date: "08.08.2026" },
  { id: "r0", rev_no: 0, label: "V0", status: "issued" as const, who: "Sinan Çolakoğlu", date: "18.07.2026" },
];

export default function ProjectPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-12 items-center border-b bg-background/90 px-4">
        <div className="text-sm font-medium">Proje Detayı Önizleme (dev · sahte veri)</div>
      </header>
      {/* `content-start`: ızgara artan boşlukta satırları GERMESİN — gerçek
          sayfada kap `flex-1` taşımıyor, önizleme onu taklit etmezse bileşen
          olduğundan yüksek ölçülür. */}
      <div className="grid w-full flex-1 content-start gap-6 px-4 py-6 lg:px-8">
        <ProjectSignatoryCard
          projectId="dev"
          people={PEOPLE}
          preparedBy="p1"
          checkedBy="p2"
        />

        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              {/* Sütun önceliklendirmesi gerçek sayfadakiyle AYNI olmalı
                  (projects/[id]/page.tsx): önizleme dar ekran davranışını
                  sınamak için var, ayrışırsa yanlış güven verir. */}
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>Revizyon</TableHead>
                <TableHead>Etiket</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="hidden md:table-cell">Oluşturan</TableHead>
                <TableHead className="hidden md:table-cell">Tarih</TableHead>
                <TableHead className="hidden lg:table-cell">Motor</TableHead>
                <TableHead className="w-12 text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {REVISIONS.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-primary">V{r.rev_no}</TableCell>
                  <TableCell className="whitespace-normal">
                    {r.label}
                    <div className="mt-0.5 text-[11px] whitespace-normal text-muted-foreground md:hidden">
                      {r.date} · {r.who}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === "issued" ? "default" : "secondary"}>
                      {r.status === "issued" ? "yayınlandı" : "taslak"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{r.who}</TableCell>
                  <TableCell className="hidden font-mono text-sm tabular-nums text-muted-foreground md:table-cell">
                    {r.date}
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
                    0.4.0
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Yayınlanmış satırda düğme HİÇ görünmez. */}
                    {r.status === "draft" && (
                      <DeleteRevisionButton
                        projectId="dev"
                        revisionId={r.id}
                        revNo={r.rev_no}
                        fallbackRevNo={
                          REVISIONS.filter((o) => o.id !== r.id).reduce<number | null>(
                            (max, o) => (max === null || o.rev_no > max ? o.rev_no : max),
                            null
                          )
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
