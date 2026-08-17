// BENİM GÜNÜM BÖLGESİ — kişiye özel dört çeyrek tek ızgarada:
// Görevlerim | Yapılacaklarım (Faz 4 yuvası) | Favoriler·Son Bakılanlar |
// Sana Ait Teknik Resimler. Izgara SARMALAYICISI buradadır (PanelView'de
// değil): bölgenin "hepsi boşsa hiç çizilme" kararı ancak veriyi gören yerde
// verilebilir.

import { MyTasksSection, type MyTaskRow } from "./my-tasks";
import {
  FavoritesRecentsSection,
  type FavoriteJobRef,
} from "./favorites-recents";
import { MineDrawingsSection } from "./mine-drawings";
import type { MineRow } from "../data";

export function MyDayRegion({
  tasks,
  taskTotal,
  favorites,
  mine,
  today,
  todos,
  gunumGizli = false,
}: {
  tasks: MyTaskRow[];
  taskTotal: number;
  favorites: FavoriteJobRef[];
  mine: MineRow[];
  today: string;
  /** Kişisel yapılacaklar yuvası (Faz 4) — geldiğinde bölge kalıcılaşır. */
  todos?: React.ReactNode;
  /** Tercihle gizlendi: görev/favori/resim çeyrekleri hiç çizilmez. */
  gunumGizli?: boolean;
}) {
  // Sunucudan gelen üçü de boşsa ve yapılacaklar yuvası yoksa bölge HİÇ
  // ÇİZİLMEZ (mine-strip kuralı). Son Bakılanlar cihazda yaşar ve kendini
  // gizler; yalnız-recents durumu todos yuvası gelene dek görünmez kalır.
  if (
    (gunumGizli || (tasks.length === 0 && favorites.length === 0 && mine.length === 0)) &&
    !todos
  ) {
    return null;
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      {!gunumGizli && <MyTasksSection rows={tasks} total={taskTotal} today={today} />}
      {todos}
      {!gunumGizli && <FavoritesRecentsSection favorites={favorites} />}
      {!gunumGizli && <MineDrawingsSection mine={mine} />}
    </div>
  );
}
