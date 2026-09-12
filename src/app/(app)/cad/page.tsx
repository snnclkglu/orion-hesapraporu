import { PageHeader } from "@/components/page-header";
import { snapshot, CadError } from "@/lib/cad/server";
import { CadWorkspace } from "./workspace";

export default async function CadPage() {
  let initial: Awaited<ReturnType<typeof snapshot>> | null = null;
  let message = "";
  try {
    initial = await snapshot();
  } catch (error) {
    message = error instanceof CadError ? error.message : "Çizim İşleme şu anda açılamıyor.";
  }
  return <><PageHeader title="Çizim İşleme" hint="Kendi bilgisayarınızdaki AutoCAD ile paftaları ve malzeme listelerini hazırlayın" />{initial ? <CadWorkspace initial={initial} /> : <div className="rounded-xl border p-6"><h2 className="font-semibold">Bağlantı kontrol edilmeli</h2><p className="mt-2 text-muted-foreground">{message}</p><a className="oc-tap mt-4 inline-flex underline" href="/cad">Yeniden dene</a></div>}</>;
}
