"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Banknote,
  AlertTriangle,
  Clock,
  CreditCard,
  Plus,
  Mail,
} from "lucide-react"

interface PaymentRow {
  id: string
  amount: number
  paymentDate: string
  method: string
  referenceNo: string
  chequeNo: string
  notes: string
  invoice: {
    id: string
    invoiceNo: string
    totalAmount: number
    status: string
    tenant: { id: string; name: string } | null
    unit: { id: string; unitNo: string } | null
  }
  [key: string]: unknown
}

interface Stats {
  collected_this_month: number
  outstanding: number
  overdue_count: number
  cheques_pending: number
}

const defaultForm = {
  invoiceId: "",
  amount: "",
  paymentDate: new Date().toISOString().split("T")[0],
  method: "Bank Transfer",
  chequeNo: "",
  chequeDate: "",
  chequeBank: "",
  referenceNo: "",
  notes: "",
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [invoices, setInvoices] = useState<{ id: string; invoiceNo: string; totalAmount: number; paidAmount: number; tenant?: { name: string } | null; unit?: { unitNo: string } | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<"soa" | "list">("soa")

  const fetchData = useCallback(async () => {
    try {
      const [payRes, statsRes] = await Promise.all([
        fetch("/api/payments"),
        fetch("/api/payments/stats"),
      ])
      if (!payRes.ok) throw new Error("Failed to fetch payments")
      setPayments(await payRes.json())
      if (statsRes.ok) setStats(await statsRes.json())

      const invRes = await fetch("/api/invoices")
      if (invRes.ok) {
        const data = await invRes.json()
        setInvoices(data.filter((i: { status: string }) => !["Paid", "Cancelled"].includes(i.status)))
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
      const res = await fetch("/api/payments", {
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

  const columns: Column<PaymentRow>[] = [
    { key: "invoiceNo", header: "Invoice #", render: (r) => r.invoice?.invoiceNo || "--" },
    { key: "tenant", header: "Tenant", render: (r) => r.invoice?.tenant?.name || "--" },
    { key: "unit", header: "Unit", render: (r) => r.invoice?.unit?.unitNo || "--" },
    { key: "amount", header: "Amount", sortable: true, render: (r) => formatCurrency(r.amount) },
    { key: "paymentDate", header: "Date", sortable: true, render: (r) => formatDate(r.paymentDate) },
    { key: "method", header: "Method" },
    { key: "referenceNo", header: "Reference", render: (r) => r.referenceNo || r.chequeNo || "--" },
  ]

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payment Tracking</h1>
          <p className="mt-1 text-sm text-slate-400">{payments.length} payments recorded</p>
        </div>
        <button onClick={() => { setForm(defaultForm); setAddOpen(true) }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500">
          <Plus className="h-4 w-4" /> Record Payment
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Collected This Month" value={formatCurrency(stats.collected_this_month)} color="green" icon={<Banknote className="h-5 w-5" />} />
          <KpiCard label="Outstanding" value={formatCurrency(stats.outstanding)} color="amber" icon={<Clock className="h-5 w-5" />} />
          <KpiCard label="Overdue Invoices" value={stats.overdue_count} color="red" icon={<AlertTriangle className="h-5 w-5" />} />
          <KpiCard label="Pending Cheques" value={stats.cheques_pending} color="blue" icon={<CreditCard className="h-5 w-5" />} />
        </div>
      )}

      <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
        <button
          onClick={() => setTab("soa")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md ${tab === "soa" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:text-white"}`}
        >
          SOA by Tenant
        </button>
        <button
          onClick={() => setTab("list")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md ${tab === "list" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:text-white"}`}
        >
          Payment List
        </button>
      </div>

      {tab === "list" ? (
        <DataTable columns={columns} data={payments} searchPlaceholder="Search payments..." searchKeys={["method", "referenceNo"]} />
      ) : (
        <SoaCards />
      )}

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Record Payment" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.invoiceId || !form.amount}>{saving ? "Saving..." : "Record"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Invoice *</label>
            <select value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
              <option value="">Select invoice</option>
              {invoices.map(i => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNo} - {i.tenant?.name || "N/A"} - Balance: {formatCurrency(i.totalAmount - i.paidAmount)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Amount (AED) *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Payment Date *</label>
              <input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Method</label>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Card">Card</option>
                <option value="Online">Online</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Reference No</label>
              <input type="text" value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          {form.method === "Cheque" && (
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
                <label className="mb-1 block text-xs font-medium text-slate-400">Bank</label>
                <input type="text" value={form.chequeBank} onChange={(e) => setForm({ ...form, chequeBank: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
        </div>
      </Modal>
    </div>
  )
}

interface SoaEntry {
  tenant: { id: string; name: string; email: string; status: string }
  unit: { id: string; unitNo: string } | null
  contract: { id: string; contractNo: string; status: string; contractStart: string; contractEnd: string; rentAmount: number } | null
  totals: {
    annualRent: number
    invoiceTotal: number
    totalBilled: number
    upfront: number
    clearedCheques: number
    invoicePaid: number
    totalPaid: number
    pending: number
    pdcsInHand: number
    bouncedTotal: number
  }
  activity: Array<{ date: string; kind: string; label: string; amount: number; status: string; ref: string }>
}

function SoaCards() {
  const [data, setData] = useState<SoaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showOnlyPending, setShowOnlyPending] = useState(false)
  const [emailing, setEmailing] = useState<string>("")

  useEffect(() => {
    fetch("/api/soa")
      .then((r) => r.json())
      .then((d) => setData(d.soa || []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return data.filter((s) => {
      if (showOnlyPending && s.totals.pending <= 0) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!`${s.tenant.name} ${s.unit?.unitNo || ""} ${s.contract?.contractNo || ""}`.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [data, search, showOnlyPending])

  const sendStatus = async (tenantId: string) => {
    setEmailing(tenantId)
    try {
      const r = await fetch(`/api/tenants/${tenantId}/rent-status`, { method: "POST" })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Failed")
      alert("✓ Rent status emailed to tenant")
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed")
    } finally {
      setEmailing("")
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">Loading SOA…</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tenant, unit or contract"
          className="flex-1 min-w-[200px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
        />
        <label className="inline-flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={showOnlyPending}
            onChange={(e) => setShowOnlyPending(e.target.checked)}
            className="h-4 w-4"
          />
          Show only tenants with pending balance
        </label>
        <span className="ml-auto text-xs text-slate-400">
          Showing <strong className="text-white">{filtered.length}</strong> of {data.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          No SOA entries match.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((s) => (
            <div key={s.tenant.id} className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <div className="border-b border-slate-800 bg-slate-900 px-4 py-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                    Unit {s.unit?.unitNo || "—"}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{s.tenant.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {s.contract ? `${s.contract.contractNo} · ${s.contract.contractStart} → ${s.contract.contractEnd}` : "No contract"}
                  </p>
                </div>
                <button
                  onClick={() => sendStatus(s.tenant.id)}
                  disabled={emailing === s.tenant.id || !s.tenant.email}
                  title={s.tenant.email ? "Email full SOA to tenant" : "Tenant has no email on file"}
                  className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                >
                  <Mail className="h-3 w-3" />
                  {emailing === s.tenant.id ? "Sending…" : "Email SOA"}
                </button>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 gap-2 px-4 pt-3 sm:grid-cols-4 text-[11px]">
                <div className="rounded bg-slate-800/60 px-2 py-1.5">
                  <p className="text-slate-500">Annual Rent</p>
                  <p className="font-semibold text-white">{formatCurrency(s.totals.annualRent)}</p>
                </div>
                <div className="rounded bg-emerald-500/10 px-2 py-1.5">
                  <p className="text-emerald-300/70">Total Paid</p>
                  <p className="font-semibold text-emerald-300">{formatCurrency(s.totals.totalPaid)}</p>
                </div>
                <div className="rounded bg-blue-500/10 px-2 py-1.5">
                  <p className="text-blue-300/70">PDCs in Hand</p>
                  <p className="font-semibold text-blue-300">{formatCurrency(s.totals.pdcsInHand)}</p>
                </div>
                <div className="rounded bg-amber-500/10 px-2 py-1.5">
                  <p className="text-amber-300/70">Pending</p>
                  <p className="font-semibold text-amber-300">{formatCurrency(s.totals.pending)}</p>
                </div>
              </div>

              {s.totals.bouncedTotal > 0 && (
                <div className="mx-4 mt-2 rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                  ⚠ Bounced cheques total: {formatCurrency(s.totals.bouncedTotal)}
                </div>
              )}

              {/* Timeline */}
              <div className="p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase text-slate-500">Activity timeline</p>
                {s.activity.length === 0 ? (
                  <p className="text-xs text-slate-500">No activity yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {s.activity.map((act, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded border border-slate-800/60 bg-slate-800/30 px-2 py-1.5 text-[11px]">
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate">
                            <span className={`mr-1 inline-block w-2 h-2 rounded-full ${
                              act.kind === "Cheque" ? "bg-blue-400" : act.kind === "Invoice" ? "bg-purple-400" : act.kind === "Payment" ? "bg-emerald-400" : "bg-amber-400"
                            }`}></span>
                            <strong className="text-slate-300">{act.kind}:</strong> {act.label}
                          </p>
                          <p className="text-[10px] text-slate-500">{formatDate(act.date)} · {act.ref || "—"}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="font-semibold text-white">{formatCurrency(act.amount)}</span>
                          <StatusBadge status={act.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
