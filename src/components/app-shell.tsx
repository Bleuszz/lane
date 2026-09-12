import { Modal } from "./modal";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getBootstrap } from "@/lib/lane/server/fns";
import { formatMoney } from "@/lib/lane/format";
import { CHANNELS } from "@/lib/lane/channels";
import { PLAN_DEFS } from "@/lib/lane/plans";
import { desktopApi } from "@/lib/lane/desktop";
import { LaneWordmark } from "@/components/logo";
import { ExtensionBridge } from "@/components/extension-bridge";
import { ThemeToggle } from "@/components/theme-toggle";
import { ModeChip, StatusBadge, accountHealthLabel } from "@/components/status";
import { cn } from "@/lib/utils";
import {
  Activity,
  CreditCard,
  LayoutDashboard,
  Menu,
  Package,
  Plus,
  Settings,
  ShoppingBag,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const NAV = [
  { to: "/inbox", label: "Today", icon: LayoutDashboard },
  { to: "/inventory", label: "Products", icon: Package },
  { to: "/new", label: "New listing", icon: Plus },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/sold", label: "Sold", icon: ShoppingBag },
] as const;

const MANAGE = [
  { to: "/automation", label: "Scheduling & safety", icon: Settings },
  { to: "/image-tools", label: "Image preparation", icon: Settings },
  { to: "/ai", label: "AI Studio & usage", icon: Activity },
  { to: "/devices", label: "Your devices", icon: Settings },
  { to: "/settings/channels", label: "Accounts", icon: Settings },
  { to: "/settings/billing", label: "Billing", icon: CreditCard },
] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const boot = useQuery({ queryKey: ["bootstrap"], queryFn: () => getBootstrap(), refetchInterval: 8000 });
  const [open, setOpen] = useState(false);
  const data = boot.data;
  const failCount = (data?.inbox.failedJobs.length ?? 0) + (data?.inbox.offlineAccounts.length ?? 0);
  const connected = data?.accounts.find((a) => a.status === "green");
  const token = data?.settings.pairingToken ?? "";

  useEffect(() => {
    const desk = desktopApi();
    if (desk?.setPairing && token) {
      void desk.setPairing(token, window.location.origin);
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ExtensionBridge bootstrap={data} />
      <div className="flex min-h-screen">
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-line bg-surface md:flex">
          <div className="flex h-14 items-center px-4">
            <Link to="/inbox" className="flex items-center">
              <LaneWordmark />
            </Link>
          </div>
          <div className="mx-3 mb-3 rounded-[var(--radius-md)] border border-line bg-raised px-3 py-2.5">
            <p className="truncate text-sm font-medium">{user?.displayName ?? user?.primaryEmail ?? "Seller"}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
              <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-ok" : "bg-subtle")} />
              {connected ? `${CHANNELS[connected.marketplace]?.short} connected` : "No channel connected"}
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2 py-1">
            {NAV.map((item) => {
              const isActive = item.to === "/inbox" ? pathname === "/inbox" : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-[var(--radius-sm)] px-2.5 text-sm transition-colors duration-[var(--motion-quick)]",
                    isActive ? "bg-mark text-mark-fg" : "text-muted hover:bg-raised/70 hover:text-ink",
                  )}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.75} />
                  <span className="flex-1">{item.label}</span>
                  {item.to === "/inbox" && failCount > 0 ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] text-mark-fg tabular">
                      {failCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <p className="mt-4 px-2.5 text-[10px] uppercase tracking-[0.14em] text-subtle">Manage</p>
            {MANAGE.map((item) => {
              const isActive = pathname.startsWith(item.to) || (item.to === "/settings/channels" && pathname.startsWith("/settings") && !pathname.startsWith("/settings/billing"));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-[var(--radius-sm)] px-2.5 text-sm transition-colors duration-[var(--motion-quick)]",
                    isActive ? "bg-mark text-mark-fg" : "text-muted hover:bg-raised/70 hover:text-ink",
                  )}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-line p-3 space-y-3">
            {data ? (
              <>
                <div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>Plan: {PLAN_DEFS[data.settings.plan].name}</span>
                    <span className="tabular">
                      {data.settings.actionsUsedMonth}/{data.settings.actionsLimit}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full bg-mark"
                      style={{
                        width: `${Math.min(100, (data.settings.actionsUsedMonth / Math.max(1, data.settings.actionsLimit)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  {data.accounts.length === 0 ? (
                    <p className="text-[11px] text-subtle">Connect a marketplace to publish.</p>
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
              </>
            ) : (
              <div className="h-16 animate-pulse rounded-[var(--radius-sm)] bg-raised" />
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-3 md:px-5">
            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-sm)] md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="shrink-0 md:hidden">
              <LaneWordmark />
            </div>
            {data ? (
              <span className="hidden items-center gap-2 sm:flex">
                <span className="inline-flex h-7 items-center rounded-full border border-line bg-raised px-2.5 text-[11px] font-medium">
                  Plan: {PLAN_DEFS[data.settings.plan].name}
                </span>
                <span className="hidden text-xs text-muted lg:block tabular">
                  Live {data.liveCount} · Sold {data.soldCount} · {formatMoney(data.gmvGbp)} GMV
                </span>
              </span>
            ) : null}
            <div className="ml-auto flex items-center gap-1">
              <Link to="/help" className="mr-1 inline-flex min-h-11 items-center whitespace-nowrap px-1 text-xs text-muted hover:text-ink sm:mr-3"><span className="sm:hidden">Help</span><span className="hidden sm:inline">Help & guides</span></Link>
              <ThemeToggle />
              {isPending ? (
                <div className="h-8 w-8 animate-pulse rounded-full bg-ink/10" />
              ) : user ? (
                <UserButton />
              ) : null}
            </div>
          </header>
          <main className="flex-1 px-3 py-4 md:px-6 md:py-6">
            <Outlet />
          </main>
        </div>
      </div>

      {open ? (
        <Modal label="Navigation" onClose={() => setOpen(false)} className="m-0 mr-auto h-dvh max-h-dvh w-[min(18rem,90vw)] rounded-none border-y-0 border-l-0 p-3">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <LaneWordmark />
              <button type="button" className="grid h-11 w-11 place-items-center" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {[...NAV, ...MANAGE].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-sm hover:bg-raised"
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
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
