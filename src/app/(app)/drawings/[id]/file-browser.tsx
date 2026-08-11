// Dosya gezgini — GERÇEK klasör ağacına göre gruplu.
//
// MTC'nin `BARA AKIM ALMA KOLU`, `HALAT KLAVUZU`, `İSLEME RESİMLERİ` bölümleri
// olduğu gibi görünür: ressamın kurduğu düzen sistemin uydurduğu bir düzene
// çevrilmez, çünkü o düzen bir bilgi taşıyor.

"use client";

import { useMemo, useState } from "react";
import { FILE_LIFECYCLE_LABELS } from "@/lib/drawings/types";
import { formatBytes, formatNum } from "@/lib/drawings/labels";
import { opensInBrowser } from "@/lib/drawings/mime";
import type { FileRow } from "../data";
import { matchesFile } from "../filters";
import { SearchBox } from "../sortable-head";
import { FileOpenButton } from "./file-open-button";

/**
 * Dosyanın DEPO durumu — üç hâl, üçü ayrı cümle.
 *
 * `stored` tek başına yetmez: bilerek yüklenmemiş bir yedek dosyayı "depoda
 * yok" diye kırmızı göstermek yanlış alarmdır ve bu modülde yanlış alarm en
 * büyük düşmandır.
 */
function depoDurumu(d: FileRow): { eksik: boolean; rozet: string; ipucu: string } {
  if (d.stored) return { eksik: false, rozet: "", ipucu: "" };
  if (d.upload_skipped) {
    // Kopyanın yolu ASLININKİNİ gösterir: dosya yine açılır, yalnız ikinci bir
    // nesne yazılmamıştır. Yolu boş olan ise yedek/çalışma dosyasıdır.
    return d.storage_path
      ? { eksik: false, rozet: "Tek Kopya", ipucu: "Bayt bayt aynısı zaten depoda; aynı nesneden açılır." }
      : { eksik: false, rozet: "Depoya Alınmadı", ipucu: "Yedek/çalışma dosyası — deftere de girmiyor." };
  }
  return {
    eksik: true,
    rozet: "Depoda Yok",
    ipucu: d.upload_error || "Kaydı var ama baytları depoya ulaşmamış.",
  };
}

export function FileBrowser({
  dosyalar,
  ekle,
}: {
  dosyalar: FileRow[];
  /** "Dosya Ekle" düğmesi — yetkisi olmayana hiç verilmez (sunucuda karar). */
  ekle?: React.ReactNode;
}) {
  const [arama, setArama] = useState("");

  const eksikSayisi = useMemo(
    () => dosyalar.filter((d) => depoDurumu(d).eksik).length,
    [dosyalar]
  );

  const { canli, digerleri, sirali } = useMemo(() => {
    const suzulmus = dosyalar.filter((d) => matchesFile(d, arama));
    const canli = suzulmus.filter((d) => d.lifecycle === "canli");
    const digerleri = suzulmus.filter((d) => d.lifecycle !== "canli");

    const klasorler = new Map<string, FileRow[]>();
    for (const d of canli) {
      const k = d.folder || "(kök)";
      const liste = klasorler.get(k);
      if (liste) liste.push(d);
      else klasorler.set(k, [d]);
    }
    return {
      canli,
      digerleri,
      sirali: [...klasorler.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr")),
    };
  }, [dosyalar, arama]);

  // ARAMADA BÜTÜN GRUPLAR AÇILIR. 53 katlı klasörün içinde bir dosyayı arayıp
  // sonucu kapalı bir katın arkasında bırakmak, aramayı işe yaramaz yapardı.
  const aramaVar = arama.trim().length > 0;

  return (
    <section className="min-w-0 border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
        <h2 className="text-sm font-medium">Dosya Gezgini</h2>
        {ekle}
        <span className="font-mono text-[11px] text-muted-foreground">
          {formatNum(canli.length)} Canlı · {formatNum(digerleri.length)} Diğer
          {eksikSayisi > 0 && (
            <span className="ml-2 text-destructive">{formatNum(eksikSayisi)} Depoda Yok</span>
          )}
        </span>
      </header>

      <div className="border-b px-3 py-2">
        <SearchBox
          value={arama}
          onChange={setArama}
          placeholder="Dosya adı, kod, malzeme ara…"
        />
      </div>

      {aramaVar && canli.length === 0 && digerleri.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Bu aramayla eşleşen dosya yok.
        </p>
      )}

      <div className="max-h-[70vh] overflow-y-auto">
        {sirali.map(([klasor, liste]) => (
          <details key={klasor} className="border-b" open={aramaVar || sirali.length <= 4}>
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium hover:bg-muted/40 pointer-coarse:py-2.5">
              <span className="font-mono text-[12px]">{klasor}</span>
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                {liste.length}
              </span>
            </summary>
            <ul className="divide-y border-t">
              {liste.map((d) => {
                const depo = depoDurumu(d);
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-1.5">
                    <span
                      className={
                        "min-w-0 flex-1 truncate font-mono text-[11px]" +
                        (depo.eksik ? " text-muted-foreground/60 line-through" : "")
                      }
                      title={d.file_name}
                    >
                      {d.file_name}
                    </span>
                    {depo.rozet && (
                      <span
                        className={
                          "border px-1.5 font-mono text-[11px] " +
                          (depo.eksik
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : "border-border bg-muted text-muted-foreground")
                        }
                        title={depo.ipucu}
                      >
                        {depo.rozet}
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {formatBytes(d.size_bytes)}
                    </span>
                    {/* DEPODA OLMAYAN DOSYANIN DÜĞMESİ PASİFTİR. Etkin görünüp
                        tıklanınca genel bir hata vermek, kullanıcıya sorunun
                        ne olduğunu değil yalnız bir şeyin bozuk olduğunu
                        söylüyordu. */}
                    <FileOpenButton
                      storagePath={d.storage_path}
                      fileName={d.file_name}
                      label={opensInBrowser(d.file_name) ? "Aç" : "İndir"}
                      title={depo.eksik ? depo.ipucu : d.rel_path}
                      disabled={depo.eksik}
                    />
                  </li>
                );
              })}
            </ul>
          </details>
        ))}

        {digerleri.length > 0 && (
          <details className="border-b" open={aramaVar}>
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium hover:bg-muted/40 pointer-coarse:py-2.5">
              Süperse · kopya · hariç
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                {digerleri.length}
              </span>
            </summary>
            <ul className="divide-y border-t">
              {digerleri.map((d) => {
                const depo = depoDurumu(d);
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-1.5">
                    <span
                      className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground"
                      title={d.rel_path}
                    >
                      {d.file_name}
                    </span>
                    <span className="border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
                      {FILE_LIFECYCLE_LABELS[d.lifecycle]}
                    </span>
                    {depo.rozet && (
                      <span
                        className={
                          "border px-1.5 font-mono text-[11px] " +
                          (depo.eksik
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : "border-border bg-muted text-muted-foreground")
                        }
                        title={depo.ipucu}
                      >
                        {depo.rozet}
                      </span>
                    )}
                    <FileOpenButton
                      storagePath={d.storage_path}
                      fileName={d.file_name}
                      label={opensInBrowser(d.file_name) ? "Aç" : "İndir"}
                      title={depo.eksik ? depo.ipucu : d.rel_path}
                      disabled={depo.eksik}
                    />
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
