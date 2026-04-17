"use client"

import { useState, useEffect, useCallback } from "react"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { formatDate } from "@/lib/utils"
import { Users, Plus, Pencil, Trash2, Shield } from "lucide-react"

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  [key: string]: unknown
}

const defaultForm = {
  name: "",
  email: "",
  password: "",
  role: "staff",
}

const defaultEditForm = {
  name: "",
  email: "",
  role: "",
  isActive: true,
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [editForm, setEditForm] = useState(defaultEditForm)
  const [editId, setEditId] = useState("")
  const [saving, setSaving] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users")
      if (!res.ok) {
        if (res.status === 403) {
          setError("Admin access required to view users")
          return
        }
        throw new Error("Failed to fetch users")
      }
      setUsers(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setAddOpen(false)
      setForm(defaultForm)
      fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (u: UserRow) => {
    setEditId(u.id)
    setEditForm({
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      setEditOpen(false)
      fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`Delete user ${u.name}? This action cannot be undone.`)) return
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const columns: Column<UserRow>[] = [
    { key: "name", header: "Name", sortable: true },
    { key: "email", header: "Email", sortable: true },
    {
      key: "role",
      header: "Role",
      render: (r) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300">
          {r.role === "admin" && <Shield className="h-3 w-3 text-amber-400" />}
          {r.role.charAt(0).toUpperCase() + r.role.slice(1)}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      render: (r) => <StatusBadge status={r.isActive ? "Active" : "Inactive"} />,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r) }} className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(r) }} className="rounded p-1.5 text-slate-400 hover:bg-red-900/50 hover:text-red-400">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ]

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-amber-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="mt-1 text-sm text-slate-400">{users.length} users</p>
          </div>
        </div>
        <button onClick={() => { setForm(defaultForm); setAddOpen(true) }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500">
          <Plus className="h-4 w-4" /> Add User
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      <DataTable columns={columns} data={users} searchPlaceholder="Search users..." searchKeys={["name", "email", "role"]} />

      {/* Add User Modal */}
      <Modal open={addOpen} onOpenChange={setAddOpen} title="Add User" description="Create a new staff account"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.name || !form.email || !form.password}>{saving ? "Creating..." : "Create"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Password *</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="accountant">Accountant</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={editOpen} onOpenChange={setEditOpen} title="Edit User"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleEdit} disabled={saving || !editForm.name || !editForm.email}>{saving ? "Saving..." : "Update"}</ModalSaveButton></>}>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Name</label>
            <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
            <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Role</label>
            <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50">
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="accountant">Accountant</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} className="rounded border-slate-600" />
              Active
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
