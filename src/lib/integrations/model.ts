import { z } from "zod";
import {
  canEditOffers,
  canSeeOffers,
  isAdminRole,
  USER_ROLES,
} from "@/lib/roles";
import { adBuyuk } from "@/lib/tr-text";

export const AGENT_SCOPES = [
  "offers:read",
  "offers:draft:write",
  "email:read",
  "email:draft:write",
  "email:publish",
  "email:test:send",
  "email:send",
  "tasks:read",
  "tasks:write",
  "tasks:comment",
  "tasks:context:read",
  "tasks:tags:manage",
  "tasks:cancel",
] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];
export const SCOPE_LABELS: Record<AgentScope, string> = {
  "tasks:cancel": "Yetkili görevleri neden belirterek iptal et ve yeniden aç",
  "tasks:tags:manage": "Yetkili etiket kataloğunu oluştur ve düzenle",
  "tasks:context:read": "İş, ekip ve pano eşleştirme bilgilerini oku",
  "tasks:read": "Görevleri oku",
  "tasks:write": "Görev oluştur ve güncelle",
  "tasks:comment": "Yorum ekle",
  "offers:read": "Teklif bilgilerini oku",
  "offers:draft:write": "Teklif taslağı oluştur ve düzenle",
  "email:read": "E-posta bilgilerini oku ve önizle",
  "email:draft:write": "E-posta taslağını düzenle",
  "email:publish": "E-posta şablonlarını ve kurallarını yayınla",
  "email:test:send": "Test e-postası gönder",
  "email:send": "E-postayı yeniden gönder",
};
export const principalSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/),
  name: z.string().min(2).max(120),
  actorId: z.uuid(),
  scopes: z
    .array(z.enum(AGENT_SCOPES))
    .min(1)
    .max(AGENT_SCOPES.length)
    .refine((v) => new Set(v).size === v.length),
  rateLimitPerMinute: z.number().int().min(1).max(600),
});
export type AgentPrincipal = z.infer<typeof principalSchema>;
export function profileCanUseScope(
  role: string | null,
  scope: AgentScope,
): boolean {
  if (scope.startsWith("tasks:"))
    return USER_ROLES.some((value) => value === role);
  if (scope.startsWith("email:")) return isAdminRole(role);
  return scope === "offers:read"
    ? canSeeOffers(role)
    : scope === "offers:draft:write" && canEditOffers(role);
}
export const agentEditSchema = principalSchema
  .extend({
    name: z.string().trim().min(2).max(120).transform(adBuyuk),
    version: z.number().int().min(0),
    status: z.enum(["active", "paused"]),
  })
  .strict();
export type AgentEdit = z.input<typeof agentEditSchema>;
export type ManagedAgent = AgentPrincipal & {
  source: "environment" | "database";
  version: number;
  status: "active" | "paused";
  profileName: string | null;
  role: string | null;
  createdAt: string | null;
  credentials: {
    id: string;
    label: string;
    createdAt: string;
    expiresAt: string | null;
    revokedAt: string | null;
  }[];
};
export type RequestEvent = {
  id: number;
  request_id: string;
  agent_id: string | null;
  method: string;
  route: string;
  scope: string | null;
  status: number;
  duration_ms: number;
  replayed: boolean;
  reason_code?: string | null;
  created_at: string;
};
export type ConfigEvent = {
  id: number;
  agent_id: string;
  actor_name: string | null;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
};
export type IntegrationSnapshot = {
  agents: ManagedAgent[];
  profiles: { id: string; full_name: string; role: string }[];
  daily?: {
    day: string;
    agent_id: string;
    requests: number;
    errors: number;
    duration_ms: number;
  }[];
  events: RequestEvent[];
  changes: ConfigEvent[];
  nextCursor: number | null;
  environmentValid: boolean;
  databaseReady: boolean;
  checkedAt: string;
  environment: string;
  baseUrl: string;
};
export const ERROR_HELP: Record<number, string> = {
  401: "Anahtar geçersiz, iptal edilmiş veya süresi dolmuş olabilir. Ajanın kullandığı anahtarı kontrol edin.",
  403: "İstenen işlem iznini, bağlı profilin rolünü ve hedef kaydın erişimini kontrol edin.",
  404: "Adres yanlış olabilir veya kayıt bu ajana görünmüyor olabilir.",
  409: "Kayıt sürümü değişmiş veya aynı tekrar anahtarı farklı bir istek için kullanılmış olabilir.",
  422: "Alan türlerini, zorunlu bilgileri ve tekrar anahtarı kurallarını kontrol edin.",
  429: "İstek sınırına ulaşıldı. Retry-After süresini bekleyin.",
  500: "İşlem tamamlanamadı. İstek kimliğiyle inceleyin; yazmayı yeni anahtarla körlemesine tekrarlamayın.",
  503: "Yapılandırma veya veritabanı doğrulanamadı. Ayar kontrolünü yenileyin.",
};

export const REASON_LABELS: Record<string, string> = {
  scope_denied: "Gerekli API izni eksik.",
  profile_denied: "Bağlı profilin rolü bu işleme izin vermiyor.",
  auth_failed: "Anahtar doğrulanamadı.",
  access_denied: "İşlem veya hedef kayıt erişimi reddedildi.",
  validation: "İstek alanları geçersiz.",
  unavailable: "Sunucu doğrulaması tamamlanamadı.",
  conflict: "Kayıt veya tekrar anahtarı çakışması.",
  limited: "İstek sınırına ulaşıldı.",
  not_found: "Uç veya görünür kayıt bulunamadı.",
  internal: "İşlem tamamlanamadı.",
};
