import { createFileRoute } from "@tanstack/react-router";
import { BUILD } from "@/lib/build";
import { getSql } from "@/lib/db";
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const sql = await getSql();
          await sql`select 1`;
          return Response.json(
            {
              status: "ok",
              app: "ok",
              database: "ok",
              environment: process.env.LANE_ENV === "production" ? "production" : "staging",
              build: BUILD,
            },
            { headers: { "cache-control": "no-store" } },
          );
        } catch {
          return Response.json(
            { status: "unavailable", app: "ok", database: "unavailable", build: BUILD },
            { status: 503, headers: { "cache-control": "no-store" } },
          );
        }
      },
    },
  },
});
