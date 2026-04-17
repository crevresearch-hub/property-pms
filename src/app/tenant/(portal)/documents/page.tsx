"use client"

import { useState, useEffect, FormEvent } from "react"

interface TenantDocument {
  id: string
  docType: string
  filename: string
  originalFilename: string
  fileSize: number
  expiryDate: string
  status: string
  reviewNotes: string
  uploadedAt: string
}

interface TenancyContract {
  id: string
  contractNo: string
  status: string
  contractStart: string
  contractEnd: string
  rentAmount: number
  contractType: string
  signedByTenantAt: string | null
  signedByLandlordAt: string | null
  signedFileName: string
}

const docTypes = [
  "Emirates ID",
  "Passport",
  "Visa",
  "Trade License",
  "Tenancy Contract",
  "Insurance",
  "Other",
]

const statusColor: Record<string, string> = {
  Uploaded: "bg-blue-500/20 text-blue-400",
  "Under Review": "bg-amber-500/20 text-amber-400",
  Approved: "bg-emerald-500/20 text-emerald-400",
  Rejected: "bg-red-500/20 text-red-400",
}

const PERSONAL_TYPES = ["Emirates ID", "Passport", "Visa"]
const CONTRACT_TYPES = ["Tenancy Contract", "Ejari"]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

function formatDate(d: string): string {
  if (!d) return ""
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

// Icon per doc type
function DocIcon({ type }: { type: string }) {
  const t = type.toLowerCase()
  let color = "text-slate-300"
  let path = (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
    />
  )

  if (t.includes("emirates")) {
    color = "text-red-400"
    path = (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z"
      />
    )
  } else if (t.includes("passport")) {
    color = "text-blue-400"
    path = (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
      />
    )
  } else if (t.includes("visa")) {
    color = "text-purple-400"
    path = (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25m-18 0V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6z"
      />
    )
  } else if (t.includes("ejari")) {
    color = "text-emerald-400"
    path = (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
      />
    )
  } else if (t.includes("tenancy") || t.includes("contract")) {
    color = "text-teal-400"
    path = (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    )
  } else if (t.includes("trade") || t.includes("license")) {
    color = "text-orange-400"
    path = (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"
      />
    )
  }

  return (
    <svg
      className={`h-6 w-6 ${color}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      {path}
    </svg>
  )
}

export default function TenantDocumentsPage() {
  const [documents, setDocuments] = useState<TenantDocument[]>([])
  const [contracts, setContracts] = useState<TenancyContract[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState("Other")
  const [expiryDate, setExpiryDate] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  function load() {
    Promise.all([
      fetch("/api/tenant/documents").then((r) => r.json()).catch(() => []),
      fetch("/api/tenant/tenancy-contracts").then((r) => r.json()).catch(() => []),
    ])
      .then(([d, c]) => {
        setDocuments(Array.isArray(d) ? d : [])
        setContracts(Array.isArray(c) ? c : [])
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function handleUpload(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setError("")
    setSuccess("")
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("docType", docType)
      if (expiryDate) formData.append("expiryDate", expiryDate)

      const res = await fetch("/api/tenant/documents/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Upload failed")
      } else {
        setSuccess("Document uploaded successfully")
        setFile(null)
        setDocType("Other")
        setExpiryDate("")
        const fileInput = document.getElementById("file-input") as HTMLInputElement
        if (fileInput) fileInput.value = ""
        load()
      }
    } catch {
      setError("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" />
      </div>
    )
  }

  const personal = documents.filter((d) => PERSONAL_TYPES.includes(d.docType))
  const contract = documents.filter((d) => CONTRACT_TYPES.includes(d.docType))
  const other = documents.filter(
    (d) => !PERSONAL_TYPES.includes(d.docType) && !CONTRACT_TYPES.includes(d.docType)
  )
  const signedContracts = contracts.filter(
    (c) => c.signedByTenantAt || c.signedFileName || c.status === "Active"
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">My Documents</h1>
        <p className="text-xs text-slate-400">
          View and manage all your tenancy documents
        </p>
      </div>

      {/* Signed Contracts */}
      {signedContracts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-teal-300">
            Signed Tenancy Contracts
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {signedContracts.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-teal-500/30 bg-gradient-to-br from-teal-500/10 to-emerald-500/5 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/20">
                    <DocIcon type="Tenancy Contract" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {c.contractNo}
                    </p>
                    <p className="text-[11px] text-slate-300">
                      {c.contractType} · {formatDate(c.contractStart)} →{" "}
                      {formatDate(c.contractEnd)}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      {c.status}
                    </span>
                  </div>
                </div>
                <a
                  href={`/api/tenancy-contracts/${c.id}?format=html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block w-full rounded-lg bg-teal-500/20 px-3 py-2 text-center text-xs font-semibold text-teal-300 transition-colors hover:bg-teal-500/30"
                >
                  View Signed Contract
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upload Form */}
      <section className="rounded-xl border border-white/5 bg-white/5 p-6">
        <h3 className="mb-4 text-sm font-semibold text-white">Upload Document</h3>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {success}
          </div>
        )}

        <form onSubmit={handleUpload} className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Document Type
            </label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
            >
              {docTypes.map((t) => (
                <option key={t} value={t} className="bg-slate-900">
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Expiry Date
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              File (max 10MB)
            </label>
            <input
              id="file-input"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white file:mr-2 file:rounded file:border-0 file:bg-teal-500/20 file:px-2 file:py-1 file:text-xs file:text-teal-400 outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-teal-500 hover:to-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </section>

      <DocGroup title="Personal Documents" docs={personal} emptyHint="No personal documents yet" />
      <DocGroup title="Contract Documents" docs={contract} emptyHint="No contract documents yet" />
      <DocGroup title="Other Documents" docs={other} emptyHint="No other documents" />
    </div>
  )
}

function DocGroup({
  title,
  docs,
  emptyHint,
}: {
  title: string
  docs: TenantDocument[]
  emptyHint: string
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-white">
        {title} <span className="text-xs text-slate-500">({docs.length})</span>
      </h2>
      {docs.length === 0 ? (
        <p className="rounded-xl border border-white/5 bg-white/5 p-4 text-sm text-slate-500">
          {emptyHint}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <DocCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </section>
  )
}

function DocCard({ doc }: { doc: TenantDocument }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-4 transition-colors hover:bg-white/10">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/5">
          <DocIcon type={doc.docType} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white" title={doc.originalFilename}>
            {doc.originalFilename || doc.filename}
          </p>
          <p className="text-[11px] text-slate-400">{doc.docType}</p>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
            <span>{formatFileSize(doc.fileSize)}</span>
            <span>·</span>
            <span>Uploaded {formatDate(doc.uploadedAt)}</span>
          </div>
          {doc.expiryDate && (
            <p className="mt-0.5 text-[10px] text-slate-500">
              Expires: {formatDate(doc.expiryDate)}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                statusColor[doc.status] || "bg-slate-500/20 text-slate-400"
              }`}
            >
              {doc.status}
            </span>
            <a
              href={`/api/tenant/documents/${doc.id}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-teal-500/20 px-2.5 py-1 text-[11px] font-semibold text-teal-300 transition-colors hover:bg-teal-500/30"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              View
            </a>
          </div>
          {doc.reviewNotes && (
            <p className="mt-1.5 text-[10px] italic text-amber-400">
              Note: {doc.reviewNotes}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
