"use client"

import { Building2, Users, DoorOpen, Percent, Banknote, Clock, AlertTriangle, Wrench, Calendar, TrendingUp, Award, MapPin } from "lucide-react"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadialBarChart, RadialBar } from "recharts"
import { useDashboard, formatAed, formatAedShort, KpiCard, LoadingSpinner, ErrorBox, CHART_COLORS, StatusPill, LastUpdatedBadge, PrintButton } from "../_shared"

export default function OwnerOverviewPage() {
  const { data, loading, error, lastUpdated, refreshing, refresh } = useDashboard()

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox message={error} />
  if (!data) return null

  const occPct = data.totals.occupancyPct
  const collectedPct = data.totals.annualRentRoll > 0 ? (data.totals.collected / data.totals.annualRentRoll) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Actions row */}
      <div className="flex items-center justify-end gap-2 print:hidden">
        <LastUpdatedBadge lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={refresh} />
        <PrintButton />
      </div>

      {/* Hero */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-[#E30613] via-red-700 to-slate-900 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-red-200">Welcome back,</p>
            <h2 className="text-3xl font-bold text-white">{data.owner.ownerName}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-red-100">
              <MapPin className="h-3.5 w-3.5" />
              {data.owner.buildingName} · {data.owner.area || "Dubai"}, {data.owner.emirate || "UAE"}
            </p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{occPct}%</p>
              <p className="text-[10px] uppercase tracking-widest text-red-200">Occupancy</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{formatAedShort(data.totals.annualRentRoll)}</p>
              <p className="text-[10px] uppercase tracking-widest text-red-200">Rent Roll</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-white">{data.totals.units}</p>
              <p className="text-[10px] uppercase tracking-widest text-red-200">Units</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Units" value={data.totals.units} icon={<Building2 className="h-5 w-5" />} accent="blue" />
        <KpiCard label="Occupied" value={`${data.totals.occupied}`} sub={`${data.totals.vacant} vacant`} icon={<Users className="h-5 w-5" />} accent="green" />
        <KpiCard label="Occupancy Rate" value={`${data.totals.occupancyPct}%`} icon={<Percent className="h-5 w-5" />} accent="amber" />
        <KpiCard label="Avg Rent / Sq Ft" value={formatAed(data.totals.avgRentPerSqft)} icon={<TrendingUp className="h-5 w-5" />} accent="purple" />
      </div>

      {/* KPI Row 2 - Financial */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <KpiCard label="Annual Rent Roll" value={formatAedShort(data.totals.annualRentRoll)} icon={<Banknote className="h-5 w-5" />} accent="amber" />
        <KpiCard label="Collected YTD" value={formatAedShort(data.totals.collected)} sub={`${Math.round(collectedPct)}% collected`} icon={<Banknote className="h-5 w-5" />} accent="green" />
        <KpiCard label="Pending" value={formatAedShort(data.totals.pending)} icon={<Clock className="h-5 w-5" />} accent="red" />
        <KpiCard label="Net Operating Income" value={formatAedShort(data.totals.netOperatingIncome)} sub={`${data.totals.profitMargin.toFixed(1)}% margin`} icon={<TrendingUp className="h-5 w-5" />} accent="purple" />
      </div>

      {/* Alerts */}
      {(data.chequeBuckets.overdue > 0 || data.totals.overdueInvoices > 0 || data.totals.vacant > 0) && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-[#E30613]" />
            <h3 className="text-sm font-semibold text-[#E30613]">Attention Required</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {data.chequeBuckets.overdue > 0 && (
              <div className="rounded-lg bg-white border border-red-100 p-3">
                <p className="text-xs text-red-700">Overdue cheques</p>
                <p className="text-lg font-bold text-[#E30613]">{formatAed(data.chequeBuckets.overdue)}</p>
              </div>
            )}
            {data.totals.overdueInvoices > 0 && (
              <div className="rounded-lg bg-white border border-red-100 p-3">
                <p className="text-xs text-red-700">Overdue invoices</p>
                <p className="text-lg font-bold text-[#E30613]">{data.totals.overdueInvoices} invoices</p>
              </div>
            )}
            {data.totals.vacant > 0 && (
              <div className="rounded-lg bg-white border border-red-100 p-3">
                <p className="text-xs text-red-700">Vacant units</p>
                <p className="text-lg font-bold text-[#E30613]">{data.totals.vacant} units</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Occupancy radial */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Occupancy</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="40%" outerRadius="100%" data={[{ name: "Occupancy", value: occPct, fill: "#22c55e" }, { name: "Gap", value: 100 - occPct, fill: "#f1f5f9" }]} startAngle={90} endAngle={-270}>
                <RadialBar background dataKey="value" cornerRadius={10} />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 32, fontWeight: 700, fill: "#111" }}>
                  {occPct}%
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-center text-xs text-slate-500">
            {data.totals.occupied} occupied · {data.totals.vacant} vacant
          </div>
        </section>

        {/* Unit Type pie */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Unit Mix</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.unitTypeBreakdown}
                  dataKey="count"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={((props: { type?: string; count?: number }) => `${props.type ?? ""}: ${props.count ?? 0}`) as unknown as undefined}
                  labelLine={false}
                >
                  {data.unitTypeBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", color: "#111" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* 6-Month mini cashflow */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Recent + Upcoming Cashflow (12 months)</h3>
          <a href="/owner/cashflow" className="text-xs text-amber-700 hover:underline">See full cashflow →</a>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.cashflowProjection.slice(3, 15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => formatAed(Number(v))} contentStyle={{ background: "#fff", border: "1px solid #e5e7eb", color: "#111" }} />
              <Legend />
              <Bar dataKey="cleared" stackId="a" fill="#22c55e" name="Cleared" />
              <Bar dataKey="expected" stackId="a" fill="#f59e0b" name="Expected" />
              <Bar dataKey="bounced" stackId="a" fill="#ef4444" name="Bounced" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Top performers + Upcoming renewals */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-700" />
            <h3 className="text-sm font-semibold text-slate-900">Top 10 Rent Contributors</h3>
          </div>
          <div className="space-y-1">
            {data.topContributors.slice(0, 10).map((u, i) => (
              <div key={u.unitNo} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-xs font-mono text-slate-500 w-5">{i + 1}</span>
                <span className="text-xs font-mono text-slate-700 w-14">{u.unitNo}</span>
                <span className="text-xs text-slate-200 flex-1 truncate">{u.tenant?.name || "Vacant"}</span>
                <span className="text-xs font-semibold text-amber-700">{formatAed(u.annualRent)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-700" />
            <h3 className="text-sm font-semibold text-slate-900">Upcoming Renewals (90 days)</h3>
          </div>
          {data.upcomingRenewals.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">No leases ending in the next 90 days</p>
          ) : (
            <div className="space-y-1">
              {data.upcomingRenewals.slice(0, 10).map((u) => (
                <div key={u.unitNo} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-xs font-mono text-slate-700 w-14">{u.unitNo}</span>
                  <span className="text-xs text-slate-200 flex-1 truncate">{u.tenant?.name || "Vacant"}</span>
                  <span className="text-xs text-slate-500">{u.contractEnd}</span>
                  <span className="text-xs font-semibold text-amber-700">{formatAedShort(u.annualRent)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Maintenance + Complaints */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-700" />
            <h3 className="text-sm font-semibold text-slate-900">Recent Maintenance Tickets</h3>
          </div>
          {data.tickets.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">No tickets</p>
          ) : (
            <div className="space-y-1">
              {data.tickets.slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-xs font-mono text-slate-500 w-16">{t.ticketNo}</span>
                  <span className="text-xs text-slate-200 flex-1 truncate">{t.title}</span>
                  <StatusPill value={t.priority} />
                  <StatusPill value={t.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="mb-3 flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-[#E30613]" />
            <h3 className="text-sm font-semibold text-slate-900">Collection Issues (Top 5)</h3>
          </div>
          {data.worstCollection.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">All clean</p>
          ) : (
            <div className="space-y-1">
              {data.worstCollection.map((u) => (
                <div key={u.unitNo} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-xs font-mono text-slate-700 w-14">{u.unitNo}</span>
                  <span className="text-xs text-slate-200 flex-1 truncate">{u.tenant?.name || "Vacant"}</span>
                  <span className="text-xs font-semibold text-[#E30613]">{formatAed(u.pending)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
