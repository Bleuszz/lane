import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
export function useReleaseFeatures() {
  const { data } = useQuery({
    queryKey: ["release-features"],
    queryFn: async () => {
      const response = await fetch("/api/auth/configuration");
      if (!response.ok) throw Error("Configuration unavailable");
      return (await response.json()).features as {
        ai: boolean;
        scheduler: boolean;
        images: boolean;
      };
    },
    staleTime: 60000,
  });
  return data ?? { ai: false, scheduler: false, images: false };
}
export function ReleaseGate({
  feature,
  children,
}: {
  feature: "ai" | "scheduler" | "images";
  children: ReactNode;
}) {
  const flags = useReleaseFeatures();
  if (!flags[feature])
    return (
      <section className="mx-auto max-w-xl space-y-4 py-8">
        <h1 className="page-title">This feature is not available yet.</h1>
        <p>It is disabled in this Lane environment. Your inventory and account remain available.</p>
        <a className="underline" href="/account">
          Back to your account
        </a>
      </section>
    );
  return children;
}
