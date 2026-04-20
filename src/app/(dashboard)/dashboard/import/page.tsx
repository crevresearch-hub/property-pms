"use client"

import { useState, useRef, useMemo } from "react"
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Undo2,
  Trash2,
  Pencil,
} from "lucide-react"

type Row = {
  rowIndex: number
  unitNoOriginal: string
  unitNo: string
  unitType: string
  contractStart: string
  contractEnd: string
  currentRent: number
  status: "Occupied" | "Vacant"
  tower: string
  warnings: string[]
  errors: string[]
  _deleted?: boolean
}

type Summary = {
  totalRows: number
  blocking: number
  warnings: number
  willCreate: number
  byStatus: { Occupied: number; Vacant: number }
}

function isDateLike(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function rowsEqual(a: Row, b: Row): boolean {
  return (
    a.unitNo === b.unitNo &&
    a.unitType === b.unitType &&
    a.contractStart === b.contractStart &&
    a.contractEnd === b.contractEnd &&
    a.currentRent === b.currentRent &&
    a.status === b.status
  )
}

// Client-side validation (matches server logic). Authoritative check still happens on commit.
function revalidate(rows: Row[]): Row[] {
  const seen = new Map<string, number>()
  const active = rows.filter((r) => !r._deleted)
  for (const r of active) {
    if (!r.unitNo) continue
    seen.set(r.unitNo, (seen.get(r.unitNo) || 0) + 1)
  }
  return rows.map((r) => {
    if (r._deleted) return r
    const errors: string[] = []
    const warnings: string[] = []

    if (!r.unitNo) errors.push("Unit number is empty")
    else if ((seen.get(r.unitNo) || 0) > 1)
      errors.push(`Duplicate unitNo "${r.unitNo}" in this batch`)

    if (r.contractStart && !isDateLike(r.contractStart))
      errors.push(`Invalid start date (expected YYYY-MM-DD)`)
    if (r.contractEnd && !isDateLike(r.contractEnd))
      errors.push(`Invalid end date (expected YYYY-MM-DD)`)
    if (r.contractStart && r.contractEnd && r.contractStart > r.contractEnd)
      errors.push("Contract start is after contract end")
    if (r.currentRent < 0) errors.push("Rent cannot be negative")

    if (!r.unitType) warnings.push("Missing unit type")
    if (r.currentRent === 0) warnings.push("Rent is 0")
    if (r.status === "Occupied" && (!r.contractStart || !r.contractEnd))
      warnings.push("Occupied unit has no contract dates")

    // Preserve server-only errors (e.g., DB duplicates from the last server response)
    const serverOnly = (r.errors || []).filter((e) =>
      e.includes("already exists in this organization"),
    )
    return { ...r, errors: [...errors, ...serverOnly], warnings }
  })
}

function computeSummary(rows: Row[]): Summary {
  const active = rows.filter((r) => !r._deleted)
  const blocking = active.filter((r) => r.errors.length > 0).length
  return {
    totalRows: active.length,
    blocking,
    warnings: active.filter((r) => r.warnings.length > 0).length,
    willCreate: active.length - blocking,
    byStatus: {
      Occupied: active.filter((r) => r.status === "Occupied").length,
      Vacant: active.filter((r) => r.status === "Vacant").length,
    },
  }
}

export default function ImportUnitsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [originalRows, setOriginalRows] = useState<Row[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState("")
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [committed, setCommitted] = useState<number | null>(null)
  const [filter, setFilter] = useState<"all" | "errors" | "warnings" | "edited" | "deleted">("all")

  const summary = useMemo(() => (rows.length ? computeSummary(rows) : null), [rows])
  const deletedCount = useMemo(() => rows.filter((r) => r._deleted).length, [rows])
  const editedCount = useMemo(
    () =>
      rows.filter((r, i) => {
        const orig = originalRows[i]
        return orig && !r._deleted && !rowsEqual(r, orig)
      }).length,
    [rows, originalRows],
  )

  async function doPreview() {
    if (!file) return
    setError("")
    setIsPreviewing(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/import/units", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Preview failed")
        return
      }
      const incoming: Row[] = data.rows || []
      setOriginalRows(incoming.map((r) => ({ ...r })))
      setRows(incoming.map((r) => ({ ...r })))
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setIsPreviewing(false)
    }
  }

  async function doCommit() {
    if (!summary || summary.willCreate === 0) return
    const active = rows.filter((r) => !r._deleted)
    if (!confirm(`Create ${summary.willCreate} Unit records in the database?`)) return
    setError("")
    setIsCommitting(true)
    try {
      const res = await fetch("/api/import/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: active, commit: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Commit failed")
        if (Array.isArray(data.rows)) {
          // Merge server-reported errors (e.g., DB dup) back into edited rows by unitNo
          const errMap = new Map<string, string[]>()
          for (const r of data.rows as Row[]) {
            if (r.errors && r.errors.length) errMap.set(r.unitNo, r.errors)
          }
          setRows((prev) =>
            prev.map((r) =>
              r._deleted ? r : { ...r, errors: errMap.get(r.unitNo) || r.errors },
            ),
          )
        }
        return
      }
      setCommitted(data.createdCount || 0)
    } catch {
      setError("An unexpected error occurred.")
    } finally {
      setIsCommitting(false)
    }
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => {
      const next = prev.slice()
      next[i] = { ...next[i], ...patch }
      return revalidate(next)
    })
  }

  function resetRow(i: number) {
    setRows((prev) => {
      const next = prev.slice()
      const orig = originalRows[i]
      if (orig) next[i] = { ...orig, _deleted: false }
      return revalidate(next)
    })
  }

  function toggleDeleted(i: number) {
    setRows((prev) => {
      const next = prev.slice()
      next[i] = { ...next[i], _deleted: !next[i]._deleted }
      return revalidate(next)
    })
  }

  function resetAll() {
    setFile(null)
    setOriginalRows([])
    setRows([])
    setError("")
    setCommitted(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const visibleRows = useMemo(() => {
    return rows
      .map((r, i) => ({ r, i, orig: originalRows[i] }))
      .filter(({ r, orig }) => {
        if (filter === "deleted") return r._deleted
        if (r._deleted) return false
        if (filter === "errors") return r.errors.length > 0
        if (filter === "warnings") return r.warnings.length > 0 && r.errors.length === 0
        if (filter === "edited") return orig && !rowsEqual(r, orig)
        return true
      })
  }, [rows, originalRows, filter])

  const canCommit =
    summary !== null && summary.blocking === 0 && summary.willCreate > 0 && !committed

  return (
    <div className="min-h-full bg-slate-950 p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Upload className="h-6 w-6 text-[#ff4757]" />
          Import Units from Excel
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Upload an Excel file, edit any row inline if needed, then confirm. Nothing is written to
          the database until you click <span className="text-white">Confirm &amp; Import</span>.
        </p>
      </div>

      {/* Step 1: Upload */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E30613]/20 text-xs text-[#ff4757]">
            1
          </span>
          Pick an Excel file (.xlsx)
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0] || null
              setFile(f)
              setRows([])
              setOriginalRows([])
              setError("")
              setCommitted(null)
            }}
            className="block cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-[#E30613] file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:text-white hover:file:bg-[#c20510]"
          />
          {file && (
            <span className="flex items-center gap-2 text-xs text-slate-400">
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </span>
          )}
          <button
            onClick={doPreview}
            disabled={!file || isPreviewing || isCommitting}
            className="ml-auto rounded-lg bg-slate-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPreviewing ? "Parsing..." : "Preview"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {committed !== null && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>Imported {committed} units successfully.</span>
          <button onClick={resetAll} className="ml-auto text-xs underline hover:text-white">
            Import another file
          </button>
        </div>
      )}

      {summary && (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E30613]/20 text-xs text-[#ff4757]">
              2
            </span>
            Review &amp; edit
            <span className="ml-2 text-[11px] text-slate-500">
              (click any cell to edit — changes are local until you Confirm &amp; Import)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <SummaryStat label="Total" value={summary.totalRows} />
            <SummaryStat label="Will create" value={summary.willCreate} tone="emerald" />
            <SummaryStat
              label="Blocking"
              value={summary.blocking}
              tone={summary.blocking > 0 ? "red" : "slate"}
            />
            <SummaryStat
              label="Warnings"
              value={summary.warnings}
              tone={summary.warnings > 0 ? "amber" : "slate"}
            />
            <SummaryStat label="Edited" value={editedCount} tone={editedCount ? "sky" : "slate"} />
            <SummaryStat
              label="Deleted"
              value={deletedCount}
              tone={deletedCount ? "red" : "slate"}
            />
          </div>

          {summary.blocking > 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              Import is blocked while any row has red errors. Edit the bad values, or delete the
              row using the trash icon.
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
              All ({summary.totalRows})
            </FilterChip>
            <FilterChip
              active={filter === "errors"}
              onClick={() => setFilter("errors")}
              tone="red"
            >
              Errors ({summary.blocking})
            </FilterChip>
            <FilterChip
              active={filter === "warnings"}
              onClick={() => setFilter("warnings")}
              tone="amber"
            >
              Warnings ({summary.warnings})
            </FilterChip>
            <FilterChip
              active={filter === "edited"}
              onClick={() => setFilter("edited")}
              tone="sky"
            >
              Edited ({editedCount})
            </FilterChip>
            <FilterChip
              active={filter === "deleted"}
              onClick={() => setFilter("deleted")}
              tone="red"
            >
              Deleted ({deletedCount})
            </FilterChip>
          </div>

          <div className="mt-4 max-h-[560px] overflow-auto rounded-lg border border-slate-800">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10 bg-slate-900 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Original</th>
                  <th className="px-2 py-2 text-left">Unit No</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-left">Start</th>
                  <th className="px-2 py-2 text-left">End</th>
                  <th className="px-2 py-2 text-right">Rent</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Flags</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {visibleRows.map(({ r, i, orig }) => {
                  const hasErr = r.errors.length > 0
                  const hasWarn = r.warnings.length > 0 && !hasErr
                  const edited = orig && !rowsEqual(r, orig)
                  return (
                    <tr
                      key={r.rowIndex}
                      className={
                        r._deleted
                          ? "bg-slate-800/50 opacity-50 line-through"
                          : hasErr
                            ? "bg-red-500/5"
                            : edited
                              ? "bg-sky-500/5"
                              : hasWarn
                                ? "bg-amber-500/5"
                                : ""
                      }
                    >
                      <td className="px-2 py-1 text-slate-500">
                        {r.rowIndex}
                        {edited && !r._deleted && (
                          <Pencil className="ml-1 inline h-2.5 w-2.5 text-sky-400" />
                        )}
                      </td>
                      <td className="px-2 py-1 text-slate-400">{r.unitNoOriginal}</td>
                      <td className="px-2 py-1">
                        <EditableCell
                          value={r.unitNo}
                          onChange={(v) => updateRow(i, { unitNo: v })}
                          disabled={r._deleted}
                          className="font-semibold text-white"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <EditableCell
                          value={r.unitType}
                          onChange={(v) => updateRow(i, { unitType: v })}
                          disabled={r._deleted}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <EditableCell
                          value={r.contractStart}
                          onChange={(v) => updateRow(i, { contractStart: v })}
                          disabled={r._deleted}
                          type="date"
                          placeholder="YYYY-MM-DD"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <EditableCell
                          value={r.contractEnd}
                          onChange={(v) => updateRow(i, { contractEnd: v })}
                          disabled={r._deleted}
                          type="date"
                          placeholder="YYYY-MM-DD"
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        <EditableCell
                          value={String(r.currentRent ?? 0)}
                          onChange={(v) => updateRow(i, { currentRent: Number(v) || 0 })}
                          disabled={r._deleted}
                          type="number"
                          align="right"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={r.status}
                          disabled={r._deleted}
                          onChange={(e) =>
                            updateRow(i, {
                              status: e.target.value as "Occupied" | "Vacant",
                            })
                          }
                          className="rounded border-0 bg-transparent text-[11px] font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#ff4757]"
                        >
                          <option value="Occupied" className="bg-slate-800">
                            Occupied
                          </option>
                          <option value="Vacant" className="bg-slate-800">
                            Vacant
                          </option>
                        </select>
                      </td>
                      <td className="px-2 py-1 max-w-[240px]">
                        {hasErr && (
                          <span className="flex items-center gap-1 text-[11px] text-red-300">
                            <XCircle className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate" title={r.errors.join(" · ")}>
                              {r.errors.join(" · ")}
                            </span>
                          </span>
                        )}
                        {hasWarn && (
                          <span className="flex items-center gap-1 text-[11px] text-amber-300">
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate" title={r.warnings.join(" · ")}>
                              {r.warnings.join(" · ")}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex justify-end gap-1">
                          {edited && !r._deleted && (
                            <button
                              onClick={() => resetRow(i)}
                              title="Reset to original"
                              className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => toggleDeleted(i)}
                            title={r._deleted ? "Undo delete" : "Delete row (skip from import)"}
                            className={
                              r._deleted
                                ? "rounded p-1 text-emerald-300 hover:bg-slate-700"
                                : "rounded p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-300"
                            }
                          >
                            {r._deleted ? (
                              <Undo2 className="h-3.5 w-3.5" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs text-slate-400">
              {canCommit
                ? `Ready to create ${summary.willCreate} Unit record(s) in one transaction.${deletedCount ? ` (${deletedCount} row${deletedCount === 1 ? "" : "s"} will be skipped.)` : ""}`
                : "Fix the blocking errors above before importing."}
            </div>
            <button
              onClick={doCommit}
              disabled={!canCommit || isCommitting}
              className="ml-4 flex-shrink-0 rounded-lg bg-[#E30613] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#c20510] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isCommitting ? "Importing..." : "Confirm & Import"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EditableCell({
  value,
  onChange,
  disabled,
  type = "text",
  className = "",
  align = "left",
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  type?: "text" | "number" | "date"
  className?: string
  align?: "left" | "right"
  placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-[11px] text-slate-200 transition-colors hover:border-slate-700 focus:border-[#ff4757] focus:bg-slate-900 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${align === "right" ? "text-right" : ""} ${className}`}
    />
  )
}

function SummaryStat({
  label,
  value,
  tone = "slate",
}: {
  label: string
  value: string | number
  tone?: "slate" | "red" | "amber" | "emerald" | "sky"
}) {
  const toneClasses = {
    slate: "border-slate-800 text-slate-300",
    red: "border-red-500/40 text-red-300",
    amber: "border-amber-500/40 text-amber-300",
    emerald: "border-emerald-500/40 text-emerald-300",
    sky: "border-sky-500/40 text-sky-300",
  }[tone]
  return (
    <div className={`rounded-lg border bg-slate-900/60 p-3 ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
  tone = "slate",
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  tone?: "slate" | "red" | "amber" | "sky"
}) {
  const toneActive = {
    slate: "bg-slate-700 text-white",
    red: "bg-red-500/20 text-red-300",
    amber: "bg-amber-500/20 text-amber-300",
    sky: "bg-sky-500/20 text-sky-300",
  }[tone]
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        active ? toneActive : "bg-slate-800 text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  )
}
