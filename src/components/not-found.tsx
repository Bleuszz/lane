import { Link } from "@tanstack/react-router";
import { LaneWordmark } from "@/components/logo";
import { Button } from "@/components/ui";

export function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-5 text-center text-ink">
      <LaneWordmark />
      <h1 className="text-xl font-medium">Page not found</h1>
      <p className="max-w-sm text-sm text-muted">That URL is not a Lane page.</p>
      <Link to="/">
        <Button>Home</Button>
      </Link>
    </main>
  );
}
