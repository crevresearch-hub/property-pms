"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Send,
  AlertCircle,
  Upload,
  CheckCircle2,
  Loader2,
  Calculator,
  X,
} from "lucide-react"

const LABEL = "mb-1.5 block text-sm font-medium text-slate-700"
const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-[#E30613] focus:ring-2 focus:ring-[#E30613]/20"

interface Unit {
  id: string
  unitNo: string
  unitType: string
  currentRent: number
  status: string
}

// Add 1 year to a YYYY-MM-DD date
function plusOneYear(dateStr: string): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

// Months difference
function monthsBetween(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
}

export default function NewTenantPage() {
  const router = useRouter()

  // Tenant basic info
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [tenantName, setTenantName] = useState("")

  // Unit
  const [units, setUnits] = useState<Unit[]>([])
  const [unitId, setUnitId] = useState("")

  // Lease dates
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Financials
  const [annualRent, setAnnualRent] = useState(0)
  const [securityDepositPct, setSecurityDepositPct] = useState(5) // %
  const [ejariFee, setEjariFee] = useState(250)
  const [dldDeposit, setDldDeposit] = useState(0)
  const [otherCharges, setOtherCharges] = useState(0)

  // Payment plan
  const [installments, setInstallments] = useState(4) // 1, 2, 3, 4, 6, 12

  // EID upload
  const [eidFile, setEidFile] = useState<File | null>(null)
  const [eidExtracted, setEidExtracted] = useState({
    nameEn: "",
    nameAr: "",
    eidNumber: "",
    nationality: "",
    dob: "",
    expiry: "",
  })
  const [eidStep, setEidStep] = useState<"upload" | "review">("upload")

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Load vacant units
  useEffect(() => {
    fetch("/api/units")
      .then((r) => r.json())
      .then((data) => {
        const list: Unit[] = Array.isArray(data) ? data : []
        setUnits(list.filter((u) => u.status === "Vacant"))
      })
      .catch(() => {})
  }, [])

  // When unit changes, auto-fill rent
  useEffect(() => {
    const u = units.find((x) => x.id === unitId)
    if (u && u.currentRent) setAnnualRent(u.currentRent)
  }, [unitId, units])

  // When start date changes, auto-set end date to +1 year (if not set)
  useEffect(() => {
    if (startDate && !endDate) {
      setEndDate(plusOneYear(startDate))
    }
  }, [startDate, endDate])

  // Auto-calc security deposit
  const securityDeposit = useMemo(
    () => Math.round((annualRent * securityDepositPct) / 100),
    [annualRent, securityDepositPct]
  )

  const totalAmount = useMemo(
    () => annualRent + securityDeposit + ejariFee + dldDeposit + otherCharges,
    [annualRent, securityDeposit, ejariFee, dldDeposit, otherCharges]
  )

  // Per-cheque amount
  const monthsForRent = monthsBetween(startDate, endDate) || 12
  const perCheque = useMemo(() => {
    if (installments < 1) return 0
    return Math.round(annualRent / installments)
  }, [annualRent, installments])

  const monthsBetweenCheques = useMemo(() => {
    if (installments < 1) return 0
    return Math.round(monthsForRent / installments)
  }, [monthsForRent, installments])

  // Date validation
  const dateError = useMemo(() => {
    if (!startDate || !endDate) return ""
    if (new Date(endDate) <= new Date(startDate)) return "End date must be after start date"
    const months = monthsBetween(startDate, endDate)
    if (months < 12) return `Lease must be at least 12 months (currently ${months} months)`
    return ""
  }, [startDate, endDate])

  const [eidOcrRunning, setEidOcrRunning] = useState(false)

  // Handle EID upload — real OCR via tesseract.js
  const handleEidUpload = async (file: File | null) => {
    if (!file) return
    setEidFile(file)
    setEidStep("review")
    setEidExtracted({
      nameEn: tenantName || "",
      nameAr: "",
      eidNumber: "",
      nationality: "",
      dob: "",
      expiry: "",
    })

    if (!file.type.startsWith("image/")) return // skip PDFs for now

    setEidOcrRunning(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/eid/ocr", { method: "POST", body: fd })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        console.error("OCR error:", e)
        return
      }
      const result = await res.json()
      setEidExtracted((prev) => ({
        nameEn: result.nameEn || prev.nameEn,
        nameAr: result.nameAr || prev.nameAr,
        eidNumber: result.eidNumber || prev.eidNumber,
        nationality: result.nationality || prev.nationality,
        dob: result.dob || "",
        expiry: result.expiry || "",
      }))
      return
    } catch (err) {
      console.error("OCR failed:", err)
      return
    } finally {
      setEidOcrRunning(false)
    }
  }

  // Validation — EID is collected from the tenant on the sign page
  const canSubmit =
    !!email &&
    !!phone &&
    !!unitId &&
    !!startDate &&
    !!endDate &&
    !dateError &&
    annualRent > 0

  // Submit
  const handleSubmit = async () => {
    setError("")
    setSuccess("")
    if (!canSubmit) {
      setError("Please complete all required fields.")
      return
    }
    setSubmitting(true)
    try {
      // Placeholder name — overwritten from EID OCR after the tenant
      // uploads their Emirates ID on the signing page.
      const interimName = tenantName || "Pending Tenant"

      // 1. Create tenant
      const tenantRes = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: interimName,
          email,
          phone,
          unitId,
        }),
      })
      if (!tenantRes.ok) {
        const e = await tenantRes.json().catch(() => ({}))
        throw new Error(e.error || "Failed to create tenant")
      }
      const tenant = await tenantRes.json()
      const tenantId = tenant.id

      // 2. Create tenancy contract (DLD format) — EID collected from tenant on sign page
      const owner = await fetch("/api/owners")
        .then((r) => r.json())
        .then((arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : null))
        .catch(() => null)
      const ctRes = await fetch(`/api/tenants/${tenantId}/tenancy-contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          ownerId: owner?.id || null,
          contractStart: startDate,
          contractEnd: endDate,
          rentAmount: annualRent,
          numberOfCheques: installments,
          securityDeposit,
          ejariFee,
          contractType: "Residential",
          purpose: "Family Residence",
          reason: "Initial",
        }),
      })
      if (!ctRes.ok) {
        const e = await ctRes.json().catch(() => ({}))
        throw new Error(e.error || "Failed to create contract")
      }
      const ctData = await ctRes.json()
      const contract = ctData.contract || ctData
      const contractId = contract.id

      // 5. Send to tenant for signature
      await fetch(`/api/tenants/${tenantId}/tenancy-contracts/${contractId}/send`, {
        method: "POST",
      }).catch(() => {})

      setSuccess(
        `✓ Sent to ${email}. Tenant will receive an email with the contract to sign online.`
      )
      setTimeout(() => {
        router.push(`/dashboard/tenants/${tenantId}/edit`)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tenant")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <Link
        href="/dashboard/tenants"
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Tenants
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">New Tenant — Quick Add</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fill the basic info, upload Emirates ID, and send the contract to the tenant for online signature.
        </p>

        {error && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* SECTION 1: Basic Info */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">
            1. Tenant Contact
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tenant@email.com"
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Phone *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+971 50 123 4567"
                className={INPUT}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Unit + Dates */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">
            2. Unit & Lease Period
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={LABEL}>Assign Unit *</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className={INPUT}
              >
                <option value="">Select a vacant unit...</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitNo} — {u.unitType} — AED {u.currentRent.toLocaleString()}/year
                  </option>
                ))}
              </select>
              {units.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  No vacant units. Add some via{" "}
                  <Link href="/dashboard/units" className="underline">
                    Units page
                  </Link>
                  .
                </p>
              )}
            </div>
            <div>
              <label className={LABEL}>Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>End Date * (min 1 year)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate ? plusOneYear(startDate) : undefined}
                className={INPUT}
              />
            </div>
          </div>
          {dateError && (
            <p className="mt-2 text-xs text-red-700">⚠ {dateError}</p>
          )}
          {!dateError && startDate && endDate && (
            <p className="mt-2 text-xs text-slate-500">
              Lease duration: <strong>{monthsBetween(startDate, endDate)} months</strong>
            </p>
          )}
        </div>

        {/* SECTION 3: Financials */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">
            3. Financial Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Annual Rent (AED) *</label>
              <input
                type="number"
                value={annualRent || ""}
                onChange={(e) => setAnnualRent(parseFloat(e.target.value) || 0)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Security Deposit %</label>
              <select
                value={securityDepositPct}
                onChange={(e) => setSecurityDepositPct(parseInt(e.target.value))}
                className={INPUT}
              >
                <option value="5">5% (Residential)</option>
                <option value="10">10% (Commercial)</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                = AED {securityDeposit.toLocaleString()}
              </p>
            </div>
            <div>
              <label className={LABEL}>Ejari Fee (AED)</label>
              <input
                type="number"
                value={ejariFee || ""}
                onChange={(e) => setEjariFee(parseFloat(e.target.value) || 0)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>DLD / Other Deposit (AED)</label>
              <input
                type="number"
                value={dldDeposit || ""}
                onChange={(e) => setDldDeposit(parseFloat(e.target.value) || 0)}
                className={INPUT}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>Other Charges (AED)</label>
              <input
                type="number"
                value={otherCharges || ""}
                onChange={(e) => setOtherCharges(parseFloat(e.target.value) || 0)}
                className={INPUT}
                placeholder="0"
              />
            </div>
          </div>

          {/* Total */}
          <div className="mt-4 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">Annual Rent</span>
              <span className="font-semibold text-slate-900">AED {annualRent.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">Security Deposit ({securityDepositPct}%)</span>
              <span className="font-semibold text-slate-900">AED {securityDeposit.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">Ejari Fee</span>
              <span className="font-semibold text-slate-900">AED {ejariFee.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">DLD / Other Deposit</span>
              <span className="font-semibold text-slate-900">AED {dldDeposit.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">Other Charges</span>
              <span className="font-semibold text-slate-900">AED {otherCharges.toLocaleString()}</span>
            </div>
            <div className="mt-2 border-t border-slate-300 pt-2 flex items-center justify-between text-sm text-slate-700">
              <span>Annual Contract Value</span>
              <span className="font-semibold text-slate-900">AED {totalAmount.toLocaleString()}</span>
            </div>
            <div className="mt-1 rounded-md bg-[#E30613]/10 border border-[#E30613]/30 p-3 flex items-center justify-between text-base font-bold text-[#E30613]">
              <span>UPFRONT (1st Cheque + Deposits + Fees)</span>
              <span>
                AED{" "}
                {(perCheque + securityDeposit + ejariFee + dldDeposit + otherCharges).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 4: Payment Plan */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">
            4. Rent Payment Plan
          </h2>
          <div>
            <label className={LABEL}>Number of Cheques (Installments)</label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 6, 12].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setInstallments(n)}
                  className={
                    installments === n
                      ? "rounded-lg bg-[#E30613] px-4 py-2 text-sm font-semibold text-white"
                      : "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  }
                >
                  {n === 1 ? "1 (Full)" : `${n} cheques`}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
            <div className="flex items-center gap-2 text-blue-900 font-semibold">
              <Calculator className="h-4 w-4" />
              Each cheque: <span className="text-base">AED {perCheque.toLocaleString()}</span>
            </div>
            <p className="mt-1 text-xs text-blue-800">
              Paid every {monthsBetweenCheques} month{monthsBetweenCheques === 1 ? "" : "s"} —
              total {installments} cheque{installments === 1 ? "" : "s"} over {monthsForRent} months.
            </p>
          </div>
        </div>

        {/* SECTION 5: Emirates ID — moved to tenant sign page */}
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Emirates ID is collected from the tenant directly.</strong>
              <p className="mt-1 text-xs text-blue-800">
                When the tenant opens the signing link, they will upload their Emirates ID
                (front &amp; back). The system auto-extracts name, EID number, expiry and
                nationality, and the tenant fills in family size and emergency contact
                before signing.
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-8 border-t border-slate-200 pt-6">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#E30613] px-6 py-4 text-base font-bold text-white shadow-lg hover:bg-[#c20510] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating tenant + sending email...
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                Submit & Send Contract to Tenant
              </>
            )}
          </button>
          <p className="mt-3 text-center text-xs text-slate-500">
            The tenant will receive an email with the contract to <strong>sign online</strong>.
            <br />
            After they sign, you&rsquo;ll add cheques + Ejari and send login credentials.
          </p>
        </div>
      </div>
    </div>
  )
}
