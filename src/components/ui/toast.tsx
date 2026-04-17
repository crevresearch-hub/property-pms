"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { CheckCircle2, XCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastVariant = "success" | "error"

interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within a ToastProvider")
  return ctx
}

let toastCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = `toast-${++toastCounter}`
      setToasts((prev) => [...prev, { id, message, variant }])
      setTimeout(() => removeToast(id), 3000)
    },
    [removeToast]
  )

  const ctx: ToastContextValue = {
    toast: addToast,
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error"),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const isSuccess = toast.variant === "success"

  return (
    <div
      className={cn(
        "flex w-80 items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl",
        "animate-in slide-in-from-right-full fade-in duration-300",
        isSuccess
          ? "border-emerald-500/30 bg-slate-900/95 text-emerald-400"
          : "border-red-500/30 bg-slate-900/95 text-red-400"
      )}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
      ) : (
        <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
      )}
      <p className="flex-1 text-sm font-medium text-slate-200">{toast.message}</p>
      <button
        onClick={onClose}
        className="shrink-0 rounded p-0.5 text-slate-500 transition-colors hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
