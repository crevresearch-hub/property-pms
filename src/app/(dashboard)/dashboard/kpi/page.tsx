"use client"

import { useState, useEffect } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { formatCurrency } from "@/lib/utils"
import {
  TrendingUp,
  Building2,
  RefreshCw,
  FileText,
  CreditCard,
  Wrench,
  ShieldAlert,
  DoorOpen,
  Banknote,
  CheckCircle,
  AlertTriangle,
} from "lucide-react"

interface KpiItem {
  id: string
  name: string
  value: number
  unit: string
  target: number
  status: string
  monthly_revenue_loss?: number
  total_pending?: number
}

interface ActivityRow {
  id: string
  user: string
  action: string
  details: string
  createdAt: string
  [key: string]: unknown
}

const iconMap: Record<string, React.ReactNode> = {
  occupancy_rate: <Building2 className="h-5 w-5" />,
  renewals_on_time: <RefreshCw className="h-5 w-5" />,
  expired_contracts: <AlertTriangle className="h-5 w-5" />,
  complaint_resolution: <CheckCircle className="h-5 w-5" />,
  doc_completeness: <FileText className="h-5 w-5" />,
  cheque_clearance: <CreditCard className="h-5 w-5" />,
  bounced_this_month: <CreditCard className="h-5 w-5" />,
  open_maintenance: <Wrench className="h-5 w-5" />,
  violations_this_month: <ShieldAlert className="h-5 w-5" />,
  vacant_units: <DoorOpen className="h-5 w-5" />,
  pending_fees: <Banknote className="h-5 w-5" />,
}

const colorMap: Record<string, "green" | "amber" | "red"> = {
  green: "green",
  amber: "amber",
  red: "red",
}

export default function KpiPage() {
  const [kpis, setKpis] = useState<KpiItem[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchData() {
      try {
        const [kpiRes, actRes] = await Promise.all([
          fetch("/api/kpi"),
          fetch("/api/activity"),
        ])
        if (!kpiRes.ok) throw new Error("Failed to fetch KPIs")
        const kpiData = await kpiRes.json()
        setKpis(kpiData.kpis || [])
        if (actRes.ok) setActivity((await actRes.json()).slice(0, 20))
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const activityColumns: Column<ActivityRow>[] = [
    { key: "user", header: "User", sortable: true },
    { key: "action", header: "Action" },
    { key: "details", header: "Details" },
    { key: "createdAt", header: "Timestamp", sortable: true, render: (r) => new Date(r.createdAt).toLocaleString() },
  ]

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Staff KPIs</h1>
        <p className="mt-1 text-sm text-slate-400">Performance metrics with traffic-light indicators</p>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const displayValue = kpi.unit === "%" ? `${kpi.value}%` : kpi.unit === "count" ? String(kpi.value) : String(kpi.value)
          const subtitle = `Target: ${kpi.unit === "%" ? `${kpi.target}%` : kpi.target}${kpi.monthly_revenue_loss ? ` | Loss: ${formatCurrency(kpi.monthly_revenue_loss)}/mo` : ""}${kpi.total_pending ? ` | Total: ${formatCurrency(kpi.total_pending)}` : ""}`

          return (
            <KpiCard
              key={kpi.id}
              label={kpi.name}
              value={displayValue}
              subtitle={subtitle}
              color={colorMap[kpi.status] || "amber"}
              icon={iconMap[kpi.id] || <TrendingUp className="h-5 w-5" />}
            />
          )
        })}
      </div>

      {/* Staff Activity */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Staff Activity</h2>
        <DataTable columns={activityColumns} data={activity} searchPlaceholder="Search activity..." searchKeys={["user", "action", "details"]} />
      </div>
    </div>
  )
}
