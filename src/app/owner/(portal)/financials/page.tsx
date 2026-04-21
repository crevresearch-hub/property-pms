"use client"

import { TrendingUp, TrendingDown, Minus, Receipt, ShieldAlert, Wrench, DollarSign } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts"
import { useDashboard, formatAed, formatAedShort, KpiCard, LoadingSpinner, ErrorBox } from "../_shared"

export default function OwnerFinancialsPage() {
  const { data, loading, error } = useDashboard()
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  const totalExpenses = data.totals.maintenanceExpense
  const noi = data.totals.grossRevenue - totalExpenses
  const margin = data.totals.grossRevenue > 0 ? (noi / data.totals.grossRevenue) * 100 : 0

  const revByType = data.unitTypeBreakdown.map((t) => ({ type: t.type, revenue: t.rent, count: t.count }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Financials</h2>
        <p className="text-sm text-slate-400">Revenue, expenses, and profitability breakdown</p>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <KpiCard label="Gross Revenue" value={formatAedShort(data.totals.grossRevenue)} icon={<TrendingUp className="h-5 w-5" />} accent="green" />
        <KpiCard label="Total Expenses" value={formatAedShort(totalExpenses)} icon={<TrendingDown className="h-5 w-5" />} accent="red" />
        <KpiCard label="Net Operating Income" value={formatAedShort(noi)} icon={<DollarSign className="h-5 w-5" />} accent="amber" />
        <KpiCard label="Profit Margin" value={`${margin.toFixed(1)}%`} icon={<Minus className="h-5 w-5" />} accent="purple" />
      </div>

      {/* P&L Statement */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-6">
        <h3 className="mb-4 text-sm font-semibold text-white">Profit & Loss Statement</h3>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-white/5">
            <tr>
              <td className="py-3 text-slate-300">Rent Collected (cleared cheques + upfront)</td>
              <td className="py-3 text-right font-mono text-green-400">{formatAed(data.chequeBuckets.cleared + data.totals.collected)}</td>
            </tr>
            <tr>
              <td className="py-3 text-slate-300">Expected Rent (pending cheques)</td>
              <td className="py-3 text-right font-mono text-amber-400">{formatAed(data.chequeBuckets.pendingAll)}</td>
            </tr>
            <tr className="border-t-2 border-white/20">
              <td className="py-3 font-semibold text-white">Gross Revenue</td>
              <td className="py-3 text-right font-mono font-bold text-green-400">{formatAed(data.totals.grossRevenue)}</td>
            </tr>
            <tr>
              <td className="py-3 pl-6 text-slate-400">— Maintenance expenses</td>
              <td className="py-3 text-right font-mono text-red-400">({formatAed(data.totals.maintenanceExpense)})</td>
            </tr>
            <tr>
              <td className="py-3 pl-6 text-slate-400">— Violations fines issued</td>
              <td className="py-3 text-right font-mono text-slate-500">{formatAed(data.totals.violationsIssued)}</td>
            </tr>
            <tr className="border-t-2 border-white/20">
              <td className="py-3 font-semibold text-white">Net Operating Income (NOI)</td>
              <td className={`py-3 text-right font-mono font-bold ${noi >= 0 ? "text-green-400" : "text-red-400"}`}>{formatAed(noi)}</td>
            </tr>
            <tr>
              <td className="py-3 text-slate-300">Profit Margin</td>
              <td className={`py-3 text-right font-mono ${margin >= 0 ? "text-green-400" : "text-red-400"}`}>{margin.toFixed(2)}%</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Revenue by unit type */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Revenue Contribution by Unit Type</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revByType} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <YAxis dataKey="type" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} width={80} />
              <Tooltip formatter={(v) => formatAed(Number(v))} contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
              <Bar dataKey="revenue" fill="#f59e0b">
                {revByType.map((_, i) => <Cell key={i} fill={`hsl(${30 + i * 25}, 80%, 55%)`} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Expense breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="h-4 w-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-white">Maintenance</h3>
          </div>
          <p className="text-2xl font-bold text-orange-400">{formatAed(data.totals.maintenanceExpense)}</p>
          <p className="mt-1 text-xs text-slate-400">Total spent on maintenance tickets</p>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Violations</h3>
          </div>
          <p className="text-2xl font-bold text-red-400">{formatAed(data.totals.violationsIssued)}</p>
          <p className="mt-1 text-xs text-slate-400">
            Collected: {formatAed(data.totals.violationsPaid)} ({data.totals.violationsIssued > 0 ? Math.round((data.totals.violationsPaid / data.totals.violationsIssued) * 100) : 0}%)
          </p>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Invoices</h3>
          </div>
          <p className="text-2xl font-bold text-blue-400">{formatAed(data.totals.invoiced)}</p>
          <p className="mt-1 text-xs text-slate-400">
            Paid: {formatAed(data.totals.invoicePaid)} · Outstanding: {formatAed(data.totals.invoiceOutstanding)}
          </p>
        </section>
      </div>

      {/* Per-unit yield table */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-4 text-sm font-semibold text-white">Yield per Unit Type</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Units</th>
                <th className="px-3 py-2 text-right">Total Sq Ft</th>
                <th className="px-3 py-2 text-right">Total Revenue</th>
                <th className="px-3 py-2 text-right">Avg Rent</th>
                <th className="px-3 py-2 text-right">AED / Sq Ft</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.unitTypeBreakdown.map((t) => (
                <tr key={t.type} className="text-slate-300">
                  <td className="px-3 py-2 font-semibold text-white">{t.type}</td>
                  <td className="px-3 py-2 text-right">{t.count}</td>
                  <td className="px-3 py-2 text-right">{t.sqft > 0 ? t.sqft.toLocaleString() : "—"}</td>
                  <td className="px-3 py-2 text-right text-green-400">{formatAed(t.rent)}</td>
                  <td className="px-3 py-2 text-right">{formatAed(t.count > 0 ? t.rent / t.count : 0)}</td>
                  <td className="px-3 py-2 text-right text-amber-400">{t.sqft > 0 ? formatAed(t.rent / t.sqft) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
