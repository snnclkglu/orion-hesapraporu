import { BottomToolPanel } from "@/components/bottom-bar-tools";
import { FeedbackBottomBar } from "./feedback-bottom-bar";
import Link from "next/link";
import { ArrowLeft, Plus, Paperclip } from "lucide-react";
import { feedbackCategories, type FeedbackItem } from "@/lib/account/model";
import "./account.css";
export function FeedbackList({
  items,
  total,
  unread = 0,
  admin = false,
  filters = {},
}: {
  items: FeedbackItem[];
  total: number;
  unread?: number;
  admin?: boolean;
  filters?: Record<string, string>;
}) {
  const base = admin ? "/admin/feedback" : "/profile/feedback",
    page = Math.max(0, Number(filters.page) || 0);
  function pageUrl(n: number) {
    return `${base}?${new URLSearchParams({ ...filters, page: String(n) })}`;
  }
  return (
    <div className="ac-page">
      <FeedbackBottomBar admin={admin} />
      <div className="ac-row justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {admin ? "Geri Bildirimler" : "Gönderdiğim geri bildirimler"}
          </h1>
          <p className="ac-muted mt-1">
            {admin
              ? `${unread} yeni gönderi · Yönetimin ortak gelen kutusu`
              : "Yönetime ilettiğiniz görüş ve öneriler."}
          </p>
        </div>
        {!admin && (
          <Link href={`${base}/new`} className="ac-button ac-primary">
            <Plus size={16} /> Geri bildirim gönder
          </Link>
        )}
      </div>
      {!admin && (
        <Link href="/profile" className="ac-button w-fit">
          <ArrowLeft size={16} /> Profilim
        </Link>
      )}
      <BottomToolPanel id="feedback-filters" title="Geri bildirim filtreleri"><form className="ac-card" action={base}>
        <label>
          Ara
          <input
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            aria-label="Geri bildirim ara"
          />
        </label>
        <div className="ac-row ac-filters">
          <label>
            Tür
            <select name="category" defaultValue={filters.category}>
              <option value="">Tüm türler</option>
              {Object.entries(feedbackCategories).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {admin && (
            <>
              <label>
                Kayıtlar
                <select
                  name="archived"
                  defaultValue={filters.archived ?? "false"}
                >
                  <option value="false">Gelen kutusu</option>
                  <option value="true">Arşiv</option>
                </select>
              </label>
              <label>
                Okunma
                <select name="unread" defaultValue={filters.unread ?? "false"}>
                  <option value="false">Tümü</option>
                  <option value="true">Okunmamış</option>
                </select>
              </label>
            </>
          )}
          <label>
            Başlangıç
            <input name="from" type="date" defaultValue={filters.from} />
          </label>
          <label>
            Bitiş
            <input name="to" type="date" defaultValue={filters.to} />
          </label>
          <div className="ac-filter-actions">
            <button className="ac-button" type="submit">
              Süz
            </button>
            <Link href={base} className="ac-button">
              Temizle
            </Link>
          </div>
        </div>
      </form></BottomToolPanel>
      <p className="ac-muted" role="status">
        {total} gönderi
      </p>
      <div className="ac-list">
        {items.map((item) => (
          <Link
            href={`${base}/${item.id}?return=${encodeURIComponent(new URLSearchParams(filters).toString())}`}
            key={item.id}
            className="ac-item"
          >
            <div className="ac-item-head">
              <strong>
                {admin
                  ? item.full_name || "Kullanıcı"
                  : feedbackCategories[item.category]}
              </strong>
              <span className="ac-muted">
                {new Date(item.submitted_at).toLocaleDateString("tr-TR")}
              </span>
            </div>
            <p className="ac-clamp">{item.body}</p>
            <div className="ac-row">
              {admin && !item.read_at && (
                <span className="ac-badge text-primary">Yeni</span>
              )}
              <span className="ac-badge">
                {feedbackCategories[item.category]}
              </span>
              {item.section && <span className="ac-badge">{item.section}</span>}
              {!!item.attachment_count && (
                <span className="ac-badge">
                  <Paperclip size={13} />
                  {item.attachment_count}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
      {!items.length && (
        <div className="ac-card text-center">
          <h2>{total ? "Bu sayfada kayıt yok" : "Henüz bir gönderi yok"}</h2>
          <p className="ac-muted">
            {admin
              ? "Yeni geri bildirimler burada listelenecek. Filtreleri de kontrol edebilirsiniz."
              : "Görüşlerinizi paylaşarak uygulamayı iyileştirmemize yardımcı olabilirsiniz."}
          </p>
        </div>
      )}
      <nav className="ac-row" aria-label="Gönderi sayfaları">
        {page > 0 && (
          <Link className="ac-button" href={pageUrl(page - 1)}>
            Önceki
          </Link>
        )}
        <span className="ac-muted">Sayfa {page + 1}</span>
        {(page + 1) * 25 < total && (
          <Link className="ac-button" href={pageUrl(page + 1)}>
            Sonraki
          </Link>
        )}
      </nav>
    </div>
  );
}
