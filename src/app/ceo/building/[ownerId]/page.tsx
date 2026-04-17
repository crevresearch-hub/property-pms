"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { ArrowLeft, Building2, Banknote, Users, DoorOpen, MessageSquareWarning, ShieldAlert, Wrench } from "lucide-react"
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"

interface BuildingDetail {
  owner: { id: string; ownerName: string; email: string; phone: string; buildingName: string; area: string; emirate: string; plotNo: string; makaniNo: string; totalUnits: number; totalFloors: number; serviceType: string }
  totals: { units: number; occupied: number; vacant: number; occupancyPct: number; annualRentRoll: number; collected: number; pending: number; invoiced: number; invoicePaid: number; invoiceOutstanding: number }
  chequeBuckets: { pendingAll: number; dueNext30: number; overdue: number; cleared: number; bounced: number }
  cashflowProjection: Array<{ month: string; expected: number; cleared: number }>
  units: Array<{ id: string; unitNo: string; unitType: string; status: string; contractEnd: string; annualRent: number; collected: number; pending: number; tenant: { id: string; name: string; email: string; phone: string; status: string } | null; contractNo: string | null; contractStatus: string | null }>
  cheques: Array<{ id: string; chequeNo: string; bankName: string; amount: number; chequeDate: string; clearedDate: string; status: string; tenantName: string; unitNo: string }>
  invoices: Array<{ id: string; invoiceNo: string; type: string; totalAmount: number; paidAmount: number; status: string; dueDate: string; tenantName: string; unitNo: string }>
  complaints: Array<{ id: string; complaintNo: string; subject: string; status: string; createdAt: string }>
  violations: Array<{ id: string; violationNo: string; type: string; severity: string; fineAmount: number; status: string; createdAt: string }>
  tickets: Array<{ id: string; ticketNo: string; title: string; priority: string; status: string; submittedAt: string }>
  vacancyCost: number
  topContributors: Array<{ unitNo: string; tenantName: string; annualRent: number }>
  maintenanceCost: number
  violationsRollup: { totalIssued: number; paid: number }
}

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`
const fmt = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"

export default function BuildingDetailPage({ params }: { params: Promise<{ ownerId: string }> }) {
  const { ownerId } = use(params)
  const [data, setData] = useState<BuildingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/ceo/building/${ownerId}`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Failed")
        setData(d)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false))
  }, [ownerId])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E30613] border-t-transparent" /></div>
  if (error) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-red-400 text-sm">{error}</div>
  if (!data) return null

  const { owner, totals, chequeBuckets, cashflowProjection, units, cheques, invoices, complaints, violations, tickets, vacancyCost, topContributors, maintenanceCost, violationsRollup } = data
  const collectedPct = totals.annualRentRoll > 0 ? Math.round((totals.collected / totals.annualRentRoll) * 100) : 0
  // Net P&L for this building: collected rent + invoices paid + violation fines collected - maintenance costs
  const buildingIncome = totals.collected + totals.invoicePaid + violationsRollup.paid
  const buildingExpenses = maintenanceCost
  const buildingNet = buildingIncome - buildingExpenses
  const buildingMargin = buildingIncome > 0 ? Math.round((buildingNet / buildingIncome) * 1000) / 10 : 0

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="border-b border-white/10 bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/ceo/dashboard" className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">Building Detail</p>
              <h1 className="text-lg font-bold text-white">{owner.buildingName}</h1>
              <p className="text-xs text-slate-400">{owner.ownerName} · {owner.area || "—"}, {owner.emirate} · {owner.serviceType}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        {/* Owner card */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase text-slate-400">Owner / Building Info</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-5">
            <Field label="Owner" value={owner.ownerName} />
            <Field label="Email" value={owner.email} />
            <Field label="Phone" value={owner.phone || "—"} />
            <Field label="Plot No." value={owner.plotNo || "—"} />
            <Field label="Makani No." value={owner.makaniNo || "—"} />
            <Field label="Total Floors" value={String(owner.totalFloors || "—")} />
            <Field label="Total Units (registered)" value={String(owner.totalUnits || totals.units)} />
            <Field label="Service Type" value={owner.serviceType} />
          </div>
        </section>

        {/* Hero KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Hero icon={<Building2 className="h-5 w-5" />} label="Units" value={String(totals.units)} hint={`${totals.occupied} occ · ${totals.vacant} vac · ${totals.occupancyPct}%`} color="blue" />
          <Hero icon={<Banknote className="h-5 w-5" />} label="Annual Rent Roll" value={aed(totals.annualRentRoll)} color="amber" />
          <Hero icon={<Users className="h-5 w-5" />} label="Collected" value={aed(totals.collected)} hint={`${collectedPct}% of rent roll`} color="emerald" />
          <Hero icon={<DoorOpen className="h-5 w-5" />} label="Pending" value={aed(totals.pending)} color="red" />
        </div>

        {/* Cheque buckets */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Cheque Cash Position</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Hero icon={<Banknote />} label="Cleared (all-time)" value={aed(chequeBuckets.cleared)} color="emerald" />
            <Hero icon={<Users />} label="Pending Total" value={aed(chequeBuckets.pendingAll)} color="amber" />
            <Hero icon={<Users />} label="Due Next 30d" value={aed(chequeBuckets.dueNext30)} color="blue" />
            <Hero icon={<DoorOpen />} label="Overdue" value={aed(chequeBuckets.overdue)} color="purple" />
            <Hero icon={<DoorOpen />} label="Bounced" value={aed(chequeBuckets.bounced)} color="purple" />
          </div>
        </section>

        {/* Cashflow projection */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Next 12-Month Cash Flow</h2>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={cashflowProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v: number) => aed(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="cleared" stackId="a" fill="#22c55e" name="Cleared (received)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="expected" stackId="a" fill="#f59e0b" name="Expected (due)" radius={[6, 6, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </section>

        {/* Building P&L Snapshot */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Building P&amp;L Snapshot</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              buildingMargin >= 50 ? "bg-emerald-500/20 text-emerald-400" :
              buildingMargin >= 20 ? "bg-amber-500/20 text-amber-400" :
              "bg-red-500/20 text-red-400"
            }`}>{buildingMargin}% margin</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Hero icon={<Banknote />} label="Total Income" value={aed(buildingIncome)} hint={`Rent ${aed(totals.collected)} + Invoices ${aed(totals.invoicePaid)} + Fines ${aed(violationsRollup.paid)}`} color="emerald" />
            <Hero icon={<Wrench className="h-5 w-5" />} label="Total Expenses" value={aed(buildingExpenses)} hint="Maintenance / repairs" color="red" />
            <Hero icon={<Banknote />} label="Net Building Income" value={aed(buildingNet)} hint={buildingNet >= 0 ? "Profit" : "Loss"} color={buildingNet >= 0 ? "amber" : "red"} />
          </div>
        </section>

        {/* Vacancy cost banner */}
        {vacancyCost > 0 && (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
            <div className="flex items-start gap-3">
              <DoorOpen className="h-6 w-6 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-amber-300">Vacancy Cost Analysis</h2>
                <p className="mt-1 text-xs text-amber-200">
                  <strong>{totals.vacant} vacant unit{totals.vacant === 1 ? "" : "s"}</strong> at the average rent of this
                  building represent <strong className="text-amber-100">{aed(vacancyCost)}</strong> in potential lost
                  annual revenue. Filling these would push annual rent roll to <strong>{aed(totals.annualRentRoll + vacancyCost)}</strong>.
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] uppercase text-amber-300/70">Lost Revenue</p>
                <p className="text-lg font-bold text-amber-300">{aed(vacancyCost)}</p>
              </div>
            </div>
          </section>
        )}

        {/* Top rent contributors */}
        {topContributors.length > 0 && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-3 text-sm font-semibold text-white">Top Rent Contributors</h2>
            <div className="space-y-1.5">
              {topContributors.map((u, i) => {
                const pct = totals.annualRentRoll > 0 ? Math.round((u.annualRent / totals.annualRentRoll) * 100) : 0
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-white">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold mr-2">{i + 1}</span>
                        Unit {u.unitNo} <span className="text-slate-400">— {u.tenantName}</span>
                      </span>
                      <span className="text-amber-300 font-semibold">{aed(u.annualRent)} <span className="text-slate-500 text-[10px]">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Cheque calendar (next 12 months grid) */}
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 text-sm font-semibold text-white">Cheque Calendar — Next 12 Months</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {cashflowProjection.map((m, i) => {
              const total = m.cleared + m.expected
              const isPast = i < new Date().getMonth() % 12 // approximate
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${
                    total === 0 ? "border-slate-700 bg-slate-800/30" :
                    m.cleared > 0 && m.expected === 0 ? "border-emerald-500/30 bg-emerald-500/10" :
                    m.expected > 0 ? "border-amber-500/30 bg-amber-500/10" :
                    "border-slate-700 bg-slate-800/30"
                  }`}
                >
                  <p className="text-[10px] uppercase font-semibold text-slate-400">{m.month}</p>
                  {total > 0 ? (
                    <>
                      <p className="text-sm font-bold text-white mt-1">{aed(total)}</p>
                      {m.cleared > 0 && <p className="text-[10px] text-emerald-300">✓ {aed(m.cleared)}</p>}
                      {m.expected > 0 && <p className="text-[10px] text-amber-300">⏳ {aed(m.expected)}</p>}
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-1">—</p>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Units list */}
        <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3">
            <h2 className="text-sm font-semibold text-white">Units in this Building ({units.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Unit</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Type</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Status</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Tenant</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Contract</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Ends</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Annual Rent</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Collected</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Pending</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2 font-semibold text-white">{u.unitNo}</td>
                    <td className="px-3 py-2 text-slate-300">{u.unitType || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        u.status === "Occupied" ? "bg-emerald-500/20 text-emerald-400" :
                        u.status === "Vacant" ? "bg-red-500/20 text-red-400" :
                        "bg-slate-500/20 text-slate-400"
                      }`}>{u.status}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{u.tenant?.name || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{u.contractNo || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{fmt(u.contractEnd)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-300">{aed(u.annualRent)}</td>
                    <td className="px-3 py-2 text-right text-emerald-300">{aed(u.collected)}</td>
                    <td className="px-3 py-2 text-right text-red-300">{aed(u.pending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* All cheques */}
        <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3">
            <h2 className="text-sm font-semibold text-white">All Cheques ({cheques.length})</h2>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-500 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Date</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Unit</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Tenant</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Cheque #</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Bank</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {cheques.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No cheques.</td></tr>
                ) : cheques.map((c) => (
                  <tr key={c.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-slate-300">{fmt(c.chequeDate)}</td>
                    <td className="px-3 py-2 text-slate-300">{c.unitNo}</td>
                    <td className="px-3 py-2 text-slate-300">{c.tenantName}</td>
                    <td className="px-3 py-2 font-mono text-white">{c.chequeNo || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{c.bankName || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold text-white">{aed(c.amount)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        c.status === "Cleared" ? "bg-emerald-500/20 text-emerald-400" :
                        c.status === "Bounced" ? "bg-red-500/20 text-red-400" :
                        c.status === "Deposited" ? "bg-blue-500/20 text-blue-400" :
                        "bg-slate-500/20 text-slate-400"
                      }`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Invoices */}
        <section className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="border-b border-white/10 px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Invoices ({invoices.length})</h2>
            <span className="text-[11px] text-slate-400">
              Invoiced {aed(totals.invoiced)} · Paid <span className="text-emerald-300">{aed(totals.invoicePaid)}</span> · Outstanding <span className="text-red-300">{aed(totals.invoiceOutstanding)}</span>
            </span>
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-500 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Invoice #</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Unit</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Tenant</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Type</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Due Date</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Amount</th>
                  <th className="px-3 py-2 text-right font-semibold uppercase">Paid</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No invoices.</td></tr>
                ) : invoices.map((i) => (
                  <tr key={i.id} className="border-t border-white/5">
                    <td className="px-3 py-2 font-mono text-white">{i.invoiceNo}</td>
                    <td className="px-3 py-2 text-slate-300">{i.unitNo}</td>
                    <td className="px-3 py-2 text-slate-300">{i.tenantName}</td>
                    <td className="px-3 py-2 text-slate-300">{i.type}</td>
                    <td className="px-3 py-2 text-slate-300">{fmt(i.dueDate)}</td>
                    <td className="px-3 py-2 text-right text-white">{aed(i.totalAmount)}</td>
                    <td className="px-3 py-2 text-right text-emerald-300">{aed(i.paidAmount)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        i.status === "Paid" ? "bg-emerald-500/20 text-emerald-400" :
                        i.status === "Overdue" ? "bg-red-500/20 text-red-400" :
                        i.status === "Tenant Submitted" ? "bg-purple-500/20 text-purple-400" :
                        "bg-slate-500/20 text-slate-400"
                      }`}>{i.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Complaints / Violations / Tickets */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <ListPanel
            title="Complaints"
            icon={<MessageSquareWarning className="h-4 w-4 text-amber-400" />}
            items={complaints.map((c) => ({ id: c.id, primary: c.subject, secondary: `${c.complaintNo} · ${fmt(c.createdAt)}`, status: c.status }))}
            emptyText="No complaints"
          />
          <ListPanel
            title="Violations"
            icon={<ShieldAlert className="h-4 w-4 text-red-400" />}
            items={violations.map((v) => ({ id: v.id, primary: `${v.type} (${v.severity})${v.fineAmount > 0 ? ` — ${aed(v.fineAmount)}` : ""}`, secondary: `${v.violationNo} · ${fmt(v.createdAt)}`, status: v.status }))}
            emptyText="No violations"
          />
          <ListPanel
            title="Maintenance Tickets"
            icon={<Wrench className="h-4 w-4 text-blue-400" />}
            items={tickets.map((t) => ({ id: t.id, primary: t.title, secondary: `${t.ticketNo} · ${t.priority} · ${fmt(t.submittedAt)}`, status: t.status }))}
            emptyText="No tickets"
          />
        </div>
      </main>
    </div>
  )
}

function Hero({ icon, label, value, hint, color }: { icon: React.ReactNode; label: string; value: string; hint?: string; color: "amber" | "blue" | "emerald" | "purple" | "red" }) {
  const cls = {
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
  }[color]
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span>{icon}</span>
        <p className="text-[11px] uppercase font-semibold tracking-wide opacity-90">{label}</p>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {hint && <p className="text-[10px] mt-0.5 opacity-75">{hint}</p>}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="text-sm text-white truncate" title={value}>{value}</p>
    </div>
  )
}

function ListPanel({ title, icon, items, emptyText }: { title: string; icon: React.ReactNode; items: Array<{ id: string; primary: string; secondary: string; status: string }>; emptyText: string }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-white">{title} ({items.length})</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyText}.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div key={it.id} className="rounded-md bg-slate-900/40 px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-white truncate">{it.primary}</p>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 flex-shrink-0">{it.status}</span>
              </div>
              <p className="text-[10px] text-slate-500">{it.secondary}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
