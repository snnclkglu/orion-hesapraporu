// Müşteri defteri yönetimi — liste + ekle / düzenle / sil.
//
// Defter şimdiye kadar yalnız iş emri formundaki pop-up'tan besleniyordu:
// yanlış yazılmış bir unvanı ya da eksik vergi numarasını düzeltmenin yolu
// yoktu. Kısaltma ve renk de burada yönetilir (İşler ve Satış Takibi listeleri
// bu iki alanı gösterir).

import { createClient } from "@/lib/supabase/server";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CustomerRow, type CustomerAdminRow } from "./customer-row";
import { NewCustomerButton } from "./new-customer-button";

/**
 * `count` embed'inin iki biçimi vardır ve ikisi de görülür: PostgREST kimi
 * sürümde `[{ count: 3 }]` dizisi, kimi sürümde tek nesne döndürür. Hiç kayıt
 * yoksa dizi BOŞ gelir — o hâlde sayı 0'dır, "bilinmiyor" değil.
 */
function embedSayisi(value: unknown): number {
  if (Array.isArray(value)) return Number((value[0] as { count?: number } | undefined)?.count) || 0;
  return Number((value as { count?: number } | null)?.count) || 0;
}

export default async function AdminCustomersPage() {
  const supabase = await createClient();

  const [{ data: customers }, { data: jobs }] = await Promise.all([
    supabase
      .from("customers")
      // İletişim kişileri SAYIYLA gelir, satırlarıyla değil (`count` embed —
      // fiyat arşivi dersi): defterdeki her müşterinin kişilerini burada
      // okumak, kullanıcının çoğunu hiç açmayacağı yüzlerce satırı her sayfa
      // yüklemesinde taşımak olurdu. Ayrıntıyı pencere kendisi çeker.
      .select(
        "id, name, short_name, color_hue, address, tax_office, tax_no, phone, fax, notes, logo_path, logo_name, customer_contacts(count)"
      )
      .order("name", { ascending: true }),
    // Bağlı iş sayısı silme uyarısında kullanılır — sayı için ayrı bir sorgu
    // yerine tek seferde okunur (defter onlarca satırdır).
    supabase.from("jobs").select("customer_id"),
  ]);

  const jobCounts = new Map<string, number>();
  for (const j of (jobs ?? []) as { customer_id: string | null }[]) {
    if (!j.customer_id) continue;
    jobCounts.set(j.customer_id, (jobCounts.get(j.customer_id) ?? 0) + 1);
  }

  const rows: CustomerAdminRow[] = (customers ?? []).map((c) => ({
    id: c.id as string,
    name: (c.name as string) ?? "",
    short_name: (c.short_name as string) ?? "",
    color_hue: Number(c.color_hue) || 0,
    address: (c.address as string) ?? "",
    tax_office: (c.tax_office as string) ?? "",
    tax_no: (c.tax_no as string) ?? "",
    phone: (c.phone as string) ?? "",
    fax: (c.fax as string) ?? "",
    notes: (c.notes as string) ?? "",
    // Logo YOLU listeye taşınır ama BAYTLARI değil: satırda logo gösterilmez
    // (defter onlarca satırdır ve her biri için indirme yapmak sayfayı
    // yavaşlatırdı), yol yalnız düzenleme penceresine geçer.
    logo_path: (c.logo_path as string) ?? "",
    logo_name: (c.logo_name as string) ?? "",
    jobCount: jobCounts.get(c.id as string) ?? 0,
    contactCount: embedSayisi(c.customer_contacts),
  }));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Müşteriler</h2>
          <p className="text-sm text-muted-foreground">
            Müşteri defteri. Kısaltma ve renk İşler ile Satış Takibi
            listelerinde görünür; Profil düğmesi ticari ilişki analizini açar.
          </p>
        </div>
        <NewCustomerButton />
      </div>

      <div className="rounded-lg border">
        <Table>
          {/*
            SÜTUN ÖNCELİKLENDİRME. Altı sütun telefonda ekranın iki katına
            çıkıyordu; sabit genişlikler (9rem + %22 + 10rem + 5rem + 6rem)
            otomatik yerleşimle çekişip unvan sütununu eziyordu. Dar ekranda
            kısaltma · unvan · eylemler kalır, vergi/telefon/iş sayısı unvanın
            altında ikinci satıra iner (bkz. customer-row.tsx). Sabit
            genişlikler yalnız sütunların hepsi görünürken (`md`) devrededir.
          */}
          <TableHeader>
            <TableRow>
              <TableHead className="md:w-[9rem]">Kısaltma</TableHead>
              <TableHead>Resmî Unvan</TableHead>
              <TableHead className="hidden md:table-cell md:w-[22%]">Vergi Dairesi / No</TableHead>
              <TableHead className="hidden md:table-cell md:w-[10rem]">Telefon</TableHead>
              <TableHead className="hidden text-right md:table-cell md:w-[5rem]">İş</TableHead>
              <TableHead className="md:w-[12rem]"><span className="sr-only">İşlemler</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <CustomerRow key={row.id} row={row} />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Defterde müşteri yok.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
