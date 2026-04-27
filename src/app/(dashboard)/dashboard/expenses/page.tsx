"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus, Trash2, FileText, Upload, CheckCircle2, XCircle, Receipt } from "lucide-react"
import { KpiCard } from "@/components/ui/kpi-card"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { StatusBadge } from "@/components/ui/status-badge"
import { formatCurrency, formatDate } from "@/lib/utils"

type Vendor = {
  id: string
  companyName: string
  phone?: string
  email?: string
  paymentMethods?: string
}
type Unit = {
  id: string
  unitNo: string
  tenantId?: string | null
  tenant?: { id: string; name: string; email?: string; phone?: string } | null
}
type Bill = {
  id: string
  vendor: { id: string; companyName: string; phone?: string; email?: string; paymentMethods?: string } | null
  unit: { id: string; unitNo: string } | null
  tenant: { id: string; name: string; email?: string } | null
  owner: { id: string; ownerName: string; email?: string } | null
  billNo: string
  billDate: string
  serviceType: string
  description: string
  baseAmount: number
  vatAmount: number
  totalAmount: number
  paymentMethod: string
  paymentDate: string
  chequeNo: string
  chequeBank: string
  chequeDate: string
  bankRef: string
  bankName: string
  status: "PendingApproval" | "Approved" | "Rejected" | "Paid"
  approvedBy: string
  approverNote: string
  rejectReason: string
  createdBy: string
  notes: string
  createdAt: string
  invoiceFileName: string
  paymentFileName: string
}

const defaultForm = {
  vendorId: "",
  unitId: "",
  billNo: "",
  billDate: "",
  serviceType: "",
  description: "",
  baseAmount: "",
  vatAmount: "",
  paymentMethod: "" as "" | "Cash" | "Cheque" | "BankTransfer",
  paymentDate: "",
  chequeNo: "",
  chequeBank: "",
  chequeDate: "",
  bankRef: "",
  bankName: "",
  notes: "",
}

const labelInput = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
const labelText = "mb-1 block text-xs font-medium text-slate-400"

export default function ExpensesPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [paymentFile, setPaymentFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, vRes, uRes] = await Promise.all([
        fetch("/api/vendor-bills"),
        fetch("/api/vendors"),
        fetch("/api/units"),
      ])
      if (!bRes.ok) throw new Error("Failed to fetch bills")
      setBills(await bRes.json())
      if (vRes.ok) setVendors(await vRes.json())
      if (uRes.ok) setUnits(await uRes.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const selectedVendor = useMemo(() => vendors.find((v) => v.id === form.vendorId), [vendors, form.vendorId])
  const selectedUnit = useMemo(() => units.find((u) => u.id === form.unitId), [units, form.unitId])
  // VAT auto-fill at 5% unless user has manually edited it.
  useEffect(() => {
    const base = parseFloat(form.baseAmount) || 0
    if (!form.vatAmount && base > 0) {
      setForm((f) => ({ ...f, vatAmount: String(Math.round(base * 0.05)) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.baseAmount])

  const totalAmount = (parseFloat(form.baseAmount) || 0) + (parseFloat(form.vatAmount) || 0)
  const allowedMethods = useMemo(() => {
    if (!selectedVendor?.paymentMethods) return ["Cash", "Cheque", "BankTransfer"] as const
    const set = new Set(selectedVendor.paymentMethods.split(",").map((s) => s.trim()))
    return (["Cash", "Cheque", "BankTransfer"] as const).filter((m) => set.has(m))
  }, [selectedVendor])

  const formIsValid =
    !!form.vendorId &&
    !!form.serviceType.trim() &&
    parseFloat(form.baseAmount) > 0 &&
    !!form.paymentMethod &&
    (form.paymentMethod !== "Cheque" || (!!form.chequeNo && !!form.chequeBank)) &&
    (form.paymentMethod !== "BankTransfer" || !!form.bankRef)

  const submit = async () => {
    if (!formIsValid) return
    setSaving(true)
    try {
      const res = await fetch("/api/vendor-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: form.vendorId,
          unitId: form.unitId || null,
          billNo: form.billNo,
          billDate: form.billDate,
          serviceType: form.serviceType,
          description: form.description,
          baseAmount: parseFloat(form.baseAmount) || 0,
          vatAmount: parseFloat(form.vatAmount) || 0,
          totalAmount,
          paymentMethod: form.paymentMethod,
          paymentDate: form.paymentDate,
          chequeNo: form.chequeNo,
          chequeBank: form.chequeBank,
          chequeDate: form.chequeDate,
          bankRef: form.bankRef,
          bankName: form.bankName,
          notes: form.notes,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || "Save failed")
      }
      const created = await res.json()
      // Upload invoice file
      if (invoiceFile && created.id) {
        const fd = new FormData()
        fd.append("file", invoiceFile)
        fd.append("kind", "invoice")
        await fetch(`/api/vendor-bills/${created.id}/upload`, { method: "POST", body: fd }).catch(() => {})
      }
      // Upload payment proof (cheque image / transfer receipt)
      if (paymentFile && created.id) {
        const fd = new FormData()
        fd.append("file", paymentFile)
        fd.append("kind", "payment")
        await fetch(`/api/vendor-bills/${created.id}/upload`, { method: "POST", body: fd }).catch(() => {})
      }
      setAddOpen(false)
      setForm(defaultForm)
      setInvoiceFile(null)
      setPaymentFile(null)
      fetchAll()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const act = async (id: string, action: "approve" | "reject" | "markPaid") => {
    let body: Record<string, unknown> = { action }
    if (action === "reject") {
      const reason = window.prompt("Reject reason:")
      if (!reason) return
      body = { ...body, rejectReason: reason }
    }
    if (action === "approve") {
      const note = window.prompt("Approval note (optional):") || ""
      body = { ...body, approverNote: note }
    }
    const res = await fetch(`/api/vendor-bills/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) fetchAll()
    else alert((await res.json()).error || "Action failed")
  }

  const remove = async (id: string) => {
    if (!window.confirm("Delete this pending bill?")) return
    const res = await fetch(`/api/vendor-bills/${id}`, { method: "DELETE" })
    if (res.ok) fetchAll()
    else alert((await res.json()).error || "Delete failed")
  }

  const filtered = useMemo(() => {
    if (statusFilter === "all") return bills
    return bills.filter((b) => b.status === statusFilter)
  }, [bills, statusFilter])

  const summary = useMemo(() => {
    const sum = (s: Bill["status"]) =>
      bills.filter((b) => b.status === s).reduce((acc, b) => acc + (b.totalAmount || 0), 0)
    return {
      pending: { count: bills.filter((b) => b.status === "PendingApproval").length, amount: sum("PendingApproval") },
      approved: { count: bills.filter((b) => b.status === "Approved").length, amount: sum("Approved") },
      paid: { count: bills.filter((b) => b.status === "Paid").length, amount: sum("Paid") },
      rejected: { count: bills.filter((b) => b.status === "Rejected").length, amount: sum("Rejected") },
    }
  }, [bills])

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses & Vendor Bills</h1>
          <p className="mt-1 text-sm text-slate-400">Vendor invoices stay Pending until the property owner approves them.</p>
        </div>
        <button
          onClick={() => { setForm(defaultForm); setInvoiceFile(null); setPaymentFile(null); setAddOpen(true) }}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500"
        >
          <Plus className="h-4 w-4" /> New Bill
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pending" value={summary.pending.count} subtitle={formatCurrency(summary.pending.amount)} color="amber" icon={<Receipt className="h-5 w-5" />} />
        <KpiCard label="Approved" value={summary.approved.count} subtitle={formatCurrency(summary.approved.amount)} color="blue" icon={<CheckCircle2 className="h-5 w-5" />} />
        <KpiCard label="Paid" value={summary.paid.count} subtitle={formatCurrency(summary.paid.amount)} color="green" icon={<CheckCircle2 className="h-5 w-5" />} />
        <KpiCard label="Rejected" value={summary.rejected.count} subtitle={formatCurrency(summary.rejected.amount)} color="red" icon={<XCircle className="h-5 w-5" />} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "PendingApproval", "Approved", "Paid", "Rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                statusFilter === s ? "bg-amber-500 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {s === "all" ? `All (${bills.length})` : s.replace(/([A-Z])/g, " $1").trim()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">No bills yet. Click <strong className="text-white">+ New Bill</strong> to add one.</p>
        ) : (
          filtered.map((b) => (
            <div key={b.id} className={`rounded-xl border p-4 ${
              b.status === "PendingApproval" ? "border-amber-700/40 bg-amber-950/10"
              : b.status === "Approved" ? "border-blue-700/40 bg-blue-950/10"
              : b.status === "Paid" ? "border-emerald-700/40 bg-emerald-950/10"
              : "border-slate-700 bg-slate-900/40"
            }`}>
              <div className="flex flex-wrap items-baseline gap-2 mb-3">
                <StatusBadge status={b.status === "PendingApproval" ? "Pending" : b.status} />
                <h3 className="text-sm font-bold text-white">{b.vendor?.companyName || "—"}</h3>
                <span className="text-xs text-slate-400">· {b.serviceType || "(no service type)"}</span>
                <span className="ml-auto text-base font-bold text-amber-300">{formatCurrency(b.totalAmount)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <div><span className="text-slate-500">Bill #:</span> <span className="text-slate-200 font-mono">{b.billNo || "—"}</span></div>
                <div><span className="text-slate-500">Bill Date:</span> <span className="text-slate-200">{b.billDate ? formatDate(b.billDate) : "—"}</span></div>
                <div><span className="text-slate-500">Unit:</span> <span className="text-slate-200">{b.unit?.unitNo || "—"}</span></div>
                <div><span className="text-slate-500">Tenant:</span> <span className="text-slate-200">{b.tenant?.name || "—"}</span></div>
                <div><span className="text-slate-500">Base:</span> <span className="text-slate-200">{formatCurrency(b.baseAmount)}</span></div>
                <div><span className="text-slate-500">VAT:</span> <span className="text-slate-200">{formatCurrency(b.vatAmount)}</span></div>
                <div><span className="text-slate-500">Method:</span> <span className="text-slate-200">{b.paymentMethod || "—"}</span></div>
                <div><span className="text-slate-500">Owner:</span> <span className="text-slate-200">{b.owner?.ownerName || "—"}</span></div>
              </div>
              {b.description && (
                <p className="mt-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">{b.description}</p>
              )}
              {b.paymentMethod === "Cheque" && (b.chequeNo || b.chequeBank) && (
                <p className="mt-2 text-[11px] text-slate-400">
                  📝 Cheque #{b.chequeNo} · {b.chequeBank}{b.chequeDate ? ` · dated ${b.chequeDate}` : ""}
                </p>
              )}
              {b.paymentMethod === "BankTransfer" && (b.bankRef || b.bankName) && (
                <p className="mt-2 text-[11px] text-slate-400">
                  🏦 Transfer ref {b.bankRef} · {b.bankName}{b.paymentDate ? ` · on ${b.paymentDate}` : ""}
                </p>
              )}
              {b.rejectReason && (
                <p className="mt-2 text-[11px] text-red-400">✕ Rejected — {b.rejectReason}</p>
              )}
              {b.approverNote && b.status === "Approved" && (
                <p className="mt-2 text-[11px] text-emerald-400">✓ {b.approverNote}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {b.invoiceFileName && (
                  <a href={`/api/vendor-bills/${b.id}/upload?kind=invoice`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700">
                    <FileText className="h-3.5 w-3.5" /> Invoice
                  </a>
                )}
                {b.paymentFileName && (
                  <a href={`/api/vendor-bills/${b.id}/upload?kind=payment`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700">
                    <FileText className="h-3.5 w-3.5" /> Payment proof
                  </a>
                )}
                {b.status === "PendingApproval" && (
                  <>
                    <button onClick={() => act(b.id, "approve")} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve (admin)
                    </button>
                    <button onClick={() => act(b.id, "reject")} className="inline-flex items-center gap-1 rounded-md border border-red-700 bg-red-950/40 hover:bg-red-900/50 px-2.5 py-1 text-[11px] font-medium text-red-300">
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                    <button onClick={() => remove(b.id)} className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </>
                )}
                {b.status === "Approved" && (
                  <button onClick={() => act(b.id, "markPaid")} className="inline-flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Paid
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="New Vendor Bill"
        description="Stays Pending until the property owner approves."
        size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={submit} disabled={!formIsValid || saving}>{saving ? "Saving…" : "Submit for Approval"}</ModalSaveButton></>}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelText}>Vendor *</label>
              <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value, paymentMethod: "" })} className={labelInput}>
                <option value="">— Select —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.companyName}</option>
                ))}
              </select>
              {selectedVendor && (
                <p className="mt-1 text-[10px] text-slate-500">{selectedVendor.phone} · {selectedVendor.email || "no email"}</p>
              )}
            </div>
            <div>
              <label className={labelText}>Type of Service *</label>
              {/* Closed list — user must pick one of the 11 standard service
                  categories. Free-text is intentionally disabled to keep the
                  expense ledger consistent for accounting reports. */}
              <select
                value={form.serviceType}
                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                className={labelInput}
              >
                <option value="">— Select —</option>
                <option value="AMC - Fire Fighting">AMC - Fire Fighting</option>
                <option value="AMC - Elevators">AMC - Elevators</option>
                <option value="AMC - Pest Control">AMC - Pest Control</option>
                <option value="AMC - Gas">AMC - Gas</option>
                <option value="AMC - GYM">AMC - GYM</option>
                <option value="Demand Charges - Expenses">Demand Charges - Expenses</option>
                <option value="Water & Electricity - Buildings">Water &amp; Electricity - Buildings</option>
                <option value="Gas Refilling Expenses">Gas Refilling Expenses</option>
                <option value="Cooling Charges - Expenses">Cooling Charges - Expenses</option>
                <option value="General Maintenance">General Maintenance</option>
                <option value="Unit Maintenance">Unit Maintenance</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelText}>Unit (optional — sets tenant + owner automatically)</label>
              <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className={labelInput}>
                <option value="">— Building-wide / no unit —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.unitNo}{u.tenant ? ` · ${u.tenant.name}` : ""}</option>
                ))}
              </select>
              {selectedUnit?.tenant && (
                <p className="mt-1 text-[10px] text-slate-500">Tenant: <strong>{selectedUnit.tenant.name}</strong>{selectedUnit.tenant.email ? ` · ${selectedUnit.tenant.email}` : ""}</p>
              )}
            </div>
            <div>
              <label className={labelText}>Bill / Invoice No</label>
              <input type="text" value={form.billNo} onChange={(e) => setForm({ ...form, billNo: e.target.value })} className={labelInput} placeholder="Vendor's invoice number" />
            </div>
          </div>
          <div>
            <label className={labelText}>Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Scope / line-item details" className={labelInput} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelText}>Bill Date</label>
              <input type="date" value={form.billDate} onChange={(e) => setForm({ ...form, billDate: e.target.value })} className={labelInput} />
            </div>
            <div>
              <label className={labelText}>Base Amount (AED) *</label>
              <input type="number" min="0" step="0.01" value={form.baseAmount} onChange={(e) => setForm({ ...form, baseAmount: e.target.value, vatAmount: "" })} className={labelInput} />
            </div>
            <div>
              <label className={labelText}>VAT (AED) <span className="text-slate-500 normal-case font-normal">(auto 5%)</span></label>
              <input type="number" min="0" step="0.01" value={form.vatAmount} onChange={(e) => setForm({ ...form, vatAmount: e.target.value })} className={labelInput} />
            </div>
          </div>
          <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-2 text-xs text-amber-200">
            Total: <strong>{formatCurrency(totalAmount)}</strong>
          </div>
          <div>
            <label className={labelText}>Vendor Invoice File <span className="text-slate-500 normal-case font-normal">(PDF/JPG/PNG)</span></label>
            <input type="file" accept=".pdf,image/*" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} className={`${labelInput} file:mr-3 file:rounded file:border-0 file:bg-amber-600 file:px-3 file:py-1 file:text-white`} />
            {invoiceFile && <p className="mt-1 text-[11px] text-emerald-400">✓ {invoiceFile.name}</p>}
          </div>
          <div>
            <label className={labelText}>Payment Method *</label>
            <div className="flex flex-wrap gap-2">
              {(["Cash", "Cheque", "BankTransfer"] as const).map((m) => {
                const allowed = allowedMethods.length === 0 || allowedMethods.includes(m)
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={!allowed}
                    onClick={() => setForm({ ...form, paymentMethod: m })}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                      form.paymentMethod === m
                        ? "border-amber-500 bg-amber-500/20 text-amber-200"
                        : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                    } disabled:opacity-30 disabled:cursor-not-allowed`}
                    title={!allowed ? "This vendor does not accept this method" : undefined}
                  >
                    {m === "Cash" ? "💵 Cash" : m === "Cheque" ? "📝 Cheque" : "🏦 Bank Transfer"}
                  </button>
                )
              })}
            </div>
            {selectedVendor && allowedMethods.length < 3 && (
              <p className="mt-1 text-[10px] text-slate-500">Vendor accepts: {allowedMethods.join(", ")}.</p>
            )}
          </div>
          {form.paymentMethod === "Cash" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-3">
              <div>
                <label className={labelText}>Cash Paid Date</label>
                <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} className={labelInput} />
              </div>
              <div>
                <label className={labelText}>Receipt File <span className="text-slate-500 normal-case font-normal">(optional)</span></label>
                <input type="file" accept=".pdf,image/*" onChange={(e) => setPaymentFile(e.target.files?.[0] || null)} className={`${labelInput} file:mr-3 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-1 file:text-white`} />
                {paymentFile && <p className="mt-1 text-[11px] text-emerald-400">✓ {paymentFile.name}</p>}
              </div>
            </div>
          )}
          {form.paymentMethod === "Cheque" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-lg border border-blue-700/40 bg-blue-900/10 p-3">
              <div>
                <label className={labelText}>Cheque No *</label>
                <input type="text" value={form.chequeNo} onChange={(e) => setForm({ ...form, chequeNo: e.target.value })} className={labelInput} />
              </div>
              <div>
                <label className={labelText}>Cheque Bank *</label>
                <input type="text" value={form.chequeBank} onChange={(e) => setForm({ ...form, chequeBank: e.target.value })} className={labelInput} />
              </div>
              <div>
                <label className={labelText}>Cheque Date</label>
                <input type="date" value={form.chequeDate} onChange={(e) => setForm({ ...form, chequeDate: e.target.value })} className={labelInput} />
              </div>
              <div>
                <label className={labelText}>Cheque Image <span className="text-slate-500 normal-case font-normal">(PDF/JPG/PNG)</span></label>
                <input type="file" accept=".pdf,image/*" onChange={(e) => setPaymentFile(e.target.files?.[0] || null)} className={`${labelInput} file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1 file:text-white`} />
                {paymentFile && <p className="mt-1 text-[11px] text-emerald-400">✓ {paymentFile.name}</p>}
              </div>
            </div>
          )}
          {form.paymentMethod === "BankTransfer" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-lg border border-purple-700/40 bg-purple-900/10 p-3">
              <div>
                <label className={labelText}>Bank Name</label>
                <input type="text" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className={labelInput} />
              </div>
              <div>
                <label className={labelText}>Reference / Txn No *</label>
                <input type="text" value={form.bankRef} onChange={(e) => setForm({ ...form, bankRef: e.target.value })} className={labelInput} />
              </div>
              <div>
                <label className={labelText}>Transfer Date</label>
                <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} className={labelInput} />
              </div>
              <div>
                <label className={labelText}>Transfer Receipt <span className="text-slate-500 normal-case font-normal">(PDF/JPG/PNG)</span></label>
                <input type="file" accept=".pdf,image/*" onChange={(e) => setPaymentFile(e.target.files?.[0] || null)} className={`${labelInput} file:mr-3 file:rounded file:border-0 file:bg-purple-600 file:px-3 file:py-1 file:text-white`} />
                {paymentFile && <p className="mt-1 text-[11px] text-emerald-400">✓ {paymentFile.name}</p>}
              </div>
            </div>
          )}
          <div>
            <label className={labelText}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={labelInput} />
          </div>
          <div className="rounded-lg border border-blue-700/40 bg-blue-900/20 p-3 text-xs text-blue-200">
            <Upload className="inline h-3.5 w-3.5 mr-1" /> Submitting will email the property owner for approval. Bill stays Pending until they act.
          </div>
        </div>
      </Modal>
    </div>
  )
}
