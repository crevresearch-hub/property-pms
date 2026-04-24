"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  User,
  Home,
  FileText,
  CreditCard,
  FolderOpen,
  Wrench,
  Key,
  Mail,
  LogOut,
  Upload,
  Send,
  ExternalLink,
  Copy,
  Trash2,
  DoorOpen,
  FileSignature,
  FileCheck,
  X,
  Plus,
  Banknote,
  Hash,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { UaePhoneInput } from "@/components/ui/uae-phone-input"

const LABEL = "mb-1.5 block text-xs font-medium text-slate-600"
const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20"
const SECTION = "rounded-2xl border border-slate-200 bg-white shadow-sm"

interface TenantFull {
  id: string
  name: string
  email: string
  phone: string
  emiratesId: string
  passportNo: string
  nationality: string
  occupation: string
  employer: string
  familySize: number
  visaNo: string
  visaExpiry: string
  emiratesIdExpiry: string
  passportExpiry: string
  emergencyContactName: string
  emergencyContactPhone: string
  status: string
  notes: string
  passwordHash: string
  isCompany: boolean
  companyName: string
  companyTradeLicense: string
  companyTradeLicenseExpiry: string
  signatoryName: string
  signatoryTitle: string
  eidNameEn?: string
  eidNameAr?: string
  eidNumber?: string
  eidExpiry?: string
  eidIssued?: string
  eidCardNumber?: string
  eidDob?: string
  eidVerifiedAt?: string | null
  eidVerifiedBy?: string
  units: {
    id: string
    unitNo: string
    unitType: string
    status: string
    currentRent: number
    contractStart: string
    contractEnd: string
  }[]
  invoices: { id: string; invoiceNo: string; totalAmount: number; status: string; dueDate: string }[]
  documents: { id: string; docType: string; filename: string; originalFilename: string; expiryDate: string; uploadedAt: string }[]
  maintenanceTickets: { id: string; ticketNo: string; title: string; status: string; priority: string; submittedAt: string }[]
}

interface TenancyContract {
  id: string
  contractNo: string
  version: number
  status: string
  contractStart: string
  contractEnd: string
  rentAmount: number
  numberOfCheques: number
  securityDeposit: number
  ejariFee: number
  municipalityFee: number
  commissionFee: number
  contractType: string
  signatureToken: string
  signedFileName: string
  sentAt: string | null
  signedByTenantAt: string | null
  notes: string
  createdAt: string
  [key: string]: unknown
}

interface Cheque {
  id: string
  chequeNo: string
  chequeDate: string
  amount: number
  bankName: string
  status: string
  paymentType: string
  sequenceNo: number
  totalCheques: number
  [key: string]: unknown
}

interface VacatingData {
  type: string
  noticeDate: string
  vacateDate: string
  reason: string
  penaltyAmount: number
  refundAmount: number
  checklist: Record<string, boolean>
  closedAt?: string
  createdAt: string
  updatedAt: string
}

const CHECKLIST_LABELS: { key: string; label: string }[] = [
  { key: "finalInspection", label: "Final inspection scheduled" },
  { key: "dewaFinalBill", label: "DEWA final bill received" },
  { key: "damageAssessment", label: "Damage assessment done" },
  { key: "fmrSigned", label: "FMR (Final Maintenance Report) signed" },
  { key: "keysReturned", label: "Keys returned" },
  { key: "depositCalculated", label: "Security deposit calculated" },
  { key: "refundIssued", label: "Refund cheque issued" },
  { key: "ejariCancelled", label: "EJARI cancelled" },
  { key: "unitMarkedVacant", label: "Unit status → Vacant" },
]

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—"
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return String(d)
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtAED(n: number): string {
  return `AED ${Number(n || 0).toLocaleString()}`
}

export default function TenantEditPage() {
  const params = useParams<{ id: string }>()
  const tenantId = params.id
  const toast = useToast()

  const [tenant, setTenant] = useState<TenantFull | null>(null)
  const [contracts, setContracts] = useState<TenancyContract[]>([])
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [vacating, setVacating] = useState<VacatingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadAll = useCallback(async (silent: boolean = false) => {
    try {
      // Only show the full-page spinner on initial load; refreshes after saves
      // run silently so the page doesn't unmount and reset scroll position.
      if (!silent) setLoading(true)
      const [tRes, cRes, qRes, vRes] = await Promise.all([
        fetch(`/api/tenants/${tenantId}`),
        fetch(`/api/tenants/${tenantId}/tenancy-contracts`),
        fetch(`/api/cheques?tenant_id=${tenantId}`),
        fetch(`/api/tenants/${tenantId}/vacating`),
      ])
      if (!tRes.ok) throw new Error("Failed to load tenant")
      setTenant(await tRes.json())
      if (cRes.ok) {
        const data = await cRes.json()
        const list = data.contracts || []
        setContracts(list)
        // Sync numCheques from the latest contract (used at activation)
        const latest = list[0]
        if (latest?.numberOfCheques && latest.numberOfCheques >= 1 && latest.numberOfCheques <= 12) {
          setNumCheques(latest.numberOfCheques)
        }
      }
      if (qRes.ok) {
        const data = await qRes.json()
        const list = Array.isArray(data) ? data : (data.cheques || [])
        setCheques(list)
      }
      if (vRes.ok) {
        const data = await vRes.json()
        setVacating(data.vacating)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading tenant")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // ----- Auto-save tenant field -----
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)
  const [savingField, setSavingField] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const updateField = (patch: Partial<TenantFull>) => {
    // Block edits when waiting on tenant signature or after contract is Active.
    // (We re-derive the same flags below for safety since this closes over state.)
    const cur = tenant
    const latest = contracts[0]
    const wait = latest && latest.status === "Sent" && !latest.signedByTenantAt
    const active = contracts.some((c) => c.status === "Active")
    if (wait || active) return
    void cur
    setTenant((t) => (t ? { ...t, ...patch } : t))
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        setSavingField(true)
        const res = await fetch(`/api/tenants/${tenantId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error("Save failed")
        setSavedAt(new Date())
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed")
      } finally {
        setSavingField(false)
      }
    }, 700)
  }

  // ----- Portal password actions -----
  const [portalBusy, setPortalBusy] = useState(false)
  const setPortalPassword = async (sendEmail: boolean) => {
    if (!tenant?.email) {
      toast.error("Tenant needs an email first")
      return
    }
    if (!confirm(sendEmail ? "Generate a new password and email it to the tenant?" : "Generate a new password?")) return
    try {
      setPortalBusy(true)
      const res = await fetch(`/api/tenants/${tenantId}/portal-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generate: true, sendEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      if (data.password) {
        await navigator.clipboard.writeText(data.password).catch(() => {})
        toast.success(
          sendEmail && data.emailSent
            ? `Password emailed. Copy: ${data.password}`
            : `Password: ${data.password} (copied)`
        )
      } else {
        toast.success("Portal password updated")
      }
      loadAll(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    } finally {
      setPortalBusy(false)
    }
  }

  // ----- Contract actions -----
  const sendContract = async (contractId: string) => {
    if (!confirm("Email this contract to the tenant for signature?")) return
    try {
      const res = await fetch(`/api/tenancy-contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      toast.success("Contract sent to tenant")
      loadAll(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    }
  }

  const markContractSigned = async (contractId: string) => {
    if (!confirm("Mark this contract as signed & activate it?")) return
    try {
      const res = await fetch(`/api/tenancy-contracts/${contractId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign" }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      toast.success("Contract signed & active")
      loadAll(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    }
  }

  const copySignLink = (token: string) => {
    const url = `${window.location.origin}/sign/${token}`
    navigator.clipboard.writeText(url).catch(() => {})
    toast.success("Sign link copied")
  }

  const uploadSigned = async (contractId: string, file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    try {
      const res = await fetch(`/api/tenancy-contracts/${contractId}/upload`, {
        method: "POST",
        body: fd,
      })
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed")
      toast.success("Signed copy uploaded")
      loadAll(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    }
  }

  // ----- Document upload -----
  const [docUploading, setDocUploading] = useState(false)
  const uploadDoc = async (file: File, docType: string) => {
    try {
      setDocUploading(true)
      const fd = new FormData()
      fd.append("file", file)
      fd.append("tenantId", tenantId)
      fd.append("docType", docType)
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd })
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed")
      toast.success(`${docType} uploaded`)
      loadAll(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    } finally {
      setDocUploading(false)
    }
  }

  const deleteDoc = async (docId: string) => {
    if (!confirm("Delete this document?")) return
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      toast.success("Deleted")
      loadAll(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    }
  }

  // ----- Activate tenant (generate credentials + send welcome email) -----
  const [activating, setActivating] = useState(false)
  const [numCheques, setNumCheques] = useState<number>(4)
  const activateTenant = async () => {
    if (numCheques < 1 || numCheques > 12) {
      toast.error("Number of cheques must be between 1 and 12.")
      return
    }
    if (!confirm(`Activate this tenant with ${numCheques} cheque(s)? This will generate a portal password, seed the cheque schedule, and email the welcome message with login credentials.`)) return
    try {
      setActivating(true)
      const res = await fetch(`/api/tenants/${tenantId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numCheques }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Activation failed")
      if (data.password) {
        await navigator.clipboard.writeText(data.password).catch(() => {})
        toast.success(
          data.emailSent
            ? `Tenant activated! Welcome email sent. Password copied: ${data.password}`
            : `Tenant activated. Password: ${data.password} (copied — email failed)`
        )
      } else {
        toast.success("Tenant activated")
      }
      loadAll(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activation failed")
    } finally {
      setActivating(false)
    }
  }

  // ----- Vacating process -----
  const [vacOpen, setVacOpen] = useState(false)
  const [vacForm, setVacForm] = useState({
    type: "Normal at expiry",
    noticeDate: new Date().toISOString().slice(0, 10),
    vacateDate: "",
    reason: "",
  })

  const initiateVacating = async () => {
    try {
      const res = await fetch(`/api/tenants/${tenantId}/vacating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vacForm),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      const data = await res.json()
      setVacating(data.vacating)
      setVacOpen(false)
      toast.success("Vacating process initiated")
      loadAll(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    }
  }

  const toggleCheck = async (key: string, value: boolean) => {
    try {
      const res = await fetch(`/api/tenants/${tenantId}/vacating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: { [key]: value } }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      const data = await res.json()
      setVacating(data.vacating)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    }
  }

  const closeVacating = async () => {
    if (!confirm("Close the vacating process? This will mark the unit vacant, terminate the contract, and set the tenant as Vacated.")) return
    try {
      const res = await fetch(`/api/tenants/${tenantId}/vacating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ close: true }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      toast.success("Move-out completed")
      loadAll(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    }
  }

  const cancelVacating = async () => {
    if (!confirm("Cancel the vacating process?")) return
    try {
      const res = await fetch(`/api/tenants/${tenantId}/vacating`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed")
      setVacating(null)
      toast.success("Vacating cancelled")
      loadAll(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#E30613]" />
      </div>
    )
  }
  if (error || !tenant) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Tenant not found"}
        </div>
      </div>
    )
  }

  const unit = tenant.units[0]
  const activeContract = contracts.find((c) => c.status === "Active")
  const latestContract = contracts[0]
  // Lock editing while we wait on tenant, and after contract goes Active.
  const waitingOnTenant =
    latestContract &&
    latestContract.status === "Sent" &&
    !latestContract.signedByTenantAt
  const fullyLocked = !!activeContract
  const isLocked = waitingOnTenant || fullyLocked
  const daysToExpiry = unit?.contractEnd
    ? Math.ceil((new Date(unit.contractEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const checklistDone = vacating
    ? Object.values(vacating.checklist).filter(Boolean).length
    : 0
  const checklistTotal = CHECKLIST_LABELS.length

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/dashboard/tenants"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Tenants
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {savingField ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
            ) : savedAt ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Saved {savedAt.toLocaleTimeString()}</>
            ) : null}
          </div>
        </div>

        {/* Lock banner */}
        {waitingOnTenant && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500 animate-pulse" />
            <div>
              <p className="font-semibold">Waiting for tenant to review &amp; sign</p>
              <p className="text-xs mt-0.5 text-amber-800">
                The contract has been emailed to the tenant. All edits are locked
                until they sign and return it. You&rsquo;ll get an email the moment they do.
              </p>
            </div>
          </div>
        )}
        {fullyLocked && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Contract active — record is locked</p>
              <p className="text-xs mt-0.5 text-emerald-800">
                Both sides have signed and the tenancy is active. Editing tenant
                or contract details is disabled. Use the Amendment workflow to issue
                a new version.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E30613]/10 text-xl font-bold text-[#E30613]">
              {tenant.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">{tenant.name}</h1>
              <p className="text-sm text-slate-500">
                {tenant.email || "No email"} {tenant.phone && ` · ${tenant.phone}`}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-medium ${
                  tenant.status === "Active" ? "bg-emerald-100 text-emerald-700" :
                  tenant.status === "Vacating" ? "bg-amber-100 text-amber-700" :
                  tenant.status === "Vacated" ? "bg-slate-200 text-slate-600" :
                  "bg-slate-100 text-slate-600"
                }`}>{tenant.status}</span>
                {tenant.isCompany && <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700">Company</span>}
                {tenant.passwordHash && <span className="rounded-full bg-teal-100 px-2 py-0.5 font-medium text-teal-700">Portal Active</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Locked-form wrapper: visually disables all child inputs while
            waiting on tenant signature or after the contract is Active. */}
        <div className={isLocked ? "pointer-events-none select-none opacity-60" : ""} aria-disabled={isLocked}>

        {/* Renewal alert */}
        {daysToExpiry !== null && daysToExpiry <= 90 && daysToExpiry >= 0 && !vacating && (
          <div className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 ${
            daysToExpiry <= 30 ? "border-red-200 bg-red-50" : daysToExpiry <= 60 ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
          }`}>
            <AlertCircle className={`mt-0.5 h-5 w-5 ${daysToExpiry <= 30 ? "text-red-500" : daysToExpiry <= 60 ? "text-amber-600" : "text-blue-500"}`} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">Lease expires in {daysToExpiry} days</p>
              <p className="text-xs text-slate-600">Contract ends {fmtDate(unit?.contractEnd)}. Consider starting the renewal process.</p>
            </div>
            <Link href="/dashboard/renewals" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Open Renewals
            </Link>
          </div>
        )}

        <div className="space-y-6">
          {/* Emirates ID preview with zoom — PM reads the card while typing
              fields. Click image to open a full-screen zoomable lightbox. */}
          {(() => {
            const frontDoc = tenant.documents.find((d) => d.docType === "Emirates ID")
            const backDoc = tenant.documents.find((d) => d.docType === "Emirates ID (Back)")
            if (!frontDoc && !backDoc) return null
            return (
              <section className={SECTION}>
                <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
                  <FileCheck className="h-4 w-4 text-[#E30613]" />
                  <h2 className="text-sm font-semibold text-slate-900">Emirates ID (Tenant Uploaded)</h2>
                  <span className="ml-auto text-xs text-slate-500">
                    Click an image to zoom. Type the fields below using these as reference.
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                  {[{ doc: frontDoc, label: "Front Side" }, { doc: backDoc, label: "Back Side" }].map((it) => (
                    <EidImageCard
                      key={it.label}
                      doc={it.doc ? { id: it.doc.id, filename: it.doc.filename, originalFilename: it.doc.originalFilename } : undefined}
                      label={it.label}
                      onOpen={setLightbox}
                    />
                  ))}
                </div>
              </section>
            )
          })()}

          {/* 1. Tenant Info */}
          <section className={SECTION}>
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
              <User className="h-4 w-4 text-[#E30613]" />
              <h2 className="text-sm font-semibold text-slate-900">Tenant Information</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <div>
                <label className={LABEL}>Full Name</label>
                <input className={INPUT} value={tenant.name} onChange={(e) => updateField({ name: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Email</label>
                <input className={INPUT} type="email" value={tenant.email} onChange={(e) => updateField({ email: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Phone</label>
                <UaePhoneInput className={INPUT} value={tenant.phone} onChange={(v) => updateField({ phone: v })} />
              </div>
              <div>
                <label className={LABEL}>Status</label>
                <select className={INPUT} value={tenant.status} onChange={(e) => updateField({ status: e.target.value })}>
                  <option>Active</option>
                  <option>Vacating</option>
                  <option>Vacated</option>
                  <option>Blacklisted</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Emirates ID</label>
                <input className={INPUT} value={tenant.emiratesId} onChange={(e) => updateField({ emiratesId: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Emirates ID Expiry</label>
                <input type="date" className={INPUT} value={tenant.emiratesIdExpiry} onChange={(e) => updateField({ emiratesIdExpiry: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Nationality</label>
                <input className={INPUT} value={tenant.nationality} onChange={(e) => updateField({ nationality: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Occupation</label>
                <input className={INPUT} value={tenant.occupation} onChange={(e) => updateField({ occupation: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Employer</label>
                <input className={INPUT} value={tenant.employer} onChange={(e) => updateField({ employer: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Family Members</label>
                <input type="number" min="1" placeholder="e.g. 4" className={INPUT} value={tenant.familySize} onChange={(e) => updateField({ familySize: Number(e.target.value) })} />
                <p className="mt-1 text-[11px] text-slate-500">
                  Total people living in the unit (include the tenant).
                  {tenant.familySize > 0 && (
                    <span className="ml-1 font-medium text-emerald-700">👪 {tenant.familySize} member{tenant.familySize === 1 ? "" : "s"}</span>
                  )}
                </p>
              </div>
              <div>
                <label className={LABEL}>Emergency Contact Name</label>
                <input className={INPUT} value={tenant.emergencyContactName} onChange={(e) => updateField({ emergencyContactName: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Emergency Contact Phone</label>
                <UaePhoneInput className={INPUT} value={tenant.emergencyContactPhone} onChange={(v) => updateField({ emergencyContactPhone: v })} />
              </div>
            </div>

            {/* Portal access — only once the tenant is activated (has a password).
                Before activation, the "Activate Tenant & Send Welcome Email"
                button in the Mandatory Documents section is the single entry
                point, so no duplicate controls. */}
            {tenant.passwordHash && (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <div>
                  <p className="text-xs font-semibold text-slate-900">Tenant Portal Access</p>
                  <p className="text-xs text-slate-500">Password is set.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPortalPassword(false)}
                    disabled={portalBusy || !tenant.email}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Key className="h-3.5 w-3.5" /> Reset Password
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* 2. Unit Info */}
          <section className={SECTION}>
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
              <Home className="h-4 w-4 text-[#E30613]" />
              <h2 className="text-sm font-semibold text-slate-900">Assigned Unit</h2>
            </div>
            <div className="p-6">
              {unit ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Info label="Unit No." value={unit.unitNo} />
                  <Info label="Type" value={unit.unitType || "—"} />
                  <Info label="Status" value={unit.status} />
                  <Info label="Rent" value={fmtAED(unit.currentRent)} />
                  <Info label="Start" value={fmtDate(unit.contractStart)} />
                  <Info label="End" value={fmtDate(unit.contractEnd)} />
                  <div className="col-span-2 flex items-end">
                    <Link href={`/dashboard/units`} className="text-xs font-medium text-[#E30613] hover:underline">
                      Manage in Units →
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No unit assigned.</p>
              )}
            </div>
          </section>

          {/* 3. Tenancy Contracts */}
          <section className={SECTION}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-[#E30613]" />
                <h2 className="text-sm font-semibold text-slate-900">Tenancy Contracts ({contracts.length})</h2>
              </div>
            </div>
            <div className="p-6">
              {contracts.length === 0 ? (
                <p className="text-sm text-slate-500">No contracts generated yet.</p>
              ) : (
                <div className="space-y-3">
                  {contracts.map((c) => (
                    <ContractRow
                      key={c.id}
                      contract={c}
                      onSend={() => sendContract(c.id)}
                      onSign={() => markContractSigned(c.id)}
                      onCopyLink={() => copySignLink(c.signatureToken)}
                      onUpload={(file) => uploadSigned(c.id, file)}
                    />
                  ))}
                </div>
              )}
              {activeContract && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  Active contract: <strong>{activeContract.contractNo}</strong> · {activeContract.contractStart} → {activeContract.contractEnd} · {fmtAED(activeContract.rentAmount)}
                </div>
              )}
              {!activeContract && latestContract && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  Latest contract is still <strong>{latestContract.status}</strong>. Send it, or upload a signed copy to activate.
                </div>
              )}
            </div>
          </section>

          {/* 3.5 Mandatory + Optional Documents + Activation */}
          {(() => {
            const ejariDoc = tenant.documents.find((d) => d.docType === "Ejari")
            const eidDoc = tenant.documents.find((d) => d.docType === "Emirates ID")
            const eidBackDoc = tenant.documents.find((d) => d.docType === "Emirates ID (Back)")
            const chequeDocs = tenant.documents.filter((d) => d.docType === "Cheques")

            const ejariUploaded = !!ejariDoc
            const eidUploaded = !!eidDoc
            const chequesUploaded = chequeDocs.length > 0
            const numChequesOk = numCheques >= 1 && numCheques <= 12

            const mandatoryCount =
              (ejariUploaded ? 1 : 0) + (eidUploaded ? 1 : 0) + (numChequesOk ? 1 : 0)

            const contractSigned = contracts.some(
              (c) => c.signedByTenantAt || c.status === "Active" || !!c.signedFileName
            )
            const allRequirementsMet = ejariUploaded && eidUploaded && numChequesOk
            const canActivate =
              allRequirementsMet && contractSigned && tenant.status !== "Active"

            const optionalTypes: Array<{ key: string; label: string; accept: string }> = [
              { key: "Passport", label: "Passport Copy", accept: ".pdf,.jpg,.jpeg,.png" },
              { key: "Visa", label: "Visa Copy", accept: ".pdf,.jpg,.jpeg,.png" },
              { key: "Trade License", label: "Trade License (if Company)", accept: ".pdf,.jpg,.jpeg,.png" },
              { key: "Salary Certificate", label: "Salary Certificate", accept: ".pdf,.jpg,.jpeg,.png" },
            ]

            return (
              <section className={SECTION}>
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-[#E30613]" />
                    <h2 className="text-sm font-semibold text-slate-900">
                      Mandatory Documents (Required Before Activation)
                    </h2>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      allRequirementsMet ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {allRequirementsMet ? "Ready to activate" : "Upload required docs"}
                  </span>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <MandatoryDocBox
                      label="Ejari Registration"
                      hint="PDF"
                      accept=".pdf"
                      doc={ejariDoc}
                      onUpload={(f) => uploadDoc(f, "Ejari")}
                      onDelete={() => ejariDoc && deleteDoc(ejariDoc.id)}
                    />
                    <div>
                      <MandatoryDocBox
                        label="Emirates ID"
                        hint="PDF / JPG / PNG"
                        accept=".pdf,.jpg,.jpeg,.png"
                        doc={eidDoc}
                        onUpload={(f) => uploadDoc(f, "Emirates ID")}
                        onDelete={() => eidDoc && deleteDoc(eidDoc.id)}
                      />
                      {eidUploaded && tenant.eidVerifiedAt && (
                        <p className="mt-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
                          ✓ EID auto-verified from tenant upload — name, number, expiry and nationality saved.
                        </p>
                      )}
                    </div>
                  </div>

                  {!contractSigned && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <span>
                        The tenant has not signed the tenancy contract yet. Send the contract from the
                        Tenancy Contracts section above.
                      </span>
                    </div>
                  )}

                  {/* --- Optional Documents --- */}
                  <div className="border-t border-slate-100 pt-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Optional Documents</h3>
                      <span className="text-xs text-slate-500">Not required for activation</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {optionalTypes.map((t) => {
                        const doc = tenant.documents.find((d) => d.docType === t.key)
                        return (
                          <OptionalDocRow
                            key={t.key}
                            label={t.label}
                            accept={t.accept}
                            doc={doc}
                            onUpload={(f) => uploadDoc(f, t.key)}
                            onDelete={() => doc && deleteDoc(doc.id)}
                          />
                        )
                      })}
                    </div>
                    <AddOtherDoc onUpload={(f, customType) => uploadDoc(f, customType)} />
                  </div>

                  {/* --- Activation CTA --- */}
                  <div className="flex flex-col items-stretch gap-3 border-t border-slate-100 pt-5 md:flex-row md:items-center md:justify-between">
                    <div className="text-xs text-slate-600">
                      {tenant.status === "Active" ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Tenant is already active and has portal access.
                        </span>
                      ) : canActivate ? (
                        <span className="font-medium text-emerald-700">
                          Ready to activate — all requirements met.
                        </span>
                      ) : (
                        <span>
                          Required: signed contract + Ejari + Emirates ID + Number of Cheques (1-12).
                          {!contractSigned && " (contract not signed yet)"}
                          {!ejariUploaded && " (Ejari missing)"}
                          {!eidUploaded && " (Emirates ID missing)"}
                          {!numChequesOk && " (cheque count invalid)"}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={activateTenant}
                      disabled={!canActivate || activating}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                    >
                      {activating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Activating…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Activate Tenant &amp; Send Welcome Email
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>
            )
          })()}

          {/* 4. Cheques */}
          <section className={SECTION}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#E30613]" />
                <h2 className="text-sm font-semibold text-slate-900">Cheques ({cheques.length})</h2>
              </div>
              <Link href="/dashboard/cheques" className="text-xs font-medium text-[#E30613] hover:underline">
                Open Cheque Tracker →
              </Link>
            </div>
            <div className="p-6">
              {cheques.length === 0 ? (
                <p className="text-sm text-slate-500">No cheques recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="pb-2 text-left font-medium">Seq</th>
                        <th className="pb-2 text-left font-medium">Cheque No.</th>
                        <th className="pb-2 text-left font-medium">Date</th>
                        <th className="pb-2 text-left font-medium">Amount</th>
                        <th className="pb-2 text-left font-medium">Bank</th>
                        <th className="pb-2 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cheques.map((q) => (
                        <tr key={q.id} className="border-b border-slate-100">
                          <td className="py-2 text-slate-700">{q.sequenceNo}/{q.totalCheques}</td>
                          <td className="py-2 font-medium text-slate-900">{q.chequeNo || "—"}</td>
                          <td className="py-2 text-slate-700">{fmtDate(q.chequeDate)}</td>
                          <td className="py-2 text-slate-700">{fmtAED(q.amount)}</td>
                          <td className="py-2 text-slate-600">{q.bankName || "—"}</td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              q.status === "Cleared" ? "bg-emerald-100 text-emerald-700" :
                              q.status === "Bounced" ? "bg-red-100 text-red-700" :
                              q.status === "Deposited" ? "bg-blue-100 text-blue-700" :
                              "bg-slate-100 text-slate-600"
                            }`}>{q.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* 5. Documents */}
          <section className={SECTION}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-[#E30613]" />
                <h2 className="text-sm font-semibold text-slate-900">Documents ({tenant.documents.length})</h2>
              </div>
              {docUploading && <span className="text-xs text-slate-500">Uploading…</span>}
            </div>
            <div className="p-6">
              <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                {["Emirates ID", "Passport", "Visa", "Other"].map((dt) => (
                  <DocUploadButton key={dt} label={dt} onSelect={(f) => uploadDoc(f, dt)} />
                ))}
              </div>
              {tenant.documents.length === 0 ? (
                <p className="text-sm text-slate-500">No documents uploaded.</p>
              ) : (
                <div className="space-y-2">
                  {tenant.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">{d.docType}</p>
                          <p className="text-xs text-slate-500">{d.originalFilename || d.filename} · {fmtDate(d.uploadedAt)}{d.expiryDate && ` · expires ${fmtDate(d.expiryDate)}`}</p>
                        </div>
                      </div>
                      <button onClick={() => deleteDoc(d.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Payment Plan — upfront + cheque tabs + receipt */}
          {latestContract && (
            <PaymentPlan
              cheques={cheques}
              contract={latestContract}
              tenantId={tenantId}
              tenantName={tenant.name}
              tenantEmail={tenant.email}
              documents={tenant.documents}
              onChange={() => loadAll(true)}
            />
          )}

        </div>
        </div>
      </div>
      {lightbox && <EidLightbox value={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}

interface UpfrontData {
  cash: number
  chequeAmount: number
  chequeNo: string
  bankName: string
  chequeDate: string
  receiptSentAt?: string
  receiptNo?: string
}
const UPFRONT_PREFIX = 'UPFRONT_JSON:'
function parseUpfront(notes: string | undefined | null): UpfrontData {
  const def: UpfrontData = { cash: 0, chequeAmount: 0, chequeNo: '', bankName: '', chequeDate: '' }
  if (!notes) return def
  for (const line of notes.split('\n')) {
    if (line.startsWith(UPFRONT_PREFIX)) {
      try {
        return { ...def, ...JSON.parse(line.slice(UPFRONT_PREFIX.length)) }
      } catch { /* ignore */ }
    }
  }
  return def
}
function serializeUpfront(notes: string | undefined | null, data: UpfrontData): string {
  const cleaned = (notes || '').split('\n').filter((l) => !l.startsWith(UPFRONT_PREFIX)).join('\n').trim()
  return [cleaned, UPFRONT_PREFIX + JSON.stringify(data)].filter(Boolean).join('\n')
}

function PaymentPlan({
  cheques,
  contract,
  tenantId,
  tenantName,
  tenantEmail,
  documents,
  onChange,
}: {
  cheques: Cheque[]
  contract: TenancyContract
  tenantId: string
  tenantName: string
  tenantEmail: string
  documents: Array<{ id: string; docType: string; originalFilename?: string; filename?: string }>
  onChange: () => void
}) {
  const sorted = [...cheques].sort((a, b) => a.sequenceNo - b.sequenceNo)
  const [activeIdx, setActiveIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<Cheque>>>({})
  const [upfront, setUpfront] = useState<UpfrontData>(parseUpfront(contract.notes))
  const [upfrontDirty, setUpfrontDirty] = useState(false)
  const [sendingReceipt, setSendingReceipt] = useState(false)
  const [receiptMsg, setReceiptMsg] = useState<string>('')
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false)
  const [sendingStatus, setSendingStatus] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string>('')

  const sendRentStatus = async () => {
    setSendingStatus(true)
    setStatusMsg('')
    try {
      const res = await fetch(`/api/tenants/${tenantId}/rent-status`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed')
      setStatusMsg(`✓ Rent status emailed to ${tenantEmail}`)
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSendingStatus(false)
    }
  }

  // Suggested upfront = security deposit + fees + first installment
  const suggestedUpfront = useMemo(() => {
    const fees =
      (contract.securityDeposit || 0) +
      (contract.ejariFee || 0) +
      (contract.municipalityFee || 0) +
      (contract.commissionFee || 0)
    const firstCheque = sorted[0]?.amount || 0
    return fees + firstCheque
  }, [contract.securityDeposit, contract.ejariFee, contract.municipalityFee, contract.commissionFee, sorted])

  // Auto-fill upfront with the suggested amount ONLY the first time this
  // component mounts or when the saved upfront changes on the server. We
  // must NOT refill on every cheque save (suggestedUpfront changes with
  // cheques) — that would erase the user's in-progress edits.
  const initializedRef = useRef(false)
  useEffect(() => {
    const parsed = parseUpfront(contract.notes)
    const hasSavedUpfront = parsed.cash > 0 || parsed.chequeAmount > 0
    if (!initializedRef.current) {
      // First load — pre-fill with saved value, or with suggestion if nothing saved.
      if (!hasSavedUpfront && suggestedUpfront > 0) {
        setUpfront({ ...parsed, cash: suggestedUpfront })
      } else {
        setUpfront(parsed)
      }
      setUpfrontDirty(false)
      initializedRef.current = true
    } else if (hasSavedUpfront) {
      // After server save, sync local state from the server.
      setUpfront(parsed)
      setUpfrontDirty(false)
    }
    // Intentionally exclude suggestedUpfront from deps so cheque saves
    // don't clobber the upfront fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract.notes])

  const upfrontTotal = (upfront.cash || 0) + (upfront.chequeAmount || 0)
  const upfrontCheqImg = documents.find((d) => d.docType === 'Upfront-Cheque')
  const chequeImgByType = (seq: number) => documents.find((d) => d.docType === `Cheque-${seq}`)

  const annualRent = contract.rentAmount || 0
  // Exclude the upfront cheque (seq=1, paymentType=Upfront) from "cleared cheques"
  // since it is already counted inside upfrontTotal.
  const collectedFromCheques = sorted
    .filter((c) => c.status === 'Cleared' && !(c.sequenceNo === 1 && c.paymentType === 'Upfront'))
    .reduce((s, c) => s + (c.amount || 0), 0)
  const collected = collectedFromCheques + upfrontTotal
  const remaining = Math.max(0, annualRent - collected)
  // PDCs in hand: cheques with a number filled in (tenant handed them over),
  // excluding the upfront cheque already counted above.
  const recordedPdcs = sorted
    .filter((c) => !!c.chequeNo && !(c.sequenceNo === 1 && c.paymentType === 'Upfront'))
    .reduce((s, c) => s + (c.amount || 0), 0)
  const totalSecured = upfrontTotal + recordedPdcs // upfront cash + upfront cheque + PDCs in hand

  const saveCheque = async (id: string, patch: Partial<Cheque>) => {
    setSaving(true)
    try {
      await fetch(`/api/cheques/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      onChange()
    } finally {
      setSaving(false)
    }
  }

  const uploadChequeImage = async (file: File, docType: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('tenantId', tenantId)
    fd.append('docType', docType)
    await fetch('/api/documents/upload', { method: 'POST', body: fd })
    onChange()
  }

  const saveUpfront = async () => {
    setSaving(true)
    try {
      const newNotes = serializeUpfront(contract.notes, upfront)
      const noteRes = await fetch(`/api/tenancy-contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNotes }),
      })
      if (!noteRes.ok) {
        const e = await noteRes.json().catch(() => ({}))
        alert(`Saving upfront notes failed: ${e.error || noteRes.status}`)
        return
      }

      // If upfront includes a cheque, write it into Cheque #1 and mark Cleared.
      const firstCheque = sorted.find((c) => c.sequenceNo === 1)
      if (firstCheque && upfront.chequeAmount > 0) {
        const r = await fetch(`/api/cheques/${firstCheque.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chequeNo: upfront.chequeNo,
            bankName: upfront.bankName,
            chequeDate: upfront.chequeDate,
            amount: upfront.chequeAmount,
            status: 'Cleared',
            clearedDate: new Date().toISOString().split('T')[0],
            paymentType: 'Upfront',
          }),
        })
        if (!r.ok) {
          const e = await r.json().catch(() => ({}))
          alert(`Updating Cheque #1 (upfront) failed: ${e.error || r.status}`)
        }
      } else if (firstCheque && upfront.chequeAmount === 0 && firstCheque.paymentType === 'Upfront') {
        const r = await fetch(`/api/cheques/${firstCheque.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chequeNo: '', bankName: '', chequeDate: '',
            status: 'Received', clearedDate: '', paymentType: 'Rent',
          }),
        })
        if (!r.ok) {
          const e = await r.json().catch(() => ({}))
          alert(`Reverting Cheque #1 failed: ${e.error || r.status}`)
        }
      }

      setUpfrontDirty(false)
      onChange()
    } finally {
      setSaving(false)
    }
  }

  const sendReceipt = async () => {
    setSendingReceipt(true)
    setReceiptMsg('')
    try {
      const res = await fetch(`/api/tenants/${tenantId}/upfront-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          cash: upfront.cash,
          chequeAmount: upfront.chequeAmount,
          chequeNo: upfront.chequeNo,
          bankName: upfront.bankName,
          chequeDate: upfront.chequeDate,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed')
      setReceiptMsg(`✓ Receipt confirmed (${data.receiptNo || ''}) — will be in the welcome email at activation`)
      setReceiptPreviewOpen(false)
      onChange()
    } catch (e) {
      setReceiptMsg(e instanceof Error ? e.message : 'Failed to confirm receipt')
    } finally {
      setSendingReceipt(false)
    }
  }

  const receiptNo = useMemo(() => `RCPT-${Date.now().toString().slice(-8)}`, [receiptPreviewOpen])
  const receiptDate = new Date().toLocaleDateString('en-GB')

  const updateStatus = (id: string, status: string, extra: Record<string, string> = {}) =>
    saveCheque(id, { ...extra, status } as Partial<Cheque>)

  const upfrontHasCheque = upfront.chequeAmount > 0
  const visiblePdcs = sorted.filter((c) => !(c.sequenceNo === 1 && upfrontHasCheque))
  const active = visiblePdcs[activeIdx]
  const edits = (active && localEdits[active.id]) || {}
  const edited = {
    chequeNo: edits.chequeNo ?? active?.chequeNo ?? "",
    bankName: edits.bankName ?? active?.bankName ?? "",
    chequeDate: (edits.chequeDate ?? active?.chequeDate ?? "").slice(0, 10),
    amount: edits.amount ?? active?.amount ?? 0,
  }
  const dirty = active && (
    edited.chequeNo !== (active.chequeNo || "") ||
    edited.bankName !== (active.bankName || "") ||
    edited.chequeDate !== ((active.chequeDate || "").slice(0, 10)) ||
    edited.amount !== (active.amount || 0)
  )

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-[#E30613]" />
          <h2 className="text-sm font-semibold text-slate-900">Payment Plan</h2>
        </div>
        <div className="flex items-center gap-2">
          {statusMsg && (
            <span className={`text-[11px] ${statusMsg.startsWith('✓') ? 'text-emerald-700' : 'text-red-700'}`}>
              {statusMsg}
            </span>
          )}
          <button
            onClick={sendRentStatus}
            disabled={sendingStatus || !tenantEmail}
            title={!tenantEmail ? 'Tenant has no email on file' : 'Email full payment status to tenant'}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {sendingStatus ? 'Sending…' : '📧 Email Rent Status'}
          </button>
          <span className="text-xs text-slate-500">
            {sorted.length} cheque{sorted.length === 1 ? "" : "s"} · {contract.contractNo}
          </span>
        </div>
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-2 gap-2 px-6 pt-4 sm:grid-cols-5">
        {[
          { label: "Annual Rent", value: annualRent, tone: "slate" },
          { label: "Upfront Paid", value: upfrontTotal, tone: "blue", hint: `cash ${upfront.cash.toLocaleString()} + cheque ${upfront.chequeAmount.toLocaleString()}` },
          { label: "PDCs Saved", value: recordedPdcs, tone: "indigo", hint: `${sorted.filter(c => !!c.chequeNo && !(c.sequenceNo === 1 && c.paymentType === 'Upfront')).length} in hand` },
          { label: "Collected (Cleared)", value: collected, tone: "emerald", hint: "money in bank" },
          { label: "Remaining", value: remaining, tone: "amber" },
        ].map((p) => (
          <div
            key={p.label}
            className={`rounded-lg border p-3 ${
              p.tone === "emerald" ? "border-emerald-200 bg-emerald-50" :
              p.tone === "blue" ? "border-blue-200 bg-blue-50" :
              p.tone === "indigo" ? "border-indigo-200 bg-indigo-50" :
              p.tone === "amber" ? "border-amber-200 bg-amber-50" :
              "border-slate-200 bg-slate-50"
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{p.label}</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              AED {p.value.toLocaleString()}
            </p>
            {p.hint && <p className="text-[10px] text-slate-500 mt-0.5">{p.hint}</p>}
          </div>
        ))}
      </div>

      {/* Upfront payment card */}
      <div className="px-6 pt-5">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-blue-900">Upfront Payment</h3>
              {suggestedUpfront > 0 && (
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Suggested: AED {suggestedUpfront.toLocaleString()} (deposits + fees + 1st cheque).
                  Split between cash and cheque as tenant paid.
                </p>
              )}
            </div>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
              Total: AED {upfrontTotal.toLocaleString()}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Cash Amount (AED)</label>
                <input
                  type="number"
                  value={upfront.cash || ''}
                  onChange={(e) => { setUpfront({ ...upfront, cash: Number(e.target.value) }); setUpfrontDirty(true) }}
                  placeholder="e.g. 4000"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Cheque Amount (AED)</label>
                <input
                  type="number"
                  value={upfront.chequeAmount || ''}
                  onChange={(e) => { setUpfront({ ...upfront, chequeAmount: Number(e.target.value) }); setUpfrontDirty(true) }}
                  placeholder="e.g. 4000"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                />
              </div>
              {upfront.chequeAmount > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Cheque #</label>
                      <input
                        type="text"
                        value={upfront.chequeNo}
                        onChange={(e) => { setUpfront({ ...upfront, chequeNo: e.target.value }); setUpfrontDirty(true) }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Bank</label>
                      <input
                        type="text"
                        value={upfront.bankName}
                        onChange={(e) => { setUpfront({ ...upfront, bankName: e.target.value }); setUpfrontDirty(true) }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Cheque Date</label>
                    <input
                      type="date"
                      value={upfront.chequeDate}
                      onChange={(e) => { setUpfront({ ...upfront, chequeDate: e.target.value }); setUpfrontDirty(true) }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                    />
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Cheque Image {upfront.chequeAmount > 0 ? <span className="text-red-600">*</span> : <span className="text-slate-400">(only if cheque)</span>}
              </label>
              {upfrontCheqImg ? (
                <div className="relative rounded-lg border border-slate-200 bg-white p-2">
                  <img
                    src={`/api/documents/${upfrontCheqImg.id}/file`}
                    alt="Upfront cheque"
                    className="w-full rounded"
                    style={{ maxHeight: 220, objectFit: 'contain' }}
                  />
                  <label className="mt-2 inline-block cursor-pointer text-xs font-medium text-[#E30613] hover:underline">
                    Replace image
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && uploadChequeImage(e.target.files[0], 'Upfront-Cheque')}
                    />
                  </label>
                </div>
              ) : (
                <label className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white text-xs text-slate-500 hover:border-[#E30613] hover:text-[#E30613]">
                  <Upload className="h-5 w-5 mb-1" />
                  Click to upload cheque image
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadChequeImage(e.target.files[0], 'Upfront-Cheque')}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={saveUpfront}
              disabled={!upfrontDirty || saving}
              className="rounded-lg bg-[#E30613] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c20510] disabled:opacity-40"
            >
              {saving ? 'Saving…' : upfrontDirty ? 'Save Upfront' : 'Saved'}
            </button>
            <button
              onClick={() => { setReceiptMsg(''); setReceiptPreviewOpen(true) }}
              disabled={upfrontTotal === 0 || !!upfront.receiptSentAt}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              title={
                upfront.receiptSentAt
                  ? `Receipt confirmed on ${new Date(upfront.receiptSentAt).toLocaleString('en-GB')} — will be included in the activation email.`
                  : 'Generate the receipt slip; it will be included in the welcome email at activation.'
              }
            >
              {upfront.receiptSentAt ? 'Receipt Confirmed ✓' : 'Preview & Confirm Receipt'}
            </button>
            {upfront.receiptSentAt && (
              <span className="text-[11px] text-emerald-700">
                {upfront.receiptNo} — will be included in the welcome email
              </span>
            )}
            {receiptMsg && (
              <span className={`text-xs ${receiptMsg.startsWith('✓') ? 'text-emerald-700' : 'text-red-700'}`}>
                {receiptMsg}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cheque tabs — when an upfront cheque is paid, cheque #1 is consumed
          by the upfront card above and hidden here. PDC tabs = N − 1. */}
      {(() => {
        const upfrontHasCheque = upfront.chequeAmount > 0
        const pdcs = sorted.filter((c) => !(c.sequenceNo === 1 && upfrontHasCheque))
        // Clamp activeIdx so it points at a visible PDC after the list shrinks.
        if (activeIdx >= pdcs.length && pdcs.length > 0) {
          setActiveIdx(0)
        }
        return (
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Post-Dated Cheques (PDCs)
              </h4>
              <span className="text-[11px] text-slate-500">
                {pdcs.length} cheque{pdcs.length === 1 ? '' : 's'} to track
                {upfrontHasCheque && " · Cheque 1 was paid upfront ↑"}
              </span>
            </div>
            {pdcs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
                No PDCs to track — all rent collected via upfront.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {pdcs.map((c, i) => {
                  const filled = !!c.chequeNo
                  const cleared = c.status === "Cleared"
                  const bounced = c.status === "Bounced"
                  const isActive = i === activeIdx
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? "border-[#E30613] bg-[#E30613] text-white"
                          : bounced
                          ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                          : cleared
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : filled
                          ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Cheque {c.sequenceNo}
                      {cleared && " ✓"}
                      {bounced && " ✕"}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Active cheque form */}
      {active && (
        <div className="p-6 pt-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Cheque {active.sequenceNo} of {active.totalCheques}
              </p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                active.status === "Cleared" ? "bg-emerald-100 text-emerald-700" :
                active.status === "Deposited" ? "bg-blue-100 text-blue-700" :
                active.status === "Bounced" ? "bg-red-100 text-red-700" :
                active.status === "Replaced" ? "bg-amber-100 text-amber-700" :
                "bg-slate-100 text-slate-700"
              }`}>
                {active.status}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Left: form inputs */}
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Cheque Number</label>
                  <input
                    type="text"
                    value={edited.chequeNo}
                    onChange={(e) => setLocalEdits((m) => ({ ...m, [active.id]: { ...m[active.id], chequeNo: e.target.value } }))}
                    placeholder="e.g. 123456"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Bank</label>
                  <input
                    type="text"
                    value={edited.bankName}
                    onChange={(e) => setLocalEdits((m) => ({ ...m, [active.id]: { ...m[active.id], bankName: e.target.value } }))}
                    placeholder="e.g. Emirates NBD"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Due Date</label>
                    <input
                      type="date"
                      value={edited.chequeDate}
                      onChange={(e) => setLocalEdits((m) => ({ ...m, [active.id]: { ...m[active.id], chequeDate: e.target.value } }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">Amount (AED)</label>
                    <input
                      type="number"
                      value={edited.amount || ""}
                      onChange={(e) => setLocalEdits((m) => ({ ...m, [active.id]: { ...m[active.id], amount: Number(e.target.value) } }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>
              {/* Right: cheque image */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Cheque Image</label>
                {(() => {
                  const img = chequeImgByType(active.sequenceNo)
                  if (img) {
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-2">
                        <img
                          src={`/api/documents/${img.id}/file`}
                          alt={`Cheque ${active.sequenceNo}`}
                          className="w-full rounded"
                          style={{ maxHeight: 200, objectFit: 'contain' }}
                        />
                        <label className="mt-2 inline-block cursor-pointer text-xs font-medium text-[#E30613] hover:underline">
                          Replace image
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && uploadChequeImage(e.target.files[0], `Cheque-${active.sequenceNo}`)}
                          />
                        </label>
                      </div>
                    )
                  }
                  return (
                    <label className="flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 hover:border-[#E30613] hover:text-[#E30613]">
                      <Upload className="h-5 w-5 mb-1" />
                      Click to upload cheque image
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadChequeImage(e.target.files[0], `Cheque-${active.sequenceNo}`)}
                      />
                    </label>
                  )
                })()}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  saveCheque(active.id, {
                    chequeNo: edited.chequeNo,
                    bankName: edited.bankName,
                    chequeDate: edited.chequeDate,
                    amount: edited.amount,
                  })
                  setLocalEdits((m) => { const { [active.id]: _, ...rest } = m; void _; return rest })
                }}
                disabled={!dirty || saving}
                className="rounded-lg bg-[#E30613] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c20510] disabled:opacity-40"
              >
                {saving ? "Saving…" : dirty ? "Save changes" : (active.chequeNo ? "✓ Saved" : "Save")}
              </button>
              {!dirty && active.chequeNo && (
                <span className="text-[11px] text-slate-500">
                  Cheque details recorded — total PDCs in hand: AED {recordedPdcs.toLocaleString()}
                </span>
              )}

              <div className="ml-auto flex gap-2">
                {active.status === "Received" && (
                  <button
                    onClick={() => updateStatus(active.id, "Deposited")}
                    className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                  >
                    Mark Deposited
                  </button>
                )}
                {(active.status === "Received" || active.status === "Deposited") && (
                  <>
                    <button
                      onClick={() => updateStatus(active.id, "Cleared", { clearedDate: new Date().toISOString().split("T")[0] })}
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      Mark Cleared
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt("Bounce reason:")
                        if (reason) updateStatus(active.id, "Bounced", { bouncedReason: reason })
                      }}
                      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      Mark Bounced
                    </button>
                  </>
                )}
                {active.status === "Bounced" && (
                  <button
                    onClick={() => updateStatus(active.id, "Replaced")}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
                  >
                    Mark Replaced
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All PDCs at a glance — populates row by row as you save */}
      {visiblePdcs.length > 0 && (
        <div className="px-6 pt-2 pb-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            All PDCs — saved data
          </h4>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Cheque No.</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Bank</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Due Date</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {visiblePdcs.map((c, i) => {
                  // Merge any unsaved local edits so the table reflects what
                  // the user has typed in the form, even before clicking Save.
                  const e = localEdits[c.id] || {}
                  const view = {
                    chequeNo: e.chequeNo ?? c.chequeNo,
                    bankName: e.bankName ?? c.bankName,
                    chequeDate: e.chequeDate ?? c.chequeDate,
                    amount: e.amount ?? c.amount,
                  }
                  const hasLocalEdits = Object.keys(e).length > 0
                  const filled = !!view.chequeNo
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setActiveIdx(i)}
                      className={`cursor-pointer border-t border-slate-100 ${
                        i === activeIdx ? "bg-red-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-slate-700">
                        Cheque {c.sequenceNo}
                        {hasLocalEdits && <span className="ml-1 text-[10px] text-amber-600">●</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-900">
                        {view.chequeNo || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-900">
                        {view.bankName || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-900">
                        {view.chequeDate || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                        AED {(view.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            c.status === "Cleared"
                              ? "bg-emerald-100 text-emerald-700"
                              : c.status === "Bounced"
                              ? "bg-red-100 text-red-700"
                              : c.status === "Deposited"
                              ? "bg-blue-100 text-blue-700"
                              : hasLocalEdits
                              ? "bg-amber-100 text-amber-700"
                              : filled
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {hasLocalEdits ? "Unsaved" : filled ? c.status : "Not entered"}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={4} className="px-3 py-2 text-right font-semibold text-slate-700">
                    Total PDCs Saved (in hand)
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-indigo-700">
                    AED {recordedPdcs.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-slate-500">
                    {visiblePdcs.filter((c) => !!c.chequeNo).length} of {visiblePdcs.length} entered
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Receipt preview modal */}
      {receiptPreviewOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4"
          onClick={() => !sendingReceipt && setReceiptPreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Preview Payment Receipt</h3>
              <button
                onClick={() => !sendingReceipt && setReceiptPreviewOpen(false)}
                disabled={sendingReceipt}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >×</button>
            </div>

            {/* Printable receipt slip */}
            <div className="p-8">
              <div className="border-b-4 border-[#E30613] pb-3 mb-5 flex items-start justify-between">
                <div>
                  <h1 className="m-0 text-2xl font-bold text-[#E30613]">Payment Receipt</h1>
                  <p className="m-0 text-xs text-slate-500">Alwaan L.L.C.</p>
                </div>
                <div className="text-right">
                  <p className="m-0 text-[11px] text-slate-500">Receipt No.</p>
                  <p className="m-0 font-mono text-sm font-bold text-slate-900">{receiptNo}</p>
                  <p className="mt-1 m-0 text-[11px] text-slate-500">{receiptDate}</p>
                </div>
              </div>

              <p className="m-0 mb-3 text-sm text-slate-800">
                Dear {tenantName},
              </p>
              <p className="m-0 mb-4 text-sm text-slate-700">
                This is your official receipt for the upfront payment toward tenancy contract{" "}
                <strong>{contract.contractNo}</strong>.
              </p>

              <table className="w-full text-sm mb-4 border-collapse">
                <tbody>
                  <tr className="bg-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-500 w-2/5 border-b border-slate-200">Tenant</td>
                    <td className="px-3 py-2 text-xs text-slate-900 border-b border-slate-200">{tenantName}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-xs text-slate-500 border-b border-slate-200">Contract No.</td>
                    <td className="px-3 py-2 text-xs text-slate-900 border-b border-slate-200">{contract.contractNo} (v{contract.version})</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-500 border-b border-slate-200">Contract Period</td>
                    <td className="px-3 py-2 text-xs text-slate-900 border-b border-slate-200">{contract.contractStart} → {contract.contractEnd}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-xs text-slate-500 border-b border-slate-200">Annual Rent</td>
                    <td className="px-3 py-2 text-xs text-slate-900 border-b border-slate-200">AED {(contract.rentAmount || 0).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <h3 className="text-sm font-semibold text-slate-900 mt-5 mb-2">Payment Breakdown</h3>
              <table className="w-full text-sm border border-slate-200 rounded overflow-hidden">
                <tbody>
                  {upfront.cash > 0 && (
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-2 text-sm text-slate-800">Cash</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-slate-900">AED {upfront.cash.toLocaleString()}</td>
                    </tr>
                  )}
                  {upfront.chequeAmount > 0 && (
                    <tr className="border-b border-slate-200">
                      <td className="px-3 py-2 text-sm text-slate-800">
                        Cheque
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {[upfront.chequeNo && `Cheque #${upfront.chequeNo}`, upfront.bankName, upfront.chequeDate].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-semibold text-slate-900">AED {upfront.chequeAmount.toLocaleString()}</td>
                    </tr>
                  )}
                  <tr className="bg-red-50">
                    <td className="px-3 py-2 font-bold text-[#E30613]">Total Upfront Received</td>
                    <td className="px-3 py-2 text-right font-bold text-[#E30613] text-base">AED {upfrontTotal.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <p className="mt-4 text-[11px] text-slate-500">
                This is a system-generated receipt. Please retain for your records.
              </p>
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-3">
              {receiptMsg && (
                <span className={`mr-auto text-xs ${receiptMsg.startsWith("✓") ? "text-emerald-700" : "text-red-700"}`}>
                  {receiptMsg}
                </span>
              )}
              <button
                onClick={() => setReceiptPreviewOpen(false)}
                disabled={sendingReceipt}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={sendReceipt}
                disabled={sendingReceipt}
                className="rounded-lg bg-[#E30613] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c20510] disabled:opacity-40"
              >
                {sendingReceipt ? "Saving…" : "Confirm Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function EidImageCard({
  doc,
  label,
  onOpen,
}: {
  doc: { id: string; filename?: string; originalFilename?: string } | undefined
  label: string
  onOpen: (v: { url: string; label: string }) => void
}) {
  const isPdf = doc?.filename?.toLowerCase().endsWith('.pdf') || doc?.originalFilename?.toLowerCase().endsWith('.pdf') || false
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)

  const onWheel = (e: React.WheelEvent) => {
    if (!doc) return
    e.preventDefault()
    setScale((s) => Math.min(6, Math.max(1, s + (e.deltaY < 0 ? 0.2 : -0.2))))
  }
  const onDown = (e: React.MouseEvent) => {
    if (scale <= 1) return
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y }
  }
  const onMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    setPos({
      x: dragRef.current.px + (e.clientX - dragRef.current.sx),
      y: dragRef.current.py + (e.clientY - dragRef.current.sy),
    })
  }
  const onUp = () => { dragRef.current = null }
  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }) }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        {doc && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Zoom out"
              onClick={() => setScale((s) => Math.max(1, s - 0.25))}
              disabled={scale <= 1}
              className="h-7 w-7 rounded border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >−</button>
            <span className="rounded border border-slate-300 bg-white px-2 h-7 inline-flex items-center text-[11px] font-mono text-slate-700">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              title="Zoom in"
              onClick={() => setScale((s) => Math.min(6, s + 0.25))}
              className="h-7 w-7 rounded border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >+</button>
            <button
              type="button"
              title="Reset"
              onClick={reset}
              className="h-7 rounded border border-slate-300 bg-white px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >Reset</button>
            <button
              type="button"
              title="Full-screen"
              onClick={() => onOpen({ url: `/api/documents/${doc.id}/file`, label })}
              className="h-7 rounded border border-slate-300 bg-white px-2 text-[11px] font-medium text-[#E30613] hover:bg-red-50"
            >⤢</button>
          </div>
        )}
      </div>
      {doc && isPdf ? (
        <div className="relative overflow-hidden rounded-md border border-slate-200 bg-white" style={{ height: 260 }}>
          <iframe
            src={`/api/documents/${doc.id}/file?v=${doc.id}#toolbar=0&navpanes=0`}
            title={`Emirates ID ${label} PDF`}
            className="h-full w-full"
          />
          <a
            href={`/api/documents/${doc.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-2 right-2 rounded bg-[#E30613] px-2 py-1 text-[10px] font-semibold text-white shadow hover:bg-[#c20510]"
          >
            Open PDF
          </a>
        </div>
      ) : doc ? (
        <div
          className="relative overflow-hidden rounded-md border border-slate-200 bg-white"
          style={{ height: 260, cursor: scale > 1 ? (dragRef.current ? "grabbing" : "grab") : "zoom-in" }}
          onWheel={onWheel}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
        >
          <img
            src={`/api/documents/${doc.id}/file`}
            alt={`Emirates ID ${label}`}
            draggable={false}
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: 'contain',
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: dragRef.current ? 'none' : 'transform 80ms ease-out',
              userSelect: 'none',
            }}
          />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-xs text-slate-400">
          Not uploaded yet
        </div>
      )}
      {doc && (
        <p className="mt-1 text-[10px] text-slate-400 text-center">
          Scroll or use +/− to zoom · drag to pan · ⤢ for full screen
        </p>
      )}
    </div>
  )
}

function EidLightbox({
  value,
  onClose,
}: {
  value: { url: string; label: string }
  onClose: () => void
}) {
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(s + 0.25, 6))
      if (e.key === "-") setScale((s) => Math.max(s - 0.25, 0.5))
      if (e.key === "0") { setScale(1); setPos({ x: 0, y: 0 }) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setScale((s) => Math.min(6, Math.max(0.5, s + (e.deltaY < 0 ? 0.2 : -0.2))))
  }
  const onDown = (e: React.MouseEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y }
  }
  const onMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return
    setPos({ x: dragRef.current.px + (e.clientX - dragRef.current.sx), y: dragRef.current.py + (e.clientY - dragRef.current.sy) })
  }
  const onUp = () => { dragRef.current = null }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div
        className="absolute top-4 right-4 flex items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-white"
        >−</button>
        <span className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-mono text-slate-800">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale((s) => Math.min(6, s + 0.25))}
          className="rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-white"
        >+</button>
        <button
          onClick={() => { setScale(1); setPos({ x: 0, y: 0 }) }}
          className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-white"
        >Reset</button>
        <button
          onClick={onClose}
          className="rounded-lg bg-[#E30613] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#c20510]"
        >Close ✕</button>
      </div>
      <div className="absolute top-4 left-4 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-800">
        {value.label}
      </div>
      <div
        className="absolute bottom-4 left-4 rounded-lg bg-white/70 px-3 py-1.5 text-[11px] text-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        Scroll to zoom · drag to pan · + / − / 0 keys · Esc to close
      </div>
      <div
        className="h-full w-full flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
        style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
      >
        <img
          src={value.url}
          alt={value.label}
          draggable={false}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: "center center",
            maxWidth: "90vw",
            maxHeight: "90vh",
            transition: dragRef.current ? "none" : "transform 80ms ease-out",
            userSelect: "none",
          }}
        />
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

function ContractRow({
  contract,
  onSend,
  onSign,
  onCopyLink,
  onUpload,
}: {
  contract: TenancyContract
  onSend: () => void
  onSign: () => void
  onCopyLink: () => void
  onUpload: (file: File) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const statusColor: Record<string, string> = {
    Draft: "bg-slate-100 text-slate-700",
    Sent: "bg-blue-100 text-blue-700",
    Active: "bg-emerald-100 text-emerald-700",
    Renewed: "bg-indigo-100 text-indigo-700",
    Terminated: "bg-red-100 text-red-700",
    Cancelled: "bg-slate-100 text-slate-500",
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {contract.contractNo} <span className="text-xs font-normal text-slate-500">v{contract.version}</span>
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[contract.status] || "bg-slate-100 text-slate-700"}`}>{contract.status}</span>
        </p>
        <p className="text-xs text-slate-500">
          {contract.contractStart} → {contract.contractEnd} · {fmtAED(contract.rentAmount)} · {contract.contractType}
        </p>
        {contract.signedFileName && (
          <p className="mt-1 text-xs text-emerald-700">Signed copy: {contract.signedFileName}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/tenancy-contracts/${contract.id}?format=html`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <ExternalLink className="h-3 w-3" /> View
        </a>
        {contract.signatureToken && (
          <button onClick={onCopyLink} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Copy className="h-3 w-3" /> Sign Link
          </button>
        )}
        {contract.status !== "Active" && contract.status !== "Terminated" && (
          <>
            <button onClick={onSend} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <Send className="h-3 w-3" /> Send
            </button>
            <button onClick={onSign} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Mark Signed
            </button>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onUpload(f)
            e.target.value = ""
          }}
        />
        <button
          onClick={() => fileInput.current?.click()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Upload className="h-3 w-3" /> Upload Signed
        </button>
      </div>
    </div>
  )
}

function MandatoryDocBox({
  label,
  hint,
  accept,
  doc,
  onUpload,
  onDelete,
}: {
  label: string
  hint: string
  accept: string
  doc: { id: string; filename: string; originalFilename: string; uploadedAt: string } | undefined
  onUpload: (file: File) => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const uploaded = !!doc
  return (
    <div
      className={`relative rounded-xl border-2 p-4 transition-colors ${
        uploaded ? "border-emerald-300 bg-emerald-50" : "border-dashed border-slate-300 bg-slate-50"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {uploaded ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Upload className="h-4 w-4 text-slate-400" />
          )}
          <p className={`text-xs font-semibold ${uploaded ? "text-emerald-800" : "text-slate-700"}`}>{label}</p>
        </div>
        {uploaded && (
          <button
            onClick={onDelete}
            title="Remove document"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-red-500 shadow-sm hover:bg-red-50 hover:text-red-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {uploaded ? (
        <div className="space-y-2">
          <p className="truncate text-xs text-emerald-700" title={doc!.originalFilename || doc!.filename}>
            {doc!.originalFilename || doc!.filename}
          </p>
          <a
            href={`/api/documents/${doc!.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#E30613] underline hover:no-underline"
          >
            View file
          </a>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-500">{hint}</p>
          <button
            onClick={() => ref.current?.click()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-[#E30613] hover:text-[#E30613]"
          >
            <Upload className="h-3.5 w-3.5" /> Upload File
          </button>
          <input
            ref={ref}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ""
            }}
          />
        </>
      )}
    </div>
  )
}

function ChequesDocBox({
  docs,
  onUpload,
  onDelete,
}: {
  docs: { id: string; filename: string; originalFilename: string; uploadedAt: string }[]
  onUpload: (file: File) => void
  onDelete: (id: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [num, setNum] = useState<number>(4)
  const uploaded = docs.length > 0
  return (
    <div
      className={`relative rounded-xl border-2 p-4 transition-colors ${
        uploaded ? "border-emerald-300 bg-emerald-50" : "border-dashed border-slate-300 bg-slate-50"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {uploaded ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <Banknote className="h-4 w-4 text-slate-400" />
        )}
        <p className={`text-xs font-semibold ${uploaded ? "text-emerald-800" : "text-slate-700"}`}>
          Cheques / PDCs
        </p>
      </div>

      <div className="mb-2 flex items-center gap-2">
        <label className="text-xs text-slate-600">No. of Cheques</label>
        <input
          type="number"
          min={1}
          max={12}
          value={num}
          onChange={(e) => setNum(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
          className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-[#E30613] focus:outline-none"
        />
      </div>

      {uploaded && (
        <div className="mb-2 space-y-1">
          {docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-md bg-white/70 px-2 py-1 text-xs text-emerald-800"
            >
              <span className="truncate" title={d.originalFilename || d.filename}>
                {d.originalFilename || d.filename}
              </span>
              <button
                onClick={() => onDelete(d.id)}
                className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => ref.current?.click()}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-[#E30613] hover:text-[#E30613]"
      >
        <Upload className="h-3.5 w-3.5" />
        {uploaded ? "Add another scan" : "Upload Cheques Scan (PDF / Images)"}
      </button>
      <p className="mt-1.5 text-[11px] text-slate-500">
        Upload a single PDF containing all {num} cheques, or upload multiple files.
      </p>
      <input
        ref={ref}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          files.forEach((f) => onUpload(f))
          e.target.value = ""
        }}
      />
    </div>
  )
}

function OptionalDocRow({
  label,
  accept,
  doc,
  onUpload,
  onDelete,
}: {
  label: string
  accept: string
  doc?: { id: string; filename: string; originalFilename: string; uploadedAt: string }
  onUpload: (file: File) => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const uploaded = !!doc
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
        uploaded ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="min-w-0">
        <p className={`text-xs font-medium ${uploaded ? "text-emerald-800" : "text-slate-700"}`}>
          {label}
        </p>
        {uploaded && (
          <p className="truncate text-[11px] text-emerald-700" title={doc!.originalFilename || doc!.filename}>
            {doc!.originalFilename || doc!.filename}
          </p>
        )}
      </div>
      {uploaded ? (
        <button
          onClick={onDelete}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
          aria-label="Remove"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <>
          <button
            onClick={() => ref.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-[#E30613] hover:text-[#E30613]"
          >
            <Upload className="h-3 w-3" /> Upload
          </button>
          <input
            ref={ref}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onUpload(f)
              e.target.value = ""
            }}
          />
        </>
      )}
    </div>
  )
}

function AddOtherDoc({ onUpload }: { onUpload: (file: File, docType: string) => void }) {
  const [open, setOpen] = useState(false)
  const [docName, setDocName] = useState("")
  const ref = useRef<HTMLInputElement>(null)

  const pick = () => {
    if (!docName.trim()) return
    ref.current?.click()
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#E30613] hover:text-[#E30613]"
        >
          <Plus className="h-3.5 w-3.5" /> Add Other Document
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 md:flex-row md:items-center">
          <input
            type="text"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder="Document name (e.g. NOC, Power of Attorney)"
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-[#E30613] focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={pick}
              disabled={!docName.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-[#E30613] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#c20510] disabled:opacity-50"
            >
              <Upload className="h-3 w-3" /> Upload
            </button>
            <button
              onClick={() => { setOpen(false); setDocName("") }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
          <input
            ref={ref}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f && docName.trim()) {
                onUpload(f, docName.trim())
                setOpen(false)
                setDocName("")
              }
              e.target.value = ""
            }}
          />
        </div>
      )}
    </div>
  )
}

function DocUploadButton({ label, onSelect }: { label: string; onSelect: (file: File) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        onClick={() => ref.current?.click()}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:border-[#E30613] hover:text-[#E30613]"
      >
        <Upload className="h-3.5 w-3.5" /> {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onSelect(f)
          e.target.value = ""
        }}
      />
    </>
  )
}

// ─────────────────────────────────────────────
// EID Verification Panel
// ─────────────────────────────────────────────
const EID_REGEX = /^784-\d{4}-\d{7}-\d{1}$/

function EidVerifyPanel({
  tenant,
  onVerified,
}: {
  tenant: TenantFull
  onVerified: () => void
}) {
  const toast = useToast()
  const verified = !!tenant.eidVerifiedAt
  const [open, setOpen] = useState(!verified)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    eidNameEn: tenant.eidNameEn || tenant.name || "",
    eidNameAr: tenant.eidNameAr || "",
    eidNumber: tenant.eidNumber || tenant.emiratesId || "",
    eidDob: tenant.eidDob || "",
    nationality: tenant.nationality || "",
    eidExpiry: tenant.eidExpiry || tenant.emiratesIdExpiry || "",
    eidIssued: tenant.eidIssued || "",
    eidCardNumber: tenant.eidCardNumber || "",
  })

  if (verified && !open) {
    return (
      <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold">EID Verified</span>
            <span className="text-emerald-700">
              on {fmtDate(tenant.eidVerifiedAt || "")}
              {tenant.eidVerifiedBy ? ` by ${tenant.eidVerifiedBy}` : ""}
            </span>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="text-[11px] font-medium text-emerald-700 underline hover:text-emerald-900"
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  const upd = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const submit = async () => {
    if (!EID_REGEX.test(form.eidNumber.trim())) {
      toast.error("Invalid EID format. Expected 784-YYYY-NNNNNNN-N")
      return
    }
    // Name/EID mismatch warning with option to sync
    const nameMismatch =
      tenant.name && form.eidNameEn && tenant.name.trim().toLowerCase() !== form.eidNameEn.trim().toLowerCase()
    const eidMismatch = tenant.emiratesId && form.eidNumber && tenant.emiratesId.trim() !== form.eidNumber.trim()

    let syncToTenant = false
    if (nameMismatch || eidMismatch) {
      const parts: string[] = []
      if (nameMismatch) parts.push(`Name on EID ("${form.eidNameEn}") differs from tenant record ("${tenant.name}")`)
      if (eidMismatch) parts.push(`EID number ("${form.eidNumber}") differs from tenant record ("${tenant.emiratesId}")`)
      syncToTenant = confirm(
        `⚠️ ${parts.join("\n\n")}\n\nUpdate tenant record with the EID values? (OK = update tenant, Cancel = keep existing and just save EID data)`
      )
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/tenants/${tenant.id}/eid-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, syncToTenant }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      toast.success(
        data.warnings?.length
          ? `EID verified with warnings: ${data.warnings.join("; ")}`
          : "EID verified & saved"
      )
      setOpen(false)
      onVerified()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setSaving(false)
    }
  }

  const EID_LABEL = "mb-1 block text-[11px] font-medium text-slate-600"
  const EID_INPUT =
    "w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20"

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          <FileCheck className="h-3.5 w-3.5 text-[#E30613]" />
          Verify Emirates ID Data
        </div>
        {verified && (
          <button
            onClick={() => setOpen(false)}
            className="text-[11px] text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        )}
      </div>
      <p className="mb-2 text-[10px] italic text-slate-500">
        Future: AI-powered automatic data extraction coming soon. For now, please read the EID and enter the data manually.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className={EID_LABEL}>Full Name (English)</label>
          <input
            className={EID_INPUT}
            value={form.eidNameEn}
            onChange={(e) => upd({ eidNameEn: e.target.value })}
          />
        </div>
        <div>
          <label className={EID_LABEL}>Full Name (Arabic)</label>
          <input
            className={EID_INPUT}
            dir="rtl"
            value={form.eidNameAr}
            onChange={(e) => upd({ eidNameAr: e.target.value })}
          />
        </div>
        <div>
          <label className={EID_LABEL}>Emirates ID Number</label>
          <input
            className={EID_INPUT}
            placeholder="784-YYYY-NNNNNNN-N"
            value={form.eidNumber}
            onChange={(e) => upd({ eidNumber: e.target.value })}
          />
        </div>
        <div>
          <label className={EID_LABEL}>Date of Birth</label>
          <input
            type="date"
            className={EID_INPUT}
            value={form.eidDob}
            onChange={(e) => upd({ eidDob: e.target.value })}
          />
        </div>
        <div>
          <label className={EID_LABEL}>Nationality</label>
          <input
            className={EID_INPUT}
            value={form.nationality}
            readOnly
            title="Edit in Personal Details above"
          />
        </div>
        <div>
          <label className={EID_LABEL}>EID Expiry</label>
          <input
            type="date"
            className={EID_INPUT}
            value={form.eidExpiry}
            onChange={(e) => upd({ eidExpiry: e.target.value })}
          />
        </div>
        <div>
          <label className={EID_LABEL}>Issuing Date</label>
          <input
            type="date"
            className={EID_INPUT}
            value={form.eidIssued}
            onChange={(e) => upd({ eidIssued: e.target.value })}
          />
        </div>
        <div>
          <label className={EID_LABEL}>Card Number (back)</label>
          <input
            className={EID_INPUT}
            value={form.eidCardNumber}
            onChange={(e) => upd({ eidCardNumber: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#E30613] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#C20411] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          Save & Verify EID
        </button>
      </div>
    </div>
  )
}
