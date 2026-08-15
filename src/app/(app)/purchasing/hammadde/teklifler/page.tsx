// TEKLİF KARŞILAŞTIRMA — sunucu kabuğu.
//
// EKRANIN CEVAPLADIĞI SORU: "bu malzemeleri kimden alayım?"
//
// Havuz "ne lazım" der, yerleşim "kaç plaka" der; burada ÜÇÜNCÜ soru sorulur
// ve cevabı tek bir sayı değildir: en ucuz fiyat, en kısa termin ve en uzun
// vade çoğu zaman ÜÇ AYRI FİRMADADIR. Ekran o üçünü yan yana koyar ve kararı
// insana bırakır.

import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing } from "@/lib/roles";
import {
  loadQualities,
  loadSiparisNolari,
  loadSiparisler,
  loadSonKur,
  loadTedarikciDefteri,
  loadTedarikciler,
  loadTeklifler,
} from "../../data";
import { loadHammaddeHavuzu } from "../data";
import {
  karsilastirmaKur,
  type KarsilastirmaKalemi,
  type KarsilastirmaTeklifi,
} from "@/lib/purchasing/hammadde/karsilastirma";
import { HAMMADDE_SINIFLARI, type HammaddeSinifi } from "@/lib/purchasing/hammadde/siniflar";
import { CompareView } from "./compare-view";

/** Sipariş birimi ve miktarı — havuz tablosundaki kuralın aynısı. */
function miktarBul(s: {
  boyAdedi: number | null;
  toplamAgirlikKg: number | null;
  parcaAdedi: number;
}): { miktar: number | null; birim: string } {
  if (s.boyAdedi != null && s.boyAdedi > 0) return { miktar: s.boyAdedi, birim: "Boy" };
  if (s.toplamAgirlikKg != null && s.toplamAgirlikKg > 0) {
    return { miktar: Math.round(s.toplamAgirlikKg), birim: "Kg" };
  }
  return { miktar: s.parcaAdedi > 0 ? s.parcaAdedi : null, birim: "Adet" };
}

export default async function TekliflerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: kullanici }, veri] = await Promise.all([
    supabase.auth.getUser(),
    loadHammaddeHavuzu(supabase),
  ]);
  const { data: profil } = kullanici.user
    ? await supabase.from("profiles").select("role").eq("id", kullanici.user.id).maybeSingle()
    : { data: null };

  const turHam = Array.isArray(sp.tur) ? sp.tur[0] : sp.tur;
  const tur = HAMMADDE_SINIFLARI.includes(turHam as HammaddeSinifi)
    ? (turHam as HammaddeSinifi)
    : null;

  // KARŞILAŞTIRMAYA YALNIZ TEKLİFİ OLAN KALEM GİRER — boş bir sütun matrisi
  // hiçbir soruyu cevaplamaz. Süzgeç istenirse tür de daraltır.
  const anahtarlar = veri.havuz.satirlar.map((s) => s.key);
  const [teklifler, siparisler, tedarikciler, defter, siparisNolari, sonKur, qualities] =
    await Promise.all([
      anahtarlar.length > 0 ? loadTeklifler(supabase, anahtarlar) : Promise.resolve([]),
      loadSiparisler(supabase),
      loadTedarikciler(supabase),
      loadTedarikciDefteri(supabase),
      loadSiparisNolari(supabase),
      loadSonKur(supabase),
      loadQualities(supabase),
    ]);

  const teklifliAnahtarlar = new Set(teklifler.map((t) => t.matchKey));
  const kapsam = veri.havuz.satirlar.filter(
    (s) => teklifliAnahtarlar.has(s.key) && (tur == null || s.sinif === tur)
  );

  const kalemler: KarsilastirmaKalemi[] = kapsam.map((s) => {
    const m = miktarBul(s);
    return { key: s.key, tanim: s.tanim, miktar: m.miktar, birim: m.birim };
  });

  const kapsamKumesi = new Set(kalemler.map((k) => k.key));
  const girdiler: KarsilastirmaTeklifi[] = teklifler
    .filter((t) => kapsamKumesi.has(t.matchKey))
    .map((t) => ({
      key: t.matchKey,
      tedarikci: t.supplier,
      birimFiyat: t.unitPrice,
      paraBirimi: t.currency,
      birimFiyatEur: t.unitPriceEur,
      vadeGun: t.paymentTermDays,
      teslimGun: t.leadTimeDays,
    }));

  const tablo = karsilastirmaKur(kalemler, girdiler);

  const siparisAdetleri = new Map<string, number>();
  for (const s of siparisler) {
    for (const l of s.satirlar) {
      siparisAdetleri.set(l.matchKey, (siparisAdetleri.get(l.matchKey) ?? 0) + l.qty);
    }
  }

  return (
    <CompareView
      tablo={tablo}
      tur={tur}
      turSayaclari={HAMMADDE_SINIFLARI.map((s) => ({
        tur: s,
        adet: veri.havuz.satirlar.filter((r) => r.sinif === s && teklifliAnahtarlar.has(r.key))
          .length,
      }))}
      siparisAdetleri={[...siparisAdetleri.entries()]}
      paylar={Object.fromEntries(
        kapsam.map((s) => [
          s.key,
          s.parcalar.map((p) => ({
            itemNo: p.itemNo,
            packageId: p.packageId,
            partKey: p.partKey,
            adet: p.adet ?? 0,
          })),
        ])
      )}
      birimler={Object.fromEntries(kalemler.map((k) => [k.key, k.birim]))}
      tedarikciler={tedarikciler}
      defter={defter}
      siparisNolari={siparisNolari}
      sonKur={sonKur}
      qualities={qualities}
      canWrite={canEditPurchasing(profil?.role)}
    />
  );
}
