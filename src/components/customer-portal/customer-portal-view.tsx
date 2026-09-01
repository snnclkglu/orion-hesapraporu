import Link from "next/link";
import Image from "next/image";
import { Download, Eye, FileText, Folder, LogOut, ShieldCheck } from "lucide-react";
import type { CustomerPortalDto, ProductPortalFileDto } from "@/lib/product-portal/types";

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

function fileMeta(file: ProductPortalFileDto): string {
  return [
    file.revisionLabel,
    file.pageCount > 0 ? `${file.pageCount} sayfa` : "",
    formatBytes(file.sizeBytes),
    file.accessMode === "download" ? "İndirilebilir" : "Filigranlı görüntüleme",
  ].filter(Boolean).join(" · ");
}

export function CustomerPortalView({ dto }: { dto: CustomerPortalDto }) {
  const folders = new Map<string, { title: string; sort: number; files: ProductPortalFileDto[] }>();
  for (const file of dto.files) {
    const current = folders.get(file.folderKey) ?? {
      title: file.folderTitle,
      sort: file.folderSort,
      files: [],
    };
    current.files.push(file);
    folders.set(file.folderKey, current);
  }
  const folderList = [...folders.values()].sort((a, b) => a.sort - b.sort);
  const base = `/paylas/vinc/${encodeURIComponent(dto.publicCode)}`;

  return (
    <div className="min-h-full bg-background text-foreground">
      {dto.preview && (
        <div className="border-b border-primary bg-primary/[0.08] px-4 py-2 text-center font-mono text-[11px] font-semibold tracking-[0.16em] text-primary">
          ÖNİZLEME · MÜŞTERİ HENÜZ BU TASLAĞI GÖRMÜYOR
        </div>
      )}
      <header className="border-b-4 border-primary bg-[#262626] text-[#F4F1EF]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-5 px-4 py-5 sm:px-6 lg:px-8">
          {/*
            * ÇİFT MARKA — plakadaki kompozisyonun aynısı.
            *
            * QR'ı okutan kişi KENDİ fabrikasının vincine bakıyor; karşısına
            * yalnız tedarikçinin markası çıkması yabancı bir yüzdür. Plaka
            * zaten ORION + müşteri logosunu birlikte taşır (Yönetim →
            * Müşteriler'deki `logo_path`); portal da aynı ikiliyi gösterir.
            * Logo kayıtta yoksa müşteri ADI yazılır — boş çerçeve bırakılmaz.
            */}
          <div className="flex min-w-0 flex-wrap items-center gap-4 sm:gap-5">
            <Image
              src="/brand/orion-logo-white.svg"
              alt="ORION CRANES"
              width={788}
              height={96}
              className="h-auto w-[190px] max-w-full"
            />
            {(dto.customerLogoDataUrl || dto.customerName) && (
              <>
                <span aria-hidden className="hidden h-9 w-px bg-white/25 sm:block" />
                {dto.customerLogoDataUrl ? (
                  // Müşteri logoları koyu zeminde okunmayabilir; plakadaki gibi
                  // kâğıt renkli bir levha üzerinde durur.
                  <span className="inline-flex items-center bg-[#F4F1EF] px-3 py-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- veri adresi; Next optimizasyonu geçersiz. */}
                    <img
                      src={dto.customerLogoDataUrl}
                      alt={dto.customerName || "Müşteri"}
                      className="h-8 w-auto max-w-[150px] object-contain"
                    />
                  </span>
                ) : (
                  <span className="truncate text-base font-bold tracking-tight">{dto.customerName}</span>
                )}
              </>
            )}
          </div>
          <p className="w-full font-mono text-[11px] font-semibold tracking-[0.2em] text-[#F4F1EF]/65">
            GÜVENLİ MÜŞTERİ DOKÜMAN PORTALI
          </p>
          <div className="flex items-center gap-3">
            <div className="border border-white/25 bg-white/5 px-3 py-2 text-right">
              <div className="font-mono text-[11px] tracking-[0.14em] text-white/60">SERİ NUMARASI</div>
              <div className="mt-1 font-mono text-base font-semibold tabular-nums">{dto.serialNo}</div>
            </div>
            {/*
              * ÇIKIŞ — portal ortak bir bilgisayardan da açılır.
              * Oturumu kapatmanın bir yolu yoktu; çerez 12 saat boyunca geçerli
              * kalıyordu. Düğme POST'tur: oturum sunucuda iptal edilir.
              * Önizlemede gösterilmez, orada bir oturum yoktur.
              */}
            {!dto.preview && (
              <form method="post" action={`${base}/cikis`}>
                <button
                  type="submit"
                  className="oc-tap inline-flex min-h-11 items-center gap-2 border border-white/25 px-3 text-sm font-medium text-[#F4F1EF] hover:bg-white/10"
                >
                  <LogOut className="size-4" /> Çıkış
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      {/*
        * MOBİLDE KİMLİK VE DESTEK ÖNCE GELİR.
        *
        * Tek sütuna düşen düzende yan sütun bütün klasörlerin ALTINA iniyordu:
        * QR'ı okutan servisçi, seri numarasını ve destek adresini görmek için
        * onlarca belgeyi kaydırmak zorunda kalıyordu. `order` yalnız dar ekranda
        * uygulanır; geniş ekranda iki sütunlu düzen aynen korunur.
        */}
      <main className="mx-auto grid w-full max-w-6xl gap-5 px-3 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:px-8 lg:py-8">
        <div className="order-2 min-w-0 space-y-5 lg:order-1">
          <section className="border bg-card p-4 sm:p-6">
            <div className="oc-kicker text-muted-foreground">{dto.company}</div>
            <div className="mt-2 h-1 w-11 bg-primary" />
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{dto.portalTitle}</h1>
            <p className="mt-2 text-base font-semibold">{dto.product || dto.craneType}</p>
            {dto.product && dto.craneType && dto.product !== dto.craneType && (
              <p className="mt-1 text-sm text-muted-foreground">{dto.craneType}</p>
            )}
            {dto.note && <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{dto.note}</p>}
          </section>

          {folderList.length > 0 ? folderList.map((folder) => (
            <section key={`${folder.sort}-${folder.title}`} className="border bg-card">
              <header className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
                <Folder className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">{folder.title}</h2>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">{folder.files.length} BELGE</span>
              </header>
              <div className="divide-y">
                {folder.files
                  .sort((a, b) => a.fileSort - b.fileSort || a.title.localeCompare(b.title, "tr"))
                  .map((file) => {
                    const href = file.accessMode === "download"
                      ? `${base}/belge/${file.id}/indir`
                      : `${base}?belge=${encodeURIComponent(file.id)}`;
                    const icon = file.accessMode === "download"
                      ? <Download className="size-4" />
                      : <Eye className="size-4" />;
                    return (
                      <article key={file.id} className="flex min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                        <span className="grid size-10 shrink-0 place-items-center border bg-muted text-primary">
                          <FileText className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-semibold">{file.title}</span>
                          <span className="mt-1 block break-words font-mono text-[11px] leading-5 text-muted-foreground">
                            {fileMeta(file)}
                          </span>
                        </span>
                        {dto.preview ? (
                          <span className="oc-tap inline-flex min-h-11 items-center justify-center gap-2 border px-3 text-sm font-medium text-muted-foreground">
                            {icon} {file.accessMode === "download" ? "İndir" : "Görüntüle"}
                          </span>
                        ) : (
                          <Link href={href} className="oc-tap inline-flex min-h-11 items-center justify-center gap-2 border border-primary px-3 text-sm font-medium text-primary hover:bg-primary/[0.06]">
                            {icon} {file.accessMode === "download" ? "İndir" : "Görüntüle"}
                          </Link>
                        )}
                      </article>
                    );
                  })}
              </div>
            </section>
          )) : (
            <section className="border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
              Bu sürümde müşteriye açılmış belge bulunmuyor.
            </section>
          )}
        </div>

        <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-5 lg:self-start">
          <section className="border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-primary" /> Vinç Kimliği
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              {dto.customerName && <div><dt className="oc-kicker text-muted-foreground">Müşteri</dt><dd className="mt-1 break-words font-semibold">{dto.customerName}</dd></div>}
              <div><dt className="oc-kicker text-muted-foreground">Seri No</dt><dd className="mt-1 break-words font-mono">{dto.serialNo}</dd></div>
              {dto.projectCode && <div><dt className="oc-kicker text-muted-foreground">Proje Kodu</dt><dd className="mt-1 break-words font-mono">{dto.projectCode}</dd></div>}
              {dto.productionYear && <div><dt className="oc-kicker text-muted-foreground">Üretim Yılı</dt><dd className="mt-1 font-mono">{dto.productionYear}</dd></div>}
              <div><dt className="oc-kicker text-muted-foreground">Paket Sürümü</dt><dd className="mt-1 font-mono">{dto.revisionLabel}</dd></div>
              <div><dt className="oc-kicker text-muted-foreground">Yayım Tarihi</dt><dd className="mt-1 font-mono">{new Date(dto.publishedAt).toLocaleDateString("tr-TR")}</dd></div>
            </dl>
          </section>
          <section className="border bg-muted/50 p-4 text-xs leading-5 text-muted-foreground">
            <p>Filigranlı görüntüleme, indirme düğmesini kapatır; ekran görüntüsünü teknik olarak engellemez.</p>
            {dto.supportEmail && (
              <p className="mt-3">Şifrenizi unuttuysanız veya belge desteğine ihtiyacınız varsa <a className="text-primary underline" href={`mailto:${dto.supportEmail}`}>{dto.supportEmail}</a> adresine yazın.</p>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
