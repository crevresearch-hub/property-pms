"use client"

import { useEffect, useState } from "react"
import { Building2, MapPin, Calendar, Shield, FileText, Users, Car, Layers } from "lucide-react"

interface OwnerInfo {
  owner: { id: string; name: string; email: string; buildingName: string; area: string; serviceType: string }
  totals: { totalUnits: number; occupied: number; vacant: number; annualRentRoll: number; collected: number; pending: number }
  units: Array<{ id: string; unitNo: string; unitType: string; status: string }>
}

const aed = (n: number) => `AED ${Number(n || 0).toLocaleString()}`

// Dummy building specs for Alwaan Residence
const specs = {
  built: "2018",
  floors: 6,
  totalUnits: 24,
  parking: 36,
  elevators: 2,
  pool: true,
  gym: true,
  security: "24/7 CCTV + Guard",
  plotNo: "347-0",
  makaniNo: "28374 19283",
  titleDeed: "TD-2018-00347",
  municipality: "Dubai Municipality",
  dewaPremise: "DWP-10293847",
  civilDefense: "Valid until Dec 2027",
  insurance: "AIG Property All-Risk — Valid until Apr 2027",
}

const amenities = [
  { icon: Car, label: "36 Parking Spaces", detail: "2 levels underground" },
  { icon: Users, label: "Swimming Pool", detail: "Rooftop, heated" },
  { icon: Shield, label: "24/7 Security", detail: "CCTV + access cards" },
  { icon: Layers, label: "Gym / Fitness", detail: "Ground floor" },
  { icon: Building2, label: "2 Elevators", detail: "Passenger + service" },
  { icon: MapPin, label: "Lobby Reception", detail: "Staffed 8am – 8pm" },
]

const docs = [
  { name: "Property Management Agreement", status: "Signed", date: "15 Apr 2026" },
  { name: "Title Deed Copy", status: "On File", date: "2018" },
  { name: "Building Completion Certificate", status: "On File", date: "2018" },
  { name: "Civil Defense Certificate", status: "Valid", date: "Exp Dec 2027" },
  { name: "Building Insurance Policy", status: "Active", date: "Exp Apr 2027" },
  { name: "DEWA Registration", status: "Active", date: "Premise: DWP-10293847" },
]

export default function PropertyPage() {
  const [data, setData] = useState<OwnerInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/owner/dashboard").then(async (r) => { if (r.ok) setData(await r.json()) }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#E30613] border-t-transparent" /></div>

  const unitsByType: Record<string, number> = {}
  data?.units.forEach((u) => { unitsByType[u.unitType || "Other"] = (unitsByType[u.unitType || "Other"] || 0) + 1 })

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-[#E30613] font-bold">Alwaan Residence</p>
        <h2 className="text-2xl font-bold">Property Profile</h2>
        <p className="text-sm text-white/40">Trade Center Second, Dubai, U.A.E.</p>
      </div>

      {/* Building hero */}
      <section className="rounded-2xl border border-[#E30613]/20 bg-gradient-to-r from-[#E30613]/10 to-transparent p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-bold mb-3">Building Information</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Building Name" value="Alwaan Residence" />
              <Field label="Location" value="Trade Center Second, Dubai" />
              <Field label="Year Built" value={specs.built} />
              <Field label="Total Floors" value={String(specs.floors)} />
              <Field label="Total Units" value={String(specs.totalUnits)} />
              <Field label="Parking Spaces" value={String(specs.parking)} />
              <Field label="Plot No." value={specs.plotNo} />
              <Field label="Makani No." value={specs.makaniNo} />
              <Field label="Title Deed" value={specs.titleDeed} />
              <Field label="DEWA Premise" value={specs.dewaPremise} />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3">Owner Details</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Field label="Owner Name" value={data?.owner.name || "—"} />
              <Field label="Email" value={data?.owner.email || "—"} />
              <Field label="Service Type" value={data?.owner.serviceType || "—"} />
              <Field label="PM Company" value="CRE L.L.C." />
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase text-white/30 font-bold mb-1">Unit Mix</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(unitsByType).map(([type, count]) => (
                  <span key={type} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs">
                    {type}: <strong className="text-[#E30613]">{count}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick financial snapshot */}
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Annual Rent Roll" value={aed(data.totals.annualRentRoll)} />
          <Mini label="Collected" value={aed(data.totals.collected)} />
          <Mini label="Pending" value={aed(data.totals.pending)} warn={data.totals.pending > 0} />
          <Mini label="Occupancy" value={`${data.totals.totalUnits > 0 ? Math.round((data.totals.occupied / data.totals.totalUnits) * 100) : 0}%`} />
        </div>
      )}

      {/* Amenities */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-4 text-sm font-bold">Building Amenities & Facilities</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {amenities.map((a) => (
            <div key={a.label} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
              <a.icon className="h-5 w-5 text-[#E30613] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">{a.label}</p>
                <p className="text-xs text-white/40">{a.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance & Safety */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-4 text-sm font-bold">Compliance &amp; Safety</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
          <ComplianceRow label="Civil Defense Certificate" value={specs.civilDefense} />
          <ComplianceRow label="Building Insurance" value={specs.insurance} />
          <ComplianceRow label="Municipality Registration" value={specs.municipality} />
          <ComplianceRow label="DEWA Registration" value={`Premise ${specs.dewaPremise}`} />
        </div>
      </section>

      {/* Documents on file */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-4 text-sm font-bold flex items-center gap-2"><FileText className="h-4 w-4 text-[#E30613]" /> Documents on File</h3>
        <div className="space-y-1.5">
          {docs.map((d) => (
            <div key={d.name} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-4 py-2.5">
              <div>
                <p className="text-sm font-medium">{d.name}</p>
                <p className="text-xs text-white/30">{d.date}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                d.status === "Signed" ? "bg-[#E30613]/20 text-[#E30613]" :
                d.status === "Active" || d.status === "Valid" ? "bg-white/10 text-white/70" :
                "bg-white/5 text-white/40"
              }`}>{d.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="text-sm font-bold mb-2">Contact Property Management</h3>
        <p className="text-xs text-white/50">
          For amendments, requests or support regarding your property, contact CRE at{" "}
          <a href="mailto:info@cre.ae" className="text-[#E30613] underline">info@cre.ae</a> or call{" "}
          <a href="tel:+97148004488" className="text-[#E30613] underline">+971 4 800 4488</a>.
        </p>
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-white/30 font-bold">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  )
}
function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? "border-[#E30613]/30 bg-[#E30613]/5" : "border-white/10 bg-white/5"}`}>
      <p className="text-[10px] uppercase text-white/30 font-bold">{label}</p>
      <p className={`text-lg font-bold ${warn ? "text-[#E30613]" : "text-white"}`}>{value}</p>
    </div>
  )
}
function ComplianceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
      <span className="text-white/50">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  )
}
