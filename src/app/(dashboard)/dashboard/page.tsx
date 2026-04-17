"use client"

import { useState, useEffect } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { formatCurrency } from "@/lib/utils"
import {
  Building2,
  Users,
  DoorOpen,
  Percent,
  Banknote,
  TrendingUp,
  Activity,
} from "lucide-react"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface DashboardData {
  total_units: number
  occupied: number
  vacant: number
  gross_rent: number
  occupancy_rate: number
  total_income: number
  total_expenses: number
  net_income: number
}

interface ActivityItem {
  id: string
  user: string
  action: string
  details: string
  createdAt: string
}

interface BuildingPerf {
  ownerId: string
  ownerName: string
  ownerEmail: string
  buildingName: string
  area: string
  totalUnits: number
  occupied: number
  vacant: number
  occupancyPct: number
  annualRentRoll: number
  collected: number
  pdcsInHand: number
  pending: number
}

interface CeoSummary {
  portfolio: { totalUnits: number; occupied: number; vacant: number; annualRentRoll: number; collected: number; pdcsInHand: number; pending: number; occupancyPct: number; totalOwners: number; totalBuildings: number }
  buildings: BuildingPerf[]
  topTenants: Array<{ unitNo: string; tenantName: string; annualRent: number }>
}

const PIE_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6366f1"]

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [ceo, setCeo] = useState<CeoSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashRes, actRes, ceoRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/activity"),
          fetch("/api/ceo/summary"),
        ])
        if (!dashRes.ok) throw new Error("Failed to fetch dashboard data")
        const dashData = await dashRes.json()
        setData(dashData)

        if (actRes.ok) {
          const actData = await actRes.json()
          setActivity(actData.slice(0, 10))
        }
        if (ceoRes.ok) {
          setCeo(await ceoRes.json())
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-800 bg-red-900/20 p-6 text-center text-red-400">
        {error}
      </div>
    )
  }

  if (!data) return null

  const revenueData = [
    { name: "Gross Rent", amount: data.gross_rent },
    { name: "Total Income", amount: data.total_income },
    { name: "Total Expenses", amount: data.total_expenses },
    { name: "Net Income", amount: data.net_income },
  ]

  const occupancyData = [
    { name: "Occupied", value: data.occupied },
    { name: "Vacant", value: data.vacant },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Executive Summary</h1>
        <p className="mt-1 text-sm text-slate-400">
          Overview of property performance and key metrics
        </p>
      </div>

      {/* Portfolio Performance — per-building breakdown */}
      {ceo && ceo.buildings.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Portfolio Performance</h2>
              <p className="text-xs text-slate-500">{ceo.portfolio.totalBuildings} building{ceo.portfolio.totalBuildings === 1 ? '' : 's'} · {ceo.portfolio.totalUnits} units · {ceo.portfolio.occupancyPct}% occupancy</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-slate-500">Annual Rent Roll</p>
              <p className="text-base font-bold text-amber-400">{formatCurrency(ceo.portfolio.annualRentRoll)}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-200">
              <thead className="bg-slate-950/40 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Building</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Owner</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Units</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Occ.</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Rent Roll</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Collected</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">PDCs in Hand</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Pending</th>
                </tr>
              </thead>
              <tbody>
                {ceo.buildings.map((b) => (
                  <tr key={b.ownerId} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-semibold text-white">{b.buildingName}<div className="text-[10px] text-slate-500">{b.area || '—'}</div></td>
                    <td className="px-3 py-2 text-slate-300">{b.ownerName}</td>
                    <td className="px-3 py-2 text-right">{b.totalUnits}<span className="text-[10px] text-slate-500"> ({b.occupied}/{b.vacant})</span></td>
                    <td className="px-3 py-2 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        b.occupancyPct >= 90 ? "bg-emerald-500/20 text-emerald-400" :
                        b.occupancyPct >= 70 ? "bg-amber-500/20 text-amber-400" :
                        "bg-red-500/20 text-red-400"
                      }`}>{b.occupancyPct}%</span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-300">{formatCurrency(b.annualRentRoll)}</td>
                    <td className="px-3 py-2 text-right text-emerald-300">{formatCurrency(b.collected)}</td>
                    <td className="px-3 py-2 text-right text-blue-300">{formatCurrency(b.pdcsInHand)}</td>
                    <td className="px-3 py-2 text-right text-red-300">{formatCurrency(b.pending)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-700 bg-slate-950/60 font-bold">
                  <td className="px-3 py-2 text-white">Portfolio Total</td>
                  <td></td>
                  <td className="px-3 py-2 text-right text-white">{ceo.portfolio.totalUnits}</td>
                  <td className="px-3 py-2 text-right text-white">{ceo.portfolio.occupancyPct}%</td>
                  <td className="px-3 py-2 text-right text-amber-400">{formatCurrency(ceo.portfolio.annualRentRoll)}</td>
                  <td className="px-3 py-2 text-right text-emerald-400">{formatCurrency(ceo.portfolio.collected)}</td>
                  <td className="px-3 py-2 text-right text-blue-400">{formatCurrency(ceo.portfolio.pdcsInHand)}</td>
                  <td className="px-3 py-2 text-right text-red-400">{formatCurrency(ceo.portfolio.pending)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Total Units"
          value={data.total_units}
          subtitle="All property units"
          color="blue"
          icon={<Building2 className="h-5 w-5" />}
        />
        <KpiCard
          label="Occupied"
          value={data.occupied}
          subtitle={`${data.occupancy_rate}% occupancy`}
          color="green"
          icon={<Users className="h-5 w-5" />}
        />
        <KpiCard
          label="Vacant"
          value={data.vacant}
          subtitle="Available units"
          color="red"
          icon={<DoorOpen className="h-5 w-5" />}
        />
        <KpiCard
          label="Occupancy Rate"
          value={`${data.occupancy_rate}%`}
          subtitle="Current rate"
          color="gold"
          icon={<Percent className="h-5 w-5" />}
        />
        <KpiCard
          label="Gross Rent"
          value={formatCurrency(data.gross_rent)}
          subtitle="Annual occupied rent"
          color="amber"
          icon={<Banknote className="h-5 w-5" />}
        />
        <KpiCard
          label="Net Income"
          value={formatCurrency(data.net_income)}
          subtitle="Income minus expenses"
          color="purple"
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Bar Chart */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Revenue Composition
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy Pie Chart */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Occupancy Breakdown
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={occupancyData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={(props: { name?: string; percent?: number }) =>
                  `${props.name || ""} ${((props.percent || 0) * 100).toFixed(0)}%`
                }
              >
                {occupancyData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-amber-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Recent Activity
          </h2>
        </div>
        {activity.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            No recent activity
          </p>
        ) : (
          <div className="space-y-3">
            {activity.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-slate-800/50 bg-slate-800/20 p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/10">
                  <Activity className="h-4 w-4 text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">
                    <span className="font-medium">{item.user}</span>{" "}
                    <span className="text-slate-400">{item.action}</span>
                  </p>
                  {item.details && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {item.details}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-600">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
