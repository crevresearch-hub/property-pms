"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  CalendarClock,
  Users,
  FileText,
  CreditCard,
  Wrench,
  Truck,
  RefreshCw,
  BookCheck,
  MessageSquareWarning,
  ShieldAlert,
  Car,
  Zap,
  FolderOpen,
  BadgeDollarSign,
  BarChart3,
  FileSignature,
  GitBranch,
  Settings,
  Activity,
  UserCog,
  Handshake,
  Mail,
  Upload,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
  devOnly?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
  devOnly?: boolean
}

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Properties & Tenants",
    items: [
      { label: "Units", href: "/dashboard/units", icon: Building2 },
      { label: "Tenants & Agreements", href: "/dashboard/tenants", icon: Users },
      { label: "Cheque Tracker", href: "/dashboard/cheques", icon: BookCheck },
      { label: "Bank Reconciliation", href: "/dashboard/reconciliation", icon: BookCheck },
      { label: "Renewals", href: "/dashboard/renewals", icon: RefreshCw },
      { label: "Invoices", href: "/dashboard/invoices", icon: FileText },
      { label: "Payments", href: "/dashboard/payments", icon: CreditCard },
    ],
  },
  {
    title: "Building Operations",
    items: [
      { label: "Maintenance", href: "/dashboard/maintenance", icon: Wrench },
      { label: "Vendors", href: "/dashboard/vendors", icon: Truck },
      { label: "Complaints", href: "/dashboard/complaints", icon: MessageSquareWarning },
      { label: "Violations", href: "/dashboard/violations", icon: ShieldAlert },
      { label: "Legal", href: "/dashboard/legal", icon: ShieldAlert },
      { label: "Parking", href: "/dashboard/parking", icon: Car },
      { label: "DEWA", href: "/dashboard/dewa", icon: Zap },
      { label: "Documents", href: "/dashboard/documents", icon: FolderOpen },
    ],
  },
  {
    title: "Reports",
    items: [
      { label: "Staff KPIs", href: "/dashboard/kpi", icon: BarChart3 },
      { label: "Activity Log", href: "/dashboard/activity", icon: Activity },
      { label: "Email Log", href: "/dashboard/emails", icon: Mail },
    ],
  },
  {
    title: "Developer",
    items: [
      { label: "Developer Tools", href: "/dashboard/developer", icon: Settings },
      { label: "Import Data", href: "/dashboard/import", icon: Upload, devOnly: true },
      { label: "Import Tenants (Folder)", href: "/dashboard/import/tenants", icon: Upload, devOnly: true },
      { label: "Import Cheques (Excel)", href: "/dashboard/import/cheques", icon: Upload, devOnly: true },
      { label: "Import Lease Data (Full)", href: "/dashboard/import/lease-data", icon: Upload, devOnly: true },
      { label: "Settings", href: "/dashboard/settings", icon: Settings, devOnly: true },
      { label: "Users", href: "/dashboard/users", icon: UserCog, adminOnly: true, devOnly: true },
    ],
  },
]

interface SidebarProps {
  organizationName?: string
  mobileOpen: boolean
  onMobileClose: () => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

export function Sidebar({ mobileOpen, onMobileClose, collapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [devUnlocked, setDevUnlocked] = useState(false)

  useEffect(() => {
    const check = () => setDevUnlocked(document.cookie.split(";").some((c) => c.trim().startsWith("dev_unlocked=1")))
    check()
    const interval = setInterval(check, 3000) // re-check every 3s
    return () => clearInterval(interval)
  }, [])

  const userRole = session?.user?.role || ""

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className={cn("border-b border-white/10 px-4 py-5", collapsed && "px-2")}>
        <p className={cn("text-sm font-bold text-white", collapsed && "text-center text-xs")}>
          {collapsed ? "PMS" : "Property Management"}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group, groupIdx) => (
          <div key={group.title} className={cn(groupIdx > 0 && "mt-4")}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.title}
              </p>
            )}
            {collapsed && groupIdx > 0 && <div className="mx-auto mb-3 mt-1 h-px w-6 bg-white/10" />}
            <ul className="space-y-0.5">
              {group.items
                .filter((item) => {
                  if (item.adminOnly && userRole !== "ADMIN") return false
                  if (item.devOnly && !devUnlocked) return false
                  return true
                })
                .map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onMobileClose}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                          collapsed && "justify-center px-2",
                          active
                            ? "bg-[#E30613]/15 text-[#ff4757]"
                            : "text-slate-400 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            active ? "text-[#ff4757]" : "text-slate-500 group-hover:text-slate-300"
                          )}
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {active && !collapsed && (
                          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#E30613]" />
                        )}
                      </Link>
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Collapse toggle - desktop only */}
      <div className="hidden border-t border-white/10 p-3 lg:block">
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg py-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-gradient-to-b from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a] transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col lg:border-r lg:border-white/5 lg:bg-gradient-to-b lg:from-[#0a0a0a] lg:via-[#1a1a1a] lg:to-[#0a0a0a]",
          collapsed ? "lg:w-[72px]" : "lg:w-64"
        )}
        style={{ transition: "width 200ms ease-in-out" }}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
