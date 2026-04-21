"use client"

import { useState, useRef } from "react"
import { Upload, CheckCircle2, AlertCircle, XCircle, FileSpreadsheet } from "lucide-react"

interface PreviewRow {
  row: number
  unitNo: string
  tenant: string
  cheques: number
  action: string
}

interface Summary {
  totalRows: number
  tenantsUpdated: number
  tenantsCreated: number
  chequesCreated: number
  chequesSkipped: number
  unitsNotFound: number
  errors: { row: number; unitNo: string; reason: string }[]
  preview: PreviewRow[]
}

export default function ImportLeaseDataPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Summary | null>(null)
  const [result, setResult] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function runUpload(dryRun: boolean) {
    if (!file) return
    setLoading(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("dryRun", String(dryRun))
      const res = await fetch("/api/admin/import-lease-data", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")
      if (dryRun) { setPreview(data); setResult(null) }
      else { setResult(data); setPreview(null) }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setLoading(false)
    }
  }

  const data = preview || result

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Import Lease Data (Full)</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload the "Lease Data" Excel file — it will:
          update tenant info (phone, email, EID, passport, nationality),
          update unit info (rent, dates),
          and create up to 12 cheques per tenant.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
      )}

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Excel file (.xlsx)</label>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null) }}
            className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-600 file:px-3 file:py-2 file:text-white hover:file:bg-amber-700"
          />
        </div>

        {file && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FileSpreadsheet className="h-4 w-4 text-green-400" />
            <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => runUpload(true)}
            disabled={!file || loading}
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" /> {loading && !preview && !result ? "Analyzing..." : "Preview (dry run)"}
          </button>
          {preview && (
            <button
              onClick={() => runUpload(false)}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
            >
              {loading ? "Importing..." : `Commit Import (${preview.totalRows} rows)`}
            </button>
          )}
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-green-800 bg-green-900/20 p-4 text-sm text-green-400">
          <p className="font-semibold">✓ Import complete</p>
          <div className="mt-2 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <div><span className="text-slate-400">Tenants created:</span> <strong>{result.tenantsCreated}</strong></div>
            <div><span className="text-slate-400">Tenants updated:</span> <strong>{result.tenantsUpdated}</strong></div>
            <div><span className="text-slate-400">Cheques created:</span> <strong>{result.chequesCreated}</strong></div>
            <div><span className="text-slate-400">Cheques skipped:</span> <strong>{result.chequesSkipped}</strong></div>
            <div><span className="text-slate-400">Units not found:</span> <strong>{result.unitsNotFound}</strong></div>
            <div><span className="text-slate-400">Errors:</span> <strong>{result.errors.length}</strong></div>
          </div>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-center">
            <p className="text-2xl font-bold text-white">{data.totalRows}</p>
            <p className="text-xs text-slate-400">Total rows</p>
          </div>
          <div className="rounded-lg border border-green-900 bg-green-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{data.tenantsCreated + data.tenantsUpdated}</p>
            <p className="text-xs text-green-500">Tenant updates</p>
          </div>
          <div className="rounded-lg border border-amber-900 bg-amber-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{data.chequesCreated}</p>
            <p className="text-xs text-amber-500">Cheques</p>
          </div>
          <div className="rounded-lg border border-red-900 bg-red-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{data.errors.length}</p>
            <p className="text-xs text-red-500">Errors</p>
          </div>
        </div>
      )}

      {data && data.preview.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                <th className="px-3 py-2 w-6"></th>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Tenant</th>
                <th className="px-3 py-2 text-right">Cheques</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.preview.slice(0, 250).map((r, i) => (
                <tr key={i} className="text-slate-300">
                  <td className="px-3 py-2">
                    {r.action.includes("skipped") ? <XCircle className="h-4 w-4 text-red-400" /> : <CheckCircle2 className="h-4 w-4 text-green-400" />}
                  </td>
                  <td className="px-3 py-2 font-mono">{r.row}</td>
                  <td className="px-3 py-2 font-mono">{r.unitNo}</td>
                  <td className="px-3 py-2">{r.tenant}</td>
                  <td className="px-3 py-2 text-right">{r.cheques}</td>
                  <td className="px-3 py-2 text-slate-500">{r.action}</td>
                </tr>
              ))}
              {data.preview.length > 250 && (
                <tr><td colSpan={6} className="px-3 py-2 text-center text-slate-500">… and {data.preview.length - 250} more rows</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && data.errors.length > 0 && (
        <details className="rounded-xl border border-red-900 bg-red-950/20 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-red-300">
            <AlertCircle className="inline h-4 w-4 mr-1" /> {data.errors.length} errors — click to expand
          </summary>
          <ul className="mt-3 space-y-1 text-xs text-red-300">
            {data.errors.slice(0, 200).map((e, i) => (
              <li key={i}>Row {e.row} (unit {e.unitNo}): {e.reason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
