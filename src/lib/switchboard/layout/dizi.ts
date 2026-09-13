// DİZİ ÇÖZÜMÜ — ortak yükseklik/derinlik seçimi, bölme, harfleme (PANO-2 · PANO-9 · PANO-33 · PANO-41).

import { ROOM_GRID, type LineupGrid, ceilToGrid } from "../sizes";
import type { LayoutSettings, LineupPrefs, PanelLayout, Unplaced } from "../types";
import { bolerekCoz, type PanelInput, type PanelSolve } from "./coz";

export interface SolveAllInput {
  panels: PanelInput[];
  settings: LayoutSettings;
  /**
   * BU DİZİNİN sipariş tercihleri (`settings.room` ya da `settings.field`).
   *
   * Çözücü hangi diziyi çözdüğünü BİLMEZ ve bilmemelidir — çağıran söyler.
   * Tercihi `settings` içinden kendisi seçseydi, "oda mı saha mı" sorusu iki
   * ayrı yerde cevaplanır ve bir gün ayrışırdı.
   */
  prefs: LineupPrefs;
  /**
   * BU DİZİNİN gövde ızgarası (`ROOM_GRID` ya da `FIELD_GRID`, PANO-33).
   *
   * `prefs` ile aynı gerekçeyle çağıran verir: çözücü oda mı saha mı çözdüğünü
   * bilmez. Verilmezse oda ızgarası kullanılır — mevcut çağıranlar ve testler
   * bozulmasın diye.
   */
  izgara?: LineupGrid;
}

export interface SolveAllResult {
  layouts: PanelLayout[];
  unplaced: Unplaced[];
  /**
   * Dizinin ortak yüksekliği; ORTAK DEĞİLSE en yüksek gövdeninki.
   *
   * `sharedHeight` false iken bu sayı tek başına bir sipariş kararı DEĞİLDİR —
   * ekran ve çıktı "kutu başına" yazar. Tek bir sayı basmak, alınmamış bir
   * ortak kararı bildirmek olurdu.
   */
  heightMm: number;
  depthMm: number;
  /** Gözler ortak yükseklik paylaşıyor mu (`LineupGrid.sharedHeight`)? */
  sharedHeight: boolean;
}

/**
 * VERİLEN PANO KÜMESİ İÇİN ORTAK BİR BOY SEÇER ve sığmayanları böler.
 *
 * Ortak yükseklik isteyen dizide (oda) bütün panolarla BİR KEZ, kutu başına
 * ölçü isteyen dizide (saha) her pano için AYRI çağrılır — ikinci durumda
 * "küme" tek elemanlıdır ve dolayısıyla "ortak boy" o kutunun kendi boyudur.
 */
function yukseklikSec(
  panels: PanelInput[],
  s: LayoutSettings,
  tercih: LineupPrefs,
  izgara: LineupGrid
): { h: number; girdiler: PanelInput[]; cozumler: PanelSolve[] } {
  // PANO BAŞINA KİLİTLİ YÜKSEKLİK DİZİYİ BAĞLAR (PANO-2): ortak yükseklik
  // zorunlu olduğu için kilitli en büyük değer dizinin tabanıdır. Bunu yok
  // saymak, ekranda "kilitledim" diyen bir seçimi sessizce ezerdi.
  //
  // ORTAK YÜKSEKLİK YOKSA (saha) bu işlev pano BAŞINA çağrılır ve "dizi"
  // tek gözdür; kilit yalnız kendi kutusunu bağlar.
  const kilitliYukseklikler = panels
    .map((p) => (p.override?.heightLocked ? p.override.heightMm : null))
    .filter((v): v is number => typeof v === "number" && v > 0);
  const yukseklikTabani = kilitliYukseklikler.length ? Math.max(...kilitliYukseklikler) : 0;

  // ORTAK BOY VARKEN KİLİT BİR TABANDIR, TEK KUTUDA İSE KİLİTTİR.
  //
  // Dizide bütün gözler aynı boyu paylaşmak zorunda olduğu için bir panonun
  // kilidi ancak "bundan alçak olamaz" diyebilir. Ortak boy yokken böyle bir
  // zorunluluk yoktur: kullanıcı o kutuyu 600 mm istediyse 600 mm alır, arama
  // onu 1400'e çıkarmaz — ekranda "kilitledim" diyen bir seçimi ezmek, bu
  // modülün baştan beri kaçındığı şeydir.
  const yukseklikAdaylari = tercih.heightMm
    ? [tercih.heightMm]
    : !izgara.sharedHeight && yukseklikTabani > 0
      ? [yukseklikTabani]
      : [...izgara.heights].filter((h) => h >= yukseklikTabani);

  // ═══════════════════════════════════════ TEK KUTU: EN KÜÇÜK ÖN YÜZ
  //
  // Ortak boy YOKSA (saha) kutu bir DİZİNİN GÖZÜ değil, tek başına sipariş
  // edilen bir üründür; o yüzden ölçüt de değişir. Diziyi çözerken önce boy
  // küçültülür çünkü boy bütün gözlerde ortaktır; tek kutuda böyle bir
  // ortaklık yoktur ve "önce en alçağı" ölçütü ölçüldüğü gibi ters teper:
  // 0019'un `TB3`ü 500 mm boy uğruna 800 mm'ye genişliyordu (0,40 m²), oysa
  // 400 x 600 (0,24 m²) aynı üç cihazı alıyor ve duvara asılan bir kutuda
  // asıl sıkıntı olan GENİŞLİK yarıya iniyor.
  //
  // Bu yüzden burada bütün boylar denenir ve ÖN YÜZ ALANI en küçük olan
  // seçilir; eşitlikte alçak olan kazanır. "Rahat" şartı (bölünmemiş + doluluk
  // payı korunmuş) hâlâ önceliklidir — hiçbir aday rahat değilse sığanların
  // en küçüğü alınır.
  if (!izgara.sharedHeight) {
    type Aday = {
      h: number;
      girdiler: PanelInput[];
      cozumler: PanelSolve[];
      sigmayan: number;
      rahat: boolean;
      alan: number;
    };
    const adaylar: Aday[] = [];
    for (const h of yukseklikAdaylari) {
      const deneme = bolerekCoz(panels, h, s, tercih, izgara);
      const sigmayan = deneme.cozumler.filter((c) => !c.fits).length;
      const bolundu = deneme.girdiler.length > panels.length;
      const enDoluOran = deneme.cozumler.reduce((m, c) => Math.max(m, c.heightFill), 0);
      adaylar.push({
        h,
        girdiler: deneme.girdiler,
        cozumler: deneme.cozumler,
        sigmayan,
        rahat: !bolundu && enDoluOran <= s.fillWarnRatio,
        alan: deneme.cozumler.reduce((t, c) => t + c.layout.widthMm * h, 0),
      });
    }

    const kucukten = (a: Aday, b: Aday) => a.alan - b.alan || a.h - b.h;
    const sigan = adaylar.filter((a) => a.sigmayan === 0);
    const en =
      [...sigan.filter((a) => a.rahat)].sort(kucukten)[0] ??
      [...sigan].sort(kucukten)[0] ??
      // Hiçbir boy sığdıramıyorsa en az pano bırakan seçilir ki ekran yine de
      // bir şey gösterebilsin (`enIyiPlakaSecimi` ile aynı ilke).
      [...adaylar].sort((a, b) => a.sigmayan - b.sigmayan || kucukten(a, b))[0];

    return { h: en.h, girdiler: en.girdiler, cozumler: en.cozumler };
  }

  // ═══════════════════════════════════════════ YÜKSEKLİK NASIL SEÇİLİR
  //
  // Adaylar KÜÇÜKTEN BÜYÜĞE denenir ama 1800'ün ALTI bir eşiğe bağlıdır
  // (kullanıcı kararı, 06.09.2026): küçük bir işte 1400 yeterliyse 1400
  // seçilir, gereksiz büyük gövde alınmaz; ama sıkışan bir iş küçük gövdeye
  // TIKIŞTIRILMAZ. Üç şart birlikte aranır ve biri eksikse bir üst boya
  // geçilir:
  //
  //   1. Bütün panolar sığmalı.
  //   2. Doluluk payı korunmalı (`fillWarnRatio`, öntanım %80) — dolu bir
  //      panonun ilave yeri kalmaz ve bir sonraki revizyonda gövde değişir.
  //   3. HİÇBİR PANO BÖLÜNMEMELİ. Bu şart olmasaydı 1400, panoyu ikiye ayırıp
  //      "sığdı" derdi: yükseklikten kazanılan, EN'den iki kat geri verilirdi.
  //
  // 1800 ve üstünde eşik aranmaz; oraya zaten sığmadığı için çıkılır.
  let secilen: { h: number; girdiler: PanelInput[]; cozumler: PanelSolve[] } | null = null;

  for (const h of yukseklikAdaylari) {
    const deneme = bolerekCoz(panels, h, s, tercih, izgara);
    const sigmayan = deneme.cozumler.filter((c) => !c.fits).length;

    if (sigmayan === 0) {
      const bolundu = deneme.girdiler.length > panels.length;
      const enDoluOran = deneme.cozumler.reduce((m, c) => Math.max(m, c.heightFill), 0);
      const rahat = !bolundu && enDoluOran <= s.fillWarnRatio;

      // Eşik ızgaradan gelir; `null` ise yalnız "rahat" sorulur. Kullanıcı bir
      // yükseklik verdiyse aday tektir ve eşik aranmaz.
      const esikGecildi =
        izgara.preferredHeightMm !== null && h >= izgara.preferredHeightMm;
      if (esikGecildi || rahat || yukseklikAdaylari.length === 1) {
        secilen = { h, girdiler: deneme.girdiler, cozumler: deneme.cozumler };
        break;
      }
      // Sığdı ama rahat değil: daha büyük gövdeye bak. Yine de elde tut —
      // hiçbir aday rahat çıkmazsa bu, sığan tek çözüm olarak kalabilir.
      if (!secilen) secilen = { h, girdiler: deneme.girdiler, cozumler: deneme.cozumler };
      continue;
    }

    // HİÇBİR YÜKSEKLİK SIĞDIRAMIYORSA en az pano bırakan seçilir ki ekran yine
    // de bir şey gösterebilsin (`enIyiPlakaSecimi` ile aynı ilke).
    //
    // EŞİTLİKTE BÜYÜK BOY KAZANIR (PANO-41). Ölçüldü (0026, 12.09.2026): eni
    // 1200'e kilitli pano hiçbir boyda sığmıyordu ve `<` kıyası ilk adayı
    // (1400) tutuyordu — 2000'de 1760/1850 ile sığan pano ekranda 1400'de
    // 2313/1250 taşıyor görünüyordu. Sığmayan sayısı eşitse daha yüksek
    // gövde daha az taşırır; onu göstermek doğrudur.
    const oncekiSigmayan = secilen
      ? secilen.cozumler.filter((c) => !c.fits).length
      : Number.POSITIVE_INFINITY;
    if (oncekiSigmayan > 0 && sigmayan <= oncekiSigmayan) {
      secilen = { h, girdiler: deneme.girdiler, cozumler: deneme.cozumler };
    }
  }

  return secilen as { h: number; girdiler: PanelInput[]; cozumler: PanelSolve[] };
}

/**
 * BİR DİZİYİ çözer: ortak derinlik ve (ızgara istiyorsa) ortak yükseklik
 * burada belirlenir.
 *
 * Yükseklik adayları KÜÇÜKTEN BÜYÜĞE denenir ama 1800'ün altı bir eşiğe
 * bağlıdır (kullanıcı kararı, 06.09.2026) — ayrıntı `yukseklikSec` içinde.
 *
 * ORTAK YÜKSEKLİK IZGARAYA BAĞLIDIR (PANO-33). Odada gövdeler yan yana dizilir
 * ve üstleri hizalıdır; sahada her kutu ayrı bir duvara asılır ve ortak boy
 * dayatmak, ölçüldüğü gibi, 220 mm ray taşıyan bir kutuyu 1400 mm yaptırıyordu.
 *
 * ORTAK DERİNLİK HER İKİ DİZİDE DE KORUNUR (PANO-2): kullanıcıya sorulan
 * yalnız yükseklikti.
 *
 * PANO BAŞINA KİLİTLİ ÖLÇÜ, ORTAK OLAN NEYSE ONU BAĞLAR: kullanıcı bir panoyu
 * 600 mm derin istediyse dizideki hiçbir pano ondan sığ olamaz.
 */
export function solveLineup(input: SolveAllInput): SolveAllResult {
  const s = input.settings;
  const tercih = input.prefs;
  const izgara = input.izgara ?? ROOM_GRID;
  if (input.panels.length === 0) {
    return {
      layouts: [],
      unplaced: [],
      heightMm: tercih.heightMm ?? izgara.heights[0],
      depthMm: tercih.depthMm ?? izgara.depths[0],
      sharedHeight: izgara.sharedHeight,
    };
  }

  // HER KUTU KENDİ ÖLÇÜSÜNDE (kullanıcı kararı, 09.09.2026): ortak yükseklik
  // istenmiyorsa her pano TEK GÖZLÜ BİR DİZİ olarak çözülür ve sonuçlar
  // birleştirilir. Bölme, harfleme, boş göz düşürme ve ortak derinlik aşağıda
  // olduğu gibi çalışmaya devam eder — ayrı bir arama kodu YAZILMAZ.
  const secimler = izgara.sharedHeight
    ? [yukseklikSec(input.panels, s, tercih, izgara)]
    : input.panels.map((pano) => yukseklikSec([pano], s, tercih, izgara));

  const secilenYukseklik = Math.max(...secimler.map((x) => x.h));
  const tumGirdiler = secimler.flatMap((x) => x.girdiler);
  const tumCozumler = secimler.flatMap((x) => x.cozumler);

  // BOŞ GÖZ SİPARİŞ EDİLMEZ.
  //
  // Ölçüldü (0019, 08.09.2026): bölme aygıt listesini ikiye ayırır ama bir
  // yarının bütün aygıtları PANO DIŞI (saha) çıkabilir — motor, enkoder, limit
  // şalteri. Geriye plakasında, kapağında ve gövdesinde hiçbir şey olmayan bir
  // gövde kalıyordu; gerçek belgede DÖRT böyle göz vardı ve her biri
  // 400 x 2000 x 600 mm'lik bir pano olarak imalatçıya gidiyordu.
  //
  // Aygıtları KAYBOLMAZ: saha aygıtları zaten `solvePanel` içinde kuyruğa
  // düşüyor ve o kuyruk aşağıda bütün çözümlerden toplanıyor.
  const doluMu = (c: PanelSolve): boolean =>
    c.layout.placements.length > 0 ||
    c.layout.doorPlacements.length > 0 ||
    c.layout.bodyDevices.length > 0 ||
    c.layout.sideDevices.length > 0;

  const tutulan = tumCozumler.map((c, i) => ({ c, g: tumGirdiler[i] })).filter((x) => doluMu(x.c));
  const girdiler = tutulan.map((x) => x.g);
  const cozumler = tutulan.map((x) => x.c);

  // BÖLÜNMÜŞ GÖZ SIRAYLA HARFLENİR. Özyineleme `LVD10-B-A-A` gibi adlar
  // üretiyordu; o ad kaç turda bölündüğünü anlatır ama panonun üstüne
  // yapıştırılacak etiket odur ve elektrikçi onu okuyamaz. Kaynak panonun
  // gözleri soldan sağa `-A`, `-B`, `-C` olur; bölünmemiş pano adını korur.
  const kaynakKodlari = [...new Set(input.panels.map((p) => p.code))];
  const kaynakKodu = new Map<string, string>();
  const sonKod = new Map<string, string>();
  const sayac = new Map<string, number>();

  for (const g of girdiler) {
    if (kaynakKodlari.includes(g.code)) {
      sonKod.set(g.code, g.code);
      continue;
    }
    // En UZUN eşleşen kaynak seçilir: `LVD1` ve `LVD10` birlikte varken
    // `LVD10-A` yanlışlıkla `LVD1`in gözü sayılmamalı.
    let kaynak = "";
    for (const kod of kaynakKodlari) {
      if (g.code.startsWith(`${kod}-`) && kod.length > kaynak.length) kaynak = kod;
    }
    if (!kaynak) {
      sonKod.set(g.code, g.code);
      continue;
    }
    const n = (sayac.get(kaynak) ?? 0) + 1;
    sayac.set(kaynak, n);
    const harf = String.fromCharCode(64 + n); // 1 → A
    const yeniKod = `${kaynak}-${harf}`;
    sonKod.set(g.code, yeniKod);
    kaynakKodu.set(yeniKod, kaynak);
  }

  // ORTAK DERİNLİK: en derin panonunki hepsine yazılır (PANO-2).
  //
  // PANO BAŞINA KİLİTLİ DERİNLİK DE BİR TABANDIR: kullanıcı bir panoyu 600 mm
  // istediyse dizideki hiçbir pano ondan sığ olamaz. Kilidi yok saymak, ekranda
  // yapılan bir seçimi sessizce ezerdi.
  const kilitliDerinlikler = girdiler
    .map((g) => (g.override?.depthLocked ? g.override.depthMm : null))
    .filter((v): v is number => typeof v === "number" && v > 0);
  const gerekli = Math.max(
    cozumler.reduce((m, c) => Math.max(m, c.layout.requiredDepthMm), 0),
    ...(kilitliDerinlikler.length ? kilitliDerinlikler : [0])
  );
  const ortakDerinlik =
    tercih.depthMm ??
    ceilToGrid(gerekli, izgara.depths) ??
    izgara.depths[izgara.depths.length - 1];

  const layouts = cozumler.map((c) => {
    const kod = sonKod.get(c.layout.code) ?? c.layout.code;
    const kaynak = kaynakKodu.get(kod) ?? null;
    const uyarilar = [...c.layout.warnings];
    if (kaynak) uyarilar.unshift(`${kaynak} tek gövdeye sığmadı; birden çok göze ayrıldı.`);

    // ÖLÇÜSÜ OLMAYAN CİHAZ VARSA GÖVDE ÖLÇÜSÜ EKSİK HESAPLANMIŞTIR ve bunu
    // söylemek zorunludur: sürücüsü ölçülmemiş bir pano 250 mm derinlik
    // gösterir ve o panoyu sipariş etmek sahada 400 mm eksik bırakırdı.
    const olcusuz = c.unplaced.filter((u) => u.reason === "olcusuz").length;
    if (olcusuz > 0) {
      uyarilar.push(
        `${olcusuz} cihazın ölçüsü bilinmiyor; en ve derinlik EKSİK hesaplandı.`
      );
    }

    return {
      ...c.layout,
      code: kod,
      name: kaynak ? `${kaynak} (${kod.slice(kaynak.length + 1)})` : c.layout.name,
      depthMm: ortakDerinlik,
      splitOf: kaynak,
      warnings: uyarilar,
    } satisfies PanelLayout;
  });

  // KUYRUK BÜTÜN ÇÖZÜMLERDEN TOPLANIR, yalnız tutulanlardan değil: boş göz
  // düşürülse de içindeki saha aygıtları kullanıcıya görünmeye devam eder.
  const unplaced = tumCozumler.flatMap((c) => c.unplaced);
  return {
    layouts,
    unplaced,
    heightMm: secilenYukseklik,
    depthMm: ortakDerinlik,
    sharedHeight: izgara.sharedHeight,
  };
}
