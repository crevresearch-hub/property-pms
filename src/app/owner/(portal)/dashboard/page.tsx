"use client"

import { useState, useEffect } from "react"
import { Building2, Users, DoorOpen, Percent, Banknote, Clock } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface DashboardData {
  owner: { ownerName: string; buildingName: string; area: string; emirate: string; email: string; phone: string }
  totals: { units: number; occupied: number; vacant: number; occupancyPct: number; annualRentRoll: number; collected: number; pending: number }
  chequeBuckets: { pendingAll: number; dueNext30: number; overdue: number; cleared: number; bounced: number }
  cashflowProjection: Array<{ month: string; expected: number; cleared: number }>
  units: Array<{ id: string; unitNo: string; unitType: string; status: string; contractEnd: string; annualRent: number; collected: number; pending: number; tenant: { name: string; email: string; phone: string } | null }>
  cheques: Array<{ id: string; chequeNo: string; bankName: string; amount: number; chequeDate: string; status: string; tenantName: string; unitNo: string }>
  invoices: Array<{ id: string; invoiceNo: string; totalAmount: number; paidAmount: number; status: string; dueDate: string; tenantName: string; unitNo: string }>
}

function formatAed(n: number): string {
  if (!n) return "AED 0"
  return `AED ${new Intl.NumberFormat("en-US").format(Math.round(n))}`
}

function StatusPill({ value }: { value: string }) {
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

function KpiCard({ label, value, icon, accent = "amber" }: { label: string; value: string | number; icon: React.ReactNode; accent?: "amber" | "green" | "red" | "blue" }) {
  const accents = {
    amber: "from-amber-500/20 to-amber-600/5 border-amber-500/30",
    green: "from-green-500/20 to-green-600/5 border-green-500/30",
    red: "from-red-500/20 to-red-600/5 border-red-500/30",
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
  }
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${accents[accent]} p-4`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <span className="text-slate-500">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

export default function OwnerDashboardPage() {
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">{error}</div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Welcome, {data.owner.ownerName}</h2>
        <p className="mt-1 text-sm text-slate-400">
          {data.owner.buildingName} · {data.owner.area}, {data.owner.emirate}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Units" value={data.totals.units} icon={<Building2 className="h-5 w-5" />} accent="blue" />
        <KpiCard label="Occupied" value={`${data.totals.occupied} / ${data.totals.units}`} icon={<Users className="h-5 w-5" />} accent="green" />
        <KpiCard label="Vacant" value={data.totals.vacant} icon={<DoorOpen className="h-5 w-5" />} accent="red" />
        <KpiCard label="Occupancy" value={`${data.totals.occupancyPct}%`} icon={<Percent className="h-5 w-5" />} accent="amber" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiCard label="Annual Rent Roll" value={formatAed(data.totals.annualRentRoll)} icon={<Banknote className="h-5 w-5" />} accent="amber" />
        <KpiCard label="Collected" value={formatAed(data.totals.collected)} icon={<Banknote className="h-5 w-5" />} accent="green" />
        <KpiCard label="Pending" value={formatAed(data.totals.pending)} icon={<Clock className="h-5 w-5" />} accent="red" />
      </div>

      {/* Cheque status */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Cheque Status Summary</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] text-slate-400">Due Next 30 Days</p>
            <p className="mt-1 text-sm font-semibold text-amber-400">{formatAed(data.chequeBuckets.dueNext30)}</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] text-slate-400">Overdue</p>
            <p className="mt-1 text-sm font-semibold text-red-400">{formatAed(data.chequeBuckets.overdue)}</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] text-slate-400">Cleared</p>
            <p className="mt-1 text-sm font-semibold text-green-400">{formatAed(data.chequeBuckets.cleared)}</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] text-slate-400">Bounced</p>
            <p className="mt-1 text-sm font-semibold text-red-400">{formatAed(data.chequeBuckets.bounced)}</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] text-slate-400">All Pending</p>
            <p className="mt-1 text-sm font-semibold text-blue-400">{formatAed(data.chequeBuckets.pendingAll)}</p>
          </div>
        </div>
      </section>

      {/* Cashflow projection */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">12-Month Cashflow Projection</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.cashflowProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v) => formatAed(Number(v))} contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Legend />
              <Bar dataKey="expected" fill="#f59e0b" name="Expected" />
              <Bar dataKey="cleared" fill="#22c55e" name="Cleared" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Units table */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Units ({data.units.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2">Unit</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Tenant</th>
                <th className="px-2 py-2">Annual Rent</th>
                <th className="px-2 py-2">Collected</th>
                <th className="px-2 py-2">Pending</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Contract End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.units.map((u) => (
                <tr key={u.id} className="text-slate-300">
                  <td className="px-2 py-2 font-mono">{u.unitNo}</td>
                  <td className="px-2 py-2">{u.unitType}</td>
                  <td className="px-2 py-2">{u.tenant?.name || <span className="text-slate-600">—</span>}</td>
                  <td className="px-2 py-2">{formatAed(u.annualRent)}</td>
                  <td className="px-2 py-2 text-green-400">{formatAed(u.collected)}</td>
                  <td className="px-2 py-2 text-red-400">{formatAed(u.pending)}</td>
                  <td className="px-2 py-2"><StatusPill value={u.status} /></td>
                  <td className="px-2 py-2">{u.contractEnd || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent cheques */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Recent Cheques</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Cheque No</th>
                <th className="px-2 py-2">Bank</th>
                <th className="px-2 py-2">Unit</th>
                <th className="px-2 py-2">Tenant</th>
                <th className="px-2 py-2">Amount</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.cheques.slice(0, 20).map((c) => (
                <tr key={c.id} className="text-slate-300">
                  <td className="px-2 py-2">{c.chequeDate}</td>
                  <td className="px-2 py-2 font-mono">{c.chequeNo}</td>
                  <td className="px-2 py-2">{c.bankName}</td>
                  <td className="px-2 py-2">{c.unitNo}</td>
                  <td className="px-2 py-2">{c.tenantName}</td>
                  <td className="px-2 py-2">{formatAed(c.amount)}</td>
                  <td className="px-2 py-2"><StatusPill value={c.status} /></td>
                </tr>
              ))}
              {data.cheques.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-slate-500">No cheques</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
