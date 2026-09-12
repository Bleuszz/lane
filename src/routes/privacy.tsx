import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "./legal.privacy";
import { publicHead } from "@/lib/lane/public-site";
export const Route = createFileRoute("/privacy")({
  head: () => publicHead("/privacy"),
  component: PrivacyPage,
});
