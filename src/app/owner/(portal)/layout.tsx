import { redirect } from "next/navigation"
import Link from "next/link"
import { getOwnerSessionFromCookies } from "@/lib/owner-auth"
import { LayoutDashboard } from "lucide-react"
import { LogoutButton } from "./logout-button"

export default async function OwnerPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getOwnerSessionFromCookies()
  if (!session) redirect("/owner/login")

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-amber-950/40 to-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.3em] text-amber-400">OWNER PORTAL</p>
            <h1 className="text-lg font-bold text-white">{session.buildingName || session.name}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-white">{session.name}</p>
              <p className="text-xs text-slate-400">Property Owner</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <nav className="border-b border-white/5 bg-black/20">
        <div className="mx-auto flex max-w-7xl gap-1 px-6">
          <Link
            href="/owner/dashboard"
            className="flex items-center gap-2 border-b-2 border-amber-500 px-4 py-3 text-sm font-semibold text-amber-400"
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  )
}
