"use client";

// PAFTA VE KATALOG SAYFASI SEÇİCİSİ.
//
// İKİ KAYNAK, TEK BİLEŞEN: ikisi de bir listeden bir yaprak seçtirir ve sonuç
// aynı şeydir — `manual_images` kaydı ve bir görsel bloğu. Ayrı iki bileşen
// yazmak, sayfa numarası alanının bir yerde unutulması demekti.
//
// SAYFA NUMARASI KULLANICIDAN GELİR ve öntanımı 1'dir: bir montaj paftası
// çoğunlukla tek yapraktır, katalog föyü ise iki-üç. Sunucu var olmayan
// sayfada 404 döner; burada tahmin yapılmaz.

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ManualImageRow } from "@/lib/manual/data";

export type MediaTuru = "pafta" | "katalog";

interface PaftaKaydi {
  id: string;
  ad: string;
  paket: string;
}
interface FoyKaydi {
  id: string;
  baslik: string;
  ekipman: string;
  kaynak: string;
  sayfalar: number;
}

const AYAR = {
  pafta: {
    baslik: "Teknik resimden pafta ekle",
    aciklama:
      "Seçilen yaprak sunucuda 1600 piksele rasterlenir ve belgeye görsel olarak girer. Bütün paftaları teslim paketine bağlamak için «Mekanik Projeler» ekini kullanın.",
    uc: "paftalar",
    bos: "Bu projede canlı bir teknik resim paketi yok.",
  },
  katalog: {
    baslik: "Katalog sayfası ekle",
    aciklama:
      "Liste bu vincin ekipmanına bağlı teknik föylerdir. Tam katalog EK-F'de kalır; buradaki tek yaprak gövdeye girer.",
    uc: "katalog-sayfalari",
    bos: "Bu vincin ekipmanına bağlı katalog föyü bulunamadı.",
  },
} as const;

export function MediaPicker({
  tur,
  acik,
  projectId,
  revisionId,
  onKapat,
  onSec,
}: {
  tur: MediaTuru;
  acik: boolean;
  projectId: string;
  revisionId: string;
  onKapat: () => void;
  onSec: (sonuc: { image: ManualImageRow; baslik: string }) => void;
}) {
  const ayar = AYAR[tur];
  const [liste, setListe] = useState<(PaftaKaydi | FoyKaydi)[] | null>(null);
  const [secili, setSecili] = useState("");
  const [sayfa, setSayfa] = useState("1");
  const [yukleniyor, setYukleniyor] = useState(false);

  // DURUM BİR SONRAKİ TIK'TA SIFIRLANIR: etkinin gövdesinde `setState`
  // çağırmak zincirleme render üretir (editördeki kurtarma kopyasının aynı
  // gerekçesi). Diyalog zaten bu tıkta açılıyor; tek karelik gecikme
  // görünmez.
  useEffect(() => {
    if (!acik) return;
    let iptal = false;
    const zaman = window.setTimeout(() => {
      setListe(null);
      setSecili("");
      setSayfa("1");
    }, 0);
    void (async () => {
      try {
        const r = await fetch(`/projects/${projectId}/manual/${revisionId}/${ayar.uc}`);
        const j = (await r.json()) as {
          paftalar?: PaftaKaydi[];
          foyler?: FoyKaydi[];
          error?: string;
        };
        if (iptal) return;
        if (j.error) {
          toast.error(j.error);
          setListe([]);
          return;
        }
        setListe(j.paftalar ?? j.foyler ?? []);
      } catch {
        if (!iptal) {
          toast.error("Liste alınamadı.");
          setListe([]);
        }
      }
    })();
    return () => {
      iptal = true;
      window.clearTimeout(zaman);
    };
  }, [acik, ayar.uc, projectId, revisionId]);

  async function ekle() {
    if (!secili) return;
    setYukleniyor(true);
    try {
      const r = await fetch(`/projects/${projectId}/manual/${revisionId}/${ayar.uc}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tur === "pafta"
            ? { dosyaId: secili, sayfa: Number(sayfa) || 1 }
            : { foyId: secili, sayfa: Number(sayfa) || 1 }
        ),
      });
      const j = (await r.json()) as { image?: ManualImageRow; baslik?: string; error?: string };
      if (!r.ok || j.error || !j.image) {
        toast.error(j.error ?? "Görsel eklenemedi.");
        return;
      }
      onSec({ image: j.image, baslik: j.baslik ?? "" });
      onKapat();
    } finally {
      setYukleniyor(false);
    }
  }

  const etiket = (k: PaftaKaydi | FoyKaydi) =>
    "ad" in k
      ? { ust: k.ad, alt: k.paket }
      : { ust: k.baslik, alt: `${k.ekipman} · ${k.kaynak} · ${k.sayfalar} sayfa` };

  return (
    <Dialog open={acik} onOpenChange={(a) => !a && onKapat()}>
      <DialogContent className="max-h-[85dvh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ayar.baslik}</DialogTitle>
          <DialogDescription>{ayar.aciklama}</DialogDescription>
        </DialogHeader>

        {liste === null ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Liste alınıyor…
          </p>
        ) : liste.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">{ayar.bos}</p>
        ) : (
          <>
            <Command className="max-h-[45dvh]">
              <CommandInput placeholder="Ara" />
              <CommandList>
                <CommandEmpty>Eşleşen kayıt yok.</CommandEmpty>
                <CommandGroup>
                  {liste.map((k) => {
                    const e = etiket(k);
                    return (
                      <CommandItem
                        key={k.id}
                        value={`${e.ust} ${e.alt}`}
                        onSelect={() => setSecili(k.id)}
                        className={secili === k.id ? "bg-muted" : ""}
                      >
                        <span className="flex flex-col">
                          <span>{e.ust}</span>
                          <span className="text-xs text-muted-foreground">{e.alt}</span>
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>

            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="mp-sayfa">Sayfa</Label>
                <Input
                  id="mp-sayfa"
                  inputMode="numeric"
                  className="w-24"
                  value={sayfa}
                  onChange={(e) => setSayfa(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <p className="pb-2 text-xs text-muted-foreground">
                Çok yapraklı bir belgede hangi yaprağın ekleneceği.
              </p>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" className="oc-tap" onClick={onKapat}>
            Vazgeç
          </Button>
          <Button className="oc-tap" disabled={!secili || yukleniyor} onClick={() => void ekle()}>
            {yukleniyor ? <Loader2 className="size-4 animate-spin" /> : null}
            Ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
