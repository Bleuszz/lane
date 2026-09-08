import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createItemFn, deleteTemplateFn, getSettingsExtras } from "@/lib/lane/server/fns";
import { formatDate } from "@/lib/lane/format";
import { Button, Panel } from "@/components/ui";
import type { ItemDraft } from "@/lib/lane/types";

export const Route = createFileRoute("/_app/settings/templates")({ component: TemplatesPage });

function TemplatesPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const extras = useQuery({ queryKey: ["settings-extras"], queryFn: () => getSettingsExtras() });
  const templates = extras.data?.templates ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Save a filled form as a template (e.g. men's Nike tee) from New listing.</p>
      {templates.length === 0 ? <p className="text-sm text-muted">No templates yet.</p> : null}
      {templates.map((t) => (
        <Panel key={t.id} className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">{t.name}</p>
            <p className="text-xs text-muted">{formatDate(t.createdAt)}</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                const payload = JSON.parse(t.payload) as ItemDraft;
                const { id } = await createItemFn({ data: payload });
                void nav({ to: "/inventory/$id", params: { id } });
              }}
            >
              Use
            </Button>
            <Button size="sm" variant="ghost" onClick={() => deleteTemplateFn({ data: { id: t.id } }).then(() => qc.invalidateQueries())}>
              Delete
            </Button>
          </div>
        </Panel>
      ))}
    </div>
  );
}
