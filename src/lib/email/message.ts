export const emailFrom = "ORION <info@orioncranes.com>";
export const emailReplyTo = "info@orioncranes.com";
export const appOrigin = "https://app.orioncranes.com";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]!);
}

/** Bildirim bağlantısı yalnız uygulamanın iş ekranlarına gidebilir. */
export function notificationUrl(href: string): string {
  const url = new URL(href, appOrigin);
  if (url.origin !== appOrigin || !/^\/jobs(?:\/|$)/.test(url.pathname)) {
    throw new Error("Geçersiz bildirim bağlantısı.");
  }
  return url.href;
}

export function notificationMessage(title: string, href: string) {
  const url = notificationUrl(href);
  const subject = `ORION · ${title.replace(/[\r\n]/g, " ").slice(0, 200)}`;
  return {
    from: emailFrom,
    reply_to: emailReplyTo,
    subject,
    text: `${title}\n\nUygulamada görüntüle: ${url}\n\nBu e-posta ORION İş Yönetim Sistemi tarafından gönderilmiştir.`,
    html: `<!doctype html><html lang="tr"><body style="margin:0;background:#FAF9F7;font-family:Arial,sans-serif;color:#262626"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:560px;background:white" cellpadding="24" cellspacing="0"><tr><td style="background:#262626;color:white;font-size:24px;font-weight:bold">ORION</td></tr><tr><td><h1 style="font-size:20px;line-height:1.5">${escapeHtml(title)}</h1><p style="line-height:1.6">Ayrıntıları görmek için uygulamayı açabilirsiniz.</p><p style="padding:16px 0"><a href="${escapeHtml(url)}" style="background:#A41E1E;color:white;padding:14px 20px;text-decoration:none;display:inline-block">Uygulamada görüntüle</a></p><p style="font-size:12px;color:#666;line-height:1.6">Bu e-posta ORION İş Yönetim Sistemi tarafından gönderilmiştir.</p></td></tr></table></td></tr></table></body></html>`,
  };
}
