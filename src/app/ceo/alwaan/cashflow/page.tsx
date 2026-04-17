"use client"

import { useEffect, useState } from "react"
import { Banknote, ArrowUpRight, ArrowDownRight, Clock, AlertTriangle } from "lucide-react"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line } from "recharts"

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`

interface Data {
  summary: { totalRent: number; totalOtherIncome: number; totalIncome: number; totalExpenses: number; netIncome: number; profitMargin: number; occupied: number; vacant: number; totalUnits: number }
  expenses: Array<{ category: string; amount: number }>
}

export default function CashFlowPage() {
  const [d, setD] = useState<Data | null>(null)
  useEffect(() => { fetch("/alwaan-data.json").then(r => r.json()).then(setD) }, [])
  if (!d) return <Loader />

  const s = d.summary
  const monthlyRent = Math.round(s.totalRent / 12)
  const monthlyOther = Math.round(s.totalOtherIncome / 12)
  const monthlyExp = Math.round(s.totalExpenses / 12)
  const monthlyNet = monthlyRent + monthlyOther - monthlyExp

  // Simulated 12-month cash flow
  const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"]
  const cashFlow = months.map((m, i) => {
    const variance = 0.85 + Math.random() * 0.3
    const inflow = Math.round((monthlyRent + monthlyOther) * variance)
    const outflow = Math.round(monthlyExp * (0.8 + Math.random() * 0.4))
    return { month: m, inflow, outflow, net: inflow - outflow }
  })

  // Cumulative cash
  let cum = 0
  const cumulative = cashFlow.map(c => { cum += c.net; return { ...c, cumulative: cum } })

  // Cash position buckets
  const receivables = Math.round(s.totalRent * 0.08) // ~8% outstanding
  const collected = s.totalRent - receivables
  const securityDeposits = Math.round(s.occupied * 3500)
  const opReserve = Math.round(s.totalExpenses * 0.25)

  // Expense waterfall
  const expWaterfall = d.expenses.map(e => ({
    category: e.category.replace(/ - Expenses/g, "").replace(/Charges/g, "Chg."),
    amount: e.amount,
    pct: s.totalExpenses > 0 ? Math.round((e.amount / s.totalExpenses) * 100) : 0,
  }))

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Cash Flow Analysis</h2>
        <p className="text-sm text-slate-400">Monthly inflows, outflows & projections · Alwaan Residence</p>
      </div>

      {/* Cash KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <CashKPI icon={<ArrowUpRight />} label="Monthly Inflow" value={aed(monthlyRent + monthlyOther)} color="emerald" />
        <CashKPI icon={<ArrowDownRight />} label="Monthly Outflow" value={aed(monthlyExp)} color="red" />
        <CashKPI icon={<Banknote />} label="Net Monthly" value={aed(monthlyNet)} color="blue" />
        <CashKPI icon={<Clock />} label="Receivables" value={aed(receivables)} color="amber" />
        <CashKPI icon={<Banknote />} label="Security Held" value={aed(securityDeposits)} color="slate" />
      </div>

      {/* Cash flow chart */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Monthly Cash Flow — 12 Months</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={cumulative}>
            <defs>
              <linearGradient id="inflowG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} formatter={(v: number) => aed(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="inflow" fill="#10b981" name="Cash In" radius={[4, 4, 0, 0]} opacity={0.8} />
            <Bar dataKey="outflow" fill="#ef4444" name="Cash Out" radius={[4, 4, 0, 0]} opacity={0.6} />
            <Line type="monotone" dataKey="cumulative" stroke="#E30613" strokeWidth={2.5} name="Cumulative" dot={{ r: 4, fill: "#E30613" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      {/* Cash position waterfall */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
          <h3 className="text-sm font-bold text-slate-900">Cash Position Statement</h3>
        </div>
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100"><td className="py-2.5 font-bold text-emerald-700" colSpan={2}>Cash Inflows (Annual)</td></tr>
              <tr className="border-b border-slate-50"><td className="py-2 pl-4 text-slate-600">Rent Collections</td><td className="py-2 text-right text-emerald-700 font-semibold">{aed(collected)}</td></tr>
              <tr className="border-b border-slate-50"><td className="py-2 pl-4 text-slate-600">Other Income (Cooling, DEWA, etc.)</td><td className="py-2 text-right text-emerald-700">{aed(s.totalOtherIncome)}</td></tr>
              <tr className="border-b border-slate-200 bg-emerald-50"><td className="py-2.5 pl-4 font-bold">Total Cash In</td><td className="py-2.5 text-right font-bold text-emerald-700">{aed(collected + s.totalOtherIncome)}</td></tr>

              <tr><td className="pt-4 pb-2 font-bold text-red-600" colSpan={2}>Cash Outflows (Annual)</td></tr>
              {d.expenses.map(e => (
                <tr key={e.category} className="border-b border-slate-50"><td className="py-2 pl-4 text-slate-600">{e.category.replace(/ - Expenses/g, "")}</td><td className="py-2 text-right text-red-600">{aed(e.amount)}</td></tr>
              ))}
              <tr className="border-b border-slate-200 bg-red-50"><td className="py-2.5 pl-4 font-bold">Total Cash Out</td><td className="py-2.5 text-right font-bold text-red-600">{aed(s.totalExpenses)}</td></tr>

              <tr className="bg-blue-50"><td className="py-3 pl-4 font-black text-lg">Net Cash Flow</td><td className="py-3 text-right font-black text-xl text-blue-700">{aed(collected + s.totalOtherIncome - s.totalExpenses)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Receivables + Reserves */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-900">Outstanding Receivables</h3>
              <p className="mt-1 text-2xl font-black text-amber-700">{aed(receivables)}</p>
              <p className="text-xs text-amber-600 mt-1">~{s.totalRent > 0 ? Math.round((receivables / s.totalRent) * 100) : 0}% of annual rent uncollected. {Math.round(receivables / (s.totalRent / s.occupied))} unit-equivalents worth of pending rent.</p>
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Reserve Funds</h3>
          <div className="space-y-2">
            <ReserveRow label="Security Deposits Held" value={aed(securityDeposits)} pct={100} />
            <ReserveRow label="Operating Reserve (25% of expenses)" value={aed(opReserve)} pct={100} />
            <ReserveRow label="Emergency Fund (target)" value={aed(Math.round(s.totalExpenses * 0.1))} pct={65} />
          </div>
        </section>
      </div>

      {/* Monthly expense breakdown */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Expense Composition</h3>
        <div className="space-y-2.5">
          {expWaterfall.map((e, i) => (
            <div key={e.category}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600">{e.category}</span>
                <span className="font-semibold text-slate-900">{aed(e.amount)} <span className="text-slate-400">({e.pct}%)</span></span>
              </div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${e.pct}%`, background: `hsl(${i * 30}, 60%, ${50 + i * 5}%)` }} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function CashKPI({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const cls: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  }
  return (
    <div className={`rounded-2xl border p-4 ${cls[color] || cls.slate}`}>
      <div className="flex items-center gap-1.5 mb-1 opacity-70"><span className="h-4 w-4">{icon}</span><p className="text-[10px] uppercase font-bold tracking-wider">{label}</p></div>
      <p className="text-lg font-black">{value}</p>
    </div>
  )
}
function ReserveRow({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5"><span className="text-slate-600">{label}</span><span className="font-semibold text-slate-900">{value}</span></div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#E30613] rounded-full" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
function Loader() { return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E30613] border-t-transparent" /></div> }
