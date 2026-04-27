"use client"

import { useState, useEffect, useCallback } from "react"
import { CheckCircle2, XCircle, FileText, Receipt } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/status-badge"

type Bill = {
  id: string
  vendor: { id: string; companyName: string; phone?: string; email?: string } | null
  unit: { id: string; unitNo: string } | null
  tenant: { id: string; name: string } | null
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
  approverNote: string
  rejectReason: string
  approvedAt: string | null
  notes: string
  createdAt: string
  invoiceFileName: string
  paymentFileName: string
}

export default function OwnerBillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<"all" | "PendingApproval" | "Approved" | "Rejected" | "Paid">("PendingApproval")

  const fetchBills = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/owner/vendor-bills")
      if (res.ok) setBills(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { fetchBills() }, [fetchBills])

  const act = async (id: string, action: "approve" | "reject") => {
    let note = ""
    if (action === "reject") {
      note = window.prompt("Reject reason — what's wrong with this bill?") || ""
      if (!note) return
    } else {
      note = window.prompt("Approval note (optional):") || ""
    }
    setBusy((m) => ({ ...m, [id]: true }))
    try {
      const res = await fetch(`/api/owner/vendor-bills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        alert(e.error || "Action failed")
      }
      await fetchBills()
    } finally {
      setBusy((m) => { const next = { ...m }; delete next[id]; return next })
    }
  }

  const filtered = filter === "all" ? bills : bills.filter((b) => b.status === filter)
  const pendingCount = bills.filter((b) => b.status === "PendingApproval").length

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Vendor Bills</h1>
        <p className="mt-1 text-sm text-slate-600">Review and approve vendor invoices submitted by your property manager.</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["all", "PendingApproval", "Approved", "Paid", "Rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === s ? "bg-[#E30613] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {s === "all" ? `All (${bills.length})` : s === "PendingApproval" ? `Pending${pendingCount ? ` (${pendingCount})` : ""}` : s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            <Receipt className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            No vendor bills{filter !== "all" ? ` in ${filter} status` : ""}.
          </p>
        ) : (
          filtered.map((b) => (
            <div key={b.id} className={`rounded-2xl border p-4 shadow-sm ${
              b.status === "PendingApproval" ? "border-amber-300 bg-amber-50"
              : b.status === "Approved" ? "border-blue-300 bg-blue-50"
              : b.status === "Paid" ? "border-emerald-300 bg-emerald-50"
              : "border-slate-200 bg-white"
            }`}>
              <div className="flex flex-wrap items-baseline gap-2 mb-3">
                <StatusBadge status={b.status === "PendingApproval" ? "Pending" : b.status} />
                <h3 className="text-sm font-bold text-slate-900">{b.vendor?.companyName || "—"}</h3>
                <span className="text-xs text-slate-600">· {b.serviceType || "(no service type)"}</span>
                <span className="ml-auto text-base font-bold text-[#E30613]">{formatCurrency(b.totalAmount)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <div><span className="text-slate-500">Bill #:</span> <span className="font-mono text-slate-800">{b.billNo || "—"}</span></div>
                <div><span className="text-slate-500">Bill Date:</span> <span className="text-slate-800">{b.billDate ? formatDate(b.billDate) : "—"}</span></div>
                <div><span className="text-slate-500">Unit:</span> <span className="text-slate-800">{b.unit?.unitNo || "—"}</span></div>
                <div><span className="text-slate-500">Tenant:</span> <span className="text-slate-800">{b.tenant?.name || "—"}</span></div>
                <div><span className="text-slate-500">Base:</span> <span className="text-slate-800">{formatCurrency(b.baseAmount)}</span></div>
                <div><span className="text-slate-500">VAT:</span> <span className="text-slate-800">{formatCurrency(b.vatAmount)}</span></div>
                <div><span className="text-slate-500">Method:</span> <span className="text-slate-800">{b.paymentMethod || "—"}</span></div>
                <div><span className="text-slate-500">Vendor Phone:</span> <span className="text-slate-800">{b.vendor?.phone || "—"}</span></div>
              </div>
              {b.description && (
                <p className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200">{b.description}</p>
              )}
              {b.paymentMethod === "Cheque" && (b.chequeNo || b.chequeBank) && (
                <p className="mt-2 text-[11px] text-slate-600">
                  📝 Cheque #{b.chequeNo} · {b.chequeBank}{b.chequeDate ? ` · dated ${b.chequeDate}` : ""}
                </p>
              )}
              {b.paymentMethod === "BankTransfer" && (b.bankRef || b.bankName) && (
                <p className="mt-2 text-[11px] text-slate-600">
                  🏦 Transfer ref {b.bankRef} · {b.bankName}{b.paymentDate ? ` · on ${b.paymentDate}` : ""}
                </p>
              )}
              {b.rejectReason && <p className="mt-2 text-[11px] text-red-700">✕ Rejected — {b.rejectReason}</p>}
              {b.approverNote && b.status === "Approved" && <p className="mt-2 text-[11px] text-emerald-700">✓ {b.approverNote}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {b.invoiceFileName && (
                  <a href={`/api/vendor-bills/${b.id}/upload?kind=invoice`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
                    <FileText className="h-3.5 w-3.5" /> Vendor Invoice
                  </a>
                )}
                {b.paymentFileName && (
                  <a href={`/api/vendor-bills/${b.id}/upload?kind=payment`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
                    <FileText className="h-3.5 w-3.5" /> Payment Proof
                  </a>
                )}
                {b.status === "PendingApproval" && (
                  <>
                    <button
                      disabled={!!busy[b.id]}
                      onClick={() => act(b.id, "approve")}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      disabled={!!busy[b.id]}
                      onClick={() => act(b.id, "reject")}
                      className="inline-flex items-center gap-1 rounded-md bg-white text-red-700 px-3 py-1.5 text-[11px] font-medium ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
