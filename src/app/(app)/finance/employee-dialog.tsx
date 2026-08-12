"use client";

// YENİ PERSONEL penceresi.
//
// BURADA OTUZ ALAN SORULMAZ. Künyenin tamamı (kan grubu, öğrenim, acil durum
// kişisi, IBAN…) profil sayfasında düzenlenir; yeni kayıt açarken sorulan
// şey işe alım anında elde GERÇEKTEN olan bilgidir. Uzun bir form, kaydı
// açmayı ertelettirir ve kişi hiç girilmez.
//
// İŞE GİRİŞ TARİHİ BURADADIR ve bu bilinçlidir: tarih künyeye değil ilk
// ÇALIŞMA DÖNEMİNE yazılır (`fin_employment`). Ayrı bir adımda sordurmak
// kullanıcıyı hiçbir şey kazandırmayan ikinci bir pencereye zorlardı —
// `saveEmployee` üçüncü argümanla ikisini tek işlemde yapar.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  DEPARTMENTS,
  JOB_TITLES,
  PERSONNEL_CATEGORIES,
  WORK_MODES,
  WORK_MODE_LABELS,
  categoryLabel,
  tcKimlikGecerliMi,
} from "@/lib/finance/personnel";
import { adBuyuk } from "@/lib/tr-text";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EditableCombobox } from "@/components/editable-combobox";
import { saveEmployee } from "./actions";
import { EMPTY_EMPLOYEE, type EmployeeInput } from "./schema";

export function NewEmployeeDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<EmployeeInput>({ ...EMPTY_EMPLOYEE });
  const [giris, setGiris] = useState("");

  function alan<K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const tcMetni = String(form.nationalId ?? "").trim();
  // DOĞRULAMA BİR UYARIDIR, ENGEL DEĞİL: yabancı uyruklu personelin numarası
  // 99 ile başlar ve NVİ algoritmasını geçmez; devralınan kayıtta üç kişinin
  // ise hiç numarası yok. Reddetmek onları kaydedilemez yapardı.
  const tcUyarisi = tcMetni.length > 0 && !tcKimlikGecerliMi(tcMetni);

  function kaydet() {
    if (!String(form.fullName ?? "").trim()) {
      toast.error("Ad soyad gerekli.");
      return;
    }
    startTransition(async () => {
      const sonuc = await saveEmployee(null, form, giris || undefined);
      if (sonuc.error && !sonuc.ok) {
        toast.error(sonuc.error);
        return;
      }
      // Personel yazıldı ama dönem yazılamadıysa eylem İKİSİNİ birden döner:
      // kayıt kaybolmaz, kullanıcı eksiği bilir.
      if (sonuc.error) toast.warning(sonuc.error);
      else toast.success("Personel eklendi.");
      onClose();
      if (sonuc.id) router.push(`/finance/${sonuc.id}`);
      else router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[min(42rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>Yeni Personel</DialogTitle>
          <DialogDescription>
            Burada yalnız işe alım anında elde olan bilgiler sorulur. Kan grubu, öğrenim,
            acil durum kişisi, IBAN ve diğer künye alanları kaydı açtıktan sonra profil
            sayfasından doldurulur.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="yp-ad">Ad Soyad</Label>
            <Input
              id="yp-ad"
              autoFocus
              className="text-base pointer-fine:text-sm"
              value={String(form.fullName ?? "")}
              // BÜYÜK HARF kullanıcı YAZARKEN de uygulanır (anında görsün);
              // şema tarafında ikinci kez yapılır ki kayıt hangi kapıdan
              // girerse girsin öyle olsun.
              onChange={(e) => alan("fullName", adBuyuk(e.target.value))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="yp-kategori">Kategori</Label>
              <Select
                value={String(form.category ?? "")}
                onValueChange={(v) => alan("category", v)}
              >
                <SelectTrigger id="yp-kategori" className="oc-tap">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERSONNEL_CATEGORIES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {categoryLabel(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="yp-sicil">Sicil No</Label>
              <Input
                id="yp-sicil"
                className="text-base pointer-fine:text-sm"
                value={String(form.employeeNo ?? "")}
                onChange={(e) => alan("employeeNo", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="yp-gorev">Görev Tanımı</Label>
              <EditableCombobox
                aria-label="Görev tanımı"
                uppercase
                value={String(form.title ?? "")}
                onChange={(v) => alan("title", adBuyuk(v))}
                options={[...JOB_TITLES]}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="yp-departman">Departman</Label>
              <EditableCombobox
                aria-label="Departman"
                uppercase
                value={String(form.department ?? "")}
                onChange={(v) => alan("department", adBuyuk(v))}
                options={[...DEPARTMENTS]}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="yp-tc">TC Kimlik No</Label>
              <Input
                id="yp-tc"
                inputMode="numeric"
                className="text-base pointer-fine:text-sm"
                value={tcMetni}
                onChange={(e) => alan("nationalId", e.target.value.replace(/\D/g, "").slice(0, 11))}
              />
              {tcUyarisi && (
                <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-3.5 shrink-0" />
                  Numara doğrulamayı geçmedi. Yabancı uyruklu personelde bu normaldir;
                  kayıt yine de yapılabilir.
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="yp-tel">Telefon</Label>
              <Input
                id="yp-tel"
                inputMode="tel"
                className="text-base pointer-fine:text-sm"
                value={String(form.phone ?? "")}
                onChange={(e) => alan("phone", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="yp-giris">İşe Giriş Tarihi</Label>
              <Input
                id="yp-giris"
                type="date"
                className="text-base pointer-fine:text-sm"
                value={giris}
                onChange={(e) => setGiris(e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="yp-sozlesme">Sözleşme Türü</Label>
              <Select
                value={String(form.contractType ?? "belirsiz")}
                onValueChange={(v) => alan("contractType", v as EmployeeInput["contractType"])}
              >
                <SelectTrigger id="yp-sozlesme" className="oc-tap">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {CONTRACT_TYPE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="yp-calisma">Çalışma Şekli</Label>
              <Select
                value={String(form.workMode ?? "tam")}
                onValueChange={(v) => alan("workMode", v as EmployeeInput["workMode"])}
              >
                <SelectTrigger id="yp-calisma" className="oc-tap">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORK_MODES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {WORK_MODE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            İşe giriş tarihi kişinin ilk <strong>çalışma dönemini</strong> açar. Bir kişi
            ayrılıp geri dönerse ikinci bir kayıt açılmaz — profil sayfasından yeni bir
            dönem eklenir ve kıdem dönemlerin toplamıdır.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" className="oc-tap" onClick={onClose}>
            Vazgeç
          </Button>
          <Button className="oc-tap" disabled={pending} onClick={kaydet}>
            {pending ? "Kaydediliyor…" : "Personeli Ekle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
