"use client";

import { useRouter } from "next/navigation";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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
        V{r.rev_no} — {r.label || "etiketsiz"} ({r.status === "issued" ? "yayınlandı" : "taslak"})
      </SelectItem>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-muted/30 p-3">
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">Eski (A)</Label>
        <Select value={selectedA} onValueChange={(v) => navigate(v, selectedB)}>
          <SelectTrigger className="h-8 w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{revisions.map(item)}</SelectContent>
        </Select>
      </div>
      <span className="pb-1.5 text-muted-foreground">→</span>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">Yeni (B)</Label>
        <Select value={selectedB} onValueChange={(v) => navigate(selectedA, v)}>
          <SelectTrigger className="h-8 w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{revisions.map(item)}</SelectContent>
        </Select>
      </div>
    </div>
  );
}
