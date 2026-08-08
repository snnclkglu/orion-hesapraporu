import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { JobForm, EMPTY_JOB } from "../job-form";
import { loadJobFormData } from "../form-data";

export default async function NewJobPage() {
  const { customers, people } = await loadJobFormData();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4">
        <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> İşler
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Yeni İş Emri</h1>
        <p className="text-sm text-muted-foreground">
          FR.11.02 iş emri formu — müşteri, iş kalemleri, kapsam ve teslim bilgileri.
        </p>
      </div>
      <JobForm mode="create" initial={EMPTY_JOB} customers={customers} people={people} />
    </div>
  );
}
