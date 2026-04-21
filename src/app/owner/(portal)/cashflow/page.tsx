"use client"

import { useMemo } from "react"
import { Clock, CheckCircle2, XCircle, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ComposedChart } from "recharts"
import { useDashboard, formatAed, formatAedShort, KpiCard, LoadingSpinner, ErrorBox, LastUpdatedBadge, PrintButton, ExportCsvButton } from "../_shared"

export default function OwnerCashflowPage() {
  const { data, loading, error, lastUpdated, refreshing, refresh } = useDashboard()

  const enriched = useMemo(() => {
    if (!data) return []
    // Per-month: income (cleared), pending (expected), bounced (loss)
    let cum = 0
    return data.cashflowProjection.map((m) => {
      const income = m.cleared
      const pending = m.expected
      const bounced = m.bounced
      const netInflow = income - bounced
      cum += netInflow
      const total = income + pending + bounced
      const collectionRate = total > 0 ? (income / total) * 100 : 0
      return { ...m, netInflow, cumulative: cum, collectionRate }
    })
  }, [data])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  const totalIncome = data.chequeBuckets.cleared
  const totalExpected = data.chequeBuckets.pendingAll
  const totalBounced = data.chequeBuckets.bounced
  const totalExpense = data.totals.maintenanceExpense
  const netCashflow = totalIncome - totalExpense - totalBounced

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Cashflow</h2>
          <p className="text-sm text-slate-500">Income, expenses, pending — month by month</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <LastUpdatedBadge lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={refresh} />
          <ExportCsvButton
            rows={enriched}
            filename="cashflow"
            columns={[
              { key: "month", label: "Month" },
              { key: "cleared", label: "Income Cleared" },
              { key: "expected", label: "Pending / Expected" },
              { key: "bounced", label: "Bounced" },
              { key: "netInflow", label: "Net Inflow" },
              { key: "cumulative", label: "Cumulative" },
              { key: "collectionRate", label: "Collection %" },
            ]}
          />
          <PrintButton />
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Received" value={formatAedShort(totalIncome)} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" sub="Cleared cheques" />
        <KpiCard label="Pending Income" value={formatAedShort(totalExpected)} icon={<Clock className="h-5 w-5" />} accent="amber" sub={`${data.chequeBuckets.total} cheques`} />
        <KpiCard label="Expenses" value={formatAedShort(totalExpense)} icon={<TrendingDown className="h-5 w-5" />} accent="red" sub="Maintenance + violations" />
        <KpiCard label="Net Cashflow" value={formatAedShort(netCashflow)} icon={<TrendingUp className="h-5 w-5" />} accent={netCashflow >= 0 ? "green" : "red"} sub="Income – Expenses" />
      </div>

      {/* Cheque bucket KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="Due Next 30 Days" value={formatAedShort(data.chequeBuckets.dueNext30)} icon={<Clock className="h-5 w-5" />} accent="amber" />
        <KpiCard label="Due Next 90 Days" value={formatAedShort(data.chequeBuckets.dueNext90)} icon={<Clock className="h-5 w-5" />} accent="blue" />
        <KpiCard label="Overdue" value={formatAedShort(data.chequeBuckets.overdue)} icon={<AlertTriangle className="h-5 w-5" />} accent="red" />
        <KpiCard label="Cleared" value={formatAedShort(data.chequeBuckets.cleared)} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        <KpiCard label="Bounced" value={formatAedShort(totalBounced)} icon={<XCircle className="h-5 w-5" />} accent="red" />
      </div>

      {/* Monthly bar chart */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Monthly Cashflow (24 months)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={enriched}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => formatAed(Number(v))} contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", color: "#111" }} />
              <Legend />
              <Bar dataKey="cleared" stackId="a" fill="#22c55e" name="Income (Cleared)" />
              <Bar dataKey="expected" stackId="a" fill="#f59e0b" name="Pending (Expected)" />
              <Bar dataKey="bounced" stackId="a" fill="#E30613" name="Bounced" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Cumulative */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Cumulative Net Cashflow</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={enriched}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => formatAed(Number(v))} contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", color: "#111" }} />
              <Legend />
              <Bar dataKey="netInflow" fill="#22c55e" name="Monthly Net" />
              <Line type="monotone" dataKey="cumulative" stroke="#E30613" strokeWidth={2} name="Cumulative" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Expected vs Cleared */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Expected vs Received</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={enriched}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 10 }} angle={-30} textAnchor="end" height={70} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => formatAed(Number(v))} contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", color: "#111" }} />
              <Legend />
              <Area type="monotone" dataKey="expected" stackId="2" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} name="Expected" />
              <Area type="monotone" dataKey="cleared" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.5} name="Received" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Month-by-month detailed table */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Month-by-Month Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2 text-right">Income Received</th>
                <th className="px-3 py-2 text-right">Pending / Expected</th>
                <th className="px-3 py-2 text-right">Bounced</th>
                <th className="px-3 py-2 text-right">Net Inflow</th>
                <th className="px-3 py-2 text-right">Cumulative</th>
                <th className="px-3 py-2 text-right">Collection %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enriched.map((m) => (
                <tr key={m.month} className="text-slate-700 hover:bg-slate-50">
                  <td className="px-3 py-2 font-semibold text-slate-900">{m.month}</td>
                  <td className="px-3 py-2 text-right font-semibold text-green-700">{formatAed(m.cleared)}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{formatAed(m.expected)}</td>
                  <td className="px-3 py-2 text-right text-[#E30613]">{m.bounced > 0 ? formatAed(m.bounced) : "—"}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${m.netInflow >= 0 ? "text-green-700" : "text-[#E30613]"}`}>{formatAed(m.netInflow)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${m.cumulative >= 0 ? "text-slate-900" : "text-[#E30613]"}`}>{formatAed(m.cumulative)}</td>
                  <td className="px-3 py-2 text-right">
                    {m.cleared + m.expected + m.bounced > 0 ? (
                      <span className={m.collectionRate >= 80 ? "text-green-700" : m.collectionRate >= 50 ? "text-amber-700" : "text-[#E30613]"}>
                        {m.collectionRate.toFixed(0)}%
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest">Total Cheques Tracked</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{data.chequeBuckets.total}</p>
          <p className="mt-1 text-xs text-slate-500">All statuses combined</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest">All Pending</p>
          <p className="mt-2 text-3xl font-bold text-amber-600">{formatAedShort(data.chequeBuckets.pendingAll)}</p>
          <p className="mt-1 text-xs text-slate-500">Received/Pending/Deposited</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest">Collection Rate</p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {data.chequeBuckets.cleared + data.chequeBuckets.bounced > 0
              ? Math.round((data.chequeBuckets.cleared / (data.chequeBuckets.cleared + data.chequeBuckets.bounced)) * 100)
              : 0}%
          </p>
          <p className="mt-1 text-xs text-slate-500">Cleared vs Bounced ratio</p>
        </div>
      </div>
    </div>
  )
}
