// Hammadde alt kabuğu — yalnız ikinci katman ray.
//
// `PageHeader` BASILMAZ: bir ekranda yalnız bir tane olur (dokunmatik md. 13)
// ve onu dıştaki `purchasing/layout.tsx` zaten basıyor. Yetki kapısı da orada;
// burada ikinci bir kontrol yalnız aynı sorunun iki kez sorulması olurdu.

import { HammaddeNav } from "./hammadde-nav";

export default function HammaddeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid gap-3">
      <HammaddeNav />
      {children}
    </div>
  );
}
