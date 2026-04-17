"use client"

import { useState, useEffect, FormEvent } from "react"

interface Ticket {
  id: string
  ticketNo: string
  category: string
  title: string
  description: string
  priority: string
  status: string
  rating: number
  ratingComment: string
  submittedAt: string
  acknowledgedAt: string | null
  assignedAt: string | null
  completedAt: string | null
  closedAt: string | null
  notes: string
  unit?: { unitNo: string } | null
  vendor?: { companyName: string; contactPerson?: string; phone?: string } | null
  comments?: Array<{ id: string; author: string; authorType: string; message: string; createdAt: string }>
}

const EXPECTED_PREFIX = "EXPECTED:"
const parseExpected = (notes?: string | null) => {
  if (!notes) return ""
  for (const l of notes.split("\n")) if (l.startsWith(EXPECTED_PREFIX)) return l.slice(EXPECTED_PREFIX.length).trim()
  return ""
}
const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

const categories = [
  "Plumbing",
  "Electrical",
  "AC / HVAC",
  "Painting",
  "Carpentry",
  "Pest Control",
  "Cleaning",
  "Appliance",
  "General",
  "Other",
]

const priorities = ["Low", "Medium", "High", "Urgent"]

const statusColor: Record<string, string> = {
  Submitted: "bg-blue-500/20 text-blue-400",
  Acknowledged: "bg-cyan-500/20 text-cyan-400",
  "In Progress": "bg-amber-500/20 text-amber-400",
  Completed: "bg-emerald-500/20 text-emerald-400",
  Closed: "bg-slate-500/20 text-slate-400",
}

const priorityColor: Record<string, string> = {
  Low: "bg-slate-500/20 text-slate-400",
  Medium: "bg-blue-500/20 text-blue-400",
  High: "bg-orange-500/20 text-orange-400",
  Urgent: "bg-red-500/20 text-red-400",
}

export default function TenantMaintenancePage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [category, setCategory] = useState("General")
  const [priority, setPriority] = useState("Medium")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [ratingTicketId, setRatingTicketId] = useState<string | null>(null)
  const [ratingValue, setRatingValue] = useState(5)
  const [ratingComment, setRatingComment] = useState("")

  function loadTickets() {
    fetch("/api/tenant/maintenance")
      .then((r) => r.json())
      .then((data) => setTickets(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTickets()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError("")
    setSuccess("")
    setSubmitting(true)

    try {
      const res = await fetch("/api/tenant/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, priority, title, description }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to submit")
      } else {
        setSuccess("Maintenance request submitted successfully")
        setTitle("")
        setDescription("")
        setCategory("General")
        setPriority("Medium")
        loadTickets()
      }
    } catch {
      setError("Failed to submit request")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRate(ticketId: string) {
    try {
      const res = await fetch(`/api/tenant/maintenance/${ticketId}/rate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: ratingValue, ratingComment }),
      })

      if (res.ok) {
        setRatingTicketId(null)
        setRatingValue(5)
        setRatingComment("")
        loadTickets()
      }
    } catch {
      // silent
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
      <h1 className="text-xl font-bold text-white">Maintenance Requests</h1>

      {/* Submit New Request */}
      <div className="rounded-xl border border-white/5 bg-white/5 p-6">
        <h3 className="mb-4 text-sm font-semibold text-white">Submit New Request</h3>

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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
              >
                {categories.map((c) => (
                  <option key={c} value={c} className="bg-slate-900">{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
              >
                {priorities.map((p) => (
                  <option key={p} value={p} className="bg-slate-900">{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Brief description of the issue"
              className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Provide details about the issue..."
              className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-all hover:from-teal-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      </div>

      {/* Rating Modal */}
      {ratingTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Rate Service</h3>
            <div className="mb-4">
              <label className="mb-2 block text-sm text-slate-400">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingValue(star)}
                    className={`text-2xl transition-colors ${
                      star <= ratingValue ? "text-amber-400" : "text-slate-600"
                    }`}
                  >
                    &#9733;
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm text-slate-400">Comment (optional)</label>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                rows={2}
                className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleRate(ratingTicketId)}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
              >
                Submit Rating
              </button>
              <button
                onClick={() => setRatingTicketId(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tickets — card view with full timeline */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-white">My Requests ({tickets.length})</h2>
        {tickets.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/5 p-8 text-center text-sm text-slate-500">
            You haven&rsquo;t submitted any maintenance requests yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {tickets.map((t) => {
              const expected = parseExpected(t.notes)
              const overdue = expected && new Date(expected) < new Date() && !t.completedAt
              return (
                <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="flex items-start justify-between border-b border-white/10 bg-white/5 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-mono text-teal-400">{t.ticketNo}</p>
                      <p className="mt-0.5 text-sm font-semibold text-white truncate">{t.title}</p>
                      <p className="text-[11px] text-slate-400">{t.category} {t.unit?.unitNo ? `· Unit ${t.unit.unitNo}` : ""}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[t.status] || "bg-slate-500/20 text-slate-400"}`}>{t.status}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityColor[t.priority] || "bg-slate-500/20 text-slate-400"}`}>{t.priority}</span>
                    </div>
                  </div>

                  {t.description && (
                    <div className="border-b border-white/5 px-4 py-2 text-xs text-slate-300 italic">
                      &ldquo;{t.description}&rdquo;
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="px-4 py-3 space-y-1.5 text-[11px]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Progress</p>
                    <Step label="Received" at={fmtDateTime(t.submittedAt)} done color="bg-blue-400" />
                    <Step label="Acknowledged by team" at={fmtDateTime(t.acknowledgedAt)} done={!!t.acknowledgedAt} color="bg-cyan-400" />
                    <Step label="Vendor assigned" at={fmtDateTime(t.assignedAt)} done={!!t.assignedAt} color="bg-purple-400" subtitle={t.vendor?.companyName ? `${t.vendor.companyName}${t.vendor.phone ? ` · ${t.vendor.phone}` : ""}` : undefined} />
                    {expected && (
                      <Step label={overdue ? "Expected (overdue)" : "Expected completion"} at={fmtDateTime(expected)} done={!!t.completedAt} color={overdue ? "bg-red-400" : "bg-amber-400"} />
                    )}
                    <Step label="Completed" at={fmtDateTime(t.completedAt)} done={!!t.completedAt} color="bg-emerald-400" />
                    {t.closedAt && <Step label="Closed" at={fmtDateTime(t.closedAt)} done color="bg-slate-400" />}
                  </div>

                  {/* Recent comments */}
                  {t.comments && t.comments.length > 0 && (
                    <div className="border-t border-white/5 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Recent updates</p>
                      <div className="space-y-1.5">
                        {t.comments.slice(0, 3).map((c) => (
                          <div key={c.id} className="rounded bg-white/5 px-2 py-1.5 text-[11px]">
                            <p className="text-slate-300">{c.message}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">{c.author} ({c.authorType}) · {fmtDateTime(c.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rate */}
                  {(t.status === "Completed" || t.status === "Closed") && (
                    <div className="border-t border-white/5 px-4 py-2.5 flex items-center justify-between">
                      {t.rating > 0 ? (
                        <span className="text-xs text-amber-400">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)} <span className="text-slate-400">— Rated</span></span>
                      ) : (
                        <button
                          onClick={() => { setRatingTicketId(t.id); setRatingValue(5); setRatingComment("") }}
                          className="text-xs text-teal-400 hover:text-teal-300 underline"
                        >
                          ★ Rate this service
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Step({ label, at, done, color, subtitle }: { label: string; at: string | null; done: boolean; color: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full ${done ? color : "bg-slate-700"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className={done ? "text-slate-200" : "text-slate-500"}>{label}</span>
          <span className="text-[10px] text-slate-500">{at || "—"}</span>
        </div>
        {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
      </div>
    </div>
  )
}
