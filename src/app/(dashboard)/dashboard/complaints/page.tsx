"use client"

import { useState, useEffect, useCallback } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatDate } from "@/lib/utils"
import { MessageSquare, AlertCircle, Clock, CheckCircle, Plus, Pencil } from "lucide-react"

interface ComplaintRow {
  id: string
  complaintNo: string
  tenant: { id: string; name: string } | null
  unit: { id: string; unitNo: string } | null
  category: string
  subject: string
  description: string
  priority: string
  status: string
  assignedTo: string
  resolution: string
  createdAt: string
  [key: string]: unknown
}

interface Stats { total: number; open: number; in_progress: number; resolved: number }

const defaultForm = { tenantId: "", unitId: "", category: "General", subject: "", description: "", priority: "Medium" }
const defaultUpdate = { status: "", assignedTo: "", resolution: "" }

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<ComplaintRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<{ id: string; unitNo: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [updateForm, setUpdateForm] = useState(defaultUpdate)
  const [updateId, setUpdateId] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([fetch("/api/complaints"), fetch("/api/complaints/stats")])
      if (!cRes.ok) throw new Error("Failed to fetch complaints")
      setComplaints(await cRes.json())
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
      const res = await fetch("/api/complaints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setAddOpen(false); setForm(defaultForm); fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setSaving(false) }
  }

  const openUpdate = (c: ComplaintRow) => {
    setUpdateId(c.id)
    setUpdateForm({ status: c.status, assignedTo: c.assignedTo, resolution: c.resolution })
    setUpdateOpen(true)
  }

  const handleUpdate = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/complaints/${updateId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updateForm) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setUpdateOpen(false); fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setSaving(false) }
  }

  const priorityColor = (p: string) => {
    switch (p) { case "High": return "text-red-400 bg-red-500/15"; case "Medium": return "text-amber-400 bg-amber-500/15"; default: return "text-blue-400 bg-blue-500/15" }
  }

  const columns: Column<ComplaintRow>[] = [
    { key: "complaintNo", header: "Complaint #", sortable: true },
    { key: "tenant", header: "Tenant", render: (r) => r.tenant?.name || "--" },
    { key: "unit", header: "Unit", render: (r) => r.unit?.unitNo || "--" },
    { key: "category", header: "Category" },
    { key: "subject", header: "Subject", sortable: true },
    { key: "priority", header: "Priority", render: (r) => <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityColor(r.priority)}`}>{r.priority}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "createdAt", header: "Created", sortable: true, render: (r) => formatDate(r.createdAt) },
    {
      key: "actions", header: "Actions",
      render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); openUpdate(r) }} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
          <Pencil className="h-4 w-4" />
        </button>
      ),
    },
  ]

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Complaints</h1>
          <p className="mt-1 text-sm text-slate-400">
            {complaints.length} complaint{complaints.length === 1 ? "" : "s"} from tenants — review &amp; respond
          </p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total" value={stats.total} color="blue" icon={<MessageSquare className="h-5 w-5" />} />
          <KpiCard label="Open" value={stats.open} color="amber" icon={<AlertCircle className="h-5 w-5" />} />
          <KpiCard label="In Progress" value={stats.in_progress} color="purple" icon={<Clock className="h-5 w-5" />} />
          <KpiCard label="Resolved" value={stats.resolved} color="green" icon={<CheckCircle className="h-5 w-5" />} />
        </div>
      )}

      <DataTable columns={columns} data={complaints} searchPlaceholder="Search complaints..." searchKeys={["complaintNo", "subject", "category"]} />

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Add Complaint" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.subject}>{saving ? "Saving..." : "Submit"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Tenant</label><select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="">Select</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Unit</label><select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="">Select</option>{units.map(u => <option key={u.id} value={u.id}>{u.unitNo}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">{["General", "Noise", "Parking", "Maintenance", "Security", "Cleanliness", "Neighbor", "Management", "Other"].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">{["Low", "Medium", "High"].map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          </div>
          <div><label className="mb-1 block text-xs font-medium text-slate-400">Subject *</label><input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-400">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
        </div>
      </Modal>

      <Modal open={updateOpen} onOpenChange={setUpdateOpen} title="Update Complaint"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleUpdate} disabled={saving}>{saving ? "Updating..." : "Update"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div><label className="mb-1 block text-xs font-medium text-slate-400">Status</label><select value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">{["Open", "In Progress", "Resolved"].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-400">Assigned To</label><input type="text" value={updateForm.assignedTo} onChange={(e) => setUpdateForm({ ...updateForm, assignedTo: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-400">Resolution</label><textarea value={updateForm.resolution} onChange={(e) => setUpdateForm({ ...updateForm, resolution: e.target.value })} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
        </div>
      </Modal>
    </div>
  )
}
