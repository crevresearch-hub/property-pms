"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function LoginInner() {
  const router = useRouter()
  const search = useSearchParams()
  const token = search.get("token")
  const [email, setEmail] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!token) return
    setBusy(true)
    setMsg({ ok: true, text: "Signing you in…" })
    fetch("/api/owner/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || "Sign-in failed")
        router.replace("/owner/dashboard")
      })
      .catch((e) => {
        setBusy(false)
        setMsg({ ok: false, text: e instanceof Error ? e.message : "Sign-in failed" })
      })
  }, [token, router])

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true); setMsg(null)
    try {
      const r = await fetch("/api/owner/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || "Failed")
      setMsg({ ok: true, text: "✓ If an owner account exists for that email, a sign-in link has been sent. Check your inbox." })
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Failed" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto h-1 w-12 bg-[#E30613] rounded mb-3"></div>
          <h1 className="text-xl font-bold text-white">Owner Portal</h1>
          <p className="mt-1 text-xs text-slate-400">Continental Real Estate L.L.C.</p>
        </div>

        {token && busy ? (
          <div className="text-center text-sm text-slate-300 py-8">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E30613] border-t-transparent mb-3"></div>
            Signing you in…
          </div>
        ) : (
          <form onSubmit={sendLink} className="space-y-4">
            <label className="block">
              <span className="block text-xs font-medium text-slate-300 mb-1">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-[#E30613]"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full rounded-lg bg-[#E30613] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#c20510] disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send sign-in link"}
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              We&rsquo;ll email you a one-click sign-in link. No password needed.
            </p>
          </form>
        )}

        {msg && (
          <div className={`mt-4 rounded-lg border p-3 text-xs ${
            msg.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  )
}

export default function OwnerLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E30613] border-t-transparent" /></div>}>
      <LoginInner />
    </Suspense>
  )
}
