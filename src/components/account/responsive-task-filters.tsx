"use client";
import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
export function ResponsiveTaskFilters({
  children,
  count,
}: {
  children: ReactNode;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="tw-filters tw-filters-desktop">{children}</div>
      <button
        className="tw-filter-trigger oc-tap"
        onClick={() => setOpen(true)}
        aria-label="Görev filtreleri"
      >
        <SlidersHorizontal size={17} /> Filtrele {count > 0 && <b>{count}</b>}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent mobileKeyboardSafe className="tw-filter-dialog">
          <DialogTitle>Görev filtreleri</DialogTitle>
          <DialogDescription>Seçimleriniz listeye uygulanır.</DialogDescription>
          <div className="tw-filters">{children}</div>
          <Button className="oc-tap" onClick={() => setOpen(false)}>
            Görevleri göster
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
