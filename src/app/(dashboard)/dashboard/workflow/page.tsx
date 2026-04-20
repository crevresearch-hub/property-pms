"use client"

import { Building2, Users, ClipboardList, Banknote, Shield, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react"

const sections = [
  {
    title: "Team Structure",
    icon: <Users className="h-5 w-5" />,
    items: [
      { role: "CEO / Owner", duties: "Final approval on renewals, major decisions, financial oversight" },
      { role: "Property Manager", duties: "Day-to-day operations, tenant relations, vendor management, renewals processing" },
      { role: "Accountant", duties: "Invoice generation, payment tracking, cheque management, financial reporting" },
      { role: "Maintenance Coordinator", duties: "Ticket management, vendor coordination, emergency response" },
      { role: "Front Desk / Admin", duties: "Document collection, tenant onboarding, visitor management" },
    ],
  },
  {
    title: "Tenant Lifecycle",
    icon: <RefreshCw className="h-5 w-5" />,
    phases: [
      {
        name: "1. Prospecting & Move-In",
        steps: [
          "Receive inquiry and schedule viewing",
          "Collect tenant documents (Emirates ID, Passport, Visa)",
          "Verify documents and run background checks",
          "Negotiate rent and payment terms",
          "Generate and sign tenancy contract",
          "Collect security deposit + first cheque + fees",
          "Register EJARI",
          "Hand over keys and access cards",
          "Create tenant record in system",
          "Set up DEWA account transfer",
        ],
      },
      {
        name: "2. Active Tenancy",
        steps: [
          "Monthly rent collection (cheque management)",
          "Handle maintenance requests within SLA",
          "DEWA billing and tracking",
          "Document management (renewals of EID, visa, etc.)",
          "Complaint handling and resolution",
          "Violation tracking and fine enforcement",
          "Regular property inspections",
          "Communication and notifications",
        ],
      },
      {
        name: "3. Renewal (90 days before expiry)",
        steps: [
          "Auto-alert: 90-day expiry warning",
          "Contact tenant for renewal intention",
          "Staff evaluates rental increase per RERA index",
          "Staff recommends rent to CEO",
          "CEO approves / adjusts final rent",
          "Tenant accepts or declines",
          "Generate new contract and collect new cheques",
          "Update EJARI registration",
          "Record contract history",
        ],
      },
      {
        name: "4. Move-Out",
        steps: [
          "Receive 90-day written notice",
          "Schedule pre-move-out inspection",
          "Generate move-out checklist",
          "Final inspection and damage assessment",
          "Settle outstanding invoices and DEWA",
          "Cancel EJARI",
          "Collect all keys and access cards",
          "Process security deposit refund (within 30 days)",
          "Update unit status to Vacant",
          "Begin remarketing",
        ],
      },
    ],
  },
  {
    title: "Fee Structure",
    icon: <Banknote className="h-5 w-5" />,
    fees: [
      { name: "New Lease Commission (Residential)", amount: "5% of annual rent (min AED 1,050)", beneficiary: "Alwaan" },
      { name: "New Lease Commission (Commercial)", amount: "10% of annual rent (min AED 1,050)", beneficiary: "Alwaan" },
      { name: "Renewal Fee (Residential)", amount: "AED 850 fixed", beneficiary: "Alwaan" },
      { name: "Renewal Fee (Commercial)", amount: "AED 1,500 fixed", beneficiary: "Alwaan" },
      { name: "EJARI Registration", amount: "AED 250 fixed", beneficiary: "Alwaan" },
      { name: "Municipality Fee", amount: "AED 210 fixed", beneficiary: "Alwaan" },
      { name: "Bounced Cheque Fine", amount: "AED 525 fixed", beneficiary: "Alwaan" },
      { name: "Cheque Replacement", amount: "AED 262.50 fixed", beneficiary: "Alwaan" },
      { name: "Late Renewal (15 days)", amount: "AED 525 fixed", beneficiary: "Alwaan" },
      { name: "Late Renewal (30 days)", amount: "AED 1,050 fixed", beneficiary: "Alwaan" },
      { name: "Early Termination (Residential)", amount: "2 months rent", beneficiary: "Landlord" },
      { name: "Early Termination (Commercial)", amount: "3 months rent", beneficiary: "Landlord" },
      { name: "Security Deposit (Residential)", amount: "5% of annual rent", beneficiary: "Refundable" },
      { name: "Security Deposit (Commercial)", amount: "10% of annual rent", beneficiary: "Refundable" },
    ],
  },
  {
    title: "KPI Targets",
    icon: <CheckCircle className="h-5 w-5" />,
    kpis: [
      { metric: "Occupancy Rate", target: ">= 90%", frequency: "Monthly" },
      { metric: "Renewals On Time", target: ">= 85%", frequency: "Quarterly" },
      { metric: "Expired Contracts", target: "0", frequency: "Daily" },
      { metric: "Complaint Resolution", target: ">= 80%", frequency: "Monthly" },
      { metric: "Document Completeness", target: ">= 90%", frequency: "Weekly" },
      { metric: "Cheque Clearance Rate", target: ">= 95%", frequency: "Monthly" },
      { metric: "Bounced Cheques", target: "0 per month", frequency: "Monthly" },
      { metric: "Open Maintenance", target: "<= 5", frequency: "Daily" },
      { metric: "Violations", target: "<= 3 per month", frequency: "Monthly" },
      { metric: "Vacant Units", target: "<= 2", frequency: "Weekly" },
      { metric: "Pending Fees", target: "<= 5", frequency: "Weekly" },
    ],
  },
  {
    title: "Tenant Rules",
    icon: <Shield className="h-5 w-5" />,
    rules: [
      "No unauthorized modifications to the property",
      "No subletting without written approval",
      "Maintain the property in good condition",
      "Pay rent on time via post-dated cheques",
      "Pay DEWA bills promptly",
      "No pets without written permission",
      "Comply with building community rules",
      "No excessive noise after 10 PM",
      "Proper waste disposal in designated areas",
      "No unauthorized parking",
      "Allow inspections with 24h notice",
      "90 days notice before vacating",
      "Return all keys and access cards on move-out",
      "Professional cleaning required before move-out",
    ],
  },
]

export default function WorkflowPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Operations Workflow</h1>
        <p className="mt-1 text-sm text-slate-400">Complete Alwaan property management operations manual</p>
      </div>

      {sections.map((section, idx) => (
        <div key={idx} className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <span className="text-amber-400">{section.icon}</span>
            {section.title}
          </h2>

          {/* Team Structure */}
          {"items" in section && section.items && (
            <div className="space-y-3">
              {section.items.map((item, i) => (
                <div key={i} className="rounded-lg border border-slate-800 bg-slate-800/30 p-4">
                  <p className="font-medium text-amber-400">{item.role}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.duties}</p>
                </div>
              ))}
            </div>
          )}

          {/* Lifecycle Phases */}
          {"phases" in section && section.phases && (
            <div className="space-y-6">
              {section.phases.map((phase, i) => (
                <div key={i}>
                  <h3 className="mb-3 text-sm font-semibold text-amber-400">{phase.name}</h3>
                  <div className="space-y-1 pl-4">
                    {phase.steps.map((step, j) => (
                      <div key={j} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Fee Structure */}
          {"fees" in section && section.fees && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-slate-400">Fee</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-slate-400">Amount</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-slate-400">Beneficiary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {section.fees.map((fee, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-slate-300">{fee.name}</td>
                      <td className="px-4 py-2 text-amber-400">{fee.amount}</td>
                      <td className="px-4 py-2 text-slate-500">{fee.beneficiary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* KPI Targets */}
          {"kpis" in section && section.kpis && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-slate-400">Metric</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-slate-400">Target</th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase text-slate-400">Frequency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {section.kpis.map((kpi, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-slate-300">{kpi.metric}</td>
                      <td className="px-4 py-2 text-amber-400">{kpi.target}</td>
                      <td className="px-4 py-2 text-slate-500">{kpi.frequency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tenant Rules */}
          {"rules" in section && section.rules && (
            <div className="space-y-2 pl-4">
              {section.rules.map((rule, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="mt-0.5 font-bold text-amber-400">{i + 1}.</span>
                  {rule}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
