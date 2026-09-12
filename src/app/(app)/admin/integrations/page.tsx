import { integrationSnapshot } from "@/lib/integrations/server";
import { IntegrationsView } from "@/components/integrations/integrations-view";
export default async function Page() {
  return <IntegrationsView initial={await integrationSnapshot()} />;
}
