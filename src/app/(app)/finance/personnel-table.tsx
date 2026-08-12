"use client";

// Personel listesi.
//
// AYRILANLAR AYRI BİR EKRANDA DEĞİLDİR — aynı listede kalır, "Ayrıldı"
// rozetiyle görünür ve Durum süzgeciyle ayrılır. Mühendislik listesindeki
// arşiv kuralının aynısı: ayrılmak bir SİLME değil bir İŞARETtir. Ayrı bir
// ekran kursaydık "eski çalışanın bordrosuna bakmak" ayrı bir yolculuk olurdu
// ve arama iki listeye bölünürdü.
//
// SÜZGEÇ ADRESTE DURUR (istemci state'inde değil): finans müdürü "ayrılanlar"
// görünümünü meslektaşına bağlantı olarak yollayabilmelidir.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, IdCard, Plus, Search, UserCheck, UserMinus, Users } from "lucide-react";
import {
  PERSONNEL_CATEGORIES,
  categoryHue,
  categoryLabel,
} from "@/lib/finance/personnel";
import { hizmetSuresiMetni } from "@/lib/finance/payroll";
import { tagStyle } from "@/lib/tags";
import { trKucuk } from "@/lib/tr-text";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { NewEmployeeDialog } from "./employee-dialog";
import type { EmployeeRow } from "./schema";

const AT_MD = "hidden md:table-cell";
const AT_LG = "hidden lg:table-cell";
const AT_XL = "hidden xl:table-cell";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Türkçe arama: "İ/ı" ayrımı `toLowerCase()` ile bozulur. */
function eslesirMi(e: EmployeeRow, ara: string): boolean {
  if (!ara) return true;
  const k = trKucuk(ara);
  return (
    trKucuk(e.fullName).includes(k) ||
    trKucuk(e.title).includes(k) ||
    trKucuk(e.department).includes(k) ||
    trKucuk(e.employeeNo).includes(k) ||
    (e.nationalId ?? "").includes(ara.trim())
  );
}

export function PersonnelTable({
  employees,
  bugun,
  durum,
  kategori,
  ara,
  canWrite,
}: {
  employees: EmployeeRow[];
  bugun: string;
  durum: string;
  kategori: string;
  ara: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [yeni, setYeni] = useState(false);
  // Arama kutusu YEREL durumdur, adres her tuşta değişmez; kullanıcı yazmayı
  // bitirince (blur / Enter) adrese yazılır. Her harfte `router.replace`
  // çağırmak sunucu bileşenini yeniden çalıştırırdı.
  const [aramaMetni, setAramaMetni] = useState(ara);

  function suzgecYaz(anahtar: string, deger: string) {
    const q = new URLSearchParams(params?.toString() ?? "");
    if (deger) q.set(anahtar, deger);
    else q.delete(anahtar);
    router.replace(q.toString() ? `/finance?${q}` : "/finance", { scroll: false });
  }

  const gorunen = useMemo(() => {
    return employees.filter((e) => {
      if (durum === "aktif" && !e.active) return false;
      if (durum === "ayrildi" && e.active) return false;
      if (kategori && e.category !== kategori) return false;
      return eslesirMi(e, aramaMetni === ara ? ara : aramaMetni);
    });
  }, [employees, durum, kategori, ara, aramaMetni]);

  const yil = bugun.slice(0, 4);
  const sayilar = useMemo(() => {
    let aktif = 0;
    let buYilGiren = 0;
    let buYilAyrilan = 0;
    let belgeUyarisi = 0;
    for (const e of employees) {
      if (e.active) aktif++;
      if (e.expiringDocs > 0) belgeUyarisi++;
      for (const d of e.employment) {
        if (d.startDate.slice(0, 4) === yil) buYilGiren++;
        if (d.endDate && d.endDate.slice(0, 4) === yil) buYilAyrilan++;
      }
    }
    return { aktif, buYilGiren, buYilAyrilan, belgeUyarisi };
  }, [employees, yil]);

  return (
    <div className="grid gap-3">
      {/* SAYAÇLAR */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Sayac ikon={<Users className="size-4" />} etiket="Aktif Çalışan" deger={sayilar.aktif} />
        <Sayac
          ikon={<UserCheck className="size-4" />}
          etiket={`${yil} İşe Giren`}
          deger={sayilar.buYilGiren}
        />
        <Sayac
          ikon={<UserMinus className="size-4" />}
          etiket={`${yil} Ayrılan`}
          deger={sayilar.buYilAyrilan}
        />
        <Sayac
          ikon={<AlertTriangle className="size-4" />}
          etiket="Belgesi Süreli"
          deger={sayilar.belgeUyarisi}
          vurgu={sayilar.belgeUyarisi > 0}
        />
      </div>

      {/* SÜZGEÇ ŞERİDİ */}
      <div className="oc-scrollx flex flex-wrap items-center gap-2 overflow-x-auto border bg-card p-2 [--oc-scroll-bg:var(--card)]">
        <div className="flex shrink-0 items-center gap-1">
          {(
            [
              ["aktif", "Aktif"],
              ["ayrildi", "Ayrılanlar"],
              ["tumu", "Tümü"],
            ] as const
          ).map(([deger, etiket]) => (
            <Button
              key={deger}
              type="button"
              size="sm"
              variant={durum === deger ? "default" : "outline"}
              className="oc-tap"
              onClick={() => suzgecYaz("durum", deger === "aktif" ? "" : deger)}
            >
              {etiket}
            </Button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={kategori ? "outline" : "secondary"}
            className="oc-tap"
            onClick={() => suzgecYaz("kategori", "")}
          >
            Tüm Kategoriler
          </Button>
          {PERSONNEL_CATEGORIES.map((k) => (
            <Button
              key={k}
              type="button"
              size="sm"
              variant={kategori === k ? "secondary" : "outline"}
              className="oc-tap"
              onClick={() => suzgecYaz("kategori", kategori === k ? "" : k)}
            >
              {categoryLabel(k)}
            </Button>
          ))}
        </div>

        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={aramaMetni}
            onChange={(e) => setAramaMetni(e.target.value)}
            onBlur={() => suzgecYaz("ara", aramaMetni)}
            onKeyDown={(e) => {
              if (e.key === "Enter") suzgecYaz("ara", aramaMetni);
            }}
            aria-label="Personel ara"
            className="pl-8 text-base pointer-fine:text-sm"
          />
        </div>

        {canWrite && (
          <Button type="button" size="sm" className="oc-tap shrink-0" onClick={() => setYeni(true)}>
            <Plus className="size-4" />
            Yeni Personel
          </Button>
        )}
      </div>

      {/* TABLO */}
      <div className="oc-scrollx overflow-x-auto border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad Soyad</TableHead>
              <TableHead className={AT_MD}>Kategori</TableHead>
              <TableHead className={AT_MD}>Görev</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className={AT_LG}>İşe Giriş</TableHead>
              <TableHead className={AT_LG}>Kıdem</TableHead>
              <TableHead className={AT_XL}>Telefon</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gorunen.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Süzgece uyan personel yok.
                </TableCell>
              </TableRow>
            )}
            {gorunen.map((e) => (
              <TableRow key={e.id} className="hover:bg-muted/40">
                <TableCell className="max-w-[16rem]">
                  <Link href={`/finance/${e.id}`} className="block">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium" title={e.fullName}>
                        {e.fullName}
                      </span>
                      {/* TC no eksikliği bir HATA DEĞİL bir eksikliktir: yabancı
                          uyruklu personelin numarası olmayabilir. İşaret sessiz. */}
                      {!e.nationalId && (
                        <IdCard
                          className="size-3.5 shrink-0 text-muted-foreground/60"
                          aria-label="TC kimlik numarası girilmemiş"
                        />
                      )}
                      {e.expiringDocs > 0 && (
                        <span
                          className="shrink-0 border border-amber-500/40 bg-amber-500/10 px-1 font-mono text-[11px] text-amber-700 dark:text-amber-400"
                          title={`${e.expiringDocs} belgenin süresi dolmuş ya da doluyor`}
                        >
                          {e.expiringDocs}
                        </span>
                      )}
                    </div>
                    {/* Dar ekranda gizlenen kritik bilgi burada ikinci satır olur —
                        ikinci bir KART markup'ı yazılmaz. */}
                    <div className="truncate text-xs text-muted-foreground md:hidden">
                      {e.title || categoryLabel(e.category)}
                    </div>
                  </Link>
                </TableCell>
                <TableCell className={AT_MD}>
                  <span
                    className="oc-tag px-1.5 py-0.5 text-[11px]"
                    style={tagStyle(categoryHue(e.category))}
                    title={e.category}
                  >
                    {categoryLabel(e.category)}
                  </span>
                </TableCell>
                <TableCell className={cn(AT_MD, "max-w-[14rem] truncate")} title={e.title}>
                  {e.title || "—"}
                </TableCell>
                <TableCell>
                  {e.active ? (
                    <Badge variant="outline" className="border-emerald-600/40 bg-emerald-600/10 font-normal text-emerald-700 dark:text-emerald-400">
                      Aktif
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      Ayrıldı
                    </Badge>
                  )}
                </TableCell>
                <TableCell className={cn(AT_LG, "text-muted-foreground")}>
                  {fmtDate(e.currentStart)}
                  {!e.active && e.lastEnd && (
                    <span className="ml-1 text-xs">→ {fmtDate(e.lastEnd)}</span>
                  )}
                </TableCell>
                <TableCell className={cn(AT_LG, "text-muted-foreground")}>
                  {/* Kıdem BÜTÜN dönemlerin toplamıdır: aynı kişi iki kez
                      çalıştıysa yalnız son dönemi saymak onu olduğundan yeni
                      gösterirdi. */}
                  {hizmetSuresiMetni(e.serviceDays)}
                  {e.employment.length > 1 && (
                    <span className="ml-1 text-[11px]" title={`${e.employment.length} çalışma dönemi`}>
                      ({e.employment.length} dönem)
                    </span>
                  )}
                </TableCell>
                <TableCell className={cn(AT_XL, "font-mono text-xs text-muted-foreground")}>
                  {e.phone || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {gorunen.length} / {employees.length} kişi görünüyor. Ayrılan personel silinmez —
        çalışma dönemi kapanır ve kaydı, maaş geçmişiyle birlikte burada kalır.
      </p>

      {yeni && <NewEmployeeDialog onClose={() => setYeni(false)} />}
    </div>
  );
}

function Sayac({
  ikon,
  etiket,
  deger,
  vurgu,
}: {
  ikon: React.ReactNode;
  etiket: string;
  deger: number;
  vurgu?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border bg-card px-3 py-2.5",
        vurgu && "border-amber-500/40 bg-amber-500/5"
      )}
    >
      <span className={cn("text-muted-foreground", vurgu && "text-amber-600 dark:text-amber-400")}>
        {ikon}
      </span>
      <div className="min-w-0">
        <div className="oc-kicker truncate text-muted-foreground">{etiket}</div>
        <div className="font-mono text-lg leading-tight font-semibold">{deger}</div>
      </div>
    </div>
  );
}
