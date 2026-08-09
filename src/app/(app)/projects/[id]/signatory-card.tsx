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
      <SelectTrigger id={id} size="sm" className="w-full min-w-0 sm:w-[15rem]">
        <SelectValue placeholder="Kişi seçin" />
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
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-2.5"
      title="PDF raporun kapağında hazırlayan ve kontrol eden olarak görünür."
    >
      <span className="oc-kicker text-muted-foreground">Rapor Sorumluları</span>
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
        <Label htmlFor="prepared_by" className="shrink-0 text-xs text-muted-foreground">
          Hazırlayan
        </Label>
        {personSelect("prepared_by", preparedById, setPreparedById)}
      </div>
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
        <Label htmlFor="checked_by" className="shrink-0 text-xs text-muted-foreground">
          Kontrol
        </Label>
        {personSelect("checked_by", checkedById, setCheckedById)}
      </div>
      <Button
        size="sm"
        className="w-full sm:ml-auto sm:w-auto"
        disabled={!dirty || pending}
        onClick={save}
      >
        {pending ? "Kaydediliyor..." : "Kaydet"}
      </Button>
    </section>
  );
}
