"use client"

import { useState, useEffect, useCallback } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatCurrency, formatDate } from "@/lib/utils"
import { ShieldAlert, AlertTriangle, Banknote, Users, Plus } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface ViolationRow {
  id: string; violationNo: string; tenant: { id: string; name: string } | null; unit: { id: string; unitNo: string } | null
  type: string; description: string; severity: string; fineAmount: number; status: string; issuedBy: string; createdAt: string
  [key: string]: unknown
}

interface Stats {
  total: number; issued: number; paid: number; total_fines: number; repeat_offenders: { tenantId: string; name: string; violationCount: number }[]
  by_type: Record<string, number>
}

const defaultForm = { tenantId: "", unitId: "", type: "General", description: "", severity: "Warning", notes: "", fineAmount: "" }

export default function ViolationsPage() {
  const [violations, setViolations] = useState<ViolationRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<{ id: string; unitNo: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [vRes, sRes] = await Promise.all([fetch("/api/violations"), fetch("/api/violations/stats")])
      if (!vRes.ok) throw new Error("Failed to fetch violations")
      setViolations(await vRes.json())
      if (sRes.ok) setStats(await sRes.json())
      const [tRes, uRes] = await Promise.all([fetch("/api/tenants"), fetch("/api/units")])
      if (tRes.ok) { const d = await tRes.json(); setTenants(d.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))) }
      if (uRes.ok) { const d = await uRes.json(); setUnits(d.map((u: { id: string; unitNo: string }) => ({ id: u.id, unitNo: u.unitNo }))) }
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/violations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setAddOpen(false); setForm(defaultForm); fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setSaving(false) }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/violations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") }
  }

  const severityColor = (s: string) => {
    switch (s) { case "Critical": return "text-red-400 bg-red-500/15"; case "Major": return "text-amber-400 bg-amber-500/15"; case "Warning": return "text-yellow-400 bg-yellow-500/15"; default: return "text-blue-400 bg-blue-500/15" }
  }

  const byTypeData = stats ? Object.entries(stats.by_type).map(([name, count]) => ({ name, count })) : []

  const columns: Column<ViolationRow>[] = [
    { key: "violationNo", header: "Violation #", sortable: true },
    { key: "tenant", header: "Tenant", render: (r) => r.tenant?.name || "--" },
    { key: "unit", header: "Unit", render: (r) => r.unit?.unitNo || "--" },
    { key: "type", header: "Type" },
    { key: "description", header: "Description", render: (r) => <span className="max-w-[200px] truncate block">{r.description || "--"}</span> },
    { key: "severity", header: "Severity", render: (r) => <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${severityColor(r.severity)}`}>{r.severity}</span> },
    { key: "fineAmount", header: "Fine", render: (r) => r.fineAmount > 0 ? formatCurrency(r.fineAmount) : <span className="text-slate-500">—</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions", header: "Actions",
      render: (r) => (
        <div className="flex gap-1">
          {r.status === "Issued" && <button onClick={(e) => { e.stopPropagation(); updateStatus(r.id, "Acknowledged") }} className="rounded px-2 py-1 text-xs text-blue-400 hover:bg-blue-900/30">Ack</button>}
          {(r.status === "Issued" || r.status === "Acknowledged") && <button onClick={(e) => { e.stopPropagation(); updateStatus(r.id, "Paid") }} className="rounded px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-900/30">Paid</button>}
        </div>
      ),
    },
  ]

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Violations</h1><p className="mt-1 text-sm text-slate-400">{violations.length} violations recorded</p></div>
        <button onClick={() => { setForm(defaultForm); setAddOpen(true) }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500"><Plus className="h-4 w-4" /> Issue Violation</button>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      {stats && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard label="Total" value={stats.total} color="blue" icon={<ShieldAlert className="h-5 w-5" />} />
            <KpiCard label="Issued" value={stats.issued} color="amber" icon={<AlertTriangle className="h-5 w-5" />} />
            <KpiCard label="Paid" value={stats.paid} color="green" icon={<Banknote className="h-5 w-5" />} />
            <KpiCard label="Total Fines" value={formatCurrency(stats.total_fines)} color="red" icon={<Banknote className="h-5 w-5" />} />
            <KpiCard label="Repeat Offenders" value={stats.repeat_offenders.length} color="purple" icon={<Users className="h-5 w-5" />} />
          </div>

          {byTypeData.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Violations by Type</h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={byTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#f1f5f9" }} />
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      <DataTable columns={columns} data={violations} searchPlaceholder="Search violations..." searchKeys={["violationNo", "type", "description"]} />

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Issue Violation" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.tenantId}>{saving ? "Issuing..." : "Issue"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Tenant *</label><select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="">Select</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Unit</label><select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="">Select</option>{units.map(u => <option key={u.id} value={u.id}>{u.unitNo}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">{["General", "Parking Violation", "Noise Complaint", "Property Damage", "Unauthorized Modification", "Pet Policy Violation", "Waste Disposal", "Balcony Violation", "Unauthorized Guest"].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Severity</label><select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">{["Warning", "Minor", "Major", "Critical"].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div><label className="mb-1 block text-xs font-medium text-slate-400">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Fine Amount (AED) — leave blank for warning-only</label>
            <input
              type="number"
              min="0"
              value={form.fineAmount}
              onChange={(e) => setForm({ ...form, fineAmount: e.target.value })}
              placeholder="e.g. 200 (or leave empty)"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
            <p className="mt-1 text-[10px] text-slate-500">If you leave this blank or set 0, the notice will be issued as a warning with no fine.</p>
          </div>
          <div><label className="mb-1 block text-xs font-medium text-slate-400">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          <p className="text-xs text-slate-500">Repeat offenders (3+ prior violations) are auto-escalated to Critical severity.</p>
        </div>
      </Modal>
    </div>
  )
}
