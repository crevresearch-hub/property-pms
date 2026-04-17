"use client"

import { useState, useEffect, useCallback } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  FileText,
  Send,
  CheckCircle,
  AlertTriangle,
  Plus,
  Pencil,
  Ban,
  Layers,
  Eye,
} from "lucide-react"

interface InvoiceRow {
  id: string
  invoiceNo: string
  tenantId: string | null
  unitId: string | null
  tenant: { id: string; name: string } | null
  unit: { id: string; unitNo: string } | null
  type: string
  amount: number
  vatAmount: number
  totalAmount: number
  dueDate: string
  periodStart: string
  periodEnd: string
  status: string
  paidAmount: number
  lateFee: number
  notes: string
  [key: string]: unknown
}

const defaultForm = {
  tenantId: "",
  unitId: "",
  type: "Rent",
  amount: "",
  vatAmount: "0",
  dueDate: "",
  periodStart: "",
  periodEnd: "",
  notes: "",
}

const defaultBulkForm = {
  dueDate: "",
  periodStart: "",
  periodEnd: "",
}

interface ProofDoc {
  id: string
  filename: string
  originalFilename: string
  filePath: string
  reviewNotes: string
  fileSize: number
  uploadedAt: string
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [proofModal, setProofModal] = useState<{ invoice: InvoiceRow; doc: ProofDoc | null; loading: boolean } | null>(null)

  const openProofModal = async (inv: InvoiceRow) => {
    const lines = (inv.notes || "").split("\n").filter((l) => l.startsWith("PROOF_DOC:"))
    if (lines.length === 0) {
      setError("No proof file is linked to this invoice.")
      return
    }
    const docId = lines[lines.length - 1].slice("PROOF_DOC:".length).split("|")[0]
    setProofModal({ invoice: inv, doc: null, loading: true })
    try {
      const r = await fetch(`/api/documents/${docId}`)
      if (!r.ok) throw new Error("Failed to load proof")
      const doc = await r.json()
      setProofModal({ invoice: inv, doc, loading: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load proof")
      setProofModal(null)
    }
  }
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<{ id: string; unitNo: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [bulkForm, setBulkForm] = useState(defaultBulkForm)
  const [saving, setSaving] = useState(false)

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch("/api/invoices")
      if (!res.ok) throw new Error("Failed to fetch invoices")
      setInvoices(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
    fetch("/api/tenants").then(r => r.ok ? r.json() : []).then(d => setTenants(Array.isArray(d) ? d.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })) : []))
    fetch("/api/units").then(r => r.ok ? r.json() : []).then(d => setUnits(Array.isArray(d) ? d.map((u: { id: string; unitNo: string }) => ({ id: u.id, unitNo: u.unitNo })) : []))
  }, [fetchInvoices])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setAddOpen(false)
      setForm(defaultForm)
      fetchInvoices()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleBulkGenerate = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/invoices/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkForm),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      const data = await res.json()
      alert(`Generated ${data.count} invoices successfully`)
      setBulkOpen(false)
      setBulkForm(defaultBulkForm)
      fetchInvoices()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (inv: InvoiceRow, newStatus: string) => {
    try {
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchInvoices()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const draftCount = invoices.filter(i => i.status === "Draft").length
  const sentCount = invoices.filter(i => i.status === "Sent").length
  const paidCount = invoices.filter(i => i.status === "Paid").length
  const overdueCount = invoices.filter(i => i.status === "Overdue").length

  const columns: Column<InvoiceRow>[] = [
    { key: "invoiceNo", header: "Invoice #", sortable: true },
    { key: "tenant", header: "Tenant", render: (r) => r.tenant?.name || "--" },
    { key: "unit", header: "Unit", render: (r) => r.unit?.unitNo || "--" },
    { key: "type", header: "Type", sortable: true },
    { key: "totalAmount", header: "Amount", sortable: true, render: (r) => formatCurrency(r.totalAmount) },
    { key: "dueDate", header: "Due Date", sortable: true, render: (r) => formatDate(r.dueDate) },
    { key: "paidAmount", header: "Paid", render: (r) => formatCurrency(r.paidAmount) },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={r.status} />
          {r.status === "Tenant Submitted" && (
            <span className="inline-block h-2 w-2 rounded-full bg-purple-400 animate-pulse" title="Awaiting verification" />
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => {
        // Find latest proof doc id from notes "PROOF_DOC:<id>|<filename>"
        const proofDocId = (() => {
          const lines = (r.notes || "").split("\n").filter((l) => l.startsWith("PROOF_DOC:"))
          if (lines.length === 0) return null
          const last = lines[lines.length - 1].slice("PROOF_DOC:".length)
          return last.split("|")[0]
        })()
        return (
          <div className="flex gap-1">
            {(r.status === "Draft" || r.status === "Sent") && (
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  if (!confirm(`Send invoice ${r.invoiceNo} to ${r.tenant?.name || 'tenant'} by email?`)) return
                  try {
                    const res = await fetch(`/api/invoices/${r.id}/send`, { method: "POST" })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || "Failed")
                    alert(data.emailSent ? "✓ Invoice emailed to tenant + portal notification sent" : (data.emailError ? `Saved but email failed: ${data.emailError}` : "Status updated (no email — tenant has no email on file)"))
                    fetchInvoices()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Send failed")
                  }
                }}
                className="rounded p-1.5 text-slate-400 hover:bg-blue-900/50 hover:text-blue-400"
                title={r.status === "Sent" ? "Re-send Email" : "Send to Tenant"}
              >
                <Send className="h-4 w-4" />
              </button>
            )}
            {proofDocId && (
              <button
                onClick={(e) => { e.stopPropagation(); openProofModal(r) }}
                className={`rounded p-1.5 hover:bg-purple-900/40 ${
                  r.status === "Tenant Submitted" ? "text-purple-400" : "text-slate-400 hover:text-purple-400"
                }`}
                title={r.status === "Tenant Submitted" ? "View payment proof" : "View archived proof"}
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
            {r.status === "Tenant Submitted" && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Verify proof and mark invoice ${r.invoiceNo} as PAID?`)) {
                      updateStatus(r, "Paid")
                    }
                  }}
                  className="rounded p-1.5 text-slate-400 hover:bg-emerald-900/50 hover:text-emerald-400"
                  title="Verify & Mark Paid"
                >
                  <CheckCircle className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Reject the proof and revert invoice ${r.invoiceNo} back to Sent?`)) {
                      updateStatus(r, "Sent")
                    }
                  }}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-900/50 hover:text-red-400"
                  title="Reject Proof"
                >
                  <Ban className="h-4 w-4" />
                </button>
              </>
            )}
            {(r.status === "Draft" || r.status === "Sent") && (
              <button onClick={(e) => { e.stopPropagation(); updateStatus(r, "Cancelled") }} className="rounded p-1.5 text-slate-400 hover:bg-red-900/50 hover:text-red-400" title="Cancel">
                <Ban className="h-4 w-4" />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoice Management</h1>
          <p className="mt-1 text-sm text-slate-400">{invoices.length} invoices total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBulkOpen(true)} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white">
            <Layers className="h-4 w-4" /> Bulk Generate
          </button>
          <button onClick={() => { setForm(defaultForm); setAddOpen(true) }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500">
            <Plus className="h-4 w-4" /> Generate Invoice
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Draft" value={draftCount} color="blue" icon={<FileText className="h-5 w-5" />} />
        <KpiCard label="Sent" value={sentCount} color="amber" icon={<Send className="h-5 w-5" />} />
        <KpiCard label="Paid" value={paidCount} color="green" icon={<CheckCircle className="h-5 w-5" />} />
        <KpiCard label="Overdue" value={overdueCount} color="red" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <DataTable columns={columns} data={invoices} searchPlaceholder="Search invoices..." searchKeys={["invoiceNo", "type"]} />

      {/* Generate Invoice Modal */}
      <Modal open={addOpen} onOpenChange={setAddOpen} title="Generate Invoice" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.amount || !form.dueDate}>{saving ? "Generating..." : "Generate"}</ModalSaveButton></>}>
        <div className="space-y-4">
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
              <label className="mb-1 block text-xs font-medium text-slate-400">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                <option value="Rent">Rent</option>
                <option value="Security Deposit">Security Deposit</option>
                <option value="Commission">Commission</option>
                <option value="DEWA">DEWA</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Late Fee">Late Fee</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Due Date *</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Amount (AED) *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">VAT Amount</label>
              <input type="number" value={form.vatAmount} onChange={(e) => setForm({ ...form, vatAmount: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Period Start</label>
              <input type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Period End</label>
              <input type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
        </div>
      </Modal>

      {/* Bulk Generate Modal */}
      <Modal open={bulkOpen} onOpenChange={setBulkOpen} title="Bulk Generate Invoices" description="Generate rent invoices for all occupied units"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleBulkGenerate} disabled={saving || !bulkForm.dueDate}>{saving ? "Generating..." : "Generate All"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Due Date *</label>
            <input type="date" value={bulkForm.dueDate} onChange={(e) => setBulkForm({ ...bulkForm, dueDate: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Period Start</label>
              <input type="date" value={bulkForm.periodStart} onChange={(e) => setBulkForm({ ...bulkForm, periodStart: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Period End</label>
              <input type="date" value={bulkForm.periodEnd} onChange={(e) => setBulkForm({ ...bulkForm, periodEnd: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
        </div>
      </Modal>

      {/* Proof viewer modal */}
      {proofModal && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setProofModal(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Payment Proof — Invoice {proofModal.invoice.invoiceNo}
                </h3>
                <p className="text-xs text-slate-500">
                  {proofModal.invoice.tenant?.name || "—"} · {proofModal.invoice.unit?.unitNo || "—"} · {formatCurrency(proofModal.invoice.totalAmount)}
                </p>
              </div>
              <button onClick={() => setProofModal(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              {proofModal.loading ? (
                <div className="flex h-40 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-400 border-t-transparent" />
                </div>
              ) : proofModal.doc ? (
                <>
                  {/* Tenant note */}
                  {proofModal.doc.reviewNotes && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-900">
                      <p className="text-[10px] font-semibold uppercase text-purple-700 mb-1">Tenant note</p>
                      {proofModal.doc.reviewNotes.replace(/^Tenant note:\s*/i, "")}
                    </div>
                  )}

                  {/* Image / PDF preview */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    {/\.(pdf)$/i.test(proofModal.doc.filename) ? (
                      <iframe
                        src={`/api/documents/${proofModal.doc.id}/file`}
                        className="h-[60vh] w-full rounded"
                        title="Payment proof"
                      />
                    ) : (
                      <img
                        src={`/api/documents/${proofModal.doc.id}/file`}
                        alt="Payment proof"
                        className="mx-auto max-h-[60vh] w-auto rounded"
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{proofModal.doc.originalFilename || proofModal.doc.filename} · {(proofModal.doc.fileSize / 1024).toFixed(0)} KB</span>
                    <a
                      href={`/api/documents/${proofModal.doc.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-600 hover:underline"
                    >
                      Open in new tab ↗
                    </a>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Proof not found.</p>
              )}
            </div>

            {/* Action footer */}
            <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-3">
              {proofModal.invoice.status !== "Tenant Submitted" && (
                <span className="mr-auto inline-flex items-center gap-1.5 text-xs">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                    proofModal.invoice.status === "Paid"
                      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      : "bg-slate-100 text-slate-700 ring-slate-200"
                  }`}>
                    {proofModal.invoice.status === "Paid" ? "✓ Verified — marked Paid" : `Status: ${proofModal.invoice.status}`}
                  </span>
                </span>
              )}
              <button
                onClick={() => setProofModal(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              {proofModal.invoice.status === "Tenant Submitted" && (
                <>
                  <button
                    onClick={() => {
                      if (confirm(`Reject the proof and revert invoice ${proofModal.invoice.invoiceNo} back to Sent?`)) {
                        updateStatus(proofModal.invoice, "Sent")
                        setProofModal(null)
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
                  >
                    <Ban className="h-3.5 w-3.5" /> Reject Proof
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Verify proof and mark invoice ${proofModal.invoice.invoiceNo} as PAID?`)) {
                        updateStatus(proofModal.invoice, "Paid")
                        setProofModal(null)
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Verify & Mark Paid
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
