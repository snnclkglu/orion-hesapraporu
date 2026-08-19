// KESİM PLANI PDF'i — atölyeye giden yerleşim belgesi.
//
// ═══════════════════════════════════════════ NEDEN AYRI BİR BELGE
//
// Talep PDF'i (`purchase-request.tsx`) tedarikçiye gider ve FİYATSIZDIR; kesim
// planı ATÖLYEYE gider ve fiyat orada zaten aranmaz. İkisinin okuyucusu, kâğıt
// yönü ve içeriği farklıdır: plan YATAY basılır çünkü 12 m'lik bir plaka dikey
// A4'e sığdırıldığında parça numaraları okunmaz olur.
//
// ÇİZİM `lib/diagrams` MODELİNDEN GELİR — ekranla AYNI model. İki ayrı çizici
// yazılsaydı kâğıttaki plan ile ekrandaki plan bir gün ayrışırdı ve o fark
// yanlış kesilmiş bir sac demektir.
//
// DENETİM ÖZETİ BELGEYE BASILIR: kâğıda bakan kişi ekranı görmüyor ve planın
// kontrol edilip edilmediğini oradan öğrenemez.

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { PdfDiagram } from "./diagram";
import { parcaNumaralari, yerlesimDiyagrami } from "@/lib/diagrams/nesting";
import type { DenetimSonucu, YerlesimSonucu } from "@/lib/purchasing/hammadde/nesting";
import { plakaAgirligiKg } from "@/lib/purchasing/hammadde/siniflar";
// `brand.tsx` içe aktarıldığı anda fontları kaydeder (modül yan etkisi).
import { BRAND, BRAND_LOGO, FONTS, LOGO_RATIO, type CompanyInfo } from "./brand";

/**
 * FONT AİLESİ ADI `brand.tsx`TEN OKUNUR, ELLE YAZILMAZ.
 *
 * Kullanıcı bildirimi (15.08.2026): *"Kesim planı pdf açılmıyor."* Sebep tek
 * bir dizgeydi: stiller `fontFamily: "IBMPlexMono"` diyordu ama `brand.tsx` o
 * aileyi **`PlexMono`** adıyla kaydediyor. @react-pdf tanımadığı aileyi
 * sessizce yedeklemez, ATAR (`Font family not registered`) — yani belge hiç
 * üretilmiyor, uç 500 dönüyordu ve kullanıcı yalnız "açılmıyor" görüyordu.
 * Ad artık `FONTS` sözlüğünden gelir: aile adı değişirse burası kendiliğinden
 * uyar ve DejaVu yedeği de (Ø, Türkçe harfler) birlikte gelir. Koruma
 * `npx tsx scripts/test-nesting-plan.ts` ile ölçülür.
 */
/** A4 yatay: 842 × 595 pt. Sayfa kenar boşluğu tek yerde. */
const SAYFA_EN = 842;
const SAYFA_BOY = 595;
const KENAR = 28;
/** Antet ve altbilgi HER SAYFADA sabittir; içerik onların arasında akar. */
const ANTET_BOY = 42;
const ALTBILGI_BOY = 30;
/** İçerik alanının ölçüleri — çizim ölçeği bunlara kelepçelenir. */
const ICERIK_EN = SAYFA_EN - 2 * KENAR;
const ICERIK_BOY = SAYFA_BOY - 2 * KENAR - ANTET_BOY - ALTBILGI_BOY;

const S = StyleSheet.create({
  page: {
    paddingTop: KENAR,
    paddingBottom: KENAR + ALTBILGI_BOY,
    paddingHorizontal: KENAR,
    fontSize: 8.5,
    fontFamily: FONTS.sans,
    color: BRAND.ink,
  },

  // ————————————————————————————————————————————————————————— ANTET
  antet: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderBottomWidth: 1.2,
    borderBottomColor: BRAND.ink,
    paddingBottom: 5,
    marginBottom: 8,
    height: ANTET_BOY,
  },
  antetSol: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  antetBaslik: { fontSize: 12, fontFamily: FONTS.sans, fontWeight: 700, letterSpacing: -0.2 },
  antetKunye: { fontSize: 7, color: BRAND.gray600, marginTop: 1.5 },
  antetSag: { alignItems: "flex-end" },
  antetKod: { fontFamily: FONTS.mono, fontSize: 8, fontWeight: 600, color: BRAND.gray700 },
  antetGun: { fontFamily: FONTS.mono, fontSize: 7, color: BRAND.gray500, marginTop: 1.5 },

  // ———————————————————————————————————————————————————————— ALTBİLGİ
  altbilgi: {
    position: "absolute",
    left: KENAR,
    right: KENAR,
    bottom: KENAR - 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 0.5,
    borderTopColor: BRAND.line300,
    paddingTop: 4,
  },
  altbilgiMetin: { fontSize: 6.5, color: BRAND.gray500 },
  altbilgiMono: { fontFamily: FONTS.mono, fontSize: 6.5, color: BRAND.gray500 },

  // ————————————————————————————————————————————————————————— GÖVDE
  h2: { fontSize: 9.5, fontFamily: FONTS.sans, fontWeight: 700, marginBottom: 3 },
  bolumBaslik: { fontSize: 7, fontFamily: FONTS.mono, fontWeight: 600, letterSpacing: 1, color: BRAND.red, marginBottom: 3 },
  serit: { flexDirection: "row", gap: 18, marginBottom: 8 },
  kutu: { flexDirection: "column" },
  kutuBaslik: { fontSize: 6.5, color: BRAND.gray500, letterSpacing: 0.6 },
  kutuDeger: { fontSize: 10, fontFamily: FONTS.mono },
  satir: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: BRAND.line300 },
  baslikSatir: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.ink,
    paddingBottom: 2,
  },
  hucre: { paddingVertical: 2.5, paddingRight: 6, fontSize: 8 },
  mono: { fontFamily: FONTS.mono },
  denetim: { fontSize: 7.5, marginBottom: 1.5 },
  uyari: { color: BRAND.red },
  grupBasi: { marginTop: 12, marginBottom: 2 },
  plakaKutusu: { marginTop: 6, alignItems: "center" },
});

export interface KesimPlaniGrubu {
  tanim: string;
  kalite: string;
  kalinlikMm: number | null;
  sonuc: YerlesimSonucu;
  denetim: DenetimSonucu[];
  olcusuzParca: number;
}

export interface KesimPlaniProps {
  gruplar: KesimPlaniGrubu[];
  meta: { docCode: string; generatedAt: string; preparedBy: string; scopeText: string };
  company: CompanyInfo;
}

function say(v: number | null | undefined, hane = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("tr-TR", { minimumFractionDigits: hane, maximumFractionDigits: hane });
}

// ÇEVİRİCİ VE ÇİZİM KABI ORTAKTIR (`pdf/diagram.tsx`).
//
// Burada bir kopyası vardı ve yorumu "report.tsx'teki çevirinin aynısı"
// diyordu — ama aynı DEĞİLDİ: `circle` dalı hiç yoktu, yani bu belgeye
// düşecek her daire (grafik çalışma noktası, halat kesiti) sessizce
// kayboluyordu; `bold` ve çizgi ucu da yok sayılıyordu. Çizim modelinin tek
// bir çevirisi olur.
//
// İKİ YÖNDEN KELEPÇE (kullanıcı bildirimi, 15.08.2026: *"yerleşim ve antet
// doğru değil"*) ortak bileşene taşındı: yalnız genişlik verilirse kareye
// yakın bir plaka çizimi A4 yatayın iç yüksekliğini (495 pt) aşıyor,
// `wrap={false}` kutusu bir sonraki yaprağa atlayıp orada da taşıyordu.
// `PdfDiagram` artık `maxHeight` de alır ve `min(en, boy ÷ oran)` uygular.

/**
 * ANTET HER SAYFADA TEKRAR EDER (`fixed`).
 *
 * Kullanıcı bildirimi (15.08.2026): *"yerleşim ve antet doğru değil."* Belge
 * beş sayfaydı ve YALNIZ İLK SAYFADA marka bandı vardı; ikinci sayfadan sonra
 * kâğıtta ne belge adı, ne doküman kodu, ne sayfa numarası kalıyordu. Kesim
 * planı atölyeye kâğıtla gider, tezgâhta yaprakları dağılır ve kimliksiz bir
 * yaprak hangi işin hangi plakası olduğunu söyleyemez.
 *
 * Antet bu yüzden `BrandBand` DEĞİLDİR: o bileşen A4 DİKEY bir kapak bandıdır
 * (logo solda, kod sağda, aralarında 800 pt boşluk kalıyordu). Buradaki antet
 * bir teknik resim antedi gibi çalışır — kimlik, belge adı, kapsam, kod, gün
 * ve sayfa numarası tek bir şeritte.
 */
function Antet({ meta }: { meta: KesimPlaniProps["meta"] }) {
  return (
    <View style={S.antet} fixed>
      <View style={S.antetSol}>
        <Image style={{ width: 96, height: 96 * LOGO_RATIO }} src={BRAND_LOGO} />
        <View>
          <Text style={S.antetBaslik}>SAC KESİM PLANI</Text>
          <Text style={S.antetKunye}>
            {meta.scopeText}
            {meta.preparedBy ? ` · Hazırlayan: ${meta.preparedBy}` : ""}
          </Text>
        </View>
      </View>
      <View style={S.antetSag}>
        <Text style={S.antetKod}>{meta.docCode}</Text>
        <Text
          style={S.antetGun}
          render={({ pageNumber, totalPages }) =>
            `${meta.generatedAt} · Sayfa ${pageNumber} / ${totalPages}`
          }
        />
      </View>
    </View>
  );
}

/**
 * ALTBİLGİ HER SAYFADA — firma künyesi + belge kimliği.
 *
 * `CompanyBlock` KULLANILMAZ: o blok akışın SONUNA basılan bir imzadır ve beş
 * sayfalık bir belgede yalnız son yaprağın ortasında görünüyordu. Burada künye
 * sabit bir altbilgidir ve her yaprakta durur.
 */
function Altbilgi({
  company,
  docCode,
}: {
  company: CompanyInfo;
  docCode: string;
}) {
  const iletisim = [company.phone, company.email, company.web].filter(Boolean).join(" · ");
  return (
    <View style={S.altbilgi} fixed>
      <Text style={S.altbilgiMetin}>
        {company.company}
        {company.address ? ` · ${company.address}` : ""}
      </Text>
      <Text style={S.altbilgiMetin}>{iletisim}</Text>
      <Text
        style={S.altbilgiMono}
        render={({ pageNumber, totalPages }) => `${docCode} · ${pageNumber}/${totalPages}`}
      />
    </View>
  );
}

/**
 * Alınacak plakaların özeti — ölçü + kalınlık + kalite başına adet ve kilo.
 *
 * KULLANIM ORANI EKRANDAKİYLE AYNI PAYDADAN ÇIKAR (`nesting-view.tsx`):
 * kullanılan alan ÷ plaka alanı. İki yerde iki farklı payda, kâğıttaki oranın
 * ekrandakinden farklı çıkması demekti.
 */
function plakaOzeti(gruplar: KesimPlaniGrubu[]) {
  const m = new Map<
    string,
    {
      enMm: number;
      boyMm: number;
      kalinlikMm: number | null;
      kalite: string;
      adet: number;
      kg: number;
      alan: number;
      kullanilan: number;
    }
  >();
  for (const g of gruplar) {
    const { enMm, boyMm } = g.sonuc.plaka;
    const k = `${enMm}x${boyMm}|${g.kalinlikMm ?? "?"}|${g.kalite}`;
    const v = m.get(k);
    if (v) {
      v.adet += g.sonuc.plakalar.length;
      v.kg += g.sonuc.plakaAgirlikKg ?? 0;
      v.alan += g.sonuc.plakaAlaniMm2;
      v.kullanilan += g.sonuc.kullanilanAlanMm2;
    } else {
      m.set(k, {
        enMm,
        boyMm,
        kalinlikMm: g.kalinlikMm,
        kalite: g.kalite,
        adet: g.sonuc.plakalar.length,
        kg: g.sonuc.plakaAgirlikKg ?? 0,
        alan: g.sonuc.plakaAlaniMm2,
        kullanilan: g.sonuc.kullanilanAlanMm2,
      });
    }
  }
  return [...m.values()].sort(
    (a, b) => (a.kalinlikMm ?? 0) - (b.kalinlikMm ?? 0) || a.enMm - b.enMm || a.boyMm - b.boyMm
  );
}

export function KesimPlaniDocument({ gruplar, meta, company }: KesimPlaniProps) {
  const toplamPlaka = gruplar.reduce((t, g) => t + g.sonuc.plakalar.length, 0);
  const plakaKg = gruplar.reduce((t, g) => t + (g.sonuc.plakaAgirlikKg ?? 0), 0);
  const parcaKg = gruplar.reduce((t, g) => t + (g.sonuc.parcaAgirlikKg ?? 0), 0);
  const fire = plakaKg > 0 ? 100 - (parcaKg / plakaKg) * 100 : 0;
  /**
   * BİR PLAKA ÇİZİMİNİN EN ÇOK KAPLAYACAĞI YÜKSEKLİK.
   *
   * İçerik alanının (≈495 pt) yarısından biraz azdır ve sebebi ölçülebilir:
   * 12 m'lik bir plaka bu sınıra hiç yaklaşmaz (≈160 pt) ve bir yaprağa İKİSİ
   * birden sığar; kare bir plaka ise sınıra dayanır, küçülür ve yaprağı tek
   * başına doldurur. Sınır olmasaydı ikinci hâl sayfayı taşırırdı.
   */
  const PLAKA_YUKSEKLIGI = Math.round(ICERIK_BOY * 0.45);

  return (
    <Document title={`Kesim Planı ${meta.docCode}`} author={company.company}>
      <Page size="A4" orientation="landscape" style={S.page}>
        <Antet meta={meta} />
        <Altbilgi company={company} docCode={meta.docCode} />

        {/* BAŞLIKLAR ELLE BÜYÜK YAZILIR: @react-pdf'in `textTransform`u
            locale'siz `toUpperCase()` çağırır ve "i" harfini "I" yapar
            (brand.tsx'in kuralı). */}
        <View style={S.serit}>
          <View style={S.kutu}>
            <Text style={S.kutuBaslik}>PLAKA</Text>
            <Text style={S.kutuDeger}>{say(toplamPlaka)}</Text>
          </View>
          <View style={S.kutu}>
            <Text style={S.kutuBaslik}>PLAKA AĞIRLIĞI</Text>
            <Text style={S.kutuDeger}>{say(Math.round(plakaKg))} kg</Text>
          </View>
          <View style={S.kutu}>
            <Text style={S.kutuBaslik}>PARÇA AĞIRLIĞI</Text>
            <Text style={S.kutuDeger}>{say(Math.round(parcaKg))} kg</Text>
          </View>
          <View style={S.kutu}>
            <Text style={S.kutuBaslik}>FİRE</Text>
            <Text style={S.kutuDeger}>%{say(fire, 1)}</Text>
          </View>
        </View>

        {/* ALINACAK PLAKALAR — belgenin ilk cevabı. Ekrandaki özetin aynısı;
            tedarikçiye giden sayı budur. */}
        <Text style={S.bolumBaslik}>ALINACAK PLAKALAR</Text>
        <View style={S.baslikSatir}>
          <Text style={[S.hucre, { width: 130 }]}>Plaka Ölçüsü</Text>
          <Text style={[S.hucre, { width: 70 }]}>Kalınlık</Text>
          <Text style={[S.hucre, { width: 90 }]}>Kalite</Text>
          <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>Plaka Adet</Text>
          <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>kg / Plaka</Text>
          <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>Kullanım</Text>
          <Text style={[S.hucre, S.mono, { width: 80, textAlign: "right" }]}>Sipariş kg</Text>
        </View>
        {plakaOzeti(gruplar).map((r) => (
          <View key={`${r.enMm}-${r.boyMm}-${r.kalinlikMm}-${r.kalite}`} style={S.satir}>
            <Text style={[S.hucre, S.mono, { width: 130 }]}>
              {say(r.enMm)} × {say(r.boyMm)} mm
            </Text>
            <Text style={[S.hucre, S.mono, { width: 70 }]}>
              {r.kalinlikMm == null ? "—" : `${say(r.kalinlikMm, 1)} mm`}
            </Text>
            <Text style={[S.hucre, { width: 90 }]}>{r.kalite || "—"}</Text>
            <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>{say(r.adet)}</Text>
            <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>
              {say(Math.round(plakaAgirligiKg(r.kalinlikMm, r.enMm, r.boyMm) ?? 0))}
            </Text>
            <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>
              {r.alan > 0 ? `%${say((r.kullanilan / r.alan) * 100, 1)}` : "—"}
            </Text>
            <Text style={[S.hucre, S.mono, { width: 80, textAlign: "right" }]}>
              {say(Math.round(r.kg))}
            </Text>
          </View>
        ))}

        {gruplar.map((g) => {
          const numaralar = parcaNumaralari(g.sonuc.plakalar);
          const liste = [...numaralar.entries()]
            .map(([id, no]) => {
              const ornek = g.sonuc.plakalar.flatMap((p) => p.parcalar).find((p) => p.id === id);
              const adet = g.sonuc.plakalar.reduce(
                (t, p) => t + p.parcalar.filter((x) => x.id === id).length,
                0
              );
              return {
                no,
                id,
                ad: ornek?.ad ?? id,
                en: ornek?.kaynakEnMm ?? 0,
                boy: ornek?.kaynakBoyMm ?? 0,
                adet,
              };
            })
            .sort((a, b) => a.no - b.no);

          return (
            <View key={g.tanim}>
              {/* GRUP KÜNYESİ VE DENETİM TEK KUTUDUR (`wrap={false}`): başlık
                  bir yaprağın dibinde yalnız kalıp denetim satırları öteki
                  yaprağa geçmemeli. Kutu yalnız BAŞLIĞI sarar — çizimleri de
                  içine almak, sayfaya sığmayan bir blok üretirdi (ekipman
                  listesinin "grup sarmalayıcı kutuya konmaz" dersi). */}
              <View wrap={false} style={S.grupBasi}>
                <Text style={S.h2}>
                  {g.tanim} — {g.sonuc.plakalar.length} × {say(g.sonuc.plaka.enMm)}×
                  {say(g.sonuc.plaka.boyMm)} mm · pay {g.sonuc.payMm} mm · doluluk %
                  {say(g.sonuc.dolulukYuzde, 1)}
                </Text>

                {/* DENETİM ÖZETİ — kâğıda bakan kişi ekranı görmüyor. */}
                {g.denetim.map((d) => (
                  <Text key={d.ad} style={[S.denetim, ...(d.gecti ? [] : [S.uyari])]}>
                    {d.gecti ? "✓" : "!"} {d.ad}: {d.ozet}
                  </Text>
                ))}
                {g.olcusuzParca > 0 && (
                  <Text style={[S.denetim, S.uyari]}>
                    ! {say(g.olcusuzParca)} parçanın ölçüsü okunamadığı için yerleşime girmedi.
                  </Text>
                )}
                {g.sonuc.sigmayanlar.map((x) => (
                  <Text key={x.id} style={[S.denetim, S.uyari]}>
                    ! {x.adet} × {x.ad} — {x.neden}
                  </Text>
                ))}
              </View>

              {g.sonuc.plakalar.map((plaka) => (
                <View key={plaka.sira} wrap={false} style={S.plakaKutusu}>
                  <PdfDiagram
                    diagram={yerlesimDiyagrami({
                      plaka,
                      numaralar,
                      baslik: `${g.tanim} · Plaka ${plaka.sira}/${g.sonuc.plakalar.length}`,
                      altNot: `${say(plaka.parcalar.length)} parça · doluluk %${say(plaka.dolulukYuzde, 1)}`,
                    })}
                    maxWidth={ICERIK_EN}
                    maxHeight={PLAKA_YUKSEKLIGI}
                    // Çerçeve YOK: çizimin kendi kabı `S.plakaKutusu`dur;
                    // ortak bileşenin çerçevesi burada ikinci bir kenarlık
                    // basardı.
                    framed={false}
                  />
                </View>
              ))}

              {/* KESİM LİSTESİ.
                  `fixed` DENENDİ VE GERİ ALINDI: @react-pdf'te `fixed` bir
                  öğe BÜTÜN yapraklarda tekrar eder, "tablo devam ettiği
                  sürece" değil — grup 1'in listesi bittikten sonra da başlık
                  satırı yaprağın dibinde bir kez daha basılıyordu (ölçüldü).
                  Bir grubun kesim listesi kısadır; başlık akışta kalır. */}
              <View style={[S.baslikSatir, { marginTop: 8 }]}>
                <Text style={[S.hucre, S.mono, { width: 28 }]}>No</Text>
                <Text style={[S.hucre, { flex: 1 }]}>Parça</Text>
                <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>En</Text>
                <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>Boy</Text>
                <Text style={[S.hucre, S.mono, { width: 50, textAlign: "right" }]}>Adet</Text>
              </View>
              {liste.map((r) => (
                <View key={r.id} style={S.satir} wrap={false}>
                  <Text style={[S.hucre, S.mono, { width: 28 }]}>{r.no}</Text>
                  <Text style={[S.hucre, { flex: 1 }]}>{r.ad}</Text>
                  <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>
                    {say(r.en)}
                  </Text>
                  <Text style={[S.hucre, S.mono, { width: 60, textAlign: "right" }]}>
                    {say(r.boy)}
                  </Text>
                  <Text style={[S.hucre, S.mono, { width: 50, textAlign: "right" }]}>
                    {say(r.adet)}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}
      </Page>
    </Document>
  );
}

export async function renderKesimPlaniPdf(props: KesimPlaniProps): Promise<Buffer> {
  const belge = await pdf(<KesimPlaniDocument {...props} />).toBuffer();
  const parcalar: Buffer[] = [];
  for await (const yigin of belge as unknown as AsyncIterable<Buffer>) parcalar.push(yigin);
  return Buffer.concat(parcalar);
}
