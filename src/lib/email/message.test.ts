import { describe, expect, it } from "vitest";
import { notificationMessage, notificationUrl } from "./message";

describe("Bildirim e-postası", () => {
  it("HTML içeriğini kaçırır; Türkçe metni ve düz metin karşılığını korur", () => {
    const message = notificationMessage('Görev: <img src=x onerror="alert(1)"> & ölçü', "/jobs/abc/gorevler");
    expect(message.html).not.toContain('<img');
    expect(message.html).toContain('&lt;img');
    expect(message.text).toContain('ölçü');
    expect(message.from).toBe('ORION <info@orioncranes.com>');
    expect(message.reply_to).toBe('info@orioncranes.com');
    expect(message.html).toContain('https://app.orioncranes.com/jobs/abc/gorevler');
  });
  it.each(['https://evil.example/jobs', '//evil.example/jobs', '/\\evil.example/jobs',
    'javascript:alert(1)', '/jobs/../../admin', '/jobs-evil'])('Dışarıya veya başka bölüme bağlantıyı reddeder: %s', (href) => {
    expect(() => notificationUrl(href)).toThrow();
  });
  it('Konu başlığından satır sonlarını kaldırır', () => {
    expect(notificationMessage('Görev\r\nBcc: x', '/jobs').subject).not.toMatch(/[\r\n]/);
  });
});
