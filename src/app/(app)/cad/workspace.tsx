"use client";

import { SectionBottomBar, useBottomBarGuard } from "@/components/section-bottom-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Monitor, RefreshCw, Upload, FileText, CheckCircle2, Loader2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { CAD_BUCKET, deviceAvailability, displayCell, stateLabels, type CadArtifact, type CadDevice, type CadJob, type CadOptions } from "@/lib/cad/contracts";
import { selectCadFiles } from "@/lib/cad/selection";
import { emptyHistory, historySchema, monthRange, quickHistoryRange, HISTORY_PAGE_SIZE, type CadHistoryFilter } from "@/lib/cad/history";
import { cadAction, cadSnapshot } from "./actions";
import { cadExportStart, cadExportFile, cadExportFinish, cadItemOptions } from "./export-actions";
import "./workspace.css";

export interface CadSnapshot { canWrite: boolean; devices: CadDevice[]; jobs: CadJob[]; total?: number; selected: CadJob | null; artifacts: CadArtifact[] }
const inputClass = "cad-input";
export function CadWorkspace({ initial, preview = false }: { initial: CadSnapshot; preview?: boolean }) {
  const [state, setState] = useState(initial);
  const [section, setSection] = useState<"new" | "history" | "results" | "devices">("new");
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState(emptyHistory);
  const [draftHistory, setDraftHistory] = useState(emptyHistory);
  const [historyBusy, setHistoryBusy] = useState(false);
  const historyRef = useRef(emptyHistory);
  const historyLoading = useRef(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(initial.selected?.id);
  const [deviceId, setDeviceId] = useState(initial.devices.find(d => !d.revoked_at)?.id ?? "");
  const [name, setName] = useState("");
  const [pair, setPair] = useState<{ code: string; deviceId: string; expiresAt: string } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
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
  const uploadIds = useRef(new Map<string, string>());
  const localBusy = useRef(false);
  const refresh = useCallback(async (id = selectedRef.current) => {
    if (preview || refreshing.current || historyLoading.current) return;
    refreshing.current = true;
    const sequence = ++refreshedAt.current;
    try {
      const result = await cadSnapshot(id, historyRef.current);
      if (sequence === refreshedAt.current && id === selectedRef.current) {
        if (result.ok) {
          setState(result.data);
          setPair(current => current && result.data.devices.some(d => d.id === current.deviceId && d.state !== "unpaired" && !d.revoked_at) ? null : current);
        }
        else setError(result.error);
      }
    } finally { refreshing.current = false; }
  }, [preview]);
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); if (!document.hidden && !localBusy.current) void refresh(); }, 5000);
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
    setSection("results");
    if (preview) { setState(current => ({ ...current, selected: job })); return; }
    const sequence = ++refreshedAt.current;
    const response = await cadSnapshot(job.id, historyRef.current);
    if (response.ok && selectedRef.current === job.id && sequence === refreshedAt.current) setState(response.data);
    else if (!response.ok) setError(response.error);
  };
  const loadHistory = useCallback(async (next: CadHistoryFilter) => {
    const parsed = historySchema.safeParse(next);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (preview) {
      const jobs = initial.jobs.filter(j => (!next.search || j.source_name.toLocaleLowerCase("tr").includes(next.search.toLocaleLowerCase("tr"))) && (!next.status || j.status === next.status) && (!next.device || j.device_id === next.device) && (!next.from || Date.parse(j.created_at) >= Date.parse(`${next.from}T00:00:00+03:00`)) && (!next.to || Date.parse(j.created_at) < Date.parse(`${next.to}T00:00:00+03:00`) + 86400000));
      historyRef.current = next; setHistory(next); setState(current => ({ ...current, total: jobs.length, jobs: jobs.slice(next.page * HISTORY_PAGE_SIZE, (next.page + 1) * HISTORY_PAGE_SIZE) })); return; }
    historyLoading.current = true; setHistoryBusy(true); setError("");
    const sequence = ++refreshedAt.current;
    const previous = historyRef.current;
    historyRef.current = next;
    try {
      const response = await cadSnapshot(selectedRef.current, next);
      if (sequence !== refreshedAt.current) return;
      if (!response.ok) { historyRef.current = previous; setError(response.error); return; }
      setState(response.data); setHistory(next);
    } catch { if (sequence === refreshedAt.current) { historyRef.current = previous; setError("İşlem geçmişi alınamadı. Yeniden deneyin."); } }
    finally { if (sequence === refreshedAt.current) { historyLoading.current = false; setHistoryBusy(false); } }
  }, [preview, initial]);
  useEffect(() => {
    if (JSON.stringify({ ...draftHistory, page: 0 }) === JSON.stringify({ ...historyRef.current, page: 0 })) return;
    const timer = setTimeout(() => { void loadHistory({ ...draftHistory, page: 0 }); }, 350);
    return () => clearTimeout(timer);
  }, [draftHistory, loadHistory]);
  const chooseFiles = (list: FileList | null) => {
    if (!list?.length) return;
    try {
      const chosen = selectCadFiles(Array.from(list));
      setFiles(chosen.files); uploadIds.current.clear(); setError("");
      setNotice(`${chosen.files.length} DWG seçildi.${chosen.ignored ? ` DWG olmayan ${chosen.ignored} dosya seçime alınmadı.` : ""}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Dosyalar seçilemedi."); }
  };
  const upload = () => run("DWG dosyaları yükleniyor", async () => {
    if (!files.length) throw new Error("DWG dosyaları veya bir klasör seçin.");
    if (!deviceAvailability(state.devices.find(d => d.id === deviceId)).ready || !ack) throw new Error("İşleme göndermeden önce AutoCAD'i hazır duruma getirin ve çalışma onayını işaretleyin.");
    let completed = 0;
    for (const file of files) {
      setBusy(`DWG yükleniyor · ${completed + 1}/${files.length} · ${file.name}`);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map(v => v.toString(16).padStart(2, "0")).join("");
      const signature = JSON.stringify([file.webkitRelativePath || file.name, hash, deviceId, paper, duplicates]);
      let id = uploadIds.current.get(signature);
      if (!id) { id = crypto.randomUUID(); uploadIds.current.set(signature, id); }
      try {
        const data = await command("create", { id, deviceId, name: file.name, size: file.size, sha256: hash, options: { paper, duplicates }, acknowledged: ack });
        if (!data.alreadyQueued) {
          if (!data.upload.exists) {
            const result = await createClient().storage.from(CAD_BUCKET).uploadToSignedUrl(data.upload.path, data.upload.token, file, { contentType: "application/octet-stream" });
            if (result.error) throw new Error("Dosya yüklenemedi; yeniden deneyebilirsiniz.");
          }
          await command("queue", { jobId: data.jobId });
        }
        selectedRef.current = data.jobId; setSelectedId(data.jobId);
        completed++; setFiles(current => current.filter(item => item !== file));
        setNotice(`${completed} DWG sıraya alındı. Her çizim ayrı iş olarak sırayla işlenecek.`);
        setSection("history");
      } catch (error) {
        throw new Error(`${file.name}: ${error instanceof Error ? error.message : "Yüklenemedi."} Kalan dosyalar seçili; yeniden göndererek devam edebilirsiniz.`);
      }
    }
    uploadIds.current.clear();
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
  const hasPairedDevice = state.devices.some(d => !d.revoked_at && d.state !== "unpaired");
  useEffect(() => {
    if (deviceId && !state.devices.some(d => d.id === deviceId && !d.revoked_at)) setDeviceId("");
    if (draftHistory.device && !state.devices.some(d => d.id === draftHistory.device && !d.revoked_at)) setDraftHistory(value => ({ ...value, device: "", page: 0 }));
  }, [state.devices, deviceId, draftHistory.device]);
  const currentDevice = state.devices.find(d => d.id === deviceId);
  const available = deviceAvailability(currentDevice, now);
  const selected = state.selected;
  const result = selected?.result;
  const visibleRows = (tab === "sheets" ? result?.paftalar ?? [] : result?.malzeme ?? []).filter(row => !search || Object.values(row).some(v => typeof v === "string" && v.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr"))));

  useBottomBarGuard(files.length > 0 || !!busy);
  const mobileView = { new: "prepare", history: "jobs", results: "results", devices: "connection" }[section];
  return <div className="cad-workspace" data-cad-view={mobileView}>
    <SectionBottomBar label="CAD" priority={25} items={([{id:"history",label:"İşlemler",icon:"list"},{id:"new",label:"Hazırla",icon:"tools"},{id:"results",label:"Sonuçlar",icon:"file"},{id:"devices",label:"Bağlantı",icon:"settings"}] as const).map(item=>({...item,active:section===item.id,onSelect:()=>setSection(item.id)}))} />
    <div className="cad-intro"><div><span className="cad-eyebrow">ÇİZİMDEN PAFTAYA</span><h1>Çizimleriniz, kendi AutoCAD’inizle.</h1><p>DWG içindeki paftaları ayırın, PDF’leri ve malzeme listesini inceleyin. Onayladığınız sonuçları Teknik Resimler’e aktarın.</p></div><div className="cad-local"><Monitor size={20} /><span>İşlem sizin bilgisayarınızda<br /><small>Windows · Tam AutoCAD · ORION Yardımcısı</small></span></div></div>
    {preview && <p className="cad-message">Görsel önizleme · Buradaki düğmeler gerçek işlem başlatmaz.</p>}
    {error && <div role="alert" className="cad-error">{error}<Button variant="ghost" onClick={() => void refresh()}>Yeniden kontrol et</Button></div>}
    {notice && <p role="status" className="cad-message">{notice}</p>}
    {busy && <p role="status" className="cad-message"><Loader2 className="animate-spin" size={16} />{busy} · Yükleme ve aktarım sırasında bu sekmeyi açık tutun.</p>}
    <nav className="cad-page-tabs" aria-label="Çizim İşleme bölümleri">{([["new","Yeni işlem"],["history","İşlem geçmişi"],["results","Sonuçlar"],["devices","Bilgisayarlar"]] as const).map(([key,label]) => <Button key={key} variant={section === key ? "default" : "outline"} disabled={key === "results" && !selected} aria-pressed={section === key} onClick={() => setSection(key)}>{label}</Button>)}</nav>
    <div className="cad-pages">
      <section hidden={section !== "devices"} data-cad-panel="connection" className="cad-card"><div className="cad-section-title"><h2><Monitor size={18} /> Bilgisayar bağlantısı</h2><Button variant="ghost" disabled={!!busy} onClick={() => void refresh()} aria-label="Bağlantıyı yenile"><RefreshCw size={16} /></Button></div>
        {state.devices.filter(d => !d.revoked_at).length ? <div className="cad-devices">{state.devices.filter(d => !d.revoked_at).map(d => {
          const availability = deviceAvailability(d, now);
          return <div key={d.id} className="cad-device"><div><strong>{d.name}</strong><p>{availability.label}</p>{d.message && <small>{d.message}</small>}</div>{state.canWrite && <Button variant="ghost" disabled={!!busy} onClick={() => void run("Bağlantı kaldırılıyor", async () => { await command("revoke", { deviceId: d.id }); })}>Bağlantıyı kaldır</Button>}</div>;
        })}</div> : <p className="cad-muted">Henüz bilgisayar bağlanmadı. Yardımcıyı kurup bu hesabınızla eşleştirin.</p>}
        {state.canWrite && <>{hasPairedDevice && <p className="cad-message">Bilgisayar bağlantınız kayıtlı. Her kullanımda yeniden kod girmeniz gerekmez; yardımcıyı açmanız yeterli.</p>}<details className="cad-help" open={!hasPairedDevice || !!pair}><summary>{hasPairedDevice ? "Başka bilgisayar bağla" : "Bilgisayarı ilk kez bağla"}</summary><div className="cad-pair-form"><label>Bilgisayar adı<input className={inputClass} value={name} onChange={e => setName(e.target.value)} maxLength={80} /></label><Button disabled={!!busy || !name.trim()} onClick={() => void run("Bağlantı kodu hazırlanıyor", async () => { setPair(await command("pair", { name })); })}><Link2 size={16} />Bağlantı kodu oluştur</Button></div>
          {pair && <div className="cad-pair-code"><strong>Yardımcıdaki bağlantı ekranına yapıştırın</strong><p>Uygulama adresi: {typeof window !== "undefined" ? window.location.origin : ""}</p><code>{pair.code}</code><small>10 dakika geçerlidir. Yalnız kendi bilgisayarınızdaki yardımcıda kullanın.</small><Button variant="outline" onClick={() => void navigator.clipboard.writeText(pair.code).then(() => setNotice("Bağlantı kodu kopyalandı.")).catch(() => setError("Kodu seçip elle kopyalayabilirsiniz."))}>Kodu kopyala</Button></div>}
          </details><details className="cad-help"><summary>Yardımcı nasıl kurulur?</summary><ol><li><a href="/cad/helper" className="underline">ORION Yardımcısını indir</a> ve Windows’ta açın.</li><li>Bu sayfadaki uygulama adresini ve bağlantı kodunu yardımcıya girin.</li><li>AutoCAD’deki çizimlerinizi kaydedip kapatın. Yardımcıdan kontrolü başlatın.</li><li>DWG dosyalarını veya klasörü seçin. AutoCAD “İşleme hazır” olduğunda işleme gönderin.</li></ol><p>AutoCAD LT ve macOS bu sürümde desteklenmiyor. Yardımcı çalışırken AutoCAD’de başka çizim açmayın.</p></details></>}
      </section>
      <section hidden={section !== "new"} data-cad-panel="prepare" className="cad-card"><h2><Upload size={18} /> Yeni işlem</h2>{state.canWrite ? <div className="cad-form">
        <label>İşlemi yapacak bilgisayar<select className={inputClass} value={deviceId} disabled={!!busy} onChange={e => setDeviceId(e.target.value)}><option value="">Bilgisayar seçin</option>{state.devices.filter(d => !d.revoked_at).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <p className="cad-muted" aria-live="polite">{available.label}</p>
        <div className="cad-file" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy) chooseFiles(e.dataTransfer.files); }}>
          <p className="cad-muted">DWG dosyalarını buraya sürükleyebilirsiniz. Klasör için aşağıdaki ayrı düğmeyi kullanın.</p>
          <input ref={fileInput} aria-label="DWG dosyası seç" type="file" accept=".dwg" multiple hidden disabled={!!busy} onChange={e => { chooseFiles(e.target.files); e.target.value = ""; }} /><Button type="button" variant="outline" disabled={!!busy} onClick={() => fileInput.current?.click()}>DWG dosyası seç</Button><small>Bir veya birden fazla .dwg dosyasını seçip Aç düğmesine basın.</small>
          <input ref={folderInput} aria-label="DWG klasörü seç" type="file" multiple hidden {...{ webkitdirectory: "", directory: "" }} disabled={!!busy} onChange={e => { chooseFiles(e.target.files); e.target.value = ""; }} /><Button type="button" variant="outline" disabled={!!busy} onClick={() => folderInput.current?.click()}>DWG içeren klasörü seç</Button><small>Klasörü bir kez seçip Klasör seç / Yükle düğmesine basın. Çift tıklamak klasörün içine girer.</small>
          <small>Klasörün alt klasörlerindeki DWG’ler de seçilir. Her DWG ayrı işlenir. En fazla 30 dosya; dosya başına 100 MB. Xref ve diğer destek dosyaları aktarılmaz.</small>
          {files.length > 0 && <div className="cad-selected-files"><strong>{files.length} DWG seçili</strong><ul>{files.map((file, i) => <li key={i}>{file.webkitRelativePath || file.name} <small>({(file.size / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB)</small></li>)}</ul><Button variant="outline" disabled={!!busy} onClick={() => { setFiles([]); uploadIds.current.clear(); }}>Seçimi temizle</Button></div>}
        </div>
        {!available.ready && <p className="cad-muted">Dosya ve klasör seçebilirsiniz. İşleme göndermek için AutoCAD’deki çizimleri kaydedip kapatın; yardımcı 1.0.5 ve sonrası hazır durumu otomatik izler. AutoCAD kapalıysa yardımcıdaki “Kontrol et ve başlat” düğmesiyle açabilirsiniz.</p>}
        <div className="cad-two"><label>Kâğıt<select className={inputClass} value={paper} disabled={!!busy} onChange={e => setPaper(e.target.value as CadOptions["paper"])}><option value="A3">A3</option><option value="AUTO">Çerçeveden belirle</option></select></label><label>Tekrarlanan paftalar<select className={inputClass} value={duplicates} disabled={!!busy} onChange={e => setDuplicates(e.target.value as CadOptions["duplicates"])}><option value="hepsi">Tümünü incelemeye getir</option><option value="dur">İşlemi durdur</option><option value="alt">Alttaki kopyayı kullan</option><option value="ust">Üstteki kopyayı kullan</option></select></label></div>
        <label className="cad-check"><input type="checkbox" disabled={!!busy} checked={ack} onChange={e => setAck(e.target.checked)} />Seçtiğim bilgisayarda AutoCAD çizimlerimi kapattım; işlem sırasında AutoCAD’i kullanmayacağım.</label>
        <Button disabled={!!busy || !available.ready || !files.length || !ack} onClick={upload}><Upload size={16} />{files.length > 1 ? `${files.length} DWG’yi işleme gönder` : "İşleme gönder"}</Button>
        <small>Yükleme tamamlanana kadar sekmeyi açık tutun. İşlem, seçtiğiniz bilgisayar açık ve yardımcı hazırken yürür.</small>
      </div> : <p className="cad-muted">Yeni işlem için Yönetici, Mühendis veya Teknik Ressam yetkisi gerekir. Hazır paketleri Teknik Resimler bölümünden görüntüleyebilirsiniz.</p>}</section>
    </div>
    <section hidden={section !== "history"} data-cad-panel="jobs" className="cad-card" aria-busy={historyBusy}>
      <div className="cad-section-title"><h2>İşlem geçmişim</h2><small>{state.total ?? state.jobs.length} işlem</small></div>
      <div className="cad-quick-dates">{[["all","Tüm zamanlar"],["today","Bugün"],["week","Son 7 gün"],["month","Bu ay"],["previous","Geçen ay"],["year","Bu yıl"]].map(([key,label]) => <Button variant={draftHistory.from === quickHistoryRange(key).from && draftHistory.to === quickHistoryRange(key).to ? "default" : "outline"} key={key} onClick={() => setDraftHistory(current => ({ ...current, ...quickHistoryRange(key), page: 0 }))}>{label}</Button>)}<label>Ay seç<input className={inputClass} type="month" value={draftHistory.from.endsWith("-01") && draftHistory.to === monthRange(draftHistory.from.slice(0,7)).to ? draftHistory.from.slice(0,7) : ""} onChange={e => setDraftHistory(current => ({ ...current, ...monthRange(e.target.value), page: 0 }))} /></label></div>
      <form className="cad-history-filters" onSubmit={e => { e.preventDefault(); void loadHistory({ ...draftHistory, page: 0 }); }}>
        <label>DWG adında ara<input className={inputClass} maxLength={120} value={draftHistory.search} onChange={e => setDraftHistory({ ...draftHistory, search: e.target.value })} placeholder="Dosya adı veya resim numarası" /></label>
        <label>Durum<select className={inputClass} value={draftHistory.status} onChange={e => setDraftHistory({ ...draftHistory, status: e.target.value as CadHistoryFilter["status"] })}><option value="">Tüm durumlar</option>{Object.entries(stateLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Bilgisayar<select className={inputClass} value={draftHistory.device} onChange={e => setDraftHistory({ ...draftHistory, device: e.target.value })}><option value="">Tüm bilgisayarlar</option>{state.devices.filter(d => !d.revoked_at).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label>Başlangıç tarihi<input type="date" className={inputClass} value={draftHistory.from} onChange={e => setDraftHistory({ ...draftHistory, from: e.target.value })} /></label>
        <label>Bitiş tarihi<input type="date" className={inputClass} value={draftHistory.to} min={draftHistory.from || undefined} onChange={e => setDraftHistory({ ...draftHistory, to: e.target.value })} /></label>
        <div className="cad-actions"><span role="status" className="cad-muted">{historyBusy ? "Güncelleniyor…" : "Filtreler otomatik uygulanır"}</span><Button type="button" variant="outline" onClick={() => setDraftHistory({ ...emptyHistory })}>Temizle</Button></div>
      </form>
      {state.jobs.length === 0 ? <div className="cad-empty"><FileText size={30} /><p>{history.search || history.status || history.device || history.from || history.to ? "Bu filtrelerle eşleşen işlem bulunamadı." : "Henüz işlem yok."}</p></div> : <div className="cad-job-list">{state.jobs.map(job => <div className="cad-history-row" key={job.id}><button disabled={!!busy || historyBusy} className={`cad-job oc-tap ${selectedId === job.id ? "cad-job-selected" : ""}`} onClick={() => void chooseJob(job)}><span><strong>{job.source_name}</strong><small>{new Date(job.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}{state.devices.find(d => d.id === job.device_id && !d.revoked_at)?.name ? ` · ${state.devices.find(d => d.id === job.device_id)?.name}` : ""}</small></span><span className={`cad-badge cad-state-${job.status}`}>{stateLabels[job.status]}</span></button>{["review","approved"].includes(job.status) && <a className="oc-tap cad-print-link" href={`/cad/file?job=${job.id}&combined=1`} target="_blank" rel="noreferrer" aria-label={`${job.source_name} birleşik PDF aç ve yazdır`}>Birleşik PDF / Yazdır</a>}</div>)}</div>}
      <div className="cad-history-footer"><small>Sayfa {history.page + 1} · En yeni işlemler önce · Tarihler Türkiye saatine göre</small><div className="cad-actions"><Button variant="outline" disabled={history.page === 0 || historyBusy || !!busy} onClick={() => void loadHistory({ ...history, page: history.page - 1 })}>Önceki</Button><Button variant="outline" disabled={(history.page + 1) * HISTORY_PAGE_SIZE >= (state.total ?? state.jobs.length) || historyBusy || !!busy} onClick={() => void loadHistory({ ...history, page: history.page + 1 })}>Sonraki</Button></div></div>
      <p className="cad-muted">Birleşik PDF, yalnız ilgili DWG’nin tüm paftalarını içerir. PDF açıldığında yazıcı simgesini veya Ctrl+P’yi kullanarak tek seferde yazdırabilirsiniz.</p>
    </section>

    {selected && <section hidden={section !== "results"} data-cad-panel="results" className="cad-card cad-results"><div className="cad-section-title"><h2>{selected.source_name}</h2><span className={`cad-badge cad-state-${selected.status}`}>{stateLabels[selected.status]}</span></div>
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
