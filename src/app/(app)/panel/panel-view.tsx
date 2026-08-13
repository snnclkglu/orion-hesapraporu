// AÇILIŞ PANOSUNUN GÖRÜNÜMÜ — sunucu bileşeni, veri almaz yalnız basar.
//
// Görünüm veriden AYRI durur çünkü iki tüketicisi var: gerçek sayfa
// (`(app)/page.tsx`) ve auth'suz görsel önizleme (`/dev/panel-preview`).
// Önizlemenin kendi kopyasını yazmak, ekran değişince ikisinin ayrışması
// demekti (uygulamadaki bütün önizleme sayfalarının kuralı).
//
// ═══════════════════════════════════════════════ NEDEN KART IZGARASI DEĞİL
//
// İlk taslak bölümleri eşit boyda ikon+başlık+açıklama kartlarıyla diziyordu.
// O düzen bir SAYFA YAPISI değil bir dolgudur: sekiz kart aynı ağırlıkta
// bağırır, hiçbiri bir şey söylemez ve göz nereye bakacağını bilemez.
//
// Bölümler bir DEFTER SATIRI gibi dizilir — teknik resmin antet tablosu gibi.
// Her satır ikonunu, adını, ne işe yaradığını ve CANLI BİR SAYIYI taşır
// ("62 iş · 4 aktif"). Satır kartdan hızlı taranır, sayı da ekranı bir
// başlatıcıdan bir duruma çevirir: kullanıcı Satın Alma'ya girmeden kaç açık
// sipariş olduğunu görür.

import Link from "next/link";
import { ArrowRight, Bell, CalendarClock, TriangleAlert } from "lucide-react";
import { BrandIcon, type BrandIconName } from "@/components/brand-icon";
import { visibleSections, roleLabel } from "@/lib/roles";
import { DRAWING_PLAN_STATUS_LABELS, type DrawingPlanStatus } from "@/lib/drawing-plan";
import { formatNum } from "@/lib/drawings/labels";
import { PanelSearch } from "./panel-search";
import type { PanelData } from "./data";

/** Uzun tarih: "13 Ağustos 2026, Çarşamba". */
function uzunTarih(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        weekday: "long",
      });
}

/** Bölüm başlığı — bu dilin kicker'ı, altında kırmızı kural. */
function Baslik({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h2 className="oc-kicker text-muted-foreground">{children}</h2>
      <span className="oc-rule-red mt-2 block" aria-hidden />
    </div>
  );
}

export function PanelView({
  data,
  role,
  displayName,
  today,
}: {
  data: PanelData;
  role: string;
  displayName: string;
  /** "YYYY-MM-DD" — İstanbul saatiyle (bkz. `bugunIstanbul`) */
  today: string;
}) {
  // Pano KENDİNİ LİSTELEMEZ. Menü ile bu liste aynı kaynaktan okunur
  // (`WORKSPACE_SECTIONS`) ve panonun kendisi de o kaynakta bir bölümdür;
  // burada tek bir satır düşülür, ikinci bir liste yazılmaz.
  const sections = visibleSections(role).filter((s) => s.href !== "/");
  // Ad tek sözcüğe iner: "Sinan Çolakoğlu, iyi çalışmalar" bir selam değil bir
  // künyedir. Boş isimde selam hiç basılmaz, uydurma bir "Kullanıcı" yazılmaz.
  const ilkAd = displayName.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="grid gap-8 pb-4">
      {/* ————————————————————————————————————— selam + arama */}
      <header className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {ilkAd ? `İyi çalışmalar, ${ilkAd}` : "İyi çalışmalar"}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {uzunTarih(today)} · <span className="text-foreground/70">{roleLabel(role)}</span>
          </p>
        </div>
        <PanelSearch hits={data.hits} />
      </header>

      {/* ————————————————————————————————————— bölümler */}
      <section>
        <Baslik>Çalışma Alanı</Baslik>
        <ul className="border-t">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="group flex min-h-16 items-center gap-3 border-b px-2 py-3 transition-colors hover:bg-muted/50 sm:gap-4 sm:px-3"
              >
                <span className="flex size-9 shrink-0 items-center justify-center border bg-muted/40 text-foreground/80 transition-colors group-hover:border-primary group-hover:text-primary">
                  <BrandIcon name={s.icon as BrandIconName} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{s.label}</span>
                  {/* Açıklama telefonda DÜŞER: orada satırın işi "nereye
                      gidiyorum"u söylemektir, bölümü tanıtmak değil. */}
                  <span className="hidden truncate text-[12px] text-muted-foreground sm:block">
                    {s.hint}
                  </span>
                </span>
                {data.counts[s.href] && (
                  <span className="shrink-0 font-mono text-[12px] whitespace-nowrap text-muted-foreground">
                    {data.counts[s.href]}
                  </span>
                )}
                <ArrowRight
                  className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ————————————————————————————————————— dikkat + yaklaşan */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <Baslik>Dikkat İsteyenler</Baslik>
          {data.signals.length === 0 ? (
            <p className="border border-dashed px-4 py-6 text-sm text-muted-foreground">
              Bekleyen bir şey yok — geciken sipariş, eksik fiyat ya da kontrol bekleyen
              üretim kaydı bulunmuyor.
            </p>
          ) : (
            <ul className="grid gap-2">
              {data.signals.map((s) => (
                <li key={s.key}>
                  <Link
                    href={s.href}
                    className="flex items-start gap-3 border px-3 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <TriangleAlert
                      className={
                        s.tone === "uyari"
                          ? "mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                          : "mt-0.5 size-4 shrink-0 text-muted-foreground"
                      }
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-mono font-semibold tabular-nums">
                        {formatNum(s.count)}
                      </span>{" "}
                      {s.label}
                    </span>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <Baslik>Yaklaşan</Baslik>
          {data.days.length === 0 ? (
            <p className="border border-dashed px-4 py-6 text-sm text-muted-foreground">
              Önümüzdeki otuz günde tarihli bir kayıt yok. Termin ve sevk günleri Satış
              Takibi’nden, teslim günleri Satın Alma’dan gelir.
            </p>
          ) : (
            <ol className="grid gap-px border bg-border">
              {data.days.map((gun) => (
                <li key={gun.date} className="grid gap-2 bg-card px-3 py-2.5 sm:grid-cols-[6rem_1fr] sm:gap-3">
                  <div className="flex items-baseline gap-2 sm:flex-col sm:gap-0.5">
                    <span
                      className={
                        gun.overdue
                          ? "font-mono text-[13px] font-semibold text-amber-700 dark:text-amber-400"
                          : "font-mono text-[13px] font-semibold"
                      }
                    >
                      {gun.label}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {gun.date.split("-").reverse().join(".")}
                    </span>
                  </div>
                  <ul className="grid gap-1">
                    {gun.items.map((k, i) => (
                      <li key={`${k.kind}-${k.label}-${i}`}>
                        <Link
                          href={k.href}
                          // DOKUNMA HEDEFİ: satır 20px ölçüldü (telefon ve
                          // tablette). `.oc-tap` DEĞİL `pointer-coarse:py-*`
                          // kullanılır — evin kuralı liste SATIRLARINI istisna
                          // tutar (dar ekran md. 1): görünmez bir 44px katman
                          // burada üst üste binen hedefler üretirdi, satırın
                          // kendi ritmini büyütmek doğru olandır.
                          className="-mx-1 flex items-baseline gap-2 rounded-none px-1 py-1 text-[13px] hover:bg-muted/60 hover:underline pointer-coarse:py-2.5"
                        >
                          <span className="oc-bullet mt-1.5" aria-hidden />
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            {k.kind}
                          </span>
                          <span className="min-w-0 truncate" title={k.hint ?? k.label}>
                            <span className="font-medium">{k.label}</span>
                            {k.hint && (
                              <span className="text-muted-foreground"> · {k.hint}</span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* ————————————————————————————————————— sana ait
          Bölüm YALNIZ DOLUYKEN çizilir. Herkese "size atanmış çizim yok" demek,
          çizim atanması hiç beklenmeyen bir satınalmacıya olmayan bir eksiklik
          göstermek olurdu. */}
      {data.mine.length > 0 && (
        <section>
          <Baslik>Sana Ait Teknik Resimler</Baslik>
          <ul className="grid gap-px border bg-border sm:grid-cols-2">
            {data.mine.map((m) => (
              <li key={`${m.href}-${m.code}`} className="bg-card">
                <Link
                  href={m.href}
                  className="flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <span className="shrink-0 font-mono text-[13px] font-medium text-primary">
                    {m.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium" title={m.name}>
                      {m.name || "—"}
                    </span>
                    {m.project && (
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {m.project}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 border px-1.5 py-0.5 text-[11px] whitespace-nowrap text-muted-foreground">
                    {DRAWING_PLAN_STATUS_LABELS[m.status as DrawingPlanStatus] ?? m.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ————————————————————————————————————— bildirimler (iskelet)
          KUTU BOŞ AMA YALAN SÖYLEMİYOR. Kullanıcı kararı: bildirim defteri
          sonra gelecek, yeri şimdiden ayrılsın. Buraya sahte bir akış koymak
          panoya olan güveni ilk gün bitirirdi; kutu ne olduğunu ve YUKARIDA
          gerçek sinyallerin durduğunu söyler. */}
      <section>
        <Baslik>Bildirimler</Baslik>
        <div className="flex items-start gap-3 border border-dashed px-4 py-5">
          <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 text-sm text-muted-foreground">
            <p className="text-foreground">Bildirim defteri henüz kurulmadı.</p>
            <p className="mt-1">
              Kurulduğunda size gelen tekil bildirimler (sipariş onayı, atanan çizim,
              yorum) burada okundu/okunmadı olarak birikecek. Bugün dikkat isteyen her
              şey <span className="text-foreground">Dikkat İsteyenler</span> ve{" "}
              <span className="text-foreground">Yaklaşan</span> bölümlerinde duruyor.
            </p>
          </div>
        </div>
      </section>

      {/* Takvim ızgarası bilinçli olarak YOK: bugünkü veri yoğunluğunda ayın
          günlerinin çoğu boş kalırdı ve boş bir ızgara, dolu bir listeden çok
          daha az şey söyler. Kullanıcı kararı: yaklaşan şeridi. */}
      <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <CalendarClock className="size-3.5 shrink-0" aria-hidden />
        Yaklaşan listesi otuz günlük penceredir; tarihlerin tamamı ilgili bölümün kendi
        ekranındadır.
      </p>
    </div>
  );
}
