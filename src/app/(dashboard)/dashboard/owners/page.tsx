"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  Handshake,
  Plus,
  Pencil,
  Search,
  Loader2,
  FileCheck,
  Clock,
  AlertCircle,
  FileText,
  Rocket,
  CheckCircle2,
} from "lucide-react"
import { KpiCard } from "@/components/ui/kpi-card"
import { cn } from "@/lib/utils"

interface Owner {
  id: string
  ownerName: string
  buildingName: string
  email: string
  phone: string
  stage: string
  contractSentAt: string | null
  contractSignedAt: string | null
  livePMSDate: string | null
  createdAt: string
  updatedAt?: string
  dldStatus?: string
  dldPdfPath?: string
  latestContractStatus?: string | null
}

const dldBadge = (status: string | undefined, hasPdf: boolean) => {
  const s = status || "Not Registered"
  if (s === "Registered" && hasPdf) {
    return {
      label: "Registered",
      cls: "bg-green-500/15 text-green-400 ring-green-500/30",
    }
  }
  if (s === "Registered") {
    return {
      label: "Registered",
      cls: "bg-green-500/15 text-green-400 ring-green-500/30",
    }
  }
  if (s === "In Progress") {
    return {
      label: "Pending",
      cls: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
    }
  }
  if (s === "Rejected") {
    return {
      label: "Rejected",
      cls: "bg-red-500/15 text-red-400 ring-red-500/30",
    }
  }
  return {
    label: "Not Registered",
    cls: "bg-slate-500/15 text-slate-400 ring-slate-500/30",
  }
}

type WorkflowBadge = { label: string; cls: string }

function workflowStatus(o: Owner): WorkflowBadge {
  const hasPdf = Boolean(o.dldPdfPath)

  if (o.stage === "Live") {
    return {
      label: "Live",
      cls: "bg-emerald-500 text-white ring-emerald-500/40",
    }
  }

  if (o.latestContractStatus === "Changes Requested") {
    return {
      label: "Changes Requested",
      cls: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
    }
  }

  if (o.contractSignedAt) {
    if (hasPdf) {
      return {
        label: "Completed",
        cls: "bg-green-500/15 text-green-400 ring-green-500/30",
      }
    }
    return {
      label: "Signed, Waiting DLD",
      cls: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
    }
  }

  if (o.contractSentAt) {
    return {
      label: "Waiting Owner",
      cls: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
    }
  }

  return {
    label: "Not Started",
    cls: "bg-slate-500/15 text-slate-400 ring-slate-500/30",
  }
}

export default function OwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const fetchOwners = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/owners")
      if (!res.ok) throw new Error("Failed to fetch owners")
      setOwners(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOwners()
  }, [fetchOwners])

  const stats = useMemo(() => {
    const total = owners.length
    const awaitingSend = owners.filter(
      (o) => o.stage === "Lead" && !o.contractSentAt
    ).length
    const waitingOwner = owners.filter(
      (o) => o.contractSentAt && !o.contractSignedAt
    ).length
    const changesRequested = owners.filter(
      (o) => o.latestContractStatus === "Changes Requested"
    ).length
    const signed = owners.filter((o) => Boolean(o.contractSignedAt)).length
    const live = owners.filter((o) => o.stage === "Live").length
    return { total, awaitingSend, waitingOwner, changesRequested, signed, live }
  }, [owners])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return owners
    return owners.filter(
      (o) =>
        o.ownerName.toLowerCase().includes(q) ||
        o.buildingName.toLowerCase().includes(q) ||
        (o.email || "").toLowerCase().includes(q)
    )
  }, [owners, search])

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Total Owners"
          value={stats.total}
          icon={<Handshake className="h-5 w-5" />}
        />
        <KpiCard
          label="Awaiting Send"
          value={stats.awaitingSend}
          color="amber"
          icon={<FileText className="h-5 w-5" />}
        />
        <KpiCard
          label="Waiting Owner Signature"
          value={stats.waitingOwner}
          color="blue"
          icon={<Clock className="h-5 w-5" />}
        />
        <KpiCard
          label="Changes Requested"
          value={stats.changesRequested}
          color="amber"
          icon={<AlertCircle className="h-5 w-5" />}
        />
        <KpiCard
          label="Signed"
          value={stats.signed}
          color="green"
          icon={<FileCheck className="h-5 w-5" />}
        />
        <KpiCard
          label="Live"
          value={stats.live}
          color="green"
          icon={<Rocket className="h-5 w-5" />}
        />
      </div>

      {/* Header: search + new button */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search owner, building or email…"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-[#E30613]/60 focus:ring-1 focus:ring-[#E30613]/30"
          />
        </div>

        <Link
          href="/dashboard/owners/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#E30613] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#c20510]"
        >
          <Plus className="h-4 w-4" />
          New Owner
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading owners…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            {owners.length === 0 ? (
              <>
                <p className="mb-3">No owners yet.</p>
                <Link
                  href="/dashboard/owners/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#E30613] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c20510]"
                >
                  <Plus className="h-4 w-4" />
                  Add your first owner
                </Link>
              </>
            ) : (
              <p>No owners match your search.</p>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Owner</th>
                <th className="px-5 py-3">Building</th>
                <th className="px-5 py-3">Workflow Status</th>
                <th className="px-5 py-3">DLD Status</th>
                <th className="px-5 py-3">Last Activity</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const lastActivity =
                  o.livePMSDate ||
                  o.contractSignedAt ||
                  o.contractSentAt ||
                  o.updatedAt ||
                  o.createdAt
                const wf = workflowStatus(o)
                return (
                  <tr
                    key={o.id}
                    className="border-b border-slate-800/60 transition-colors hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/owners/${o.id}/edit`}
                        className="block"
                      >
                        <div className="font-medium text-white">{o.ownerName}</div>
                        <div className="text-xs text-slate-400">{o.email}</div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-200">
                      {o.buildingName}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
                          wf.cls
                        )}
                      >
                        {wf.label === "Completed" || wf.label === "Live" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : null}
                        {wf.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {(() => {
                        const b = dldBadge(o.dldStatus, Boolean(o.dldPdfPath))
                        return (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                              b.cls
                            )}
                          >
                            {b.label}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {lastActivity
                        ? formatDistanceToNow(new Date(lastActivity), {
                            addSuffix: true,
                          })
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/owners/${o.id}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-[#E30613]/50 hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
