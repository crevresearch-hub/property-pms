"use client"

import { LogOut } from "lucide-react"

export function LogoutButton() {
  const handleLogout = async () => {
    await fetch("/api/owner/auth", { method: "DELETE" })
    window.location.href = "/owner/login"
  }
  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
    >
      <LogOut className="h-3.5 w-3.5" /> Sign out
    </button>
  )
}
