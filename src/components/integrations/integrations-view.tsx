"use client";
import { useState, useTransition } from "react";
import {
  Activity,
  ArrowDownToLine,
  Check,
  Copy,
  KeyRound,
  Plug,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useMobileFormViewport } from "@/components/ui/mobile-form-viewport";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AGENT_SCOPES,
  SCOPE_LABELS,
  ERROR_HELP,
  REASON_LABELS,
  profileCanUseScope,
  type IntegrationSnapshot,
  type ManagedAgent,
  type AgentEdit,
} from "@/lib/integrations/model";
import { ENDPOINTS, connectionGuide } from "@/lib/integrations/catalog";
import type {
  IntegrationCommand,
  EventFilters,
} from "@/lib/integrations/server";
import {
  refreshIntegrations,
  saveIntegration,
} from "@/app/(app)/admin/integrations/actions";
import { USER_ROLE_LABELS, type UserRole } from "@/lib/roles";
import { adBuyuk } from "@/lib/tr-text";
import { trKatla } from "@/lib/drawings/tr-text";
import "@/components/account/account.css";
import "./integrations.css";

const TABS = [
  "Genel bakış",
  "Ajanlar",
  "Uç noktalar",
  "İstekler",
  "Rehber",
] as const;
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("tr-TR", {
        timeZone: "Europe/Istanbul",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
const roleName = (role: string | null) =>
  USER_ROLE_LABELS[role as UserRole] ?? "Profil doğrulanamadı";
function CopyButton({
  value,
  label = "Kopyala",
}: {
  value: string;
  label?: string;
}) {
  const [message, setMessage] = useState("");
  return (
    <span className="int-copy">
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage("Kopyalandı");
          } catch {
            setMessage("Kopyalanamadı; metni seçerek kopyalayın.");
          }
        }}
      >
        <Copy size={15} />
        {label}
      </Button>
      <span role="status" className="ac-muted">
        {message}
      </span>
    </span>
  );
}

export function IntegrationsView({
  initial,
  preview = false,
}: {
  initial: IntegrationSnapshot;
  preview?: boolean;
}) {
  const [formNode, setFormNode] = useState<HTMLDivElement | null>(null);
  useMobileFormViewport(formNode);
  const [data, setData] = useState(initial),
    [tab, setTab] = useState<(typeof TABS)[number]>("Genel bakış");
  const [pending, start] = useTransition(),
    [message, setMessage] = useState("");
  const [selected, setSelected] = useState(initial.agents[0]?.id ?? ""),
    [query, setQuery] = useState("");
  const [filters, setFilters] = useState<EventFilters>({ status: "all" });
  const [confirmation, setConfirmation] = useState<{
    command: IntegrationCommand;
    title: string;
    description: string;
  } | null>(null);
  const [secret, setSecret] = useState("");
  const [creating, setCreating] = useState(false);
  const agent = data.agents.find((a) => a.id === selected);
  const ask = (
    command: IntegrationCommand,
    title: string,
    description: string,
  ) => setConfirmation({ command, title, description });
  const refresh = (f: EventFilters = filters) =>
    start(async () => {
      if (preview) {
        setMessage("Önizleme: bağlantı çağrısı yapılmadı.");
        return;
      }
      const result = await refreshIntegrations(f);
      if (result.ok) {
        setData(result.data);
        setMessage(
          "Ayarlar kontrol edildi. Gerçek bağlantı için ajandan /me isteği gönderin.",
        );
      } else setMessage(result.error);
    });
  const execute = () =>
    start(async () => {
      if (!confirmation) return;
      if (preview) {
        setMessage("Önizleme: değişiklik kaydedilmedi, anahtar üretilmedi.");
        setConfirmation(null);
        return;
      }
      const result = await saveIntegration(confirmation.command);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setConfirmation(null);
      setCreating(false);
      setMessage(
        "Değişiklik kaydedildi. Yeni ayar sonraki API isteğinde uygulanır.",
      );
      if (result.token) setSecret(result.token);
      const fresh = await refreshIntegrations(filters);
      if (fresh.ok) setData(fresh.data);
    });
  const last = data.events[0];
  return (
    <div ref={setFormNode} className="ac-page int-page">
      <header className="int-header">
        <div>
          <p className="int-eyebrow">
            <Plug size={16} /> BAĞLANTILAR
          </p>
          <h1>API ve Entegrasyonlar</h1>
          <p className="ac-muted">
            Ajanların erişimini yönetin, bağlantıları doğrulayın.
          </p>
        </div>
        <Button variant="outline" disabled={pending} onClick={() => refresh()}>
          <RefreshCw size={16} />
          Ayarları kontrol et
        </Button>
      </header>
      <div className="int-tabs" role="group" aria-label="Entegrasyon bölümleri">
        {TABS.map((t) => (
          <button
            type="button"
            className="oc-tap"
            aria-pressed={tab === t}
            key={t}
            onClick={() => {
              setTab(t);
              setQuery("");
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {message && (
        <p role="status" className="int-notice">
          {message}
        </p>
      )}
      {!data.databaseReady && (
        <p role="alert" className="int-notice">
          Ajan veritabanı okunamadı. Yönetim değişiklikleri kapalı; bağlantı ve
          kurulum kontrol edilmeli.
        </p>
      )}
      {!data.environmentValid && (
        <p className="ac-muted">
          Ortam tanımı yok veya geçersiz. Veritabanına aktarılmış ajanlar kendi
          kayıtlarından doğrulanır.
        </p>
      )}
      {tab === "Genel bakış" && (
        <>
          <section className="ac-hero int-connection">
            <div className="int-symbol">
              <Plug size={26} />
            </div>
            <div>
              <span className="ac-badge">{data.environment} · API v1</span>
              <h2>ORION ajan bağlantısı</h2>
              <code>{data.baseUrl}</code>
              <p className="ac-muted">
                Tek bağlantı adresi; her ajan için ayrı izinler.
              </p>
            </div>
            <CopyButton value={data.baseUrl} label="Adresi kopyala" />
          </section>
          <div className="int-stats">
            <section className="ac-card">
              <ShieldCheck size={20} />
              <h2>{data.agents.length} ajan</h2>
              <p className="ac-muted">
                {data.agents.filter((a) => a.source === "database").length}{" "}
                kayıt uygulamadan yönetiliyor.
              </p>
            </section>
            <section className="ac-card">
              <Check size={20} />
              <h2>
                {data.databaseReady
                  ? "Kayıtlar okunabiliyor"
                  : "Kontrol gerekli"}
              </h2>
              <p className="ac-muted">
                Kontrol: {date(data.checkedAt)}. Bu, gerçek API isteği testi
                değildir.
              </p>
            </section>
            <section className="ac-card">
              <Activity size={20} />
              <h2>
                {last
                  ? `Son listelenen yanıt: ${last.status}`
                  : "Gerçek istek bekleniyor"}
              </h2>
              <p className="ac-muted">
                {last
                  ? date(last.created_at)
                  : "Henüz sonuç ölçümü yok. Eski işlem izinden başarı sonucu üretilmez."}
              </p>
            </section>
          </div>
          <section className="ac-card">
            <h2>Grokbot neden işlem yapamıyor?</h2>
            <p>
              Önce ajanın izinlerini kontrol edin. İzin verilmiş olsa da bağlı
              profilin rolü ve görev/ekip erişimi işlemi sınırlar.
            </p>
            <div className="ac-row">
              <Button onClick={() => setTab("Ajanlar")}>Ajanları incele</Button>
              <Button variant="outline" onClick={() => setTab("Rehber")}>
                Bağlantı rehberi
              </Button>
            </div>
          </section>
          <section className="ac-card">
            <h2>Diğer bağlantılar</h2>
            <p className="ac-muted">
              CAD yardımcısı, Resend teslim bildirimleri ve zamanlanmış işler
              ayrı kimlik doğrulaması kullanır. Buradaki görev izinleri bu
              bağlantılara erişim vermez.
            </p>
          </section>
        </>
      )}
      {tab === "Ajanlar" && (
        <>
          <div className="ac-row justify-between">
            <p className="ac-muted">
              İzinler uygulama rolünü veya özel görev görünürlüğünü değiştirmez.
            </p>
            <Button
              disabled={!data.databaseReady || pending}
              onClick={() => setCreating(true)}
            >
              <KeyRound size={16} />
              Yeni ajan
            </Button>
          </div>
          <label className="int-search">
            Ajan ara
            <input
              className="ac-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={100}
            />
          </label>
          <div className="int-agent-grid">
            {data.agents
              .filter((a) =>
                trKatla(a.name + " " + a.id).includes(trKatla(query)),
              )
              .map((a) => (
                <button
                  type="button"
                  className="int-agent oc-tap"
                  key={a.id}
                  aria-pressed={selected === a.id}
                  onClick={() => setSelected(a.id)}
                >
                  <span className="int-agent-title">
                    <KeyRound size={19} />
                    <strong>{a.name}</strong>
                  </span>
                  <span className="ac-muted">
                    {a.profileName ?? "Profil bulunamadı"} · {roleName(a.role)}
                  </span>
                  <span className="ac-row">
                    <span className="ac-badge">
                      {a.status === "paused" ? "Duraklatıldı" : "Etkin"}
                    </span>
                    <span className="ac-muted">
                      {a.source === "database"
                        ? "Uygulamadan yönetiliyor"
                        : "Ortam kaydı · Salt okunur"}
                    </span>
                  </span>
                </button>
              ))}
          </div>
          {!data.agents.length && (
            <section className="ac-card">
              <h2>Henüz ajan yok</h2>
              <p>
                Ayrı bir otomasyon profili hazırlayıp ilk ajanı
                oluşturabilirsiniz.
              </p>
            </section>
          )}
          {agent && (
            <section className="ac-card" key={`${agent.id}-${agent.version}`}>
              <div>
                <h2>{agent.name}</h2>
                <code>{agent.id}</code>
                <p className="ac-muted">
                  {agent.profileName ?? "—"} · {roleName(agent.role)} ·
                  Oluşturulma: {date(agent.createdAt)}
                </p>
              </div>
              {agent.source === "environment" ? (
                <>
                  <p>
                    Etkin izinler ana ortam tanımı ve varsa ek görev izinlerinin
                    birleşimidir. Aktarım mevcut token, profil ve izinleri
                    korur.
                  </p>
                  <ScopeList agent={agent} />
                  <Button
                    disabled={!data.databaseReady || pending}
                    onClick={() =>
                      ask(
                        { action: "import", id: agent.id },
                        "Yönetimi uygulamaya aktar",
                        `${agent.name}: mevcut anahtar, profil ve ${agent.scopes.length} izin korunacak. Bundan sonraki izin değişikliklerini bu ekrandan yapabileceksiniz.`,
                      )
                    }
                  >
                    Yönetimi uygulamaya aktar
                  </Button>
                </>
              ) : (
                <AgentEditor
                  key={`${agent.id}-${agent.version}`}
                  agent={agent}
                  profiles={data.profiles}
                  disabled={pending || !data.databaseReady}
                  onSubmit={(value) =>
                    ask(
                      { action: "update", value },
                      "İzin değişikliğini kaydet",
                      changeDescription(agent, value),
                    )
                  }
                />
              )}
              <div className="ac-row">
                <CopyButton
                  value={connectionGuide(data.baseUrl, agent.scopes)}
                  label="Grokbot yönergesini kopyala"
                />
                <a
                  className="ac-button"
                  href={
                    preview
                      ? undefined
                      : `/admin/integrations/download?agent=${encodeURIComponent(agent.id)}`
                  }
                  aria-disabled={preview}
                >
                  <ArrowDownToLine size={16} />
                  Bağlantı paketi
                </a>
              </div>
              {agent.source === "database" && (
                <>
                  <h3 className="font-semibold">Anahtarlar</h3>
                  <p className="ac-muted">
                    Anahtar sonradan gösterilmez. Yenilemede eski anahtar en
                    fazla 24 saat daha geçerli kalır. İptal edilen anahtar geri
                    açılamaz.
                  </p>
                  <div className="ac-row">
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        ask(
                          {
                            action: "rotate",
                            id: agent.id,
                            version: agent.version,
                            overlapHours: 24,
                          },
                          "Yeni anahtar üret",
                          "Yeni anahtar yalnız bir kez gösterilecek. Eski anahtar en fazla 24 saat sonra sona erecek; Grokbot secret kaynağını bu sürede güncelleyin.",
                        )
                      }
                    >
                      Anahtarı yenile · 24 saat geçiş
                    </Button>
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        ask(
                          {
                            action: "rotate",
                            id: agent.id,
                            version: agent.version,
                            overlapHours: 0,
                          },
                          "Anahtarı hemen değiştir",
                          "Eski anahtarların tamamı hemen sona erecek. Yeni anahtar Grokbot'a tanımlanana kadar bağlantı duracak.",
                        )
                      }
                    >
                      Hemen değiştir
                    </Button>
                  </div>
                  {agent.credentials.map((k) => (
                    <div className="int-key" key={k.id}>
                      <div>
                        <strong>{k.label}</strong>
                        <p className="ac-muted">
                          Oluşturulma: {date(k.createdAt)} · Bitiş:{" "}
                          {date(k.expiresAt)}
                        </p>
                        <span className="ac-badge">
                          {k.revokedAt
                            ? "İptal edildi"
                            : k.expiresAt && new Date(k.expiresAt) <= new Date()
                              ? "Süresi doldu"
                              : "Geçerli"}
                        </span>
                      </div>
                      {!k.revokedAt && (
                        <Button
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            ask(
                              {
                                action: "revoke",
                                id: agent.id,
                                version: agent.version,
                                credentialId: k.id,
                              },
                              "Anahtarı iptal et",
                              `${k.label} sonraki istekte çalışmayacak. Bu işlem geri alınamaz.`,
                            )
                          }
                        >
                          İptal et
                        </Button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </section>
          )}
        </>
      )}
      {tab === "Uç noktalar" && (
        <>
          <label className="int-search">
            İşlem, modül veya adres ara
            <input
              className="ac-input"
              maxLength={120}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <p className="ac-muted">
            Adresler ortak bağlantıya eklenir. Görevlerin ayrıntılı sözleşmesi
            burada, teklif/e-posta alan şemaları indirilebilir bağlantı
            paketindedir.
          </p>
          {ENDPOINTS.filter((e) =>
            trKatla(`${e.module} ${e.title} ${e.path} ${e.scope}`).includes(
              trKatla(query),
            ),
          ).map((e, i) => (
            <details
              className="ac-card int-endpoint"
              key={`${e.path}-${e.method}-${i}`}
            >
              <summary className="oc-tap">
                <span className="ac-badge">{e.method}</span>
                <strong>{e.title}</strong>
                <span className="ac-muted">{e.module}</span>
                <code>{e.path}</code>
              </summary>
              <p>{e.notes}</p>
              <p>
                <strong>Gerekli izin:</strong>{" "}
                {e.scope ? SCOPE_LABELS[e.scope] : "Geçerli ajan kimliği"}
              </p>
              {e.scope && <code>{e.scope}</code>}
              <CopyButton
                value={`${data.baseUrl}${e.path}`}
                label="Uç adresini kopyala"
              />
              {e.contract !== undefined && (
                <details>
                  <summary className="oc-tap">
                    Alanlar, parametreler ve yanıt sözleşmesi
                  </summary>
                  <pre>{JSON.stringify(e.contract, null, 2)}</pre>
                </details>
              )}
            </details>
          ))}
        </>
      )}
      {tab === "İstekler" && (
        <>
          <form
            className="ac-card int-filters"
            onSubmit={(e) => {
              e.preventDefault();
              setFilters({ ...filters, cursor: undefined });
              refresh({ ...filters, cursor: undefined });
            }}
          >
            <label>
              Ajan
              <select
                value={filters.agent ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, agent: e.target.value || undefined })
                }
              >
                <option value="">Tüm ajanlar</option>
                {data.agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sonuç
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    status: e.target.value as EventFilters["status"],
                  })
                }
              >
                <option value="all">Tüm sonuçlar</option>
                <option value="error">Hatalar</option>
                <option value="success">Başarılı yanıtlar</option>
              </select>
            </label>
            <label>
              Başlangıç
              <input
                type="date"
                value={filters.from ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, from: e.target.value || undefined })
                }
              />
            </label>
            <label>
              Bitiş
              <input
                type="date"
                min={filters.from}
                value={filters.to ?? ""}
                onChange={(e) =>
                  setFilters({ ...filters, to: e.target.value || undefined })
                }
              />
            </label>
            <Button disabled={pending}>Süz</Button>
          </form>
          <p className="ac-muted">
            Son 7 günün ölçülen yanıtları. Kimliği doğrulanmayan istekler
            örneklenir; kayıtlar kesin trafik sayımı değildir. İçerikler ve
            anahtarlar saklanmaz.
          </p>
          {data.events.map((e) => (
            <details className="ac-card int-endpoint" key={e.id}>
              <summary className="oc-tap">
                <span
                  className={`ac-badge ${e.status >= 400 ? "text-destructive" : ""}`}
                >
                  {e.status} · {e.status >= 400 ? "Hata" : "Başarılı"}
                </span>
                <strong>
                  {data.agents.find((a) => a.id === e.agent_id)?.name ??
                    (e.agent_id || "Kimlik doğrulanmadı")}
                </strong>
                <span className="ac-muted">
                  {date(e.created_at)} · {e.duration_ms} ms
                </span>
                <code>
                  {e.method} {e.route}
                </code>
              </summary>
              <p>
                {e.reason_code && (
                  <strong>{REASON_LABELS[e.reason_code]} </strong>
                )}
                {ERROR_HELP[e.status] ??
                  "İstek başarılı yanıt verdi. Gönderimlerde teslim durumu ayrıca kontrol edilir."}
              </p>
              <p className="ac-muted">
                {e.scope ?? "İşlem izni henüz belirlenmedi"}{" "}
                {e.replayed ? "· Önceki yanıt tekrar kullanıldı" : ""}
              </p>
              <code>{e.request_id}</code>
              <CopyButton
                value={e.request_id}
                label="İstek kimliğini kopyala"
              />
            </details>
          ))}
          {!data.events.length && (
            <section className="ac-card">
              <h2>Bu filtrelerde ölçüm yok</h2>
              <p className="ac-muted">
                Ajan bağlantı testinden sonra ayarları yenileyin. Geçmiş audit
                kayıtları başarılı istek gibi gösterilmez.
              </p>
            </section>
          )}
          {data.nextCursor && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                const f = { ...filters, cursor: data.nextCursor! };
                setFilters(f);
                refresh(f);
              }}
            >
              Daha eski istekler
            </Button>
          )}
          <details className="ac-card">
            <summary className="oc-tap">Son 30 günün günlük ölçümleri</summary>
            <p className="ac-muted">
              Ölçülen kayıtların toplamı; kimliksiz trafik örneklenmiştir. En
              fazla 500 günlük ajan satırı gösterilir.
            </p>
            {data.daily?.map((d) => (
              <p key={d.day + d.agent_id}>
                {d.day} · {d.agent_id || "Kimlik doğrulanmadı"} · {d.requests}{" "}
                ölçüm · {d.errors} hata · Ortalama{" "}
                {Math.round(d.duration_ms / Math.max(1, d.requests))} ms
              </p>
            ))}
          </details>
          <h2 className="text-xl font-semibold">Son yönetim değişiklikleri</h2>
          {data.changes.map((c) => (
            <details key={c.id} className="ac-card">
              <summary className="oc-tap">
                {c.agent_id} ·{" "}
                {(
                  {
                    create: "Ajan oluşturuldu",
                    import: "Aktarıldı",
                    update: "Ayarlar değişti",
                    rotate: "Anahtar yenilendi",
                    revoke: "Anahtar iptal edildi",
                  } as Record<string, string>
                )[c.action] ?? c.action}
              </summary>
              <p className="ac-muted">
                {c.actor_name ?? "—"} · {date(c.created_at)}
              </p>
              <pre>{JSON.stringify(c.detail, null, 2)}</pre>
            </details>
          ))}
          {!data.changes.length && (
            <p className="ac-muted">Henüz yönetim değişikliği yok.</p>
          )}
        </>
      )}
      {tab === "Rehber" && (
        <>
          <section className="ac-card">
            <h2>Üç adımda bağlanın</h2>
            <ol className="list-decimal pl-5 space-y-3">
              <li>
                Ajanı ve mevcut otomasyon profilini seçin. Yalnız gereken işlem
                izinlerini verin.
              </li>
              <li>
                Anahtarı Grokbot’un güvenli secret kaynağına kaydedin. Mevcut
                anahtarı tekrar paylaşmanız gerekmez.
              </li>
              <li>
                <code>GET /me</code> ile doğrulayın; sonra izinli modülü okuyun.
                Yanıtın istek kimliğiyle hatayı inceleyin.
              </li>
            </ol>
            <label>
              Ajan
              <select
                className="ac-input"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Ajan seçin</option>
                {data.agents.map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <pre>{connectionGuide(data.baseUrl, agent?.scopes ?? [])}</pre>
            <CopyButton
              value={connectionGuide(data.baseUrl, agent?.scopes ?? [])}
              label="Yönergeyi kopyala"
            />
            <a
              className="ac-button"
              href={
                preview
                  ? undefined
                  : `/admin/integrations/download?agent=${encodeURIComponent(selected)}`
              }
              aria-disabled={preview}
            >
              <ArrowDownToLine size={16} />
              API dosyasını indir
            </a>
          </section>
          <section className="ac-card">
            <h2>Sık karşılaşılan yanıtlar</h2>
            {Object.entries(ERROR_HELP).map(([code, help]) => (
              <p key={code}>
                <strong>{code}</strong> — {help}
              </p>
            ))}
          </section>
        </>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent mobileKeyboardSafe className="int-page">
          <DialogTitle>Yeni ajan</DialogTitle>
          <DialogDescription>
            Önce Kullanıcılar bölümünde ayrı otomasyon profilini hazırlayın. Bu
            ekran kullanıcı rolünü değiştirmez.
          </DialogDescription>
          <AgentEditor
            profiles={data.profiles}
            disabled={pending}
            onSubmit={(value) =>
              ask(
                { action: "create", value, dedicatedProfile: true },
                "Ajanı oluştur",
                `${value.name}, seçilen otomasyon profiliyle çalışacak. Anahtar yalnız bir kez gösterilecek. İzinler: ${value.scopes.map((s) => SCOPE_LABELS[s]).join("; ")}`,
              )
            }
          />
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirmation(null);
        }}
      >
        <DialogContent mobileKeyboardSafe className="int-page">
          <DialogTitle>{confirmation?.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line">
            {confirmation?.description}
          </DialogDescription>
          <div className="ac-row">
            <Button disabled={pending} onClick={execute}>
              {pending ? "Kaydediliyor…" : "Onayla ve kaydet"}
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmation(null)}
            >
              Vazgeç
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!secret}
        onOpenChange={(open) => {
          if (!open) setSecret("");
        }}
      >
        <DialogContent mobileKeyboardSafe className="int-page">
          <DialogTitle>Yeni anahtar hazır</DialogTitle>
          <DialogDescription>
            Bu anahtar yalnız şimdi gösterilir. Grokbot’un güvenli secret
            kaynağına kaydedin. Pencere kapanınca yeniden gösterilemez.
          </DialogDescription>
          <pre className="select-all">{secret}</pre>
          <CopyButton value={secret} label="Anahtarı kopyala" />
          <Button onClick={() => setSecret("")}>Kaydettim, kapat</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function changeDescription(agent: ManagedAgent, value: AgentEdit) {
  const added = value.scopes.filter((s) => !agent.scopes.includes(s)),
    removed = agent.scopes.filter((s) => !value.scopes.includes(s));
  return [
    `Ajan: ${agent.name}`,
    `Ad: ${agent.name} → ${value.name}`,
    `Eklenecek: ${added.map((s) => SCOPE_LABELS[s]).join("; ") || "Yok"}`,
    `Kaldırılacak: ${removed.map((s) => SCOPE_LABELS[s]).join("; ") || "Yok"}`,
    `Durum: ${value.status === "active" ? "Etkin" : "Duraklatıldı"}`,
    `Dakikalık sınır: ${agent.rateLimitPerMinute} → ${value.rateLimitPerMinute}`,
  ].join("\n");
}
function ScopeList({ agent }: { agent: ManagedAgent }) {
  return (
    <ul className="int-scopes">
      {agent.scopes.map((s) => (
        <li key={s}>
          <Check size={16} />
          <span>
            {SCOPE_LABELS[s]}
            <code>{s}</code>
            {!profileCanUseScope(agent.role, s) && (
              <span className="text-destructive">
                Profil rolü bu işleme izin vermiyor.
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
function AgentEditor({
  agent,
  profiles,
  disabled,
  onSubmit,
}: {
  agent?: ManagedAgent;
  profiles: IntegrationSnapshot["profiles"];
  disabled: boolean;
  onSubmit: (value: AgentEdit) => void;
}) {
  const [value, setValue] = useState<AgentEdit>(
    agent
      ? {
          id: agent.id,
          name: agent.name,
          actorId: agent.actorId,
          scopes: agent.scopes,
          rateLimitPerMinute: agent.rateLimitPerMinute,
          status: agent.status,
          version: agent.version,
        }
      : {
          id: "",
          name: "",
          actorId: "",
          scopes: [],
          rateLimitPerMinute: 60,
          status: "active",
          version: 0,
        },
  );
  const [error, setError] = useState("");
  const role = profiles.find((p) => p.id === value.actorId)?.role ?? null;
  return (
    <form
      className="ac-card int-editor"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.scopes.length) {
          setError("En az bir işlem izni seçin.");
          return;
        }
        setError("");
        onSubmit(value);
      }}
    >
      <div className="int-fields">
        <label>
          Ajan adı
          <input
            value={value.name}
            onChange={(e) =>
              setValue({ ...value, name: adBuyuk(e.target.value) })
            }
            minLength={2}
            maxLength={120}
            required
          />
        </label>
        {!agent && (
          <label>
            Ajan kimliği
            <input
              value={value.id}
              onChange={(e) => setValue({ ...value, id: e.target.value })}
              pattern="[a-z0-9][a-z0-9._\-]{1,63}"
              minLength={2}
              maxLength={64}
              required
            />
            <span className="ac-muted">
              Küçük Latin harf, rakam, nokta, tire veya alt çizgi.
            </span>
          </label>
        )}
        <div>
          {agent ? (
            <>
              <p className="mb-2 text-sm font-medium">Otomasyon profili</p>
              <p className="rounded-md border p-3 text-sm">
                {agent.profileName ?? "—"} · {roleName(agent.role)}
              </p>
            </>
          ) : (
            <label>
              Otomasyon profili
              <select
                required
                value={value.actorId}
                onChange={(e) =>
                  setValue({ ...value, actorId: e.target.value })
                }
              >
                <option value="">Profil seçin</option>
                {profiles.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.full_name} · {roleName(p.role)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label>
          Dakikalık istek sınırı
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            required
            value={value.rateLimitPerMinute || ""}
            onChange={(e) =>
              setValue({ ...value, rateLimitPerMinute: Number(e.target.value) })
            }
          />
          <span className="ac-muted">
            Ortak sınır sunucu örneğinde, görev sınırı ayrıca veritabanında
            uygulanır.
          </span>
        </label>
        {agent && (
          <label>
            Durum
            <select
              value={value.status}
              onChange={(e) =>
                setValue({
                  ...value,
                  status: e.target.value as AgentEdit["status"],
                })
              }
            >
              <option value="active">Etkin</option>
              <option value="paused">Duraklatıldı</option>
            </select>
          </label>
        )}
      </div>
      <fieldset>
        <legend className="mb-3 font-semibold">İşlem izinleri</legend>
        <div className="int-scopes">
          {AGENT_SCOPES.map((s) => (
            <label key={s} className="int-check oc-tap">
              <input
                type="checkbox"
                checked={value.scopes.includes(s)}
                onChange={(e) =>
                  setValue({
                    ...value,
                    scopes: e.target.checked
                      ? [...value.scopes, s]
                      : value.scopes.filter((x) => x !== s),
                  })
                }
              />
              <span>
                {SCOPE_LABELS[s]}
                <code>{s}</code>
                {value.scopes.includes(s) && !profileCanUseScope(role, s) && (
                  <span className="text-destructive">
                    Seçilen profil rolü bu işleme izin vermiyor.
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {!agent && (
        <label className="int-check oc-tap">
          <input type="checkbox" required />
          <span>Seçtiğim profil bu otomasyon için ayrılmıştır.</span>
        </label>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <Button disabled={disabled} type="submit">
        {agent ? "Değişiklikleri gözden geçir" : "Ajanı oluştur"}
      </Button>
    </form>
  );
}
