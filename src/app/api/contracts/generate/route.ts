import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { FEE_STRUCTURE, calculateFee } from '@/lib/fees'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizationId = session.user.organizationId
    const body = await request.json()

    const { unitId, tenantId, contractStart, contractEnd, annualRent, securityDeposit, paymentMode, chequeCount } = body

    if (!unitId || !tenantId) {
      return NextResponse.json(
        { error: 'Unit ID and Tenant ID are required' },
        { status: 400 }
      )
    }

    // Fetch unit
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, organizationId },
    })
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    // Fetch tenant
    const tenant = await prisma.tenant.findFirst({
      where: { id: tenantId, organizationId },
    })
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Fetch organization
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    })

    const rent = annualRent ? parseFloat(annualRent) : unit.currentRent
    const startDate = contractStart || unit.contractStart
    const endDate = contractEnd || unit.contractEnd
    const isCommercial = unit.unitType.toLowerCase().includes('commercial') || unit.unitType.toLowerCase().includes('shop') || unit.unitType.toLowerCase().includes('office')
    const unitTypeKey = isCommercial ? 'commercial' : 'residential'

    // Calculate all CRE fees
    const commissionFee = calculateFee(`new_lease_${unitTypeKey}`, rent)
    const ejariFee = calculateFee('ejari', rent)
    const municipalityFee = calculateFee('municipality', rent)
    const depositAmount = securityDeposit ? parseFloat(securityDeposit) : calculateFee(`security_deposit_${unitTypeKey}`, rent)
    const monthlyRent = rent / 12
    const cheques = chequeCount ? parseInt(chequeCount, 10) : 12
    const perChequeAmount = rent / cheques

    const contractHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tenancy Contract - Unit ${unit.unitNo}</title>
<style>
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #222; max-width: 800px; margin: 0 auto; padding: 40px 60px; }
  h1 { text-align: center; font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 10px; }
  h2 { font-size: 14pt; margin-top: 24px; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .header { text-align: center; margin-bottom: 30px; }
  .header .org-name { font-size: 16pt; font-weight: bold; }
  .parties-table, .fees-table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  .parties-table td, .fees-table td, .fees-table th { border: 1px solid #ccc; padding: 6px 10px; }
  .fees-table th { background: #f5f5f5; text-align: left; }
  .clause { margin: 8px 0; padding-left: 20px; }
  .clause-num { font-weight: bold; }
  .signature-block { margin-top: 60px; display: flex; justify-content: space-between; }
  .sig-line { border-top: 1px solid #333; width: 250px; margin-top: 60px; padding-top: 4px; text-align: center; }
  ol { padding-left: 20px; }
  ol li { margin-bottom: 6px; }
  .footer { text-align: center; margin-top: 40px; font-size: 10pt; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
</style>
</head>
<body>
<div class="header">
  <div class="org-name">${org?.name || 'Property Management'}</div>
  <div>${org?.address || ''}</div>
  <div>${org?.phone || ''} | ${org?.email || ''}</div>
</div>

<h1>TENANCY CONTRACT AGREEMENT</h1>

<p><strong>Contract Date:</strong> ${new Date().toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

<h2>1. PARTIES</h2>
<table class="parties-table">
  <tr><td style="width:140px"><strong>Landlord / Agent</strong></td><td>${org?.name || 'Property Management Company'}</td></tr>
  <tr><td><strong>Address</strong></td><td>${org?.address || 'N/A'}</td></tr>
  <tr><td><strong>Tenant Name</strong></td><td>${tenant.name}</td></tr>
  <tr><td><strong>Emirates ID</strong></td><td>${tenant.emiratesId || 'N/A'}</td></tr>
  <tr><td><strong>Passport No.</strong></td><td>${tenant.passportNo || 'N/A'}</td></tr>
  <tr><td><strong>Nationality</strong></td><td>${tenant.nationality || 'N/A'}</td></tr>
  <tr><td><strong>Phone</strong></td><td>${tenant.phone || 'N/A'}</td></tr>
  <tr><td><strong>Email</strong></td><td>${tenant.email || 'N/A'}</td></tr>
  <tr><td><strong>Emergency Contact</strong></td><td>${tenant.emergencyContactName || 'N/A'} - ${tenant.emergencyContactPhone || 'N/A'}</td></tr>
</table>

<h2>2. PROPERTY DETAILS</h2>
<table class="parties-table">
  <tr><td style="width:140px"><strong>Unit No.</strong></td><td>${unit.unitNo}</td></tr>
  <tr><td><strong>Unit Type</strong></td><td>${unit.unitType || 'Residential'}</td></tr>
  <tr><td><strong>Building/Location</strong></td><td>${org?.name || 'N/A'}</td></tr>
</table>

<h2>3. LEASE TERM</h2>
<table class="parties-table">
  <tr><td style="width:140px"><strong>Start Date</strong></td><td>${startDate}</td></tr>
  <tr><td><strong>End Date</strong></td><td>${endDate}</td></tr>
  <tr><td><strong>Duration</strong></td><td>12 Months (unless otherwise specified)</td></tr>
</table>

<h2>4. FINANCIAL TERMS</h2>
<table class="fees-table">
  <tr><th>Description</th><th>Amount (AED)</th><th>Notes</th></tr>
  <tr><td>Annual Rent</td><td>${rent.toFixed(2)}</td><td>${paymentMode || `${cheques} cheques`}</td></tr>
  <tr><td>Monthly Equivalent</td><td>${monthlyRent.toFixed(2)}</td><td></td></tr>
  <tr><td>Per Cheque Amount</td><td>${perChequeAmount.toFixed(2)}</td><td>${cheques} cheque(s)</td></tr>
  <tr><td>Security Deposit</td><td>${depositAmount.toFixed(2)}</td><td>${FEE_STRUCTURE[`security_deposit_${unitTypeKey}`]?.name || 'Refundable'}</td></tr>
  <tr><td>Commission</td><td>${commissionFee.toFixed(2)}</td><td>${FEE_STRUCTURE[`new_lease_${unitTypeKey}`]?.name || ''}</td></tr>
  <tr><td>EJARI Registration</td><td>${ejariFee.toFixed(2)}</td><td>Mandatory</td></tr>
  <tr><td>Municipality Fee</td><td>${municipalityFee.toFixed(2)}</td><td>Annual</td></tr>
  <tr><td><strong>Total Move-In Cost</strong></td><td><strong>${(depositAmount + commissionFee + ejariFee + municipalityFee + perChequeAmount).toFixed(2)}</strong></td><td>First cheque + fees</td></tr>
</table>

<h2>5. TENANT OBLIGATIONS</h2>
<ol>
  <li>The Tenant shall use the premises solely for ${isCommercial ? 'the commercial purpose agreed upon' : 'residential dwelling'} and shall not change its use without prior written consent.</li>
  <li>The Tenant shall keep the premises in good condition and shall be responsible for any damage caused beyond normal wear and tear.</li>
  <li>The Tenant shall not make any structural alterations, additions, or modifications to the premises without the Landlord's prior written approval.</li>
  <li>The Tenant shall not sublet, assign, or transfer the tenancy or any part thereof without prior written consent from the Landlord/Agent.</li>
  <li>The Tenant shall pay all DEWA (Dubai Electricity and Water Authority) bills, internet, and other utility charges promptly during the tenancy period.</li>
  <li>The Tenant shall maintain the air conditioning units and shall be responsible for regular servicing at their own expense.</li>
  <li>The Tenant shall comply with all building rules, regulations, and community guidelines established by the management.</li>
  <li>The Tenant shall not cause any nuisance, disturbance, or annoyance to neighboring tenants or the general community.</li>
  <li>The Tenant shall allow the Landlord or authorized representatives to inspect the property with at least 24 hours' notice.</li>
  <li>The Tenant shall not keep any pets on the premises without explicit written consent from the Landlord/Agent.</li>
  <li>The Tenant shall return all keys and access cards upon termination or expiry of the tenancy.</li>
  <li>The Tenant shall provide at least 90 days' written notice before the contract expiry date if they intend to vacate.</li>
</ol>

<h2>6. LANDLORD OBLIGATIONS</h2>
<ol>
  <li>The Landlord shall deliver the premises in a clean, habitable, and good condition at the commencement of the lease.</li>
  <li>The Landlord shall be responsible for major structural repairs and maintenance of common areas.</li>
  <li>The Landlord shall not unreasonably disturb the Tenant's peaceful enjoyment of the premises.</li>
  <li>The Landlord shall provide adequate notice before entering the premises for inspection or maintenance.</li>
</ol>

<h2>7. FEES AND PENALTIES</h2>
<table class="fees-table">
  <tr><th>Item</th><th>Amount (AED)</th><th>Beneficiary</th></tr>
  <tr><td>Bounced Cheque Fine</td><td>${calculateFee('bounced_cheque').toFixed(2)}</td><td>Alwaan</td></tr>
  <tr><td>Cheque Replacement Fee</td><td>${calculateFee('cheque_replacement').toFixed(2)}</td><td>Alwaan</td></tr>
  <tr><td>Cheque Postponement Fee</td><td>${calculateFee('cheque_postponement').toFixed(2)}</td><td>Alwaan</td></tr>
  <tr><td>Late Renewal (within 15 days)</td><td>${calculateFee('late_renewal_15').toFixed(2)}</td><td>Alwaan</td></tr>
  <tr><td>Late Renewal (within 30 days)</td><td>${calculateFee('late_renewal_30').toFixed(2)}</td><td>Alwaan</td></tr>
  <tr><td>Early Termination Penalty</td><td>${calculateFee(`early_termination_${unitTypeKey}`, rent).toFixed(2)}</td><td>Landlord</td></tr>
  <tr><td>Name Change / Transfer</td><td>${calculateFee(`name_change_${unitTypeKey}`, rent).toFixed(2)}</td><td>Alwaan</td></tr>
  <tr><td>Certification Letter</td><td>${calculateFee('certification_letter').toFixed(2)}</td><td>Alwaan</td></tr>
</table>

<h2>8. EARLY TERMINATION</h2>
<ol>
  <li>Either party may terminate this contract early by providing a minimum of 2 months' written notice.</li>
  <li>The Tenant shall be liable to pay an early termination penalty equal to ${isCommercial ? '3' : '2'} month(s)' rent (AED ${calculateFee(`early_termination_${unitTypeKey}`, rent).toFixed(2)}) to the Landlord.</li>
  <li>All outstanding DEWA bills, rent, and other charges must be settled before vacating.</li>
  <li>The security deposit shall be refunded after deducting any outstanding amounts, damages, or penalties, within 30 days of vacating.</li>
</ol>

<h2>9. RENEWAL</h2>
<ol>
  <li>The Tenant shall notify the Landlord/Agent of their intention to renew at least 90 days before the contract expiry.</li>
  <li>Renewal terms and rent adjustments shall be mutually agreed upon and are subject to RERA guidelines.</li>
  <li>A renewal fee of AED ${calculateFee(`renewal_${unitTypeKey}`, rent).toFixed(2)} is applicable for processing.</li>
  <li>Failure to initiate renewal within the stipulated time may attract late renewal fees as specified in Section 7.</li>
</ol>

<h2>10. MOVE-OUT PROCEDURES</h2>
<ol>
  <li>The Tenant shall provide 90 days' written notice of intent to vacate.</li>
  <li>The Tenant shall schedule a move-out inspection at least 7 days before the vacating date.</li>
  <li>The premises must be returned in the same condition as received, subject to normal wear and tear.</li>
  <li>All keys, access cards, parking cards, and remote controls must be returned.</li>
  <li>DEWA final bill clearance and NOC from the building management are required.</li>
  <li>The security deposit refund is subject to satisfactory inspection and clearance of all dues.</li>
</ol>

<h2>11. DISPUTE RESOLUTION</h2>
<p>Any disputes arising from this agreement shall first be resolved amicably between the parties. If no resolution is reached, the matter shall be referred to the Rental Dispute Settlement Centre (RDSC) in accordance with the laws of the Emirate.</p>

<h2>12. GOVERNING LAW</h2>
<p>This contract is governed by the laws of the United Arab Emirates, specifically the tenancy laws and regulations of the respective Emirate.</p>

<h2>13. GENERAL PROVISIONS</h2>
<ol>
  <li>This contract constitutes the entire agreement between the parties and supersedes all prior discussions, negotiations, and agreements.</li>
  <li>Any amendment or modification to this contract must be made in writing and signed by both parties.</li>
  <li>If any provision of this contract is found to be unenforceable, the remaining provisions shall continue in full force and effect.</li>
  <li>The Tenant acknowledges having inspected the premises and accepts them in their current condition.</li>
</ol>

<div class="signature-block">
  <div>
    <div class="sig-line">Landlord / Authorized Agent</div>
    <p>${org?.name || ''}</p>
    <p>Date: _________________</p>
  </div>
  <div>
    <div class="sig-line">Tenant</div>
    <p>${tenant.name}</p>
    <p>Date: _________________</p>
  </div>
</div>

<div style="margin-top: 40px;">
  <div style="text-align: center;">
    <div class="sig-line">Witness</div>
    <p>Name: _________________</p>
    <p>Date: _________________</p>
  </div>
</div>

<div class="footer">
  <p>This contract has been prepared by ${org?.name || 'the Property Management Company'}.</p>
  <p>Generated on ${new Date().toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
</div>
</body>
</html>`

    await logActivity(
      organizationId,
      session.user.name,
      'Generated Contract',
      `Contract generated for Unit ${unit.unitNo} - Tenant: ${tenant.name}`
    )

    return NextResponse.json({
      html: contractHtml,
      metadata: {
        unitNo: unit.unitNo,
        tenantName: tenant.name,
        annualRent: rent,
        contractStart: startDate,
        contractEnd: endDate,
        securityDeposit: depositAmount,
        commission: commissionFee,
        ejari: ejariFee,
        municipality: municipalityFee,
        totalMoveInCost: depositAmount + commissionFee + ejariFee + municipalityFee + perChequeAmount,
        chequeCount: cheques,
        perChequeAmount,
        unitType: isCommercial ? 'Commercial' : 'Residential',
      },
    })
  } catch (error) {
    console.error('POST /api/contracts/generate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
