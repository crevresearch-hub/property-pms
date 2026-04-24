"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Lock, Key, Shield, LogOut, Upload, Database, FileText, Settings as SettingsIcon, Eye, EyeOff } from "lucide-react"

interface Creds {
  staff: Array<{ id: string; email: string; name: string; role: string; hasPassword: boolean }>
  owners: Array<{ id: string; email: string; name: string; building: string; hasPassword: boolean }>
  tenants: Array<{ id: string; email: string; name: string; status: string; phone: string; unitNo: string; hasPassword: boolean }>
}

function devCookie(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie.split(";").some((c) => c.trim().startsWith("dev_unlocked=1"))
}

export default function DeveloperPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [data, setData] = useState<Creds | null>(null)
  const [search, setSearch] = useState("")
  const [resetTarget, setResetTarget] = useState<{ type: string; id: string; name: string } | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [resetMsg, setResetMsg] = useState("")
  const [tab, setTab] = useState<"staff" | "owner" | "tenant" | "tools">("staff")

  useEffect(() => {
    setUnlocked(devCookie())
  }, [])

  useEffect(() => {
    if (!unlocked) return
    fetch("/api/developer/credentials")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Failed")
        return r.json()
      })
      .then(setData)
      .catch((e) => setAuthError(e.message))
  }, [unlocked])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthError("")
    const res = await fetch("/api/developer/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { setUnlocked(true); setPassword("") }
    else setAuthError("Wrong password")
  }

  async function handleLogout() {
    await fetch("/api/developer/auth", { method: "DELETE" })
    setUnlocked(false)
    setData(null)
  }

  async function resetPassword() {
    if (!resetTarget || newPassword.length < 6) { setResetMsg("Password must be at least 6 characters"); return }
    const res = await fetch("/api/developer/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: resetTarget.type, id: resetTarget.id, password: newPassword }),
    })
    const data = await res.json()
    if (!res.ok) { setResetMsg(data.error || "Failed"); return }
    setResetMsg(`✓ Password reset for ${resetTarget.name}: ${newPassword}`)
    setNewPassword("")
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-slate-900 p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#E30613]/20">
              <Lock className="h-7 w-7 text-[#E30613]" />
            </div>
            <h1 className="text-xl font-bold text-white">Developer Access</h1>
            <p className="mt-2 text-sm text-slate-400">Restricted area. Enter developer password.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Developer password"
              autoFocus
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none focus:border-[#E30613]/50"
            />
            {authError && <p className="text-sm text-red-400 text-center">{authError}</p>}
            <button type="submit" className="w-full rounded-lg bg-[#E30613] py-3 text-sm font-bold text-white hover:bg-[#c20510]">
              Unlock Developer Tools
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (!data) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  const filtered = {
    staff: data.staff.filter(s => !search || s.email.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase())),
    owners: data.owners.filter(o => !search || o.email.toLowerCase().includes(search.toLowerCase()) || o.name.toLowerCase().includes(search.toLowerCase())),
    tenants: data.tenants.filter(t => !search || t.email?.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase()) || t.unitNo.includes(search)),
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-[#E30613]/20">
            <Shield className="h-5 w-5 text-[#E30613]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white">Developer Tools</h1>
            <p className="text-xs sm:text-sm text-slate-400 hidden sm:block">All sensitive system access in one place</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700 shrink-0"
        >
          <LogOut className="h-3.5 w-3.5" /> Lock
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 scrollbar-hide">
        {(["staff", "owner", "tenant", "tools"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs sm:text-sm font-semibold capitalize ${tab === t ? "border-[#E30613] text-white" : "border-transparent text-slate-400 hover:text-white"}`}
          >
            {t === "staff" ? `Staff (${data.staff.length})` : t === "owner" ? `Owners (${data.owners.length})` : t === "tenant" ? `Tenants (${data.tenants.length})` : "Admin Tools"}
          </button>
        ))}
      </div>

      {tab === "tools" ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { href: "/dashboard/import", label: "Import Data", icon: Upload },
            { href: "/dashboard/import/tenants", label: "Import Tenants (Folder)", icon: Upload },
            { href: "/dashboard/import/cheques", label: "Import Cheques (Excel)", icon: Upload },
            { href: "/dashboard/import/lease-data", label: "Import Lease Data (Full)", icon: Upload },
            { href: "/dashboard/reconciliation", label: "Bank Reconciliation", icon: Database },
            { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/60 p-4 sm:p-6 text-center hover:border-[#E30613]/50 hover:bg-slate-800/60 min-h-[100px]"
            >
              <Icon className="h-6 w-6 sm:h-8 sm:w-8 text-amber-400" />
              <span className="text-xs sm:text-sm font-semibold text-white leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      ) : (
        <>
          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab}...`}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          />

          {resetMsg && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
              {resetMsg}
              <button onClick={() => setResetMsg("")} className="ml-2 underline">dismiss</button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
            <table className="w-full text-left text-xs min-w-full">
              <thead className="bg-slate-900/60 text-slate-400">
                <tr>
                  <th className="px-2 sm:px-3 py-2">Name</th>
                  <th className="px-2 sm:px-3 py-2 hidden sm:table-cell">Email</th>
                  {tab === "tenant" && <th className="px-2 sm:px-3 py-2">Unit</th>}
                  {tab === "tenant" && <th className="px-2 sm:px-3 py-2 hidden md:table-cell">Phone</th>}
                  {tab === "owner" && <th className="px-2 sm:px-3 py-2 hidden md:table-cell">Building</th>}
                  {tab === "staff" && <th className="px-2 sm:px-3 py-2 hidden md:table-cell">Role</th>}
                  <th className="px-2 sm:px-3 py-2 hidden sm:table-cell">Status</th>
                  <th className="px-2 sm:px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(tab === "staff" ? filtered.staff : tab === "owner" ? filtered.owners : filtered.tenants).map((row) => {
                  type Row = typeof row & Partial<{ role: string; building: string; unitNo: string; phone: string }>
                  const r = row as Row
                  return (
                    <tr key={r.id} className="text-slate-300">
                      <td className="px-2 sm:px-3 py-2 font-semibold text-white">
                        <div>{r.name}</div>
                        {/* Show email on mobile under the name */}
                        <div className="sm:hidden font-mono text-[10px] text-slate-500 truncate">{r.email || <span className="text-red-400">(no email)</span>}</div>
                      </td>
                      <td className="px-2 sm:px-3 py-2 font-mono text-slate-400 hidden sm:table-cell">{r.email || <span className="text-red-400">(no email)</span>}</td>
                      {tab === "tenant" && <td className="px-2 sm:px-3 py-2 font-mono">{r.unitNo || "—"}</td>}
                      {tab === "tenant" && <td className="px-2 sm:px-3 py-2 font-mono hidden md:table-cell">{r.phone || "—"}</td>}
                      {tab === "owner" && <td className="px-2 sm:px-3 py-2 hidden md:table-cell">{r.building}</td>}
                      {tab === "staff" && <td className="px-2 sm:px-3 py-2 hidden md:table-cell">{r.role}</td>}
                      <td className="px-2 sm:px-3 py-2 hidden sm:table-cell">
                        {r.hasPassword ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">
                            <Eye className="h-3 w-3" /> Password set
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] text-slate-400">
                            <EyeOff className="h-3 w-3" /> No password
                          </span>
                        )}
                      </td>
                      <td className="px-2 sm:px-3 py-2 text-right">
                        <button
                          onClick={() => { setResetTarget({ type: tab, id: r.id, name: r.name }); setNewPassword("") }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 whitespace-nowrap"
                        >
                          <Key className="h-3 w-3" /> <span className="hidden sm:inline">Set / Reset</span> Password
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
            🔒 <strong>Note:</strong> Passwords are hashed (bcrypt) and cannot be shown in plain text — this is industry-standard security. Use <em>Set / Reset Password</em> to give a user a new known password.
          </div>
        </>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-slate-900 shadow-2xl">
            <div className="border-b border-slate-800 px-5 py-4">
              <h3 className="text-lg font-bold text-white">Set password for {resetTarget.name}</h3>
              <p className="text-xs text-slate-400 capitalize">{resetTarget.type} account</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-[#E30613]/50"
              />
              <p className="text-xs text-slate-500">Tell this to the user. After they log in, they should change it.</p>
            </div>
            <div className="flex gap-2 border-t border-slate-800 bg-slate-900/80 px-5 py-3">
              <button
                onClick={() => setResetTarget(null)}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
              >Cancel</button>
              <button
                onClick={resetPassword}
                disabled={newPassword.length < 6}
                className="flex-1 rounded-lg bg-[#E30613] px-3 py-2 text-sm font-semibold text-white hover:bg-[#c20510] disabled:opacity-50"
              >Set Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
