"use client"

import { useEffect, useState } from "react"
import { Banknote, TrendingUp, ArrowDown, ArrowUp } from "lucide-react"
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts"

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`
const COLORS = ["#E30613", "#333", "#666", "#999", "#ccc", "#fff"]

interface CashData {
  totals: { totalIncome: number; totalExpenses: number; netIncome: number; profitMargin: number }
  monthly: Array<{ month: string; income: number; expense: number; net: number; collectedCheques: number }>
  incomeCategories: Array<{ category: string; amount: number }>
  expenseCategories: Array<{ category: string; amount: number }>
  chequeBuckets: { pendingDueNext30: number; pendingDueNext90: number; overdue: number; bouncedUnreplaced: number; clearedYTD: number }
  invoiceTotals: { totalInvoiced: number; totalInvoicePaid: number; overdueInvoices: number }
}

export default function FinancialsPage() {
  const [data, setData] = useState<CashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/ceo/cashflow").then(async (r) => { if (r.ok) setData(await r.json()) }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E30613] border-t-transparent" /></div>
  if (!data) return <p className="text-white/50 text-sm">No financial data available.</p>

  const { totals, monthly, incomeCategories, expenseCategories, chequeBuckets } = data

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-[#E30613] font-bold">Alwaan Residence</p>
        <h2 className="text-2xl font-bold">Financial Report</h2>
      </div>

      {/* P&L summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Stat icon={<ArrowUp />} label="Total Income" value={aed(totals.totalIncome)} good />
        <Stat icon={<ArrowDown />} label="Total Expenses" value={aed(totals.totalExpenses)} bad />
        <Stat icon={<TrendingUp />} label="Net Income" value={aed(totals.netIncome)} good={totals.netIncome >= 0} bad={totals.netIncome < 0} />
        <Stat icon={<Banknote />} label="Profit Margin" value={`${totals.profitMargin}%`} good={totals.profitMargin > 30} />
      </div>

      {/* Monthly trend */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 text-xs font-bold uppercase text-white/40">12-Month Income vs Expense</h3>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="month" tick={{ fill: "#555", fontSize: 10 }} />
            <YAxis tick={{ fill: "#555", fontSize: 10 }} />
            <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: 8 }} formatter={(v) => aed(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="income" fill="#E30613" name="Income" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="#333" name="Expense" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="net" stroke="#fff" strokeWidth={2} name="Net" dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </section>

      {/* Category breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CatBreakdown title="Income by Category" data={incomeCategories} total={totals.totalIncome} />
        <CatBreakdown title="Expenses by Category" data={expenseCategories} total={totals.totalExpenses} />
      </div>

      {/* Cheque position */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 text-xs font-bold uppercase text-white/40">Cheque Cash Position</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Mini label="Cleared YTD" value={aed(chequeBuckets.clearedYTD)} />
          <Mini label="Due Next 30d" value={aed(chequeBuckets.pendingDueNext30)} />
          <Mini label="Due 31–90d" value={aed(chequeBuckets.pendingDueNext90)} />
          <Mini label="Overdue" value={aed(chequeBuckets.overdue)} warn />
          <Mini label="Bounced" value={aed(chequeBuckets.bouncedUnreplaced)} warn />
        </div>
      </section>

      {/* Monthly P&L table */}
      <section className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="border-b border-white/10 bg-white/5 px-5 py-3">
          <h3 className="text-sm font-bold">Monthly P&amp;L</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-white/40">
              <tr>
                <th className="px-3 py-2 text-left font-bold uppercase">Month</th>
                <th className="px-3 py-2 text-right font-bold uppercase">Income</th>
                <th className="px-3 py-2 text-right font-bold uppercase">Expense</th>
                <th className="px-3 py-2 text-right font-bold uppercase">Net</th>
                <th className="px-3 py-2 text-right font-bold uppercase">Margin</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m, i) => {
                const margin = m.income > 0 ? Math.round((m.net / m.income) * 100) : 0
                return (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2">{m.month}</td>
                    <td className="px-3 py-2 text-right text-[#E30613]">{aed(m.income)}</td>
                    <td className="px-3 py-2 text-right text-white/60">{aed(m.expense)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${m.net >= 0 ? "text-white" : "text-[#E30613]"}`}>{aed(m.net)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${margin >= 50 ? "bg-white/10 text-white" : margin >= 20 ? "bg-white/5 text-white/60" : "bg-[#E30613]/20 text-[#E30613]"}`}>{margin}%</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Stat({ icon, label, value, good, bad }: { icon: React.ReactNode; label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${bad ? "border-[#E30613]/30 bg-[#E30613]/5" : good ? "border-white/10 bg-white/5" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-center gap-2 text-white/40 mb-1"><span className="h-4 w-4">{icon}</span><p className="text-[10px] uppercase font-bold">{label}</p></div>
      <p className={`text-xl font-bold ${bad ? "text-[#E30613]" : "text-white"}`}>{value}</p>
    </div>
  )
}
function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? "border-[#E30613]/30 bg-[#E30613]/5" : "border-white/10 bg-white/5"}`}>
      <p className="text-[10px] uppercase text-white/30 font-bold">{label}</p>
      <p className={`text-sm font-bold ${warn ? "text-[#E30613]" : "text-white"}`}>{value}</p>
    </div>
  )
}
function CatBreakdown({ title, data, total }: { title: string; data: Array<{ category: string; amount: number }>; total: number }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-3 text-xs font-bold uppercase text-white/40">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart><Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="amount" nameKey="category">
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie><Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: 8 }} formatter={(v) => aed(Number(v))} /></PieChart>
        </ResponsiveContainer>
        <div className="space-y-1 text-xs">
          {data.map((c, i) => (
            <div key={c.category} className="flex items-center justify-between rounded bg-white/[0.03] px-2 py-1">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{c.category}</span>
              <span className="font-semibold">{aed(c.amount)} <span className="text-white/30 text-[10px]">{total > 0 ? Math.round((c.amount / total) * 100) : 0}%</span></span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
