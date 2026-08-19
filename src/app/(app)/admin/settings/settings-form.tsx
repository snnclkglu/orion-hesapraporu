"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ReportSettings } from "@/lib/settings";
import { updateReportSettings } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
// Vinç tipi listesi TEK YERDEDİR (`lib/crane-types.ts`).
import { craneTypeOptions } from "@/lib/crane-types";

export function SettingsForm({ initial }: { initial: ReportSettings }) {
  const [form, setForm] = useState<ReportSettings>(initial);
  const [pending, startTransition] = useTransition();
  // Kayıtlı değer listede olmasa bile seçenek olarak DURUR (devralınan ya da
  // elle yazılmış varsayılanlar bu yüzden sessizce değişmez).
  const craneTypes = useMemo(
    () => craneTypeOptions(initial.default_crane_type),
    [initial.default_crane_type]
  );

  function set<K extends keyof ReportSettings>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateReportSettings({
        company: form.company.trim(),
        city: form.city.trim(),
        title_tr: form.title_tr.trim(),
        title_en: form.title_en.trim(),
        default_crane_type: form.default_crane_type.trim(),
        address: (form.address ?? "").trim(),
        phone: (form.phone ?? "").trim(),
        email: (form.email ?? "").trim(),
        web: (form.web ?? "").trim(),
      });
      if (result?.error) toast.error(result.error);
      else toast.success("Rapor ayarları kaydedildi");
    });
  }

  return (
    <Card>
      {/* `pt-6` gereksizdi: `Card` zaten `py-(--card-spacing)` veriyor, ikisi
          üst üste binince kartın üstünde 48px boşluk kalıyordu. */}
      <CardContent>
        <form onSubmit={handleSubmit} className="grid max-w-xl gap-4">
          <div className="grid gap-2">
            <Label htmlFor="st-company">Firma</Label>
            <Input
              id="st-company" value={form.company}
              onChange={(e) => set("company", e.target.value)} required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="st-city">Şehir</Label>
            <Input
              id="st-city" value={form.city}
              onChange={(e) => set("city", e.target.value)} required
            />
          </div>
          {/* `sm:` öneki olmadan iki sütun 336px'lik ekranda alan başına
              ~160px bırakıyordu. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="st-title-tr">Rapor Başlığı (TR)</Label>
              <Input
                id="st-title-tr" value={form.title_tr}
                onChange={(e) => set("title_tr", e.target.value)} required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="st-title-en">Rapor Başlığı (EN)</Label>
              <Input
                id="st-title-en" value={form.title_en}
                onChange={(e) => set("title_en", e.target.value)} required
              />
            </div>
          </div>
          {/* Alan bir süre serbest METİNDİ ve `lib/crane-types.ts` listesine
              yeni bir tip eklendiğinde yönetim panelinde GÖRÜNMÜYORDU: liste
              tek kaynaktı ama bu ekran onu okumuyordu. `craneTypeOptions`
              kayıtlı/devralınan değeri listenin başına ekler, yani elle
              yazılmış eski bir varsayılan da seçili kalır. */}
          <div className="grid gap-2">
            <Label htmlFor="st-crane">Varsayılan Vinç Tipi</Label>
            <Select
              value={form.default_crane_type}
              onValueChange={(v) => set("default_crane_type", v)}
            >
              <SelectTrigger id="st-crane" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {craneTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Yeni proje dialogunda önerilen vinç tipi.
            </p>
          </div>

          <div className="grid gap-2 border-t pt-4">
            <Label htmlFor="st-address" className="text-sm font-medium">
              Rapor Altbilgisi — İletişim
            </Label>
            <p className="-mt-1 text-xs text-muted-foreground">
              PDF rapor sayfalarının altbilgisinde firma iletişim bilgileri olarak gösterilir.
            </p>
            <Input
              id="st-address" placeholder="Adres"
              value={form.address ?? ""} onChange={(e) => set("address", e.target.value)}
            />
            {/* Üç sütun 360px'lik telefonda alan başına ~85px bırakıyordu —
                "0312 000 00 00" yazan alan kendi yer tutucusunu bile
                göstermiyordu. `type` alanları doğru mobil klavyeyi açar. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input
                type="tel" inputMode="tel" autoComplete="off"
                placeholder="Telefon" value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
              {/* E-posta alanı da BİLEREK `type="email"` DEĞİL — Web alanıyla
                  aynı gerekçe. Bu alan rapor künyesine basılan serbest bir
                  iletişim metnidir; içinde iki adres ya da açıklama olabilir ve
                  tarayıcı doğrulaması o durumda kaydetmeyi engellerdi. Amaç
                  doğru klavyeyi açmaktı, yeni bir doğrulama kuralı koymak
                  değil. */}
              <Input
                inputMode="email" autoComplete="off"
                placeholder="E-posta" value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
              {/* Web alanı BİLEREK `type="url"` DEĞİL: varsayılan değer
                  şemasız ("orioncranes.com") ve tarayıcı doğrulaması şema
                  isteyip formun kaydedilmesini engellerdi. `inputMode` doğru
                  klavyeyi doğrulama getirmeden açar. Alanlar firmanın
                  bilgisidir, oturumdaki kişinin değil — `autoComplete` kapalı. */}
              <Input
                inputMode="url" autoComplete="off"
                placeholder="Web" value={form.web ?? ""}
                onChange={(e) => set("web", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
