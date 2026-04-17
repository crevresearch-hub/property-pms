"use client"

import { useState, useEffect } from "react"
import { DataTable, Column } from "@/components/ui/data-table"
import { Activity } from "lucide-react"

interface ActivityRow {
  id: string
  user: string
  action: string
  details: string
  createdAt: string
  [key: string]: unknown
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/activity")
        if (!res.ok) throw new Error("Failed to fetch activity logs")
        setLogs(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const columns: Column<ActivityRow>[] = [
    { key: "user", header: "User", sortable: true },
    { key: "action", header: "Action", sortable: true },
    { key: "details", header: "Details" },
    {
      key: "createdAt",
      header: "Timestamp",
      sortable: true,
      render: (r) => new Date(r.createdAt).toLocaleString(),
    },
  ]

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Activity Log</h1>
          <p className="mt-1 text-sm text-slate-400">
            {logs.length} recent actions recorded
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={logs}
        searchPlaceholder="Search activity..."
        searchKeys={["user", "action", "details"]}
      />
    </div>
  )
}
