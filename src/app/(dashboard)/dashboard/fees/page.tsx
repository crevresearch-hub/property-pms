"use client"

import { useState, useEffect, useCallback } from "react"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatCurrency } from "@/lib/utils"
import { Calculator, Banknote, Plus, Zap } from "lucide-react"

interface FeeEntry {
  id: string; tenantId: string | null; unitId: string | null; tenant: { id: string; name: string } | null; unit: { id: string; unitNo: string } | null
  feeType: string; description: string; amount: number; beneficiary: string; status: string; paidDate: string
  [key: string]: unknown
}

interface FeeStructure {
  [key: string]: { name: string; type: string; beneficiary: string; amount?: number; rate?: number; min?: number; months?: number }
}

const defaultForm = { tenantId: "", unitId: "", feeType: "", description: "", amount: "", beneficiary: "Alwaan" }
const defaultCalcForm = { fee_type: "", annual_rent: "" }

export default function FeesPage() {
  const [entries, setEntries] = useState<FeeEntry[]>([])
  const [structure, setStructure] = useState<FeeStructure>({})
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<{ id: string; unitNo: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [calcForm, setCalcForm] = useState(defaultCalcForm)
  const [calcResult, setCalcResult] = useState<{ name: string; calculated_amount: number; beneficiary: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [autoChecking, setAutoChecking] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [lRes, sRes] = await Promise.all([fetch("/api/fees/ledger"), fetch("/api/fees/structure")])
      if (!lRes.ok) throw new Error("Failed to fetch fee ledger")
      setEntries(await lRes.json())
      if (sRes.ok) setStructure(await sRes.json())
      const [tRes, uRes] = await Promise.all([fetch("/api/tenants"), fetch("/api/units")])
      if (tRes.ok) { const d = await tRes.json(); setTenants(d.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))) }
      if (uRes.ok) { const d = await uRes.json(); setUnits(d.map((u: { id: string; unitNo: string }) => ({ id: u.id, unitNo: u.unitNo }))) }
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/fees/ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setAddOpen(false); setForm(defaultForm); fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setSaving(false) }
  }

  const handleCalculate = async () => {
    try {
      const res = await fetch("/api/fees/calculate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(calcForm) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setCalcResult(await res.json())
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") }
  }

  const handleAutoCheck = async () => {
    setAutoChecking(true)
    try {
      const res = await fetch("/api/fees/auto-check", { method: "POST" })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      const data = await res.json()
      alert(data.message)
      fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setAutoChecking(false) }
  }

  const markPaid = async (id: string) => {
    try {
      const res = await fetch(`/api/fees/ledger/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Paid", paidDate: new Date().toISOString().split("T")[0] }) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") }
  }

  const pendingTotal = entries.filter(e => e.status === "Pending").reduce((s, e) => s + e.amount, 0)
  const paidTotal = entries.filter(e => e.status === "Paid").reduce((s, e) => s + e.amount, 0)

  const columns: Column<FeeEntry>[] = [
    { key: "tenant", header: "Tenant", render: (r) => r.tenant?.name || "--" },
    { key: "unit", header: "Unit", render: (r) => r.unit?.unitNo || "--" },
    { key: "feeType", header: "Type", sortable: true },
    { key: "description", header: "Description" },
    { key: "amount", header: "Amount", sortable: true, render: (r) => formatCurrency(r.amount) },
    { key: "beneficiary", header: "Beneficiary" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions", header: "Actions",
      render: (r) => r.status === "Pending" ? (
        <button onClick={(e) => { e.stopPropagation(); markPaid(r.id) }} className="rounded px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-900/30">Mark Paid</button>
      ) : null,
    },
  ]

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Alwaan Fees</h1><p className="mt-1 text-sm text-slate-400">{entries.length} fee entries</p></div>
        <div className="flex gap-2">
          <button onClick={handleAutoCheck} disabled={autoChecking} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50">
            <Zap className="h-4 w-4" /> {autoChecking ? "Checking..." : "Auto-Check Penalties"}
          </button>
          <button onClick={() => { setForm(defaultForm); setAddOpen(true) }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500"><Plus className="h-4 w-4" /> Add Fee</button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <Banknote className="h-8 w-8 text-amber-400" />
          <div><p className="text-xs text-slate-400">Pending Fees</p><p className="text-xl font-bold text-white">{formatCurrency(pendingTotal)}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <Banknote className="h-8 w-8 text-emerald-400" />
          <div><p className="text-xs text-slate-400">Collected Fees</p><p className="text-xl font-bold text-white">{formatCurrency(paidTotal)}</p></div>
        </div>
      </div>

      {/* Fee Calculator */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase text-slate-400"><Calculator className="h-4 w-4 text-amber-400" /> Fee Calculator</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">Fee Type</label>
            <select value={calcForm.fee_type} onChange={(e) => setCalcForm({ ...calcForm, fee_type: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
              <option value="">Select</option>
              {Object.entries(structure).map(([key, val]) => <option key={key} value={key}>{val.name}</option>)}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="mb-1 block text-xs font-medium text-slate-400">Annual Rent (AED)</label>
            <input type="number" value={calcForm.annual_rent} onChange={(e) => setCalcForm({ ...calcForm, annual_rent: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <button onClick={handleCalculate} disabled={!calcForm.fee_type} className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/30 disabled:opacity-50">Calculate</button>
          {calcResult && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm">
              <span className="text-slate-400">{calcResult.name}:</span> <span className="font-bold text-amber-400">{formatCurrency(calcResult.calculated_amount)}</span>
              <span className="ml-2 text-xs text-slate-500">({calcResult.beneficiary})</span>
            </div>
          )}
        </div>
      </div>

      <DataTable columns={columns} data={entries} searchPlaceholder="Search fees..." searchKeys={["feeType", "description"]} />

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Add Fee Entry" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.feeType || !form.amount}>{saving ? "Saving..." : "Save"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Tenant</label><select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="">Select</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Unit</label><select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="">Select</option>{units.map(u => <option key={u.id} value={u.id}>{u.unitNo}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Fee Type *</label><input type="text" value={form.feeType} onChange={(e) => setForm({ ...form, feeType: e.target.value })} placeholder="e.g., Bounced Cheque Fine" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Amount (AED) *</label><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          </div>
          <div><label className="mb-1 block text-xs font-medium text-slate-400">Description</label><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          <div><label className="mb-1 block text-xs font-medium text-slate-400">Beneficiary</label><select value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="Alwaan">Alwaan</option><option value="Landlord">Landlord</option><option value="Tenant">Tenant</option></select></div>
        </div>
      </Modal>
    </div>
  )
}
