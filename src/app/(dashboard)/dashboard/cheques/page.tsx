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
  const [contracts, setContracts] = useState<Array<{ id: string; tenantId: string; unitId: string | null; contractType: string; securityDeposit: number; ejariFee: number; commissionFee: number; notes: string | null }>>([])
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
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
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

  const filtered = useMemo(() => {
    // Cash Only: show no cheques at all (card view seeds cash-only tenants)
    if (paymentMethod === "cash") return []
    return cheques.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false
      if (tenantFilter !== "all" && c.tenantId !== tenantFilter) return false
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
  }, [cheques, statusFilter, tenantFilter, dateRange, paymentMethod, today, thisMonthStart, in7Str, in30Str])

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
        <ChequeUnitCards
          cheques={filtered}
          contracts={contracts}
          updateStatus={updateStatus}
          allUnits={
            paymentMethod === "cheque"
              ? allUnits.filter((u) => cheques.some((c) => c.unit?.id === u.id))
              : paymentMethod === "cash"
                ? allUnits.filter((u) => u.tenantId && !cheques.some((c) => c.unit?.id === u.id))
                : allUnits
          }
          showCashOnly={
            paymentMethod === "cash" ||
            (paymentMethod === "all" && statusFilter === "all" && tenantFilter === "all" && dateRange === "all")
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
  | { type: "bounce-collect"; cheque: ChequeRow }

type ContractLite = {
  id: string
  tenantId: string
  unitId: string | null
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

  const todayStr = () => new Date().toISOString().slice(0, 10)
  const resetActionState = () => {
    setPendingAction(null)
    setRejectReason("")
    setBouncedDate("")
    setDepositDate("")
    setDepositRemarks("")
    setDepositSlipFile(null)
    setClearDate("")
    setReverseSubtype("")
    setReverseAmount("")
    setReverseDate("")
    setReverseChequeNo("")
    setReverseChequeBank("")
    setReverseChequeDate("")
    setReverseSlipFile(null)
    setCollectMethod("")
  }

  const runAction = async () => {
    if (!pendingAction) return
    setBusyAction(true)
    try {
      if (pendingAction.type === "deposit") {
        await updateStatus(pendingAction.cheque.id, "Deposited", {
          depositedDate: depositDate || todayStr(),
          depositRemarks,
        })
        if (depositSlipFile && pendingAction.cheque.tenant?.id) {
          const fd = new FormData()
          fd.append('file', depositSlipFile)
          fd.append('tenantId', pendingAction.cheque.tenant.id)
          fd.append('docType', `Deposit-Slip-Cheque-${pendingAction.cheque.id}`)
          await fetch('/api/documents/upload', { method: 'POST', body: fd }).catch(() => {})
        }
      } else if (pendingAction.type === "clear") {
        await updateStatus(pendingAction.cheque.id, "Cleared", { clearedDate: clearDate || todayStr() })
      } else if (pendingAction.type === "reverse") {
        const c = pendingAction.cheque
        const date = reverseDate || todayStr()
        const amt = parseFloat(reverseAmount || String(c.amount)) || c.amount
        if (reverseSubtype === "ReplacementCash") {
          // Old cheque settled by cash → mark Cleared, record reason as Replacement
          await updateStatus(c.id, "Cleared", {
            clearedDate: date,
            chequeNo: "",
            bankName: "Cash",
            amount: String(amt),
            bouncedReason: "Replaced by Cash",
            paymentType: c.paymentType === "Upfront" ? "Upfront" : "Replacement",
          })
        } else if (reverseSubtype === "ReplacementCheque") {
          // Replace with new cheque details, restart cycle as Pending
          await updateStatus(c.id, "Pending", {
            chequeNo: reverseChequeNo,
            bankName: reverseChequeBank,
            chequeDate: reverseChequeDate || date,
            amount: String(amt),
            bouncedReason: "Replaced by new Cheque",
            clearedDate: "",
            depositedDate: "",
            paymentType: c.paymentType === "Upfront" ? "Upfront" : "Replacement",
          })
        } else if (reverseSubtype === "Bounced") {
          await updateStatus(c.id, "Bounced", {
            bouncedDate: date,
            bouncedReason: rejectReason,
          })
        } else if (reverseSubtype === "Partial") {
          // Partial collection: store collected amount in clearedDate slot via notes,
          // and mark cheque as Partial; user can continue collecting.
          const collectedSoFar = (typeof c.notes === "string" && c.notes.match(/PARTIAL_COLLECTED:(\d+(?:\.\d+)?)/)?.[1]) || "0"
          const newCollected = parseFloat(collectedSoFar) + amt
          const remaining = (c.amount || 0) - newCollected
          const newNotes = `${(c.notes || "").replace(/PARTIAL_COLLECTED:[^\n]*/g, "").trim()}\nPARTIAL_COLLECTED:${newCollected}`.trim()
          const isFullyCollected = remaining <= 0
          await updateStatus(c.id, isFullyCollected ? "Cleared" : "Partial", {
            notes: newNotes,
            ...(isFullyCollected ? { clearedDate: date } : {}),
            ...(collectMethod === "Cash" ? { bankName: collectMethod === "Cash" ? "Cash" : (c.bankName || "") } : {}),
          })
        }
        // Slip upload for cheque-replacement / partial-cheque
        if (reverseSlipFile && pendingAction.cheque.tenant?.id) {
          const fd = new FormData()
          fd.append('file', reverseSlipFile)
          fd.append('tenantId', pendingAction.cheque.tenant.id)
          fd.append('docType', `Reverse-${reverseSubtype}-Cheque-${pendingAction.cheque.id}`)
          await fetch('/api/documents/upload', { method: 'POST', body: fd }).catch(() => {})
        }
      } else if (pendingAction.type === "bounce-collect") {
        // After a bounce, collect the full amount (cash or cheque) → moves to Cleared
        const c = pendingAction.cheque
        const date = reverseDate || todayStr()
        const amt = c.amount
        if (collectMethod === "Cash") {
          await updateStatus(c.id, "Cleared", {
            clearedDate: date,
            chequeNo: "",
            bankName: "Cash",
            amount: String(amt),
            bouncedReason: `${c.bouncedReason || "Bounced"} — collected by Cash`,
            paymentType: "Replacement",
          })
        } else if (collectMethod === "Cheque") {
          await updateStatus(c.id, "Pending", {
            chequeNo: reverseChequeNo,
            bankName: reverseChequeBank,
            chequeDate: reverseChequeDate || date,
            amount: String(amt),
            bouncedReason: `${c.bouncedReason || "Bounced"} — replaced by new Cheque`,
            clearedDate: "",
            depositedDate: "",
            paymentType: "Replacement",
          })
        }
        if (reverseSlipFile && pendingAction.cheque.tenant?.id) {
          const fd = new FormData()
          fd.append('file', reverseSlipFile)
          fd.append('tenantId', pendingAction.cheque.tenant.id)
          fd.append('docType', `BounceCollect-Cheque-${pendingAction.cheque.id}`)
          await fetch('/api/documents/upload', { method: 'POST', body: fd }).catch(() => {})
        }
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
                    return extras.map((e) => (
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
                        <td className="px-2 py-1.5"><StatusBadge status={e.status} /></td>
                        <td className="px-2 py-1.5 text-right">
                          <Link
                            href={`/dashboard/tenants/${tenantId}/edit#payment-plan`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                            title="Open the tenant's Payment Plan to record / update this payment"
                          >
                            ↗ Manage
                          </Link>
                        </td>
                      </tr>
                    ))
                  })()}
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
                            {c.status === "Bounced" && (
                              <button
                                onClick={() => { resetActionState(); setPendingAction({ type: "bounce-collect", cheque: c }) }}
                                className="inline-flex items-center gap-1 rounded-md bg-amber-600 hover:bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                              >
                                💰 Collect
                              </button>
                            )}
                            {c.status !== "Cleared" && c.status !== "Bounced" && c.status !== "Replaced" && (
                              <>
                                {c.status !== "Deposited" && (
                                  <button
                                    onClick={() => setPendingAction({ type: "deposit", cheque: c })}
                                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                  >
                                    🏦 Deposit
                                  </button>
                                )}
                                <button
                                  onClick={() => setPendingAction({ type: "clear", cheque: c })}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" /> Clear
                                </button>
                                <button
                                  onClick={() => { resetActionState(); setPendingAction({ type: "reverse", cheque: c }) }}
                                  className="inline-flex items-center gap-1 rounded-md bg-red-600 hover:bg-red-500 px-2.5 py-1 text-xs font-semibold text-white shadow"
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Reverse
                                </button>
                              </>
                            )}
                            {c.status === "Cleared" && (
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
            )}
          </div>
        )
      })}

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
            ? "Collect Bounced Cheque"
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
                (pendingAction?.type === "reverse" && !reverseSubtype) ||
                (pendingAction?.type === "reverse" && reverseSubtype === "Bounced" && rejectReason.trim().length < 2) ||
                (pendingAction?.type === "reverse" && reverseSubtype === "ReplacementCheque" && (!reverseChequeNo || !reverseChequeBank)) ||
                (pendingAction?.type === "reverse" && reverseSubtype === "Partial" && (!collectMethod || !reverseAmount)) ||
                (pendingAction?.type === "bounce-collect" && !collectMethod) ||
                (pendingAction?.type === "bounce-collect" && collectMethod === "Cheque" && (!reverseChequeNo || !reverseChequeBank))
              }
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-40 ${
                pendingAction?.type === "deposit"
                  ? "bg-blue-600 hover:bg-blue-500"
                  : pendingAction?.type === "clear"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : pendingAction?.type === "bounce-collect"
                  ? "bg-amber-600 hover:bg-amber-500"
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
                      ? "Collect the bounced cheque amount in full"
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
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Deposit Slip <span className="text-slate-500 normal-case font-normal">(optional — PDF/JPG/PNG)</span>
                    </label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setDepositSlipFile(e.target.files?.[0] || null)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1 file:text-white"
                    />
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
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Cleared Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={clearDate || todayStr()}
                  onChange={(e) => setClearDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50"
                />
              </div>
            )}

            {pendingAction.type === "reverse" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Type of Reverse <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={reverseSubtype}
                    onChange={(e) => setReverseSubtype(e.target.value as ReverseSubtype)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-red-500/50"
                  >
                    <option value="">— Select —</option>
                    <option value="ReplacementCash">Replacement By Cash</option>
                    <option value="ReplacementCheque">Replacement By CHQ</option>
                    <option value="Bounced">Bounced CHQ</option>
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
                        <input type="date" value={reverseDate || todayStr()} onChange={(e) => setReverseDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
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
                      <input type="date" value={reverseDate || todayStr()} onChange={(e) => setReverseDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
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
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Amount Collected (AED) *</label>
                        <input type="number" value={reverseAmount} onChange={(e) => setReverseAmount(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">Date *</label>
                        <input type="date" value={reverseDate || todayStr()} onChange={(e) => setReverseDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
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
                  <input type="date" value={reverseDate || todayStr()} onChange={(e) => setReverseDate(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
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
