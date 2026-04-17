"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { ToastProvider } from "@/components/ui/toast"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated" || !session) {
    redirect("/login")
  }

  return (
    <ToastProvider>
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Main content area offset by sidebar width */}
      <div
        className={sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64"}
        style={{ transition: "padding-left 200ms ease-in-out" }}
      >
        <Topbar
          title="Dashboard"
          onMenuToggle={() => setMobileOpen(!mobileOpen)}
        />
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
    </ToastProvider>
  )
}
