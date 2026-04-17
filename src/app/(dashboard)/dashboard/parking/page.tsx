"use client"

import { useState, useEffect, useCallback } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { Car, ParkingCircle, Plus, Layers, UserPlus, UserMinus } from "lucide-react"

interface SlotRow {
  id: string; slotNo: string; zone: string; floor: string; type: string; status: string
  tenantId: string | null; tenant: { id: string; name: string } | null; unit: { id: string; unitNo: string } | null
  vehiclePlate: string; vehicleType: string; vehicleColor: string; notes: string
  [key: string]: unknown
}

interface Stats { total: number; assigned: number; available: number; reserved: number; parking_violations: number }

const defaultForm = { slotNo: "", zone: "A", floor: "Basement", type: "Standard", notes: "" }
const defaultBulkForm = { zone: "A", floor: "Basement", prefix: "", start: "1", end: "10", type: "Standard" }
const defaultAssignForm = { tenantId: "", unitId: "", vehiclePlate: "", vehicleType: "", vehicleColor: "" }

export default function ParkingPage() {
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [units, setUnits] = useState<{ id: string; unitNo: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [bulkForm, setBulkForm] = useState(defaultBulkForm)
  const [assignForm, setAssignForm] = useState(defaultAssignForm)
  const [assignId, setAssignId] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [sRes, stRes] = await Promise.all([fetch("/api/parking"), fetch("/api/parking/stats")])
      if (!sRes.ok) throw new Error("Failed to fetch parking data")
      setSlots(await sRes.json())
      if (stRes.ok) setStats(await stRes.json())
      const [tRes, uRes] = await Promise.all([fetch("/api/tenants"), fetch("/api/units")])
      if (tRes.ok) { const d = await tRes.json(); setTenants(d.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name }))) }
      if (uRes.ok) { const d = await uRes.json(); setUnits(d.map((u: { id: string; unitNo: string }) => ({ id: u.id, unitNo: u.unitNo }))) }
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/parking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setAddOpen(false); setForm(defaultForm); fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setSaving(false) }
  }

  const handleBulkAdd = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/parking/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bulkForm) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      const data = await res.json()
      alert(`${data.created} slots created, ${data.skipped} skipped`)
      setBulkOpen(false); setBulkForm(defaultBulkForm); fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setSaving(false) }
  }

  const openAssign = (slot: SlotRow) => {
    setAssignId(slot.id)
    setAssignForm({ tenantId: slot.tenantId || "", unitId: slot.unit?.id || "", vehiclePlate: slot.vehiclePlate, vehicleType: slot.vehicleType, vehicleColor: slot.vehicleColor })
    setAssignOpen(true)
  }

  const handleAssign = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/parking/${assignId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...assignForm, status: "Assigned" }) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setAssignOpen(false); fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") } finally { setSaving(false) }
  }

  const releaseSlot = async (id: string) => {
    try {
      const res = await fetch(`/api/parking/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "Available", tenantId: null, unitId: null, vehiclePlate: "", vehicleType: "", vehicleColor: "" }) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") }
  }

  const columns: Column<SlotRow>[] = [
    { key: "slotNo", header: "Slot #", sortable: true },
    { key: "zone", header: "Zone" },
    { key: "floor", header: "Floor" },
    { key: "type", header: "Type" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "tenant", header: "Tenant", render: (r) => r.tenant?.name || "--" },
    { key: "vehiclePlate", header: "Vehicle", render: (r) => r.vehiclePlate ? `${r.vehiclePlate} (${r.vehicleColor || ""} ${r.vehicleType || ""})`.trim() : "--" },
    {
      key: "actions", header: "Actions",
      render: (r) => (
        <div className="flex gap-1">
          {r.status === "Available" && <button onClick={(e) => { e.stopPropagation(); openAssign(r) }} className="rounded p-1.5 text-slate-400 hover:bg-emerald-900/50 hover:text-emerald-400" title="Assign"><UserPlus className="h-4 w-4" /></button>}
          {r.status === "Assigned" && <button onClick={(e) => { e.stopPropagation(); releaseSlot(r.id) }} className="rounded p-1.5 text-slate-400 hover:bg-red-900/50 hover:text-red-400" title="Release"><UserMinus className="h-4 w-4" /></button>}
        </div>
      ),
    },
  ]

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Parking Management</h1><p className="mt-1 text-sm text-slate-400">{slots.length} parking slots</p></div>
        <div className="flex gap-2">
          <button onClick={() => setBulkOpen(true)} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white"><Layers className="h-4 w-4" /> Bulk Add</button>
          <button onClick={() => { setForm(defaultForm); setAddOpen(true) }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500"><Plus className="h-4 w-4" /> Add Slot</button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Slots" value={stats.total} color="blue" icon={<ParkingCircle className="h-5 w-5" />} />
          <KpiCard label="Assigned" value={stats.assigned} color="green" icon={<Car className="h-5 w-5" />} />
          <KpiCard label="Available" value={stats.available} color="amber" icon={<ParkingCircle className="h-5 w-5" />} />
          <KpiCard label="Violations" value={stats.parking_violations} color="red" icon={<Car className="h-5 w-5" />} />
        </div>
      )}

      <DataTable columns={columns} data={slots} searchPlaceholder="Search parking..." searchKeys={["slotNo", "zone", "vehiclePlate"]} />

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Add Parking Slot"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.slotNo}>{saving ? "Saving..." : "Save"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Slot No *</label><input type="text" value={form.slotNo} onChange={(e) => setForm({ ...form, slotNo: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Zone</label><input type="text" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Floor</label><input type="text" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="Standard">Standard</option><option value="Compact">Compact</option><option value="Handicap">Handicap</option><option value="VIP">VIP</option></select></div>
          </div>
        </div>
      </Modal>

      <Modal open={bulkOpen} onOpenChange={setBulkOpen} title="Bulk Add Parking Slots"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleBulkAdd} disabled={saving || !bulkForm.start || !bulkForm.end}>{saving ? "Creating..." : "Create"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Zone</label><input type="text" value={bulkForm.zone} onChange={(e) => setBulkForm({ ...bulkForm, zone: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Start #</label><input type="number" value={bulkForm.start} onChange={(e) => setBulkForm({ ...bulkForm, start: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">End #</label><input type="number" value={bulkForm.end} onChange={(e) => setBulkForm({ ...bulkForm, end: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Floor</label><input type="text" value={bulkForm.floor} onChange={(e) => setBulkForm({ ...bulkForm, floor: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Type</label><select value={bulkForm.type} onChange={(e) => setBulkForm({ ...bulkForm, type: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="Standard">Standard</option><option value="Compact">Compact</option></select></div>
          </div>
        </div>
      </Modal>

      <Modal open={assignOpen} onOpenChange={setAssignOpen} title="Assign Parking Slot"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAssign} disabled={saving || !assignForm.tenantId}>{saving ? "Assigning..." : "Assign"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Tenant *</label><select value={assignForm.tenantId} onChange={(e) => setAssignForm({ ...assignForm, tenantId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="">Select</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Unit</label><select value={assignForm.unitId} onChange={(e) => setAssignForm({ ...assignForm, unitId: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"><option value="">Select</option>{units.map(u => <option key={u.id} value={u.id}>{u.unitNo}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Plate No</label><input type="text" value={assignForm.vehiclePlate} onChange={(e) => setAssignForm({ ...assignForm, vehiclePlate: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Vehicle Type</label><input type="text" value={assignForm.vehicleType} onChange={(e) => setAssignForm({ ...assignForm, vehicleType: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
            <div><label className="mb-1 block text-xs font-medium text-slate-400">Color</label><input type="text" value={assignForm.vehicleColor} onChange={(e) => setAssignForm({ ...assignForm, vehicleColor: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" /></div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
