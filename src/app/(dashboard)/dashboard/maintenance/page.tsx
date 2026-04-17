"use client"

import { useState, useEffect, useCallback } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatDate } from "@/lib/utils"
import {
  Wrench,
  AlertTriangle,
  CheckCircle,
  Users,
  Plus,
  Pencil,
} from "lucide-react"

interface TicketRow {
  id: string
  ticketNo: string
  tenant: { id: string; name: string } | null
  unit: { id: string; unitNo: string } | null
  vendor: { id: string; companyName: string; contactPerson: string; phone: string } | null
  category: string
  priority: string
  title: string
  description: string
  status: string
  estimatedCost: number
  actualCost: number
  submittedAt: string
  acknowledgedAt: string | null
  assignedAt: string | null
  completedAt: string | null
  closedAt: string | null
  notes: string
  [key: string]: unknown
}

const EXPECTED_PREFIX = "EXPECTED:"
function parseExpected(notes: string | undefined | null): string {
  if (!notes) return ""
  for (const line of notes.split("\n")) {
    if (line.startsWith(EXPECTED_PREFIX)) return line.slice(EXPECTED_PREFIX.length).trim()
  }
  return ""
}
function setExpected(notes: string | undefined | null, expectedIso: string): string {
  const cleaned = (notes || "").split("\n").filter((l) => !l.startsWith(EXPECTED_PREFIX)).join("\n").trim()
  if (!expectedIso) return cleaned
  return [cleaned, EXPECTED_PREFIX + expectedIso].filter(Boolean).join("\n")
}
const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

interface Stats {
  open: number
  assigned: number
  emergency: number
  completed: number
}

const defaultForm = {
  tenantId: "",
  unitId: "",
  category: "General",
  priority: "Medium",
  title: "",
  description: "",
  vendorId: "",
  estimatedCost: "",
}

const defaultUpdateForm = {
  status: "",
  vendorId: "",
  actualCost: "",
  expectedAt: "",
}

export default function MaintenancePage() {
  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<{ id: string; unitNo: string }[]>([])
  const [vendors, setVendors] = useState<{ id: string; companyName: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [updateForm, setUpdateForm] = useState(defaultUpdateForm)
  const [updateId, setUpdateId] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [tickRes, statsRes] = await Promise.all([
        fetch("/api/maintenance"),
        fetch("/api/maintenance/stats"),
      ])
      if (!tickRes.ok) throw new Error("Failed to fetch tickets")
      setTickets(await tickRes.json())
      if (statsRes.ok) setStats(await statsRes.json())

      const [tRes, uRes, vRes] = await Promise.all([fetch("/api/tenants"), fetch("/api/units"), fetch("/api/vendors")])
      if (tRes.ok) { const d = await tRes.json(); setTenants(d.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))) }
      if (uRes.ok) { const d = await uRes.json(); setUnits(d.map((u: { id: string; unitNo: string }) => ({ id: u.id, unitNo: u.unitNo }))) }
      if (vRes.ok) { const d = await vRes.json(); setVendors(d.map((v: { id: string; companyName: string }) => ({ id: v.id, companyName: v.companyName }))) }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setAddOpen(false)
      setForm(defaultForm)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const openUpdate = (t: TicketRow) => {
    setUpdateId(t.id)
    setUpdateForm({
      status: t.status,
      vendorId: t.vendor?.id || "",
      actualCost: String(t.actualCost || ""),
      expectedAt: parseExpected(t.notes),
    })
    setUpdateOpen(true)
  }

  const handleUpdate = async () => {
    setSaving(true)
    try {
      const target = tickets.find((x) => x.id === updateId)
      const newNotes = setExpected(target?.notes || "", updateForm.expectedAt)
      const body: Record<string, unknown> = {
        status: updateForm.status,
        vendorId: updateForm.vendorId,
        actualCost: updateForm.actualCost,
        notes: newNotes,
      }
      const res = await fetch(`/api/maintenance/${updateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setUpdateOpen(false)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const priorityColor = (p: string) => {
    switch (p) {
      case "Emergency": return "text-red-400 bg-red-500/15"
      case "High": return "text-amber-400 bg-amber-500/15"
      case "Medium": return "text-blue-400 bg-blue-500/15"
      default: return "text-slate-400 bg-slate-500/15"
    }
  }

  const columns: Column<TicketRow>[] = [
    { key: "ticketNo", header: "Ticket #", sortable: true },
    { key: "tenant", header: "Tenant", render: (r) => r.tenant?.name || "--" },
    { key: "unit", header: "Unit", render: (r) => r.unit?.unitNo || "--" },
    { key: "category", header: "Category" },
    { key: "title", header: "Title", sortable: true },
    {
      key: "priority",
      header: "Priority",
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityColor(r.priority)}`}>
          {r.priority}
        </span>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "vendor", header: "Vendor", render: (r) => r.vendor?.companyName || "--" },
    {
      key: "lifecycle",
      header: "Timeline",
      render: (r) => {
        const expected = parseExpected(r.notes)
        const overdue = expected && new Date(expected) < new Date() && !r.completedAt
        return (
          <div className="flex flex-col gap-0.5 text-[10px] leading-tight">
            <div className="text-slate-300"><span className="text-slate-500">Received:</span> {fmtDateTime(r.submittedAt)}</div>
            {r.assignedAt && <div className="text-blue-300"><span className="text-slate-500">Assigned:</span> {fmtDateTime(r.assignedAt)}</div>}
            {expected && (
              <div className={overdue ? "text-red-400" : "text-amber-300"}>
                <span className="text-slate-500">Expected:</span> {fmtDateTime(expected)}{overdue && " ⚠"}
              </div>
            )}
            {r.completedAt && <div className="text-emerald-300"><span className="text-slate-500">Completed:</span> {fmtDateTime(r.completedAt)}</div>}
          </div>
        )
      },
    },
    {
      key: "actions",
      header: "Actions",
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
          <h1 className="text-2xl font-bold text-white">Maintenance</h1>
          <p className="mt-1 text-sm text-slate-400">{tickets.length} tickets total</p>
        </div>
        <button onClick={() => { setForm(defaultForm); setAddOpen(true) }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500">
          <Plus className="h-4 w-4" /> Create Ticket
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Open" value={stats.open} color="blue" icon={<Wrench className="h-5 w-5" />} />
          <KpiCard label="Assigned" value={stats.assigned} color="amber" icon={<Users className="h-5 w-5" />} />
          <KpiCard label="Emergency" value={stats.emergency} color="red" icon={<AlertTriangle className="h-5 w-5" />} />
          <KpiCard label="Completed" value={stats.completed} color="green" icon={<CheckCircle className="h-5 w-5" />} />
        </div>
      )}

      <DataTable columns={columns} data={tickets} searchPlaceholder="Search tickets..." searchKeys={["ticketNo", "title", "category"]} />

      {/* Create Ticket Modal */}
      <Modal open={addOpen} onOpenChange={setAddOpen} title="Create Maintenance Ticket" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.title}>{saving ? "Creating..." : "Create"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Title *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Tenant</label>
              <select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                <option value="">Select tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Unit</label>
              <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                <option value="">Select unit</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.unitNo}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                {["General", "Plumbing", "Electrical", "HVAC", "Painting", "Carpentry", "Pest Control", "Cleaning", "Elevator", "Other"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                {["Low", "Medium", "High", "Emergency"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Vendor</label>
              <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                <option value="">Select vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.companyName}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Estimated Cost</label>
              <input type="number" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
        </div>
      </Modal>

      {/* Update Ticket Modal */}
      <Modal open={updateOpen} onOpenChange={setUpdateOpen} title="Update Ticket"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleUpdate} disabled={saving}>{saving ? "Updating..." : "Update"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Status</label>
            <select value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
              {["Submitted", "Acknowledged", "Assigned", "In Progress", "Escalated", "Completed", "Closed"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Assign Vendor</label>
            <select value={updateForm.vendorId} onChange={(e) => setUpdateForm({ ...updateForm, vendorId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
              <option value="">No vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.companyName}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Expected Completion (date &amp; time)</label>
            <input
              type="datetime-local"
              value={updateForm.expectedAt}
              onChange={(e) => setUpdateForm({ ...updateForm, expectedAt: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
            <p className="mt-1 text-[10px] text-slate-500">When the vendor expects to complete this work. Tenant will see it in their portal.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Actual Cost</label>
            <input type="number" value={updateForm.actualCost} onChange={(e) => setUpdateForm({ ...updateForm, actualCost: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
        </div>
      </Modal>
    </div>
  )
}
