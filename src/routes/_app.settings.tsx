import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { LEGAL_FOOTER } from "@/lib/lane/copy";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/settings")({ component: SettingsLayout });

const TABS = [
  { to: "/settings/channels", label: "Channels" },
  { to: "/settings/templates", label: "Templates" },
  { to: "/settings/pricing-rules", label: "Pricing rules" },
  { to: "/settings/shipping", label: "Shipping" },
  { to: "/settings/billing", label: "Billing" },
] as const;

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-medium tracking-[-0.02em]">Settings</h1>
      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "h-10 shrink-0 px-3 text-sm",
              pathname === t.to ? "border-b-2 border-mark text-ink" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="py-5">
        <Outlet />
      </div>
      <p className="pb-8 text-[11px] leading-relaxed text-subtle">{LEGAL_FOOTER}</p>
    </div>
  );
}
