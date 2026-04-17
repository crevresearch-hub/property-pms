import { cn } from "@/lib/utils"

const statusStyles: Record<string, string> = {
  // Invoice / Payment statuses
  draft: "bg-slate-500/15 text-slate-400 ring-slate-500/30",
  sent: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  paid: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  overdue: "bg-red-500/15 text-red-400 ring-red-500/30",
  partial: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  cancelled: "bg-slate-500/15 text-slate-500 ring-slate-500/30",
  void: "bg-slate-500/15 text-slate-500 ring-slate-500/30",

  // Maintenance / Complaint statuses
  open: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  "in-progress": "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  in_progress: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  closed: "bg-slate-500/15 text-slate-400 ring-slate-500/30",
  resolved: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",

  // Approval statuses
  submitted: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  approved: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  rejected: "bg-red-500/15 text-red-400 ring-red-500/30",
  pending: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  signed: "bg-blue-500/15 text-blue-400 ring-blue-500/30",

  // Unit / Lease statuses
  occupied: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  vacant: "bg-red-500/15 text-red-400 ring-red-500/30",
  "under-maintenance": "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  reserved: "bg-purple-500/15 text-purple-400 ring-purple-500/30",

  // Contract statuses
  active: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  expired: "bg-red-500/15 text-red-400 ring-red-500/30",
  expiring: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  renewed: "bg-blue-500/15 text-blue-400 ring-blue-500/30",

  // Cheque statuses
  deposited: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  bounced: "bg-red-500/15 text-red-400 ring-red-500/30",
  replaced: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
  "post-dated": "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  received: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  cleared: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",

  // Tenant list custom (passed in as "Emailed to Client" by the page)
  "emailed-to-client": "bg-amber-500/15 text-amber-400 ring-amber-500/30",

  // Invoice tenant-submitted (waiting for PM verification)
  "tenant-submitted": "bg-purple-500/15 text-purple-400 ring-purple-500/30",
}

const fallbackStyle = "bg-slate-500/15 text-slate-400 ring-slate-500/30"

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, "-")
  const style = statusStyles[normalized] || fallbackStyle

  // Note: avoid mapping "pending" → "Emailed to Client" here — it leaks
  // into other contexts (cheques, invoices, etc.). Tenant-list specific
  // labels are applied directly in that component.
  const labelOverrides: Record<string, string> = {
    signed: "Signed — Awaiting Activation",
  }
  const displayLabel =
    labelOverrides[normalized] ||
    status.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        style,
        className
      )}
    >
      {displayLabel}
    </span>
  )
}
