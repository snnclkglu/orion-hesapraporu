"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface MobileRouteOption {
  href: string;
  label: string;
}

export function MobileRouteSelect({
  value,
  options,
  label,
  className,
}: {
  value: string;
  options: readonly MobileRouteOption[];
  label: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <div className={cn("min-w-0", className)}>
      <Select value={value} onValueChange={(href) => router.push(href)}>
        <SelectTrigger className="w-full min-w-0" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {options.map((option) => (
            <SelectItem key={option.href} value={option.href}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
