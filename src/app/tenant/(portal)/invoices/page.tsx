"use client"

import { useState, useEffect } from "react"
import { Upload, Check, X } from "lucide-react"

interface Invoice {
  id: string
  invoiceNo: string
  type: string
  amount: number
  vatAmount: number
  totalAmount: number
  dueDate: string
  paidAmount: number
  status: string
  periodStart: string
  periodEnd: string
  unit?: { unitNo: string } | null
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 0 }).format(n)
}

const statusColor: Record<string, string> = {
  Paid: "bg-emerald-500/20 text-emerald-400",
  Overdue: "bg-red-500/20 text-red-400",
  Draft: "bg-slate-500/20 text-slate-400",
  Sent: "bg-blue-500/20 text-blue-400",
  "Partially Paid": "bg-amber-500/20 text-amber-400",
  "Tenant Submitted": "bg-purple-500/20 text-purple-400",
  Cancelled: "bg-slate-500/20 text-slate-500",
}

export default function TenantInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [proofFor, setProofFor] = useState<Invoice | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofNote, setProofNote] = useState("")
  const [proofBusy, setProofBusy] = useState(false)
  const [proofMsg, setProofMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadInvoices = () => {
    setLoading(true)
    fetch("/api/tenant/invoices")
      .then((r) => r.json())
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadInvoices() }, [])

  const submitProof = async () => {
    if (!proofFor || !proofFile) return
    setProofBusy(true)
    setProofMsg(null)
    try {
      const fd = new FormData()
      fd.append("file", proofFile)
      if (proofNote) fd.append("note", proofNote)
      const r = await fetch(`/api/invoices/${proofFor.id}/proof`, { method: "POST", body: fd })
      const data = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(data.error || "Upload failed")
      setProofMsg({ ok: true, text: "✓ Proof submitted. Our team will verify and update the invoice status." })
      setProofFile(null); setProofNote("")
      setTimeout(() => { setProofFor(null); setProofMsg(null); loadInvoices() }, 1500)
    } catch (e) {
      setProofMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" })
    } finally {
      setProofBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">My Invoices</h1>

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">Invoice #</th>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium">Due Date</th>
              <th className="px-4 py-3 font-medium text-right">Paid</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No invoices found
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{inv.invoiceNo}</td>
                  <td className="px-4 py-3 text-slate-300">{inv.unit?.unitNo || "-"}</td>
                  <td className="px-4 py-3 text-slate-300">{inv.type}</td>
                  <td className="px-4 py-3 text-right text-white">{formatCurrency(inv.totalAmount)}</td>
                  <td className="px-4 py-3 text-slate-300">{inv.dueDate}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(inv.paidAmount)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[inv.status] || "bg-slate-500/20 text-slate-400"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {inv.status === "Paid" ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
                        <Check className="h-3 w-3" /> Paid
                      </span>
                    ) : inv.status === "Cancelled" ? (
                      <span className="text-xs text-slate-500">Cancelled</span>
                    ) : inv.status === "Tenant Submitted" ? (
                      <span
                        title="Your payment proof is being reviewed by the management team."
                        className="inline-flex items-center gap-1 rounded-md bg-purple-500/15 px-2 py-1 text-xs font-semibold text-purple-300"
                      >
                        <Check className="h-3 w-3" /> Submitted — awaiting review
                      </span>
                    ) : (
                      <button
                        onClick={() => { setProofFor(inv); setProofFile(null); setProofNote(""); setProofMsg(null) }}
                        className="inline-flex items-center gap-1 rounded-md bg-teal-600 hover:bg-teal-500 px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        <Upload className="h-3 w-3" /> Submit Proof
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Proof upload modal */}
      {proofFor && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => !proofBusy && setProofFor(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <h3 className="text-sm font-semibold text-white">Submit Payment Proof</h3>
              <button
                onClick={() => setProofFor(null)}
                disabled={proofBusy}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div><span className="text-slate-500">Invoice:</span> <span className="font-mono text-white">{proofFor.invoiceNo}</span></div>
                  <div><span className="text-slate-500">Amount:</span> <span className="text-white font-semibold">{formatCurrency(proofFor.totalAmount)}</span></div>
                  <div><span className="text-slate-500">Due:</span> <span className="text-white">{proofFor.dueDate}</span></div>
                  <div><span className="text-slate-500">Type:</span> <span className="text-white">{proofFor.type}</span></div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Receipt / proof file <span className="text-red-400">*</span>
                </label>
                {proofFile ? (
                  <div className="flex items-center justify-between rounded-md bg-white/5 border border-white/10 px-3 py-2 text-xs">
                    <span className="truncate text-white">{proofFile.name} <span className="text-slate-500">({(proofFile.size / 1024).toFixed(0)} KB)</span></span>
                    <button onClick={() => setProofFile(null)} className="text-red-400 hover:text-red-300">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-teal-600 file:px-2 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-teal-500"
                  />
                )}
                <p className="mt-1 text-[10px] text-slate-500">PDF / JPG / PNG / WebP, max 10 MB</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Note (optional)</label>
                <textarea
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  rows={3}
                  placeholder="e.g. Bank transfer ref 12345 from Emirates NBD"
                  className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50"
                />
              </div>

              {proofMsg && (
                <div className={`rounded-md px-3 py-2 text-xs ${
                  proofMsg.ok ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                  : "bg-red-500/10 text-red-300 border border-red-500/30"
                }`}>
                  {proofMsg.text}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3">
              <button
                onClick={() => setProofFor(null)}
                disabled={proofBusy}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={submitProof}
                disabled={proofBusy || !proofFile}
                className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
              >
                {proofBusy ? "Uploading…" : (<><Check className="h-3.5 w-3.5" /> Submit</>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
