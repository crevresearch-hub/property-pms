"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { Modal, ModalCancelButton, ModalSaveButton } from "@/components/ui/modal"
import { HelpPanel } from "@/components/ui/help-panel"
import { formatCurrency, formatDate } from "@/lib/utils"
import { UaePhoneInput } from "@/components/ui/uae-phone-input"
import { UaeBankInput } from "@/components/ui/uae-bank-input"
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  FileSignature,
  Upload,
  Download,
  ExternalLink,
  KeyRound,
  Mail,
  Copy,
  Ban,
} from "lucide-react"

interface TenantRow {
  id: string
  name: string
  phone: string
  email: string
  emiratesId: string
  passportNo: string
  nationality: string
  emergencyContactName: string
  emergencyContactPhone: string
  status: string
  notes: string
  visaNo: string
  visaExpiry: string
  emiratesIdExpiry: string
  passportExpiry: string
  occupation: string
  employer: string
  familySize: number
  isCompany: boolean
  companyName: string
  companyTradeLicense: string
  companyTradeLicenseExpiry: string
  signatoryName: string
  signatoryTitle: string
  units: { id: string; unitNo: string; unitType: string; status: string; currentRent: number; contractStart?: string; contractEnd?: string; sqFt?: number; notes?: string }[]
  reservedUnitNo: string
  documents: { id: string; docType: string }[]
  has_ejari: boolean
  has_cheque: boolean
  has_eid: boolean
  [key: string]: unknown
}

interface UnitOption {
  id: string
  unitNo: string
  unitType: string
  currentRent: number
  status: string
}

interface OwnerOption {
  id: string
  ownerName: string
  buildingName: string
}

interface ContractRow {
  id: string
  contractNo: string
  version: number
  status: string
  contractStart: string
  contractEnd: string
  rentAmount: number
  contractType: string
  signedFilePath: string
  signedFileName: string
  signatureToken?: string
  createdAt: string
}

const defaultForm = {
  name: "",
  phone: "",
  email: "",
  emiratesId: "",
  passportNo: "",
  nationality: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  status: "Active",
  notes: "",
  unitId: "",
  visaNo: "",
  visaExpiry: "",
  emiratesIdExpiry: "",
  passportExpiry: "",
  occupation: "",
  employer: "",
  familySize: 1,
  isCompany: false,
  companyName: "",
  companyTradeLicense: "",
  companyTradeLicenseExpiry: "",
  signatoryName: "",
  signatoryTitle: "",
}

const defaultContractForm = {
  unitId: "",
  ownerId: "",
  contractStart: "",
  contractEnd: "",
  rentAmount: 0,
  rentInWords: "",
  numberOfCheques: 4,
  securityDeposit: 0,
  bookingAmount: 0,
  contractType: "Residential",
  purpose: "Family residence",
  commissionFee: 0,
  ejariFee: 250,
  municipalityFee: 0,
  reason: "Initial",
}

export default function TenantsPage() {
  const { data: session } = useSession()
  // Developer status — dev-login identity OR the dev_unlocked cookie set by
  // /dashboard/developer's password unlock. Either grants delete + bypass.
  const [devUnlocked, setDevUnlocked] = useState(false)
  useEffect(() => {
    const v = typeof document !== "undefined" && document.cookie
      .split(";").some((c) => c.trim().startsWith("dev_unlocked=1"))
    setDevUnlocked(v)
  }, [])
  const isDeveloper =
    session?.user?.id === "admin-dev" ||
    session?.user?.email === "admin@cre.ae" ||
    devUnlocked
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [vacantUnits, setVacantUnits] = useState<UnitOption[]>([])
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const [portalTenant, setPortalTenant] = useState<TenantRow | null>(null)
  const [portalBusy, setPortalBusy] = useState(false)
  const [portalMsg, setPortalMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [portalTempPwd, setPortalTempPwd] = useState<string>("")
  const [termOpen, setTermOpen] = useState(false)
  const [termTenant, setTermTenant] = useState<TenantRow | null>(null)
  const [termReason, setTermReason] = useState("")
  const [termEffectiveDate, setTermEffectiveDate] = useState("")
  const [termProof, setTermProof] = useState<File | null>(null)
  const [termConfirm, setTermConfirm] = useState(false)
  const [termBusy, setTermBusy] = useState(false)
  const [termError, setTermError] = useState("")
  // Extended termination flow per spec — type chooses the date semantics:
  //   BreakLease  : DEWA closing date + rent-calc date (auto = DEWA + 2 months
  //                 unless the user overrides — that 2-month gap is the
  //                 break-lease penalty window).
  //   NonRenewal  : DEWA closing date + rent-calc date (kept equal — no
  //                 penalty).
  // Both types require a DEWA Clearance + FMR Report upload.
  const [termType, setTermType] = useState<"" | "BreakLease" | "NonRenewal">("")
  const [termDewaDate, setTermDewaDate] = useState("")
  const [termRentCalcDate, setTermRentCalcDate] = useState("")
  const [termDewaDoc, setTermDewaDoc] = useState<File | null>(null)
  const [termFmrDoc, setTermFmrDoc] = useState<File | null>(null)
  const [termAquaDoc, setTermAquaDoc] = useState<File | null>(null)
  const [contractOpen, setContractOpen] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [contractForm, setContractForm] = useState(defaultContractForm)
  const [contractYears, setContractYears] = useState(1)
  const [editId, setEditId] = useState("")
  const [detailTenant, setDetailTenant] = useState<TenantRow | null>(null)
  const [tenantContracts, setTenantContracts] = useState<ContractRow[]>([])
  const [tenantCheques, setTenantCheques] = useState<Array<{ id: string; sequenceNo: number; chequeNo: string; bankName: string; chequeDate: string; amount: number; status: string; paymentType: string }>>([])
  const [activeTenant, setActiveTenant] = useState<TenantRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [preBookOpen, setPreBookOpen] = useState(false)
  const [preBookForm, setPreBookForm] = useState({
    name: "",
    phone: "",
    email: "",
    unitId: "",
    usage: "Residential" as "Residential" | "Commercial",
    expectedMoveIn: "",
    preBookingDeposit: "",
    paymentMethod: "Cash" as "Cash" | "Cheque",
    chequeNo: "",
    chequeDate: "",
    bankName: "",
    notes: "",
  })
  const [preBookBusy, setPreBookBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [nationalityFilter, setNationalityFilter] = useState<string>("all")
  const [docsFilter, setDocsFilter] = useState<"all" | "all-docs" | "missing-ejari" | "missing-eid" | "missing-cheque" | "no-docs">("all")

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch("/api/tenants")
      if (!res.ok) throw new Error("Failed to fetch tenants")
      setTenants(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch("/api/units")
      if (res.ok) {
        const data: UnitOption[] = await res.json()
        setUnits(data)
        setVacantUnits(data.filter((u) => u.status === "Vacant"))
      }
    } catch {}
  }, [])

  const fetchOwners = useCallback(async () => {
    try {
      const res = await fetch("/api/owners")
      if (res.ok) {
        const data = await res.json()
        const list: OwnerOption[] = Array.isArray(data) ? data : data.owners || []
        setOwners(list)
      }
    } catch {}
  }, [])

  const fetchTenantContracts = useCallback(async (tenantId: string) => {
    try {
      const res = await fetch(`/api/tenants/${tenantId}/tenancy-contracts`)
      if (!res.ok) return
      const data = await res.json()
      setTenantContracts(data.contracts || [])
    } catch {}
  }, [])

  useEffect(() => {
    fetchTenants()
    fetchUnits()
    fetchOwners()
  }, [fetchTenants, fetchUnits, fetchOwners])

  const handleAdd = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create tenant")
      }
      setAddOpen(false)
      setForm(defaultForm)
      fetchTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (t: TenantRow) => {
    setEditId(t.id)
    setForm({
      name: t.name,
      phone: t.phone,
      email: t.email,
      emiratesId: t.emiratesId,
      passportNo: t.passportNo,
      nationality: t.nationality,
      emergencyContactName: t.emergencyContactName,
      emergencyContactPhone: t.emergencyContactPhone,
      status: t.status,
      notes: t.notes,
      unitId: "",
      visaNo: t.visaNo || "",
      visaExpiry: t.visaExpiry || "",
      emiratesIdExpiry: t.emiratesIdExpiry || "",
      passportExpiry: t.passportExpiry || "",
      occupation: t.occupation || "",
      employer: t.employer || "",
      familySize: t.familySize || 1,
      isCompany: Boolean(t.isCompany),
      companyName: t.companyName || "",
      companyTradeLicense: t.companyTradeLicense || "",
      companyTradeLicenseExpiry: t.companyTradeLicenseExpiry || "",
      signatoryName: t.signatoryName || "",
      signatoryTitle: t.signatoryTitle || "",
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    setSaving(true)
    try {
      const { unitId: _u, ...rest } = form
      const res = await fetch(`/api/tenants/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rest),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to update tenant")
      }
      setEditOpen(false)
      setForm(defaultForm)
      fetchTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t: TenantRow) => {
    const confirmName = t.name.split(' ')[0] // first name only, easier to type
    const warn = `⚠ WARNING — Deleting tenant "${t.name}" will also delete:\n• Their cheques\n• Their invoices\n• Their documents (Emirates ID, Ejari, cheques PDFs)\n• Their maintenance tickets, complaints, violations\n\nThis CANNOT be undone.\n\nTo confirm, type the first name: "${confirmName}"`
    const typed = prompt(warn)
    if (typed !== confirmName) {
      if (typed !== null) alert("Name didn't match. Delete cancelled.")
      return
    }
    try {
      const res = await fetch(`/api/tenants/${t.id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to delete tenant")
      }
      fetchTenants()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const openGenerate = (t: TenantRow) => {
    setActiveTenant(t)
    const firstUnit = t.units[0]
    const matchedUnit = firstUnit ? units.find((u) => u.id === firstUnit.id) : undefined
    const rent = matchedUnit?.currentRent || firstUnit?.currentRent || 0
    const isResidential = (matchedUnit?.unitType || "Residential").toLowerCase().includes("commercial")
      ? false
      : true
    const contractType = isResidential ? "Residential" : "Commercial"
    const security = (isResidential ? 0.05 : 0.1) * rent
    const commission = Math.max((isResidential ? 0.05 : 0.1) * rent, 1050)
    setContractForm({
      ...defaultContractForm,
      unitId: firstUnit?.id || "",
      contractType,
      rentAmount: rent,
      securityDeposit: security,
      commissionFee: commission,
    })
    setContractOpen(true)
  }

  const openTerminate = (t: TenantRow) => {
    setTermTenant(t)
    setTermReason("")
    setTermEffectiveDate(new Date().toISOString().slice(0, 10))
    setTermProof(null)
    setTermConfirm(false)
    setTermError("")
    setTermType("")
    setTermDewaDate("")
    setTermRentCalcDate("")
    setTermDewaDoc(null)
    setTermFmrDoc(null)
    setTermAquaDoc(null)
    setTermOpen(true)
  }

  // Auto-derive the rent-calc date whenever DEWA date / type changes.
  // BreakLease → DEWA + 2 months (the penalty window).
  // NonRenewal → DEWA closing date itself.
  // The user can still override by typing in the rent-calc field directly.
  useEffect(() => {
    if (!termDewaDate || !termType) return
    const d = new Date(termDewaDate)
    if (Number.isNaN(d.getTime())) return
    if (termType === "BreakLease") {
      d.setMonth(d.getMonth() + 2)
      setTermRentCalcDate(d.toISOString().slice(0, 10))
    } else if (termType === "NonRenewal") {
      setTermRentCalcDate(termDewaDate)
    }
  }, [termDewaDate, termType])

  const submitTerminate = async () => {
    if (!termTenant) return
    setTermError("")
    if (termReason.trim().length < 3) {
      setTermError("Please enter a reason for termination.")
      return
    }
    if (!termType) { setTermError("Please choose a termination type."); return }
    if (!termDewaDate) { setTermError("DEWA closing date is required."); return }
    if (!termRentCalcDate) { setTermError("Rent calculation date is required."); return }
    if (!termDewaDoc) { setTermError("DEWA Clearance document is required."); return }
    if (!termFmrDoc) { setTermError("FMR Report is required."); return }
    if (!termAquaDoc) { setTermError("Aqua Cool clearance is required."); return }
    if (!termConfirm) {
      setTermError("Please tick the confirmation box to proceed.")
      return
    }
    setTermBusy(true)
    try {
      const fd = new FormData()
      fd.append("reason", termReason.trim())
      fd.append("effectiveDate", termEffectiveDate)
      fd.append("terminationType", termType)
      fd.append("dewaClosingDate", termDewaDate)
      fd.append("rentCalcDate", termRentCalcDate)
      if (termProof) fd.append("proof", termProof)
      fd.append("dewaClearance", termDewaDoc)
      fd.append("fmrReport", termFmrDoc)
      fd.append("aquaCool", termAquaDoc)
      const res = await fetch(`/api/tenants/${termTenant.id}/terminate`, {
        method: "POST",
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to terminate")
      setTermOpen(false)
      await fetchTenants()
    } catch (e) {
      setTermError(e instanceof Error ? e.message : "Failed to terminate")
    } finally {
      setTermBusy(false)
    }
  }

  const openPortal = (t: TenantRow) => {
    setPortalTenant(t)
    setPortalMsg(null)
    setPortalTempPwd("")
    setPortalOpen(true)
  }

  const resetTenantPassword = async (sendEmail: boolean) => {
    if (!portalTenant) return
    setPortalBusy(true)
    setPortalMsg(null)
    setPortalTempPwd("")
    try {
      const res = await fetch(`/api/tenants/${portalTenant.id}/portal-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true, sendEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      if (data.password) setPortalTempPwd(data.password)
      setPortalMsg({
        text: sendEmail
          ? "New password generated and emailed to the tenant."
          : "New password generated. Copy it now — it won’t be shown again.",
        ok: true,
      })
      await fetchTenants()
    } catch (e) {
      setPortalMsg({ text: e instanceof Error ? e.message : "Failed", ok: false })
    } finally {
      setPortalBusy(false)
    }
  }

  const disableTenantPortal = async () => {
    if (!portalTenant) return
    if (!confirm(`Disable portal login for ${portalTenant.name}? They won't be able to sign in until you issue a new password.`)) return
    setPortalBusy(true)
    setPortalMsg(null)
    try {
      const res = await fetch(`/api/tenants/${portalTenant.id}/portal-password`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      setPortalMsg({ text: "Portal login disabled for this tenant.", ok: true })
      await fetchTenants()
    } catch (e) {
      setPortalMsg({ text: e instanceof Error ? e.message : "Failed", ok: false })
    } finally {
      setPortalBusy(false)
    }
  }

  const openDetail = async (t: TenantRow) => {
    setDetailTenant(t)
    setDetailOpen(true)
    setTenantCheques([])
    await fetchTenantContracts(t.id)
    try {
      const r = await fetch(`/api/cheques?tenant_id=${t.id}`)
      const data = await r.json()
      setTenantCheques(Array.isArray(data) ? data : (data.cheques || []))
    } catch { /* ignore */ }
  }

  const handleGenerate = async () => {
    if (!activeTenant) return
    setSaving(true)
    try {
      const res = await fetch(`/api/tenants/${activeTenant.id}/tenancy-contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contractForm),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to generate contract")
      }
      const data = await res.json()
      setContractOpen(false)
      window.open(`/api/tenancy-contracts/${data.contract.id}?format=html`, "_blank")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setSaving(false)
    }
  }

  const handleContractAction = async (
    contract: ContractRow,
    action: "send" | "sign" | "cancel" | "terminate"
  ) => {
    if (action === "cancel" && !confirm(`Cancel ${contract.contractNo}?`)) return
    if (action === "terminate" && !confirm(`Terminate ${contract.contractNo}?`)) return
    try {
      const res = await fetch(`/api/tenancy-contracts/${contract.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed")
      }
      if (detailTenant) await fetchTenantContracts(detailTenant.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const handleUploadSigned = async (contract: ContractRow) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".pdf,.jpg,.jpeg,.png"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const fd = new FormData()
      fd.append("file", file)
      try {
        const res = await fetch(`/api/tenancy-contracts/${contract.id}/upload`, {
          method: "POST",
          body: fd,
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Upload failed")
        }
        if (detailTenant) await fetchTenantContracts(detailTenant.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload error")
      }
    }
    input.click()
  }

  const DocBadge = ({ has, label }: { has: boolean; label: string }) => (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        has
          ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30"
          : "bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30"
      }`}
    >
      {has ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  )

  const columns: Column<TenantRow>[] = [
    { key: "name", header: "Name", sortable: true, filterable: true },
    { key: "phone", header: "Phone", filterable: true },
    { key: "email", header: "Email", filterable: true },
    {
      key: "units",
      header: "Unit",
      sortable: true,
      filterable: true,
      filterValue: (row) => [...row.units.map((u) => u.unitNo), row.reservedUnitNo].filter(Boolean).join(", "),
      render: (row) => {
        if (row.units.length > 0) return row.units.map((u) => u.unitNo).join(", ")
        if (row.reservedUnitNo) {
          return (
            <span className="inline-flex items-center gap-1">
              <span className="font-mono">{row.reservedUnitNo}</span>
              <span className="rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-blue-400 ring-1 ring-blue-500/30">📌 Reserved</span>
            </span>
          )
        }
        return <span className="text-slate-600">--</span>
      },
    },
    {
      key: "unitType",
      header: "Type",
      filterable: true,
      filterValue: (row) => row.units.map((u) => u.unitType).filter(Boolean).join(", "),
      render: (row) =>
        row.units.length > 0 && row.units[0].unitType
          ? row.units.map((u) => u.unitType).filter(Boolean).join(", ")
          : <span className="text-slate-600">--</span>,
    },
    {
      key: "contractStart",
      header: "Contract Start",
      filterable: true,
      filterValue: (row) => row.units.map((u) => u.contractStart || "").filter(Boolean).join(", "),
      render: (row) => {
        const d = row.units[0]?.contractStart
        return d ? <span className="whitespace-nowrap text-slate-300">{formatDate(d)}</span> : <span className="text-slate-600">—</span>
      },
    },
    {
      key: "contractEnd",
      header: "Contract End",
      filterable: true,
      filterValue: (row) => row.units.map((u) => u.contractEnd || "").filter(Boolean).join(", "),
      render: (row) => {
        const d = row.units[0]?.contractEnd
        if (!d) return <span className="text-slate-600">—</span>
        const today = new Date()
        const end = new Date(d)
        const days = Math.floor((end.getTime() - today.getTime()) / 86400000)
        const color = days < 0 ? "text-red-400" : days <= 30 ? "text-amber-400" : days <= 90 ? "text-blue-300" : "text-slate-300"
        return <span className={`whitespace-nowrap ${color}`}>{formatDate(d)}</span>
      },
    },
    { key: "nationality", header: "Nationality", filterable: true },
    { key: "emiratesId", header: "Emirates ID", filterable: true },
    {
      key: "status",
      header: "Status",
      filterable: true,
      render: (row) => (
        <StatusBadge status={row.status === "Pending" ? "Emailed to Client" : row.status} />
      ),
    },
    {
      key: "docs",
      header: "Docs",
      render: (row) => (
        <div className="flex gap-1">
          <DocBadge has={row.has_ejari} label="Ejari" />
          <DocBadge has={row.has_cheque} label="Chq" />
          <DocBadge has={row.has_eid} label="EID" />
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-1">
          <button
            title="View"
            onClick={(e) => { e.stopPropagation(); openDetail(row) }}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Eye className="h-4 w-4" />
          </button>
          <Link
            href={`/dashboard/tenants/${row.id}/edit`}
            title="Edit"
            onClick={(e) => e.stopPropagation()}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          {row.status === "Active" && (
            <button
              title="Tenant Portal"
              onClick={(e) => { e.stopPropagation(); openPortal(row) }}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-amber-400"
            >
              <KeyRound className="h-4 w-4" />
            </button>
          )}
          {row.status === "Active" && (
            <button
              title="Terminate Contract"
              onClick={(e) => { e.stopPropagation(); openTerminate(row) }}
              className="rounded p-1.5 text-slate-400 hover:bg-red-900/50 hover:text-red-400"
            >
              <Ban className="h-4 w-4" />
            </button>
          )}
          {/* Hard-delete is developer-only. Non-developer users use the
              Terminate button above for the proper end-of-tenancy workflow. */}
          {isDeveloper && (
            <button
              title="Delete (developer only)"
              onClick={(e) => { e.stopPropagation(); handleDelete(row) }}
              className="rounded p-1.5 text-slate-400 hover:bg-red-900/50 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ]

  const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
  const labelCls = "mb-1 block text-xs font-medium text-slate-400"

  const formFields = (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          id="isCompany"
          type="checkbox"
          checked={form.isCompany}
          onChange={(e) => setForm({ ...form, isCompany: e.target.checked })}
        />
        <label htmlFor="isCompany" className="text-sm text-slate-300">Company tenant (corporate lease)</label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{form.isCompany ? "Contact Person *" : "Name *"}</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <UaePhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Nationality</label>
          <input type="text" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Emirates ID</label>
          <input type="text" value={form.emiratesId} onChange={(e) => setForm({ ...form, emiratesId: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>EID Expiry</label>
          <input type="date" value={form.emiratesIdExpiry} onChange={(e) => setForm({ ...form, emiratesIdExpiry: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Passport No</label>
          <input type="text" value={form.passportNo} onChange={(e) => setForm({ ...form, passportNo: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Passport Expiry</label>
          <input type="date" value={form.passportExpiry} onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Visa No</label>
          <input type="text" value={form.visaNo} onChange={(e) => setForm({ ...form, visaNo: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Visa Expiry</label>
          <input type="date" value={form.visaExpiry} onChange={(e) => setForm({ ...form, visaExpiry: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Occupation</label>
          <input type="text" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Employer</label>
          <input type="text" value={form.employer} onChange={(e) => setForm({ ...form, employer: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Family Members</label>
          <input type="number" min={1} placeholder="e.g. 4" value={form.familySize} onChange={(e) => setForm({ ...form, familySize: Number(e.target.value) })} className={inputCls} />
          <p className="mt-1 text-[11px] text-slate-500">
            Total people living in the unit (include the tenant).
            {form.familySize > 0 && (
              <span className="ml-1 font-medium text-emerald-400">👪 {form.familySize} member{form.familySize === 1 ? "" : "s"}</span>
            )}
          </p>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputCls}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Emergency Contact</label>
          <input type="text" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Emergency Phone</label>
          <UaePhoneInput value={form.emergencyContactPhone} onChange={(v) => setForm({ ...form, emergencyContactPhone: v })} className={inputCls} />
        </div>
      </div>

      {form.isCompany && (
        <div className="rounded-lg border border-amber-700/40 bg-amber-900/10 p-3">
          <p className="mb-3 text-xs font-semibold uppercase text-amber-400">Company Information</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Company Name</label>
              <input type="text" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Trade License No</label>
              <input type="text" value={form.companyTradeLicense} onChange={(e) => setForm({ ...form, companyTradeLicense: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Trade License Expiry</label>
              <input type="date" value={form.companyTradeLicenseExpiry} onChange={(e) => setForm({ ...form, companyTradeLicenseExpiry: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Signatory Name</label>
              <input type="text" value={form.signatoryName} onChange={(e) => setForm({ ...form, signatoryName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Signatory Title</label>
              <input type="text" value={form.signatoryTitle} onChange={(e) => setForm({ ...form, signatoryTitle: e.target.value })} className={inputCls} />
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div>
          <label className={labelCls}>Assign Unit (optional)</label>
          <select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} className={inputCls}>
            <option value="">No unit</option>
            {vacantUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.unitNo}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelCls}>Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
      </div>
    </div>
  )

  const contractFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Unit *</label>
          <select
            value={contractForm.unitId}
            onChange={(e) => {
              const u = units.find((x) => x.id === e.target.value)
              const isResidential = u && u.unitType.toLowerCase().includes("commercial") ? false : true
              const ct = isResidential ? "Residential" : "Commercial"
              const rent = u?.currentRent || 0
              setContractForm({
                ...contractForm,
                unitId: e.target.value,
                contractType: ct,
                rentAmount: rent || contractForm.rentAmount,
                securityDeposit: (isResidential ? 0.05 : 0.1) * (rent || contractForm.rentAmount),
                commissionFee: Math.max((isResidential ? 0.05 : 0.1) * (rent || contractForm.rentAmount), 1050),
              })
            }}
            className={inputCls}
          >
            <option value="">Select unit...</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.unitNo} ({u.unitType || "—"})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Landlord *</label>
          <select value={contractForm.ownerId} onChange={(e) => setContractForm({ ...contractForm, ownerId: e.target.value })} className={inputCls}>
            <option value="">Select landlord...</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.ownerName} – {o.buildingName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Contract Type</label>
          <select
            value={contractForm.contractType}
            onChange={(e) => {
              const ct = e.target.value
              const isRes = ct === "Residential"
              setContractForm({
                ...contractForm,
                contractType: ct,
                securityDeposit: (isRes ? 0.05 : 0.1) * contractForm.rentAmount,
                commissionFee: Math.max((isRes ? 0.05 : 0.1) * contractForm.rentAmount, 1050),
              })
            }}
            className={inputCls}
          >
            <option value="Residential">Residential</option>
            <option value="Commercial">Commercial</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Reason</label>
          <select value={contractForm.reason} onChange={(e) => setContractForm({ ...contractForm, reason: e.target.value })} className={inputCls}>
            <option value="Initial">Initial</option>
            <option value="Renewal">Renewal</option>
            <option value="Amendment">Amendment</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Start Date *</label>
          <input
            type="date"
            value={contractForm.contractStart}
            min={(() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10) })()}
            onChange={(e) => {
              const start = e.target.value
              let end = ""
              if (start) {
                const d = new Date(start)
                d.setFullYear(d.getFullYear() + contractYears)
                d.setDate(d.getDate() - 1)
                end = d.toISOString().slice(0, 10)
              }
              setContractForm({ ...contractForm, contractStart: start, contractEnd: end })
            }}
            className={inputCls}
          />
          <p className="mt-1 text-[10px] text-slate-500">Cannot be a past date.</p>
        </div>
        <div>
          <label className={labelCls}>Number of Years *</label>
          <select
            value={contractYears}
            onChange={(e) => {
              const y = parseInt(e.target.value)
              setContractYears(y)
              if (contractForm.contractStart) {
                const d = new Date(contractForm.contractStart)
                d.setFullYear(d.getFullYear() + y)
                d.setDate(d.getDate() - 1)
                setContractForm({ ...contractForm, contractEnd: d.toISOString().slice(0, 10) })
              }
            }}
            className={inputCls}
          >
            <option value={1}>1 year</option>
            <option value={2}>2 years</option>
            <option value={3}>3 years</option>
            <option value={4}>4 years</option>
            <option value={5}>5 years</option>
            <option value={10}>10 years</option>
          </select>
        </div>
        <div className="col-span-2 rounded-lg border border-slate-700 bg-slate-800/40 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">End Date (auto)</span>
            <span className="text-base font-bold text-white">{contractForm.contractEnd || "—"}</span>
          </div>
          {contractForm.contractStart && contractForm.contractEnd && (() => {
            const s = new Date(contractForm.contractStart)
            const en = new Date(contractForm.contractEnd)
            const days = Math.floor((en.getTime() - s.getTime()) / 86400000) + 1
            return <p className="mt-1 text-[10px] text-slate-500">{days} days · Start + {contractYears} year{contractYears > 1 ? "s" : ""} − 1 day</p>
          })()}
        </div>
        <div>
          <label className={labelCls}>Annual Rent (AED) *</label>
          <input
            type="number"
            value={contractForm.rentAmount}
            onChange={(e) => {
              const rent = Number(e.target.value)
              const isRes = contractForm.contractType === "Residential"
              setContractForm({
                ...contractForm,
                rentAmount: rent,
                securityDeposit: (isRes ? 0.05 : 0.1) * rent,
                commissionFee: Math.max((isRes ? 0.05 : 0.1) * rent, 1050),
              })
            }}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Number of Cheques</label>
          <input type="number" min={1} max={12} value={contractForm.numberOfCheques} onChange={(e) => setContractForm({ ...contractForm, numberOfCheques: Number(e.target.value) })} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Rent in Words</label>
          <input type="text" value={contractForm.rentInWords} onChange={(e) => setContractForm({ ...contractForm, rentInWords: e.target.value })} className={inputCls} placeholder="e.g. Sixty Thousand Dirhams Only" />
        </div>
        <div>
          <label className={labelCls}>Security Deposit (AED)</label>
          <input type="number" value={contractForm.securityDeposit} onChange={(e) => setContractForm({ ...contractForm, securityDeposit: Number(e.target.value) })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Booking Amount (AED)</label>
          <input type="number" value={contractForm.bookingAmount} onChange={(e) => setContractForm({ ...contractForm, bookingAmount: Number(e.target.value) })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>EJARI Fee</label>
          <input type="number" value={contractForm.ejariFee} onChange={(e) => setContractForm({ ...contractForm, ejariFee: Number(e.target.value) })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Admin / Commission Fee (AED)</label>
          <input type="number" value={contractForm.commissionFee} onChange={(e) => setContractForm({ ...contractForm, commissionFee: Number(e.target.value) })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Purpose</label>
          <input type="text" value={contractForm.purpose} onChange={(e) => setContractForm({ ...contractForm, purpose: e.target.value })} className={inputCls} />
        </div>
      </div>
    </div>
  )

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants &amp; Agreements</h1>
          <p className="mt-1 text-sm text-slate-400">{tenants.length} tenants registered</p>
        </div>
        <div className="flex items-center gap-2">
          <HelpPanel
            title="Tenants — How it works"
            sections={[
              {
                title: "What this page does",
                body: (
                  <p>Central registry of every tenant in your buildings. Search, filter, edit, assign to units, generate contracts, track documents and cheques — all starting here.</p>
                ),
              },
              {
                title: "Add a tenant — two ways",
                body: (
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Onboarding Wizard</strong> (amber button) — full move-in flow: upload Emirates ID → OCR auto-fill → assign unit → set contract dates + rent → generate cheques → calculate fees (Ejari, Municipality) → generate DLD contract → email signing link to tenant. Takes 5-10 min.</li>
                    <li><strong>Quick Add</strong> (grey button) — fast modal with just name, phone, email, EID. No contract, no cheques, no emails. Use when you only have basic info; fill the rest via Edit later.</li>
                  </ul>
                ),
              },
              {
                title: "Columns",
                body: (
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Name</strong> — sorted by unit number, not alphabetical</li>
                    <li><strong>Phone / Email</strong> — contact info</li>
                    <li><strong>Unit</strong> — which unit they occupy</li>
                    <li><strong>Type</strong> — unit type (Studio / 1 BHK / etc.)</li>
                    <li><strong>Nationality</strong> — filterable</li>
                    <li><strong>Emirates ID</strong> — 784-XXXX-XXXXXXX-X</li>
                    <li><strong>Status</strong> — Active / Pending / Terminated / Blacklisted</li>
                    <li><strong>Docs</strong> — green ticks for Ejari / Cheques / EID uploaded</li>
                  </ul>
                ),
              },
              {
                title: "Filters",
                body: (
                  <p>Every column has a funnel icon for Excel-style multi-select filtering. Combined with search box for fast lookup.</p>
                ),
              },
              {
                title: "Row actions",
                body: (
                  <ul className="list-disc pl-5 space-y-1">
                    <li>👁 <strong>View</strong> — quick detail modal showing everything</li>
                    <li>✏ <strong>Edit</strong> — edit all tenant fields + upload documents (Emirates ID, Ejari, cheques)</li>
                    <li>🔑 <strong>Portal Password</strong> — generate / reset tenant&apos;s portal login</li>
                    <li>🚫 <strong>Terminate</strong> — end the tenancy (releases the unit, marks tenant Terminated)</li>
                    <li>🗑 <strong>Delete</strong> — removes tenant + their cheques + documents (DANGEROUS, requires confirmation)</li>
                  </ul>
                ),
              },
              {
                title: "Documents per tenant",
                body: (
                  <p>Each tenant can hold unlimited files in the Edit page → Documents section. Supports PDF, images. File types are tagged: Emirates ID, Ejari, Cheques, Passport, Other. Approvable / rejectable by staff.</p>
                ),
              },
              {
                title: "Bulk import",
                body: (
                  <p>
                    Sidebar → <strong>Import Tenants (Folder)</strong> — scans a folder with PDFs and auto-creates tenants from Ejari data.
                    <br />
                    Sidebar → <strong>Import Lease Data (Full)</strong> — Excel with 236+ tenants + cheques in one go.
                  </p>
                ),
              },
            ]}
          />
          <Link href="/dashboard/tenants/new" className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500">
            <Plus className="h-4 w-4" /> Full Onboarding
          </Link>
          <button onClick={() => setPreBookOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Pre-Booking
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
          {error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Quick Filters */}
      {(() => {
        const nationalities = Array.from(new Set(tenants.map((t) => t.nationality).filter(Boolean))).sort()
        const unitTypes = Array.from(new Set(tenants.flatMap((t) => t.units.map((u) => u.unitType)).filter(Boolean))).sort()
        const filtered = tenants.filter((t) => {
          if (statusFilter !== "all" && t.status !== statusFilter) return false
          if (typeFilter !== "all" && !t.units.some((u) => u.unitType === typeFilter)) return false
          if (nationalityFilter !== "all" && t.nationality !== nationalityFilter) return false
          if (docsFilter === "all-docs" && !(t.has_ejari && t.has_cheque && t.has_eid)) return false
          if (docsFilter === "missing-ejari" && t.has_ejari) return false
          if (docsFilter === "missing-eid" && t.has_eid) return false
          if (docsFilter === "missing-cheque" && t.has_cheque) return false
          if (docsFilter === "no-docs" && (t.has_ejari || t.has_cheque || t.has_eid)) return false
          return true
        })
        const filterBtn = (label: string, active: boolean, onClick: () => void, count?: number, color: "amber" | "blue" | "green" | "red" = "amber") => {
          const colors = {
            amber: active ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" : "bg-slate-800 text-slate-400 hover:text-white",
            blue: active ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30" : "bg-slate-800 text-slate-400 hover:text-white",
            green: active ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/30" : "bg-slate-800 text-slate-400 hover:text-white",
            red: active ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30" : "bg-slate-800 text-slate-400 hover:text-white",
          }
          return (
            <button onClick={onClick} className={`rounded-lg px-3 py-1 text-xs font-medium ${colors[color]}`}>
              {label}{count !== undefined && <span className="ml-1 text-[10px] opacity-75">({count})</span>}
            </button>
          )
        }
        const anyActive = statusFilter !== "all" || typeFilter !== "all" || nationalityFilter !== "all" || docsFilter !== "all"
        return (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {filterBtn("All", statusFilter === "all", () => setStatusFilter("all"), tenants.length, "amber")}
                {filterBtn("Active", statusFilter === "Active", () => setStatusFilter("Active"), tenants.filter(t => t.status === "Active").length, "green")}
                {filterBtn("Pre-Booked", statusFilter === "Pre-Booked", () => setStatusFilter("Pre-Booked"), tenants.filter(t => t.status === "Pre-Booked").length, "blue")}
                {filterBtn("Pending", statusFilter === "Pending", () => setStatusFilter("Pending"), tenants.filter(t => t.status === "Pending").length, "amber")}
                {filterBtn("Vacating", statusFilter === "Vacating", () => setStatusFilter("Vacating"), tenants.filter(t => t.status === "Vacating").length, "amber")}
                {filterBtn("Terminated", statusFilter === "Terminated", () => setStatusFilter("Terminated"), tenants.filter(t => t.status === "Terminated").length, "red")}
                {filterBtn("Blacklisted", statusFilter === "Blacklisted", () => setStatusFilter("Blacklisted"), tenants.filter(t => t.status === "Blacklisted").length, "red")}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Unit Type</p>
              <div className="flex flex-wrap gap-1.5">
                {filterBtn("All", typeFilter === "all", () => setTypeFilter("all"), tenants.length, "blue")}
                {unitTypes.map((t) => filterBtn(t, typeFilter === t, () => setTypeFilter(t), tenants.filter((x) => x.units.some((u) => u.unitType === t)).length, "blue"))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Documents</p>
              <div className="flex flex-wrap gap-1.5">
                {filterBtn("All", docsFilter === "all", () => setDocsFilter("all"), tenants.length, "green")}
                {filterBtn("✓ All 3 docs", docsFilter === "all-docs", () => setDocsFilter("all-docs"), tenants.filter(t => t.has_ejari && t.has_cheque && t.has_eid).length, "green")}
                {filterBtn("Missing Ejari", docsFilter === "missing-ejari", () => setDocsFilter("missing-ejari"), tenants.filter(t => !t.has_ejari).length, "red")}
                {filterBtn("Missing EID", docsFilter === "missing-eid", () => setDocsFilter("missing-eid"), tenants.filter(t => !t.has_eid).length, "red")}
                {filterBtn("Missing Cheques", docsFilter === "missing-cheque", () => setDocsFilter("missing-cheque"), tenants.filter(t => !t.has_cheque).length, "red")}
                {filterBtn("No docs", docsFilter === "no-docs", () => setDocsFilter("no-docs"), tenants.filter(t => !t.has_ejari && !t.has_cheque && !t.has_eid).length, "red")}
              </div>
            </div>
            {nationalities.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Nationality</p>
                <select
                  value={nationalityFilter}
                  onChange={(e) => setNationalityFilter(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-white outline-none focus:border-amber-500/50"
                >
                  <option value="all">All ({tenants.length})</option>
                  {nationalities.map((n) => (
                    <option key={n} value={n}>{n} ({tenants.filter(t => t.nationality === n).length})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                Showing <strong className="text-white">{filtered.length}</strong> of <strong className="text-white">{tenants.length}</strong> tenants
              </span>
              {anyActive && (
                <button
                  onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setNationalityFilter("all"); setDocsFilter("all") }}
                  className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >Clear filters</button>
              )}
            </div>
          </div>
        )
      })()}

      <DataTable
        columns={columns}
        data={tenants.filter((t) => {
          if (statusFilter !== "all" && t.status !== statusFilter) return false
          if (typeFilter !== "all" && !t.units.some((u) => u.unitType === typeFilter)) return false
          if (nationalityFilter !== "all" && t.nationality !== nationalityFilter) return false
          if (docsFilter === "all-docs" && !(t.has_ejari && t.has_cheque && t.has_eid)) return false
          if (docsFilter === "missing-ejari" && t.has_ejari) return false
          if (docsFilter === "missing-eid" && t.has_eid) return false
          if (docsFilter === "missing-cheque" && t.has_cheque) return false
          if (docsFilter === "no-docs" && (t.has_ejari || t.has_cheque || t.has_eid)) return false
          return true
        })}
        searchPlaceholder="Search tenants..."
        searchKeys={["name", "phone", "email", "emiratesId"]}
      />

      <Modal open={addOpen} onOpenChange={setAddOpen} title="Add Tenant" description="Register a new tenant" size="xl"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleAdd} disabled={saving || !form.name}>{saving ? "Saving..." : "Save"}</ModalSaveButton></>}>
        {formFields}
      </Modal>

      {/* Pre-Booking Modal */}
      <Modal
        open={preBookOpen}
        onOpenChange={(v) => { setPreBookOpen(v); if (!v) setPreBookForm({ name: "", phone: "", email: "", unitId: "", usage: "Residential", expectedMoveIn: "", preBookingDeposit: "", paymentMethod: "Cash", chequeNo: "", chequeDate: "", bankName: "", notes: "" }) }}
        title="Pre-Booking"
        description="Reserve a unit for a future tenant. Record deposit paid. Complete onboarding when they move in."
        size="lg"
        footer={
          <>
            <ModalCancelButton />
            <ModalSaveButton
              onClick={async () => {
                setPreBookBusy(true)
                try {
                  let res = await fetch("/api/tenants/pre-booking", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(preBookForm),
                  })
                  let data = await res.json()

                  // Conflict: unit already pre-booked
                  if (res.status === 409 && data.conflict) {
                    const ex = data.existingPreBooking
                    const msg = `⚠ Unit is already pre-booked by:\n\n• ${ex.name}\n• Phone: ${ex.phone}\n• Deposit: AED ${ex.preBookingDeposit}\n• Expected move-in: ${ex.expectedMoveIn || "TBD"}\n\nCreate a SECOND pre-booking (waitlist) anyway?`
                    if (!confirm(msg)) { setPreBookBusy(false); return }
                    res = await fetch("/api/tenants/pre-booking", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ...preBookForm, forceBook: true }),
                    })
                    data = await res.json()
                  }

                  if (!res.ok) throw new Error(data.error || "Failed")
                  setPreBookOpen(false)
                  setPreBookForm({ name: "", phone: "", email: "", unitId: "", usage: "Residential", expectedMoveIn: "", preBookingDeposit: "", paymentMethod: "Cash", chequeNo: "", chequeDate: "", bankName: "", notes: "" })
                  fetchTenants()
                  if (preBookForm.email) {
                    if (data.emailSent) {
                      alert(`✓ Pre-booking created and receipt emailed to ${preBookForm.email}`)
                    } else {
                      alert(`✓ Pre-booking created. ⚠ Email not sent: ${data.emailError || "unknown error"}`)
                    }
                  }
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed")
                } finally {
                  setPreBookBusy(false)
                }
              }}
              disabled={preBookBusy || !preBookForm.name || !preBookForm.phone}
            >
              {preBookBusy ? "Saving..." : "Create Pre-Booking"}
            </ModalSaveButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-300">
            <strong>💡 What is pre-booking?</strong> Use this when a new tenant has reserved a unit (paid deposit) but hasn&apos;t moved in yet. The tenant gets status <strong>Pre-Booked</strong>. Later when they actually move in, click <em>Convert to Active</em> on their profile to run full onboarding.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Tenant Name *</label>
              <input
                value={preBookForm.name}
                onChange={(e) => setPreBookForm({ ...preBookForm, name: e.target.value })}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Phone *</label>
              <UaePhoneInput
                value={preBookForm.phone}
                onChange={(v) => setPreBookForm({ ...preBookForm, phone: v })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
              <input
                type="email"
                value={preBookForm.email}
                onChange={(e) => setPreBookForm({ ...preBookForm, email: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Unit Reserved</label>
              <select
                value={preBookForm.unitId}
                onChange={(e) => setPreBookForm({ ...preBookForm, unitId: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              >
                <option value="">Select unit (optional)</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitNo} · {u.unitType} · {u.status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Type</label>
              <div className="flex gap-2">
                {(["Residential", "Commercial"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setPreBookForm({ ...preBookForm, usage: u })}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      preBookForm.usage === u
                        ? "bg-amber-500 text-slate-900"
                        : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    {u === "Commercial" ? "🏢 Commercial (+5% VAT)" : "🏠 Residential"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Expected Move-In</label>
              <input
                type="date"
                value={preBookForm.expectedMoveIn}
                onChange={(e) => setPreBookForm({ ...preBookForm, expectedMoveIn: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              Booking Amount (AED) {preBookForm.usage === "Commercial" && <span className="text-amber-400">— excl. VAT</span>}
            </label>
            <input
              type="number"
              min="0"
              value={preBookForm.preBookingDeposit}
              onChange={(e) => setPreBookForm({ ...preBookForm, preBookingDeposit: e.target.value })}
              placeholder="e.g. 2000"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
            {preBookForm.usage === "Commercial" && parseFloat(preBookForm.preBookingDeposit) > 0 && (
              <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Booking amount:</span>
                  <span className="font-mono">AED {parseFloat(preBookForm.preBookingDeposit).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-amber-300">
                  <span>VAT (5%):</span>
                  <span className="font-mono">AED {(parseFloat(preBookForm.preBookingDeposit) * 0.05).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t border-amber-500/20 mt-2 pt-2 font-semibold text-amber-400">
                  <span>Total (incl. VAT):</span>
                  <span className="font-mono">AED {(parseFloat(preBookForm.preBookingDeposit) * 1.05).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Payment Method</label>
            <div className="flex gap-2">
              {(["Cash", "Cheque"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPreBookForm({ ...preBookForm, paymentMethod: m })}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    preBookForm.paymentMethod === m
                      ? m === "Cash" ? "bg-green-500 text-white" : "bg-blue-500 text-white"
                      : "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                  }`}
                >
                  {m === "Cash" ? "💵 Cash" : "💳 Cheque"}
                </button>
              ))}
            </div>
          </div>

          {preBookForm.paymentMethod === "Cheque" && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-blue-300">💳 Cheque Details</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Cheque No *</label>
                  <input
                    type="text"
                    value={preBookForm.chequeNo}
                    onChange={(e) => setPreBookForm({ ...preBookForm, chequeNo: e.target.value })}
                    placeholder="e.g. 100015"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Cheque Date *</label>
                  <input
                    type="date"
                    value={preBookForm.chequeDate}
                    onChange={(e) => setPreBookForm({ ...preBookForm, chequeDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-400">Bank *</label>
                  <UaeBankInput
                    value={preBookForm.bankName}
                    onChange={(v) => setPreBookForm({ ...preBookForm, bankName: v })}
                    placeholder="e.g. Emirates NBD"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
              <p className="text-[10px] text-blue-300">
                ℹ A Cheque Tracker record will be created automatically with status &quot;Received&quot;.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
            <textarea
              value={preBookForm.notes}
              onChange={(e) => setPreBookForm({ ...preBookForm, notes: e.target.value })}
              rows={2}
              placeholder="e.g. Paid cash, receipt #123"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
            />
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} onOpenChange={setEditOpen} title="Edit Tenant" description="Update tenant information" size="xl"
        footer={<><ModalCancelButton /><ModalSaveButton onClick={handleEdit} disabled={saving || !form.name}>{saving ? "Saving..." : "Update"}</ModalSaveButton></>}>
        {formFields}
      </Modal>

      <Modal
        open={contractOpen}
        onOpenChange={setContractOpen}
        title={`Generate Tenancy Contract - ${activeTenant?.name || ""}`}
        description="Bilingual EN / AR tenancy contract"
        size="xl"
        footer={
          <>
            <ModalCancelButton />
            <ModalSaveButton
              onClick={handleGenerate}
              disabled={saving || !contractForm.unitId || !contractForm.ownerId || !contractForm.contractStart || !contractForm.contractEnd || !contractForm.rentAmount || (() => {
                const today = new Date(); today.setHours(0,0,0,0)
                return new Date(contractForm.contractStart) < today
              })()}
            >
              {saving ? "Generating..." : "Generate Contract"}
            </ModalSaveButton>
          </>
        }
      >
        {contractFormFields}
      </Modal>

      <Modal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={
          detailTenant
            ? `${detailTenant.name}${detailTenant.units?.[0]?.unitNo ? ` — Unit ${detailTenant.units[0].unitNo}` : detailTenant.reservedUnitNo ? ` — Unit ${detailTenant.reservedUnitNo} (Reserved)` : ''}`
            : "Tenant Details"
        }
        size="xl"
      >
        {detailTenant && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={detailTenant.status || ''} />
              {Boolean((detailTenant as unknown as { passwordHash?: string }).passwordHash) && (
                <span className="rounded-full bg-teal-500/15 text-teal-400 ring-1 ring-teal-500/30 px-2.5 py-0.5 text-[11px] font-semibold">Portal Active</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Phone:</span> <span className="ml-2 text-white">{detailTenant.phone || "--"}</span></div>
              <div><span className="text-slate-500">Email:</span> <span className="ml-2 text-white">{detailTenant.email || "--"}</span></div>
              <div><span className="text-slate-500">Emirates ID:</span> <span className="ml-2 text-white font-mono">{detailTenant.emiratesId || "--"}</span></div>
              <div><span className="text-slate-500">EID Expiry:</span> <span className="ml-2 text-white">{(detailTenant as unknown as { emiratesIdExpiry?: string }).emiratesIdExpiry || "--"}</span></div>
              <div><span className="text-slate-500">Nationality:</span> <span className="ml-2 text-white">{detailTenant.nationality || "--"}</span></div>
              <div><span className="text-slate-500">Family Size:</span> <span className="ml-2 text-white">{(detailTenant as unknown as { familySize?: number }).familySize ?? "--"}</span></div>
              <div><span className="text-slate-500">Occupation:</span> <span className="ml-2 text-white">{detailTenant.occupation || "--"}</span></div>
              <div><span className="text-slate-500">Employer:</span> <span className="ml-2 text-white">{detailTenant.employer || "--"}</span></div>
              <div><span className="text-slate-500">Emergency Contact:</span> <span className="ml-2 text-white">{(detailTenant as unknown as { emergencyContactName?: string }).emergencyContactName || "--"}</span></div>
              <div><span className="text-slate-500">Emergency Phone:</span> <span className="ml-2 text-white">{(detailTenant as unknown as { emergencyContactPhone?: string }).emergencyContactPhone || "--"}</span></div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Unit &amp; Contract Details</h3>
              {detailTenant.units.length === 0 ? (
                <p className="text-sm text-slate-600">No units assigned</p>
              ) : (
                <div className="space-y-3">
                  {detailTenant.units.map((u) => {
                    // Parse notes for fees and extras
                    const notes = u.notes || ""
                    const pick = (label: RegExp) => {
                      const m = notes.match(label)
                      return m ? m[1].trim() : ""
                    }
                    const securityDeposit = pick(/Security Deposit:\s*AED\s*([\d,.]+)/i)
                    const ejariFee = pick(/Ejari\s*Fee:?\s*AED\s*([\d,.]+)/i)
                    const commissionFee = pick(/Commission:?\s*AED\s*([\d,.]+)/i)
                    const adminFee = pick(/Admin\s*Fee:?\s*AED\s*([\d,.]+)/i)
                    const numCheq = u.currentRent && Number(u.currentRent) > 0 ? 4 : 0
                    const firstCheque = numCheq > 0 ? Math.round(Number(u.currentRent) / numCheq) : 0
                    const parseAed = (s: string) => Number(String(s).replace(/[^\d.]/g, '')) || 0
                    const firstTotal = parseAed(securityDeposit || '') + parseAed(ejariFee || '') + parseAed(adminFee || '') + parseAed(commissionFee || '') + firstCheque
                    const dewaNo = pick(/DEWA\s*Premise\s*No:?\s*(\S+)/i)
                    const buildingName = pick(/Building:?\s*([^\n]+?)$/im)
                    const ejariContract = pick(/Ejari\s*Contract\s*No:?\s*(\S+)/i)

                    return (
                      <div key={u.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-4 text-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-white">{u.unitNo}</span>
                            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{u.unitType}</span>
                            {u.sqFt ? <span className="text-xs text-slate-500">{u.sqFt} sq ft</span> : null}
                          </div>
                          <StatusBadge status={u.status} />
                        </div>

                        {/* Contract dates + rent row */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-700">
                            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Contract Start</p>
                            <p className="mt-1 text-base font-semibold text-white">{u.contractStart ? formatDate(u.contractStart) : "—"}</p>
                          </div>
                          <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-700">
                            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Contract End</p>
                            <p className="mt-1 text-base font-semibold text-white">{u.contractEnd ? formatDate(u.contractEnd) : "—"}</p>
                          </div>
                          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                            <p className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">Annual Rent</p>
                            <p className="mt-1 text-base font-bold text-amber-300">{formatCurrency(u.currentRent)}</p>
                          </div>
                        </div>

                        {/* Fees row (only shows filled fees) */}
                        {(securityDeposit || ejariFee || commissionFee || adminFee) && (
                          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fees &amp; Deposit</p>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 text-xs">
                              {securityDeposit && (
                                <div><span className="text-slate-500">Security Deposit:</span> <span className="ml-1 font-semibold text-green-400">AED {securityDeposit}</span></div>
                              )}
                              {ejariFee && (
                                <div><span className="text-slate-500">Ejari Fee:</span> <span className="ml-1 text-white">AED {ejariFee}</span></div>
                              )}
                              {adminFee && (
                                <div><span className="text-slate-500">Admin Fee:</span> <span className="ml-1 text-white">AED {adminFee}</span></div>
                              )}
                              {commissionFee && (
                                <div><span className="text-slate-500">Commission:</span> <span className="ml-1 text-white">AED {commissionFee}</span></div>
                              )}
                            </div>
                            {firstTotal > 0 && (
                              <div className="mt-3 rounded-lg border border-[#E30613]/30 bg-[#E30613]/10 px-3 py-2 flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#E30613]">First Total Amount</span>
                                <span className="text-base font-bold text-[#E30613]">AED {firstTotal.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Property info */}
                        {(dewaNo || buildingName || ejariContract) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                            {buildingName && <span><span className="text-slate-500">Building:</span> <span className="text-slate-300">{buildingName}</span></span>}
                            {dewaNo && <span><span className="text-slate-500">DEWA:</span> <span className="font-mono text-slate-300">{dewaNo}</span></span>}
                            {ejariContract && <span><span className="text-slate-500">Ejari Contract:</span> <span className="font-mono text-slate-300">{ejariContract}</span></span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase text-slate-400">Tenant Contracts</h3>
                {(() => {
                  // Find the nearest contract end date across all units
                  const endDates = detailTenant.units.map((u) => u.contractEnd).filter(Boolean)
                  const today = new Date()
                  const ninetyDaysLater = new Date()
                  ninetyDaysLater.setDate(ninetyDaysLater.getDate() + 90)
                  const hasUpcomingRenewal = endDates.some((d) => {
                    if (!d) return false
                    const dt = new Date(d)
                    return dt <= ninetyDaysLater
                  })
                  const daysToEnd = endDates.length > 0
                    ? Math.floor((new Date(endDates.sort()[0]!).getTime() - today.getTime()) / 86400000)
                    : null

                  if (hasUpcomingRenewal) {
                    return (
                      <button
                        onClick={() => { setDetailOpen(false); openGenerate(detailTenant) }}
                        className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        <Plus className="h-3 w-3" /> Renew Contract
                        {daysToEnd !== null && <span className="ml-1 text-[10px] opacity-80">· {daysToEnd >= 0 ? `${daysToEnd}d left` : `expired ${Math.abs(daysToEnd)}d ago`}</span>}
                      </button>
                    )
                  }
                  return (
                    <span
                      title={daysToEnd !== null ? `Renewal available when contract end is within 90 days (currently ${daysToEnd} days away)` : undefined}
                      className="flex items-center gap-1 rounded bg-slate-700/40 px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed"
                    >
                      🔒 Renew Contract {daysToEnd !== null && <span className="text-[10px] opacity-70">(available at T-90d)</span>}
                    </span>
                  )
                })()}
              </div>
              {tenantContracts.length === 0 ? (
                <p className="text-sm text-slate-600">No contracts generated yet</p>
              ) : (
                <div className="space-y-2">
                  {tenantContracts.map((c) => (
                    <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-white">{c.contractNo} <span className="text-xs text-slate-500">v{c.version}</span></div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDate(c.contractStart)} → {formatDate(c.contractEnd)} · {c.contractType} · {formatCurrency(c.rentAmount)}
                          </div>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a
                          href={`/api/tenancy-contracts/${c.id}?format=html`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
                        >
                          <ExternalLink className="h-3 w-3" /> View
                        </a>
                        {c.status === "Draft" && (
                          <button
                            onClick={() => handleContractAction(c, "send")}
                            className="rounded bg-blue-700/50 px-2 py-1 text-xs text-blue-200 hover:bg-blue-700"
                          >
                            Send
                          </button>
                        )}
                        {c.signatureToken && (c.status === "Draft" || c.status === "Sent") && (() => {
                          const signUrl = `${window.location.origin}/sign/${c.signatureToken}`
                          const msg = `Hello ${detailTenant?.name || ''}, please review and sign your tenancy contract ${c.contractNo} here: ${signUrl}`
                          const digits = (detailTenant?.phone || '').replace(/\D/g, '')
                          const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
                          return (
                            <>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(signUrl)
                                  alert("Sign link copied!\n\n" + signUrl)
                                }}
                                className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
                                title="Copy sign link"
                              >
                                📋 Copy Link
                              </button>
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 rounded bg-emerald-700/50 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-700"
                                title={digits ? `Send via WhatsApp to ${detailTenant?.phone}` : "No phone on file — opens WhatsApp with just the message"}
                              >
                                💬 WhatsApp
                              </a>
                            </>
                          )
                        })()}
                        {c.signedFilePath && (
                          <a
                            href={`/api/tenancy-contracts/${c.id}/download`}
                            className="flex items-center gap-1 rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600"
                          >
                            <Download className="h-3 w-3" /> Download
                          </a>
                        )}
                        {c.status === "Active" && (
                          <button
                            onClick={() => handleContractAction(c, "terminate")}
                            className="rounded bg-red-800/50 px-2 py-1 text-xs text-red-300 hover:bg-red-800"
                          >
                            Terminate
                          </button>
                        )}
                        {c.status === "Draft" && (
                          <button
                            onClick={() => handleContractAction(c, "cancel")}
                            className="rounded bg-red-800/50 px-2 py-1 text-xs text-red-300 hover:bg-red-800"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Documents</h3>
              {(() => {
                const docs = ((detailTenant as unknown as { documents?: Array<{ id: string; docType: string; originalFilename?: string }> }).documents) || []
                if (docs.length === 0) {
                  return <p className="text-sm text-slate-600">No documents uploaded yet.</p>
                }
                return (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {docs.map((d) => (
                      <a
                        key={d.id}
                        href={`/api/documents/${d.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2 text-xs text-slate-200 hover:border-amber-500/40 hover:bg-slate-800/60"
                      >
                        <span className="truncate"><strong className="text-amber-400">{d.docType}</strong> — {d.originalFilename || ''}</span>
                        <ExternalLink className="ml-2 h-3 w-3 flex-shrink-0 text-slate-500" />
                      </a>
                    ))}
                  </div>
                )
              })()}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Cheques</h3>
              {tenantCheques.length === 0 ? (
                <p className="text-sm text-slate-600">No cheques recorded yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-800">
                  <table className="w-full text-xs text-slate-200">
                    <thead className="bg-slate-800/50 text-slate-400">
                      <tr>
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">Cheque No.</th>
                        <th className="px-3 py-2 text-left">Bank</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantCheques.map((c) => (
                        <tr key={c.id} className="border-t border-slate-800">
                          <td className="px-3 py-2">
                            Cheque {c.sequenceNo}
                            {c.paymentType === 'Upfront' && <span className="ml-1 text-[10px] text-blue-400">(Upfront)</span>}
                          </td>
                          <td className="px-3 py-2 font-mono">{c.chequeNo || '—'}</td>
                          <td className="px-3 py-2">{c.bankName || '—'}</td>
                          <td className="px-3 py-2">{c.chequeDate || '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(c.amount || 0)}</td>
                          <td className="px-3 py-2"><StatusBadge status={c.status || 'Pending'} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals Summary */}
              {tenantCheques.length > 0 && (() => {
                const total = tenantCheques.reduce((s, c) => s + (c.amount || 0), 0)
                const cleared = tenantCheques.filter(c => c.status === 'Cleared').reduce((s, c) => s + (c.amount || 0), 0)
                const received = tenantCheques.filter(c => ['Received', 'Deposited', 'Pending'].includes(c.status)).reduce((s, c) => s + (c.amount || 0), 0)
                const bounced = tenantCheques.filter(c => c.status === 'Bounced').reduce((s, c) => s + (c.amount || 0), 0)
                const today = new Date().toISOString().slice(0, 10)
                const overdue = tenantCheques.filter(c => c.chequeDate && c.chequeDate < today && !['Cleared', 'Replaced'].includes(c.status)).reduce((s, c) => s + (c.amount || 0), 0)
                const pending = Math.max(0, total - cleared)

                return (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Amount</p>
                      <p className="mt-1 text-lg font-bold text-white">{formatCurrency(total)}</p>
                      <p className="text-[10px] text-slate-500">{tenantCheques.length} cheques</p>
                    </div>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-400">Cleared</p>
                      <p className="mt-1 text-lg font-bold text-emerald-400">{formatCurrency(cleared)}</p>
                      <p className="text-[10px] text-emerald-300">{tenantCheques.filter(c => c.status === 'Cleared').length} cheques</p>
                    </div>
                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-blue-400">Received / Pending</p>
                      <p className="mt-1 text-lg font-bold text-blue-400">{formatCurrency(received)}</p>
                      <p className="text-[10px] text-blue-300">{tenantCheques.filter(c => ['Received', 'Deposited', 'Pending'].includes(c.status)).length} cheques</p>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-amber-400">Pending Balance</p>
                      <p className="mt-1 text-lg font-bold text-amber-400">{formatCurrency(pending)}</p>
                      <p className="text-[10px] text-amber-300">Total − Cleared</p>
                    </div>
                    <div className={`rounded-lg border p-3 ${overdue > 0 || bounced > 0 ? 'border-red-500/30 bg-red-500/10' : 'border-slate-700 bg-slate-900/60'}`}>
                      <p className={`text-[10px] uppercase tracking-wider ${overdue > 0 || bounced > 0 ? 'text-red-400' : 'text-slate-500'}`}>Issues</p>
                      {bounced > 0 && <p className="mt-1 text-sm font-bold text-red-400">Bounced: {formatCurrency(bounced)}</p>}
                      {overdue > 0 && <p className="text-sm font-bold text-red-400">Overdue: {formatCurrency(overdue)}</p>}
                      {overdue === 0 && bounced === 0 && <p className="mt-1 text-lg font-bold text-green-400">✓ None</p>}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </Modal>

      {/* Terminate Contract modal */}
      <Modal
        open={termOpen}
        onOpenChange={setTermOpen}
        title={`Terminate Contract — ${termTenant?.name || ""}`}
        description="This ends the tenancy, disables the portal, and emails the tenant."
        size="md"
        footer={
          <>
            <ModalCancelButton />
            <button
              onClick={submitTerminate}
              disabled={termBusy || !termConfirm || termReason.trim().length < 3 || !termType || !termDewaDate || !termRentCalcDate || !termDewaDoc || !termFmrDoc || !termAquaDoc}
              className="inline-flex items-center gap-2 rounded-lg bg-[#E30613] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c20510] disabled:opacity-50"
            >
              <Ban className="h-4 w-4" />
              {termBusy ? "Terminating..." : "Confirm Termination"}
            </button>
          </>
        }
      >
        {termTenant && (
          <div className="space-y-5 text-sm">
            {/* ── Step 1: Type picker — radio cards instead of a dropdown so
                each option's policy ("2-month penalty" / "no penalty") is
                visible before clicking. */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Step 1 · Termination Type</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([
                  {
                    val: "BreakLease",
                    title: "Break Lease",
                    icon: "⚠",
                    blurb: "Tenant ends contract early. 2-month penalty added to the rent calculation date.",
                    accent: "amber",
                  },
                  {
                    val: "NonRenewal",
                    title: "Non Renewal",
                    icon: "📅",
                    blurb: "Contract reaches its natural end. No penalty — rent calc matches DEWA closing date.",
                    accent: "slate",
                  },
                ] as const).map((opt) => {
                  const selected = termType === opt.val
                  return (
                    <button
                      type="button"
                      key={opt.val}
                      onClick={() => setTermType(opt.val)}
                      className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                        selected
                          ? opt.accent === "amber"
                            ? "border-amber-400 bg-amber-50"
                            : "border-slate-700 bg-slate-100"
                          : "border-slate-200 bg-white hover:border-slate-400"
                      }`}
                    >
                      <span className="text-xl leading-none">{opt.icon}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${selected ? "text-slate-900" : "text-slate-800"}`}>{opt.title}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{opt.blurb}</p>
                      </div>
                      {selected && <span className="text-emerald-600">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Step 2: Dates — only after type is picked. The tile reminds
                the user how rent-calc is derived for the chosen type. */}
            {termType && (
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Step 2 · Closure & Rent Calculation Dates</p>
                <div className={`rounded-xl border p-3 ${termType === "BreakLease" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                  <p className={`mb-2 text-[11px] ${termType === "BreakLease" ? "text-amber-800" : "text-slate-700"}`}>
                    {termType === "BreakLease"
                      ? "Rent calc auto-fills as DEWA closing + 2 months (penalty). You can override if a different gap was negotiated."
                      : "Rent calc auto-fills to match DEWA closing date. You can override if needed."}
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        DEWA Closing Date <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="date"
                        value={termDewaDate}
                        onChange={(e) => setTermDewaDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Rent Calculation Date <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="date"
                        value={termRentCalcDate}
                        min={termDewaDate || undefined}
                        onChange={(e) => setTermRentCalcDate(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      />
                      {termType === "BreakLease" && termDewaDate && termRentCalcDate && (
                        <p className="mt-1 text-[10px] text-amber-700">
                          ↳ {Math.round((new Date(termRentCalcDate).getTime() - new Date(termDewaDate).getTime()) / 86400000)} days after DEWA closing
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Required Documents — explicit "Required" badges */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Step 3 · Required Documents</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {([
                  { val: "dewa", label: "DEWA Clearance", file: termDewaDoc, set: setTermDewaDoc, hint: "Latest DEWA bill / clearance receipt" },
                  { val: "fmr", label: "FMR Report", file: termFmrDoc, set: setTermFmrDoc, hint: "Final Move-out Report from inspection" },
                  { val: "aqua", label: "Aqua Cool Clearance", file: termAquaDoc, set: setTermAquaDoc, hint: "Aqua Cool / chiller account closure receipt" },
                ] as const).map((doc) => (
                  <div key={doc.val} className={`rounded-lg border-2 p-3 ${doc.file ? "border-emerald-300 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-800">{doc.label}</p>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${doc.file ? "bg-emerald-200 text-emerald-800" : "bg-red-200 text-red-800"}`}>
                        {doc.file ? "Attached" : "Required"}
                      </span>
                    </div>
                    <p className="mb-2 text-[10px] text-slate-600">{doc.hint}</p>
                    {!doc.file ? (
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => doc.set(e.target.files?.[0] || null)}
                        className="block w-full text-[11px] text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:ring-1 file:ring-slate-300 hover:file:bg-slate-50"
                      />
                    ) : (
                      <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]">
                        <span className="truncate">{doc.file.name} <span className="text-slate-500">({(doc.file.size / 1024).toFixed(0)} KB)</span></span>
                        <button onClick={() => doc.set(null)} className="ml-2 text-red-600 hover:text-red-800">Remove</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Optional extra proof — collapsed below the two mandatory ones */}
              <details className="mt-2 rounded-lg border border-slate-200 bg-white">
                <summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50">+ Add another supporting document (optional)</summary>
                <div className="border-t border-slate-200 p-3">
                  {!termProof ? (
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setTermProof(e.target.files?.[0] || null)}
                      className="block w-full text-[11px] text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-slate-300"
                    />
                  ) : (
                    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px]">
                      <span className="truncate">{termProof.name} ({(termProof.size / 1024).toFixed(0)} KB)</span>
                      <button onClick={() => setTermProof(null)} className="ml-2 text-red-600 hover:text-red-800">Remove</button>
                    </div>
                  )}
                </div>
              </details>
              <p className="mt-2 text-[10px] text-slate-500">All files: PDF / JPG / PNG / WebP, max 10 MB each.</p>
            </div>

            {/* ── Step 4: Reason + Effective date */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Step 4 · Reason</p>
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Reason for Termination <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={termReason}
                    onChange={(e) => setTermReason(e.target.value)}
                    placeholder="Describe why the contract is being terminated (non-payment, mutual agreement, etc.)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={termEffectiveDate}
                    onChange={(e) => setTermEffectiveDate(e.target.value)}
                    className="w-full sm:w-1/2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <input
                type="checkbox"
                checked={termConfirm}
                onChange={(e) => setTermConfirm(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-xs text-red-800">
                I confirm I have verified all details. Terminating will immediately:
                end the active contract, disable the tenant&rsquo;s portal login, and
                send a termination email to <strong>{termTenant.email || "the tenant"}</strong>.
                This cannot be reversed.
              </span>
            </label>

            {termError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {termError}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Tenant Portal Access modal */}
      <Modal
        open={portalOpen}
        onOpenChange={(o) => { setPortalOpen(o); if (!o) { setPortalMsg(null); setPortalTempPwd("") } }}
        title={`Tenant Portal — ${portalTenant?.name || ""}`}
        description="Manage login credentials for the tenant portal"
        size="md"
        footer={<ModalCancelButton>Close</ModalCancelButton>}
      >
        {portalTenant && (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Username (email)</p>
                  <p className="font-medium text-slate-900">{portalTenant.email || "—"}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                    Boolean((portalTenant as unknown as { passwordHash?: string }).passwordHash)
                      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                      : "bg-red-100 text-red-700 ring-red-200"
                  }`}
                >
                  {Boolean((portalTenant as unknown as { passwordHash?: string }).passwordHash) ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>

            {portalTempPwd && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">One-time password (copy now):</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 rounded border border-amber-300 bg-white px-2 py-1 font-mono text-sm">{portalTempPwd}</code>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(portalTempPwd) }}
                    className="rounded border border-amber-300 bg-white px-2 py-1 text-xs hover:bg-amber-100"
                  >
                    <Copy className="h-3 w-3 inline mr-1" />Copy
                  </button>
                </div>
              </div>
            )}

            {portalMsg && (
              <div className={`rounded-lg border p-3 text-xs ${portalMsg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                {portalMsg.text}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                disabled={portalBusy || !portalTenant.email}
                onClick={() => resetTenantPassword(true)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#E30613] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c20510] disabled:opacity-50"
              >
                <Mail className="h-4 w-4" /> Reset password &amp; email tenant
              </button>
              <button
                disabled={portalBusy || !portalTenant.email}
                onClick={() => resetTenantPassword(false)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" /> Generate new password (show only, no email)
              </button>
              {Boolean((portalTenant as unknown as { passwordHash?: string }).passwordHash) && (
                <button
                  disabled={portalBusy}
                  onClick={disableTenantPortal}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" /> Disable portal login
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-500">
              Disabling blocks login until a new password is issued. Reset generates a random password; either copy it directly or send it to the tenant by email.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

function DocBadge({ has, label }: { has: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${has ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30" : "bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30"}`}>
      {has ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}
