"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ReportSettings } from "@/lib/settings";
import { updateReportSettings } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsForm({ initial }: { initial: ReportSettings }) {
  const [form, setForm] = useState<ReportSettings>(initial);
  const [pending, startTransition] = useTransition();

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
      <CardContent className="pt-6">
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
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid gap-2">
            <Label htmlFor="st-crane">Varsayılan Vinç Tipi</Label>
            <Input
              id="st-crane" value={form.default_crane_type}
              onChange={(e) => set("default_crane_type", e.target.value)} required
            />
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
              id="st-address" placeholder="Adres (ör. OSTİM OSB, Ankara)"
              value={form.address ?? ""} onChange={(e) => set("address", e.target.value)}
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                placeholder="Telefon" value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
              <Input
                placeholder="E-posta" value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
              <Input
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
