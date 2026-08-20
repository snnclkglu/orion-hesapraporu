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
import { EmptyState } from "@/components/empty-state";
import { trKatla } from "@/lib/drawings/tr-text";
// Süzgeç şeridi, arama kutusu ve sıralanabilir başlık EVİN ORTAK kabuğudur.
// `jobs` ve `purchasing` da onları buradan alıyor; ikinci bir kopya yazmak
// sıralama okunu ve "temizle" düğmesini bölümden bölüme farklı davrandırırdı.
import { FilterBar, SearchBox } from "@/app/(app)/drawings/sortable-head";
import { ELECTRICAL_BUCKET, suggestElectricalRevision, type ElectricalDoc } from "@/lib/electrical/data";
import { ELECTRICAL_CATEGORIES } from "@/lib/electrical/category";
import { materialRows, rollupBy } from "@/lib/electrical/rollup";
import { groupSheetsByLocation } from "@/lib/electrical/sheet-index";
import {
  BOS_SUZGEC,
  filterMaterials,
  filterParts,
  filterToQuery,
  sortMaterials,
  sortParts,
  suzgecTemizMi,
  type ElectricalFilter,
  type MaterialSortKey,
  type PartSortKey,
} from "@/lib/electrical/filter";
import type { ElectricalPart, ElectricalSheet } from "@/lib/electrical/types";
import type { ElectricalCatalogReference } from "@/lib/electrical/catalogs";
import { BosSonuc, MaterialTable, PartTable } from "./electrical-table";
import {
  deleteElectricalDoc,
  registerElectricalDoc,
  setCurrentElectricalDoc,
} from "./actions";

/** Kovanın sınırı 150 MB; istemci de aynı sayıyı bilir ki hata erken görünsün. */
const EN_BUYUK = 157_286_400;

type Gorunum = "malzeme" | "aygit" | "sayfalar";

const boyut = (b: number): string =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

export function ElectricalCard({
  projectId,
  docs,
  current,
  parts,
  catalogReferences,
  canEdit,
}: {
  projectId: string;
  docs: ElectricalDoc[];
  current: ElectricalDoc | null;
  parts: ElectricalPart[];
  catalogReferences: ElectricalCatalogReference[];
  canEdit: boolean;
}) {
  const girdi = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [okunuyor, setOkunuyor] = useState(false);
  const [gorunum, setGorunum] = useState<Gorunum>("malzeme");
  const [suzgec, setSuzgec] = useState<ElectricalFilter>(BOS_SUZGEC);
  // İKİ AYRI SIRALAMA DURUMU: malzeme ve aygıt listeleri farklı sütunlar
  // taşıyor ve tek bir durum, görünüm değişince tanınmayan bir anahtara
  // düşerdi. Öntanım `sort` — BELGEDEKİ sıra (bkz. `filter.ts`).
  const [malzemeSira, setMalzemeSira] = useState<{ key: MaterialSortKey; desc: boolean }>({
    key: "sort",
    desc: false,
  });
  const [aygitSira, setAygitSira] = useState<{ key: PartSortKey; desc: boolean }>({
    key: "sort",
    desc: false,
  });
  const [bekle, basla] = useTransition();

  const malzeme = useMemo(() => materialRows(parts), [parts]);
  const panolar = useMemo(() => rollupBy(parts, "location"), [parts]);
  const tedarikciler = useMemo(() => rollupBy(parts, "supplier"), [parts]);
  const kategoriler = useMemo(() => {
    const adetler = new Map<string, number>();
    for (const satir of malzeme) {
      adetler.set(satir.category, (adetler.get(satir.category) ?? 0) + 1);
    }
    return ELECTRICAL_CATEGORIES.flatMap((category) => {
      const adet = adetler.get(category) ?? 0;
      return adet ? [{ category, adet }] : [];
    });
  }, [malzeme]);
  const sayfaObekleri = useMemo(
    () => groupSheetsByLocation(current?.sheets ?? []),
    [current]
  );

  // SÜZ → SIRALA, bu sırayla ve HER İKİSİ de saf çekirdekten. Excel ucu aynı
  // iki fonksiyonu çağırır; ekranda görülen ile indirilen ayrışamaz.
  const gosterilenMalzeme = useMemo(
    () => sortMaterials(filterMaterials(malzeme, suzgec), malzemeSira.key, malzemeSira.desc),
    [malzeme, suzgec, malzemeSira]
  );
  const gosterilenAygit = useMemo(
    () => sortParts(filterParts(parts, suzgec), aygitSira.key, aygitSira.desc),
    [parts, suzgec, aygitSira]
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
              // İNDİRİLEN DOSYA EKRANDAKİ SÜZGECİ TAŞIR: bağlantı süzgeci
              // sorguya çevirir ve uç aynı saf fonksiyonu çağırır. Etiket de
              // bunu söyler — süzülmüş bir ekrandan "Excel" yazan bir düğmeye
              // basan kişi tam listeyi beklerdi.
              <Button size="sm" variant="outline" asChild>
                <a href={`/projects/${projectId}/electrical/export${filterToQuery(suzgec)}`}>
                  <Download className="size-3.5" />
                  {suzgecTemizMi(suzgec) ? "Excel" : "Excel (süzülmüş)"}
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
                        else toast.success("Elektrik projesi silme talebi Yönetici onayına gönderildi.");
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
        <div className="overflow-hidden rounded-lg border bg-card">
          {/* GÖRÜNÜM RAYI — üç ayrı soru, üç ayrı liste. Segment denetimi
              (düğme kümesi değil): hangisinin etkin olduğu tek bakışta
              okunmalı ve sayaç SÜZÜLMÜŞ değil TOPLAM adedi göstermeli —
              süzgeci değiştirmek raydaki sayıyı oynatırsa "kaç malzeme var"
              sorusu cevapsız kalır. Süzülmüş adet süzgeç şeridindedir. */}
          <div className="flex flex-wrap items-center gap-1 border-b p-2">
            {(
              [
                ["malzeme", "Malzeme", malzeme.length],
                ["aygit", "Aygıt", parts.length],
                ["sayfalar", "Sayfalar", current?.sheets.length ?? 0],
              ] as const
            ).map(([k, etiket, adet]) => (
              <button
                key={k}
                type="button"
                aria-pressed={gorunum === k}
                onClick={() => setGorunum(k)}
                className={`oc-tap inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  gorunum === k
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                {etiket}
                <span className="font-mono text-[11px] tabular-nums opacity-70">{adet}</span>
              </button>
            ))}
          </div>

          {gorunum === "sayfalar" ? (
            <SheetIndex obekler={sayfaObekleri} />
          ) : (
            <>
              {/* SÜZGEÇ ŞERİDİ evin ortak kabuğudur (`FilterBar`): sayaç ve
                  "temizle" her listede aynı yerde durur. */}
              <FilterBar
                gorunen={gorunum === "malzeme" ? gosterilenMalzeme.length : gosterilenAygit.length}
                toplam={gorunum === "malzeme" ? malzeme.length : parts.length}
                temiz={suzgecTemizMi(suzgec)}
                onTemizle={() => setSuzgec(BOS_SUZGEC)}
              >
                <select
                  value={suzgec.location}
                  onChange={(e) => setSuzgec((f) => ({ ...f, location: e.target.value }))}
                  className="oc-tap h-9 max-w-44 rounded-md border bg-background px-2 text-sm"
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
                <select
                  value={suzgec.category}
                  onChange={(e) => setSuzgec((f) => ({ ...f, category: e.target.value }))}
                  className="oc-tap h-9 max-w-64 rounded-md border bg-background px-2 text-sm"
                  aria-label="Kategori süzgeci"
                >
                  <option value="">Bütün kategoriler</option>
                  {kategoriler.map((k) => (
                    <option key={k.category} value={k.category}>
                      {k.category} ({k.adet})
                    </option>
                  ))}
                </select>
                <select
                  value={suzgec.supplier}
                  onChange={(e) => setSuzgec((f) => ({ ...f, supplier: e.target.value }))}
                  className="oc-tap h-9 max-w-52 rounded-md border bg-background px-2 text-sm"
                  aria-label="Tedarikçi süzgeci"
                >
                  <option value="">Bütün tedarikçiler</option>
                  {tedarikciler
                    .filter((t) => t.key)
                    .map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label} ({t.lines})
                      </option>
                    ))}
                </select>
                <SearchBox
                  value={suzgec.q}
                  onChange={(v) => setSuzgec((f) => ({ ...f, q: v }))}
                  placeholder="Kod, tanım, kategori, tip"
                  className="w-full sm:w-56"
                />
              </FilterBar>

              {gorunum === "malzeme" &&
                (gosterilenMalzeme.length === 0 ? (
                  <BosSonuc onTemizle={() => setSuzgec(BOS_SUZGEC)} />
                ) : (
                  <MaterialTable
                    rows={gosterilenMalzeme}
                    catalogReferences={catalogReferences}
                    sortKey={malzemeSira.key}
                    desc={malzemeSira.desc}
                    onSort={(k) =>
                      setMalzemeSira((s) => ({ key: k, desc: s.key === k ? !s.desc : false }))
                    }
                  />
                ))}

              {gorunum === "aygit" &&
                (gosterilenAygit.length === 0 ? (
                  <BosSonuc onTemizle={() => setSuzgec(BOS_SUZGEC)} />
                ) : (
                  <PartTable
                    rows={gosterilenAygit}
                    sortKey={aygitSira.key}
                    desc={aygitSira.desc}
                    onSort={(k) =>
                      setAygitSira((s) => ({ key: k, desc: s.key === k ? !s.desc : false }))
                    }
                  />
                ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SAYFA DİZİNİ — projenin içindekiler tablosu, panoya göre öbeklenmiş.
 *
 * TABLO DEĞİL IZGARA: 157 satırlık bir dizinde "pano · pafta · ad" üçlüsü tek
 * sütunda alt alta 157 satır ederdi ve okuyan aradığı paftayı kaydırarak
 * arardı. Öbek başlığı panoyu bir kez söyler, altındaki ızgara paftaları geniş
 * ekranda üç kola yayar — göz bir öbeği tek bakışta tarar.
 *
 * ARAMA BURADA KENDİ İÇİNDEDİR: malzeme süzgecinin alanları (tedarikçi,
 * malzeme kodu) sayfa dizininde YOKTUR ve ortak şeridi paylaşmak, çalışmayan
 * iki açılır liste göstermek olurdu.
 */
function SheetIndex({ obekler }: { obekler: { location: string; sheets: ElectricalSheet[] }[] }) {
  const [ara, setAra] = useState("");
  const q = trKatla(ara);
  const suzulmus = q
    ? obekler
        .map((g) => ({
          ...g,
          sheets: g.sheets.filter(
            (sf) =>
              trKatla(sf.title).includes(q) ||
              trKatla(g.location).includes(q) ||
              sf.sheetNo.includes(q) ||
              String(sf.page) === q
          ),
        }))
        .filter((g) => g.sheets.length > 0)
    : obekler;
  const gorunen = suzulmus.reduce((n, g) => n + g.sheets.length, 0);
  const toplam = obekler.reduce((n, g) => n + g.sheets.length, 0);

  return (
    <>
      <FilterBar
        gorunen={gorunen}
        toplam={toplam}
        temiz={!ara.trim()}
        onTemizle={() => setAra("")}
      >
        <SearchBox
          value={ara}
          onChange={setAra}
          placeholder="Pafta adı, pano ya da sayfa no"
          className="w-full sm:w-72"
        />
      </FilterBar>
      {gorunen === 0 ? (
        <BosSonuc onTemizle={() => setAra("")} />
      ) : (
        <div className="divide-y">
          {suzulmus.map((g, i) => (
            <div key={`${g.location}-${i}`} className="p-3">
              <div className="font-mono text-sm font-medium">
                {g.location ? `+${g.location}` : "— (kimliksiz)"}
              </div>
              <ul className="mt-1 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {g.sheets.map((sf) => (
                  <li key={sf.page} className="flex min-w-0 gap-2 text-muted-foreground">
                    <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums">
                      s.{sf.page}
                    </span>
                    {/* Pafta adı da KESİLİR: uzun bir ad ızgaranın kolonunu
                        şişirip komşu kolonu daraltıyordu. */}
                    <span className="min-w-0 truncate" title={sf.title}>
                      {sf.sheetNo ? `${sf.sheetNo} · ` : ""}
                      {sf.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
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
