"use client"

import { useState, useMemo } from "react"
import { Banknote, Search } from "lucide-react"
import { useDashboard, formatAed, StatusPill, LoadingSpinner, ErrorBox, KpiCard } from "../_shared"

export default function OwnerChequesPage() {
  const { data, loading, error } = useDashboard()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filtered = useMemo(() => {
    if (!data) return []
    let result = data.cheques
    if (search.trim()) {
      const term = search.toLowerCase()
      result = result.filter((c) =>
        c.chequeNo?.toLowerCase().includes(term) ||
        c.bankName?.toLowerCase().includes(term) ||
        c.tenantName?.toLowerCase().includes(term) ||
        c.unitNo?.toLowerCase().includes(term)
      )
    }
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter)
    return result
  }, [data, search, statusFilter])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  const statuses = ["Received", "Pending", "Deposited", "Cleared", "Bounced", "Replaced"]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Cheques</h2>
        <p className="text-sm text-slate-400">All cheques received and their status</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Cheques" value={data.chequeBuckets.total} icon={<Banknote className="h-5 w-5" />} accent="blue" />
        <KpiCard label="Cleared" value={formatAed(data.chequeBuckets.cleared)} icon={<Banknote className="h-5 w-5" />} accent="green" />
        <KpiCard label="Pending" value={formatAed(data.chequeBuckets.pendingAll)} icon={<Banknote className="h-5 w-5" />} accent="amber" />
        <KpiCard label="Bounced" value={formatAed(data.chequeBuckets.bounced)} icon={<Banknote className="h-5 w-5" />} accent="red" />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by cheque no, bank, tenant, unit..."
            className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder-slate-500 focus:border-amber-500/50"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setStatusFilter("all")} className={`rounded-lg px-3 py-1 text-xs ${statusFilter === "all" ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" : "bg-white/5 text-slate-400 hover:text-white"}`}>
            All <span className="ml-1 text-[10px]">({data.cheques.length})</span>
          </button>
          {statuses.map((s) => {
            const count = data.cheques.filter((c) => c.status === s).length
            return (
              <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-lg px-3 py-1 text-xs ${statusFilter === s ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" : "bg-white/5 text-slate-400 hover:text-white"}`}>
                {s} <span className="ml-1 text-[10px]">({count})</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="mb-3 text-xs text-slate-400">Showing {filtered.length} of {data.cheques.length}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Cheque No</th>
                <th className="px-3 py-2">Bank</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Tenant</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Cleared On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((c) => (
                <tr key={c.id} className="text-slate-300 hover:bg-white/5">
                  <td className="px-3 py-2 font-mono">{c.chequeDate}</td>
                  <td className="px-3 py-2 font-mono">{c.chequeNo}</td>
                  <td className="px-3 py-2">{c.bankName}</td>
                  <td className="px-3 py-2 font-mono">{c.unitNo}</td>
                  <td className="px-3 py-2">{c.tenantName}</td>
                  <td className="px-3 py-2 text-right font-semibold text-amber-400">{formatAed(c.amount)}</td>
                  <td className="px-3 py-2"><StatusPill value={c.status} /></td>
                  <td className="px-3 py-2 text-slate-500">{c.clearedDate || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No cheques match — upload cheques via Import Cheques (Excel)</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
