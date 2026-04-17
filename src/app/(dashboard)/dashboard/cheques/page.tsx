"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Plus,
  Layers,
  ArrowRightCircle,
} from "lucide-react"

interface ChequeRow {
  id: string
  tenantId: string
  unitId: string | null
  tenant: { id: string; name: string } | null
  unit: { id: string; unitNo: string } | null
  chequeNo: string
  chequeDate: string
  amount: number
  bankName: string
  status: string
  paymentType: string
  periodFrom: string
  periodTo: string
  sequenceNo: number
  totalCheques: number
  bouncedReason: string
  clearedDate: string
  notes: string
  [key: string]: unknown
}

interface Summary {
  total: number
  totalAmount: number
  received: { count: number; amount: number }
  cleared: { count: number; amount: number }
  bounced: { count: number; amount: number }
  deposited: { count: number; amount: number }
}

const defaultForm = {
  tenantId: "",
  unitId: "",
  chequeNo: "",
  chequeDate: "",
  amount: "",
  bankName: "",
  paymentType: "Rent",
  periodFrom: "",
  periodTo: "",
  sequenceNo: "1",
  totalCheques: "12",
  notes: "",
}

const defaultBulkForm = {
  tenantId: "",
  unitId: "",
  bankName: "",
  paymentType: "Rent",
  chequeCount: "12",
  startAmount: "",
  startChequeNo: "",
  startDate: "",
}

export default function ChequesPage() {
  const [cheques, setCheques] = useState<ChequeRow[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<{ id: string; unitNo: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [bulkForm, setBulkForm] = useState(defaultBulkForm)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [cheqRes, sumRes] = await Promise.all([
        fetch("/api/cheques"),
        fetch("/api/cheques/summary"),
      ])
      if (!cheqRes.ok) throw new Error("Failed to fetch cheques")
      setCheques(await cheqRes.json())
      if (sumRes.ok) { const d = await sumRes.json(); setSummary(d.summary) }

      const [tRes, uRes] = await Promise.all([fetch("/api/tenants"), fetch("/api/units")])
      if (tRes.ok) { const d = await tRes.json(); setTenants(d.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))) }
      if (uRes.ok) { const d = await uRes.json(); setUnits(d.map((u: { id: string; unitNo: string }) => ({ id: u.id, unitNo: u.unitNo }))) }
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
      const res = await fetch("/api/cheques", {
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

  const handleBulkAdd = async () => {
    setSaving(true)
    try {
      const count = parseInt(bulkForm.chequeCount) || 12
      const baseAmount = parseFloat(bulkForm.startAmount) || 0
      const baseNo = parseInt(bulkForm.startChequeNo) || 1
      const startDate = bulkForm.startDate ? new Date(bulkForm.startDate) : new Date()

      const chequesList = Array.from({ length: count }, (_, i) => {
        const date = new Date(startDate)
        date.setMonth(date.getMonth() + i)
        return {
          chequeNo: String(baseNo + i),
          chequeDate: date.toISOString().split("T")[0],
          amount: baseAmount,
          periodFrom: date.toISOString().split("T")[0],
          periodTo: new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split("T")[0],
        }
      })

      const res = await fetch("/api/cheques/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: bulkForm.tenantId,
          unitId: bulkForm.unitId || null,
          bankName: bulkForm.bankName,
          paymentType: bulkForm.paymentType,
          cheques: chequesList,
        }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      const data = await res.json()
      alert(`${data.count} cheques created successfully`)
      setBulkOpen(false)
      setBulkForm(defaultBulkForm)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const updateChequeStatus = async (id: string, status: string, extra: Record<string, string> = {}) => {
    try {
      const res = await fetch(`/api/cheques/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const columns: Column<ChequeRow>[] = [
    { key: "tenant", header: "Tenant", render: (r) => r.tenant?.name || "--" },
    { key: "unit", header: "Unit", render: (r) => r.unit?.unitNo || "--" },
    { key: "chequeNo", header: "Cheque #", sortable: true },
    { key: "chequeDate", header: "Date", sortable: true, render: (r) => r.chequeDate ? formatDate(r.chequeDate) : "--" },
    { key: "amount", header: "Amount", sortable: true, render: (r) => formatCurrency(r.amount) },
    { key: "bankName", header: "Bank" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "seq", header: "Seq", render: (r) => `${r.sequenceNo}/${r.totalCheques}` },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex gap-1">
          {r.status === "Received" && (
            <>
              <button onClick={(e) => { e.stopPropagation(); updateChequeStatus(r.id, "Deposited") }} className="rounded p-1.5 text-slate-400 hover:bg-blue-900/50 hover:text-blue-400" title="Deposit">
                <ArrowRightCircle className="h-4 w-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); updateChequeStatus(r.id, "Cleared", { clearedDate: new Date().toISOString().split("T")[0] }) }} className="rounded p-1.5 text-slate-400 hover:bg-emerald-900/50 hover:text-emerald-400" title="Clear">
                <CheckCircle className="h-4 w-4" />
              </button>
            </>
          )}
          {r.status === "Deposited" && (
            <>
              <button onClick={(e) => { e.stopPropagation(); updateChequeStatus(r.id, "Cleared", { clearedDate: new Date().toISOString().split("T")[0] }) }} className="rounded p-1.5 text-slate-400 hover:bg-emerald-900/50 hover:text-emerald-400" title="Clear">
                <CheckCircle className="h-4 w-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); const reason = prompt("Bounce reason:"); if (reason) updateChequeStatus(r.id, "Bounced", { bouncedReason: reason }) }} className="rounded p-1.5 text-slate-400 hover:bg-red-900/50 hover:text-red-400" title="Bounce">
                <XCircle className="h-4 w-4" />
              </button>
            </>
          )}
          {r.status === "Bounced" && (
            <button onClick={(e) => { e.stopPropagation(); updateChequeStatus(r.id, "Replaced") }} className="rounded px-2 py-1 text-xs text-amber-400 hover:bg-amber-900/30" title="Replace">
              Replace
            </button>
          )}
        </div>
      ),
    },
  ]

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cheque Tracker</h1>
          <p className="mt-1 text-sm text-slate-400">{cheques.length} cheques on record</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBulkOpen(true)} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white">
            <Layers className="h-4 w-4" /> Bulk Add
          </button>
          <button onClick={() => { setForm(defaultForm); setAddOpen(true) }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500">
            <Plus className="h-4 w-4" /> Add Cheque
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Cheques" value={summary.total} subtitle={formatCurrency(summary.totalAmount)} color="blue" icon={<CreditCard className="h-5 w-5" />} />
          <KpiCard label="Received" value={summary.received.count} subtitle={formatCurrency(summary.received.amount)} color="amber" icon={<CreditCard className="h-5 w-5" />} />
          <KpiCard label="Cleared" value={summary.cleared.count} subtitle={formatCurrency(summary.cleared.amount)} color="green" icon={<CheckCircle className="h-5 w-5" />} />
          <KpiCard label="Bounced" value={summary.bounced.count} subtitle={formatCurrency(summary.bounced.amount)} color="red" icon={<XCircle className="h-5 w-5" />} />
        </div>
      )}

      <ChequeFilters
        cheques={cheques}
        columns={columns}
        updateStatus={updateChequeStatus}
      />

      {/* Add Cheque Modal */}
      <Modal open={addOpen} onOpenChange={setAddOpen} title="Add Cheque" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.tenantId || !form.amount}>{saving ? "Saving..." : "Save"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Tenant *</label>
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
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Cheque No</label>
              <input type="text" value={form.chequeNo} onChange={(e) => setForm({ ...form, chequeNo: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Cheque Date</label>
              <input type="date" value={form.chequeDate} onChange={(e) => setForm({ ...form, chequeDate: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Amount (AED) *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Bank Name</label>
              <input type="text" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Payment Type</label>
              <select value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                <option value="Rent">Rent</option>
                <option value="Security Deposit">Security Deposit</option>
                <option value="Commission">Commission</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Seq No</label>
              <input type="number" value={form.sequenceNo} onChange={(e) => setForm({ ...form, sequenceNo: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Total Cheques</label>
              <input type="number" value={form.totalCheques} onChange={(e) => setForm({ ...form, totalCheques: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
        </div>
      </Modal>

      {/* Bulk Add Modal */}
      <Modal open={bulkOpen} onOpenChange={setBulkOpen} title="Bulk Add Cheques" description="Auto-generate monthly cheques" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleBulkAdd} disabled={saving || !bulkForm.tenantId || !bulkForm.startAmount}>{saving ? "Creating..." : "Create All"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Tenant *</label>
              <select value={bulkForm.tenantId} onChange={(e) => setBulkForm({ ...bulkForm, tenantId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                <option value="">Select tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Unit</label>
              <select value={bulkForm.unitId} onChange={(e) => setBulkForm({ ...bulkForm, unitId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                <option value="">Select unit</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.unitNo}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">No. of Cheques</label>
              <input type="number" value={bulkForm.chequeCount} onChange={(e) => setBulkForm({ ...bulkForm, chequeCount: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Amount Per Cheque *</label>
              <input type="number" value={bulkForm.startAmount} onChange={(e) => setBulkForm({ ...bulkForm, startAmount: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Start Cheque No</label>
              <input type="text" value={bulkForm.startChequeNo} onChange={(e) => setBulkForm({ ...bulkForm, startChequeNo: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Start Date</label>
              <input type="date" value={bulkForm.startDate} onChange={(e) => setBulkForm({ ...bulkForm, startDate: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Bank Name</label>
              <input type="text" value={bulkForm.bankName} onChange={(e) => setBulkForm({ ...bulkForm, bankName: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ChequeFilters({
  cheques,
  columns,
  updateStatus,
}: {
  cheques: ChequeRow[]
  columns: Column<ChequeRow>[]
  updateStatus: (id: string, status: string, extra?: Record<string, string>) => Promise<void> | void
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [tenantFilter, setTenantFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<string>("all")
  const [view, setView] = useState<"cards" | "table">("cards")

  const today = new Date().toISOString().slice(0, 10)
  const thisMonthStart = today.slice(0, 7) + "-01"
  const in30 = new Date(); in30.setDate(in30.getDate() + 30)
  const in30Str = in30.toISOString().slice(0, 10)
  const in7 = new Date(); in7.setDate(in7.getDate() + 7)
  const in7Str = in7.toISOString().slice(0, 10)

  const tenantOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of cheques) {
      if (c.tenantId && c.tenant?.name) m.set(c.tenantId, c.tenant.name)
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [cheques])

  const filtered = useMemo(() => {
    return cheques.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false
      if (tenantFilter !== "all" && c.tenantId !== tenantFilter) return false
      if (dateRange !== "all") {
        const d = c.chequeDate || ""
        if (!d) return false
        if (dateRange === "overdue" && !(d < today && c.status !== "Cleared" && c.status !== "Replaced")) return false
        if (dateRange === "this-week" && !(d >= today && d <= in7Str)) return false
        if (dateRange === "this-month" && !(d >= thisMonthStart && d <= today.slice(0, 7) + "-31")) return false
        if (dateRange === "next-30" && !(d >= today && d <= in30Str)) return false
      }
      return true
    })
  }, [cheques, statusFilter, tenantFilter, dateRange, today, thisMonthStart, in7Str, in30Str])

  const filteredTotal = filtered.reduce((s, c) => s + (c.amount || 0), 0)

  const StatusButton = ({ value, label }: { value: string; label: string }) => (
    <button
      onClick={() => setStatusFilter(value)}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        statusFilter === value
          ? "bg-amber-500 text-slate-900"
          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  )

  const DateButton = ({ value, label }: { value: string; label: string }) => (
    <button
      onClick={() => setDateRange(value)}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        dateRange === value
          ? "bg-blue-500 text-white"
          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</p>
          <div className="flex flex-wrap gap-1.5">
            <StatusButton value="all" label={`All (${cheques.length})`} />
            <StatusButton value="Pending" label="Pending" />
            <StatusButton value="Received" label="Received" />
            <StatusButton value="Deposited" label="Deposited" />
            <StatusButton value="Cleared" label="Cleared" />
            <StatusButton value="Bounced" label="Bounced" />
            <StatusButton value="Replaced" label="Replaced" />
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Due Date</p>
          <div className="flex flex-wrap gap-1.5">
            <DateButton value="all" label="Anytime" />
            <DateButton value="overdue" label="🔴 Overdue" />
            <DateButton value="this-week" label="This Week" />
            <DateButton value="this-month" label="This Month" />
            <DateButton value="next-30" label="Next 30 Days" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tenant</p>
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            >
              <option value="all">All tenants ({tenantOptions.length})</option>
              {tenantOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end justify-end gap-3 text-xs text-slate-400">
            <span>
              Showing <strong className="text-white">{filtered.length}</strong> cheques
              {(statusFilter !== "all" || tenantFilter !== "all" || dateRange !== "all") && ` of ${cheques.length}`}
            </span>
            <span className="text-amber-400 font-semibold">{formatCurrency(filteredTotal)}</span>
            {(statusFilter !== "all" || tenantFilter !== "all" || dateRange !== "all") && (
              <button
                onClick={() => { setStatusFilter("all"); setTenantFilter("all"); setDateRange("all") }}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
          <button
            onClick={() => setView("cards")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
              view === "cards" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:text-white"
            }`}
          >
            By Apartment
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
              view === "table" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:text-white"
            }`}
          >
            Flat List
          </button>
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search cheque #, bank..."
          searchKeys={["chequeNo", "bankName"]}
        />
      ) : (
        <ChequeUnitCards cheques={filtered} updateStatus={updateStatus} />
      )}
    </div>
  )
}

type ChequeAction =
  | { type: "clear"; cheque: ChequeRow }
  | { type: "reject"; cheque: ChequeRow }

function ChequeUnitCards({
  cheques,
  updateStatus,
}: {
  cheques: ChequeRow[]
  updateStatus: (id: string, status: string, extra?: Record<string, string>) => Promise<void> | void
}) {
  const [pendingAction, setPendingAction] = useState<ChequeAction | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [busyAction, setBusyAction] = useState(false)

  const runAction = async () => {
    if (!pendingAction) return
    setBusyAction(true)
    try {
      const tdy = new Date().toISOString().slice(0, 10)
      if (pendingAction.type === "clear") {
        await updateStatus(pendingAction.cheque.id, "Cleared", { clearedDate: tdy })
      } else {
        await updateStatus(pendingAction.cheque.id, "Bounced", { bouncedReason: rejectReason })
      }
      setPendingAction(null)
      setRejectReason("")
    } finally {
      setBusyAction(false)
    }
  }
  // Group cheques by unit (or "Unassigned" if no unit)
  const grouped = useMemo(() => {
    const map = new Map<string, { unitNo: string; tenantName: string; cheques: ChequeRow[] }>()
    for (const c of cheques) {
      const key = c.unit?.id || "no-unit"
      const unitNo = c.unit?.unitNo || "Unassigned"
      const tenantName = c.tenant?.name || "—"
      if (!map.has(key)) map.set(key, { unitNo, tenantName, cheques: [] })
      map.get(key)!.cheques.push(c)
    }
    return [...map.values()].sort((a, b) => a.unitNo.localeCompare(b.unitNo, undefined, { numeric: true }))
  }, [cheques])

  if (grouped.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
        No cheques match the current filters.
      </div>
    )
  }

  const today = new Date().toISOString().slice(0, 10)
  const fmtDateOnly = (s: string) => s ? formatDate(s) : "—"

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {grouped.map((g) => {
        const total = g.cheques.reduce((s, c) => s + (c.amount || 0), 0)
        const collected = g.cheques.filter((c) => c.status === "Cleared").reduce((s, c) => s + (c.amount || 0), 0)
        const pending = total - collected
        const dueToday = g.cheques.filter((c) => c.chequeDate === today && c.status !== "Cleared")
        const overdue = g.cheques.filter((c) => c.chequeDate && c.chequeDate < today && c.status !== "Cleared" && c.status !== "Replaced")

        return (
          <div key={g.unitNo} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            {/* Card header */}
            <div className="border-b border-slate-800 bg-slate-900 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">Unit {g.unitNo}</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{g.tenantName}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dueToday.length > 0 && (
                    <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                      {dueToday.length} due today
                    </span>
                  )}
                  {overdue.length > 0 && (
                    <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                      {overdue.length} overdue
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded bg-slate-800/60 px-2 py-1">
                  <p className="text-slate-500">Total</p>
                  <p className="font-semibold text-white">{formatCurrency(total)}</p>
                </div>
                <div className="rounded bg-emerald-500/10 px-2 py-1">
                  <p className="text-emerald-300/70">Collected</p>
                  <p className="font-semibold text-emerald-300">{formatCurrency(collected)}</p>
                </div>
                <div className="rounded bg-amber-500/10 px-2 py-1">
                  <p className="text-amber-300/70">Pending</p>
                  <p className="font-semibold text-amber-300">{formatCurrency(pending)}</p>
                </div>
              </div>
            </div>

            {/* Cheque ledger */}
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-slate-200">
                <thead className="bg-slate-900/80 text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold uppercase">Due Date</th>
                    <th className="px-2 py-1.5 text-left font-semibold uppercase">Channel</th>
                    <th className="px-2 py-1.5 text-left font-semibold uppercase">Cheque #</th>
                    <th className="px-2 py-1.5 text-left font-semibold uppercase">Bank</th>
                    <th className="px-2 py-1.5 text-right font-semibold uppercase">Amount</th>
                    <th className="px-2 py-1.5 text-left font-semibold uppercase">Status</th>
                    <th className="px-2 py-1.5 text-right font-semibold uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {g.cheques.map((c) => {
                    const isUpfront = c.paymentType === "Upfront"
                    const isOverdue = c.chequeDate && c.chequeDate < today && c.status !== "Cleared" && c.status !== "Replaced"
                    return (
                      <tr key={c.id} className={`border-t border-slate-800 ${isOverdue ? "bg-red-500/5" : ""}`}>
                        <td className="px-2 py-1.5">
                          {fmtDateOnly(c.chequeDate)}
                          {isUpfront && <span className="ml-1 text-[9px] text-blue-400">UPFRONT</span>}
                        </td>
                        <td className="px-2 py-1.5">{isUpfront && !c.chequeNo ? "Cash" : "Cheque"}</td>
                        <td className="px-2 py-1.5 font-mono">{c.chequeNo || "—"}</td>
                        <td className="px-2 py-1.5">{c.bankName || "—"}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{formatCurrency(c.amount)}</td>
                        <td className="px-2 py-1.5"><StatusBadge status={c.status} /></td>
                        <td className="px-2 py-1.5">
                          <div className="flex justify-end gap-1.5">
                            {c.status !== "Cleared" && c.status !== "Bounced" && c.status !== "Replaced" && (
                              <>
                                <button
                                  onClick={() => setPendingAction({ type: "clear", cheque: c })}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" /> Clear
                                </button>
                                <button
                                  onClick={() => { setRejectReason(""); setPendingAction({ type: "reject", cheque: c }) }}
                                  className="inline-flex items-center gap-1 rounded-md bg-red-600 hover:bg-red-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Reject
                                </button>
                              </>
                            )}
                            {(c.status === "Cleared" || c.status === "Bounced") && (
                              <span className="text-[10px] text-slate-500">— Final —</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Confirmation modal — replaces native browser confirm() */}
      <Modal
        open={!!pendingAction}
        onOpenChange={(o) => { if (!o && !busyAction) { setPendingAction(null); setRejectReason("") } }}
        title={pendingAction?.type === "clear" ? "Confirm: Mark as Cleared" : "Confirm: Reject Cheque"}
        size="md"
        footer={
          <>
            <ModalCancelButton onClick={() => { setPendingAction(null); setRejectReason("") }} />
            <button
              onClick={runAction}
              disabled={busyAction || (pendingAction?.type === "reject" && rejectReason.trim().length < 2)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-40 ${
                pendingAction?.type === "clear"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-red-600 hover:bg-red-500"
              }`}
            >
              {busyAction
                ? "Saving…"
                : pendingAction?.type === "clear"
                ? "✓ Confirm Clear"
                : "✕ Confirm Reject"}
            </button>
          </>
        }
      >
        {pendingAction && (
          <div className="space-y-4">
            <div className={`rounded-xl border p-4 ${
              pendingAction.type === "clear"
                ? "border-emerald-700/40 bg-emerald-900/10"
                : "border-red-700/40 bg-red-900/10"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                  pendingAction.type === "clear" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                }`}>
                  {pendingAction.type === "clear" ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    {pendingAction.type === "clear" ? "Mark this cheque as Cleared?" : "Reject this cheque?"}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div>
                      <span className="text-slate-500">Tenant:</span>{" "}
                      <span className="text-white">{pendingAction.cheque.tenant?.name || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Unit:</span>{" "}
                      <span className="text-white">{pendingAction.cheque.unit?.unitNo || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Cheque #:</span>{" "}
                      <span className="font-mono text-white">{pendingAction.cheque.chequeNo || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Bank:</span>{" "}
                      <span className="text-white">{pendingAction.cheque.bankName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Date:</span>{" "}
                      <span className="text-white">{pendingAction.cheque.chequeDate || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Amount:</span>{" "}
                      <span className={`font-semibold ${
                        pendingAction.type === "clear" ? "text-emerald-300" : "text-red-300"
                      }`}>{formatCurrency(pendingAction.cheque.amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {pendingAction.type === "reject" && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Reason for Rejection <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. insufficient funds, signature mismatch, post-dated"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-red-500/50"
                />
              </div>
            )}

            <div className="rounded-lg border border-blue-700/40 bg-blue-900/20 p-3 text-xs text-blue-200">
              ✉️ The tenant will be automatically emailed an updated payment statement
              showing total paid + remaining balance.
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
