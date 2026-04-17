"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatCurrency, formatDate } from "@/lib/utils"
import { RefreshCw, AlertTriangle, Plus, Zap, Send, RefreshCcw } from "lucide-react"

interface AlertRow {
  unitId: string
  unitNo: string
  unitType: string
  contractEnd: string
  currentRent: number
  daysUntilExpiry: number
  category: string
  tenant: { id: string; name: string } | null
  renewalStatus: string
  renewalId: string | null
  renewalRequest: {
    id: string
    status: string
    proposedRent: number
    finalRent: number
    requestedAt: string
  } | null
  recentActivity: Array<{
    template: string
    subject: string
    sentAt: string
    status: string
  }>
  [key: string]: unknown
}

const ACTIVITY_ICON: Record<string, string> = {
  renewal_remind: '📧',
  renewal_congrats: '🎉',
  'renewal_not-renew': '🚫',
}
const ACTIVITY_LABEL: Record<string, string> = {
  renewal_remind: 'Reminder sent',
  renewal_congrats: 'Congrats sent',
  'renewal_not-renew': 'Not-renewing notice sent',
}
const formatTimeAgo = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

interface RenewalRow {
  id: string
  unitId: string
  tenantId: string | null
  unit: { id: string; unitNo: string; currentRent: number; contractEnd: string } | null
  tenant: { id: string; name: string } | null
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
  [key: string]: unknown
}

const defaultForm = {
  unitId: "",
  tenantId: "",
  proposedRent: "",
  newStartDate: "",
  newEndDate: "",
  tenantNotes: "",
}

export default function RenewalsPage() {
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [renewals, setRenewals] = useState<RenewalRow[]>([])
  const [units, setUnits] = useState<{ id: string; unitNo: string; tenantId: string | null; currentRent: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoResult, setAutoResult] = useState<{ scanned: number; sent: number; skipped: number } | null>(null)

  const runAutoCheck = async () => {
    if (!confirm("Scan all leases and send renewal notices (90/60/30 day)? Already-sent notices will be skipped.")) return
    setAutoRunning(true)
    setAutoResult(null)
    try {
      const res = await fetch("/api/renewals/auto-check", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setAutoResult({ scanned: data.scanned, sent: data.sent, skipped: data.skipped })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-check failed")
    } finally {
      setAutoRunning(false)
    }
  }

  const sendNotice = async (unitId: string) => {
    if (!confirm("Send the appropriate renewal notice email to this tenant?")) return
    try {
      const res = await fetch("/api/renewals/auto-check", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      const mine = (data.actions || []).find((a: { unitNo: string }) => {
        const row = alerts.find((x) => x.unitId === unitId)
        return row && a.unitNo === row.unitNo
      })
      if (mine?.status === "sent") {
        setAutoResult({ scanned: data.scanned, sent: data.sent, skipped: data.skipped })
      } else if (mine?.reason === "already sent") {
        setError("A notice for this milestone has already been sent.")
      } else if (mine?.reason) {
        setError(`Skipped: ${mine.reason}`)
      }
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed")
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const [alertRes, renewRes, unitRes] = await Promise.all([
        fetch("/api/renewals/expiry-alerts"),
        fetch("/api/renewals"),
        fetch("/api/units"),
      ])
      if (alertRes.ok) { const d = await alertRes.json(); setAlerts(d.alerts || []) }
      if (!renewRes.ok) throw new Error("Failed to fetch renewals")
      setRenewals(await renewRes.json())
      if (unitRes.ok) {
        const d = await unitRes.json()
        setUnits(d.filter((u: { status: string }) => u.status === "Occupied").map((u: { id: string; unitNo: string; tenantId: string | null; currentRent: number }) => ({ id: u.id, unitNo: u.unitNo, tenantId: u.tenantId, currentRent: u.currentRent })))
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
      const res = await fetch("/api/renewals", {
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

  const updateRenewal = async (id: string, data: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/renewals/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const urgencyColor = (category: string) => {
    if (category.includes("Expired")) return "border-l-red-500 bg-red-900/10"
    if (category.includes("Critical")) return "border-l-amber-500 bg-amber-900/10"
    if (category.includes("Warning")) return "border-l-yellow-500 bg-yellow-900/10"
    return "border-l-blue-500 bg-blue-900/10"
  }

  const renewalColumns: Column<RenewalRow>[] = [
    { key: "unit", header: "Unit", render: (r) => r.unit?.unitNo || "--" },
    { key: "tenant", header: "Tenant", render: (r) => r.tenant?.name || "--" },
    { key: "currentRent", header: "Current Rent", render: (r) => formatCurrency(r.currentRent) },
    { key: "proposedRent", header: "Proposed", render: (r) => r.proposedRent ? formatCurrency(r.proposedRent) : "--" },
    { key: "staffRecommendedRent", header: "Recommended", render: (r) => r.staffRecommendedRent ? formatCurrency(r.staffRecommendedRent) : "--" },
    { key: "finalRent", header: "Final", render: (r) => r.finalRent ? formatCurrency(r.finalRent) : "--" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex gap-1">
          {r.status === "Requested" && (
            <button onClick={(e) => { e.stopPropagation(); const rent = prompt("Staff recommended rent:", String(r.currentRent)); if (rent) updateRenewal(r.id, { status: "Under Review", staffRecommendedRent: rent }) }} className="rounded px-2 py-1 text-xs text-blue-400 hover:bg-blue-900/30">
              Review
            </button>
          )}
          {r.status === "Under Review" && (
            <>
              <button onClick={(e) => { e.stopPropagation(); const rent = prompt("Final rent:", String(r.staffRecommendedRent || r.currentRent)); if (rent) updateRenewal(r.id, { status: "Accepted", finalRent: rent }) }} className="rounded px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-900/30">
                Approve
              </button>
              <button onClick={(e) => { e.stopPropagation(); updateRenewal(r.id, { status: "Rejected" }) }} className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/30">
                Reject
              </button>
            </>
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
          <h1 className="text-2xl font-bold text-white">Lease Renewals</h1>
          <p className="mt-1 text-sm text-slate-400">{alerts.length} active leases — renew, remind, or mark not renewing</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAutoCheck}
            disabled={autoRunning}
            className="flex items-center gap-2 rounded-lg border border-emerald-600/50 bg-emerald-600/15 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-600/25 disabled:opacity-60"
          >
            <Zap className={`h-4 w-4 ${autoRunning ? "animate-pulse" : ""}`} /> {autoRunning ? "Running…" : "Run Auto-Check"}
          </button>
          <button onClick={() => { setForm(defaultForm); setAddOpen(true) }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500">
            <Plus className="h-4 w-4" /> Create Renewal
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      {autoResult && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-800 bg-emerald-900/20 p-3 text-sm text-emerald-300">
          <span>Auto-check complete: scanned <strong>{autoResult.scanned}</strong> · sent <strong>{autoResult.sent}</strong> · skipped <strong>{autoResult.skipped}</strong>.</span>
          <button onClick={() => setAutoResult(null)} className="underline">Dismiss</button>
        </div>
      )}

      {/* Expiry Alerts with filter pills */}
      {alerts.length > 0 && (
        <ExpiryAlertsBlock
          alerts={alerts}
          urgencyColor={urgencyColor}
          onSendNotice={sendNotice}
          onRenew={(a) => {
            const start = (() => {
              const d = new Date(a.contractEnd)
              d.setDate(d.getDate() + 1)
              return d.toISOString().slice(0, 10)
            })()
            const end = (() => {
              const d = new Date(a.contractEnd)
              d.setFullYear(d.getFullYear() + 1)
              return d.toISOString().slice(0, 10)
            })()
            setForm({
              unitId: a.unitId,
              tenantId: a.tenant?.id || "",
              proposedRent: String(a.currentRent),
              newStartDate: start,
              newEndDate: end,
              tenantNotes: "",
            })
            setAddOpen(true)
          }}
        />
      )}

      {/* Renewal Requests Table */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
          <RefreshCw className="h-4 w-4 text-amber-400" /> Renewal Requests
        </h2>
        <DataTable columns={renewalColumns} data={renewals} searchPlaceholder="Search renewals..." searchKeys={["status"]} />
      </div>

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Create Renewal Request" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.unitId}>{saving ? "Creating..." : "Create"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Unit *</label>
            <select value={form.unitId} onChange={(e) => {
              const unit = units.find(u => u.id === e.target.value)
              setForm({ ...form, unitId: e.target.value, tenantId: unit?.tenantId || "" })
            }} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
              <option value="">Select unit</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.unitNo} - {formatCurrency(u.currentRent)}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Proposed Rent</label>
              <input type="number" value={form.proposedRent} onChange={(e) => setForm({ ...form, proposedRent: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
              <p className="mt-1 text-[10px] text-slate-500">
                RERA Decree 43/2013: rent increase is capped based on the RERA index for the area.
                Check{" "}
                <a href="https://dubailand.gov.ae/en/eservices/rental-index-rera/" target="_blank" rel="noreferrer" className="text-amber-400 underline">RERA calculator</a>.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">New Start Date</label>
              <input type="date" value={form.newStartDate} onChange={(e) => setForm({ ...form, newStartDate: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">New End Date</label>
              <input type="date" value={form.newEndDate} onChange={(e) => setForm({ ...form, newEndDate: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
            <textarea value={form.tenantNotes} onChange={(e) => setForm({ ...form, tenantNotes: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ExpiryAlertsBlock({
  alerts,
  urgencyColor,
  onSendNotice,
  onRenew,
}: {
  alerts: AlertRow[]
  urgencyColor: (c: string) => string
  onSendNotice: (unitId: string) => void
  onRenew: (a: AlertRow) => void
}) {
  const [filter, setFilter] = useState<string>("all")

  const counts = useMemo(() => {
    const c = { all: alerts.length, expired: 0, critical: 0, warning: 0, notice: 0, stable: 0 }
    for (const a of alerts) {
      if (a.daysUntilExpiry <= 0) c.expired++
      else if (a.daysUntilExpiry <= 30) c.critical++
      else if (a.daysUntilExpiry <= 60) c.warning++
      else if (a.daysUntilExpiry <= 90) c.notice++
      else c.stable++
    }
    return c
  }, [alerts])

  const filtered = useMemo(() => {
    if (filter === "all") return alerts
    return alerts.filter((a) => {
      const d = a.daysUntilExpiry
      if (filter === "expired") return d <= 0
      if (filter === "critical") return d > 0 && d <= 30
      if (filter === "warning") return d > 30 && d <= 60
      if (filter === "notice") return d > 60 && d <= 90
      if (filter === "stable") return d > 90
      return true
    })
  }, [alerts, filter])

  const [pendingQA, setPendingQA] = useState<
    | { action: 'remind' | 'not-renew' | 'congrats'; alert: AlertRow }
    | null
  >(null)
  const [qaMessage, setQaMessage] = useState("")
  const [qaBusy, setQaBusy] = useState(false)
  const [qaResult, setQaResult] = useState<{ ok: boolean; text: string } | null>(null)

  const runQuickAction = async () => {
    if (!pendingQA) return
    setQaBusy(true)
    setQaResult(null)
    try {
      const res = await fetch('/api/renewals/quick-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: pendingQA.alert.unitId, action: pendingQA.action, message: qaMessage }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed')
      setQaResult({ ok: true, text: `✓ Email sent to ${pendingQA.alert.tenant?.name || 'tenant'}` })
      setTimeout(() => { setPendingQA(null); setQaMessage(""); setQaResult(null) }, 1200)
    } catch (e) {
      setQaResult({ ok: false, text: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setQaBusy(false)
    }
  }

  const quickAction = (unitId: string, action: 'remind' | 'not-renew' | 'congrats') => {
    const alert = alerts.find((a) => a.unitId === unitId)
    if (!alert) return
    setQaMessage("")
    setQaResult(null)
    setPendingQA({ action, alert })
  }

  const FilterPill = ({ value, label, count, color }: { value: string; label: string; count: number; color: string }) => (
    <button
      onClick={() => setFilter(value)}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        filter === value
          ? `${color} text-white`
          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}
    >
      {label} <span className="opacity-75">({count})</span>
    </button>
  )

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400">
        <AlertTriangle className="h-4 w-4 text-amber-400" /> Expiry Alerts
      </h2>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <FilterPill value="all" label="All" count={counts.all} color="bg-amber-500" />
        <FilterPill value="expired" label="Expired" count={counts.expired} color="bg-red-600" />
        <FilterPill value="critical" label="≤30 days" count={counts.critical} color="bg-amber-500" />
        <FilterPill value="warning" label="31–60 days" count={counts.warning} color="bg-yellow-500" />
        <FilterPill value="notice" label="61–90 days" count={counts.notice} color="bg-blue-500" />
        <FilterPill value="stable" label="Stable (90+)" count={counts.stable} color="bg-emerald-600" />
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-500">
          No alerts in this category.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <div key={a.unitId} className={`rounded-lg border-l-4 border border-slate-800 p-4 ${urgencyColor(a.category)}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-white">Unit {a.unitNo}</p>
                  <p className="text-xs text-slate-400">{a.tenant?.name || "No tenant"}</p>
                </div>
                <span className="text-xs font-medium text-slate-500">{a.category}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">Expires: {formatDate(a.contractEnd)}</span>
                <span className={a.daysUntilExpiry <= 0 ? "font-bold text-red-400" : a.daysUntilExpiry <= 30 ? "text-amber-400" : "text-blue-400"}>
                  {a.daysUntilExpiry <= 0 ? `${Math.abs(a.daysUntilExpiry)} days overdue` : `${a.daysUntilExpiry} days left`}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Rent: {formatCurrency(a.currentRent)} · Status: {a.renewalStatus}
              </div>

              {/* Renewal request panel — only when one exists */}
              {a.renewalRequest && (
                <div className="mt-2 rounded-md border border-slate-700 bg-slate-900/40 px-2 py-1.5 text-[11px] text-slate-300">
                  <div className="flex items-center justify-between">
                    <strong className="text-amber-400">Renewal Request</strong>
                    <span className="text-slate-500">{formatTimeAgo(a.renewalRequest.requestedAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <StatusBadge status={a.renewalRequest.status} />
                    {a.renewalRequest.proposedRent > 0 && (
                      <span>Proposed: {formatCurrency(a.renewalRequest.proposedRent)}</span>
                    )}
                    {a.renewalRequest.finalRent > 0 && (
                      <span className="text-emerald-300">Final: {formatCurrency(a.renewalRequest.finalRent)}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Recent activity timeline (last 30 days) */}
              {a.recentActivity && a.recentActivity.length > 0 && (
                <div className="mt-2 space-y-0.5 rounded-md bg-slate-900/30 px-2 py-1.5 text-[11px]">
                  <p className="text-[10px] font-semibold uppercase text-slate-500">Recent activity</p>
                  {a.recentActivity.map((act, i) => (
                    <div key={i} className="flex items-center justify-between text-slate-300">
                      <span>
                        {ACTIVITY_ICON[act.template] || '✉️'}{' '}
                        {ACTIVITY_LABEL[act.template] || act.subject}
                      </span>
                      <span className="text-slate-500">{formatTimeAgo(act.sentAt)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => onRenew(a)}
                  className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  <RefreshCcw className="h-3 w-3" /> Renew Now
                </button>
                <button
                  onClick={() => quickAction(a.unitId, 'remind')}
                  className="inline-flex items-center gap-1 rounded border border-amber-700/40 bg-amber-600/10 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-600/20"
                >
                  <Send className="h-3 w-3" /> Reminder
                </button>
                <button
                  onClick={() => quickAction(a.unitId, 'congrats')}
                  className="inline-flex items-center gap-1 rounded border border-emerald-700/40 bg-emerald-600/10 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-600/20"
                >
                  🎉 Congrats
                </button>
                <button
                  onClick={() => quickAction(a.unitId, 'not-renew')}
                  className="inline-flex items-center gap-1 rounded border border-red-700/40 bg-red-600/10 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-600/20"
                >
                  Not Renewing
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick-action confirmation modal */}
      <Modal
        open={!!pendingQA}
        onOpenChange={(o) => { if (!o && !qaBusy) { setPendingQA(null); setQaMessage(""); setQaResult(null) } }}
        title={
          pendingQA?.action === 'remind' ? 'Send Renewal Reminder'
          : pendingQA?.action === 'congrats' ? 'Send Renewal Congrats'
          : 'Mark Not Renewing'
        }
        size="md"
        footer={
          <>
            <ModalCancelButton onClick={() => { setPendingQA(null); setQaMessage(""); setQaResult(null) }} />
            <button
              onClick={runQuickAction}
              disabled={qaBusy}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-40 ${
                pendingQA?.action === 'not-renew'
                  ? 'bg-red-600 hover:bg-red-500'
                  : pendingQA?.action === 'congrats'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-900'
              }`}
            >
              {qaBusy ? 'Sending…' : pendingQA?.action === 'not-renew' ? 'Confirm — Mark Not Renewing' : 'Send Email'}
            </button>
          </>
        }
      >
        {pendingQA && (
          <div className="space-y-4">
            <div className={`rounded-xl border p-4 ${
              pendingQA.action === 'not-renew'
                ? 'border-red-700/40 bg-red-900/10'
                : pendingQA.action === 'congrats'
                ? 'border-emerald-700/40 bg-emerald-900/10'
                : 'border-amber-700/40 bg-amber-900/10'
            }`}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div><span className="text-slate-500">Unit:</span> <span className="text-white font-semibold">{pendingQA.alert.unitNo}</span></div>
                <div><span className="text-slate-500">Tenant:</span> <span className="text-white">{pendingQA.alert.tenant?.name || '—'}</span></div>
                <div><span className="text-slate-500">Lease ends:</span> <span className="text-white">{formatDate(pendingQA.alert.contractEnd)}</span></div>
                <div><span className="text-slate-500">Current rent:</span> <span className="text-white font-semibold">{formatCurrency(pendingQA.alert.currentRent)}</span></div>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              {pendingQA.action === 'remind' && 'A friendly renewal reminder email will be sent to the tenant.'}
              {pendingQA.action === 'congrats' && 'A congratulations email confirming the renewal will be sent.'}
              {pendingQA.action === 'not-renew' && 'The lease will be marked as Not Renewing and a confirmation email with move-out coordination will be sent.'}
            </p>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Optional message to include
              </label>
              <textarea
                value={qaMessage}
                onChange={(e) => setQaMessage(e.target.value)}
                rows={3}
                placeholder="(Leave blank for the default message)"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </div>

            {qaResult && (
              <div className={`rounded-lg border p-3 text-xs ${
                qaResult.ok
                  ? 'border-emerald-700/40 bg-emerald-900/20 text-emerald-300'
                  : 'border-red-700/40 bg-red-900/20 text-red-300'
              }`}>
                {qaResult.text}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
