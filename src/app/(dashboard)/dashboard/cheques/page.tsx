"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { HelpPanel } from "@/components/ui/help-panel"
import { TrackerTabs } from "@/components/ui/tracker-tabs"
import { UaeBankInput } from "@/components/ui/uae-bank-input"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Plus,
  Layers,
  ArrowRightCircle,
} from "lucide-react"

// Display alias — the spec calls the initial state "Received". We keep the
// stored status "Pending" for backward compatibility with rows seeded before
// the rename, but every user-facing badge / filter label reads "Received".
function displayStatusLabel(status: string): string {
  return status === "Pending" ? "Received" : status
}

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
  bouncedDate?: string
  depositedDate?: string
  depositRemarks?: string
  clearedDate: string
  notes: string
  parentId?: string | null
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
  const [allUnits, setAllUnits] = useState<Array<{ id: string; unitNo: string; status: string; currentRent: number; tenantId: string | null; tenant: { id: string; name: string } | null }>>([])
  const [contracts, setContracts] = useState<ContractLite[]>([])
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

      const [tRes, uRes, cRes] = await Promise.all([
        fetch("/api/tenants"),
        fetch("/api/units"),
        fetch("/api/tenancy-contracts"),
      ])
      if (tRes.ok) { const d = await tRes.json(); setTenants(d.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))) }
      if (uRes.ok) {
        const d = await uRes.json()
        setUnits(d.map((u: { id: string; unitNo: string }) => ({ id: u.id, unitNo: u.unitNo })))
        setAllUnits(d)
      }
      if (cRes.ok) {
        const d = await cRes.json()
        setContracts(d.contracts || [])
      }
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
    { key: "chequeDate", header: "Cheque Date", sortable: true, render: (r) => r.chequeDate ? formatDate(r.chequeDate) : "--" },
    { key: "amount", header: "Amount", sortable: true, render: (r) => formatCurrency(r.amount) },
    { key: "bankName", header: "Bank" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={displayStatusLabel(r.status)} /> },
    { key: "clearedDate", header: "Cleared On", render: (r) => r.clearedDate ? formatDate(r.clearedDate) : "--" },
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
      <TrackerTabs />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cheque Tracker</h1>
          <p className="mt-1 text-sm text-slate-400">{cheques.length} cheques on record</p>
        </div>
        <div className="flex gap-2">
          <HelpPanel
            title="Cheque Tracker — How it works"
            sections={[
              {
                title: "What this page does",
                body: (
                  <p>Track every rent cheque in the system — from receiving post-dated cheques (PDCs) to depositing, clearing, or marking bounced. Every tenant with cheques, plus cash-only tenants (no PDCs), appears here.</p>
                ),
              },
              {
                title: "KPI cards at top",
                body: (
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Total Cheques</strong> — all cheques ever received</li>
                    <li><strong>Received</strong> — in-hand, not deposited yet</li>
                    <li><strong>Cleared</strong> — money landed in bank ✓</li>
                    <li><strong>Bounced</strong> — cheque rejected by bank</li>
                  </ul>
                ),
              },
              {
                title: "Filters explained",
                body: (
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Status:</strong> pending (not yet processed), received (in hand), deposited (sent to bank), cleared (paid), bounced (rejected), replaced (after bounce, new cheque issued)</li>
                    <li><strong>When:</strong>
                      <ul className="list-disc pl-5 mt-1">
                        <li>📅 Due Today — cheques dated today</li>
                        <li>✓ Cleared Today — you cleared them today</li>
                        <li>🔴 Overdue — past-date, not cleared</li>
                        <li>This Week / Month / Next 30 Days</li>
                      </ul>
                    </li>
                    <li><strong>Payment Method:</strong>
                      <ul className="list-disc pl-5 mt-1">
                        <li><strong>All</strong> — every tenant</li>
                        <li>💳 <strong>Cheque</strong> — only tenants with at least one cheque</li>
                        <li>💵 <strong>Cash Only</strong> — tenants with zero cheques (cash payers)</li>
                      </ul>
                    </li>
                    <li><strong>Tenant:</strong> dropdown to pick one specific tenant</li>
                  </ul>
                ),
              },
              {
                title: "Two views",
                body: (
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>By Apartment</strong> (default) — cards grouped per unit/tenant, with their cheque ledger. Best for reviewing one tenant at a time.</li>
                    <li><strong>Flat List</strong> — every cheque in one sortable table. Best for bulk status updates.</li>
                  </ul>
                ),
              },
              {
                title: "Typical workflows",
                body: (
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Morning routine:</strong> Click <em>Due Today</em> → see cheques to deposit at the bank today → after depositing, mark them <em>Deposited</em>.</li>
                    <li><strong>After bank reconciliation:</strong> Bank confirms money in → mark cheques <em>Cleared</em> with today&apos;s date.</li>
                    <li><strong>Bounced cheque:</strong> Bank rejects → mark <em>Bounced</em> + reason → issue replacement cheque → mark old one <em>Replaced</em>.</li>
                    <li><strong>Cash collection:</strong> Click 💵 <em>Cash Only</em> → see all cash-paying tenants → record their payment manually (via tenant profile, or Payments page).</li>
                  </ul>
                ),
              },
              {
                title: "Buttons (top right)",
                body: (
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Bulk Add</strong> — create multiple cheques at once (e.g., 12 monthly PDCs for one tenant with auto-spaced dates)</li>
                    <li><strong>Add Cheque</strong> — one cheque at a time</li>
                  </ul>
                ),
              },
              {
                title: "Related pages",
                body: (
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Import Cheques (Excel)</strong> — upload a CSV with 5 columns to bulk import</li>
                    <li><strong>Import Lease Data (Full)</strong> — upload full lease Excel (236+ tenants × 12 cheques)</li>
                    <li><strong>Bank Reconciliation</strong> — upload bank statement → auto-match credits to cheques</li>
                  </ul>
                ),
              },
              {
                title: "Cheque status meanings",
                body: (
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Pending</strong> — cheque exists but not yet categorized</li>
                    <li><strong>Received</strong> — in hand, not deposited</li>
                    <li><strong>Deposited</strong> — sent to bank, waiting clearance</li>
                    <li><strong>Cleared</strong> — ✓ money in account</li>
                    <li><strong>Bounced</strong> — rejected by bank (reason stored)</li>
                    <li><strong>Replaced</strong> — replacement cheque issued after bounce</li>
                  </ul>
                ),
              },
            ]}
          />
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="Total Cheques" value={summary.total} subtitle={formatCurrency(summary.totalAmount)} color="blue" icon={<CreditCard className="h-5 w-5" />} />
          <KpiCard label="Received / PDC Holding" value={summary.received.count} subtitle={formatCurrency(summary.received.amount)} color="amber" icon={<CreditCard className="h-5 w-5" />} />
          <KpiCard label="Deposited" value={summary.deposited.count} subtitle={formatCurrency(summary.deposited.amount)} color="blue" icon={<CreditCard className="h-5 w-5" />} />
          <KpiCard label="Cleared" value={summary.cleared.count} subtitle={formatCurrency(summary.cleared.amount)} color="green" icon={<CheckCircle className="h-5 w-5" />} />
          <KpiCard label="Bounced" value={summary.bounced.count} subtitle={formatCurrency(summary.bounced.amount)} color="red" icon={<XCircle className="h-5 w-5" />} />
        </div>
      )}

      <ChequeFilters
        cheques={cheques}
        contracts={contracts}
        columns={columns}
        updateStatus={updateChequeStatus}
        allUnits={allUnits}
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
  contracts,
  columns,
  updateStatus,
  allUnits,
}: {
  cheques: ChequeRow[]
  contracts: ContractLite[]
  columns: Column<ChequeRow>[]
  updateStatus: (id: string, status: string, extra?: Record<string, string>) => Promise<void> | void
  allUnits: Array<{ id: string; unitNo: string; status: string; currentRent: number; tenantId: string | null; tenant: { id: string; name: string } | null }>
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [tenantFilter, setTenantFilter] = useState<string>("all")
  const [unitFilter, setUnitFilter] = useState<string>("all")
  const [search, setSearch] = useState<string>("")
  const [dateRange, setDateRange] = useState<string>("all")
  const [paymentMethod, setPaymentMethod] = useState<"all" | "cheque" | "cash">("all")
  const [view, setView] = useState<"cards" | "table">("cards")

  const today = new Date().toISOString().slice(0, 10)
  const thisMonthStart = today.slice(0, 7) + "-01"
  const in30 = new Date(); in30.setDate(in30.getDate() + 30)
  const in30Str = in30.toISOString().slice(0, 10)
  const in7 = new Date(); in7.setDate(in7.getDate() + 7)
  const in7Str = in7.toISOString().slice(0, 10)

  const tenantOptions = useMemo(() => {
    const m = new Map<string, string>()
    // All tenants who have a unit (not just those with cheques)
    for (const u of allUnits) {
      if (u.tenantId && u.tenant?.name) m.set(u.tenantId, u.tenant.name)
    }
    // Also include any tenant from cheques (covers edge cases)
    for (const c of cheques) {
      if (c.tenantId && c.tenant?.name && !m.has(c.tenantId)) m.set(c.tenantId, c.tenant.name)
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [cheques, allUnits])

  const unitOptions = useMemo(() => {
    const m = new Map<string, string>()
    // Honor the active tenant filter: when a tenant is selected, only show
    // their units so the dropdown stays manageable on a 364-tenant portfolio.
    for (const u of allUnits) {
      if (tenantFilter !== "all" && u.tenantId !== tenantFilter) continue
      m.set(u.id, u.unitNo)
    }
    for (const c of cheques) {
      if (tenantFilter !== "all" && c.tenantId !== tenantFilter) continue
      if (c.unit?.id && !m.has(c.unit.id)) m.set(c.unit.id, c.unit.unitNo || "")
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }))
  }, [cheques, allUnits, tenantFilter])

  const searchTerm = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    // Cash Only: show no cheques at all (card view seeds cash-only tenants)
    if (paymentMethod === "cash") return []
    return cheques.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false
      if (tenantFilter !== "all" && c.tenantId !== tenantFilter) return false
      if (unitFilter !== "all" && c.unit?.id !== unitFilter) return false
      if (searchTerm) {
        const haystack = [
          c.tenant?.name,
          c.unit?.unitNo,
          c.chequeNo,
          c.bankName,
          c.paymentType,
          c.status,
          String(c.amount || ""),
          c.notes,
        ].filter(Boolean).join(" ").toLowerCase()
        if (!haystack.includes(searchTerm)) return false
      }
      if (dateRange !== "all") {
        const d = c.chequeDate || ""
        if (!d) return false
        if (dateRange === "today" && d !== today) return false
        if (dateRange === "cleared-today" && c.clearedDate !== today) return false
        if (dateRange === "deposited-today" && c.depositedDate !== today) return false
        if (dateRange === "bounced-today" && c.bouncedDate !== today) return false
        if (dateRange === "overdue" && !(d < today && c.status !== "Cleared" && c.status !== "Replaced")) return false
        if (dateRange === "this-week" && !(d >= today && d <= in7Str)) return false
        if (dateRange === "this-month" && !(d >= thisMonthStart && d <= today.slice(0, 7) + "-31")) return false
        if (dateRange === "next-30" && !(d >= today && d <= in30Str)) return false
      }
      return true
    })
  }, [cheques, statusFilter, tenantFilter, unitFilter, searchTerm, dateRange, paymentMethod, today, thisMonthStart, in7Str, in30Str])

  // Exclude Replaced rows from the total so a Replacement / Bounce-Collect
  // doesn't double-count the same installment (parent + child).
  const filteredTotal = filtered.reduce((s, c) => s + (c.status === "Replaced" ? 0 : c.amount || 0), 0)

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
            {/* "Pending" is the stored value for newly-seeded cheques (legacy
                + still emitted by the seed path); the spec calls this state
                "Received". One filter button covers both. */}
            <StatusButton value="Pending" label="Received" />
            <StatusButton value="Deposited" label="Deposited" />
            <StatusButton value="Cleared" label="Cleared" />
            <StatusButton value="Bounced" label="Bounced" />
            <StatusButton value="Replaced" label="Replaced" />
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">When</p>
          <div className="flex flex-wrap gap-1.5">
            <DateButton value="all" label="Anytime" />
            <DateButton value="today" label="📅 Due Today" />
            <DateButton value="deposited-today" label="🏦 Deposited Today" />
            <DateButton value="cleared-today" label="✓ Cleared Today" />
            <DateButton value="bounced-today" label="✕ Bounced Today" />
            <DateButton value="overdue" label="🔴 Overdue" />
            <DateButton value="this-week" label="This Week" />
            <DateButton value="this-month" label="This Month" />
            <DateButton value="next-30" label="Next 30 Days" />
          </div>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Payment Method</p>
          <div className="flex flex-wrap gap-1.5">
            {(() => {
              const tenantsWithCheques = new Set(cheques.map((c) => c.tenantId).filter(Boolean))
              const totalTenants = allUnits.filter((u) => u.tenantId).length
              const chequeTenantCount = tenantsWithCheques.size
              const cashTenantCount = totalTenants - chequeTenantCount
              const counts = { all: totalTenants, cheque: chequeTenantCount, cash: cashTenantCount }
              return (["all", "cheque", "cash"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    paymentMethod === m
                      ? m === "cash" ? "bg-green-500 text-white" : "bg-amber-500 text-slate-900"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {m === "all" ? "All" : m === "cheque" ? "💳 Cheque" : "💵 Cash Only"}
                  <span className="ml-1.5 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-semibold">
                    {counts[m]}
                  </span>
                </button>
              ))
            })()}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Search</p>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tenant, unit #, cheque #, bank, amount, notes..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 pr-8 text-sm text-white outline-none focus:border-amber-500/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tenant</p>
            <select
              value={tenantFilter}
              onChange={(e) => { setTenantFilter(e.target.value); setUnitFilter("all") }}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            >
              <option value="all">All tenants ({tenantOptions.length})</option>
              {tenantOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Unit</p>
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            >
              <option value="all">All units ({unitOptions.length})</option>
              {unitOptions.map(([id, unitNo]) => (
                <option key={id} value={id}>{unitNo}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-end justify-end gap-3 text-xs text-slate-400">
          <span>
            Showing <strong className="text-white">{filtered.length}</strong> cheques
            {(statusFilter !== "all" || tenantFilter !== "all" || unitFilter !== "all" || dateRange !== "all" || searchTerm) && ` of ${cheques.length}`}
          </span>
          <span className="text-amber-400 font-semibold">{formatCurrency(filteredTotal)}</span>
          {(statusFilter !== "all" || tenantFilter !== "all" || unitFilter !== "all" || dateRange !== "all" || searchTerm) && (
            <button
              onClick={() => { setStatusFilter("all"); setTenantFilter("all"); setUnitFilter("all"); setDateRange("all"); setSearch("") }}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              Clear filters
            </button>
          )}
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
        <ChequeUnitCards
          cheques={filtered}
          contracts={contracts}
          updateStatus={updateStatus}
          allUnits={(() => {
            // Start from the payment-method base set (cheque-only / cash-only / all),
            // then apply tenant/unit/search filters so the card grid mirrors the
            // table view's universal filters.
            const base = paymentMethod === "cheque"
              ? allUnits.filter((u) => cheques.some((c) => c.unit?.id === u.id))
              : paymentMethod === "cash"
                ? allUnits.filter((u) => u.tenantId && !cheques.some((c) => c.unit?.id === u.id))
                : allUnits
            return base.filter((u) => {
              if (tenantFilter !== "all" && u.tenantId !== tenantFilter) return false
              if (unitFilter !== "all" && u.id !== unitFilter) return false
              if (searchTerm) {
                const haystack = [u.unitNo, u.tenant?.name].filter(Boolean).join(" ").toLowerCase()
                if (!haystack.includes(searchTerm)) return false
              }
              return true
            })
          })()}
          showCashOnly={
            paymentMethod === "cash" ||
            (paymentMethod === "all" && statusFilter === "all" && tenantFilter === "all" && unitFilter === "all" && dateRange === "all" && !searchTerm)
          }
        />
      )}
    </div>
  )
}

type ReverseSubtype = "" | "ReplacementCash" | "ReplacementCheque" | "Bounced" | "Partial"
type ChequeAction =
  | { type: "deposit"; cheque: ChequeRow }
  | { type: "clear"; cheque: ChequeRow }
  | { type: "reverse"; cheque: ChequeRow }
  // Bounce-collection: when a cheque is already Bounced, "Reverse" jumps straight to collecting full amount.
  // When peId is set, the bounce-collect operates on a specific Partial event row instead of the parent cheque.
  | { type: "bounce-collect"; cheque: ChequeRow; peId?: string }
  // Cash collected from tenant, now staff is recording the bank deposit into the owner's account.
  | { type: "deposit-to-owner"; cheque: ChequeRow }
  // Time-bound undo of the most recent EVENT line on a cheque's history.
  | { type: "undo-last"; cheque: ChequeRow }

type ContractLite = {
  id: string
  tenantId: string
  unitId: string | null
  ownerId?: string | null
  contractType: string
  securityDeposit: number
  ejariFee: number
  commissionFee: number
  notes: string | null
}

// Parses a JSON-encoded payment block from contract.notes (UPFRONT_JSON, DEPOSIT_JSON, FEES_JSON).
function parseNotesBlock(notes: string | null | undefined, prefix: string): Record<string, unknown> | null {
  if (!notes) return null
  for (const line of notes.split('\n')) {
    if (line.startsWith(prefix)) {
      try { return JSON.parse(line.slice(prefix.length)) } catch { return null }
    }
  }
  return null
}

// Append a structured event line to a cheque's notes.
// Format: EVENT:<ISO-timestamp>|<type>|<detail>
// We always store a full ISO timestamp (including time) so events that share
// the same calendar date still sort by insertion order in the history modal.
// `dateOrIso` accepts either YYYY-MM-DD (we append the current wall-clock time)
// or a full ISO datetime.
function appendEvent(notes: string | null | undefined, type: string, detail: string, dateOrIso: string): string {
  let ts = dateOrIso
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) {
    // Date-only — combine with the current time so multiple same-day events
    // can still be ordered correctly.
    ts = `${ts}T${new Date().toISOString().slice(11, 19)}`
  }
  const line = `EVENT:${ts}|${type}|${detail.replace(/\|/g, " ")}`
  return `${(notes || "").trim()}\n${line}`.trim()
}

// Per-partial event tracking — each partial collection has its own status flow.
//   PE:<id>|<date>|<amount>|<method>|<chequeNo>|<bank>|<status>|<bankedDate>
type PartialEvent = {
  id: string
  date: string
  amount: number
  method: "Cash" | "Cheque"
  chequeNo: string
  bank: string
  status: "Received" | "Pending" | "Deposited" | "Cleared" | "Bounced"
  bankedDate: string
}
function parsePartialEvents(notes: string | null | undefined): PartialEvent[] {
  if (!notes) return []
  const out: PartialEvent[] = []
  for (const m of notes.matchAll(/PE:([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^\n]*)/g)) {
    out.push({
      id: m[1],
      date: m[2],
      amount: parseFloat(m[3]) || 0,
      method: (m[4] as PartialEvent["method"]) || "Cash",
      chequeNo: m[5] || "",
      bank: m[6] || "",
      status: (m[7] as PartialEvent["status"]) || "Received",
      bankedDate: m[8] || "",
    })
  }
  return out
}
function serializePartialEvent(e: PartialEvent): string {
  return `PE:${e.id}|${e.date}|${e.amount}|${e.method}|${e.chequeNo}|${e.bank}|${e.status}|${e.bankedDate}`
}
function replacePartialEvent(notes: string, e: PartialEvent): string {
  const without = notes.split("\n").filter((l) => !new RegExp(`^PE:${e.id}\\|`).test(l)).join("\n").trim()
  return `${without}\n${serializePartialEvent(e)}`.trim()
}

// Ensures the cheque's ORIGINAL details are recorded as an ISSUED event before
// any replacement / bounce / partial mutates the chequeNo / amount fields.
// Without this, replacements would erase the audit of "this used to be cheque #X".
function ensureIssuedEvent(notes: string | null | undefined, c: { chequeNo: string; bankName: string; chequeDate: string; amount: number; sequenceNo: number }): string {
  // Anchor to start-of-line so we don't false-positive on `PARTIAL_EVENT:` substrings.
  if (/(?:^|\n)EVENT:[^|]*\|ISSUED\|/.test(notes || "")) return notes || ""
  const date = c.chequeDate || ""
  const ref = c.chequeNo ? `#${c.chequeNo}` : `seq ${c.sequenceNo}`
  const detail = `${ref} · ${c.bankName || "—"} · AED ${(c.amount || 0).toLocaleString()}`
  return appendEvent(notes, "ISSUED", detail, date)
}

// Map event types to icon + human label
const EVENT_META: Record<string, { icon: string; label: string }> = {
  ISSUED: { icon: "📅", label: "Cheque issued" },
  DEPOSITED: { icon: "🏦", label: "Deposited at bank" },
  CLEARED: { icon: "✓", label: "Cleared" },
  BOUNCED: { icon: "✕", label: "Bounced" },
  REPLACED_BY_CASH: { icon: "🔄", label: "Replaced by Cash" },
  REPLACED_BY_CHEQUE: { icon: "🔄", label: "Replaced by new Cheque" },
  PARTIAL_CASH: { icon: "💰", label: "Partial collected — Cash" },
  PARTIAL_CHEQUE: { icon: "💰", label: "Partial collected — Cheque" },
  BANKED_TO_OWNER: { icon: "💼", label: "Banked to Owner" },
  COLLECTED_AFTER_BOUNCE_CASH: { icon: "💰", label: "Bounce collected — Cash" },
  COLLECTED_AFTER_BOUNCE_CHEQUE: { icon: "💰", label: "Bounce collected — Cheque" },
  SLIP_UPLOADED: { icon: "📎", label: "Slip uploaded" },
  DELTA: { icon: "Δ", label: "Amount adjusted" },
  PE_BOUNCED: { icon: "✕", label: "Partial Bounced" },
  PE_BOUNCE_COLLECTED: { icon: "💰", label: "Partial Bounce collected" },
  UNDONE: { icon: "↶", label: "Action undone" },
}

// Builds a chronological lifecycle log for a cheque. Reads:
//   1. EVENT:<date>|<type>|<detail> lines (canonical, written by appendEvent)
//   2. Legacy fields (chequeDate, depositedDate, clearedDate, bouncedDate, OWNER_DEPOSITED, PARTIAL_*)
//      — kept for backwards compat with rows created before the EVENT log existed.
function buildChequeHistory(c: ChequeRow): { date: string; label: string; detail: string; icon: string }[] {
  type Entry = { date: string; label: string; detail: string; icon: string; sortKey: string }
  const entries: Entry[] = []
  const seen = new Set<string>()

  // 1) Canonical EVENT lines (timestamp may be YYYY-MM-DD or full ISO).
  // Anchored to start-of-line so the "EVENT:" substring inside legacy
  // `PARTIAL_EVENT:` lines doesn't get misparsed as a canonical event.
  // Final sort happens via each entry's sortKey at the end of this function,
  // so we don't need to pre-sort here.
  const eventLines = [...(c.notes || "").matchAll(/(?:^|\n)EVENT:([^|]*)\|([^|]+)\|([^\n]*)/g)]
  for (const m of eventLines) {
    const [, ts, type, detail] = m
    const meta = EVENT_META[type] || { icon: "•", label: type }
    // Display only the date portion (YYYY-MM-DD) — the time is just for ordering.
    const displayDate = (ts || "").slice(0, 10)
    const key = `${ts}|${type}|${detail}`
    if (seen.has(key)) continue
    seen.add(key)
    // ISSUED is always conceptually first, even when chequeDate is post-dated
    // (its visible date may be in the future, but it predates every action).
    const sortKey = type === "ISSUED" ? "0" : (ts || displayDate)
    entries.push({ date: displayDate, label: meta.label, detail: detail || "—", icon: meta.icon, sortKey })
  }

  // 2) Legacy fallbacks — only add if the corresponding canonical event isn't already in seen
  const seenTypes = new Set([...eventLines].map((m) => m[2]))
  if (c.chequeDate && !seenTypes.has("ISSUED")) {
    entries.push({ date: c.chequeDate, label: "Cheque issued", detail: `${c.chequeNo ? `#${c.chequeNo}` : "no cheque #"} · ${c.bankName || "—"} · AED ${(c.amount || 0).toLocaleString()}`, icon: "📅", sortKey: "0" })
  }
  if (c.depositedDate && !seenTypes.has("DEPOSITED")) {
    entries.push({ date: c.depositedDate, label: "Deposited at bank", detail: c.depositRemarks || "Submitted, awaiting clearance", icon: "🏦", sortKey: c.depositedDate })
  }
  // Bounce-collect resolution markers — when a cheque was bounced and then
  // collected by Cash/Cheque, the bouncedReason has the suffix appended (see
  // line 1230). We detect that suffix here so the legacy clearedDate can be
  // rendered as "Bounce collected — …" instead of generic "Cleared", and the
  // bounced reason is shown without the resolution suffix.
  const reasonRaw = c.bouncedReason || ""
  const isBounceCollectedCash = /—\s*collected by Cash\b/i.test(reasonRaw)
  const isBounceCollectedCheque = /—\s*replaced by new Cheque\b/i.test(reasonRaw)
  const cleanedBounceReason = reasonRaw.replace(/\s*—\s*(collected by Cash|collected by Cheque|replaced by Cash|replaced by new Cheque).*$/i, "").trim() || "—"

  // Skip Cleared legacy fallback if a REPLACED_BY_CASH or BOUNCE-COLLECT event
  // is already in the log — those imply clearance, so a separate Cleared entry
  // would just duplicate the same fact.
  const clearedAlreadyImplied =
    seenTypes.has("CLEARED") ||
    seenTypes.has("REPLACED_BY_CASH") ||
    seenTypes.has("COLLECTED_AFTER_BOUNCE_CASH") ||
    seenTypes.has("COLLECTED_AFTER_BOUNCE_CHEQUE")
  if (c.clearedDate && !clearedAlreadyImplied) {
    if (isBounceCollectedCash) {
      entries.push({ date: c.clearedDate, label: "Bounce collected — Cash", detail: "Cash settled the bounce", icon: "💰", sortKey: `${c.clearedDate}_2` })
    } else if (isBounceCollectedCheque) {
      entries.push({ date: c.clearedDate, label: "Bounce collected — Cheque", detail: c.chequeNo ? `New #${c.chequeNo} settled the bounce` : "New cheque settled the bounce", icon: "💰", sortKey: `${c.clearedDate}_2` })
    } else {
      entries.push({ date: c.clearedDate, label: "Cleared", detail: c.bankName ? `via ${c.bankName}` : "Funds credited", icon: "✓", sortKey: c.clearedDate })
    }
  }
  if (c.bouncedDate && !seenTypes.has("BOUNCED")) {
    // sortKey suffix "_1" so legacy Bounced sorts before legacy Cleared /
    // Bounce-collected on the same day — a cheque cannot bounce after clearing.
    entries.push({ date: c.bouncedDate, label: "Bounced", detail: cleanedBounceReason, icon: "✕", sortKey: `${c.bouncedDate}_1` })
  }
  // Legacy per-event partial entries
  const partialEvents = [...(c.notes || "").matchAll(/PARTIAL_EVENT:([^|]*)\|([^|]*)\|([^\s]*)/g)]
  for (const m of partialEvents) {
    const [, evDate, evAmt, evMethod] = m
    if (seenTypes.has(`PARTIAL_${(evMethod || "CASH").toUpperCase()}`)) continue
    entries.push({
      date: evDate || "",
      label: `Partial collected — ${evMethod || "Cash"}`,
      detail: `AED ${parseFloat(evAmt || "0").toLocaleString()}`,
      icon: "💰",
      sortKey: evDate || "",
    })
  }
  if (partialEvents.length === 0 && !seenTypes.has("PARTIAL_CASH") && !seenTypes.has("PARTIAL_CHEQUE")) {
    const partialMatch = (c.notes || "").match(/PARTIAL_COLLECTED:(\d+(?:\.\d+)?)/)
    if (partialMatch) entries.push({ date: c.chequeDate || "", label: "Partial collected (cumulative)", detail: `AED ${parseFloat(partialMatch[1]).toLocaleString()} of AED ${(c.amount || 0).toLocaleString()}`, icon: "💰", sortKey: c.chequeDate || "" })
  }
  const ownerMatch = (c.notes || "").match(/OWNER_DEPOSITED:([^\s]+)/)
  if (ownerMatch && !seenTypes.has("BANKED_TO_OWNER")) {
    entries.push({ date: ownerMatch[1], label: "Banked to Owner", detail: "Cash deposited into owner account", icon: "💼", sortKey: ownerMatch[1] })
  }
  // Heuristic for old replacements based on bouncedReason text
  if (!seenTypes.has("REPLACED_BY_CASH") && /replaced by cash/i.test(c.bouncedReason || "")) {
    entries.push({ date: c.clearedDate || "", label: "Replaced by Cash", detail: c.bouncedReason || "", icon: "🔄", sortKey: c.clearedDate || "" })
  }
  if (!seenTypes.has("REPLACED_BY_CHEQUE") && /replaced by new cheque/i.test(c.bouncedReason || "")) {
    entries.push({ date: c.chequeDate || "", label: "Replaced by new Cheque", detail: `${c.chequeNo ? `New #${c.chequeNo} · ` : ""}${c.bankName || ""}`, icon: "🔄", sortKey: c.chequeDate || "" })
  }

  // Sort by full timestamp (canonical events keep insertion order on same-day);
  // strip the sortKey from the returned entries.
  return entries
    .sort((a, b) => (a.sortKey || "").localeCompare(b.sortKey || ""))
    .map(({ sortKey: _sk, ...rest }) => rest)
}

// Read-only status date display (label + date). Edits happen via the action
// modals so the lifecycle stays linear and auditable.
function StatusDateCell({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col items-start text-left">
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      <span className="text-[12px] font-medium text-slate-200">
        {value || <span className="text-slate-600 italic">—</span>}
      </span>
    </div>
  )
}

function ChequeUnitCards({
  cheques,
  contracts,
  updateStatus,
  allUnits,
  showCashOnly = true,
}: {
  cheques: ChequeRow[]
  contracts: ContractLite[]
  updateStatus: (id: string, status: string, extra?: Record<string, string>) => Promise<void> | void
  allUnits: Array<{ id: string; unitNo: string; status: string; currentRent: number; tenantId: string | null; tenant: { id: string; name: string } | null }>
  showCashOnly?: boolean
}) {
  const [pendingAction, setPendingAction] = useState<ChequeAction | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [bouncedDate, setBouncedDate] = useState("")
  const [depositDate, setDepositDate] = useState("")
  const [depositRemarks, setDepositRemarks] = useState("")
  const [depositSlipFile, setDepositSlipFile] = useState<File | null>(null)
  const [clearDate, setClearDate] = useState("")
  // Per spec: Clear step requires evidence — either a bank-statement
  // upload OR explanatory notes (e.g. "cheque cleared by SMS confirmation,
  // attachment unavailable"). Confirm is gated on at least one being present.
  const [clearStatementFile, setClearStatementFile] = useState<File | null>(null)
  const [clearNotes, setClearNotes] = useState("")
  const [busyAction, setBusyAction] = useState(false)
  // Reverse-modal extras
  const [reverseSubtype, setReverseSubtype] = useState<ReverseSubtype>("")
  const [reverseAmount, setReverseAmount] = useState("")
  const [reverseDate, setReverseDate] = useState("")
  const [reverseChequeNo, setReverseChequeNo] = useState("")
  const [reverseChequeBank, setReverseChequeBank] = useState("")
  const [reverseChequeDate, setReverseChequeDate] = useState("")
  const [reverseSlipFile, setReverseSlipFile] = useState<File | null>(null)
  // Bounce-collection (after a cheque already bounced)
  const [collectMethod, setCollectMethod] = useState<"" | "Cash" | "Cheque">("")
  // Force-partial flow: when user clicks "Collect More" on a partial-pending row,
  // lock the subtype dropdown to Partial AND lock the amount to the remaining balance.
  const [forcePartial, setForcePartial] = useState(false)
  const [historyFor, setHistoryFor] = useState<ChequeRow | null>(null)
  // Action: bank Security Deposit / Admin+Ejari Fees cash to owner account.
  const [extraDepositAction, setExtraDepositAction] = useState<null | {
    contractId: string
    kind: "deposit" | "fees"
    amount: number
    label: string
    tenantId: string
    unitId: string
    ownerId: string | null
  }>(null)
  const [extraDepDate, setExtraDepDate] = useState("")
  const [extraDepSlip, setExtraDepSlip] = useState<File | null>(null)
  const [extraDepNotes, setExtraDepNotes] = useState("")
  const [extraDepBusy, setExtraDepBusy] = useState(false)

  const todayStr = () => new Date().toISOString().slice(0, 10)
  // Centralised invoice generator for any installment-style payment cleared via cash/cheque.
  // Called from runAction whenever a payment reaches a Cleared state.
  const generateInstallmentInvoice = async (
    c: ChequeRow,
    amount: number,
    date: string,
    eventTag: string
  ) => {
    if (!c.tenantId || !amount || amount <= 0) return
    try {
      const ctr = contracts.find((x) => (c.tenantId && x.tenantId === c.tenantId) || (c.unitId && x.unitId === c.unitId))
      const isCommercial = (ctr?.contractType || "").toLowerCase() === "commercial"
      const refLabel = c.chequeNo ? `Cheque #${c.chequeNo}` : `Sequence ${c.sequenceNo}`
      const installLabel = c.paymentType === "Upfront"
        ? "Rent (Upfront)"
        : `Rent (Installment ${c.sequenceNo} of ${c.totalCheques})`
      await fetch("/api/invoices/auto-vat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: c.tenantId,
          unitId: c.unitId,
          type: installLabel,
          baseAmount: amount,
          vatRate: isCommercial ? 0.05 : 0,
          paymentDate: date,
          notes: `${refLabel} · ${eventTag}`,
          sourceRef: `cheque-${c.id}-${eventTag}`,
          sendEmail: true,
        }),
      }).catch(() => {})
    } catch { /* non-blocking */ }
  }

  // Per spec section 3 (data model + ordering rule): Replacement / Bounce-Collect
  // must NOT mutate the parent row's identity. Instead, the parent stays as an
  // immutable audit anchor (status="Replaced") and a new linked row is created
  // with parentId=parent.id. The new row inherits the parent's sequenceNo so
  // the [sequenceNo asc, createdAt asc] sort places it directly under the parent.
  const createChildCheque = async (
    parent: ChequeRow,
    child: {
      chequeNo: string
      bankName: string
      chequeDate: string
      amount: number
      paymentType?: string
      issuedDetail: string
    }
  ): Promise<{ id: string } | null> => {
    try {
      const nowIso = new Date().toISOString().slice(0, 19)
      const childNotes = `EVENT:${nowIso}|ISSUED|${child.issuedDetail}`
      const res = await fetch("/api/cheques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: parent.tenantId,
          unitId: parent.unitId,
          chequeNo: child.chequeNo,
          chequeDate: child.chequeDate,
          amount: child.amount,
          bankName: child.bankName,
          status: "Received",
          paymentType: child.paymentType || parent.paymentType || "Rent",
          periodFrom: parent.periodFrom || "",
          periodTo: parent.periodTo || "",
          sequenceNo: parent.sequenceNo,
          totalCheques: parent.totalCheques,
          notes: childNotes,
          parentId: parent.id,
        }),
      })
      if (!res.ok) return null
      return await res.json()
    } catch { return null }
  }

  const resetActionState = () => {
    setPendingAction(null)
    setRejectReason("")
    setBouncedDate("")
    setDepositDate("")
    setDepositRemarks("")
    setDepositSlipFile(null)
    setClearDate("")
    setClearStatementFile(null)
    setClearNotes("")
    setReverseSubtype("")
    setReverseAmount("")
    setReverseDate("")
    setReverseChequeNo("")
    setReverseChequeBank("")
    setReverseChequeDate("")
    setReverseSlipFile(null)
    setCollectMethod("")
    setForcePartial(false)
  }

  const runAction = async () => {
    if (!pendingAction) return
    setBusyAction(true)
    try {
      if (pendingAction.type === "deposit") {
        const c = pendingAction.cheque
        const date = depositDate || todayStr()
        const refLabel = `Cheque ${c.chequeNo ? `#${c.chequeNo}` : `seq ${c.sequenceNo}`}`
        const baseNotes = ensureIssuedEvent(c.notes, c)
        // Cash flow is one step (Received → Deposit clicked → Cleared); cheque
        // flow is two (Received → Deposit → Deposited → Clear → Cleared). We
        // detect cash payments by the synthetic "Cash" bank set during
        // Bounce-Collect-Cash / Replacement-By-Cash.
        const isCashPayment = (c.bankName || "").toLowerCase() === "cash"
        if (isCashPayment) {
          const newNotes = appendEvent(baseNotes, "CLEARED", `${refLabel} · AED ${(c.amount || 0).toLocaleString()} cash banked`, date)
          await updateStatus(c.id, "Cleared", {
            clearedDate: date,
            depositedDate: date,
            depositRemarks,
            notes: newNotes,
          })
          // Note: the auto-VAT invoice for cash payments is fired at the
          // RECEIVE step (Bounce-Collect-Cash / Replacement-By-Cash) — that's
          // when the tenant actually paid. Banking the cash is internal.
        } else {
          const newNotes = appendEvent(baseNotes, "DEPOSITED", `${refLabel} → ${c.bankName || "bank"} · ${depositRemarks || "awaiting clearance"}`, date)
          await updateStatus(c.id, "Deposited", {
            depositedDate: date,
            depositRemarks,
            notes: newNotes,
          })
        }
        if (depositSlipFile && c.tenant?.id) {
          const fd = new FormData()
          fd.append('file', depositSlipFile)
          fd.append('tenantId', c.tenant.id)
          fd.append('docType', `Deposit-Slip-Cheque-${c.id}`)
          await fetch('/api/documents/upload', { method: 'POST', body: fd }).catch(() => {})
        }
      } else if (pendingAction.type === "clear") {
        const date = clearDate || todayStr()
        const c = pendingAction.cheque
        const refLabel = `Cheque ${c.chequeNo ? `#${c.chequeNo}` : `seq ${c.sequenceNo}`}`
        const baseNotes = ensureIssuedEvent(c.notes, c)
        // Spec requires either a bank-statement upload OR explanatory notes
        // when clearing. The note is appended to the CLEARED event detail so
        // it shows up directly in the lifecycle modal; the statement file
        // (if any) is uploaded as a tenant document.
        const noteSuffix = clearNotes.trim() ? ` · ${clearNotes.trim()}` : (clearStatementFile ? ` · statement attached` : "")
        const newNotes = appendEvent(baseNotes, "CLEARED", `${refLabel} · AED ${(c.amount || 0).toLocaleString()} via ${c.bankName || "bank"}${noteSuffix}`, date)
        await updateStatus(c.id, "Cleared", { clearedDate: date, notes: newNotes })
        if (clearStatementFile && c.tenant?.id) {
          const fd = new FormData()
          fd.append('file', clearStatementFile)
          fd.append('tenantId', c.tenant.id)
          fd.append('docType', `Bank-Statement-Cheque-${c.id}`)
          await fetch('/api/documents/upload', { method: 'POST', body: fd }).catch(() => {})
        }
        // Auto-generate Rent invoice for this cleared installment
        try {
          const ctr = contracts.find((x) => (c.tenantId && x.tenantId === c.tenantId) || (c.unitId && x.unitId === c.unitId))
          const isCommercial = (ctr?.contractType || "").toLowerCase() === "commercial"
          const installLabel = c.paymentType === "Upfront" ? "Rent (Upfront)" : `Rent (Installment ${c.sequenceNo} of ${c.totalCheques})`
          await fetch("/api/invoices/auto-vat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantId: c.tenantId,
              unitId: c.unitId,
              type: installLabel,
              baseAmount: c.amount,
              vatRate: isCommercial ? 0.05 : 0,
              paymentDate: date,
              notes: `${refLabel} cleared via ${c.bankName || "bank"}`,
              sourceRef: `cheque-${c.id}-cleared`,
              sendEmail: true,
            }),
          }).catch(() => {})
        } catch { /* non-blocking */ }
      } else if (pendingAction.type === "reverse") {
        const c = pendingAction.cheque
        const date = reverseDate || todayStr()
        const amt = parseFloat(reverseAmount || String(c.amount)) || c.amount
        const oldRef = `Cheque ${c.chequeNo ? `#${c.chequeNo}` : `seq ${c.sequenceNo}`}`
        let baseNotesR = ensureIssuedEvent(c.notes, c)
        // Stamp a DELTA event if the replacement / partial amount differs
        // from the original — keeps the audit trail explicit about over-/
        // under-collected sums (e.g. when a late fee is added to the
        // replacement cheque).
        const original = c.amount || 0
        if (reverseSubtype !== "Partial" && Math.abs(amt - original) >= 0.01) {
          const sign = amt > original ? "+" : "−"
          const diff = Math.abs(amt - original)
          baseNotesR = appendEvent(baseNotesR, "DELTA", `${oldRef} · original AED ${original.toLocaleString()} → new AED ${amt.toLocaleString()} (${sign}AED ${diff.toLocaleString()})`, date)
        }
        if (reverseSubtype === "ReplacementCash") {
          // Per spec section 10: replacement creates a NEW LINKED payment.
          // Parent stays as an immutable audit anchor (status="Replaced");
          // child carries the active lifecycle (Received → Deposit → Cleared).
          // Auto-VAT invoice fires on the parent's installment ref (cash is in
          // hand at the receive step).
          const child = await createChildCheque(c, {
            chequeNo: "",
            bankName: "Cash",
            chequeDate: c.chequeDate,
            amount: amt,
            issuedDetail: `Cash replacement of ${oldRef} · AED ${amt.toLocaleString()}`,
          })
          const parentNotes = appendEvent(baseNotesR, "REPLACED_BY_CASH", `${oldRef} → cash replacement · AED ${amt.toLocaleString()}${child ? ` (new id ${child.id})` : ""}`, date)
          await updateStatus(c.id, "Replaced", {
            bouncedReason: "Replaced by Cash",
            notes: parentNotes,
          })
          await generateInstallmentInvoice(c, amt, date, "ReplacedByCash")
        } else if (reverseSubtype === "ReplacementCheque") {
          // Same shape as Replacement Cash — new child carries the active
          // cheque lifecycle, parent locked at Replaced.
          const child = await createChildCheque(c, {
            chequeNo: reverseChequeNo,
            bankName: reverseChequeBank,
            chequeDate: reverseChequeDate || date,
            amount: amt,
            issuedDetail: `Cheque replacement of ${oldRef} · #${reverseChequeNo} · ${reverseChequeBank} · AED ${amt.toLocaleString()}`,
          })
          const parentNotes = appendEvent(baseNotesR, "REPLACED_BY_CHEQUE", `${oldRef} → New #${reverseChequeNo} · ${reverseChequeBank} · AED ${amt.toLocaleString()}${child ? ` (new id ${child.id})` : ""}`, date)
          await updateStatus(c.id, "Replaced", {
            bouncedReason: "Replaced by new Cheque",
            notes: parentNotes,
          })
        } else if (reverseSubtype === "Bounced") {
          const newNotes = appendEvent(baseNotesR, "BOUNCED", `${oldRef} · ${rejectReason}`, date)
          await updateStatus(c.id, "Bounced", {
            bouncedDate: date,
            bouncedReason: rejectReason,
            notes: newNotes,
          })
        } else if (reverseSubtype === "Partial") {
          const collectedSoFar = (typeof c.notes === "string" && c.notes.match(/PARTIAL_COLLECTED:(\d+(?:\.\d+)?)/)?.[1]) || "0"
          const newCollected = parseFloat(collectedSoFar) + amt
          const remaining = (c.amount || 0) - newCollected
          const cleanedNotes = baseNotesR.replace(/PARTIAL_COLLECTED:[^\n]*/g, "").trim()
          const eventType = collectMethod === "Cheque" ? "PARTIAL_CHEQUE" : "PARTIAL_CASH"
          const eventDetail = collectMethod === "Cheque"
            ? `${oldRef} · AED ${amt.toLocaleString()} via #${reverseChequeNo} ${reverseChequeBank}`
            : `${oldRef} · AED ${amt.toLocaleString()} cash`
          // Append a PE: line to track this partial's own status flow.
          const peId = `pe${Date.now()}`
          // Per spec: initial state for ALL payments is "Received". Both cash
          // and cheque PEs start there; cheque PEs progress Received → Deposited
          // → Cleared, cash PEs go Received → Cleared via Deposit Cash.
          const peLine = `PE:${peId}|${date}|${amt}|${collectMethod || "Cash"}|${reverseChequeNo || ""}|${reverseChequeBank || ""}|Received|`
          let withEvent = `${cleanedNotes}\nPARTIAL_COLLECTED:${newCollected}\n${peLine}`.trim()
          withEvent = appendEvent(withEvent, eventType, eventDetail, date)
          const isFullyCollected = remaining <= 0
          if (isFullyCollected) withEvent = appendEvent(withEvent, "CLEARED", `${oldRef} fully collected (AED ${(c.amount || 0).toLocaleString()})`, date)
          await updateStatus(c.id, isFullyCollected ? "Cleared" : "Partial", {
            notes: withEvent,
            ...(isFullyCollected ? { clearedDate: date } : {}),
            ...(collectMethod === "Cash" ? { bankName: collectMethod === "Cash" ? "Cash" : (c.bankName || "") } : {}),
          })
          // Auto-VAT invoice rules per partial event:
          //   - Partial Cash    → fire NOW (cash physically in hand)
          //   - Partial Cheque  → defer; fire when the PE event hits Cleared
          //     (real money only arrives after the partial cheque clears)
          // We use the PE-${peId} sourceRef shape that updatePartialEvent also
          // uses, so the two pathways de-dupe at the auto-vat endpoint.
          if (collectMethod === "Cash") {
            await generateInstallmentInvoice(c, amt, date, `PE-${peId}`)
          }
        }
        // Slip upload for cheque-replacement / partial-cheque
        if (reverseSlipFile && pendingAction.cheque.tenant?.id) {
          const fd = new FormData()
          fd.append('file', reverseSlipFile)
          fd.append('tenantId', pendingAction.cheque.tenant.id)
          fd.append('docType', `Reverse-${reverseSubtype}-Cheque-${pendingAction.cheque.id}`)
          await fetch('/api/documents/upload', { method: 'POST', body: fd }).catch(() => {})
        }
      } else if (pendingAction.type === "deposit-to-owner") {
        const c = pendingAction.cheque
        const date = reverseDate || todayStr()
        const amt = parseFloat(reverseAmount || String(c.amount)) || c.amount
        const refLabel = `Cheque ${c.chequeNo ? `#${c.chequeNo}` : `seq ${c.sequenceNo}`}`
        const baseNotes = ensureIssuedEvent(c.notes, c)
        // Find the contract → owner
        const ctr = contracts.find((x) =>
          (c.tenantId && x.tenantId === c.tenantId) || (c.unitId && x.unitId === c.unitId)
        )
        try {
          const depRes = await fetch("/api/cash-deposits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: amt,
              cashSource: c.paymentType === "Upfront" ? "Upfront" : "Rent",
              tenantId: c.tenantId,
              tenantName: c.tenant?.name || "",
              unitNo: c.unit?.unitNo || "",
              ownerId: ctr?.ownerId || null,
              ownerName: "",
              bankName: "",
              accountNo: "",
              referenceNo: "",
              depositedAt: date,
              status: "Deposited",
              notes: rejectReason || `Cash collected for cheque ${c.chequeNo || `#${c.sequenceNo}`}`,
              notifyOwner: true,
            }),
          })
          if (depRes.ok && reverseSlipFile) {
            const created = await depRes.json()
            const fd = new FormData()
            fd.append("file", reverseSlipFile)
            await fetch(`/api/cash-deposits/${created.id}/slip`, { method: "POST", body: fd }).catch(() => {})
          }
          // Update notes with both the marker and an EVENT entry so the timeline shows it.
          const cleared = baseNotes.replace(/OWNER_DEPOSITED:[^\s]*/g, "").trim()
          const withMarker = `${cleared}\nOWNER_DEPOSITED:${date}`
          const finalNotes = appendEvent(withMarker, "BANKED_TO_OWNER", `${refLabel} · AED ${amt.toLocaleString()} into owner account`, date)
          await updateStatus(c.id, c.status, { notes: finalNotes })
        } catch (e) {
          console.error("deposit-to-owner failed:", e)
        }
      } else if (pendingAction.type === "bounce-collect") {
        const c = pendingAction.cheque
        const date = reverseDate || todayStr()
        const peIdScoped = pendingAction.peId
        // Partial-event scoped bounce-collect: operate on the PE: line, leave
        // the parent cheque alone except for the appended history event.
        if (peIdScoped) {
          const events = parsePartialEvents(c.notes)
          const ev = events.find((e) => e.id === peIdScoped)
          if (!ev) { resetActionState(); setBusyAction(false); return }
          const peRef = `Partial ${ev.id}`
          const updated: PartialEvent = {
            ...ev,
            status: "Received",
            method: collectMethod === "Cheque" ? "Cheque" : "Cash",
            chequeNo: collectMethod === "Cheque" ? reverseChequeNo : "",
            bank: collectMethod === "Cheque" ? reverseChequeBank : "Cash",
            bankedDate: "",
            date,
          }
          let newNotes = replacePartialEvent(c.notes || "", updated)
          const detail = collectMethod === "Cash"
            ? `${peRef} · AED ${ev.amount.toLocaleString()} cash settled the bounce`
            : `${peRef} → New #${reverseChequeNo} · ${reverseChequeBank} · AED ${ev.amount.toLocaleString()}`
          newNotes = appendEvent(newNotes, "PE_BOUNCE_COLLECTED", detail, date)
          await updateStatus(c.id, c.status, { notes: newNotes })
          // For partial cash: invoice fires NOW (money in hand). For partial
          // cheque: defer until the new partial cheque clears.
          if (collectMethod === "Cash") {
            await generateInstallmentInvoice(c, ev.amount, date, `PE-${ev.id}`)
          }
          if (reverseSlipFile && c.tenant?.id) {
            const fd = new FormData()
            fd.append('file', reverseSlipFile)
            fd.append('tenantId', c.tenant.id)
            fd.append('docType', `PE-BounceCollect-${peIdScoped}`)
            await fetch('/api/documents/upload', { method: 'POST', body: fd }).catch(() => {})
          }
          resetActionState()
          setBusyAction(false)
          return
        }
        const amt = c.amount
        const oldRef = `Cheque ${c.chequeNo ? `#${c.chequeNo}` : `seq ${c.sequenceNo}`}`
        const baseNotes = ensureIssuedEvent(c.notes, c)
        if (collectMethod === "Cash") {
          // Per spec 9 + parent-id model: bounce collected in cash creates a
          // new LINKED row that follows the cash flow. Parent stays as an
          // immutable Bounced audit anchor (status flipped to Replaced so the
          // Collect button no longer shows on it). Invoice fires NOW.
          const child = await createChildCheque(c, {
            chequeNo: "",
            bankName: "Cash",
            chequeDate: c.chequeDate,
            amount: amt,
            issuedDetail: `Cash collection for bounced ${oldRef} · AED ${amt.toLocaleString()}`,
          })
          const parentNotes = appendEvent(baseNotes, "COLLECTED_AFTER_BOUNCE_CASH", `${oldRef} · AED ${amt.toLocaleString()} cash settled the bounce${child ? ` (new id ${child.id})` : ""}`, date)
          await updateStatus(c.id, "Replaced", {
            bouncedReason: `${c.bouncedReason || "Bounced"} — collected by Cash`,
            notes: parentNotes,
          })
          await generateInstallmentInvoice(c, amt, date, "BounceCollectCash")
        } else if (collectMethod === "Cheque") {
          const child = await createChildCheque(c, {
            chequeNo: reverseChequeNo,
            bankName: reverseChequeBank,
            chequeDate: reverseChequeDate || date,
            amount: amt,
            issuedDetail: `Cheque replacement for bounced ${oldRef} · #${reverseChequeNo} · ${reverseChequeBank} · AED ${amt.toLocaleString()}`,
          })
          const parentNotes = appendEvent(baseNotes, "COLLECTED_AFTER_BOUNCE_CHEQUE", `${oldRef} → New #${reverseChequeNo} · ${reverseChequeBank} · AED ${amt.toLocaleString()}${child ? ` (new id ${child.id})` : ""}`, date)
          await updateStatus(c.id, "Replaced", {
            bouncedReason: `${c.bouncedReason || "Bounced"} — replaced by new Cheque`,
            notes: parentNotes,
          })
        }
        if (reverseSlipFile && pendingAction.cheque.tenant?.id) {
          const fd = new FormData()
          fd.append('file', reverseSlipFile)
          fd.append('tenantId', pendingAction.cheque.tenant.id)
          fd.append('docType', `BounceCollect-Cheque-${pendingAction.cheque.id}`)
          await fetch('/api/documents/upload', { method: 'POST', body: fd }).catch(() => {})
        }
      } else if (pendingAction.type === "undo-last") {
        // Strip the most recent canonical EVENT line from notes and restore
        // the cheque to whatever the previous status implies. We don't
        // mutate other DB columns (clearedDate / depositedDate / etc.) — the
        // user can re-perform the action correctly. Audit-trail safe: we
        // also stamp an UNDONE event so the undo itself is logged.
        const c = pendingAction.cheque
        const lines = (c.notes || "").split("\n")
        // Find the last EVENT: line that is line-anchored.
        let lastIdx = -1
        for (let i = lines.length - 1; i >= 0; i--) {
          if (/^EVENT:/.test(lines[i])) { lastIdx = i; break }
        }
        if (lastIdx < 0) { setBusyAction(false); resetActionState(); return }
        const removedLine = lines[lastIdx]
        const m = removedLine.match(/^EVENT:([^|]*)\|([^|]+)\|(.*)$/)
        const removedType = m?.[2] || "?"
        const remaining = lines.filter((_, i) => i !== lastIdx).join("\n").trim()
        const stamped = appendEvent(remaining, "UNDONE", `Removed: ${removedType} · ${m?.[3] || ""}`, todayStr())
        // Pick a safe rollback status based on what was undone.
        const rollbackStatus =
          removedType === "CLEARED" ? "Deposited"
          : removedType === "DEPOSITED" ? "Received"
          : removedType === "BOUNCED" ? "Deposited"
          : c.status
        const extra: Record<string, string> = { notes: stamped }
        if (removedType === "CLEARED") extra.clearedDate = ""
        if (removedType === "DEPOSITED") { extra.depositedDate = ""; extra.depositRemarks = "" }
        if (removedType === "BOUNCED") { extra.bouncedDate = ""; extra.bouncedReason = "" }
        await updateStatus(c.id, rollbackStatus, extra)
      }
      resetActionState()
    } finally {
      setBusyAction(false)
    }
  }
  // Group by unit — starts from ALL occupied units (so cash-only tenants also appear),
  // then attaches their cheques from the filtered list.
  const grouped = useMemo(() => {
    const map = new Map<string, { unitId: string; unitNo: string; tenantName: string; cheques: ChequeRow[]; annualRent: number }>()
    // Seed with every unit that has a tenant — only when no filter is active.
    // If filters ARE active, the user is looking for specific cheques, so cash-only
    // tenants (with 0 cheques) shouldn't appear and clutter the view.
    if (showCashOnly) {
      for (const u of allUnits) {
        if (!u.tenantId) continue
        map.set(u.id, { unitId: u.id, unitNo: u.unitNo, tenantName: u.tenant?.name || "—", cheques: [], annualRent: u.currentRent })
      }
    }
    // Attach cheques from the filtered list
    for (const c of cheques) {
      const key = c.unit?.id || "no-unit"
      if (!map.has(key)) {
        const unitNo = c.unit?.unitNo || "Unassigned"
        const tenantName = c.tenant?.name || "—"
        map.set(key, { unitId: key, unitNo, tenantName, cheques: [], annualRent: 0 })
      }
      map.get(key)!.cheques.push(c)
    }
    return [...map.values()].sort((a, b) => a.unitNo.localeCompare(b.unitNo, undefined, { numeric: true }))
  }, [cheques, allUnits])

  if (grouped.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
        No tenants or cheques match the current filters.
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
        const isCashOnly = g.cheques.length === 0

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
                  {isCashOnly && (
                    <span className="rounded bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-300">
                      💵 Cash Paid
                    </span>
                  )}
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
                  <p className="text-slate-500">Annual Rent</p>
                  <p className="font-semibold text-white">{formatCurrency(isCashOnly ? g.annualRent : total)}</p>
                </div>
                <div className="rounded bg-emerald-500/10 px-2 py-1">
                  <p className="text-emerald-300/70">{isCashOnly ? "Status" : "Collected"}</p>
                  <p className="font-semibold text-emerald-300">{isCashOnly ? "Cash Paid" : formatCurrency(collected)}</p>
                </div>
                <div className="rounded bg-amber-500/10 px-2 py-1">
                  <p className="text-amber-300/70">Pending</p>
                  <p className="font-semibold text-amber-300">{isCashOnly ? "—" : formatCurrency(pending)}</p>
                </div>
              </div>
            </div>

            {/* Cash-only tenants: show a banner */}
            {isCashOnly && (
              <div className="bg-green-500/5 border-t border-green-500/20 px-4 py-3 text-center">
                <p className="text-xs text-green-300">
                  <span className="font-semibold">No cheques on record.</span> This tenant pays in cash or by direct transfer.
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Annual rent: {formatCurrency(g.annualRent)}
                </p>
              </div>
            )}

            {/* Cheque ledger */}
            {!isCashOnly && (
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
                    <th className="px-2 py-1.5 text-left font-semibold uppercase">Status Date</th>
                    <th className="px-2 py-1.5 text-right font-semibold uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Find this unit's contract — prefer one that has saved Deposit/Fees JSON.
                    const c0 = g.cheques[0]
                    const tenantId = c0?.tenantId || ""
                    const unitId = c0?.unitId || ""
                    const matching = contracts.filter((x) =>
                      (tenantId && x.tenantId === tenantId) ||
                      (unitId && x.unitId === unitId)
                    )
                    const contract =
                      matching.find((c) => parseNotesBlock(c.notes, 'DEPOSIT_JSON:') || parseNotesBlock(c.notes, 'FEES_JSON:')) ||
                      matching[0]
                    if (!contract) return null
                    type Extra = { id: string; label: string; method: string; chequeNo: string; bank: string; amount: number; status: string }
                    const extras: Extra[] = []

                    // Security Deposit — always show if contract has one, even if unpaid.
                    if ((contract.securityDeposit || 0) > 0) {
                      const dep = parseNotesBlock(contract.notes, 'DEPOSIT_JSON:') as null | { method?: string; cash?: number; chequeAmount?: number; chequeNo?: string; bankName?: string; chequeStatus?: string }
                      if (dep && (dep.cash || dep.chequeAmount)) {
                        const isCheque = dep.method === 'Cheque' && (dep.chequeAmount || 0) > 0
                        extras.push({
                          id: `${contract.id}-dep`,
                          label: 'Security Deposit',
                          method: isCheque ? 'Cheque' : 'Cash',
                          chequeNo: isCheque ? (dep.chequeNo || '—') : '—',
                          bank: isCheque ? (dep.bankName || '—') : '—',
                          amount: isCheque ? (dep.chequeAmount || 0) : (dep.cash || 0),
                          status: isCheque ? (dep.chequeStatus || 'Pending') : 'Received',
                        })
                      } else {
                        // Not paid yet — show as Pending with expected amount
                        extras.push({
                          id: `${contract.id}-dep-pending`,
                          label: 'Security Deposit',
                          method: '—',
                          chequeNo: '—',
                          bank: '—',
                          amount: contract.securityDeposit || 0,
                          status: 'Pending',
                        })
                      }
                    }

                    // Admin + Ejari Fees — always show if contract has either.
                    const isCommercial = (contract.contractType || '').toLowerCase() === 'commercial'
                    const commVat = Math.round((contract.commissionFee || 0) * 0.05)
                    const feesExpected = (contract.commissionFee || 0) + commVat + (contract.ejariFee || 0)
                    if (feesExpected > 0) {
                      const fees = parseNotesBlock(contract.notes, 'FEES_JSON:') as null | { method?: string; cash?: number; chequeAmount?: number; chequeNo?: string; bankName?: string; chequeStatus?: string }
                      if (fees && (fees.cash || fees.chequeAmount)) {
                        const isCheque = fees.method === 'Cheque' && (fees.chequeAmount || 0) > 0
                        extras.push({
                          id: `${contract.id}-fees`,
                          label: `Admin + Ejari Fees${isCommercial ? ' (incl. VAT)' : ''}`,
                          method: isCheque ? 'Cheque' : 'Cash',
                          chequeNo: isCheque ? (fees.chequeNo || '—') : '—',
                          bank: isCheque ? (fees.bankName || '—') : '—',
                          amount: isCheque ? (fees.chequeAmount || 0) : (fees.cash || 0),
                          status: isCheque ? (fees.chequeStatus || 'Pending') : 'Received',
                        })
                      } else {
                        extras.push({
                          id: `${contract.id}-fees-pending`,
                          label: `Admin + Ejari Fees${isCommercial ? ' (incl. VAT)' : ''}`,
                          method: '—',
                          chequeNo: '—',
                          bank: '—',
                          amount: feesExpected,
                          status: 'Pending',
                        })
                      }
                    }

                    if (extras.length === 0) return null
                    // Detect "banked to owner" markers per extras row
                    const depBanked = (contract.notes || "").match(/DEPOSIT_BANKED:([^\s]+)/)?.[1] || ""
                    const feesBanked = (contract.notes || "").match(/FEES_BANKED:([^\s]+)/)?.[1] || ""
                    return extras.map((e) => {
                      const isDeposit = e.id.endsWith("-dep") || e.id.endsWith("-dep-pending")
                      const isFees = e.id.endsWith("-fees") || e.id.endsWith("-fees-pending")
                      const banked = isDeposit ? depBanked : isFees ? feesBanked : ""
                      const isCashReceived = e.method === "Cash" && e.status === "Received"
                      const showStatus = banked ? "Cleared" : e.status
                      return (
                        <tr key={e.id} className="border-t border-slate-800 bg-slate-800/30">
                          <td className="px-2 py-1.5 text-slate-400">{e.label}</td>
                          <td className="px-2 py-1.5">
                            {e.method === 'Cash' ? (
                              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">💵 Cash</span>
                            ) : e.method === 'Cheque' ? (
                              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-blue-300">📝 Cheque</span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 font-mono">{e.chequeNo}</td>
                          <td className="px-2 py-1.5">{e.bank}</td>
                          <td className="px-2 py-1.5 text-right font-semibold">{formatCurrency(e.amount)}</td>
                          <td className="px-2 py-1.5"><StatusBadge status={displayStatusLabel(showStatus)} /></td>
                          <td className="px-2 py-1.5">
                            {banked ? (
                              <div className="flex flex-col items-start text-left">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wide">to Owner</span>
                                <span className="text-[12px] font-medium text-slate-200">{banked}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {/* Cash received but not yet banked → Deposit Cash button */}
                            {isCashReceived && !banked && (
                              <button
                                onClick={() => {
                                  resetActionState()
                                  setExtraDepositAction({
                                    contractId: contract.id,
                                    kind: isDeposit ? "deposit" : "fees",
                                    amount: e.amount,
                                    label: e.label,
                                    tenantId,
                                    unitId: contract.unitId || "",
                                    ownerId: contract.ownerId || null,
                                  })
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-purple-600 hover:bg-purple-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                              >
                                💼 Deposit Cash
                              </button>
                            )}
                            {/* Banked → final */}
                            {banked && (
                              <span className="text-[10px] text-emerald-400">✓ Banked to Owner</span>
                            )}
                            {/* Pending payment from tenant — staff records it via tenant edit */}
                            {!isCashReceived && !banked && e.status === "Pending" && (
                              <Link
                                href={`/dashboard/tenants/${tenantId}/edit#payment-plan`}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                                title="Awaiting collection — record in Tenant Edit"
                              >
                                ↗ Record Payment
                              </Link>
                            )}
                            {/* Cheque method → handled in tenant edit's PE flow */}
                            {!isCashReceived && !banked && e.method === "Cheque" && (
                              <Link
                                href={`/dashboard/tenants/${tenantId}/edit#payment-plan`}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                              >
                                ↗ Cheque flow
                              </Link>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  })()}
                  {g.cheques.flatMap((c) => {
                    // PARTIAL SPLIT — for each PE: line, render its own row with its own status.
                    // Then add a "Partial Pending" row if any balance remains.
                    const peEvents = parsePartialEvents(c.notes)
                    const cumulativeMatch = (c.notes || "").match(/PARTIAL_COLLECTED:(\d+(?:\.\d+)?)/)
                    if (c.status === "Partial" && (peEvents.length > 0 || cumulativeMatch)) {
                      const collectedTotal = peEvents.reduce((s, e) => s + e.amount, 0) || (cumulativeMatch ? parseFloat(cumulativeMatch[1]) || 0 : 0)
                      const remainingAmt = Math.max(0, (c.amount || 0) - collectedTotal)
                      const rows: ChequeRow[] = []
                      // One row per partial event
                      for (const e of peEvents) {
                        rows.push({
                          ...c,
                          id: `${c.id}-pe-${e.id}`,
                          amount: e.amount,
                          status: e.status,
                          chequeNo: e.chequeNo || (e.method === "Cash" ? "" : c.chequeNo),
                          bankName: e.method === "Cash" ? "Cash" : (e.bank || ""),
                          chequeDate: e.date,
                          clearedDate: e.status === "Cleared" ? (e.bankedDate || e.date) : "",
                          depositedDate: e.status === "Deposited" ? e.date : "",
                          notes: `${c.notes || ""}\n__PE_ROW__:${e.id}:${c.id}`,
                        } as ChequeRow)
                      }
                      // Legacy fallback — old data without PE lines, just render one collected row
                      if (peEvents.length === 0 && cumulativeMatch) {
                        const partialOwnerMarker = (c.notes || "").match(/OWNER_DEPOSITED:([^\s]+)/)
                        rows.push({
                          ...c,
                          id: `${c.id}-collected`,
                          amount: collectedTotal,
                          status: partialOwnerMarker ? "Cleared" : "Received",
                          notes: `${c.notes || ""}\n__PARTIAL_HALF__:collected:${c.id}`,
                        } as ChequeRow)
                      }
                      // Remaining balance row — inherits the original cheque's
                      // chequeNo + bank so the user can see WHICH cheque this
                      // remainder belongs to. The "Partial Pending" status pill
                      // and "Awaiting collection" hint already differentiate it
                      // from a fully collected row.
                      if (remainingAmt > 0) {
                        rows.push({
                          ...c,
                          id: `${c.id}-remaining`,
                          amount: remainingAmt,
                          status: "Partial Pending",
                          chequeNo: c.chequeNo || "",
                          bankName: c.bankName || "",
                          notes: `${c.notes || ""}\n__PARTIAL_HALF__:remaining:${c.id}`,
                        } as ChequeRow)
                      }
                      return rows
                    }
                    return [c]
                  }).map((c) => {
                    const isUpfront = c.paymentType === "Upfront"
                    const isOverdue = c.chequeDate && c.chequeDate < today && c.status !== "Cleared" && c.status !== "Replaced" && c.status !== "Partial Pending"
                    const isCashPayment = (c.bankName || "").toLowerCase() === "cash" || (isUpfront && !c.chequeNo)
                    const partialHalfMatch = (c.notes || "").match(/__PARTIAL_HALF__:(\w+):([\w-]+)/)
                    const peRowMatch = (c.notes || "").match(/__PE_ROW__:([\w]+):([\w-]+)/)
                    const peEventId = peRowMatch?.[1] || ""
                    const isPartialHalf = partialHalfMatch?.[1] || (peEventId ? "pe-row" : "")
                    const realChequeId = partialHalfMatch?.[2] || peRowMatch?.[2] || c.id
                    const realCheque = isPartialHalf ? g.cheques.find(x => x.id === realChequeId) || c : c
                    // Helper: update a specific PE event's status on the parent's notes.
                    // The optional historyEvent param lets callers stamp an EVENT line
                    // (e.g. PE_BOUNCED) alongside the status change so the lifecycle modal
                    // shows the transition explicitly.
                    const updatePartialEvent = async (
                      patch: Partial<PartialEvent>,
                      opts?: { historyEvent?: { type: string; detail: string } }
                    ) => {
                      if (!peEventId) return
                      const events = parsePartialEvents(realCheque.notes)
                      const ev = events.find(e => e.id === peEventId)
                      if (!ev) return
                      const updated = { ...ev, ...patch }
                      let newNotes = replacePartialEvent(realCheque.notes || "", updated)
                      if (opts?.historyEvent) {
                        newNotes = appendEvent(newNotes, opts.historyEvent.type, opts.historyEvent.detail, today)
                      }
                      await updateStatus(realCheque.id, realCheque.status, { notes: newNotes })
                      // When this partial event reaches Cleared, generate an invoice for it
                      if (patch.status === "Cleared") {
                        const date = patch.bankedDate || updated.bankedDate || updated.date || today
                        await generateInstallmentInvoice(realCheque, ev.amount, date, `PE-${ev.id}`)
                      }
                    }
                    const ownerDepositMarker = (c.notes || "").match(/OWNER_DEPOSITED:([^\s]+)/)
                    const ownerDepositedDate = ownerDepositMarker ? ownerDepositMarker[1] : ""
                    // Cash flow: Received (in hand) → Cleared (banked to owner)
                    // Cheque flow: Pending → Deposited → Cleared
                    const displayStatus = isCashPayment && c.status === "Cleared"
                      ? (ownerDepositedDate ? "Cleared" : "Received")
                      : isPartialHalf === "remaining" ? "Partial Pending"
                      : isPartialHalf === "collected" ? (c.status === "Cleared" ? "Partial Cleared" : "Partial Received")
                      : c.status
                    // Pick the relevant "status date" + the field name (used by inline edit)
                    let statusDate = ""
                    let statusDateField = ""
                    let statusDateLabel = ""
                    if (ownerDepositedDate) { statusDate = ownerDepositedDate; statusDateField = "ownerDeposit"; statusDateLabel = "to Owner" }
                    else if (c.status === "Cleared") { statusDate = c.clearedDate || ""; statusDateField = "clearedDate"; statusDateLabel = "Cleared" }
                    else if (c.status === "Bounced") { statusDate = c.bouncedDate || ""; statusDateField = "bouncedDate"; statusDateLabel = "Bounced" }
                    else if (c.status === "Deposited") { statusDate = c.depositedDate || ""; statusDateField = "depositedDate"; statusDateLabel = "Deposited" }
                    else { statusDate = c.chequeDate || ""; statusDateField = "chequeDate"; statusDateLabel = "Due" }
                    return (
                      <tr key={c.id} className={`border-t border-slate-800 ${isOverdue ? "bg-red-500/5" : ""}`}>
                        <td className="px-2 py-1.5">
                          {fmtDateOnly(c.chequeDate)}
                          {isUpfront && <span className="ml-1 text-[9px] text-blue-400">UPFRONT</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          {isCashPayment ? (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">💵 Cash</span>
                          ) : (
                            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-blue-300">📝 Cheque</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-mono">
                          <span className="inline-flex flex-col items-start gap-0.5">
                            <span className="inline-flex items-center gap-1.5">
                              {/* Child-row indicator: when this cheque was spawned by a Replacement
                                  or Bounce-Collect on another cheque, prefix with "↳" so the parent-
                                  child chain is visually obvious without opening the history modal. */}
                              {c.parentId && <span className="text-slate-500" title="Linked from a previous cheque">↳</span>}
                              {c.chequeNo || (isCashPayment ? "Cash" : "—")}
                              {(() => {
                                const eventCount = buildChequeHistory(realCheque).length
                                if (eventCount <= 1) return null
                                return (
                                  <button
                                    onClick={() => setHistoryFor(realCheque)}
                                    title={`Show lifecycle history (${eventCount} events)`}
                                    className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-slate-500 hover:bg-slate-700 hover:text-slate-200"
                                  >
                                    <span className="text-[11px]">📜</span>
                                    <span className="rounded-full bg-slate-700 px-1.5 text-[9px] font-semibold leading-none text-slate-200">{eventCount}</span>
                                  </button>
                                )
                              })()}
                            </span>
                            {c.parentId && (() => {
                              const parent = g.cheques.find((x) => x.id === c.parentId)
                              if (!parent) return null
                              const parentRef = parent.chequeNo ? `#${parent.chequeNo}` : `seq ${parent.sequenceNo}`
                              return <span className="text-[9px] text-slate-500 normal-case">from {parentRef}</span>
                            })()}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">{c.bankName || "—"}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{formatCurrency(c.amount)}</td>
                        <td className="px-2 py-1.5">
                          {/* Per spec section 8, partial rows carry TWO statuses
                              (PARTIAL + RECEIVED/PENDING/CLEARED). Render them as
                              two side-by-side pills so both facets are visually
                              explicit. Non-partial rows render a single pill. */}
                          {(displayStatus === "Partial Pending" || displayStatus === "Partial Received" || displayStatus === "Partial Cleared") ? (
                            <span className="inline-flex flex-wrap gap-1">
                              <StatusBadge status="Partial" />
                              <StatusBadge status={displayStatus.replace(/^Partial\s+/, "")} />
                            </span>
                          ) : (
                            <StatusBadge status={displayStatusLabel(displayStatus)} />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {isPartialHalf === "remaining" ? (
                            <span className="text-[11px] text-slate-500">Awaiting collection</span>
                          ) : (
                            <StatusDateCell label={statusDateLabel} value={statusDate} />
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex justify-end gap-1.5">
                            {/* Partial — Remaining half: continue collecting */}
                            {isPartialHalf === "remaining" && (
                              <button
                                onClick={() => {
                                  resetActionState()
                                  setReverseSubtype("Partial")
                                  setForcePartial(true)
                                  setReverseAmount(String(c.amount))
                                  setPendingAction({ type: "reverse", cheque: realCheque })
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                              >
                                💰 Collect More
                              </button>
                            )}
                            {/* Partial — Cash event: Received → 💼 Deposit Cash → Cleared */}
                            {isPartialHalf === "pe-row" && isCashPayment && c.status === "Received" && (
                              <button
                                onClick={async () => { await updatePartialEvent({ status: "Cleared", bankedDate: today }) }}
                                className="inline-flex items-center gap-1 rounded-md bg-purple-600 hover:bg-purple-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                title="Bank this cash into the owner's account"
                              >
                                💼 Deposit Cash
                              </button>
                            )}
                            {/* Partial — Cheque event: Received → 🏦 Deposit; Deposited → ✓ Clear */}
                            {isPartialHalf === "pe-row" && !isCashPayment && c.status === "Received" && (
                              <button
                                onClick={async () => { await updatePartialEvent({ status: "Deposited" }) }}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                              >
                                🏦 Deposit
                              </button>
                            )}
                            {isPartialHalf === "pe-row" && !isCashPayment && c.status === "Deposited" && (
                              <>
                                <button
                                  onClick={async () => { await updatePartialEvent({ status: "Cleared", bankedDate: today }) }}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" /> Clear
                                </button>
                                {/* Partial cheque bounced at the bank — flip to Bounced and
                                    surface a Collect button on the next render. */}
                                <button
                                  onClick={async () => {
                                    const reason = prompt("Bounce reason (bank rejection):")
                                    if (!reason) return
                                    await updatePartialEvent(
                                      { status: "Bounced" },
                                      { historyEvent: { type: "PE_BOUNCED", detail: `Partial ${peEventId} · ${reason}` } }
                                    )
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md bg-red-600 hover:bg-red-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Bounce
                                </button>
                              </>
                            )}
                            {isPartialHalf === "pe-row" && c.status === "Bounced" && (
                              <button
                                onClick={() => { resetActionState(); setPendingAction({ type: "bounce-collect", cheque: realCheque, peId: peEventId }) }}
                                className="inline-flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                              >
                                💰 Collect
                              </button>
                            )}
                            {isPartialHalf === "pe-row" && c.status === "Cleared" && (
                              <span className="text-[10px] text-emerald-400">✓ Done</span>
                            )}
                            {/* Legacy collected-half fallback (old data without PE lines) */}
                            {isPartialHalf === "collected" && c.status !== "Cleared" && (
                              <button
                                onClick={() => { resetActionState(); setPendingAction({ type: "deposit-to-owner", cheque: realCheque }) }}
                                className="inline-flex items-center gap-1 rounded-md bg-purple-600 hover:bg-purple-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                title="Bank this collected portion into the owner's account"
                              >
                                💼 Deposit Cash
                              </button>
                            )}
                            {c.status === "Bounced" && !isPartialHalf && (
                              <button
                                onClick={() => { resetActionState(); setPendingAction({ type: "bounce-collect", cheque: c }) }}
                                className="inline-flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                              >
                                💰 Collect
                              </button>
                            )}
                            {!isPartialHalf && c.status !== "Cleared" && c.status !== "Bounced" && c.status !== "Replaced" && (
                              <>
                                {c.status !== "Deposited" && (
                                  <button
                                    onClick={() => setPendingAction({ type: "deposit", cheque: c })}
                                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                  >
                                    🏦 Deposit
                                  </button>
                                )}
                                {/* Clear is only valid AFTER the cheque has been deposited at the
                                    bank — clearing means "the bank credited my deposit". Hidden
                                    on Pending / Partial so the lifecycle stays linear. */}
                                {c.status === "Deposited" && (
                                  <button
                                    onClick={() => setPendingAction({ type: "clear", cheque: c })}
                                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                  >
                                    <CheckCircle className="h-3.5 w-3.5" /> Clear
                                  </button>
                                )}
                                {/* Reverse is a CHEQUE-only action per spec. Cash payments only
                                    have Deposit available — they are uniquely-tracked per
                                    instance and do not get a Bounce / Replacement / Partial
                                    workflow applied. The "↺ Reverse Cash" admin action below
                                    is a separate refund flow and not part of the standard
                                    Reverse modal. */}
                                {!isCashPayment && (
                                  <button
                                    onClick={() => { resetActionState(); setPendingAction({ type: "reverse", cheque: c }) }}
                                    className="inline-flex items-center gap-1 rounded-md bg-red-600 hover:bg-red-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> Reverse
                                  </button>
                                )}
                              </>
                            )}
                            {/* Cleared cheque → next canonical step is banking the funds into the
                                owner's account. Shown for cash AND cheque payments (both end up
                                in the org's account first, then need to be remitted to the owner). */}
                            {!isPartialHalf && c.status === "Cleared" && !ownerDepositedDate && (
                              <button
                                onClick={() => { resetActionState(); setPendingAction({ type: "deposit-to-owner", cheque: c }) }}
                                className="inline-flex items-center gap-1 rounded-md bg-purple-600 hover:bg-purple-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                title="Record bank deposit into the owner's account"
                              >
                                💼 Deposit to Owner
                              </button>
                            )}
                            {!isPartialHalf && c.status === "Cleared" && ownerDepositedDate && (
                              <span className="text-[10px] text-emerald-400">✓ Banked to owner</span>
                            )}
                            {/* Undo Last — only when the most recent EVENT is within a 5-min window.
                                Pulls the timestamp off the last EVENT: line in notes. */}
                            {!isPartialHalf && (() => {
                              const m = (c.notes || "").match(/(?:^|\n)EVENT:([^|]*)\|([^|]+)\|/g)
                              if (!m || m.length === 0) return null
                              const last = m[m.length - 1]
                              const tsMatch = last.match(/EVENT:([^|]*)\|/)
                              const ts = tsMatch?.[1] || ""
                              const tsMs = ts ? new Date(ts).getTime() : 0
                              if (!tsMs || isNaN(tsMs)) return null
                              const ageMin = (Date.now() - tsMs) / 60000
                              if (ageMin < 0 || ageMin > 5) return null
                              return (
                                <button
                                  onClick={() => { resetActionState(); setPendingAction({ type: "undo-last", cheque: c }) }}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[10px] font-medium text-slate-300"
                                  title={`Undo the last action (${Math.round(ageMin * 60)}s ago)`}
                                >
                                  ↶ Undo
                                </button>
                              )
                            })()}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )
      })}

      {/* Extra-row Deposit-to-Owner modal (Security Deposit / Admin+Ejari Fees cash banking) */}
      <Modal
        open={!!extraDepositAction}
        onOpenChange={(o) => { if (!o && !extraDepBusy) { setExtraDepositAction(null); setExtraDepDate(""); setExtraDepSlip(null); setExtraDepNotes("") } }}
        title={extraDepositAction ? `Deposit to Owner — ${extraDepositAction.label}` : "Deposit to Owner"}
        size="md"
        footer={
          <>
            <ModalCancelButton onClick={() => { setExtraDepositAction(null); setExtraDepDate(""); setExtraDepSlip(null); setExtraDepNotes("") }} />
            <button
              disabled={extraDepBusy || !extraDepSlip}
              onClick={async () => {
                if (!extraDepositAction) return
                setExtraDepBusy(true)
                try {
                  const date = extraDepDate || todayStr()
                  // 1) Create CashDeposit row
                  const depRes = await fetch("/api/cash-deposits", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      amount: extraDepositAction.amount,
                      cashSource: extraDepositAction.kind === "deposit" ? "Security Deposit" : "Admin / Ejari Fees",
                      tenantId: extraDepositAction.tenantId,
                      tenantName: "",
                      unitNo: "",
                      ownerId: extraDepositAction.ownerId || null,
                      ownerName: "",
                      bankName: "",
                      accountNo: "",
                      referenceNo: "",
                      depositedAt: date,
                      status: "Deposited",
                      notes: extraDepNotes,
                      notifyOwner: true,
                    }),
                  })
                  if (depRes.ok && extraDepSlip) {
                    const created = await depRes.json()
                    const fd = new FormData()
                    fd.append("file", extraDepSlip)
                    await fetch(`/api/cash-deposits/${created.id}/slip`, { method: "POST", body: fd }).catch(() => {})
                  }
                  // 2) Mark contract notes with DEPOSIT_BANKED or FEES_BANKED
                  const ctr = contracts.find((x) => x.id === extraDepositAction.contractId)
                  if (ctr) {
                    const marker = extraDepositAction.kind === "deposit" ? "DEPOSIT_BANKED" : "FEES_BANKED"
                    const cleaned = (ctr.notes || "").replace(new RegExp(`${marker}:[^\\s]*`, "g"), "").trim()
                    const newNotes = `${cleaned}\n${marker}:${date}`.trim()
                    await fetch(`/api/tenancy-contracts/${ctr.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ notes: newNotes }),
                    }).catch(() => {})
                  }
                  setExtraDepositAction(null)
                  setExtraDepDate("")
                  setExtraDepSlip(null)
                  setExtraDepNotes("")
                  // Reload to refresh contracts + notes (markers)
                  window.location.reload()
                } finally {
                  setExtraDepBusy(false)
                }
              }}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-40 hover:bg-purple-500"
            >
              {extraDepBusy ? "Saving…" : "💼 Confirm Bank Deposit"}
            </button>
          </>
        }
      >
        {extraDepositAction && (
          <div className="space-y-3">
            <div className="rounded-lg border border-purple-700/40 bg-purple-900/10 p-3 text-xs text-purple-200">
              Bank <strong>AED {extraDepositAction.amount.toLocaleString()}</strong> cash collected for <strong>{extraDepositAction.label}</strong> into the owner&rsquo;s account. Internal accounting only — tenant won&rsquo;t see this.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Deposit Date *</label>
                <input type="date" value={extraDepDate || todayStr()} onChange={(e) => setExtraDepDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Amount (AED) <span className="text-[9px] text-purple-400">(fixed)</span></label>
                <input type="number" value={extraDepositAction.amount} readOnly className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white opacity-70 cursor-not-allowed" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Bank Slip * <span className="text-slate-500 normal-case font-normal">(PDF/JPG/PNG)</span></label>
              <input type="file" accept=".pdf,image/*" onChange={(e) => setExtraDepSlip(e.target.files?.[0] || null)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-purple-600 file:px-3 file:py-1 file:text-white" />
              {extraDepSlip && <p className="mt-1 text-[11px] text-emerald-400">✓ {extraDepSlip.name}</p>}
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Notes (optional)</label>
              <textarea value={extraDepNotes} onChange={(e) => setExtraDepNotes(e.target.value)} rows={2} placeholder="e.g. Deposited at Emirates NBD Bur Dubai, slip #4432" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
            </div>
          </div>
        )}
      </Modal>

      {/* History modal — chronological log of cheque lifecycle events */}
      <Modal
        open={!!historyFor}
        onOpenChange={(o) => { if (!o) setHistoryFor(null) }}
        title={historyFor ? `History — ${historyFor.chequeNo ? `Cheque #${historyFor.chequeNo}` : `Sequence ${historyFor.sequenceNo}`}` : "History"}
        size="md"
        footer={<ModalCancelButton onClick={() => setHistoryFor(null)} />}
      >
        {historyFor && (() => {
          const h = buildChequeHistory(historyFor)
          if (h.length === 0) return <p className="text-sm text-slate-400">No history events yet.</p>
          return (
            <div className="relative">
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-700" />
              <ul className="space-y-3">
                {h.map((e, i) => (
                  <li key={i} className="relative flex gap-3">
                    <div className="z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-base">
                      {e.icon}
                    </div>
                    <div className="flex-1 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-white">
                          <span className="mr-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
                          {e.label}
                        </p>
                        <p className="text-[11px] text-slate-400">{e.date || "—"}</p>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-300">{e.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })()}
      </Modal>

      {/* Confirmation modal — replaces native browser confirm() */}
      <Modal
        open={!!pendingAction}
        onOpenChange={(o) => { if (!o && !busyAction) resetActionState() }}
        title={
          pendingAction?.type === "deposit"
            ? "Confirm: Mark as Deposited"
            : pendingAction?.type === "clear"
            ? "Confirm: Mark as Cleared"
            : pendingAction?.type === "bounce-collect"
            ? (pendingAction.peId ? "Collect Bounced Partial" : "Collect Bounced Cheque")
            : pendingAction?.type === "deposit-to-owner"
            ? "Deposit Cash to Owner Account"
            : pendingAction?.type === "undo-last"
            ? "Undo Last Action"
            : "Reverse Cheque"
        }
        size="md"
        footer={
          <>
            <ModalCancelButton onClick={resetActionState} />
            <button
              onClick={runAction}
              disabled={
                busyAction ||
                (pendingAction?.type === "deposit" && !depositSlipFile) ||
                (pendingAction?.type === "clear" && !clearStatementFile) ||
                (pendingAction?.type === "reverse" && !reverseSubtype) ||
                (pendingAction?.type === "reverse" && reverseSubtype === "Bounced" && rejectReason.trim().length < 2) ||
                (pendingAction?.type === "reverse" && reverseSubtype === "ReplacementCheque" && (!reverseChequeNo || !reverseChequeBank)) ||
                (pendingAction?.type === "reverse" && reverseSubtype === "Partial" && (!collectMethod || !reverseAmount)) ||
                (pendingAction?.type === "bounce-collect" && !collectMethod) ||
                (pendingAction?.type === "bounce-collect" && collectMethod === "Cheque" && (!reverseChequeNo || !reverseChequeBank)) ||
                (pendingAction?.type === "deposit-to-owner" && !reverseSlipFile)
              }
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-40 ${
                pendingAction?.type === "deposit"
                  ? "bg-blue-600 hover:bg-blue-500"
                  : pendingAction?.type === "clear"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : pendingAction?.type === "bounce-collect"
                  ? "bg-amber-600 hover:bg-amber-500"
                  : pendingAction?.type === "deposit-to-owner"
                  ? "bg-purple-600 hover:bg-purple-500"
                  : pendingAction?.type === "undo-last"
                  ? "bg-slate-600 hover:bg-slate-500"
                  : "bg-red-600 hover:bg-red-500"
              }`}
            >
              {busyAction
                ? "Saving…"
                : pendingAction?.type === "deposit"
                ? "🏦 Confirm Deposit"
                : pendingAction?.type === "clear"
                ? "✓ Confirm Clear"
                : pendingAction?.type === "bounce-collect"
                ? "💰 Confirm Collection"
                : pendingAction?.type === "deposit-to-owner"
                ? "💼 Confirm Bank Deposit"
                : pendingAction?.type === "undo-last"
                ? "↶ Confirm Undo"
                : "✓ Confirm Reverse"}
            </button>
          </>
        }
      >
        {pendingAction && (
          <div className="space-y-4">
            <div className={`rounded-xl border p-4 ${
              pendingAction.type === "deposit"
                ? "border-blue-700/40 bg-blue-900/10"
                : pendingAction.type === "clear"
                ? "border-emerald-700/40 bg-emerald-900/10"
                : pendingAction.type === "bounce-collect"
                ? "border-amber-700/40 bg-amber-900/10"
                : "border-red-700/40 bg-red-900/10"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                  pendingAction.type === "deposit" ? "bg-blue-500/20 text-blue-300" :
                  pendingAction.type === "clear" ? "bg-emerald-500/20 text-emerald-300" :
                  pendingAction.type === "bounce-collect" ? "bg-amber-500/20 text-amber-300" : "bg-red-500/20 text-red-300"
                }`}>
                  {pendingAction.type === "deposit"
                    ? <span className="text-lg">🏦</span>
                    : pendingAction.type === "clear"
                    ? <CheckCircle className="h-5 w-5" />
                    : pendingAction.type === "bounce-collect"
                    ? <span className="text-lg">💰</span>
                    : <XCircle className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">
                    {pendingAction.type === "deposit"
                      ? "Mark this cheque as Deposited (submitted to bank, awaiting clearance)?"
                      : pendingAction.type === "clear"
                      ? "Mark this cheque as Cleared?"
                      : pendingAction.type === "bounce-collect"
                      ? (pendingAction.peId ? "Collect this bounced partial in full" : "Collect the bounced cheque amount in full")
                      : pendingAction.type === "undo-last"
                      ? "Undo the most recent action on this cheque"
                      : "Reverse this cheque — what happened?"}
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
                      <span className="font-semibold text-amber-300">{formatCurrency(pendingAction.cheque.amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {pendingAction.type === "deposit" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Deposit Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={depositDate || todayStr()}
                      onChange={(e) => setDepositDate(e.target.value)}
                      min={pendingAction.cheque.chequeDate || undefined}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                    />
                    {pendingAction.cheque.chequeDate && (depositDate || todayStr()) < pendingAction.cheque.chequeDate && (
                      <p className="mt-1 text-[10px] text-amber-400">⚠ Deposit date is before the cheque date ({pendingAction.cheque.chequeDate}). The bank will likely reject a postdated cheque.</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Deposit Slip <span className="text-red-400">*</span> <span className="text-slate-500 normal-case font-normal">(PDF/JPG/PNG)</span>
                    </label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setDepositSlipFile(e.target.files?.[0] || null)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1 file:text-white"
                    />
                    {!depositSlipFile && (
                      <p className="mt-1 text-[10px] text-amber-400">Required — bank deposit slip needed to mark this as Deposited.</p>
                    )}
                    {depositSlipFile && (
                      <p className="mt-1 text-[11px] text-emerald-400">✓ {depositSlipFile.name}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Remarks <span className="text-slate-500 normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={depositRemarks}
                    onChange={(e) => setDepositRemarks(e.target.value)}
                    rows={2}
                    placeholder="e.g. Deposited at Emirates NBD Bur Dubai branch, cashier stamp attached"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
            )}

            {pendingAction.type === "clear" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Cleared Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={clearDate || todayStr()}
                    onChange={(e) => setClearDate(e.target.value)}
                    min={pendingAction.cheque.depositedDate || pendingAction.cheque.chequeDate || undefined}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
                  />
                  {pendingAction.cheque.depositedDate && (clearDate || todayStr()) < pendingAction.cheque.depositedDate && (
                    <p className="mt-1 text-[10px] text-red-400">✕ Clear date cannot be before the deposit date ({pendingAction.cheque.depositedDate}).</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Bank Statement / Screenshot <span className="text-red-400">*</span> <span className="text-slate-500 normal-case font-normal">(PDF/JPG/PNG)</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setClearStatementFile(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-1 file:text-white"
                  />
                  {!clearStatementFile && (
                    <p className="mt-1 text-[10px] text-amber-400">Required — bank proof needed to mark this as Cleared.</p>
                  )}
                  {clearStatementFile && <p className="mt-1 text-[11px] text-emerald-400">✓ {clearStatementFile.name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Notes <span className="text-slate-500 normal-case font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={clearNotes}
                    onChange={(e) => setClearNotes(e.target.value)}
                    rows={2}
                    placeholder="e.g. Confirmed via SMS from Emirates NBD, ref #ABC123"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
            )}

            {pendingAction.type === "reverse" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Type of Reverse <span className="text-red-400">*</span>
                    {forcePartial && <span className="ml-2 text-[10px] font-normal text-amber-400">(locked — continuing partial collection)</span>}
                  </label>
                  <select
                    value={reverseSubtype}
                    onChange={(e) => setReverseSubtype(e.target.value as ReverseSubtype)}
                    disabled={forcePartial}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-red-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">— Select —</option>
                    <option value="ReplacementCash">Replacement By Cash</option>
                    <option value="ReplacementCheque">Replacement By CHQ</option>
                    {/* Bounce only makes sense after the cheque has been deposited —
                        you only learn it bounced once the bank rejects it. */}
                    {pendingAction.cheque.status === "Deposited" && (
                      <option value="Bounced">Bounced CHQ</option>
                    )}
                    <option value="Partial">Partial Payment</option>
                  </select>
                </div>

                {/* Replacement By Cash */}
                {reverseSubtype === "ReplacementCash" && (
                  <div className="space-y-3 rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-3">
                    <p className="text-[11px] text-emerald-200">Cash collected to settle this cheque — old cheque will be marked Cleared.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Cash Amount (AED) *</label>
                        <input type="number" value={reverseAmount || pendingAction.cheque.amount} onChange={(e) => setReverseAmount(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Collection Date *</label>
                        <input type="date" value={reverseDate || todayStr()} onChange={(e) => setReverseDate(e.target.value)} min={pendingAction.cheque.chequeDate || undefined} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Replacement By Cheque */}
                {reverseSubtype === "ReplacementCheque" && (
                  <div className="space-y-3 rounded-lg border border-blue-700/40 bg-blue-900/10 p-3">
                    <p className="text-[11px] text-blue-200">New cheque replaces this one — bank lifecycle restarts at Pending.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Cheque No *</label>
                        <input type="text" value={reverseChequeNo} onChange={(e) => setReverseChequeNo(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Bank *</label>
                        <UaeBankInput value={reverseChequeBank} onChange={setReverseChequeBank} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Cheque Date</label>
                        <input type="date" value={reverseChequeDate || todayStr()} onChange={(e) => setReverseChequeDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Amount (AED)</label>
                        <input type="number" value={reverseAmount || pendingAction.cheque.amount} onChange={(e) => setReverseAmount(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Cheque Image (optional)</label>
                      <input type="file" accept=".pdf,image/*" onChange={(e) => setReverseSlipFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1 file:text-white" />
                      {reverseSlipFile && <p className="mt-1 text-[11px] text-emerald-400">✓ {reverseSlipFile.name}</p>}
                    </div>
                  </div>
                )}

                {/* Bounced */}
                {reverseSubtype === "Bounced" && (
                  <div className="space-y-3 rounded-lg border border-red-700/40 bg-red-900/10 p-3">
                    <p className="text-[11px] text-red-200">Mark cheque as Bounced. It stays Bounced until you collect the full amount via the 💰 Collect button.</p>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Bounced Date *</label>
                      <input type="date" value={reverseDate || todayStr()} onChange={(e) => setReverseDate(e.target.value)} min={pendingAction.cheque.chequeDate || undefined} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Reason *</label>
                      <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="e.g. insufficient funds, signature mismatch" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                    </div>
                  </div>
                )}

                {/* Partial */}
                {reverseSubtype === "Partial" && (
                  <div className="space-y-3 rounded-lg border border-amber-700/40 bg-amber-900/10 p-3">
                    <p className="text-[11px] text-amber-200">Partial collection — cheque becomes Partial; you can collect the remainder later. Original amount: {formatCurrency(pendingAction.cheque.amount)}.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Method *</label>
                        <select value={collectMethod} onChange={(e) => setCollectMethod(e.target.value as "" | "Cash" | "Cheque")} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
                          <option value="">—</option>
                          <option value="Cash">💵 Cash</option>
                          <option value="Cheque">📝 Cheque</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                          Amount Collected (AED) *
                          {forcePartial && <span className="ml-1 text-[9px] text-amber-400">(remaining balance — locked)</span>}
                        </label>
                        <input
                          type="number"
                          value={reverseAmount}
                          onChange={(e) => setReverseAmount(e.target.value)}
                          readOnly={forcePartial}
                          className={`w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white ${forcePartial ? "opacity-70 cursor-not-allowed" : ""}`}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Date *</label>
                        <input type="date" value={reverseDate || todayStr()} onChange={(e) => setReverseDate(e.target.value)} min={pendingAction.cheque.chequeDate || undefined} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                      </div>
                      {collectMethod === "Cheque" && (
                        <>
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Cheque No</label>
                            <input type="text" value={reverseChequeNo} onChange={(e) => setReverseChequeNo(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Bank</label>
                            <UaeBankInput value={reverseChequeBank} onChange={setReverseChequeBank} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {pendingAction.type === "bounce-collect" && (
              <div className="space-y-3 rounded-lg border border-amber-700/40 bg-amber-900/10 p-3">
                <p className="text-[11px] text-amber-200">Collect the full bounced amount of <strong>{formatCurrency(pendingAction.cheque.amount)}</strong>. Pick how it was settled.</p>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Method *</label>
                  <select value={collectMethod} onChange={(e) => setCollectMethod(e.target.value as "" | "Cash" | "Cheque")} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
                    <option value="">—</option>
                    <option value="Cash">💵 Cash</option>
                    <option value="Cheque">📝 Cheque (replacement)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Date *</label>
                  <input type="date" value={reverseDate || todayStr()} onChange={(e) => setReverseDate(e.target.value)} min={pendingAction.cheque.chequeDate || undefined} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                </div>
                {collectMethod === "Cheque" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">New Cheque No *</label>
                      <input type="text" value={reverseChequeNo} onChange={(e) => setReverseChequeNo(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Bank *</label>
                      <UaeBankInput value={reverseChequeBank} onChange={setReverseChequeBank} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Cheque Date</label>
                      <input type="date" value={reverseChequeDate || todayStr()} onChange={(e) => setReverseChequeDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Image (optional)</label>
                      <input type="file" accept=".pdf,image/*" onChange={(e) => setReverseSlipFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-amber-600 file:px-3 file:py-1 file:text-white" />
                      {reverseSlipFile && <p className="mt-1 text-[11px] text-emerald-400">✓ {reverseSlipFile.name}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {pendingAction.type === "deposit-to-owner" && (
              <div className="space-y-3 rounded-lg border border-purple-700/40 bg-purple-900/10 p-3">
                <p className="text-[11px] text-purple-200">
                  Cash <strong>{formatCurrency(pendingAction.cheque.amount)}</strong> was collected from the tenant.
                  Now record the bank deposit you made into the owner&rsquo;s account.
                  This is internal accounting — the tenant won&rsquo;t see this in their portal.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Deposit Date *</label>
                    <input type="date" value={reverseDate || todayStr()} onChange={(e) => setReverseDate(e.target.value)} min={pendingAction.cheque.chequeDate || undefined} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">
                      Amount (AED)
                      <span className="ml-1 text-[9px] text-purple-400">(fixed — collected amount)</span>
                    </label>
                    <input
                      type="number"
                      value={pendingAction.cheque.amount}
                      readOnly
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white opacity-70 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Bank Slip * <span className="text-slate-500 normal-case font-normal">(PDF/JPG/PNG)</span></label>
                  <input type="file" accept=".pdf,image/*" onChange={(e) => setReverseSlipFile(e.target.files?.[0] || null)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-purple-600 file:px-3 file:py-1 file:text-white" />
                  {reverseSlipFile && <p className="mt-1 text-[11px] text-emerald-400">✓ {reverseSlipFile.name}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Notes (optional)</label>
                  <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="e.g. Deposited at Emirates NBD Bur Dubai branch, slip #4432" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                </div>
              </div>
            )}

            {pendingAction.type === "undo-last" && (() => {
              const lines = (pendingAction.cheque.notes || "").split("\n")
              let lastLine = ""
              for (let i = lines.length - 1; i >= 0; i--) {
                if (/^EVENT:/.test(lines[i])) { lastLine = lines[i]; break }
              }
              const m = lastLine.match(/^EVENT:([^|]*)\|([^|]+)\|(.*)$/)
              const eventType = m?.[2] || "?"
              const eventDetail = m?.[3] || ""
              const eventTs = m?.[1] || ""
              return (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Action to undo</p>
                    <p className="mt-1 text-sm font-semibold text-white">{eventType}</p>
                    <p className="text-xs text-slate-300">{eventDetail}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{eventTs}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 p-3 text-[11px] text-slate-300">
                    The action will be removed from the lifecycle log and the cheque rolled back to the previous status. An <strong>UNDONE</strong> event is stamped so the undo itself is auditable. Available only within 5 minutes of the original action.
                  </div>
                </div>
              )
            })()}

            {pendingAction.type !== "deposit-to-owner" && pendingAction.type !== "undo-last" && (
              <div className="rounded-lg border border-blue-700/40 bg-blue-900/20 p-3 text-xs text-blue-200">
                ✉️ The tenant will be automatically emailed an updated payment statement
                showing total paid + remaining balance.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
