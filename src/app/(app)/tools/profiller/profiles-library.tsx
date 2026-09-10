"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trKatla } from "@/lib/drawings/tr-text";
import { PROFIL_KESITLERI } from "@/lib/purchasing/hammadde/profil-kesitleri";
import { NumberField, parseMetricNumber } from "../number-field";

const numberFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
const FAMILIES = [...new Set(PROFIL_KESITLERI.map((profile) => profile.aile))].sort();

function normalizedSearch(value: string): string {
  return trKatla(value)
    .replace(/\bNPI\b/g, "IPN")
    .replace(/\bNPU\b/g, "UPN");
}

export function ProfilesLibrary() {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("all");
  const [length, setLength] = useState("");
  const [quantity, setQuantity] = useState("1");
  const lengthMm = parseMetricNumber(length);
  const count = parseMetricNumber(quantity);
  const needle = normalizedSearch(query);
  const profiles = useMemo(
    () => PROFIL_KESITLERI.filter((profile) =>
      (family === "all" || profile.aile === family) &&
      (!needle || normalizedSearch(`${profile.kod} ${profile.aile}`).includes(needle))
    ),
    [family, needle]
  );

  return (
    <main className="grid gap-4">
      <header className="grid gap-1 border-b pb-3">
        <p className="oc-kicker text-muted-foreground">Profiller.xls referansı</p>
        <h2 className="text-lg font-semibold">Profil kütüphanesi</h2>
        <p className="text-sm text-muted-foreground">{PROFIL_KESITLERI.length} kesit · anma ölçüleri mm · anma ağırlıkları kg/m</p>
      </header>

      <section className="grid gap-3 border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_12rem_9rem]">
        <div className="grid gap-1.5">
          <label htmlFor="profile-search" className="text-[12px] text-muted-foreground">Kesit ara</label>
          <Input id="profile-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="" className="font-mono" />
        </div>
        <div className="grid gap-1.5">
          <label className="text-[12px] text-muted-foreground">Aile</label>
          <Select value={family} onValueChange={setFamily}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Bütün aileler</SelectItem>{FAMILIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <NumberField id="profile-length" label="Parça boyu" value={length} onChange={setLength} />
        <NumberField id="profile-count" label="Adet" unit="adet" value={quantity} onChange={setQuantity} />
      </section>

      <p className="text-[12px] text-muted-foreground">
        NPI araması IPN, NPU araması UPN ailesini bulur. Toplam ağırlık yalnız geçerli boy ve adet girildiğinde gösterilir.
      </p>

      <div className="overflow-hidden border bg-card">
        <table className="oc-tablet-table oc-compact-mobile-table w-full text-sm">
          <thead className="bg-muted/45 text-left text-[11px] tracking-wide text-muted-foreground uppercase">
            <tr><th className="px-3 py-2">Kesit</th><th className="px-3 py-2">Aile</th><th className="px-3 py-2 text-right">h</th><th className="px-3 py-2 text-right">b</th><th className="px-3 py-2 text-right">kg/m</th><th className="px-3 py-2 text-right">Toplam</th></tr>
          </thead>
          <tbody>
            {profiles.map((profile) => {
              const total = lengthMm && count && lengthMm > 0 && count > 0 ? profile.kgPerM * (lengthMm / 1000) * count : null;
              return <tr key={profile.kod} className="border-t hover:bg-muted/30"><td data-label="Kesit" className="px-3 py-2 font-mono font-medium">{profile.kod}</td><td data-label="Aile" className="px-3 py-2">{profile.aile}</td><td data-label="Yükseklik h" className="px-3 py-2 text-right font-mono">{profile.h === null ? "—" : `${numberFormat.format(profile.h)} mm`}</td><td data-label="Genişlik b" className="px-3 py-2 text-right font-mono">{profile.b === null ? "—" : `${numberFormat.format(profile.b)} mm`}</td><td data-label="Metre ağırlığı" className="px-3 py-2 text-right font-mono">{numberFormat.format(profile.kgPerM)} kg/m</td><td data-label="Toplam" className="px-3 py-2 text-right font-mono font-semibold text-primary">{total === null ? "—" : `${numberFormat.format(total)} kg`}</td></tr>;
            })}
          </tbody>
        </table>
        {profiles.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Bu aramayla eşleşen profil yok.</p>}
      </div>
    </main>
  );
}
