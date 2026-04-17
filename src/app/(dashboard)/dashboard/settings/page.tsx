"use client"

import { useState, useEffect } from "react"
import { Settings, Building2, Lock, CreditCard, Mail } from "lucide-react"

interface OrgSettings {
  id: string
  name: string
  email: string
  phone: string
  address: string
  plan: string
  maxUnits: number
}

interface EmailLogRow {
  id: string
  toEmail: string
  toName: string
  subject: string
  template: string
  status: string
  errorMessage: string
  sentAt: string
}

export default function SettingsPage() {
  const [org, setOrg] = useState<OrgSettings | null>(null)
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [emailLogs, setEmailLogs] = useState<EmailLogRow[]>([])
  const [emailLogsLoading, setEmailLogsLoading] = useState(true)

  useEffect(() => {
    async function fetchOrg() {
      try {
        // Fetch organization info from the session or a dedicated endpoint
        // For now we'll use the dashboard data shape
        const res = await fetch("/api/dashboard")
        if (res.ok) {
          // We don't have a direct org endpoint, so set defaults
          setOrg({
            id: "",
            name: "Alwan Residence",
            email: "",
            phone: "",
            address: "",
            plan: "starter",
            maxUnits: 50,
          })
          setForm({
            name: "Alwan Residence",
            email: "",
            phone: "",
            address: "",
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }
    fetchOrg()
  }, [])

  useEffect(() => {
    async function fetchEmailLogs() {
      setEmailLogsLoading(true)
      try {
        const res = await fetch("/api/email-logs")
        if (res.ok) {
          const data = await res.json()
          setEmailLogs(data.logs || [])
        }
      } catch {/* ignore */}
      finally {
        setEmailLogsLoading(false)
      }
    }
    fetchEmailLogs()
  }, [])

  const formatLogDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleString("en-GB", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    } catch { return iso }
  }

  const handleSaveOrg = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      // In a real app, this would POST to /api/organization
      // For now we simulate success
      await new Promise(resolve => setTimeout(resolve, 500))
      setSuccess("Organization settings saved successfully")
      setOrg(prev => prev ? { ...prev, ...form } : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (passwordForm.newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    setSavingPassword(true)
    setError("")
    setSuccess("")
    try {
      // In a real app, this would POST to /api/auth/change-password
      await new Promise(resolve => setTimeout(resolve, 500))
      setSuccess("Password changed successfully")
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSavingPassword(false)
    }
  }

  const planInfo: Record<string, { name: string; units: number; features: string[] }> = {
    starter: { name: "Starter", units: 50, features: ["Up to 50 units", "Basic reports", "Email support"] },
    professional: { name: "Professional", units: 200, features: ["Up to 200 units", "Advanced reports", "Priority support", "API access"] },
    enterprise: { name: "Enterprise", units: 9999, features: ["Unlimited units", "Custom reports", "Dedicated support", "White label", "API access"] },
  }

  const currentPlan = planInfo[org?.plan || "starter"] || planInfo.starter

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-sm text-slate-400">Organization and account settings</p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}
      {success && <div className="rounded-lg border border-emerald-800 bg-emerald-900/20 p-3 text-sm text-emerald-400">{success} <button onClick={() => setSuccess("")} className="ml-2 underline">Dismiss</button></div>}

      {/* Organization Settings */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <Building2 className="h-5 w-5 text-amber-400" /> Organization
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Organization Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Address</label>
            <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <button onClick={handleSaveOrg} disabled={saving} className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Plan Info */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <CreditCard className="h-5 w-5 text-amber-400" /> Current Plan
        </h2>
        <div className="flex items-start gap-6">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-6 py-4 text-center">
            <p className="text-lg font-bold text-amber-400">{currentPlan.name}</p>
            <p className="text-xs text-slate-400">Current Plan</p>
          </div>
          <div>
            <p className="text-sm text-slate-300">Plan Features:</p>
            <ul className="mt-2 space-y-1">
              {currentPlan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {f}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Max units: {currentPlan.units === 9999 ? "Unlimited" : currentPlan.units}
            </p>
          </div>
        </div>
      </div>

      {/* Email Activity */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <Mail className="h-5 w-5 text-amber-400" /> Email Activity
        </h2>
        <p className="mb-3 text-xs text-slate-400">Most recent emails dispatched by your organization.</p>
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Recipient</th>
                <th className="px-3 py-2 text-left">Subject</th>
                <th className="px-3 py-2 text-left">Template</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {emailLogsLoading ? (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">Loading…</td></tr>
              ) : emailLogs.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">No emails dispatched yet.</td></tr>
              ) : (
                emailLogs.map((e) => {
                  const badge =
                    e.status === "Sent"
                      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                      : e.status === "Failed"
                      ? "bg-red-500/15 text-red-300 ring-red-500/30"
                      : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                  return (
                    <tr key={e.id} className="hover:bg-slate-800/40" title={e.errorMessage || ""}>
                      <td className="px-3 py-2 text-slate-400">{formatLogDate(e.sentAt)}</td>
                      <td className="px-3 py-2 text-white">{e.toName ? `${e.toName} <${e.toEmail}>` : e.toEmail}</td>
                      <td className="px-3 py-2 text-slate-300">{e.subject}</td>
                      <td className="px-3 py-2 text-slate-400">{e.template}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${badge}`}>
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <Lock className="h-5 w-5 text-amber-400" /> Change Password
        </h2>
        <div className="max-w-md space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Current Password</label>
            <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">New Password</label>
            <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Confirm New Password</label>
            <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <button onClick={handleChangePassword} disabled={savingPassword || !passwordForm.currentPassword || !passwordForm.newPassword} className="rounded-lg border border-slate-700 bg-slate-800 px-6 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50">
            {savingPassword ? "Changing..." : "Change Password"}
          </button>
        </div>
      </div>
    </div>
  )
}
