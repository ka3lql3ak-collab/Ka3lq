"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary: "bg-gradient-to-br from-peach-400 to-berry-500 text-ink-950 shadow-lg shadow-berry-500/20 hover:brightness-110",
    secondary: "bg-ink-800 text-ink-200 border border-ink-700 hover:bg-ink-700",
    ghost: "text-ink-300 hover:bg-ink-800 hover:text-ink-200",
    danger: "bg-berry-500/15 text-berry-400 border border-berry-500/30 hover:bg-berry-500/25",
    success: "bg-lime-500/15 text-lime-400 border border-lime-500/30 hover:bg-lime-500/25",
  };
  const s = { sm: "px-2.5 py-1 text-xs", md: "px-3.5 py-2 text-sm", lg: "px-5 py-2.5 text-base" }[size];
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx("inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed", v[variant], s, className)}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <span className={cx("inline-block animate-spin rounded-full border-2 border-current border-t-transparent", className)} aria-label="Loading" />;
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("rounded-2xl border border-ink-700/70 bg-ink-900/70 backdrop-blur-sm", className)}>
      {children}
    </div>
  );
}

const BADGE: Record<string, string> = {
  approved: "bg-lime-500/15 text-lime-400 border-lime-500/30",
  completed: "bg-lime-500/15 text-lime-400 border-lime-500/30",
  done: "bg-lime-500/15 text-lime-400 border-lime-500/30",
  ready: "bg-lime-500/15 text-lime-400 border-lime-500/30",
  rejected: "bg-berry-500/15 text-berry-400 border-berry-500/30",
  failed: "bg-berry-500/15 text-berry-400 border-berry-500/30",
  cancelled: "bg-ink-700 text-ink-400 border-ink-600",
  unknown: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  pending: "bg-ink-800 text-ink-300 border-ink-600",
  draft: "bg-ink-800 text-ink-300 border-ink-600",
  queued: "bg-sky-400/10 text-sky-400 border-sky-400/30",
  running: "bg-peach-500/15 text-peach-400 border-peach-500/30",
  generating: "bg-peach-500/15 text-peach-400 border-peach-500/30",
  submitting: "bg-peach-500/15 text-peach-400 border-peach-500/30",
  submitted: "bg-sky-400/10 text-sky-400 border-sky-400/30",
  awaiting_approval: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  demo: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  paid: "bg-berry-500/10 text-berry-400 border-berry-500/30",
  free: "bg-lime-500/10 text-lime-400 border-lime-500/25",
};

export function Badge({ tone, children, className }: { tone?: string; children: ReactNode; className?: string }) {
  const t = tone ?? (typeof children === "string" ? children : "pending");
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", BADGE[t] ?? BADGE.pending, className)}>
      {(t === "running" || t === "generating" || t === "submitting") && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {typeof children === "string" ? children.replace(/_/g, " ") : children}
    </span>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cx("h-1.5 w-full overflow-hidden rounded-full bg-ink-800", className)}>
      <div className="h-full rounded-full bg-gradient-to-r from-peach-400 to-berry-500 transition-all" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-peach-400">{eyebrow}</div>}
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="text-4xl">🍓</div>
      <div className="font-display text-lg font-semibold text-white">{title}</div>
      {children && <div className="max-w-md text-sm text-ink-400">{children}</div>}
      {action}
    </Card>
  );
}

export function ErrorBox({ error, className }: { error: string | null | undefined; className?: string }) {
  if (!error) return null;
  return <div className={cx("rounded-xl border border-berry-500/30 bg-berry-500/10 px-4 py-3 text-sm text-berry-400", className)}>⚠ {error}</div>;
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "demo" | "ok"; children: ReactNode; className?: string }) {
  const t = {
    info: "border-sky-400/25 bg-sky-400/5 text-sky-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    demo: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    ok: "border-lime-500/30 bg-lime-500/10 text-lime-300",
  }[tone];
  return <div className={cx("rounded-xl border px-4 py-3 text-sm", t, className)}>{children}</div>;
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label>{label}</label>
      {children}
      {hint && <div className="text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal className={cx("max-h-[90vh] w-full overflow-auto rounded-2xl border border-ink-700 bg-ink-900 shadow-2xl scroll-thin", wide ? "max-w-3xl" : "max-w-lg")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink-800 px-5 py-4">
          <div className="font-display text-lg font-semibold text-white">{title}</div>
          <button className="text-ink-400 hover:text-white" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-800 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------ Confirm dialog (promise API) --------------------- */

interface ConfirmOpts {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "paid" | "default";
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

/* ---------------------------------- Toasts -------------------------------- */

interface ToastItem {
  id: number;
  text: string;
  tone: "ok" | "error" | "info";
}
const ToastCtx = createContext<(text: string, tone?: ToastItem["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })), []);
  const toast = useCallback((text: string, tone: ToastItem["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 8000 : 4000);
  }, []);
  const close = (v: boolean) => {
    pending?.resolve(v);
    setPending(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      <ToastCtx.Provider value={toast}>
        {children}
        <Modal
          open={!!pending}
          onClose={() => close(false)}
          title={pending?.title}
          footer={
            <>
              <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
              <Button variant={pending?.tone === "danger" ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
                {pending?.confirmLabel ?? "Confirm"}
              </Button>
            </>
          }
        >
          <div className="text-sm text-ink-300">{pending?.body}</div>
        </Modal>
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cx(
                "pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur",
                t.tone === "error" ? "border-berry-500/40 bg-ink-900/95 text-berry-400" : t.tone === "info" ? "border-sky-400/30 bg-ink-900/95 text-sky-300" : "border-lime-500/30 bg-ink-900/95 text-lime-300",
              )}
            >
              {t.text}
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl border border-ink-700 bg-ink-900 p-1">
      {items.map((i) => (
        <button key={i.value} onClick={() => onChange(i.value)} className={cx("rounded-lg px-3 py-1.5 text-sm font-medium transition", value === i.value ? "bg-ink-700 text-white" : "text-ink-400 hover:text-ink-200")}>
          {i.label}
        </button>
      ))}
    </div>
  );
}
