import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Native modal semantics keep background controls inert and restore focus. */
export function Modal({ children, label, onClose, canClose = true, className }: {
  children: ReactNode; label: string; onClose: () => void; canClose?: boolean; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = overflow; if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={label}
    onCancel={e => { e.preventDefault(); if (canClose) onClose(); }}
    onClick={e => {
      if (!canClose || e.target !== e.currentTarget) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose();
    }}
    className={cn("m-auto max-h-[90dvh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-5 text-ink shadow-xl backdrop:bg-black/40", className)}>
    {children}
  </dialog>;
}
