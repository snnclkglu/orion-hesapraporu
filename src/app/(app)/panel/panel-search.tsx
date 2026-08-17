"use client";

// PANONUN KAHRAMANI ARAMADIR.
//
// Sayfanın sorusu "nereye gideceğim" değil "hangi işe bakacağım"dır ve cevabı
// çoğu zaman bir NUMARADIR: 0057, 0043-00-1000, ASTOR. Bu yüzden arama bir
// köşedeki büyüteç değil, sayfanın ilk ve en büyük öğesidir.
//
// PENCERE (modal) DEĞİL: aramanın korunmuş bir odağa ihtiyacı yok ve pencere,
// arkasındaki panoyu kapatıp kullanıcıyı bir kararın içine hapsederdi. Sonuçlar
// alanın hemen altında, sayfanın akışında açılır.
//
// SÜZME İSTEMCİDEDİR: her tuş vuruşunda Frankfurt'a gitmek aramayı yavaş
// yapardı ve kullanıcı yazarken bekleyemez. Defter artık RSC yüküyle DEĞİL,
// paylaşılan istemci deposundan gelir (`lib/command-index-store`): boşta ya da
// ilk odakta bir kez çekilir, Ctrl+K paleti aynı depoyu okur.

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, CornerDownLeft } from "lucide-react";
import { panelAra, PANEL_KIND_LABELS, type PanelHit } from "@/lib/panel";
import {
  ensureCommandIndex,
  useCommandIndex,
} from "@/lib/command-index-store";
import { cn } from "@/lib/utils";

const BOS_DEFTER: PanelHit[] = [];

export function PanelSearch({
  hits: sabitHits,
}: {
  /** Yalnız dev önizleme için: auth'suz sayfada depo 401 alır, fikstür bunu
   *  aşar. Gerçek sayfa prop VERMEZ. */
  hits?: PanelHit[];
} = {}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [aktif, setAktif] = useState(0);
  const [odakli, setOdakli] = useState(false);
  const girdiRef = useRef<HTMLInputElement>(null);
  const listeId = useId();

  const durum = useCommandIndex();
  // Boş defter SABİT referanstır ve seçim `useMemo`dadır: her çizimde yeni
  // bir `[]` üretmek aşağıdaki arama memo'sunu her turda geçersiz kılardı.
  const hits = useMemo(
    () => sabitHits ?? (durum.status === "ready" ? durum.data.hits : BOS_DEFTER),
    [sabitHits, durum]
  );
  const defterHazir = sabitHits !== undefined || durum.status === "ready";
  const defterHata = sabitHits === undefined && durum.status === "error";

  // Defter BOŞTA çekilir (kullanıcı kutuya hiç dokunmadan hazır olsun diye)
  // ama sayfanın ilk boyamasını beklemez. `requestIdleCallback` olmayan
  // tarayıcıda (Safari) kısa bir zamanlayıcı aynı işi görür. Bu bir durum
  // senkronu değil bir AĞ İSTEĞİ tetiğidir — effect'in meşru işi.
  useEffect(() => {
    if (sabitHits !== undefined) return;
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => ensureCommandIndex());
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(() => ensureCommandIndex(), 1500);
    return () => clearTimeout(t);
  }, [sabitHits]);

  const { gruplar, toplam } = useMemo(() => panelAra(hits, q), [hits, q]);
  const duz = useMemo(() => gruplar.flatMap((g) => g.hits), [gruplar]);
  const acik = q.trim().length >= 2;

  // ⌘K / Ctrl+K ARTIK BURADA DEĞİL (kullanıcı kararı, 16.08.2026): kısayolun
  // sahibi her sayfadan açılan KOMUT PALETİdir (components/command-palette).
  // Bu kutu panonun kahramanı olmayı sürdürür — yalnız kısayol rozetini
  // devretti; iki dinleyici aynı tuşta yarışsaydı hangisinin kazandığı
  // sayfaya göre değişirdi.

  function klavye(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQ("");
      girdiRef.current?.blur();
      return;
    }
    if (!acik || duz.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktif((i) => (i + 1) % duz.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktif((i) => (i - 1 + duz.length) % duz.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const secilen = duz[aktif];
      if (secilen) router.push(secilen.href);
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-3 border bg-card px-4 transition-colors",
          // Odak kırmızı omurgayla değil TAM ÇERÇEVEYLE gösterilir: kalın renkli
          // bir sol kenar bu dilde sol menünün yapısal imzasıdır, bir girdi
          // durumu değil.
          odakli ? "border-primary" : "border-border"
        )}
      >
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={girdiRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            // Seçim SORGUYLA BİRLİKTE sıfırlanır ve bunu bir `useEffect`
            // yapmaz: sorgu zaten burada değişiyor, etkiye taşımak aynı işi
            // bir tur sonra ve fazladan bir çizimle yapardı. Eski indeks yeni
            // listede başka bir kaydı gösterir ve Enter kullanıcıyı
            // istemediği sayfaya götürürdü.
            setAktif(0);
          }}
          onKeyDown={klavye}
          onFocus={() => {
            setOdakli(true);
            // Odak, boşta çekim henüz olmadıysa (ya da hata aldıysa) defteri
            // ister — `ensureCommandIndex` hazır/yüklenirken sessizce döner.
            if (sabitHits === undefined) ensureCommandIndex();
          }}
          onBlur={() => setOdakli(false)}
          type="search"
          role="combobox"
          aria-expanded={acik}
          aria-controls={listeId}
          aria-autocomplete="list"
          aria-label="İş, kalem, müşteri, rapor ya da resim grubu ara"
          placeholder="İş no, ürün, müşteri, rapor ya da resim grubu ara…"
          className="h-14 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground/70 pointer-fine:text-sm"
        />
      </div>

      {acik && (
        <div
          id={listeId}
          role="listbox"
          aria-label="Arama sonuçları"
          // Sonuçlar sayfanın AKIŞINDA değil ÜSTÜNDE durur: liste açılıp
          // kapandıkça altındaki pano zıplasaydı, kullanıcı yazarken bakışını
          // kaybederdi.
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-[60dvh] overflow-y-auto border bg-card shadow-lg"
        >
          {!defterHazir ? (
            // Defter gelmeden "bulunamadı" demek YALAN olurdu — kayıt belki
            // var, henüz inmedi. Yüklenme ve hata ayrı cümlelerdir.
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {defterHata
                ? "Defter yüklenemedi — bağlantıyı kontrol edip kutuya yeniden odaklanın."
                : "Defter yükleniyor…"}
            </p>
          ) : duz.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{q.trim()}</span> için kayıt
              bulunamadı. İş numarası (<span className="font-mono">0057</span>), kalem numarası
              (<span className="font-mono">0057-03</span>) ya da müşteri adıyla deneyin.
            </p>
          ) : (
            <>
              {gruplar.map((grup) => (
                <section key={grup.kind}>
                  <h3 className="oc-kicker sticky top-0 z-10 border-b bg-muted/70 px-4 py-2 text-muted-foreground backdrop-blur-sm">
                    {PANEL_KIND_LABELS[grup.kind]}
                  </h3>
                  <ul>
                    {grup.hits.map((hit) => {
                      const i = duz.indexOf(hit);
                      return (
                        <li key={`${hit.kind}-${hit.code}-${hit.href}-${hit.label}`}>
                          <Link
                            href={hit.href}
                            role="option"
                            aria-selected={i === aktif}
                            onMouseEnter={() => setAktif(i)}
                            // `onMouseDown` ile gidilir: `blur` sonuç listesini
                            // kapatıyor ve `click` hiç ulaşmıyordu.
                            onMouseDown={(e) => {
                              e.preventDefault();
                              router.push(hit.href);
                            }}
                            className={cn(
                              "flex items-baseline gap-3 border-b px-4 py-2.5 text-sm last:border-b-0",
                              i === aktif ? "bg-muted" : "hover:bg-muted/50"
                            )}
                          >
                            <span className="shrink-0 font-mono text-[13px] font-medium text-primary">
                              {hit.code || "—"}
                            </span>
                            <span className="min-w-0 flex-1 truncate" title={hit.label}>
                              {hit.label}
                            </span>
                            {hit.hint && (
                              <span
                                className="hidden max-w-[16rem] shrink-0 truncate text-[12px] text-muted-foreground sm:block"
                                title={hit.hint}
                              >
                                {hit.hint}
                              </span>
                            )}
                            {i === aktif && (
                              <CornerDownLeft
                                className="size-3.5 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {/* KIRPMA SESSİZ OLMAZ: grup başına altı satır gösteriliyor ve
                  kaç tanesinin görünmediği yazılıyor. */}
              {toplam > duz.length && (
                <p className="border-t px-4 py-2 text-[12px] text-muted-foreground">
                  {toplam} kayıttan {duz.length} tanesi gösteriliyor — aramayı daraltın.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
