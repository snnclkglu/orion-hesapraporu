// KATLI BÖLÜM — başlık çizilir, gövde YÜKLENMEZ (sorgusu hiç koşmaz; bayt
// taşımama dersi, md. 21). "Aç" bir tıkla tercihi çevirir ve refresh gövdeyi
// getirir.

import type { PanelSectionId } from "@/lib/panel-prefs";
import { PANEL_SECTION_LABELS } from "@/lib/panel-prefs";
import { SectionExpandButton } from "../prefs-client";
import { Baslik } from "./section-frame";

export function CollapsedSection({ id }: { id: PanelSectionId }) {
  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <Baslik>{PANEL_SECTION_LABELS[id]}</Baslik>
        <SectionExpandButton id={id} />
      </div>
    </section>
  );
}
