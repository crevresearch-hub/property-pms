"use client"

import { useState, useEffect, useCallback } from "react"
import { formatCurrency } from "@/lib/utils"
import { FileText, Download, ClipboardList } from "lucide-react"

interface UnitOption { id: string; unitNo: string; unitType: string; currentRent: number; tenantId: string | null; contractStart: string; contractEnd: string }
interface TenantOption { id: string; name: string }

const defaultForm = {
  unitId: "",
  tenantId: "",
  contractStart: "",
  contractEnd: "",
  annualRent: "",
  securityDeposit: "",
  paymentMode: "",
  chequeCount: "12",
}

const defaultMoveOutForm = {
  unitId: "",
  tenantId: "",
  moveOutDate: "",
  isEarlyTermination: false,
}

export default function ContractsPage() {
  const [units, setUnits] = useState<UnitOption[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [form, setForm] = useState(defaultForm)
  const [moveOutForm, setMoveOutForm] = useState(defaultMoveOutForm)
  const [generating, setGenerating] = useState(false)
  const [generatingMoveOut, setGeneratingMoveOut] = useState(false)
  const [error, setError] = useState("")
  interface MoveOutChecklist {
    unitNo: string
    tenantName: string
    moveOutDate: string
    isEarlyTermination: boolean
    inspectionItems: { id: number; category: string; item: string; status: string }[]
    financialSummary: {
      securityDeposit: { amount: number }
      earlyTermination: { penalty: number }
      outstandingInvoices: { totalAmount: number }
      estimatedRefund: number
    }
  }
  const [moveOutResult, setMoveOutResult] = useState<MoveOutChecklist | null>(null)

  useEffect(() => {
    fetch("/api/units").then(r => r.ok ? r.json() : []).then(d => setUnits(Array.isArray(d) ? d.map((u: UnitOption) => ({ id: u.id, unitNo: u.unitNo, unitType: u.unitType, currentRent: u.currentRent, tenantId: u.tenantId, contractStart: u.contractStart, contractEnd: u.contractEnd })) : []))
    fetch("/api/tenants").then(r => r.ok ? r.json() : []).then(d => setTenants(Array.isArray(d) ? d.map((t: TenantOption) => ({ id: t.id, name: t.name })) : []))
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    setError("")
    try {
      const res = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      const data = await res.json()
      // Open in new tab
      const win = window.open("", "_blank")
      if (win) {
        win.document.write(data.html)
        win.document.close()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setGenerating(false)
    }
  }

  const handleMoveOut = async () => {
    setGeneratingMoveOut(true)
    setError("")
    try {
      const res = await fetch("/api/contracts/move-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(moveOutForm),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setMoveOutResult(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setGeneratingMoveOut(false)
    }
  }

  const selectUnit = (unitId: string) => {
    const unit = units.find(u => u.id === unitId)
    setForm({
      ...form,
      unitId,
      tenantId: unit?.tenantId || "",
      contractStart: unit?.contractStart || "",
      contractEnd: unit?.contractEnd || "",
      annualRent: unit ? String(unit.currentRent) : "",
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Contract Generator</h1>
        <p className="mt-1 text-sm text-slate-400">Generate tenancy contracts and move-out checklists</p>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      {/* Contract Generator */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <FileText className="h-5 w-5 text-amber-400" /> Tenancy Contract
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Unit *</label>
              <select value={form.unitId} onChange={(e) => selectUnit(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                <option value="">Select unit</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.unitNo} ({u.unitType}) - {formatCurrency(u.currentRent)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Tenant *</label>
              <select value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                <option value="">Select tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Contract Start</label>
              <input type="date" value={form.contractStart} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Contract End</label>
              <input type="date" value={form.contractEnd} onChange={(e) => setForm({ ...form, contractEnd: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Annual Rent (AED)</label>
              <input type="number" value={form.annualRent} onChange={(e) => setForm({ ...form, annualRent: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Security Deposit</label>
              <input type="number" value={form.securityDeposit} onChange={(e) => setForm({ ...form, securityDeposit: e.target.value })} placeholder="Auto-calculated" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">No. of Cheques</label>
              <select value={form.chequeCount} onChange={(e) => setForm({ ...form, chequeCount: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                {[1, 2, 3, 4, 6, 12].map(n => <option key={n} value={String(n)}>{n} cheque{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleGenerate} disabled={generating || !form.unitId || !form.tenantId} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50">
            <Download className="h-4 w-4" /> {generating ? "Generating..." : "Generate Contract"}
          </button>
        </div>
      </div>

      {/* Move-Out Checklist */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <ClipboardList className="h-5 w-5 text-amber-400" /> Move-Out Checklist
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Unit *</label>
              <select value={moveOutForm.unitId} onChange={(e) => { const u = units.find(x => x.id === e.target.value); setMoveOutForm({ ...moveOutForm, unitId: e.target.value, tenantId: u?.tenantId || "" }) }} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
                <option value="">Select unit</option>
                {units.filter(u => u.tenantId).map(u => <option key={u.id} value={u.id}>{u.unitNo}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Move-Out Date</label>
              <input type="date" value={moveOutForm.moveOutDate} onChange={(e) => setMoveOutForm({ ...moveOutForm, moveOutDate: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={moveOutForm.isEarlyTermination} onChange={(e) => setMoveOutForm({ ...moveOutForm, isEarlyTermination: e.target.checked })} className="rounded border-slate-600" />
                Early Termination
              </label>
            </div>
          </div>
          <button onClick={handleMoveOut} disabled={generatingMoveOut || !moveOutForm.unitId} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-6 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50">
            <ClipboardList className="h-4 w-4" /> {generatingMoveOut ? "Generating..." : "Generate Checklist"}
          </button>
        </div>

        {/* Move-Out Result */}
        {moveOutResult && (
          <div className="mt-6 space-y-4 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <h3 className="font-semibold text-white">Move-Out Checklist: Unit {moveOutResult.unitNo}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-500">Tenant:</span> <span className="text-white">{moveOutResult.tenantName}</span></div>
              <div><span className="text-slate-500">Move-Out Date:</span> <span className="text-white">{moveOutResult.moveOutDate}</span></div>
              <div><span className="text-slate-500">Early Termination:</span> <span className={moveOutResult.isEarlyTermination ? "text-red-400" : "text-emerald-400"}>{moveOutResult.isEarlyTermination ? "Yes" : "No"}</span></div>
            </div>

            {/* Inspection Items */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase text-slate-400">Inspection Checklist</h4>
              <div className="space-y-1">
                {moveOutResult.inspectionItems?.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300">
                    <input type="checkbox" className="rounded border-slate-600" />
                    <span className="text-slate-500">[{item.category}]</span> {item.item}
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            {moveOutResult.financialSummary && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-400">Financial Summary</h4>
                <div className="rounded border border-slate-700 bg-slate-800 p-3 text-sm">
                  <div className="flex justify-between text-slate-300"><span>Security Deposit</span><span>{formatCurrency(moveOutResult.financialSummary.securityDeposit?.amount || 0)}</span></div>
                  <div className="flex justify-between text-slate-300"><span>Early Termination Penalty</span><span className="text-red-400">{formatCurrency(moveOutResult.financialSummary.earlyTermination?.penalty || 0)}</span></div>
                  <div className="flex justify-between text-slate-300"><span>Outstanding Rent</span><span>{formatCurrency(moveOutResult.financialSummary.outstandingInvoices?.totalAmount || 0)}</span></div>
                  <div className="mt-2 flex justify-between border-t border-slate-700 pt-2 font-semibold"><span className="text-white">Estimated Refund</span><span className="text-emerald-400">{formatCurrency(moveOutResult.financialSummary.estimatedRefund || 0)}</span></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
