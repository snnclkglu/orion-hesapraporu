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

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-4">
        <h2 className="text-sm font-semibold">Rapor Sorumluları</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF raporun kapağında hazırlayan ve kontrol eden olarak görünür.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="prepared_by">Hazırlayan</Label>
          <Select value={preparedById} onValueChange={setPreparedById}>
            <SelectTrigger id="prepared_by"><SelectValue placeholder="Kişi seçin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Seçilmedi</SelectItem>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id}>{personLabel(person)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="checked_by">Kontrol</Label>
          <Select value={checkedById} onValueChange={setCheckedById}>
            <SelectTrigger id="checked_by"><SelectValue placeholder="Kişi seçin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Seçilmedi</SelectItem>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id}>{personLabel(person)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="sm" disabled={!dirty || pending} onClick={save}>
          {pending ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
    </section>
  );
}
