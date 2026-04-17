import Link from "next/link"
import { Building2, Users } from "lucide-react"

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a]">
      {/* Decorative red orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#E30613]/15 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-[#E30613]/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <div className="mb-10 text-center">
          <img
            src="/cre-logo.png"
            alt="Continental Real Estate"
            className="mx-auto h-24 w-auto sm:h-32"
          />
          <p className="mt-4 text-[11px] font-bold tracking-[0.4em] text-[#E30613]">
            PROPERTY MANAGEMENT SYSTEM
          </p>
          <h1 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            Welcome to CRE System
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Please select your portal to continue
          </p>
        </div>

        {/* Two portal cards */}
        <div className="grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Staff Portal */}
          <Link
            href="/login"
            className="group relative overflow-hidden rounded-2xl border-2 border-[#E30613]/30 bg-white p-7 transition-all hover:border-[#E30613] hover:shadow-2xl hover:shadow-[#E30613]/20"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-[#E30613]/5 transition-all group-hover:bg-[#E30613]/10" />
            <div className="relative">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[#E30613] shadow-lg shadow-[#E30613]/30">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Staff Portal</h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#E30613]">
                For CRE Administrators & Staff
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Manage owners, tenants, contracts, maintenance, and all building operations.
              </p>
              <ul className="mt-4 space-y-1 text-xs text-slate-500">
                <li>• Property Owners & PM Agreements</li>
                <li>• Tenant Onboarding & Contracts</li>
                <li>• Cheque Tracking & Renewals</li>
                <li>• Maintenance, Vendors & Reports</li>
              </ul>
              <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E30613] px-4 py-2 text-sm font-semibold text-white group-hover:bg-[#c20510]">
                Sign in as Staff
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </Link>

          {/* Tenant Portal */}
          <Link
            href="/tenant/login"
            className="group relative overflow-hidden rounded-2xl border-2 border-emerald-200 bg-white p-7 transition-all hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/20"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-emerald-500/5 transition-all group-hover:bg-emerald-500/10" />
            <div className="relative">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-500/30">
                <Users className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Tenant Portal</h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                For Tenants & Residents
              </p>
              <p className="mt-3 text-sm text-slate-600">
                View your unit, pay rent, submit maintenance requests, and manage your tenancy.
              </p>
              <ul className="mt-4 space-y-1 text-xs text-slate-500">
                <li>• View My Unit & Lease</li>
                <li>• Pay Invoices Online</li>
                <li>• Submit Maintenance Requests</li>
                <li>• Upload Documents & Renew Lease</li>
              </ul>
              <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white group-hover:bg-emerald-700">
                Sign in as Tenant
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center">
          <p className="text-xs text-slate-500">
            Continental Real Estate &copy; {new Date().getFullYear()} &middot; Dubai, United Arab Emirates
          </p>
          <p className="mt-1 text-[11px] text-slate-600">
            Need help? Contact us at <a href="mailto:info@cre.ae" className="text-[#E30613] hover:underline">info@cre.ae</a>
          </p>
        </footer>
      </div>
    </div>
  )
}
