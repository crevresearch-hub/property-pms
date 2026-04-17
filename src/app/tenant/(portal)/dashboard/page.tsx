"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface UnitInfo {
  id: string
  unitNo: string
  unitType: string
  contractStart: string
  contractEnd: string
  currentRent: number
  status: string
}

interface Invoice {
  id: string
  invoiceNo: string
  type: string
  amount: number
  totalAmount: number
  dueDate: string
  paidAmount: number
  status: string
  createdAt: string
  unit?: { unitNo: string } | null
}

interface Cheque {
  id: string
  chequeNo: string
  chequeDate: string
  amount: number
  bankName: string
  status: string
  sequenceNo: number
  totalCheques: number
}

interface Ticket {
  id: string
  ticketNo: string
  category: string
  title: string
  priority: string
  status: string
  submittedAt: string
}

interface Notification {
  id: string
  title: string
  message: string
  category: string
  isRead: boolean
  createdAt: string
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return 0
  const end = new Date(dateStr)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 0,
  }).format(n || 0)
}

function formatDate(d: string): string {
  if (!d) return "N/A"
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function TenantDashboardPage() {
  const [units, setUnits] = useState<UnitInfo[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/tenant/unit").then((r) => r.json()),
      fetch("/api/tenant/invoices").then((r) => r.json()),
      fetch("/api/tenant/cheques").then((r) => r.json()).catch(() => []),
      fetch("/api/tenant/maintenance").then((r) => r.json()),
      fetch("/api/tenant/notifications").then((r) => r.json()),
    ])
      .then(([u, inv, chq, tix, notif]) => {
        setUnits(Array.isArray(u) ? u : [])
        setInvoices(Array.isArray(inv) ? inv : [])
        setCheques(Array.isArray(chq) ? chq : [])
        setTickets(Array.isArray(tix) ? tix : [])
        setNotifications(Array.isArray(notif) ? notif : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" />
      </div>
    )
  }

  const unit = units[0]
  const annualRent = unit?.currentRent || 0

  const paidFromCheques = cheques
    .filter((c) => c.status === "Cleared")
    .reduce((s, c) => s + (c.amount || 0), 0)
  const paidFromInvoices = invoices.reduce(
    (s, inv) => s + (inv.paidAmount || 0),
    0
  )
  const paidSoFar = paidFromCheques + paidFromInvoices
  const pendingBalance = Math.max(annualRent - paidSoFar, 0)

  const nextPendingCheque = [...cheques]
    .filter((c) => c.status !== "Cleared" && c.status !== "Cancelled")
    .sort((a, b) => (a.chequeDate > b.chequeDate ? 1 : -1))[0]

  const leaseStart = unit?.contractStart || ""
  const leaseEnd = unit?.contractEnd || ""
  const daysLeft = daysUntil(leaseEnd)

  const openTickets = tickets.filter(
    (t) => !["Completed", "Closed"].includes(t.status)
  )
  const recentInvoices = invoices.slice(0, 4)
  const unreadNotifications = notifications.filter((n) => !n.isRead).slice(0, 4)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Welcome back</h1>
        <p className="text-xs text-slate-400">
          Here&apos;s a snapshot of your tenancy
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="My Unit"
          value={unit?.unitNo || "—"}
          sub={unit?.unitType || "No unit assigned"}
          color="teal"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
            />
          }
        />
        <KpiCard
          label="Annual Rent"
          value={formatCurrency(annualRent)}
          sub="Contract total"
          color="emerald"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12s-1.45-.22-2.003-.659c-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          }
        />
        <KpiCard
          label="Paid So Far"
          value={formatCurrency(paidSoFar)}
          sub={`${cheques.filter((c) => c.status === "Cleared").length} cheque(s) cleared`}
          color="blue"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          }
        />
        <KpiCard
          label="Pending Balance"
          value={formatCurrency(pendingBalance)}
          sub={pendingBalance > 0 ? "Remaining" : "Fully paid"}
          color={pendingBalance > 0 ? "amber" : "emerald"}
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          }
        />
        <KpiCard
          label="Next Payment Due"
          value={nextPendingCheque ? formatDate(nextPendingCheque.chequeDate) : "None"}
          sub={
            nextPendingCheque
              ? `${formatCurrency(nextPendingCheque.amount)} · ${nextPendingCheque.bankName || "Bank"}`
              : "All cheques cleared"
          }
          color="purple"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          }
        />
      </div>

      {/* Lease Period */}
      {unit && (
        <div className="rounded-xl border border-white/5 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">
                Lease Period
              </p>
              <p className="mt-1 text-lg font-bold text-white">
                {formatDate(leaseStart)} — {formatDate(leaseEnd)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-slate-400">
                Days Remaining
              </p>
              <p
                className={`mt-1 text-3xl font-extrabold ${
                  daysLeft <= 30
                    ? "text-red-400"
                    : daysLeft <= 90
                    ? "text-amber-400"
                    : "text-teal-300"
                }`}
              >
                {daysLeft > 0 ? daysLeft : 0}
              </p>
              <p className="text-xs text-slate-500">
                {daysLeft <= 0
                  ? "Lease ended"
                  : daysLeft <= 90
                  ? "Renewal window open"
                  : "days"}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          {leaseStart && leaseEnd && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-emerald-400"
                  style={{
                    width: `${leaseProgress(leaseStart, leaseEnd)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLink
          href="/tenant/documents"
          label="View Documents"
          sub="EID, Passport, Contracts"
          color="from-blue-500/20 to-cyan-500/10"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          }
        />
        <QuickLink
          href="/tenant/maintenance"
          label="Submit Maintenance"
          sub="Report an issue"
          color="from-amber-500/20 to-orange-500/10"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
            />
          }
        />
        <QuickLink
          href="/tenant/invoices"
          label="Pay Rent"
          sub="View invoices & pay"
          color="from-emerald-500/20 to-teal-500/10"
          icon={
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
            />
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Section title="Recent Invoices" action={{ label: "View all", href: "/tenant/invoices" }}>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-slate-500">No invoices yet</p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {inv.invoiceNo}
                    </p>
                    <p className="text-xs text-slate-400">
                      {inv.type} · Due {formatDate(inv.dueDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      {formatCurrency(inv.totalAmount)}
                    </p>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        inv.status === "Paid"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : inv.status === "Overdue"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Maintenance */}
        <Section
          title="Maintenance Updates"
          action={{ label: "View all", href: "/tenant/maintenance" }}
        >
          {openTickets.length === 0 ? (
            <p className="text-sm text-slate-500">No active tickets</p>
          ) : (
            <div className="space-y-2">
              {openTickets.slice(0, 4).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{t.title}</p>
                    <p className="text-xs text-slate-400">
                      {t.ticketNo} · {t.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        t.priority === "Urgent"
                          ? "bg-red-500/20 text-red-400"
                          : t.priority === "High"
                          ? "bg-orange-500/20 text-orange-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {t.priority}
                    </span>
                    <p className="mt-0.5 text-[10px] text-slate-500">{t.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Notifications */}
        <Section title="Recent Activity">
          {unreadNotifications.length === 0 ? (
            <p className="text-sm text-slate-500">No new notifications</p>
          ) : (
            <div className="space-y-3">
              {unreadNotifications.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border border-white/5 bg-white/5 px-3 py-2.5"
                >
                  <p className="text-sm font-medium text-white">{n.title}</p>
                  {n.message && (
                    <p className="mt-0.5 text-xs text-slate-400">{n.message}</p>
                  )}
                  <p className="mt-1 text-[10px] text-slate-600">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Cheques summary */}
        <Section title="Cheques Schedule">
          {cheques.length === 0 ? (
            <p className="text-sm text-slate-500">No cheques on file</p>
          ) : (
            <div className="space-y-2">
              {cheques.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      #{c.sequenceNo}/{c.totalCheques} · {c.bankName || "Bank"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDate(c.chequeDate)} · {c.chequeNo || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      {formatCurrency(c.amount)}
                    </p>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.status === "Cleared"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : c.status === "Bounced"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function leaseProgress(start: string, end: string): number {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  const n = Date.now()
  if (!s || !e || e <= s) return 0
  const pct = ((n - s) / (e - s)) * 100
  return Math.max(0, Math.min(100, pct))
}

function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string
  value: string
  sub: string
  color: "teal" | "emerald" | "blue" | "amber" | "purple"
  icon: React.ReactNode
}) {
  const colorMap: Record<string, string> = {
    teal: "bg-teal-500/20 text-teal-400",
    emerald: "bg-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/20 text-blue-400",
    amber: "bg-amber-500/20 text-amber-400",
    purple: "bg-purple-500/20 text-purple-400",
  }
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-5 transition-colors hover:bg-white/10">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${colorMap[color]}`}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            {icon}
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400">{label}</p>
          <p className="truncate text-lg font-bold text-white">{value}</p>
          <p className="truncate text-[11px] text-slate-500">{sub}</p>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: { label: string; href: string }
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action && (
          <Link
            href={action.href}
            className="text-xs font-medium text-teal-400 hover:text-teal-300"
          >
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function QuickLink({
  href,
  label,
  sub,
  color,
  icon,
}: {
  href: string
  label: string
  sub: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border border-white/5 bg-gradient-to-br ${color} p-4 transition-all hover:border-white/20 hover:scale-[1.02]`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
        <svg
          className="h-5 w-5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          {icon}
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-[11px] text-slate-300">{sub}</p>
      </div>
    </Link>
  )
}
