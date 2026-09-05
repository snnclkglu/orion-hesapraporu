import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const migration = read(
  "supabase/migrations/20260905000001_offer_job_engineering_transfer.sql"
);
const fixMigration = read(
  "supabase/migrations/20260905000002_offer_win_and_engineering_v0_fix.sql"
);

describe("teklif → iş emri → mühendislik veri sözleşmesi", () => {
  it("kazanılmış/yayınlı teklifi tek işlemde işe bağlar", () => {
    expect(migration).toContain("create or replace function public.create_job_from_offer");
    expect(migration).toContain("v_offer.status::text <> 'won'");
    expect(migration).toContain("v_revision.status::text <> 'issued'");
    expect(migration).toContain("update public.offers set job_id = v_job_id");
    expect(migration).toContain("insert into public.offer_job_conversions");
    expect(migration).toContain("insert into public.offer_engineering_handoffs");
  });

  it("mühendislik aktarım tablosunda ticari fiyat kolonları yoktur", () => {
    const handoffTable = migration.slice(
      migration.indexOf("create table if not exists public.offer_engineering_handoffs"),
      migration.indexOf("create index if not exists offer_engineering_handoffs_job_idx")
    );
    expect(handoffTable).not.toMatch(/unit_price|manual_cost|discount|payment|total_price/i);
    expect(handoffTable).toContain("technical_facts jsonb");
    expect(handoffTable).toContain("technical_snapshot jsonb");
    expect(migration).toContain("where entry.key = any (array[");
    expect(migration).toContain("'mainCapacityT', 'auxCapacityT', 'spanM'");
    expect(migration).not.toContain("coalesce(v_item->'technical_snapshot'");
    expect(migration).not.toContain("coalesce(v_item->'unmapped_fields'");
  });

  it("V0'ı iş emri ve benzersiz iş kalemi olmadan oluşturmaz", () => {
    expect(migration).toContain("create or replace function public.create_engineering_report_v0");
    expect(migration).toContain("if v_job.status::text <> 'active'");
    expect(migration).toContain("if nullif(btrim(p_job_item_no), '') is null");
    expect(migration).toContain("if v_item_count <> 1");
    expect(migration).toContain("if v_item_project_id is not null");
    expect(migration).toContain("p_source_mode not in ('manual', 'from_offer')");
  });

  it("V0 sorgusunda çıktı değişkeniyle project_id sütununu belirsiz bırakmaz", () => {
    expect(fixMigration).toContain("select ji.id, ji.project_id");
    expect(fixMigration).toContain("from public.job_items as ji");
    expect(fixMigration).not.toMatch(/\n\s*select id, project_id/);
  });

  it("Kazanıldı geçişinde son revizyonu aynı SQL işleminde yayımlar", () => {
    expect(fixMigration).toContain("create or replace function public.mark_offer_won");
    expect(fixMigration).toContain("order by r.rev_no desc");
    expect(fixMigration).toContain("set status = 'issued'");
    expect(fixMigration).toContain("set status = 'won'");
  });

  it("liste son revizyon için düzenle, önizle ve indir eylemlerini sunar", () => {
    const table = read("src/app/(app)/offers/offers-table.tsx");
    expect(table).toContain("LatestRevisionActions");
    expect(table).toContain(">Düzenle</");
    expect(table).toContain(">Önizle</");
    expect(table).toContain(">İndir</");
    expect(table).not.toContain('>Kapsam</TableHead>');
  });

  it("mobil paylaşım verisine bağlantı veya metin eklemez", () => {
    const download = read("src/components/pdf-download-link.tsx");
    expect(download).toContain("navigator.share({ files: [file] })");
    expect(download).not.toMatch(/navigator\.share\(\{[\s\S]*?\b(url|text|title)\s*:/);
  });

  it("Yeni İş sayfasında işe bağlanmamış kazanılan teklifleri seçtirir", () => {
    const page = read("src/app/(app)/jobs/new/page.tsx");
    const picker = read("src/app/(app)/jobs/won-offer-picker.tsx");
    expect(page).toContain('<WonOfferPicker offers={wonOffers} />');
    expect(page).toContain('.eq("status", "won")');
    expect(page).toContain('.is("job_id", null)');
    expect(page).toContain('.eq("offer_revisions.status", "issued")');
    expect(picker).toContain("/work-order`");
  });

  it("İşler'e açılan teklif RPC'si ticari alanları DB içinde ayıklar", () => {
    expect(fixMigration).toContain("create or replace function public.job_offer_document_payload");
    expect(fixMigration).toContain("'pricing', '{}'::jsonb");
    expect(fixMigration).toContain("'paymentLines', '[]'::jsonb");
    expect(fixMigration).toContain("not in ('payment', 'price', 'tax')");
    expect(fixMigration).toContain("jsonb_build_object('notes', p.notes)");
    expect(fixMigration).toContain("jsonb_build_object('generalTerms', p.general_terms)");
    expect(fixMigration).toContain("- 'userId' - 'signaturePath' - 'signatureName'");
    expect(fixMigration).toContain("create or replace function public.get_job_offer_document");
    expect(fixMigration).not.toContain("total_amount text");
  });

  it("sade teklif belgesini iş sekmesi, liste ve hesap raporunda koşullu sunar", () => {
    const nav = read("src/app/(app)/jobs/[id]/job-nav.tsx");
    const table = read("src/app/(app)/jobs/jobs-table.tsx");
    const project = read("src/app/(app)/projects/[id]/project-header.tsx");
    expect(nav).toContain('label: "Teklif Dokümanı"');
    expect(table).toContain("JobDocumentButtons");
    expect(table).toContain("job.hasOfferDocument");
    expect(table).toContain("/offer-document`");
    expect(project).toContain("offerDocumentHref");
    expect(project).toContain("fiyat ve ödeme içermeyen teklif dokümanını aç");
  });

  it("Mühendislik okumasını yalnız Yönetici, Müdür ve Mühendise açar", () => {
    const roles = read("src/lib/roles.ts");
    const layout = read("src/app/(app)/projects/layout.tsx");
    const jobDetail = read("src/app/(app)/jobs/[id]/(hub)/page.tsx");
    expect(roles).toContain("export function canSeeEngineering");
    expect(roles).toContain("visible: canSeeEngineering");
    expect(layout).toContain("if (!profile || !canSeeEngineering(profile.role)) redirect");
    expect(jobDetail).toContain("canViewEngineering={canViewEngineering}");
    expect(jobDetail).toContain("Rapor erişimi yetki gerektiriyor");
    expect(fixMigration).toContain("create or replace function public.can_see_engineering");
    expect(fixMigration).toContain("p.role::text in ('admin', 'manager', 'engineer')");
    expect(fixMigration).toContain('create policy "projects_select"');
  });

  it("arayüz bağımsız mühendislik raporu önermiyor ve iki başlangıç modu sunuyor", () => {
    const dialog = read("src/app/(app)/projects/new-project-dialog.tsx");
    const actions = read("src/app/(app)/projects/actions.ts");
    expect(dialog).toContain('<TabsTrigger value="manual">');
    expect(dialog).toContain('<TabsTrigger value="from_offer">');
    expect(dialog).not.toContain("Bağımsız (İşe Atanmamış)");
    expect(actions).toContain('job_id: z.uuid("İş emri seçilmeli")');
    expect(actions).toContain('job_item_id: z.uuid("İş kalemi seçilmeli")');
  });
});
