"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, AlertCircle } from "lucide-react"

const LABEL = "mb-1.5 block text-sm font-medium text-slate-700"
const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20"

export default function NewOwnerPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    ownerName: "",
    email: "",
    phone: "",
    buildingName: "",
    buildingType: "Residential",
    contractStartDate: "",
    contractEndDate: "",
  })

  const update = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }))
    if (error) setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.ownerName.trim() || !form.email.trim() || !form.buildingName.trim()) {
      setError("Owner name, email and building name are required")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || "Save failed")
      }
      const owner = await res.json()
      router.push(`/dashboard/owners/${owner.id}/edit`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/dashboard/owners"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Owners
        </Link>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-8 py-6">
            <h1 className="text-2xl font-semibold text-slate-900">Add New Owner</h1>
            <p className="mt-1 text-sm text-slate-500">
              Start with the essentials. You&apos;ll fill in the rest and review the contract on the next
              page.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 px-8 py-6">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className={LABEL}>Owner Name *</label>
              <input
                className={INPUT}
                value={form.ownerName}
                onChange={(e) => update({ ownerName: e.target.value })}
                placeholder="e.g. Ahmed Al Mansouri"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={LABEL}>Email *</label>
                <input
                  type="email"
                  className={INPUT}
                  value={form.email}
                  onChange={(e) => update({ email: e.target.value })}
                  placeholder="owner@example.com"
                />
              </div>
              <div>
                <label className={LABEL}>Phone</label>
                <input
                  className={INPUT}
                  value={form.phone}
                  onChange={(e) => update({ phone: e.target.value })}
                  placeholder="+971 50 123 4567"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={LABEL}>Building Name *</label>
                <input
                  className={INPUT}
                  value={form.buildingName}
                  onChange={(e) => update({ buildingName: e.target.value })}
                  placeholder="e.g. Marina Heights Tower"
                />
              </div>
              <div>
                <label className={LABEL}>Building Type</label>
                <select
                  className={INPUT}
                  value={form.buildingType}
                  onChange={(e) => update({ buildingType: e.target.value })}
                >
                  <option>Residential</option>
                  <option>Commercial</option>
                  <option>Mixed-Use</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className={LABEL}>Contract Start</label>
                <input
                  type="date"
                  className={INPUT}
                  value={form.contractStartDate}
                  onChange={(e) => update({ contractStartDate: e.target.value })}
                />
              </div>
              <div>
                <label className={LABEL}>Contract End</label>
                <input
                  type="date"
                  className={INPUT}
                  value={form.contractEndDate}
                  onChange={(e) => update({ contractEndDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <Link
                href="/dashboard/owners"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#E30613] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#c20510] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save & Continue →"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
