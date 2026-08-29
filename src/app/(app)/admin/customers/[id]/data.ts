import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCustomerLogo } from "@/lib/customers/logo-server";
import type {
  CustomerProfileContact,
  CustomerProfileDataset,
  CustomerProfileIdentity,
  CustomerProfileJob,
  CustomerProfileOffer,
  CustomerProfileProject,
} from "@/lib/customer-profile";

export interface LoadedCustomerProfile {
  data: CustomerProfileDataset;
  logoUrl: string | null;
}

export async function loadCustomerProfile(
  supabase: SupabaseClient,
  customerId: string
): Promise<LoadedCustomerProfile | null> {
  const { data: rawCustomer } = await supabase
    .from("customers")
    .select("id, name, short_name, color_hue, address, tax_office, tax_no, phone, fax, notes, logo_path, logo_name, created_at, updated_at")
    .eq("id", customerId)
    .maybeSingle();
  if (!rawCustomer) return null;

  const [contactsResult, offersResult, jobsResult] = await Promise.all([
    supabase
      .from("customer_contacts")
      .select("id, name, title, department, phone, email, note, is_primary, active, sort")
      .eq("customer_id", customerId)
      .order("active", { ascending: false })
      .order("sort", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("offer_list")
      .select("id, offer_no, subject, status, currency, latest_total, issued_on, issue_date, created_at, updated_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("jobs")
      .select("id, job_no, title, status, work_order_date, created_at, updated_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const jobs: CustomerProfileJob[] = (jobsResult.data ?? []).map((job) => ({
    id: String(job.id),
    jobNo: String(job.job_no ?? ""),
    title: String(job.title ?? ""),
    status: String(job.status ?? "active"),
    workOrderDate: job.work_order_date ? String(job.work_order_date) : null,
    createdAt: String(job.created_at),
    updatedAt: String(job.updated_at),
  }));
  let projects: CustomerProfileProject[] = [];
  if (jobs.length > 0) {
    const { data: projectRows } = await supabase
      .from("projects")
      .select("id, job_id, doc_no, name, status, created_at, updated_at")
      .in("job_id", jobs.map((job) => job.id))
      .eq("report_context", "engineering")
      .order("created_at", { ascending: false })
      .limit(1000);
    projects = (projectRows ?? []).map((project) => ({
      id: String(project.id),
      jobId: project.job_id ? String(project.job_id) : null,
      docNo: String(project.doc_no ?? ""),
      name: String(project.name ?? ""),
      status: String(project.status ?? "active"),
      createdAt: String(project.created_at),
      updatedAt: String(project.updated_at),
    }));
  }

  const customer: CustomerProfileIdentity = {
    id: String(rawCustomer.id),
    name: String(rawCustomer.name ?? ""),
    shortName: String(rawCustomer.short_name ?? ""),
    colorHue: Number(rawCustomer.color_hue) || 0,
    address: String(rawCustomer.address ?? ""),
    taxOffice: String(rawCustomer.tax_office ?? ""),
    taxNo: String(rawCustomer.tax_no ?? ""),
    phone: String(rawCustomer.phone ?? ""),
    fax: String(rawCustomer.fax ?? ""),
    notes: String(rawCustomer.notes ?? ""),
    logoPath: String(rawCustomer.logo_path ?? ""),
    logoName: String(rawCustomer.logo_name ?? ""),
    createdAt: String(rawCustomer.created_at),
    updatedAt: String(rawCustomer.updated_at),
  };
  const contacts: CustomerProfileContact[] = (contactsResult.data ?? []).map((contact) => ({
    id: String(contact.id),
    name: String(contact.name ?? ""),
    title: String(contact.title ?? ""),
    department: String(contact.department ?? ""),
    phone: String(contact.phone ?? ""),
    email: String(contact.email ?? ""),
    note: String(contact.note ?? ""),
    isPrimary: Boolean(contact.is_primary),
    active: Boolean(contact.active),
  }));
  const offers: CustomerProfileOffer[] = (offersResult.data ?? []).map((offer) => ({
    id: String(offer.id),
    offerNo: String(offer.offer_no ?? ""),
    subject: String(offer.subject ?? ""),
    status: String(offer.status ?? "draft"),
    currency: String(offer.currency ?? ""),
    latestTotal: offer.latest_total == null ? null : Number(offer.latest_total),
    issuedOn: offer.issued_on ? String(offer.issued_on) : null,
    issueDate: String(offer.issue_date ?? ""),
    createdAt: String(offer.created_at),
    updatedAt: String(offer.updated_at),
  }));

  const logo = customer.logoPath ? await loadCustomerLogo(supabase, customer.id) : null;
  const logoUrl = logo ? `data:image/png;base64,${logo.toString("base64")}` : null;
  return { data: { customer, contacts, offers, jobs, projects }, logoUrl };
}
