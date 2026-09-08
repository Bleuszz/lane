import { CHANNELS } from "@/lib/lane/channels";
import type { AccountStatus, MarketplaceId } from "@/lib/lane/types";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

export function statusTone(status: string): "neutral" | "ok" | "warn" | "danger" | "mark" {
  if (status === "live" || status === "done" || status === "green") return "ok";
  if (status === "error" || status === "dead" || status === "needs_reauth") return "danger";
  if (
    status === "waiting_for_browser" ||
    status === "queued" ||
    status === "extension_offline" ||
    status === "rate_limited" ||
    status === "paused"
  ) {
    return "warn";
  }
  if (status === "sold") return "mark";
  return "neutral";
}

export function StatusBadge({ status }: { status: string }) {
  const label =
    status === "green" ||
    status === "extension_offline" ||
    status === "needs_reauth" ||
    status === "rate_limited" ||
    status === "paused"
      ? accountHealthLabel(status as AccountStatus)
      : status.replaceAll("_", " ");
  return <Badge tone={statusTone(status)}>{label}</Badge>;
}

export function ChannelDot({
  marketplace,
  remoteStatus,
}: {
  marketplace: MarketplaceId;
  remoteStatus: string;
}) {
  const short = CHANNELS[marketplace]?.short ?? marketplace;
  const tone =
    remoteStatus === "live"
      ? "bg-ok-bg text-ok"
      : remoteStatus === "error" || remoteStatus === "dead"
        ? "bg-danger-bg text-danger"
        : remoteStatus === "waiting_for_browser" || remoteStatus === "queued"
          ? "bg-warn-bg text-warn"
          : remoteStatus === "sold"
            ? "bg-secondary text-mark"
            : "bg-secondary text-muted";
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-1.5 font-mono text-[10px] uppercase tracking-[0.06em]",
        tone,
      )}
      title={`${short} · ${remoteStatus}`}
    >
      {short}
    </span>
  );
}

export function ModeChip({ mode }: { mode: "oauth" | "extension" }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
      {mode === "oauth" ? "API" : "EXTENSION"}
    </span>
  );
}

export function accountHealthLabel(status: AccountStatus): string {
  if (status === "green") return "Connected";
  if (status === "extension_offline") return "Browser asleep";
  if (status === "needs_reauth") return "Needs reauth";
  if (status === "rate_limited") return "Rate limited";
  if (status === "paused") return "Paused";
  return status;
}
