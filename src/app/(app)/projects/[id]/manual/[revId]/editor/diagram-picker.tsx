"use client";

// ŞEMA SEÇİCİ — hesap motorunun bu vinç için ürettiği diyagramları listeler.
//
// KATALOG HAFİFTİR, MODEL DEĞİL: liste yalnız anahtar ve başlık taşır; seçilen
// şemanın modeli ayrı bir istekte çözülür. Seksen şemanın modelini birden
// indirmek, açılışta bir megabayt taşımak demekti.
//
// LİSTE O VİNÇTE GERÇEKTEN ÜRETİLENLERDİR. Üretilemeyen bir şema listede hiç
// görünmez — kullanıcıya seçebileceğini sanıp boş dönen bir satır göstermek,
// hiç göstermemekten kötüdür.
//
// İKİ KAYNAK, TEK SEÇİCİ: hesap motorunun şemaları `semalar` ucundan, pano
// yerleşim şemaları `semalar/pano` ucundan gelir. İkisi ayrı uçtur çünkü pano
// çizimleri `diagrams/select.ts` defterine BİLEREK kaydedilmez (PANO-16) —
// ama sözleşmeleri aynıdır ve bu bileşen ikisini de sürer. İki ayrı seçici
// yazmak, birinde düzeltilen bir davranışın ötekinde unutulmasına açık kapı
// bırakırdı.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ManualDiagramModel } from "@/lib/manual/types";

interface SemaKaydi {
  key: string;
  baslik: string;
  modul: string;
  bolum: string;
}

export function DiagramPicker({
  acik,
  projectId,
  revisionId,
  uc = "semalar",
  baslik = "Hesaptan şema ekle",
  bosMetin = "Bu vinç için üretilebilen şema yok.",
  onKapat,
  onSec,
}: {
  acik: boolean;
  projectId: string;
  revisionId: string;
  /** Uç segmenti: `semalar` (hesap) ya da `semalar/pano` (pano yerleşimi). */
  uc?: string;
  baslik?: string;
  bosMetin?: string;
  onKapat: () => void;
  onSec: (sema: {
    diagramKey: string;
    baslik: string;
    diagram: ManualDiagramModel;
    /** Sunucunun sayfaya sığdırdığı genişlik yüzdesi; yoksa tam genişlik. */
    widthPct?: number;
  }) => void;
}) {
  const [liste, setListe] = useState<SemaKaydi[] | null>(null);
  const [not, setNot] = useState("");
  const [seciliyor, setSeciliyor] = useState("");

  useEffect(() => {
    if (!acik || liste !== null) return;
    let iptal = false;
    void (async () => {
      try {
        const r = await fetch(`/projects/${projectId}/manual/${revisionId}/${uc}`);
        const j = (await r.json()) as { semalar?: SemaKaydi[]; not?: string; error?: string };
        if (iptal) return;
        if (j.error) {
          toast.error(j.error);
          setListe([]);
          return;
        }
        setListe(j.semalar ?? []);
        setNot(j.not ?? "");
      } catch {
        if (!iptal) {
          toast.error("Şema listesi alınamadı.");
          setListe([]);
        }
      }
    })();
    return () => {
      iptal = true;
    };
  }, [acik, liste, projectId, revisionId, uc]);

  async function sec(kayit: SemaKaydi) {
    setSeciliyor(kayit.key);
    try {
      const r = await fetch(`/projects/${projectId}/manual/${revisionId}/${uc}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: kayit.key }),
      });
      const j = (await r.json()) as {
        diagramKey?: string;
        baslik?: string;
        diagram?: ManualDiagramModel;
        widthPct?: number;
        error?: string;
      };
      if (!r.ok || j.error || !j.diagram) {
        toast.error(j.error ?? "Şema alınamadı.");
        return;
      }
      onSec({
        diagramKey: j.diagramKey ?? kayit.key,
        baslik: j.baslik ?? kayit.baslik,
        diagram: j.diagram,
        ...(typeof j.widthPct === "number" ? { widthPct: j.widthPct } : {}),
      });
      onKapat();
    } finally {
      setSeciliyor("");
    }
  }

  // Modüle göre kümelenir: mühendis şemayı "hangi hesabın şeması" diye arar.
  const gruplar = new Map<string, SemaKaydi[]>();
  for (const k of liste ?? []) {
    const g = gruplar.get(k.modul) ?? [];
    g.push(k);
    gruplar.set(k.modul, g);
  }

  return (
    <Dialog open={acik} onOpenChange={(a) => !a && onKapat()}>
      <DialogContent className="max-h-[85dvh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{baslik}</DialogTitle>
          <DialogDescription>
            Şema EKLEME ANINDA çözülür ve belgeye yazılır; hesap sonradan revize
            edilirse bu kılavuz değişmez. Vektördür — teslim PDF&apos;inde keskin kalır.
          </DialogDescription>
        </DialogHeader>

        {liste === null ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Şemalar hesaplanıyor…
          </p>
        ) : liste.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            {not || bosMetin}
          </p>
        ) : (
          <Command className="max-h-[55dvh]">
            <CommandInput placeholder="Şema ara" />
            <CommandList>
              <CommandEmpty>Eşleşen şema yok.</CommandEmpty>
              {[...gruplar.entries()].map(([modul, kayitlar]) => (
                <CommandGroup key={modul} heading={modul}>
                  {kayitlar.map((k) => (
                    <CommandItem
                      key={k.key}
                      value={`${k.modul} ${k.bolum} ${k.baslik}`}
                      disabled={seciliyor !== ""}
                      onSelect={() => void sec(k)}
                    >
                      {seciliyor === k.key ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      <span className="flex flex-col">
                        <span>{k.baslik}</span>
                        <span className="text-xs text-muted-foreground">{k.bolum}</span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        )}

        <Button variant="outline" className="oc-tap" onClick={onKapat}>
          Vazgeç
        </Button>
      </DialogContent>
    </Dialog>
  );
}
