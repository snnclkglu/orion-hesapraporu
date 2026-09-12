export type MaintenanceRun = {
  started_at: string;
  mode: "apply" | "dry-run";
  status: "running" | "completed" | "failed" | "expired";
  candidates: number;
  removed: number;
  failed: number;
};

export function MaintenanceStatus({ run, unavailable = false, now }: { run: MaintenanceRun | null; unavailable?: boolean; now: number }) {
  const late = run && now - new Date(run.started_at).getTime() > 27 * 60 * 60 * 1000;
  const interrupted = run?.status === "running" && now - new Date(run.started_at).getTime() > 15 * 60 * 1000;
  const problem = unavailable || late || interrupted || run?.status === "failed" || run?.status === "expired";
  return (
    <section className="ac-card mx-auto mt-6 w-full max-w-5xl text-sm" aria-label="Görsel bakımı">
      <h2 className="font-semibold">Görsel bakımı</h2>
      <p className={problem ? "mt-2 text-destructive" : "mt-2 text-muted-foreground"}>
        {unavailable ? "Bakım bilgisi şu anda alınamıyor. Geri bildirimleri kullanmaya devam edebilirsiniz."
          : !run ? "Otomatik bakım henüz başlatılmadı."
          : problem ? "Bakımın kontrol edilmesi gerekiyor. Son çalışma tamamlanmamış veya beklenen sürede yenilenmemiş."
          : run.status === "running" ? "Bakım devam ediyor."
          : run.mode === "dry-run" ? "Silmesiz kontrol tamamlandı."
          : "Son bakım tamamlandı."}
      </p>
      {run && <p className="mt-2 leading-relaxed text-muted-foreground">
        {new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(run.started_at))}
        {" · "}{run.candidates} aday · {run.removed} temizlenen · {run.failed} başarısız
      </p>}
      <p className="mt-2 text-muted-foreground">Aktif profil fotoğrafları ve gönderilmiş geri bildirimlerin ekleri korunur.</p>
    </section>
  );
}
