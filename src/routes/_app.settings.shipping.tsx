import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getSettingsExtras } from "@/lib/lane/server/fns";
import { CARRIERS } from "@/lib/lane/postage";
import { formatMoney } from "@/lib/lane/format";
import { Panel } from "@/components/ui";

export const Route = createFileRoute("/_app/settings/shipping")({ component: ShippingPage });

function ShippingPage() {
  const extras = useQuery({ queryKey: ["settings-extras"], queryFn: () => getSettingsExtras() });
  const profiles = extras.data?.shipping ?? [];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Royal Mail, Evri, InPost, Yodel, Vinted shipping, eBay Click & Drop. Collection vs postage, buyer-pays vs included.
      </p>
      {profiles.map((p) => (
        <Panel key={p.id} className="p-4">
          <p className="text-sm font-medium">{p.name}</p>
          <p className="mt-1 text-xs text-muted">
            {CARRIERS.find((c) => c.id === p.carrier)?.label ?? p.carrier} · {p.service} · {p.packageType.replaceAll("_", " ")}
            {" · "}
            {p.buyerPays ? "buyer pays" : "included"} {formatMoney(p.priceGbp)}
            {p.collection ? " · collection" : ""}
          </p>
        </Panel>
      ))}
    </div>
  );
}
