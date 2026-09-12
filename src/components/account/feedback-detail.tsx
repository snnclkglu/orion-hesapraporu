"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Archive } from "lucide-react";
import {
  feedbackCategories,
  type FeedbackItem,
  type FeedbackAttachment,
} from "@/lib/account/model";
import { manageFeedback } from "@/app/(app)/profile/feedback/actions";
import "./account.css";
export function FeedbackDetail({
  item,
  attachments,
  admin = false,
  back = "",
  sent = false,
}: {
  item: FeedbackItem;
  attachments: FeedbackAttachment[];
  admin?: boolean;
  back?: string;
  sent?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function manage(action: string) {
    setBusy(true);
    try {
      const r = await manageFeedback(item.id, action, item.version ?? 0);
      setMessage(r.error ?? "Güncellendi.");
      if (!r.error) router.refresh();
    } catch {
      setMessage("Bağlantı kurulamadı. Yeniden deneyin.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ac-page max-w-3xl">
      <Link
        className="ac-button w-fit"
        href={`${admin ? "/admin/feedback" : "/profile/feedback"}${back ? `?${new URLSearchParams(back).toString()}` : ""}`}
      >
        <ArrowLeft size={16} /> Gönderilere dön
      </Link>
      {sent && (
        <p role="status" className="ac-status">
          Geri bildiriminiz yönetime iletildi.
        </p>
      )}
      <article className="ac-card">
        <div className="ac-item-head">
          <h1 className="text-xl font-semibold">
            {admin ? item.full_name : "Geri bildiriminiz"}
          </h1>
          <span className="ac-muted">
            {new Date(item.submitted_at).toLocaleString("tr-TR")}
          </span>
        </div>
        <div className="ac-row">
          <span className="ac-badge">{feedbackCategories[item.category]}</span>
          {item.section && <span className="ac-badge">{item.section}</span>}
        </div>
        <p className="whitespace-pre-wrap break-words leading-relaxed">
          {item.body}
        </p>
        <div className="ac-files">
          {attachments.map((a) => (
            <a
              className="ac-file"
              key={a.id}
              href={`/api/account/feedback-image/${a.id}`}
              target="_blank"
              rel="noreferrer"
            >
                <Image unoptimized width={180} height={100}
                src={`/api/account/feedback-image/${a.id}`}
                alt={a.name}
                loading="lazy"
              />
              <span className="break-all text-sm">{a.name}</span>
            </a>
          ))}
        </div>
        <p className="ac-muted break-all">Kayıt: {item.id}</p>
      </article>
      {admin && (
        <section className="ac-card">
          <h2>Yönetim işlemleri</h2>
          <p className="ac-muted">
            Okundu bilgisi yönetimin ortak kuyruğuna aittir. Arşivleme
            kullanıcının gönderisini silmez.
          </p>
          <div className="ac-row ac-actions">
            <button
              className="ac-button"
              disabled={busy}
              onClick={() => void manage(item.read_at ? "unread" : "read")}
            >
              <Check size={16} />
              {item.read_at ? "Okunmadı işaretle" : "Okundu işaretle"}
            </button>
            <button
              className="ac-button"
              disabled={busy}
              onClick={() =>
                void manage(item.archived_at ? "restore" : "archive")
              }
            >
              <Archive size={16} />
              {item.archived_at ? "Arşivden çıkar" : "Arşivle"}
            </button>
          </div>
          {message && (
            <p role="status" className="ac-status">
              {message}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
