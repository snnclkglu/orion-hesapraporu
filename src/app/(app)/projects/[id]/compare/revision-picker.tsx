"use client";

import { useRouter } from "next/navigation";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { revisionStatusLabel } from "@/lib/revision-status";

interface Rev {
  id: string;
  rev_no: number;
  label: string;
  status: string;
}

export function RevisionPicker({
  projectId, revisions, selectedA, selectedB,
}: {
  projectId: string;
  revisions: Rev[];
  selectedA: string;
  selectedB: string;
}) {
  const router = useRouter();

  function navigate(a: string, b: string) {
    router.replace(`/projects/${projectId}/compare?a=${a}&b=${b}`);
  }

  function item(r: Rev) {
    return (
      <SelectItem key={r.id} value={r.id}>
        V{r.rev_no} — {r.label || "etiketsiz"} ({revisionStatusLabel(r.status)})
      </SelectItem>
    );
  }

  return (
    // Sabit `w-64` iki seçici 375px'te alt alta düşüyor, aradaki "→" da kendi
    // satırında tek başına kalıyordu: mobilde seçiciler tam genişlik, ok gizli.
    // (`h-8` hiç etkili değildi — taban `data-[size=default]:h-10` daha yüksek
    // özgüllükte; kaldırıldı, görünen yükseklik değişmiyor.)
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="grid w-full min-w-0 gap-1 sm:w-auto">
        <Label className="text-xs text-muted-foreground">Eski (A)</Label>
        <Select value={selectedA} onValueChange={(v) => navigate(v, selectedB)}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{revisions.map(item)}</SelectContent>
        </Select>
      </div>
      <span className="hidden pb-1.5 text-muted-foreground sm:inline">→</span>
      <div className="grid w-full min-w-0 gap-1 sm:w-auto">
        <Label className="text-xs text-muted-foreground">Yeni (B)</Label>
        <Select value={selectedB} onValueChange={(v) => navigate(selectedA, v)}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{revisions.map(item)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}
