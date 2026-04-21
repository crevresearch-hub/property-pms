"use client"

import { Wallet, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ComposedChart } from "recharts"
import { useDashboard, formatAed, formatAedShort, KpiCard, LoadingSpinner, ErrorBox } from "../_shared"

export default function OwnerCashflowPage() {
  const { data, loading, error } = useDashboard()
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  // Build cumulative line
  let cum = 0
  const cashflowWithCumulative = data.cashflowProjection.map((m) => {
    cum += m.cleared
    return { ...m, cumulative: cum }
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Cashflow</h2>
        <p className="text-sm text-slate-400">Past 6 months + next 18 months projection</p>
      </div>

      {/* Cheque bucket KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Due Next 30 Days" value={formatAedShort(data.chequeBuckets.dueNext30)} icon={<Clock className="h-5 w-5" />} accent="amber" />
        <KpiCard label="Due Next 90 Days" value={formatAedShort(data.chequeBuckets.dueNext90)} icon={<Clock className="h-5 w-5" />} accent="blue" />
        <KpiCard label="Overdue" value={formatAedShort(data.chequeBuckets.overdue)} icon={<AlertTriangle className="h-5 w-5" />} accent="red" />
        <KpiCard label="Cleared" value={formatAedShort(data.chequeBuckets.cleared)} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        <KpiCard label="Bounced" value={formatAedShort(data.chequeBuckets.bounced)} icon={<XCircle className="h-5 w-5" />} accent="red" />
      </div>

      {/* Monthly bar chart */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Monthly Cashflow (24 months)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.cashflowProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => formatAed(Number(v))} contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Legend />
              <Bar dataKey="cleared" stackId="a" fill="#22c55e" name="Cleared" />
              <Bar dataKey="expected" stackId="a" fill="#f59e0b" name="Expected" />
              <Bar dataKey="bounced" stackId="a" fill="#ef4444" name="Bounced" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Cumulative cleared + expected line */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Cumulative Cashflow Trend</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cashflowWithCumulative}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => formatAed(Number(v))} contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Legend />
              <Bar dataKey="cleared" fill="#22c55e" name="Monthly Cleared" />
              <Line type="monotone" dataKey="cumulative" stroke="#f59e0b" strokeWidth={2} name="Cumulative" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Expected vs Cleared area */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Expected vs Cleared</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.cashflowProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => formatAed(Number(v))} contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Legend />
              <Area type="monotone" dataKey="expected" stackId="2" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} name="Expected" />
              <Area type="monotone" dataKey="cleared" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.5} name="Cleared" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Month-by-month table */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Month-by-Month Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2 text-right">Expected</th>
                <th className="px-3 py-2 text-right">Cleared</th>
                <th className="px-3 py-2 text-right">Bounced</th>
                <th className="px-3 py-2 text-right">Collection Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.cashflowProjection.map((m) => {
                const total = m.cleared + m.expected + m.bounced
                const rate = total > 0 ? (m.cleared / total) * 100 : 0
                return (
                  <tr key={m.month} className="text-slate-300">
                    <td className="px-3 py-2 font-semibold text-white">{m.month}</td>
                    <td className="px-3 py-2 text-right text-amber-400">{formatAed(m.expected)}</td>
                    <td className="px-3 py-2 text-right text-green-400">{formatAed(m.cleared)}</td>
                    <td className="px-3 py-2 text-right text-red-400">{m.bounced > 0 ? formatAed(m.bounced) : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {total > 0 ? <span className={rate >= 80 ? "text-green-400" : rate >= 50 ? "text-amber-400" : "text-red-400"}>{rate.toFixed(0)}%</span> : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Total Cheques Tracked</p>
          <p className="mt-2 text-3xl font-bold text-white">{data.chequeBuckets.total}</p>
          <p className="mt-1 text-xs text-slate-400">All statuses combined</p>
        </section>
        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">All Pending</p>
          <p className="mt-2 text-3xl font-bold text-amber-400">{formatAedShort(data.chequeBuckets.pendingAll)}</p>
          <p className="mt-1 text-xs text-slate-400">Received/Pending/Deposited status</p>
        </section>
        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Collection Rate</p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            {data.chequeBuckets.cleared + data.chequeBuckets.bounced > 0
              ? Math.round((data.chequeBuckets.cleared / (data.chequeBuckets.cleared + data.chequeBuckets.bounced)) * 100)
              : 0}%
          </p>
          <p className="mt-1 text-xs text-slate-400">Cleared vs Bounced ratio</p>
        </section>
      </div>
    </div>
  )
}
