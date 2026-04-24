"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { KpiCard } from "@/components/ui/kpi-card"
import { StatusBadge } from "@/components/ui/status-badge"
import { HelpPanel } from "@/components/ui/help-panel"
import { Scale, XCircle, FileWarning, ShieldAlert, Receipt, Ban, UserX, ExternalLink, AlertTriangle } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface LegalData {
  summary: {
    bouncedCheques: number
    bouncedAmount: number
    expiredContracts: number
    unpaidViolations: number
    unpaidViolationsAmount: number
    overdueInvoices: number
    overdueInvoicesAmount: number
    blacklisted: number
    vacating: number
  }
  bouncedCheques: Array<{ id: string; chequeNo: string; chequeDate: string; amount: number; bankName: string; bouncedReason: string; tenantId: string; tenantName: string; tenantPhone: string; unitNo: string }>
  expiredContracts: Array<{ unitId: string; unitNo: string; tenantId: string | null; tenantName: string; tenantPhone: string; contractEnd: string; daysOverdue: number; currentRent: number }>
  unpaidViolations: Array<{ id: string; violationNo: string; type: string; severity: string; fineAmount: number; status: string; tenantName: string; unitNo: string; createdAt: string }>
  overdueInvoices: Array<{ id: string; invoiceNo: string; dueDate: string; totalAmount: number; paidAmount: number; outstanding: number; status: string; tenantName: string; unitNo: string }>
  blacklisted: Array<{ id: string; name: string; phone: string; emiratesId: string; notes: string; updatedAt: string }>
  vacating: Array<{ id: string; name: string; status: string; phone: string; unitNo: string }>
}

export default function LegalPage() {
  const [data, setData] = useState<LegalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<"cheques" | "contracts" | "violations" | "invoices" | "blacklist" | "vacating">("cheques")

  useEffect(() => {
    fetch("/api/legal")
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Failed to load")
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>
  if (error) return <div className="rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">{error}</div>
  if (!data) return null

  const s = data.summary
  const tabs = [
    { key: "cheques", label: "Bounced Cheques", count: s.bouncedCheques, icon: XCircle },
    { key: "contracts", label: "Expired Contracts", count: s.expiredContracts, icon: FileWarning },
    { key: "violations", label: "Unpaid Violations", count: s.unpaidViolations, icon: ShieldAlert },
    { key: "invoices", label: "Overdue Invoices", count: s.overdueInvoices, icon: Receipt },
    { key: "blacklist", label: "Blacklisted", count: s.blacklisted, icon: Ban },
    { key: "vacating", label: "Vacating / Terminated", count: s.vacating, icon: UserX },
  ] as const

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E30613]/20">
            <Scale className="h-5 w-5 text-[#E30613]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Legal Dashboard</h1>
            <p className="text-sm text-slate-400">All cases that may require legal action — auto-aggregated from the system</p>
          </div>
        </div>
        <HelpPanel
          title="Legal — How it works"
          sections={[
            {
              title: "What this page does",
              body: (
                <p>Automatically flags any case in your system that might need legal attention — bounced cheques, expired leases, unpaid fines, overdue invoices, blacklisted tenants, and tenants vacating. Nothing to configure — it just aggregates data already in the system.</p>
              ),
            },
            {
              title: "Why cases appear here",
              body: (
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Bounced Cheque</strong> — tenant&apos;s cheque was rejected by bank. Money not received. You may need to file a police complaint or pursue civil case under UAE Decree-Law 14.</li>
                  <li><strong>Expired Contract</strong> — lease end date has passed but tenant still occupies the unit. Either renew or start eviction.</li>
                  <li><strong>Unpaid Violation</strong> — fine issued but not paid. Enforcement needed.</li>
                  <li><strong>Overdue Invoice</strong> — invoice past due date with balance remaining. Demand letter or legal notice.</li>
                  <li><strong>Blacklisted</strong> — tenant flagged as do-not-rent. Historical reference.</li>
                  <li><strong>Vacating / Terminated</strong> — tenants in the process of leaving. Track final settlements.</li>
                </ul>
              ),
            },
            {
              title: "Quick actions",
              body: (
                <p>Click any tenant name or unit to jump to their full profile. From there you can issue notices, terminate contracts, or blacklist.</p>
              ),
            },
          ]}
        />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Bounced" value={s.bouncedCheques} subtitle={formatCurrency(s.bouncedAmount)} color="red" icon={<XCircle className="h-5 w-5" />} />
        <KpiCard label="Expired Contracts" value={s.expiredContracts} color="amber" icon={<FileWarning className="h-5 w-5" />} />
        <KpiCard label="Unpaid Violations" value={s.unpaidViolations} subtitle={formatCurrency(s.unpaidViolationsAmount)} color="red" icon={<ShieldAlert className="h-5 w-5" />} />
        <KpiCard label="Overdue Invoices" value={s.overdueInvoices} subtitle={formatCurrency(s.overdueInvoicesAmount)} color="red" icon={<Receipt className="h-5 w-5" />} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-0">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? "border-[#E30613] text-white" : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold">{t.count}</span>
            </button>
          )
        })}
      </div>

      {/* Panels */}
      {tab === "cheques" && (
        <Panel icon={<XCircle className="h-4 w-4 text-red-400" />} title="Bounced Cheques" desc="Cheques rejected by bank — money not received.">
          {data.bouncedCheques.length === 0 ? <Empty text="No bounced cheques." /> : (
            <DataTable rows={data.bouncedCheques.map((c) => ({
              ID: c.chequeNo,
              Tenant: <Link href={`/dashboard/tenants/${c.tenantId}/edit`} className="text-amber-400 hover:underline">{c.tenantName}</Link>,
              Phone: c.tenantPhone,
              Unit: c.unitNo,
              Bank: c.bankName,
              Amount: <span className="text-red-400 font-semibold">{formatCurrency(c.amount)}</span>,
              Date: formatDate(c.chequeDate),
              Reason: c.bouncedReason || <span className="text-slate-500">—</span>,
            }))} />
          )}
        </Panel>
      )}

      {tab === "contracts" && (
        <Panel icon={<FileWarning className="h-4 w-4 text-amber-400" />} title="Expired Contracts" desc="Lease end date has passed. Tenant still occupies the unit without a renewal.">
          {data.expiredContracts.length === 0 ? <Empty text="All active contracts are within term." /> : (
            <DataTable rows={data.expiredContracts.map((u) => ({
              Unit: u.unitNo,
              Tenant: u.tenantId ? <Link href={`/dashboard/tenants/${u.tenantId}/edit`} className="text-amber-400 hover:underline">{u.tenantName}</Link> : u.tenantName,
              Phone: u.tenantPhone,
              "Contract End": formatDate(u.contractEnd),
              "Days Overdue": <span className="text-red-400 font-semibold">{u.daysOverdue} days</span>,
              "Annual Rent": formatCurrency(u.currentRent),
            }))} />
          )}
        </Panel>
      )}

      {tab === "violations" && (
        <Panel icon={<ShieldAlert className="h-4 w-4 text-red-400" />} title="Unpaid Violations" desc="Fines issued but not settled.">
          {data.unpaidViolations.length === 0 ? <Empty text="No unpaid violations." /> : (
            <DataTable rows={data.unpaidViolations.map((v) => ({
              Ref: v.violationNo,
              Type: v.type,
              Severity: <StatusBadge status={v.severity} />,
              Tenant: v.tenantName,
              Unit: v.unitNo,
              Fine: formatCurrency(v.fineAmount),
              Status: <StatusBadge status={v.status} />,
              Issued: formatDate(String(v.createdAt).slice(0, 10)),
            }))} />
          )}
        </Panel>
      )}

      {tab === "invoices" && (
        <Panel icon={<Receipt className="h-4 w-4 text-red-400" />} title="Overdue Invoices" desc="Invoices past their due date with unpaid balance.">
          {data.overdueInvoices.length === 0 ? <Empty text="No overdue invoices." /> : (
            <DataTable rows={data.overdueInvoices.map((i) => ({
              Invoice: i.invoiceNo,
              Tenant: i.tenantName,
              Unit: i.unitNo,
              "Due Date": formatDate(i.dueDate),
              Total: formatCurrency(i.totalAmount),
              Paid: formatCurrency(i.paidAmount),
              Outstanding: <span className="text-red-400 font-semibold">{formatCurrency(i.outstanding)}</span>,
              Status: <StatusBadge status={i.status} />,
            }))} />
          )}
        </Panel>
      )}

      {tab === "blacklist" && (
        <Panel icon={<Ban className="h-4 w-4 text-red-400" />} title="Blacklisted Tenants" desc="Tenants flagged as do-not-rent.">
          {data.blacklisted.length === 0 ? <Empty text="No blacklisted tenants." /> : (
            <DataTable rows={data.blacklisted.map((t) => ({
              Name: <Link href={`/dashboard/tenants/${t.id}/edit`} className="text-amber-400 hover:underline">{t.name}</Link>,
              Phone: t.phone || <span className="text-slate-500">—</span>,
              "Emirates ID": t.emiratesId || <span className="text-slate-500">—</span>,
              Since: formatDate(String(t.updatedAt).slice(0, 10)),
              Notes: t.notes ? <span className="text-xs text-slate-400">{t.notes.slice(0, 80)}</span> : <span className="text-slate-500">—</span>,
            }))} />
          )}
        </Panel>
      )}

      {tab === "vacating" && (
        <Panel icon={<UserX className="h-4 w-4 text-amber-400" />} title="Vacating / Terminated" desc="Tenants in the process of leaving. Track final settlements.">
          {data.vacating.length === 0 ? <Empty text="No tenants currently vacating." /> : (
            <DataTable rows={data.vacating.map((t) => ({
              Name: <Link href={`/dashboard/tenants/${t.id}/edit`} className="text-amber-400 hover:underline">{t.name}</Link>,
              Unit: t.unitNo,
              Phone: t.phone || <span className="text-slate-500">—</span>,
              Status: <StatusBadge status={t.status} />,
            }))} />
          )}
        </Panel>
      )}
    </div>
  )
}

function Panel({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
      <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-3">
        <div className="flex items-center gap-2">{icon}<h3 className="text-sm font-semibold text-white">{title}</h3></div>
        <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-sm text-green-400">
      <AlertTriangle className="h-4 w-4" /> {text}
    </div>
  )
}

function DataTable({ rows }: { rows: Array<Record<string, React.ReactNode>> }) {
  if (rows.length === 0) return null
  const cols = Object.keys(rows[0])
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-900 text-slate-500">
          <tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-semibold uppercase tracking-wider">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((r, i) => (
            <tr key={i} className="text-slate-300 hover:bg-slate-800/40">
              {cols.map((c) => <td key={c} className="px-3 py-2 whitespace-nowrap">{r[c]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
