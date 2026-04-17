"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Send, Loader2, ExternalLink, Calendar, TrendingUp, Wrench, Building2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"

interface Statement {
  owner: {
    id: string
    ownerName: string
    email: string
    buildingName: string
    iban: string
    bankName: string
    managementFee: number
    maintenanceMarkup: number
  }
  month: string
  periodLabel: string
  rentCollected: number
  otherIncome: number
  maintenanceExpenses: number
  managementCommission: number
  maintenanceMarkupAmount: number
  netPayable: number
  invoices: { invoiceNo: string; tenantName: string; unitNo: string; amount: number; type: string; paidAt: string }[]
  maintenance: { workOrderNo: string; vendorName: string; description: string; amount: number }[]
}

function fmtAED(n: number): string {
  return `AED ${Number(n || 0).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

export default function OwnerReportsPage() {
  const params = useParams<{ id: string }>()
  const ownerId = params.id
  const toast = useToast()
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const res = await fetch(`/api/owners/${ownerId}/monthly-statement?month=${month}`)
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [ownerId, month])

  useEffect(() => {
    load()
  }, [load])

  const sendToOwner = async () => {
    if (!data) return
    if (!data.owner.email) {
      toast.error("Owner has no email on file")
      return
    }
    if (!confirm(`Email the ${data.periodLabel} statement to ${data.owner.ownerName} <${data.owner.email}>?`)) return
    try {
      setSending(true)
      const res = await fetch(`/api/owners/${ownerId}/monthly-statement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Send failed")
      toast.success(body.message || "Statement emailed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href={`/dashboard/owners/${ownerId}/edit`}
          className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Owner
        </Link>

        <div className="mb-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E30613]/10 text-[#E30613]">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Monthly Statement</h1>
              <p className="text-sm text-slate-500">
                {data?.owner.buildingName || "—"} · {data?.owner.ownerName || "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="border-0 bg-transparent text-sm text-slate-900 outline-none"
              />
            </div>
            <a
              href={`/api/owners/${ownerId}/monthly-statement?format=html&month=${month}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" /> Preview HTML
            </a>
            <button
              onClick={sendToOwner}
              disabled={sending || !data}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E30613] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c20510] disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to Owner
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#E30613]" />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {data && !loading && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <KpiCard label="Rent Collected" value={fmtAED(data.rentCollected)} color="text-emerald-700 bg-emerald-50" icon={<TrendingUp className="h-5 w-5" />} />
              <KpiCard label="Maintenance Expenses" value={fmtAED(data.maintenanceExpenses)} color="text-amber-700 bg-amber-50" icon={<Wrench className="h-5 w-5" />} />
              <KpiCard label="Net Payable to Owner" value={fmtAED(data.netPayable)} color="text-white bg-[#E30613]" icon={<TrendingUp className="h-5 w-5" />} highlight />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">Breakdown</h2>
              <div className="space-y-2 text-sm">
                <Row label="Rent Collected" value={fmtAED(data.rentCollected)} />
                <Row label="Other Income" value={fmtAED(data.otherIncome)} />
                <Row label="Maintenance Expenses" value={`− ${fmtAED(data.maintenanceExpenses)}`} minus />
                <Row label={`Maintenance Markup (${data.owner.maintenanceMarkup}%)`} value={`− ${fmtAED(data.maintenanceMarkupAmount)}`} minus />
                <Row label={`CRE Management Commission (${data.owner.managementFee}%)`} value={`− ${fmtAED(data.managementCommission)}`} minus />
                <div className="mt-2 flex items-center justify-between border-t-2 border-slate-900 pt-3">
                  <span className="font-semibold text-slate-900">Net Payable to Owner</span>
                  <span className="text-lg font-bold text-emerald-700">{fmtAED(data.netPayable)}</span>
                </div>
              </div>
            </div>

            {data.owner.iban && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm">
                <p className="font-semibold text-blue-900">Bank Transfer Details</p>
                <p className="mt-1 text-blue-800">Bank: <strong>{data.owner.bankName || "—"}</strong></p>
                <p className="text-blue-800">IBAN: <strong className="font-mono">{data.owner.iban}</strong></p>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Income Details ({data.invoices.length})</h3>
                {data.invoices.length === 0 ? (
                  <p className="text-sm text-slate-500">No payments recorded this month.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-2 text-left font-medium">Invoice</th>
                        <th className="pb-2 text-left font-medium">Tenant / Unit</th>
                        <th className="pb-2 text-left font-medium">Type</th>
                        <th className="pb-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.invoices.map((i, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="py-1.5 text-slate-700">{i.invoiceNo}</td>
                          <td className="py-1.5 text-slate-700">{i.tenantName} · {i.unitNo}</td>
                          <td className="py-1.5 text-slate-600">{i.type}</td>
                          <td className="py-1.5 text-right font-medium text-slate-900">{fmtAED(i.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Maintenance Details ({data.maintenance.length})</h3>
                {data.maintenance.length === 0 ? (
                  <p className="text-sm text-slate-500">No maintenance expenses this month.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-2 text-left font-medium">WO</th>
                        <th className="pb-2 text-left font-medium">Vendor</th>
                        <th className="pb-2 text-left font-medium">Description</th>
                        <th className="pb-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.maintenance.map((m, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="py-1.5 text-slate-700">{m.workOrderNo}</td>
                          <td className="py-1.5 text-slate-700">{m.vendorName}</td>
                          <td className="py-1.5 text-slate-600">{m.description}</td>
                          <td className="py-1.5 text-right font-medium text-slate-900">{fmtAED(m.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, color, icon, highlight }: { label: string; value: string; color: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${highlight ? "border-[#E30613]" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center justify-between">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${color}`}>{icon}</span>
      </div>
      <p className={`mt-3 text-xs font-medium uppercase tracking-wide ${highlight ? "text-white/80" : "text-slate-500"}`}>{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? "text-white" : "text-slate-900"}`}>{value}</p>
    </div>
  )
}

function Row({ label, value, minus }: { label: string; value: string; minus?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <span className={`font-medium ${minus ? "text-amber-700" : "text-slate-900"}`}>{value}</span>
    </div>
  )
}
