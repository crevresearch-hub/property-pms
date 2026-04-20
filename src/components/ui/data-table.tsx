"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  filterable?: boolean
  filterValue?: (row: T) => string
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
  const [filters, setFilters] = useState<Record<string, Set<string>>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [filterSearch, setFilterSearch] = useState("")
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setOpenFilter(null)
        setFilterSearch("")
      }
    }
    if (openFilter) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [openFilter])

  const getCellValue = useCallback(
    (row: T, col: Column<T>): string => {
      if (col.filterValue) return col.filterValue(row)
      const val = row[col.key]
      if (val === null || val === undefined || val === "") return ""
      return String(val)
    },
    []
  )

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

  const uniqueValues = useCallback(
    (col: Column<T>): string[] => {
      const set = new Set<string>()
      for (const row of data) {
        const v = getCellValue(row, col)
        set.add(v || "(Blank)")
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    },
    [data, getCellValue]
  )

  const toggleFilterValue = (key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      const current = new Set(next[key] ?? [])
      if (current.has(value)) current.delete(value)
      else current.add(value)
      if (current.size === 0) delete next[key]
      else next[key] = current
      return next
    })
  }

  const clearColumnFilter = (key: string) => {
    setFilters((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const selectAllColumn = (col: Column<T>) => {
    const all = uniqueValues(col)
    setFilters((prev) => ({ ...prev, [col.key]: new Set(all) }))
  }

  const filteredData = useMemo(() => {
    let result = data

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

    const activeFilters = Object.entries(filters).filter(([, v]) => v.size > 0)
    if (activeFilters.length > 0) {
      result = result.filter((row) =>
        activeFilters.every(([key, allowed]) => {
          const col = columns.find((c) => c.key === key)
          if (!col) return true
          const v = getCellValue(row, col) || "(Blank)"
          return allowed.has(v)
        })
      )
    }

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
  }, [data, search, sortKey, sortDir, searchKeys, columns, filters, getCellValue])

  const activeFilterCount = Object.values(filters).filter((s) => s.size > 0).length

  return (
    <div
      className={cn(
        "overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm border-t-2 border-t-[#E30613]",
        className
      )}
    >
      {/* Search bar */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#E30613]/50 focus:ring-1 focus:ring-[#E30613]/20"
          />
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={() => setFilters({})}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" /> Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-[#1a1a1a] to-[#0a0a0a]">
              {columns.map((col) => {
                const active = (filters[col.key]?.size ?? 0) > 0
                return (
                  <th
                    key={col.key}
                    className={cn(
                      "sticky top-0 whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-300",
                      col.className
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn(col.sortable && "cursor-pointer select-none hover:text-white")}
                        onClick={col.sortable ? () => handleSort(col.key) : undefined}
                      >
                        {col.header}
                      </span>
                      {col.sortable && (
                        <span
                          className="cursor-pointer text-slate-500"
                          onClick={() => handleSort(col.key)}
                        >
                          {sortKey === col.key && sortDir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-[#ff4757]" />
                          ) : sortKey === col.key && sortDir === "desc" ? (
                            <ArrowDown className="h-3.5 w-3.5 text-[#ff4757]" />
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}
                      {col.filterable && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenFilter(openFilter === col.key ? null : col.key)
                              setFilterSearch("")
                            }}
                            className={cn(
                              "rounded p-0.5 transition-colors",
                              active
                                ? "text-[#ff4757]"
                                : "text-slate-500 hover:text-white"
                            )}
                            title="Filter"
                          >
                            <Filter className={cn("h-3.5 w-3.5", active && "fill-current")} />
                          </button>
                          {openFilter === col.key && (
                            <div
                              ref={filterRef}
                              className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-slate-300 bg-white p-2 text-slate-800 shadow-xl"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between gap-2 px-1 pb-2">
                                <span className="text-xs font-semibold text-slate-600">Filter {col.header}</span>
                                <div className="flex gap-2 text-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => selectAllColumn(col)}
                                    className="text-blue-600 hover:underline"
                                  >
                                    All
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => clearColumnFilter(col.key)}
                                    className="text-slate-500 hover:underline"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                              <input
                                type="text"
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                placeholder="Search..."
                                className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-xs normal-case text-slate-800 outline-none focus:border-blue-500"
                              />
                              <div className="max-h-56 overflow-y-auto">
                                {uniqueValues(col)
                                  .filter((v) =>
                                    filterSearch
                                      ? v.toLowerCase().includes(filterSearch.toLowerCase())
                                      : true
                                  )
                                  .map((v) => {
                                    const checked = filters[col.key]?.has(v) ?? false
                                    return (
                                      <label
                                        key={v}
                                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs normal-case hover:bg-slate-100"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleFilterValue(col.key, v)}
                                          className="h-3.5 w-3.5 accent-blue-600"
                                        />
                                        <span className="truncate" title={v}>{v}</span>
                                      </label>
                                    )
                                  })}
                                {uniqueValues(col).filter((v) =>
                                  filterSearch ? v.toLowerCase().includes(filterSearch.toLowerCase()) : true
                                ).length === 0 && (
                                  <p className="p-2 text-center text-xs text-slate-500">No matches</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </span>
                  </th>
                )
              })}
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
