"use client"

import { useState, FormEvent } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a]">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-[#E30613]/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-[#E30613]/10 blur-3xl" />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl sm:p-10">
          {/* CRE Logo */}
          <div className="mb-8 text-center">
            <img src="/cre-logo.png" alt="CRE" className="mx-auto h-20 w-auto" />
            <div className="mt-4 inline-block rounded-full bg-[#E30613]/10 px-4 py-1">
              <p className="text-[10px] font-bold tracking-[0.3em] text-[#E30613]">
                STAFF PORTAL
              </p>
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">Staff Sign In</h2>
            <p className="mt-1 text-sm text-slate-500">
              For CRE administrators and property management staff
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 focus:border-[#E30613] focus:bg-white focus:ring-2 focus:ring-[#E30613]/20"
              />
            </div>

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
                autoComplete="current-password"
                placeholder="Enter your password"
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all duration-200 focus:border-[#E30613] focus:bg-white focus:ring-2 focus:ring-[#E30613]/20"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="relative mt-2 flex w-full items-center justify-center rounded-lg bg-[#E30613] px-4 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-[#E30613]/30 transition-all duration-200 hover:bg-[#c20510] focus:outline-none focus:ring-2 focus:ring-[#E30613]/50 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 border-t border-slate-100 pt-6 text-center space-y-2">
            <p className="text-xs text-slate-500">
              Are you a tenant?{" "}
              <a href="/tenant/login" className="font-semibold text-emerald-700 hover:underline">
                Sign in here →
              </a>
            </p>
            <p className="text-xs text-slate-400">
              <a href="/" className="hover:text-slate-600">← Back to home</a>
              {" · "}
              CRE &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
