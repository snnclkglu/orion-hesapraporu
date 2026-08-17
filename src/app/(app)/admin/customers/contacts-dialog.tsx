"use client";

// MÜŞTERİ İLETİŞİM KİŞİLERİ penceresi (kullanıcı isteği, 17.08.2026:
// *"Müşteri bilgilerine ayrıca iletişim kişisi de ekleyebileyim. Çünkü teklifte
// kişi belirtiliyor. Bir veya birden fazla kişi olabilir bir müşteriye."*)
//
// LİSTE PENCERE AÇILINCA TARAYICIDAN ÇEKİLİR, sayfa yalnız SAYIYI okur. Gerekçe
// ölçülüdür: defterde yirmiden fazla müşteri var ve hepsinin kişilerini sunucuda
// okumak, kullanıcının hiç açmayacağı yüzlerce satırı her sayfa yüklemesinde
// taşımak demekti (fiyat arşivinin `count` embed dersi). Sayı satırda durur,
// ayrıntı istendiğinde gelir.
//
// KİŞİ DÜZENLEMESİ SATIR İÇİNDEDİR, İKİNCİ BİR PENCERE AÇMAZ: bu ekranın
// kendisi zaten bir penceredir ve iç içe pencere telefonda kapatma sırasını
// belirsizleştirir (kullanıcı hangi katmanı kapattığını bilemez).

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import {
  createCustomerContact,
  deleteCustomerContact,
  updateCustomerContact,
  type CustomerContactInput,
} from "../actions";
import { createClient } from "@/lib/supabase/client";
import { activeContacts, type CustomerContact } from "@/lib/customer-contacts";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TAM_BOY_PENCERE } from "@/components/pencere";

const BOS_FORM: CustomerContactInput = {
  name: "",
  title: "",
  department: "",
  phone: "",
  email: "",
  note: "",
  isPrimary: false,
  active: true,
};

/** Kişiyi düzenleme formuna açar — kayıt hangi kapıdan girdiyse aynı alanlar. */
function formaCevir(c: CustomerContact): CustomerContactInput {
  return {
    name: c.name,
    title: c.title,
    department: c.department,
    phone: c.phone,
    email: c.email,
    note: c.note,
    isPrimary: c.isPrimary,
    active: c.active,
  };
}

/**
 * Boş alan `—` ile görünür (değişmez md. 5): kutuya örnek bir değer yazmak
 * ("Örn. 0532 …") kullanıcının onu gerçek veri sanmasının en kısa yoludur.
 */
function metin(value: string): string {
  return value.trim() || "—";
}

/** Kişinin ikinci satırı: yalnız DOLU alanlar birleşir, boşluk bırakılmaz. */
function ozet(parcalar: readonly string[]): string {
  const dolu = parcalar.map((p) => p.trim()).filter(Boolean);
  return dolu.length > 0 ? dolu.join(" · ") : "—";
}

/**
 * Defteri tarayıcıdan okur. PASİF KİŞİLER DE GELİR: bu ekran defteri YÖNETİR,
 * onu kullanmaz — pasife çekilmiş bir kişiyi geri açmanın başka yolu kalmazdı.
 * `activeContacts` süzgeci yalnız ÖNERİ yolunda (teklif kapağı) çalışır.
 *
 * Bileşenin DIŞINDADIR ve setState ETMEZ: efekt gövdesinden çağrılacak, durum
 * yazımı `await`ten sonra çağıranda yapılacak.
 */
async function kisileriOku(
  customerId: string
): Promise<{ liste: CustomerContact[]; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customer_contacts")
    .select("id, customer_id, name, title, department, phone, email, note, is_primary, active, sort")
    .eq("customer_id", customerId)
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  if (error) return { liste: [], error: error.message };
  return {
    liste: (data ?? []).map((r) => ({
      id: r.id as string,
      customerId: r.customer_id as string,
      name: (r.name as string) ?? "",
      title: (r.title as string) ?? "",
      department: (r.department as string) ?? "",
      phone: (r.phone as string) ?? "",
      email: (r.email as string) ?? "",
      note: (r.note as string) ?? "",
      isPrimary: Boolean(r.is_primary),
      active: Boolean(r.active),
      sort: Number(r.sort) || 0,
    })),
  };
}

/** Ad/unvan/bölüm/telefon/e-posta/not alanları — ekleme ve düzenlemede aynı. */
function ContactFields({
  form,
  onChange,
  idOneki,
  disabled,
}: {
  form: CustomerContactInput;
  onChange: (next: CustomerContactInput) => void;
  idOneki: string;
  disabled: boolean;
}) {
  function set<K extends keyof CustomerContactInput>(key: K, value: CustomerContactInput[K]) {
    onChange({ ...form, [key]: value });
  }

  const alanlar = [
    { key: "name" as const, id: "ad", etiket: "Ad Soyad", ipucu: "Teklif kapağındaki KİME satırına yazılır", max: 160, gerekli: true },
    { key: "title" as const, id: "unvan", etiket: "Unvan", ipucu: "Muhatap listesinde adın yanında görünür", max: 120 },
    { key: "department" as const, id: "bolum", etiket: "Bölüm", ipucu: "Kapaktaki «Bölüm» satırı", max: 120 },
    { key: "phone" as const, id: "telefon", etiket: "Telefon", ipucu: "Kapaktaki «Telefon» satırı", max: 60, tip: "tel" },
    { key: "email" as const, id: "eposta", etiket: "E-posta", ipucu: "Belgeye basılmaz; defterde durur", max: 160, tip: "email" },
    { key: "note" as const, id: "not", etiket: "Not", ipucu: "Yalnız defterde görünür", max: 500 },
  ];

  return (
    // ETİKETLER GÖRÜNÜRDÜR, yalnız `aria-label` DEĞİL (kullanıcı bildirimi,
    // 17.08.2026: *"iletişim kişisi eklerken açılan kutuda hangi kutu ne işe
    // yarar belli olmuyor"*). Altı kutu yan yana dizilince ekran okuyucuya
    // anlamlı ama GÖZE anlamsız bir ızgara çıkıyordu; her kutunun üstünde adı,
    // altında da belgede nereye gittiği yazıyor.
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {alanlar.map((a) => (
          <div key={a.key} className="grid gap-1.5">
            <Label htmlFor={`${idOneki}-${a.id}`}>
              {a.etiket}
              {a.gerekli ? <span className="text-destructive"> *</span> : null}
            </Label>
            <Input
              id={`${idOneki}-${a.id}`}
              type={a.tip}
              value={form[a.key]}
              onChange={(e) => set(a.key, e.target.value)}
              required={a.gerekli}
              maxLength={a.max}
              disabled={disabled}
              className="text-base pointer-fine:text-sm"
            />
            <p className="text-xs text-muted-foreground">{a.ipucu}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={form.isPrimary}
            onChange={(e) => set("isPrimary", e.target.checked)}
            disabled={disabled}
          />
          Teklifte önce bu kişi önerilsin
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
            disabled={disabled}
          />
          Muhatap listesinde görünsün
        </label>
      </div>
    </div>
  );
}

export function ContactsDialog({
  customerId,
  customerName,
  open,
  onOpenChange,
}: {
  customerId: string;
  customerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [liste, setListe] = useState<CustomerContact[] | null>(null);
  const [okumaHatasi, setOkumaHatasi] = useState<string | null>(null);
  const [ekleme, setEkleme] = useState<CustomerContactInput | null>(null);
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [duzenForm, setDuzenForm] = useState<CustomerContactInput>(BOS_FORM);
  const [silinecek, setSilinecek] = useState<string | null>(null);

  /** Defteri okur ve durumu tazeler — hem açılışta hem her yazmadan sonra. */
  const yukle = useCallback(async () => {
    const sonuc = await kisileriOku(customerId);
    if (sonuc.error) {
      setOkumaHatasi("Kişiler okunamadı: " + sonuc.error);
      setListe([]);
      return;
    }
    setOkumaHatasi(null);
    setListe(sonuc.liste);
  }, [customerId]);

  // AÇILIŞTA BİR KEZ ÇEKİLİR. setState `await`ten SONRA çalışır — efekt
  // gövdesinde SENKRON bir setState zincirleme render tetiklerdi
  // (`react-hooks/set-state-in-effect`, notification-bell'in kalıbı). `iptal`
  // bayrağı, cevap gelmeden kapatılan bir pencereye yazmayı engeller.
  useEffect(() => {
    let iptal = false;
    async function basla() {
      const sonuc = await kisileriOku(customerId);
      if (iptal) return;
      if (sonuc.error) {
        setOkumaHatasi("Kişiler okunamadı: " + sonuc.error);
        setListe([]);
        return;
      }
      setOkumaHatasi(null);
      setListe(sonuc.liste);
    }
    void basla();
    return () => {
      iptal = true;
    };
  }, [customerId]);

  /**
   * Yazma sonrası defter YENİDEN ÇEKİLİR, istemcide yamanmaz: birincil
   * işaretlemek KARDEŞ satırları da değiştirir (yıldız bir satırdan öbürüne
   * geçer) ve yerel yama o kardeşleri eski hâlinde bırakırdı. `router.refresh`
   * ayrıca satırdaki sayıyı tazeler.
   */
  function tazele() {
    void yukle();
    router.refresh();
  }

  function ekle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ekleme) return;
    startTransition(async () => {
      const res = await createCustomerContact(customerId, ekleme);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Kişi deftere eklendi.");
      setEkleme(null);
      tazele();
    });
  }

  function kaydet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!duzenlenen) return;
    startTransition(async () => {
      const res = await updateCustomerContact(duzenlenen, duzenForm);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Kişi güncellendi.");
      setDuzenlenen(null);
      tazele();
    });
  }

  /** Satırdaki yıldız ve pasif anahtarı aynı yazma yolundan geçer. */
  function isaretle(c: CustomerContact, degisiklik: Partial<CustomerContactInput>) {
    startTransition(async () => {
      const res = await updateCustomerContact(c.id, { ...formaCevir(c), ...degisiklik });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      tazele();
    });
  }

  function sil(id: string) {
    startTransition(async () => {
      const res = await deleteCustomerContact(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Kişi defterden silindi.");
      setSilinecek(null);
      tazele();
    });
  }

  const etkinSayisi = liste ? activeContacts(liste).length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Yükseklik kelepçesi `DialogContent` tabanındadır (MOBIL-4), burada
          tekrar edilmez; telefonda TAM BOY, çünkü kişi formu çok alanlıdır. */}
      <DialogContent className={`${TAM_BOY_PENCERE} sm:max-w-[min(46rem,calc(100%-2rem))]`}>
        <DialogHeader>
          <DialogTitle>İletişim Kişileri</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{customerName}</span> için muhatap defteri.
            Teklif kapağındaki &quot;KİME&quot; bloğu buradan önerilir; yıldızlı kişi önce
            gelir. Teslim edilmiş bir teklif bu defterden bağımsızdır — kişi
            sonradan düzeltilse de belgedeki ad değişmez.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {liste === null && (
            <p className="py-6 text-center text-sm text-muted-foreground">Kişiler yükleniyor…</p>
          )}

          {okumaHatasi && (
            <p className="border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
              {okumaHatasi}
            </p>
          )}

          {liste !== null && liste.length === 0 && !okumaHatasi && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Bu müşterinin defterinde kişi yok.
            </p>
          )}

          {(liste ?? []).map((c) => (
            <div
              key={c.id}
              className={
                "rounded-lg border p-2.5 " + (c.active ? "" : "opacity-60 border-dashed")
              }
            >
              {duzenlenen === c.id ? (
                <form onSubmit={kaydet} className="grid gap-2">
                  <ContactFields
                    form={duzenForm}
                    onChange={setDuzenForm}
                    idOneki={`kisi-${c.id}`}
                    disabled={pending}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDuzenlenen(null)}
                    >
                      Vazgeç
                    </Button>
                    <Button type="submit" size="sm" disabled={pending}>
                      {pending ? "Kaydediliyor…" : "Kaydet"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  {/* Serbest metin hücresi telefonda SARAR (MOBIL-15): boşluksuz
                      uzun bir e-posta adresi kutuyu kendi genişliğine çekmesin. */}
                  <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{metin(c.name)}</span>
                      {c.isPrimary && (
                        <span className="border px-1 text-[11px] font-normal text-muted-foreground">
                          Birincil
                        </span>
                      )}
                      {!c.active && (
                        <span className="border border-dashed px-1 text-[11px] font-normal text-muted-foreground">
                          Pasif
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {ozet([c.title, c.department])}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {ozet([c.phone, c.email])}
                    </div>
                    {c.note.trim() && (
                      <div className="mt-0.5 text-[13px] text-muted-foreground">{c.note}</div>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => isaretle(c, { isPrimary: !c.isPrimary })}
                      aria-label={
                        c.isPrimary
                          ? c.name + " birincil işaretini kaldır"
                          : c.name + " kişisini birincil yap"
                      }
                      aria-pressed={c.isPrimary}
                      title={c.isPrimary ? "Birincil işaretini kaldır" : "Birincil yap"}
                    >
                      <Star className={c.isPrimary ? "fill-current" : undefined} />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => isaretle(c, { active: !c.active })}
                      aria-label={
                        c.active ? c.name + " kişisini pasife al" : c.name + " kişisini etkinleştir"
                      }
                      aria-pressed={c.active}
                      title={c.active ? "Pasife al" : "Etkinleştir"}
                    >
                      {c.active ? <X /> : <Check />}
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        setDuzenForm(formaCevir(c));
                        setDuzenlenen(c.id);
                        setSilinecek(null);
                      }}
                      aria-label={c.name + " kaydını düzenle"}
                      title="Düzenle"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setSilinecek(c.id)}
                      aria-label={c.name + " kaydını sil"}
                      title="Sil"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              )}

              {/* SİLME ONAYI SATIR İÇİNDEDİR: iç içe pencere telefonda hangi
                  katmanın kapandığını belirsizleştirir. */}
              {silinecek === c.id && duzenlenen !== c.id && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
                  <span className="text-muted-foreground">
                    Kişi defterden silinecek. Teslim edilmiş tekliflerdeki ad DEĞİŞMEZ.
                    İşten ayrılmadıysa silmek yerine pasife alın.
                  </span>
                  <span className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSilinecek(null)}>
                      Vazgeç
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => sil(c.id)}
                    >
                      {pending ? "Siliniyor…" : "Sil"}
                    </Button>
                  </span>
                </div>
              )}
            </div>
          ))}

          {ekleme ? (
            <form onSubmit={ekle} className="grid gap-2 rounded-lg border border-dashed p-2.5">
              <ContactFields
                form={ekleme}
                onChange={setEkleme}
                idOneki="yeni-kisi"
                disabled={pending}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setEkleme(null)}>
                  Vazgeç
                </Button>
                <Button type="submit" size="sm" disabled={pending || ekleme.name.trim().length < 2}>
                  {pending ? "Ekleniyor…" : "Ekle"}
                </Button>
              </div>
            </form>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() => {
                // İLK KİŞİ KENDİLİĞİNDEN BİRİNCİLDİR: tek muhataplı bir
                // müşteride kullanıcıdan ayrıca yıldız beklemek, teklif
                // kapağının boş açılmasından başka bir şey üretmezdi.
                setEkleme({ ...BOS_FORM, isPrimary: etkinSayisi === 0 });
                setDuzenlenen(null);
                setSilinecek(null);
              }}
            >
              <Plus className="size-4" /> Kişi Ekle
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
