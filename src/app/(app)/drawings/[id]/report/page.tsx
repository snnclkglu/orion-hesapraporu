// İÇE AKTARIM RAPORU — modülün en değerli ekranı.
//
// Bölümler SABİT SIRALIDIR (Eksikler · Çelişkiler · Bilgi): dönen kullanıcı
// nereye bakacağını bilmelidir. Boş bölüm de basılır ve "temiz" der — bir
// bölümün yokluğu ile boş olması aynı şey değildir.
//
// DİL SUÇLAMAZ. "Standart dışı" değil "tanıyamadım"; "hatalı" değil "iki
// kaynak farklı söylüyor". Rapor ressamın karnesi değil, sistemin kavrayışının
// dökümüdür — bir kez suçlayıcı okunan rapora kimse bakmaz.

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditDrawings } from "@/lib/roles";
import { FINDING_SECTIONS, formatNum, recognitionClass } from "@/lib/drawings/labels";
import { loadAcks, loadFindings, loadPackage } from "../../data";
import { FindingRow } from "./finding-row";

export default async function PackageReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const paket = await loadPackage(supabase, id);
  if (!paket) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const yazabilir = canEditDrawings(profile?.role);

  const [bulgular, onaylar] = await Promise.all([loadFindings(supabase, id), loadAcks(supabase, id)]);

  return (
    <div className="grid gap-4">
      <section className="border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="oc-kicker text-muted-foreground">Sistemin kavrayışı</p>
            <p className={`font-mono text-3xl font-semibold ${recognitionClass(paket.recognition_pct)}`}>
              {paket.recognition_pct == null ? "—" : `%${paket.recognition_pct}`}
            </p>
            <p className="mt-1 max-w-md text-[12px] text-muted-foreground">
              Bu paketin {paket.recognition_pct ?? 0}&apos;ini tanıyabildim.
              {paket.unrecognized_count > 0
                ? ` ${formatNum(paket.unrecognized_count)} dosyayı tanıyamadım — arşivde duruyorlar, aşağıdan elle bağlayabilirsiniz.`
                : " Tanıyamadığım dosya yok."}
            </p>
          </div>

          <dl className="flex flex-wrap gap-4">
            {FINDING_SECTIONS.map((b) => (
              <div key={b.kind}>
                <dt className="oc-kicker text-muted-foreground">{b.title}</dt>
                <dd className="font-mono text-xl font-semibold tabular-nums">
                  {formatNum(paket.finding_counts?.[b.kind] ?? 0)}
                </dd>
              </div>
            ))}
            <div>
              <dt className="oc-kicker text-muted-foreground">Onaylanan</dt>
              <dd className="font-mono text-xl font-semibold tabular-nums">
                {formatNum(onaylar.size)}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {FINDING_SECTIONS.map((bolum) => {
        const liste = bulgular.filter((b) => b.kind === bolum.kind);
        return (
          <section key={bolum.kind} className="border bg-card">
            <header className="border-b bg-muted/40 px-4 py-2.5">
              <h2 className="flex items-baseline gap-2 text-sm font-medium">
                {bolum.title}
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatNum(liste.length)}
                </span>
              </h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{bolum.hint}</p>
            </header>

            {liste.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Bu bölümde bir şey yok.
              </p>
            ) : (
              <ul className="divide-y">
                {liste.map((b) => (
                  <FindingRow
                    key={b.id}
                    packageId={id}
                    code={b.code}
                    kind={b.kind}
                    subject={b.subject}
                    title={b.title}
                    detail={b.detail}
                    hintId={b.hint_id}
                    acked={onaylar.has(`${b.code}|${b.subject}`)}
                    canWrite={yazabilir}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
