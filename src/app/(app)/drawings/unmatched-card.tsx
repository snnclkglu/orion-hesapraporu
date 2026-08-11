"use client";

// Eşleşmemiş Paketler — İş Takibi'ndeki "Kalem Eşleştirme" kartının kardeşi.
//
// Bir paket kaleme bağlanamamış olabilir çünkü kalem henüz açılmamıştır ya da
// `autoItemNos` numarayı kaydırmıştır (`0057-00` → `0057-01`). Paket bu yüzden
// DÜŞÜRÜLMEZ; burada ayrıca sayılır ve tek işlemde bağlanır.
//
// "Paket numarasını da değiştir" AYRI BİR SORUDUR ve öntanımlı olarak KAPALIDIR:
// klasörün adı ve içindeki bütün parça kodları hâlâ eski numarayı diyor. Metni
// değiştirmek onu belgeyle çelişkiye düşürür; bağlantıyı değiştirmek düşürmez.

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/combobox";
import { remapPackageItemNo } from "./actions";

interface UnmatchedPackage {
  id: string;
  folderName: string;
  itemNo: string;
}

export function UnmatchedCard({
  packages,
  items,
}: {
  packages: UnmatchedPackage[];
  items: { id: string; itemNo: string; label: string }[];
}) {
  const [secim, setSecim] = useState<Record<string, string>>({});
  const [numarayiDaYaz, setNumarayiDaYaz] = useState(false);
  const [kaydediliyor, basla] = useTransition();

  function bagla(pkg: UnmatchedPackage) {
    const jobItemId = secim[pkg.id] ?? "";
    if (!jobItemId) {
      toast.error("Önce bir iş kalemi seçin.");
      return;
    }
    basla(async () => {
      const sonuc = await remapPackageItemNo({
        packageId: pkg.id,
        jobItemId,
        rewriteItemNo: numarayiDaYaz,
      });
      if (sonuc.error) toast.error(sonuc.error);
      else toast.success("Paket iş kalemine bağlandı.");
    });
  }

  return (
    <section className="border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Link2 className="size-4 text-primary" />
          Eşleşmemiş Paketler ({packages.length})
        </h2>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            className="size-4"
            checked={numarayiDaYaz}
            onChange={(e) => setNumarayiDaYaz(e.target.checked)}
          />
          Paketin kalem numarasını da güncelle
        </label>
      </header>

      <p className="border-b px-4 py-2 text-[11px] text-muted-foreground">
        Bu paketler bir iş kalemine bağlanamadı — kalem henüz açılmamış ya da
        numara kaymış olabilir. Dosyalar ve defter yerinde duruyor; bağlamak
        yalnız listelemeyi düzeltir. <strong>Parça kodları hiçbir hâlde değişmez.</strong>
      </p>

      <ul className="divide-y">
        {packages.map((p) => (
          <li key={p.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <span className="block truncate text-sm" title={p.folderName}>
                {p.folderName}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                Paket Kalem No: {p.itemNo || "—"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Combobox
                value={secim[p.id] ?? ""}
                onChange={(v) => setSecim((s) => ({ ...s, [p.id]: v }))}
                options={items.map((i) => ({ value: i.id, label: i.label }))}
                placeholder="İş Kalemi Seç…"
                className="min-w-[min(18rem,calc(100vw-3rem))]"
              />
              <Button size="sm" onClick={() => bagla(p)} disabled={kaydediliyor}>
                Bağla
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
