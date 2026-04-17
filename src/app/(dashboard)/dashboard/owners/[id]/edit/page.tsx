"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  ArrowLeft,
  Send,
  Upload,
  CheckCircle2,
  Rocket,
  FileText,
  Plus,
  X,
  ExternalLink,
  Download,
  Loader2,
  ChevronDown,
  ChevronRight,
  Landmark,
  Clock,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  AutoSaveIndicator,
  type AutoSaveStatus,
} from "@/components/ui/auto-save-indicator"
import { useToast } from "@/components/ui/toast"

/* ============================================================
 * Types (loose — mirrors existing Owner + ContractContent shapes)
 * ============================================================ */

interface Owner {
  id: string
  ownerName: string
  ownerType: string
  emiratesId: string
  passportNo: string
  nationality: string
  email: string
  phone: string
  alternatePhone: string
  address: string
  iban: string
  bankName: string
  tradeLicense: string
  buildingName: string
  buildingType: string
  emirate: string
  area: string
  plotNo: string
  makaniNo: string
  titleDeedNo: string
  totalUnits: number
  totalFloors: number
  yearBuilt: string
  serviceType: string
  leasingCommissionRes: number
  leasingCommissionCom: number
  managementFee: number
  contractStartDate: string
  contractEndDate: string
  contractTerm: string
  noticePeriodDays: number
  stage: string
  contractSentAt: string | null
  contractSignedAt: string | null
  emailSentAt: string | null
  livePMSDate: string | null
  signedByOwner: boolean
  signedByCRE: boolean
  dldContractNo: string
  dldStatus: string
  dldContractType: string
  dldSubmittedAt: string | null
  dldRegisteredAt: string | null
  dldPdfPath: string
  dldPdfName: string
  dldPdfSize: number
  dldPdfUploadedAt: string | null
  dldNotes: string
  [key: string]: unknown
}

interface DldData {
  dldContractNo: string
  dldStatus: string
  dldContractType: string
  dldSubmittedAt: string | null
  dldRegisteredAt: string | null
  dldPdfPath: string
  dldPdfName: string
  dldPdfSize: number
  dldPdfUploadedAt: string | null
  dldNotes: string
}

interface ContractVersion {
  id: string
  contractNo: string
  version: number
  status: string
  generatedAt: string
  sentAt: string | null
  sentToEmail: string
  signedAt: string | null
  signedByOwnerName: string
  signedByCREName: string
  ownerSignedAt: string | null
  creSignedAt: string | null
  ownerSignatureImage: string
  creSignatureImage: string
  ownerIpAddress: string
  signedFileName: string
  signedFilePath: string
  uploadedAt: string | null
  reason: string
  notes: string
}

interface ContractContent {
  preambleEn: string
  preambleAr: string
  services: Array<{ en: string; ar: string }>
  ownerObligations: Array<{ en: string; ar: string }>
  creObligations: Array<{ en: string; ar: string }>
  paymentToOwner: Array<{ en: string; ar: string }>
  termination: Array<{ en: string; ar: string }>
  confidentiality: Array<{ en: string; ar: string }>
  disputeResolution: Array<{ en: string; ar: string }>
  governingLaw: Array<{ en: string; ar: string }>
  [key: string]: unknown
}

/* ============================================================
 * Helpers
 * ============================================================ */

// Tiny debounce helper (lodash is not installed)
function useDebouncedCallback<T extends (...args: never[]) => void>(
  fn: T,
  delay: number
) {
  const ref = useRef<T>(fn)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    ref.current = fn
  }, [fn])
  return useCallback(
    (...args: Parameters<T>) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => ref.current(...args), delay)
    },
    [delay]
  )
}

const SERVICE_TYPES = [
  "Full Property Management",
  "Leasing Only / Brokerage",
  "Rent Collection Only",
  "Maintenance Only",
  "Hybrid (Custom)",
  "Sales Brokerage",
  "Snagging Service",
]

const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"]

const LABEL = "mb-1 block text-xs font-medium text-slate-600"
const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20"

/* ============================================================
 * Workflow stage helpers
 * ============================================================ */

type WorkflowStep = "info" | "contract" | "sent" | "signed" | "dld" | "live"

function computeStepStatus(
  owner: Owner | null,
  dld?: DldData | null
): Record<WorkflowStep, boolean> {
  if (!owner) {
    return {
      info: false,
      contract: false,
      sent: false,
      signed: false,
      dld: false,
      live: false,
    }
  }
  const info = Boolean(owner.ownerName && owner.email && owner.buildingName)
  const sent = Boolean(owner.contractSentAt || owner.emailSentAt)
  const signed = Boolean(owner.contractSignedAt || owner.signedByOwner)
  const live = owner.stage === "Live" || Boolean(owner.livePMSDate)
  const contract = info // contract exists by default once owner exists
  const dldStatus = dld?.dldStatus ?? owner.dldStatus
  const dldPdfPath = dld?.dldPdfPath ?? owner.dldPdfPath
  const dldDone = dldStatus === "Registered" && Boolean(dldPdfPath)
  return { info, contract, sent, signed, dld: dldDone, live }
}

function stageBadgeStyle(stage: string) {
  switch (stage) {
    case "Lead":
      return "bg-blue-50 text-blue-700 ring-blue-200"
    case "Proposal Sent":
      return "bg-amber-50 text-amber-700 ring-amber-200"
    case "Negotiation":
      return "bg-purple-50 text-purple-700 ring-purple-200"
    case "Contract Signed":
      return "bg-green-50 text-green-700 ring-green-200"
    case "Live":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200"
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200"
  }
}

/* ============================================================
 * Page
 * ============================================================ */

export default function OwnerEditPage() {
  const params = useParams<{ id: string }>()
  const ownerId = params.id
  const toast = useToast()

  const [owner, setOwner] = useState<Owner | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  // Form buffer (what the user is typing); syncs from owner on load
  const [form, setForm] = useState<Partial<Owner>>({})
  const [infoSaveStatus, setInfoSaveStatus] = useState<AutoSaveStatus>("idle")

  // Contract text
  const [contractContent, setContractContent] = useState<ContractContent | null>(null)
  const [contractSaveStatus, setContractSaveStatus] = useState<AutoSaveStatus>("idle")
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    services: true,
    ownerObligations: false,
    creObligations: false,
    paymentToOwner: false,
    termination: false,
    confidentiality: false,
    disputeResolution: false,
    governingLaw: false,
  })

  // Contract versions
  const [contracts, setContracts] = useState<ContractVersion[]>([])
  const [contractsLoading, setContractsLoading] = useState(false)
  const [showPrevVersions, setShowPrevVersions] = useState(false)

  // Action state
  const [actionLoading, setActionLoading] = useState<string>("")

  // DLD state
  const [dld, setDld] = useState<DldData | null>(null)
  const [dldForm, setDldForm] = useState<Partial<DldData>>({})
  const [dldSaveStatus, setDldSaveStatus] = useState<AutoSaveStatus>("idle")
  const [dldUploading, setDldUploading] = useState(false)

  const uploadInputRef = useRef<HTMLInputElement>(null)
  const dldFileInputRef = useRef<HTMLInputElement>(null)

  /* -------- load -------- */

  const loadOwner = useCallback(async () => {
    try {
      const res = await fetch(`/api/owners/${ownerId}`)
      if (!res.ok) throw new Error("Owner not found")
      const data: Owner = await res.json()
      setOwner(data)
      setForm(data)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error")
    }
  }, [ownerId])

  const loadContractContent = useCallback(async () => {
    try {
      const res = await fetch(`/api/owners/${ownerId}/contract-content`)
      if (!res.ok) return
      const data = await res.json()
      setContractContent(data.content)
    } catch {
      /* ignore */
    }
  }, [ownerId])

  const loadDld = useCallback(async () => {
    try {
      const res = await fetch(`/api/owners/${ownerId}/dld`)
      if (!res.ok) return
      const data: DldData = await res.json()
      setDld(data)
      setDldForm(data)
    } catch {
      /* ignore */
    }
  }, [ownerId])

  const loadContracts = useCallback(async () => {
    setContractsLoading(true)
    try {
      const res = await fetch(`/api/owners/${ownerId}/contracts`)
      if (res.ok) {
        const data = await res.json()
        setContracts(data.contracts || [])
      }
    } catch {
      /* ignore */
    } finally {
      setContractsLoading(false)
    }
  }, [ownerId])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      await Promise.all([loadOwner(), loadContractContent(), loadContracts(), loadDld()])
      setLoading(false)
    })()
  }, [loadOwner, loadContractContent, loadContracts, loadDld])

  /* -------- auto-save: owner info -------- */

  const saveOwnerPatch = useCallback(
    async (patch: Partial<Owner>) => {
      setInfoSaveStatus("saving")
      try {
        const res = await fetch(`/api/owners/${ownerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, ...patch }),
        })
        if (!res.ok) throw new Error("save failed")
        const updated = await res.json()
        setOwner(updated)
        setInfoSaveStatus("saved")
      } catch {
        setInfoSaveStatus("error")
      }
    },
    [ownerId, form]
  )

  const debouncedSaveOwner = useDebouncedCallback(saveOwnerPatch, 500)

  const updateField = (patch: Partial<Owner>) => {
    setForm((f) => ({ ...f, ...patch }))
  }

  const commitField = (patch: Partial<Owner>) => {
    // On blur — flush pending then save
    debouncedSaveOwner(patch)
  }

  /* -------- auto-save: contract content -------- */

  const saveContractContent = useCallback(
    async (next: ContractContent) => {
      setContractSaveStatus("saving")
      try {
        const res = await fetch(`/api/owners/${ownerId}/contract-content`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        })
        if (!res.ok) throw new Error("save failed")
        setContractSaveStatus("saved")
      } catch {
        setContractSaveStatus("error")
      }
    },
    [ownerId]
  )

  const debouncedSaveContract = useDebouncedCallback(saveContractContent, 600)

  const updateContract = (next: ContractContent) => {
    setContractContent(next)
    debouncedSaveContract(next)
  }

  /* -------- auto-save: DLD -------- */

  const saveDldPatch = useCallback(
    async (patch: Partial<DldData>) => {
      setDldSaveStatus("saving")
      try {
        const res = await fetch(`/api/owners/${ownerId}/dld`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error("save failed")
        const updated: DldData = await res.json()
        setDld(updated)
        setDldForm((f) => ({ ...f, ...updated }))
        setDldSaveStatus("saved")
      } catch {
        setDldSaveStatus("error")
      }
    },
    [ownerId]
  )

  const debouncedSaveDld = useDebouncedCallback(saveDldPatch, 500)

  const updateDldField = (patch: Partial<DldData>) => {
    setDldForm((f) => ({ ...f, ...patch }))
  }
  const commitDldField = (patch: Partial<DldData>) => {
    debouncedSaveDld(patch)
  }

  const handleDldStatusChange = async (status: string) => {
    updateDldField({ dldStatus: status })
    await saveDldPatch({ dldStatus: status })
  }

  const handleDldContractTypeChange = async (t: string) => {
    updateDldField({ dldContractType: t })
    await saveDldPatch({ dldContractType: t })
  }

  const handleDldUpload = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are allowed")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB limit")
      return
    }
    setDldUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/owners/${ownerId}/dld/upload`, {
        method: "POST",
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Upload failed")
      toast.success("DLD PDF uploaded")
      if (data.dld) {
        setDld(data.dld)
        setDldForm(data.dld)
      } else {
        await loadDld()
      }
      await loadOwner()
      // If owner already signed, send final package email (PM + DLD)
      if (owner?.contractSignedAt) {
        try {
          const fres = await fetch(`/api/owners/${ownerId}/send-final-package`, { method: "POST" })
          if (fres.ok) toast.success("Final package email sent to owner (PM + DLD)")
        } catch {
          /* non-blocking */
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setDldUploading(false)
    }
  }

  const handleDldRemove = async () => {
    if (!confirm("Remove the uploaded DLD PDF? This cannot be undone.")) return
    setDldUploading(true)
    try {
      const res = await fetch(`/api/owners/${ownerId}/dld/upload`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to remove")
      if (data.dld) {
        setDld(data.dld)
        setDldForm(data.dld)
      } else {
        await loadDld()
      }
      toast.success("DLD PDF removed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    } finally {
      setDldUploading(false)
    }
  }

  /* -------- derived -------- */

  const steps = useMemo(() => computeStepStatus(owner, dld), [owner, dld])
  const latestContract = contracts[0]
  const prevContracts = contracts.slice(1)
  // Find currently Active contract (may be older than the latest if a new amendment is pending)
  const activeContract = contracts.find(c => c.status === "Active")
  const hasPendingAmendment = activeContract && latestContract && latestContract.id !== activeContract.id
    && ["Draft", "Sent", "Changes Requested", "Signed"].includes(latestContract.status)

  /* -------- workflow actions -------- */

  const handleSend = async () => {
    if (!owner) return
    setActionLoading("send")
    try {
      // Generate a version first if none exists, then send
      let contractToSend = latestContract
      if (!contractToSend) {
        const gen = await fetch(`/api/owners/${ownerId}/contracts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Initial contract" }),
        })
        if (!gen.ok) throw new Error("Failed to generate contract")
        const genData = await gen.json().catch(() => ({}))
        contractToSend = genData.contract
        if (!contractToSend) {
          // Reload list to find newest
          const listRes = await fetch(`/api/owners/${ownerId}/contracts`)
          const listData = await listRes.json().catch(() => ({}))
          contractToSend = (listData.contracts || [])[0]
        }
        if (!contractToSend) throw new Error("Could not create contract version")
      }
      const res = await fetch(
        `/api/owners/${ownerId}/contracts/${contractToSend.id}/send`,
        { method: "POST" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to send email")
      toast.success(`Email sent to ${data.toEmail || owner.email}`)
      await loadContracts()
      await loadOwner()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send")
    } finally {
      setActionLoading("")
    }
  }

  const handleUpload = async (file: File) => {
    if (!latestContract) {
      toast.error("No contract version to attach to — send first.")
      return
    }
    setActionLoading("upload")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(
        `/api/owners/${ownerId}/contracts/${latestContract.id}/upload`,
        { method: "POST", body: fd }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Upload failed")
      }
      toast.success(`Uploaded ${file.name}`)
      await loadContracts()
      await loadOwner()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setActionLoading("")
    }
  }

  const handleMarkSigned = async () => {
    setActionLoading("sign")
    try {
      const res = await fetch(`/api/owners/${ownerId}/sign`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to mark signed")
      toast.success("Contract marked as signed")
      await loadContracts()
      await loadOwner()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    } finally {
      setActionLoading("")
    }
  }

  const handleActivate = async () => {
    if (
      !confirm(
        "This will mark the building as Live in the PMS. The owner can then begin operations. Continue?"
      )
    ) {
      return
    }
    setActionLoading("activate")
    try {
      const res = await fetch(`/api/owners/${ownerId}/activate`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to activate")
      toast.success("Building is now Live in PMS")
      await loadOwner()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    } finally {
      setActionLoading("")
    }
  }

  const handleGenerateNewVersion = async () => {
    setActionLoading("generate")
    try {
      const reason = latestContract?.status === "Changes Requested"
        ? "Amendment - updated per owner's change request"
        : "New version"
      const res = await fetch(`/api/owners/${ownerId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error("Failed to generate new version")
      const data = await res.json()
      const newCid = data.contract?.id
      toast.success(`New version ${data.contract?.contractNo} generated`)
      await loadContracts()
      // Auto-send the new version to owner if previous was Changes Requested
      if (newCid && latestContract?.status === "Changes Requested") {
        const sendRes = await fetch(`/api/owners/${ownerId}/contracts/${newCid}/send`, {
          method: "POST",
        })
        if (sendRes.ok) {
          toast.success(`Email sent to owner with updated contract`)
          await loadContracts()
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    } finally {
      setActionLoading("")
    }
  }

  const handleDeleteContract = async (contractId: string) => {
    setActionLoading("delete")
    try {
      const res = await fetch(`/api/owners/${ownerId}/contracts/${contractId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to delete contract")
      }
      toast.success("Contract deleted")
      await loadContracts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error")
    } finally {
      setActionLoading("")
    }
  }

  /* -------- clause editing helpers -------- */

  const updateClause = (
    section: keyof ContractContent,
    idx: number,
    patch: { en?: string; ar?: string }
  ) => {
    if (!contractContent) return
    const arr = (contractContent[section] as Array<{ en: string; ar: string }>).slice()
    arr[idx] = { ...arr[idx], ...patch }
    updateContract({ ...contractContent, [section]: arr })
  }

  const addClause = (section: keyof ContractContent) => {
    if (!contractContent) return
    const arr = (contractContent[section] as Array<{ en: string; ar: string }>).slice()
    arr.push({ en: "", ar: "" })
    updateContract({ ...contractContent, [section]: arr })
  }

  const removeClause = (section: keyof ContractContent, idx: number) => {
    if (!contractContent) return
    const arr = (contractContent[section] as Array<{ en: string; ar: string }>).slice()
    arr.splice(idx, 1)
    updateContract({ ...contractContent, [section]: arr })
  }

  /* -------- render -------- */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (loadError || !owner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
          {loadError || "Owner not found"}
          <div className="mt-3">
            <Link href="/dashboard/owners" className="text-sm font-medium underline">
              ← Back to owners
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const f = form as Owner

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* ================= Sticky header ================= */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <Link
            href="/dashboard/owners"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Owners
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold text-slate-900">
                {owner.ownerName}
                <span className="mx-2 text-slate-300">—</span>
                <span className="text-slate-700">{owner.buildingName}</span>
              </h1>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
                    stageBadgeStyle(owner.stage)
                  )}
                >
                  {owner.stage}
                </span>
                {owner.contractSentAt && (
                  <span className="text-xs text-slate-500">
                    Sent {formatDistanceToNow(new Date(owner.contractSentAt), { addSuffix: true })}
                  </span>
                )}
                {owner.contractSignedAt && (
                  <span className="text-xs text-emerald-600">
                    Signed{" "}
                    {formatDistanceToNow(new Date(owner.contractSignedAt), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <WorkflowActions
              owner={owner}
              actionLoading={actionLoading}
              onSend={handleSend}
              onUpload={() => uploadInputRef.current?.click()}
              onMarkSigned={handleMarkSigned}
              onActivate={handleActivate}
            />
          </div>

          {/* Progress stepper */}
          <Stepper steps={steps} className="mt-5" />
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleUpload(f)
            e.target.value = ""
          }}
        />
      </div>

      {/* ================= Main content ================= */}
      <div className="mx-auto max-w-6xl px-6 py-8 space-y-10">
        {/* -------- Section 1: Owner & Property Info -------- */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Owner & Property Information
              </h2>
              <p className="text-xs text-slate-500">
                Changes save automatically as you leave each field.
              </p>
            </div>
            <AutoSaveIndicator status={infoSaveStatus} />
          </div>

          <div className="grid grid-cols-1 gap-8 px-6 py-6 lg:grid-cols-2">
            {/* Owner column */}
            <div>
              <h3 className="mb-4 text-sm font-semibold text-slate-800">Owner Details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Owner Name *" value={f.ownerName} onChange={(v) => updateField({ ownerName: v })} onBlur={() => commitField({ ownerName: f.ownerName })} />
                <div>
                  <label className={LABEL}>Owner Type</label>
                  <select
                    className={INPUT}
                    value={f.ownerType || "Individual"}
                    onChange={(e) => {
                      updateField({ ownerType: e.target.value })
                      commitField({ ownerType: e.target.value })
                    }}
                  >
                    <option>Individual</option>
                    <option>Company</option>
                  </select>
                </div>
                <Field label="Emirates ID" value={f.emiratesId} onChange={(v) => updateField({ emiratesId: v })} onBlur={() => commitField({ emiratesId: f.emiratesId })} />
                <Field label="Passport No" value={f.passportNo} onChange={(v) => updateField({ passportNo: v })} onBlur={() => commitField({ passportNo: f.passportNo })} />
                <Field label="Nationality" value={f.nationality} onChange={(v) => updateField({ nationality: v })} onBlur={() => commitField({ nationality: f.nationality })} />
                <Field label="Email *" type="email" value={f.email} onChange={(v) => updateField({ email: v })} onBlur={() => commitField({ email: f.email })} />
                <Field label="Phone" value={f.phone} onChange={(v) => updateField({ phone: v })} onBlur={() => commitField({ phone: f.phone })} />
                <Field label="Alternate Phone" value={f.alternatePhone} onChange={(v) => updateField({ alternatePhone: v })} onBlur={() => commitField({ alternatePhone: f.alternatePhone })} />
                <div className="sm:col-span-2">
                  <Field label="Address" value={f.address} onChange={(v) => updateField({ address: v })} onBlur={() => commitField({ address: f.address })} />
                </div>
                <Field label="IBAN" value={f.iban} onChange={(v) => updateField({ iban: v })} onBlur={() => commitField({ iban: f.iban })} />
                <Field label="Bank Name" value={f.bankName} onChange={(v) => updateField({ bankName: v })} onBlur={() => commitField({ bankName: f.bankName })} />
              </div>
            </div>

            {/* Property column */}
            <div>
              <h3 className="mb-4 text-sm font-semibold text-slate-800">Building Details</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Building Name *" value={f.buildingName} onChange={(v) => updateField({ buildingName: v })} onBlur={() => commitField({ buildingName: f.buildingName })} />
                <div>
                  <label className={LABEL}>Building Type</label>
                  <select
                    className={INPUT}
                    value={f.buildingType || "Residential"}
                    onChange={(e) => {
                      updateField({ buildingType: e.target.value })
                      commitField({ buildingType: e.target.value })
                    }}
                  >
                    <option>Residential</option>
                    <option>Commercial</option>
                    <option>Mixed-Use</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Emirate</label>
                  <select
                    className={INPUT}
                    value={f.emirate || "Dubai"}
                    onChange={(e) => {
                      updateField({ emirate: e.target.value })
                      commitField({ emirate: e.target.value })
                    }}
                  >
                    {EMIRATES.map((em) => (
                      <option key={em}>{em}</option>
                    ))}
                  </select>
                </div>
                <Field label="Area" value={f.area} onChange={(v) => updateField({ area: v })} onBlur={() => commitField({ area: f.area })} />
                <Field label="Plot No" value={f.plotNo} onChange={(v) => updateField({ plotNo: v })} onBlur={() => commitField({ plotNo: f.plotNo })} />
                <Field label="Makani No" value={f.makaniNo} onChange={(v) => updateField({ makaniNo: v })} onBlur={() => commitField({ makaniNo: f.makaniNo })} />
                <Field label="Title Deed No" value={f.titleDeedNo} onChange={(v) => updateField({ titleDeedNo: v })} onBlur={() => commitField({ titleDeedNo: f.titleDeedNo })} />
                <Field
                  label="Total Units"
                  type="number"
                  value={String(f.totalUnits ?? 0)}
                  onChange={(v) => updateField({ totalUnits: Number(v) || 0 })}
                  onBlur={() => commitField({ totalUnits: Number(f.totalUnits) || 0 })}
                />
                <Field
                  label="Total Floors"
                  type="number"
                  value={String(f.totalFloors ?? 0)}
                  onChange={(v) => updateField({ totalFloors: Number(v) || 0 })}
                  onBlur={() => commitField({ totalFloors: Number(f.totalFloors) || 0 })}
                />
                <Field label="Year Built" value={f.yearBuilt} onChange={(v) => updateField({ yearBuilt: v })} onBlur={() => commitField({ yearBuilt: f.yearBuilt })} />
              </div>
            </div>
          </div>

          {/* Contract Terms row */}
          <div className="border-t border-slate-100 px-6 py-6">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Contract Terms</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
              <div className="col-span-2">
                <label className={LABEL}>Service Type</label>
                <select
                  className={INPUT}
                  value={f.serviceType || SERVICE_TYPES[0]}
                  onChange={(e) => {
                    updateField({ serviceType: e.target.value })
                    commitField({ serviceType: e.target.value })
                  }}
                >
                  {SERVICE_TYPES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <Field label="Start Date" type="date" value={(f.contractStartDate || "").slice(0, 10)} onChange={(v) => updateField({ contractStartDate: v })} onBlur={() => commitField({ contractStartDate: f.contractStartDate })} />
              <Field label="End Date" type="date" value={(f.contractEndDate || "").slice(0, 10)} onChange={(v) => updateField({ contractEndDate: v })} onBlur={() => commitField({ contractEndDate: f.contractEndDate })} />
              <Field label="Term" value={f.contractTerm} onChange={(v) => updateField({ contractTerm: v })} onBlur={() => commitField({ contractTerm: f.contractTerm })} />
              <Field
                label="Notice Days"
                type="number"
                value={String(f.noticePeriodDays ?? 60)}
                onChange={(v) => updateField({ noticePeriodDays: Number(v) || 0 })}
                onBlur={() => commitField({ noticePeriodDays: Number(f.noticePeriodDays) || 0 })}
              />
              <Field
                label="Comm. Res %"
                type="number"
                value={String(f.leasingCommissionRes ?? 0)}
                onChange={(v) => updateField({ leasingCommissionRes: Number(v) || 0 })}
                onBlur={() => commitField({ leasingCommissionRes: Number(f.leasingCommissionRes) || 0 })}
              />
              <Field
                label="Comm. Com %"
                type="number"
                value={String(f.leasingCommissionCom ?? 0)}
                onChange={(v) => updateField({ leasingCommissionCom: Number(v) || 0 })}
                onBlur={() => commitField({ leasingCommissionCom: Number(f.leasingCommissionCom) || 0 })}
              />
              <Field
                label="Mgmt Fee %"
                type="number"
                value={String(f.managementFee ?? 0)}
                onChange={(v) => updateField({ managementFee: Number(v) || 0 })}
                onBlur={() => commitField({ managementFee: Number(f.managementFee) || 0 })}
              />
            </div>
          </div>
        </section>

        {/* -------- Section 1.5: Simple DLD Contract Upload -------- */}
        <SimpleDldCard
          dld={dld}
          uploading={dldUploading}
          ownerSigned={Boolean(owner.contractSignedAt)}
          onUploadClick={() => dldFileInputRef.current?.click()}
          onRemove={handleDldRemove}
          ownerId={ownerId}
        />
        <input
          ref={dldFileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleDldUpload(file)
            e.target.value = ""
          }}
        />

        {/* -------- Section 2: Contract Preview & Editor -------- */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#E30613]" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Property Management Agreement
                </h2>
                <p className="text-xs text-slate-500">
                  Click any text to edit. Changes save automatically.
                </p>
              </div>
            </div>
            <AutoSaveIndicator status={contractSaveStatus} />
          </div>

          {!contractContent ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Loading contract…
            </div>
          ) : (
            <div className="space-y-5 px-6 py-6">
              {/* Preamble */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Preamble
                </h3>
                <BilingualTextarea
                  en={contractContent.preambleEn}
                  ar={contractContent.preambleAr}
                  onChange={(en, ar) =>
                    updateContract({ ...contractContent, preambleEn: en, preambleAr: ar })
                  }
                />
              </div>

              {/* Sections */}
              {(
                [
                  ["services", "Services Provided"],
                  ["ownerObligations", "Owner Obligations"],
                  ["creObligations", "CRE Obligations"],
                  ["paymentToOwner", "Payment to Owner"],
                  ["termination", "Termination"],
                  ["confidentiality", "Confidentiality"],
                  ["disputeResolution", "Dispute Resolution"],
                  ["governingLaw", "Governing Law"],
                ] as Array<[keyof ContractContent, string]>
              ).map(([key, title]) => {
                const clauses = (contractContent[key] as Array<{ en: string; ar: string }>) || []
                const open = openSections[key as string]
                return (
                  <div key={key as string} className="rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenSections((s) => ({ ...s, [key as string]: !s[key as string] }))
                      }
                      className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400" />
                        )}
                        <span className="text-sm font-semibold text-slate-800">{title}</span>
                        <span className="text-xs text-slate-400">({clauses.length})</span>
                      </div>
                    </button>

                    {open && (
                      <div className="space-y-3 border-t border-slate-100 px-4 py-4">
                        {clauses.map((c, idx) => (
                          <div
                            key={idx}
                            className="group relative rounded-lg border border-slate-200 bg-slate-50 p-3"
                          >
                            <button
                              type="button"
                              onClick={() => removeClause(key, idx)}
                              className="absolute right-2 top-2 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                              title="Delete clause"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  English
                                </label>
                                <textarea
                                  className="w-full resize-y rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20"
                                  rows={2}
                                  value={c.en}
                                  onChange={(e) => updateClause(key, idx, { en: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  العربية
                                </label>
                                <textarea
                                  dir="rtl"
                                  className="w-full resize-y rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20"
                                  rows={2}
                                  value={c.ar}
                                  onChange={(e) => updateClause(key, idx, { ar: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addClause(key)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-[#E30613] hover:text-[#E30613]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Clause
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* -------- Section 3: Contract Versions -------- */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Contract Versions</h2>
              <p className="text-xs text-slate-500">
                Generated PDFs, send/sign status, and signed uploads.
              </p>
            </div>
            {latestContract && (
              <button
                onClick={handleGenerateNewVersion}
                disabled={actionLoading === "generate"}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60",
                  latestContract.status === "Changes Requested"
                    ? "bg-amber-600 hover:bg-amber-700 animate-pulse"
                    : "bg-[#E30613] hover:bg-[#c20510]"
                )}
              >
                {actionLoading === "generate" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {latestContract.status === "Changes Requested"
                  ? "Generate Updated Version + Resend"
                  : "Generate New Version"}
              </button>
            )}
          </div>

          <div className="px-6 py-6">
            {contractsLoading ? (
              <div className="py-6 text-center text-sm text-slate-500">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            ) : !latestContract ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-6 py-8 text-center">
                <p className="text-sm text-slate-500">
                  No contract generated yet. Click{" "}
                  <span className="font-semibold text-slate-700">Send to Owner</span> above to
                  generate and email the first version.
                </p>
              </div>
            ) : (
              <>
                {/* Amendment-in-progress banner */}
                {hasPendingAmendment && (
                  <div className="mb-4 rounded-xl border-2 border-blue-300 bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">📝</div>
                      <div className="flex-1">
                        <div className="font-bold text-blue-900">Amendment In Progress</div>
                        <div className="mt-1 text-sm text-blue-900/90">
                          The original contract <strong>{activeContract!.contractNo}</strong> is still <strong>Active and legally valid</strong>.
                          A new amendment <strong>{latestContract.contractNo} v{latestContract.version}</strong> is being processed.
                          Once the owner signs the amendment and CRE counter-signs, the original will be automatically marked Superseded.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <ContractCard
                  ownerId={ownerId}
                  contract={latestContract}
                  isLatest
                  onMarkSigned={handleMarkSigned}
                  onDelete={handleDeleteContract}
                  actionLoading={actionLoading}
                />

                {/* Show currently Active contract (when newer is pending amendment) */}
                {hasPendingAmendment && activeContract && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-semibold text-emerald-700">✓ Currently Active Signed Contract</p>
                    <ContractCard
                      ownerId={ownerId}
                      contract={activeContract}
                      isLatest={false}
                      actionLoading={actionLoading}
                    />
                  </div>
                )}
              </>
            )}

            {prevContracts.length > 0 && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowPrevVersions((s) => !s)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  {showPrevVersions ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {showPrevVersions ? "Hide" : "Show"} previous versions ({prevContracts.length})
                </button>
                {showPrevVersions && (
                  <div className="mt-3 space-y-3">
                    {prevContracts.filter(c => !hasPendingAmendment || c.id !== activeContract?.id).map((c) => (
                      <ContractCard
                        key={c.id}
                        ownerId={ownerId}
                        contract={c}
                        isLatest={false}
                        onDelete={handleDeleteContract}
                        actionLoading={actionLoading}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/* ============================================================
 * Subcomponents
 * ============================================================ */

function Field({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
}: {
  label: string
  value: string | undefined
  onChange: (v: string) => void
  onBlur?: () => void
  type?: string
}) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      <input
        type={type}
        className={INPUT}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </div>
  )
}

function BilingualTextarea({
  en,
  ar,
  onChange,
}: {
  en: string
  ar: string
  onChange: (en: string, ar: string) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <textarea
        className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#E30613] focus:bg-white focus:ring-2 focus:ring-[#E30613]/20"
        rows={4}
        value={en}
        onChange={(e) => onChange(e.target.value, ar)}
      />
      <textarea
        dir="rtl"
        className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#E30613] focus:bg-white focus:ring-2 focus:ring-[#E30613]/20"
        rows={4}
        value={ar}
        onChange={(e) => onChange(en, e.target.value)}
      />
    </div>
  )
}

function Stepper({
  steps,
  className,
}: {
  steps: Record<WorkflowStep, boolean>
  className?: string
}) {
  const items: Array<{ key: WorkflowStep; label: string }> = [
    { key: "info", label: "Info" },
    { key: "contract", label: "Contract" },
    { key: "sent", label: "Sent" },
    { key: "signed", label: "Signed" },
    { key: "dld", label: "DLD Registered" },
    { key: "live", label: "Live" },
  ]
  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto", className)}>
      {items.map((it, idx) => {
        const done = steps[it.key]
        return (
          <div key={it.key} className="flex items-center gap-1">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1",
                done
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-slate-50 text-slate-500 ring-slate-200"
              )}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-slate-300" />
              )}
              {it.label}
            </div>
            {idx < items.length - 1 && (
              <span
                className={cn(
                  "h-px w-6",
                  done ? "bg-emerald-300" : "bg-slate-200"
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function WorkflowActions({
  owner,
  actionLoading,
  onSend,
  onUpload,
  onMarkSigned,
  onActivate,
}: {
  owner: Owner
  actionLoading: string
  onSend: () => void
  onUpload: () => void
  onMarkSigned: () => void
  onActivate: () => void
}) {
  const sent = Boolean(owner.contractSentAt || owner.emailSentAt)
  const signed = Boolean(owner.contractSignedAt || owner.signedByOwner)
  const live = owner.stage === "Live" || Boolean(owner.livePMSDate)

  if (live) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 className="h-4 w-4" />
        Agreement Active — Building Live
      </div>
    )
  }

  if (signed) {
    return (
      <button
        onClick={onActivate}
        disabled={actionLoading === "activate"}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
      >
        {actionLoading === "activate" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4" />
        )}
        Activate Building
      </button>
    )
  }

  if (sent) {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onUpload}
          disabled={actionLoading === "upload"}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {actionLoading === "upload" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload Signed PDF
        </button>
        <button
          onClick={onMarkSigned}
          disabled={actionLoading === "sign"}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-60"
        >
          {actionLoading === "sign" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Mark Signed
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onSend}
      disabled={actionLoading === "send"}
      className="inline-flex items-center gap-2 rounded-lg bg-[#E30613] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#c20510] disabled:opacity-60"
    >
      {actionLoading === "send" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
      Send to Owner
    </button>
  )
}

function ContractCard({
  ownerId,
  contract,
  isLatest,
  onMarkSigned,
  onDelete,
  actionLoading,
}: {
  ownerId: string
  contract: ContractVersion
  isLatest: boolean
  onMarkSigned?: () => void
  onDelete?: (contractId: string) => void
  actionLoading: string
}) {
  const statusColor =
    contract.status === "Active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : contract.status === "Signed"
      ? "bg-green-50 text-green-700 ring-green-200"
      : contract.status === "Sent"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : contract.status === "Changes Requested"
      ? "bg-amber-100 text-amber-800 ring-amber-300"
      : contract.status === "Draft"
      ? "bg-slate-50 text-slate-700 ring-slate-200"
      : "bg-slate-50 text-slate-700 ring-slate-200"

  // Parse change request note from contract.notes (prepended by API)
  const changeRequest = contract.status === "Changes Requested" && contract.notes
    ? contract.notes.split("---")[0]?.trim()
    : null

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-5",
        isLatest ? "border-slate-300 shadow-sm" : "border-slate-200",
        contract.status === "Changes Requested" ? "ring-2 ring-amber-300" : ""
      )}
    >
      {/* Prominent banner when owner requested changes */}
      {changeRequest && isLatest && (
        <div className="mb-4 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⚠️</div>
            <div className="flex-1">
              <div className="font-bold text-amber-900">Owner Requested Changes</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-amber-900/90">
                {changeRequest}
              </div>
              <div className="mt-3 text-xs text-amber-800">
                <strong>What to do:</strong> Scroll down to <strong>Section 2 (Contract Preview)</strong> to
                edit the clauses, then click <strong>&quot;+ Generate New Version&quot;</strong> below.
                The updated contract will auto-email the owner.
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              {contract.contractNo}
            </span>
            <span className="text-xs text-slate-500">v{contract.version}</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                statusColor
              )}
            >
              {contract.status}
            </span>
            {isLatest && (
              <span className="rounded-full bg-[#E30613]/10 px-2 py-0.5 text-[11px] font-medium text-[#E30613]">
                Latest
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Generated{" "}
            {formatDistanceToNow(new Date(contract.generatedAt), { addSuffix: true })}
            {contract.reason && ` · ${contract.reason}`}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <StatusPill label="Sent" done={!!contract.sentAt} />
            <StatusPill label="Owner Signed" done={!!contract.ownerSignedAt} />
            <StatusPill label="CRE Signed" done={!!contract.creSignedAt} />
            <StatusPill label="PDF Uploaded" done={!!contract.uploadedAt} />
          </div>

          {/* Signature display */}
          {(contract.ownerSignatureImage || contract.creSignatureImage) && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {contract.ownerSignatureImage && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-900">✍️ Owner Signature</span>
                    <span className="text-[10px] text-emerald-700">
                      {contract.ownerSignedAt && formatDistanceToNow(new Date(contract.ownerSignedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="rounded bg-white p-2 border border-emerald-100">
                    <img src={contract.ownerSignatureImage} alt="Owner signature" className="mx-auto max-h-20" />
                  </div>
                  <div className="mt-2 text-[10px] text-emerald-800">
                    Signed by: <strong>{contract.signedByOwnerName || '—'}</strong>
                    {contract.ownerIpAddress && <> · IP: {contract.ownerIpAddress}</>}
                  </div>
                </div>
              )}
              {contract.creSignatureImage ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-900">🤝 CRE Counter-Signature</span>
                    <span className="text-[10px] text-emerald-700">
                      {contract.creSignedAt && formatDistanceToNow(new Date(contract.creSignedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="rounded bg-white p-2 border border-emerald-100">
                    <img src={contract.creSignatureImage} alt="CRE signature" className="mx-auto max-h-20" />
                  </div>
                  <div className="mt-2 text-[10px] text-emerald-800">
                    Signed by: <strong>{contract.signedByCREName || '—'}</strong>
                  </div>
                </div>
              ) : contract.ownerSignatureImage ? (
                <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-3 flex flex-col items-center justify-center text-center">
                  <div className="text-xs font-semibold text-amber-900 mb-1">⏳ Awaiting CRE Counter-Signature</div>
                  <div className="text-[10px] text-amber-700">Click the button at top to counter-sign</div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/owners/${ownerId}/contracts/${contract.id}?format=html`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Contract
          </a>
          {contract.signedFilePath && (
            <a
              href={contract.signedFilePath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <Download className="h-3.5 w-3.5" />
              Download Signed
            </a>
          )}
          {isLatest && contract.sentAt && !contract.signedAt && onMarkSigned && (
            <button
              onClick={onMarkSigned}
              disabled={actionLoading === "sign"}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark Signed
            </button>
          )}
          {onDelete && contract.status === "Draft" && (
            <button
              onClick={() => {
                if (confirm(`Delete contract ${contract.contractNo} v${contract.version}? This cannot be undone.`)) {
                  onDelete(contract.id)
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              <X className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>

      {contract.signedFileName && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Uploaded: <span className="font-medium">{contract.signedFileName}</span>
        </div>
      )}
    </div>
  )
}

/* ============================================================
 * DLD Section — Dubai Land Department Official Registration
 * ============================================================ */

const DLD_STATUSES: Array<{ value: string; label: string }> = [
  { value: "Not Registered", label: "Not Registered" },
  { value: "In Progress", label: "In Progress" },
  { value: "Registered", label: "Registered" },
  { value: "Rejected", label: "Rejected" },
]

const DLD_CONTRACT_TYPES: Array<{ value: string; label: string; hint: string }> = [
  { value: "PM Building", label: "PM Contract (Building)", hint: "Whole-building property management" },
  { value: "PM Unit", label: "PM Contract (Unit)", hint: "Single-unit property management" },
  { value: "Lease & Sublease", label: "Lease & Sublease Contract", hint: "Master lease / sublease agreement" },
]

function dldStatusStyle(status: string) {
  switch (status) {
    case "Registered":
      return "bg-green-50 text-green-700 ring-green-200"
    case "In Progress":
      return "bg-amber-50 text-amber-700 ring-amber-200"
    case "Rejected":
      return "bg-red-50 text-red-700 ring-red-200"
    default:
      return "bg-slate-100 text-slate-700 ring-slate-300"
  }
}

function formatBytes(n: number) {
  if (!n) return "0 B"
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function SimpleDldCard({
  dld,
  uploading,
  ownerSigned,
  onUploadClick,
  onRemove,
  ownerId,
}: {
  dld: DldData | null
  uploading: boolean
  ownerSigned: boolean
  onUploadClick: () => void
  onRemove: () => void
  ownerId: string
}) {
  const hasPdf = Boolean(dld?.dldPdfPath)

  return (
    <section className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm sm:p-6">
      <div className="mb-3 flex items-center gap-2">
        <Landmark className="h-5 w-5 text-blue-700" />
        <h2 className="text-base font-semibold text-slate-900">DLD Contract (Dubai Land Department)</h2>
      </div>
      <p className="mb-4 text-sm text-slate-600">
        {hasPdf
          ? "The official DLD-stamped contract PDF is on file. Both parties have a complete record."
          : ownerSigned
          ? "Owner has signed the PM Agreement. Upload the DLD-stamped official contract PDF now — owner will receive an email with both documents as a final package."
          : "Once the owner signs the PM Agreement, upload the DLD-stamped official contract PDF here. Owner will receive a final email with both documents."}
      </p>

      {!hasPdf ? (
        <button
          type="button"
          onClick={onUploadClick}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Upload DLD Contract PDF"}
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-blue-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <div>
              <div className="text-sm font-semibold text-slate-900">{dld?.dldPdfName || "DLD Contract.pdf"}</div>
              <div className="text-xs text-slate-500">
                {dld?.dldPdfSize ? `${(dld.dldPdfSize / 1024).toFixed(1)} KB · ` : ""}
                Uploaded {dld?.dldPdfUploadedAt ? formatDistanceToNow(new Date(dld.dldPdfUploadedAt), { addSuffix: true }) : ""}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/owners/${ownerId}/dld/download`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
            <button
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              <X className="h-3.5 w-3.5" /> Replace
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

// Old complex DLD section - kept for backwards compat but no longer rendered
function DldSectionLegacy({
  dld,
  dldForm,
  saveStatus,
  uploading,
  onUpdateField,
  onCommitField,
  onStatusChange,
  onContractTypeChange,
  onUploadClick,
  onRemove,
  ownerId,
}: {
  dld: DldData | null
  dldForm: Partial<DldData>
  saveStatus: AutoSaveStatus
  uploading: boolean
  onUpdateField: (patch: Partial<DldData>) => void
  onCommitField: (patch: Partial<DldData>) => void
  onStatusChange: (s: string) => void
  onContractTypeChange: (t: string) => void
  onUploadClick: () => void
  onRemove: () => void
  ownerId: string
}) {
  const status = dldForm.dldStatus ?? dld?.dldStatus ?? "Not Registered"
  const contractType =
    dldForm.dldContractType ?? dld?.dldContractType ?? "PM Building"
  const contractNo = dldForm.dldContractNo ?? dld?.dldContractNo ?? ""
  const notes = dldForm.dldNotes ?? dld?.dldNotes ?? ""
  const registeredAt =
    (dldForm.dldRegisteredAt ?? dld?.dldRegisteredAt ?? "") || ""

  const hasPdf = Boolean(dld?.dldPdfPath)
  const pdfName = dld?.dldPdfName || ""
  const pdfSize = dld?.dldPdfSize || 0
  const pdfUploadedAt = dld?.dldPdfUploadedAt

  // Step progress flags
  const stepPortalOpen = status !== "Not Registered" || Boolean(contractNo) || hasPdf
  const stepSubmitted = status === "In Progress" || status === "Registered" || Boolean(contractNo)
  const stepContractNo = Boolean(contractNo)
  const stepPdf = hasPdf

  return (
    <section className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-blue-50/70 via-slate-50 to-white shadow-sm">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-blue-200 bg-gradient-to-r from-blue-100/80 to-slate-100/60 px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm ring-1 ring-blue-900/20">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-blue-900">
              Official DLD Registration
            </h2>
            <p className="text-xs text-blue-800/70">
              Dubai Land Department official property management contract
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1",
              dldStatusStyle(status)
            )}
          >
            {status === "Registered" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : status === "In Progress" ? (
              <Clock className="h-3.5 w-3.5" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-current opacity-70" />
            )}
            {status}
            {status === "Registered" && registeredAt && (
              <span className="ml-1 font-normal opacity-80">
                · {new Date(registeredAt).toLocaleDateString()}
              </span>
            )}
          </span>
          <AutoSaveIndicator status={saveStatus} />
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        {/* Progress stepper */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-white/70 px-4 py-3">
          <DldStep label="Open Portal" done={stepPortalOpen} />
          <DldStepConnector done={stepPortalOpen} />
          <DldStep label="Submit to DLD" done={stepSubmitted} />
          <DldStepConnector done={stepSubmitted} />
          <DldStep label="Receive Contract No" done={stepContractNo} />
          <DldStepConnector done={stepContractNo} />
          <DldStep label="Upload PDF" done={stepPdf} />
        </div>

        {/* Status + Contract Type row */}
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-blue-200 bg-white p-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-blue-900">
              Registration Status
            </label>
            <div className="flex flex-wrap gap-2">
              {DLD_STATUSES.map((s) => {
                const active = status === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => onStatusChange(s.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-blue-700 bg-blue-700 text-white shadow-sm"
                        : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-900"
                    )}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-blue-900">
              Contract Type
            </label>
            <div className="space-y-1.5">
              {DLD_CONTRACT_TYPES.map((t) => {
                const checked = contractType === t.value
                return (
                  <label
                    key={t.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      checked
                        ? "border-blue-600 bg-blue-50/70 text-blue-900"
                        : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="dldContractType"
                      className="mt-0.5 h-3.5 w-3.5 accent-blue-700"
                      checked={checked}
                      onChange={() => onContractTypeChange(t.value)}
                    />
                    <span className="flex-1">
                      <span className="block font-medium">{t.label}</span>
                      <span className="block text-[11px] text-slate-500">
                        {t.hint}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        {/* STEP 1: Open DLD Portal */}
        <DldStepCard
          number={1}
          title="Open DLD Portal"
          description="Register this property management contract with Dubai Land Department."
        >
          <div className="flex flex-wrap gap-2">
            <a
              href="https://dlrapp.dubailand.gov.ae/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
            >
              <Landmark className="h-4 w-4" />
              Open Dubai REST Portal
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
            <a
              href="https://dubailand.gov.ae/en/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"
            >
              <ExternalLink className="h-4 w-4" />
              Open DLD Portal
            </a>
          </div>
        </DldStepCard>

        {/* STEP 2: Enter DLD Contract Number */}
        <DldStepCard
          number={2}
          title="Enter DLD Contract Number"
          description="After registration, DLD issues a contract number. Enter it below."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                DLD Contract No
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
                placeholder="e.g. 0320200809002228"
                value={contractNo}
                onChange={(e) => onUpdateField({ dldContractNo: e.target.value })}
                onBlur={() => onCommitField({ dldContractNo: contractNo })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Registered Date
              </label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
                value={(registeredAt || "").slice(0, 10)}
                onChange={(e) =>
                  onUpdateField({
                    dldRegisteredAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  })
                }
                onBlur={() =>
                  onCommitField({
                    dldRegisteredAt:
                      registeredAt && String(registeredAt).length
                        ? new Date(String(registeredAt)).toISOString()
                        : null,
                  })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Notes
              </label>
              <textarea
                rows={3}
                className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20"
                placeholder="Any notes regarding DLD registration, submission reference, contacts, etc."
                value={notes}
                onChange={(e) => onUpdateField({ dldNotes: e.target.value })}
                onBlur={() => onCommitField({ dldNotes: notes })}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              Changes save automatically when you leave a field.
            </p>
            <button
              type="button"
              onClick={() =>
                onCommitField({
                  dldContractNo: contractNo,
                  dldNotes: notes,
                  dldRegisteredAt:
                    registeredAt && String(registeredAt).length
                      ? new Date(String(registeredAt)).toISOString()
                      : null,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Save DLD Info
            </button>
          </div>
        </DldStepCard>

        {/* STEP 3: Upload Official DLD PDF */}
        <DldStepCard
          number={3}
          title="Upload Official DLD PDF"
          description="Upload the signed/stamped DLD contract PDF for your records."
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onUploadClick}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {hasPdf ? "Replace DLD Contract PDF" : "Upload DLD Contract PDF"}
            </button>
            <span className="text-[11px] text-slate-500">PDF only · max 10MB</span>
          </div>

          {hasPdf && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 flex-none text-blue-700" />
                    <span className="truncate text-sm font-medium text-blue-900">
                      {pdfName}
                    </span>
                    <span className="text-[11px] text-blue-900/60">
                      ({formatBytes(pdfSize)})
                    </span>
                  </div>
                  {pdfUploadedAt && (
                    <p className="mt-0.5 text-[11px] text-blue-900/70">
                      Uploaded{" "}
                      {formatDistanceToNow(new Date(pdfUploadedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/owners/${ownerId}/dld/download`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={onRemove}
                    disabled={uploading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}
        </DldStepCard>
      </div>
    </section>
  )
}

function DldStep({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
        done
          ? "bg-blue-700 text-white ring-blue-800"
          : "bg-white text-slate-600 ring-slate-300"
      )}
    >
      {done ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <span className="h-2 w-2 rounded-full border border-slate-400" />
      )}
      {label}
    </span>
  )
}

function DldStepConnector({ done }: { done: boolean }) {
  return (
    <span
      className={cn("h-px w-5", done ? "bg-blue-400" : "bg-slate-300")}
      aria-hidden
    />
  )
}

function DldStepCard({
  number,
  title,
  description,
  children,
}: {
  number: number
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-blue-700 text-xs font-bold text-white ring-2 ring-blue-100">
          {number}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-blue-900">
            STEP {number}: {title}
          </h3>
          <p className="text-xs text-slate-600">{description}</p>
        </div>
      </div>
      <div className="pl-10">{children}</div>
    </div>
  )
}

function StatusPill({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1",
        done
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-slate-50 text-slate-500 ring-slate-200"
      )}
    >
      {done ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <span className="h-2 w-2 rounded-full border border-slate-300" />
      )}
      {label}
    </span>
  )
}
