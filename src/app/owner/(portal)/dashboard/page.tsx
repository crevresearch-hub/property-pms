"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Users, Banknote, Clock, DoorOpen, ChevronRight } from "lucide-react"
import { PieChart, Pie, Cell, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface OwnerData {
  owner: { name: string; buildingName: string; area: string; serviceType: string }
  totals: { totalUnits: number; occupied: number; vacant: number; annualRentRoll: number; collected: number; pending: number }
  units: Array<{ id: string; unitNo: string; unitType: string; status: string; contractEnd: string; annualRent: number; totalCollected: number; pending: number; tenant: { name: string; email: string; status: string } | null; contract: { contractNo: string; contractEnd: string } | null }>
}

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`
const PIE = ["#E30613", "#333"]

export default function OwnerDashPage() {
  const router = useRouter()
  const [data, setData] = useState<OwnerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/owner/dashboard")
      .then(async (r) => { if (r.status === 401) { router.replace("/owner/login"); return }; const d = await r.json(); if (r.ok) setData(d) })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <Loader />
  if (!data) return null

  const { totals, units } = data
  const occPct = totals.totalUnits > 0 ? Math.round((totals.occupied / totals.totalUnits) * 100) : 0
  const colPct = totals.annualRentRoll > 0 ? Math.round((totals.collected / totals.annualRentRoll) * 100) : 0
  const occData = [{ name: "Occupied", value: totals.occupied }, { name: "Vacant", value: totals.vacant }]
  const rentData = units.filter((u) => u.annualRent > 0).sort((a, b) => b.annualRent - a.annualRent).map((u) => ({ name: u.unitNo, rent: u.annualRent, collected: u.totalCollected }))

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-[#E30613]/30 bg-[#E30613]/5 p-6 flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[#E30613] font-bold">Alwaan Residence</p>
          <h2 className="mt-1 text-2xl font-bold">Overview Dashboard</h2>
          <p className="text-sm text-white/40">{data.owner.area} · {data.owner.serviceType}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-white/40">Annual Rent Roll</p>
          <p className="text-3xl font-bold text-[#E30613]">{aed(totals.annualRentRoll)}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Kpi label="Total Units" value={String(totals.totalUnits)} />
        <Kpi label="Occupied" value={String(totals.occupied)} accent />
        <Kpi label="Vacant" value={String(totals.vacant)} />
        <Kpi label="Collected" value={aed(totals.collected)} sub={`${colPct}%`} />
        <Kpi label="Pending" value={aed(totals.pending)} warning={totals.pending > 0} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="mb-2 text-xs font-bold uppercase text-white/40">Occupancy</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={occData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value">
                {occData.map((_, i) => <Cell key={i} fill={PIE[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-center text-2xl font-bold text-[#E30613]">{occPct}%</p>
        </div>
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="mb-2 text-xs font-bold uppercase text-white/40">Rent vs Collected per Unit</h3>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={rentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 10 }} />
              <YAxis tick={{ fill: "#555", fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: 8 }} formatter={(v: number) => aed(v)} />
              <Bar dataKey="rent" fill="#E30613" name="Annual Rent" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="collected" stroke="#fff" strokeWidth={2} name="Collected" dot={{ r: 3, fill: "#fff" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Units */}
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="border-b border-white/10 bg-white/5 px-5 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold">All Units ({units.length})</h3>
          <div className="flex gap-2 text-[10px]">
            <span className="rounded-full bg-[#E30613]/20 text-[#E30613] px-2 py-0.5 font-semibold">{totals.occupied} Occupied</span>
            <span className="rounded-full bg-white/10 text-white/50 px-2 py-0.5 font-semibold">{totals.vacant} Vacant</span>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {units.map((u) => (
            <div key={u.id} onClick={() => setExpanded(expanded === u.id ? null : u.id)} className="cursor-pointer hover:bg-white/[0.03]">
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${u.status === "Occupied" ? "bg-[#E30613]" : "bg-white/20"}`} />
                  <div>
                    <p className="text-sm font-semibold">Unit {u.unitNo} <span className="text-white/30 text-xs">{u.unitType}</span></p>
                    <p className="text-xs text-white/30">{u.tenant?.name || "Vacant"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right text-xs">
                  <div><p className="font-bold">{aed(u.annualRent)}</p><p className="text-white/30">rent</p></div>
                  <div><p className="text-[#E30613] font-semibold">{aed(u.totalCollected)}</p><p className="text-white/30">collected</p></div>
                  <div><p className={u.pending > 0 ? "font-semibold" : "text-white/30"}>{aed(u.pending)}</p><p className="text-white/30">pending</p></div>
                  <ChevronRight className={`h-4 w-4 text-white/20 transition-transform ${expanded === u.id ? "rotate-90" : ""}`} />
                </div>
              </div>
              {expanded === u.id && u.tenant && (
                <div className="border-t border-white/5 bg-white/[0.02] px-5 py-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div><p className="text-white/30">Tenant</p><p>{u.tenant.name}</p></div>
                  <div><p className="text-white/30">Email</p><p>{u.tenant.email}</p></div>
                  <div><p className="text-white/30">Contract</p><p>{u.contract?.contractNo || "—"}</p></div>
                  <div><p className="text-white/30">Ends</p><p>{u.contract?.contractEnd || u.contractEnd || "—"}</p></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Vacancy alert */}
      {totals.vacant > 0 && (
        <div className="rounded-2xl border border-[#E30613]/30 bg-[#E30613]/5 p-5 flex items-start gap-3">
          <DoorOpen className="h-5 w-5 text-[#E30613] mt-0.5" />
          <div>
            <p className="text-sm font-bold">{totals.vacant} Vacant Unit{totals.vacant === 1 ? "" : "s"}</p>
            <p className="text-xs text-white/50">Potential lost revenue: <strong className="text-[#E30613]">{aed(totals.occupied > 0 ? Math.round((totals.annualRentRoll / totals.occupied) * totals.vacant) : 0)}</strong> annually.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, sub, accent, warning }: { label: string; value: string; sub?: string; accent?: boolean; warning?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warning ? "border-[#E30613]/40 bg-[#E30613]/10" : accent ? "border-[#E30613]/20 bg-[#E30613]/5" : "border-white/10 bg-white/5"}`}>
      <p className="text-[10px] uppercase font-bold text-white/40">{label}</p>
      <p className={`text-lg font-bold ${warning ? "text-[#E30613]" : "text-white"}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/30">{sub}</p>}
    </div>
  )
}
function Loader() { return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E30613] border-t-transparent" /></div> }
