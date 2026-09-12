import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { FUNNEL_EVENTS, measure, type FunnelEvent } from "@/lib/lane/measurement";
export function Measurement() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [choice, setChoice] = useState<string | null>("disabled");
  useEffect(() => {
    if (import.meta.env.VITE_LANE_ANALYTICS_ENABLED === "true") {
      try {
        setChoice(localStorage.getItem("lane-measurement"));
      } catch {
        setChoice("no");
      }
    }
  }, []);
  useEffect(() => {
    if (choice !== "yes") return;
    measure("page_view");
    if (path === "/pricing") measure("pricing_viewed");
  }, [path, choice]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const value = (e.target as Element)
        ?.closest?.("[data-lane-event]")
        ?.getAttribute("data-lane-event");
      if (value && FUNNEL_EVENTS.includes(value as FunnelEvent)) measure(value as FunnelEvent);
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  function choose(value: string) {
    try {
      localStorage.setItem("lane-measurement", value);
    } catch {}
    setChoice(value);
  }
  if (import.meta.env.VITE_LANE_ANALYTICS_ENABLED !== "true") return null;
  if (choice === null)
    return (
      <section
        aria-label="Optional measurement"
        className="fixed bottom-3 left-3 right-3 z-50 mx-auto max-w-xl rounded-xl border border-line bg-surface p-5 shadow-xl"
      >
        <h2 className="font-medium">Help us understand what works?</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          With your permission, Lane counts actions such as signup and device approval. No account
          IDs, URLs or listing details.{" "}
          <a href="/legal/cookies" className="underline">
            Measurement details
          </a>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="public-button secondary" onClick={() => choose("no")}>
            No thanks
          </button>
          <button className="public-button" onClick={() => choose("yes")}>
            Allow counts
          </button>
        </div>
      </section>
    );
  return (
    <button
      onClick={() => setChoice(null)}
      className="fixed bottom-2 right-2 rounded border border-line bg-surface px-3 py-2 text-xs z-40"
    >
      Measurement choices
    </button>
  );
}
