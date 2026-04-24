"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import { UaeBankInput } from "@/components/ui/uae-bank-input"
import { Plus, Trash2, Banknote, CheckCircle, Clock, AlertCircle } from "lucide-react"

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
  createdAt: string
  [key: string]: unknown
}

interface OwnerOpt {
  id: string
  ownerName: string
  buildingName: string
  buildingBankName?: string
  buildingBankAccountNo?: string
}

interface TenantOpt {
  id: string
  name: string
  units: { unitNo: string }[]
}

const defaultForm = {
  amount: "",
  cashSource: "Upfront",
  tenantId: "",
  tenantName: "",
  unitNo: "",
  ownerId: "",
  ownerName: "",
  bankName: "",
  accountNo: "",
  referenceNo: "",
  depositedAt: new Date().toISOString().slice(0, 10),
  status: "Deposited",
  notes: "",
}

export default function CashDepositsPage() {
  const [deposits, setDeposits] = useState<CashDeposit[]>([])
  const [owners, setOwners] = useState<OwnerOpt[]>([])
  const [tenants, setTenants] = useState<TenantOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      const [dRes, oRes, tRes] = await Promise.all([
        fetch("/api/cash-deposits"),
        fetch("/api/owners"),
        fetch("/api/tenants"),
      ])
      if (dRes.ok) setDeposits(await dRes.json())
      if (oRes.ok) setOwners(await oRes.json())
      if (tRes.ok) setTenants(await tRes.json())
    } catch {
      setError("Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleAdd = async () => {
    setError("")
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("Enter a valid amount"); return }
    if (!form.depositedAt) { setError("Deposit date is required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/cash-deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || "Failed")
      }
      setAddOpen(false)
      setForm(defaultForm)
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (d: CashDeposit) => {
    if (!confirm(`Delete this deposit of AED ${d.amount.toLocaleString()}?`)) return
    await fetch(`/api/cash-deposits/${d.id}`, { method: "DELETE" })
    await loadAll()
  }

  const handleVerify = async (d: CashDeposit) => {
    await fetch(`/api/cash-deposits/${d.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Verified" }),
    })
    await loadAll()
  }

  // Summary stats
  const summary = useMemo(() => {
    const total = deposits.reduce((s, d) => s + d.amount, 0)
    const pending = deposits.filter((d) => d.status === "Pending")
    const deposited = deposits.filter((d) => d.status === "Deposited")
    const verified = deposits.filter((d) => d.status === "Verified")
    return {
      total,
      count: deposits.length,
      pendingCount: pending.length,
      pendingAmt: pending.reduce((s, d) => s + d.amount, 0),
      depositedCount: deposited.length,
      depositedAmt: deposited.reduce((s, d) => s + d.amount, 0),
      verifiedCount: verified.length,
      verifiedAmt: verified.reduce((s, d) => s + d.amount, 0),
    }
  }, [deposits])

  const columns: Column<CashDeposit>[] = [
    {
      key: "depositedAt",
      header: "Deposit Date",
      sortable: true,
      render: (r) => r.depositedAt ? formatDate(r.depositedAt) : "--",
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      render: (r) => <span className="font-semibold text-amber-400">{formatCurrency(r.amount)}</span>,
    },
    { key: "cashSource", header: "Source", filterable: true },
    {
      key: "tenantName",
      header: "From (Tenant)",
      filterable: true,
      render: (r) => (
        <div>
          <div className="text-white">{r.tenantName || "—"}</div>
          {r.unitNo && <div className="text-[10px] text-slate-500">Unit {r.unitNo}</div>}
        </div>
      ),
    },
    {
      key: "ownerName",
      header: "To (Owner)",
      filterable: true,
      render: (r) => (
        <div>
          <div className="text-white">{r.ownerName || "—"}</div>
          {r.bankName && <div className="text-[10px] text-slate-500">{r.bankName}{r.accountNo ? ` · ${r.accountNo}` : ""}</div>}
        </div>
      ),
    },
    { key: "referenceNo", header: "Ref #", render: (r) => <span className="font-mono text-xs">{r.referenceNo || "—"}</span> },
    { key: "depositedBy", header: "Staff", render: (r) => r.depositedBy || "—" },
    {
      key: "status",
      header: "Status",
      filterable: true,
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex gap-1">
          {r.status !== "Verified" && (
            <button
              onClick={() => handleVerify(r)}
              title="Mark verified by owner"
              className="rounded p-1.5 text-slate-400 hover:bg-emerald-900/50 hover:text-emerald-400"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => handleDelete(r)}
            title="Delete"
            className="rounded p-1.5 text-slate-400 hover:bg-red-900/50 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>
  }

  const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
  const labelCls = "mb-1 block text-xs font-medium text-slate-400"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cash Deposits</h1>
          <p className="mt-1 text-sm text-slate-400">
            Track cash PMS staff deposit into owner bank accounts — tenants → staff → bank.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" /> Record Deposit
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
          {error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Records" value={summary.count} subtitle={formatCurrency(summary.total)} color="blue" icon={<Banknote className="h-5 w-5" />} />
        <KpiCard label="Pending" value={summary.pendingCount} subtitle={formatCurrency(summary.pendingAmt)} color="amber" icon={<Clock className="h-5 w-5" />} />
        <KpiCard label="Deposited" value={summary.depositedCount} subtitle={formatCurrency(summary.depositedAmt)} color="blue" icon={<Banknote className="h-5 w-5" />} />
        <KpiCard label="Verified by Owner" value={summary.verifiedCount} subtitle={formatCurrency(summary.verifiedAmt)} color="green" icon={<CheckCircle className="h-5 w-5" />} />
      </div>

      <div className="rounded-lg border border-blue-800 bg-blue-900/10 p-3 text-xs text-blue-200">
        <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
        Each row is an accountability record: staff deposited tenant cash into the owner&apos;s bank account on that date. Use the ✓ icon to mark a deposit &ldquo;Verified by Owner&rdquo; once the owner confirms receipt.
      </div>

      <DataTable<CashDeposit> data={deposits} columns={columns} searchKeys={["tenantName", "ownerName", "referenceNo", "depositedBy", "unitNo"]} />

      {/* Add modal */}
      <Modal
        open={addOpen}
        onOpenChange={(v) => { setAddOpen(v); if (!v) setForm(defaultForm) }}
        title="Record Cash Deposit"
        description="Staff handed cash to the bank for the owner's account — log it for accountability."
        size="lg"
        footer={
          <>
            <ModalCancelButton />
            <ModalSaveButton onClick={handleAdd} disabled={saving || !form.amount || !form.depositedAt}>
              {saving ? "Saving..." : "Save"}
            </ModalSaveButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Amount (AED) *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 5000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cash Source</label>
              <select value={form.cashSource} onChange={(e) => setForm({ ...form, cashSource: e.target.value })} className={inputCls}>
                <option>Upfront</option>
                <option>Security Deposit</option>
                <option>Admin / Ejari Fees</option>
                <option>Rent</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>From Tenant (optional)</label>
              <select
                value={form.tenantId}
                onChange={(e) => {
                  const t = tenants.find((x) => x.id === e.target.value)
                  setForm({
                    ...form,
                    tenantId: e.target.value,
                    tenantName: t?.name || "",
                    unitNo: t?.units?.[0]?.unitNo || "",
                  })
                }}
                className={inputCls}
              >
                <option value="">— Select tenant —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}{t.units?.[0]?.unitNo ? ` (Unit ${t.units[0].unitNo})` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>To Owner *</label>
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
                className={inputCls}
              >
                <option value="">— Select owner —</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.ownerName} – {o.buildingName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Owner Bank *</label>
              <UaeBankInput value={form.bankName} onChange={(v) => setForm({ ...form, bankName: v })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Account Number</label>
              <input type="text" value={form.accountNo} onChange={(e) => setForm({ ...form, accountNo: e.target.value })} placeholder="AEXX XXXX XXXX…" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Deposit Date *</label>
              <input type="date" value={form.depositedAt} onChange={(e) => setForm({ ...form, depositedAt: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Bank Reference # <span className="text-slate-500">(deposit slip)</span></label>
              <input type="text" value={form.referenceNo} onChange={(e) => setForm({ ...form, referenceNo: e.target.value })} placeholder="e.g. DEP-2026-00123" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Deposited at Emirates NBD Bur Dubai branch, slip # 4432" className={inputCls} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
