import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HELP } from "@/lib/lane/help";
import { FAQ, publicHead } from "@/lib/lane/public-site";
import { PublicLayout, PageIntro } from "@/components/public-layout";
import { Input } from "@/components/ui";
export const Route = createFileRoute("/help")({ head: () => publicHead("/help"), component: Help });
function Help() {
  const [search, setSearch] = useState("");
  const entries = [
    ...HELP,
    ...FAQ.map(([question, answer]) => ({ category: "About Lane", question, answer })),
  ].filter((e) => (e.question + " " + e.answer).toLowerCase().includes(search.toLowerCase()));
  return (
    <PublicLayout>
      <PageIntro eyebrow="A LITTLE GUIDANCE" title="Less figuring things out.">
        <p>Straight answers about accounts, marketplace connections and the current beta.</p>
      </PageIntro>
      <section className="public-section !pt-0 max-w-3xl">
        <Input
          aria-label="Search help"
          type="search"
          className="mb-8 h-12"
          placeholder="Search trials, connect, privacy…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="mb-4 text-sm text-muted" role="status">
          {entries.length} answers
        </p>
        {entries.map((e, i) => (
          <details key={i} className="border-b border-line py-5">
            <summary className="cursor-pointer font-medium">{e.question}</summary>
            <p className="mt-4 leading-7 text-muted">{e.answer}</p>
          </details>
        ))}
        {!entries.length && <p>No matching answer. Try “trial” or “connect”.</p>}
        <a href="/contact" className="mt-8 inline-block underline">
          Still need help? Contact Lane →
        </a>
      </section>
    </PublicLayout>
  );
}
