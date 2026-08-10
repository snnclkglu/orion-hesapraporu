"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({
  className,
  /**
   * Kaydırma KABININ sınıfı — `className` tablonun kendisine gider.
   *
   * Kap sınıfı sabit yazılıydı ve çağrı yeri ona hiçbir şey ekleyemiyordu; bu
   * yüzden `.oc-scrollx` ipucunu isteyen ekranlar tabloyu İKİNCİ bir kaba
   * sarmak zorunda kalıyor, sarmayanlarda (satış ve işler listeleri) tablo
   * telefonda SESSİZCE kayıyordu — mobil tarayıcı kaydırma çubuğu çizmez,
   * kullanıcı sağda sütun olduğunu bilmiyordu (AGENTS md. 8).
   */
  containerClassName,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div
      data-slot="table-container"
      // `.oc-scrollx` artık VARSAYILANDIR: gölge yalnız gerçekten taşma varken
      // görünür ve sona gelince kendiliğinden söner (saf CSS, JS yok), yani
      // taşmayan tabloya bedeli yoktur. Zemin varsayılanı `--card`; kart
      // dışında duran tablo `containerClassName` ile kendi zeminini verir.
      className={cn("oc-scrollx relative w-full overflow-x-auto overscroll-x-contain", containerClassName)}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
