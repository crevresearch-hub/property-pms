"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { DataTable, Column } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"
import { formatDate } from "@/lib/utils"
import { FileText, CheckCircle, XCircle, ExternalLink, Search } from "lucide-react"

interface DocRow {
  id: string
  tenantId: string
  tenant: { id: string; name: string; units?: { id: string; unitNo: string }[] } | null
  docType: string
  filename: string
  originalFilename: string
  filePath: string
  fileSize: number
  expiryDate: string
  status: string
  reviewNotes: string
  uploadedAt: string
  [key: string]: unknown
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const isImage = (filename: string) => /\.(png|jpe?g|webp|gif)$/i.test(filename)

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [view, setView] = useState<"apartment" | "list">("apartment")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/documents")
      if (!res.ok) throw new Error("Failed to fetch documents")
      setDocuments(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const reviewDoc = async (id: string, status: string) => {
    const notes = status === "Rejected" ? prompt("Rejection reason:") || "" : ""
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNotes: notes }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      fetchData()
    } catch (err) { setError(err instanceof Error ? err.message : "An error occurred") }
  }

  const docTypes = useMemo(() => {
    const set = new Set<string>()
    for (const d of documents) set.add(d.docType)
    return [...set].sort()
  }, [documents])

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return documents.filter((d) => {
      if (typeFilter !== "all" && d.docType !== typeFilter) return false
      if (q && !`${d.tenant?.name || ""} ${d.tenant?.units?.[0]?.unitNo || ""} ${d.docType} ${d.originalFilename}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [documents, search, typeFilter])

  // Group by unit (or "Unassigned" if no unit)
  const grouped = useMemo(() => {
    const map = new Map<string, { unitNo: string; tenantName: string; docs: DocRow[] }>()
    for (const d of filteredDocs) {
      const u = d.tenant?.units?.[0]
      const key = u?.id || `no-unit-${d.tenantId || "x"}`
      const unitNo = u?.unitNo || "Unassigned"
      const tenantName = d.tenant?.name || "—"
      if (!map.has(key)) map.set(key, { unitNo, tenantName, docs: [] })
      map.get(key)!.docs.push(d)
    }
    return [...map.values()].sort((a, b) => a.unitNo.localeCompare(b.unitNo, undefined, { numeric: true }))
  }, [filteredDocs])

  const columns: Column<DocRow>[] = [
    { key: "tenant", header: "Tenant", render: (r) => r.tenant?.name || "--" },
    { key: "unit", header: "Unit", render: (r) => r.tenant?.units?.[0]?.unitNo || "--" },
    { key: "docType", header: "Type", sortable: true },
    {
      key: "originalFilename",
      header: "File",
      render: (r) => (
        <a href={`/api/documents/${r.id}/file`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-amber-400 hover:underline">
          {r.originalFilename || r.filename}
          <ExternalLink className="h-3 w-3" />
        </a>
      ),
    },
    { key: "fileSize", header: "Size", render: (r) => formatFileSize(r.fileSize) },
    { key: "expiryDate", header: "Expiry", render: (r) => r.expiryDate ? formatDate(r.expiryDate) : "--" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "uploadedAt", header: "Uploaded", sortable: true, render: (r) => formatDate(r.uploadedAt) },
    {
      key: "actions", header: "Actions",
      render: (r) => (
        <div className="flex gap-1">
          {r.status === "Uploaded" && (
            <>
              <button onClick={(e) => { e.stopPropagation(); reviewDoc(r.id, "Approved") }} className="rounded p-1.5 text-slate-400 hover:bg-emerald-900/50 hover:text-emerald-400" title="Approve"><CheckCircle className="h-4 w-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); reviewDoc(r.id, "Rejected") }} className="rounded p-1.5 text-slate-400 hover:bg-red-900/50 hover:text-red-400" title="Reject"><XCircle className="h-4 w-4" /></button>
            </>
          )}
        </div>
      ),
    },
  ]

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>

  const uploaded = documents.filter(d => d.status === "Uploaded").length
  const approved = documents.filter(d => d.status === "Approved").length
  const rejected = documents.filter(d => d.status === "Rejected").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Documents</h1>
        <p className="mt-1 text-sm text-slate-400">{documents.length} documents on record across {grouped.length} apartment{grouped.length === 1 ? "" : "s"}</p>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error} <button onClick={() => setError("")} className="ml-2 underline">Dismiss</button></div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <FileText className="h-8 w-8 text-amber-400" />
          <div><p className="text-xs text-slate-400">Pending Review</p><p className="text-xl font-bold text-white">{uploaded}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <CheckCircle className="h-8 w-8 text-emerald-400" />
          <div><p className="text-xs text-slate-400">Approved</p><p className="text-xl font-bold text-white">{approved}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <XCircle className="h-8 w-8 text-red-400" />
          <div><p className="text-xs text-slate-400">Rejected</p><p className="text-xl font-bold text-white">{rejected}</p></div>
        </div>
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
          <button
            onClick={() => setView("apartment")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md ${view === "apartment" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:text-white"}`}
          >
            By Apartment
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md ${view === "list" ? "bg-amber-500 text-slate-900" : "text-slate-300 hover:text-white"}`}
          >
            Flat List
          </button>
        </div>

        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenant, unit, type, filename"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
        >
          <option value="all">All types ({docTypes.length})</option>
          {docTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {view === "list" ? (
        <DataTable columns={columns} data={filteredDocs} searchPlaceholder="" searchKeys={["docType", "originalFilename"]} />
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
          No documents match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {grouped.map((g) => (
            <div key={g.unitNo + g.tenantName} className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">Unit {g.unitNo}</p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{g.tenantName}</p>
                </div>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                  {g.docs.length} doc{g.docs.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="divide-y divide-slate-800">
                {g.docs.map((d) => (
                  <div key={d.id} className="flex items-start gap-3 p-3 hover:bg-slate-800/40">
                    {/* Thumbnail */}
                    <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer" className="flex-shrink-0">
                      {isImage(d.filename) ? (
                        <img src={`/api/documents/${d.id}/file`} alt={d.docType} className="h-12 w-12 rounded border border-slate-700 object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded border border-slate-700 bg-slate-800 text-slate-400">
                          <FileText className="h-5 w-5" />
                        </div>
                      )}
                    </a>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">{d.docType}</p>
                          <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer" className="block truncate text-xs text-amber-400 hover:underline">
                            {d.originalFilename || d.filename}
                          </a>
                        </div>
                        <StatusBadge status={d.status} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {formatFileSize(d.fileSize)} · Uploaded {formatDate(d.uploadedAt)}
                        {d.expiryDate && ` · Expires ${formatDate(d.expiryDate)}`}
                      </p>
                      {d.status === "Uploaded" && (
                        <div className="mt-1.5 flex gap-1">
                          <button
                            onClick={() => reviewDoc(d.id, "Approved")}
                            className="inline-flex items-center gap-1 rounded bg-emerald-700/40 px-2 py-0.5 text-[10px] text-emerald-300 hover:bg-emerald-700/60"
                          >
                            <CheckCircle className="h-3 w-3" /> Approve
                          </button>
                          <button
                            onClick={() => reviewDoc(d.id, "Rejected")}
                            className="inline-flex items-center gap-1 rounded bg-red-700/40 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-700/60"
                          >
                            <XCircle className="h-3 w-3" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
