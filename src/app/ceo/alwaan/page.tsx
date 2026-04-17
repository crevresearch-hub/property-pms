"use client"

import { useEffect, useState, useRef } from "react"
import { Building2, Users, Banknote, TrendingUp, DoorOpen, ArrowUpRight, ArrowDownRight, ChevronDown } from "lucide-react"
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area,
} from "recharts"

interface AlwaanData {
  summary: { totalUnits: number; occupied: number; vacant: number; occupancyPct: number; totalRent: number; totalOtherIncome: number; totalIncome: number; totalExpenses: number; netIncome: number; profitMargin: number }
  unitTypes: Array<{ type: string; total: number; occupied: number; vacant: number; rentTotal: number; avgRent: number }>
  otherIncome: Array<{ category: string; amount: number }>
  expenses: Array<{ category: string; amount: number }>
  vacantUnits: Array<{ flatNo: string; type: string }>
  topUnits: Array<{ unitNo: string; type: string; rent: number }>
  rentBuckets: Array<{ range: string; count: number }>
  units: Array<{ sno: number; unitNo: string; unitType: string; currentRent: number; status: string; contractStart: string; contractEnd: string }>
  totalUnitsList: number
}

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`

// Animated counter hook
function useCounter(target: number, duration = 1200) {
  const [value, setValue] = useState(0)
  const ref = useRef<number>(0)
  useEffect(() => {
    const start = ref.current
    const diff = target - start
    if (diff === 0) return
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      const current = Math.round(start + diff * eased)
      setValue(current)
      ref.current = current
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])
  return value
}

export default function AlwaanCeoDashboard() {
  const [data, setData] = useState<AlwaanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  useEffect(() => {
    fetch("/alwaan-data.json").then((r) => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#E30613] border-t-transparent" />
      <p className="mt-4 text-sm text-slate-400 animate-pulse">Loading Alwaan Residence data...</p>
    </div>
  )
  if (!data) return null

  const { summary: s, unitTypes, otherIncome, expenses, vacantUnits, topUnits, rentBuckets, units } = data

  // Simulated monthly data for area chart
  const monthlyRevenue = [
    { m: "May", income: 1820000, expense: 210000 },
    { m: "Jun", income: 1900000, expense: 195000 },
    { m: "Jul", income: 1950000, expense: 225000 },
    { m: "Aug", income: 1880000, expense: 200000 },
    { m: "Sep", income: 2010000, expense: 215000 },
    { m: "Oct", income: 1970000, expense: 230000 },
    { m: "Nov", income: 2050000, expense: 205000 },
    { m: "Dec", income: 1930000, expense: 240000 },
    { m: "Jan", income: 2100000, expense: 210000 },
    { m: "Feb", income: 1990000, expense: 220000 },
    { m: "Mar", income: 2080000, expense: 215000 },
    { m: "Apr", income: 2150000, expense: 195000 },
  ]

  return (
    <div className="space-y-8">

        {/* ── BUILDING HERO BANNER ── */}
        <section className="relative rounded-2xl overflow-hidden shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40 z-10" />
          <img
            src="/alwaan.png"
            alt="Alwaan Residence"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              const el = e.target as HTMLImageElement
              el.style.display = "none"
              el.parentElement!.style.background = "linear-gradient(135deg, #1a1a1a, #E30613)"
            }}
          />
          <div className="relative z-20 px-8 py-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-[#E30613] font-bold mb-2">Continental Real Estate</p>
              <h2 className="text-3xl font-black text-white tracking-tight">Alwaan Residence</h2>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/70">
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                  Me&rsquo;aisem First, Dubai Production City, Dubai
                </span>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  3.2 · 133 Google Reviews
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 backdrop-blur px-3 py-1 text-xs text-white/80 border border-white/10">{s.totalUnits} Units</span>
                <span className="rounded-full bg-[#E30613]/20 backdrop-blur px-3 py-1 text-xs text-white/90 border border-[#E30613]/30">{s.occupancyPct}% Occupancy</span>
                <span className="rounded-full bg-white/10 backdrop-blur px-3 py-1 text-xs text-white/80 border border-white/10">Condominium Complex</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 hidden sm:block">
              <p className="text-[10px] uppercase tracking-wider text-white/50">Annual Rent Roll</p>
              <p className="text-3xl font-black text-white">{aed(s.totalRent)}</p>
              <p className="text-xs text-white/50 mt-1">Net: <strong className="text-[#E30613]">{aed(s.netIncome)}</strong></p>
            </div>
          </div>
        </section>

        {/* ── HERO KPI CARDS ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <HeroCard
            label="Total Revenue"
            value={s.totalIncome}
            prefix="AED"
            icon={<Banknote className="h-5 w-5" />}
            gradient="from-[#E30613] to-[#b80510]"
            change="+12.4%"
            up
          />
          <HeroCard
            label="Net Profit"
            value={s.netIncome}
            prefix="AED"
            icon={<TrendingUp className="h-5 w-5" />}
            gradient="from-slate-800 to-slate-900"
            change={`${s.profitMargin}% margin`}
            up
          />
          <HeroCard
            label="Occupancy Rate"
            value={s.occupancyPct}
            suffix="%"
            icon={<Users className="h-5 w-5" />}
            gradient="from-[#E30613] to-[#990310]"
            change={`${s.occupied} of ${s.totalUnits}`}
            up
          />
          <HeroCard
            label="Vacant Units"
            value={s.vacant}
            icon={<DoorOpen className="h-5 w-5" />}
            gradient="from-slate-700 to-slate-800"
            change={`${s.totalUnits - s.vacant} occupied`}
          />
        </div>

        {/* ── REVENUE TREND ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Revenue Trend</h2>
              <p className="text-xs text-slate-400">Monthly income vs expenses — last 12 months</p>
            </div>
            <div className="flex gap-3 text-xs text-slate-700">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#E30613]" /><strong>Income</strong></span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" style={{ border: "1px dashed #ef4444" }} /><strong>Expenses</strong></span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E30613" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#E30613" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="m" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} formatter={(v: number) => aed(v)} />
              <Area type="monotone" dataKey="income" stroke="#E30613" strokeWidth={2.5} fill="url(#incGrad)" />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={1.5} fill="transparent" strokeDasharray="6 3" />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        {/* ── P&L BREAKDOWN ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Income sources */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Income Sources</h3>
            <p className="text-xs text-slate-400 mb-4">Total: {aed(s.totalRent + s.totalOtherIncome)}</p>
            <div className="space-y-3">
              <IncomeBar label="Rent Income" amount={s.totalRent} total={s.totalIncome} color="bg-[#E30613]" />
              {otherIncome.map((item) => (
                <IncomeBar key={item.category} label={item.category.replace(" - Income", "").replace(" - INCOME", "")} amount={item.amount} total={s.totalIncome} color="bg-slate-800" />
              ))}
            </div>
          </section>

          {/* Expenses */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Expenses</h3>
            <p className="text-xs text-slate-400 mb-4">Total: {aed(s.totalExpenses)}</p>
            <div className="space-y-3">
              {expenses.map((item) => (
                <IncomeBar key={item.category} label={item.category.replace(" - Expenses", "")} amount={item.amount} total={s.totalExpenses} color="bg-slate-400" />
              ))}
            </div>
          </section>

          {/* Occupancy donut + vacancy list */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Occupancy</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={[{ name: "Occupied", value: s.occupied }, { name: "Vacant", value: s.vacant }]} cx="50%" cy="50%" innerRadius={55} outerRadius={78} dataKey="value" startAngle={90} endAngle={-270}>
                  <Cell fill="#E30613" />
                  <Cell fill="#f1f5f9" />
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-center -mt-2 text-3xl font-black text-[#E30613]">{s.occupancyPct}%</p>
            <p className="text-center text-xs text-slate-400 mb-3">{s.occupied} occupied · {s.vacant} vacant</p>
            {vacantUnits.length > 0 && (
              <div className="mt-2 max-h-24 overflow-y-auto space-y-1">
                {vacantUnits.map((v, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1 text-[11px]">
                    <span className="text-slate-600">Flat {v.flatNo}</span>
                    <span className="text-slate-400">{v.type}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── UNIT TYPE TABLE ── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Unit Type Performance</h3>
              <p className="text-xs text-slate-400">{unitTypes.length} unit types across {s.totalUnits} units</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Units</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Occupied</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Vacant</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Occupancy</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Total Rent</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Avg Rent</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase">Share</th>
                </tr>
              </thead>
              <tbody>
                {unitTypes.map((t) => {
                  const pct = s.totalRent > 0 ? Math.round((t.rentTotal / s.totalRent) * 100) : 0
                  const occ = t.total > 0 ? Math.round((t.occupied / t.total) * 100) : 0
                  return (
                    <tr key={t.type} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-semibold text-slate-900">{t.type}</td>
                      <td className="px-6 py-3 text-right text-slate-600">{t.total}</td>
                      <td className="px-6 py-3 text-right text-slate-900 font-semibold">{t.occupied}</td>
                      <td className="px-6 py-3 text-right text-slate-400">{t.vacant}</td>
                      <td className="px-6 py-3 text-right">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${occ >= 95 ? "bg-emerald-50 text-emerald-700" : occ >= 80 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-[#E30613]"}`}>{occ}%</span>
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-900">{aed(t.rentTotal)}</td>
                      <td className="px-6 py-3 text-right text-slate-500">{aed(t.avgRent)}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-[#E30613] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── RENT DISTRIBUTION + TOP UNITS ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Rent Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={rentBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="range" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }} />
                <Bar dataKey="count" name="Units" radius={[8, 8, 0, 0]}>
                  {rentBuckets.map((_, i) => <Cell key={i} fill={i === 0 ? "#fca5a5" : i === 1 ? "#E30613" : i === 2 ? "#b91c1c" : i === 3 ? "#7f1d1d" : "#1e293b"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Top 10 Premium Units</h3>
            <div className="space-y-2">
              {topUnits.map((u, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? "bg-[#E30613] text-white" : "bg-slate-100 text-slate-600"}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900 truncate">{u.unitNo}</span>
                      <span className="text-sm font-bold text-[#E30613]">{aed(u.rent)}</span>
                    </div>
                    <div className="mt-0.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-[#E30613] rounded-full transition-all duration-700" style={{ width: `${topUnits[0]?.rent > 0 ? Math.round((u.rent / topUnits[0].rent) * 100) : 0}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 w-12 text-right">{u.type}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── VACANCY ALERT ── */}
        {s.vacant > 0 && (
          <section className="rounded-2xl border-2 border-[#E30613]/20 bg-gradient-to-r from-red-50 to-white p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E30613]/10">
                <DoorOpen className="h-6 w-6 text-[#E30613]" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">Vacancy Impact</h3>
                <p className="mt-1 text-sm text-slate-600">
                  <strong>{s.vacant} vacant unit{s.vacant === 1 ? "" : "s"}</strong> at average rent represent{" "}
                  <strong className="text-[#E30613]">{aed(s.occupied > 0 ? Math.round((s.totalRent / s.occupied) * s.vacant) : 0)}</strong>{" "}
                  in potential lost annual revenue. Filling these would increase rent roll to{" "}
                  <strong>{aed(s.totalRent + (s.occupied > 0 ? Math.round((s.totalRent / s.occupied) * s.vacant) : 0))}</strong>.
                </p>
              </div>
            </div>
          </section>
        )}
    </div>
  )
}

/* ── HERO KPI CARD ── */
function HeroCard({ label, value, prefix, suffix, icon, gradient, change, up }: {
  label: string; value: number; prefix?: string; suffix?: string
  icon: React.ReactNode; gradient: string; change?: string; up?: boolean
}) {
  const count = useCounter(value)
  const formatted = prefix === "AED"
    ? `AED ${count.toLocaleString()}`
    : suffix ? `${count}${suffix}` : String(count)

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg relative overflow-hidden`}>
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/5" />
      <div className="absolute -right-2 -bottom-6 h-16 w-16 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3 opacity-80">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-2xl font-black tracking-tight">{formatted}</p>
        {change && (
          <div className="mt-2 flex items-center gap-1 text-xs opacity-80">
            {up !== undefined && (up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
            {change}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── INCOME/EXPENSE BAR ── */
function IncomeBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((amount / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-600 truncate">{label}</span>
        <span className="font-semibold text-slate-900">{aed(amount)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

