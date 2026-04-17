"use client"

import { useEffect, useState } from "react"
import { ArrowUpRight, ArrowDownRight } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`
const COLORS = ["#E30613", "#1e293b", "#475569", "#94a3b8", "#cbd5e1", "#f1f5f9", "#fca5a5", "#333"]

interface Data {
  summary: { totalRent: number; totalOtherIncome: number; totalIncome: number; totalExpenses: number; netIncome: number; profitMargin: number; occupied: number; totalUnits: number }
  otherIncome: Array<{ category: string; amount: number }>
  expenses: Array<{ category: string; amount: number }>
  unitTypes: Array<{ type: string; rentTotal: number; occupied: number; avgRent: number }>
}

export default function PnlPage() {
  const [d, setD] = useState<Data | null>(null)
  useEffect(() => { fetch("/alwaan-data.json").then(r => r.json()).then(setD) }, [])
  if (!d) return <Loader />

  const s = d.summary
  const allIncome = [{ category: "Rent Income", amount: s.totalRent }, ...d.otherIncome]
  const grossProfit = s.totalIncome - s.totalExpenses
  const expenseRatio = s.totalIncome > 0 ? Math.round((s.totalExpenses / s.totalIncome) * 1000) / 10 : 0
  const rentPerUnit = s.occupied > 0 ? Math.round(s.totalRent / s.occupied) : 0
  const incomePerUnit = s.totalUnits > 0 ? Math.round(s.totalIncome / s.totalUnits) : 0
  const expensePerUnit = s.totalUnits > 0 ? Math.round(s.totalExpenses / s.totalUnits) : 0

  // Simulated quarterly comparison
  const quarterly = [
    { q: "Q1 2025", income: 5200000, expense: 580000 },
    { q: "Q2 2025", income: 5600000, expense: 620000 },
    { q: "Q3 2025", income: 5800000, expense: 650000 },
    { q: "Q4 2025", income: 6100000, expense: 700000 },
    { q: "Q1 2026", income: 6200000, expense: 640000 },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-black text-slate-900">Profit & Loss Analysis</h2>
        <p className="text-sm text-slate-400">Annual financial performance · Alwaan Residence</p>
      </div>

      {/* P&L Statement */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
          <h3 className="text-sm font-bold text-slate-900">Income Statement</h3>
        </div>
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100"><td className="py-2.5 font-bold text-slate-900 text-base" colSpan={2}>Revenue</td></tr>
              <tr className="border-b border-slate-50"><td className="py-2 pl-4 text-slate-600">Rent Income</td><td className="py-2 text-right font-semibold text-slate-900">{aed(s.totalRent)}</td></tr>
              {d.otherIncome.map(i => (
                <tr key={i.category} className="border-b border-slate-50"><td className="py-2 pl-4 text-slate-600">{i.category.replace(/ - Income| - INCOME/g, "")}</td><td className="py-2 text-right text-slate-700">{aed(i.amount)}</td></tr>
              ))}
              <tr className="border-b border-slate-200 bg-slate-50"><td className="py-2.5 pl-4 font-bold text-slate-900">Total Revenue</td><td className="py-2.5 text-right font-bold text-slate-900 text-base">{aed(s.totalIncome)}</td></tr>

              <tr><td className="pt-4 pb-2 font-bold text-slate-900 text-base" colSpan={2}>Operating Expenses</td></tr>
              {d.expenses.map(e => (
                <tr key={e.category} className="border-b border-slate-50"><td className="py-2 pl-4 text-slate-600">{e.category.replace(/ - Expenses/g, "")}</td><td className="py-2 text-right text-red-600">{aed(e.amount)}</td></tr>
              ))}
              <tr className="border-b border-slate-200 bg-red-50"><td className="py-2.5 pl-4 font-bold text-slate-900">Total Expenses</td><td className="py-2.5 text-right font-bold text-red-600 text-base">{aed(s.totalExpenses)}</td></tr>

              <tr className="bg-emerald-50"><td className="py-3 pl-4 font-black text-slate-900 text-lg">Net Operating Income</td><td className="py-3 text-right font-black text-emerald-700 text-xl">{aed(grossProfit)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* KPI metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Profit Margin" value={`${s.profitMargin}%`} sub="Net / Revenue" good />
        <MetricCard label="Expense Ratio" value={`${expenseRatio}%`} sub="Expenses / Revenue" />
        <MetricCard label="Avg Rent / Unit" value={aed(rentPerUnit)} sub="Occupied units only" />
        <MetricCard label="Expense / Unit" value={aed(expensePerUnit)} sub="All units" />
      </div>

      {/* Income vs Expense comparison */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Revenue Composition</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={allIncome} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="amount" nameKey="category">
                {allIncome.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }} formatter={(v: number) => aed(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={d.expenses} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis type="category" dataKey="category" width={170} tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }} formatter={(v: number) => aed(v)} />
              <Bar dataKey="amount" fill="#E30613" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      {/* Quarterly trend */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Quarterly Performance Trend</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={quarterly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="q" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }} formatter={(v: number) => aed(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="income" fill="#E30613" name="Revenue" radius={[6, 6, 0, 0]} />
            <Bar dataKey="expense" fill="#1e293b" name="Expenses" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Revenue by unit type */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Revenue by Unit Type</h3>
        <div className="space-y-3">
          {d.unitTypes.filter(t => t.rentTotal > 0).map((t, i) => {
            const pct = s.totalRent > 0 ? Math.round((t.rentTotal / s.totalRent) * 100) : 0
            return (
              <div key={t.type}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-700">{t.type} <span className="text-slate-400">({t.occupied} units · avg {aed(t.avgRent)})</span></span>
                  <span className="font-bold text-slate-900">{aed(t.rentTotal)} <span className="text-slate-400 text-xs">({pct}%)</span></span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#E30613] to-[#b80510] transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value, sub, good }: { label: string; value: string; sub: string; good?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className={`text-2xl font-black mt-1 ${good ? "text-emerald-600" : "text-slate-900"}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}
function Loader() { return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E30613] border-t-transparent" /></div> }
