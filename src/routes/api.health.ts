import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const sql = await getSql();
          await sql`select 1`;
          return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
        } catch {
          return Response.json(
            { status: "unavailable" },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
