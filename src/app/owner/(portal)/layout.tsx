import { redirect } from "next/navigation"
import { getOwnerSessionFromCookies } from "@/lib/owner-auth"
import { LogoutButton } from "./logout-button"
import { NavTabs } from "./nav-tabs"

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

      <NavTabs />

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  )
}
