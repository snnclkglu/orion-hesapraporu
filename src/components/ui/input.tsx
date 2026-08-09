import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Marka: 40px kontrol yüksekliği (--control-h-md), düz yüzey (gölge yok),
        // odak = 2px solid kırmızı outline + 2px offset (soft ring değil)
        //
        // YAZI BOYUTU DOKUNMATİĞE GÖRE KISILIR, KIRILIMA GÖRE DEĞİL.
        // iOS Safari 16px'ten küçük yazılı bir alana odaklanınca sayfayı
        // KENDİLİĞİNDEN yakınlaştırır ve geri çıkmaz; kullanıcı her alandan
        // sonra elle uzaklaştırmak zorunda kalır. Eski kural `md:text-sm` idi
        // ve 768px'ten geniş her yerde 14px veriyordu — iPad portre (768px)
        // tam oraya düşüyor, yani tabletin tamamında sorun geri geliyordu.
        // Doğru soru genişlik değil aygıttır: fare varsa 14px yoğunluk,
        // parmak varsa 16px güvenlik.
        "h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive pointer-fine:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
