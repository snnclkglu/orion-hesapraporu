import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Marka kontrol yükseklikleri: md 40px, lg 48px (--control-h-*)
        //
        // DOKUNMATİK PAYI — KUTUYU BÜYÜTEREK DEĞİL, `.oc-tap` ile.
        //
        // Kural hâlâ aynı soruyu sorar: "işaretleme aygıtı kaba mı"
        // (`pointer: coarse`). Kırılım (`max-sm:`) yanlış sorudur — dar pencere
        // ≠ dokunmatik, 1280px'lik bir tablet de parmakla kullanılır.
        //
        // DEĞİŞEN: pay eskiden yüksekliği büyütüyordu (`pointer-coarse:h-10`),
        // yani 32px'lik bir düğme telefonda 40px oluyordu. Hedef doğruydu ama
        // bedeli görünürdü: atölyede telefondan bakınca ekran düğmeden
        // görünmüyordu, yan yana üç eylem satırın yarısını yiyordu. Görsel
        // yoğunluk ile dokunma güvenilirliği AYNI ŞEY DEĞİL: `.oc-tap`
        // görünmez bir `::after` ile hedefi 44px'e çıkarır, kutu olduğu yerde
        // kalır. Yani taban 40px'ten 44px'e ÇIKAR (WCAG 2.5.8 en az 24px
        // ister; 32px'lik ikon düğmeleri tabloda satır bağlantısının üstünde
        // durduğu için ıskalanan her dokunuş kullanıcıyı yanlış sayfaya
        // götürüyordu — o hata artık daha da uzak).
        //
        // `lg` genişletici ALMAZ: 48px zaten tabanın üstünde.
        default:
          "oc-tap h-10 gap-1.5 px-3 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 pointer-coarse:h-9 pointer-coarse:px-2.5",
        xs: "oc-tap h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "oc-tap h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5",
        lg: "h-12 gap-1.5 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        icon: "oc-tap-square size-10 pointer-coarse:size-9",
        "icon-xs":
          "oc-tap-square size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "oc-tap-square size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md",
        "icon-lg": "oc-tap-square size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
