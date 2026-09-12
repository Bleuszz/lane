import { createFileRoute } from "@tanstack/react-router";
import { TermsPage } from "./legal.terms";
import { publicHead } from "@/lib/lane/public-site";
export const Route = createFileRoute("/terms")({
  head: () => publicHead("/terms"),
  component: TermsPage,
});
