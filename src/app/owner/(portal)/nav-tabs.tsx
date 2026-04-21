"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, TrendingUp, Wallet, Building2, Banknote, FileText } from "lucide-react"

const tabs = [
  { href: "/owner/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/owner/financials", label: "Financials", icon: TrendingUp },
  { href: "/owner/cashflow", label: "Cashflow", icon: Wallet },
  { href: "/owner/units", label: "Units", icon: Building2 },
  { href: "/owner/cheques", label: "Cheques", icon: Banknote },
  { href: "/owner/reports", label: "Reports", icon: FileText },
]

export function NavTabs() {
  const pathname = usePathname()
  return (
    <nav className="border-b border-white/5 bg-black/20 sticky top-0 z-20 backdrop-blur">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 scrollbar-hide">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = pathname === t.href || pathname.startsWith(t.href + "/")
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                active
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
