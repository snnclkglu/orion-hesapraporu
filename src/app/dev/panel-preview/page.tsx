// Sadece development: AÇILIŞ PANOSUNU auth olmadan görsel test etmek için.
// Production'da 404 döner. (sales-preview / worklog-preview ile aynı desen.)
//
// FİKSTÜR GERÇEK BÜYÜKLÜKLERDEDİR ve bu bilinçlidir (personel önizlemesinin
// dersi): "MUHTELİF VİNÇLER" gibi kısa bir adla panoya bakmak, gerçek
// hayattaki "İSDEMİR AMONYUM SÜLFAT TESİSİ 2M³ KAPASİTELİ KEPÇELİ ÇİFT
// KİRİŞLİ TAVAN VİNCİ" satırının telefonda ne yaptığını GÖSTERMEZ. Uzun ad,
// çok kayıtlı gün ve geciken tarih burada bilerek vardır.
//
// SAYFA İKİ ROLÜ ÜST ÜSTE BASAR: yönetici (bütün bölümler, satış ve satın
// alma sinyalleri) ve teknik ressam (dar menü, sinyalsiz, "sana ait" dolu).
// Rol bazlı bir ekranı tek bir rolle sınamak, kesilen tarafı hiç görmemektir.

import { notFound } from "next/navigation";
import { PanelView } from "@/app/(app)/panel/panel-view";
import type { PanelData } from "@/app/(app)/panel/data";
import { panelSinyalleri, panelTakvim, type PanelHit } from "@/lib/panel";

const BUGUN = "2026-08-13";

const HITS: PanelHit[] = [
  {
    kind: "job",
    code: "0055",
    label: "İSDEMİR AMONYUM SÜLFAT TESİSİ 2M³ KAPASİTELİ KEPÇELİ ÇİFT KİRİŞLİ TAVAN VİNCİ",
    hint: "İSDEMİR A.Ş. · Aktif",
    href: "/jobs/1",
  },
  { kind: "job", code: "0057", label: "MUHTELİF VİNÇLER", hint: "ASTOR A.Ş. · Aktif", href: "/jobs/2" },
  {
    kind: "item",
    code: "0057-06",
    label: "1,0 T KAPASİTELİ PERGEL VİNÇ",
    hint: "MUHTELİF VİNÇLER",
    href: "/jobs/2",
  },
  { kind: "customer", code: "ASTOR", label: "ASTOR A.Ş.", hint: "9 iş", href: "/jobs" },
  {
    kind: "project",
    code: "0055-00",
    label: "AMONYUM SÜLFAT TESİSİ VİNCİ",
    href: "/projects/1",
  },
  { kind: "package", code: "0043-00-0000", label: "MTC PASLANMAZ", href: "/drawings/1" },
  {
    kind: "group",
    code: "0043-00-1000",
    label: "ELEKTRİK PANOSU",
    hint: "MTC PASLANMAZ",
    href: "/drawings/1/parts",
  },
];

const YONETICI: PanelData = {
  hits: HITS,
  signals: panelSinyalleri([
    {
      key: "po-overdue",
      count: 3,
      label: "siparişin termini geçti, teslim alınmadı",
      href: "/purchasing/teslimat",
      tone: "uyari",
    },
    {
      key: "review",
      count: 12,
      label: "üretim kaydı revizyon sonrası kontrol bekliyor",
      href: "/drawings",
      tone: "uyari",
    },
    {
      key: "sales-unpriced",
      count: 18,
      label: "iş kaleminin fiyatı girilmedi",
      href: "/sales",
      tone: "bilgi",
    },
    // Sıfır sayan sinyal listeye GİRMEMELİ — önizleme bunu da gösterir.
    { key: "doc-expiry", count: 0, label: "personel belgesi", href: "/personnel", tone: "uyari" },
  ]),
  days: panelTakvim(
    [
      // GECİKME: şeridin en üstünde ve kehribar.
      { date: "2026-08-10", kind: "Teslim", label: "SIP-2026-118", hint: "YILMAZ REDÜKTÖR", href: "/purchasing/teslimat" },
      { date: "2026-08-13", kind: "Termin", label: "0057-03", hint: "5 T KAPASİTELİ MONORAY VİNÇ", href: "/sales" },
      { date: "2026-08-14", kind: "Sevk", label: "0040-00", hint: "PANEL İMALATI", href: "/sales" },
      { date: "2026-08-14", kind: "Teslim", label: "SIP-2026-131", hint: "SIBRE", href: "/purchasing/teslimat" },
      { date: "2026-08-18", kind: "Termin", label: "0055-00", hint: "İSDEMİR AMONYUM SÜLFAT TESİSİ VİNCİ", href: "/sales" },
      { date: "2026-09-02", kind: "Teslim", label: "SIP-2026-140", hint: "CONDUCTIX-WAMPFLER", href: "/purchasing/teslimat" },
    ],
    BUGUN
  ),
  mine: [],
  counts: {
    "/jobs": "62 iş · 4 aktif",
    "/projects": "31 rapor",
    "/drawings": "3 paket",
    "/purchasing": "17 açık sipariş",
    "/worklog": "212 kayıt · bu ay",
    "/sales": "88 kalem",
    "/personnel": "38 çalışan",
    "/admin": "5 kullanıcı",
  },
};

const RESSAM: PanelData = {
  hits: HITS,
  // Ressamın satış ve satın alma sinyali YOKTUR; kalan tek sinyal teknik resim.
  signals: panelSinyalleri([
    {
      key: "review",
      count: 12,
      label: "üretim kaydı revizyon sonrası kontrol bekliyor",
      href: "/drawings",
      tone: "uyari",
    },
  ]),
  // Tarihli kayıtların tamamı satış/satın alma tarafındadır: ressamın şeridi
  // BOŞTUR ve boş durum burada sınanır.
  days: [],
  mine: [
    { code: "0100", name: "KÖPRÜ YÜRÜTME GRUBU", status: "ciziliyor", project: "AMONYUM SÜLFAT TESİSİ VİNCİ", href: "/projects/1" },
    { code: "0200", name: "ANA KİRİŞ", status: "kontrol", project: "AMONYUM SÜLFAT TESİSİ VİNCİ", href: "/projects/1" },
    { code: "1500", name: "ANA ARABA KOMPLESİ", status: "bekliyor", project: "MTC PASLANMAZ ÇİFT KİRİŞLİ TAVAN VİNCİ", href: "/projects/2" },
  ],
  counts: { "/jobs": "62 iş · 4 aktif", "/projects": "31 rapor", "/drawings": "3 paket" },
};

export default function PanelPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto grid max-w-5xl gap-12 p-4 sm:p-6">
      <section>
        <p className="oc-kicker mb-4 text-muted-foreground">Önizleme · Yönetici</p>
        <PanelView data={YONETICI} role="admin" displayName="Sinan Çolakoğlu" today={BUGUN} />
      </section>

      <hr className="border-t-2 border-dashed" />

      <section>
        <p className="oc-kicker mb-4 text-muted-foreground">Önizleme · Teknik Ressam</p>
        <PanelView data={RESSAM} role="draftsman" displayName="Mehmet Yıldız" today={BUGUN} />
      </section>
    </main>
  );
}
