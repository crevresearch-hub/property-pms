"use client"

import { useState, useEffect, FormEvent } from "react"

interface Complaint {
  id: string
  complaintNo: string
  category: string
  subject: string
  description: string
  priority: string
  status: string
  resolution: string
  resolvedAt: string | null
  createdAt: string
  unit?: { unitNo: string } | null
}

const categories = ["Noise", "Cleanliness", "Common Area", "Parking", "Security", "Neighbour", "Building", "General"]
const priorities = ["Low", "Medium", "High"]

const statusColor: Record<string, string> = {
  Open: "bg-amber-500/20 text-amber-400",
  "In Progress": "bg-blue-500/20 text-blue-400",
  Resolved: "bg-emerald-500/20 text-emerald-400",
  Closed: "bg-slate-500/20 text-slate-400",
}

const fmt = (iso: string | null) => {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function TenantComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [category, setCategory] = useState("General")
  const [priority, setPriority] = useState("Medium")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  function load() {
    fetch("/api/tenant/complaints")
      .then((r) => r.json())
      .then((d) => setComplaints(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!subject.trim()) return
    setError(""); setSuccess(""); setSubmitting(true)
    try {
      const r = await fetch("/api/tenant/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, priority, subject, description }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || "Failed")
      setSuccess("✓ Complaint filed. Our team will respond shortly.")
      setSubject(""); setDescription(""); setPriority("Medium"); setCategory("General")
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Complaints</h1>

      {/* Submit form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">File a complaint</h2>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        {success && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{success}</div>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50">
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-slate-400 mb-1">Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50">
              {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="block text-xs text-slate-400 mb-1">Subject *</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Loud noise from upstairs neighbour every night"
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/50"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-slate-400 mb-1">Details</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what's happening, when it started, who's affected..."
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/50"
          />
        </label>

        <button
          type="submit"
          disabled={submitting || !subject.trim()}
          className="rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50"
        >
          {submitting ? "Filing…" : "File Complaint"}
        </button>
      </form>

      {/* List */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">My Complaints ({complaints.length})</h2>
        {complaints.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/5 p-8 text-center text-sm text-slate-500">
            You haven&rsquo;t filed any complaints yet.
          </div>
        ) : (
          <div className="space-y-3">
            {complaints.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-teal-400">{c.complaintNo}</p>
                    <p className="mt-0.5 text-sm font-semibold text-white">{c.subject}</p>
                    <p className="text-[11px] text-slate-400">{c.category} · {c.priority} priority · Filed {fmt(c.createdAt)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[c.status] || "bg-slate-500/20 text-slate-400"}`}>{c.status}</span>
                </div>
                {c.description && <p className="mt-2 text-xs text-slate-300 italic">&ldquo;{c.description}&rdquo;</p>}
                {c.resolution && (
                  <div className="mt-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs">
                    <p className="text-[10px] font-semibold uppercase text-emerald-300 mb-0.5">Resolution {c.resolvedAt && `· ${fmt(c.resolvedAt)}`}</p>
                    <p className="text-emerald-200">{c.resolution}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
