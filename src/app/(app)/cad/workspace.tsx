"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Monitor, RefreshCw, Upload, FileText, CheckCircle2, Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { CAD_BUCKET, MAX_SOURCE_BYTES, deviceAvailability, displayCell, stateLabels, type CadArtifact, type CadDevice, type CadJob, type CadOptions } from "@/lib/cad/contracts";
import { cadAction, cadSnapshot } from "./actions";
import { cadExportStart, cadExportFile, cadExportFinish, cadItemOptions } from "./export-actions";
import "./workspace.css";

export interface CadSnapshot { canWrite: boolean; devices: CadDevice[]; jobs: CadJob[]; selected: CadJob | null; artifacts: CadArtifact[] }
const inputClass = "cad-input";
export function CadWorkspace({ initial, preview = false }: { initial: CadSnapshot; preview?: boolean }) {
  const [state, setState] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | undefined>(initial.selected?.id);
  const [deviceId, setDeviceId] = useState(initial.devices.find(d => !d.revoked_at)?.id ?? "");
  const [name, setName] = useState("");
  const [pair, setPair] = useState<{ code: string; expiresAt: string } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [paper, setPaper] = useState<CadOptions["paper"]>("A3");
  const [duplicates, setDuplicates] = useState<CadOptions["duplicates"]>("hepsi");
  const [ack, setAck] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [folderName, setFolderName] = useState("");
  const [itemId, setItemId] = useState("");
  const [items, setItems] = useState<{ id: string; item_no: string; product_name: string }[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<"sheets" | "materials" | "files">("sheets");
  const [limit, setLimit] = useState(50);
  const selectedRef = useRef(selectedId);
  const refreshedAt = useRef(0);
  const refreshing = useRef(false);
  const uploadId = useRef<{ signature: string; id: string } | null>(null);
  const localBusy = useRef(false);
  const refresh = useCallback(async (id = selectedRef.current) => {
    if (preview || refreshing.current) return;
    refreshing.current = true;
    const sequence = ++refreshedAt.current;
    try {
      const result = await cadSnapshot(id);
      if (sequence === refreshedAt.current && id === selectedRef.current) {
        if (result.ok) setState(result.data);
        else setError(result.error);
      }
    } finally { refreshing.current = false; }
  }, [preview]);
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); if (!document.hidden && !localBusy.current) void refresh(); }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    if (preview) return;
    void cadItemOptions().then(r => { if (r.ok) setItems(r.items); });
  }, [preview]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  const run = async (label: string, fn: () => Promise<void>) => {
    if (localBusy.current || preview) return;
    localBusy.current = true; setBusy(label); setError(""); setNotice("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "İşlem tamamlanamadı."); }
    finally { localBusy.current = false; setBusy(""); await refresh(); }
  };
  const command = async (action: string, payload: unknown) => {
    const response = await cadAction(action, payload);
    if (!response.ok) throw new Error(response.error);
    return response.data;
  };
  const chooseJob = async (job: CadJob) => {
    selectedRef.current = job.id; setSelectedId(job.id); setReviewed(false); setSearch(""); setLimit(50); setTab("sheets");
    setFolderName(job.source_name.replace(/\.dwg$/i, ""));
    if (preview) return;
    const response = await cadSnapshot(job.id);
    if (response.ok && selectedRef.current === job.id) setState(response.data);
    else if (!response.ok) setError(response.error);
  };
  const upload = () => run("DWG yükleniyor", async () => {
    if (!file) throw new Error("Bir DWG dosyası seçin.");
    if (file.size > MAX_SOURCE_BYTES) throw new Error("İlk sürümde dosya sınırı 100 MB.");
    const signature = `${file.name}:${file.size}:${file.lastModified}:${deviceId}:${paper}:${duplicates}`;
    if (uploadId.current?.signature !== signature) uploadId.current = { signature, id: crypto.randomUUID() };
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map(v => v.toString(16).padStart(2, "0")).join("");
    const data = await command("create", { id: uploadId.current.id, deviceId, name: file.name, size: file.size, sha256: hash, options: { paper, duplicates }, acknowledged: ack });
    if (!data.alreadyQueued && !data.upload.exists) {
      const result = await createClient().storage.from(CAD_BUCKET).uploadToSignedUrl(data.upload.path, data.upload.token, file, { contentType: "application/octet-stream" });
      if (result.error) throw new Error("DWG yüklenemedi. Dosyayı seçili bırakıp yeniden deneyebilirsiniz.");
    }
    await command("queue", { jobId: data.jobId });
    selectedRef.current = data.jobId; setSelectedId(data.jobId); setNotice("DWG sıraya alındı. Yardımcı işi aldığında tarayıcıyı kapatabilirsiniz.");
    uploadId.current = null; setFile(null);
  });
  const exportJob = () => run("Paket aktarılıyor", async () => {
    const job = state.selected;
    if (!job) return;
    const start = await cadExportStart({ jobId: job.id, folderName, itemId: itemId || null });
    if (!start.ok) throw new Error(start.error);
    if (start.exportedAt) { setNotice("Bu işlem daha önce aktarıldı. Teknik Resimler’deki paket korunuyor."); return; }
    for (let i = 0; i < start.artifacts.length; i++) {
      setBusy(`Dosyalar aktarılıyor · ${i + 1}/${start.artifacts.length}`);
      const result = await cadExportFile({ jobId: job.id, artifactId: start.artifacts[i].id });
      if (!result.ok) throw new Error(result.error);
    }
    const verify = await cadExportFinish(job.id, "verify");
    if (!verify.ok) throw new Error(verify.error);
    for (const phase of ["excel", "pdf"] as const) {
      let offset: number | null = 0;
      for (let step = 0; offset !== null && step < 250; step++) {
        setBusy(phase === "excel" ? "Malzeme listesi okunuyor" : "PDF bilgileri okunuyor");
        const response: Response = await fetch(`/drawings/${start.packageId}/import?asama=${phase}&ofset=${offset}&adet=5`, { method: "POST" });
        if (!response.ok) throw new Error("Paket içeriği okunamadı. Aktarımı yeniden deneyebilirsiniz.");
        const data: { kalan: number; sonraki: number | null; okunamayan?: unknown[] } = await response.json();
        if (data.okunamayan?.length) throw new Error("Bazı paket dosyaları okunamadı. Teknik Resimler bölümünden kontrol edin.");
        offset = data.kalan ? data.sonraki : null;
      }
      if (offset !== null) throw new Error("İçe aktarma sınırına ulaşıldı; Teknik Resimler bölümünden devam edin.");
    }
    const finish = await cadExportFinish(job.id, "reconcile");
    if (!finish.ok) throw new Error(finish.error);
    setNotice("Sonuçlar Teknik Resimler paketine aktarıldı. Paketteki eşleştirmeleri kontrol edebilirsiniz.");
  });
  const currentDevice = state.devices.find(d => d.id === deviceId);
  const available = deviceAvailability(currentDevice, now);
  const selected = state.selected;
  const result = selected?.result;
  const visibleRows = (tab === "sheets" ? result?.paftalar ?? [] : result?.malzeme ?? []).filter(row => !search || Object.values(row).some(v => typeof v === "string" && v.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr"))));

  return <div className="cad-workspace">
    <div className="cad-intro"><div><span className="cad-eyebrow">ÇİZİMDEN PAFTAYA</span><h1>Çizimleriniz, kendi AutoCAD’inizle.</h1><p>DWG içindeki paftaları ayırın, PDF’leri ve malzeme listesini inceleyin. Onayladığınız sonuçları Teknik Resimler’e aktarın.</p></div><div className="cad-local"><Monitor size={20} /><span>İşlem sizin bilgisayarınızda<br /><small>Windows · Tam AutoCAD · ORION Yardımcısı</small></span></div></div>
    {preview && <p className="cad-message">Görsel önizleme · Buradaki düğmeler gerçek işlem başlatmaz.</p>}
    {error && <div role="alert" className="cad-error">{error}<Button variant="ghost" onClick={() => void refresh()}>Yeniden kontrol et</Button></div>}
    {notice && <p role="status" className="cad-message">{notice}</p>}
    {busy && <p role="status" className="cad-message"><Loader2 className="animate-spin" size={16} />{busy} · Yükleme ve aktarım sırasında bu sekmeyi açık tutun.</p>}
    <div className="cad-setup-grid">
      <section className="cad-card"><div className="cad-section-title"><h2><Monitor size={18} /> Bilgisayar bağlantısı</h2><Button variant="ghost" disabled={!!busy} onClick={() => void refresh()} aria-label="Bağlantıyı yenile"><RefreshCw size={16} /></Button></div>
        {state.devices.filter(d => !d.revoked_at).length ? <div className="cad-devices">{state.devices.filter(d => !d.revoked_at).map(d => {
          const availability = deviceAvailability(d, now);
          return <div key={d.id} className="cad-device"><div><strong>{d.name}</strong><p>{availability.label}</p>{d.message && <small>{d.message}</small>}</div>{state.canWrite && <Button variant="ghost" disabled={!!busy} onClick={() => void run("Bağlantı kaldırılıyor", async () => { await command("revoke", { deviceId: d.id }); })}>Bağlantıyı kaldır</Button>}</div>;
        })}</div> : <p className="cad-muted">Henüz bilgisayar bağlanmadı. Yardımcıyı kurup bu hesabınızla eşleştirin.</p>}
        {state.canWrite && <><div className="cad-pair-form"><label>Bilgisayar adı<input className={inputClass} value={name} onChange={e => setName(e.target.value)} maxLength={80} /></label><Button disabled={!!busy || !name.trim()} onClick={() => void run("Bağlantı kodu hazırlanıyor", async () => { setPair(await command("pair", { name })); })}><Link2 size={16} />Bağlantı kodu oluştur</Button></div>
          {pair && <div className="cad-pair-code"><strong>Yardımcıdaki bağlantı ekranına yapıştırın</strong><p>Uygulama adresi: {typeof window !== "undefined" ? window.location.origin : ""}</p><code>{pair.code}</code><small>10 dakika geçerlidir. Yalnız kendi bilgisayarınızdaki yardımcıda kullanın.</small><Button variant="outline" onClick={() => void navigator.clipboard.writeText(pair.code).then(() => setNotice("Bağlantı kodu kopyalandı.")).catch(() => setError("Kodu seçip elle kopyalayabilirsiniz."))}>Kodu kopyala</Button></div>}
          <details className="cad-help"><summary>Yardımcı nasıl kurulur?</summary><ol><li><a href="/cad/helper" className="underline">ORION Yardımcısını indir</a> ve Windows’ta açın.</li><li>Bu sayfadaki uygulama adresini ve bağlantı kodunu yardımcıya girin.</li><li>AutoCAD’deki çizimlerinizi kaydedip kapatın. Yardımcıdan kontrolü başlatın.</li><li>Bağlantı “İşleme hazır” olduğunda DWG yükleyin.</li></ol><p>AutoCAD LT ve macOS bu sürümde desteklenmiyor. Yardımcı çalışırken AutoCAD’de başka çizim açmayın.</p></details></>}
      </section>
      <section className="cad-card"><h2><Upload size={18} /> Yeni işlem</h2>{state.canWrite ? <div className="cad-form">
        <label>İşlemi yapacak bilgisayar<select className={inputClass} value={deviceId} onChange={e => setDeviceId(e.target.value)}><option value="">Bilgisayar seçin</option>{state.devices.filter(d => !d.revoked_at).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <p className="cad-muted" aria-live="polite">{available.label}</p>
        <label className="cad-file">DWG dosyası<input type="file" accept=".dwg" disabled={!!busy || !available.ready} onChange={e => { setFile(e.target.files?.[0] ?? null); uploadId.current = null; }} /><small>En fazla 100 MB. İlk sürüm, dış referans gerektirmeyen tek DWG içindir.</small></label>
        <div className="cad-two"><label>Kâğıt<select className={inputClass} value={paper} onChange={e => setPaper(e.target.value as CadOptions["paper"])}><option value="A3">A3</option><option value="AUTO">Çerçeveden belirle</option></select></label><label>Tekrarlanan paftalar<select className={inputClass} value={duplicates} onChange={e => setDuplicates(e.target.value as CadOptions["duplicates"])}><option value="hepsi">Tümünü incelemeye getir</option><option value="dur">İşlemi durdur</option><option value="alt">Alttaki kopyayı kullan</option><option value="ust">Üstteki kopyayı kullan</option></select></label></div>
        <label className="cad-check"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />Seçtiğim bilgisayarda AutoCAD çizimlerimi kapattım; işlem sırasında AutoCAD’i kullanmayacağım.</label>
        <Button disabled={!!busy || !available.ready || !file || !ack} onClick={upload}><Upload size={16} />İşleme gönder</Button>
        <small>Yükleme tamamlanana kadar sekmeyi açık tutun. İşlem, seçtiğiniz bilgisayar açık ve yardımcı hazırken yürür.</small>
      </div> : <p className="cad-muted">Yeni işlem için Yönetici, Mühendis veya Teknik Ressam yetkisi gerekir. Hazır paketleri Teknik Resimler bölümünden görüntüleyebilirsiniz.</p>}</section>
    </div>
    <section className="cad-card"><div className="cad-section-title"><h2>İşlem geçmişim</h2><small>Son 100 işlem</small></div>{state.jobs.length === 0 ? <div className="cad-empty"><FileText size={30} /><p>İlk çiziminizi gönderdiğinizde işlem burada görünecek.</p></div> : <div className="cad-job-list">{state.jobs.map(job => <button disabled={!!busy} className={`cad-job oc-tap ${selectedId === job.id ? "cad-job-selected" : ""}`} key={job.id} onClick={() => void chooseJob(job)}><span><strong>{job.source_name}</strong><small>{new Date(job.created_at).toLocaleString("tr-TR")} · {state.devices.find(d => d.id === job.device_id)?.name ?? "Bilgisayar"}</small></span><span className={`cad-badge cad-state-${job.status}`}>{stateLabels[job.status]}</span></button>)}</div>}</section>
    {selected && <section className="cad-card cad-results"><div className="cad-section-title"><h2>{selected.source_name}</h2><span className={`cad-badge cad-state-${selected.status}`}>{stateLabels[selected.status]}</span></div>
      <p className="cad-muted">{selected.progress || "Bilgisayar durumu bekleniyor"} · Deneme: {selected.attempts}</p>
      {selected.error && <p className="cad-error">{selected.error}</p>}
      {selected.status === "processing" && selected.lease_until && Date.parse(selected.lease_until) < now && <p className="cad-error">İşleme bağlantısı kesildi. Yardımcıyı kontrol edin; eski işlem otomatik olarak başarılı sayılmaz.</p>}
      <div className="cad-actions"><a className="oc-tap underline" href={`/cad/file?job=${selected.id}`}>Kaynak DWG’yi indir</a>{state.canWrite && ["failed", "cancelled"].includes(selected.status) && <Button disabled={!!busy} variant="outline" onClick={() => void run("Yeniden sıraya alınıyor", async () => { await command("retry", { jobId: selected.id }); })}>Yeniden dene</Button>}{state.canWrite && ["uploading", "queued", "processing", "failed"].includes(selected.status) && <Button disabled={!!busy} variant="outline" onClick={() => void run("İşlem iptal ediliyor", async () => { await command("cancel", { jobId: selected.id }); })}>İptal et</Button>}{selected.status === "uploading" && <Button disabled={!!busy} variant="outline" onClick={() => void run("Dosya kontrol ediliyor", async () => { await command("queue", { jobId: selected.id }); })}>Yüklemeyi kontrol et</Button>}</div>
      {result && <><div className="cad-stats"><div><strong>{result.ozet.pafta}</strong><span>Pafta</span></div><div><strong>{result.ozet.pdf_basarili}</strong><span>PDF</span></div><div><strong>{result.ozet.malzeme_satiri}</strong><span>Malzeme satırı</span></div><div><strong>{result.arac_surum}</strong><span>İşleme sürümü</span></div></div>
        <div className="cad-actions" role="tablist" aria-label="Sonuç türü">{([['sheets','Paftalar'],['materials','Malzemeler'],['files','Dosyalar ve tanı']] as const).map(([key, label]) => <Button role="tab" aria-selected={tab === key} variant={tab === key ? "default" : "outline"} key={key} onClick={() => { setTab(key); setLimit(50); }}>{label}</Button>)}</div>
        {tab !== "files" && <label>Sonuçlarda ara<input className={inputClass} value={search} onChange={e => { setSearch(e.target.value); setLimit(50); }} /></label>}
        {tab === "sheets" && <div className="cad-sheets">{visibleRows.slice(0, limit).map((s, i) => { const pdf = state.artifacts.find(a => a.name === s.pdf && a.kind === "pdf"); return <article key={i} className="cad-sheet"><div><strong>{displayCell(s.resim_no)}</strong><p>{displayCell(s.parca)}</p><small>{displayCell(s.kagit)} · Ölçek {displayCell(s.olcek)}</small></div>{pdf && <a className="oc-tap underline" href={`/cad/file?job=${selected.id}&artifact=${pdf.id}`} target="_blank" rel="noreferrer">PDF aç / indir</a>}{s.uyarilar ? <p className="cad-sheet-warning">{displayCell(s.uyarilar)}</p> : null}</article>; })}</div>}
        {tab === "materials" && <div className="cad-materials">{visibleRows.slice(0, limit).map((m, i) => <article key={i}><strong>{displayCell(m.resim_no)}</strong><span>{displayCell(m.tanim)}</span><dl><div><dt>Malzeme</dt><dd>{displayCell(m.malzeme)}</dd></div><div><dt>Adet</dt><dd>{displayCell(m.adet)}</dd></div><div><dt>Birim ağırlık</dt><dd>{displayCell(m.birim_agirlik)}</dd></div><div><dt>Toplam ağırlık</dt><dd>{displayCell(m.toplam_agirlik)}</dd></div></dl><small>Kaynak pafta: {displayCell(m.pafta)}</small></article>)}</div>}
        {tab !== "files" && visibleRows.length === 0 && <p className="cad-muted">Gösterilecek satır yok.</p>}
        {tab !== "files" && visibleRows.length > limit && <Button variant="outline" onClick={() => setLimit(limit + 50)}>50 satır daha göster</Button>}
        {tab === "files" && <div className="cad-files">{state.artifacts.map(a => <a key={a.id} href={`/cad/file?job=${selected.id}&artifact=${a.id}`} className="oc-tap"><FileText size={16} /><span>{a.name}</span><small>{(a.size / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} KB</small></a>)}<p className="cad-muted">Tanı dosyalarında tanınamayan antetler, ölçek farklılıkları ve malzeme okuma bulguları bulunur.</p></div>}
        {state.canWrite && selected.status === "review" && <div className="cad-approval"><h3>Sonuçları kontrol edin</h3><p>Ölçekleri, revizyon kopyalarını ve malzeme adetlerini inceleyin. Bu onay satın alma kaydı oluşturmaz.</p><label className="cad-check"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />PDF’leri ve malzeme listesini inceledim.</label><Button disabled={!reviewed || !!busy} onClick={() => void run("Sonuçlar onaylanıyor", async () => { await command("approve", { jobId: selected.id }); })}><CheckCircle2 size={16} />Sonuçları onayla</Button></div>}
        {state.canWrite && selected.status === "approved" && <div className="cad-approval"><h3>Teknik Resimler’e aktar</h3><div className="cad-two"><label>Paket adı<input className={inputClass} maxLength={180} value={folderName} onChange={e => setFolderName(e.target.value)} /></label><label>İş kalemi<select className={inputClass} value={itemId} onChange={e => setItemId(e.target.value)}><option value="">Sonradan bağlayacağım</option>{items.map(item => <option key={item.id} value={item.id}>{item.item_no} · {item.product_name}</option>)}</select></label></div><p>Mevcut paketlerin üzerine yazılmaz. Yarım kalan aktarım aynı paket üzerinden devam eder.</p><div className="cad-actions"><Button disabled={!!busy || !folderName.trim()} onClick={exportJob}>{selected.package_id ? "Aktarımı kontrol et / devam et" : "Pakete aktar"}</Button>{selected.package_id && <Link className="oc-tap underline" href={`/drawings/${selected.package_id}`}>Teknik Resimler’de aç</Link>}</div></div>}
      </>}
    </section>}
  </div>;
}
