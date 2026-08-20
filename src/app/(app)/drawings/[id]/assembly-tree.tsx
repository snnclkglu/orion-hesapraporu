"use client";

// Montaj ağacı — KATLANIR, girintili HTML listesi.
//
// `lib/diagrams` ile ÇİZİLMEZ (AGENTS WORKLOG-17): o katman `DiagramEl[]` üretir ve
// aynı model PDF'e basılır; burada gereken etkileşimli bir liste.
//
// AĞAÇ KAPALI AÇILIR. Önceden bütün düğümler açıktı ve 121 parçalık MONORAY'da
// ana gruplara ulaşmak için sayfayı kaydırmak gerekiyordu; 261 parçalık MTC'de
// bu iş göz taramasıyla yapılamaz hâle geliyordu. Kullanıcının istediği şey
// şuydu: "önce ana grupları göreyim, üzerine tıklayınca altı açılsın."
//
// ANA GRUP KODDAN OKUNUR, elle işaretlenmez: `0053-01-0201` gibi kalem
// numarasından SONRA tek segmenti olan kod bir ana gruptur. Ağaçta bunlar
// köktür (üstleri kalem numarasıdır ve o bir parça değildir, bkz.
// `part-code.ts` `parentCode`), yani "kök = ana grup" ayrı bir kural değil aynı
// kuralın görünen yüzüdür.
//
// GİRİNTİ SINIRLIDIR (`min(level,4)`): kod altı segmente kadar iniyor
// (`0043-00-0802-00-02-06`) ve sınırsız girinti derin düğümleri telefonda ekran
// dışına iterdi. Yazı KÜÇÜLTÜLMEZ — okunmayan bir ağaç ağaç değildir.
//
// Kendi dosyasında durur ki `/dev/drawings-preview` onu auth'suz basabilsin:
// bu ekranı her değişiklikte gerçek veriyle denemek zorunda kalmak, kusurların
// kullanıcıya ulaşmasına sebep oluyordu.

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNum } from "@/lib/drawings/labels";
import { trKatla } from "@/lib/drawings/tr-text";
import type { PartRow } from "../data";
import { FileOpenButton } from "./file-open-button";
import { SearchBox } from "../sortable-head";

/**
 * Ağacın dosyadan istediği tek şey.
 *
 * `FileRow`un tamamı GEÇMEZ: bu bileşen artık istemcidedir ve prop'ları RSC
 * yükünde taşınır — 454 satırlık bir pakette `meta` alanıyla birlikte bütün
 * dosya kayıtlarını telefona indirmek, üç alan için yüzlerce KB demekti.
 */
export interface TreeFile {
  id: string;
  storage_path: string;
  file_name: string;
}

export function AssemblyTree({
  parts,
  files,
  packageId,
}: {
  parts: PartRow[];
  files: TreeFile[];
  packageId?: string;
}) {
  const [arama, setArama] = useState("");
  const [acik, setAcik] = useState<Set<string>>(new Set());

  const dosyaKimlik = useMemo(() => new Map(files.map((d) => [d.id, d])), [files]);

  const { kodlu, cocuklar, kokler, altSayisi } = useMemo(() => {
    // Kodsuz satın alma satırları ağaca GİRMEZ — onlar bir montajın altında
    // durmaz, Satın Alma bölümünde durur.
    const kodlu = parts.filter((p) => p.part_code);
    const cocuklar = new Map<string, PartRow[]>();
    for (const p of kodlu) {
      const anahtar = p.parent_code || "";
      const liste = cocuklar.get(anahtar);
      if (liste) liste.push(p);
      else cocuklar.set(anahtar, [p]);
    }
    const kodKumesi = new Set(kodlu.map((p) => p.part_code));
    // Üstü defterde OLMAYAN düğüm de köktür: ağaç bir düğümü yutmamalı.
    const kokler = kodlu.filter((p) => !p.parent_code || !kodKumesi.has(p.parent_code));

    // KAPALI BİR DÜĞÜM NE SAKLADIĞINI SÖYLEMELİ. Alt toplam olmadan katlama
    // bilgiyi gizlemek olurdu: "0500" satırı 38 parça mı saklıyor 2 mi,
    // açmadan bilinmiyordu. Sayım bütün alt ağacı kapsar, yalnız doğrudan
    // çocukları değil.
    const altSayisi = new Map<string, number>();
    const say = (kod: string): number => {
      const varOlan = altSayisi.get(kod);
      if (varOlan != null) return varOlan;
      // Döngüye karşı önce 0 yazılır: bozuk bir üst zinciri (kod kendi
      // atasını gösteriyorsa) sonsuz özyinelemeye çevirmemeli.
      altSayisi.set(kod, 0);
      const alt = cocuklar.get(kod) ?? [];
      const toplam = alt.reduce((t, c) => t + 1 + say(c.part_code), 0);
      altSayisi.set(kod, toplam);
      return toplam;
    };
    for (const p of kodlu) say(p.part_code);

    return { kodlu, cocuklar, kokler, altSayisi };
  }, [parts]);

  // ARAMA AĞACI AÇAR. Kapalı bir katın arkasında kalan sonuç, aramayı işe
  // yaramaz yapardı (dosya gezginindeki kuralın aynısı). Eşleşen düğümün
  // BÜTÜN ATALARI açılır, yoksa sonuç görünmez bir dalda kalırdı.
  const aramaAnahtari = arama.trim() ? trKatla(arama) : "";
  const { eslesen, zorlaAcik } = useMemo(() => {
    if (!aramaAnahtari) return { eslesen: null as Set<string> | null, zorlaAcik: null };
    const eslesen = new Set<string>();
    for (const p of kodlu) {
      const havuz = trKatla(
        [p.part_code, p.description, p.name, p.assembly_title, p.material].join(" ")
      );
      if (aramaAnahtari.split(/\s+/).every((k) => havuz.includes(k))) eslesen.add(p.part_code);
    }
    // Ata zinciri: eşleşen her düğümün üstleri de görünür ve AÇIK olmalı.
    const kodaParca = new Map(kodlu.map((p) => [p.part_code, p]));
    const gorunur = new Set(eslesen);
    const zorlaAcik = new Set<string>();
    for (const kod of eslesen) {
      let ust = kodaParca.get(kod)?.parent_code || "";
      while (ust && kodaParca.has(ust) && !zorlaAcik.has(ust)) {
        gorunur.add(ust);
        zorlaAcik.add(ust);
        ust = kodaParca.get(ust)?.parent_code || "";
      }
    }
    return { eslesen: gorunur, zorlaAcik };
  }, [aramaAnahtari, kodlu]);

  function cevir(kod: string) {
    setAcik((o) => {
      const y = new Set(o);
      if (y.has(kod)) y.delete(kod);
      else y.add(kod);
      return y;
    });
  }

  const gorunenKokler = eslesen ? kokler.filter((k) => eslesen.has(k.part_code)) : kokler;

  return (
    <section className="min-w-0 border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-2.5">
        <h2 className="text-sm font-medium">Montaj Ağacı</h2>
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatNum(gorunenKokler.length)} Ana Grup · {formatNum(kodlu.length)} Kodlu Parça
          </span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setAcik(new Set(kodlu.map((p) => p.part_code)))}
          >
            Tümünü Aç
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => setAcik(new Set())}>
            Kapat
          </Button>
        </span>
      </header>

      <div className="border-b px-3 py-2">
        <SearchBox value={arama} onChange={setArama} placeholder="Kod, Tanım, Malzeme Ara…" />
      </div>

      {kokler.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Defter henüz kurulmamış. Üstteki “Yeniden Eşleştir” ile kurabilirsiniz.
        </p>
      ) : gorunenKokler.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Bu aramayla eşleşen parça yok.
        </p>
      ) : (
        <div className="oc-scrollx overflow-x-auto [--oc-scroll-bg:var(--card)]">
          {/* En küçük genişlik `sm` ÜSTÜNDE kapılır: 375px'lik ekranda 544px'lik
              taban ağacı sürekli yatay kaydırmaya mahkûm ediyordu, oysa girinti
              ve parça kodları o genişlikte de sarabiliyor
              (`body { overflow-wrap: break-word }`). Günlük girişteki
              `lg:min-w-[62rem]` ile aynı kalıp. */}
          <ul className="divide-y sm:min-w-[34rem]">
            {gorunenKokler.map((k) => (
              <Dugum
                key={k.register_key}
                part={k}
                cocuklar={cocuklar}
                altSayisi={altSayisi}
                seviye={0}
                dosyaKimlikYol={dosyaKimlik}
                packageId={packageId}
                acik={acik}
                zorlaAcik={zorlaAcik}
                gorunur={eslesen}
                onCevir={cevir}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Dugum({
  part,
  cocuklar,
  altSayisi,
  seviye,
  dosyaKimlikYol,
  packageId,
  acik,
  zorlaAcik,
  gorunur,
  onCevir,
}: {
  part: PartRow;
  cocuklar: Map<string, PartRow[]>;
  altSayisi: Map<string, number>;
  seviye: number;
  dosyaKimlikYol: Map<string, TreeFile>;
  packageId?: string;
  acik: Set<string>;
  /** Aramanın açtığı ata düğümler; kullanıcının tercihini EZMEZ, ekler. */
  zorlaAcik: Set<string> | null;
  /** Arama varsa görünür kodlar; yoksa `null` (hepsi görünür). */
  gorunur: Set<string> | null;
  onCevir: (kod: string) => void;
}) {
  const tumAlt = cocuklar.get(part.part_code) ?? [];
  const alt = gorunur ? tumAlt.filter((c) => gorunur.has(c.part_code)) : tumAlt;
  const acilabilir = alt.length > 0;
  const acikMi = acilabilir && (acik.has(part.part_code) || zorlaAcik?.has(part.part_code) === true);

  const dosyaVar = part.has_model || part.has_sheet || part.has_cut || part.has_3d;
  // İMALAT parçasının resminin olmaması insanın bakması gereken bir şeydir ve
  // raporu açmadan, ağaçta bir bakışta görünmelidir.
  const eksik = part.kind === "imalat" && !dosyaVar;
  const resim = part.sheet_file_id ? dosyaKimlikYol.get(part.sheet_file_id) : null;
  const kesim = part.cut_file_id ? dosyaKimlikYol.get(part.cut_file_id) : null;

  // ANA GRUP SATIRI (0057-00-0500, 0057-00-0510 …) ayırt edici basılır.
  //
  // 121 parçalık bir ağaçta bütün kodlar aynı ağırlıkta olunca grup sınırları
  // kayboluyor ve göz nerede bir montajın bittiğini göremiyor. Girinti tek
  // başına yetmiyor çünkü dar ekranda 0,75rem'e sıkışıyor. Ayrım TİPOGRAFİYLE
  // yapılır: kod kalın, satır hafif zeminli ve üstünde bir çizgi — marka dili
  // gereği renk değil AĞIRLIK ve KURAL kullanılır.
  const anaGrup = seviye === 0;
  const icerik = altSayisi.get(part.part_code) ?? 0;

  return (
    <li>
      <div
        className={
          "flex flex-wrap items-center gap-x-2 gap-y-1 py-2 pr-4 text-sm" +
          (anaGrup ? " border-t border-t-border bg-muted/40" : "") +
          (eksik ? " border-l-2 border-l-destructive bg-destructive/5" : "")
        }
        style={{ paddingLeft: `${0.5 + Math.min(seviye, 4) * 0.75}rem` }}
      >
        {/* AÇMA HEDEFİ SATIRIN KENDİSİDİR, oku değil: 16px'lik bir ikonu
            telefonda vurmak zor. Kod + tanım tek bir düğmedir ve 44px'lik
            hedefi `min-h` ile alır. Yaprak düğümde düğüm yoktur — tıklanacak
            bir şey yokken imleç değişmesi yanlış bir vaat olurdu. */}
        {acilabilir ? (
          <button
            type="button"
            onClick={() => onCevir(part.part_code)}
            aria-expanded={acikMi}
            className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left transition-colors pointer-coarse:min-h-11 hover:text-foreground"
          >
            {acikMi ? (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            )}
            <Kimlik part={part} anaGrup={anaGrup} />
            {!acikMi && icerik > 0 && (
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {formatNum(icerik)} Parça
              </span>
            )}
          </button>
        ) : (
          <span className="flex min-h-9 min-w-0 flex-1 items-center gap-2 pointer-coarse:min-h-11">
            <span className="size-4 shrink-0" aria-hidden />
            <Kimlik part={part} anaGrup={anaGrup} />
          </span>
        )}

        {part.qty != null && (
          <span className="font-mono text-[11px] text-muted-foreground">×{part.qty}</span>
        )}
        {part.material && (
          <span className="border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
            {part.material}
            {part.thickness_mm != null && ` ${formatNum(part.thickness_mm, 1)}mm`}
          </span>
        )}
        {part.weight_kg != null && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {formatNum(part.weight_kg, 1)} kg
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {resim && (
            <FileOpenButton
              storagePath={resim.storage_path}
              packageId={packageId}
              fileId={resim.id}
              fileName={resim.file_name}
              label="PDF"
              title={resim.file_name}
            />
          )}
          {kesim && (
            <FileOpenButton
              storagePath={kesim.storage_path}
              packageId={packageId}
              fileId={kesim.id}
              fileName={kesim.file_name}
              label="DXF"
              title={kesim.file_name}
            />
          )}
          {part.has_3d && <span className="border px-1.5 font-mono text-[11px] text-muted-foreground">3D</span>}
          {eksik && (
            <span className="border border-destructive/40 bg-destructive/10 px-1.5 font-mono text-[11px] text-destructive">
              Resim Yok
            </span>
          )}
        </span>
      </div>

      {acikMi && (
        <ul className="divide-y border-t">
          {alt.map((c) => (
            <Dugum
              key={c.register_key}
              part={c}
              cocuklar={cocuklar}
              altSayisi={altSayisi}
              seviye={seviye + 1}
              dosyaKimlikYol={dosyaKimlikYol}
              packageId={packageId}
              acik={acik}
              zorlaAcik={zorlaAcik}
              gorunur={gorunur}
              onCevir={onCevir}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Kod + tanım — açılabilir ve yaprak düğümlerin paylaştığı gövde. */
function Kimlik({ part, anaGrup }: { part: PartRow; anaGrup: boolean }) {
  return (
    <>
      <span
        className={
          anaGrup
            ? "font-mono text-[13px] font-bold tracking-tight"
            : "font-mono text-[12px] font-medium"
        }
      >
        {part.part_code}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground/80" title={part.description}>
        {part.description || part.name || part.assembly_title || "—"}
      </span>
    </>
  );
}
