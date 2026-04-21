"use client"

import { useState, useRef } from "react"
import { Upload, CheckCircle2, AlertCircle, XCircle, FileSpreadsheet, Download } from "lucide-react"

interface PreviewRow {
  row: number
  unitNo: string
  chequeNo: string
  chequeDate: string
  amount: number
  bankName: string
  status: string
  tenantName?: string
  error?: string
}

interface ImportResult {
  total: number
  created: number
  skipped: number
  errors: { row: number; unitNo: string; reason: string }[]
  preview: PreviewRow[]
}

export default function ImportChequesPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
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
      const res = await fetch("/api/admin/import-cheques", { method: "POST", body: fd })
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

  const downloadTemplate = () => {
    const csv =
      "unit_no,cheque_no,cheque_date,amount,bank_name\n" +
      "1001,000123,2025-12-23,16750,Emirates NBD\n" +
      "1001,000124,2026-03-23,16750,Emirates NBD\n"
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "cheques-template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const data = preview || result
  const stats = data ? {
    ok: data.preview.filter((r) => !r.error).length,
    bad: data.preview.filter((r) => r.error).length,
  } : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Import Cheques from Excel</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload a spreadsheet with columns: <code className="rounded bg-slate-800 px-1 text-xs">unit_no, cheque_no, cheque_date, amount, bank_name</code>
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
      )}

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-400 mb-1">Excel or CSV file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null) }}
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-600 file:px-3 file:py-2 file:text-white hover:file:bg-amber-700"
            />
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" /> Download CSV template
          </button>
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
            <Upload className="h-4 w-4" /> {loading && preview === null && !result ? "Analyzing..." : "Preview"}
          </button>
          {preview && stats && stats.ok > 0 && (
            <button
              onClick={() => runUpload(false)}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
            >
              {loading ? "Importing..." : `Commit Import (${stats.ok} valid)`}
            </button>
          )}
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-green-800 bg-green-900/20 p-4 text-sm text-green-400">
          <p className="font-semibold">✓ Import complete</p>
          <p>Created: {result.created} cheques</p>
          {result.errors.length > 0 && <p className="mt-1 text-amber-400">Errors: {result.errors.length}</p>}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-center">
            <p className="text-2xl font-bold text-white">{data.total}</p>
            <p className="text-xs text-slate-400">Total rows</p>
          </div>
          <div className="rounded-lg border border-green-900 bg-green-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{stats?.ok || 0}</p>
            <p className="text-xs text-green-500">Valid</p>
          </div>
          <div className="rounded-lg border border-red-900 bg-red-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{stats?.bad || 0}</p>
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
                <th className="px-3 py-2">Cheque No</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Bank</th>
                <th className="px-3 py-2">Problem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.preview.slice(0, 200).map((r, i) => (
                <tr key={i} className="text-slate-300">
                  <td className="px-3 py-2">
                    {r.error ? <XCircle className="h-4 w-4 text-red-400" /> : <CheckCircle2 className="h-4 w-4 text-green-400" />}
                  </td>
                  <td className="px-3 py-2 font-mono">{r.row}</td>
                  <td className="px-3 py-2 font-mono">{r.unitNo}</td>
                  <td className="px-3 py-2">{r.tenantName || "—"}</td>
                  <td className="px-3 py-2 font-mono">{r.chequeNo}</td>
                  <td className="px-3 py-2">{r.chequeDate}</td>
                  <td className="px-3 py-2">AED {r.amount.toLocaleString()}</td>
                  <td className="px-3 py-2">{r.bankName}</td>
                  <td className="px-3 py-2 text-red-400">{r.error || ""}</td>
                </tr>
              ))}
              {data.preview.length > 200 && (
                <tr><td colSpan={9} className="px-3 py-2 text-center text-slate-500">… and {data.preview.length - 200} more rows</td></tr>
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
            {data.errors.slice(0, 100).map((e, i) => (
              <li key={i}>Row {e.row} (unit {e.unitNo}): {e.reason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
