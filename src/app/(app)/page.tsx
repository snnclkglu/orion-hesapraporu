// AÇILIŞ SAYFASI — giriş sonrası ilk ekran.
//
// Adres KÖKTÜR (`/`) ve bu bilinçlidir: giriş sonrası bir yönlendirme zinciri
// (`/` → `/panel` → …) her oturumda bir fazladan gidiş-dönüş eder ve tarayıcı
// geçmişinde geri tuşunu kırar. Sayfa `(app)` grubunun içindedir, yani kabuğu
// ve yetki kapısını diğer bölümlerle paylaşır.
//
// KRİTİK YOL: oturum + profil + tercih (PK'den tek satır). Bölümler kendi
// Suspense sınırlarının arkasında paralel akar (`panel/loaders.tsx`): iskelet
// anında gelir, her bölüm verisi hazır olunca dolar, düşen bölüm yalnız
// kendini "okunamadı" olarak işaretler.
//
// TERCİH ÜÇ HÂL BİLİR: GİZLİ bölümün yuvası hiç kurulmaz (sorgusu koşmaz),
// KATLI bölümün yalnız başlığı çizilir (gövde yüklenmez, "Aç" refresh ile
// getirir), kalan her şey tam yüklenir. Yerleşim `PanelView`dedir — aynı
// çerçeveyi auth'suz önizleme de basar (`/dev/panel-preview`).

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/profile";
import { bugunIstanbul, loadPanelPrefs } from "./panel/data";
import { PanelView, type PanelSlots } from "./panel/panel-view";
import { PanelSearch } from "./panel/panel-search";
import {
  ActivityLoader,
  AgendaLoader,
  MyDayLoader,
  NotificationsLoader,
  SignalsLoader,
  WorkspaceLoader,
} from "./panel/loaders";
import { QuickActionsSection } from "./panel/sections/quick-actions";
import { SectionSkeleton } from "./panel/sections/skeletons";
import { CollapsedSection } from "./panel/sections/collapsed";
import { SectionsMenu } from "./panel/prefs-client";

export default async function PanelPage() {
  // Kabuk zaten oturum ister; buradaki kontrol kimliği tipe kazandırmak
  // içindir. Profil sorgusu `cache` sayesinde kabuğunkiyle TEKtir.
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const today = bugunIstanbul();
  const prefs = await loadPanelPrefs(supabase, profile.userId);
  const gizli = new Set(prefs.hidden);
  const katli = new Set(prefs.collapsed);

  const sections: PanelSlots = {};

  if (!gizli.has("hizli")) {
    // Şerit veri çekmez (rol yeter) — Suspense gerekmez.
    sections.hizli = <QuickActionsSection role={profile.role} />;
  }

  // Benim Günüm bölgesi iki tercihi birden taşır: "gunum" (görev/favori/
  // resim çeyrekleri) ve "yapilacak" (madde çeyreği). İkisi de gizliyse bölge
  // hiç kurulmaz; bölge katlıysa yalnız başlık çizilir.
  const gunumGizli = gizli.has("gunum");
  const yapilacakGizli = gizli.has("yapilacak");
  if (!gunumGizli || !yapilacakGizli) {
    sections.gunum = katli.has("gunum") ? (
      <CollapsedSection id="gunum" />
    ) : (
      <Suspense
        fallback={
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <SectionSkeleton
              baslik={gunumGizli ? "Yapılacaklarım" : "Görevlerim"}
              rows={3}
            />
            {!gunumGizli && !yapilacakGizli && (
              <SectionSkeleton baslik="Yapılacaklarım" rows={3} />
            )}
          </div>
        }
      >
        <MyDayLoader
          userId={profile.userId}
          today={today}
          gunumGizli={gunumGizli}
          yapilacakGizli={yapilacakGizli}
        />
      </Suspense>
    );
  }

  if (!gizli.has("alan")) {
    sections.alan = katli.has("alan") ? (
      <CollapsedSection id="alan" />
    ) : (
      <Suspense fallback={<SectionSkeleton baslik="Çalışma Alanı" rows={6} satir="h-16" />}>
        <WorkspaceLoader role={profile.role} today={today} />
      </Suspense>
    );
  }

  if (!gizli.has("sinyal")) {
    sections.sinyal = katli.has("sinyal") ? (
      <CollapsedSection id="sinyal" />
    ) : (
      <Suspense fallback={<SectionSkeleton baslik="Dikkat İsteyenler" rows={3} />}>
        <SignalsLoader role={profile.role} today={today} />
      </Suspense>
    );
  }

  if (!gizli.has("ajanda")) {
    sections.ajanda = katli.has("ajanda") ? (
      <CollapsedSection id="ajanda" />
    ) : (
      <Suspense fallback={<SectionSkeleton baslik="Yaklaşan" rows={4} />}>
        <AgendaLoader role={profile.role} userId={profile.userId} today={today} />
      </Suspense>
    );
  }

  if (!gizli.has("bildirim")) {
    sections.bildirim = katli.has("bildirim") ? (
      <CollapsedSection id="bildirim" />
    ) : (
      <Suspense fallback={<SectionSkeleton baslik="Bildirimler" rows={3} />}>
        <NotificationsLoader />
      </Suspense>
    );
  }

  if (!gizli.has("akis")) {
    sections.akis = katli.has("akis") ? (
      <CollapsedSection id="akis" />
    ) : (
      <Suspense fallback={<SectionSkeleton baslik="Son Hareketler" rows={4} />}>
        <ActivityLoader />
      </Suspense>
    );
  }

  return (
    <PanelView
      role={profile.role}
      displayName={profile.fullName || profile.email}
      today={today}
      search={<PanelSearch />}
      sections={sections}
      araclar={<SectionsMenu prefs={prefs} />}
    />
  );
}
