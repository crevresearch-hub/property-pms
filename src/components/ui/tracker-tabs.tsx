"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookCheck, Wallet } from "lucide-react"

const TABS = [
  { href: "/dashboard/cheques", label: "Cheque Tracker", icon: BookCheck },
  { href: "/dashboard/cash-tracker", label: "Cash Tracker", icon: Wallet },
]

export function TrackerTabs() {
  const pathname = usePathname()
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-900/50 p-1">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/")
        const Icon = t.icon
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              active
                ? "flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm"
                : "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
            }
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
