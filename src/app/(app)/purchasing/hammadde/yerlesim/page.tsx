// SAC PLAKA YERLEŞİMİ — kesim planı.
//
// Kullanıcı kararı (15.08.2026): *"Kullanıcı sacları listeleyecek, filtreleyerek
// veya seçerek, sonra tuşa basacak, sistem … sac plakasına bunları
// yerleştirecek."*
//
// ═══════════════════════════════════════════ NEDEN SUNUCUDA HESAPLANIYOR
//
// Yerleşim SAF ve DETERMİNİSTİKtir: aynı seçim + aynı plaka + aynı pay her
// zaman aynı planı verir. Bu yüzden PLAN SAKLANMAZ — parametreler adreste
// taşınır ve her açılışta yeniden hesaplanır. Bir tabloya konsaydı parçalar
// değiştiğinde sessizce eskirdi ve atölye eski plana bakarak keserdi.
//
// Hesabın sunucuda olması iki şey kazandırır: sayfa paylaşılabilir bir
// bağlantıdır (foreman'a gönderilir) ve 1800 parçalık bir seçim tarayıcı
// iş parçacığını kilitlemez.

import { createClient } from "@/lib/supabase/server";
import { loadHammaddeHavuzu } from "../data";
import {
  loadQualities,
  loadSiparisNolari,
  loadSonKur,
  loadTedarikciDefteri,
  loadTedarikciler,
} from "../../data";
import { canEditPurchasing } from "@/lib/roles";
import {
  enIyiPlakaSecimi,
  sacYerlesimi,
  yerlesimDenetimi,
  type YerlesimParcasi,
  type YerlesimSonucu,
} from "@/lib/purchasing/hammadde/nesting";
import {
  KESIM_PAYLARI,
  PLAKA_BOYLARI,
  PLAKA_ENLERI,
  VARSAYILAN_KESIM_PAYI,
} from "@/lib/purchasing/hammadde/siniflar";
import { NestingView, type YerlesimGrubu } from "./nesting-view";

function tekil(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function YerlesimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const veri = await loadHammaddeHavuzu(supabase);

  const tumSac = veri.havuz.satirlar.filter((s) => s.sinif === "SAC");

  // ————————————————————————————————— iş süzgeci
  //
  // Kullanıcı isteği (15.08.2026): *"Plaka yerleşiminde hammadde havuzundaki
  // gibi iş seçme satır seçme özellikleri olsun. Çünkü her zaman hepsini
  // kesmeyebiliriz, bazılarını erteleyebiliriz."*
  //
  // Süzgeç LİSTEYİ daraltır, SEÇİMİ değil: bir iş seçilince kalem listesi o
  // işin kalemlerine iner ama seçili kalanlar seçili kalır — kullanıcı iki işi
  // arka arkaya süzüp ikisinden de kalem toplayabilmelidir.
  const isHam = sp.is;
  const isSuzgeci = new Set(Array.isArray(isHam) ? isHam : isHam ? [isHam] : []);
  const isSecenekleri = [
    ...new Map(
      tumSac
        .flatMap((s) => s.paylar)
        .filter((x) => x.jobNo)
        .map((x) => [x.jobNo, x.jobTitle || x.customer || ""])
    ).entries(),
  ]
    .sort((a, b) => b[0].localeCompare(a[0], "tr"))
    .map(([jobNo, baslik]) => ({
      value: jobNo,
      label: baslik ? `${jobNo} · ${baslik}` : jobNo,
      count: tumSac.filter((s) => s.paylar.some((x) => x.jobNo === jobNo)).length,
    }));

  const sacSatirlari =
    isSuzgeci.size === 0
      ? tumSac
      : tumSac.filter((s) => s.paylar.some((x) => isSuzgeci.has(x.jobNo)));

  const kHam = sp.k;
  const secilenler = new Set(Array.isArray(kHam) ? kHam : kHam ? [kHam] : []);
  // SEÇİM YOKSA HİÇBİR ŞEY YERLEŞTİRİLMEZ. "Hepsini yerleştir" varsayılanı
  // yirmi altı ayrı kalınlık için yüzlerce plaka üretir ve ekranı kullanılamaz
  // yapardı; kullanıcı ne yerleştireceğini SÖYLER.
  // SEÇİM SÜZGEÇTEN BAĞIMSIZDIR: süzgeç görünen listeyi daraltır, plan
  // seçilen HER kalemi kapsar. Aksi hâlde iş süzgecini değiştiren kullanıcı,
  // farkında olmadan yarım bir kesim planı basardı.
  const secili = tumSac.filter((s) => secilenler.has(s.key));

  const payHam = Number.parseInt(tekil(sp.pay), 10);
  const pay = (KESIM_PAYLARI as readonly number[]).includes(payHam)
    ? payHam
    : VARSAYILAN_KESIM_PAYI;

  const enHam = Number.parseInt(tekil(sp.en), 10);
  const en = (PLAKA_ENLERI as readonly number[]).includes(enHam) ? enHam : null;
  const boyHam = Number.parseInt(tekil(sp.boy), 10);
  const boy = (PLAKA_BOYLARI as readonly number[]).includes(boyHam) ? boyHam : null;
  const dondur = tekil(sp.dondur) !== "0";

  const adaylar = PLAKA_ENLERI.flatMap((e) => PLAKA_BOYLARI.map((b) => ({ enMm: e, boyMm: b })));

  const gruplar: YerlesimGrubu[] = secili.map((satir) => {
    // Parçalar KESİM LİSTESİNDEN gelir: aynı ölçüdeki parçalar tek satırda
    // toplanır ve adet olarak açılır — yerleşim çekirdeği kopyaları kendisi
    // üretir.
    const parcalar: YerlesimParcasi[] = [];
    let olcusuz = 0;
    for (const p of satir.parcalar) {
      if (p.enMm == null || p.boyMm == null || !p.adet || p.adet <= 0) {
        olcusuz++;
        continue;
      }
      parcalar.push({
        id: p.partKey || p.tanim,
        ad: p.tanim,
        enMm: p.enMm,
        boyMm: p.boyMm,
        adet: p.adet,
      });
    }

    const kalinlik = satir.parcalar.find((p) => p.kalinlikMm != null)?.kalinlikMm ?? null;
    const ayar = { payMm: pay, dondur, kalinlikMm: kalinlik };

    let sonuc: YerlesimSonucu | null = null;
    let hata = "";
    if (parcalar.length > 0) {
      try {
        sonuc =
          en && boy
            ? sacYerlesimi(parcalar, { enMm: en, boyMm: boy }, ayar)
            : enIyiPlakaSecimi(parcalar, adaylar, ayar);
      } catch (e) {
        hata = e instanceof Error ? e.message : "Yerleşim hesaplanamadı.";
      }
    }

    return {
      key: satir.key,
      tanim: satir.tanim,
      kalite: satir.kalite,
      kalinlikMm: kalinlik,
      olcusuzParca: olcusuz,
      hata,
      sonuc,
      // DENETİM SUNUCUDA KOŞAR: plan da orada üretiliyor ve iki taraf aynı
      // nesneyi görmeli. İstemcide yeniden koşturmak, ekrandaki plan ile
      // denetlenen planın ayrışabilmesi demekti.
      denetim: sonuc ? yerlesimDenetimi(parcalar, sonuc) : [],
      paylar: satir.parcalar.map((p) => ({
        itemNo: p.itemNo,
        packageId: p.packageId,
        partKey: p.partKey,
        adet: p.adet ?? 0,
      })),
    };
  });

  // SİPARİŞ PENCERESİ EKİPMAN TARAFIYLA ORTAKTIR: bir sac plakası da bir
  // rulman gibi sipariş edilir ve aynı `match_key` uzayında yaşar.
  const [{ data: kullanici }] = await Promise.all([supabase.auth.getUser()]);
  const { data: profil } = kullanici.user
    ? await supabase.from("profiles").select("role").eq("id", kullanici.user.id).maybeSingle()
    : { data: null };
  const [tedarikciler, defterKaydi, siparisNolari, sonKur, qualities] = await Promise.all([
    loadTedarikciler(supabase),
    loadTedarikciDefteri(supabase),
    loadSiparisNolari(supabase),
    loadSonKur(supabase),
    loadQualities(supabase),
  ]);

  return (
    <NestingView
      tumSaclar={sacSatirlari.map((s) => ({
        key: s.key,
        tanim: s.tanim,
        parcaAdedi: s.parcaAdedi,
        agirlikKg: s.toplamAgirlikKg,
        isler: [...new Set(s.paylar.map((x) => x.jobNo).filter(Boolean))],
      }))}
      isSecenekleri={isSecenekleri}
      isSecili={[...isSuzgeci]}
      secili={[...secilenler]}
      pay={pay}
      en={en}
      boy={boy}
      dondur={dondur}
      gruplar={gruplar}
      tedarikciler={tedarikciler}
      defter={defterKaydi}
      siparisNolari={siparisNolari}
      sonKur={sonKur}
      qualities={qualities}
      canWrite={canEditPurchasing(profil?.role)}
    />
  );
}
