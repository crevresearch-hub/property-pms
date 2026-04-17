"use client"

import { useState, useRef, useEffect } from "react"
import { signOut, useSession } from "next-auth/react"
import {
  Menu,
  Bell,
  FileDown,
  ChevronDown,
  LogOut,
  User,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TopbarProps {
  title: string
  onMenuToggle: () => void
  notificationCount?: number
}

export function Topbar({ title, onMenuToggle, notificationCount = 0 }: TopbarProps) {
  const { data: session } = useSession()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const userName = session?.user?.name || "User"
  const userRole = session?.user?.role || "USER"
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#E30613]/20 bg-[#0a0a0a]/90 px-4 backdrop-blur-xl sm:px-6">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Export PDF */}
        <button
          className="hidden items-center gap-2 rounded-lg bg-[#E30613] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#c20510] sm:flex"
          onClick={() => window.print()}
        >
          <FileDown className="h-3.5 w-3.5" />
          Export PDF
        </button>

        {/* Notifications */}
        <button
          className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E30613] px-1 text-[10px] font-bold text-white">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          )}
        </button>

        {/* User dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-white/5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#E30613] to-[#c20510] text-xs font-bold text-white">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-white">{userName}</p>
              <p className="text-[10px] text-slate-500">{userRole}</p>
            </div>
            <ChevronDown
              className={cn(
                "hidden h-4 w-4 text-slate-500 transition-transform sm:block",
                userMenuOpen && "rotate-180"
              )}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
              <div className="border-b border-slate-800 px-4 py-3">
                <p className="text-sm font-medium text-white">{userName}</p>
                <p className="text-xs text-slate-400">{session?.user?.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => setUserMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <User className="h-4 w-4 text-slate-500" />
                  Profile
                </button>
                <button
                  onClick={() => setUserMenuOpen(false)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Settings className="h-4 w-4 text-slate-500" />
                  Settings
                </button>
              </div>
              <div className="border-t border-slate-800 py-1">
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
