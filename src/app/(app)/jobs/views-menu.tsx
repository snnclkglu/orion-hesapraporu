"use client";

// Kayıtlı görünüm çipleri + "Görünümü Kaydet".
//
// Bir kayıtlı görünüm, adresin (view + süzgeç + sıralama + grup)
// adlandırılmış FOTOĞRAFIDIR. Çipe tıklamak fotoğrafı adrese YAZAR
// (adreseYaz — sunucu turu yok); yıldızlı çip açılış varsayılanıdır ve
// /jobs parametresiz açıldığında sunucu onu uygular.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookmarkPlus, MoreHorizontal, Star, Trash2 } from "lucide-react";
import {
  configToState,
  stateToConfig,
  writeJobsViewState,
  type JobsViewState,
  type SavedViewConfig,
} from "@/lib/jobs/view-state";
import { adreseYaz } from "@/app/(app)/purchasing/adres-suzgec";
import {
  createSavedView,
  deleteSavedView,
  setDefaultSavedView,
} from "./views-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SavedViewRow {
  id: string;
  name: string;
  config: unknown;
  isDefault: boolean;
}

export function ViewsMenu({
  views,
  currentState,
}: {
  views: SavedViewRow[];
  /** Kaydedilecek O ANKİ durum (arama taslağı dâhil) — jobs-views verir. */
  currentState: JobsViewState;
}) {
  const [kaydetAcik, setKaydetAcik] = useState(false);
  const [ad, setAd] = useState("");
  const [varsayilan, setVarsayilan] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function uygula(config: unknown) {
    const state = configToState(config);
    if (!state) {
      toast.error("Bu görünüm okunamadı — yeniden kaydedin.");
      return;
    }
    // FOTOĞRAFIN TAMAMI yazılır: fotoğrafta olmayan alan (ör. ay) adresten
    // SİLİNİR — yarım uygulama iki görünümün karışımını üretirdi.
    adreseYaz({ ...writeJobsViewState(state), ay: undefined });
  }

  function kaydet() {
    const config: SavedViewConfig = stateToConfig(currentState);
    startTransition(async () => {
      const res = await createSavedView(ad, config, varsayilan);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Görünüm kaydedildi.");
      setKaydetAcik(false);
      setAd("");
      setVarsayilan(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {views.map((v) => (
        <span key={v.id} className="inline-flex items-stretch border">
          <button
            type="button"
            onClick={() => uygula(v.config)}
            className="oc-tap inline-flex items-center gap-1.5 px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            title={v.isDefault ? `${v.name} — açılış görünümü` : v.name}
          >
            {v.isDefault && (
              <Star className="size-3 shrink-0 fill-amber-400 text-amber-500" />
            )}
            <span className="max-w-[10rem] truncate">{v.name}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`${v.name} görünüm eylemleri`}
                className="oc-tap-square grid place-items-center border-l px-1 text-muted-foreground hover:text-foreground"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
              <DropdownMenuItem
                onSelect={() => {
                  startTransition(async () => {
                    const res = await setDefaultSavedView(v.id, !v.isDefault);
                    if (res?.error) {
                      toast.error(res.error);
                      return;
                    }
                    router.refresh();
                  });
                }}
              >
                <Star
                  className={cn("size-3.5", v.isDefault && "fill-amber-400 text-amber-500")}
                />
                {v.isDefault ? "Varsayılanı Kaldır" : "Açılış Görünümü Yap"}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  startTransition(async () => {
                    const res = await deleteSavedView(v.id);
                    if (res?.error) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success("Görünüm silindi.");
                    router.refresh();
                  });
                }}
              >
                <Trash2 className="size-3.5" /> Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setKaydetAcik(true)}
        disabled={pending}
      >
        <BookmarkPlus className="size-3.5" /> Görünümü Kaydet
      </Button>

      <Dialog open={kaydetAcik} onOpenChange={setKaydetAcik}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Görünümü Kaydet</DialogTitle>
            <DialogDescription>
              Şu anki görünüm, süzgeçler ve sıralama bir adla saklanır; çipe
              tıklayınca aynen geri gelir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="gorunum-ad">Görünüm Adı</Label>
              <Input
                id="gorunum-ad"
                value={ad}
                onChange={(e) => setAd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ad.trim()) kaydet();
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={varsayilan}
                onChange={(e) => setVarsayilan(e.target.checked)}
                className="size-4 accent-primary"
              />
              İşler sayfası açılışta bu görünümle gelsin
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setKaydetAcik(false)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={kaydet} disabled={pending || !ad.trim()}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
