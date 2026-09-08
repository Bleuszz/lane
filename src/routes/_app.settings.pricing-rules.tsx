import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSettingsExtras, upsertPricingRule } from "@/lib/lane/server/fns";
import { CHANNELS } from "@/lib/lane/channels";
import { Button, Input, NativeSelect, Panel } from "@/components/ui";
import type { PricingRuleView } from "@/lib/lane/types";

export const Route = createFileRoute("/_app/settings/pricing-rules")({ component: PricingPage });

const KINDS: PricingRuleView["kind"][] = ["flat", "plus_amount", "plus_percent", "round_99", "undercut"];

function PricingPage() {
  const qc = useQueryClient();
  const extras = useQuery({ queryKey: ["settings-extras"], queryFn: () => getSettingsExtras() });
  const rules = extras.data?.rules ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Applied at publish. Flat, +£X, +Y%, round to .99, or undercut another channel by £1.
      </p>
      {rules.map((r) => (
        <Panel key={r.id} className="grid gap-3 p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted">Channel</p>
            <p className="text-sm">{CHANNELS[r.marketplace]?.label}</p>
          </div>
          <NativeSelect
            value={r.kind}
            onChange={(e) =>
              upsertPricingRule({ data: { ...r, kind: e.target.value as PricingRuleView["kind"] } }).then(() =>
                qc.invalidateQueries(),
              )
            }
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>{k.replaceAll("_", " ")}</option>
            ))}
          </NativeSelect>
          <Input
            inputMode="decimal"
            defaultValue={r.amount ?? ""}
            placeholder="Amount"
            onBlur={(e) => {
              const n = e.target.value === "" ? null : Number(e.target.value);
              void upsertPricingRule({ data: { ...r, amount: n } }).then(() => qc.invalidateQueries());
            }}
          />
          <p className="text-xs text-muted self-center">
            {r.kind === "undercut" ? "£ off the base (or the named channel)." : r.kind === "round_99" ? "Ignores amount." : null}
          </p>
        </Panel>
      ))}
      <Button
        variant="secondary"
        onClick={() =>
          upsertPricingRule({ data: { marketplace: "ebay_uk", kind: "plus_amount", amount: 2 } }).then(() =>
            qc.invalidateQueries(),
          )
        }
      >
        Add eBay +£ rule
      </Button>
    </div>
  );
}
