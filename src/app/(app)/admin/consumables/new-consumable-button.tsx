"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createConsumableItem, type ConsumableItemInput } from "../actions";
import { CONSUMABLE_UNIT_SUGGESTIONS } from "./consumable-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY_FORM: ConsumableItemInput = {
  name: "",
  groupName: "",
  defaultUnit: "Adet",
  active: true,
  note: "",
};

export function NewConsumableButton({ groups }: { groups: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ConsumableItemInput>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next && !pending) setForm(EMPTY_FORM);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createConsumableItem(form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(form.name + " sarf defterine eklendi.");
      setForm(EMPTY_FORM);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Yeni Sarf Malzeme
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-[min(38rem,calc(100%-2rem))]">
          <DialogHeader>
            <DialogTitle>Yeni Sarf Malzeme</DialogTitle>
            <DialogDescription>
              SM kodu otomatik ve kalıcı verilir. Aynı malzeme adı noktalama/yazım farkıyla
              yeniden girilirse tekillik anahtarı ikinci kaydı engeller.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="yeni-sarf-ad">Malzeme Adı</Label>
              <Input
                id="yeni-sarf-ad"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
                maxLength={200}
                autoFocus
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="grid gap-1.5">
                <Label htmlFor="yeni-sarf-grup">Grup</Label>
                <Input
                  id="yeni-sarf-grup"
                  list="yeni-sarf-gruplar"
                  value={form.groupName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, groupName: event.target.value }))
                  }
                  required
                  maxLength={120}
                  placeholder="Örn. Sarf Gider-Atölye"
                />
                <datalist id="yeni-sarf-gruplar">
                  {groups.map((group) => (
                    <option key={group} value={group} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="yeni-sarf-birim">Varsayılan Birim</Label>
                <Input
                  id="yeni-sarf-birim"
                  list="yeni-sarf-birimler"
                  value={form.defaultUnit}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, defaultUnit: event.target.value }))
                  }
                  required
                  maxLength={30}
                />
                <datalist id="yeni-sarf-birimler">
                  {CONSUMABLE_UNIT_SUGGESTIONS.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="yeni-sarf-not">Not</Label>
              <Textarea
                id="yeni-sarf-not"
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({ ...current, note: event.target.value }))
                }
                rows={2}
                maxLength={500}
              />
            </div>

            <label className="flex items-start gap-2 border bg-muted/30 p-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((current) => ({ ...current, active: event.target.checked }))
                }
                className="mt-0.5 size-4"
              />
              <span>
                Sarf seçicilerinde görünsün
                <span className="block text-[12px] text-muted-foreground">
                  Pasif kayıt defterde kalır fakat yeni gider girişinde önerilmez.
                </span>
              </span>
            </label>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => changeOpen(false)}>
                Vazgeç
              </Button>
              <Button
                type="submit"
                disabled={
                  pending ||
                  form.name.trim().length < 2 ||
                  !form.groupName.trim() ||
                  !form.defaultUnit.trim()
                }
              >
                {pending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
