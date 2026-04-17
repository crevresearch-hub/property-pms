"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  RotateCcw,
  X,
  Loader2,
  FileText,
} from "lucide-react"
import type { ContractContent } from "@/lib/contract-clauses-default"

/* =================================================================
 * FullContractEditor
 * Word/Google Docs-like editor for every clause of the PM Agreement.
 * ================================================================= */

type TabId =
  | "preamble"
  | "services"
  | "fees"
  | "ownerObligations"
  | "creObligations"
  | "paymentToOwner"
  | "reports"
  | "kpis"
  | "termination"
  | "confidentiality"
  | "disputeResolution"
  | "governingLaw"
  | "sectionHeaders"
  | "footerNote"

const TABS: Array<{ id: TabId; label: string; num: string }> = [
  { id: "preamble", label: "Preamble", num: "0" },
  { id: "services", label: "Services", num: "4" },
  { id: "fees", label: "Fees", num: "5" },
  { id: "ownerObligations", label: "Owner Obligations", num: "6" },
  { id: "creObligations", label: "CRE Obligations", num: "7" },
  { id: "paymentToOwner", label: "Payment to Owner", num: "8" },
  { id: "reports", label: "Reports", num: "9" },
  { id: "kpis", label: "KPIs", num: "10" },
  { id: "termination", label: "Termination", num: "11" },
  { id: "confidentiality", label: "Confidentiality", num: "12" },
  { id: "disputeResolution", label: "Dispute Resolution", num: "13" },
  { id: "governingLaw", label: "Governing Law", num: "14" },
  { id: "sectionHeaders", label: "Section Headers", num: "#" },
  { id: "footerNote", label: "Footer Note", num: "F" },
]

interface Props {
  ownerId: string
  ownerName: string
  buildingName: string
  onClose: () => void
  onSaved: (emailSent: boolean) => void
}

export default function FullContractEditor({
  ownerId,
  ownerName,
  buildingName,
  onClose,
  onSaved,
}: Props) {
  const [content, setContent] = useState<ContractContent | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<TabId>("preamble")
  const [sendEmail, setSendEmail] = useState(true)
  const [reason, setReason] = useState("Amendment - contract text edited")

  // Load current content
  useEffect(() => {
    let aborted = false
    ;(async () => {
      setLoading(true)
      setError("")
      try {
        const r = await fetch(`/api/owners/${ownerId}/contract-content`, { cache: "no-store" })
        if (!r.ok) throw new Error((await r.json()).error || "Failed to load contract content")
        const data = await r.json()
        if (!aborted) {
          setContent(data.content as ContractContent)
          setIsCustom(!!data.isCustom)
        }
      } catch (e) {
        if (!aborted) setError(e instanceof Error ? e.message : "Failed to load contract content")
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => {
      aborted = true
    }
  }, [ownerId])

  const update = useCallback(<K extends keyof ContractContent>(key: K, value: ContractContent[K]) => {
    setContent(prev => (prev ? { ...prev, [key]: value } : prev))
  }, [])

  const handleReset = async () => {
    if (!confirm("Reset contract text to system defaults? Your custom edits will be lost.")) return
    setSaving(true)
    setError("")
    try {
      const r = await fetch(`/api/owners/${ownerId}/contract-content`, { method: "DELETE" })
      if (!r.ok) throw new Error((await r.json()).error || "Reset failed")
      const data = await r.json()
      setContent(data.content as ContractContent)
      setIsCustom(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed")
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!content) return
    if (!confirm(`Save changes and generate a new contract version for ${ownerName}?`)) return

    setSaving(true)
    setError("")
    try {
      // 1) save edited content
      const put = await fetch(`/api/owners/${ownerId}/contract-content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      })
      if (!put.ok) throw new Error((await put.json()).error || "Failed to save content")

      // 2) generate a new versioned contract
      const gen = await fetch(`/api/owners/${ownerId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || "Amendment - contract text edited" }),
      })
      if (!gen.ok) throw new Error((await gen.json()).error || "Failed to generate contract version")
      const genData = await gen.json()

      // 3) optionally email
      let emailSent = false
      if (sendEmail && genData.contract?.id) {
        const send = await fetch(`/api/owners/${ownerId}/contracts/${genData.contract.id}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }).catch(() => null)
        if (send && send.ok) emailSent = true
      }

      onSaved(emailSent)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95 backdrop-blur">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E30613]/15 ring-1 ring-[#E30613]/40">
            <FileText className="h-4 w-4 text-[#ff4757]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white md:text-base">Full Contract Editor</h2>
              {isCustom && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-500/30">
                  CUSTOM
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400">
              {ownerName} &middot; {buildingName}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
          title="Close"
        >
          <X className="h-4 w-4" /> Close
        </button>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Tabs */}
        <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-slate-800 bg-slate-900/60 p-2 md:max-w-[230px] md:flex-col md:gap-0.5 md:overflow-y-auto md:border-b-0 md:border-r">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium transition " +
                (tab === t.id
                  ? "bg-[#E30613]/15 text-white ring-1 ring-[#E30613]/50"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white")
              }
            >
              <span className="font-mono text-[10px] text-slate-500">{t.num}</span>
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          ))}
        </aside>

        {/* Panel */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-950 p-4 md:p-6">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading contract content...
            </div>
          )}
          {!loading && error && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}
          {!loading && content && (
            <TabPanel tab={tab} content={content} update={update} />
          )}
        </main>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-900 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={saving || loading}
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to Default
          </button>
          <label className="inline-flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={e => setSendEmail(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#E30613]"
            />
            Email new version to owner
          </label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for new version"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-[#E30613] focus:outline-none md:w-72"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading || !content}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#E30613] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c20510] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? "Saving..." : "Save & Generate New Version"}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================ */
/* Tab panel switcher                                            */
/* ============================================================ */

function TabPanel({
  tab,
  content,
  update,
}: {
  tab: TabId
  content: ContractContent
  update: <K extends keyof ContractContent>(key: K, value: ContractContent[K]) => void
}) {
  switch (tab) {
    case "preamble":
      return (
        <Section title="Preamble" num="0" description="Opening paragraph of the agreement.">
          <BilingualField
            labelEn="English"
            labelAr="Arabic (العربية)"
            valueEn={content.preambleEn}
            valueAr={content.preambleAr}
            onChangeEn={v => update("preambleEn", v)}
            onChangeAr={v => update("preambleAr", v)}
            rows={6}
          />
        </Section>
      )
    case "services":
      return (
        <ListSection<{ en: string; ar: string }>
          title="Scope of Services"
          num="4"
          description="Checklist of services CRE provides."
          items={content.services}
          onChange={items => update("services", items)}
          blank={{ en: "", ar: "" }}
          renderRow={(item, idx, change) => (
            <BilingualField
              labelEn={`English #${idx + 1}`}
              labelAr="Arabic (العربية)"
              valueEn={item.en}
              valueAr={item.ar}
              onChangeEn={v => change({ ...item, en: v })}
              onChangeAr={v => change({ ...item, ar: v })}
              rows={2}
            />
          )}
        />
      )
    case "fees":
      return (
        <ListSection<ContractContent["fees"][number]>
          title="Commission & Fees Structure"
          num="5"
          description="Fee table with service name, amount, remarks, and beneficiary."
          items={content.fees}
          onChange={items => update("fees", items)}
          blank={{ serviceEn: "", serviceAr: "", amount: "", remarksEn: "", remarksAr: "", beneficiary: "Alwaan" }}
          renderRow={(f, _idx, change) => (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <LabeledInput label="Service (English)" value={f.serviceEn} onChange={v => change({ ...f, serviceEn: v })} />
                <LabeledInput label="Service (Arabic)" value={f.serviceAr} onChange={v => change({ ...f, serviceAr: v })} rtl />
              </div>
              <LabeledInput label="Amount" value={f.amount} onChange={v => change({ ...f, amount: v })} />
              <div className="grid gap-3 md:grid-cols-2">
                <LabeledTextarea label="Remarks (English)" value={f.remarksEn} onChange={v => change({ ...f, remarksEn: v })} rows={2} />
                <LabeledTextarea label="Remarks (Arabic)" value={f.remarksAr} onChange={v => change({ ...f, remarksAr: v })} rows={2} rtl />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Beneficiary</label>
                <select
                  value={f.beneficiary}
                  onChange={e => change({ ...f, beneficiary: e.target.value })}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-[#E30613] focus:outline-none"
                >
                  <option value="Alwaan">Alwaan</option>
                  <option value="Landlord">Landlord</option>
                </select>
              </div>
            </div>
          )}
          extraBelow={
            <BilingualField
              labelEn="Fees footer note (English)"
              labelAr="Fees footer note (Arabic)"
              valueEn={content.feesFooterEn}
              valueAr={content.feesFooterAr}
              onChangeEn={v => update("feesFooterEn", v)}
              onChangeAr={v => update("feesFooterAr", v)}
              rows={4}
            />
          }
        />
      )
    case "ownerObligations":
      return (
        <ListSection<{ en: string; ar: string }>
          title="Owner Obligations"
          num="6"
          items={content.ownerObligations}
          onChange={items => update("ownerObligations", items)}
          blank={{ en: "", ar: "" }}
          renderRow={(item, idx, change) => (
            <BilingualField
              labelEn={`Clause ${idx + 1} (English)`}
              labelAr="Arabic (العربية)"
              valueEn={item.en}
              valueAr={item.ar}
              onChangeEn={v => change({ ...item, en: v })}
              onChangeAr={v => change({ ...item, ar: v })}
              rows={3}
            />
          )}
        />
      )
    case "creObligations":
      return (
        <ListSection<{ en: string; ar: string }>
          title="CRE Obligations"
          num="7"
          items={content.creObligations}
          onChange={items => update("creObligations", items)}
          blank={{ en: "", ar: "" }}
          renderRow={(item, idx, change) => (
            <BilingualField
              labelEn={`Clause ${idx + 1} (English)`}
              labelAr="Arabic (العربية)"
              valueEn={item.en}
              valueAr={item.ar}
              onChangeEn={v => change({ ...item, en: v })}
              onChangeAr={v => change({ ...item, ar: v })}
              rows={3}
            />
          )}
        />
      )
    case "paymentToOwner":
      return (
        <ListSection<{ en: string; ar: string }>
          title="Payment to Owner"
          num="8"
          description="Tokens {{paymentFrequency}}, {{paymentFrequencyDesc}}, {{paymentFrequencyArDesc}}, and {{approvalThreshold}} are replaced automatically."
          items={content.paymentToOwner}
          onChange={items => update("paymentToOwner", items)}
          blank={{ en: "", ar: "" }}
          renderRow={(item, idx, change) => (
            <BilingualField
              labelEn={`Clause ${idx + 1} (English, HTML allowed)`}
              labelAr="Arabic (العربية)"
              valueEn={item.en}
              valueAr={item.ar}
              onChangeEn={v => change({ ...item, en: v })}
              onChangeAr={v => change({ ...item, ar: v })}
              rows={3}
            />
          )}
        />
      )
    case "reports":
      return (
        <ListSection<ContractContent["reports"][number]>
          title="Reporting Obligations"
          num="9"
          items={content.reports}
          onChange={items => update("reports", items)}
          blank={{ en: "", ar: "", freq: "Monthly / شهري" }}
          renderRow={(r, idx, change) => (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <LabeledInput label={`Report #${idx + 1} (English)`} value={r.en} onChange={v => change({ ...r, en: v })} />
                <LabeledInput label="Arabic (العربية)" value={r.ar} onChange={v => change({ ...r, ar: v })} rtl />
              </div>
              <LabeledInput label="Frequency" value={r.freq} onChange={v => change({ ...r, freq: v })} />
            </div>
          )}
        />
      )
    case "kpis":
      return (
        <ListSection<ContractContent["kpis"][number]>
          title="Key Performance Indicators"
          num="10"
          items={content.kpis}
          onChange={items => update("kpis", items)}
          blank={{ labelEn: "", labelAr: "", target: "" }}
          renderRow={(k, idx, change) => (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <LabeledInput label={`KPI #${idx + 1} Label (English)`} value={k.labelEn} onChange={v => change({ ...k, labelEn: v })} />
                <LabeledInput label="Label (Arabic)" value={k.labelAr} onChange={v => change({ ...k, labelAr: v })} rtl />
              </div>
              <LabeledInput label="Target" value={k.target} onChange={v => change({ ...k, target: v })} />
            </div>
          )}
        />
      )
    case "termination":
      return (
        <ListSection<{ en: string; ar: string }>
          title="Termination of Agreement"
          num="11"
          description="Token {{noticePeriodDays}} is replaced from the owner's contract settings."
          items={content.termination}
          onChange={items => update("termination", items)}
          blank={{ en: "", ar: "" }}
          renderRow={(item, idx, change) => (
            <BilingualField
              labelEn={`Clause ${idx + 1} (English, HTML allowed)`}
              labelAr="Arabic (العربية)"
              valueEn={item.en}
              valueAr={item.ar}
              onChangeEn={v => change({ ...item, en: v })}
              onChangeAr={v => change({ ...item, ar: v })}
              rows={3}
            />
          )}
        />
      )
    case "confidentiality":
      return (
        <ListSection<{ en: string; ar: string }>
          title="Confidentiality & Data Protection"
          num="12"
          items={content.confidentiality}
          onChange={items => update("confidentiality", items)}
          blank={{ en: "", ar: "" }}
          renderRow={(item, idx, change) => (
            <BilingualField
              labelEn={`Clause ${idx + 1} (English)`}
              labelAr="Arabic (العربية)"
              valueEn={item.en}
              valueAr={item.ar}
              onChangeEn={v => change({ ...item, en: v })}
              onChangeAr={v => change({ ...item, ar: v })}
              rows={3}
            />
          )}
        />
      )
    case "disputeResolution":
      return (
        <ListSection<{ en: string; ar: string }>
          title="Dispute Resolution"
          num="13"
          items={content.disputeResolution}
          onChange={items => update("disputeResolution", items)}
          blank={{ en: "", ar: "" }}
          renderRow={(item, idx, change) => (
            <BilingualField
              labelEn={`Step ${idx + 1} (English, HTML allowed)`}
              labelAr="Arabic (العربية)"
              valueEn={item.en}
              valueAr={item.ar}
              onChangeEn={v => change({ ...item, en: v })}
              onChangeAr={v => change({ ...item, ar: v })}
              rows={3}
            />
          )}
        />
      )
    case "governingLaw":
      return (
        <ListSection<{ en: string; ar: string }>
          title="Governing Law"
          num="14"
          items={content.governingLaw}
          onChange={items => update("governingLaw", items)}
          blank={{ en: "", ar: "" }}
          renderRow={(item, idx, change) => (
            <BilingualField
              labelEn={`Clause ${idx + 1} (English)`}
              labelAr="Arabic (العربية)"
              valueEn={item.en}
              valueAr={item.ar}
              onChangeEn={v => change({ ...item, en: v })}
              onChangeAr={v => change({ ...item, ar: v })}
              rows={2}
            />
          )}
        />
      )
    case "sectionHeaders": {
      const sh = content.sectionHeaders
      const setSh = (patch: Partial<typeof sh>) =>
        update("sectionHeaders", { ...sh, ...patch })
      const rows: Array<{ num: string; enKey: keyof typeof sh; arKey: keyof typeof sh }> = [
        { num: "1", enKey: "s1En", arKey: "s1Ar" },
        { num: "2", enKey: "s2En", arKey: "s2Ar" },
        { num: "3", enKey: "s3En", arKey: "s3Ar" },
        { num: "4", enKey: "s4En", arKey: "s4Ar" },
        { num: "5", enKey: "s5En", arKey: "s5Ar" },
        { num: "6", enKey: "s6En", arKey: "s6Ar" },
        { num: "7", enKey: "s7En", arKey: "s7Ar" },
        { num: "8", enKey: "s8En", arKey: "s8Ar" },
        { num: "9", enKey: "s9En", arKey: "s9Ar" },
        { num: "10", enKey: "s10En", arKey: "s10Ar" },
        { num: "11", enKey: "s11En", arKey: "s11Ar" },
        { num: "12", enKey: "s12En", arKey: "s12Ar" },
        { num: "13", enKey: "s13En", arKey: "s13Ar" },
        { num: "14", enKey: "s14En", arKey: "s14Ar" },
        { num: "15", enKey: "s15En", arKey: "s15Ar" },
      ]
      return (
        <Section title="Section Headers" num="#" description="Titles for each of the 15 contract sections.">
          <div className="space-y-3">
            {rows.map(r => (
              <div key={r.num} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#ff4757]">
                  Section {r.num}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledInput label="English" value={sh[r.enKey]} onChange={v => setSh({ [r.enKey]: v } as Partial<typeof sh>)} />
                  <LabeledInput label="Arabic (العربية)" value={sh[r.arKey]} onChange={v => setSh({ [r.arKey]: v } as Partial<typeof sh>)} rtl />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )
    }
    case "footerNote":
      return (
        <Section title="Footer Note" num="F" description="Printed at the bottom of every contract page set.">
          <BilingualField
            labelEn="English"
            labelAr="Arabic (العربية)"
            valueEn={content.footerNoteEn}
            valueAr={content.footerNoteAr}
            onChangeEn={v => update("footerNoteEn", v)}
            onChangeAr={v => update("footerNoteAr", v)}
            rows={3}
          />
        </Section>
      )
  }
}

/* ============================================================ */
/* Reusable atoms                                                */
/* ============================================================ */

function Section({
  title,
  num,
  description,
  children,
}: {
  title: string
  num: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-md bg-[#E30613]/15 px-2 font-mono text-[11px] font-bold text-[#ff4757] ring-1 ring-[#E30613]/40">
            {num}
          </span>
          <h3 className="text-base font-bold text-white md:text-lg">{title}</h3>
        </div>
        {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function BilingualField({
  labelEn,
  labelAr,
  valueEn,
  valueAr,
  onChangeEn,
  onChangeAr,
  rows = 3,
}: {
  labelEn: string
  labelAr: string
  valueEn: string
  valueAr: string
  onChangeEn: (v: string) => void
  onChangeAr: (v: string) => void
  rows?: number
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <LabeledTextarea label={labelEn} value={valueEn} onChange={onChangeEn} rows={rows} />
      <LabeledTextarea label={labelAr} value={valueAr} onChange={onChangeAr} rows={rows} rtl />
    </div>
  )
}

function LabeledTextarea({
  label,
  value,
  onChange,
  rows = 3,
  rtl = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
  rtl?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        dir={rtl ? "rtl" : undefined}
        style={rtl ? { fontFamily: "Cairo, sans-serif" } : undefined}
        className="w-full resize-y rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-[#E30613] focus:outline-none"
      />
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  rtl = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rtl?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        dir={rtl ? "rtl" : undefined}
        style={rtl ? { fontFamily: "Cairo, sans-serif" } : undefined}
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-[#E30613] focus:outline-none"
      />
    </div>
  )
}

function ListSection<T>({
  title,
  num,
  description,
  items,
  onChange,
  blank,
  renderRow,
  extraBelow,
}: {
  title: string
  num: string
  description?: string
  items: T[]
  onChange: (items: T[]) => void
  blank: T
  renderRow: (item: T, idx: number, change: (next: T) => void) => React.ReactNode
  extraBelow?: React.ReactNode
}) {
  const change = (idx: number) => (next: T) => {
    const copy = items.slice()
    copy[idx] = next
    onChange(copy)
  }
  const remove = (idx: number) => () => {
    if (!confirm("Remove this item?")) return
    const copy = items.slice()
    copy.splice(idx, 1)
    onChange(copy)
  }
  const moveUp = (idx: number) => () => {
    if (idx <= 0) return
    const copy = items.slice()
    ;[copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]]
    onChange(copy)
  }
  const moveDown = (idx: number) => () => {
    if (idx >= items.length - 1) return
    const copy = items.slice()
    ;[copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]]
    onChange(copy)
  }
  const add = () => {
    // Defensive deep copy of blank so different rows don't share a reference
    onChange([...items, JSON.parse(JSON.stringify(blank)) as T])
  }

  const blankKey = useMemo(() => JSON.stringify(blank), [blank])

  return (
    <Section title={title} num={num} description={description}>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={`${blankKey}-${idx}`}
            className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#ff4757]">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#E30613]/20 font-mono text-[10px]">
                  {idx + 1}
                </span>
                Item {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={moveUp(idx)}
                  disabled={idx === 0}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                  title="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={moveDown(idx)}
                  disabled={idx === items.length - 1}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30"
                  title="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={remove(idx)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-600/20 text-red-300 ring-1 ring-inset ring-red-500/30 hover:bg-red-600/30"
                  title="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {renderRow(item, idx, change(idx))}
          </div>
        ))}
        <button
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-600 bg-slate-900/30 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-[#E30613]/60 hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" /> Add Item
        </button>
      </div>
      {extraBelow && <div className="mt-6 border-t border-slate-800 pt-4">{extraBelow}</div>}
    </Section>
  )
}
