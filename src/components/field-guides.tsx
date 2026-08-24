"use client";

// Alan bilgi açılırlarının ŞEMALARI.
//
// Bazı seçim kutularının cevabı bir cümleyle anlaşılmaz: motor bağlantı
// biçiminde B5 ile B14'ün farkı flanşın ÇAPI ve deliklerinin DİŞLİ olup
// olmadığıdır — yanlış olanı sipariş etmek motoru redüktöre takılamaz hâle
// getirir. Bu yüzden kutunun bilgi açılırı metnin üstüne biçimin şemasını
// çizer ve seçili biçimi vurgular.
//
// Çizimler METİNDEN AYRI DEĞİLDİR: kodlar, IM karşılıkları ve açıklamalar
// `lib/calc/fields.ts`teki sözlüklerden okunur (tek kaynak); burada yalnız
// çizim vardır. Alan tanımları saf kalsın diye JSX buradadır.

import { cn } from "@/lib/utils";
import {
  MOTOR_MOUNT_TYPES,
  MOTOR_MOUNT_TYPE_IM_CODES,
  MOTOR_MOUNT_TYPE_INFO,
  MOTOR_MOUNT_TYPE_LABELS,
} from "@/lib/calc/fields";

/** Şemanın hangi montaj öğelerini çizeceği — biçim kodundan çözülür. */
interface MountShape {
  /** Ayaklar var mı (B3 / B34 / B35) */
  feet: boolean;
  /** Flanş: yok · büyük geçme delikli (FF) · küçük dişli delikli (FT) */
  flange: "none" | "ff" | "ft";
}

const SHAPES: Record<string, MountShape> = {
  B3: { feet: true, flange: "none" },
  B5: { feet: false, flange: "ff" },
  B14: { feet: false, flange: "ft" },
  B35: { feet: true, flange: "ff" },
  B34: { feet: true, flange: "ft" },
};

/**
 * Tek bir montaj biçiminin YANDAN GÖRÜNÜŞÜ. Ölçekli değildir; okunmak
 * içindir. Mil sağdadır, flanş milin kökünde durur, ayaklar altta zemine
 * oturur.
 */
function MountSchematic({ shape, active }: { shape: MountShape; active: boolean }) {
  const ink = active ? "var(--primary)" : "var(--foreground)";
  const body = active ? "var(--primary)" : "var(--muted-foreground)";
  // Ölçü zinciri: mil ekseni y=47, gövde 28…66, ayak tabanı (zemin) y=72.
  // BÜYÜK FLANŞ (FF) tam olarak AYAK DÜZLEMİNE kadar iner — gerçek motorda da
  // flanş yarıçapı mil yüksekliğine yakındır, yani flanşın altı ayakların
  // oturduğu düzlemle hemen hemen aynı hizadadır. Zemini delen bir flanş
  // çizmek şemayı yalancı yapardı.
  return (
    <svg
      viewBox="0 0 160 96"
      className="w-full"
      role="presentation"
      aria-hidden="true"
    >
      {/* zemin — yalnız ayaklı biçimlerde çizilir */}
      {shape.feet && (
        <>
          <line x1="18" y1="72" x2="142" y2="72" stroke="var(--border)" strokeWidth="1.5" />
          {[24, 38, 52, 66, 80, 94, 108, 122, 136].map((x) => (
            <line key={x} x1={x} y1="72" x2={x - 6} y2="78" stroke="var(--border)" strokeWidth="1" />
          ))}
        </>
      )}

      {/* gövde + soğutma kanatları */}
      <rect x="30" y="28" width="78" height="38" rx="3" fill="var(--muted)" stroke={ink} strokeWidth="1.4" />
      {[40, 50, 60, 70, 80, 90, 100].map((x) => (
        <line key={x} x1={x} y1="29" x2={x} y2="65" stroke="var(--border)" strokeWidth="0.9" />
      ))}
      {/* klemens kutusu */}
      <rect x="58" y="18" width="24" height="10" rx="1.5" fill="var(--muted)" stroke={ink} strokeWidth="1.2" />

      {/* ayaklar: gövdenin altında iki pabuç, ortalarında cıvata deliği */}
      {shape.feet && (
        <>
          <rect x="34" y="66" width="20" height="6" fill={body} opacity="0.8" />
          <rect x="84" y="66" width="20" height="6" fill={body} opacity="0.8" />
          <circle cx="44" cy="69" r="1.6" fill="var(--background)" />
          <circle cx="94" cy="69" r="1.6" fill="var(--background)" />
        </>
      )}

      {/* flanş: FF gövdeden TAŞAR (büyük çap), FT gövde boyunda kalır */}
      {shape.flange === "ff" && (
        <>
          <rect x="108" y="22" width="9" height="50" fill={body} opacity="0.85" />
          {/* geçme delik: içi boş, cıvata motor tarafından geçer */}
          <circle cx="112.5" cy="27" r="2.4" fill="var(--background)" stroke={ink} strokeWidth="1" />
          <circle cx="112.5" cy="67" r="2.4" fill="var(--background)" stroke={ink} strokeWidth="1" />
        </>
      )}
      {shape.flange === "ft" && (
        <>
          {/* FT flanş gövdeden yalnız biraz taşar — FF'in yanında küçüklüğü
              görülsün diye 2 birim; gerçekte de çapı gövde boyuna yakındır. */}
          <rect x="108" y="26" width="9" height="42" fill={body} opacity="0.85" />
          {/* DİŞLİ delik DOLU basılır; geçme delik içi boştur. İki delik bu
              şemada yalnız buradan ayrılır, bu yüzden ayrım dolu/boş gibi en
              kaba işaretle verilir — kesik daire bu ölçekte yıldıza dönüyordu. */}
          <circle cx="112.5" cy="32" r="2.4" fill={ink} />
          <circle cx="112.5" cy="62" r="2.4" fill={ink} />
        </>
      )}

      {/* mil — flanş varsa onun dışından, yoksa doğrudan gövdeden çıkar */}
      <rect
        x={shape.flange === "none" ? 108 : 117}
        y="42.5"
        width={shape.flange === "none" ? 36 : 27}
        height="9"
        fill={body}
        opacity="0.9"
      />
      {/* mil ekseni */}
      <line
        x1="24" y1="47" x2="150" y2="47"
        stroke="var(--border)" strokeWidth="0.8" strokeDasharray="7 3 1.5 3"
      />
    </svg>
  );
}

export interface MotorMountGuideProps {
  /** Kutuda seçili olan biçim kodu — şemada vurgulanır. */
  selected?: string;
}

/**
 * Motor bağlantı (montaj) biçimleri şeması — IEC 60034-7.
 *
 * Beş biçim yan yana çizilir; kutuda seçili olan vurgulanır. Kartın altındaki
 * metin `fields.ts`teki açıklama sözlüğünden gelir.
 */
export function MotorMountGuide({ selected }: MotorMountGuideProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {MOTOR_MOUNT_TYPES.map((code) => {
        const active = selected === code;
        return (
          <div
            key={code}
            className={cn(
              "border p-2",
              active ? "border-primary/60 bg-primary/5" : "bg-background"
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "font-mono text-xs font-semibold",
                  active ? "text-primary" : "text-foreground"
                )}
              >
                {code}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {MOTOR_MOUNT_TYPE_IM_CODES[code]}
              </span>
            </div>
            <MountSchematic shape={SHAPES[code]} active={active} />
            <p className="text-[11px] font-medium leading-tight">
              {/* Etiket "B3 — Ayaklı" biçimindedir; kod başlıkta zaten var. */}
              {MOTOR_MOUNT_TYPE_LABELS[code].replace(/^\S+\s+—\s+/, "")}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {MOTOR_MOUNT_TYPE_INFO[code]}
            </p>
          </div>
        );
      })}
      <p className="text-[11px] leading-snug text-muted-foreground sm:col-span-2">
        Şemada içi BOŞ daire geçme deliğidir (FF — cıvata motordan geçer), DOLU
        daire dişli deliktir (FT — cıvata karşı makineden motora vidalanır).
        Yandan görünüştür, ölçekli değildir.
      </p>
    </div>
  );
}

/** Bilgi açılırında çizilecek şemayı alan tanımındaki ada göre seçer. */
export function FieldGuide({
  guide,
  value,
}: {
  guide: "motorMount";
  value?: unknown;
}) {
  if (guide === "motorMount") {
    return <MotorMountGuide selected={typeof value === "string" ? value : undefined} />;
  }
  return null;
}
