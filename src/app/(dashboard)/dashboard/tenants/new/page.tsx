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
import { UaePhoneInput, isValidUaePhone } from "@/components/ui/uae-phone-input"

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

interface ParkingSlotOption {
  id: string
  slotNo: string
  zone: string
  floor: string
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

  // Contract type — drives VAT rules and security deposit default
  const [contractType, setContractType] = useState<"Residential" | "Commercial">("Residential")

  // Financials
  const [annualRent, setAnnualRent] = useState(0)
  const [securityDepositPct, setSecurityDepositPct] = useState(5) // %
  const [adminFee, setAdminFee] = useState(500)
  const [ejariFee, setEjariFee] = useState(250)
  const [otherCharges, setOtherCharges] = useState(0)

  // Parking (optional)
  const [parkingSlots, setParkingSlots] = useState<ParkingSlotOption[]>([])
  const [parkingSlotId, setParkingSlotId] = useState("")
  const [parkingAmount, setParkingAmount] = useState(0)
  const [vehiclePlate, setVehiclePlate] = useState("")
  // Inline "create new parking slot" form
  const [showNewParking, setShowNewParking] = useState(false)
  const [newParkingSlotNo, setNewParkingSlotNo] = useState("")
  const [newParkingZone, setNewParkingZone] = useState("A")
  const [newParkingFloor, setNewParkingFloor] = useState("Basement")
  const [newParkingType, setNewParkingType] = useState("Standard")
  const [creatingParking, setCreatingParking] = useState(false)
  const [parkingError, setParkingError] = useState("")

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

  // Load available parking slots
  useEffect(() => {
    fetch("/api/parking")
      .then((r) => r.json())
      .then((data) => {
        const list: ParkingSlotOption[] = Array.isArray(data) ? data : []
        setParkingSlots(list.filter((s) => s.status === "Available"))
      })
      .catch(() => {})
  }, [])

  // Create a new parking slot inline and select it
  const handleCreateParking = async () => {
    setParkingError("")
    if (!newParkingSlotNo.trim()) {
      setParkingError("Slot number is required")
      return
    }
    setCreatingParking(true)
    try {
      const res = await fetch("/api/parking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotNo: newParkingSlotNo.trim(),
          zone: newParkingZone,
          floor: newParkingFloor,
          type: newParkingType,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || "Failed to create parking slot")
      }
      const slot = await res.json()
      setParkingSlots((prev) => [...prev, { id: slot.id, slotNo: slot.slotNo, zone: slot.zone, floor: slot.floor, status: slot.status }])
      setParkingSlotId(slot.id)
      setShowNewParking(false)
      setNewParkingSlotNo("")
    } catch (err) {
      setParkingError(err instanceof Error ? err.message : "Failed to create parking slot")
    } finally {
      setCreatingParking(false)
    }
  }

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

  // Auto-flip deposit % when contract type changes
  useEffect(() => {
    setSecurityDepositPct(contractType === "Commercial" ? 10 : 5)
  }, [contractType])

  // Auto-calc security deposit
  const securityDeposit = useMemo(
    () => Math.round((annualRent * securityDepositPct) / 100),
    [annualRent, securityDepositPct]
  )

  // VAT (UAE 5%):
  //   Residential → VAT only on Admin Fee
  //   Commercial  → VAT on Admin Fee + Annual Rent
  const vat = useMemo(() => {
    const base = contractType === "Commercial" ? adminFee + annualRent : adminFee
    return Math.round(base * 0.05)
  }, [contractType, adminFee, annualRent])

  const parkingFee = parkingSlotId ? parkingAmount : 0

  const totalAmount = useMemo(
    () => annualRent + securityDeposit + adminFee + ejariFee + vat + parkingFee + otherCharges,
    [annualRent, securityDeposit, adminFee, ejariFee, vat, parkingFee, otherCharges]
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
    isValidUaePhone(phone) &&
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
          contractType,
          purpose: contractType === "Commercial" ? "Commercial Use" : "Family Residence",
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

      // 4. Assign parking slot if selected
      if (parkingSlotId) {
        await fetch(`/api/parking/${parkingSlotId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "assign",
            tenantId,
            unitId,
            vehiclePlate,
          }),
        }).catch(() => {})
      }

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

        {/* SECTION 0: Contract Type — affects VAT and deposit rules */}
        <div className="mt-6 rounded-xl border-2 border-[#E30613]/30 bg-[#E30613]/5 p-4">
          <label className="mb-2 block text-sm font-bold text-slate-900">Contract Type *</label>
          <div className="flex gap-2">
            {(["Residential", "Commercial"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setContractType(t)}
                className={
                  contractType === t
                    ? "flex-1 rounded-lg bg-[#E30613] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
                    : "flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                }
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-600">
            {contractType === "Commercial"
              ? "⚙ Commercial: 5% VAT on Admin Fee + Annual Rent · 10% Security Deposit"
              : "⚙ Residential: 5% VAT on Admin Fee only · 5% Security Deposit"}
          </p>
        </div>

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
              <UaePhoneInput
                value={phone}
                onChange={setPhone}
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
              <label className={LABEL}>Admin Fee (AED)</label>
              <input
                type="number"
                value={adminFee || ""}
                onChange={(e) => setAdminFee(parseFloat(e.target.value) || 0)}
                className={INPUT}
              />
              <p className="mt-1 text-[11px] text-slate-500">VAT applies on this.</p>
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
        </div>

        {/* SECTION 3.5: Parking (optional) */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">
            4. Parking <span className="text-xs font-normal text-slate-500">(optional)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className={LABEL}>Parking Slot</label>
                <button
                  type="button"
                  onClick={() => { setShowNewParking((v) => !v); setParkingError("") }}
                  className="mb-1.5 text-xs font-semibold text-[#E30613] hover:underline"
                >
                  {showNewParking ? "× Cancel" : "+ Add new slot"}
                </button>
              </div>
              <select
                value={parkingSlotId}
                onChange={(e) => {
                  setParkingSlotId(e.target.value)
                  if (!e.target.value) { setParkingAmount(0); setVehiclePlate("") }
                }}
                className={INPUT}
              >
                <option value="">Not assigned</option>
                {parkingSlots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.slotNo} — Zone {s.zone} · {s.floor}
                  </option>
                ))}
              </select>

              {showNewParking && (
                <div className="mt-3 rounded-lg border-2 border-dashed border-[#E30613]/40 bg-[#E30613]/5 p-4">
                  <p className="mb-3 text-xs font-semibold text-slate-700">Create new parking slot</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>Slot No *</label>
                      <input
                        type="text"
                        value={newParkingSlotNo}
                        onChange={(e) => setNewParkingSlotNo(e.target.value)}
                        placeholder="e.g. P-101"
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Zone</label>
                      <input
                        type="text"
                        value={newParkingZone}
                        onChange={(e) => setNewParkingZone(e.target.value)}
                        placeholder="A / B / C"
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Floor</label>
                      <select
                        value={newParkingFloor}
                        onChange={(e) => setNewParkingFloor(e.target.value)}
                        className={INPUT}
                      >
                        <option>Basement</option>
                        <option>Ground</option>
                        <option>Level 1</option>
                        <option>Level 2</option>
                        <option>Level 3</option>
                        <option>Rooftop</option>
                      </select>
                    </div>
                    <div>
                      <label className={LABEL}>Type</label>
                      <select
                        value={newParkingType}
                        onChange={(e) => setNewParkingType(e.target.value)}
                        className={INPUT}
                      >
                        <option>Standard</option>
                        <option>Covered</option>
                        <option>Disabled</option>
                        <option>Visitor</option>
                      </select>
                    </div>
                  </div>
                  {parkingError && (
                    <p className="mt-2 text-xs text-red-700">⚠ {parkingError}</p>
                  )}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreateParking}
                      disabled={creatingParking || !newParkingSlotNo.trim()}
                      className="rounded-lg bg-[#E30613] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#c20510] disabled:opacity-50"
                    >
                      {creatingParking ? "Creating..." : "Create & Select"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {parkingSlotId && (
              <>
                <div>
                  <label className={LABEL}>Parking Amount (AED / year)</label>
                  <input
                    type="number"
                    value={parkingAmount || ""}
                    onChange={(e) => setParkingAmount(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 3000"
                    className={INPUT}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>Vehicle Plate <span className="text-slate-400">(optional)</span></label>
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="e.g. A 12345 Dubai"
                    className={INPUT}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* PAYMENT SUMMARY (placed after Parking so parking row is included) */}
        {(() => {
          const rentVat = contractType === "Commercial" ? Math.round(annualRent * 0.05) : 0
          const adminVat = Math.round(adminFee * 0.05)
          const parkingSlotNo = parkingSlots.find((s) => s.id === parkingSlotId)?.slotNo || ""
          type Row = { label: string; base: number; vat: number }
          const rows: Row[] = [
            { label: "Annual Rent", base: annualRent, vat: rentVat },
            { label: `Security Deposit (${securityDepositPct}%)`, base: securityDeposit, vat: 0 },
            { label: "Admin Fee", base: adminFee, vat: adminVat },
            { label: "Ejari Fee", base: ejariFee, vat: 0 },
          ]
          if (parkingSlotId && parkingAmount > 0) {
            rows.push({ label: `Parking (${parkingSlotNo})`, base: parkingAmount, vat: 0 })
          }
          if (otherCharges > 0) {
            rows.push({ label: "Other Charges", base: otherCharges, vat: 0 })
          }
          const totalBase = rows.reduce((s, r) => s + r.base, 0)
          const totalVat = rows.reduce((s, r) => s + r.vat, 0)
          const grandTotal = totalBase + totalVat
          const upfront = perCheque + securityDeposit + adminFee + adminVat + ejariFee + parkingFee + otherCharges + (contractType === "Commercial" ? Math.round(perCheque * 0.05) : 0)
          return (
            <div className="mt-8 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-900 px-4 py-2.5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">Payment Summary</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide">Details</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide">Amount (excl. VAT)</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide">VAT (5%)</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.label} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-700">{r.label}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-900">{r.base.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-500">{r.vat > 0 ? r.vat.toLocaleString() : "—"}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{(r.base + r.vat).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="px-4 py-2.5 text-sm font-bold text-slate-900">Annual Contract Value</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-slate-900">{totalBase.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-slate-900">{totalVat.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-base font-bold text-slate-900">AED {grandTotal.toLocaleString()}</td>
                  </tr>
                  <tr className="bg-[#E30613]/10">
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-[#E30613]">
                      UPFRONT (1st Cheque + Deposits + Fees + VAT{parkingFee > 0 ? " + Parking" : ""})
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-base font-bold text-[#E30613]">
                      AED {upfront.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })()}

        {/* SECTION 4: Payment Plan */}
        <div className="mt-8">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-200 pb-2 mb-4">
            5. Rent Payment Plan
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
