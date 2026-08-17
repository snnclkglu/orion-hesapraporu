// TEKLİFLER — sunucu kabuğu.
//
// EKRANIN CEVAPLADIĞI SORU: "bu malzemeleri kimden alayım?"
//
// Havuz "ne lazım" der, yerleşim "kaç plaka" der; burada ÜÇÜNCÜ soru sorulur
// ve cevabı tek bir sayı değildir: en ucuz fiyat, en kısa termin ve en uzun
// vade çoğu zaman ÜÇ AYRI FİRMADADIR. Ekran o üçünü yan yana koyar ve kararı
// insana bırakır.
//
// ═══════════════════════════ SAYFANIN SATIRI ARTIK "TALEP"TİR, FİRMA CEVABI DEĞİL
//
// Kullanıcı kararı (15.08.2026): *"Teklif Karşılaştırma bölümünü teklifler
// yapalım. Bu teklifler bölümde istediğim tekliflerin buraya düşmesi. Birkaç
// firmadan aynı teklifi aldığımda burada görebileyim. Teklifin üstüne
// tıkladığımda bir pop up açılsın ve hangi firma ne teklif verdi görebileyim."*
//
// Sabahki sürümde satır BİR FİRMANIN teklifiydi (`TK0006`) ve aynı soruya üç
// firmadan gelen cevap listede üç ayrı satır olarak duruyordu — "aynı teklifi
// birkaç firmadan aldım" cümlesinin ekranda karşılığı yoktu. Satır artık
// TALEPtir (`TT0003`); firmaların cevapları onun altındadır ve karşılaştırma
// matrisi pop-up'ta açılır.
//
// ═══════════════════════════ PLAKA TEKLİFİ NEDEN GÖRÜNMÜYORDU
//
// Kullanıcı bildirimi: *"Fiyat girdiğimde de teklif karşılaştırma bölümüne
// düşmüyor. Ancak tekliflere kaydedildi diye uyarı geliyor."* Ölçüldü ve
// doğruydu — kayıt yapılıyor, sayfa okumuyordu. Teklifler YALNIZ havuz
// anahtarlarıyla isteniyordu ve plaka teklifinin anahtarı havuzda YOKTUR
// (`SAC 12 X 1500 X 3000 S235JR` bir ÜRÜN, havuzdaki `SAC 12 MM S235JR` bir
// İHTİYAÇtır). Bu sayfa o duruma zaten hazırlıklıydı (aşağıdaki
// `kalemKunyesi`); eksik olan bir kat aşağıdaydı ve `loadTeklifDefteri`de
// düzeltildi — artık kapsamı bu ekran olan partiler de okunuyor.
//
// SEÇİM ADRESTE TAŞINIR (`?tur=…`), yerleşim ekranının kuralının aynısı.

import { createClient } from "@/lib/supabase/server";
import { canEditPurchasing, isAdminRole } from "@/lib/roles";
import {
  loadQualities,
  loadSiparisNolari,
  loadSiparisler,
  loadSonKur,
  loadTedarikciDefteri,
  loadTedarikciler,
  loadTeklifDefteri,
  type TeklifSatiri,
} from "../../data";
import { loadHammaddeHavuzu } from "../data";
import {
  karsilastirmaKur,
  type KarsilastirmaKalemi,
  type KarsilastirmaTeklifi,
} from "@/lib/purchasing/hammadde/karsilastirma";
import { stokMiktari } from "@/lib/purchasing/hammadde/havuz";
import { talepBasligi, teklifMiktari } from "@/lib/purchasing/talep";
import { alimKategorisi } from "@/lib/purchasing/hammadde/alim-analizi";
import { HAMMADDE_SINIFLARI, type HammaddeSinifi } from "@/lib/purchasing/hammadde/siniflar";
import { QuotesView } from "./quotes-view";
import type { PartiOzeti, TalepGorunumu } from "./types";

/**
 * Gruplama künyesini düşürür — ekrana giden `PartiOzeti` `requestId` TAŞIMAZ.
 *
 * Pencere partiyi zaten talebin içinden okuyor; ikinci bir bağ, taşınmış bir
 * partide iki gerçek üretirdi.
 */
function partiKunyesi(p: PartiOzeti & { requestId: string | null }): PartiOzeti {
  const { requestId, ...kalan } = p;
  void requestId;
  return kalan;
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

  const anahtarlar = veri.havuz.satirlar.map((s) => s.key);
  const [defter, siparisler, tedarikciler, tedarikciDefteri, siparisNolari, sonKur, qualities] =
    await Promise.all([
      // KAPSAM DA VERİLİR: havuz anahtarı tutmayan plaka teklifleri ancak
      // böyle görünür. Havuz boşsa bile sorgu koşar — teklif havuzdan
      // BAĞIMSIZ olarak açılmış olabilir.
      loadTeklifDefteri(supabase, anahtarlar, { scope: "hammadde" }),
      loadSiparisler(supabase),
      loadTedarikciler(supabase),
      loadTedarikciDefteri(supabase),
      loadSiparisNolari(supabase),
      loadSonKur(supabase),
      loadQualities(supabase),
    ]);

  /** Stok anahtarı → havuz satırı (miktar, birim, tanım, sınıf). */
  const havuzHaritasi = new Map(veri.havuz.satirlar.map((s) => [s.key, s]));

  /**
   * KALEMİN KÜNYESİ — havuz konuşuyorsa O, susuyorsa TEKLİFİN KENDİSİ.
   *
   * Havuz eşleşmesi ŞART DEĞİLDİR (HAM-24): plaka teklifinin anahtarı havuzda
   * yoktur ve olmamalıdır. Miktar `teklifMiktari` ile tek yerde çözülür —
   * havuzda karşılığı olan kalemde havuz otoriterdir (parçalar değiştikçe o
   * değişir), plakada ise teklifle birlikte donmuş kilo okunur.
   */
  const kalemKunyesi = (t: TeklifSatiri) => {
    const havuzSatiri = havuzHaritasi.get(t.matchKey);
    if (havuzSatiri) {
      const m = stokMiktari(havuzSatiri);
      return {
        tanim: havuzSatiri.tanim,
        sinif: havuzSatiri.sinif as HammaddeSinifi,
        miktar: teklifMiktari(m.miktar, t.qty),
        birim: m.birim,
      };
    }
    const sinif = alimKategorisi(t.sample);
    return {
      tanim: t.sample,
      sinif: (HAMMADDE_SINIFLARI.includes(sinif as HammaddeSinifi)
        ? sinif
        : "DIGER") as HammaddeSinifi,
      miktar: teklifMiktari(null, t.qty),
      // Birim teklifle birlikte saklanıyorsa o; yoksa hammaddede ticari birim
      // kilodur (plaka proformasının birimi).
      birim: t.unit || "Kg",
    };
  };

  // ————————————————————————————————— firma cevapları (parti künyeleri)
  //
  // `requestId` künyeye BURADA eklenir ve gruplamadan sonra düşürülür: ekrana
  // giden `PartiOzeti` onu taşımaz, çünkü pencere partiyi zaten talebin
  // içinden okur ve ikinci bir bağ iki gerçek üretirdi.
  const ozetler: (PartiOzeti & { requestId: string | null })[] = defter.partiler
    .map((p) => {
      const satirlar = p.satirlar
        .filter((t) => tur == null || kalemKunyesi(t).sinif === tur)
        .map((t) => {
          const k = kalemKunyesi(t);
          return {
            quoteId: t.id,
            key: t.matchKey,
            tanim: k.tanim,
            miktar: k.miktar,
            birim: k.birim,
            birimFiyat: t.unitPrice,
            paraBirimi: t.currency,
            kur: t.fxRate,
            birimFiyatEur: t.unitPriceEur,
            tutarEur:
              k.miktar != null && t.unitPriceEur != null ? k.miktar * t.unitPriceEur : null,
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
        miktarsizKalem: satirlar.filter((s) => s.miktar == null).length,
        satirlar,
        requestId: p.requestId,
      };
    })
    // TÜR SÜZGECİ SONRASI BOŞALAN PARTİ LİSTEDEN DÜŞER: "0 kalem" yazan bir
    // satır seçilebilir görünür ama karşılaştırmaya hiçbir şey katmaz.
    .filter((p) => p.kalemSayisi > 0);

  // ————————————————————————————————— talepler (ekranın satırı)
  const talepHaritasi = new Map(defter.talepler.map((t) => [t.id, t]));
  const gruplar = new Map<string, (PartiOzeti & { requestId: string | null })[]>();
  for (const p of ozetler) {
    // TALEBİ OLMAYAN PARTİ KAYBOLMAZ, KENDİ BAŞINA BİR TALEP OLUR: migration
    // uygulanmamış bir ortamda ya da devralınan kayıtta ekran yine çalışır —
    // yalnız birleştirme/ad değiştirme kapalıdır (`gercek: false`).
    const anahtar = p.requestId ?? `parti:${p.id}`;
    const liste = gruplar.get(anahtar);
    if (liste) liste.push(p);
    else gruplar.set(anahtar, [p]);
  }

  const talepler: TalepGorunumu[] = [...gruplar.entries()]
    .map(([anahtar, partiler]) => {
      const talep = talepHaritasi.get(anahtar);
      const sirali = [...partiler].sort(
        (a, b) => a.quotedAt.localeCompare(b.quotedAt) || a.code.localeCompare(b.code, "tr")
      );

      // KARŞILAŞTIRMA YALNIZ AÇIK TEKLİFLERDEN KURULUR: iptal edilmiş bir
      // teklif defterde durur ama yarışa girmez (`loadTeklifler`in kuralı).
      const acikOlanlar = sirali.filter((p) => p.status !== "iptal");
      const kapsam = [...new Set(acikOlanlar.flatMap((p) => p.satirlar.map((s) => s.key)))];
      const kalemKaynagi = new Map(
        acikOlanlar.flatMap((p) => p.satirlar.map((s) => [s.key, s] as const))
      );
      const kalemler: KarsilastirmaKalemi[] = kapsam
        .map((k) => {
          const s = kalemKaynagi.get(k)!;
          return { key: k, tanim: s.tanim, miktar: s.miktar, birim: s.birim };
        })
        .sort((a, b) => a.tanim.localeCompare(b.tanim, "tr"));

      const girdiler: KarsilastirmaTeklifi[] = acikOlanlar.flatMap((p) =>
        p.satirlar.map((s) => ({
          key: s.key,
          // SÜTUN PARTİDİR, TEDARİKÇİ DEĞİL: aynı firmanın iki teklifi iki
          // sütundur ve ancak öyle ayrı ayrı değerlendirilebilir.
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

      const gunler = sirali.map((p) => p.quotedAt).filter(Boolean).sort();
      return {
        id: anahtar,
        code: talep?.code ?? sirali[0]?.code ?? "",
        // AD ÜÇ KAYNAKTAN, SIRAYLA: insanın verdiği ad → talebin türetilmiş
        // adı → kalemlerden anlık türev. Üçüncüsü yalnız talep kaydı olmayan
        // (devralınan) satırda çalışır ve orada bir ad UYDURMAZ, var olan
        // kalem adlarını özetler.
        baslik:
          talep?.title?.trim() ||
          talepBasligi([...new Set(sirali.flatMap((p) => p.satirlar.map((s) => s.tanim)))]),
        gercek: Boolean(talep),
        partiler: sirali.map((p) => partiKunyesi(p)),
        tablo: karsilastirmaKur(kalemler, girdiler),
        kalemSayisi: kapsam.length,
        firmaSayisi: new Set(acikOlanlar.map((p) => p.supplier)).size,
        ilkTarih: gunler[0] ?? "",
        sonTarih: gunler[gunler.length - 1] ?? "",
        tamameniIptal: acikOlanlar.length === 0,
      };
    })
    // EN YENİ ÜSTTE: satınalmacının bugün baktığı teklif dünkü değildir.
    .sort(
      (a, b) => b.sonTarih.localeCompare(a.sonTarih) || b.code.localeCompare(a.code, "tr")
    );

  // ————————————————————————————————— sipariş penceresinin gerektirdikleri
  const siparisAdetleri = new Map<string, number>();
  for (const s of siparisler) {
    for (const l of s.satirlar) {
      siparisAdetleri.set(l.matchKey, (siparisAdetleri.get(l.matchKey) ?? 0) + l.qty);
    }
  }

  const tumAnahtarlar = [
    ...new Set(talepler.flatMap((t) => t.partiler.flatMap((p) => p.satirlar.map((s) => s.key)))),
  ];

  return (
    <QuotesView
      talepler={talepler}
      tur={tur}
      turSayaclari={HAMMADDE_SINIFLARI.map((s) => ({
        tur: s,
        adet: new Set(
          defter.partiler
            .flatMap((p) => p.satirlar)
            .filter((t) => kalemKunyesi(t).sinif === s)
            .map((t) => t.matchKey)
        ).size,
      }))}
      siparisAdetleri={[...siparisAdetleri.entries()]}
      // PAY HARİTASI YALNIZ HAVUZDA KARŞILIĞI OLAN KALEMDE DOLUDUR. Plakanın
      // payı yoktur ve olamaz: bir plaka onlarca parçanın kaynağıdır ve o bağ
      // ancak KESİM PLANI yapılırken bilinir (yerleşim ekranı sipariş açarken
      // onu yazar). Pencere bunu sessizce geçmez, satır altında söyler.
      paylar={Object.fromEntries(
        tumAnahtarlar.map((k) => [
          k,
          (havuzHaritasi.get(k)?.parcalar ?? []).map((p) => ({
            itemNo: p.itemNo,
            packageId: p.packageId,
            partKey: p.partKey,
            adet: p.adet ?? 0,
          })),
        ])
      )}
      tedarikciler={tedarikciler}
      defter={tedarikciDefteri}
      siparisNolari={siparisNolari}
      sonKur={sonKur}
      qualities={qualities}
      canWrite={canEditPurchasing(profil?.role)}
      isAdmin={isAdminRole(profil?.role)}
    />
  );
}
