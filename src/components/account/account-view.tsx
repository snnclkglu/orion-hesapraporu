"use client";
import { AnchorBottomBar } from "@/components/anchor-bottom-bar";
import { NavigationAppearanceControl } from "@/components/section-bottom-bar";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  ArrowUpRight,
  MessageSquare,
  Shield,
  Users,
  Camera,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { LogoutButton } from "@/components/logout-button";
import { roleLabel } from "@/lib/roles";
import type { AccountData } from "@/lib/account/model";
import {
  saveAccount,
  saveAvatar,
  changeAccountPassword,
  prepareAvatar,
} from "@/app/(app)/profile/actions";
import "./account.css";
import { PhoneInput } from "./phone-input";
import { normalizePhone, phoneError } from "@/lib/account/phone";
import { useMobileFormViewport } from "@/components/ui/mobile-form-viewport";
import { useUnsavedForm } from "./use-unsaved-form";
import { prepareImageTransport } from "@/lib/account/image-transport";
export function AccountView({
  initial,
  preview = false,
}: {
  initial: AccountData;
  preview?: boolean;
}) {
  const [formNode, setFormNode] = useState<HTMLDivElement | null>(null);
  useMobileFormViewport(formNode);
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const [file, setFile] = useState<File | null>(null),
    [url, setUrl] = useState(""),
    [dimensions, setDimensions] = useState({ w: 1, h: 1 });
  const [crop, setCrop] = useState({ zoom: 1, x: 0.5, y: 0.5 });
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function choosePhoto(selected: File) {
    setBusy(true);
    setMessage("Fotoğraf hazırlanıyor…");
    setError(false);
    try {
      let imageFile = await prepareImageTransport(selected);
      if (!preview) {
        const form = new FormData();
        form.set("file", imageFile);
        const result = await prepareAvatar(form);
        if (result.error || !result.image)
          throw new Error(result.error ?? "Fotoğraf açılamadı.");
        const bytes = Uint8Array.from(atob(result.image), (c) =>
          c.charCodeAt(0),
        );
        imageFile = new File([bytes], "profil.webp", { type: "image/webp" });
      }
      setFile(imageFile);
      setUrl(URL.createObjectURL(imageFile));
      setCrop({ zoom: 1, x: 0.5, y: 0.5 });
      setMessage("");
    } catch (e) {
      setError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Fotoğraf hazırlanamadı. Yeniden deneyin.",
      );
    } finally {
      setBusy(false);
    }
  }
  const dirty =
    data.name !== initial.name ||
    data.phone !== initial.phone ||
    data.note !== initial.note ||
    !!file;
  useUnsavedForm(dirty);
  async function run(
    action: () => Promise<{
      error?: string;
      version?: number;
      avatar?: string | null;
      name?: string;
      phone?: string;
    }>,
    success: string,
  ) {
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const r = preview ? {} : await action();
      if (r.error) {
        setMessage(r.error);
        setError(true);
        return false;
      }
      setData((d) => ({
        ...d,
        version: r.version ?? d.version,
        name: r.name ?? d.name,
        phone: r.phone ?? d.phone,
        avatar: r.avatar === undefined ? d.avatar : r.avatar,
      }));
      setMessage(preview ? "Önizleme: değişiklik kaydedilmedi." : success);
      if (!preview) router.refresh();
      return true;
    } catch {
      setMessage(
        "Bağlantı kurulamadı. Bilgileriniz korunuyor; yeniden deneyin.",
      );
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function photo(remove = false) {
    const f = new FormData();
    if (file) f.set("file", file);
    f.set("version", String(data.version));
    f.set("remove", String(remove));
    Object.entries(crop).forEach(([k, v]) => f.set(k, String(v)));
    if (
      await run(
        () => saveAvatar(f),
        remove ? "Fotoğraf kaldırıldı." : "Fotoğraf güncellendi.",
      )
    )
      setFile(null);
  }
  const scale = (220 / Math.min(dimensions.w, dimensions.h)) * crop.zoom;
  return (
    <div className="ac-page" ref={setFormNode}>
      <AnchorBottomBar label="Profilim" sections={[{id:"profile-info",label:"Bilgiler",icon:"person"},{id:"profil-fotografi",label:"Fotoğraf",icon:"grid"},{id:"profile-teams",label:"Ekipler",icon:"team"}]} more={[{id:"appearance",label:"Görünüm",onSelect:()=>document.getElementById("profile-appearance")?.scrollIntoView({block:"start"}),icon:"settings"},{id:"feedback",label:"Gönderilerim",href:"/profile/feedback",icon:"inbox"},{id:"new-feedback",label:"Geri bildirim gönder",href:"/profile/feedback/new",icon:"file"}]} />
      <Link href="/" className="ac-button w-fit">
        <ArrowLeft size={16} /> Çalışma alanına dön
      </Link>
      <header className="ac-hero">
        <UserAvatar
          name={data.name}
          userId={data.id}
          photo={!!data.avatar}
          version={data.avatar ?? ""}
          size={80}
        />
        <div className="min-w-0">
          <p className="ac-muted">Profilim</p>
          <h1>{data.name || "Kullanıcı"}</h1>
          <p className="ac-muted">
            {roleLabel(data.role)}
            {data.title ? ` · ${data.title}` : ""}
          </p>
        </div>
      </header>
      <nav className="oc-section-desktop ac-row ac-actions" aria-label="Profil kısayolları">
        <a className="ac-button" href="#profil-fotografi">
          <Camera size={16} /> Fotoğrafı düzenle
        </a>
        <Link className="ac-button" href="/profile/feedback/new">
          <MessageSquare size={16} /> Geri bildirim
        </Link>
        <Link className="ac-button" href="/profile/feedback">
          Gönderilerim
        </Link>
      </nav>
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={`ac-status ${error ? "ac-error" : ""}`}
        >
          {message}
        </p>
      )}
      <div className="ac-grid">
        <div className="ac-stack">
          <form
            id="profile-info" className="ac-card scroll-mt-20"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                data.phone !== initial.phone &&
                normalizePhone(data.phone) === null
              ) {
                setMessage(phoneError);
                setError(true);
                return;
              }
              void run(
                () =>
                  saveAccount({
                    name: data.name,
                    phone: data.phone,
                    note: data.note,
                    version: data.version,
                  }),
                "Bilgileriniz kaydedildi.",
              );
            }}
          >
            <h2>Kişisel bilgiler</h2>
            <label>
              Ad soyad
              <input
                value={data.name}
                maxLength={120}
                required
                autoComplete="name"
                onChange={(e) => setData({ ...data, name: e.target.value })}
              />
            </label>
            <label>
              Giriş e-postası
              <input value={data.email} readOnly type="email" />
            </label>
            <p className="ac-muted">
              E-posta, unvan ve uygulama rolünü yönetiminiz düzenler.
            </p>
            <PhoneInput
              value={data.phone}
              original={initial.phone}
              onChange={(phone) => setData({ ...data, phone })}
            />
            <label>
              Özel not · isteğe bağlı
              <textarea
                value={data.note}
                maxLength={500}
                onChange={(e) => setData({ ...data, note: e.target.value })}
              />
            </label>
            <p className="ac-muted">
              Telefon ve özel not yalnız size ve yöneticilere açıktır.
            </p>
            <button className="ac-button ac-primary" disabled={busy}>
              {busy ? "Kaydediliyor…" : "Bilgileri kaydet"}
            </button>
          </form>
          <section className="ac-card scroll-mt-20" id="profil-fotografi">
            <h2 className="ac-row">
              <Camera size={18} /> Profil fotoğrafı
            </h2>
            <p className="ac-muted">
              İsteğe bağlıdır. Uygulamadaki ekip arkadaşlarınız görebilir.
            </p>
            <label>
              Fotoğraf seç
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && f.size > 10485760) {
                    setError(true);
                    setMessage("Fotoğraf en fazla 10 MB olabilir.");
                  } else {
                    if (f) void choosePhoto(f);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            {file && (
              <>
                <div className="ac-crop">
                  <Image
                    unoptimized
                    width={dimensions.w}
                    height={dimensions.h}
                    src={url}
                    alt="Fotoğraf kırpma önizlemesi"
                    onLoad={(e) =>
                      setDimensions({
                        w: e.currentTarget.naturalWidth,
                        h: e.currentTarget.naturalHeight,
                      })
                    }
                    onError={() => {
                      setError(true);
                      setMessage(
                        "Cihaz bu fotoğrafı önizleyemedi. Fotoğraflar uygulamasından JPEG olarak paylaşarak tekrar seçebilirsiniz.",
                      );
                    }}
                    style={{
                      width: dimensions.w * scale,
                      height: dimensions.h * scale,
                      left: -(dimensions.w * scale - 220) * crop.x,
                      top: -(dimensions.h * scale - 220) * crop.y,
                    }}
                  />
                </div>
                <label>
                  Yakınlaştır
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={crop.zoom}
                    onChange={(e) =>
                      setCrop({ ...crop, zoom: +e.target.value })
                    }
                  />
                </label>
                <label>
                  Yatay konum
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={crop.x}
                    onChange={(e) => setCrop({ ...crop, x: +e.target.value })}
                  />
                </label>
                <label>
                  Dikey konum
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={crop.y}
                    onChange={(e) => setCrop({ ...crop, y: +e.target.value })}
                  />
                </label>
                <div className="ac-row ac-actions">
                  <button
                    className="ac-button"
                    onClick={() => setCrop({ zoom: 1, x: 0.5, y: 0.5 })}
                  >
                    Ortala
                  </button>
                  <button
                    className="ac-button"
                    onClick={() => setFile(null)}
                    disabled={busy}
                  >
                    Vazgeç
                  </button>
                  <button
                    className="ac-button ac-primary"
                    disabled={busy}
                    onClick={() => void photo()}
                  >
                    Fotoğrafı kullan
                  </button>
                </div>
              </>
            )}
            {data.avatar && !file && (
              <button
                className="ac-button"
                disabled={busy}
                onClick={() => void photo(true)}
              >
                Fotoğrafı kaldır
              </button>
            )}
            <p className="ac-muted">
              JPEG, PNG, WebP, HEIC · en fazla 10 MB. Fotoğraftaki konum bilgisi
              saklanmaz.
            </p>
          </section>
        </div>
        <div className="ac-stack">
          <section className="ac-card">
            <h2>Uygulamayı birlikte iyileştirelim</h2>
            <Link href="/profile/feedback/new" className="ac-link-card">
              <MessageSquare size={22} />
              <span>Geri bildirim gönder</span>
              <ArrowUpRight size={18} />
            </Link>
            <Link className="ac-button" href="/profile/feedback">
              Gönderdiğim geri bildirimler
            </Link>
            <p className="ac-muted">
              Gönderilerinizi yalnız siz ve yönetim görebilir.
            </p>
          </section>
          <section className="ac-card scroll-mt-20" id="profile-teams">
            <h2 className="ac-row">
              <Users size={18} /> Ekiplerim
            </h2>
            <div className="ac-row">
              {data.teams.map((t) => (
                <Link
                  className="ac-badge min-h-11"
                  key={t.id}
                  href={`/?view=team&team=${t.id}`}
                >
                  {t.name}
                </Link>
              ))}
            </div>
            {!data.teams.length && (
              <p className="ac-muted">Henüz bir ekibe dahil değilsiniz.</p>
            )}
            <p className="ac-muted">Ekip üyeliklerini yönetiminiz düzenler.</p>
          </section>
          <section className="ac-card scroll-mt-20" id="profile-appearance">
            <h2>Görünüm</h2>
            <NavigationAppearanceControl />
            <label>
              Bu cihazdaki tema
              <select
                value={theme ?? "system"}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="system">Sistem</option>
                <option value="light">Açık</option>
                <option value="dark">Koyu</option>
              </select>
            </label>
          </section>
          <form
            className="ac-card"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              if (
                await run(
                  () => changeAccountPassword(f),
                  "Parolanız güncellendi.",
                )
              )
                form.reset();
            }}
          >
            <h2 className="ac-row">
              <Shield size={18} /> Güvenlik
            </h2>
            <label>
              Mevcut parola
              <input
                name="current"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              Yeni parola
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label>
              Yeni parola tekrar
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <button className="ac-button" disabled={busy}>
              Parolayı değiştir
            </button>
            <LogoutButton />
          </form>
        </div>
      </div>
    </div>
  );
}
