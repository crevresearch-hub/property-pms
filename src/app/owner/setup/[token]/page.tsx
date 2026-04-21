"use client"

import { useState, useEffect, use, FormEvent } from "react"
import { useRouter } from "next/navigation"

interface TokenInfo {
  valid: boolean
  reason?: string
  email?: string
  ownerName?: string
  buildingName?: string
  alreadySet?: boolean
}

export default function OwnerSetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [info, setInfo] = useState<TokenInfo | null>(null)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch(`/api/owner/setup?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then(setInfo)
      .finally(() => setChecking(false))
  }, [token])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    if (password !== confirm) {
      setError("Passwords don't match")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/owner/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || "Failed to set password")
      else router.push("/owner/login")
    } catch {
      setError("Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-yellow-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl sm:p-10">
          <div className="mb-6 text-center">
            <div className="mt-4 inline-block rounded-full bg-amber-100 px-4 py-1">
              <p className="text-[10px] font-bold tracking-[0.3em] text-amber-700">OWNER PORTAL</p>
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">Set Your Password</h2>
          </div>

          {!info?.valid ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {info?.reason || "Invalid or expired link."}{" "}
              <a href="/owner/login" className="font-semibold underline">Go to login</a>
            </div>
          ) : info.alreadySet ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Password already set.{" "}
              <a href="/owner/login" className="font-semibold underline">Sign in</a>
            </div>
          ) : (
            <>
              <div className="mb-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                <p><strong>Owner:</strong> {info.ownerName}</p>
                <p><strong>Building:</strong> {info.buildingName}</p>
                <p><strong>Email:</strong> {info.email}</p>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-600/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-600/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-lg bg-amber-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {loading ? "Setting..." : "Set Password & Sign In"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
