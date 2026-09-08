import { cn } from "@/lib/utils";

export function LaneMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("text-mark", className)} aria-hidden>
      <rect x="4" y="2.5" width="2.4" height="15" fill="currentColor" />
      <rect x="13.6" y="2.5" width="2.4" height="15" fill="currentColor" />
    </svg>
  );
}

export function LaneWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LaneMark className="h-5 w-5" />
      <span className="text-[15px] font-semibold tracking-[-0.02em]">Lane</span>
    </span>
  );
}
