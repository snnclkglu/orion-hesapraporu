"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Paperclip } from "lucide-react";
import {
  beginFeedback,
  addFeedbackImage,
  submitFeedback,
} from "@/app/(app)/profile/feedback/actions";
import { feedbackCategories } from "@/lib/account/model";
import "./account.css";
import { useUnsavedForm } from "./use-unsaved-form";
import { useFeedbackDraft } from "./use-feedback-draft";
import { prepareImageTransport } from "@/lib/account/image-transport";
export function FeedbackForm({ preview = false, userId }: { preview?: boolean; userId?: string }) {
  const [body, setBody] = useState(""),
    [category, setCategory] = useState("general"),
    [section, setSection] = useState("");
  const [files, setFiles] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [locked, setLocked] = useState(false),
    [submissionAttempted, setSubmissionAttempted] = useState(false),
    [message, setMessage] = useState(""),
    [progress, setProgress] = useState("");
  const key = useRef<string | null>(null);
  const sending = useRef(false);
  const router = useRouter();
  const draft = useFeedbackDraft(userId);
  useUnsavedForm(!!body || !!files.length);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (preview) {
        setMessage("Önizleme: gönderi kaydedilmedi.");
        return;
      }
      key.current ??= crypto.randomUUID();
      const id = key.current;
      // Kesinleşmesi belirsiz bir gönderi, geri getirilen metinden yeni kimlikle çoğaltılmasın.
      draft.write(null);
      setProgress("Gönderi hazırlanıyor…");
      setLocked(true);
      const result = await beginFeedback({
        id,
        body: body.trim(),
        category,
        section,
        files: files.length,
      });
      if (result.error) throw new Error(result.error);
      setLocked(true);
      for (let slot = 0; slot < files.length; slot++) {
        setProgress(`Görsel ${slot + 1}/${files.length} yükleniyor…`);
        const f = new FormData();
        f.set("file", await prepareImageTransport(files[slot]));
        const r = await addFeedbackImage(id, slot, f);
        if (r.error) throw new Error(`Görsel ${slot + 1}: ${r.error}`);
      }
      setProgress("Yönetime iletiliyor…");
      setSubmissionAttempted(true);
      const done = await submitFeedback(id);
      if (done.error) throw new Error(done.error);
      draft.write(null);
      setBody("");
      setFiles([]);
      router.push(`/profile/feedback/${id}?sent=1`);
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Bağlantı kesildi. Metin ve ekleriniz korunuyor; yeniden deneyin.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <div className="ac-page max-w-2xl">
      <Link href="/profile/feedback" className="ac-button w-fit">
        <ArrowLeft size={16} /> Gönderilerim
      </Link>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Geri bildirim gönder
        </h1>
        <p className="ac-muted mt-2">
          Bir sorun, fikir veya küçük bir iyileştirme. Yalnız siz ve yönetim
          görebilir.
        </p>
      </header>
      <form className="ac-card" onSubmit={submit}>
        {!body && draft.raw && !locked && (
          <div className="ac-row">
            <button type="button" className="ac-button" onClick={() => {
              try {
                const saved = JSON.parse(draft.raw!);
                if (typeof saved.body !== "string") throw new Error();
                setBody(saved.body.slice(0, 4000));
                setCategory(Object.hasOwn(feedbackCategories, saved.category) ? saved.category : "general");
                setSection(typeof saved.section === "string" ? saved.section.slice(0, 60) : "");
                setMessage("Metin taslağı geri getirildi. Varsa görselleri yeniden seçin.");
              } catch { draft.write(null); }
            }}>Metin taslağını geri getir</button>
            <button type="button" className="ac-button" onClick={() => draft.write(null)}>Taslağı sil</button>
          </div>
        )}
        <label>
          Geri bildirimin
          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); draft.write({ body: e.target.value, category, section }); }}
            required
            maxLength={4000}
            rows={7}
            disabled={busy || locked}
            autoFocus
          />
        </label>
        <p className="ac-muted text-right">{body.length}/4000</p>
        <div className="ac-grid">
          <label>
            Tür
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); draft.write({ body, category: e.target.value, section }); }}
              disabled={busy || locked}
            >
              {Object.entries(feedbackCategories).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            İlgili bölüm · isteğe bağlı
            <select
              value={section}
              onChange={(e) => { setSection(e.target.value); draft.write({ body, category, section: e.target.value }); }}
              disabled={busy || locked}
            >
              <option value="">Seçilmedi</option>
              {[
                "Panel",
                "Profilim",
                "Ekipler",
                "Yönetim",
                "İşler",
                "Mühendislik",
                "Satın Alma",
                "Diğer",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="ac-row">
          <Paperclip size={16} /> Ekran görüntüsü ekle
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy || locked || files.length >= 3}
            onChange={(e) => {
              const chosen = Array.from(e.target.files ?? []);
              if (
                chosen.some((f) => f.size > 10485760) ||
                files.length + chosen.length > 3
              )
                setMessage(
                  "En fazla 3 görsel; her görsel en fazla 10 MB olabilir.",
                );
              else {
                setFiles([...files, ...chosen]);
                setMessage("");
              }
              e.target.value = "";
            }}
          />
        </label>
        {files.map((f, i) => (
          <div className="ac-row" key={`${f.name}-${i}`}>
            <span className="min-w-0 flex-1 break-all">{f.name}</span>
            <button
              className="ac-button"
              type="button"
              disabled={busy || locked}
              onClick={() => setFiles(files.filter((_, n) => n !== i))}
            >
              Kaldır
            </button>
          </div>
        ))}
        <p className="ac-muted">
          Ekranınız otomatik alınmaz. Yalnız yazdığınız metin, seçtiğiniz bölüm
          ve eklediğiniz görseller gönderilir.
        </p>
        {message && (
          <p role="alert" className="ac-status ac-error">
            {message}
          </p>
        )}
        {progress && (
          <p role="status" className="ac-status">
            {progress}
          </p>
        )}
        <button
          className="ac-button ac-primary"
          disabled={busy || !body.trim()}
        >
          <Send size={17} />
          {busy ? "Gönderiliyor…" : locked ? "Yeniden dene" : "Yönetime gönder"}
        </button>
        {locked && !busy && !submissionAttempted && (
          <button
            type="button"
            className="ac-button"
            onClick={() => {
              key.current = null;
              setLocked(false);
              setMessage(
                "Gönderi yeniden düzenlemeye açıldı. Önceki eksik taslak yönetime iletilmedi.",
              );
            }}
          >
            Metni veya ekleri düzenle
          </button>
        )}
      </form>
    </div>
  );
}
