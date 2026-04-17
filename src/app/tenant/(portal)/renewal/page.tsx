"use client"

import { useState, useEffect, FormEvent } from "react"

interface UnitInfo {
  id: string
  unitNo: string
  unitType: string
  contractStart: string
  contractEnd: string
  currentRent: number
}

interface Renewal {
  id: string
  unitId: string
  currentRent: number
  proposedRent: number
  staffRecommendedRent: number
  finalRent: number
  newStartDate: string
  newEndDate: string
  status: string
  tenantNotes: string
  staffNotes: string
  ceoNotes: string
  requestedAt: string
  reviewedAt: string | null
  decidedAt: string | null
  acceptedAt: string | null
  unit?: { unitNo: string; contractStart: string; contractEnd: string; currentRent: number } | null
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return 0
  const end = new Date(dateStr)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 0 }).format(n)
}

const statusColor: Record<string, string> = {
  Requested: "bg-blue-500/20 text-blue-400",
  "Under Review": "bg-amber-500/20 text-amber-400",
  Approved: "bg-emerald-500/20 text-emerald-400",
  Rejected: "bg-red-500/20 text-red-400",
  Accepted: "bg-teal-500/20 text-teal-400",
}

export default function TenantRenewalPage() {
  const [units, setUnits] = useState<UnitInfo[]>([])
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState("")
  const [proposedRent, setProposedRent] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  function loadData() {
    Promise.all([
      fetch("/api/tenant/unit").then((r) => r.json()),
      fetch("/api/tenant/renewal").then((r) => r.json()),
    ])
      .then(([u, r]) => {
        const unitList = Array.isArray(u) ? u : []
        setUnits(unitList)
        setRenewals(Array.isArray(r) ? r : [])
        if (unitList.length > 0 && !selectedUnitId) {
          setSelectedUnitId(unitList[0].id)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedUnit = units.find((u) => u.id === selectedUnitId)
  const daysLeft = selectedUnit ? daysUntil(selectedUnit.contractEnd) : 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedUnitId) return
    setError("")
    setSuccess("")
    setSubmitting(true)

    try {
      const res = await fetch("/api/tenant/renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: selectedUnitId,
          proposedRent: proposedRent ? parseFloat(proposedRent) : undefined,
          notes,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to submit")
      } else {
        setSuccess("Renewal request submitted successfully")
        setProposedRent("")
        setNotes("")
        loadData()
      }
    } catch {
      setError("Failed to submit renewal request")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAccept(renewalId: string) {
    try {
      const res = await fetch(`/api/tenant/renewal/${renewalId}/accept`, {
        method: "PUT",
      })

      if (res.ok) {
        setSuccess("Renewal accepted! Your contract has been updated.")
        loadData()
      } else {
        const data = await res.json()
        setError(data.error || "Failed to accept")
      }
    } catch {
      setError("Failed to accept renewal")
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
      <h1 className="text-xl font-bold text-white">Lease Renewal</h1>

      {/* Current Lease Info */}
      {selectedUnit && (
        <div className="rounded-xl border border-white/5 bg-white/5 p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">Current Lease Information</h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Unit</p>
              <p className="text-lg font-bold text-white">{selectedUnit.unitNo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Current Rent</p>
              <p className="text-lg font-bold text-teal-400">{formatCurrency(selectedUnit.currentRent)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Contract End</p>
              <p className="text-lg font-bold text-white">{selectedUnit.contractEnd || "N/A"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Days Left</p>
              <p className={`text-lg font-bold ${daysLeft <= 30 ? "text-red-400" : daysLeft <= 90 ? "text-amber-400" : "text-white"}`}>
                {daysLeft} days
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Request Renewal Form */}
      <div className="rounded-xl border border-white/5 bg-white/5 p-6">
        <h3 className="mb-4 text-sm font-semibold text-white">Request Renewal</h3>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {units.length > 1 && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Select Unit</label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id} className="bg-slate-900">
                      {u.unitNo}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Proposed Rent (AED)</label>
              <input
                type="number"
                value={proposedRent}
                onChange={(e) => setProposedRent(e.target.value)}
                placeholder={selectedUnit ? String(selectedUnit.currentRent) : ""}
                className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes for management..."
                className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedUnitId}
            className="rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:from-teal-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Request Renewal"}
          </button>
        </form>
      </div>

      {/* Renewal History Table */}
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/5">
        <h3 className="border-b border-white/5 px-4 py-3 text-sm font-semibold text-white">Renewal History</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Current Rent</th>
              <th className="px-4 py-3 font-medium">Proposed</th>
              <th className="px-4 py-3 font-medium">Final Rent</th>
              <th className="px-4 py-3 font-medium">New Period</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Requested</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {renewals.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No renewal requests
                </td>
              </tr>
            ) : (
              renewals.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{r.unit?.unitNo || "-"}</td>
                  <td className="px-4 py-3 text-slate-300">{formatCurrency(r.currentRent)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatCurrency(r.proposedRent)}</td>
                  <td className="px-4 py-3 text-teal-400 font-medium">
                    {r.finalRent > 0 ? formatCurrency(r.finalRent) : "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {r.newStartDate && r.newEndDate
                      ? `${r.newStartDate} - ${r.newEndDate}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[r.status] || "bg-slate-500/20 text-slate-400"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(r.requestedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "Approved" ? (
                      <button
                        onClick={() => handleAccept(r.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        Accept
                      </button>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
