import { redirect } from "next/navigation"
import { getOwnerSessionFromCookies } from "@/lib/owner-auth"
import { LogoutButton } from "./logout-button"
import { NavTabs } from "./nav-tabs"

export default async function OwnerPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getOwnerSessionFromCookies()
  if (!session) redirect("/owner/login")

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b-2 border-[#E30613] bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.3em] text-[#E30613]">OWNER PORTAL</p>
            <h1 className="text-lg font-bold text-slate-900">{session.buildingName || session.name}</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{session.name}</p>
              <p className="text-xs text-slate-500">Property Owner</p>
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
