"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { updateProjectSignatories } from "../actions";

const NONE = "__none__";

export interface SignatoryOption {
  id: string;
  full_name: string;
  role: "admin" | "engineer";
}

export function ProjectSignatoryCard({
  projectId,
  people,
  preparedBy,
  checkedBy,
}: {
  projectId: string;
  people: SignatoryOption[];
  preparedBy: string | null;
  checkedBy: string | null;
}) {
  const [preparedById, setPreparedById] = useState(preparedBy ?? NONE);
  const [checkedById, setCheckedById] = useState(checkedBy ?? NONE);
  const [pending, startTransition] = useTransition();
  const dirty = preparedById !== (preparedBy ?? NONE) || checkedById !== (checkedBy ?? NONE);

  function save() {
    startTransition(async () => {
      const result = await updateProjectSignatories(projectId, {
        prepared_by: preparedById === NONE ? null : preparedById,
        checked_by: checkedById === NONE ? null : checkedById,
      });
      if (result.error) toast.error(result.error);
      else toast.success("Rapor sorumluları güncellendi.");
    });
  }

  const personLabel = (person: SignatoryOption) =>
    `${person.full_name || "İsimsiz kullanıcı"} · ${person.role === "admin" ? "Admin" : "Mühendis"}`;

  const personSelect = (
    id: string,
    value: string,
    onChange: (v: string) => void
  ) => (
    <Select value={value} onValueChange={onChange}>
      {/* Sabit 240px: etiketle birlikte ~310px tutuyor, 360px telefonda kartın
          iç genişliği (296px) yetmiyor ve kutu kartı taşırıyordu. */}
      <SelectTrigger id={id} size="sm" className="w-full min-w-0 lg:w-[15rem]">
        <SelectValue placeholder="Kişi Seçin" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Seçilmedi</SelectItem>
        {people.map((person) => (
          <SelectItem key={person.id} value={person.id}>{personLabel(person)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // İki açılır listelik bir ayar beş satır yer kaplıyordu (başlık + açıklama +
  // iki etiketli sütun + kendi satırındaki Kaydet). Ayar TEK SATIRA indi;
  // açıklama, alanların ne işe yaradığı zaten adlarından okunduğu için başlığın
  // ipucuna (title) taşındı.
  return (
    <section
      className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 rounded-lg border bg-card px-2.5 py-2 lg:flex lg:flex-wrap lg:gap-x-4 lg:gap-y-2 lg:px-4 lg:py-2.5"
      title="PDF raporun kapağında hazırlayan ve kontrol eden olarak görünür."
    >
      <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 lg:contents">
        <span className="oc-kicker min-w-0 text-muted-foreground">Rapor Sorumluları</span>
        <Button
          size="sm"
          className="h-8 shrink-0 px-2.5 lg:order-last lg:ml-auto"
          disabled={!dirty || pending}
          onClick={save}
        >
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
      <div className="col-span-2 grid min-w-0 grid-cols-subgrid items-center lg:flex lg:w-auto lg:gap-2">
        <Label htmlFor="prepared_by" className="shrink-0 text-xs text-muted-foreground">
          Hazırlayan
        </Label>
        {personSelect("prepared_by", preparedById, setPreparedById)}
      </div>
      <div className="col-span-2 grid min-w-0 grid-cols-subgrid items-center lg:flex lg:w-auto lg:gap-2">
        <Label htmlFor="checked_by" className="shrink-0 text-xs text-muted-foreground">
          Kontrol
        </Label>
        {personSelect("checked_by", checkedById, setCheckedById)}
      </div>
    </section>
  );
}
