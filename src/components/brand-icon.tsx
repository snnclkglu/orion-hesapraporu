// Orion Cranes marka ikon seti — design-system/assets/icons/*.svg dosyalarının
// birebir inline SVG karşılığı (24×24 grid, 1.5 stroke, kare uç). Lucide yerine
// bu set kullanılır; "menu" ikonu aynı kurallarla çizilmiş hamburger'dır.

const ICON_PATHS: Record<BrandIconName, React.ReactNode> = {
  bolt: (
    <>
      <path d="M12 4 L18 7.5 L18 14.5 L12 18 L6 14.5 L6 7.5 Z" />
      <circle cx="12" cy="11" r="3" />
    </>
  ),
  cabin: (
    <>
      <rect x="4" y="5" width="16" height="14" />
      <line x1="4" y1="10" x2="20" y2="10" />
      <line x1="12" y1="10" x2="12" y2="19" />
    </>
  ),
  console: (
    <>
      <path d="M4 17 L7 8 L17 8 L20 17 Z" />
      <circle cx="10" cy="13" r="1" />
      <circle cx="14" cy="13" r="1" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 16 a8 8 0 0 1 16 0" />
      <line x1="12" y1="16" x2="16.5" y2="11" />
      <line x1="4" y1="16" x2="20" y2="16" />
    </>
  ),
  hook: (
    <>
      <line x1="12" y1="3" x2="12" y2="11" />
      <path d="M12 11 a4.5 4.5 0 1 1 -4 6.8" />
      <line x1="9" y1="3" x2="15" y2="3" />
    </>
  ),
  panel: (
    <>
      <rect x="5" y="4" width="14" height="16" />
      <line x1="14" y1="4" x2="14" y2="20" />
      <line x1="11" y1="12" x2="12.5" y2="12" />
    </>
  ),
  safety: (
    <>
      <path d="M12 3 L19 6 L19 12 C19 16 16 19 12 21 C8 19 5 16 5 12 L5 6 Z" />
      <path d="M9 12 l2 2 l4 -4" />
    </>
  ),
  seat: (
    <>
      <path d="M8 4 L8 12 L16 12" />
      <rect x="7" y="12" width="10" height="3" />
      <line x1="9" y1="15" x2="9" y2="19" />
      <line x1="15" y1="15" x2="15" y2="19" />
    </>
  ),
  // Satış takibi: çizelge sayfası + yükselen sütunlar. Rakam DEĞİL, rakamın
  // tutulduğu defter anlatılır — para simgesi kullanılmaz (çoklu para birimi).
  ledger: (
    <>
      <rect x="4" y="4" width="16" height="16" />
      <line x1="8" y1="16" x2="8" y2="12.5" />
      <line x1="12" y1="16" x2="12" y2="9.5" />
      <line x1="16" y1="16" x2="16" y2="7.5" />
    </>
  ),
  // İş takibi: puantaj çizelgesi — takvim yaprağı + üzerinde saat ibresi.
  // "ledger" defterle karışmasın diye yaprağın üst tırnakları korunur; ölçülen
  // büyüklük ZAMANDIR, o yüzden ibre ikonun merkezindedir.
  timesheet: (
    <>
      <rect x="4" y="5" width="16" height="15" />
      <line x1="4" y1="9.5" x2="20" y2="9.5" />
      <line x1="8.5" y1="3" x2="8.5" y2="6" />
      <line x1="15.5" y1="3" x2="15.5" y2="6" />
      <circle cx="12" cy="14.75" r="3.25" />
      <path d="M12 13 L12 14.75 L13.5 15.75" />
    </>
  ),
  // Teknik resimler: pafta + antet şeridi + ölçü çizgisi. Anlatılan şey
  // "dosya" değil ÇİZİMDİR — bu yüzden klasör ya da kâğıt köşesi değil,
  // teknik resmi teknik resim yapan iki öğe (antet ve ölçülendirme) çizilir.
  blueprint: (
    <>
      <rect x="3" y="5" width="18" height="14" />
      <line x1="3" y1="15.5" x2="21" y2="15.5" />
      <line x1="14" y1="15.5" x2="14" y2="19" />
      <path d="M7 9 L9.5 9 M7 9 L7.9 8.2 M7 9 L7.9 9.8" />
      <path d="M13 9 L10.5 9 M13 9 L12.1 8.2 M13 9 L12.1 9.8" />
    </>
  ),
  // Satın alma: DIŞARIDAN İÇERİ gelen malzeme — açık tepeli tekne + inen ok.
  // Alışveriş arabası bilinçli olarak kullanılmadı (bu bir perakende motifi ve
  // marka dili endüstriyel); kapalı dikdörtgen de kullanılmadı, çünkü setteki
  // dört ikon (cabin · panel · blueprint · timesheet) zaten dikdörtgenle
  // başlıyor ve dar rayda etiketsiz durduklarında ayırt edilemezlerdi.
  cart: (
    <>
      <path d="M4 13 L4 19 L20 19 L20 13" />
      <line x1="12" y1="3.5" x2="12" y2="14" />
      <path d="M8.5 10.5 L12 14 L15.5 10.5" />
    </>
  ),
  // Finans: madeni para yığını. Setteki TEK eliptik gövde budur ve bu bilinçli
  // — dört ikon (cabin · panel · blueprint · timesheet) ve iki kenar çubuğu
  // ikonu zaten dikdörtgenle başlıyor; dar rayda (etiketsiz, 24px) yedinci bir
  // dikdörtgen ayırt edilemezdi. Para SİMGESİ kullanılmaz: bölüm üç para
  // birimiyle birden çalışır (ledger ikonundaki aynı gerekçe). Üç dilim
  // "yığın" der; tek bölmeli uzun bir silindir veritabanı ikonuna benzerdi.
  wallet: (
    <>
      <ellipse cx="12" cy="7" rx="7" ry="2.6" />
      <path d="M5 7 L5 17 A7 2.6 0 0 0 19 17 L19 7" />
      <path d="M5 10.4 A7 2.6 0 0 0 19 10.4" />
      <path d="M5 13.8 A7 2.6 0 0 0 19 13.8" />
    </>
  ),
  // Teklif: fiyat etiketi — 45° dönmüş beşgen gövde + delik.
  //
  // Sette EĞİK GÖVDELİ TEK İKON budur ve bu bilinçlidir: altı ikon (cabin ·
  // panel · blueprint · timesheet · ledger · gauge) dikdörtgenle başlıyor ve
  // dar rayda (24px, etiketsiz) yedincisi ayırt edilemezdi. Para simgesi
  // KULLANILMAZ — bölüm üç para birimiyle birden çalışır (ledger ve wallet
  // ikonlarındaki aynı gerekçe).
  tag: (
    <>
      <path d="M13 3 L21 3 L21 11 L11 21 L3 13 Z" />
      <circle cx="17.6" cy="6.4" r="1.4" />
    </>
  ),
  menu: (
    <>
      <line x1="5" y1="7" x2="19" y2="7" />
      <line x1="5" y1="12" x2="19" y2="12" />
      <line x1="5" y1="17" x2="19" y2="17" />
    </>
  ),
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  // Kenar çubuğu daralt/genişlet: panel + yön oku. İki ikon aynı çerçeveyi
  // paylaşır, yalnız ok yönü değişir — durum tek bakışta okunur.
  sidebarCollapse: (
    <>
      <rect x="4" y="5" width="16" height="14" />
      <line x1="10" y1="5" x2="10" y2="19" />
      <path d="M16 9.5 L13.5 12 L16 14.5" />
    </>
  ),
  sidebarExpand: (
    <>
      <rect x="4" y="5" width="16" height="14" />
      <line x1="10" y1="5" x2="10" y2="19" />
      <path d="M13.5 9.5 L16 12 L13.5 14.5" />
    </>
  ),
};

export type BrandIconName =
  | "bolt"
  | "cabin"
  | "console"
  | "gauge"
  | "hook"
  | "panel"
  | "safety"
  | "seat"
  | "ledger"
  | "timesheet"
  | "blueprint"
  | "cart"
  | "wallet"
  | "tag"
  | "menu"
  | "close"
  | "sidebarCollapse"
  | "sidebarExpand";

/**
 * İkon adlarının ÇALIŞMA ZAMANI listesi — defterin kendisinden türetilir.
 *
 * `BrandIconName` bir tiptir ve tip çalışma zamanında yoktur; `roles.ts`teki
 * `WorkspaceSection.icon` alanı ise `string`tir ve `app-shell.tsx`te
 * `as BrandIconName` ile CAST edilir. Yani menüye yanlış yazılmış bir ikon adı
 * derlemeyi geçer ve kullanıcı boş bir `<svg>` görür. Bu dizi o bağı bir teste
 * bağlanabilir kılar (`lib/__tests__/roles.test.ts`).
 */
export const BrandIconNames = Object.keys(ICON_PATHS) as BrandIconName[];

export function BrandIcon({
  name,
  size = 16,
  className,
  "aria-hidden": ariaHidden = true,
}: {
  name: BrandIconName;
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
