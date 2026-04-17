"use client"

import { useState, useMemo, useCallback } from "react"
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  className?: string
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  searchPlaceholder?: string
  searchKeys?: string[]
  onRowClick?: (row: T) => void
  emptyMessage?: string
  className?: string
}

type SortDirection = "asc" | "desc" | null

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchPlaceholder = "Search...",
  searchKeys,
  onRowClick,
  emptyMessage = "No data found.",
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        if (sortDir === "asc") setSortDir("desc")
        else if (sortDir === "desc") {
          setSortKey(null)
          setSortDir(null)
        }
      } else {
        setSortKey(key)
        setSortDir("asc")
      }
    },
    [sortKey, sortDir]
  )

  const filteredData = useMemo(() => {
    let result = data

    // Search filtering
    if (search.trim()) {
      const term = search.toLowerCase()
      const keys = searchKeys || columns.map((c) => c.key)
      result = result.filter((row) =>
        keys.some((key) => {
          const val = row[key]
          return val !== null && val !== undefined && String(val).toLowerCase().includes(term)
        })
      )
    }

    // Sorting
    if (sortKey && sortDir) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortKey]
        const bVal = b[sortKey]
        if (aVal === bVal) return 0
        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1

        let comparison: number
        if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = aVal - bVal
        } else {
          comparison = String(aVal).localeCompare(String(bVal))
        }
        return sortDir === "asc" ? comparison : -comparison
      })
    }

    return result
  }, [data, search, sortKey, sortDir, searchKeys, columns])

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm border-t-2 border-t-[#E30613]",
        className
      )}
    >
      {/* Search bar */}
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#E30613]/50 focus:ring-1 focus:ring-[#E30613]/20"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-[#1a1a1a] to-[#0a0a0a]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "sticky top-0 whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300",
                    col.sortable && "cursor-pointer select-none hover:text-white",
                    col.className
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      <span className="text-slate-500">
                        {sortKey === col.key && sortDir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5 text-[#ff4757]" />
                        ) : sortKey === col.key && sortDir === "desc" ? (
                          <ArrowDown className="h-3.5 w-3.5 text-[#ff4757]" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "transition-colors",
                    onRowClick && "cursor-pointer",
                    "hover:bg-slate-50"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-slate-700",
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : (row[col.key] as React.ReactNode) ?? ""}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with count */}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5">
        <p className="text-xs text-slate-500">
          {filteredData.length} of {data.length} record{data.length !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  )
}
