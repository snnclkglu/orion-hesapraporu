import taskApi from "../../../docs/task-api.openapi.json";
import type { AgentScope } from "./model";
export type Endpoint = {
  module: string;
  method: string;
  path: string;
  title: string;
  scope: AgentScope | null;
  notes: string;
  contract?: unknown;
};
const taskEndpoints: Endpoint[] = Object.entries(taskApi.paths).flatMap(
  ([path, item]) =>
    Object.entries(item)
      .filter(([method]) => ["get", "post", "patch"].includes(method))
      .map(([method, raw]) => {
        const op = raw as { summary?: string; description?: string };
        return {
          module: "Görevler",
          method: method.toUpperCase(),
          path,
          title: op.summary ?? path,
          scope:
            /\/(cancel|reactivate)$/.test(path) ? "tasks:cancel" : path === "/tasks/context"
              ? "tasks:context:read"
              : method === "get"
                ? "tasks:read"
                : path.startsWith("/tasks/tags")
                  ? "tasks:tags:manage"
                  : path.endsWith("/comments")
                    ? "tasks:comment"
                    : "tasks:write",
          notes: `${op.description ?? ""} ${method !== "get" ? "Idempotency-Key zorunlu. Güncellemede güncel version değerini kullanın." : "Profil ve kayıt erişimi uygulanır."}`,
          contract: {
            ...raw,
            parameters: [
              ...((item as { parameters?: unknown[] }).parameters ?? []),
              ...((raw as { parameters?: unknown[] }).parameters ?? []),
            ],
          },
        } as Endpoint;
      }),
);
function offer(
  method: string,
  path: string,
  title: string,
  notes: string,
): Endpoint {
  return {
    module: "Teklif",
    method,
    path,
    title,
    scope: method === "GET" ? "offers:read" : "offers:draft:write",
    notes: `Yönetici veya Müdür profili gerekir. ${notes}`,
  };
}
export const EMAIL_COMMAND_SCOPES = {
  "template.save": "email:draft:write",
  "template.publish": "email:publish",
  "rule.save": "email:publish",
  "settings.save": "email:publish",
  preview: "email:read",
  "test.send": "email:test:send",
  "delivery.retry": "email:send",
  "delivery.resend": "email:send",
} as const satisfies Record<string, AgentScope>;
export const ENDPOINTS: Endpoint[] = [
  {
    module: "Bağlantı",
    method: "GET",
    path: "/me",
    title: "Ajan kimliğini ve izinlerini oku",
    scope: null,
    notes:
      "Geçerli, aktif anahtar ve mevcut profil gerekir. Başka ajan bilgisi dönmez.",
  },
  ...taskEndpoints,
  offer(
    "GET",
    "/customers",
    "Müşteri ara",
    "q zorunlu: 1–120 karakter. En fazla 20 sonuç.",
  ),
  offer(
    "GET",
    "/offer-options",
    "Teklif seçeneklerini oku",
    "Katalog ve arama bilgileri için bağlantı paketindeki ortak rehberi kullanın.",
  ),
  offer(
    "GET",
    "/offer-templates",
    "Kalem şablonlarını oku",
    "Şablon kimliklerini buradan alın; tahmin etmeyin.",
  ),
  offer(
    "POST",
    "/offers",
    "Teklif taslağı oluştur",
    "customerId (UUID) ve subject (metin) zorunlu. lang, currency, issuerCustomerId isteğe bağlı. Idempotency-Key önerilir.",
  ),
  offer(
    "GET",
    "/offers/{offerId}",
    "Teklif ayrıntısını oku",
    "offerId UUID; uygulamada liste ucu yerine bilinen teklif kimliği kullanılır.",
  ),
  offer(
    "POST",
    "/offers/{offerId}/revisions",
    "Taslak revizyon oluştur",
    "Gövde gerekmez. Idempotency-Key önerilir.",
  ),
  offer(
    "GET",
    "/offers/{offerId}/revisions/{revisionId}",
    "Revizyonu oku",
    "Teklif ve revizyon UUID. payload, notes, status ve rev_no döner.",
  ),
  offer(
    "PUT",
    "/offers/{offerId}/revisions/{revisionId}",
    "Taslak revizyonu kaydet",
    "payload nesnesi zorunlu; notes isteğe bağlı. Yayımlanmış revizyon değişmez. PUT için ortak tekrar önbelleği yoktur.",
  ),
  offer(
    "POST",
    "/offers/{offerId}/revisions/{revisionId}/items",
    "Şablondan kalem ekle",
    "Şema bağlantı paketindedir. Idempotency-Key önerilir.",
  ),
  {
    module: "E-posta",
    method: "GET",
    path: "/email-center",
    title: "E-posta bilgilerini oku",
    scope: "email:read",
    notes:
      "Yönetici profili. status, q, jobId, page filtreleri; detail=version|delivery ve id ile ayrıntı.",
  },
  ...Object.entries(EMAIL_COMMAND_SCOPES).map(([command, scope]) => ({
    module: "E-posta",
    method: "POST",
    path: "/email-center",
    title: command,
    scope,
    notes: `Gövde: { action: "${command}", data: { ... } }. Yönetici profili. ${command === "preview" ? "Salt önizleme; gönderim yapmaz." : "Idempotency-Key zorunlu."} Ayrıntılı alan şeması bağlantı paketindedir.`,
  })),
];
export function connectionGuide(baseUrl: string, scopes: readonly string[]) {
  return `ORION ajan bağlantısı\nAPI: ${baseUrl}\nSürüm: 1\nİzinler: ${scopes.join(", ")}\n\nToken'ı güvenli secret kaynağından ORION_API_TOKEN ortam değişkenine yükle; sohbetlere veya loglara yazma.\nÖnce GET /me ile kimliğini ve izinlerini doğrula. Görev bağlamını /tasks/context üzerinden oku. Yalnız yetkili olduğun kayıtlar üzerinde çalış; iş/proje kimliklerini tahmin etme.\nYeni görev öncesinde mevcut kayıtları ara. Yazma isteğinde aynı mantıksal işlem için aynı Idempotency-Key ve gövdeyi koru. 409'da güncel kaydı oku, 429'da Retry-After süresini bekle. Görev güncellemesinde version kullan.\n401/403'te yetkiyi aşmayı deneme; X-Request-Id ile yöneticine bildir. E-posta gönderimi yalnız ayrıca yetkilendirildiğinde yapılır.\n\nSalt okuma testi (Bash):\ncurl --fail-with-body -H "Authorization: Bearer $ORION_API_TOKEN" "${baseUrl}/me"\n\nPowerShell:\nInvoke-RestMethod -Headers @{ Authorization = "Bearer $env:ORION_API_TOKEN" } -Uri "${baseUrl}/me"\n\nBu paket anahtar içermez. Yetki listesi kayıt görünürlüğünün yerine geçmez.\n`;
}
