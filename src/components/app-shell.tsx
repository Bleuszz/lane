import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getBootstrap } from "@/lib/lane/server/fns";
import { formatMoney } from "@/lib/lane/format";
import { CHANNELS } from "@/lib/lane/channels";
import { LEGAL_FOOTER } from "@/lib/lane/copy";
import { PLAN_DEFS } from "@/lib/lane/plans";
import { LaneWordmark } from "@/components/logo";
import { ExtensionBridge } from "@/components/extension-bridge";
import { ModeChip, StatusBadge, accountHealthLabel } from "@/components/status";
import { cn } from "@/lib/utils";
import {
  Activity,
  Inbox,
  Menu,
  Package,
  Plus,
  Settings,
  ShoppingBag,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";

const NAV = [
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/new", label: "New listing", icon: Plus },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/sold", label: "Sold", icon: ShoppingBag },
  { to: "/settings/channels", label: "Settings", icon: Settings },
] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap(), refetchInterval: 8000 });
  const [open, setOpen] = useState(false);
  const data = boot.data;
  const failCount = (data?.inbox.failedJobs.length ?? 0) + (data?.inbox.offlineAccounts.length ?? 0);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ExtensionBridge bootstrap={data} />
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
          <div className="flex h-14 items-center px-4">
            <Link to="/inbox" className="flex items-center">
              <LaneWordmark />
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2">
            {NAV.map((item) => {
              const isActive =
                item.to === "/inbox"
                  ? pathname === "/inbox"
                  : item.to === "/settings/channels"
                    ? pathname.startsWith("/settings")
                    : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-[var(--radius-sm)] px-2.5 text-sm",
                    isActive ? "bg-secondary text-ink" : "text-muted hover:bg-secondary/70 hover:text-ink",
                  )}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.75} />
                  <span className="flex-1">{item.label}</span>
                  {item.to === "/inbox" && failCount > 0 ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] text-white tabular">
                      {failCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-line p-3 space-y-3">
            {data ? (
              <>
                <div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>{PLAN_DEFS[data.settings.plan].name}</span>
                    <span className="tabular">
                      {data.settings.actionsUsedMonth}/{data.settings.actionsLimit}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-mark"
                      style={{
                        width: `${Math.min(100, (data.settings.actionsUsedMonth / Math.max(1, data.settings.actionsLimit)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-subtle">Publish + relist. Updates and delists are free.</p>
                </div>
                <div className="space-y-1.5">
                  {data.accounts.length === 0 ? (
                    <p className="text-[11px] text-subtle">No channels connected.</p>
                  ) : (
                    data.accounts.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-[11px]">
                        <span className="flex-1 truncate">{CHANNELS[a.marketplace]?.short}</span>
                        <ModeChip mode={a.mode} />
                        <StatusBadge status={a.status} />
                      </div>
                    ))
                  )}
                </div>
                {data.accounts.some((a) => a.mode === "extension") ? (
                  <p className="text-[11px] leading-relaxed text-subtle">
                    Vinted stays green only while Lane Bridge heartbeats from a vinted.co.uk tab.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="h-16 animate-pulse rounded-[var(--radius-sm)] bg-secondary" />
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-3 md:px-5">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="md:hidden">
              <LaneWordmark />
            </div>
            <p className="hidden text-xs text-muted md:block">
              One inventory record. Channel listings hang off it.
            </p>
            <div className="ml-auto flex items-center gap-3">
              {data ? (
                <span className="hidden text-xs text-muted sm:block tabular">
                  Live {data.liveCount} · Sold {data.soldCount} · {formatMoney(data.gmvGbp)} GMV
                </span>
              ) : null}
              {isPending ? (
                <div className="h-8 w-8 animate-pulse rounded-full bg-ink/10" />
              ) : user ? (
                <UserButton />
              ) : null}
            </div>
          </header>
          <main className="flex-1 px-3 py-4 md:px-6 md:py-5">
            <Outlet />
          </main>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 left-0 w-72 bg-surface p-3 shadow-[var(--shadow-panel)]">
            <div className="mb-3 flex items-center justify-between">
              <LaneWordmark />
              <button type="button" className="grid h-10 w-10 place-items-center" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-sm hover:bg-secondary"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
            {data?.accounts.map((a) => (
              <p key={a.id} className="mt-3 text-xs text-muted">
                {CHANNELS[a.marketplace]?.short} · {accountHealthLabel(a.status)}
              </p>
            ))}
            <p className="mt-6 text-[10px] leading-relaxed text-subtle">{LEGAL_FOOTER}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
