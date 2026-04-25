"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { KpiCard } from "@/components/ui/kpi-card"
import { formatCurrency } from "@/lib/utils"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { UaeBankInput } from "@/components/ui/uae-bank-input"
import { Banknote, Wallet, ArrowRight, CheckCircle, Plus, ExternalLink, Upload } from "lucide-react"
import { TrackerTabs } from "@/components/ui/tracker-tabs"

interface Unit {
  id: string
  unitNo: string
  status: string
  currentRent: number
  tenantId: string | null
  tenant: { id: string; name: string; email?: string } | null
  ownerId?: string
  ownerName?: string
}

interface CashDeposit {
  id: string
  amount: number
  cashSource: string
  tenantId: string | null
  tenantName: string
  unitNo: string
  ownerId: string | null
  ownerName: string
  bankName: string
  accountNo: string
  referenceNo: string
  depositedBy: string
  depositedAt: string
  status: string
  notes: string
}

interface Cheque {
  id: string
  tenantId: string
  unitId: string | null
  amount: number
  status: string
}

interface OwnerOpt {
  id: string
  ownerName: string
  buildingName: string
  buildingBankName?: string
  buildingBankAccountNo?: string
}

export default function CashTrackerPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [deposits, setDeposits] = useState<CashDeposit[]>([])
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [owners, setOwners] = useState<OwnerOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "pending" | "fully-paid">("all")

  // "Record Cash" modal state — records a collection from a tenant +
  // (optionally) logs the bank deposit to the owner in one shot.
  const [recordOpen, setRecordOpen] = useState(false)
  const [recordTarget, setRecordTarget] = useState<{ unit: Unit; annualRent: number } | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    amount: "",
    cashSource: "Rent",
    ownerId: "",
    ownerName: "",
    bankName: "",
    accountNo: "",
    referenceNo: "",
    depositedAt: new Date().toISOString().slice(0, 10),
    notes: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const loadAll = useCallback(async () => {
    try {
      const [uRes, dRes, cRes, oRes] = await Promise.all([
        fetch("/api/units"),
        fetch("/api/cash-deposits"),
        fetch("/api/cheques"),
        fetch("/api/owners"),
      ])
      if (uRes.ok) setUnits(await uRes.json())
      if (dRes.ok) setDeposits(await dRes.json())
      if (cRes.ok) {
        const data = await cRes.json()
        const list = Array.isArray(data) ? data : (data.cheques || [])
        setCheques(list)
      }
      if (oRes.ok) setOwners(await oRes.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Tenants paying in cash = occupied units whose tenant has zero cheques on record.
  const cashCards = useMemo(() => {
    const tenantChequeCount = new Map<string, number>()
    for (const c of cheques) {
      tenantChequeCount.set(c.tenantId, (tenantChequeCount.get(c.tenantId) || 0) + 1)
    }
    const depositsByTenant = new Map<string, CashDeposit[]>()
    for (const d of deposits) {
      if (!d.tenantId) continue
      const list = depositsByTenant.get(d.tenantId) || []
      list.push(d)
      depositsByTenant.set(d.tenantId, list)
    }
    const rows = units
      .filter((u) => u.tenantId && u.tenant && (tenantChequeCount.get(u.tenantId!) || 0) === 0)
      .map((u) => {
        const tenantDeposits = depositsByTenant.get(u.tenantId!) || []
        const collected = tenantDeposits.reduce((s, d) => s + d.amount, 0)
        const verified = tenantDeposits.filter((d) => d.status === "Verified").reduce((s, d) => s + d.amount, 0)
        const annual = u.currentRent || 0
        const pending = Math.max(0, annual - collected)
        return {
          unit: u,
          tenantName: u.tenant!.name,
          annualRent: annual,
          collected,
          verified,
          pending,
          deposits: tenantDeposits.sort((a, b) => (b.depositedAt || "").localeCompare(a.depositedAt || "")),
          fullyPaid: collected >= annual && annual > 0,
        }
      })
    return rows.sort((a, b) => a.unit.unitNo.localeCompare(b.unit.unitNo, undefined, { numeric: true }))
  }, [units, cheques, deposits])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cashCards.filter((r) => {
      if (q && !(r.unit.unitNo.toLowerCase().includes(q) || r.tenantName.toLowerCase().includes(q))) return false
      if (filter === "pending" && r.pending <= 0) return false
      if (filter === "fully-paid" && !r.fullyPaid) return false
      return true
    })
  }, [cashCards, search, filter])

  const summary = useMemo(() => {
    const totalExpected = cashCards.reduce((s, r) => s + r.annualRent, 0)
    const totalCollected = cashCards.reduce((s, r) => s + r.collected, 0)
    const totalVerified = cashCards.reduce((s, r) => s + r.verified, 0)
    const totalPending = Math.max(0, totalExpected - totalCollected)
    return {
      tenantCount: cashCards.length,
      fullyPaid: cashCards.filter((r) => r.fullyPaid).length,
      totalExpected,
      totalCollected,
      totalVerified,
      totalPending,
    }
  }, [cashCards])

  const openRecord = (row: { unit: Unit; annualRent: number }) => {
    setRecordTarget(row)
    setForm({
      amount: "",
      cashSource: "Rent",
      ownerId: row.unit.ownerId || "",
      ownerName: row.unit.ownerName || "",
      bankName: "",
      accountNo: "",
      referenceNo: "",
      depositedAt: new Date().toISOString().slice(0, 10),
      notes: "",
    })
    setError("")
    setRecordOpen(true)
  }

  const saveRecord = async () => {
    if (!recordTarget) return
    const amt = parseFloat(form.amount)
    if (!amt || amt <= 0) { setError("Enter amount > 0"); return }
    if (!form.depositedAt) { setError("Deposit date required"); return }
    if (!receiptFile) { setError("Payment receipt is required — please attach the bank slip / proof"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/cash-deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          cashSource: form.cashSource,
          tenantId: recordTarget.unit.tenantId,
          tenantName: recordTarget.unit.tenant?.name || "",
          unitNo: recordTarget.unit.unitNo,
          ownerId: form.ownerId || recordTarget.unit.ownerId || null,
          ownerName: form.ownerName || recordTarget.unit.ownerName || "",
          bankName: form.bankName,
          accountNo: form.accountNo,
          referenceNo: form.referenceNo,
          depositedAt: form.depositedAt,
          notes: form.notes,
          status: "Deposited",
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed")
      const created = await res.json()

      // Upload receipt slip (mandatory)
      const fd = new FormData()
      fd.append("file", receiptFile)
      const slipRes = await fetch(`/api/cash-deposits/${created.id}/slip`, { method: "POST", body: fd })
      if (!slipRes.ok) {
        const e = await slipRes.json().catch(() => ({}))
        throw new Error(e.error || "Receipt upload failed; deposit saved without proof.")
      }

      setRecordOpen(false)
      setReceiptFile(null)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>
  }

  return (
    <div className="space-y-6">
      <TrackerTabs />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cash Tracker</h1>
          <p className="mt-1 text-sm text-slate-400">
            Tenants paying by cash / direct transfer — see how much was collected and deposited into the owner&rsquo;s account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/cash-deposits"
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            <Banknote className="h-4 w-4" /> All Deposits
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Cash-Paying Tenants" value={summary.tenantCount} subtitle={formatCurrency(summary.totalExpected)} color="amber" icon={<Wallet className="h-5 w-5" />} />
        <KpiCard label="Collected / Deposited" value={summary.totalCollected.toLocaleString()} subtitle={formatCurrency(summary.totalCollected)} color="blue" icon={<Banknote className="h-5 w-5" />} />
        <KpiCard label="Verified by Owner" value={summary.totalVerified.toLocaleString()} subtitle={formatCurrency(summary.totalVerified)} color="green" icon={<CheckCircle className="h-5 w-5" />} />
        <KpiCard label="Pending Balance" value={summary.totalPending.toLocaleString()} subtitle={`${summary.fullyPaid}/${summary.tenantCount} fully paid`} color="red" icon={<ArrowRight className="h-5 w-5" />} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search unit or tenant name..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
        />
        {[
          { k: "all", label: `All (${cashCards.length})` },
          { k: "pending", label: `With Pending (${cashCards.filter((r) => r.pending > 0).length})` },
          { k: "fully-paid", label: `Fully Paid (${summary.fullyPaid})` },
        ].map((b) => (
          <button
            key={b.k}
            onClick={() => setFilter(b.k as typeof filter)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === b.k ? "bg-amber-500 text-slate-900" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          No cash-paying tenants match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((r) => (
            <div key={r.unit.id} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
              {/* Header */}
              <div className="border-b border-slate-800 bg-slate-900 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">Unit {r.unit.unitNo}</p>
                    <p className="mt-0.5 text-sm font-semibold text-white">{r.tenantName}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-300">
                      💵 Cash Paid
                    </span>
                    {r.fullyPaid && (
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        ✓ Fully Paid
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
                  <div className="rounded bg-slate-800/60 px-2 py-1">
                    <p className="text-slate-500">Annual Rent</p>
                    <p className="font-semibold text-white">{formatCurrency(r.annualRent)}</p>
                  </div>
                  <div className="rounded bg-emerald-500/10 px-2 py-1">
                    <p className="text-emerald-300/70">Collected</p>
                    <p className="font-semibold text-emerald-300">{formatCurrency(r.collected)}</p>
                  </div>
                  <div className="rounded bg-blue-500/10 px-2 py-1">
                    <p className="text-blue-300/70">Verified</p>
                    <p className="font-semibold text-blue-300">{formatCurrency(r.verified)}</p>
                  </div>
                  <div className="rounded bg-amber-500/10 px-2 py-1">
                    <p className="text-amber-300/70">Pending</p>
                    <p className="font-semibold text-amber-300">{formatCurrency(r.pending)}</p>
                  </div>
                </div>
              </div>

              {/* Deposits ledger */}
              <div className="p-3">
                {r.deposits.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-700 bg-slate-800/30 p-4 text-center">
                    <p className="text-xs text-slate-400">
                      No cash collection recorded yet. Click <strong>+ Record Cash</strong> to log the first payment.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-[11px] text-slate-200">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                        <th className="px-2 py-1.5">Date</th>
                        <th className="px-2 py-1.5">Source</th>
                        <th className="px-2 py-1.5">Bank / Ref</th>
                        <th className="px-2 py-1.5 text-right">Amount</th>
                        <th className="px-2 py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.deposits.map((d) => (
                        <tr key={d.id} className="border-t border-slate-800">
                          <td className="px-2 py-1.5">{d.depositedAt || "—"}</td>
                          <td className="px-2 py-1.5 text-slate-400">{d.cashSource || "—"}</td>
                          <td className="px-2 py-1.5">
                            <div className="text-white">{d.bankName || "—"}</div>
                            {d.referenceNo && <div className="text-[9px] text-slate-500 font-mono">{d.referenceNo}</div>}
                          </td>
                          <td className="px-2 py-1.5 text-right font-semibold text-emerald-300">{formatCurrency(d.amount)}</td>
                          <td className="px-2 py-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                              d.status === "Verified" ? "bg-emerald-500/20 text-emerald-300" :
                              d.status === "Deposited" ? "bg-blue-500/20 text-blue-300" :
                              "bg-amber-500/20 text-amber-300"
                            }`}>{d.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <Link
                    href="/dashboard/cash-deposits"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-700"
                  >
                    <ExternalLink className="h-3 w-3" /> View in Cash Deposits
                  </Link>
                  <button
                    onClick={() => openRecord(r)}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-slate-900 hover:bg-amber-400"
                  >
                    <Plus className="h-3 w-3" /> Record Cash
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record cash modal */}
      <Modal
        open={recordOpen}
        onOpenChange={(v) => { setRecordOpen(v); if (!v) { setRecordTarget(null); setReceiptFile(null) } }}
        title={recordTarget ? `Record Cash — ${recordTarget.unit.unitNo} · ${recordTarget.unit.tenant?.name || ""}` : "Record Cash"}
        description="Log cash collected from this tenant and deposited into the owner's bank account."
        size="lg"
        footer={
          <>
            <ModalCancelButton />
            <ModalSaveButton onClick={saveRecord} disabled={saving || !form.amount || !form.depositedAt || !receiptFile}>
              {saving ? "Saving…" : "Save Collection"}
            </ModalSaveButton>
          </>
        }
      >
        {error && (
          <div className="mb-3 rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
        )}
        {recordTarget && (
          <div className="mb-3 rounded-lg border border-emerald-700/40 bg-emerald-900/10 p-3 text-xs text-emerald-200">
            <span className="font-semibold">Annual rent:</span> {formatCurrency(recordTarget.annualRent)} ·
            <span className="ml-2 font-semibold">Already collected:</span> {formatCurrency(cashCards.find((r) => r.unit.id === recordTarget.unit.id)?.collected || 0)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Amount (AED) *</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="e.g. 5000"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Cash Source</label>
            <select
              value={form.cashSource}
              onChange={(e) => setForm({ ...form, cashSource: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            >
              <option>Rent</option>
              <option>Upfront</option>
              <option>Security Deposit</option>
              <option>Admin / Ejari Fees</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">To Owner</label>
            <select
              value={form.ownerId}
              onChange={(e) => {
                const o = owners.find((x) => x.id === e.target.value)
                setForm({
                  ...form,
                  ownerId: e.target.value,
                  ownerName: o?.ownerName || "",
                  bankName: o?.buildingBankName || form.bankName,
                  accountNo: o?.buildingBankAccountNo || form.accountNo,
                })
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            >
              <option value="">— Select owner —</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.ownerName} – {o.buildingName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Owner Bank</label>
            <UaeBankInput
              value={form.bankName}
              onChange={(v) => setForm({ ...form, bankName: v })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Account No</label>
            <input
              type="text"
              value={form.accountNo}
              onChange={(e) => setForm({ ...form, accountNo: e.target.value })}
              placeholder="AEXX…"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Deposit Date *</label>
            <input
              type="date"
              value={form.depositedAt}
              onChange={(e) => setForm({ ...form, depositedAt: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">Bank Reference #</label>
            <input
              type="text"
              value={form.referenceNo}
              onChange={(e) => setForm({ ...form, referenceNo: e.target.value })}
              placeholder="e.g. DEP-2026-00123"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Payment Receipt <span className="text-red-400">*</span> <span className="text-slate-500 font-normal normal-case">(PDF / JPG / PNG)</span>
            </label>
            <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed p-3 transition-colors ${receiptFile ? "border-emerald-600 bg-emerald-900/10" : "border-slate-700 bg-slate-800 hover:border-amber-500/50"}`}>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <Upload className={`h-5 w-5 ${receiptFile ? "text-emerald-400" : "text-slate-400"}`} />
              <div className="flex-1 min-w-0">
                {receiptFile ? (
                  <>
                    <p className="text-sm font-medium text-emerald-300 truncate">✓ {receiptFile.name}</p>
                    <p className="text-[11px] text-emerald-400/70">{(receiptFile.size / 1024).toFixed(1)} KB · click to replace</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-300">Click to attach the bank deposit slip / payment receipt</p>
                    <p className="text-[11px] text-slate-500">Required so the owner can verify the payment</p>
                  </>
                )}
              </div>
            </label>
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Cash collected at office then deposited same day, Emirates NBD Bur Dubai"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
