"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, BarChart3, TrendingUp, Building2, LogOut } from "lucide-react"

interface OwnerSession { id: string; name: string; email: string; orgId: string }

const tabs = [
  { label: "Dashboard", href: "/owner/dashboard", icon: LayoutDashboard },
  { label: "Financials", href: "/owner/financials", icon: BarChart3 },
  { label: "Market", href: "/owner/market", icon: TrendingUp },
  { label: "Property", href: "/owner/property", icon: Building2 },
]

export default function OwnerPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [owner, setOwner] = useState<OwnerSession | null>(null)

  useEffect(() => {
    try {
      const raw = document.cookie.match(/owner_session=([^;]+)/)
      if (raw) setOwner(JSON.parse(decodeURIComponent(raw[1])))
    } catch { /* ignore */ }
  }, [])

  async function logout() {
    await fetch("/api/owner/auth", { method: "DELETE" })
    router.replace("/owner/login")
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-sm font-bold text-white">Alwaan Residence</h1>
              <p className="text-[10px] text-white/40">{owner?.name || ""} · Owner Portal</p>
            </div>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
        {/* Tab navigation */}
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((t) => {
              const active = pathname === t.href
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                    active
                      ? "border-[#E30613] text-[#E30613]"
                      : "border-transparent text-white/50 hover:text-white/80 hover:border-white/20"
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-white/5 py-4 text-center text-[10px] text-white/20">
        Alwaan L.L.C. · Dubai, U.A.E. · <a href="mailto:info@cre.ae" className="text-[#E30613]/50">info@cre.ae</a>
      </footer>
    </div>
  )
}
