import { TECHNICAL_SOURCES } from "@/lib/engineering-tools/standards";
import { SourceNote } from "../source-note";
import { BoltTool } from "./bolt-tool";
export default function BoltPage(){return <main className="grid gap-5"><header><p className="oc-kicker text-muted-foreground">Bağlantı ön boyutlandırması</p><h2 className="text-xl font-semibold">Cıvata merkezi</h2><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Metrik kaba diş ölçüleri, geçiş delikleri, montaj torku, standart boy ve yapısal yerleşim ölçüleri.</p></header><BoltTool/><div className="grid gap-2 sm:grid-cols-3"><SourceNote source={TECHNICAL_SOURCES.iso273}/><SourceNote source={TECHNICAL_SOURCES.torque}/><SourceNote source={TECHNICAL_SOURCES.eurocodeBolts}/></div></main>}
