import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createItemFn, getBootstrap, getSettingsExtras, publishItems, saveTemplateFn } from "@/lib/lane/server/fns";
import { ChannelPicker, EMPTY_DRAFT, ItemForm } from "@/components/item-form";
import { Button, Input } from "@/components/ui";
import { useState } from "react";
import type { ItemDraft } from "@/lib/lane/types";

export const Route = createFileRoute("/_app/new")({ component: NewPage });

function NewPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap() });
  const extras = useQuery({ queryKey: ["settings-extras"], queryFn: () => getSettingsExtras() });
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [tplName, setTplName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async (andPublish: boolean) => {
      const { id } = await createItemFn({ data: draft });
      if (andPublish && accountIds.length) {
        await publishItems({ data: { itemIds: [id], accountIds } });
      }
      return id;
    },
    onSuccess: (id) => {
      void qc.invalidateQueries();
      void nav({ to: "/inventory/$id", params: { id } });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const accounts = boot.data?.accounts ?? [];
  const ebayOn = accounts.some((a) => accountIds.includes(a.id) && a.marketplace === "ebay_uk");
  const vintedOn = accounts.some((a) => accountIds.includes(a.id) && a.marketplace === "vinted_uk");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-medium tracking-[-0.02em]">New listing</h1>
        <p className="mt-1 text-sm text-muted">One form. Fields for unselected channels stay out of the way.</p>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted">Publish to</p>
        <ChannelPicker
          accounts={accounts}
          selected={accountIds}
          onToggle={(id) => setAccountIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
        />
      </div>
      <ItemForm
        draft={draft}
        onChange={setDraft}
        ebaySelected={ebayOn}
        vintedSelected={vintedOn}
        rules={extras.data?.rules ?? []}
        aiEnabled={Boolean(boot.data?.settings.aiPack)}
      />
      {err ? <p className="text-sm text-danger">{err}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={create.isPending} onClick={() => create.mutate(true)}>
          {create.isPending ? "Saving…" : accountIds.length ? "Save and queue publish" : "Save draft"}
        </Button>
        <Button variant="secondary" disabled={create.isPending} onClick={() => create.mutate(false)}>
          Save draft only
        </Button>
        <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Template name" className="w-40" />
        <Button
          variant="ghost"
          onClick={() => saveTemplateFn({ data: { name: tplName || "Untitled", payload: draft } }).then(() => qc.invalidateQueries())}
        >
          Save template
        </Button>
      </div>
    </div>
  );
}
