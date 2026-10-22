"use client";
import { X, PackageOpen } from "lucide-react";
import React from "react";
import { twMerge } from "tailwind-merge";
export const Button = ({
  className = "",
  variant = "primary",
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) => (
  <button
    className={twMerge(
      "focusable inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:opacity-40",
      variant === "primary" && "bg-accent text-white hover:brightness-95",
      variant === "secondary" &&
        "border border-line bg-surface hover:bg-black/5 dark:hover:bg-white/5",
      variant === "danger" && "bg-red-600 text-white",
      variant === "ghost" && "hover:bg-black/5 dark:hover:bg-white/5",
      className,
    )}
    {...p}
  />
);
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...p }, ref) {
  return (
    <input
      ref={ref}
      className={twMerge(
        "focusable h-11 w-full rounded-lg border border-line bg-transparent px-3 text-sm placeholder:text-muted",
        className,
      )}
      {...p}
    />
  );
});
export const Select = ({
  className = "",
  ...p
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={twMerge(
      "focusable h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm",
      className,
    )}
    {...p}
  />
);
export const Textarea = ({
  className = "",
  ...p
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={twMerge(
      "focusable min-h-20 w-full rounded-lg border border-line bg-transparent p-3 text-sm",
      className,
    )}
    {...p}
  />
);
export const Card = ({
  className = "",
  ...p
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={twMerge(
      "rounded-xl border border-line bg-surface shadow-[0_1px_1px_rgba(0,0,0,.02)]",
      className,
    )}
    {...p}
  />
);
export const Badge = ({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "red" | "amber";
}) => (
  <span
    className={twMerge(
      "inline-flex rounded-full px-2 py-1 text-[11px] font-bold",
      tone === "neutral" && "bg-black/5 dark:bg-white/10",
      tone === "green" && "bg-emerald-100 text-emerald-800",
      tone === "red" && "bg-red-100 text-red-700",
      tone === "amber" && "bg-amber-100 text-amber-800",
    )}
  >
    {children}
  </span>
);
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const titleId = React.useId();
  const panel = React.useRef<HTMLDivElement>(null);
  const close = React.useRef(onClose);
  React.useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const target = panel.current?.querySelector<HTMLElement>(
        "input:not([disabled]), textarea:not([disabled]), select:not([disabled])",
      );
      (target || panel.current)?.focus({ preventScroll: true });
    });
    const keydown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll("[data-app-modal]");
      if (dialogs[dialogs.length - 1] !== panel.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const elements = Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ) || [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = elements[0],
        last = elements.at(-1);
      if (!first) {
        event.preventDefault();
        panel.current?.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      if (previouslyFocused?.isConnected)
        previouslyFocused.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panel}
        data-app-modal
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={twMerge(
          "max-h-[92dvh] w-full overflow-auto overscroll-contain rounded-t-2xl bg-surface shadow-2xl outline-none sm:rounded-2xl",
          wide ? "max-w-4xl" : "max-w-lg",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-4">
          <h2 id={titleId} className="font-semibold">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-9 p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </Button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
export const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="grid gap-1.5 text-sm font-medium">
    <span>{label}</span>
    {children}
  </label>
);
export const Empty = ({
  title,
  copy,
  action,
}: {
  title: string;
  copy: string;
  action?: React.ReactNode;
}) => (
  <div className="grid min-h-52 place-items-center p-8 text-center">
    <div>
      <PackageOpen className="mx-auto mb-3 text-muted" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{copy}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  </div>
);
