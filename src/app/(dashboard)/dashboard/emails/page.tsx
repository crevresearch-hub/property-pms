"use client"

import { useEffect, useMemo, useState } from "react"
import { Mail, RefreshCw, Search } from "lucide-react"

interface EmailLogRow {
  id: string
  toEmail: string
  toName: string
  subject: string
  template: string
  status: string
  errorMessage: string
  triggeredBy: string
  refType: string
  refId: string
  sentAt: string
}

const TEMPLATE_LABEL: Record<string, string> = {
  tenancy_contract_generated: "Contract — for signing",
  tenant_activated_welcome: "Welcome — activation",
  upfront_receipt: "Upfront receipt",
  rent_status: "Rent status (manual)",
  cheque_status_update: "Cheque cleared / rejected",
  renewal_remind: "Renewal — reminder",
  renewal_congrats: "Renewal — congrats",
  "renewal_not-renew": "Renewal — not renewing",
  tenant_portal_welcome: "Portal credentials",
  tenancy_terminated: "Tenancy terminated",
  contract_signed: "Owner contract signed",
}

const formatTime = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-GB")
}

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<EmailLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [templateFilter, setTemplateFilter] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<EmailLogRow | null>(null)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/email-logs")
      const d = await r.json()
      setLogs(d.logs || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchLogs() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false
      if (templateFilter !== "all" && l.template !== templateFilter) return false
      if (q && !`${l.toEmail} ${l.toName} ${l.subject}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [logs, statusFilter, templateFilter, search])

  const templates = useMemo(() => {
    const set = new Set<string>()
    logs.forEach((l) => set.add(l.template))
    return [...set].sort()
  }, [logs])

  const sentCount = logs.filter((l) => l.status === "Sent").length
  const failedCount = logs.filter((l) => l.status === "Failed").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Log</h1>
          <p className="mt-1 text-sm text-slate-400">
            {logs.length} emails on record · {sentCount} sent · {failedCount > 0 && <span className="text-red-400">{failedCount} failed</span>}
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: "all", l: `All (${logs.length})` },
              { v: "Sent", l: `Sent (${sentCount})` },
              { v: "Failed", l: `Failed (${failedCount})` },
              { v: "Queued", l: `Queued (${logs.filter((l) => l.status === "Queued").length})` },
            ].map((p) => (
              <button
                key={p.v}
                onClick={() => setStatusFilter(p.v)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  statusFilter === p.v
                    ? p.v === "Failed"
                      ? "bg-red-600 text-white"
                      : "bg-amber-500 text-slate-900"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {p.l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Template</p>
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            >
              <option value="all">All templates ({templates.length})</option>
              {templates.map((t) => (
                <option key={t} value={t}>{TEMPLATE_LABEL[t] || t}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Search</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Email, name or subject"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-xs text-slate-200">
          <thead className="bg-slate-900 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold uppercase">Sent</th>
              <th className="px-3 py-2 text-left font-semibold uppercase">To</th>
              <th className="px-3 py-2 text-left font-semibold uppercase">Subject</th>
              <th className="px-3 py-2 text-left font-semibold uppercase">Template</th>
              <th className="px-3 py-2 text-left font-semibold uppercase">By</th>
              <th className="px-3 py-2 text-left font-semibold uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500"><Mail className="mx-auto h-5 w-5 animate-pulse" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No emails match the current filters.</td></tr>
            ) : (
              filtered.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setSelected(l)}
                  className="cursor-pointer border-t border-slate-800 hover:bg-slate-900/60"
                >
                  <td className="px-3 py-2 whitespace-nowrap text-slate-400">{formatTime(l.sentAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-medium text-white">{l.toName || "—"}</div>
                    <div className="text-[10px] text-slate-500">{l.toEmail}</div>
                  </td>
                  <td className="px-3 py-2"><div className="max-w-[28ch] truncate" title={l.subject}>{l.subject}</div></td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                      {TEMPLATE_LABEL[l.template] || l.template}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-400">{l.triggeredBy || "system"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        l.status === "Sent"
                          ? "bg-emerald-100 text-emerald-700"
                          : l.status === "Failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Email detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{selected.subject}</h3>
                <p className="text-xs text-slate-500">{selected.toName} &lt;{selected.toEmail}&gt; · {new Date(selected.sentAt).toLocaleString("en-GB")} · by {selected.triggeredBy || "system"}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
            </div>
            <div className="overflow-auto p-4 text-xs text-slate-700">
              <div className="mb-2 flex flex-wrap gap-2">
                <span className="rounded bg-slate-100 px-2 py-0.5">Template: <strong>{TEMPLATE_LABEL[selected.template] || selected.template}</strong></span>
                <span className="rounded bg-slate-100 px-2 py-0.5">Status: <strong>{selected.status}</strong></span>
                {selected.refType && <span className="rounded bg-slate-100 px-2 py-0.5">Ref: {selected.refType}</span>}
              </div>
              {selected.errorMessage && (
                <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-red-800">
                  <strong>Error:</strong> {selected.errorMessage}
                </div>
              )}
              <p className="mb-2 text-[10px] uppercase text-slate-500">View the email exactly as the tenant received it:</p>
              <iframe
                srcDoc={`<a-fetch href="/api/email-logs/${selected.id}/body"></a-fetch>`}
                title="Email"
                className="h-[60vh] w-full rounded border border-slate-200"
                onLoad={(e) => {
                  // Lazy-load body via separate fetch since EmailLog body isn't in list response.
                  const iframe = e.currentTarget
                  fetch(`/api/email-logs/${selected.id}`).then((r) => r.json()).then((data) => {
                    if (data?.body && iframe.contentDocument) {
                      iframe.contentDocument.open()
                      iframe.contentDocument.write(data.body)
                      iframe.contentDocument.close()
                    }
                  })
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
