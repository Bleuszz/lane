import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { HELP } from "@/lib/lane/help";
import { LaneWordmark } from "@/components/logo";
import { Input } from "@/components/ui";
export const Route = createFileRoute("/help")({ component: Help });
function Help() {
  const [search, setSearch] = useState("");
  const entries = HELP.filter((e) => `${e.category} ${e.question} ${e.answer}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="min-h-screen bg-paper"><header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6"><Link to="/"><LaneWordmark/></Link><Link to="/inbox" className="text-sm text-mark">Open your workspace →</Link></header><div className="mx-auto max-w-3xl px-6 py-12"><p className="eyebrow">A little guidance</p><h1 className="page-title">Less figuring things out.</h1><p className="mt-3 text-muted">Straight answers for your first listing and the ones after it.</p><Input aria-label="Search help" type="search" className="my-8 h-12" placeholder="Search connections, photos, AI credits…" value={search} onChange={(e) => setSearch(e.target.value)}/><div>{entries.map((e) => <details className="group border-b border-line py-5" key={e.question}><summary className="cursor-pointer text-base font-medium"><span className="mb-1 block text-[10px] uppercase tracking-widest text-muted">{e.category}</span>{e.question}</summary><p className="mt-4 max-w-2xl text-sm leading-7 text-muted">{e.answer}</p></details>)}{!entries.length && <p className="text-muted">No matching answer. Try “photos”, “connect” or “credits”.</p>}</div><p className="mt-10 text-sm text-muted">This is a beta. The answers describe what is implemented and what still needs live verification.</p></div></main>;
}
