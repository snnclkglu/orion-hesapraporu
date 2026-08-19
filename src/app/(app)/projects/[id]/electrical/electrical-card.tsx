"use client";

// ELEKTRİK PROJESİ SEKMESİ — yükleme, künye, sayfa dizini ve malzeme listesi.
//
// SEKME HESAP RAPORU İLE TEKNİK RESİM TAKİBİ ARASINDADIR (kullanıcı kararı,
// 19.08.2026) ve sıra bir düzen tercihi değil bir AKIŞTIR: mekanik hesap
// biter, elektrik projesi gelir, resimler çizilir.
//
// ÜÇ SORU, ÜÇ GÖRÜNÜM — ve hepsi TEK kaynaktan:
//   MALZEME  — sipariş edilebilir liste (aynı ürün tek satır, adet toplanır)
//   AYGIT    — belgedeki ham satırlar (elektrikçi panoda bunu okur)
//   SAYFALAR — projenin içindekiler tablosu
//
// SÜZME İSTEMCİDE YAPILIR. Sorgu sunucuda BİR KEZ koşar; 726 satır için her
// tuş vuruşunda sunucuya gitmek hem yavaş hem gereksizdir (`offers/page.tsx`
// ile aynı karar).

import { useMemo, useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ELECTRICAL_BUCKET, suggestElectricalRevision, type ElectricalDoc } from "@/lib/electrical/data";
import { materialRows, rollupBy } from "@/lib/electrical/rollup";
import { groupSheetsByLocation } from "@/lib/electrical/sheet-index";
import type { ElectricalPart } from "@/lib/electrical/types";
import {
  deleteElectricalDoc,
  registerElectricalDoc,
  setCurrentElectricalDoc,
} from "./actions";

/** Kovanın sınırı 150 MB; istemci de aynı sayıyı bilir ki hata erken görünsün. */
const EN_BUYUK = 157_286_400;

type Gorunum = "malzeme" | "aygit" | "sayfalar";

/** Okunamayan bir sayı EKRANDA "—"DİR; `0` yazmak yalan olurdu (md. 4·5). */
const say = (n: number | null): string => (n === null ? "—" : String(n));

const boyut = (b: number): string =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

export function ElectricalCard({
  projectId,
  docs,
  current,
  parts,
  canEdit,
}: {
  projectId: string;
  docs: ElectricalDoc[];
  current: ElectricalDoc | null;
  parts: ElectricalPart[];
  canEdit: boolean;
}) {
  const girdi = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [okunuyor, setOkunuyor] = useState(false);
  const [gorunum, setGorunum] = useState<Gorunum>("malzeme");
  const [arama, setArama] = useState("");
  const [pano, setPano] = useState("");
  const [bekle, basla] = useTransition();

  const malzeme = useMemo(() => materialRows(parts), [parts]);
  const panolar = useMemo(() => rollupBy(parts, "location"), [parts]);
  const tedarikciler = useMemo(() => rollupBy(parts, "supplier"), [parts]);
  const sayfaObekleri = useMemo(
    () => groupSheetsByLocation(current?.sheets ?? []),
    [current]
  );

  const q = arama.trim().toLocaleLowerCase("tr-TR");
  const uyar = (s: string) => s.toLocaleLowerCase("tr-TR").includes(q);

  const suzulmusAygit = useMemo(
    () =>
      parts.filter(
        (p) =>
          (!pano || p.location === pano) &&
          (!q || uyar(p.deviceTag) || uyar(p.designation) || uyar(p.partNo) || uyar(p.typeNo) || uyar(p.supplier))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parts, pano, q]
  );

  const suzulmusMalzeme = useMemo(
    () =>
      malzeme.filter(
        (m) =>
          (!pano || m.locations.includes(pano)) &&
          (!q || uyar(m.designation) || uyar(m.partNo) || uyar(m.typeNo) || uyar(m.supplier))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [malzeme, pano, q]
  );

  async function yukle(file: File) {
    if (file.size > EN_BUYUK) {
      toast.error("Dosya 150 MB sınırını aşıyor.");
      return;
    }
    if (!/\.pdf$/i.test(file.name)) {
      toast.error("Elektrik projesi PDF olarak yüklenir.");
      return;
    }
    setYukleniyor(true);
    try {
      const docId = crypto.randomUUID();
      const supabase = createClient();
      // Depo yolu istemcide de sunucuda da BAĞIMSIZ kurulur (bkz. `actions.ts`).
      const { error } = await supabase.storage
        .from(ELECTRICAL_BUCKET)
        .upload(`${projectId}/${docId}.pdf`, file, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (error) {
        toast.error(`Yükleme başarısız: ${error.message}`);
        return;
      }
      const sonuc = await registerElectricalDoc(projectId, {
        docId,
        fileName: file.name,
        revision: suggestElectricalRevision(file.name),
        sizeBytes: file.size,
      });
      if (sonuc.error) {
        toast.error(sonuc.error);
        return;
      }
      toast.success("Elektrik projesi yüklendi. Malzeme listesi okunuyor…");
      await oku(docId);
    } finally {
      setYukleniyor(false);
      if (girdi.current) girdi.current.value = "";
    }
  }

  async function oku(docId: string) {
    setOkunuyor(true);
    try {
      const r = await fetch(
        `/projects/${projectId}/electrical/import?belge=${encodeURIComponent(docId)}`,
        { method: "POST" }
      );
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        partCount?: number;
        pageCount?: number;
        note?: string;
      };
      if (!r.ok || j.error) {
        toast.error(j.error ?? "Okuma başarısız.");
        return;
      }
      // NOT SESSİZ KALMAZ: malzeme listesi bulunamadıysa boş bir tablo
      // "proje malzeme taşımıyor" diye okunurdu.
      if (j.note) {
        toast.warning(`${j.pageCount} sayfa okundu ama malzeme listesi bulunamadı (${j.note}).`);
      } else {
        toast.success(`${j.pageCount} sayfa okundu — ${j.partCount} malzeme satırı.`);
      }
      window.location.reload();
    } finally {
      setOkunuyor(false);
    }
  }

  function ac(doc: ElectricalDoc) {
    basla(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from(ELECTRICAL_BUCKET)
        .createSignedUrl(doc.storagePath, 120);
      if (error || !data?.signedUrl) {
        toast.error("Belge açılamadı.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    });
  }

  const yuklemeKutusu = canEdit && (
    <>
      <Button
        size="sm"
        variant={docs.length ? "outline" : "default"}
        disabled={yukleniyor || okunuyor}
        onClick={() => girdi.current?.click()}
      >
        {yukleniyor ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {docs.length ? "Yeni Sürüm Yükle" : "Elektrik Projesi Yükle"}
      </Button>
      <input
        ref={girdi}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void yukle(f);
        }}
      />
    </>
  );

  if (!current && docs.length === 0) {
    return (
      <EmptyState
        title="ELEKTRİK PROJESİ YÜKLENMEMİŞ"
        description="Çizim bürosundan gelen PDF'i yükleyin; malzeme listesi (Parts list), sayfa dizini ve künye otomatik okunur."
        className="rounded-lg"
      >
        {yuklemeKutusu}
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4">
      {/* ————————————————————————————————————————————— künye şeridi */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">
                {current?.titleBlock.projectDescription ||
                  current?.titleBlock.projectName ||
                  current?.fileName ||
                  "Elektrik Projesi"}
              </h3>
              {current?.revision && (
                <Badge variant="outline" className="font-mono uppercase">
                  {current.revision}
                </Badge>
              )}
              {current && !current.parsedAt && (
                <Badge variant="secondary">Henüz okunmadı</Badge>
              )}
              {current?.note && (
                <Badge variant="destructive" title={current.note}>
                  <TriangleAlert className="size-3" /> Malzeme listesi bulunamadı
                </Badge>
              )}
            </div>
            {current && (
              <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4">
                <Kunye etiket="Çizim bürosu iş no" deger={current.titleBlock.jobNumber} />
                <Kunye etiket="Firma" deger={current.titleBlock.company} />
                <Kunye etiket="Saha" deger={current.titleBlock.location} />
                <Kunye etiket="Çizen" deger={current.titleBlock.drawnBy} />
                <Kunye
                  etiket="Tarih"
                  deger={
                    current.titleBlock.dateIso
                      ? new Date(current.titleBlock.dateIso).toLocaleDateString("tr-TR")
                      : ""
                  }
                />
                <Kunye etiket="Sayfa" deger={current.pageCount ? String(current.pageCount) : ""} />
                <Kunye etiket="Dosya" deger={`${current.fileName} · ${boyut(current.sizeBytes)}`} />
              </dl>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {current && (
              <Button size="sm" variant="outline" disabled={bekle} onClick={() => ac(current)}>
                <FileText className="size-3.5" /> Projeyi Aç
              </Button>
            )}
            {canEdit && current && (
              <Button
                size="sm"
                variant="outline"
                disabled={okunuyor}
                onClick={() => void oku(current.id)}
                title="PDF'i yeniden okur; malzeme satırları yeniden üretilir."
              >
                {okunuyor ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Yeniden Oku
              </Button>
            )}
            {parts.length > 0 && (
              <Button size="sm" variant="outline" asChild>
                <a href={`/projects/${projectId}/electrical/export`}>
                  <Download className="size-3.5" /> Excel
                </a>
              </Button>
            )}
            {yuklemeKutusu}
          </div>
        </div>
      </div>

      {/* ————————————————————————————————————— eski sürümler (varsa) */}
      {docs.length > 1 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">Yüklenen sürümler</div>
          <ul className="divide-y">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                {d.isCurrent ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="size-3" /> Güncel
                  </Badge>
                ) : (
                  <Badge variant="secondary">Arşiv</Badge>
                )}
                <span className="min-w-0 flex-1 break-words">{d.fileName}</span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {new Date(d.createdAt).toLocaleDateString("tr-TR")} · {d.pageCount || "—"} s.
                </span>
                <button
                  type="button"
                  onClick={() => ac(d)}
                  className="oc-tap text-primary hover:underline"
                >
                  Aç
                </button>
                {canEdit && !d.isCurrent && (
                  <button
                    type="button"
                    onClick={() =>
                      basla(async () => {
                        const r = await setCurrentElectricalDoc(projectId, d.id);
                        if (r.error) toast.error(r.error);
                        else window.location.reload();
                      })
                    }
                    className="oc-tap text-primary hover:underline"
                  >
                    Güncel yap
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    title="Sürümü sil"
                    onClick={() =>
                      basla(async () => {
                        const r = await deleteElectricalDoc(projectId, d.id);
                        if (r.error) toast.error(r.error);
                        else window.location.reload();
                      })
                    }
                    className="oc-tap text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* —————————————————————————————————————————————— özet sayılar */}
      {parts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Ozet baslik="Aygıt satırı" deger={String(parts.length)} alt={`${current?.partsPages.length ?? 0} sayfadan`} />
          <Ozet baslik="Benzersiz malzeme" deger={String(malzeme.length)} alt="sipariş edilebilir kalem" />
          <Ozet baslik="Pano" deger={String(panolar.filter((p) => p.key).length)} alt={`${tedarikciler.filter((t) => t.key).length} tedarikçi`} />
        </div>
      )}

      {/* ————————————————————————————————————————————— liste + süzgeç */}
      {(parts.length > 0 || sayfaObekleri.length > 0) && (
        <div className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["malzeme", `Malzeme (${malzeme.length})`],
                  ["aygit", `Aygıt (${parts.length})`],
                  ["sayfalar", `Sayfalar (${current?.sheets.length ?? 0})`],
                ] as const
              ).map(([k, etiket]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setGorunum(k)}
                  className={`oc-tap rounded-md px-3 py-1.5 text-sm ${
                    gorunum === k ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {etiket}
                </button>
              ))}
            </div>
            {gorunum !== "sayfalar" && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <select
                  value={pano}
                  onChange={(e) => setPano(e.target.value)}
                  className="oc-tap h-9 rounded-md border bg-background px-2 text-sm"
                  aria-label="Pano süzgeci"
                >
                  <option value="">Bütün panolar</option>
                  {panolar
                    .filter((p) => p.key)
                    .map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label} ({p.lines})
                      </option>
                    ))}
                </select>
                <Input
                  value={arama}
                  onChange={(e) => setArama(e.target.value)}
                  placeholder="Ara: kod, tanım, tedarikçi"
                  className="h-9 w-56"
                />
              </div>
            )}
          </div>

          <div className="oc-scrollx overflow-x-auto">
            {gorunum === "malzeme" && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-16 text-right">Adet</TableHead>
                    <TableHead>Tanım</TableHead>
                    <TableHead className="hidden md:table-cell">Tip No</TableHead>
                    <TableHead className="hidden lg:table-cell">Tedarikçi</TableHead>
                    <TableHead>Malzeme Kodu</TableHead>
                    <TableHead className="hidden xl:table-cell">Panolar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suzulmusMalzeme.map((m) => (
                    <TableRow key={m.key}>
                      <TableCell className="text-right font-mono tabular-nums">{say(m.qty)}</TableCell>
                      <TableCell className="break-words whitespace-normal">{m.designation || "—"}</TableCell>
                      <TableCell className="hidden font-mono text-xs md:table-cell">{m.typeNo || "—"}</TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">{m.supplier || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{m.partNo || "—"}</TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                        {m.locations.map((l) => `+${l}`).join(" ") || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {gorunum === "aygit" && (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Aygıt Etiketi</TableHead>
                    <TableHead className="w-16 text-right">Adet</TableHead>
                    <TableHead>Tanım</TableHead>
                    <TableHead className="hidden md:table-cell">Tip No</TableHead>
                    <TableHead className="hidden lg:table-cell">Tedarikçi</TableHead>
                    <TableHead className="hidden lg:table-cell w-16 text-right">Sayfa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suzulmusAygit.map((p, i) => (
                    <TableRow key={`${p.deviceTag}-${p.partNo}-${i}`}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">{p.deviceTag}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{say(p.qty)}</TableCell>
                      <TableCell className="break-words whitespace-normal">{p.designation || "—"}</TableCell>
                      <TableCell className="hidden font-mono text-xs md:table-cell">{p.typeNo || "—"}</TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">{p.supplier || "—"}</TableCell>
                      <TableCell className="hidden text-right font-mono text-xs tabular-nums lg:table-cell">
                        {p.page || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {gorunum === "sayfalar" && (
              <div className="divide-y">
                {sayfaObekleri.map((g, i) => (
                  <div key={`${g.location}-${i}`} className="p-3">
                    <div className="font-mono text-sm font-medium">
                      {g.location ? `+${g.location}` : "— (kimliksiz)"}
                    </div>
                    <ul className="mt-1 grid gap-0.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                      {g.sheets.map((s) => (
                        <li key={s.page} className="flex gap-2 text-muted-foreground">
                          <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums">
                            s.{s.page}
                          </span>
                          <span className="min-w-0 break-words">
                            {s.sheetNo ? `${s.sheetNo} · ` : ""}
                            {s.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Künye satırı — BOŞ ALAN "—" BASAR, uydurulmaz (değişmez md. 4·5). */
function Kunye({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{etiket}</dt>
      <dd className="truncate" title={deger || undefined}>
        {deger || "—"}
      </dd>
    </div>
  );
}

function Ozet({ baslik, deger, alt }: { baslik: string; deger: string; alt: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{baslik}</div>
      <div className="font-mono text-2xl tabular-nums">{deger}</div>
      <div className="text-xs text-muted-foreground">{alt}</div>
    </div>
  );
}
