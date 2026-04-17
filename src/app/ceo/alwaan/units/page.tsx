"use client"

import { useEffect, useState } from "react"
import { Building2, ChevronDown, Search } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis } from "recharts"

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`

interface Unit { sno: number; unitNo: string; unitType: string; currentRent: number; status: string; contractStart: string; contractEnd: string }
interface UnitType { type: string; total: number; occupied: number; vacant: number; rentTotal: number; avgRent: number }
interface Vacant { flatNo: string; type: string }
interface Data {
  summary: { totalUnits: number; occupied: number; vacant: number; occupancyPct: number; totalRent: number }
  unitTypes: UnitType[]
  vacantUnits: Vacant[]
  rentBuckets: Array<{ range: string; count: number }>
  units: Unit[]
  totalUnitsList: number
}

const PIE = ["#E30613", "#1e293b", "#475569", "#94a3b8", "#cbd5e1", "#fca5a5"]

export default function UnitsPage() {
  const [d, setD] = useState<Data | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  useEffect(() => { fetch("/alwaan-data.json").then(r => r.json()).then(setD) }, [])
  if (!d) return <Loader />

  const filtered = d.units.filter(u => {
    if (typeFilter !== "all" && u.unitType !== typeFilter) return false
    if (statusFilter !== "all" && u.status !== statusFilter) return false
    if (search && !u.unitNo.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const unitTypePie = d.unitTypes.map(t => ({ name: t.type, value: t.total }))
  const rentByType = d.unitTypes.filter(t => t.avgRent > 0).map(t => ({ type: t.type, avg: t.avgRent, max: Math.round(t.avgRent * 1.3), min: Math.round(t.avgRent * 0.7) }))

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Unit Analysis</h2>
        <p className="text-sm text-slate-400">{d.totalUnitsList} total units · {d.summary.occupied} occupied · {d.summary.vacant} vacant</p>
      </div>

      {/* Unit mix + Rent distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Unit Mix</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={unitTypePie} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {unitTypePie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Average Rent by Unit Type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rentByType}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="type" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }} formatter={(v: number) => aed(v)} />
              <Bar dataKey="avg" fill="#E30613" name="Average Rent" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      {/* Rent distribution */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Rent Distribution (number of units per bracket)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={d.rentBuckets}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="range" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }} />
            <Bar dataKey="count" name="Units" radius={[8, 8, 0, 0]}>
              {d.rentBuckets.map((_, i) => <Cell key={i} fill={["#fca5a5", "#E30613", "#b91c1c", "#7f1d1d", "#1e293b"][i] || "#333"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Unit type performance table */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
          <h3 className="text-sm font-bold text-slate-900">Performance by Unit Type</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Type</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Total</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Occupied</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Vacant</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Occ%</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Avg Rent</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Share</th>
              </tr>
            </thead>
            <tbody>
              {d.unitTypes.map(t => {
                const occ = t.total > 0 ? Math.round((t.occupied / t.total) * 100) : 0
                const share = d.summary.totalRent > 0 ? Math.round((t.rentTotal / d.summary.totalRent) * 100) : 0
                return (
                  <tr key={t.type} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-6 py-3 font-semibold text-slate-900">{t.type}</td>
                    <td className="px-6 py-3 text-right">{t.total}</td>
                    <td className="px-6 py-3 text-right font-semibold">{t.occupied}</td>
                    <td className="px-6 py-3 text-right text-slate-400">{t.vacant}</td>
                    <td className="px-6 py-3 text-right"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${occ >= 95 ? "bg-emerald-50 text-emerald-700" : occ >= 80 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{occ}%</span></td>
                    <td className="px-6 py-3 text-right font-semibold">{aed(t.rentTotal)}</td>
                    <td className="px-6 py-3 text-right text-slate-500">{aed(t.avgRent)}</td>
                    <td className="px-6 py-3 text-right"><div className="inline-flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#E30613] rounded-full" style={{ width: `${share}%` }} /></div><span className="text-xs text-slate-500 w-8 text-right">{share}%</span></div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Vacant units */}
      {d.vacantUnits.length > 0 && (
        <section className="rounded-2xl border-2 border-[#E30613]/20 bg-red-50 p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3">{d.vacantUnits.length} Vacant Units — Revenue Opportunity</h3>
          <div className="flex flex-wrap gap-2">
            {d.vacantUnits.map((v, i) => (
              <span key={i} className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs text-slate-700">Flat {v.flatNo} <span className="text-slate-400">({v.type})</span></span>
            ))}
          </div>
        </section>
      )}

      {/* Full unit register */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900">Unit Register ({filtered.length} of {d.totalUnitsList})</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search unit" className="rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#E30613] w-36" />
            </div>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none">
              <option value="all">All types</option>
              {d.unitTypes.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none">
              <option value="all">All status</option>
              <option value="Occupied">Occupied</option>
              <option value="Vacant">Vacant</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left font-semibold uppercase">#</th>
                <th className="px-4 py-2 text-left font-semibold uppercase">Unit</th>
                <th className="px-4 py-2 text-left font-semibold uppercase">Type</th>
                <th className="px-4 py-2 text-left font-semibold uppercase">Status</th>
                <th className="px-4 py-2 text-left font-semibold uppercase">Start</th>
                <th className="px-4 py-2 text-left font-semibold uppercase">End</th>
                <th className="px-4 py-2 text-right font-semibold uppercase">Rent</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.sno} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-2 text-slate-400">{u.sno}</td>
                  <td className="px-4 py-2 font-semibold text-slate-900">{u.unitNo}</td>
                  <td className="px-4 py-2 text-slate-500">{u.unitType}</td>
                  <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${u.status === "Occupied" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{u.status}</span></td>
                  <td className="px-4 py-2 text-slate-400">{u.contractStart || "—"}</td>
                  <td className="px-4 py-2 text-slate-400">{u.contractEnd || "—"}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-900">{aed(u.currentRent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Loader() { return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E30613] border-t-transparent" /></div> }
