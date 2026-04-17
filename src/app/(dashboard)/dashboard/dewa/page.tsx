"use client"

import { useState, useEffect, useCallback } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Zap, Droplets, Plus } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface DewaRow {
  id: string; unitId: string; tenantId: string | null; unit: { id: string; unitNo: string } | null; tenant: { id: string; name: string } | null
  premiseNo: string; month: string; electricityReading: number; waterReading: number; electricityCharge: number; waterCharge: number; sewageCharge: number; totalCharge: number; status: string; notes: string
  [key: string]: unknown
}

interface Summary { total_charges: number; pending: number; paid: number; total_electricity: number; total_water: number; monthly_breakdown: { month: string; electricity: number; water: number; sewage: number; total: number }[] }

const defaultForm = { unitId: "", tenantId: "", premiseNo: "", month: "", electricityReading: "", waterReading: "", electricityCharge: "", waterCharge: "", sewageCharge: "", notes: "" }

export default function DewaPage() {
  const [readings, setReadings] = useState<DewaRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [units, setUnits] = useState<{ id: string; unitNo: string; tenantId: string | null }[]>([])
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [rRes, sRes] = await Promise.all([fetch("/api/dewa"), fetch("/api/dewa/summary")])
      if (!rRes.ok) throw new Error("Failed to fetch DEWA data")
      setReadings(await rRes.json())
      if (sRes.ok) setSummary(await sRes.json())
      const [uRes, tRes] = await Promise.all([fetch("/api/units"), fetch("/api/tenants")])
      if (uRes.ok) { const d = await uRes.json(); setUnits(d.map((u: { id: string; unitNo: string; tenantId: string | null }) => ({ id: u.id, unitNo: u.unitNo, tenantId: u.tenantId }))) }
      if (tRes.ok) { const d = await tRes.json(); setTenants(d.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))) }
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/dewa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setAddOpen(false); setForm(defaultForm); fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setSaving(false) }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/dewa/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, paidDate: status === "Paid" ? new Date().toISOString().split("T")[0] : "" }) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") }
  }

  const columns: Column<DewaRow>[] = [
    { key: "unit", header: "Unit", render: (r) => r.unit?.unitNo || "--" },
    { key: "tenant", header: "Tenant", render: (r) => r.tenant?.name || "--" },
    { key: "month", header: "Month", sortable: true },
    { key: "electricityCharge", header: "Electricity", render: (r) => formatCurrency(r.electricityCharge) },
    { key: "waterCharge", header: "Water", render: (r) => formatCurrency(r.waterCharge) },
    { key: "sewageCharge", header: "Sewage", render: (r) => formatCurrency(r.sewageCharge) },
    { key: "totalCharge", header: "Total", sortable: true, render: (r) => formatCurrency(r.totalCharge) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions", header: "Actions",
      render: (r) => r.status === "Pending" ? (
        <button onClick={(e) => { e.stopPropagation(); updateStatus(r.id, "Paid") }} className="rounded px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-900/30">Mark Paid</button>
      ) : null,
    },
  ]

  const chartData = summary?.monthly_breakdown.slice(0, 12).reverse() || []

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">DEWA Tracking</h1><p className="mt-1 text-sm text-slate-400">{readings.length} readings recorded</p></div>
        <button onClick={() => { setForm(defaultForm); setAddOpen(true) }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500"><Plus className="h-4 w-4" /> Add Reading</button>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Charges" value={formatCurrency(summary.total_charges)} color="blue" icon={<Zap className="h-5 w-5" />} />
          <KpiCard label="Pending" value={formatCurrency(summary.pending)} color="amber" icon={<Zap className="h-5 w-5" />} />
          <KpiCard label="Electricity" value={formatCurrency(summary.total_electricity)} color="gold" icon={<Zap className="h-5 w-5" />} />
          <KpiCard label="Water" value={formatCurrency(summary.total_water)} color="green" icon={<Droplets className="h-5 w-5" />} />
        </div>
      )}

      {chartData.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Monthly Breakdown</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9" }} formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="electricity" fill="#f59e0b" name="Electricity" radius={[2, 2, 0, 0]} />
              <Bar dataKey="water" fill="#3b82f6" name="Water" radius={[2, 2, 0, 0]} />
              <Bar dataKey="sewage" fill="#8b5cf6" name="Sewage" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <DataTable columns={columns} data={readings} searchPlaceholder="Search DEWA readings..." searchKeys={["month", "premiseNo"]} />

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Add DEWA Reading" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.unitId || !form.month}>{saving ? "Saving..." : "Save"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Unit *</label><select value={form.unitId} onChange={(e) => { const u = units.find(x => x.id === e.target.value); setForm({ ...form, unitId: e.target.value, tenantId: u?.tenantId || "" }) }} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="">Select</option>{units.map(u => <option key={u.id} value={u.id}>{u.unitNo}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Month * (YYYY-MM)</label><input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Elec. Charge (AED)</label><input type="number" value={form.electricityCharge} onChange={(e) => setForm({ ...form, electricityCharge: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Water Charge (AED)</label><input type="number" value={form.waterCharge} onChange={(e) => setForm({ ...form, waterCharge: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Sewage (AED)</label><input type="number" value={form.sewageCharge} onChange={(e) => setForm({ ...form, sewageCharge: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Elec. Reading</label><input type="number" value={form.electricityReading} onChange={(e) => setForm({ ...form, electricityReading: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Water Reading</label><input type="number" value={form.waterReading} onChange={(e) => setForm({ ...form, waterReading: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          </div>
          <div><label className="mb-1 block text-xs font-medium text-slate-400">Premise No</label><input type="text" value={form.premiseNo} onChange={(e) => setForm({ ...form, premiseNo: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
        </div>
      </Modal>
    </div>
  )
}
