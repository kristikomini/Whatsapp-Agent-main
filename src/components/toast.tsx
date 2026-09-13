"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  toast: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

/**
 * App-wide toast notifications. Small, theme-aware, auto-dismissing. Used to
 * surface the results of mutations (esp. failures that were previously silent —
 * a failed sale/edit used to just close the modal as if it worked).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, tone, message }]);
      setTimeout(() => remove(id), tone === "error" ? 6000 : 3500);
    },
    [remove]
  );

  const api = React.useMemo<ToastApi>(
    () => ({
      toast,
      success: (m: string) => toast(m, "success"),
      error: (m: string) => toast(m, "error"),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto flex flex-col items-stretch sm:items-end gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const toneStyle: Record<ToastTone, { icon: typeof Info; fg: string; soft: string }> = {
  success: { icon: CheckCircle2, fg: "var(--success)", soft: "var(--success-soft)" },
  error: { icon: AlertTriangle, fg: "var(--danger)", soft: "var(--danger-soft)" },
  info: { icon: Info, fg: "var(--info)", soft: "var(--info-soft)" },
};

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const s = toneStyle[toast.tone];
  const Icon = s.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      role="status"
      aria-live={toast.tone === "error" ? "assertive" : "polite"}
      className="card pointer-events-auto flex items-start gap-2.5 p-3 pr-2.5 sm:min-w-[280px] sm:max-w-md"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.soft, color: s.fg }}>
        <Icon size={16} />
      </span>
      <p className="text-sm flex-1 min-w-0 pt-0.5" style={{ color: "var(--text)" }}>{toast.message}</p>
      <button onClick={onClose} aria-label="Chiudi notifica" className="text-faint hover:text-[var(--text)] transition-colors shrink-0 p-0.5">
        <X size={15} />
      </button>
    </motion.div>
  );
}

/** Access the toast API. Falls back to a no-op-ish console if used outside the provider. */
export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    const warn = (m: string) => console.warn("[toast:no-provider]", m);
    return { toast: warn, success: warn, error: warn };
  }
  return ctx;
}
