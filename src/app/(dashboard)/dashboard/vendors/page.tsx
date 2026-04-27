"use client"

import { useState, useEffect, useCallback } from "react"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Building2, Plus, Pencil, Trash2, Star } from "lucide-react"
import { UaePhoneInput } from "@/components/ui/uae-phone-input"

interface VendorRow {
  id: string
  companyName: string
  contactPerson: string
  phone: string
  landline: string
  email: string
  tradeLicenseNo: string
  tradeLicenseExpiry: string
  address: string
  status: string
  isPreferred: boolean
  categories: string
  categoriesList: string[]
  paymentMethods: string
  notes: string
  [key: string]: unknown
}

interface WorkOrderRow {
  id: string
  workOrderNo: string
  vendor: { id: string; companyName: string } | null
  ticket: { id: string; ticketNo: string; title: string; tenant?: { name: string } | null; unit?: { unitNo: string } | null } | null
  scopeOfWork: string
  startDate: string
  expectedCompletion: string
  estimatedAmount: number
  actualAmount: number
  status: string
  [key: string]: unknown
}

const defaultForm = {
  companyName: "",
  contactPerson: "",
  phone: "",
  landline: "",
  email: "",
  tradeLicenseNo: "",
  tradeLicenseExpiry: "",
  address: "",
  status: "Active",
  isPreferred: false,
  categories: "",
  // CSV string of accepted payment methods (Cash / Cheque / BankTransfer).
  // Default to Cash so the "at least one" rule is satisfied for new rows.
  paymentMethods: "Cash",
  notes: "",
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [editId, setEditId] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [vRes, woRes] = await Promise.all([fetch("/api/vendors"), fetch("/api/vendors/work-orders")])
      if (!vRes.ok) throw new Error("Failed to fetch vendors")
      setVendors(await vRes.json())
      if (woRes.ok) setWorkOrders(await woRes.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setAddOpen(false)
      setForm(defaultForm)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (v: VendorRow) => {
    setEditId(v.id)
    setForm({
      companyName: v.companyName,
      contactPerson: v.contactPerson,
      phone: v.phone,
      landline: v.landline || "",
      email: v.email,
      tradeLicenseNo: v.tradeLicenseNo,
      tradeLicenseExpiry: v.tradeLicenseExpiry,
      address: v.address,
      status: v.status,
      isPreferred: v.isPreferred,
      categories: v.categories,
      paymentMethods: v.paymentMethods || "Cash",
      notes: v.notes,
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/vendors/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setEditOpen(false)
      setForm(defaultForm)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (v: VendorRow) => {
    if (!confirm(`Delete vendor ${v.companyName}?`)) return
    try {
      const res = await fetch(`/api/vendors/${v.id}`, { method: "DELETE" })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const vendorColumns: Column<VendorRow>[] = [
    { key: "companyName", header: "Company", sortable: true },
    { key: "contactPerson", header: "Contact" },
    { key: "phone", header: "Phone" },
    { key: "email", header: "Email" },
    {
      key: "categories",
      header: "Categories",
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.categoriesList.map((c, i) => (
            <span key={i} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{c}</span>
          ))}
        </div>
      ),
    },
    { key: "tradeLicenseExpiry", header: "License Expiry", render: (r) => r.tradeLicenseExpiry ? formatDate(r.tradeLicenseExpiry) : "--" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "isPreferred",
      header: "Preferred",
      render: (r) => r.isPreferred ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> : <span className="text-slate-600">--</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r) }} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"><Pencil className="h-4 w-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(r) }} className="rounded p-1.5 text-slate-400 hover:bg-red-900/50 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
        </div>
      ),
    },
  ]

  const woColumns: Column<WorkOrderRow>[] = [
    { key: "workOrderNo", header: "WO #", sortable: true },
    { key: "vendor", header: "Vendor", render: (r) => r.vendor?.companyName || "--" },
    { key: "ticket", header: "Ticket", render: (r) => r.ticket?.ticketNo || "--" },
    { key: "scopeOfWork", header: "Scope" },
    { key: "estimatedAmount", header: "Est. Amount", render: (r) => formatCurrency(r.estimatedAmount) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "startDate", header: "Start", render: (r) => r.startDate ? formatDate(r.startDate) : "--" },
  ]

  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Company Name *</label>
          <input type="text" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Contact Person</label>
          <input type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Mobile</label>
          <UaePhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Landline <span className="text-slate-500">(optional)</span></label>
          <input
            type="tel"
            value={form.landline}
            onChange={(e) => setForm({ ...form, landline: e.target.value })}
            placeholder="04 1234567"
            inputMode="tel"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Accepted Payment Methods <span className="text-red-400">*</span>
        </label>
        <div className="flex flex-wrap gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-3">
          {([
            { val: "Cash", label: "💵 Cash" },
            { val: "Cheque", label: "📝 Cheque" },
            { val: "BankTransfer", label: "🏦 Bank Transfer" },
          ] as const).map(({ val, label }) => {
            const set = new Set((form.paymentMethods || "").split(",").map((s) => s.trim()).filter(Boolean))
            const checked = set.has(val)
            return (
              <label key={val} className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = new Set(set)
                    if (e.target.checked) next.add(val); else next.delete(val)
                    setForm({ ...form, paymentMethods: Array.from(next).join(",") })
                  }}
                />
                {label}
              </label>
            )
          })}
        </div>
        {!form.paymentMethods.trim() && (
          <p className="mt-1 text-[10px] text-amber-400">Required — pick at least one method.</p>
        )}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Categories (comma separated)</label>
        <input type="text" value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })} placeholder="Plumbing, Electrical, HVAC" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Trade License No</label>
          <input type="text" value={form.tradeLicenseNo} onChange={(e) => setForm({ ...form, tradeLicenseNo: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">License Expiry</label>
          <input type="date" value={form.tradeLicenseExpiry} onChange={(e) => setForm({ ...form, tradeLicenseExpiry: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.isPreferred} onChange={(e) => setForm({ ...form, isPreferred: e.target.checked })} className="rounded border-slate-600" />
            Preferred Vendor
          </label>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
      </div>
    </div>
  )

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Vendors</h1>
          <p className="mt-1 text-sm text-slate-400">{vendors.length} vendors registered</p>
        </div>
        <button onClick={() => { setForm(defaultForm); setAddOpen(true) }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500">
          <Plus className="h-4 w-4" /> Add Vendor
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      <DataTable columns={vendorColumns} data={vendors} searchPlaceholder="Search vendors..." searchKeys={["companyName", "contactPerson", "categories"]} />

      {workOrders.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-white">Work Orders</h2>
          <DataTable columns={woColumns} data={workOrders} searchPlaceholder="Search work orders..." searchKeys={["workOrderNo", "scopeOfWork"]} />
        </div>
      )}

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Add Vendor" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.companyName || !form.paymentMethods.trim()}>{saving ? "Saving..." : "Save"}</ModalSaveButton></>}>
        {formFields}
      </Modal>

      <Modal open={editOpen} onOpenChange={setEditOpen} title="Edit Vendor" size="lg"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleEdit} disabled={saving || !form.companyName || !form.paymentMethods.trim()}>{saving ? "Saving..." : "Update"}</ModalSaveButton></>}>
        {formFields}
      </Modal>
    </div>
  )
}
