import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET /api/tenants/[id]/settlement-summary
//
// Aggregates the financial picture for a tenant at termination time:
//   - annualRent          : from unit.currentRent
//   - securityDeposit     : from the active TenancyContract
//   - rentReceived        : sum of all cleared cheques (cash + cheque) for
//                            this tenant
//   - maintenanceCharges  : sum of Paid VendorBills attached to the unit
//   - otherCredits        : sum of approved cash deposits (org → owner) is
//                            NOT pulled here — that's an org-side action,
//                            not a tenant settlement item.
//
// Returned numbers are best-effort defaults. The modal lets staff override
// any cell before confirming termination.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const organizationId = session.user.organizationId
    const { id } = await params

    const tenant = await prisma.tenant.findFirst({
      where: { id, organizationId },
      include: { units: { select: { id: true, currentRent: true, contractStart: true, contractEnd: true } } },
    })
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const unit = tenant.units[0]
    const annualRent = unit?.currentRent || 0

    const tc = await prisma.tenancyContract.findFirst({
      where: { organizationId, tenantId: id, status: 'Active' },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      select: { securityDeposit: true, contractStart: true, contractEnd: true, rentAmount: true },
    })
    // Prefer contract's rent if set, else fall back to unit.currentRent.
    const finalAnnualRent = tc?.rentAmount && tc.rentAmount > 0 ? tc.rentAmount : annualRent
    const securityDeposit = tc?.securityDeposit || Math.round(finalAnnualRent * 0.05)

    // Rent received needs three sources to be complete:
    //   (1) Full cleared cheques  (status='Cleared')
    //   (2) Partial cheques' individually-cleared PE events (parent stays
    //        at status='Partial' until every PE clears, so we'd otherwise
    //        miss the cash that already cleared)
    //   (3) Replaced parents are skipped — their child row carries the
    //        active state and is already counted via (1).
    const allCheques = await prisma.cheque.findMany({
      where: { organizationId, tenantId: id, status: { not: 'Replaced' } },
      select: { id: true, amount: true, status: true, notes: true },
    })
    let rentReceived = 0
    let partialClearedCount = 0
    for (const c of allCheques) {
      if (c.status === 'Cleared') {
        rentReceived += c.amount || 0
        continue
      }
      if (c.status === 'Partial' && c.notes) {
        // PE:<id>|<date>|<amount>|<method>|<chequeNo>|<bank>|<status>|<bankedDate>
        const peLines = c.notes.matchAll(/(?:^|\n)PE:[^|]*\|[^|]*\|([^|]*)\|[^|]*\|[^|]*\|[^|]*\|([^|]*)\|/g)
        for (const m of peLines) {
          const amt = parseFloat(m[1]) || 0
          const status = (m[2] || '').trim()
          if (status === 'Cleared' && amt > 0) {
            rentReceived += amt
            partialClearedCount += 1
          }
        }
      }
    }

    // Maintenance charges = total of Paid VendorBills linked to this unit.
    // We use unitId scoping (not tenantId) because vendor bills are
    // unit-attached even when the tenant has changed.
    let maintenanceCharges = 0
    if (unit?.id) {
      const bills = await prisma.vendorBill.findMany({
        where: { organizationId, unitId: unit.id, status: 'Paid' },
        select: { totalAmount: true },
      })
      maintenanceCharges = bills.reduce((s, b) => s + (b.totalAmount || 0), 0)
    }

    return NextResponse.json({
      annualRent: finalAnnualRent,
      securityDeposit,
      rentReceived,
      maintenanceCharges,
      // Helpful context for the modal display:
      contractStart: tc?.contractStart || unit?.contractStart || '',
      contractEnd: tc?.contractEnd || unit?.contractEnd || '',
      clearedCount: allCheques.filter((c) => c.status === 'Cleared').length,
      partialClearedCount,
    })
  } catch (error) {
    console.error('GET /api/tenants/[id]/settlement-summary error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
