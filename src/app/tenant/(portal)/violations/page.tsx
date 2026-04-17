"use client"

import { useState, useEffect } from "react"

interface Violation {
  id: string
  violationNo: string
  type: string
  description: string
  evidence: string
  severity: string
  fineAmount: number
  status: string
  issuedBy: string
  acknowledgedAt: string | null
  paidAt: string | null
  notes: string
  createdAt: string
  unit?: { unitNo: string } | null
}

const sevColor: Record<string, string> = {
  Warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Minor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Major: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Critical: "bg-red-500/20 text-red-400 border-red-500/30",
}

const statusColor: Record<string, string> = {
  Issued: "bg-amber-500/20 text-amber-400",
  Acknowledged: "bg-cyan-500/20 text-cyan-400",
  Paid: "bg-emerald-500/20 text-emerald-400",
  Disputed: "bg-purple-500/20 text-purple-400",
  Waived: "bg-slate-500/20 text-slate-400",
}

const fmt = (iso: string | null) => {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function TenantViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [acknowledging, setAcknowledging] = useState("")
  const [error, setError] = useState("")

  function load() {
    fetch("/api/tenant/violations")
      .then((r) => r.json())
      .then((d) => setViolations(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function acknowledge(id: string) {
    if (!confirm("Acknowledge this violation notice?")) return
    setAcknowledging(id)
    try {
      const r = await fetch(`/api/tenant/violations/${id}/acknowledge`, { method: "POST" })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || "Failed")
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setAcknowledging("")
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" /></div>

  const totalUnpaid = violations.filter((v) => !v.paidAt && v.status !== "Waived").reduce((s, v) => s + v.fineAmount, 0)
  const unacknowledged = violations.filter((v) => !v.acknowledgedAt).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Violations</h1>
        <p className="mt-1 text-sm text-slate-400">
          {violations.length} notice{violations.length === 1 ? "" : "s"} on record
          {unacknowledged > 0 && <span className="text-amber-400"> · {unacknowledged} awaiting your acknowledgement</span>}
          {totalUnpaid > 0 && <span className="text-red-400"> · AED {totalUnpaid.toLocaleString()} unpaid</span>}
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      {violations.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
          <p className="text-emerald-300">No violations on record. Keep up the good standing 🟢</p>
        </div>
      ) : (
        <div className="space-y-3">
          {violations.map((v) => (
            <div key={v.id} className={`rounded-xl border p-4 ${sevColor[v.severity] || "bg-slate-500/10 border-slate-500/30"}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono opacity-80">{v.violationNo}</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{v.type}</p>
                  <p className="text-[11px] opacity-75">
                    Issued {fmt(v.createdAt)} by {v.issuedBy || "CRE"}
                    {v.unit?.unitNo ? ` · Unit ${v.unit.unitNo}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[v.status] || "bg-slate-500/20 text-slate-400"}`}>{v.status}</span>
                  <span className="text-xs font-bold">{v.severity}</span>
                </div>
              </div>

              {v.description && <p className="text-xs text-white/80 mb-3">{v.description}</p>}

              {v.fineAmount > 0 ? (
                <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Fine</span>
                  <span className="text-base font-bold text-white">AED {v.fineAmount.toLocaleString()}</span>
                </div>
              ) : (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-center text-[11px] text-amber-300">
                  Warning notice — no fine issued
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                {v.acknowledgedAt ? (
                  <span className="text-cyan-300">✓ Acknowledged {fmt(v.acknowledgedAt)}</span>
                ) : (
                  <button
                    onClick={() => acknowledge(v.id)}
                    disabled={acknowledging === v.id}
                    className="inline-flex items-center gap-1 rounded-md bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {acknowledging === v.id ? "…" : "I Acknowledge"}
                  </button>
                )}
                {v.paidAt && <span className="text-emerald-300">✓ Paid {fmt(v.paidAt)}</span>}
                <span className="ml-auto text-slate-400">
                  Dispute? Email <a href="mailto:info@cre.ae" className="text-amber-300 underline">info@cre.ae</a> within 7 days.
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
