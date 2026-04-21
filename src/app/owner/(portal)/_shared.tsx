"use client"

import { useEffect, useState, useCallback } from "react"
import { RefreshCw, Download, Printer } from "lucide-react"

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
  cashflowProjection: Array<{ key: string; month: string; expected: number; cleared: number; bounced: number }>
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const r = await fetch("/api/owner/dashboard")
      if (!r.ok) throw new Error((await r.json()).error || "Failed to load")
      const d = await r.json()
      setData(d)
      setLastUpdated(new Date())
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), 60_000) // refresh every 60s
    return () => clearInterval(interval)
  }, [load])

  return { data, loading, error, lastUpdated, refreshing, refresh: () => load(true) }
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

export function timeAgo(date: Date | null): string {
  if (!date) return ""
  const sec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (sec < 5) return "just now"
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return date.toLocaleDateString()
}

export function LastUpdatedBadge({ lastUpdated, refreshing, onRefresh }: { lastUpdated: Date | null; refreshing: boolean; onRefresh: () => void }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 10_000)
    return () => clearInterval(t)
  }, [])
  void tick
  return (
    <button
      onClick={onRefresh}
      disabled={refreshing}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 hover:text-slate-900 hover:border-[#E30613]/50 print:hidden"
      title="Refresh data"
    >
      <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
      Updated {timeAgo(lastUpdated)}
    </button>
  )
}

export function StatusPill({ value }: { value: string }) {
  const map: Record<string, string> = {
    Occupied: "bg-green-100 text-green-700",
    Vacant: "bg-red-100 text-red-700",
    Reserved: "bg-amber-100 text-amber-700",
    "Under Maintenance": "bg-orange-100 text-orange-700",
    Cleared: "bg-green-100 text-green-700",
    Bounced: "bg-red-100 text-red-700",
    Received: "bg-blue-100 text-blue-700",
    Pending: "bg-amber-100 text-amber-700",
    Deposited: "bg-blue-100 text-blue-700",
    Paid: "bg-green-100 text-green-700",
    Overdue: "bg-red-100 text-red-700",
    Unpaid: "bg-amber-100 text-amber-700",
  }
  const cls = map[value] || "bg-slate-100 text-slate-700"
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{value}</span>
}

export function KpiCard({
  label, value, icon, accent = "amber", sub,
}: {
  label: string; value: string | number; icon: React.ReactNode
  accent?: "amber" | "green" | "red" | "blue" | "purple"; sub?: string
}) {
  const accents = {
    amber: "border-l-amber-500 bg-gradient-to-br from-amber-50 to-white",
    green: "border-l-green-500 bg-gradient-to-br from-green-50 to-white",
    red: "border-l-[#E30613] bg-gradient-to-br from-red-50 to-white",
    blue: "border-l-blue-500 bg-gradient-to-br from-blue-50 to-white",
    purple: "border-l-purple-500 bg-gradient-to-br from-purple-50 to-white",
  }
  const iconColors = {
    amber: "text-amber-600",
    green: "text-green-600",
    red: "text-[#E30613]",
    blue: "text-blue-600",
    purple: "text-purple-600",
  }
  return (
    <div className={`rounded-xl border border-slate-200 border-l-4 ${accents[accent]} p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <span className={iconColors[accent]}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
    </div>
  )
}

export function SkeletonKpi() {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 animate-pulse">
      <div className="h-2 w-20 rounded bg-slate-200" />
      <div className="mt-3 h-7 w-28 rounded bg-slate-200" />
    </div>
  )
}

export function SkeletonBlock({ height = 200 }: { height?: number }) {
  return <div className="animate-pulse rounded-xl border border-slate-200 bg-slate-100" style={{ height }} />
}

export function LoadingSpinner() {
  return (
    <div className="space-y-6">
      <SkeletonBlock height={120} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SkeletonKpi /><SkeletonKpi /><SkeletonKpi /><SkeletonKpi />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SkeletonKpi /><SkeletonKpi /><SkeletonKpi /><SkeletonKpi />
      </div>
      <SkeletonBlock height={260} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonBlock height={200} />
        <SkeletonBlock height={200} />
      </div>
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>
}

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 hover:text-slate-900 hover:border-[#E30613]/50 print:hidden"
    >
      <Printer className="h-3 w-3" /> Print / PDF
    </button>
  )
}

export function ExportCsvButton<T extends Record<string, unknown>>({
  rows, filename, columns,
}: {
  rows: T[]
  filename: string
  columns: { key: keyof T; label: string }[]
}) {
  const onClick = () => {
    const headers = columns.map((c) => c.label)
    const body = rows.map((r) => columns.map((c) => {
      const v = r[c.key]
      if (v === null || v === undefined) return ""
      return String(v)
    }))
    const csv = [headers, ...body]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700 hover:bg-green-100 print:hidden"
    >
      <Download className="h-3 w-3" /> Export CSV
    </button>
  )
}

export const CHART_COLORS = ["#E30613", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#eab308"]
