import { createFileRoute } from "@tanstack/react-router";
import { handleBridge } from "@/lib/lane/server/bridge";

export const Route = createFileRoute("/api/bridge/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleBridge(request),
      POST: ({ request }) => handleBridge(request),
      OPTIONS: ({ request }) => handleBridge(request),
    },
  },
});
