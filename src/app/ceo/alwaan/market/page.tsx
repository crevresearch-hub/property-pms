"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts"

const aed = (n: number) => `AED ${n.toLocaleString()}`

// Market data for Dubai Production City (IMPZ) and nearby areas
const areaComps = [
  { area: "Dubai Production City", avgRent: 38000, yourRent: 42000 },
  { area: "Motor City", avgRent: 45000, yourRent: 0 },
  { area: "Dubai Sports City", avgRent: 40000, yourRent: 0 },
  { area: "JVC", avgRent: 48000, yourRent: 0 },
  { area: "Dubai Silicon Oasis", avgRent: 42000, yourRent: 0 },
  { area: "International City", avgRent: 28000, yourRent: 0 },
]

const rentalIndex = [
  { year: "2019", index: 82 },
  { year: "2020", index: 78 },
  { year: "2021", index: 80 },
  { year: "2022", index: 88 },
  { year: "2023", index: 95 },
  { year: "2024", index: 100 },
  { year: "2025", index: 105 },
  { year: "2026", index: 108 },
]


const unitTypeRents = [
  { type: "Studio", market: 28000, yours: 33600, diff: "+20%" },
  { type: "1 BHK", market: 38000, yours: 41920, diff: "+10%" },
  { type: "1 BR", market: 55000, yours: 70000, diff: "+27%" },
  { type: "SHOP", market: 180000, yours: 208000, diff: "+16%" },
]

export default function MarketPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-[#E30613] font-bold">Alwaan Residence</p>
        <h2 className="text-2xl font-bold">Market Analysis</h2>
        <p className="text-sm text-slate-400">Me'aisem First, Dubai Production City · Q2 2026</p>
      </div>

      {/* Market summary pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Pill label="Market Avg Rent" value={aed(38000)} sub="Dubai Production City (1 BHK)" />
        <Pill label="Your Avg Rent" value={aed(42000)} sub="+11% above market" accent />
        <Pill label="RERA Index" value="102" sub="↑ 2% YoY" />
        <Pill label="Vacancy Rate (area)" value="7%" sub="Dubai avg 8%" />
      </div>

      {/* Area comparison */}
      <section className="rounded-2xl border border-slate-200 bg-white border-slate-200 shadow-sm p-5">
        <h3 className="mb-3 text-xs font-bold uppercase text-slate-400">Average Annual Rent by Area (1 BHK benchmark)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={areaComps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="area" tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }} formatter={(v) => aed(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="avgRent" fill="#333" name="Market Avg" radius={[4, 4, 0, 0]} />
            <Bar dataKey="yourRent" fill="#E30613" name="Your Building" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* RERA rental index trend */}
      <section className="rounded-2xl border border-slate-200 bg-white border-slate-200 shadow-sm p-5">
        <h3 className="mb-3 text-xs font-bold uppercase text-slate-400">RERA Rental Index — Dubai Production City</h3>
        <p className="mb-3 text-xs text-slate-400">Base year 2024 = 100. Current: 108 (↑8% since 2024). Per RERA Decree 43/2013 rent increase caps.</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={rentalIndex}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis domain={[70, 120]} tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }} />
            <Line type="monotone" dataKey="index" stroke="#E30613" strokeWidth={2.5} dot={{ r: 4, fill: "#E30613" }} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <div className="grid grid-cols-1 gap-6">
        {/* Your rent vs market by unit type */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
          <h3 className="mb-3 text-xs font-bold uppercase text-slate-400">Your Rent vs Market by Unit Type</h3>
          <div className="space-y-2">
            {unitTypeRents.map((u) => {
              const aboveMkt = u.yours >= u.market
              return (
                <div key={u.type} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-bold text-slate-900">{u.type}</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${aboveMkt ? "bg-[#E30613]/10 text-[#E30613]" : "bg-slate-100 text-slate-500"}`}>{u.diff}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Market: {aed(u.market)}</span>
                    <span>Yours: <strong className="text-slate-900">{aed(u.yours)}</strong></span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-[#E30613]" style={{ width: `${Math.min(100, Math.round((u.yours / u.market) * 100))}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white border-slate-200 shadow-sm p-5 text-xs text-slate-400">
        <p><strong className="text-white/60">Disclaimer:</strong> Market data is indicative and sourced from publicly available RERA / DLD statistics and Alwaan internal benchmarks. For official valuations, consult a certified RERA-approved valuator.</p>
      </section>
    </div>
  )
}

function Pill({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-[#E30613]/30 bg-[#E30613]/5" : "border-slate-200 bg-white border-slate-200 shadow-sm"}`}>
      <p className="text-[10px] uppercase font-bold text-slate-400">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}
