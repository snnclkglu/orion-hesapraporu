import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { JobForm, EMPTY_JOB } from "../job-form";
import { loadJobFormData } from "../form-data";

export default async function NewJobPage() {
  const { customers, people } = await loadJobFormData();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-4">
        {/* Geri bağlantısı yalnız yazı yüksekliğindeydi (~20px); tıklama alanı
            asgari 36px'e (dokunmatikte 40px) yayılır, negatif kenar boşluğu
            eklenen iç boşluğu hizada tutar. */}
        <Link href="/jobs" className="-ml-1 inline-flex min-h-9 items-center gap-1 px-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-10">
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
