"use client"

import { useEffect, useState } from "react"

export interface DashboardData {
  owner: { ownerName: string; buildingName: string; area: string; emirate: string; email: string; phone: string }
  totals: {
    units: number; occupied: number; vacant: number; occupancyPct: number
    annualRentRoll: number; collected: number; pending: number
    invoiced: number; invoicePaid: number; invoiceOutstanding: number; overdueInvoices: number
    maintenanceExpense: number; violationsIssued: number; violationsPaid: number
    grossRevenue: number; netOperatingIncome: number; profitMargin: number; avgRentPerSqft: number
  }
  chequeBuckets: { pendingAll: number; dueNext30: number; dueNext90: number; overdue: number; cleared: number; bounced: number; total: number }
  cashflowProjection: Array<{ month: string; expected: number; cleared: number; bounced: number }>
  unitTypeBreakdown: Array<{ type: string; count: number; rent: number; sqft: number }>
  nationalityBreakdown: Array<{ nationality: string; count: number }>
  units: Array<{
    id: string; unitNo: string; unitType: string; sqFt: number; status: string
    contractStart: string; contractEnd: string; annualRent: number; collected: number
    pending: number; rentPerSqft: number
    tenant: { name: string; email: string; phone: string; nationality: string; status: string } | null
  }>
  topContributors: Array<{ unitNo: string; tenant: { name: string } | null; annualRent: number }>
  worstCollection: Array<{ unitNo: string; tenant: { name: string } | null; annualRent: number; pending: number }>
  upcomingRenewals: Array<{ unitNo: string; contractEnd: string; annualRent: number; tenant: { name: string } | null }>
  cheques: Array<{ id: string; chequeNo: string; bankName: string; amount: number; chequeDate: string; clearedDate: string; status: string; tenantName: string; unitNo: string }>
  invoices: Array<{ id: string; invoiceNo: string; totalAmount: number; paidAmount: number; status: string; dueDate: string; tenantName: string; unitNo: string }>
  complaints: Array<{ id: string; complaintNo: string; subject: string; status: string; createdAt: string }>
  tickets: Array<{ id: string; ticketNo: string; title: string; priority: string; status: string; submittedAt: string }>
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/owner/dashboard")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Failed to load")
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

export function formatAed(n: number): string {
  if (!n || isNaN(n)) return "AED 0"
  return `AED ${new Intl.NumberFormat("en-US").format(Math.round(n))}`
}

export function formatAedShort(n: number): string {
  if (!n || isNaN(n)) return "AED 0"
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}k`
  return `AED ${Math.round(n)}`
}

export function StatusPill({ value }: { value: string }) {
  const map: Record<string, string> = {
    Occupied: "bg-green-500/20 text-green-400",
    Vacant: "bg-red-500/20 text-red-400",
    Reserved: "bg-amber-500/20 text-amber-400",
    "Under Maintenance": "bg-orange-500/20 text-orange-400",
    Cleared: "bg-green-500/20 text-green-400",
    Bounced: "bg-red-500/20 text-red-400",
    Received: "bg-blue-500/20 text-blue-400",
    Pending: "bg-amber-500/20 text-amber-400",
    Deposited: "bg-blue-500/20 text-blue-400",
    Paid: "bg-green-500/20 text-green-400",
    Overdue: "bg-red-500/20 text-red-400",
    Unpaid: "bg-amber-500/20 text-amber-400",
  }
  const cls = map[value] || "bg-slate-500/20 text-slate-400"
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{value}</span>
}

export function KpiCard({
  label, value, icon, accent = "amber", sub,
}: {
  label: string; value: string | number; icon: React.ReactNode
  accent?: "amber" | "green" | "red" | "blue" | "purple"; sub?: string
}) {
  const accents = {
    amber: "from-amber-500/20 to-amber-600/5 border-amber-500/30",
    green: "from-green-500/20 to-green-600/5 border-green-500/30",
    red: "from-red-500/20 to-red-600/5 border-red-500/30",
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/30",
  }
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${accents[accent]} p-4`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <span className="text-slate-500">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

export function LoadingSpinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">{message}</div>
}

export const CHART_COLORS = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#a855f7", "#ec4899", "#14b8a6", "#eab308"]
