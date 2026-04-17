"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error"

interface Props {
  status: AutoSaveStatus
  className?: string
}

/**
 * Small inline text badge that conveys auto-save state.
 * "Saved ✓" auto-fades to idle after 2s.
 */
export function AutoSaveIndicator({ status, className }: Props) {
  const [visible, setVisible] = useState<AutoSaveStatus>(status)

  useEffect(() => {
    setVisible(status)
    if (status === "saved") {
      const t = setTimeout(() => setVisible("idle"), 2000)
      return () => clearTimeout(t)
    }
  }, [status])

  if (visible === "idle") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-slate-400",
          className
        )}
      >
        &nbsp;
      </span>
    )
  }

  if (visible === "saving") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200",
          className
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    )
  }

  if (visible === "saved") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 transition-opacity",
          className
        )}
      >
        <CheckCircle2 className="h-3 w-3" />
        Saved
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200",
        className
      )}
    >
      <AlertCircle className="h-3 w-3" />
      Save failed
    </span>
  )
}
