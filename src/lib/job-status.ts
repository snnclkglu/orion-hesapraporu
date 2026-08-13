// İş emri durumu — tek tanım yeri.
//
// `projects.status` yalnız aktif/arşiv taşır; İŞİN akışı bundan zengindir:
// beklemeye alınan (pasif) ve tamamlanan işler ayrı durumlardır. Etiket, renk
// ve sıra burada tanımlanır; liste, detay ve filtreler buradan okur.

export const JOB_STATUSES = ["active", "passive", "completed", "archived"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  active: "Aktif",
  passive: "Pasif",
  completed: "Tamamlandı",
  archived: "Arşiv",
};

/**
 * Durum noktasının rengi (Tailwind sınıfı). Aktif yeşil, pasif kehribar
 * (beklemede), tamamlandı kömür (kapanmış ama canlı kayıt), arşiv soluk gri.
 * KIRMIZI kullanılmaz: bu uygulamada kırmızı "kontrol sağlanmadı" demektir.
 */
export const JOB_STATUS_DOT: Record<JobStatus, string> = {
  active: "bg-success",
  passive: "bg-amber-500",
  completed: "bg-foreground",
  archived: "bg-muted-foreground/40",
};

/** Bilinmeyen/eski değerleri güvenli varsayılana indirger. */
export function jobStatusOf(value: unknown): JobStatus {
  return JOB_STATUSES.includes(value as JobStatus) ? (value as JobStatus) : "active";
}

export function jobStatusLabel(value: unknown): string {
  return JOB_STATUS_LABELS[jobStatusOf(value)];
}

// ——————————————————————————————— SEVK TARİHİ → TAMAMLANDI (13.08.2026)

/**
 * İşin BÜTÜN kalemleri sevk edildi mi?
 *
 * Kural "herhangi biri" DEĞİL "hepsi"dir ve fark yalnız ÇOK KALEMLİ işlerde
 * görünür (canlı defterde 62 işin 11'i; en büyüğü dokuz kalemli
 * "MUHTELİF VİNÇLER"). Orada ilk vincin sevk edilmesi işi bitirmez — atölye
 * kalan sekizini imal ediyordur ve "Tamamlandı" yazan bir satır bunu gizlerdi.
 * Tek kalemli işte (62'nin 51'i) iki okuma zaten aynı sonucu verir.
 *
 * KALEMSİZ İŞ SEVK EDİLMİŞ SAYILMAZ: boş listede `every` doğru döner ve
 * kalemleri henüz girilmemiş yeni bir iş açılır açılmaz "Tamamlandı" olurdu.
 *
 * Ticari kaydı HİÇ OLMAYAN kalem de sevk edilmemiştir: `job_item_sales`
 * satırları önceden üretilmez (md. 16), yani kaydı olmayan kalem "sevk yok"
 * demektir — çağıran onu `shipmentDate: null` olarak geçirir.
 */
export function allItemsShipped(
  items: readonly { shipmentDate: string | null }[]
): boolean {
  return items.length > 0 && items.every((i) => !!i.shipmentDate);
}

/**
 * Sevk tarihi girildiğinde iş durumu OTOMATİK "Tamamlandı" olur mu?
 *
 * Otomatik geçiş YALNIZ `active`ten yapılır ve bu, kullanıcının istediği
 * "manuel müdahale" güvencesinin ta kendisidir — ayrı bir "elle ayarlandı"
 * sütununa gerek bırakmaz:
 *
 *   · `active` sütunun VARSAYILANIdır (`jobs.status default 'active'`,
 *     `jobStatusOf` de oraya düşer). Yani "kimse bir şey söylemedi" demektir
 *     ve otomatik kararın dokunabileceği tek hâl budur.
 *   · `passive` · `completed` · `archived` üçü de bir İNSAN KARARIDIR. Beklemeye
 *     alınmış bir işi sevk tarihi yüzünden "tamamlandı" yapmak, kullanıcının
 *     az önce verdiği kararı ezmek olurdu.
 *
 * Kullanıcı İşler sayfasından durumu ne yaparsa yapsın otomatik kural onu bir
 * daha ezmez; yalnız `active`e geri döndürülmüş bir işe YENİ bir sevk tarihi
 * girilirse kural yeniden çalışır — o da bir ezme değil, yeni bir olgudur.
 */
export function autoCompletesOnShipment(status: unknown): boolean {
  return jobStatusOf(status) === "active";
}
