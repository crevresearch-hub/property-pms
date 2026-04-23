"use client"

import { useState, useEffect, useCallback } from "react"
import { KpiCard } from "@/components/ui/kpi-card"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Building2,
  Users,
  DoorOpen,
  Percent,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react"

interface Tenant {
  id: string
  name: string
  phone: string
  email: string
}

interface UnitRow {
  id: string
  unitNo: string
  unitType: string
  sqFt: number
  contractStart: string
  contractEnd: string
  currentRent: number
  status: string
  notes: string
  tenantId: string | null
  tenant: Tenant | null
  [key: string]: unknown
}

const defaultForm = {
  unitNo: "",
  unitType: "",
  sqFt: "",
  contractStart: "",
  contractEnd: "",
  currentRent: "",
  status: "Vacant",
  notes: "",
  tenantId: "",
}

export default function UnitsPage() {
  const [units, setUnits] = useState<UnitRow[]>([])
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    floors: 3,
    unitsPerFloor: 8,
    startFloor: 1,
    numbering: "floor-prefix" as "floor-prefix" | "sequential",
    prefix: "",
    unitType: "Flat",
    currentRent: 0,
    status: "Vacant",
    skipExisting: true,
  })
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number } | null>(null)

  // Advanced per-floor bulk add
  const UNIT_TYPES = ["Studio", "1 BHK", "2 BHK", "3 BHK", "Penthouse", "Shop", "Office", "Commercial"]
  const [mixedOpen, setMixedOpen] = useState(false)
  const [mixedStartFloor, setMixedStartFloor] = useState(1)
  const [mixedNumbering, setMixedNumbering] = useState<"floor-prefix" | "sequential">("floor-prefix")
  const [mixedFloors, setMixedFloors] = useState<Array<{
    floor: number
    types: Array<{ unitType: string; count: number; rent: number }>
  }>>([
    { floor: 1, types: [{ unitType: "3 BHK", count: 18, rent: 0 }, { unitType: "2 BHK", count: 10, rent: 0 }, { unitType: "Studio", count: 9, rent: 0 }] },
  ])
  const [mixedBusy, setMixedBusy] = useState(false)
  const [mixedPreview, setMixedPreview] = useState<{ total: number; conflicts: number; preview: Array<{ unitNo: string; unitType: string; floor: number; conflict: boolean }> } | null>(null)
  const [mixedResult, setMixedResult] = useState<{ created: number; skipped: number; failed: number } | null>(null)

  const mixedTotalUnits = mixedFloors.reduce((s, f) => s + f.types.reduce((ts, t) => ts + (t.count || 0), 0), 0)

  const addMixedFloor = () => {
    const next = (mixedFloors[mixedFloors.length - 1]?.floor ?? 0) + 1
    setMixedFloors([...mixedFloors, { floor: next, types: [{ unitType: "Studio", count: 1, rent: 0 }] }])
  }
  const removeMixedFloor = (idx: number) => setMixedFloors(mixedFloors.filter((_, i) => i !== idx))
  const addTypeRow = (floorIdx: number) => {
    const copy = [...mixedFloors]
    copy[floorIdx].types.push({ unitType: "Studio", count: 1, rent: 0 })
    setMixedFloors(copy)
  }
  const removeTypeRow = (floorIdx: number, typeIdx: number) => {
    const copy = [...mixedFloors]
    copy[floorIdx].types = copy[floorIdx].types.filter((_, i) => i !== typeIdx)
    setMixedFloors(copy)
  }
  const updateTypeRow = (floorIdx: number, typeIdx: number, field: "unitType" | "count" | "rent", value: string | number) => {
    const copy = [...mixedFloors]
    const row = copy[floorIdx].types[typeIdx]
    if (field === "unitType") row.unitType = String(value)
    else if (field === "count") row.count = parseInt(String(value), 10) || 0
    else row.rent = parseFloat(String(value)) || 0
    setMixedFloors(copy)
  }
  const runMixed = async (dryRun: boolean) => {
    setMixedBusy(true)
    setError("")
    try {
      const res = await fetch("/api/units/bulk-mixed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floors: mixedFloors,
          startFloor: mixedStartFloor,
          numbering: mixedNumbering,
          dryRun,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      if (dryRun) { setMixedPreview(data); setMixedResult(null) }
      else {
        setMixedResult({ created: data.created, skipped: data.skipped, failed: data.failed })
        setMixedPreview(null)
        fetchUnits()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setMixedBusy(false)
    }
  }
  const [form, setForm] = useState(defaultForm)
  const [editId, setEditId] = useState("")
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch("/api/units")
      if (!res.ok) throw new Error("Failed to fetch units")
      const data = await res.json()
      setUnits(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch("/api/tenants")
      if (res.ok) {
        const data = await res.json()
        setTenants(data.map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })))
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchUnits()
    fetchTenants()
  }, [fetchUnits, fetchTenants])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitNo: form.unitNo,
          unitType: form.unitType,
          sqFt: form.sqFt,
          contractStart: form.contractStart,
          contractEnd: form.contractEnd,
          currentRent: form.currentRent,
          status: form.status,
          notes: form.notes,
          tenantId: form.tenantId || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create unit")
      }
      setAddOpen(false)
      setForm(defaultForm)
      fetchUnits()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (unit: UnitRow) => {
    setEditId(unit.id)
    setForm({
      unitNo: unit.unitNo,
      unitType: unit.unitType,
      sqFt: unit.sqFt ? String(unit.sqFt) : "",
      contractStart: unit.contractStart,
      contractEnd: unit.contractEnd,
      currentRent: String(unit.currentRent),
      status: unit.status,
      notes: unit.notes,
      tenantId: unit.tenantId || "",
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/units/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitNo: form.unitNo,
          unitType: form.unitType,
          sqFt: form.sqFt,
          contractStart: form.contractStart,
          contractEnd: form.contractEnd,
          currentRent: form.currentRent,
          status: form.status,
          notes: form.notes,
          tenantId: form.tenantId || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update unit")
      }
      setEditOpen(false)
      setForm(defaultForm)
      fetchUnits()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (unit: UnitRow) => {
    const warn = unit.tenantId
      ? `⚠ WARNING — Unit ${unit.unitNo} has a tenant (${unit.tenant?.name || ""}). Deleting will also delete:\n• the tenant\n• their cheques\n• their invoices\n• their documents\n\nTo confirm, type the unit number:`
      : `Delete unit ${unit.unitNo}?\n\nType the unit number to confirm:`
    const typed = prompt(warn)
    if (typed !== unit.unitNo) {
      if (typed !== null) alert("Unit number didn't match. Delete cancelled.")
      return
    }
    try {
      const res = await fetch(`/api/units/${unit.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to delete unit")
      }
      fetchUnits()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const filteredUnits = units.filter((u) => {
    const statusOk = statusFilter === "all" || u.status === statusFilter
    const typeOk = typeFilter === "all" || u.unitType === typeFilter
    return statusOk && typeOk
  })

  const occupied = units.filter((u) => u.status === "Occupied").length
  const vacant = units.filter((u) => u.status === "Vacant").length
  const underMaintenance = units.filter((u) => u.status === "Under Maintenance").length
  const reserved = units.filter((u) => u.status === "Reserved").length
  const occupancy = units.length > 0
    ? Math.round((occupied / units.length) * 100)
    : 0

  const statusCounts: Record<string, number> = {
    all: units.length,
    Occupied: occupied,
    Vacant: vacant,
    "Under Maintenance": underMaintenance,
    Reserved: reserved,
  }

  const unitTypes = ["Studio", "1 BHK", "2 BHK", "3 BHK", "Penthouse", "Shop", "Office", "Commercial"]
  const unitsByStatus = statusFilter === "all" ? units : units.filter((u) => u.status === statusFilter)
  const typeCounts: Record<string, number> = { all: unitsByStatus.length }
  for (const t of unitTypes) {
    typeCounts[t] = unitsByStatus.filter((u) => u.unitType === t).length
  }

  const columns: Column<UnitRow>[] = [
    { key: "unitNo", header: "Unit No", sortable: true, filterable: true },
    { key: "unitType", header: "Type", sortable: true, filterable: true },
    {
      key: "tenant",
      header: "Tenant",
      filterable: true,
      filterValue: (row) => row.tenant?.name || "",
      render: (row) => row.tenant?.name || <span className="text-slate-600">--</span>,
    },
    {
      key: "currentRent",
      header: "Rent",
      sortable: true,
      filterable: true,
      filterValue: (row) => formatCurrency(row.currentRent),
      render: (row) => formatCurrency(row.currentRent),
    },
    {
      key: "contractStart",
      header: "Contract Start",
      filterable: true,
      filterValue: (row) => row.contractStart ? formatDate(row.contractStart) : "",
      render: (row) => row.contractStart ? formatDate(row.contractStart) : "--",
    },
    {
      key: "contractEnd",
      header: "Contract End",
      filterable: true,
      filterValue: (row) => row.contractEnd ? formatDate(row.contractEnd) : "",
      render: (row) => row.contractEnd ? formatDate(row.contractEnd) : "--",
    },
    {
      key: "status",
      header: "Status",
      filterable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(row) }}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row) }}
            className="rounded p-1.5 text-slate-400 hover:bg-red-900/50 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Unit No *</label>
          <input
            type="text"
            value={form.unitNo}
            onChange={(e) => setForm({ ...form, unitNo: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Unit Type</label>
          <select
            value={form.unitType}
            onChange={(e) => setForm({ ...form, unitType: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          >
            <option value="">Select type</option>
            <option value="Studio">Studio</option>
            <option value="1 BHK">1 BHK</option>
            <option value="2 BHK">2 BHK</option>
            <option value="3 BHK">3 BHK</option>
            <option value="Penthouse">Penthouse</option>
            <option value="Shop">Shop</option>
            <option value="Office">Office</option>
            <option value="Commercial">Commercial</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Square Feet</label>
        <input
          type="number"
          min="0"
          step="any"
          value={form.sqFt}
          onChange={(e) => setForm({ ...form, sqFt: e.target.value })}
          placeholder="e.g. 850"
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Contract Start</label>
          <input
            type="date"
            value={form.contractStart}
            onChange={(e) => setForm({ ...form, contractStart: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Contract End</label>
          <input
            type="date"
            value={form.contractEnd}
            onChange={(e) => setForm({ ...form, contractEnd: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Annual Rent (AED)</label>
          <input
            type="number"
            value={form.currentRent}
            onChange={(e) => setForm({ ...form, currentRent: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          >
            <option value="Vacant">Vacant</option>
            <option value="Occupied">Occupied</option>
            <option value="Under Maintenance">Under Maintenance</option>
            <option value="Reserved">Reserved</option>
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Tenant</label>
        <select
          value={form.tenantId}
          onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
        >
          <option value="">No tenant assigned</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
        />
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Unit Management</h1>
          <p className="mt-1 text-sm text-slate-400">Manage all property units</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setMixedOpen(true); setMixedPreview(null); setMixedResult(null) }}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            <Building2 className="h-4 w-4" /> Bulk Add (Per Floor)
          </button>
          <button
            onClick={() => setBulkOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Building2 className="h-4 w-4" /> Bulk Add Units
          </button>
          <button
            onClick={() => { setForm(defaultForm); setAddOpen(true) }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500"
          >
            <Plus className="h-4 w-4" /> Add Single Unit
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Units" value={units.length} color="blue" icon={<Building2 className="h-5 w-5" />} />
        <KpiCard label="Occupied" value={occupied} color="green" icon={<Users className="h-5 w-5" />} />
        <KpiCard label="Vacant" value={vacant} color="red" icon={<DoorOpen className="h-5 w-5" />} />
        <KpiCard label="Occupancy" value={`${occupancy}%`} color="gold" icon={<Percent className="h-5 w-5" />} />
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2">
        {["all", "Occupied", "Vacant", "Under Maintenance", "Reserved"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {s === "all" ? "All" : s}
            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                statusFilter === s ? "bg-amber-500/30" : "bg-slate-700"
              }`}
            >
              {statusCounts[s] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Unit Type Filter */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">By Type</p>
        <div className="flex flex-wrap gap-2">
          {["all", ...unitTypes].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {t === "all" ? "All Types" : t}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  typeFilter === t ? "bg-blue-500/30" : "bg-slate-700"
                }`}
              >
                {typeCounts[t] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredUnits}
        searchPlaceholder="Search units..."
        searchKeys={["unitNo", "unitType"]}
      />

      {/* Add Modal */}
      <Modal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Unit"
        description="Create a new property unit"
        footer={
          <>
            <ModalCancelButton />
            <ModalSaveButton onClick={handleAdd} disabled={saving || !form.unitNo}>
              {saving ? "Saving..." : "Save"}
            </ModalSaveButton>
          </>
        }
      >
        {formFields}
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Unit"
        description="Update unit details"
        footer={
          <>
            <ModalCancelButton />
            <ModalSaveButton onClick={handleEdit} disabled={saving || !form.unitNo}>
              {saving ? "Saving..." : "Update"}
            </ModalSaveButton>
          </>
        }
      >
        {formFields}
      </Modal>

      {/* Bulk Add Units Modal */}
      <Modal
        open={bulkOpen}
        onOpenChange={(v) => { setBulkOpen(v); if (!v) setBulkResult(null) }}
        title="Bulk Add Units"
        description="Quickly create multiple units across floors"
        size="lg"
        footer={
          <>
            <ModalCancelButton onClick={() => setBulkOpen(false)} />
            <ModalSaveButton
              onClick={async () => {
                setBulkBusy(true)
                setBulkResult(null)
                try {
                  const res = await fetch("/api/units/bulk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(bulkForm),
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error || "Bulk create failed")
                  setBulkResult({ created: data.created, skipped: data.skipped })
                  await fetchUnits()
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed")
                } finally {
                  setBulkBusy(false)
                }
              }}
              disabled={bulkBusy || bulkForm.floors < 1 || bulkForm.unitsPerFloor < 1}
            >
              {bulkBusy ? "Creating…" : `Create ${bulkForm.floors * bulkForm.unitsPerFloor} Units`}
            </ModalSaveButton>
          </>
        }
      >
        <div className="space-y-4 text-sm">
          {bulkResult ? (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-800">
              <p className="font-bold">✓ Done</p>
              <p>Created: {bulkResult.created} new units</p>
              {bulkResult.skipped > 0 && <p>Skipped: {bulkResult.skipped} (already existed)</p>}
            </div>
          ) : (
            <>
              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
                <strong>Example:</strong> 3 floors × 8 units/floor = 24 units<br/>
                With &quot;floor-prefix&quot; numbering: 101, 102, ... 108, 201, ... 308
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Floors</span>
                  <input type="number" min="1" max="200" value={bulkForm.floors}
                    onChange={(e) => setBulkForm({ ...bulkForm, floors: parseInt(e.target.value) || 1 })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Units per Floor</span>
                  <input type="number" min="1" max="500" value={bulkForm.unitsPerFloor}
                    onChange={(e) => setBulkForm({ ...bulkForm, unitsPerFloor: parseInt(e.target.value) || 1 })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Start Floor #</span>
                  <input type="number" min="1" value={bulkForm.startFloor}
                    onChange={(e) => setBulkForm({ ...bulkForm, startFloor: parseInt(e.target.value) || 1 })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Numbering</span>
                  <select value={bulkForm.numbering}
                    onChange={(e) => setBulkForm({ ...bulkForm, numbering: e.target.value as "floor-prefix" | "sequential" })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="floor-prefix">Floor + Number (101, 102…)</option>
                    <option value="sequential">Sequential (001, 002…)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Optional Prefix</span>
                  <input type="text" placeholder="e.g. A-" value={bulkForm.prefix}
                    onChange={(e) => setBulkForm({ ...bulkForm, prefix: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Unit Type</span>
                  <select value={bulkForm.unitType}
                    onChange={(e) => setBulkForm({ ...bulkForm, unitType: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option>Flat</option><option>Studio</option><option>1BR</option>
                    <option>2BR</option><option>3BR</option><option>4BR</option>
                    <option>Shop</option><option>Office</option><option>Warehouse</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Default Rent (AED/year)</span>
                  <input type="number" min="0" value={bulkForm.currentRent}
                    onChange={(e) => setBulkForm({ ...bulkForm, currentRent: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Default Status</span>
                  <select value={bulkForm.status}
                    onChange={(e) => setBulkForm({ ...bulkForm, status: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option>Vacant</option><option>Occupied</option><option>Reserved</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={bulkForm.skipExisting}
                  onChange={(e) => setBulkForm({ ...bulkForm, skipExisting: e.target.checked })}
                />
                Skip if unit number already exists (recommended)
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <strong>Will create:</strong> {bulkForm.floors * bulkForm.unitsPerFloor} units
                <br/>
                <strong>Sample numbers:</strong>{" "}
                {(() => {
                  const samples: string[] = []
                  let seq = 1
                  for (let f = bulkForm.startFloor; f < bulkForm.startFloor + bulkForm.floors && samples.length < 4; f++) {
                    for (let i = 1; i <= bulkForm.unitsPerFloor && samples.length < 4; i++) {
                      let n = bulkForm.numbering === "sequential"
                        ? String(seq++).padStart(3, "0")
                        : `${f}${String(i).padStart(2, "0")}`
                      if (bulkForm.prefix) n = `${bulkForm.prefix}${n}`
                      samples.push(n)
                    }
                  }
                  return samples.join(", ") + (bulkForm.floors * bulkForm.unitsPerFloor > 4 ? "…" : "")
                })()}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Bulk Add Per-Floor Modal */}
      <Modal
        open={mixedOpen}
        onOpenChange={(v) => { setMixedOpen(v); if (!v) { setMixedPreview(null); setMixedResult(null) } }}
        title="Bulk Add Units — Per Floor Breakdown"
        description="Define each floor's unit mix (e.g. Floor 1: 18 × 3 BHK + 10 × 2 BHK + 9 × Studio)"
        size="lg"
        footer={
          <>
            <ModalCancelButton onClick={() => setMixedOpen(false)} />
            {!mixedPreview && !mixedResult && (
              <ModalSaveButton onClick={() => runMixed(true)} disabled={mixedBusy || mixedTotalUnits === 0}>
                {mixedBusy ? "Analyzing..." : `Preview ${mixedTotalUnits} units`}
              </ModalSaveButton>
            )}
            {mixedPreview && !mixedResult && (
              <ModalSaveButton onClick={() => runMixed(false)} disabled={mixedBusy}>
                {mixedBusy ? "Creating..." : `Create ${mixedPreview.total - mixedPreview.conflicts} new units`}
              </ModalSaveButton>
            )}
          </>
        }
      >
        <div className="space-y-4 text-sm">
          {mixedResult && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-800">
              <p className="font-bold">✓ Done</p>
              <p>Created: {mixedResult.created}</p>
              {mixedResult.skipped > 0 && <p>Skipped: {mixedResult.skipped}</p>}
              {mixedResult.failed > 0 && <p className="text-red-700">Failed: {mixedResult.failed}</p>}
            </div>
          )}

          {!mixedResult && (
            <>
              {/* Global settings */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Start Floor #</span>
                  <input
                    type="number" min="0"
                    value={mixedStartFloor}
                    onChange={(e) => setMixedStartFloor(parseInt(e.target.value) || 1)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Numbering</span>
                  <select
                    value={mixedNumbering}
                    onChange={(e) => setMixedNumbering(e.target.value as "floor-prefix" | "sequential")}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-white"
                  >
                    <option value="floor-prefix">Floor + Number (101, 102…)</option>
                    <option value="sequential">Sequential (001, 002…)</option>
                  </select>
                </label>
              </div>

              {/* Per-floor blocks */}
              {mixedFloors.map((f, fIdx) => (
                <div key={fIdx} className="rounded-lg border border-slate-300 bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">Floor</span>
                      <input
                        type="number" min="0"
                        value={f.floor}
                        onChange={(e) => {
                          const copy = [...mixedFloors]
                          copy[fIdx].floor = parseInt(e.target.value) || 0
                          setMixedFloors(copy)
                        }}
                        className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 bg-white"
                      />
                      <span className="text-xs text-slate-600">
                        ({f.types.reduce((s, t) => s + t.count, 0)} units)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMixedFloor(fIdx)}
                      className="text-xs text-red-600 hover:underline"
                    >Remove floor</button>
                  </div>

                  <table className="w-full text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="text-left py-1">Unit Type</th>
                        <th className="text-left py-1 w-20">Count</th>
                        <th className="text-left py-1 w-28">Rent (AED)</th>
                        <th className="w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.types.map((t, tIdx) => (
                        <tr key={tIdx}>
                          <td className="py-1 pr-2">
                            <select
                              value={t.unitType}
                              onChange={(e) => updateTypeRow(fIdx, tIdx, "unitType", e.target.value)}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-slate-900 bg-white"
                            >
                              {UNIT_TYPES.map((ut) => <option key={ut}>{ut}</option>)}
                            </select>
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="number" min="0"
                              value={t.count}
                              onChange={(e) => updateTypeRow(fIdx, tIdx, "count", e.target.value)}
                              className="w-full rounded border border-slate-300 px-2 py-1 text-slate-900 bg-white"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="number" min="0"
                              value={t.rent}
                              onChange={(e) => updateTypeRow(fIdx, tIdx, "rent", e.target.value)}
                              placeholder="0"
                              className="w-full rounded border border-slate-300 px-2 py-1 text-slate-900 bg-white"
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeTypeRow(fIdx, tIdx)}
                              className="text-red-600 hover:text-red-800 text-base"
                              title="Remove"
                            >×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    type="button"
                    onClick={() => addTypeRow(fIdx)}
                    className="text-xs text-blue-600 hover:underline"
                  >+ Add another type to floor {f.floor}</button>
                </div>
              ))}

              <button
                type="button"
                onClick={addMixedFloor}
                className="w-full rounded-lg border-2 border-dashed border-slate-300 py-2 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600"
              >+ Add another floor</button>

              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
                <strong>Total units to create:</strong> {mixedTotalUnits}<br />
                <strong>Floors:</strong> {mixedFloors.length}
              </div>
            </>
          )}

          {mixedPreview && !mixedResult && (
            <div className="rounded-lg border border-slate-300 bg-white p-3 max-h-64 overflow-y-auto">
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Preview: {mixedPreview.total} units
                {mixedPreview.conflicts > 0 && <span className="text-red-600"> · {mixedPreview.conflicts} conflicts (will skip)</span>}
              </p>
              <table className="w-full text-xs">
                <thead className="text-slate-500">
                  <tr><th className="text-left">Unit</th><th className="text-left">Type</th><th className="text-left">Floor</th><th className="text-left">Status</th></tr>
                </thead>
                <tbody>
                  {mixedPreview.preview.slice(0, 100).map((p, i) => (
                    <tr key={i}><td className="py-0.5 font-mono">{p.unitNo}</td><td>{p.unitType}</td><td>{p.floor}</td><td>{p.conflict ? <span className="text-red-600">exists</span> : <span className="text-green-600">new</span>}</td></tr>
                  ))}
                </tbody>
              </table>
              {mixedPreview.preview.length < mixedPreview.total && (
                <p className="text-[10px] text-slate-500 mt-2">... and {mixedPreview.total - mixedPreview.preview.length} more</p>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
