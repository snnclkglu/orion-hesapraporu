"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  // `max-w-full` + yatay kaydırma: sekme etiketleri `whitespace-nowrap`tır,
  // dar ekranda şerit kap genişliğini aşıp SAYFAYI yatay kaydırıyordu.
  // Tetikleyicilerin `flex-1`i kaydırma kabında büzülmeye dönmesin diye
  // `shrink-0` verilir.
  // Dokunmatikte şerit 36px'ten 44px'e çıkar; sekme tetikleyicileri
  // `h-[calc(100%-1px)]` ile şeridin yüksekliğini izlediği için tek yerden
  // büyür. Grup seçicisinin özgüllüğünü karşılamak üzere `pointer-coarse`
  // aynı grup varyantına zincirlenir — düz `pointer-coarse:h-11` kaybederdi.
  //
  // `overflow-y-hidden` AÇIKÇA yazılır: CSS'te bir eksen `visible` dışına
  // çıkınca diğeri de `visible` kalamaz, `overflow-x-auto` tek başına
  // `overflow-y`yi de `auto` yapar. Tetikleyicinin altçizgi çubuğu
  // (`after`, şeridin dışına taşacak biçimde konumlanır) o eksende 1–2px
  // kaydırılabilir alan üretiyor, tarayıcı da şeridin içine 15px'lik DİKEY
  // KAYDIRMA ÇUBUĞU çiziyordu: sekmelerin yanında ▲▼ oku beliriyor ve şerit
  // o kadar daralıyordu.
  "group/tabs-list inline-flex w-fit max-w-full items-center justify-center overflow-x-auto overflow-y-hidden rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-9 group-data-horizontal/tabs:pointer-coarse:h-11 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none [&>*]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        // Altçizgi çubuğu ŞERİDİN İÇİNDE kalır. Kural: taşma payı en çok
        // şeridin iç boşluğu kadardır (`p-[3px]`) — daha fazlası kaydırma
        // kabında taşma sayılır ve şeride kaydırma çubuğu çizdirir
        // (`tabsListVariants` notu). Eski değerler -5px / -4px idi.
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-3px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-[3px] group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
