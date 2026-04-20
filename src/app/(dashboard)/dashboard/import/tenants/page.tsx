"use client"

import { useState } from "react"
import { FolderSearch, Play, CheckCircle2, AlertCircle, XCircle, Loader2, Trash2 } from "lucide-react"

interface PreviewRow {
  folderName: string
  folderPath: string
  unitNo: string
  tenantNameFromFolder: string
  hasEidPdf: boolean
  hasEjariPdf: boolean
  hasChequesPdf: boolean
  unitFound: boolean
  unitHasTenant: boolean
  existingTenantName?: string
}

type RowStatus = "pending" | "importing" | "created" | "skipped" | "error"
interface RowResult {
  status: RowStatus
  message?: string
  tenantId?: string
  ocrStatus?: string
}

export default function BulkImportTenantsPage() {
  const [folderPath, setFolderPath] = useState(
    "D:\\Projects\\Alwaan - Documnets\\Alwwan - Tenant Sorted"
  )
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [results, setResults] = useState<Record<string, RowResult>>({})
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [stopRequested, setStopRequested] = useState(false)
  const [error, setError] = useState("")
  const [skipIfHasTenant, setSkipIfHasTenant] = useState(true)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetConfirm, setResetConfirm] = useState("")
  const [resetBusy, setResetBusy] = useState(false)
  const [resetResult, setResetResult] = useState<string>("")
  const [normalizing, setNormalizing] = useState(false)
  const [normalizeResult, setNormalizeResult] = useState("")

  const handleNormalize = async () => {
    setNormalizing(true)
    setNormalizeResult("")
    try {
      const res = await fetch("/api/admin/normalize-unit-types", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      const summary = data.changes
        .map((c: { from: string; to: string; count: number }) => `${c.from} → ${c.to} (${c.count})`)
        .join(", ")
      setNormalizeResult(
        `Updated ${data.updated} of ${data.totalUnits} units.${summary ? " " + summary : ""}`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setNormalizing(false)
    }
  }

  const handleReset = async () => {
    setResetBusy(true)
    setResetResult("")
    try {
      const res = await fetch("/api/admin/import-tenants/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: resetConfirm }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Reset failed")
      setResetResult(
        `Deleted ${data.deletedTenants} tenants, ${data.deletedDocuments} docs, cleared ${data.clearedUnits} units, removed ${data.removedUploadFolders} folders.`
      )
      setResults({})
      setResetConfirm("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setResetBusy(false)
    }
  }

  const handlePreview = async () => {
    setLoading(true)
    setError("")
    setRows([])
    setResults({})
    try {
      const res = await fetch(`/api/admin/import-tenants/preview?path=${encodeURIComponent(folderPath)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Preview failed (${res.status})`)
      }
      const data = await res.json()
      setRows(data.rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setLoading(false)
    }
  }

  const handleStart = async () => {
    setRunning(true)
    setStopRequested(false)
    setError("")

    for (const row of rows) {
      if (stopRequested) break
      if (!row.unitFound) {
        setResults((prev) => ({ ...prev, [row.folderName]: { status: "skipped", message: "Unit not found in DB" } }))
        continue
      }
      if (skipIfHasTenant && row.unitHasTenant) {
        setResults((prev) => ({ ...prev, [row.folderName]: { status: "skipped", message: `Has tenant: ${row.existingTenantName}` } }))
        continue
      }

      setResults((prev) => ({ ...prev, [row.folderName]: { status: "importing" } }))
      try {
        const res = await fetch("/api/admin/import-tenants/one", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderPath: row.folderPath,
            unitNo: row.unitNo,
            tenantNameFromFolder: row.tenantNameFromFolder,
            skipIfUnitHasTenant: skipIfHasTenant,
          }),
        })
        const data = await res.json()
        if (!res.ok || data.status === "error") {
          setResults((prev) => ({ ...prev, [row.folderName]: { status: "error", message: data.error || data.reason || "Failed" } }))
        } else if (data.status === "skipped") {
          setResults((prev) => ({ ...prev, [row.folderName]: { status: "skipped", message: data.reason } }))
        } else {
          setResults((prev) => ({ ...prev, [row.folderName]: {
            status: "created",
            tenantId: data.tenantId,
            ocrStatus: data.ejariStatus,
            message: `${data.tenantName} (Ejari: ${data.ejariStatus || 'skipped'})`,
          } }))
        }
      } catch (e) {
        setResults((prev) => ({ ...prev, [row.folderName]: { status: "error", message: e instanceof Error ? e.message : "Failed" } }))
      }
    }

    setRunning(false)
    setStopRequested(false)
  }

  const stats = {
    created: Object.values(results).filter((r) => r.status === "created").length,
    skipped: Object.values(results).filter((r) => r.status === "skipped").length,
    errors: Object.values(results).filter((r) => r.status === "error").length,
    pending: rows.length - Object.keys(results).length,
  }

  const statusIcon = (s?: RowStatus) => {
    if (s === "importing") return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    if (s === "created") return <CheckCircle2 className="h-4 w-4 text-green-500" />
    if (s === "skipped") return <AlertCircle className="h-4 w-4 text-amber-500" />
    if (s === "error") return <XCircle className="h-4 w-4 text-red-500" />
    return <span className="h-4 w-4 rounded-full bg-slate-700" />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bulk Import Tenants from Folder</h1>
        <p className="mt-1 text-sm text-slate-400">
          Reads folder structure <code className="rounded bg-slate-800 px-1 text-xs">unit_no - TENANT NAME/{"{emirates_id,ejari,cheques}"}</code>,
          OCRs the Emirates ID, creates tenant records, and attaches PDFs.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
      )}

      {resetResult && (
        <div className="rounded-lg border border-green-800 bg-green-900/20 p-3 text-sm text-green-400">{resetResult}</div>
      )}

      {normalizeResult && (
        <div className="rounded-lg border border-blue-800 bg-blue-900/20 p-3 text-sm text-blue-400">{normalizeResult}</div>
      )}

      <div className="rounded-xl border border-blue-900 bg-blue-950/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-300">Normalize Unit Types</p>
            <p className="text-xs text-slate-400">
              Convert raw Ejari types like &quot;1bed room+Hall&quot; into standard labels (Studio, 1 BHK, 2 BHK, etc.).
            </p>
          </div>
          <button
            onClick={handleNormalize}
            disabled={normalizing}
            className="rounded-lg border border-blue-700 bg-blue-900/40 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-900/60 disabled:opacity-50"
          >
            {normalizing ? "Normalizing..." : "Normalize All Units"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-red-900 bg-red-950/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-red-400">Danger Zone</p>
            <p className="text-xs text-slate-400">
              Delete ALL tenants, their documents, and unassign all units. Use this before re-running the import.
            </p>
          </div>
          {!resetOpen ? (
            <button
              onClick={() => setResetOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-red-700 bg-red-900/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/60"
            >
              <Trash2 className="h-3.5 w-3.5" /> Reset All Tenants
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder='Type "DELETE ALL"'
                className="rounded border border-red-700 bg-slate-900 px-2 py-1 text-xs text-white"
              />
              <button
                onClick={handleReset}
                disabled={resetBusy || resetConfirm !== "DELETE ALL"}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {resetBusy ? "Deleting..." : "Confirm"}
              </button>
              <button
                onClick={() => { setResetOpen(false); setResetConfirm("") }}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Root Folder Path</label>
          <input
            type="text"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="e.g. D:\Projects\..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={skipIfHasTenant}
            onChange={(e) => setSkipIfHasTenant(e.target.checked)}
          />
          Skip units that already have a tenant (safe re-run)
        </label>
        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            disabled={loading || running}
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
          >
            <FolderSearch className="h-4 w-4" />
            {loading ? "Scanning..." : "Preview Folder"}
          </button>
          {rows.length > 0 && !running && (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500"
            >
              <Play className="h-4 w-4" />
              Start Import ({rows.length} folders)
            </button>
          )}
          {running && (
            <button
              onClick={() => setStopRequested(true)}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-center">
            <p className="text-2xl font-bold text-white">{stats.pending}</p>
            <p className="text-xs text-slate-400">Pending</p>
          </div>
          <div className="rounded-lg border border-green-900 bg-green-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{stats.created}</p>
            <p className="text-xs text-green-500">Created</p>
          </div>
          <div className="rounded-lg border border-amber-900 bg-amber-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{stats.skipped}</p>
            <p className="text-xs text-amber-500">Skipped</p>
          </div>
          <div className="rounded-lg border border-red-900 bg-red-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.errors}</p>
            <p className="text-xs text-red-500">Errors</p>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                <th className="px-3 py-2 w-6"></th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Folder Name</th>
                <th className="px-3 py-2">Files</th>
                <th className="px-3 py-2">DB Status</th>
                <th className="px-3 py-2">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((row) => {
                const r = results[row.folderName]
                return (
                  <tr key={row.folderName} className="text-slate-300">
                    <td className="px-3 py-2">{statusIcon(r?.status)}</td>
                    <td className="px-3 py-2 font-mono">{row.unitNo}</td>
                    <td className="px-3 py-2">{row.tenantNameFromFolder}</td>
                    <td className="px-3 py-2">
                      <span className={row.hasEidPdf ? "text-green-400" : "text-slate-600"}>EID </span>
                      <span className={row.hasEjariPdf ? "text-green-400" : "text-slate-600"}>Ejari </span>
                      <span className={row.hasChequesPdf ? "text-green-400" : "text-slate-600"}>Cheques</span>
                    </td>
                    <td className="px-3 py-2">
                      {!row.unitFound && <span className="text-red-400">Unit not in DB</span>}
                      {row.unitFound && row.unitHasTenant && <span className="text-amber-400">Has tenant: {row.existingTenantName}</span>}
                      {row.unitFound && !row.unitHasTenant && <span className="text-green-400">Ready</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{r?.message || ""}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
