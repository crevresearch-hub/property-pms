"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, BarChart3, Banknote, Building2, TrendingUp } from "lucide-react"

const tabs = [
  { label: "Overview", href: "/ceo/alwaan", icon: LayoutDashboard },
  { label: "P&L Analysis", href: "/ceo/alwaan/pnl", icon: BarChart3 },
  { label: "Cash Flow", href: "/ceo/alwaan/cashflow", icon: Banknote },
  { label: "Unit Analysis", href: "/ceo/alwaan/units", icon: Building2 },
  { label: "Market Intel", href: "/ceo/alwaan/market", icon: TrendingUp },
]

export default function AlwaanLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="mx-auto max-w-[1400px] px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Alwaan Residence</h1>
              <p className="text-[11px] text-slate-400">Me&rsquo;aisem First, Dubai Production City · CEO Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
            <span className="text-xs text-slate-400">{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
        </div>
        <div className="mx-auto max-w-[1400px] px-8">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((t) => {
              const active = pathname === t.href
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? "border-[#E30613] text-[#E30613]"
                      : "border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-300"
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
      <main className="mx-auto max-w-[1400px] px-8 py-8">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white py-5">
        <div className="mx-auto max-w-[1400px] px-8 flex items-center justify-between">
          <p className="text-xs text-slate-400">Alwaan Residence · CRE L.L.C. · Dubai, U.A.E.</p>
          <p className="text-xs text-slate-300">Data: Building rent register + expense sheet</p>
        </div>
      </footer>
    </div>
  )
}
