"use client"

import { useState, FormEvent, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { BarChart3 } from "lucide-react"

function CeoLoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get("to") || "/ceo/alwaan"

  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/ceo/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error || "Sign-in failed")
      else {
        router.push(redirectTo)
        router.refresh()
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-amber-950/40 to-slate-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500 shadow-lg shadow-amber-500/30">
              <BarChart3 className="h-7 w-7 text-white" />
            </div>
            <div className="inline-block rounded-full bg-amber-100 px-4 py-1">
              <p className="text-[10px] font-bold tracking-[0.3em] text-amber-700">
                CEO DASHBOARD
              </p>
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">Executive Access</h2>
            <p className="mt-1 text-sm text-slate-500">
              Enter the CEO password to continue
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
                placeholder="CEO password"
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-600/20"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="relative mt-2 flex w-full items-center justify-center rounded-lg bg-amber-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-amber-500/30 transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Enter Dashboard"}
            </button>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-6 text-center">
            <p className="text-xs text-slate-400">
              Alwaan &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CeoLoginPage() {
  return (
    <Suspense fallback={null}>
      <CeoLoginForm />
    </Suspense>
  )
}
