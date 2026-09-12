"use client";
import { useSyncExternalStore, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const query = "(max-width: 767px), (pointer: coarse) and (max-height: 500px)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function TaskQuickPicker({
  open,
  onOpenChange,
  title,
  trigger,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const mobile = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  if (mobile)
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent mobileKeyboardSafe className="tw-quick-popover">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Görevin {title.toLocaleLowerCase("tr")} bilgisini düzenle.
          </DialogDescription>
          {children}
        </DialogContent>
      </Dialog>
    );
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="tw-quick-popover" align="end">
        <h3>{title}</h3>
        {children}
      </PopoverContent>
    </Popover>
  );
}
