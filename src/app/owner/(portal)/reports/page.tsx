"use client"

import { FileText, Download, TrendingUp, Banknote, Calendar } from "lucide-react"
import { useDashboard, formatAed, LoadingSpinner, ErrorBox } from "../_shared"

export default function OwnerReportsPage() {
  const { data, loading, error } = useDashboard()
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  const rentRoll = data.units.map((u) => ({
    unit: u.unitNo,
    type: u.unitType,
    tenant: u.tenant?.name || "Vacant",
    nationality: u.tenant?.nationality || "",
    rent: u.annualRent,
    collected: u.collected,
    pending: u.pending,
    status: u.status,
    start: u.contractStart,
    end: u.contractEnd,
  }))

  const exportRentRollCsv = () => {
    const headers = ["Unit", "Type", "Tenant", "Nationality", "Annual Rent", "Collected", "Pending", "Status", "Start", "End"]
    const rows = rentRoll.map((r) => [r.unit, r.type, r.tenant, r.nationality, r.rent, r.collected, r.pending, r.status, r.start, r.end])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rent-roll-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportChequesCsv = () => {
    const headers = ["Date", "Cheque No", "Bank", "Unit", "Tenant", "Amount", "Status", "Cleared On"]
    const rows = data.cheques.map((c) => [c.chequeDate, c.chequeNo, c.bankName, c.unitNo, c.tenantName, c.amount, c.status, c.clearedDate])
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `cheques-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Reports</h2>
        <p className="text-sm text-slate-400">Download your building&apos;s data in Excel-friendly format</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/30 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-500/20 p-2">
              <TrendingUp className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">Rent Roll</h3>
              <p className="mt-1 text-xs text-slate-400">
                All {data.units.length} units with tenants, rents, collections, and contract dates.
              </p>
              <button
                onClick={exportRentRollCsv}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                <Download className="h-3.5 w-3.5" /> Download CSV
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-green-500/20 p-2">
              <Banknote className="h-5 w-5 text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">Cheques Ledger</h3>
              <p className="mt-1 text-xs text-slate-400">
                All {data.chequeBuckets.total} cheques with amount, date, bank, status.
              </p>
              <button
                onClick={exportChequesCsv}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
              >
                <Download className="h-3.5 w-3.5" /> Download CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary card */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Annual Summary</h3>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-white/5">
            <tr><td className="py-2 text-slate-300">Total Units</td><td className="py-2 text-right font-mono text-white">{data.totals.units}</td></tr>
            <tr><td className="py-2 text-slate-300">Occupied / Vacant</td><td className="py-2 text-right font-mono text-white">{data.totals.occupied} / {data.totals.vacant}</td></tr>
            <tr><td className="py-2 text-slate-300">Occupancy Rate</td><td className="py-2 text-right font-mono text-green-400">{data.totals.occupancyPct}%</td></tr>
            <tr><td className="py-2 text-slate-300">Annual Rent Roll</td><td className="py-2 text-right font-mono text-amber-400">{formatAed(data.totals.annualRentRoll)}</td></tr>
            <tr><td className="py-2 text-slate-300">Collected</td><td className="py-2 text-right font-mono text-green-400">{formatAed(data.totals.collected)}</td></tr>
            <tr><td className="py-2 text-slate-300">Pending</td><td className="py-2 text-right font-mono text-red-400">{formatAed(data.totals.pending)}</td></tr>
            <tr><td className="py-2 text-slate-300">Cleared Cheques</td><td className="py-2 text-right font-mono text-green-400">{formatAed(data.chequeBuckets.cleared)}</td></tr>
            <tr><td className="py-2 text-slate-300">Maintenance Expense</td><td className="py-2 text-right font-mono text-orange-400">{formatAed(data.totals.maintenanceExpense)}</td></tr>
            <tr><td className="py-2 text-slate-300">Net Operating Income</td><td className="py-2 text-right font-mono font-bold text-amber-400">{formatAed(data.totals.netOperatingIncome)}</td></tr>
            <tr><td className="py-2 text-slate-300">Profit Margin</td><td className="py-2 text-right font-mono text-white">{data.totals.profitMargin.toFixed(1)}%</td></tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4">
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200">
            <strong>PDF statements coming soon.</strong> For now, open the CSV files in Excel or Google Sheets. You can also print any of the Dashboard/Financials/Cashflow pages via your browser&apos;s print function.
          </p>
        </div>
      </section>
    </div>
  )
}
