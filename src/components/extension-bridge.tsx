import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { heartbeat } from "@/lib/lane/server/fns";
import type { BootstrapPayload } from "@/lib/lane/types";

/** Ticks eBay OAuth jobs only. Vinted jobs complete in the Chrome extension. */
export function ExtensionBridge({ bootstrap }: { bootstrap: BootstrapPayload | undefined }) {
  const qc = useQueryClient();
  const running = useRef(false);
  const hasOauth = bootstrap?.accounts.some((a) => a.mode === "oauth") ?? false;

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (running.current) return;
      running.current = true;
      try {
        await heartbeat();
        if (!cancelled) await qc.invalidateQueries();
      } catch {
        /* unsigned or transient */
      } finally {
        running.current = false;
      }
    }
    void tick();
    const ms = hasOauth ? 4000 : 12000;
    const id = window.setInterval(() => void tick(), ms);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hasOauth, qc]);

  return null;
}
