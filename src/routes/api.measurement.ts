import { createFileRoute } from "@tanstack/react-router";
import { FUNNEL_EVENTS } from "@/lib/lane/measurement";
import { getSql } from "@/lib/db";
// One free instance: bounded process-wide intake cap prevents unbounded write traffic.
let windowStart = 0,
  count = 0;
export const Route = createFileRoute("/api/measurement")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (process.env.LANE_ANALYTICS_ENABLED !== "true")
          return new Response(null, { status: 204 });
        if (request.headers.get("origin") !== process.env.BETTER_AUTH_URL?.replace(/\/$/, ""))
          return new Response(null, { status: 403 });
        if (!request.headers.get("content-type")?.startsWith("application/json"))
          return new Response(null, { status: 415 });
        if (Number(request.headers.get("content-length") || 0) > 100)
          return new Response(null, { status: 413 });
        if (Date.now() - windowStart > 60000) {
          windowStart = Date.now();
          count = 0;
        }
        if (++count > 120) return new Response(null, { status: 429 });
        let data;
        try {
          const reader = request.body?.getReader();
          if (!reader) return new Response(null, { status: 400 });
          const timer = setTimeout(() => void reader.cancel(), 5000);
          let size = 0,
            text = "";
          const decoder = new TextDecoder();
          try {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) break;
              size += chunk.value.byteLength;
              if (size > 100) {
                await reader.cancel();
                return new Response(null, { status: 413 });
              }
              text += decoder.decode(chunk.value, { stream: true });
            }
            text += decoder.decode();
          } finally {
            clearTimeout(timer);
            reader.releaseLock();
          }
          data = JSON.parse(text);
        } catch {
          return new Response(null, { status: 400 });
        }
        if (!data || Object.keys(data).length !== 1 || !FUNNEL_EVENTS.includes(data.event))
          return new Response(null, { status: 400 });
        try {
          const sql = await getSql();
          await sql`insert into website_daily_events(day,event,total) values(current_date,${data.event},1) on conflict(day,event) do update set total=website_daily_events.total+1`;
          return new Response(null, { status: 204 });
        } catch {
          return new Response(null, { status: 503 });
        }
      },
    },
  },
});
