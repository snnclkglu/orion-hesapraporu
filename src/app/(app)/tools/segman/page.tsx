import { TECHNICAL_SOURCES } from "@/lib/engineering-tools/standards";
import { SourceNote } from "../source-note";
import { CirclipTool } from "./circlip-tool";
export default function CirclipPage(){return <main className="grid gap-5"><header><p className="oc-kicker text-muted-foreground">Mil ve delik emniyeti</p><h2 className="text-xl font-semibold">Segman ölçüleri</h2><p className="mt-1 text-sm text-muted-foreground">Dış DIN 471 ve iç DIN 472 segmanlarının halka ve kanal ölçülerini birlikte gösterir.</p></header><CirclipTool/><SourceNote source={TECHNICAL_SOURCES.circlips}/></main>}
