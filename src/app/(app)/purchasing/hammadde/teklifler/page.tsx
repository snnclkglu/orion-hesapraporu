// TEKLİF KARŞILAŞTIRMA — sunucu kabuğu.
//
// EKRANIN CEVAPLADIĞI SORU: "bu malzemeleri kimden alayım?"
//
// Havuz "ne lazım" der, yerleşim "kaç plaka" der; burada ÜÇÜNCÜ soru sorulur
// ve cevabı tek bir sayı değildir: en ucuz fiyat, en kısa termin ve en uzun
// vade çoğu zaman ÜÇ AYRI FİRMADADIR. Ekran o üçünü yan yana koyar ve kararı
// insana bırakır.
//
// ═══════════════════════════════════ SAYFA ARTIK PARTİ ÜZERİNE KURULU
//
// Kullanıcı bildirimi (15.08.2026): *"Teklif karşılaştırma sayfası şu anda
// karmaşık geliyor. Teklif Aç Koduna göre satır satır gelsin. Her açtığım
// teklifi ayrı ayrı değerlendirebileyim. İstersem bu sayfada teklifleri
// birleştir ayrı diyebileyim."*
//
// Eski sayfa doğrudan bir MATRİSLE açılıyordu ve matrisin sütunu TEDARİKÇİYDİ:
// aynı firmadan iki hafta arayla alınmış iki teklif tek sütunda eriyor,
// kullanıcı hangi teklifi değerlendirdiğini bilemiyordu. Şimdi sayfa bir
// LİSTEYLE açılır (her satır bir teklif, kendi koduyla) ve karşılaştırma o
// listeden SEÇİLENLER üzerinde kurulur.
//
// SEÇİM ADRESTE TAŞINIR (`?p=…&gorunum=…`), yerleşim ekranının kuralının
// aynısı: karşılaştırma paylaşılabilir bir bağlantıdır ve tarayıcı
// yenilendiğinde aynı tablo çıkar.

import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing, isAdminRole } from "@/lib/roles";
import {
  loadQualities,
  loadSiparisNolari,
  loadSiparisler,
  loadSonKur,
  loadTedarikciDefteri,
  loadTedarikciler,
  loadTeklifPartileri,
} from "../../data";
import { loadHammaddeHavuzu } from "../data";
import {
  karsilastirmaKur,
  type KarsilastirmaKalemi,
  type KarsilastirmaTeklifi,
} from "@/lib/purchasing/hammadde/karsilastirma";
import { alimKategorisi } from "@/lib/purchasing/hammadde/alim-analizi";
import { HAMMADDE_SINIFLARI, type HammaddeSinifi } from "@/lib/purchasing/hammadde/siniflar";
import { CompareView, type PartiOzeti } from "./compare-view";

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

function coklu(v: string | string[] | undefined): string[] {
  return Array.isArray(v) ? v : v ? [v] : [];
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
  const gorunum = (Array.isArray(sp.gorunum) ? sp.gorunum[0] : sp.gorunum) === "ayri"
    ? "ayri"
    : "birlesik";

  const anahtarlar = veri.havuz.satirlar.map((s) => s.key);
  const [partiler, siparisler, tedarikciler, defter, siparisNolari, sonKur, qualities] =
    await Promise.all([
      anahtarlar.length > 0
        ? loadTeklifPartileri(supabase, anahtarlar)
        : Promise.resolve([]),
      loadSiparisler(supabase),
      loadTedarikciler(supabase),
      loadTedarikciDefteri(supabase),
      loadSiparisNolari(supabase),
      loadSonKur(supabase),
      loadQualities(supabase),
    ]);

  /** Stok anahtarı → havuz satırı (miktar, birim, tanım, sınıf). */
  const havuzHaritasi = new Map(veri.havuz.satirlar.map((s) => [s.key, s]));

  // ————————————————————————————————— parti künyeleri
  //
  // Özet HER PARTİ İÇİN kurulur (seçilmiş olsun olmasın): liste satırında
  // toplam ve kalem sayısı görünmeden kullanıcı hangi teklifi seçeceğini
  // bilemez.
  /**
   * HAVUZDA OLMAYAN KALEMİN TEKLİFİ DE GÖRÜNÜR (kullanıcı isteği, 15.08.2026:
   * plaka teklifi).
   *
   * PLAKA TEKLİFİNİN ANAHTARI HAVUZDA YOKTUR ve olmamalıdır: havuz `SAC 10 MM
   * S355JR` (bir İHTİYAÇ) der, plaka teklifi `SAC 10 X 1500 X 6000 ST37` (bir
   * ÜRÜN) — ikisi ayrı kalemdir ve plaka ölçüsü ancak yerleşimle bilinir
   * (md. 24). Havuz eşleşmesi ŞART koşulsaydı, kullanıcının yerleşim
   * ekranından açtığı teklif bu sayfada hiç görünmezdi.
   *
   * MİKTAR O ZAMAN BİLİNMEZ ve UYDURULMAZ (`null`): tutar sütunu tire kalır,
   * karşılaştırma birim fiyat üzerinden yapılır. Sınıf ise stok adından
   * çözülür — tür şeridi o kalemi de süzebilsin.
   */
  const kalemKunyesi = (t: { matchKey: string; sample: string }) => {
    const havuzSatiri = havuzHaritasi.get(t.matchKey);
    if (havuzSatiri) {
      const m = miktarBul(havuzSatiri);
      return {
        tanim: havuzSatiri.tanim,
        sinif: havuzSatiri.sinif as HammaddeSinifi,
        miktar: m.miktar,
        birim: m.birim,
      };
    }
    const sinif = alimKategorisi(t.sample);
    return {
      tanim: t.sample,
      sinif: (HAMMADDE_SINIFLARI.includes(sinif as HammaddeSinifi)
        ? sinif
        : "DIGER") as HammaddeSinifi,
      miktar: null,
      birim: "Kg",
    };
  };

  const ozetler: PartiOzeti[] = partiler
    .map((p) => {
      const satirlar = p.satirlar
        .filter((t) => tur == null || kalemKunyesi(t).sinif === tur)
        .map((t) => {
          const k = kalemKunyesi(t);
          const m = { miktar: k.miktar, birim: k.birim };
          return {
            quoteId: t.id,
            key: t.matchKey,
            tanim: k.tanim,
            miktar: m.miktar,
            birim: m.birim,
            birimFiyat: t.unitPrice,
            paraBirimi: t.currency,
            kur: t.fxRate,
            birimFiyatEur: t.unitPriceEur,
            tutarEur:
              m.miktar != null && t.unitPriceEur != null ? m.miktar * t.unitPriceEur : null,
            teslimGun: t.leadTimeDays,
          };
        })
        .sort((a, b) => a.tanim.localeCompare(b.tanim, "tr"));

      const ilk = p.satirlar[0];
      return {
        id: p.id,
        code: p.code,
        supplier: p.supplier,
        quotedAt: p.quotedAt,
        status: p.status,
        note: p.note,
        cancelReason: p.cancelReason,
        // VADE PARTİ BAŞINADIR ama satırlar çelişebilir: en uzunu yazılır
        // (çekirdekteki kuralın aynısı — satınalmacı en kötü hâli görmeli).
        vadeGun: p.satirlar.reduce((m, t) => Math.max(m, t.paymentTermDays), 0),
        paraBirimi: ilk?.currency ?? "EUR",
        kur: ilk?.fxRate ?? null,
        toplamEur: satirlar.reduce((t, s) => t + (s.tutarEur ?? 0), 0),
        kalemSayisi: satirlar.length,
        satirlar,
      };
    })
    // TÜR SÜZGECİ SONRASI BOŞALAN PARTİ LİSTEDEN DÜŞER: "0 kalem" yazan bir
    // satır seçilebilir görünür ama karşılaştırmaya hiçbir şey katmaz.
    .filter((p) => p.kalemSayisi > 0);

  // ————————————————————————————————— seçim
  //
  // Adreste seçim yoksa AÇIK partilerin hepsi seçilidir: ekranın sorusu "bu
  // malzemeleri kimden alayım" ve boş bir matris o soruyu cevaplamaz.
  const istenen = new Set(coklu(sp.p));
  const secili =
    istenen.size > 0
      ? ozetler.filter((p) => istenen.has(p.id))
      : ozetler.filter((p) => p.status !== "iptal");

  // ————————————————————————————————— birleşik matris
  //
  // SÜTUN PARTİDİR, TEDARİKÇİ DEĞİL: aynı firmanın iki teklifi iki sütundur ve
  // ancak öyle ayrı ayrı değerlendirilebilir.
  const kapsam = [...new Set(secili.flatMap((p) => p.satirlar.map((s) => s.key)))];
  // KALEM KÜNYESİ SATIRLARDAN OKUNUR, havuzdan DEĞİL: plaka teklifinin
  // anahtarı havuzda yoktur ve `havuzHaritasi.get(k)!` orada patlardı.
  const kalemKaynagi = new Map(
    secili.flatMap((p) => p.satirlar.map((s) => [s.key, s] as const))
  );
  const kalemler: KarsilastirmaKalemi[] = kapsam
    .map((k) => {
      const s = kalemKaynagi.get(k)!;
      return { key: k, tanim: s.tanim, miktar: s.miktar, birim: s.birim };
    })
    .sort((a, b) => a.tanim.localeCompare(b.tanim, "tr"));

  const girdiler: KarsilastirmaTeklifi[] = secili.flatMap((p) =>
    p.satirlar.map((s) => ({
      key: s.key,
      sutunKey: p.id,
      etiket: p.code ? `${p.code} · ${p.supplier}` : p.supplier,
      tedarikci: p.supplier,
      birimFiyat: s.birimFiyat,
      paraBirimi: s.paraBirimi,
      birimFiyatEur: s.birimFiyatEur,
      vadeGun: p.vadeGun,
      teslimGun: s.teslimGun,
    }))
  );

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
      partiler={ozetler}
      seciliIdler={secili.map((p) => p.id)}
      gorunum={gorunum}
      tur={tur}
      turSayaclari={HAMMADDE_SINIFLARI.map((s) => ({
        tur: s,
        adet: new Set(
          partiler
            .flatMap((p) => p.satirlar)
            .filter((t) => kalemKunyesi(t).sinif === s)
            .map((t) => t.matchKey)
        ).size,
      }))}
      siparisAdetleri={[...siparisAdetleri.entries()]}
      paylar={Object.fromEntries(
        kapsam.map((k) => [
          k,
          (havuzHaritasi.get(k)?.parcalar ?? []).map((p) => ({
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
      isAdmin={isAdminRole(profil?.role)}
    />
  );
}
