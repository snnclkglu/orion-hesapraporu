"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Gauge, Save, Users, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomerScoreSettings, ProfileScoringSettings, UserScoreSettings } from "@/lib/profile-scoring";
import { updateProfileScoringSettings } from "../actions";

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center border bg-background focus-within:ring-2 focus-within:ring-ring">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="border-0 font-mono tabular-nums shadow-none focus-visible:ring-0"
          required
        />
        {suffix ? <span className="pr-3 text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}

function TotalBadge({ total }: { total: number }) {
  const valid = total === 100;
  return (
    <div className={valid ? "border border-success/30 bg-success/10 px-3 py-2 text-sm text-success" : "border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"}>
      <span className="font-medium">Ağırlık toplamı:</span>{" "}
      <span className="font-mono tabular-nums">{total}/100</span>
    </div>
  );
}

export function ProfileScoringForm({ initial }: { initial: ProfileScoringSettings }) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const userTotal = form.user.recencyWeight + form.user.consistencyWeight + form.user.engagementWeight;
  const customerTotal = form.customer.recencyWeight + form.customer.offerActivityWeight + form.customer.conversionWeight + form.customer.activeWorkWeight + form.customer.completenessWeight;
  const valid = userTotal === 100 && customerTotal === 100;

  function setUser<K extends keyof UserScoreSettings>(key: K, value: number) {
    setForm((current) => ({ ...current, user: { ...current.user, [key]: value } }));
  }
  function setCustomer<K extends keyof CustomerScoreSettings>(key: K, value: number) {
    setForm((current) => ({ ...current, customer: { ...current.customer, [key]: value } }));
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return toast.error("Her profil türünde ağırlık toplamı 100 olmalı.");
    startTransition(async () => {
      const result = await updateProfileScoringSettings(form);
      if (result.error) toast.error(result.error);
      else toast.success("Profil puanlama ayarları kaydedildi.");
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRound className="size-5 text-primary" /> Kullanıcı puanı</CardTitle>
            <CardDescription>Son 30 gündeki güncellik, kullanım düzeni ve aktif süre.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <TotalBadge total={userTotal} />
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField id="user-recency" label="Güncellik" value={form.user.recencyWeight} onChange={(v) => setUser("recencyWeight", v)} min={0} max={100} suffix="puan" />
              <NumberField id="user-consistency" label="Düzen" value={form.user.consistencyWeight} onChange={(v) => setUser("consistencyWeight", v)} min={0} max={100} suffix="puan" />
              <NumberField id="user-engagement" label="Aktif süre" value={form.user.engagementWeight} onChange={(v) => setUser("engagementWeight", v)} min={0} max={100} suffix="puan" />
            </div>
            <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
              <NumberField id="user-days" label="Tam düzen hedefi" value={form.user.activeDaysTarget} onChange={(v) => setUser("activeDaysTarget", v)} min={1} max={30} suffix="aktif gün / 30 gün" />
              <NumberField id="user-hours" label="Tam süre hedefi" value={form.user.activeHoursTarget} onChange={(v) => setUser("activeHoursTarget", v)} min={1} max={300} step={0.5} suffix="saat / 30 gün" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-[oklch(0.56_0.12_210)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="size-5 text-[oklch(0.56_0.12_210)]" /> Müşteri puanı</CardTitle>
            <CardDescription>İlişki güncelliği, teklifler, kazanım, aktif işler ve kayıt bütünlüğü.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <TotalBadge total={customerTotal} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField id="customer-recency" label="Güncellik" value={form.customer.recencyWeight} onChange={(v) => setCustomer("recencyWeight", v)} min={0} max={100} suffix="puan" />
              <NumberField id="customer-offer" label="Teklif etkinliği" value={form.customer.offerActivityWeight} onChange={(v) => setCustomer("offerActivityWeight", v)} min={0} max={100} suffix="puan" />
              <NumberField id="customer-conversion" label="Kazanım oranı" value={form.customer.conversionWeight} onChange={(v) => setCustomer("conversionWeight", v)} min={0} max={100} suffix="puan" />
              <NumberField id="customer-work" label="Aktif işler" value={form.customer.activeWorkWeight} onChange={(v) => setCustomer("activeWorkWeight", v)} min={0} max={100} suffix="puan" />
              <NumberField id="customer-complete" label="Kayıt bütünlüğü" value={form.customer.completenessWeight} onChange={(v) => setCustomer("completenessWeight", v)} min={0} max={100} suffix="puan" />
            </div>
            <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
              <NumberField id="customer-window" label="Güncellik penceresi" value={form.customer.recencyWindowDays} onChange={(v) => setCustomer("recencyWindowDays", v)} min={30} max={1825} suffix="gün" />
              <NumberField id="customer-offer-target" label="Teklif hedefi" value={form.customer.annualOfferTarget} onChange={(v) => setCustomer("annualOfferTarget", v)} min={1} max={100} suffix="adet / 12 ay" />
              <NumberField id="customer-job-target" label="Aktif iş hedefi" value={form.customer.activeJobTarget} onChange={(v) => setCustomer("activeJobTarget", v)} min={1} max={50} suffix="iş" />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-3 border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex max-w-3xl items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Gauge className="mt-0.5 size-4 shrink-0" /> Puan değiştiğinde geçmiş kayıtlar yeniden hesaplanmaz; profil her açılışta güncel ayar ve güncel verilerle anlık hesaplanır.
        </p>
        <Button type="submit" disabled={pending || !valid} className="gap-2"><Save className="size-4" />{pending ? "Kaydediliyor…" : "Ayarları Kaydet"}</Button>
      </div>
    </form>
  );
}
