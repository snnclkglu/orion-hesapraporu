// PLAKA VARLIKLARI — EKRANDA ADRES, İNDİRMEDE GÖMÜLÜ.
//
// Vinç kimlik plakası uygulamanın TEK istemci tarafı belgesidir (Vercel
// fonksiyon bütçesi). Fontlar ve marka logosu bu yüzden tarayıcıya ulaşmak
// zorundadır — ama proje sayfasının yüküne binmek zorunda DEĞİLDİR.
//
// Önce üçü de base64'lenip prop olarak gönderiliyordu, üstelik fontlar İKİ KEZ
// (`*DataUrl` ve `embeddedFontsCss`): Vinç Kimliği sekmesini hiç açmayan
// kullanıcı dahil HER proje sayfası ~0,94 MB fazladan taşıyordu.
//
// Ayrım şudur:
//   EKRAN  — önizleme sayfanın içindedir, aynı kökenden `/fonts/...` ve
//            `/brand/...` adreslerini okuyabilir. Sıfır bayt prop.
//   İNDİRME — indirilen SVG matbaaya gider ve KENDİ KENDİNE YETMELİDİR;
//            orada fontlar ve logo base64 olarak GÖMÜLÜR. Bedeli yalnız
//            düğmeye basan kullanıcı öder.

/** Baskı plakasının kullandığı üç yüz; `public/fonts` altında statik durur. */
export const PLATE_FONT_FILES = {
  archivoBold: "/fonts/Archivo-Bold.ttf",
  archivoExtraBold: "/fonts/Archivo-ExtraBold.ttf",
  plexSemiBold: "/fonts/IBMPlexMono-SemiBold.ttf",
} as const;

/** Ekranda gösterilen SVG için: font dosyalarını ADRESLE çağırır. */
export const SCREEN_FONT_CSS = `
@font-face{font-family:Archivo;src:url(${PLATE_FONT_FILES.archivoBold}) format('truetype');font-weight:700;font-display:block}
@font-face{font-family:Archivo;src:url(${PLATE_FONT_FILES.archivoExtraBold}) format('truetype');font-weight:800;font-display:block}
@font-face{font-family:PlexMono;src:url(${PLATE_FONT_FILES.plexSemiBold}) format('truetype');font-weight:500 700;font-display:block}
`;

/** Ekrandaki plaka logosu; indirmede bunun base64'ü kullanılır. */
export const PLATE_LOGO_URL = "/brand/orion-logo-white.svg";
/** @react-pdf `Image` yalnız raster okur — PDF tarafının logosu budur. */
export const PLATE_LOGO_RASTER_URL = "/brand/orion-logo-paper.png";

/**
 * Büyük ikili veriyi base64'e çevirir.
 *
 * `btoa(String.fromCharCode(...bytes))` KULLANILMAZ: yayılım (spread) yüz binlik
 * bir diziyle çağrı yığınını taşırır ve font dosyaları tam o boydadır. Parçalı
 * dönüşüm boyuttan bağımsız çalışır.
 */
function base64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}

/**
 * GELEN BAYT GERÇEKTEN FONT MU — "200 OK" YETMEZ.
 *
 * Bu tam olarak bir kez oldu ve sessizdi: `proxy.ts` matcher'ı `.ttf` uzantısını
 * muaf tutmuyordu, istek korumalı sayılıyor ve `/login` sayfasının HTML'i **200**
 * ile dönüyordu. `response.ok` doğruydu; fontkit "Unknown font format" diyordu ve
 * indirilen baskı SVG'sine font yerine giriş sayfası gömülüyordu. Matcher
 * düzeltildi — ama bir sonraki yönlendirme kuralı aynı tuzağı kurabilir, o yüzden
 * imza burada sınanır. Yanlış içerikli bir başarı, açık bir hatadan çok daha
 * pahalıdır: bozuk plaka matbaadan döner.
 */
const FONT_SIGNATURES = [
  [0x00, 0x01, 0x00, 0x00], // TrueType
  [0x74, 0x72, 0x75, 0x65], // 'true'
  [0x4f, 0x54, 0x54, 0x4f], // 'OTTO' (CFF)
  [0x74, 0x74, 0x63, 0x66], // 'ttcf'
];

function looksLikeFont(bytes: Uint8Array): boolean {
  return FONT_SIGNATURES.some((signature) =>
    signature.every((byte, index) => bytes[index] === byte)
  );
}

/*
 * `force-cache` KULLANILMAZ — zehirlenmiş bir girdiyi ölümsüzleştirir.
 *
 * İlk sürümde vardı ve hemen bedelini gösterdi: proxy muafiyeti eklenmeden
 * önce `/fonts/*.ttf` giriş sayfasının HTML'ini 200 ile döndürmüştü, tarayıcı
 * onu önbelleğe aldı ve muafiyet düzeltildikten SONRA da `force-cache` o bozuk
 * yanıtı sunmaya devam etti. Varsayılan davranış normal önbellek başlıklarına
 * uyar; statik dosya zaten önbelleğe alınır, ama yenilenebilir kalır.
 */
async function fetchAsset(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} okunamadı (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchFontDataUrl(url: string): Promise<string> {
  const bytes = await fetchAsset(url);
  if (!looksLikeFont(bytes)) {
    throw new Error(
      `${url} bir yazı tipi dosyası döndürmedi (${bytes.length} bayt). ` +
      "İstek büyük olasılıkla giriş sayfasına yönlendirildi; proxy muafiyetini kontrol edin."
    );
  }
  return `data:font/ttf;base64,${base64(bytes)}`;
}

async function fetchAsDataUrl(url: string, mime: string): Promise<string> {
  return `data:${mime};base64,${base64(await fetchAsset(url))}`;
}

export interface EmbeddedPlateAssets {
  /** İndirilen SVG'ye gömülecek `@font-face` bloğu. */
  fontsCss: string;
  /** İndirilen SVG'ye gömülecek ORION logosu (vektör). */
  logoDataUrl: string;
}

let cached: Promise<EmbeddedPlateAssets> | null = null;

/**
 * İNDİRME için varlıkları bir kez indirir ve gömülebilir hâle getirir.
 *
 * Sonuç önbelleklenir: kullanıcı SVG ve PDF'i art arda indirdiğinde fontlar
 * ikinci kez çözülmez. Hata olursa önbellek TEMİZLENİR — kalıcı bir başarısızlık
 * düğmeyi sonsuza kadar bozuk bırakmasın.
 */
export function embeddedPlateAssets(): Promise<EmbeddedPlateAssets> {
  if (!cached) {
    cached = (async () => {
      const [bold, extraBold, plex, logo] = await Promise.all([
        fetchFontDataUrl(PLATE_FONT_FILES.archivoBold),
        fetchFontDataUrl(PLATE_FONT_FILES.archivoExtraBold),
        fetchFontDataUrl(PLATE_FONT_FILES.plexSemiBold),
        fetchAsDataUrl(PLATE_LOGO_URL, "image/svg+xml"),
      ]);
      return {
        fontsCss: `
@font-face{font-family:Archivo;src:url(${bold}) format('truetype');font-weight:700}
@font-face{font-family:Archivo;src:url(${extraBold}) format('truetype');font-weight:800}
@font-face{font-family:PlexMono;src:url(${plex}) format('truetype');font-weight:500 700}
`,
        logoDataUrl: logo,
      };
    })().catch((error) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}
