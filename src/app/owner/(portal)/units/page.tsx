"use client"

import { useState, useMemo } from "react"
import { Search, Building2 } from "lucide-react"
import { useDashboard, formatAed, StatusPill, LoadingSpinner, ErrorBox, KpiCard, ExportCsvButton, LastUpdatedBadge, PrintButton } from "../_shared"

export default function OwnerUnitsPage() {
  const { data, loading, error, lastUpdated, refreshing, refresh } = useDashboard()
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortKey, setSortKey] = useState<"unitNo" | "annualRent" | "pending" | "rentPerSqft">("unitNo")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const filtered = useMemo(() => {
    if (!data) return []
    let result = data.units
    if (search.trim()) {
      const term = search.toLowerCase()
      result = result.filter((u) =>
        u.unitNo.toLowerCase().includes(term) ||
        u.tenant?.name?.toLowerCase().includes(term) ||
        u.unitType?.toLowerCase().includes(term)
      )
    }
    if (typeFilter !== "all") result = result.filter((u) => u.unitType === typeFilter)
    if (statusFilter !== "all") result = result.filter((u) => u.status === statusFilter)
    result = [...result].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey]
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), undefined, { numeric: true })
        : String(bv).localeCompare(String(av), undefined, { numeric: true })
    })
    return result
  }, [data, search, typeFilter, statusFilter, sortKey, sortDir])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  const types = Array.from(new Set(data.units.map((u) => u.unitType).filter(Boolean))).sort()
  const statuses = ["Occupied", "Vacant", "Under Maintenance", "Reserved"]

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Units</h2>
          <p className="text-sm text-slate-400">Detailed view of every unit in {data.owner.buildingName}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <LastUpdatedBadge lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={refresh} />
          <ExportCsvButton
            rows={filtered.map((u) => ({
              unitNo: u.unitNo, unitType: u.unitType, sqFt: u.sqFt, tenant: u.tenant?.name || "",
              nationality: u.tenant?.nationality || "", annualRent: u.annualRent, collected: u.collected,
              pending: u.pending, status: u.status, contractStart: u.contractStart, contractEnd: u.contractEnd,
            }))}
            filename="units"
            columns={[
              { key: "unitNo", label: "Unit" },
              { key: "unitType", label: "Type" },
              { key: "sqFt", label: "Sq Ft" },
              { key: "tenant", label: "Tenant" },
              { key: "nationality", label: "Nationality" },
              { key: "annualRent", label: "Annual Rent" },
              { key: "collected", label: "Collected" },
              { key: "pending", label: "Pending" },
              { key: "status", label: "Status" },
              { key: "contractStart", label: "Start" },
              { key: "contractEnd", label: "End" },
            ]}
          />
          <PrintButton />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Units" value={data.totals.units} icon={<Building2 className="h-5 w-5" />} accent="blue" />
        <KpiCard label="Occupied" value={`${data.totals.occupied}`} icon={<Building2 className="h-5 w-5" />} accent="green" />
        <KpiCard label="Vacant" value={`${data.totals.vacant}`} icon={<Building2 className="h-5 w-5" />} accent="red" />
        <KpiCard label="Avg Rent/SqFt" value={formatAed(data.totals.avgRentPerSqft)} icon={<Building2 className="h-5 w-5" />} accent="amber" />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search unit no, tenant, type..."
              className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder-slate-500 focus:border-amber-500/50"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTypeFilter("all")} className={`rounded-lg px-3 py-1 text-xs ${typeFilter === "all" ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" : "bg-white/5 text-slate-400 hover:text-white"}`}>
            All Types <span className="ml-1 text-[10px]">({data.units.length})</span>
          </button>
          {types.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`rounded-lg px-3 py-1 text-xs ${typeFilter === t ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" : "bg-white/5 text-slate-400 hover:text-white"}`}>
              {t} <span className="ml-1 text-[10px]">({data.units.filter((u) => u.unitType === t).length})</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setStatusFilter("all")} className={`rounded-lg px-3 py-1 text-xs ${statusFilter === "all" ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30" : "bg-white/5 text-slate-400 hover:text-white"}`}>
            All Status
          </button>
          {statuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-lg px-3 py-1 text-xs ${statusFilter === s ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30" : "bg-white/5 text-slate-400 hover:text-white"}`}>
              {s} <span className="ml-1 text-[10px]">({data.units.filter((u) => u.status === s).length})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Units table */}
      <section className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="mb-3 text-xs text-slate-400">Showing {filtered.length} of {data.units.length} units</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th onClick={() => toggleSort("unitNo")} className="px-3 py-2 cursor-pointer hover:text-white">
                  Unit {sortKey === "unitNo" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Sq Ft</th>
                <th className="px-3 py-2">Tenant</th>
                <th className="px-3 py-2">Nationality</th>
                <th className="px-3 py-2">Contract End</th>
                <th onClick={() => toggleSort("annualRent")} className="px-3 py-2 cursor-pointer hover:text-white text-right">
                  Annual Rent {sortKey === "annualRent" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th onClick={() => toggleSort("rentPerSqft")} className="px-3 py-2 cursor-pointer hover:text-white text-right">
                  AED/SqFt {sortKey === "rentPerSqft" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-3 py-2 text-right">Collected</th>
                <th onClick={() => toggleSort("pending")} className="px-3 py-2 cursor-pointer hover:text-white text-right">
                  Pending {sortKey === "pending" && (sortDir === "asc" ? "▲" : "▼")}
                </th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((u) => (
                <tr key={u.id} className="text-slate-300 hover:bg-white/5">
                  <td className="px-3 py-2 font-mono font-semibold text-white">{u.unitNo}</td>
                  <td className="px-3 py-2">{u.unitType || <span className="text-slate-600">—</span>}</td>
                  <td className="px-3 py-2 text-right">{u.sqFt > 0 ? u.sqFt.toLocaleString() : "—"}</td>
                  <td className="px-3 py-2">{u.tenant?.name || <span className="text-slate-600">Vacant</span>}</td>
                  <td className="px-3 py-2 text-slate-400">{u.tenant?.nationality || "—"}</td>
                  <td className="px-3 py-2">{u.contractEnd || "—"}</td>
                  <td className="px-3 py-2 text-right text-amber-400">{formatAed(u.annualRent)}</td>
                  <td className="px-3 py-2 text-right">{u.rentPerSqft > 0 ? formatAed(u.rentPerSqft) : "—"}</td>
                  <td className="px-3 py-2 text-right text-green-400">{formatAed(u.collected)}</td>
                  <td className="px-3 py-2 text-right text-red-400">{u.pending > 0 ? formatAed(u.pending) : "—"}</td>
                  <td className="px-3 py-2"><StatusPill value={u.status} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="px-3 py-8 text-center text-slate-500">No units match the current filter</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
