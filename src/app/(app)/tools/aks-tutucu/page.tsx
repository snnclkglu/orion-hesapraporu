import { TECHNICAL_SOURCES } from "@/lib/engineering-tools/standards";
import { SourceNote } from "../source-note";
import { AxleHolderTool } from "./axle-holder-tool";
export default function AxleHolderPage(){return <main className="grid gap-5"><header><p className="oc-kicker text-muted-foreground">Kaldırma makineleri</p><h2 className="text-xl font-semibold">DIN 15058 aks tutucu</h2><p className="mt-1 text-sm text-muted-foreground">Aks çapından tutucu plaka, delik ve bağlantı ölçülerini seçer.</p></header><AxleHolderTool/><SourceNote source={TECHNICAL_SOURCES.din15058}/></main>}
