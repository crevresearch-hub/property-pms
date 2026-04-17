"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts"

const aed = (n: number) => `AED ${n.toLocaleString()}`

// Dummy market data for Trade Center Second / Dubai
const areaComps = [
  { area: "Trade Center 2", avgRent: 72000, yourRent: 78000 },
  { area: "DIFC", avgRent: 120000, yourRent: 0 },
  { area: "Business Bay", avgRent: 85000, yourRent: 0 },
  { area: "Downtown", avgRent: 110000, yourRent: 0 },
  { area: "JLT", avgRent: 55000, yourRent: 0 },
  { area: "Marina", avgRent: 95000, yourRent: 0 },
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

const demandTrend = [
  { month: "Jan", inquiries: 45, leased: 3 },
  { month: "Feb", inquiries: 52, leased: 4 },
  { month: "Mar", inquiries: 60, leased: 5 },
  { month: "Apr", inquiries: 48, leased: 3 },
  { month: "May", inquiries: 55, leased: 4 },
  { month: "Jun", inquiries: 42, leased: 2 },
  { month: "Jul", inquiries: 38, leased: 2 },
  { month: "Aug", inquiries: 35, leased: 1 },
  { month: "Sep", inquiries: 50, leased: 3 },
  { month: "Oct", inquiries: 58, leased: 4 },
  { month: "Nov", inquiries: 62, leased: 5 },
  { month: "Dec", inquiries: 40, leased: 2 },
]

const unitTypeRents = [
  { type: "Studio", market: 45000, yours: 48000, diff: "+7%" },
  { type: "1 BHK", market: 65000, yours: 72000, diff: "+11%" },
  { type: "2 BHK", market: 90000, yours: 88000, diff: "-2%" },
  { type: "3 BHK", market: 120000, yours: 115000, diff: "-4%" },
]

export default function MarketPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-[#E30613] font-bold">Alwaan Residence</p>
        <h2 className="text-2xl font-bold">Market Analysis</h2>
        <p className="text-sm text-white/40">Trade Center Second, Dubai · Q2 2026</p>
      </div>

      {/* Market summary pills */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Pill label="Market Avg Rent" value={aed(72000)} sub="Trade Center 2" />
        <Pill label="Your Avg Rent" value={aed(78000)} sub="+8% above market" accent />
        <Pill label="RERA Index" value="108" sub="↑ 3% YoY" />
        <Pill label="Vacancy Rate (area)" value="12%" sub="Dubai avg 8%" />
      </div>

      {/* Area comparison */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 text-xs font-bold uppercase text-white/40">Average Annual Rent by Area (1 BHK benchmark)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={areaComps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="area" tick={{ fill: "#666", fontSize: 10 }} />
            <YAxis tick={{ fill: "#666", fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: 8 }} formatter={(v) => aed(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="avgRent" fill="#333" name="Market Avg" radius={[4, 4, 0, 0]} />
            <Bar dataKey="yourRent" fill="#E30613" name="Your Building" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* RERA rental index trend */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 text-xs font-bold uppercase text-white/40">RERA Rental Index — Trade Center 2</h3>
        <p className="mb-3 text-xs text-white/40">Base year 2024 = 100. Current: 108 (↑8% since 2024). Per RERA Decree 43/2013 rent increase caps.</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={rentalIndex}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="year" tick={{ fill: "#666", fontSize: 10 }} />
            <YAxis domain={[70, 120]} tick={{ fill: "#666", fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: 8 }} />
            <Line type="monotone" dataKey="index" stroke="#E30613" strokeWidth={2.5} dot={{ r: 4, fill: "#E30613" }} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Demand trend */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="mb-3 text-xs font-bold uppercase text-white/40">Demand Trend (Monthly)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={demandTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="month" tick={{ fill: "#555", fontSize: 10 }} />
              <YAxis tick={{ fill: "#555", fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="inquiries" fill="#333" name="Inquiries" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leased" fill="#E30613" name="Leased" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* Your rent vs market by unit type */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="mb-3 text-xs font-bold uppercase text-white/40">Your Rent vs Market by Unit Type</h3>
          <div className="space-y-2">
            {unitTypeRents.map((u) => {
              const aboveMkt = u.yours >= u.market
              return (
                <div key={u.type} className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">{u.type}</span>
                    <span className={`text-xs font-bold ${aboveMkt ? "text-[#E30613]" : "text-white/50"}`}>{u.diff}</span>
                  </div>
                  <div className="flex justify-between text-xs text-white/40">
                    <span>Market: {aed(u.market)}</span>
                    <span>Yours: <strong className="text-white">{aed(u.yours)}</strong></span>
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

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-xs text-white/40">
        <p><strong className="text-white/60">Disclaimer:</strong> Market data is indicative and sourced from publicly available RERA / DLD statistics and CRE internal benchmarks. For official valuations, consult a certified RERA-approved valuator.</p>
      </section>
    </div>
  )
}

function Pill({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-[#E30613]/30 bg-[#E30613]/5" : "border-white/10 bg-white/5"}`}>
      <p className="text-[10px] uppercase font-bold text-white/40">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
      {sub && <p className="text-[10px] text-white/40">{sub}</p>}
    </div>
  )
}
