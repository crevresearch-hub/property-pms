"use client"

import { useState, useRef } from "react"
import { Upload, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet, Banknote } from "lucide-react"

interface Match {
  bankRow: { rowNum: number; date: string; amount: number; description: string; ref: string }
  chequeId: string
  chequeNo: string
  chequeDate: string
  amount: number
  tenantName: string
  unitNo: string
  daysDiff: number
  score: number
}
interface UnmatchedBank {
  rowNum: number; date: string; amount: number; description: string; ref: string
}
interface UnmatchedCheque {
  id: string; chequeNo: string; chequeDate: string; amount: number; tenantName: string; unitNo: string; status: string
}
interface Result {
  bankRowCount: number
  bankTotal: number
  matched: Match[]
  matchedTotal: number
  unmatchedBank: UnmatchedBank[]
  unmatchedCheques: UnmatchedCheque[]
  committed: boolean
  clearedCount: number
}

function formatAed(n: number): string {
  return `AED ${new Intl.NumberFormat("en-US").format(Math.round(n))}`
}

export default function BankReconciliationPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Result | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function run(commit: boolean) {
    if (!file) return
    setLoading(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("commit", String(commit))
      const res = await fetch("/api/admin/reconcile-bank", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")
      if (commit) { setResult(data); setPreview(null) }
      else { setPreview(data); setResult(null) }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const csv = "Date,Credit,Description,Reference\n2026-01-01,5300,Cheque 100015 from MICHAEL,100015\n"
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "bank-statement-template.csv"; a.click()
    URL.revokeObjectURL(url)
  }

  const data = preview || result

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bank Reconciliation</h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload your bank statement — the system matches each credit against tracked cheques.
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>}

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Bank statement (CSV or Excel)</label>
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
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            Download template
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
            onClick={() => run(false)}
            disabled={!file || loading}
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" /> {loading && !preview && !result ? "Matching..." : "Preview matches"}
          </button>
          {preview && preview.matched.length > 0 && (
            <button
              onClick={() => run(true)}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
            >
              {loading ? "Saving..." : `Confirm & Clear ${preview.matched.length} cheques`}
            </button>
          )}
        </div>
      </div>

      {result?.committed && (
        <div className="rounded-lg border border-green-800 bg-green-900/20 p-4 text-sm text-green-400">
          <p className="font-semibold">✓ Reconciliation complete</p>
          <p className="mt-1">{result.clearedCount} cheques marked Cleared with bank statement reference.</p>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-center">
            <p className="text-2xl font-bold text-white">{data.bankRowCount}</p>
            <p className="text-xs text-slate-400">Bank credits</p>
            <p className="text-[10px] text-slate-500">{formatAed(data.bankTotal)}</p>
          </div>
          <div className="rounded-lg border border-green-900 bg-green-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{data.matched.length}</p>
            <p className="text-xs text-green-500">Matched</p>
            <p className="text-[10px] text-slate-500">{formatAed(data.matchedTotal)}</p>
          </div>
          <div className="rounded-lg border border-amber-900 bg-amber-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-amber-400">{data.unmatchedBank.length}</p>
            <p className="text-xs text-amber-500">Unmatched Bank</p>
          </div>
          <div className="rounded-lg border border-red-900 bg-red-900/20 p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{data.unmatchedCheques.length}</p>
            <p className="text-xs text-red-500">Pending Cheques</p>
          </div>
        </div>
      )}

      {data && data.matched.length > 0 && (
        <section className="rounded-xl border border-green-900 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-green-400">
            <CheckCircle2 className="inline h-4 w-4 mr-1" /> {data.matched.length} Matched ({formatAed(data.matchedTotal)})
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-800 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Bank Date</th>
                  <th className="px-3 py-2">Cheque Date</th>
                  <th className="px-3 py-2">Cheque No</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Days Diff</th>
                  <th className="px-3 py-2">Match Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.matched.map((m, i) => (
                  <tr key={i} className="text-slate-300">
                    <td className="px-3 py-2 font-mono">{m.bankRow.date}</td>
                    <td className="px-3 py-2 font-mono">{m.chequeDate}</td>
                    <td className="px-3 py-2 font-mono">{m.chequeNo}</td>
                    <td className="px-3 py-2 font-mono">{m.unitNo}</td>
                    <td className="px-3 py-2">{m.tenantName}</td>
                    <td className="px-3 py-2 text-right">{formatAed(m.amount)}</td>
                    <td className="px-3 py-2 text-right">{m.daysDiff}</td>
                    <td className="px-3 py-2">
                      <span className={m.score >= 80 ? "text-green-400" : m.score >= 50 ? "text-amber-400" : "text-orange-400"}>
                        {m.score >= 80 ? "High" : m.score >= 50 ? "Medium" : "Low"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && data.unmatchedBank.length > 0 && (
        <section className="rounded-xl border border-amber-900 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-amber-400">
            <AlertCircle className="inline h-4 w-4 mr-1" /> {data.unmatchedBank.length} Bank Credits Without a Matching Cheque
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-800 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.unmatchedBank.slice(0, 200).map((b) => (
                  <tr key={b.rowNum} className="text-slate-300">
                    <td className="px-3 py-2 font-mono">{b.rowNum}</td>
                    <td className="px-3 py-2 font-mono">{b.date}</td>
                    <td className="px-3 py-2 text-right">{formatAed(b.amount)}</td>
                    <td className="px-3 py-2 font-mono">{b.ref}</td>
                    <td className="px-3 py-2 truncate max-w-xs">{b.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && data.unmatchedCheques.length > 0 && (
        <section className="rounded-xl border border-red-900 bg-slate-900">
          <div className="border-b border-slate-800 px-4 py-3 text-sm font-semibold text-red-400">
            <XCircle className="inline h-4 w-4 mr-1" /> {data.unmatchedCheques.length} Cheques Not Found in Bank Statement
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-800 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Cheque Date</th>
                  <th className="px-3 py-2">Cheque No</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Tenant</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.unmatchedCheques.slice(0, 200).map((c) => (
                  <tr key={c.id} className="text-slate-300">
                    <td className="px-3 py-2 font-mono">{c.chequeDate}</td>
                    <td className="px-3 py-2 font-mono">{c.chequeNo}</td>
                    <td className="px-3 py-2 font-mono">{c.unitNo}</td>
                    <td className="px-3 py-2">{c.tenantName}</td>
                    <td className="px-3 py-2 text-right">{formatAed(c.amount)}</td>
                    <td className="px-3 py-2">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!data && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center">
          <Banknote className="h-12 w-12 mx-auto text-slate-600 mb-3" />
          <p className="text-sm text-slate-400">
            Upload a bank statement to start. The system will match each credit to a cheque by number + amount + date.
          </p>
        </div>
      )}
    </div>
  )
}
