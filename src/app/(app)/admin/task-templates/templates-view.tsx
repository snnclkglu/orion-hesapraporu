"use client";

// Görev şablonu düzenleyicisi: madde ekle, adlandır, sırala, pasife çek, sil.
//
// AD DÜZENLEME YERİNDEDİR (Input + odak kaybında kaydet): bir kontrol listesi
// maddesini yeniden adlandırmak için pencere açtırmak, en sık düzeltmeyi üç
// tıka çıkarırdı (termin kutusu kuralı). Kutunun değeri `defaultValue` +
// `key` iledir, efektle senkron DEĞİL.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Trash2 } from "lucide-react";
import {
  createTemplate,
  deleteTemplate,
  moveTemplate,
  renameTemplate,
  toggleTemplate,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export interface TemplateRow {
  id: string;
  title: string;
  active: boolean;
}

export function TemplatesView({ templates }: { templates: TemplateRow[] }) {
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function calistir(fn: () => Promise<{ error?: string }>, basari?: string) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (basari) toast.success(basari);
      router.refresh();
    });
  }

  function ekle() {
    const v = title.trim();
    if (!v) return;
    setTitle("");
    calistir(() => createTemplate(v));
  }

  return (
    <div className="grid max-w-3xl gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Görev Şablonu</h2>
        <p className="text-sm text-muted-foreground">
          İş detayındaki &quot;Şablondan Ekle&quot; bu listeyi tek tıkla görev
          setine çevirir. Sıra, işe eklenme sırasıdır.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ekle();
          }}
          placeholder="Yeni madde yazın…"
          className="min-w-[12rem] flex-1"
        />
        <Button type="button" onClick={ekle} disabled={pending || !title.trim()}>
          Ekle
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="ŞABLON BOŞ"
          description="Hazır madde uydurulmaz — firmanın gerçek kontrol listesini buraya siz yazarsınız (ör. sözleşme, hesap raporu, teknik resim, satın alma, imalat, sevk adımları)."
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {templates.map((t, i) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2">
              <span className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={pending || i === 0}
                  onClick={() => calistir(() => moveTemplate(t.id, -1))}
                  aria-label="Yukarı taşı"
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={pending || i === templates.length - 1}
                  onClick={() => calistir(() => moveTemplate(t.id, 1))}
                  aria-label="Aşağı taşı"
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </span>

              {/* Yerinde ad düzenleme: odak kaybında değiştiyse kaydeder. */}
              <Input
                key={`${t.id}-${t.title}`}
                defaultValue={t.title}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== t.title) {
                    calistir(() => renameTemplate(t.id, v));
                  }
                }}
                className={cn("flex-1", !t.active && "text-muted-foreground line-through")}
              />

              <button
                type="button"
                onClick={() => calistir(() => toggleTemplate(t.id, !t.active))}
                disabled={pending}
                aria-label={t.active ? "Pasife çek" : "Aktifleştir"}
                title={t.active ? "Aktif — tıklayınca pasife düşer" : "Pasif — şablona girmez"}
                className={cn(
                  "oc-tap-square grid size-5 shrink-0 place-items-center border transition-colors",
                  t.active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-transparent hover:border-primary"
                )}
              >
                <Check className="size-3.5" />
              </button>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                onClick={() => calistir(() => deleteTemplate(t.id), "Madde silindi.")}
                aria-label="Maddeyi sil"
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
