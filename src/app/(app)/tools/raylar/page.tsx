import { TECHNICAL_SOURCES } from "@/lib/engineering-tools/standards";
import { SourceNote } from "../source-note";
import { RailsTool } from "./rails-tool";

export default function RailsPage() { return <main className="grid gap-5"><header><p className="oc-kicker text-muted-foreground">Ray · krapo · ped</p><h2 className="text-xl font-semibold">Ray sistemleri</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Ray ölçüsünü seçin; kesiti, metre ağırlığını ve doğrulanmış uyumlu bağlantı elemanlarını birlikte görün.</p></header><RailsTool/><div className="grid gap-2 sm:grid-cols-2"><SourceNote source={TECHNICAL_SOURCES.crapex}/><SourceNote source={TECHNICAL_SOURCES.beket}/></div></main>; }
