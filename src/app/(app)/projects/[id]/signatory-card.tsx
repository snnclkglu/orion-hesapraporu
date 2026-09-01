"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboOption } from "@/components/combobox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { roleLabel } from "@/lib/roles";
import { updateProjectSignatories } from "../actions";

const NONE = "__none__";

export interface SignatoryOption {
  id: string;
  full_name: string;
  role: string;
}

export function ProjectSignatoryCard({
  projectId,
  people,
  preparedBy,
  checkedBy,
  checkedByName,
}: {
  projectId: string;
  people: SignatoryOption[];
  preparedBy: string | null;
  checkedBy: string | null;
  checkedByName: string | null;
}) {
  const router = useRouter();
  const [preparedById, setPreparedById] = useState(preparedBy ?? NONE);
  const initialCheckedByName =
    checkedByName?.trim() || people.find((person) => person.id === checkedBy)?.full_name || "";
  const [checkedByValue, setCheckedByValue] = useState(initialCheckedByName);
  const [pending, startTransition] = useTransition();
  const dirty =
    preparedById !== (preparedBy ?? NONE) || checkedByValue.trim() !== initialCheckedByName;

  const checkedOptions = useMemo<ComboOption[]>(() => {
    const options: ComboOption[] = people.map((person) => ({
      value: person.full_name,
      label: personLabel(person),
      keywords: [person.full_name, roleLabel(person.role)],
    }));
    const custom = checkedByValue.trim();
    if (custom && !people.some((person) => person.full_name === custom)) {
      options.unshift({ value: custom, label: custom, hint: "Elle girilen isim" });
    }
    return options;
  }, [checkedByValue, people]);

  function save() {
    startTransition(async () => {
      const checkedName = checkedByValue.trim();
      const checkedPerson = people.find((person) => person.full_name === checkedName);
      const result = await updateProjectSignatories(projectId, {
        prepared_by: preparedById === NONE ? null : preparedById,
        checked_by: checkedPerson?.id ?? null,
        checked_by_name: checkedName,
      });
      if (result.error) toast.error(result.error);
      else {
        toast.success("Rapor sorumluları güncellendi.");
        router.refresh();
      }
    });
  }

  function personLabel(person: SignatoryOption) {
    return `${person.full_name || "İsimsiz kullanıcı"} · ${roleLabel(person.role)}`;
  }

  const personSelect = (
    id: string,
    value: string,
    onChange: (v: string) => void
  ) => (
    <Select value={value} onValueChange={onChange}>
      {/* Sabit 240px: etiketle birlikte ~310px tutuyor, 360px telefonda kartın
          iç genişliği (296px) yetmiyor ve kutu kartı taşırıyordu. */}
      <SelectTrigger id={id} size="sm" className="w-full min-w-0 lg:w-[15rem]">
        <SelectValue placeholder="Kullanıcı seçin" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Seçilmedi</SelectItem>
        {people.map((person) => (
          <SelectItem key={person.id} value={person.id}>{personLabel(person)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // `lg:shrink-0` ÖLÇÜLMÜŞ BİR TAŞMANIN DÜZELTMESİDİR (01.09.2026, 1024 px).
  // Öbek `min-w-0` taşıyor ama içindeki açılır liste tetikleyicisi `shrink-0`:
  // esnek satırda öbek 345 px'lik içeriğinin altına (267 px) büzülüyor,
  // tetikleyici oradan taşıyor ve SAYFA 29 px yatay kayıyordu. Büzülmeyi
  // kapatınca flex sarma devreye giriyor ve öbek alt satıra iniyor —
  // MOBIL-16'nın "1023 ve 1024 px'te taşma yok" ölçütü sağlanır.
  //
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
      <div className="col-span-2 grid min-w-0 grid-cols-subgrid items-center lg:flex lg:w-auto lg:shrink-0 lg:gap-2">
        <Label htmlFor="prepared_by" className="shrink-0 text-xs text-muted-foreground">
          Oluşturan
        </Label>
        {personSelect("prepared_by", preparedById, setPreparedById)}
      </div>
      <div className="col-span-2 grid min-w-0 grid-cols-subgrid items-center lg:flex lg:w-auto lg:shrink-0 lg:gap-2">
        <Label htmlFor="checked_by" className="shrink-0 text-xs text-muted-foreground">
          Kontrol Eden
        </Label>
        <Combobox
          options={checkedOptions}
          value={checkedByValue || null}
          onChange={setCheckedByValue}
          onCreate={setCheckedByValue}
          placeholder="Seçilmedi"
          searchPlaceholder="Kullanıcı seçin veya isim yazın…"
          emptyText="İsim yazıp aşağıdaki seçeneği kullanın."
          createLabel="Bu adı kullan"
          className="h-8 lg:w-[15rem]"
        />
      </div>
    </section>
  );
}
