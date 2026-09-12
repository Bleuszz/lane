import { cva, type VariantProps } from "class-variance-authority";
import { cloneElement, isValidElement, useId } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out,cubic-bezier(0.23,1,0.32,1))] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mark focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  {
    variants: {
      variant: {
        primary: "bg-mark text-mark-fg hover:bg-mark-hover",
        secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-raised",
        ghost: "text-ink hover:bg-secondary",
        danger: "bg-danger text-white hover:bg-danger/90",
        link: "text-mark underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-[var(--radius-xs)]",
        md: "h-10 px-3.5 text-sm rounded-[var(--radius-sm)]",
        lg: "h-11 px-4 text-sm rounded-[var(--radius-sm)]",
        icon: "h-10 w-10 rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-[var(--radius-sm)] border border-line bg-raised px-3 text-sm text-ink placeholder:text-subtle",
        "focus:border-mark focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-[var(--radius-sm)] border border-line bg-raised px-3 py-2 text-sm text-ink placeholder:text-subtle",
        "focus:border-mark focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-xs font-medium text-muted mb-1.5", className)} {...props} />;
}

export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-[var(--radius-sm)] border border-line bg-raised px-3 text-sm text-ink",
        "focus:border-mark focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generated = useId();
  const input = isValidElement<{ id?: string }>(children) ? children : null;
  const id = input?.props.id ?? generated;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {input ? cloneElement(input, { id }) : children}
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "mark";
  className?: string;
}) {
  const tones = {
    neutral: "bg-secondary text-muted",
    ok: "bg-ok-bg text-ok",
    warn: "bg-warn-bg text-warn",
    danger: "bg-danger-bg text-danger",
    mark: "bg-mark text-mark-fg",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-[var(--radius-lg)] border border-line bg-surface shadow-[var(--shadow-panel)]", className)}>
      {children}
    </div>
  );
}
