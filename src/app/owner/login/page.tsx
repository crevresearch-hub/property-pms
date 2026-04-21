"use client"

import { useState, FormEvent, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

const ERROR_MESSAGES: Record<string, string> = {
  "no-token": "Sign-in link is missing.",
  "invalid-or-expired": "This sign-in link is invalid or has expired.",
  "owner-not-found": "No active owner account found. Contact management.",
}

function OwnerLoginInner() {
  const router = useRouter()
  const params = useSearchParams()
  const errorFromUrl = params.get("error")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"password" | "magic">("password")
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (errorFromUrl && ERROR_MESSAGES[errorFromUrl]) {
      setError(ERROR_MESSAGES[errorFromUrl])
    }
  }, [errorFromUrl])

  async function handlePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setInfo("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/owner/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || "Login failed")
      else {
        router.push("/owner/dashboard")
        router.refresh()
      }
    } catch {
      setError("Unexpected error.")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleMagic(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setInfo("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/owner/login/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error || "Failed to send link")
      else setInfo(data.message || "Sign-in link sent. Check your email.")
    } catch {
      setError("Unexpected error.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-amber-950 via-amber-900 to-amber-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-yellow-500/15 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl sm:p-10">
          <div className="mb-8 text-center">
            <div className="mt-4 inline-block rounded-full bg-amber-100 px-4 py-1">
              <p className="text-[10px] font-bold tracking-[0.3em] text-amber-700">OWNER PORTAL</p>
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">Property Owner Sign In</h2>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {info && (
            <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              ✓ {info}
            </div>
          )}

          {mode === "password" ? (
            <form onSubmit={handlePassword} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-600/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-600/20"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center rounded-lg bg-amber-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </button>
              <p className="text-center text-xs text-slate-500">
                Forgot password?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("magic"); setError(""); setInfo("") }}
                  className="font-semibold text-amber-700 hover:underline"
                >
                  Email me a login link
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleMagic} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-600/20"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center rounded-lg bg-amber-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {isLoading ? "Sending..." : "Send sign-in link"}
              </button>
              <p className="text-center text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => { setMode("password"); setError(""); setInfo("") }}
                  className="font-semibold text-amber-700 hover:underline"
                >
                  ← Back to password login
                </button>
              </p>
            </form>
          )}

          <div className="mt-8 border-t border-slate-100 pt-6 text-center space-y-2">
            <p className="text-xs text-slate-500">
              Are you staff?{" "}
              <a href="/login" className="font-semibold text-[#E30613] hover:underline">
                Sign in here →
              </a>
            </p>
            <p className="text-xs text-slate-400">
              Alwaan &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OwnerLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-amber-950" />}>
      <OwnerLoginInner />
    </Suspense>
  )
}
